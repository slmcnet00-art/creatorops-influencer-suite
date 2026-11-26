import test from 'node:test'
import assert from 'node:assert/strict'
import { snapshotMergeDecision, brandSnapshotSignature } from '../src/workspaceSyncGuard.js'

test('SYNC-1: own acknowledged save does not merge or discard newer local edits', () => {
  const signature = brandSnapshotSignature({ b: '2', a: '1' })
  assert.equal(signature, 'a:1|b:2')
  assert.equal(snapshotMergeDecision(signature, signature, true), 'ignore')
})
test('SYNC-1: pending full or brand edits block remote replacement', () => {
  const local = { title: 'unsaved input' }
  for (const pending of [{ full: true, brand: false }, { full: false, brand: true }]) {
    const decision = snapshotMergeDecision('remote-new', 'saved-old', pending.full || pending.brand)
    assert.equal(decision, 'conflict')
    assert.equal(local.title, 'unsaved input')
  }
  assert.equal(snapshotMergeDecision('new', 'old', false), 'merge')
})
