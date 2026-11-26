import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createTikTokBusinessOAuth } from '../server/tiktokBusinessOAuth.js'

function setup() {
  let time = 1000000, value = { pending: {}, connections: {} }
  const requests = []
  const env = { TIKTOK_BUSINESS_APP_ID: '7667107420862152705', TIKTOK_BUSINESS_APP_SECRET: 'test-secret', TIKTOK_BUSINESS_ACCOUNT_SCOPES: 'test-approved-scope' }
  const service = createTikTokBusinessOAuth({ workspaceId: 'test', env, now: () => time,
    store: { read: async () => structuredClone(value), update: async fn => { const next = structuredClone(value); fn(next); value = next } },
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ code: 0, data: { access_token: 'test-access-token', refresh_token: 'test-refresh-token', advertiser_ids: ['1234567890123456789'], open_id: 'test-open-id', scope: ['test-approved-scope'], expires_in: 3600 } }) }
    },
  })
  return { service, requests, env, advance: ms => { time += ms } }
}

test('광고주 인증 주소는 등록 주소와 일치하며 Secret을 URL에 넣지 않는다', async () => {
  const { service } = setup()
  const result = await service.begin('advertiser', 'owner')
  const url = new URL(result.url)
  assert.equal(url.origin, 'https://business-api.tiktok.com')
  assert.equal(url.searchParams.get('app_id'), '7667107420862152705')
  assert.equal(url.searchParams.get('redirect_uri'), service.registration.advertiserRedirectUrl)
  assert.match(url.searchParams.get('state'), /^[a-f0-9]{64}$/)
  assert.doesNotMatch(result.url, /test-secret/)
  await assert.rejects(service.begin('advertiser', null), { status: 401 })
})

test('state 불일치·만료·다른 인증 종류·재사용을 거부하고 토큰 교환을 중복 실행하지 않는다', async () => {
  const fixture = setup(), { service, requests } = fixture
  const url = new URL((await service.begin('advertiser', 'owner')).url), state = url.searchParams.get('state')
  await assert.rejects(service.complete('advertiser', { auth_code: 'code', state: 'a'.repeat(64) }), { status: 400 })
  await assert.rejects(service.complete('account', { auth_code: 'code', state }), { status: 400 })
  assert.equal(requests.length, 0)
  await service.complete('advertiser', { auth_code: 'code', state })
  await assert.rejects(service.complete('advertiser', { auth_code: 'code', state }), { status: 400 })
  assert.equal(requests.length, 1)
  const nextState = new URL((await service.begin('advertiser', 'owner')).url).searchParams.get('state')
  fixture.advance(600001)
  await assert.rejects(service.complete('advertiser', { auth_code: 'code', state: nextState }), { status: 400 })
  assert.equal(requests.length, 1)
})

test('계정 인증은 별도 redirect·토큰 API를 사용하고 상태 조회에 토큰을 노출하지 않는다', async () => {
  const { service, requests } = setup()
  const url = new URL((await service.begin('account', 'owner')).url)
  assert.equal(url.origin, 'https://www.tiktok.com')
  assert.equal(url.searchParams.get('scope'), 'test-approved-scope')
  assert.equal(url.searchParams.get('redirect_uri'), service.registration.accountRedirectUrl)
  await service.complete('account', { code: 'account-code', state: url.searchParams.get('state') })
  assert.match(requests[0].url, /tt_user\/oauth2\/token\/$/)
  assert.equal(requests[0].body.client_id, '7667107420862152705')
  assert.equal(requests[0].body.redirect_uri, service.registration.accountRedirectUrl)
  assert.doesNotMatch(JSON.stringify(await service.status()), /test-access-token|test-refresh-token|test-secret/)
})

test('동일 state의 동시 콜백도 한 번만 교환하며 미설정 계정 권한은 임의 요청하지 않는다', async () => {
  const { service, requests, env } = setup()
  const state = new URL((await service.begin('advertiser', 'owner')).url).searchParams.get('state')
  const results = await Promise.allSettled([service.complete('advertiser', { auth_code: 'x', state }), service.complete('advertiser', { auth_code: 'x', state })])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(requests.length, 1)
  env.TIKTOK_BUSINESS_ACCOUNT_SCOPES = ''
  await assert.rejects(service.begin('account', 'owner'), { status: 503 })
  const stateInfo = await service.status()
  assert.equal(stateInfo.configured, true)
  assert.equal(stateInfo.accountAuthorizationReady, false)
})

test('등록 콜백은 HTTPS 주소를 제공하고 일반 방문·오류 페이지에 인증 코드를 반사하지 않는다', async t => {
  const { service } = setup(), app = express()
  service.register(app, (_req, res) => res.sendStatus(401))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const registration = await (await fetch(`${base}/oauth/tiktok/registration`)).json()
  assert.match(registration.data.advertiserRedirectUrl, /^https:\/\/creatorops-suite-api.onrender.com/)
  for (const kind of ['advertiser', 'account']) {
    const page = await fetch(`${base}/oauth/tiktok/${kind}/callback`)
    assert.equal(page.status, 200)
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer')
    const bad = await fetch(`${base}/oauth/tiktok/${kind}/callback?code=private-code`)
    assert.equal(bad.status, 400)
    assert.doesNotMatch(await bad.text(), /private-code/)
    assert.equal((await fetch(`${base}/oauth/tiktok/${kind}/auth-url`)).status, 401)
  }
})

test('서버 성과 조회는 연결에 실제 승인된 계정만 사용하고 만료 토큰을 거부한다', async () => {
  const fixture = setup(), { service } = fixture
  const state = new URL((await service.begin('advertiser', 'owner')).url).searchParams.get('state')
  await service.complete('advertiser', { auth_code: 'code', state })
  const status = await service.status(), id = status.connections[0].id
  assert.equal(status.reportingEnabled, false)
  assert.equal(status.connections[0].authenticationState, 'stored')
  assert.equal((await service.getAdvertiserConnection(id, '1234567890123456789')).accessToken, 'test-access-token')
  for (const [key, advertiser] of [[id, '999'], ['__proto__', '1234567890123456789']]) {
    await assert.rejects(service.getAdvertiserConnection(key, advertiser), { status: 403, code: 'account_not_authorized' })
  }
  fixture.advance(3600000)
  await assert.rejects(service.getAdvertiserConnection(id, '1234567890123456789'), { status: 403, code: 'authorization_expired' })
  assert.equal((await service.status()).connections[0].authenticationState, 'expired')
  assert.doesNotMatch(JSON.stringify(await service.status()), /test-access-token|test-refresh-token|test-secret/)
})
