import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCreatorProfileEvidence, profileEvidenceKey } from '../shared/creatorProfileEvidence.js'
const creator = { id: 1, profileUrl: 'https://instagram.com/Creator/?igsh=a', followers: 100, averageViews: 500, engagement: 2.3 }
const row = { profileUrl: 'https://www.instagram.com/creator/', status: 'verified', imageUrl: 'https://scontent.cdninstagram.com/profile', followers: 120, source: '공개 프로필', collectedAt: '2026-11-26T10:00:00Z' }
test('verified profile counts retain previous value, history, source and date without changing other metrics', () => {
  const result = applyCreatorProfileEvidence({ creators: [creator] }, [row]).creators[0]
  assert.equal(result.followers, 120)
  assert.equal(result.previousFollowers, 100)
  assert.equal(result.followerChange, 20)
  assert.equal(result.averageViews, 500)
  assert.equal(result.engagement, 2.3)
  assert.equal(result.followerHistory[0].measuredAt, row.collectedAt)
  assert.equal(result.profileImageUrl, row.imageUrl)
})
test('unavailable, hidden or missing counts never erase an existing count; a real zero is retained', () => {
  const workspace = { creators: [creator] }
  assert.equal(applyCreatorProfileEvidence(workspace, [{ ...row, status: 'unavailable' }]), workspace)
  assert.equal(applyCreatorProfileEvidence(workspace, [{ ...row, followers: null }]).creators[0].followers, 100)
  assert.equal(applyCreatorProfileEvidence(workspace, [{ ...row, followers: 0 }]).creators[0].followers, 0)
})
test('duplicate or older observations are ignored, and unrelated accounts remain unchanged', () => {
  const current = applyCreatorProfileEvidence({ creators: [creator, { id: 2, profileUrl: 'https://instagram.com/other/' }] }, [row])
  assert.equal(applyCreatorProfileEvidence(current, [row]), current)
  assert.equal(applyCreatorProfileEvidence(current, [{ ...row, collectedAt: '2020-01-01T00:00:00Z' }]), current)
  assert.equal(current.creators[1].profileImageUrl, undefined)
  assert.notEqual(profileEvidenceKey('https://youtube.com/channel/UCabc'), profileEvidenceKey('https://youtube.com/channel/UCABC'))
})
