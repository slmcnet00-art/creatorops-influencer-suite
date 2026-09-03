import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateOperationalMetrics, normalizeOperationJobName } from '../server/operationsJobs.js'

test('지원하는 운영 작업만 허용한다', () => {
  assert.equal(normalizeOperationJobName('tracking-refresh'), 'tracking-refresh')
  assert.equal(normalizeOperationJobName('metric-recalculation'), 'metric-recalculation')
  assert.equal(normalizeOperationJobName('youtube-retention'), 'youtube-retention')
  assert.equal(normalizeOperationJobName('unknown-job'), '')
})

test('콘텐츠 스냅샷과 수집 로그에서 운영 지표를 재계산한다', () => {
  const metrics = aggregateOperationalMetrics(
    [
      { id: 1, views: 100, likes: 10, comments: 2, shares: 1 },
      { id: 2, views: 300, likes: 20, comments: 3, shares: 4 },
    ],
    [
      { id: 11, status: 'success' },
      { id: 12, status: 'failed' },
      { id: 13, status: 'success' },
      { id: 14, status: 'partial' },
    ],
  )
  assert.equal(metrics.find((item) => item.metricId === 'MET-SNS-001').value, 400)
  assert.equal(metrics.find((item) => item.metricId === 'MET-SNS-004').value, 5)
  assert.equal(metrics.find((item) => item.metricId === 'MET-OPS-001').value, 50)
  assert.deepEqual(metrics.find((item) => item.metricId === 'MET-OPS-001').valueJson, { success: 2, total: 4 })
})
