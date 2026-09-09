export const campaignTypeOptions = ['제안형', '공개모집', '앰배서더', '커머스/제휴', 'UGC/숏폼', '공동구매']

// Read legacy records without deleting campaigns or changing their platform.
export function normalizeCampaignType(value) {
  if (value === '틱톡 공동구매 셀러') return '공동구매'
  return value ?? '제안형'
}

export function isGroupBuyingCampaign(value) {
  return normalizeCampaignType(value) === '공동구매'
}
