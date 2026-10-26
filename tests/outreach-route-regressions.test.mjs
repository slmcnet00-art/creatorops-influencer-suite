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
    WORKSPACE_ID: 'test', activeOutreachSendWorkspaces: new Set(), createHash, assertOutreachRole,
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
    async call(role = 'Owner', campaignId = 'allowed') {
      let error, body
      await handler({ workspaceUser: { id: 'test-user', role, email: 'nobody@example.invalid', brandIds: ['a'] }, body: { workspaceId: 'test', campaignId, accessToken: 'not-a-real-token', to: 'nobody@example.invalid', message: 'test only', idempotencyKey: 'same-request' } }, { json: row => { body = row } }, failure => { error = failure })
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
