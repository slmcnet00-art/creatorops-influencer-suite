import { memorySupabase } from './helpers/memorySupabase.mjs'
import { isValidOutreachEmail } from '../server/outreachSuppression.js'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertOutreachRole, assertCampaignScope } from '../server/outreachAccess.js'
import { isDefinitiveDeliveryFailure } from '../server/outreachDelivery.js'

function routeHarness({ uncertain = false } = {}) {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
  const records = new Map()
  let handler, sends = 0
  const context = vm.createContext({
    app: { post: (_path, _auth, callback) => { handler = callback } }, requireWorkspaceAccess() {},
    isValidOutreachEmail, WORKSPACE_ID: 'test', activeOutreachSendWorkspaces: new Set(), createHash, assertOutreachRole,
    assertOutreachCampaigns: async (request, items) => { for (const item of items) assertCampaignScope(request.workspaceUser, { id: item.campaignId, brandId: item.campaignId === 'allowed' ? 'a' : 'b' }) },
    httpError: (status, message) => Object.assign(new Error(message), { status }),
    normalizeOutreachEmail: value => value.toLowerCase(), normalizeOutreachDeliveryItem: row => row,
    getOutreachRecipientBlocks: async () => [], getOutreachBlockReason: () => null,
    getCampaignDailyOutreachUsage: async () => ({ used: 0, remaining: 50, limit: 50 }),
    findOutreachDelivery: async (_workspace, key) => records.get(key),
    claimOutreachDelivery: async (_workspace, item) => {
      if (records.has(item.idempotencyKey)) return { claimed: false, existing: records.get(item.idempotencyKey) }
      records.set(item.idempotencyKey, { status: 'sending' })
      return { claimed: true }
    },
    persistOutreachDelivery: async (_workspace, item, row) => { records.set(item.idempotencyKey, { ...row, provider_message_id: row.providerMessageId }) },
    sendGmailWithRetry: async () => { sends++; if (uncertain) throw Object.assign(new Error('ambiguous upstream response'), { status: 500 }); return { id: 'mock-message', attemptCount: 1 } },
    isDefinitiveDeliveryFailure, safeWriteAuditLog: async () => {}, getOutreachDailyRemaining: (used, limit) => limit - used, OUTREACH_MAX_ATTEMPTS: 3,
  })
  vm.runInContext(source.slice(source.indexOf("app.post('/outreach/gmail/send',"), source.indexOf("app.post('/outreach/gmail/send-batch',")), context)
  return {
    get sends() { return sends },
    async call(role = 'Owner', campaignId = 'allowed', to = 'nobody@example.invalid') {
      let error, body
      await handler({ workspaceUser: { id: 'test-user', role, email: 'nobody@example.invalid', brandIds: ['a'] }, body: { workspaceId: 'test', campaignId, accessToken: 'not-a-real-token', to, message: 'test only', idempotencyKey: 'same-request' } }, { json: row => { body = row } }, failure => { error = failure })
      return { error, body }
    },
  }
}

test('실제 단건 라우트는 Client/Analyst 발송과 다른 브랜드 발송을 막는다', async () => {
  const harness = routeHarness()
  assert.equal((await harness.call('Client')).error.status, 403)
  assert.equal((await harness.call('Analyst')).error.status, 403)
  assert.equal((await harness.call('Manager', 'other-brand')).error.status, 403)
  assert.equal(harness.sends, 0)
})

test('실제 단건 라우트의 같은 요청 재전송은 발송 횟수를 늘리지 않는다', async () => {
  const harness = routeHarness()
  assert.equal((await harness.call()).body.data.id, 'mock-message')
  assert.equal((await harness.call()).body.data.duplicate, true)
  assert.equal(harness.sends, 1)
})

test('결과가 불확실한 발송은 pending을 유지하고 자동 재발송하지 않는다', async () => {
  const harness = routeHarness({ uncertain: true })
  assert.equal((await harness.call()).error.status, 500)
  assert.equal((await harness.call()).error.status, 409)
  assert.equal(harness.sends, 1)
})


