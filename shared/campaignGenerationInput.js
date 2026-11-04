// Previous AI output is not product evidence and must not become the next prompt's facts.
export function campaignGenerationInput(campaign = {}, { includeStrategy = false } = {}) {
  const next = { ...campaign }
  for (const key of ['generatedContentGuide', 'individualContentGuides', 'generationState', 'strategyInputRaw']) delete next[key]
  if (!includeStrategy) delete next.influencerStrategy
  return next
}
