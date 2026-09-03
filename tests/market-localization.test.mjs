import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAMPAIGN_MARKET_MODES,
  buildCampaignMarkets,
  getCampaignMarketForCountry,
  getCampaignMarketCountries,
  isMultiMarketCampaign,
  normalizeCampaignMarket,
  normalizeCampaignMarkets,
  resolveCampaignMarketCountry,
} from '../src/marketLocalization.js'

test('기존 단일 국가 캠페인은 단일 마켓으로 호환된다', () => {
  const campaign = { targetCountry: 'JP' }

  assert.deepEqual(getCampaignMarketCountries(campaign), ['JP'])
  assert.equal(isMultiMarketCampaign(campaign), false)
  assert.equal(normalizeCampaignMarket(campaign).currency, 'JPY')
})

test('글로벌 캠페인은 선택 순서와 국가별 통화·언어를 보존한다', () => {
  const campaign = {
    marketMode: CAMPAIGN_MARKET_MODES.multi,
    targetMarkets: ['US', 'JP', 'EU'],
  }
  const markets = normalizeCampaignMarkets(campaign)

  assert.deepEqual(markets.map((market) => market.country), ['US', 'JP', 'EU'])
  assert.deepEqual(markets.map((market) => market.currency), ['USD', 'JPY', 'EUR'])
  assert.equal(markets[0].language, 'en')
  assert.equal(isMultiMarketCampaign(campaign), true)
  assert.equal(getCampaignMarketForCountry(campaign, 'JP').language, 'ja')
  assert.equal(getCampaignMarketForCountry(campaign, 'EU').language, 'en')
})

test('다국가 캠페인은 대표 언어가 아니라 레코드 운영 국가의 언어를 사용한다', () => {
  const campaign = {
    marketMode: CAMPAIGN_MARKET_MODES.multi,
    outputLanguage: 'ko',
    markets: [
      { country: 'KR', language: 'ko' },
      { country: 'US', language: 'en' },
      { country: 'JP', language: 'ja' },
      { country: 'CN', language: 'zh-CN' },
    ],
  }

  assert.equal(getCampaignMarketForCountry(campaign, 'KR').language, 'ko')
  assert.equal(getCampaignMarketForCountry(campaign, 'US').language, 'en')
  assert.equal(getCampaignMarketForCountry(campaign, 'JP').language, 'ja')
  assert.equal(getCampaignMarketForCountry(campaign, 'CN').language, 'zh-CN')
})

test('마켓 재구성은 기존 국가별 환율 설정을 유지한다', () => {
  const campaign = {
    markets: [
      { country: 'US', exchangeRateKrw: 1410, exchangeRateSource: '수동 환율' },
      { country: 'JP', exchangeRateKrw: 9.5 },
    ],
  }
  const rebuilt = buildCampaignMarkets(['JP', 'US', 'KR'], campaign)

  assert.equal(rebuilt[0].country, 'JP')
  assert.equal(rebuilt[0].exchangeRateKrw, 9.5)
  assert.equal(rebuilt[1].exchangeRateKrw, 1410)
  assert.equal(rebuilt[2].currency, 'KRW')
})

test('레코드 국가가 비어 있거나 범위 밖이면 대표 국가에 귀속한다', () => {
  const campaign = { targetMarkets: ['US', 'JP'] }

  assert.equal(resolveCampaignMarketCountry(campaign, 'JP'), 'JP')
  assert.equal(resolveCampaignMarketCountry(campaign, 'DE'), 'US')
  assert.equal(resolveCampaignMarketCountry(campaign, ''), 'US')
})
