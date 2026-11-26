import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

function clientHarness({ confirm = false, creators = [{ id: 'creator', contactEmail: 'creator@example.invalid' }], response, httpStatus = 200 } = {}) {
  const items = [{ id: 'item', creatorId: 'creator', campaignId: 'campaign', channel: 'email', status: '승인 대기', message: 'test' }]
  let fetches = 0, tokens = 0, confirmation = '', disconnected = false, requestBody
  let workspace = { outreach: items }
  const context = vm.createContext({ useMemo: fn => fn(), contactChannelCatalog: { email: {}, instagram_dm: {}, tiktok_dm: {} }, selectedOutreachItems: items, selectedEmailOutreachItems: items, creators, brandCampaigns: [{ id: 'campaign', name: 'test campaign' }], selectedCampaign: {}, outreach: items, backendConfig: { apiBaseUrl: 'https://example.invalid', workspaceId: 'test' }, gmailConnected: true, gmailAuth: {}, authSession: {}, OUTREACH_BLOCKED_STATUSES: new Set(), hasDuplicateSentOutreach: () => false, showToast() {}, setGmailSending() {}, setOutreachDailyUsage() {}, window: { confirm: message => { confirmation = message; return confirm }, localStorage: { removeItem: () => { disconnected = true } } }, setGmailAuth: () => { disconnected = true }, GMAIL_AUTH_STORE_KEY: 'fake', getFreshGmailAccessToken: async () => { tokens++; return 'fake' }, fetch: async (_url, options) => { fetches++; requestBody = JSON.parse(options.body); return { ok: httpStatus < 400, status: httpStatus, json: async () => response || { data: { results: [] } } } }, buildOutreachSubject: () => 'test', nowLabel: () => 'now', updateWorkspace: updater => { workspace = updater(workspace) }, appendActivity: current => current, setSelectedOutreachIds() {} })
  vm.runInContext(source.slice(source.indexOf('function getRecommendedContactChannelId('), source.indexOf('function getCreatorProfileUrl(')), context)
  vm.runInContext(source.slice(source.indexOf('  const selectedEmailOutreachItems ='), source.indexOf('  const selectedDmOutreachItems =')), context)
  context.outreachJobRequestRef = { current: null }
  context.AbortController = AbortController
  context.setOutreachJob = () => {}
  context.sendAndWatchOutreachJob = async ({ body }) => { const response = await context.fetch('', { body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw Object.assign(new Error(payload.message), { status: response.status }); return payload.data }
  vm.runInContext(source.slice(source.indexOf('  const sendSelectedOutreachEmails ='), source.indexOf('  const setOutreachRecipientSuppression =')) + '; this.send = sendSelectedOutreachEmails', context)
  return { context, get requestBody() { return requestBody }, get fetches() { return fetches }, get tokens() { return tokens }, get confirmation() { return confirmation }, get disconnected() { return disconnected }, get workspace() { return workspace } }
}

test('OUT-1: cancelling recipient confirmation never requests a token or sends', async () => {
  const h = clientHarness()
  await h.context.send()
  assert.equal(h.fetches, 0)
  assert.equal(h.tokens, 0)
  assert.match(h.confirmation, /test campaign/)
  assert.match(h.confirmation, /creator@example\.invalid/)
  assert.match(h.confirmation, /1건/)
})

test('OUT-1: accepted confirmation allows the stubbed send request', async () => {
  const h = clientHarness({ confirm: true })
  await h.context.send()
  assert.equal(h.fetches, 1)
  assert.equal(h.tokens, 1)
})


test('OUT-2: fallback email fields enter the same batch and recipient preview', async () => {
  for (const field of ['businessEmail', 'publicEmail', 'email']) {
    const h = clientHarness({ confirm: true, creators: [{ id: 'creator', [field]: 'business@example.invalid' }] })
    await h.context.send()
    assert.equal(h.fetches, 1)
    assert.equal(h.requestBody.items[0].to, 'business@example.invalid')
    assert.match(h.confirmation, /business@example\.invalid/)
  }
})


test('OUT-3: duplicate with provider ID reconciles pending client row as sent', async () => {
  const h = clientHarness({ confirm: true, response: { data: { results: [{ id: 'item', status: 'skipped', reason: 'duplicate', providerMessageId: 'gmail-id' }] } } })
  await h.context.send()
  assert.equal(h.workspace.outreach[0].status, '발송 완료')
})

test('OUT-3: Gmail disconnect uses actual HTTP 401, not error wording', async () => {
  for (const httpStatus of [400, 401, 500]) {
    const h = clientHarness({ confirm: true, httpStatus, response: { message: 'invalid token wording' } })
    await h.context.send()
    assert.equal(h.disconnected, httpStatus === 401)
  }
  const h = clientHarness({ confirm: true, response: { data: { results: [{ id: 'item', status: 'failed', message: 'invalid input' }] } } })
  await h.context.send()
  assert.equal(h.disconnected, false)
})
