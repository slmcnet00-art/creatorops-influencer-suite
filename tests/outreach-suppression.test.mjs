import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOutreachSuppressionId,
  getOutreachBlockReason,
  isOutreachSuppressedStatus,
  isValidOutreachEmail,
  normalizeOutreachEmail,
  normalizeOutreachSuppressionScope,
} from '../server/outreachSuppression.js'

test('아웃리치 이메일은 공백과 대소문자를 정규화한다', () => {
  assert.equal(normalizeOutreachEmail('  Creator@Example.COM '), 'creator@example.com')
  assert.equal(isValidOutreachEmail('creator@example.com'), true)
  assert.equal(isValidOutreachEmail('not-an-email'), false)
})

test('수신 거부 레코드는 워크스페이스와 이메일 기준으로 고정 ID를 만든다', () => {
  assert.equal(
    buildOutreachSuppressionId('miping-main', 'Creator+Ops@Example.com'),
    'suppression:miping-main:creator%2Bops%40example.com',
  )
  assert.equal(
    buildOutreachSuppressionId('miping-main', 'Creator+Ops@Example.com', 'campaign', 'campaign-1'),
    'campaign-suppression:miping-main:campaign-1:creator%2Bops%40example.com',
  )
})

test('캠페인 제외와 전체 수신 거부를 서로 다른 범위로 판정한다', () => {
  assert.equal(normalizeOutreachSuppressionScope('campaign'), 'campaign')
  assert.equal(normalizeOutreachSuppressionScope('workspace'), 'workspace')
  assert.equal(isOutreachSuppressedStatus('suppressed'), true)
  assert.equal(isOutreachSuppressedStatus('campaign_suppressed'), true)
  assert.equal(isOutreachSuppressedStatus('unsuppressed'), false)
  assert.equal(isOutreachSuppressedStatus('sent'), false)
})

test('캠페인 제외는 같은 이메일의 다른 캠페인 발송을 막지 않는다', () => {
  const records = [
    { recipient: 'creator@example.com', campaign_id: 'campaign-a', status: 'campaign_suppressed' },
  ]
  assert.equal(getOutreachBlockReason(records, { to: 'creator@example.com', campaignId: 'campaign-a' }), 'campaign_suppressed')
  assert.equal(getOutreachBlockReason(records, { to: 'creator@example.com', campaignId: 'campaign-b' }), '')
})

test('전체 수신 거부는 같은 이메일의 모든 캠페인 발송을 막는다', () => {
  const records = [
    { recipient: 'creator@example.com', campaign_id: null, status: 'suppressed' },
  ]
  assert.equal(getOutreachBlockReason(records, { to: 'creator@example.com', campaignId: 'campaign-a' }), 'suppressed')
  assert.equal(getOutreachBlockReason(records, { to: 'creator@example.com', campaignId: 'campaign-b' }), 'suppressed')
})
