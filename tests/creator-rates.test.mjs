import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateEstimatedCreatorRate, getCreatorRateSummary, withCreatorRate } from '../shared/creatorRates.js'
import { planCampaignBudget } from '../src/campaignBudget.js'

const creator = { id: 1, name: '검증용', platform: 'YouTube', country: 'KR', followers: 100000, averageViews: 100000, engagement: 4, engagementBasis: 'views' }
test('조회수 중심이며 팔로워·참여율·국가·형식을 같은 함수로 반영한다', () => {
  const base = calculateEstimatedCreatorRate(creator, { contentFormats: ['롱폼'] })
  assert.equal(base.estimatedPrice, 1800000)
  for (const next of [{ averageViews: 200000 }, { followers: 1000000 }, { engagement: 8 }, { country: 'JP' }]) {
    assert.ok(calculateEstimatedCreatorRate({ ...creator, ...next }, { contentFormats: ['롱폼'] }).estimatedPrice > base.estimatedPrice)
  }
  assert.ok(calculateEstimatedCreatorRate(creator, { contentFormats: ['숏폼'] }).estimatedPrice < base.estimatedPrice)
  assert.ok(calculateEstimatedCreatorRate({ ...creator, averageViews: 10000, followers: 1000000 }).estimatedPrice < base.estimatedPrice)
})
test('선택한 형식 각각 1건을 합산하고 형식별 지표를 우선하며 중복은 제외한다', () => {
  const c = { ...creator, averageViewsByFormat: { 숏폼: 20000, 롱폼: 100000 } }
  const short = calculateEstimatedCreatorRate(c, { contentFormats: ['숏폼'] })
  const long = calculateEstimatedCreatorRate(c, { contentFormats: ['롱폼'] })
  const both = calculateEstimatedCreatorRate(c, { contentFormats: ['숏폼', '롱폼', '숏폼'] })
  assert.equal(both.estimatedPrice, short.estimatedPrice + long.estimatedPrice)
  assert.equal(both.breakdown.length, 2)
  assert.equal(both.factors.averageViews, 100000)
})
test('기존 예상값은 재계산하고 모든 실제 협의 단가 별칭은 보존한다', () => {
  for (const key of ['actualPrice', 'agreedAmount', 'contractAmount']) {
    const rate = getCreatorRateSummary({ ...creator, [key]: 700000, price: 99999999, estimatedPrice: 99999999 })
    assert.equal(rate.effectivePrice, 700000)
    assert.equal(rate.budgetPrice, 700000)
  }
  assert.equal(getCreatorRateSummary({ ...creator, price: 99999999, estimatedPrice: 99999999 }).effectivePrice, 1800000)
  assert.equal(getCreatorRateSummary({ ...creator, actualPrice: 0, agreedAmount: 700000 }).effectivePrice, 700000)
  assert.equal(getCreatorRateSummary({ ...creator, price: 700000, rateSource: 'manual' }).effectivePrice, 700000)
})
test('미확인 조회수·참여율 기준·국가를 사실처럼 만들지 않는다', () => {
  const noViews = calculateEstimatedCreatorRate({ ...creator, averageViews: 0, price: 1000000 })
  assert.equal(noViews.estimatedPrice, 0)
  assert.match(noViews.warnings.join(' '), /조회/)
  const unknown = calculateEstimatedCreatorRate({ ...creator, engagement: 99, engagementBasis: '', country: 'Unverified' })
  assert.equal(unknown.factors.engagementMultiplier, 1)
  assert.equal(unknown.factors.countryMultiplier, 1)
  assert.ok(unknown.warnings.length >= 2)
  assert.equal(calculateEstimatedCreatorRate({ ...creator, country: 'JP', countryConfidence: 'unverified' }).factors.countryMultiplier, 1)
  assert.equal(calculateEstimatedCreatorRate(creator, { targetCountry: 'US' }).factors.countryMultiplier, 1)
})
test('캠페인 변경 시 저장값 덮어쓰기 없이 재계산하며 예산은 추정 상한으로 제한한다', () => {
  const campaign = { budget: 5000000, contentFormats: ['숏폼', '롱폼'] }
  const projected = withCreatorRate(creator, campaign)
  assert.equal(getCreatorRateSummary(projected).effectivePrice, getCreatorRateSummary(creator, campaign).effectivePrice)
  const plan = planCampaignBudget(campaign, [{ creatorId: 1, score: 90 }], [creator])
  const rate = getCreatorRateSummary(creator, campaign)
  assert.equal(plan.totalCost, rate.budgetPrice)
  assert.ok(plan.totalCost <= campaign.budget)
  assert.equal(creator.price, undefined)
  assert.equal(planCampaignBudget({ ...campaign, budget: rate.estimatedPrice }, [{ creatorId: 1 }], [creator]).items.length, 0)
})
test('큰 값·음수·NaN에서도 금액과 보정 계수가 유한하고 범위 안에 있다', () => {
  for (const value of [-2, NaN, Infinity, 0, 1e12]) {
    const rate = calculateEstimatedCreatorRate({ ...creator, averageViews: value, followers: value, engagement: value })
    assert.ok(Number.isFinite(rate.estimatedPrice))
    assert.ok(rate.range.low <= rate.estimatedPrice && rate.estimatedPrice <= rate.range.high)
    assert.ok(rate.factors.followerMultiplier >= 0.8 && rate.factors.followerMultiplier <= 1.2)
    assert.ok(rate.factors.engagementMultiplier >= 0.85 && rate.factors.engagementMultiplier <= 1.15)
  }
})

