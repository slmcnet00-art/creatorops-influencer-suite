import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createTikTokReporting } from '../server/tiktokReporting.js'
import { createTikTokBusinessOAuth } from '../server/tiktokBusinessOAuth.js'

const INPUT = { connectionId: `advertiser:${'a'.repeat(24)}`, advertiserId: '1234567890123456789', startDate: '2026-11-01', endDate: '2026-11-03' }
const ROW = { dimensions: { campaign_id: '9876543210987654321', stat_time_day: '2026-11-01 00:00:00' }, metrics: { campaign_name: '테스트 캠페인', spend: '12.30', impressions: '100', clicks: '0', conversion: '1.5', currency: 'JPY', timezone: 'Asia/Tokyo' } }
const body = (list = [structuredClone(ROW)], pagination = {}) => ({ code: 0, data: { list, page_info: { page: 1, page_size: 100, total_page: 1, total_number: list.length, ...pagination } } })
function setup({ enabled = true, response, connection, fetchImpl } = {}) {
  const requests = [], credentials = [], audits = [], waits = []
  const env = { TIKTOK_BUSINESS_REPORTING_ENABLED: enabled ? 'true' : 'false' }
  const service = createTikTokReporting({ env, now: () => Date.parse('2026-11-05T00:00:00Z'), wait: async ms => { waits.push(ms) },
    oauth: { getAdvertiserConnection: async (...args) => { credentials.push(args); if (connection) return connection(...args); return { accessToken: 'private-access-token' } } },
    audit: async event => { audits.push(event) },
    fetchImpl: async (...args) => { requests.push(args); return fetchImpl ? fetchImpl(...args) : response || { ok: true, status: 200, json: async () => body() } },
  })
  return { service, requests, credentials, audits, waits, env }
}

test('승인 전 기본 차단: 로그인·기능 활성화 전에는 저장소와 TikTok을 호출하지 않는다', async () => {
  const { service, requests, credentials } = setup({ enabled: false })
  await assert.rejects(service.report(INPUT), { status: 401, code: 'login_required' })
  await assert.rejects(service.report(INPUT, 'owner'), { status: 503, code: 'approval_required' })
  assert.equal(requests.length, 0)
  assert.equal(credentials.length, 0)
  const enabled = setup().service
  for (const input of [null, [], 'invalid']) await assert.rejects(enabled.report(input, 'owner'), { status: 400, code: 'invalid_input' })
})

test('고정 v2.0 보고 엔드포인트만 호출하고 토큰은 헤더에만 사용하며 기간·통화를 보존한다', async () => {
  const { service, requests, audits } = setup()
  const result = await service.report({ ...INPUT, url: 'https://attacker.example', token: 'ignored-token' }, 'owner')
  assert.equal(requests.length, 1)
  const [url, options] = requests[0]
  assert.equal(url, 'https://business-api.tiktok.com/open_api/v2.0/report/integrated/get/')
  assert.equal(options.method, 'POST')
  assert.equal(options.redirect, 'error')
  assert.equal(options.headers['Access-Token'], 'private-access-token')
  assert.deepEqual(JSON.parse(options.body).advertiser_ids, [INPUT.advertiserId])
  assert.deepEqual(JSON.parse(options.body).dimensions, ['campaign_id', 'stat_time_day'])
  assert.doesNotMatch(url + options.body + JSON.stringify(result) + JSON.stringify(audits), /private-access-token|ignored-token/)
  assert.equal(result.mode, 'live')
  assert.equal(result.rows[0].campaignId, ROW.dimensions.campaign_id)
  assert.equal(result.rows[0].spend, '12.30')
  assert.equal(result.rows[0].conversions, '1.5')
  assert.equal(result.rows[0].currency, 'JPY')
  assert.equal(result.rows[0].timezone, 'Asia/Tokyo')
  assert.equal(result.rows[0].date, '2026-11-01')
  assert.equal(audits[0].metadata.rowCount, 1)
})

test('결측값을 0으로 만들지 않고 진짜 0·소수 전환·안전 정수 초과를 구분한다', async () => {
  const row = structuredClone(ROW)
  Object.assign(row.metrics, { spend: '-', impressions: '9007199254740993', conversion: '-', currency: '-', timezone: '-' })
  const { service } = setup({ response: { ok: true, status: 200, json: async () => body([row]) } })
  const result = await service.report(INPUT, 'owner')
  assert.equal(result.rows[0].spend, null)
  assert.equal(result.rows[0].impressions, null)
  assert.equal(result.rows[0].clicks, 0)
  assert.equal(result.rows[0].conversions, null)
  assert.equal(result.rows[0].currency, null)
})

test('잘못된 계정 ID·실재하지 않는 날짜·30일 초과·페이지 입력은 외부 호출 전 거부한다', async () => {
  const { service, requests, credentials } = setup()
  for (const patch of [
    { advertiserId: Number(INPUT.advertiserId) }, { connectionId: '__proto__' }, { advertiserId: 'other' },
    { startDate: '2026-02-30' }, { startDate: '2026-11-04' }, { endDate: '2026-12-01' },
    { page: '2' }, { pageSize: 101 }, { pageSize: 0 },
  ]) await assert.rejects(service.report({ ...INPUT, ...patch }, 'owner'), { status: 400 })
  assert.equal(requests.length, 0)
  assert.equal(credentials.length, 0)
})

