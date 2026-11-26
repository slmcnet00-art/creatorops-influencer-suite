import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { memorySupabase } from './helpers/memorySupabase.mjs'
import { mergeBrandWorkspaceSnapshots } from '../shared/brandWorkspaceSnapshots.js'
import { brandSnapshotSignature } from '../src/workspaceSyncGuard.js'

function watcher(kind, options) {
  const db = memorySupabase({ workspace_snapshots: [{ workspace_id: 'w', updated_at: 'v1', payload: { brands: [], campaigns: [], creators: [] } }], brand_scoped_snapshots: [{ workspace_id: 'w', brand_id: 'b', updated_at: 'v1', payload: { creators: [{ id: 1, followers: 1 }] } }] })
  const queries = [], events = []
  const originalFrom = db.from.bind(db)
  db.from = table => { const query = originalFrom(table), select = query.select; query.select = columns => { queries.push({ table, columns }); return select(columns) }; return query }
  let poll
  const context = vm.createContext({ getSupabaseClient: () => db, WORKSPACE_ID: 'w', mergeBrandWorkspaceSnapshots, brandSnapshotSignature, window: { setInterval: fn => { poll = fn; return 1 }, clearInterval() {} } })
  const source = readFileSync(new URL('../src/backendSync.js', import.meta.url), 'utf8')
  const start = kind === 'full' ? 'export function watchCloudWorkspace(' : 'export function watchBrandCloudWorkspaces('
  const end = kind === 'full' ? 'export async function loadBrandCloudWorkspaces(' : 'const RAW_STATUS_TO_DB'
  vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)).replace('export function', 'function'), context)
  const stop = context[kind === 'full' ? 'watchCloudWorkspace' : 'watchBrandCloudWorkspaces'](event => events.push(event), options)
  return { db, queries, events, stop, poll: () => poll() }
}

for (const kind of ['full', 'brand']) {
  test(`${kind} idle and own-save polling never re-downloads the snapshot payload`, async () => {
    const after = kind === 'full' ? 'v1' : 'b:v1'
    const h = watcher(kind, { after, getAcknowledgedVersion: () => after })
    for (let i = 0; i < 10; i++) await h.poll()
    assert.equal(h.queries.length, 10)
    assert.ok(h.queries.every(query => !query.columns.includes('payload')))
    assert.equal(h.events.length, 0)
  })

  test(`${kind} remote updates still load the latest payload once, then return to metadata-only reads`, async () => {
    const h = watcher(kind, { after: kind === 'full' ? 'v1' : 'b:v1' })
    if (kind === 'full') h.db.tables.workspace_snapshots[0].updated_at = 'v2'
    else { h.db.tables.brand_scoped_snapshots[0].updated_at = 'v2'; h.db.tables.brand_scoped_snapshots[0].payload.creators[0].followers = 2 }
    await h.poll()
    assert.equal(h.events.length, 1)
    assert.equal(h.events[0].status, 'updated')
    const payloadReads = h.queries.filter(query => query.columns.includes('payload')).length
    await h.poll()
    assert.equal(h.queries.filter(query => query.columns.includes('payload')).length, payloadReads)
    assert.equal(h.events.length, 1)
    h.stop()
    const reads = h.queries.length
    await h.poll()
    assert.equal(h.queries.length, reads)
  })
}