test('같은 조회수의 세 플랫폼·미지원 형식·누락된 부분 패키지와 실제 금액을 구분한다', () => {
  const short = { contentFormats: ['숏폼'] }
  const ig = calculateEstimatedCreatorRate({ ...creator, platform: 'Instagram' }, short)
  const tt = calculateEstimatedCreatorRate({ ...creator, platform: 'TikTok' }, short)
  assert.ok(ig.estimatedPrice > tt.estimatedPrice)
  assert.equal(calculateEstimatedCreatorRate(creator, { contentFormats: ['스토리'] }).estimatedPrice, 0)
  assert.equal(calculateEstimatedCreatorRate({ ...creator, averageViews: 0, averageViewsByFormat: { 숏폼: 1000 } }, { contentFormats: ['숏폼', '롱폼'] }).estimatedPrice, 0)
  assert.equal(getCreatorRateSummary({ actualPrice: 700000 }).effectivePrice, 700000)
  assert.equal(calculateEstimatedCreatorRate({ ...creator, engagement: Infinity }).factors.engagementMultiplier, 1)
  assert.equal(calculateEstimatedCreatorRate({ ...creator, engagement: -1 }).factors.engagementMultiplier, 1)
  assert.equal(calculateEstimatedCreatorRate({ ...creator, engagement: undefined }).factors.engagementMultiplier, 1)
})

test('최근 YouTube 표본이 있으면 미확인 Shorts를 전체 평균으로 대신 가격 매기지 않는다', () => {
  const c = { ...creator, youtubeRecentMetrics: { sampleCount: 12 }, averageViewsByFormat: { 롱폼: 20000 }, inferredAverageViewsByFormat: { 숏폼: 9999999 } }
  assert.equal(calculateEstimatedCreatorRate(c, { contentFormats: ['숏폼'] }).estimatedPrice, 0)
  assert.equal(calculateEstimatedCreatorRate(c, { contentFormats: ['롱폼'] }).breakdown[0].averageViews, 20000)
  assert.equal(getCreatorRateSummary({ ...c, actualPrice: 700000 }, { contentFormats: ['숏폼', '롱폼'] }).effectivePrice, 700000)
})
