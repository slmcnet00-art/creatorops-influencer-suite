import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewGuideClaims, reviewCampaignGuides } from '../shared/guideClaimReview.js'
import { assertCampaignGenerationFacts } from '../server/campaignGenerationQuality.js'

test('미확인 일본어 지원·검색·보관 기능은 확인 후 사용할 문구로 표시한다', () => {
  const jp = reviewGuideClaims('このアプリは日本語対応で便利です。\nアプリのレシピ検索画面を録画。')
  assert.equal((jp.match(/要確認/g) || []).length, 2)
  const ko = reviewGuideClaims('깨빙 앱에서 재료별 검색이 가능합니다.\n앱의 요리 과정을 관리할 수 있어요.')
  assert.equal((ko.match(/확인 필요/g) || []).length, 2)
  assert.equal(reviewGuideClaims(jp), jp)
})
test('0원 예산을 무가 협찬으로 확정한 표현과 합의되지 않은 조건은 정정한다', () => {
  const text = reviewGuideClaims('本キャンペーンは現時点で無償シーディング\n合意済み納品物：動画\n예산 0원, 무상 협찬 위주')
  assert.doesNotMatch(text, /現時点で無償シーディング|合意済み納品物|무상 협찬 위주/)
  assert.match(text, /未確定/)
  assert.match(text, /협의 필요/)
})
test('확인 필요 표시가 이미 있거나 조리·실제 레퍼런스 근거인 내용은 유지한다', () => {
  const text = '앱 검색 화면: 실제 지원 여부 확인 후 촬영\n0~3초: 완성 접시를 보여주세요.\nhttps://www.youtube.com/watch?v=MWJumz6syok\n공개 조회수: 33,168,967회'
  assert.equal(reviewGuideClaims(text), text)
})

test('기존 전략·공통·개별 가이드를 모두 검수하고 원본과 추적 링크는 보존한다', () => {
  const text = '깨빙は日本語対応アプリで便利です。'
  const campaign = { influencerStrategy: text, generatedContentGuide: text, individualContentGuides: { 1: { guide: text, trackingLinks: { url: 'https://example.com' } } } }
  const reviewed = reviewCampaignGuides(campaign)
  assert.match(reviewed.influencerStrategy, /要確認/)
  assert.match(reviewed.generatedContentGuide, /要確認/)
  assert.match(reviewed.individualContentGuides[1].guide, /要確認/)
  assert.deepEqual(reviewed.individualContentGuides[1].trackingLinks, campaign.individualContentGuides[1].trackingLinks)
  assert.equal(campaign.influencerStrategy, text)
  assert.doesNotThrow(() => assertCampaignGenerationFacts(reviewed.generatedContentGuide, { budget: 0 }))
  assert.throws(() => assertCampaignGenerationFacts(reviewGuideClaims('予算: 15000 JPY'), { budget: 0 }), { status: 422 })
})
