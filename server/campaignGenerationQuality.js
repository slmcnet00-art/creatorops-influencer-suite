export const CAMPAIGN_FACT_INSTRUCTIONS = 'The current campaign facts at the end of the request override examples, old outputs, learning materials and general playbooks. Never invent approved budget, features, language support, brand collaborations, safety verification or conversion results. Reference adaptation ideas are proposed new scenes, not scenes observed in the original. Output a review draft, not an approved production instruction.'

export function campaignFactsPrompt(campaign = {}) {
  return '\n\n## AUTHORITATIVE CURRENT CAMPAIGN FACTS (override any conflicting example)\n' + JSON.stringify({
    budgetKrw: Number(campaign.budget ?? 0),
    totalCandidateTarget: Number(campaign.recommendationTargetCount || 0),
    assignedCreatorIds: campaign.creatorIds ?? [],
    targetCountry: campaign.targetCountry,
    outputLanguage: campaign.outputLanguage,
    contentFormats: campaign.contentFormats,
    product: campaign.product,
    reward: campaign.reward,
    mission: campaign.mission,
    unknownUntilVerified: ['app Japanese language support', 'exact app features and available recipes', 'store/download URL', 'agreed creator fee', 'conversion tracking integration', 'audience demographics', 'brand safety and fake follower rates'],
    zeroBudgetRule: '0 KRW is the only approved budget when budgetKrw is 0. Do not import 15,000,000 or any example amount. Do not allocate paid fees until separately approved.',
  })
}

export function assertCampaignGenerationFacts(text, campaign = {}, source = {}) {
  const fail = (message) => { throw Object.assign(new Error(message), { status: 422 }) }
  if (Number(campaign.budget ?? 0) === 0) {
    for (const line of String(text).split('\n')) {
      if (!/예산|予算|budget/i.test(line)) continue
      const numbers = [...line.matchAll(/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:KRW|JPY|원|円|만\s*원|억\s*원)/gi)]
      if (numbers.some((match) => Number(match[0].replace(/[^\d.]/g, '')) > 0)) fail('생성된 예산이 저장된 0원 예산과 다릅니다. 전략을 검토한 후 다시 생성하세요.')
    }
  }
  if (/日本語対応アプリで|일본어 지원[^\n]{0,20}기능을 갖춘/.test(text)) fail('확인되지 않은 일본어 지원을 확정한 생성물입니다. 앱 지원 정보를 확인하세요.')
  const videoIds = (value) => [...String(value).matchAll(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/g)].map((match) => match[1])
  const permitted = new Set(videoIds(JSON.stringify(source)))
  if (videoIds(text).some((id) => !permitted.has(id))) fail('입력에 없는 YouTube 원본 링크가 생성되어 저장하지 않았습니다.')
}
