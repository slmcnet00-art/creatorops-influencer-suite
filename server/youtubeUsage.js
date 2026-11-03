import { randomUUID } from 'node:crypto'
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

export function createYouTubeUsage({ getClient, workspaceId, env = process.env, now = () => new Date() }) {
  const limits = { search: Number(env.YOUTUBE_SEARCH_DAILY_LIMIT || 50000), default: Number(env.YOUTUBE_DEFAULT_DAILY_LIMIT || 110000) }
  if (Object.values(limits).some(n => !Number.isSafeInteger(n) || n <= 0)) throw apiError(503, 'YouTube quota limits must be positive integers.')
  async function track(url, invoke) {
    const method = classifyYouTubeRequest(url)
    if (!method) return invoke()
    const client = getClient()
    if (!client) throw apiError(503, 'YouTube API usage storage is unavailable. No upstream request was sent.')
    const time = now(), period = youtubeQuotaPeriod(time)
    const metadata = { schema: 'youtube-usage.v1', ...method, ...period, requestId: randomUUID() }
    // No API keys, URLs, search terms or upstream personal content are retained.
    const { data, error } = await client.from('job_runs').insert({ workspace_id: workspaceId, job_name: 'youtube-api-usage', status: 'running', started_at: time.toISOString(), metadata }).select('id').single()
    if (error) throw apiError(503, 'YouTube usage could not be recorded. No upstream request was sent.')
    let failure
    try {
      const result = await invoke()
      if (result?.ok === false) {
        const payload = await result.clone().json().catch(() => ({}))
        failure = Object.assign(Error(payload?.error?.message || 'Upstream HTTP error'), { status: result.status })
      }
      return result
    } catch (e) { failure = e; throw e } finally {
      const { error: finishError } = await client.from('job_runs').update({ status: failure ? 'failed' : 'success', finished_at: now().toISOString(),
        metadata: { ...metadata, quotaExceeded: Boolean(failure && /quota|daily limit/i.test(failure.message)), httpStatus: failure?.status || (failure ? null : 200) },
      }).eq('workspace_id', workspaceId).eq('id', data.id)
      if (finishError) console.warn('YouTube usage completion metadata unavailable; attempted call remains counted.')
    }
  }
  async function summary() {
    const client = getClient(), period = youtubeQuotaPeriod(now())
    if (!client) throw apiError(503, 'YouTube API usage storage is unavailable.')
    async function count(bucket, field, value, extra = {}) {
      let query = client.from('job_runs').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('job_name', 'youtube-api-usage').eq(`metadata->>${field}`, value).eq('metadata->>bucket', bucket)
      for (const [key, value] of Object.entries(extra)) query = query.eq(key, value)
      const { count, error } = await query
      if (error || count == null) throw apiError(503, 'Usage counts are unavailable; do not assume zero.')
      return count
    }
    const buckets = await Promise.all(['search', 'default'].map(async bucket => {
      const [used, monthUsed, quotaErrors] = await Promise.all([count(bucket, 'day', period.day), count(bucket, 'month', period.month), count(bucket, 'day', period.day, { 'metadata->>quotaExceeded': 'true' })])
      const limit = limits[bucket]
      return { bucket, used, monthUsed, dailyLimit: limit, remaining: Math.max(0, limit - used), percent: Math.round(used / limit * 1000) / 10, level: quotaErrors ? 'upstream-quota-error' : quotaLevel(used, limit), quotaErrors }
    }))
    const { data: first, error: firstError } = await client.from('job_runs').select('started_at').eq('workspace_id', workspaceId).eq('job_name', 'youtube-api-usage').order('started_at', { ascending: true }).limit(1)
    if (firstError) throw apiError(503, 'Usage start time is unavailable.')
    return { ...period, trackingSince: first?.[0]?.started_at || null, timeZone: 'America/Los_Angeles', buckets, thresholds: [80, 95, 100], accounting: 'server-attempts-estimated-units', scope: 'all-users-and-campaigns-in-this-workspace',
      note: '계측 시작 이후의 실제 서버 요청부터 집계합니다.', warning: '기록 시작 전 사용량·다른 서비스의 호출은 포함하지 않습니다. Google Cloud 공식 계측과 차이가 날 수 있습니다.' }
  }
  function register(app, requireAdmin) {
    app.get('/admin/youtube-usage', requireAdmin, async (_req, res, next) => {
      try { res.set('Cache-Control', 'no-store').json({ data: await summary() }) } catch (e) { next(e) }
    })
  }
  return { track, summary, register }
}
