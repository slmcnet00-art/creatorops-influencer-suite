// Internal planning assumptions, NOT surveyed market prices or a fitted prediction model.
// Methodology and source limits: docs/creator-rate-methodology.md.
export const CREATOR_RATE_VERSION = 'creator-rate-v2-2026-11'
export const CREATOR_RATE_POLICY = Object.freeze({
  youtube: { cpm: 18000, floor: 300000, formats: { 숏폼: 0.45, 롱폼: 1, 라이브: 1.2, '이미지/캐러셀': 0.8 }, defaultFormat: '롱폼' },
  instagram: { cpm: 14000, floor: 180000, formats: { 숏폼: 1, 롱폼: 1.4, 라이브: 1.2, '이미지/캐러셀': 0.8, 스토리: 0.3 }, defaultFormat: '숏폼' },
  tiktok: { cpm: 10000, floor: 150000, formats: { 숏폼: 1, 롱폼: 1.4, 라이브: 1.2, '이미지/캐러셀': 0.8, 스토리: 0.3 }, defaultFormat: '숏폼' },
})
export const CREATOR_COUNTRY_FACTORS = Object.freeze({ KR: 1, JP: 1.15, US: 1.3, CA: 1.2, GB: 1.25, AU: 1.2, DE: 1.2, FR: 1.15, SG: 1.2, CN: 0.9, TW: 0.9, HK: 1.1, TH: 0.75, VN: 0.65, ID: 0.65, PH: 0.6, MY: 0.75, ES: 1.05 })
const countryAliases = { 한국: 'KR', 대한민국: 'KR', korea: 'KR', 'south korea': 'KR', 일본: 'JP', japan: 'JP', 미국: 'US', usa: 'US', 'united states': 'US', 캐나다: 'CA', canada: 'CA', 영국: 'GB', uk: 'GB', 중국: 'CN', china: 'CN', 호주: 'AU', australia: 'AU' }
const formatAliases = { short: '숏폼', shorts: '숏폼', reel: '숏폼', reels: '숏폼', long: '롱폼', longform: '롱폼', live: '라이브', feed: '이미지/캐러셀', story: '스토리', stories: '스토리' }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export function toCreatorRateNumber(value) {
  const number = Number(typeof value === 'string' ? value.replace(/[,₩%\s]/g, '') : value)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}
const positive = (...values) => values.map(toCreatorRateNumber).find(value => value > 0) || 0
const round = value => Math.round(value / 10000) * 10000
const canonicalFormat = value => formatAliases[String(value).toLowerCase()] || value
export function creatorRateCountry(value) {
  const text = String(value || '').trim()
  return countryAliases[text.toLowerCase()] || text.toUpperCase()
}

