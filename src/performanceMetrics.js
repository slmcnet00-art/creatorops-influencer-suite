export const getAverageViews = creator => Number(creator?.averageViews ?? creator?.avgViews ?? 0) || 0

export function getActualSpend(campaign, fulfillment = [], operations = []) {
  const matches = row => String(row.campaignId) === String(campaign.id)
  const recorded = fulfillment.filter(matches).reduce((sum, row) => sum + Number(row.paymentAmount || 0), 0)
    + operations.filter(matches).reduce((sum, row) => sum + Number(row.actualCost || 0), 0)
  return Math.max(0, recorded, Number(campaign.actualSpend || 0))
}

export function getActualRevenue(campaign, events = []) {
  const rows = events.filter(event => String(event.campaignId) === String(campaign.id) && ['purchase', 'refund'].includes(event.eventType))
  if (!rows.length) return Math.max(0, Number(campaign.actualRevenue || 0))
  return Math.max(0, rows.reduce((sum, event) => sum + Number(event.eventValue || 0) * (event.eventType === 'refund' ? -1 : 1), 0))
}

export function aggregateEngagement(posts = []) {
  const views = posts.reduce((sum, post) => sum + Number(post.views || 0), 0)
  const interactions = posts.reduce((sum, post) => {
    const counts = ['likes', 'comments', 'shares', 'saves'].reduce((n, key) => n + Number(post[key] || 0), 0)
    return sum + (counts || Math.max(0, Number(post.engagementRate || 0)) / 100 * Number(post.views || 0))
  }, 0)
  return views > 0 ? interactions / views * 100 : 0
}
