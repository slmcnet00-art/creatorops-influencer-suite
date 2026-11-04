import test from 'node:test'
import assert from 'node:assert/strict'
import { hasTrackingDestination, trackingLogTimestamp, invalidatePlaceholderTrackingLogs } from '../src/trackingDestination.js'

test('주소 미입력과 예시 주소로 추적 링크를 발급하지 않는다', () => {
  assert.equal(hasTrackingDestination(), false)
  assert.equal(hasTrackingDestination({ destination: 'https://brand.example/landing' }), false)
  assert.equal(hasTrackingDestination({ destination: 'https://www.brand.example/path' }), false)
  assert.equal(hasTrackingDestination({ destination: 'javascript:alert(1)' }), false)
  assert.equal(hasTrackingDestination({ destination: 'https://brand.com/app' }), true)
})

test('표시용 날짜는 최신 ISO 비활성 기록을 가리지 않으며 현재 캠페인 예시 링크만 비활성화한다', () => {
  assert.equal(trackingLogTimestamp({ createdAt: '11월 4일 오후 5:00' }), 0)
  assert.ok(trackingLogTimestamp({ updatedAt: '2026-11-04T09:00:00Z' }) > 0)
  const rows = [{ campaignId: 1, destination: 'https://brand.example/landing', status: 'active' }, { campaignId: 2, destination: 'https://brand.example/landing', status: 'active' }, { campaignId: 1, destination: 'https://brand.com/app', status: 'active' }]
  const next = invalidatePlaceholderTrackingLogs(rows, 1, '2026-11-04T09:00:00Z')
  assert.equal(next[0].status, 'inactive')
  assert.equal(next[1], rows[1])
  assert.equal(next[2], rows[2])
  assert.equal(rows[0].status, 'active')
})
