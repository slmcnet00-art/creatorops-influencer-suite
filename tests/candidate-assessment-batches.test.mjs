import test from 'node:test'
import assert from 'node:assert/strict'
import { assessCandidateBatches } from '../server/candidateAssessmentBatches.js'

const candidates = Array.from({ length: 43 }, (_, i) => ({ recommendationId: `r${i}`, creatorId: i, evidence: [{ id: 'actual' }] }))
const review = row => ({ ...row, fitScore: 75, decision: 'recommend', confidence: 'medium', evidenceIds: ['actual'] })

test('43명 전원을 10명 이하·동시 2개 배치로 평가하며 최종 목표 10명으로 잘라내지 않는다', async () => {
  let active = 0, maxActive = 0
  const sizes = []
  const results = await assessCandidateBatches(candidates, async batch => {
    sizes.push(batch.length); active++; maxActive = Math.max(active, maxActive)
    await new Promise(resolve => setTimeout(resolve, 2))
    active--
    return batch.map(review)
  })
  assert.deepEqual(sizes, [10, 10, 10, 10, 3])
  assert.equal(maxActive, 2)
  assert.equal(results.length, 43)
  assert.equal(new Set(results.map(row => row.creatorId)).size, 43)
})

test('배치 한 개가 누락되면 부분 결과를 성공한 전체 평가로 반환하지 않는다', async () => {
  await assert.rejects(assessCandidateBatches(candidates, async (batch, meta) => meta.index === 1 ? [] : batch.map(review)))
})
