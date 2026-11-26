import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { normalizeCreatorGroups } from '../shared/creatorGroups.js'
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const context = vm.createContext({ crypto: webcrypto })
vm.runInContext(source.slice(source.indexOf('function createId()'), source.indexOf('function compactNumber(')), context)

test('SYNC-10: 10,000 generated IDs remain unique without numeric addition', () => {
  const ids = Array.from({ length: 10000 }, () => context.createId())
  assert.equal(new Set(ids).size, 10000)
  assert.ok(ids.every(id => /^[0-9a-f-]{36}$/.test(id)))
  assert.doesNotMatch(source, /createId\(\) \+/)
})
test('SYNC-10: legacy numeric and UUID references round-trip with original types', () => {
  const uuid = context.createId()
  const records = JSON.parse(JSON.stringify([{ id: 42 }, { id: uuid }]))
  assert.equal(context.resolveRecordId(records, '42'), 42)
  assert.equal(context.resolveRecordId(records, uuid), uuid)
  const groups = normalizeCreatorGroups([{ id: context.createId(), creatorIds: ['42', uuid] }], records)
  assert.deepEqual(groups[0].creatorIds, [42, uuid])
  assert.doesNotMatch(source, /Number\((?:trackingDraft|fulfillmentDraft|effectiveDraft)\.(?:campaignId|creatorId)\)/)
})
