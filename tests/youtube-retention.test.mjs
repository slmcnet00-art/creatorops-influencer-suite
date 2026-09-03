import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getYouTubeRetentionCutoff,
  sanitizeStaleYouTubeApiData,
  YOUTUBE_API_DATA_MAX_AGE_DAYS,
} from '../server/youtubeRetention.js'

test('YouTube API 데이터 보존 기준은 30일이다', () => {
  assert.equal(YOUTUBE_API_DATA_MAX_AGE_DAYS, 30)
  assert.equal(getYouTubeRetentionCutoff(new Date('2026-09-03T00:00:00.000Z')), '2026-08-04T00:00:00.000Z')
})

test('30일을 넘긴 YouTube API 통계는 식별 URL만 남기고 제거한다', () => {
  const result = sanitizeStaleYouTubeApiData({
    creators: [{ id: 1, platform: 'YouTube', profileUrl: 'https://youtube.com/@demo', followers: 1000, averageViews: 300, sourceCollectedAtIso: '2026-07-01T00:00:00.000Z' }],
    contentReferences: [{ id: 2, platform: 'YouTube', url: 'https://youtube.com/watch?v=demo', title: 'Old title', thumbnailUrl: 'https://img.youtube.com/demo.jpg', views: 100, collectedAt: '2026-07-01T00:00:00.000Z' }],
    trackedPosts: [{ id: 3, platform: 'YouTube', url: 'https://youtube.com/watch?v=tracked', views: 900, lastChecked: '2026-07-01T00:00:00.000Z' }],
  }, { now: new Date('2026-09-03T00:00:00.000Z') })

  assert.equal(result.changed, true)
  assert.equal(result.redacted, 3)
  assert.equal(result.payload.creators[0].followers, 0)
  assert.equal(result.payload.creators[0].profileUrl, 'https://youtube.com/@demo')
  assert.equal(result.payload.contentReferences[0].title, 'YouTube reference · refresh required')
  assert.equal(result.payload.contentReferences[0].thumbnailUrl, '')
  assert.equal(result.payload.trackedPosts[0].views, 0)
})

test('30일 이내 데이터와 다른 플랫폼 데이터는 유지한다', () => {
  const payload = {
    creators: [
      { id: 1, platform: 'YouTube', followers: 1000, sourceCollectedAtIso: '2026-08-20T00:00:00.000Z' },
      { id: 2, platform: 'Instagram', followers: 2000, sourceCollectedAtIso: '2026-01-01T00:00:00.000Z' },
    ],
  }
  const result = sanitizeStaleYouTubeApiData(payload, { now: new Date('2026-09-03T00:00:00.000Z') })
  assert.equal(result.changed, false)
  assert.equal(result.payload, payload)
})