export function calculateEstimatedCreatorRate(creator = {}, context = creator.rateContext || {}) {
  context ||= {}
  const platform = ['youtube', 'instagram', 'tiktok'].find(key => String(creator.platform || '').toLowerCase().includes(key))
  const policy = CREATOR_RATE_POLICY[platform]
  const warnings = []
  const followers = toCreatorRateNumber(creator.followers ?? creator.subscribers)
  const averageViews = toCreatorRateNumber(creator.averageViews ?? creator.avgViews)
  const engagement = toCreatorRateNumber(creator.engagement ?? creator.engagementRate)
  const engagementBasis = creator.engagementBasis
  const followerMultiplier = followers ? clamp(1 + Math.log10(followers / 100000) * 0.08, 0.8, 1.2) : 1
  const benchmark = engagementBasis === 'followers'
    ? followers < 10000 ? 4 : followers < 100000 ? 3 : followers < 1000000 ? 2 : 1
    : platform === 'tiktok' ? 5 : 4
  const rawEngagement = creator.engagement ?? creator.engagementRate
  const rawEngagementNumber = Number(String(rawEngagement ?? '').replace(/[,%\s]/g, ''))
  const hasEngagement = rawEngagement !== undefined && rawEngagement !== null && rawEngagement !== '' && Number.isFinite(rawEngagementNumber) && rawEngagementNumber >= 0 && ['views', 'followers'].includes(engagementBasis) && engagement <= 100 && creator.engagementVerified !== false
  const engagementMultiplier = hasEngagement ? clamp(1 + (engagement / benchmark - 1) * 0.15, 0.85, 1.15) : 1
  if (!hasEngagement) warnings.push('참여율의 산정 기준 또는 실측 여부 미확인: 참여율 보정 미적용')
  if (!followers) warnings.push('팔로워·구독자 수 미확인: 규모 보정 미적용')
  const country = creatorRateCountry(creator.country)
  const countryKnown = Boolean(CREATOR_COUNTRY_FACTORS[country]) && creator.countryConfidence !== 'unverified'
  const countryMultiplier = countryKnown ? CREATOR_COUNTRY_FACTORS[country] : 1
  if (!countryKnown) warnings.push('크리에이터 국가 미확인: 국가 보정 미적용(검색·캠페인 국가는 대신 사용하지 않음)')
  let formats = context.contentFormats ?? creator.contentFormats
  if (!Array.isArray(formats) || !formats.length) {
    formats = [policy?.defaultFormat].filter(Boolean)
    warnings.push('콘텐츠 형식 미정: 플랫폼 기본 형식 1건을 가정')
  }
  formats = [...new Set(formats.map(canonicalFormat))]
  const breakdown = formats.map(format => {
    const multiplier = policy?.formats[format]
    const formatViews = toCreatorRateNumber(creator.averageViewsByFormat?.[format])
    const views = formatViews || averageViews
    if (!formatViews && views) warnings.push(`${format}: 형식별 조회수 미확인, 전체 평균 조회수를 대용한 초안`)
    if (!views || !multiplier) warnings.push(`${format}: ${!views ? '평균 조회수 수집 필요' : '지원하지 않는 형식·플랫폼으로 별도 견적 필요'}`)
    const base = policy && multiplier && views ? Math.max(policy.floor * multiplier * countryMultiplier, views / 1000 * policy.cpm * multiplier * followerMultiplier * engagementMultiplier * countryMultiplier) : 0
    return { format, averageViews: views, viewsSource: formatViews ? '형식별 평균' : '전체 평균 대용', formatMultiplier: multiplier || 0, estimatedPrice: round(base) }
  })
  const complete = Boolean(policy && breakdown.length && breakdown.every(row => row.estimatedPrice > 0))
  const estimatedPrice = complete ? breakdown.reduce((sum, row) => sum + row.estimatedPrice, 0) : 0
  if (!complete) warnings.push('조회수·납품 범위 확인 전 전체 패키지 가격 산정 불가')
  const uniqueWarnings = [...new Set(warnings)]
  const hasUncertainty = uniqueWarnings.length > 0
  const range = { low: Math.floor(estimatedPrice * (hasUncertainty ? 0.6 : 0.7) / 10000) * 10000, high: Math.ceil(estimatedPrice * (hasUncertainty ? 1.5 : 1.3) / 10000) * 10000 }
  return {
    estimatedPrice, range, breakdown, warnings: uniqueWarnings,
    calculationVersion: CREATOR_RATE_VERSION,
    formula: 'SUM_BY_FORMAT(MAX(format_floor, avg_views/1000 * base_CPM * follower_factor * engagement_factor * country_factor * format_factor))',
    factors: { platform: creator.platform || '미확인', followers, averageViews, engagement, engagementBasis: hasEngagement ? engagementBasis : 'unverified', engagementBenchmark: benchmark, followerMultiplier, engagementMultiplier, country: countryKnown ? country : '미확인', countryMultiplier, baseCpm: policy?.cpm || 0, contentFormats: formats },
    assumptionLabel: '내부 초기 가정 · 실거래 검증 전',
  }
}

export function getCreatorRateSummary(creator = {}, context = creator.rateContext || {}) {
  const calculated = calculateEstimatedCreatorRate(creator, context)
  const actualPrice = positive(creator.actualPrice, creator.agreedAmount, creator.contractAmount, ['manual', 'agreed'].includes(creator.rateSource) ? creator.price : 0)
  return { ...calculated, actualPrice, effectivePrice: actualPrice || calculated.estimatedPrice, budgetPrice: actualPrice || calculated.range.high, label: actualPrice ? '확정 단가' : calculated.estimatedPrice ? '예상 단가' : '산정 전' }
}

export function withCreatorRate(creator = {}, context = creator.rateContext || {}) {
  context ||= {}
  const rate = getCreatorRateSummary(creator, context)
  return { ...creator, price: rate.effectivePrice, estimatedPrice: rate.estimatedPrice, actualPrice: rate.actualPrice || null, rateSource: rate.actualPrice ? 'manual' : 'calculated', rateCalculationVersion: rate.calculationVersion, rateFormula: rate.formula, rateFactors: rate.factors, rateContext: { contentFormats: context.contentFormats } }
}
