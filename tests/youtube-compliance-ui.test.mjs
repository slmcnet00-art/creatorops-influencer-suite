import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { audienceLabel, audienceGroupLabel, YOUTUBE_INPUT_NOTICE_EN } from '../src/platformAudience.js'

test('YouTube audience uses Subscribers in both language modes', () => {
  for (const platform of ['YouTube', 'youtube', ' YOUTUBE ']) assert.equal(audienceLabel(platform), 'Subscribers')
})
test('other platforms retain follower terminology', () => {
  for (const platform of ['Instagram', 'TikTok', undefined]) assert.equal(audienceLabel(platform), '팔로워')
})
test('mixed groups do not mislabel subscribers as followers', () => {
  assert.equal(audienceGroupLabel([{ platform: 'YouTube' }]), 'Subscribers')
  assert.equal(audienceGroupLabel([{ platform: 'TikTok' }]), '팔로워')
  assert.equal(audienceGroupLabel([{ platform: 'YouTube' }, { platform: 'TikTok' }]), 'Subscribers / 팔로워')
})
test('shared notice explains read-only input and export restrictions', () => {
  for (const text of ['read-only', 'does not upload', 'Google Sheets', 'excluded']) assert.ok(YOUTUBE_INPUT_NOTICE_EN.includes(text))
})
test('demo, reference and detail views share audience terminology', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const demo = readFileSync(new URL('../src/YouTubeApiReview.jsx', import.meta.url), 'utf8')
  for (const expression of ['audienceLabel(selectedCreator.platform)', 'audienceLabel(selectedRecommendationCreator.platform)', 'audienceLabel(item.platform)', 'audienceLabel(creator.platform)']) assert.ok(app.includes(expression))
  assert.ok(demo.includes("audienceLabel('YouTube')"))
  assert.ok(demo.includes('YOUTUBE_INPUT_NOTICE_EN'))
  assert.ok(!app.includes('<Stat label="팔로워"'))
})
