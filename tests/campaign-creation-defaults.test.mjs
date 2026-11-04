import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveCampaignBudget, buildNewCampaignAllocation } from '../src/campaignCreationDefaults.js'

test('명시한 예산 0과 양수는 그대로 보존하고 미입력은 0으로 시작한다', () => {
  for (const value of [0, '0', '', undefined, null]) assert.equal(resolveCampaignBudget(value), 0)
  assert.equal(resolveCampaignBudget('2300000'), 2300000)
  assert.equal(resolveCampaignBudget('', 500000), 500000)
  for (const value of ['invalid', -1, Infinity]) assert.equal(resolveCampaignBudget(value, 500000), 500000)
})

test('공용 후보 풀이 있어도 신규 캠페인은 배정·예상비용·진행률 없이 시작한다', () => {
  const sharedPool = [1, 3, 6]
  const first = buildNewCampaignAllocation(sharedPool)
  assert.deepEqual(first, { creatorIds: [], plannedCreatorCost: 0, progress: 0, stages: [0, 0, 0, 0] })
  first.creatorIds.push(99)
  assert.deepEqual(buildNewCampaignAllocation(sharedPool).creatorIds, [])
  assert.deepEqual(sharedPool, [1, 3, 6])
})

test('생성·수정 경로는 0원 예산을 지원하고 신규 생성에 shortlist를 배정하지 않는다', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const create = app.slice(app.indexOf('  const createCampaign ='), app.indexOf('  const createCreator ='))
  assert.match(create, /buildNewCampaignAllocation\(\)/)
  assert.match(create, /resolveCampaignBudget\(campaignDraft.budget\)/)
  assert.doesNotMatch(create, /getCreatorsByIds\(creators, shortlist\)|creatorIds: \[\.\.\.shortlist\]|15000000/)
  assert.match(app, /resolveCampaignBudget\(campaignEditDraft.budget, activeCampaignForModal.budget\)/)
  assert.doesNotMatch(app, /spend: Math.min\(activeCampaignForModal.spend/)
})
