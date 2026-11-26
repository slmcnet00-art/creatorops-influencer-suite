import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

function clientHarness({ confirm = false, creators = [{ id: 'creator', contactEmail: 'creator@example.invalid' }], response, httpStatus = 200 } = {}) {
  const items = [{ id: 'item', creatorId: 'creator', campaignId: 'campaign', channel: 'email', status: '승인 대기', message: 'test' }]
  let fetches = 0, tokens = 0, confirmation = '', disconnected = false
  let workspace = { outreach: items }
  const context = vm.createContext({ selectedOutreachItems: items, selectedEmailOutreachItems: items, creators, brandCampaigns: [{ id: 'campaign', name: 'test campaign' }], selectedCampaign: {}, outreach: items, backendConfig: { apiBaseUrl: 'https://example.invalid', workspaceId: 'test' }, gmailConnected: true, gmailAuth: {}, authSession: {}, OUTREACH_BLOCKED_STATUSES: new Set(), hasDuplicateSentOutreach: () => false, showToast() {}, setGmailSending() {}, setOutreachDailyUsage() {}, window: { confirm: message => { confirmation = message; return confirm }, localStorage: { removeItem: () => { disconnected = true } } }, setGmailAuth: () => { disconnected = true }, GMAIL_AUTH_STORE_KEY: 'fake', getFreshGmailAccessToken: async () => { tokens++; return 'fake' }, fetch: async () => { fetches++; return { ok: httpStatus < 400, status: httpStatus, json: async () => response || { data: { results: [] } } } }, buildOutreachSubject: () => 'test', nowLabel: () => 'now', updateWorkspace: updater => { workspace = updater(workspace) }, appendActivity: current => current, setSelectedOutreachIds() {} })
  vm.runInContext(source.slice(source.indexOf('function getCreatorContactEmail('), source.indexOf('function getCreatorProfileUrl(')), context)
  vm.runInContext(source.slice(source.indexOf('  const sendSelectedOutreachEmails ='), source.indexOf('  const setOutreachRecipientSuppression =')) + '; this.send = sendSelectedOutreachEmails', context)
  return { context, get fetches() { return fetches }, get tokens() { return tokens }, get confirmation() { return confirmation }, get disconnected() { return disconnected }, get workspace() { return workspace } }
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
