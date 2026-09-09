import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { campaignTypeOptions, normalizeCampaignType, isGroupBuyingCampaign } from '../src/campaignTypes.js'

test('캠페인 옵션은 플랫폼과 분리된 공동구매를 제공한다', () => {
  assert.equal(campaignTypeOptions.length, 6)
  assert.ok(campaignTypeOptions.includes('공동구매'))
  assert.ok(!campaignTypeOptions.includes('틱톡 공동구매 셀러'))
})

test('기존 공동구매 타입을 읽을 때만 변환하며 다른 타입을 보존한다', () => {
  assert.equal(normalizeCampaignType('틱톡 공동구매 셀러'), '공동구매')
  for (const type of [...campaignTypeOptions, '사용자 정의 타입']) {
    assert.equal(normalizeCampaignType(type), type)
  }
  assert.equal(normalizeCampaignType(undefined), '제안형')
  assert.equal(normalizeCampaignType(null), '제안형')
})

test('신규·기존 공동구매는 같은 전략 경로를 쓰고 어필리에이트와 구분한다', () => {
  assert.equal(isGroupBuyingCampaign('공동구매'), true)
  assert.equal(isGroupBuyingCampaign('틱톡 공동구매 셀러'), true)
  assert.equal(isGroupBuyingCampaign('커머스/제휴'), false)
  assert.equal(isGroupBuyingCampaign(undefined), false)
})

test('화면의 공동구매 전략은 TikTok으로 플랫폼을 강제하지 않는다', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.ok(app.includes('const sellerMode = isGroupBuyingCampaign(campaign?.campaignType)'))
  assert.ok(app.includes("const primaryPlatform = selectedPlatforms[0] ?? 'Instagram'"))
  assert.ok(app.includes('`${primaryPlatform} 공동구매 파트너'))
  assert.ok(app.includes("text.includes('공동구매') ? '공동구매'"))
  assert.ok(app.includes('campaignType: normalizeCampaignType(campaign.campaignType ?? fallback?.campaignType)'))
  assert.ok(app.includes('campaignType: normalizeCampaignType(campaignEditDraft.campaignType)'))
})
