import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOutreachSuppressionId,
  isOutreachSuppressedStatus,
  isValidOutreachEmail,
  normalizeOutreachEmail,
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
})

test('서버 수신 거부 상태만 발송 차단으로 판정한다', () => {
  assert.equal(isOutreachSuppressedStatus('suppressed'), true)
  assert.equal(isOutreachSuppressedStatus('unsuppressed'), false)
  assert.equal(isOutreachSuppressedStatus('sent'), false)
})
