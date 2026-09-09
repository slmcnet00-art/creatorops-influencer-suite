import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { campaignTypeOptions, normalizeCampaignType, isGroupBuyingCampaign, contentFormatOptions, normalizeContentFormats, toggleContentFormat, contentFormatSummary } from '../src/campaignTypes.js'

test('캠페인 옵션은 플랫폼과 분리된 공동구매를 제공한다', () => {
  assert.equal(campaignTypeOptions.length, 5)
  assert.ok(!campaignTypeOptions.includes('UGC/숏폼'))
  assert.ok(campaignTypeOptions.includes('공동구매'))
  assert.ok(!campaignTypeOptions.includes('틱톡 공동구매 셀러'))
})

test('기존 공동구매 타입을 읽을 때만 변환하며 다른 타입을 보존한다', () => {
  assert.equal(normalizeCampaignType('틱톡 공동구매 셀러'), '공동구매')
  for (const type of [...campaignTypeOptions, 'UGC/숏폼', '사용자 정의 타입']) {
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

test('콘텐츠 형식은 여러 개 선택·해제할 수 있고 입력을 변형하지 않는다', () => {
  const initial = ['숏폼']
  const selected = toggleContentFormat(initial, '라이브')
  assert.deepEqual(initial, ['숏폼'])
  assert.deepEqual(selected, ['숏폼', '라이브'])
  assert.deepEqual(toggleContentFormat(selected, '숏폼'), ['라이브'])
  assert.deepEqual(toggleContentFormat(['라이브'], '라이브'), [])
  assert.ok(!contentFormatOptions.includes('UGC'))
})

test('기존 캠페인은 형식을 추정하지 않고 미정으로 유지한다', () => {
  assert.deepEqual(normalizeContentFormats(undefined), [])
  assert.deepEqual(normalizeContentFormats('UGC/숏폼'), [])
  assert.deepEqual(normalizeContentFormats(['숏폼', '숏폼', '잘못된 형식', '라이브']), ['숏폼', '라이브'])
  assert.equal(contentFormatSummary(['숏폼', '라이브']), '숏폼, 라이브')
  assert.equal(contentFormatSummary([]), '미정 · 협의 필요')
})

test('형식 선택은 생성·수정·정규화·생성 입력에 전달한다', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.equal((app.match(/<ContentFormatSelector/g) || []).length, 3)
  assert.ok(app.includes('contentFormats: normalizeContentFormats(campaignDraft.contentFormats)'))
  assert.ok(app.includes('contentFormats: normalizeContentFormats(campaignEditDraft.contentFormats)'))
  assert.ok(app.includes('contentFormats: normalizeContentFormats(campaign.contentFormats)'))
  const server = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
  assert.equal((server.match(/Respect (all )?campaign.contentFormats/g) || []).length, 3)
})
