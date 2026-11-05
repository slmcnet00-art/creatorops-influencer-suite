export const CAMPAIGN_FACT_INSTRUCTIONS = 'The current campaign facts at the end of the request override examples, old outputs, learning materials and general playbooks. Never invent approved budget, features, language support, brand collaborations, safety verification or conversion results. Reference adaptation ideas are proposed new scenes, not scenes observed in the original. Output a review draft, not an approved production instruction.'

export function campaignFactsPrompt(campaign = {}) {
  return '\n\n## AUTHORITATIVE CURRENT CAMPAIGN FACTS (override any conflicting example)\n' + JSON.stringify({
    budgetKrw: Number(campaign.budget ?? 0),
    totalCandidateTarget: Number(campaign.recommendationTargetCount || 0),
    assignedCreatorIds: campaign.creatorIds ?? [],
    targetCountry: campaign.targetCountry,
    preferredPlatforms: campaign.preferredPlatforms,
    outputLanguage: campaign.outputLanguage,
    contentFormats: campaign.contentFormats,
    product: campaign.product,
    reward: campaign.reward,
    mission: campaign.mission,
    kpiTarget: campaign.kpiTarget,
    internalSaveMeaning: 'Saving/selecting candidates means storing creator records in the internal CRM. It is NOT a public-video save or save-rate metric. In a candidate-selection test, measure valid records selected/saved; do not claim posts, creator agreements or audience engagement already occurred.',
    unknownUntilVerified: ['app Japanese language support', 'exact app features and available recipes', 'store/download URL', 'agreed creator fee', 'conversion tracking integration', 'audience demographics', 'brand safety and fake follower rates'],
    zeroBudgetRule: '0 KRW is the only approved budget when budgetKrw is 0. Do not import 15,000,000 or any example amount. Do not allocate paid fees until separately approved.',
    creativeGrounding: 'Product category/name is not proof of specific functionality. Do NOT invent named app filters, timers, ingredient recommendations, automatic shopping lists, save functions or guarantees, even with a confirmation-required label. When no verified feature evidence is supplied, build the creative around a specific real cooking/content premise and brand introduction; reserve an actual app-screen proof slot pending supplied screen evidence. Do not make the chosen concept depend on an imagined feature. Never claim guaranteed zero failure or time savings. Market/audience statements without supplied research are hypotheses, not observed facts.',
    platformRule: 'The selected preferredPlatforms and contentFormats override brand starter defaults and learning examples. If only YouTube is selected, do not deliver Instagram/TikTok scripts. Public YouTube data does NOT provide saves/shares, watch retention or app installs. Those require separately supplied owner analytics/integration; without it, plan only accessible views/likes/comments and manual qualitative review.',
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
  const unconditionalText = String(text).split('\n').filter(line => !/要確認|확인 필요|未確認|미확인|confirmation required/i.test(line)).join('\n')
  if (/日本語対応アプリで|일본어 지원[^\n]{0,20}기능을 갖춘/.test(unconditionalText)) fail('확인되지 않은 일본어 지원을 확정한 생성물입니다. 앱 지원 정보를 확인하세요.')
  const videoIds = (value) => [...String(value).matchAll(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/g)].map((match) => match[1])
  const permitted = new Set(videoIds(JSON.stringify(source)))
  if (videoIds(text).some((id) => !permitted.has(id))) fail('입력에 없는 YouTube 원본 링크가 생성되어 저장하지 않았습니다.')
  const isApp = /앱|\bapp\b/i.test(String(campaign.product || ''))
  const sourceFacts = JSON.stringify({ product: campaign.product, mission: campaign.mission, verifiedFeatures: campaign.verifiedFeatures, productEvidence: campaign.productEvidence })
  if (isApp) {
    for (const capability of ['남은 재료 활용.*?필터', '남은 재료로 만들기', '단계별 타이머', '10분 레시피.*?카테고리', '절대 실패.*?카테고리', '余り食材.*?フィルター', 'タイマー機能']) {
      const pattern = new RegExp(capability, 'i')
      if (pattern.test(text) && !pattern.test(sourceFacts)) fail('제공되지 않은 앱 기능을 가정한 제안입니다. 확인된 기능으로 다시 생성하세요.')
    }
  }
  if (/youtube/i.test(String(campaign.preferredPlatforms || '')) && !/instagram|tiktok/i.test(String(campaign.preferredPlatforms || ''))) {
    const measurable = String(text).split('\n').filter(line => !/수동|불가|미제공|제공하지|수집하지|확인 필요|별도|직접|未提供|取得でき|手動|別途|要確認|not available|owner analytics/i.test(line))
    if (measurable.some(line => /저장률|저장\s*수\s*(집계|수집)|保存率|保存数.*(?:集計|収集)/.test(line))) fail('공개 YouTube API에서 제공하지 않는 저장 지표를 수집 대상으로 확정했습니다.')
  }
}
