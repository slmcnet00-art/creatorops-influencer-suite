import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCandidateEvidence, validateCandidateAssessments, applyCandidateAssessments } from '../shared/evidenceRanking.js'
import { planCampaignBudget } from '../src/campaignBudget.js'

const candidates = [
  { recommendationId: 'r1', creatorId: 1, evidence: [{ id: 'v1', text: '먹방' }] },
  { recommendationId: 'r2', creatorId: 2, evidence: [{ id: 'v2', text: '재료와 순서가 있는 요리 레시피' }] },
]
const assessment = (index, fitScore, decision = 'recommend') => ({ ...candidates[index], fitScore, decision, confidence: 'medium', evidenceIds: [candidates[index].evidence[0].id], aiSummary: '입력 영상 근거로 평가' })

test('AI가 규칙 점수가 낮았던 실제 레시피 후보를 최종 예산 선정 전에 올릴 수 있다', () => {
  const rows = [{ id: 'r1', creatorId: 1, score: 99 }, { id: 'r2', creatorId: 2, score: 20 }]
  const items = validateCandidateAssessments([assessment(0, 35, 'exclude'), assessment(1, 90)], candidates)
  const ranked = applyCandidateAssessments(rows, items)
  const plan = planCampaignBudget({ budget: 100000, recommendationTargetCount: 1 }, ranked, [{ id: 1, actualPrice: 10000 }, { id: 2, actualPrice: 50000 }])
  assert.deepEqual(plan.items.map(row => row.creatorId), [2])
  assert.equal(plan.totalCost, 50000)
  assert.equal(rows[1].score, 20)
})

test('알 수 없는 후보·중복·누락·출처 없는 추천은 성공한 AI 평가로 저장하지 않는다', () => {
  for (const items of [
    [assessment(0, 90)],
    [assessment(0, 90), assessment(0, 80)],
    [assessment(0, 90), { ...assessment(1, 90), creatorId: 'invented' }],
    [assessment(0, 90), { ...assessment(1, 90), evidenceIds: ['fabricated'] }],
    [assessment(0, 90), { ...assessment(1, 90), evidenceIds: [] }],
  ]) assert.throws(() => validateCandidateAssessments(items, candidates))
  const review = validateCandidateAssessments([assessment(0, 35, 'exclude'), { ...assessment(1, 50, 'review'), evidenceIds: [] }], candidates)
  assert.equal(review[1].decision, 'review')
})

test('실제 최근 영상과 프로필 근거만 입력하고 검색국가·모델 단가를 사실로 승격하지 않는다', () => {
  const value = buildCandidateEvidence({ sourceSnippet: '요리 순서', searchCountry: 'JP', price: 120000, recentRelevance: { evidence: [{ videoId: 'abc', title: '레시피', url: 'https://youtu.be/abc' }] } })
  assert.ok(value.some(item => item.text.includes('요리 순서')))
  assert.doesNotMatch(JSON.stringify(value), /120000|JP/)
})
