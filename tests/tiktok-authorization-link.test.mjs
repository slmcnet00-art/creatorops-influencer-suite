import test from 'node:test'
import assert from 'node:assert/strict'
import { validateTikTokAuthorizationLink } from '../src/tiktokAuthorizationLink.js'

const redirect = 'https://creatorops-suite-api.onrender.com/oauth/tiktok/advertiser/callback'
const valid = 'https://business-api.tiktok.com/portal/auth?' + new URLSearchParams({ app_id: 'test', redirect_uri: redirect, state: 'a'.repeat(64) })
test('관리자 승인 링크를 올바른 TikTok 호스트·등록 URI·일회용 state로 제한한다', () => {
  assert.equal(validateTikTokAuthorizationLink(valid, 'advertiser', redirect), valid)
  for (const url of [
    valid.replace('business-api.tiktok.com', 'business-api.tiktok.com.example.com'),
    valid.replace('https:', 'http:'),
    valid.replace('/portal/auth?', '/wrong?'),
    valid.replace('https://business-api', 'https://attacker@business-api'),
    valid.replace('a'.repeat(64), 'your_custom_params'),
  ]) assert.throws(() => validateTikTokAuthorizationLink(url, 'advertiser', redirect))
  assert.throws(() => validateTikTokAuthorizationLink(valid, 'advertiser', 'https://example.com/callback'))
})

test('광고주 링크를 계정 소유자 인증으로 혼용하지 않는다', () => {
  assert.throws(() => validateTikTokAuthorizationLink(valid, 'account', redirect))
})
