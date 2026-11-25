import { CONTENT_METRICS, contentMetricHistory, metricValue } from './contentMetricHistory.js'
import { creatorAccountGroup } from './creatorAccountGroup.js'

const id = value => String(value ?? '')
const amount = value => value !== '' && value != null && typeof value !== 'boolean' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
const handle = value => String(value || '').trim().replace(/^@/, '').toLowerCase()
const inCampaign = (row, campaign) => id(row.campaignId ?? row.campaign_id) === id(campaign.id)
const sumKnown = values => values.some(value => value !== null) ? values.reduce((sum, value) => sum + (value ?? 0), 0) : null
const unique = rows => [...new Map(rows.map((row, index) => [row.id == null ? `row-${index}` : id(row.id), row])).values()]

export function reportMetricSummary(posts, field) {
  const values = posts.map(post => metricValue(post, field))
  return { value: sumKnown(values), known: values.filter(value => value !== null).length, total: posts.length }
}

function metrics(posts) {
  const result = Object.fromEntries(CONTENT_METRICS.map(field => [field, reportMetricSummary(posts, field)]))
  const complete = posts.length > 0 && CONTENT_METRICS.every(field => result[field].known === posts.length)
  result.reactions = sumKnown(CONTENT_METRICS.filter(field => field !== 'views').map(field => result[field].value))
  result.engagementRate = complete && result.views.value > 0 ? result.reactions / result.views.value * 100 : null
  result.complete = complete
  return result
}

function creatorCost(creatorId, fulfillment, operations) {
  const matches = row => id(row.creatorId ?? row.creator_id) === id(creatorId)
  const payments = unique(fulfillment.filter(matches)).map(row => amount(row.paymentAmount)).filter(value => value !== null)
  const costs = unique(operations.filter(matches)).map(row => amount(row.actualCost)).filter(value => value !== null)
  // The two collections can describe the same payment. Payment records take
  // precedence; never add a second operations copy or allocate a quotation.
  return payments.length ? payments.reduce((sum, value) => sum + value, 0) : costs.length ? costs.reduce((sum, value) => sum + value, 0) : null
}

export function reportContentFormat(post = {}, campaign = {}) {
  const value = post.contentFormat || post.format || post.mediaType || post.media_type || post.contentType || (campaign.contentFormats?.length === 1 ? campaign.contentFormats[0] : '')
  const label = String(value || '').trim()
  if (/short|reel|숏폼|릴스/i.test(label)) return '숏폼'
  if (/carousel|캐러셀/i.test(label)) return '이미지/캐러셀'
  if (/story|스토리/i.test(label)) return '스토리'
  if (/image|photo|이미지|사진/i.test(label)) return '이미지/캐러셀'
  if (/long|롱폼/i.test(label)) return '롱폼'
  return label || '형식 미확인'
}

export function reportObservedTrend(posts, field = 'views', now = Date.now()) {
  const days = new Map()
  posts.forEach((post, index) => {
    const perDay = new Map()
    contentMetricHistory(post, now).forEach(point => {
      const value = metricValue(point, field)
      if (value === null) return
      const day = new Date(Date.parse(point.measuredAt) + 9 * 3600000).toISOString().slice(0, 10)
      perDay.set(day, value)
    })
    perDay.forEach((value, day) => {
      if (!days.has(day)) days.set(day, new Map())
      days.get(day).set(index, value)
    })
  })
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, values]) => ({ day, value: [...values.values()].reduce((a, b) => a + b, 0), observed: values.size, total: posts.length }))
}

