import { getCreatorRateSummary } from '../shared/creatorRates.js'
const money = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0

export function planCampaignBudget(campaign = {}, rows = [], creators = []) {
  const budget = money(campaign.budget)
  const spend = money(campaign.spend)
  const availableBudget = Math.max(0, budget - spend)
  const target = Math.floor(money(campaign.recommendationTargetCount)) || 10
  const maxFee = money(campaign.maxCreatorFee)
  const byId = new Map(creators.map(creator => [String(creator.id), creator]))
  const seen = new Set()
  const items = []
  let totalCost = 0, unknownCount = 0, overBudgetCount = 0, overFeeCount = 0
  for (const row of [...rows].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))) {
    const key = String(row.creatorId)
    if (seen.has(key)) continue
    seen.add(key)
    const creator = byId.get(key)
    if (!creator) continue
    const rate = getCreatorRateSummary(creator, campaign)
    const cost = rate.budgetPrice
    if (!cost) { unknownCount++; continue }
    if (maxFee && cost > maxFee) { overFeeCount++; continue }
    if (items.length >= target) continue
    if (cost > availableBudget - totalCost) { overBudgetCount++; continue }
    items.push({ ...row, budgetCost: cost, creatorName: creator.name, rateLabel: rate.actualPrice ? '협의 금액' : '예상 상한', rateRange: rate.range })
    totalCost += cost
  }
  return { budget, spend, availableBudget, target, items, totalCost, remainingBudget: availableBudget - totalCost, unknownCount, overBudgetCount, overFeeCount }
}
