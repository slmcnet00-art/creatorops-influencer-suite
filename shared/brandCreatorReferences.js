export function referencedBrandCreatorIds({ brandId, creators = [], campaigns = [], records = [], shortlist = [] }) {
  const ids = new Set(shortlist.map(String))
  creators.filter(c => String(c.brandId ?? c.brand_id) === String(brandId)).forEach(c => ids.add(String(c.id)))
  for (const item of [...campaigns, ...records]) {
    const creatorId = item?.creatorId ?? item?.creator_id
    if (creatorId != null) ids.add(String(creatorId))
    for (const id of [...(item?.creatorIds || []), ...(item?.memberIds || [])]) ids.add(String(id))
  }
  return ids
}
