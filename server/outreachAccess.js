const error = (status, message) => Object.assign(new Error(message), { status })
export function assertOutreachRole(user) {
  if (!['Owner', 'Admin', 'Manager', 'Marketer'].includes(user?.role)) throw error(403, 'This role cannot send outreach or change suppressions.')
}
export function assertCampaignScope(user, campaign) {
  assertOutreachRole(user)
  if (!campaign) throw error(404, 'The campaign must be saved to the shared workspace before sending.')
  if (!['Owner', 'Admin'].includes(user.role) && !(user.brandIds || []).map(String).includes(String(campaign.brandId))) throw error(403, 'No write access to this campaign brand.')
}
