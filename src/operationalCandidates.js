export function isExampleCreator(creator = {}) {
  return creator.isDemo === true || /(?:^|[.@/])example(?:[./:\s]|$)/i.test(`${creator.contactEmail || ''} ${creator.profileUrl || ''}`)
}

// A read-only display projection: never erase stored records or other teams' history.
export function operationalCandidateView(workspace) {
  const creators = (workspace.creators ?? []).filter((creator) => !isExampleCreator(creator))
  const ids = new Set(creators.map((creator) => String(creator.id)))
  const keep = (id) => ids.has(String(id))
  const linked = (rows = []) => rows.filter((row) => !row.isDemo && (!row.creatorId || keep(row.creatorId)))
  return {
    ...workspace,
    creators,
    shortlist: (workspace.shortlist ?? []).filter(keep),
    campaigns: (workspace.campaigns ?? []).map((campaign) => ({ ...campaign, creatorIds: (campaign.creatorIds ?? []).filter(keep) })),
    creatorGroups: (workspace.creatorGroups ?? []).map((group) => ({ ...group, creatorIds: (group.creatorIds ?? []).filter(keep) })).filter((group) => group.creatorIds.length),
    recommendations: linked(workspace.recommendations),
    outreach: linked(workspace.outreach),
    recruitedPool: linked(workspace.recruitedPool),
    quotes: linked(workspace.quotes),
    fulfillmentRecords: linked(workspace.fulfillmentRecords),
    trackedPosts: linked(workspace.trackedPosts),
    candidatePoolEvidence: linked(workspace.candidatePoolEvidence),
  }
}
