import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { memorySupabase } from './helpers/memorySupabase.mjs'
import { compareAndSwapSnapshot } from '../src/snapshotConcurrency.js'
import { sanitizeStaleYouTubeApiData } from '../server/youtubeRetention.js'

const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
function helpers() {
  const context = vm.createContext({ compareAndSwapSnapshot, httpError: (status, message) => Object.assign(new Error(message), { status }) })
  vm.runInContext(source.slice(source.indexOf('function trackedPostIdentity('), source.indexOf('async function runYouTubeRetentionOperation(')), context)
  return context
}

test('SYNC-4: refresh CAS retry preserves concurrent campaign edits, new posts and manual post edits', async () => {
  const original = { id: 'post', views: 10, title: 'original' }
  const snapshot = { workspace_id: 'w', updated_at: 'v1', payload: { title: 'campaign', trackedPosts: [original] } }
  const db = memorySupabase({ workspace_snapshots: [snapshot] })
  // Another device commits after the job read, before its first write.
  Object.assign(db.tables.workspace_snapshots[0], { updated_at: 'v2', payload: { title: 'edited campaign', trackedPosts: [{ ...original, title: 'manual title' }, { id: 'new', views: 20 }] } })
  const h = helpers()
  await h.saveOperationSnapshot(db, 'workspace_snapshots', { workspace_id: 'w' }, snapshot,
    payload => h.mergeTrackingRefresh(payload, new Map([['post', original]]), new Map([['post', { ...original, views: 50, title: 'API title' }]])))
  const saved = db.tables.workspace_snapshots[0].payload
  assert.equal(saved.title, 'edited campaign')
  assert.equal(saved.trackedPosts[0].title, 'manual title')
  assert.equal(saved.trackedPosts[0].views, 50)
  assert.equal(saved.trackedPosts[1].id, 'new')
})

test('SYNC-4: retention re-sanitizes newest brand payload without removing concurrent user data', async () => {
  const now = new Date('2026-11-26T00:00:00Z')
  const stale = { id: 'ytref:old', platform: 'YouTube', source: 'YouTube Data API', collectedAt: '2026-01-01T00:00:00Z', followers: 100 }
  const snapshot = { workspace_id: 'w', brand_id: 'b', updated_at: 'v1', payload: { creators: [stale], note: 'old' } }
  const db = memorySupabase({ brand_scoped_snapshots: [snapshot] })
  Object.assign(db.tables.brand_scoped_snapshots[0], { updated_at: 'v2', payload: { creators: [stale, { id: 'manual', platform: 'Instagram', followers: 42 }], note: 'new' } })
  await helpers().saveOperationSnapshot(db, 'brand_scoped_snapshots', { workspace_id: 'w', brand_id: 'b' }, snapshot, payload => sanitizeStaleYouTubeApiData(payload, { now }))
  const saved = db.tables.brand_scoped_snapshots[0].payload
  assert.equal(saved.note, 'new')
  assert.equal(saved.creators[1].followers, 42)
  assert.equal(saved.creators[0].followers, 0)
})

test('SYNC-4: conflicts stop after three CAS attempts without unconditional writes', async () => {
  let attempts = 0
  const h = helpers()
  h.compareAndSwapSnapshot = async () => { attempts++; return { status: 'conflict', payload: { trackedPosts: [] }, updatedAt: 'new' } }
  await assert.rejects(h.saveOperationSnapshot({}, 'workspace_snapshots', {}, { payload: {} }, payload => ({ changed: true, payload })), { status: 409 })
  assert.equal(attempts, 3)
})
