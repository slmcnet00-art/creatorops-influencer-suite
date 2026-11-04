export function resolveCampaignBudget(value, fallback = 0) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback
}

// A shared saved-candidate pool is not consent to assign everyone to a new campaign.
export function buildNewCampaignAllocation() {
  return { creatorIds: [], plannedCreatorCost: 0, progress: 0, stages: [0, 0, 0, 0] }
}
