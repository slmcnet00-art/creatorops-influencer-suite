import test from 'node:test'
import assert from 'node:assert/strict'
import { generateReviewedCreative } from '../server/creativeReview.js'

test('초안의 허구 기능을 검토 단계에서 고친 뒤 검증한 본문만 반환한다', async () => {
  const stages = []
  const result = await generateReviewedCreative({ prompt: 'actual source', campaign: { product: '요리 앱', budget: 0 }, trace: { sources: [] }, source: {}, kind: 'strategy',
    run: async (prompt, context) => {
      stages.push(context.stage)
      if (context.stage === 'draft') return '남은 재료 활용 필터로 검색'
      assert.match(prompt, /남은 재료 활용 필터/)
      const result = JSON.stringify({ issues: ['가상 필터 삭제'], text: '0-3s: 캔참치 개봉 클로즈업. 검증: 원본 확인 후 콘셉트 비교.' })
      context.validateOutput(result)
      return result
    },
  })
  assert.deepEqual(stages, ['draft', 'review'])
  assert.doesNotMatch(result.text, /필터/)
  assert.equal(result.review.productionApproved, false)
})

test('검토 모델이 원본 링크를 지어내면 성공한 가이드로 반환하지 않는다', async () => {
  await assert.rejects(generateReviewedCreative({ prompt: 'source', campaign: {}, trace: { sources: [] }, source: {}, kind: 'strategy',
    run: async (_prompt, context) => context.stage === 'draft' ? 'draft' : JSON.stringify({ issues: [], text: '0-3s 검증 https://youtu.be/XXXXXXXXXXX' }),
  }), { status: 422 })
})

test('자료를 읽었다는 모델 주장 대신 원문과 일치하는 원칙만 출처에 기록한다', async () => {
  const source = { id: 'actual', citationId: 'S1', name: '가이드.txt' }
  const runWith = principleId => generateReviewedCreative({ prompt: 'source', campaign: {}, trace: { sources: [source] }, principles: [{ id: 'S1-P1', citationId: 'S1', quote: '원본 화면과 문장을 복제하지 않는다.' }], source: {}, kind: 'strategy',
    run: async (_prompt, context) => context.stage === 'draft' ? 'draft' : JSON.stringify({ issues: [], text: '0-3s 캔참치 클로즈업, 비교 검증.', learningApplications: [{ principleId, application: '새로운 손동작으로 도입 장면을 제안한다.' }] }),
  })
  await assert.rejects(runWith('invented'), { status: 422 })
  const result = await runWith('S1-P1')
  assert.match(result.text, /\[K:S1\]/)
  assert.match(result.text, /원본 화면과 문장을 복제하지 않는다/)
})