test('SEC-3: route rejects recipient lists and header injection before sending', async () => {
  for (const to of ['a@example.com,b@example.com', 'Name <a@example.com>', 'a@example.com\r\nBcc:b@example.com', 'a@example.com\n']) {
    const harness = routeHarness()
    assert.equal((await harness.call('Owner', 'allowed', to)).error.status, 400)
    assert.equal(harness.sends, 0)
  }
})

test('SEC-3: batch normalizer and MIME builder reject malformed recipients', () => {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
  const context = vm.createContext({ isValidOutreachEmail, normalizeOutreachEmail: value => value.trim().toLowerCase(), Buffer, httpError: (status, message) => Object.assign(new Error(message), { status }) })
  vm.runInContext(source.slice(source.indexOf('function normalizeOutreachDeliveryItem('), source.indexOf('async function getOutreachRecipientBlocks(')), context)
  vm.runInContext(source.slice(source.indexOf('function buildGmailRawMessage('), source.indexOf('async function callOpenAIText(')), context)
  for (const to of ['a@example.com;b@example.com', 'a@example.com\r\n', 'Name <a@example.com>']) {
    assert.throws(() => context.normalizeOutreachDeliveryItem({ to, message: 'test' }), { status: 400 })
    assert.throws(() => context.buildGmailRawMessage({ to, message: 'test' }), { status: 400 })
  }
  assert.equal(context.normalizeOutreachDeliveryItem({ to: 'A@example.com', message: 'test' }).to, 'a@example.com')
})


function batchHarness({ failure = 'definitive', persistenceFailure = true } = {}) {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
  const records = new Map(), memory = new Map()
  let handler, sends = 0
  const context = vm.createContext({
    app: { post: (_path, _auth, callback) => { handler = callback } }, requireWorkspaceAccess() {},
    WORKSPACE_ID: 'test', activeOutreachSendWorkspaces: new Set(), outreachDeliveryMemory: memory,
    OUTREACH_BATCH_LIMIT: 20, OUTREACH_SEND_INTERVAL_MS: 0, OUTREACH_MAX_ATTEMPTS: 3, OUTREACH_DAILY_LIMIT_PER_CAMPAIGN: 50,
    assertOutreachRole, assertOutreachCampaigns: async () => {}, httpError: (status, message) => Object.assign(new Error(message), { status }),
    normalizeOutreachDeliveryItem: item => item, getOutreachRecipientBlocks: async () => [], getOutreachBlockReason: () => '',
    getCampaignDailyOutreachUsage: async () => ({ used: 0, remaining: 50, limit: 50 }), findOutreachDelivery: async (_w, key) => records.get(key),
    claimOutreachDelivery: async (_w, item) => { records.set(item.idempotencyKey, { status: 'sending' }); return { claimed: true } },
    persistOutreachDelivery: async (_w, item, delivery) => { if (persistenceFailure && item.id === 'bad') throw new Error('test DB unavailable'); records.set(item.idempotencyKey, { ...delivery, provider_message_id: delivery.providerMessageId }) },
    sendGmailWithRetry: async (_token, item) => { sends++; if (item.id === 'bad' && failure !== 'accepted') throw Object.assign(new Error('test provider failure'), { status: failure === 'definitive' ? 400 : 500 }); return { id: `gmail-${item.id}`, attemptCount: 1 } },
    isDefinitiveDeliveryFailure, safeWriteAuditLog: async () => {}, getOutreachDailyRemaining: (used, limit) => limit - used, delay: async () => {},
  })
  vm.runInContext(source.slice(source.indexOf("app.post('/outreach/gmail/send-batch',"), source.indexOf("app.post('/outreach/suppressions',")), context)
  return { records, memory, get sends() { return sends }, async call(ids = ['first', 'bad', 'last']) {
    let body, error
    await handler({ workspaceUser: { id: 'user', role: 'Owner' }, body: { workspaceId: 'test', accessToken: 'fake', items: ids.map(id => ({ id, campaignId: 'campaign', creatorId: id, idempotencyKey: id, to: `${id}@example.invalid`, message: 'test' })) } }, { json: value => { body = value } }, value => { error = value })
    return { body, error }
  } }
}

