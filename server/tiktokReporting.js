import { apiError } from './integrationStore.js'

const REPORT_URL = 'https://business-api.tiktok.com/open_api/v2.0/report/integrated/get/'
const METRICS = ['campaign_name', 'spend', 'impressions', 'clicks', 'conversion', 'currency', 'timezone']
const fail = (status, code, message) => Object.assign(apiError(status, message), { code, publicTikTokError: true })
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail(400, 'invalid_date', '조회 기간은 YYYY-MM-DD 형식이어야 합니다.')
  const time = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw fail(400, 'invalid_date', '실제 존재하는 날짜를 입력하세요.')
  return time
}
function decimal(value) {
  // TikTok returns strings; unavailable values must never become a measured zero.
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) ? value : null
}
function count(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const result = Number(value)
  return Number.isSafeInteger(result) ? result : null
}
function pagination(value, page, pageSize) {
  if (!value || value.page !== page || value.page_size !== pageSize
    || !Number.isSafeInteger(value.total_page) || value.total_page < 0
    || !Number.isSafeInteger(value.total_number) || value.total_number < 0
    || (value.total_page > 0 && page > value.total_page)) {
    throw fail(502, 'invalid_response', 'TikTok 보고서의 페이지 정보를 확인할 수 없습니다.')
  }
  return { page, pageSize, totalPages: value.total_page, totalRows: value.total_number, nextPage: page < value.total_page ? page + 1 : null }
}
function normalizeRow(row, advertiserId, startDate, endDate) {
  const campaignId = row?.dimensions?.campaign_id
  const date = row?.dimensions?.stat_time_day
  const metrics = row?.metrics
  if (typeof campaignId !== 'string' || !/^\d+$/.test(campaignId) || typeof date !== 'string' || !metrics
    || !/^\d{4}-\d{2}-\d{2}(?: 00:00:00)?$/.test(date) || date.slice(0, 10) < startDate || date.slice(0, 10) > endDate
    || (metrics.advertiser_id !== undefined && metrics.advertiser_id !== advertiserId)) {
    throw fail(502, 'invalid_response', 'TikTok 보고서의 광고 계정·캠페인·기간을 확인할 수 없습니다.')
  }
  try { day(date.slice(0, 10)) } catch { throw fail(502, 'invalid_response', 'TikTok 보고서 날짜를 확인할 수 없습니다.') }
  return {
    advertiserId, campaignId, date: date.slice(0, 10),
    campaignName: typeof metrics.campaign_name === 'string' ? metrics.campaign_name.slice(0, 500) : null,
    spend: decimal(metrics.spend), impressions: count(metrics.impressions), clicks: count(metrics.clicks), conversions: decimal(metrics.conversion),
    currency: typeof metrics.currency === 'string' && /^[A-Z]{3}$/.test(metrics.currency) ? metrics.currency : null,
    timezone: typeof metrics.timezone === 'string' && /^[A-Za-z0-9_+:/.-]{1,80}$/.test(metrics.timezone) ? metrics.timezone : null,
  }
}

