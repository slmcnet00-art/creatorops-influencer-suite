export const BRAND_SCOPED_ARRAY_KEYS = [
  'candidatePoolEvidence',
  'recommendations',
  'outreach',
  'recruitedPool',
  'quotes',
  'fulfillmentRecords',
  'trackedPosts',
  'utmTrackingLogs',
  'shortLinkClickLogs',
  'orderAttributionLogs',
  'couponRedemptionLogs',
  'contentReferences',
  'creatorGroups',
  'contentExperiments',
  'conversionEvents',
  'creatorOperations',
  'contentTemplates',
  'operationalAlerts',
]

function recordIdentity(item, index) {
  if (item == null || typeof item !== 'object') return `${typeof item}:${String(item)}`
  return String(item.id ?? item.creatorId ?? item.creator_id ?? item.url ?? item.contentUrl ?? `row-${index}`)
}

function dedupeRecords(items = []) {
  const records = new Map()
  items.forEach((item, index) => records.set(recordIdentity(item, index), item))
  return [...records.values()]
}

export function mergeBrandWorkspaceSnapshots(workspace, snapshots = []) {
  const next = { ...workspace }
  const brandMap = new Map((next.brands ?? []).map((brand) => [String(brand.id), brand]))
  const creatorMap = new Map((next.creators ?? []).map((creator) => [String(creator.id), creator]))

  const creatorVersions = new Map()
  snapshots.forEach((snapshot) => {
    const payload = snapshot?.payload ?? snapshot
    const brandId = String(snapshot?.brand_id ?? payload?.brandId ?? '')
    if (!brandId) return
    if (payload.brand) brandMap.set(brandId, payload.brand)
    const snapshotTime = Date.parse(snapshot?.updated_at) || 0
    ;(payload.creators ?? []).forEach((creator) => {
      const id = String(creator.id)
      if (!creatorVersions.has(id) || snapshotTime >= creatorVersions.get(id)) {
        creatorMap.set(id, creator)
        creatorVersions.set(id, snapshotTime)
      }
    })
    if (Array.isArray(payload.campaigns)) next.campaigns = [
      ...(next.campaigns ?? []).filter((campaign) => String(campaign.brandId) !== brandId),
      ...payload.campaigns,
    ]
    const campaignIds = new Set((payload.campaigns ?? []).map((campaign) => String(campaign.id)))
    BRAND_SCOPED_ARRAY_KEYS.forEach((key) => {
      if (!Array.isArray(payload[key])) return
      const retained = (next[key] ?? []).filter((item) => {
        if (!item || typeof item !== 'object') return brandId !== String(next.activeBrandId)
        const itemBrandId = item.brandId ?? item.brand_id
        const campaignId = item.campaignId ?? item.campaign_id
        return String(itemBrandId ?? '') !== brandId && !campaignIds.has(String(campaignId ?? ''))
      })
      next[key] = dedupeRecords([...retained, ...(payload[key] ?? [])])
    })
    if (brandId === String(next.activeBrandId)) {
      next.shortlist = payload.shortlist ?? next.shortlist
      next.savedProductionReferenceIds = payload.savedProductionReferenceIds ?? next.savedProductionReferenceIds
    }
  })

  next.brands = [...brandMap.values()]
  next.creators = [...creatorMap.values()]
  return next
}

