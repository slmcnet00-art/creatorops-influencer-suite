import { planCampaignBudget } from './campaignBudget.js'

export default function CampaignBudgetPanel({ campaign, recommendations, creators }) {
  if (!campaign) return null
  const plan = planCampaignBudget(campaign, recommendations.filter(row => row.campaignId === campaign.id), creators)
  const krw = value => `${value.toLocaleString('ko-KR')}원`
  return <div className="campaign-guide-detail" aria-label="예산 내 추천 계획">
    <strong>적합도순 예산 내 추천 · {plan.items.length}/{plan.target}명</strong>
    <p>총예산 {krw(plan.budget)} · 집행액 {krw(plan.spend)} · 사용 가능 {krw(plan.availableBudget)}</p>
    <p>추천 합계 {krw(plan.totalCost)} · 추천 후 잔액 {krw(plan.remainingBudget)}</p>
    {!plan.budget && <p>예산 미확정입니다. 0원이 무가 협찬을 의미하지 않습니다. 예산을 입력하면 유가 추천 목록을 계산합니다.</p>}
    <p>단가 미확인 {plan.unknownCount}명 · 잔여 예산 초과 {plan.overBudgetCount}명 · 인당 한도 초과 {plan.overFeeCount}명 제외</p>
    {plan.items.length > 0 && <ul>{plan.items.map(row => <li key={row.creatorId}>{row.creatorName} · {krw(row.budgetCost)}</li>)}</ul>}
    <small>단가는 협의 전 추정치일 수 있습니다. 예산은 원화 기준이며 후보 비용의 합계를 제한합니다. 제작·세금·기타 비용은 예산에서 별도 확보하세요. 예산 변경 시 추천은 즉시 재계산되며 저장 후보는 유지됩니다. 기존 전략·가이드는 재검토하세요.</small>
  </div>
}
