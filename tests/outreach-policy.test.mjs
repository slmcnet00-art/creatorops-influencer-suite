import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildOutreachPolicy,
  getKstDayWindow,
  getOutreachDailyRemaining,
} from '../server/outreachPolicy.js'

test('아웃리치 기본 정책은 20건·10초·캠페인별 일 50건이다', () => {
  assert.deepEqual(buildOutreachPolicy(), {
    batchLimit: 20,
    sendIntervalMs: 10_000,
    dailyLimitPerCampaign: 50,
    maxAttempts: 3,
  })
})

test('일일 한도는 한국시간 자정을 경계로 계산한다', () => {
  assert.deepEqual(getKstDayWindow('2026-09-03T14:59:59.000Z'), {
    dateKey: '2026-09-03',
    startAt: '2026-09-02T15:00:00.000Z',
    endAt: '2026-09-03T15:00:00.000Z',
  })
  assert.equal(getKstDayWindow('2026-09-03T15:00:00.000Z').dateKey, '2026-09-04')
})

test('캠페인별 남은 발송량은 0 아래로 내려가지 않는다', () => {
  assert.equal(getOutreachDailyRemaining(12, 50), 38)
  assert.equal(getOutreachDailyRemaining(50, 50), 0)
  assert.equal(getOutreachDailyRemaining(75, 50), 0)
})
