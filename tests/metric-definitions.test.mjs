import test from 'node:test'
import assert from 'node:assert/strict'
import { knownMetricCount, metricObservationSummary, metricDefinitions } from '../shared/metricDefinitions.js'

test('confirmed zero survives while absent and pending measurements do not count', () => {
  const rows = [{ views: 0 }, { views: 500 }, { views: null }, { views: '' }, {},
    { views: 0, metricsPending: true }, { views: 0, needsVerification: true },
    { views: 12, metric_availability: { views: 'unavailable' } }, { views: false }]
  assert.equal(knownMetricCount(rows, 'views'), 2)
})

test('observation summary uses collection dates instead of save dates', () => {
  const rows = [{ source: 'Public snapshot', fetchedAt: '2026-11-01T00:00:00Z' },
    { sourceCollectedAtIso: '2026-11-10T00:00:00Z', metricSources: [{ source: 'YouTube Data API' }] },
    { savedAt: '2026-11-23T00:00:00Z' }]
  assert.deepEqual(metricObservationSummary(rows), {
    sources: ['Public snapshot', 'YouTube Data API'], dated: 2, oldest: '2026-11-01T00:00:00.000Z',
  })
  assert.equal(metricObservationSummary([{ fetchedAt: 'invalid' }]).oldest, '')
})

test('definitions distinguish follower totals, sampled estimates and campaign KPI progress', () => {
  assert.match(metricDefinitions['search-reach'].name, /합계/)
  assert.match(metricDefinitions['expected-views'].limitation, /20%/)
  assert.match(metricDefinitions['recruiting-progress'].formula, /산술평균/)
})