test('승인되지 않은 계정과 만료 인증은 토큰 조회 단계에서 차단하고 TikTok 호출을 하지 않는다', async () => {
  for (const code of ['account_not_authorized', 'authorization_expired']) {
    const { service, requests } = setup({ connection: () => { throw Object.assign(new Error('인증 확인 필요'), { status: 403, code }) } })
    await assert.rejects(service.report(INPUT, 'owner'), { status: 403, code })
    assert.equal(requests.length, 0)
  }
})

test('페이지를 자동 순회하지 않고 다음 페이지와 부분 결과 경고를 반환한다', async () => {
  const payload = body([structuredClone(ROW)], { page: 2, total_page: 3, total_number: 201 })
  payload.data.extra_info = { uv_invalid: 'provider detail', search_ads_throttle: 'provider detail' }
  const { service, requests } = setup({ response: { ok: true, status: 200, json: async () => payload } })
  const result = await service.report({ ...INPUT, page: 2 }, 'owner')
  assert.equal(result.pagination.nextPage, 3)
  assert.equal(result.pagination.totalRows, 201)
  assert.equal(result.warnings.length, 2)
  assert.equal(requests.length, 1)
  assert.doesNotMatch(JSON.stringify(result), /provider detail/)
})

test('정상 빈 결과를 인증 오류와 구분한다', async () => {
  const { service } = setup({ response: { ok: true, status: 200, json: async () => body([], { total_page: 0 }) } })
  const result = await service.report(INPUT, 'owner')
  assert.deepEqual(result.rows, [])
  assert.equal(result.pagination.nextPage, null)
})

test('호출 제한·권한 오류·5xx·비정상 응답은 자동 재시도하지 않고 민감한 원문을 숨긴다', async () => {
  for (const [status, code] of [[429, 'provider_rate_limit'], [401, 'authorization_required'], [403, 'authorization_required'], [500, 'provider_unavailable']]) {
    const { service, requests } = setup({ response: { ok: false, status, headers: new Headers({ 'retry-after': '3' }), json: async () => ({ message: 'private-access-token' }) } })
    await assert.rejects(service.report(INPUT, 'owner'), error => {
      assert.equal(error.code, code)
      assert.doesNotMatch(error.message, /private-access-token/)
      if (status === 429) assert.equal(error.retryAfter, 3)
      return true
    })
    assert.equal(requests.length, 1)
  }
  for (const json of [async () => { throw Error('private-access-token') }, async () => ({ code: 40001, message: 'private-access-token' }), async () => null]) {
    const { service, requests } = setup({ response: { ok: true, status: 200, json } })
    await assert.rejects(service.report(INPUT, 'owner'), error => error.status === 502 && !error.message.includes('private-access-token'))
    assert.equal(requests.length, 1)
  }
})

test('다른 계정·조회 기간 밖·잘못된 페이지의 응답을 정상 성과로 반환하지 않는다', async () => {
  for (const mutate of [
    payload => { payload.data.list[0].metrics.advertiser_id = '999' },
    payload => { payload.data.list[0].dimensions.stat_time_day = '2026-10-31' },
    payload => { payload.data.list[0].dimensions.campaign_id = 9876543210987654321 },
    payload => { payload.data.page_info.page = 2 },
    payload => { payload.data.page_info.total_number = 0 },
  ]) {
    const payload = body(); mutate(payload)
    const { service } = setup({ response: { ok: true, status: 200, json: async () => payload } })
    await assert.rejects(service.report(INPUT, 'owner'), { status: 502, code: 'invalid_response' })
  }
})

test('네트워크·타임아웃 실패를 안전하게 처리하고 다음 조회를 막는 잠금을 남기지 않는다', async () => {
  let attempt = 0
  const { service, requests } = setup({ fetchImpl: async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal)
    if (attempt++ === 0) throw new DOMException('private-access-token', 'TimeoutError')
    return { ok: true, status: 200, json: async () => body() }
  } })
  await assert.rejects(service.report(INPUT, 'owner'), error => error.code === 'provider_unavailable' && !error.message.includes('private-access-token'))
  assert.equal(requests.length, 1)
  assert.equal((await service.report(INPUT, 'owner')).rows.length, 1)
  assert.equal(requests.length, 2)
})

test('동시 조회를 제한하고 요청 시작 사이에 간격을 둔다', async () => {
  const release = []
  const { service, requests, waits } = setup({ fetchImpl: () => new Promise(resolve => release.push(() => resolve({ ok: true, status: 200, json: async () => body() }))) })
  const first = service.report(INPUT, 'owner'), second = service.report(INPUT, 'owner')
  await new Promise(resolve => setImmediate(resolve))
  await assert.rejects(service.report(INPUT, 'owner'), { status: 429, code: 'local_rate_limit' })
  assert.equal(requests.length, 2)
  assert.deepEqual(waits, [200])
  release.forEach(fn => fn())
  await Promise.all([first, second])
})

