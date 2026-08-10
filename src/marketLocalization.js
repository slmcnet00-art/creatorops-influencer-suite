export const MARKET_OPTIONS = [
  { country: 'KR', label: '한국', language: 'ko', languageLabel: '한국어', currency: 'KRW', currencySymbol: '₩', exchangeRateKrw: 1 },
  { country: 'US', label: '미국', language: 'en', languageLabel: '영어', currency: 'USD', currencySymbol: '$', exchangeRateKrw: 1380 },
  { country: 'JP', label: '일본', language: 'ja', languageLabel: '일본어', currency: 'JPY', currencySymbol: '¥', exchangeRateKrw: 9.2 },
  { country: 'CN', label: '중국', language: 'zh-CN', languageLabel: '중국어(간체)', currency: 'CNY', currencySymbol: '¥', exchangeRateKrw: 190 },
  { country: 'SEA', label: '동남아', language: 'en', languageLabel: '영어', currency: 'SGD', currencySymbol: 'S$', exchangeRateKrw: 1060 },
  { country: 'EU', label: '유럽', language: 'en', languageLabel: '영어', currency: 'EUR', currencySymbol: '€', exchangeRateKrw: 1600 },
]

export const LANGUAGE_OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: '영어' },
  { value: 'ja', label: '일본어' },
  { value: 'zh-CN', label: '중국어(간체)' },
]

export function getMarketConfig(country = 'KR') {
  return MARKET_OPTIONS.find((market) => market.country === country) || MARKET_OPTIONS[0]
}

export function normalizeCampaignMarket(campaign = {}) {
  const fallback = getMarketConfig(campaign.targetCountry || campaign.country || 'KR')
  return {
    country: campaign.targetCountry || fallback.country,
    countryLabel: fallback.label,
    language: campaign.outputLanguage || fallback.language,
    languageLabel: LANGUAGE_OPTIONS.find((item) => item.value === (campaign.outputLanguage || fallback.language))?.label || fallback.languageLabel,
    currency: campaign.localCurrency || fallback.currency,
    currencySymbol: fallback.currencySymbol,
    exchangeRateKrw: Number(campaign.exchangeRateKrw) > 0 ? Number(campaign.exchangeRateKrw) : fallback.exchangeRateKrw,
    exchangeRateSource: campaign.exchangeRateSource || '운영 기준환율(수동)',
    exchangeRateUpdatedAt: campaign.exchangeRateUpdatedAt || '',
  }
}

export function formatDualCurrency(krwValue, campaign = {}) {
  const krw = Number(krwValue || 0)
  if (!krw) return '산정 전'
  const market = normalizeCampaignMarket(campaign)
  const krwLabel = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(krw)
  if (market.currency === 'KRW') return krwLabel
  const localValue = krw / market.exchangeRateKrw
  const fractionDigits = market.currency === 'JPY' ? 0 : 2
  const localLabel = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: market.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(localValue)
  return `${krwLabel} · ${localLabel}`
}

export function getLanguageInstruction(campaign = {}) {
  const market = normalizeCampaignMarket(campaign)
  const instructions = {
    ko: '한국어로 자연스럽고 친근하게 작성합니다.',
    en: 'Write in natural, friendly English appropriate for the target market.',
    ja: '対象市場に合わせ、自然で親しみのある日本語で作成します。',
    'zh-CN': '请使用适合目标市场的自然、亲切的简体中文撰写。',
  }
  return instructions[market.language] || instructions.en
}
