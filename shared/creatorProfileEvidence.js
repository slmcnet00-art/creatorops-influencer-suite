export function profileEvidenceKey(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    const path = url.pathname.replace(/\/+$/, '')
    return host + (host === 'youtube.com' && path.startsWith('/channel/') ? path : path.toLowerCase())
  } catch { return '' }
}
export function applyCreatorProfileEvidence(workspace, observations) {
  const evidence = new Map(observations.filter(row => row.status === 'verified').map(row => [profileEvidenceKey(row.profileUrl), row]))
  let changed = false
  const creators = (workspace.creators || []).map(creator => {
    const row = evidence.get(profileEvidenceKey(creator.profileUrl))
    if (!row || Date.parse(row.collectedAt) <= Date.parse(creator.profileCheckedAt || 0)) return creator
    const patch = { profileCheckedAt: row.collectedAt }
    if (row.imageUrl) Object.assign(patch, { profileImageUrl: row.imageUrl, profileImageStatus: 'verified', profileImageCollectedAt: row.collectedAt })
    if (Number.isSafeInteger(row.followers) && row.followers >= 0) {
      const old = creator.followers == null || creator.followers === '' ? null : Number(creator.followers)
      Object.assign(patch, { followers: row.followers, followerCheckedAt: row.collectedAt, followerSource: row.source, followerPrecision: row.followerPrecision })
      if (Number.isFinite(old) && old !== null && old !== row.followers) Object.assign(patch, { previousFollowers: old, followerChange: row.followers - old })
      patch.followerHistory = [...(creator.followerHistory || []), { value: row.followers, measuredAt: row.collectedAt, source: row.source }].slice(-30)
    }
    changed = true
    return { ...creator, ...patch }
  })
  return changed ? { ...workspace, creators } : workspace
}
