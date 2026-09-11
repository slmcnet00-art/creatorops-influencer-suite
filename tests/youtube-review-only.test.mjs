import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reviewAudienceText } from '../src/youtubeReviewCopy.js'

test('review audience terminology applies only to YouTube', () => {
  assert.equal(reviewAudienceText('followers 100; subscribers 200', 'YouTube'), 'Subscribers 100; Subscribers 200')
  assert.equal(reviewAudienceText('followers 100', 'Instagram'), 'followers 100')
  assert.equal(reviewAudienceText('followers 100', undefined), 'followers 100')
})
test('Korean detail label is unchanged and reference notice is review-only', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.ok(source.includes('<Stat label="팔로워" value={displayMetric(selectedCreator.followers)} />'))
  assert.ok(source.includes('{youtubeEnglishReviewMode && (\n            <div className="youtube-data-policy-note"'))
  assert.ok(!source.includes('audienceLabel'))
})
