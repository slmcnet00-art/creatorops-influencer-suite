import { getCreatorRateSummary } from './creatorRates.js'

const amount = value => value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value)
export function buildCampaignQuote(campaign = {}, creators = [], settings = campaign.quoteSettings || {}) {
  const assigned = new Set((campaign.creatorIds || []).map(String))
  const items = creators.filter(c => assigned.has(String(c.id))).map(creator => {
    const override = settings.creatorOverrides?.[creator.id] || {}
    const rate = getCreatorRateSummary(creator, campaign)
    const unitPrice = Object.hasOwn(override, 'unitPrice') ? amount(override.unitPrice) : rate.effectivePrice > 0 ? rate.effectivePrice : null
    const quantity = Object.hasOwn(override, 'quantity') ? amount(override.quantity) : 1
    return { id: creator.id, name: creator.name, platform: creator.platform, scope: (campaign.contentFormats || []).join(' + ') || '콘텐츠 형식 협의',
      unitPrice, quantity, included: override.included !== false,
      priceLabel: Object.hasOwn(override, 'unitPrice') ? '견적 초안 입력' : rate.label,
      total: unitPrice == null || quantity == null ? null : Math.round(unitPrice * quantity) }
  }).filter(row => row.included)
  const creatorSubtotal = items.reduce((sum, row) => sum + (row.total ?? 0), 0)
  const managementRate = amount(settings.managementRate) ?? 0
  const management = Math.round(creatorSubtotal * Math.min(managementRate, 100) / 100)
  const shippingUnitCost = amount(settings.shippingUnitCost)
  const shippingQuantity = amount(settings.shippingQuantity) ?? items.length
  const shipping = shippingUnitCost == null ? null : Math.round(shippingUnitCost * shippingQuantity)
  const additionalCost = amount(settings.additionalCost)
  const subtotal = creatorSubtotal + management + (shipping ?? 0) + (additionalCost ?? 0)
  const vatRate = Math.min(amount(settings.vatRate) ?? 10, 100)
  const vat = Math.round(subtotal * vatRate / 100)
  const unknownCount = items.filter(row => row.total == null).length
  return { items, creatorSubtotal, managementRate, management, shipping, shippingQuantity, shippingUnitCost, additionalCost, subtotal, vatRate, vat, total: subtotal + vat,
    unknownCount, incomplete: !items.length || unknownCount > 0,
    budget: amount(campaign.budget), currency: 'KRW',
    note: '예상 견적 초안입니다. 크리에이터 확정 단가, 배송·제품비, 2차 활용 범위는 협의 후 확정합니다. 미입력 비용은 합계에서 제외됩니다.' }
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