test('OUT-3: batch retains prior and later results when failure recording also fails', async () => {
  const h = batchHarness()
  const { body, error } = await h.call()
  assert.equal(error, undefined)
  assert.deepEqual(Array.from(body.data.results, row => row.status), ['sent', 'failed', 'sent'])
  assert.equal(body.data.summary.sent, 2)
  assert.equal(body.data.results[1].recordingFailed, true)
})

test('OUT-3: uncertain and accepted-but-unrecorded deliveries are never resent automatically', async () => {
  for (const failure of ['uncertain', 'accepted']) {
    const h = batchHarness({ failure })
    const first = await h.call(['bad'])
    assert.equal(first.error, undefined)
    assert.equal(first.body.data.results[0].requiresManualReview, true)
    const second = await h.call(['bad'])
    assert.equal(second.body.data.results[0].reason, 'duplicate')
    if (failure === 'accepted') assert.equal(second.body.data.results[0].providerMessageId, 'gmail-bad')
    assert.equal(h.sends, 1)
  }
})

test('OUT-3: policy manual-review query scopes stale sending rows and does not retry them', async () => {
  const now = new Date('2026-11-26T00:30:00Z')
  const db = memorySupabase({ outreach_messages: [
    { id: 'old', workspace_id: 'w', campaign_id: 'c', status: 'sending', updated_at: '2026-11-26T00:00:00Z', recipient: 'test@example.invalid' },
    { id: 'fresh', workspace_id: 'w', campaign_id: 'c', status: 'sending', updated_at: '2026-11-26T00:25:00Z' },
    { id: 'other', workspace_id: 'w', campaign_id: 'other', status: 'sending', updated_at: '2026-11-26T00:00:00Z' },
    { id: 'sent', workspace_id: 'w', campaign_id: 'c', status: 'sent', updated_at: '2026-11-26T00:00:00Z' },
  ] })
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
  const context = vm.createContext({ getSupabaseAdminClient: () => db, httpError: (status, message) => Object.assign(new Error(message), { status }) })
  vm.runInContext(source.slice(source.indexOf('async function getOutreachPendingReviews('), source.indexOf('async function getCampaignDailyOutreachUsage(')), context)
  const rows = await context.getOutreachPendingReviews('w', 'c', now)
  assert.deepEqual(Array.from(rows, row => row.id), ['old'])
  assert.equal(rows[0].status, 'manual_check_required')
  assert.equal(db.tables.outreach_messages[0].status, 'sending')
})


test('OUT-3: policy returns manual-review rows only after campaign authorization', async () => {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
  let handler, authorized = false, body
  const context = vm.createContext({ app: { get: (_path, _auth, callback) => { handler = callback } }, requireWorkspaceAccess() {}, WORKSPACE_ID: 'w', OUTREACH_BATCH_LIMIT: 20, OUTREACH_SEND_INTERVAL_MS: 10000, OUTREACH_DAILY_LIMIT_PER_CAMPAIGN: 50,
    httpError: (status, message) => Object.assign(new Error(message), { status }), assertOutreachCampaigns: async (_request, items) => { assert.equal(items[0].campaignId, 'c'); authorized = true },
    getOutreachPendingReviews: async () => { assert.equal(authorized, true); return [{ id: 'old', status: 'manual_check_required' }] }, getCampaignDailyOutreachUsage: async () => ({ used: 0 }) })
  vm.runInContext(source.slice(source.indexOf("app.get('/outreach/policy',"), source.indexOf("app.post('/outreach/gmail/send',")), context)
  await handler({ query: { workspaceId: 'w', campaignId: 'c' } }, { json: value => { body = value } }, error => { throw error })
  assert.equal(body.data.manualReviewRequired[0].id, 'old')
})
