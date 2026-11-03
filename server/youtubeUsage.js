import { createHash } from 'node:crypto'
import { apiError } from './integrationStore.js'

export function youtubeQuotaPeriod(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  return { day: `${parts.year}-${parts.month}-${parts.day}`, month: `${parts.year}-${parts.month}` }
}
export function classifyYouTubeRequest(value) {
  const url = new URL(value)
  if (!['www.googleapis.com', 'youtube.googleapis.com'].includes(url.hostname) || !url.pathname.startsWith('/youtube/v3/')) return null
  const resource = url.pathname.split('/').pop()
  if (!['search', 'channels', 'videos', 'playlistItems', 'playlists', 'commentThreads', 'comments'].includes(resource)) throw apiError(500, 'YouTube quota method is not configured.')
  return { bucket: resource === 'search' ? 'search' : 'default', method: `${resource}.list`, units: 1 }
}
export function quotaLevel(used, limit) { return used >= limit ? 'exhausted' : used >= limit * .95 ? 'critical' : used >= limit * .8 ? 'warning' : 'normal' }

const counterJob = 'youtube-api-usage-daily'
export function createYouTubeUsage({ getClient, workspaceId, env = process.env, now = () => new Date() }) {
  const limits = { search: Number(env.YOUTUBE_SEARCH_DAILY_LIMIT || 50000), default: Number(env.YOUTUBE_DEFAULT_DAILY_LIMIT || 110000) }
  if (Object.values(limits).some(n => !Number.isSafeInteger(n) || n <= 0)) throw apiError(503, 'YouTube quota limits must be positive integers.')
  const queues = new Map()
  async function mutate(period, bucket, change) {
    const hash = createHash('sha256').update(JSON.stringify([workspaceId, period.day, bucket])).digest('hex').slice(0, 12)
    // In JS's exact integer range, far above the normal job sequence. A hash
    // collision is detected by the full scope checks and never overwrites data.
    const id = String(8000000000000000n + BigInt(`0x${hash}`))
    const previous = queues.get(id) || Promise.resolve()
    const task = previous.catch(() => {}).then(async () => {
      const client = getClient()
      if (!client) throw apiError(503, 'YouTube API usage storage is unavailable. No upstream request was sent.')
      for (let attempt = 0; attempt < 12; attempt++) {
        const { data: row, error } = await client.from('job_runs').select('metadata').eq('id', id).eq('workspace_id', workspaceId).eq('job_name', counterJob).maybeSingle()
        if (error) throw apiError(503, 'YouTube usage could not be read. No upstream request was sent.')
        const current = row?.metadata || { schema: 'youtube-usage.daily.v1', ...period, bucket, units: 0, calls: 0, failedCount: 0, quotaErrors: 0, methods: {}, revision: 0 }
        if (current.day !== period.day || current.month !== period.month || current.bucket !== bucket || current.schema !== 'youtube-usage.daily.v1' || ['units', 'calls', 'failedCount', 'quotaErrors', 'revision'].some(k => !Number.isSafeInteger(current[k]) || current[k] < 0)) throw apiError(503, 'YouTube usage counter scope conflict.')
        const next = { ...change(current), revision: current.revision + 1 }
        if (!row) {
          const inserted = await client.from('job_runs').insert({ id, workspace_id: workspaceId, job_name: counterJob, status: 'success', started_at: now().toISOString(), metadata: next })
          if (!inserted.error) return
          if (inserted.error.code !== '23505') throw apiError(503, 'YouTube usage could not be recorded. No upstream request was sent.')
        } else {
          const updated = await client.from('job_runs').update({ metadata: next, finished_at: now().toISOString() }).eq('id', id).eq('workspace_id', workspaceId).eq('job_name', counterJob).eq('metadata', JSON.stringify(current)).select('id').maybeSingle()
          if (updated.error) throw apiError(503, 'YouTube usage could not be updated. No upstream request was sent.')
          if (updated.data) return
        }
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 5))
      }
      throw apiError(503, 'YouTube usage counter is busy. No upstream request was sent.')
    })
    queues.set(id, task)
    try { return await task } finally { if (queues.get(id) === task) queues.delete(id) }
  }
  async function track(url, invoke) {
    const method = classifyYouTubeRequest(url)
    if (!method) return invoke()
    const period = youtubeQuotaPeriod(now())
    // Record before contacting Google. No keys, URLs, search terms or content.
    await mutate(period, method.bucket, m => ({ ...m, calls: m.calls + 1, units: m.units + method.units, methods: { ...m.methods, [method.method]: (m.methods[method.method] || 0) + 1 } }))
    let failure
    try {
      const result = await invoke()
      if (result?.ok === false) {
        const payload = await result.clone().json().catch(() => ({}))
        failure = Object.assign(Error(payload?.error?.message || 'Upstream HTTP error'), { status: result.status })
      }
      return result
    } catch (e) { failure = e; throw e } finally {
      if (failure) {
        try { await mutate(period, method.bucket, m => ({ ...m, failedCount: m.failedCount + 1, quotaErrors: m.quotaErrors + (/quota|daily limit/i.test(failure.message) ? 1 : 0) })) }
        catch { console.warn('YouTube failure metadata unavailable; attempted call remains counted.') }
      }
    }
  }
  async function summary() {
    const client = getClient(), period = youtubeQuotaPeriod(now())
    if (!client) throw apiError(503, 'YouTube API usage storage is unavailable.')
    const { data: daily, error: dailyError } = await client.from('job_runs').select('metadata,started_at').eq('workspace_id', workspaceId).eq('job_name', counterJob).eq('metadata->>month', period.month)
    if (dailyError || (daily || []).some(row => ['units', 'quotaErrors'].some(k => !Number.isSafeInteger(row.metadata?.[k]) || row.metadata[k] < 0))) throw apiError(503, 'Usage counts are unavailable; do not assume zero.')
    // Include the short pre-release per-request instrumentation history. New
    // requests use two small counters per day, not unbounded per-call rows.
    async function legacyCount(bucket, field, value, extra = {}) {
      let query = client.from('job_runs').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('job_name', 'youtube-api-usage').eq(`metadata->>${field}`, value).eq('metadata->>bucket', bucket)
      for (const [key, value] of Object.entries(extra)) query = query.eq(key, value)
      const { count, error } = await query
      if (error || count == null) throw apiError(503, 'Usage counts are unavailable; do not assume zero.')
      return count
    }
    const buckets = await Promise.all(['search', 'default'].map(async bucket => {
      const [oldDay, oldMonth, oldErrors] = await Promise.all([legacyCount(bucket, 'day', period.day), legacyCount(bucket, 'month', period.month), legacyCount(bucket, 'day', period.day, { 'metadata->>quotaExceeded': 'true' })])
      const monthRows = (daily || []).map(r => r.metadata).filter(m => m.bucket === bucket), dayRows = monthRows.filter(m => m.day === period.day)
      const used = oldDay + dayRows.reduce((n, m) => n + m.units, 0), monthUsed = oldMonth + monthRows.reduce((n, m) => n + m.units, 0), quotaErrors = oldErrors + dayRows.reduce((n, m) => n + m.quotaErrors, 0), limit = limits[bucket]
      return { bucket, used, monthUsed, dailyLimit: limit, remaining: Math.max(0, limit - used), percent: Math.round(used / limit * 1000) / 10, level: quotaErrors ? 'upstream-quota-error' : quotaLevel(used, limit), quotaErrors }
    }))
    const firstTimes = await Promise.all([counterJob, 'youtube-api-usage'].map(async job => {
      const { data, error } = await client.from('job_runs').select('started_at').eq('workspace_id', workspaceId).eq('job_name', job).order('started_at', { ascending: true }).limit(1)
      if (error) throw apiError(503, 'Usage start time is unavailable.')
      return data?.[0]?.started_at
    }))
    return { ...period, trackingSince: firstTimes.filter(Boolean).sort()[0] || null, timeZone: 'America/Los_Angeles', buckets, thresholds: [80, 95, 100], accounting: 'server-attempts-estimated-units', scope: 'all-users-and-campaigns-in-this-workspace',
      note: '계측 시작 이후의 실제 서버 요청부터 집계합니다.', warning: '기록 시작 전 사용량·다른 서비스의 호출은 포함하지 않습니다. Google Cloud 공식 계측과 차이가 날 수 있습니다.' }
  }
  function register(app, requireAdmin) {
    app.get('/admin/youtube-usage', requireAdmin, async (_req, res, next) => {
      try { res.set('Cache-Control', 'no-store').json({ data: await summary() }) } catch (e) { next(e) }
    })
  }
  return { track, summary, register }
}
