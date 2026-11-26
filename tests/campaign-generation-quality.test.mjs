import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignFactsPrompt, assertCampaignGenerationFacts } from '../server/campaignGenerationQuality.js'
import { campaignBrandInput, generationSourceInput, emptyBrandBrief } from '../shared/campaignGenerationInput.js'

test('새 브랜드에 남은 세럼 데모 자료와 기본 플랫폼이 요리 앱 사실로 섞이지 않는다', () => {
  const brand = { name: '깨빙', brief: { product: '신규 캠페인 제품', platforms: ['Instagram', 'TikTok'], categories: ['뷰티'], learningMaterials: [{ title: '세럼', sourceType: '데모 학습자료' }, { title: '실제 브랜드 자료', sourceType: '파일', summary: '검증한 내용' }] } }
  const result = campaignBrandInput(brand, { product: '요리 레시피 앱', preferredPlatforms: 'youtube' })
  assert.doesNotMatch(JSON.stringify(result), /세럼|뷰티|Instagram|TikTok/)
  assert.match(JSON.stringify(result), /실제 브랜드 자료/)
  assert.equal(brand.brief.learningMaterials.length, 2)
  assert.equal(generationSourceInput({ learningMaterials: brand.brief.learningMaterials }).learningMaterials.length, 1)
  const empty = emptyBrandBrief({ product: '세럼', categories: ['뷰티'], platforms: ['Instagram'], learningMaterials: brand.brief.learningMaterials, tone: '친근하게' })
  assert.deepEqual(empty.learningMaterials, [])
  assert.deepEqual(empty.platforms, [])
  assert.equal(empty.product, '')
  assert.equal(empty.tone, '친근하게')
})

test('미확인 표지만 붙인 가상 앱 필터와 공개 API 저장 지표 수집도 거부한다', () => {
  const campaign = { product: '깨빙 요리 레시피 앱', preferredPlatforms: 'youtube' }
  assert.throws(() => assertCampaignGenerationFacts('확인 필요: 남은 재료 활용 필터로 검색한다', campaign), { status: 422 })
  assert.throws(() => assertCampaignGenerationFacts('저장률과 저장 수 집계', campaign), { status: 422 })
  assert.doesNotThrow(() => assertCampaignGenerationFacts('공개 API에 저장률 미제공, 별도 확인 필요', campaign))
})

test('학습자료 예시보다 현재 0원·10명 사실을 우선하며 다른 AI 산출물은 사실 블록에 넣지 않는다', () => {
  const prompt = campaignFactsPrompt({ budget: 0, recommendationTargetCount: 10, influencerStrategy: 'old 15000000', generatedContentGuide: 'old guide' })
  assert.match(prompt, /"budgetKrw":0/)
  assert.match(prompt, /"totalCandidateTarget":10/)
  assert.doesNotMatch(prompt, /old guide|old 15000000/)
  assert.match(prompt, /INTERNAL CRM|internal CRM/)
})

test('실제 0원 캠페인에 1,500만 원을 다시 제안하는 생성물은 성공 처리하지 않는다', () => {
  for (const output of ['예산 총액: 15,000,000 KRW', '- 예산: 1500만 원', '予算: 1,630,000 JPY']) {
    assert.throws(() => assertCampaignGenerationFacts(output, { budget: 0 }), { status: 422 })
  }
  assert.doesNotThrow(() => assertCampaignGenerationFacts('예산: 0원 · 비용 별도 협의\n공개 조회: 33,168,967회', { budget: 0 }))
  assert.doesNotThrow(() => assertCampaignGenerationFacts('예산: 15,000,000 KRW', { budget: 15000000 }))
})

test('미확인 일본어 지원 확정과 원본 링크 조작은 거부한다', () => {
  assert.throws(() => assertCampaignGenerationFacts('깨빙は日本語対応アプリで、便利です。', { budget: 0 }), { status: 422 })
  const source = { references: [{ url: 'https://www.youtube.com/watch?v=MWJumz6syok' }] }
  assert.doesNotThrow(() => assertCampaignGenerationFacts('https://www.youtube.com/watch?v=MWJumz6syok', {}, source))
  assert.throws(() => assertCampaignGenerationFacts('https://www.youtube.com/watch?v=MWJumz6syoA', {}, source), { status: 422 })
})
