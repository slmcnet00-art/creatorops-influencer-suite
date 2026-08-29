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

export const CAMPAIGN_MARKET_MODES = {
  single: 'single',
  multi: 'multi',
}

export function getMarketConfig(country = 'KR') {
  return MARKET_OPTIONS.find((market) => market.country === country) || MARKET_OPTIONS[0]
}

export function normalizeCampaignMarkets(campaign = {}) {
  const sourceMarkets = Array.isArray(campaign.markets) && campaign.markets.length
    ? campaign.markets
    : Array.isArray(campaign.targetMarkets) && campaign.targetMarkets.length
      ? campaign.targetMarkets
      : [campaign.targetCountry || campaign.country || 'KR']
  const seen = new Set()

  return sourceMarkets
    .map((entry) => {
      const country = String(typeof entry === 'string' ? entry : entry?.country || '').toUpperCase()
      if (!country || seen.has(country)) return null
      seen.add(country)
      const fallback = getMarketConfig(country)
      const source = typeof entry === 'string' ? {} : entry
      return {
        country,
        label: source.label || fallback.label,
        language: source.language || fallback.language,
        languageLabel: source.languageLabel || fallback.languageLabel,
        currency: source.currency || fallback.currency,
        currencySymbol: source.currencySymbol || fallback.currencySymbol,
        exchangeRateKrw: Number(source.exchangeRateKrw) > 0
          ? Number(source.exchangeRateKrw)
          : fallback.exchangeRateKrw,
        exchangeRateSource: source.exchangeRateSource || campaign.exchangeRateSource || '운영 기준환율(수동)',
        exchangeRateUpdatedAt: source.exchangeRateUpdatedAt || campaign.exchangeRateUpdatedAt || '',
      }
    })
    .filter(Boolean)
}

export function getCampaignMarketCountries(campaign = {}) {
  return normalizeCampaignMarkets(campaign).map((market) => market.country)
}

export function isMultiMarketCampaign(campaign = {}) {
  return campaign.marketMode === CAMPAIGN_MARKET_MODES.multi || getCampaignMarketCountries(campaign).length > 1
}

export function buildCampaignMarkets(countries = [], campaign = {}) {
  const existing = new Map(normalizeCampaignMarkets(campaign).map((market) => [market.country, market]))
  return [...new Set((Array.isArray(countries) ? countries : [countries]).map((country) => String(country || '').toUpperCase()).filter(Boolean))]
    .map((country) => existing.get(country) || normalizeCampaignMarkets({ targetCountry: country })[0])
    .filter(Boolean)
}

export function resolveCampaignMarketCountry(campaign = {}, country = '') {
  const markets = normalizeCampaignMarkets(campaign)
  const requested = String(country || '').toUpperCase()
  if (requested && markets.some((market) => market.country === requested)) return requested
  return markets[0]?.country || 'KR'
}

export function normalizeCampaignMarket(campaign = {}) {
  const campaignMarkets = normalizeCampaignMarkets(campaign)
  const primaryMarket = campaignMarkets[0]
  const fallback = getMarketConfig(primaryMarket?.country || campaign.targetCountry || campaign.country || 'KR')
  return {
    country: primaryMarket?.country || campaign.targetCountry || fallback.country,
    countryLabel: primaryMarket?.label || fallback.label,
    language: campaign.outputLanguage || primaryMarket?.language || fallback.language,
    languageLabel: LANGUAGE_OPTIONS.find((item) => item.value === (campaign.outputLanguage || primaryMarket?.language || fallback.language))?.label || primaryMarket?.languageLabel || fallback.languageLabel,
    currency: campaign.localCurrency || primaryMarket?.currency || fallback.currency,
    currencySymbol: primaryMarket?.currencySymbol || fallback.currencySymbol,
    exchangeRateKrw: Number(campaign.exchangeRateKrw) > 0 ? Number(campaign.exchangeRateKrw) : primaryMarket?.exchangeRateKrw || fallback.exchangeRateKrw,
    exchangeRateSource: campaign.exchangeRateSource || primaryMarket?.exchangeRateSource || '운영 기준환율(수동)',
    exchangeRateUpdatedAt: campaign.exchangeRateUpdatedAt || primaryMarket?.exchangeRateUpdatedAt || '',
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
