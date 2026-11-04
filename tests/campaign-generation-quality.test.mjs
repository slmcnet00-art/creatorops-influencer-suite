import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignFactsPrompt, assertCampaignGenerationFacts } from '../server/campaignGenerationQuality.js'

test('학습자료 예시보다 현재 0원·10명 사실을 우선하며 다른 AI 산출물은 사실 블록에 넣지 않는다', () => {
  const prompt = campaignFactsPrompt({ budget: 0, recommendationTargetCount: 10, influencerStrategy: 'old 15000000', generatedContentGuide: 'old guide' })
  assert.match(prompt, /"budgetKrw":0/)
  assert.match(prompt, /"totalCandidateTarget":10/)
  assert.doesNotMatch(prompt, /old guide|old 15000000/)
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