test('보고서 API는 관리자만 접근하며 실패와 성공 응답에 캐시·토큰 노출을 방지한다', async t => {
  const fixture = setup(), app = express()
  app.use(express.json())
  fixture.service.register(app, (req, res, next) => {
    if (req.headers.authorization !== 'Bearer test-admin') return res.sendStatus(401)
    req.adminUser = { id: 'owner' }; next()
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/admin/tiktok-business/reports`
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(INPUT) }
  assert.equal((await fetch(url, options)).status, 401)
  assert.equal(fixture.requests.length, 0)
  const ok = await fetch(url, { ...options, headers: { ...options.headers, Authorization: 'Bearer test-admin' } })
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('cache-control'), 'no-store')
  assert.doesNotMatch(await ok.text(), /private-access-token/)
  fixture.env.TIKTOK_BUSINESS_REPORTING_ENABLED = 'false'
  const blocked = await fetch(url, { ...options, headers: { ...options.headers, Authorization: 'Bearer test-admin' } })
  assert.equal(blocked.status, 503)
  assert.equal((await blocked.json()).error, 'approval_required')
})

test('저장소 오류의 코드·메시지·토큰은 API 응답에 노출하지 않는다', async t => {
  const { service } = setup({ connection: () => { throw Object.assign(Error('DB failure private-access-token'), { code: 'DATABASE_ERROR', status: 400 }) } })
  const app = express(); app.use(express.json())
  service.register(app, (req, _res, next) => { req.adminUser = { id: 'owner' }; next() })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const result = await fetch(`http://127.0.0.1:${server.address().port}/admin/tiktok-business/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(INPUT) })
  assert.equal(result.status, 503)
  assert.deepEqual(await result.json(), { error: 'report_unavailable', message: 'TikTok 보고서 연결을 확인할 수 없습니다.' })
})

test('모의 통합 흐름: 인증 시작→콜백 저장→상태 조회→승인 전 차단→명시 활성화 후 한 페이지 보고', async t => {
  let vault = { pending: {}, connections: {} }
  const requests = [], env = { TIKTOK_BUSINESS_APP_ID: 'test-app', TIKTOK_BUSINESS_APP_SECRET: 'test-secret' }
  const fetchImpl = async (url, options) => {
    requests.push({ url, body: options.body })
    return { ok: true, status: 200, json: async () => url.includes('/oauth2/access_token/')
      ? { code: 0, data: { access_token: 'integration-private-token', advertiser_ids: [INPUT.advertiserId], expires_in: 3600 } }
      : body() }
  }
  const oauth = createTikTokBusinessOAuth({ env, fetchImpl, workspaceId: 'test', store: {
    read: async () => structuredClone(vault), update: async fn => { const next = structuredClone(vault); fn(next); vault = next },
  } })
  const app = express(); app.use(express.json())
  const admin = (req, res, next) => { if (req.headers.authorization !== 'Bearer test-admin') return res.sendStatus(401); req.adminUser = { id: 'owner' }; next() }
  oauth.register(app, admin)
  createTikTokReporting({ oauth, env, fetchImpl }).register(app, admin)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`, headers = { Authorization: 'Bearer test-admin', 'Content-Type': 'application/json' }
  const start = await (await fetch(`${base}/oauth/tiktok/advertiser/auth-url`, { headers })).json()
  const state = new URL(start.data.url).searchParams.get('state')
  const callback = await fetch(`${base}/oauth/tiktok/advertiser/callback?auth_code=mock-code&state=${state}`)
  assert.equal(callback.status, 200)
  const status = await (await fetch(`${base}/admin/tiktok-business/status`, { headers })).json()
  assert.equal(status.data.connections.length, 1)
  assert.equal(status.data.reportingEnabled, false)
  assert.doesNotMatch(JSON.stringify(status), /integration-private-token|test-secret/)
  const options = { method: 'POST', headers, body: JSON.stringify({ ...INPUT, connectionId: status.data.connections[0].id }) }
  assert.equal((await fetch(`${base}/admin/tiktok-business/reports`, options)).status, 503)
  assert.equal(requests.length, 1)
  env.TIKTOK_BUSINESS_REPORTING_ENABLED = 'true' // Test-only approval simulation, not a production configuration change.
  const result = await fetch(`${base}/admin/tiktok-business/reports`, options)
  assert.equal(result.status, 200)
  const report = await result.json()
  assert.equal(report.data.rows.length, 1)
  assert.equal(report.data.rows[0].campaignId, ROW.dimensions.campaign_id)
  assert.equal(requests.length, 2)
  assert.doesNotMatch(JSON.stringify(report), /integration-private-token|test-secret|mock-code/)
  const otherAccount = await fetch(`${base}/admin/tiktok-business/reports`, { ...options, body: JSON.stringify({ ...INPUT, connectionId: status.data.connections[0].id, advertiserId: '999' }) })
  assert.equal(otherAccount.status, 403)
  assert.equal((await otherAccount.json()).error, 'account_not_authorized')
  assert.equal(requests.length, 2)
})
