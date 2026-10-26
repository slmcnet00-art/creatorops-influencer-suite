import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('성과 집계는 저장을 포함한 백분율과 정규화한 조회수를 사용한다', async () => {
  const { aggregateEngagement, getAverageViews } = await import('../src/performanceMetrics.js')
  assert.equal(aggregateEngagement([{ views: 1000, likes: 40, comments: 5, shares: 5, saves: 12 }]), 6.2)
  assert.equal(aggregateEngagement([]), 0)
  assert.equal(getAverageViews({ averageViews: 284000 }), 284000)
  assert.equal(getAverageViews({ avgViews: 123 }), 123)
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /aggregateEngagement\(campaignModalTrackedPosts\)/)
  assert.match(source, /spend: 0,\s*revenue: 0/)
})

test('Client/Analyst 및 다른 브랜드의 발송을 차단한다', async () => {
  const { assertOutreachRole, assertCampaignScope } = await import('../server/outreachAccess.js')
  for (const role of ['Client', 'Analyst', '', 'invalid']) assert.throws(() => assertOutreachRole({ role }), { status: 403 })
  for (const role of ['Owner', 'Admin', 'Manager', 'Marketer']) assert.doesNotThrow(() => assertOutreachRole({ role }))
  assert.throws(() => assertCampaignScope({ role: 'Manager', brandIds: ['a'] }, { brandId: 'b' }), { status: 403 })
  assert.doesNotThrow(() => assertCampaignScope({ role: 'Manager', brandIds: ['a'] }, { brandId: 'a' }))
  assert.throws(() => assertCampaignScope({ role: 'Admin' }, null), { status: 404 })
})

test('유료 요청 경로는 공통 인증 게이트를 통과한다', () => {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.match(source, /app\.use\(PROTECTED_API_PATHS, requireWorkspaceAccess\)/)
})

test('원자적 스냅샷 저장은 같은 버전의 두 수정 중 하나만 허용한다', async () => {
  const { compareAndSwapSnapshot } = await import('../src/snapshotConcurrency.js')
  let state = { workspace_id: 'test', payload: {}, updated_at: '2026-01-01T00:00:00.000Z' }
  const client = { from: () => {
    let expected
    let patch
    const query = {
      update(row) { patch = row; return this },
      insert(row) { patch = row; return this },
      eq(key, value) { if (key === 'updated_at') expected = value; return this },
      select() { return this },
      async maybeSingle() {
        if (!patch) return { data: structuredClone(state), error: null }
        if (state.updated_at !== expected) return { data: null, error: null }
        state = { ...state, ...patch }
        return { data: structuredClone(state), error: null }
      },
    }
    return query
  } }
  const expected = state.updated_at
  const results = await Promise.all([
    compareAndSwapSnapshot(client, 'workspace_snapshots', { workspace_id: 'test' }, { a: true }, expected),
    compareAndSwapSnapshot(client, 'workspace_snapshots', { workspace_id: 'test' }, { b: true }, expected),
  ])
  assert.deepEqual(results.map(row => row.status).sort(), ['conflict', 'saved'])
})

test('발송 선점은 중복·동시 요청을 한 번만 허용하고 DB 실패 시 닫힌다', async () => {
  const { claimDelivery, isDefinitiveDeliveryFailure } = await import('../server/outreachDelivery.js')
  let stored = null
  const db = { from: () => ({
    async insert(row) {
      if (stored) return { error: { code: '23505' } }
      stored = row
      return { error: null }
    },
    select() { return this }, eq() { return this },
    async maybeSingle() { return { data: stored, error: null } },
  }) }
  const row = { id: 'test', workspace_id: 'test', idempotency_key: 'same', status: 'sending' }
  const claims = await Promise.all([claimDelivery(db, row), claimDelivery(db, row)])
  assert.equal(claims.filter(claim => claim.claimed).length, 1)
  assert.equal((await claimDelivery(db, row)).claimed, false)
  await assert.rejects(claimDelivery({ from: () => ({ insert: async () => ({ error: new Error('offline') }) }) }, row), /offline/)
  assert.equal(isDefinitiveDeliveryFailure({ status: 500 }), false)
  assert.equal(isDefinitiveDeliveryFailure({ status: 400 }), true)
  assert.equal(isDefinitiveDeliveryFailure({ status: 400, deliveryAccepted: true }), false)
})

test('예측 매출 및 상태 전환 버튼은 실제 매출을 만들지 않는다', async () => {
  const { getActualRevenue } = await import('../src/performanceMetrics.js')
  const campaign = { id: 1, revenue: 12750000 }
  assert.equal(getActualRevenue(campaign), 0)
  assert.equal(getActualRevenue(campaign, [{ campaignId: 1, eventType: 'purchase', eventValue: 100 }, { campaignId: 1, eventType: 'refund', eventValue: 100 }]), 0)
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const advance = source.slice(source.indexOf('const advanceCampaign ='), source.indexOf('const createCampaign ='))
  assert.doesNotMatch(advance, /revenue:|spend:/)
})
