export const campaignTypeOptions = ['제안형', '공개모집', '앰배서더', '커머스/제휴', '공동구매']

export const contentFormatOptions = ['숏폼', '롱폼', '라이브', '이미지/캐러셀', '스토리']

export function normalizeContentFormats(value) {
  return [...new Set((Array.isArray(value) ? value : []).filter((format) => contentFormatOptions.includes(format)))]
}

export function toggleContentFormat(value, format) {
  const current = normalizeContentFormats(value)
  return normalizeContentFormats(current.includes(format) ? current.filter((item) => item !== format) : [...current, format])
}

export function contentFormatSummary(value) {
  return normalizeContentFormats(value).join(', ') || '미정 · 협의 필요'
}

// Read legacy records without deleting campaigns or changing their platform.
export function normalizeCampaignType(value) {
  if (value === '틱톡 공동구매 셀러') return '공동구매'
  return value ?? '제안형'
}

export function isGroupBuyingCampaign(value) {
  return normalizeCampaignType(value) === '공동구매'
}
