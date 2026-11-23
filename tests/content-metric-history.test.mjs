import test from 'node:test'
import assert from 'node:assert/strict'
import { recordContentMetrics, contentMetricHistory, metricValue } from '../shared/contentMetricHistory.js'
import { sanitizeStaleYouTubeApiData } from '../server/youtubeRetention.js'

const now = Date.parse('2026-11-23T00:00:00Z')
test('successful refresh stores reactions, keeps zero and leaves unavailable fields unknown', () => {
  const post = recordContentMetrics({ id: 'a', likes: 99 }, { status: 'refreshed', checkedAt: '2026-11-22T00:00:00Z', views: 100, likes: 0, comments: null }, now)
  assert.equal(post.metricHistory[0].likes, 0)
  assert.equal(post.metricHistory[0].comments, null)
  assert.equal(metricValue({ views: false }, 'views'), null)
  assert.equal(metricValue({ views: 100, metricsPending: true }, 'views'), null)
})
test('failures and undated measurements never create fabricated history', () => {
  const post = { id: 'a', views: 123 }
  assert.equal(recordContentMetrics(post, { status: 'refresh_failed', checkedAt: '2026-11-22T00:00:00Z', views: 123 }, now), post)
  assert.equal(recordContentMetrics(post, { views: 999 }, now), post)
})
test('manual report values record their collection date and source without inventing missing reactions', () => {
  const post = recordContentMetrics({ id: 'manual-report' }, { status: 'manual', measuredAt: '2026-11-21T00:00:00Z', source: '사용자 제공 보고서', views: 50000, likes: 0 }, now)
  assert.equal(post.metricHistory[0].source, '사용자 제공 보고서')
  assert.equal(post.metricHistory[0].views, 50000)
  assert.equal(post.metricHistory[0].comments, null)
})
test('response history preserves scheduled observations missing from the browser copy', () => {
  const post = recordContentMetrics({ id: 'a' }, { status: 'refreshed', checkedAt: '2026-11-23T00:00:00Z', views: 300, metricHistory: [{ measuredAt: '2026-11-22T00:00:00Z', views: 200 }] }, now)
  assert.deepEqual(post.metricHistory.map(point => point.views), [200, 300])
})
test('history orders, deduplicates observations and removes expired or future points', () => {
  const history = contentMetricHistory({ metricHistory: [
    { measuredAt: '2026-11-22T00:00:00Z', views: 200 },
    { measuredAt: '2026-11-21T00:00:00Z', views: 100 },
    { measuredAt: '2026-11-22T00:00:00Z', views: 250 },
    { measuredAt: '2026-10-01T00:00:00Z', views: 10 },
    { measuredAt: '2026-12-01T00:00:00Z', views: 500 },
  ] }, now)
  assert.deepEqual(history.map(point => point.views), [100, 250])
})
test('fresh YouTube record still purges old observation history from persisted payload', () => {
  const result = sanitizeStaleYouTubeApiData({ trackedPosts: [{ platform: 'YouTube', source: 'YouTube Data API', sourceCollectedAtIso: '2026-11-22T00:00:00Z', metricHistory: [
    { measuredAt: '2026-10-01T00:00:00Z', views: 10 },
    { measuredAt: '2026-11-22T00:00:00Z', views: 250 },
  ] }] }, { now: new Date(now) })
  assert.equal(result.changed, true)
  assert.equal(result.payload.trackedPosts[0].metricHistory.length, 1)
})