export function buildCampaignReportAnalytics({ campaign, creators = [], posts = [], fulfillment = [], operations = [], links = [], clicks = [], orders = [], conversions = [] } = {}) {
  if (!campaign) return { rows: [], gradeRows: [], formatRows: [], posts: [], totals: metrics([]), cost: null, revenue: null, costCoverage: { known: 0, total: 0 }, traffic: { links: [], clicks: null, purchases: null, refunds: null, revenue: null }, unmatched: 0 }
  const scopedPosts = unique(posts.filter(post => inCampaign(post, campaign)))
  const scopedFulfillment = fulfillment.filter(row => inCampaign(row, campaign))
  const scopedOperations = operations.filter(row => inCampaign(row, campaign))
  const assigned = new Set((campaign.creatorIds || []).map(id))
  const creatorMap = new Map(creators.map(creator => [id(creator.id), creator]))
  const grouped = new Map([...assigned].filter(key => creatorMap.has(key)).map(key => [key, { creator: creatorMap.get(key), posts: [] }]))
  const financialIds = new Set([...scopedFulfillment, ...scopedOperations].map(row => id(row.creatorId ?? row.creator_id)))
  for (const key of financialIds) if (creatorMap.has(key) && !grouped.has(key)) grouped.set(key, { creator: creatorMap.get(key), posts: [] })
  let unmatched = 0
  for (const [postIndex, post] of scopedPosts.entries()) {
    let creator = creatorMap.get(id(post.creatorId ?? post.creator_id))
    if (!creator && post.handle) {
      const matches = creators.filter(item => handle(item.handle) === handle(post.handle) && (!post.platform || item.platform === post.platform))
      if (matches.length === 1) creator = matches[0]
    }
    const key = creator ? id(creator.id) : `unmatched:${post.id ?? post.url ?? postIndex}`
    if (!creator) unmatched++
    if (!grouped.has(key)) grouped.set(key, { creator: creator || { id: key, name: post.creatorName || '크리에이터 연결 필요', platform: post.platform }, posts: [] })
    grouped.get(key).posts.push(post)
  }
  const rows = [...grouped.values()].map(row => {
    const result = metrics(row.posts)
    const cost = creatorCost(row.creator.id, scopedFulfillment, scopedOperations)
    const cpv = cost !== null && row.posts.length && result.views.known === row.posts.length && result.views.value > 0 ? cost / result.views.value : null
    return { ...row, ...result, cost, cpv, cpm: cpv === null ? null : cpv * 1000, cpe: cost !== null && result.complete && result.reactions > 0 ? cost / result.reactions : null, grade: creatorAccountGroup(row.creator), formats: [...new Set(row.posts.map(post => reportContentFormat(post, campaign)))] }
  })
  const paid = rows.filter(row => row.cost !== null)
  const directCost = amount(campaign.actualSpend)
  const recordedCost = sumKnown([...financialIds].map(key => creatorCost(key, scopedFulfillment, scopedOperations)))
  const unallocatedCost = sumKnown([...financialIds].filter(key => !creatorMap.has(key)).map(key => creatorCost(key, scopedFulfillment, scopedOperations)))
  const cost = directCost ?? recordedCost
  const gradeRows = [...Map.groupBy(rows, row => row.grade.label)].map(([label, items]) => ({ label, creators: items.length, posts: items.reduce((sum, row) => sum + row.posts.length, 0), ...metrics(items.flatMap(row => row.posts)), cost: sumKnown(items.map(row => row.cost)), costKnown: items.filter(row => row.cost !== null).length }))
  const formatRows = [...Map.groupBy(scopedPosts, post => reportContentFormat(post, campaign))].map(([label, items]) => ({ label, posts: items.length, ...metrics(items) }))
  const scopedLinks = unique(links.filter(row => inCampaign(row, campaign)))
  const scopedClicks = unique(clicks.filter(row => inCampaign(row, campaign)))
  const purchaseSource = orders.some(row => inCampaign(row, campaign)) ? orders.filter(row => inCampaign(row, campaign)) : conversions.filter(row => inCampaign(row, campaign) && ['purchase', 'refund'].includes(row.eventType))
  const transactions = [...new Map(purchaseSource.map((row, index) => {
    const type = row.eventType || (['refunded', 'refund'].includes(row.status) ? 'refund' : 'purchase')
    return [`${type}:${row.orderId ?? row.order_id ?? row.transactionId ?? row.id ?? `row-${index}`}`, { ...row, type }]
  })).values()]
  const purchases = transactions.filter(row => row.type === 'purchase')
  const refunds = transactions.filter(row => row.type === 'refund')
  const amounts = transactions.map(row => amount(row.eventValue ?? row.revenue ?? row.orderAmount ?? row.amount))
  const revenue = amounts.length && amounts.every(value => value !== null) ? transactions.reduce((sum, row, index) => sum + amounts[index] * (row.type === 'refund' ? -1 : 1), 0) : transactions.length ? null : amount(campaign.actualRevenue)
  return {
    rows, gradeRows, formatRows, posts: scopedPosts, totals: metrics(scopedPosts), cost, revenue,
    costCoverage: { known: paid.length, total: rows.length, campaignTotal: directCost !== null }, costComplete: directCost !== null || (rows.length > 0 && paid.length === rows.length && unallocatedCost === null), unallocatedCost, unmatched,
    traffic: { links: scopedLinks, clicks: scopedClicks.length ? scopedClicks.reduce((sum, row) => sum + (amount(row.clicks ?? row.count) ?? 1), 0) : null, purchases: transactions.length ? purchases.length : null, refunds: transactions.length ? refunds.length : null, revenue, source: orders.some(row => inCampaign(row, campaign)) ? '주문 귀속 기록' : '구매·환불 이벤트' },
  }
}
