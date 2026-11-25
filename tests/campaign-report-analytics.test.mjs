import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCampaignReportAnalytics, reportContentFormat, reportObservedTrend } from '../shared/campaignReportAnalytics.js'

const campaign = { id: 1, creatorIds: [10, 20], contentFormats: ['숏폼', '스토리'] }
const creators = [{ id: 10, name: 'A', handle: '@a', platform: 'YouTube', followers: 12000 }, { id: 20, name: 'B', handle: '@b', platform: 'Instagram' }]
const post = { id: 100, campaignId: 1, creatorId: 10, views: 1000, likes: 10, comments: 2, shares: 1, saves: 2, contentFormat: '숏폼' }
const make = patch => buildCampaignReportAnalytics({ campaign, creators, posts: [post], ...patch })

test('선택 캠페인 실제 콘텐츠만 집계하고 예상 조회수나 다른 캠페인 비용을 섞지 않는다', () => {
  const result = make({ posts: [post, { ...post, id: 200, campaignId: 2, views: 999999 }], fulfillment: [{ campaignId: 2, creatorId: 10, paymentAmount: 900000 }] })
  assert.equal(result.posts.length, 1)
  assert.equal(result.totals.views.value, 1000)
  assert.equal(result.rows.length, 2)
  assert.equal(result.cost, null)
  assert.equal(result.rows[1].views.value, null)
})

test('실제 비용은 지급 기록 우선으로 중복을 피하고 견적은 사용하지 않는다', () => {
  const result = make({ fulfillment: [{ id: 1, campaignId: 1, creatorId: 10, paymentAmount: 10000 }], operations: [{ campaignId: 1, creatorId: 10, actualCost: 10000 }] })
  assert.equal(result.rows[0].cost, 10000)
  assert.equal(result.rows[0].cpv, 10)
  assert.equal(result.rows[0].cpm, 10000)
  assert.equal(result.rows[0].cpe, 10000 / 15)
  assert.equal(result.cost, 10000)
  assert.equal(result.costComplete, false)
  const totalOnly = make({ campaign: { ...campaign, actualSpend: 40000 }, creators: creators.map(row => ({ ...row, price: 5000 })) })
  assert.equal(totalOnly.cost, 40000)
  assert.equal(totalOnly.costComplete, true)
  assert.equal(totalOnly.rows[0].cost, null)
  assert.equal(totalOnly.rows[0].cpv, null)
})

test('명시적 0원과 0 반응은 보존하고 미확인은 0 또는 확정 효율로 표시하지 않는다', () => {
  const result = make({ posts: [{ ...post, likes: 0, shares: null }], operations: [{ campaignId: 1, creatorId: 10, actualCost: 0 }] })
  assert.equal(result.rows[0].likes.value, 0)
  assert.equal(result.rows[0].shares.value, null)
  assert.equal(result.rows[0].cpv, 0)
  assert.equal(result.rows[0].cpe, null)
  assert.equal(result.rows[0].engagementRate, null)
  const partial = make({ posts: [post, { ...post, id: 101, views: null }], operations: [{ campaignId: 1, creatorId: 10, actualCost: 100 }] })
  assert.equal(partial.rows[0].views.known, 1)
  assert.equal(partial.rows[0].views.value, 1000)
  assert.equal(partial.rows[0].cpv, null)
})

test('등급과 형식은 원천을 사용하고 여러 형식이 지정되면 개별 형식을 추측하지 않는다', () => {
  const result = make()
  assert.equal(result.rows[0].grade.label, '마이크로')
  assert.equal(result.rows[1].grade.label, '등급 미확인')
  assert.equal(reportContentFormat({}, campaign), '형식 미확인')
  assert.equal(reportContentFormat({}, { contentFormats: ['Reels'] }), '숏폼')
  assert.equal(result.formatRows[0].views.value, 1000)
})

test('한국시간 일자별 마지막 실제 관측만 합산하고 빈 날이나 다른 콘텐츠를 채우지 않는다', () => {
  const posts = [{ metricHistory: [{ measuredAt: '2026-11-23T16:00:00Z', views: 50 }, { measuredAt: '2026-11-24T02:00:00Z', views: 100 }, { measuredAt: '2026-11-24T16:00:00Z', views: 130 }] }, { metricHistory: [{ measuredAt: '2026-11-24T03:00:00Z', views: 200 }] }]
  assert.deepEqual(reportObservedTrend(posts, 'views', Date.parse('2026-11-25T12:00:00Z')), [
    { day: '2026-11-24', value: 300, observed: 2, total: 2 },
    { day: '2026-11-25', value: 130, observed: 1, total: 2 },
  ])
})

test('주문과 이벤트 이중 집계를 피하고 같은 주문의 구매와 환불을 구분한다', () => {
  const result = make({
    orders: [{ orderId: 'x', campaignId: 1, amount: 100 }, { orderId: 'x', campaignId: 1, amount: 100 }, { orderId: 'x', campaignId: 1, eventType: 'refund', amount: 20 }, { orderId: 'other', campaignId: 2, amount: 1000 }],
    conversions: [{ id: 1, campaignId: 1, eventType: 'purchase', eventValue: 100 }],
    clicks: [{ id: 'click', campaignId: 1, count: 0 }],
  })
  assert.equal(result.traffic.purchases, 1)
  assert.equal(result.traffic.refunds, 1)
  assert.equal(result.revenue, 80)
  assert.equal(result.traffic.clicks, 0)
  assert.equal(make().traffic.purchases, null)
})

test('이름만 비슷하거나 플랫폼이 다른 계정에는 콘텐츠를 잘못 합산하지 않는다', () => {
  const result = make({ posts: [{ ...post, creatorId: null, handle: '@a', platform: 'Instagram' }] })
  assert.equal(result.unmatched, 1)
  assert.equal(result.rows.find(row => row.creator.id === 10).posts.length, 0)
  assert.equal(result.rows.length, 3)
})

test('개인 연결이 없는 실제 비용도 총액에서는 보존하고 임의 배분하지 않는다', () => {
  const result = make({ fulfillment: [{ campaignId: 1, paymentAmount: 15000 }] })
  assert.equal(result.cost, 15000)
  assert.equal(result.unallocatedCost, 15000)
  assert.equal(result.rows[0].cost, null)
  assert.equal(result.costComplete, false)
})
