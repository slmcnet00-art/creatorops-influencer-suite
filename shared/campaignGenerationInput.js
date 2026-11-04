// Previous AI output is not product evidence and must not become the next prompt's facts.
export function campaignGenerationInput(campaign = {}, { includeStrategy = false } = {}) {
  const next = { ...campaign }
  for (const key of ['generatedContentGuide', 'individualContentGuides', 'generationState', 'strategyInputRaw']) delete next[key]
  if (!includeStrategy) delete next.influencerStrategy
  return next
}

export function creatorGenerationInput(creator = {}) {
  // Discovery's modelled rate, engagement and safety scores are not observed facts.
  return Object.fromEntries(['id', 'name', 'handle', 'platform', 'profileUrl', 'country', 'countryConfidence', 'followers', 'sourceTitle', 'matchedContentUrl', 'sourceCollectedAtIso']
    .filter((key) => creator[key] !== undefined).map((key) => [key, creator[key]]))
}
