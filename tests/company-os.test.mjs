import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { apiError, matchesSecret } from '../server/integrationStore.js'
import { createCompanyOs, campaignReport, validateCampaignPatch } from '../server/companyOs.js'
import {isOsDiscoveryRead} from '../server/osDiscoveryAccess.js'
import { memorySupabase } from './helpers/memorySupabase.mjs'

const token = 'company-os-test-secret-'.repeat(3), version = '2026-01-01T00:00:00.000Z'
function fixture() {
  return memorySupabase({ workspaces: [{ id: 'test', settings: {}, updated_at: version }],
    workspace_snapshots: [{ workspace_id: 'test', payload: { brands: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], campaigns: [{ id: 'stale', brandId: 'a' }] }, updated_at: version }],
    brand_scoped_snapshots: [{ workspace_id: 'test', brand_id: 'a', updated_at: version, payload: { brandId: 'a', brand: { id: 'a', name: 'A' }, campaigns: [], trackedPosts: [] } }],
  })
}
async function start(t, client) {
  const app = express(); app.use(express.json())
  const service = createCompanyOs({ getClient: () => client, workspaceId: 'test', env: { CREATOROPS_OS_API_TOKEN: token },
    requireAdmin: (req, _res, next) => next(Object.assign(Error('not admin'), { status: req.headers.authorization ? 403 : 401 })),
  })
  service.register(app)
  app.use((e, _req, res, _next) => res.status(e.status || 500).json({ error: e.message }))
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}/os-bridge/v1`
  return async (path, options = {}) => {
    const res = await fetch(base + path, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } })
    return { status: res.status, body: await res.json() }
  }
}
test('OS API는 별도 서비스 키가 필요하고 scoped 삭제를 오래된 전체 스냅샷으로 복구하지 않는다', async t => {
  const call = await start(t, fixture())
  assert.equal((await call('/campaigns', { headers: { Authorization: '' } })).status, 401)
  assert.equal((await call('/campaigns', { headers: { Authorization: 'Bearer learning-only-key' } })).status, 403)
  assert.deepEqual((await call('/campaigns')).body.data.campaigns, [])
  assert.equal((await call('/brands')).body.data.brands.find(b => b.id === 'a').writable, true)
})
test('캠페인 생성/수정은 버전과 멱등키를 검증하고 계획을 실적으로 바꾸지 않는다', async t => {
  const client = fixture(), call = await start(t, client)
  const create = { method: 'POST', headers: { 'Idempotency-Key': 'request-1', 'If-Match': version }, body: JSON.stringify({ brandId: 'a', campaign: { name: 'OS 캠페인', budget: 5000000, targetRevenue: 10000000, targetMarkets: ['JP', 'US'] } }) }
  assert.equal((await call('/campaigns', { ...create, headers: { 'Idempotency-Key': 'no-version' } })).status, 428)
  const first = await call('/campaigns', create)
  assert.equal(first.status, 201)
  assert.equal((await call('/campaigns', create)).body.data.duplicate, true)
  assert.equal((await call('/campaigns', { ...create, body: JSON.stringify({ brandId: 'a', campaign: { name: '다른 입력' } }) })).status, 409)
  const id = first.body.data.campaign.id
  assert.equal(Number.isSafeInteger(id), true)
  assert.equal(first.body.data.campaign.status, '섭외')
  assert.equal(first.body.data.campaign.targetCountry, 'JP')
  assert.equal(first.body.data.campaign.outputLanguage, 'ja')
  const update = { method: 'PATCH', headers: { 'If-Match': version }, body: JSON.stringify({ brandId: 'a', campaign: { name: '수정' } }) }
  assert.equal((await call(`/campaigns/${id}`, update)).status, 409)
  const results = await Promise.all([call(`/campaigns/${id}`, { ...update, headers: { 'If-Match': first.body.data.version } }), call(`/campaigns/${id}`, { ...update, headers: { 'If-Match': first.body.data.version } })])
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
  const report = (await call(`/reports/${id}`)).body.data
  assert.equal(report.actualSpendKrw, 0); assert.equal(report.actualRevenueKrw, 0); assert.equal(report.roas, null)
  assert.equal(client.tables.brand_scoped_snapshots[0].payload.campaigns.length, 1)
})
test('캠페인 API는 실제 매출/집행/임의 필드 쓰기를 차단하고 콘텐츠 형식을 검증한다', () => {
  for (const field of ['actualRevenue', 'actualSpend', 'spend', 'revenue', 'creatorIds', '__proto__']) assert.throws(() => validateCampaignPatch(JSON.parse(`{"${field}":100}`)), { status: 400 })
  assert.throws(() => validateCampaignPatch({ contentFormats: ['잘못된 형식'] }), { status: 400 })
  assert.throws(() => validateCampaignPatch({ budget: -1 }), { status: 400 })
  assert.throws(() => validateCampaignPatch({ landingUrl: 'javascript:alert(1)' }), { status: 400 })
})
test('통합 보고서는 검색 결과나 개인 연락처 대신 실제 캠페인 합산 지표만 제공한다', () => {
  const report = campaignReport({ id: 'c', brandId: 'a', revenue: 9999999, spend: 9999999 }, { trackedPosts: [{ campaignId: 'c', views: 1000, likes: 40, saves: 22, url: 'secret-url' }] })
  assert.equal(report.engagementRate, 6.2)
  assert.equal(report.actualRevenueKrw, 0)
  assert.equal(JSON.stringify(report).includes('secret-url'), false)
})

test('실행 키는 허용한 AI/검색 경로만 통과하고 Gmail/관리자/학습 인증으로 확장되지 않는다', async () => {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = source.indexOf('async function requireWorkspaceAccess('), end = source.indexOf('\nasync function assertOutreachCampaigns(', start)
  const gate = vm.runInNewContext(`(${source.slice(start, end)})`, {
    process: { env: { CREATOROPS_OS_API_TOKEN: token } }, matchesSecret, isOsDiscoveryRead,
    PROTECTED_API_PATHS: ['/ai/campaign-strategy', '/discovery/youtube/search'], httpError: apiError,
    getSupabaseAdminClient: () => ({ auth: { getUser: async () => ({ data: {}, error: {} }) } }),
  })
  for (const path of ['/ai/campaign-strategy', '/discovery/youtube/search']) {
    const req = { originalUrl: `${path}?test=1`, headers: { authorization: `Bearer ${token}` } }
    let error
    await gate(req, {}, e => { error = e })
    assert.equal(error, undefined); assert.equal(req.workspaceUser.role, 'OSService')
  }
  for (const path of ['/outreach/gmail/send', '/oauth/google/token', '/admin/access/members', '/os-bridge/v1/learning']) {
    const req = { originalUrl: path, headers: { authorization: `Bearer ${token}` } }
    let error
    await gate(req, {}, e => { error = e })
    assert.equal(error.status, 401); assert.equal(req.workspaceUser, undefined)
  }
})
