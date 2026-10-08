import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reviewAudienceText } from '../src/youtubeReviewCopy.js'

test('review audience terminology applies only to YouTube', () => {
  assert.equal(reviewAudienceText('followers 100; subscribers 200', 'YouTube'), 'Subscribers 100; Subscribers 200')
  assert.equal(reviewAudienceText('followers 100', 'Instagram'), 'followers 100')
  assert.equal(reviewAudienceText('followers 100', undefined), 'followers 100')
})
test('integrated Korean and English views use platform-aware labels and the public data notice', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.ok(source.includes('audienceLabel(selectedCreator.platform)'))
  assert.ok(source.includes('<div className="youtube-data-policy-note" role="note">'))
  assert.ok(source.includes('youtubeEnglishReviewMode ? YOUTUBE_INPUT_NOTICE_EN'))
})