export function createTikTokReporting({ oauth, env = process.env, fetchImpl = fetch, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), audit = async () => {} }) {
  let active = 0, nextStart = 0
  const enabled = () => env.TIKTOK_BUSINESS_REPORTING_ENABLED === 'true'
  async function report(input = {}, actorId) {
    if (!actorId) throw fail(401, 'login_required', '관리자 로그인이 필요합니다.')
    if (!enabled()) throw fail(503, 'approval_required', 'TikTok 보고 권한 승인과 실계정 인증 확인 후 성과 조회를 활성화할 수 있습니다.')
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(400, 'invalid_input', '조회할 광고 계정과 기간을 입력하세요.')
    const { connectionId, advertiserId, startDate, endDate, page = 1, pageSize = 100 } = input
    if (typeof connectionId !== 'string' || !/^advertiser:[a-f0-9]{24}$/.test(connectionId)
      || typeof advertiserId !== 'string' || !/^\d{1,30}$/.test(advertiserId)) throw fail(400, 'invalid_account', '저장된 광고주 연결과 문자열 광고 계정 ID를 선택하세요.')
    const from = day(startDate), to = day(endDate)
    if (to < from || (to - from) / 86400000 >= 30) throw fail(400, 'invalid_range', '조회 기간은 시작일을 포함해 최대 30일입니다.')
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw fail(400, 'invalid_page', '페이지는 양의 정수, 페이지당 건수는 1~100이어야 합니다.')
    const connection = await oauth.getAdvertiserConnection(connectionId, advertiserId)
    if (active >= 2) throw fail(429, 'local_rate_limit', '진행 중인 TikTok 조회가 많습니다. 잠시 후 다시 조회하세요.')
    active++
    try {
      const delay = Math.max(0, nextStart - now())
      nextStart = Math.max(nextStart, now()) + 200
      if (delay) await wait(delay)
      let response, payload
      try {
        response = await fetchImpl(REPORT_URL, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json', 'Access-Token': connection.accessToken },
          body: JSON.stringify({ advertiser_ids: [advertiserId], dimensions: ['campaign_id', 'stat_time_day'], metrics: METRICS, start_date: startDate, end_date: endDate, page, page_size: pageSize }),
        })
      } catch { throw fail(502, 'provider_unavailable', 'TikTok 응답을 받지 못했습니다. 연결 상태를 확인한 뒤 다시 조회하세요.') }
      if (response.status === 429) throw Object.assign(fail(429, 'provider_rate_limit', 'TikTok 호출 한도에 도달했습니다. 잠시 후 다시 조회하세요.'), { retryAfter: Math.ceil(Math.min(120, Math.max(1, Number(response.headers?.get('retry-after')) || 60))) })
      if (response.status === 401 || response.status === 403) throw fail(403, 'authorization_required', 'TikTok 보고 권한과 광고주 계정 인증을 확인하세요.')
      if (!response.ok) throw fail(502, 'provider_unavailable', 'TikTok 보고서를 가져오지 못했습니다. 자동 재시도는 하지 않았습니다.')
      try { payload = await response.json() } catch { throw fail(502, 'invalid_response', 'TikTok 응답 형식을 확인할 수 없습니다.') }
      if (payload?.code !== 0) throw fail(502, 'provider_rejected', 'TikTok이 조회를 거절했습니다. 승인 권한·계정 인증·조회 조건을 확인하세요.')
      const data = payload.data
      if (!Array.isArray(data?.list) || data.list.length > pageSize) throw fail(502, 'invalid_response', 'TikTok 보고서 목록 형식을 확인할 수 없습니다.')
      const pageInfo = pagination(data.page_info, page, pageSize)
      const rows = data.list.map(row => normalizeRow(row, advertiserId, startDate, endDate))
      if (rows.length > pageInfo.totalRows || (!pageInfo.totalPages && rows.length)) throw fail(502, 'invalid_response', 'TikTok 보고서 건수와 페이지 정보가 일치하지 않습니다.')
      const warnings = []
      if (data.extra_info?.uv_invalid) warnings.push('일부 도달 지표를 TikTok에서 제공하지 않았습니다.')
      if (data.extra_info?.search_ads_throttle || pageInfo.totalRows >= 20000) warnings.push('TikTok 동기 보고서의 20,000개 광고 제한에 걸릴 수 있습니다. 전체 데이터로 간주하지 마세요.')
      await audit({ actorId, action: 'tiktok.report.read', targetType: 'tiktok_connection', targetId: connectionId, metadata: { rowCount: rows.length, page, startDate, endDate } })
      return { source: 'TikTok Marketing API v2.0', mode: 'live', collectedAt: new Date(now()).toISOString(), advertiserId, startDate, endDate, rows, pagination: pageInfo, warnings,
        notes: ['날짜는 광고 계정 시간대 기준입니다.', '광고 전환은 TikTok의 귀속 기준이며 UTM 유입·전체 구매 건수와 다를 수 있습니다.', '비용은 각 행의 통화 기준 문자열이며, 미제공 지표는 null입니다.'] }
    } finally { active-- }
  }
  function register(app, requireAdmin) {
    app.post('/admin/tiktok-business/reports', requireAdmin, async (req, res) => {
      res.set('Cache-Control', 'no-store')
      try { res.json({ data: await report(req.body, req.adminUser.id) }) }
      catch (error) {
        if (error.publicTikTokError && error.retryAfter) res.set('Retry-After', String(error.retryAfter))
        res.status(error.publicTikTokError ? error.status : 503).json({ error: error.publicTikTokError ? error.code : 'report_unavailable', message: error.publicTikTokError ? error.message : 'TikTok 보고서 연결을 확인할 수 없습니다.' })
      }
    })
  }
  return { report, register, enabled }
}
