import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDiscoverySearchPlans, searchAcrossMarkets } from '../server/multiMarketDiscovery.js'
import { assertCreativeExecution, creativeExecutionInstructions } from '../server/creativeExecution.js'

test('AI 확장은 원문 조건을 보존한 현지어에만 붙이며 국가당 최대 3개다', () => {
  const plan = parseDiscoverySearchPlans(JSON.stringify({ queries: [{ country: 'JP', query: '料理 レシピ', focusKeywords: ['お弁当', '時短'] }] }), ['JP'], '요리 레시피')
  assert.deepEqual(plan.searchPlans.JP, ['料理 レシピ', '料理 レシピ お弁当', '料理 レシピ 時短'])
  assert.throws(() => parseDiscoverySearchPlans(JSON.stringify({ queries: [{ country: 'JP', query: '料理', focusKeywords: ['site:evil.com'] }] }), ['JP']))
})

test('확장 검색은 실제 결과만 합치고 중복·원문 불일치·총량 초과를 제거한다', async () => {
  const calls = []
  const result = await searchAcrossMarkets({ query: 'recipe', countries: ['US'], maxResults: 3,
    translate: async () => ({ US: 'recipe', searchPlans: { US: ['recipe', 'recipe lunchbox', 'recipe quick'] } }),
    search: async (query, _limit, _country, options) => {
      calls.push({ query, options })
      if (query.includes('quick')) throw Error('provider unavailable')
      return [{ id: 'one', name: 'recipe', country: 'US', countryConfidence: 'official' }, ...(query.includes('lunchbox') ? [{ id: 'two', name: 'recipe', country: 'US', countryConfidence: 'official' }, { id: 'wrong', name: 'gaming', country: 'US', countryConfidence: 'official' }] : [])]
    },
  })
  assert.deepEqual(result.data.map(row => row.id), ['one', 'two'])
  assert.equal(calls[1].options.evidenceQuery, 'recipe')
  assert.ok(result.search.partial)
})

test('일반론 가이드는 저장하지 않고 한·일 촬영표·검증 계획을 확인한다', () => {
  assert.throws(() => assertCreativeExecution('제품을 소개하고 장점을 말한 후 다운로드를 유도하세요.', 'guide'))
  assert.throws(() => assertCreativeExecution('첫 3초 후킹, 검증 계획만 있음', 'guide'))
  assert.doesNotThrow(() => assertCreativeExecution('0-3s\n検証計画\n|時間|画面|\n|---|---|\n|0-3s|完成品|\n|3-8s|実演|\n|8-20s|結果|', 'guide'))
  assert.match(creativeExecutionInstructions('guide'), /THREE materially different/)
  assert.match(creativeExecutionInstructions('guide'), /not an observation/)
})
