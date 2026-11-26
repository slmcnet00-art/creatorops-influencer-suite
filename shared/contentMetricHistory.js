export const CONTENT_METRICS = ['views', 'likes', 'comments', 'shares', 'saves']
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export function contentThumbnail(post = {}) {
  const first = post.images?.[0] || post.carousel?.[0] || post.media?.[0]
  const candidate = typeof first === 'string' ? first : first?.imageUrl || first?.display_url || first?.thumbnail_url || first?.url
  return [candidate, post.thumbnailUrl, post.thumbnail_url, post.thumbnail, post.display_url].find(url => /^https?:\/\//i.test(String(url || '')) && !/\.(mp4|mov|webm)(?:[?#]|$)/i.test(url)) || ''
}

export function metricValue(post, field) {
  const value = post?.[field]
  if (post?.metricsPending || ['missing', 'unavailable', 'restricted', 'unverified'].includes(post?.metric_availability?.[field])) return null
  return value !== '' && value !== null && value !== undefined && typeof value !== 'boolean' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
}

export function contentMetricHistory(post, now = Date.now()) {
  const points = new Map()
  for (const point of Array.isArray(post?.metricHistory) ? post.metricHistory : []) {
    const at = Date.parse(point.measuredAt)
    if (!Number.isFinite(at) || at <= now - WINDOW_MS || at > now + 5 * 60 * 1000) continue
    points.set(at, { measuredAt: new Date(at).toISOString(), source: point.source || '', ...Object.fromEntries(CONTENT_METRICS.map(field => [field, metricValue(point, field)])) })
  }
  return [...points.entries()].sort((a, b) => a[0] - b[0]).map(([, point]) => point).slice(-120)
}

export function recordContentMetrics(previous, measurement, now = Date.now()) {
  const refreshStatus = measurement.lastRefreshStatus || measurement.status
  if (refreshStatus && refreshStatus !== 'refreshed' && refreshStatus !== 'manual') return previous
  const measuredAt = measurement.checkedAt || measurement.measuredAt
  if (!Number.isFinite(Date.parse(measuredAt))) return previous
  const observed = measurement.metricHistory?.find(point => Date.parse(point.measuredAt) === Date.parse(measuredAt)) || measurement
  const point = { measuredAt, source: measurement.source || '수동 입력', ...Object.fromEntries(CONTENT_METRICS.map(field => [field, metricValue(observed, field)])) }
  if (CONTENT_METRICS.every(field => point[field] === null)) return previous
  const metrics = Object.fromEntries(CONTENT_METRICS.map(field => [field, metricValue(measurement, field) ?? previous[field]]))
  return { ...previous, ...measurement, ...metrics, title: String(measurement.title || '').trim() ? measurement.title : previous.title,
    status: previous.status, lastRefreshStatus: refreshStatus || previous.lastRefreshStatus, metricsPending: false, sourceCollectedAtIso: measuredAt,
    metricHistory: contentMetricHistory({ metricHistory: [...(previous.metricHistory || []), ...(measurement.metricHistory || []), point] }, now) }
}
