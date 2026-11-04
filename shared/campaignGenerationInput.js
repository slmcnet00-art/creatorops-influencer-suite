// Previous AI output is not product evidence and must not become the next prompt's facts.
export function emptyBrandBrief(defaults = {}) {
  return { ...defaults, brandName: '', product: '', persona: '', keywords: '', categories: [], platforms: [], learningMaterials: [], minFollowers: 0, maxPrice: 0 }
}

export function generationSourceInput(value) {
  if (Array.isArray(value)) return value.filter(item => !item || typeof item !== 'object' || !(/demo|데모|예시\s*학습/i.test(`${item.sourceType || ''} ${item.createdAt || ''}`) || item.isDemo === true)).map(generationSourceInput)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, generationSourceInput(item)]))
}

export function campaignBrandInput(brand = {}, campaign = {}) {
  const next = generationSourceInput(brand)
  const brief = { ...(next.brief || {}) }
  // The new-brand starter brief is a UI placeholder, not researched brand evidence.
  if (/신규 캠페인 제품|new campaign product/i.test(brief.product || '')) {
    for (const key of ['product', 'categories', 'platforms', 'goal', 'persona', 'keywords', 'minFollowers', 'maxPrice']) delete brief[key]
  }
  return { ...next, brief, currentCampaignProduct: campaign.product || '', currentCampaignPlatforms: campaign.preferredPlatforms || '' }
}

export function campaignGenerationInput(campaign = {}, { includeStrategy = false } = {}) {
  const next = { ...campaign }
  for (const key of ['generatedContentGuide', 'individualContentGuides', 'generationState', 'strategyInputRaw']) delete next[key]
  if (!includeStrategy) delete next.influencerStrategy
  return generationSourceInput(next)
}

export function creatorGenerationInput(creator = {}) {
  // Discovery's modelled rate, engagement and safety scores are not observed facts.
  return Object.fromEntries(['id', 'name', 'handle', 'platform', 'profileUrl', 'country', 'countryConfidence', 'followers', 'sourceTitle', 'sourceSnippet', 'recentRelevance', 'matchedContentUrl', 'sourceCollectedAtIso']
    .filter((key) => creator[key] !== undefined).map((key) => [key, creator[key]]))
}
