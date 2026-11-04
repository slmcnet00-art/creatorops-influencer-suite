import test from 'node:test'
import assert from 'node:assert/strict'
import { planCampaignBudget } from '../src/campaignBudget.js'

const creators = [{ id: 1, name: 'A', actualPrice: 700, price: 700 }, { id: 2, name: 'B', actualPrice: 400, price: 400 }, { id: 3, name: 'C', actualPrice: 300, price: 300 }, { id: 4, name: '미확인', price: 0 }]
const rows = creators.map((c, i) => ({ id: i + 10, creatorId: c.id, score: 100 - i }))
test('한 명씩이 아니라 전체 추천 합계를 총예산 안에 제한한다', () => {
  const plan = planCampaignBudget({ budget: 1000, recommendationTargetCount: 10 }, rows, creators)
  assert.deepEqual(plan.items.map((row) => row.creatorId), [1, 3])
  assert.equal(plan.totalCost, 1000)
  assert.equal(plan.unknownCount, 1)
  assert.equal(plan.overBudgetCount, 1)
})
test('예산 증감·집행액·인당 한도·목표 수가 즉시 재계산된다', () => {
  assert.deepEqual(planCampaignBudget({ budget: 500 }, rows, creators).items.map(r => r.creatorId), [2])
  assert.equal(planCampaignBudget({ budget: 1400 }, rows, creators).items.length, 3)
  assert.equal(planCampaignBudget({ budget: 1000, spend: 600 }, rows, creators).totalCost, 400)
  assert.equal(planCampaignBudget({ budget: 1000, maxCreatorFee: 500 }, rows, creators).totalCost, 700)
  assert.equal(planCampaignBudget({ budget: 1400, recommendationTargetCount: 1 }, rows, creators).items.length, 1)
})
test('0원·미확인 단가는 무가 협찬으로 간주하지 않고 원본 후보는 보존한다', () => {
  assert.equal(planCampaignBudget({ budget: 0 }, rows, creators).items.length, 0)
  assert.equal(planCampaignBudget({ budget: 400 }, rows, [{ id: 1, actualPrice: 300, price: 700 }]).totalCost, 300)
  assert.equal(rows.length, 4)
  assert.equal(creators[0].price, 700)
})
test('중복·없는 후보·잘못된 금액과 목표로 예산을 초과하거나 같은 후보를 두 번 추천하지 않는다', () => {
  const plan = planCampaignBudget({ budget: -1 }, [...rows, rows[0]], creators)
  assert.equal(plan.totalCost, 0)
  assert.equal(plan.items.length, 0)
  for (let budget = 0; budget < 1500; budget += 17) {
    const p = planCampaignBudget({ budget, spend: 50 }, [...rows, rows[0]], creators)
    assert.ok(p.totalCost <= Math.max(0, budget - 50))
    assert.equal(new Set(p.items.map(row => row.creatorId)).size, p.items.length)
  }
})
