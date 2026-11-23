import { getCreatorRateSummary } from './creatorRates.js'

const amount = value => value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value)
export const QUOTE_FORM_TYPES = [{ id: 'general', label: '일반 견적서', description: '등급별 수량·단가를 기준으로 작성합니다.' }, { id: 'list', label: '리스트 견적서', description: '크리에이터별 명단·수량·단가를 표시합니다.' }]
export const quoteFormType = value => value === 'list' ? 'list' : 'general'
export const quoteGrade = value => {
  const text = String(value || '').trim()
  if (!text || /^(exclusive|paid|gifted) seeding$|^[무유]가\s*시딩$/i.test(text)) return '등급 미분류'
  return /^[SABC]$/i.test(text) ? `${text.toUpperCase()}급` : text
}
function quoteTotals(campaign, items, settings) {
  const creatorSubtotal = items.reduce((sum, row) => sum + (row.total ?? 0), 0)
  const managementRate = Math.min(amount(settings.managementRate) ?? 0, 100)
  const management = Math.round(creatorSubtotal * managementRate / 100)
  const shippingUnitCost = amount(settings.shippingUnitCost)
  const shippingQuantity = amount(settings.shippingQuantity) ?? items.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
  const shipping = shippingUnitCost == null ? null : Math.round(shippingUnitCost * shippingQuantity)
  const additionalCost = amount(settings.additionalCost)
  const subtotal = creatorSubtotal + management + (shipping ?? 0) + (additionalCost ?? 0)
  const vatRate = Math.min(amount(settings.vatRate) ?? 10, 100)
  const vat = Math.round(subtotal * vatRate / 100)
  const unknownCount = items.filter(row => row.total == null).length
  return { items, creatorSubtotal, managementRate, management, shipping, shippingQuantity, shippingUnitCost, additionalCost, subtotal, vatRate, vat, total: subtotal + vat,
    unknownCount, incomplete: !items.length || unknownCount > 0, budget: amount(campaign.budget), currency: 'KRW',
    note: '예상 견적 초안입니다. 크리에이터 확정 단가, 배송·제품비, 2차 활용 범위는 협의 후 확정합니다. 미입력 비용은 합계에서 제외됩니다.' }
}
export function buildCampaignQuote(campaign = {}, creators = [], settings = campaign.quoteSettings || {}) {
  const assigned = new Set((campaign.creatorIds || []).map(String))
  const items = creators.filter(c => assigned.has(String(c.id))).map(creator => {
    const override = settings.creatorOverrides?.[creator.id] || {}
    const rate = getCreatorRateSummary(creator, campaign)
    const unitPrice = Object.hasOwn(override, 'unitPrice') ? amount(override.unitPrice) : rate.effectivePrice > 0 ? rate.effectivePrice : null
    const quantity = Object.hasOwn(override, 'quantity') ? amount(override.quantity) : 1
    return { id: creator.id, name: creator.name, grade: quoteGrade(creator.tier), profileUrl: creator.profileUrl || '', platform: creator.platform, scope: (campaign.contentFormats || []).join(' + ') || '콘텐츠 형식 협의',
      unitPrice, quantity, included: override.included !== false, note: quoteGrade(creator.tier) === '등급 미분류' && creator.tier ? `협업 유형: ${creator.tier}` : '',
      priceLabel: Object.hasOwn(override, 'unitPrice') ? '견적 초안 입력' : rate.label,
      total: unitPrice == null || quantity == null ? null : Math.round(unitPrice * quantity) }
  }).filter(row => row.included)
  return quoteTotals(campaign, items, settings)
}

export function generalQuoteRows(campaign = {}, creators = [], settings = campaign.quoteSettings || {}) {
  if (Array.isArray(settings.gradeRows)) return settings.gradeRows.map((row, index) => {
    const unitPrice = amount(row.unitPrice), quantity = amount(row.quantity)
    return { id: row.id || `grade-${index}`, grade: quoteGrade(row.grade), name: row.name || '인플루언서 콘텐츠 협업', platform: row.platform || '협의', scope: row.scope || '콘텐츠 형식 협의',
      quantity, unitPrice, total: quantity == null || unitPrice == null ? null : Math.round(quantity * unitPrice), priceLabel: '등급별 계획 단가 · 미확정', note: row.note || '' }
  })
  const groups = new Map()
  for (const row of buildCampaignQuote(campaign, creators, settings).items) {
    const key = JSON.stringify([row.grade, row.platform, row.scope, row.unitPrice, row.priceLabel, row.note, row.quantity == null])
    const group = groups.get(key) || { ...row, id: key, name: '인플루언서 콘텐츠 협업', quantity: 0, total: row.total == null ? null : 0, memberCount: 0 }
    group.quantity = row.quantity == null ? null : group.quantity + row.quantity
    group.memberCount++
    if (group.total != null) group.total += row.total
    groups.set(key, group)
  }
  return [...groups.values()].map(row => ({ ...row, roundingAdjustment: row.total == null ? 0 : row.total - Math.round(row.quantity * row.unitPrice) }))
}
export function buildQuoteForForm(campaign = {}, creators = [], settings = campaign.quoteSettings || {}) {
  const formType = quoteFormType(settings.formType)
  return { ...(formType === 'list' ? buildCampaignQuote(campaign, creators, settings) : quoteTotals(campaign, generalQuoteRows(campaign, creators, settings), settings)), formType }
}

export function campaignQuoteSheets(campaign, brand, quote, settings = {}) {
  const money = value => value == null ? '확인 필요' : value
  const metadata = `${settings.issuerName || '㈜미핑기획'} → ${settings.recipient || brand?.name || campaign.brandName || '수신처 확인 필요'} · ${campaign.name} · KRW · ${new Date().toISOString().slice(0, 10)}`
  const rows = quote.items.map(row => [row.name, row.platform, row.scope, row.quantity, money(row.unitPrice), money(row.total), row.priceLabel])
  rows.push(['크리에이터 비용 소계', '', '', '', '', quote.creatorSubtotal, `미확인 ${quote.unknownCount}건`],
    ['운영 기획·관리', '', '', '', `${quote.managementRate}%`, quote.management, '크리에이터 비용 소계 기준'],
    ['배송비', '', '', quote.shippingQuantity, money(quote.shippingUnitCost), money(quote.shipping), '미입력 시 합계 제외'],
    ['기타 비용', '', '', '', '', money(quote.additionalCost), settings.additionalNote || '제품비·제작비·활용료 등 별도 입력'],
    ['공급가액', '', '', '', '', quote.subtotal, '입력·산정 가능한 금액 합계'],
    ['부가세', '', '', '', `${quote.vatRate}%`, quote.vat, ''],
    ['총 견적', '', '', '', '', quote.total, quote.incomplete ? '미확인 항목 제외 · 초안' : '협의 전 · 초안'])
  return [{ name: '캠페인 견적서', title: `${campaign.name} 견적서`, metadata,
    note: [quote.note, settings.note, settings.validUntil ? `유효기간: ${settings.validUntil}` : '유효기간: 협의'].filter(Boolean).join('\n'),
    headers: ['항목', '채널', '협업 범위', '수량', '단가 (KRW)', '금액 (KRW)', '산출 근거'], widths: [30, 15, 30, 10, 21, 23, 37], rows, filter: false }]
}
