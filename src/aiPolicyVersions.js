const policyVersionFieldByFeature = {
  'campaign-strategy': 'strategyPolicyVersion',
  'content-guide': 'guidePolicyVersion',
  'creator-recommendation': 'recommendationPolicyVersion',
  'outreach-message': 'outreachPolicyVersion',
}

export function getGeneratedPolicyVersion(generationState, featureKey) {
  const state = generationState && typeof generationState === 'object' ? generationState : {}
  const versionField = policyVersionFieldByFeature[featureKey]
  const explicitVersion = versionField ? String(state[versionField] || '').trim() : ''
  if (explicitVersion) return explicitVersion
  if (state.policyFeatureKey === featureKey) return String(state.packageVersion || '').trim()
  return ''
}

export function getAiOutputPolicyState({ activePolicy, generationState, featureKey, hasOutput }) {
  if (!activePolicy) return null
  const activeVersion = String(activePolicy.version || '').trim()
  if (!hasOutput) return { status: 'ready', activeVersion, generatedVersion: '', needsRegeneration: false }

  const generatedVersion = getGeneratedPolicyVersion(generationState, featureKey)
  if (!generatedVersion) {
    return { status: 'unknown', activeVersion, generatedVersion: '', needsRegeneration: true }
  }
  if (!activeVersion || generatedVersion === activeVersion) {
    return { status: 'current', activeVersion, generatedVersion, needsRegeneration: false }
  }
  return { status: 'stale', activeVersion, generatedVersion, needsRegeneration: true }
}
