// Normalization must not discard links or provenance when a shared snapshot
// is read, saved, polled or opened on another device.
export function creatorGroupBrandId(group, campaigns = []) {
  const explicit = group.brandId ?? group.brand_id
  if (explicit !== undefined && explicit !== null && explicit !== '') return String(explicit)
  const campaignId = group.campaignId ?? group.campaign_id
  if (campaignId === undefined || campaignId === null || campaignId === '') return ''
  const campaign = campaigns.find(item => String(item.id) === String(campaignId))
  return String(campaign?.brandId ?? campaign?.brand_id ?? '')
}

export function creatorGroupsForBrand(groups = [], campaigns = [], brandId, scope = 'current') {
  return scope === 'all' ? groups : groups.filter(group => creatorGroupBrandId(group, campaigns) === String(brandId))
}

export function normalizeCreatorGroups(groups = [], creators = []) {
  const creatorIds = new Map(creators.map(creator => [String(creator.id), creator.id]))
  return (Array.isArray(groups) ? groups : []).filter(group => group && typeof group === 'object').map((group, index) => ({
    ...group,
    id: group.id || `group-${index + 1}`,
    name: group.name || `인플루언서 그룹 ${index + 1}`,
    description: group.description || '운영자가 저장한 인플루언서 그룹입니다.',
    platform: group.platform || 'All',
    type: group.type || '즐겨찾기',
    owner: group.owner || '운영 담당자',
    createdAt: group.createdAt || new Date().toLocaleDateString('ko-KR'),
    creatorIds: [...new Set((group.creatorIds || []).filter(id => creatorIds.has(String(id))).map(id => creatorIds.get(String(id))))],
  }))
}
