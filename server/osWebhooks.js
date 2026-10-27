import { createHmac, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { apiError, readSettings, updateSettings } from './integrationStore.js'

export const WEBHOOK_EVENTS = ['campaign.created', 'campaign.updated', 'ai.generation.completed', 'ai.generation.failed', 'operation.completed', 'operation.failed']
export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0))
  }
  // Public global-unicast IPv6 only; reject mapped IPv4, local and documentation ranges.
  return isIP(address) === 6 && /^[23]/i.test(address) && !/^2001:(db8|0:|10:|20:)/i.test(address) && !/^2002:/i.test(address)
}
export async function validateWebhookUrl(value, resolve = lookup) {
  if (typeof value !== 'string' || value.length > 2048) throw apiError(400, 'A callback URL of up to 2048 characters is required.')
  let url
  try { url = new URL(value) } catch { throw apiError(400, 'A public HTTPS callback URL is required.') }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash || url.search || url.hostname.toLowerCase().endsWith('.localhost') || url.hostname.toLowerCase() === 'localhost') throw apiError(400, 'Only public HTTPS port 443 callbacks without query credentials are supported.')
  const addresses = await resolve(url.hostname.replace(/^\[|\]$/g, ''), { all: true, verbatim: true })
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw apiError(400, 'Private callback networks are not allowed.')
  return { url, address: addresses[0] }
}
export const webhookSignature = (secret, timestamp, body) => `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
export async function deliverWebhook(url, event, secret) {
  const target = await validateWebhookUrl(url)
  const body = JSON.stringify(event), timestamp = String(Math.floor(Date.now() / 1000))
  // Pin the validated address; never follow redirects or perform a second DNS lookup.
  return new Promise((resolve, reject) => {
    const req = httpsRequest(target.url, { method: 'POST', family: target.address.family, autoSelectFamily: false,
      lookup: (_host, _options, cb) => cb(null, target.address.address, target.address.family),
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
        'X-CreatorOps-Event-Id': event.id, 'X-CreatorOps-Timestamp': timestamp,
        'X-CreatorOps-Signature': webhookSignature(secret, timestamp, body) },
    }, res => {
      res.resume()
      if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.statusCode)
      else reject(Object.assign(apiError(502, `Webhook destination returned HTTP ${res.statusCode}.`), { deliveryStatus: res.statusCode }))
    })
    req.setTimeout(10000, () => req.destroy(new Error('Webhook delivery timed out.')))
    req.on('error', reject)
    req.end(body)
  })
}

export function createOsWebhooks({ getClient, workspaceId, env = process.env, send = deliverWebhook, audit = async () => {} }) {
  let busy = false
  async function config() { return (await readSettings(getClient(), workspaceId)).settings?.osWebhook || { enabled: false, events: [], url: '' } }
  async function publish(type, data) {
    const destination = await config()
    if (!destination.enabled || !destination.events.includes(type)) return { queued: false, reason: 'subscription-not-enabled' }
    const event = { id: randomUUID(), type, workspaceId, occurredAt: new Date().toISOString(), data }
    const { error } = await getClient().from('job_runs').insert({ workspace_id: workspaceId, job_name: 'os-webhook-delivery', status: 'running', detail: type,
      metadata: { state: 'pending', attempts: 0, nextAttemptAt: new Date().toISOString(), url: destination.url, event } })
    if (error) throw error
    return { queued: true, eventId: event.id }
  }
  async function drain() {
    if (busy || !getClient() || String(env.CREATOROPS_OS_WEBHOOK_SECRET || '').length < 32) return
    busy = true
    try {
      const destination = await config()
      if (!destination.enabled) return
      const { data, error } = await getClient().from('job_runs').select('id,metadata').eq('workspace_id', workspaceId).eq('job_name', 'os-webhook-delivery').eq('status', 'running').order('id').limit(100)
      if (error) throw error
      for (const row of data || []) {
        const meta = row.metadata || {}, now = Date.now()
        if (Date.parse(meta.nextAttemptAt) > now || Date.parse(meta.lockUntil) > now) continue
        if (!['pending', 'sending'].includes(meta.state)) continue
        const claimed = { ...meta, state: 'sending', lockUntil: new Date(now + 60000).toISOString(), attempts: Number(meta.attempts || 0) + 1 }
        const lock = getClient().from('job_runs').update({ metadata: claimed }).eq('id', row.id).eq('workspace_id', workspaceId).eq('status', 'running').eq('metadata', JSON.stringify(meta))
        const { data: acquired, error: claimError } = await lock.select('id').maybeSingle()
        if (claimError) throw claimError
        if (!acquired) continue
        try {
          if (destination.url !== meta.url || !destination.events.includes(meta.event?.type)) throw apiError(409, 'Subscription changed; old event delivery is disabled.')
          const status = await send(meta.url, meta.event, env.CREATOROPS_OS_WEBHOOK_SECRET)
          const { error } = await getClient().from('job_runs').update({ status: 'success', metadata: { ...claimed, state: 'delivered', httpStatus: status }, finished_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('id', row.id)
          if (error) throw error
        } catch (error) {
          const terminal = claimed.attempts >= 5 || error.status === 409
          const { error: writeError } = await getClient().from('job_runs').update({ status: terminal ? 'failed' : 'running',
            metadata: { ...claimed, state: terminal ? 'failed' : 'pending', lockUntil: null, lastError: 'Delivery failed; inspect destination availability and subscription.', lastHttpStatus: Number(error.deliveryStatus) || null,
              nextAttemptAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** claimed.attempts)).toISOString() },
            finished_at: terminal ? new Date().toISOString() : null,
          }).eq('workspace_id', workspaceId).eq('id', row.id)
          if (writeError) throw writeError
        }
      }
    } finally { busy = false }
  }
  function register(app, access) {
    const wrap = fn => async (req, res, next) => { try { res.set('Cache-Control', 'no-store'); await fn(req, res) } catch (error) { next(error) } }
    app.get('/os-bridge/v1/webhook', access, wrap(async (_req, res) => res.json({ data: { ...(await config()), supportedEvents: WEBHOOK_EVENTS, signingConfigured: String(env.CREATOROPS_OS_WEBHOOK_SECRET || '').length >= 32 } })))
    app.put('/os-bridge/v1/webhook', access, wrap(async (req, res) => {
      const { url, events, enabled } = req.body || {}
      if (typeof enabled !== 'boolean' || !Array.isArray(events) || events.some(e => !WEBHOOK_EVENTS.includes(e))) throw apiError(400, 'Provide enabled and supported events.')
      if (enabled && String(env.CREATOROPS_OS_WEBHOOK_SECRET || '').length < 32) throw apiError(503, 'Webhook signing is not configured.')
      if (enabled || url) await validateWebhookUrl(url)
      const value = { url: String(url || ''), events: [...new Set(events)], enabled, updatedAt: new Date().toISOString() }
      await updateSettings(getClient(), workspaceId, settings => ({ ...settings, osWebhook: value }))
      await audit({ actorId: req.osActor?.id, action: 'os.webhook.configured', targetType: 'integration', targetId: 'company-os', metadata: { enabled, events: value.events, hostname: url ? new URL(url).hostname : null } })
      res.json({ data: value })
    }))
    app.get('/os-bridge/v1/webhook/deliveries', access, wrap(async (_req, res) => {
      const { data, error } = await getClient().from('job_runs').select('id,status,metadata,started_at,finished_at').eq('workspace_id', workspaceId).eq('job_name', 'os-webhook-delivery').order('id', { ascending: false }).limit(100)
      if (error) throw error
      res.json({ data: { deliveries: (data || []).map(r => ({ id: r.id, eventId: r.metadata?.event?.id, type: r.metadata?.event?.type, status: r.status, attempts: r.metadata?.attempts, httpStatus: r.metadata?.httpStatus ?? r.metadata?.lastHttpStatus ?? null, nextAttemptAt: r.metadata?.nextAttemptAt, error: r.metadata?.lastError, createdAt: r.started_at })) } })
    }))
  }
  function start() {
    const timer = setInterval(() => drain().catch(() => console.warn('OS webhook dispatcher failed; pending deliveries remain in DB.')), 30000)
    timer.unref()
    return timer
  }
  return { register, publish, drain, start }
}
