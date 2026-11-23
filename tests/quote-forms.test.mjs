import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import JSZip from 'jszip'
import { buildCampaignQuote, buildQuoteForForm, generalQuoteRows } from '../shared/campaignQuote.js'
import { buildMipingQuoteXlsx } from '../src/mipingQuoteWorkbook.js'

const campaign = { name: '검증 캠페인', creatorIds: [1, 2, 3, 4], budget: 0, contentFormats: ['숏폼'] }
const creators = [
  { id: 1, name: 'Creator One', tier: 'A', platform: 'Instagram', actualPrice: 1000000, profileUrl: 'https://www.instagram.com/creator_one/' },
  { id: 2, name: 'Creator Two', tier: 'A', platform: 'Instagram', actualPrice: 1000000 },
  { id: 3, name: 'Creator Three', tier: 'A', platform: 'Instagram', actualPrice: 2000000 },
  { id: 4, name: 'Unknown Rate', platform: 'TikTok' },
]
const template = type => fs.readFile(new URL(`../public/templates/miping-${type}-quote.xlsx`, import.meta.url))

test('일반 견적은 등급·채널·형식·동일 단가별로 묶고 단가가 다른 후보를 평균으로 혼합하지 않는다', () => {
  const general = buildQuoteForForm(campaign, creators, { formType: 'general', managementRate: 10, shippingUnitCost: 3000 })
  const list = buildQuoteForForm(campaign, creators, { formType: 'list', managementRate: 10, shippingUnitCost: 3000 })
  assert.equal(general.items.length, 3); assert.equal(list.items.length, 4)
  assert.equal(general.items[0].grade, 'A급'); assert.equal(general.items[0].quantity, 2)
  assert.equal(general.items[0].unitPrice, 1000000); assert.equal(general.items[1].unitPrice, 2000000)
  assert.equal(general.total, list.total); assert.equal(general.shippingQuantity, 4)
  assert.equal(general.items[2].grade, '등급 미분류'); assert.equal(general.items[2].unitPrice, null)
  assert.equal(general.unknownCount, 1); assert.equal(general.budget, 0)
})

test('후보 없이 등급별 계획을 만들 수 있고 미입력과 실제 0원, 리스트 단가를 구분한다', () => {
  const settings = { formType: 'general', gradeRows: [{ grade: 'S', quantity: 2, unitPrice: 5000000 }, { grade: 'B', quantity: 10, unitPrice: 0 }, { grade: 'A', quantity: '', unitPrice: 500000 }], vatRate: 0 }
  const q = buildQuoteForForm({}, [], settings)
  assert.equal(q.total, 10000000); assert.equal(q.items[1].total, 0); assert.equal(q.items[2].total, null)
  assert.equal(q.unknownCount, 1)
  assert.equal(buildQuoteForForm(campaign, creators, { ...settings, formType: 'list' }).creatorSubtotal, 4000000)
  assert.equal(creators[0].actualPrice, 1000000)
  assert.equal(generalQuoteRows({}, [], { gradeRows: [] }).length, 0)
  assert.equal(buildCampaignQuote(campaign, creators).items.length, 4)
})

test('협업 유형을 등급으로 오인하지 않고 개별 건 원 단위 반올림도 합산 시 보존한다', () => {
  const rows = [{ id: 1, tier: 'paid seeding', platform: 'TikTok', actualPrice: 100.5 }, { id: 2, tier: 'paid seeding', platform: 'TikTok', actualPrice: 100.5 }]
  const q = buildQuoteForForm({ creatorIds: [1, 2] }, rows, { formType: 'general' })
  assert.equal(q.items[0].grade, '등급 미분류'); assert.match(q.items[0].note, /paid seeding/)
  assert.equal(q.creatorSubtotal, 202); assert.equal(q.items[0].roundingAdjustment, 1)
})

test('두 다운로드가 미핑기획 To·Title·Date·Amount와 남색 견적 양식을 사용하며 수식·세금·인쇄 범위를 보존한다', async () => {
  for (const type of ['general', 'list']) {
    const settings = { formType: type, recipient: '수신 광고주', issuedAt: '2026-11-23', managementRate: 10, shippingUnitCost: 3000, additionalCost: 50000, vatRate: 10 }
    const q = buildQuoteForForm(campaign, creators, settings)
    const zip = await JSZip.loadAsync(await buildMipingQuoteXlsx({ campaign, brand: { name: '브랜드' }, quote: q, settings, templateBytes: await template(type) }))
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string')
    const styles = await zip.file('xl/styles.xml').async('string')
    const wb = await zip.file('xl/workbook.xml').async('string')
    for (const word of ['미핑기획', 'To', 'Title', 'Date', 'Amount', '수신 광고주', '검증 캠페인', 'Sub Total', 'VAT', 'Grand Total']) assert.ok(sheet.includes(word), word)
    assert.match(styles, /002060/); assert.match(sheet, /<f>IF\(AND\(ISNUMBER\(E7\)/)
    assert.match(sheet, /<f>ROUND\(G\d+\*H\d+,0\)<\/f>/)
    assert.match(sheet, new RegExp(`<v>${q.total}</v>`)); assert.match(wb, /Print_Area/); assert.match(wb, /Print_Titles/)
    assert.match(sheet, /orientation="landscape" fitToWidth="1" fitToHeight="0"/)
    assert.doesNotMatch(sheet, /P&amp;G|Vinyl|한아름|224700000|2020-01/)
    if (type === 'general') { assert.doesNotMatch(sheet, /Creator One/); assert.match(sheet, /A급/) }
    else { assert.match(sheet, /Creator One/); assert.match(await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string'), /instagram.com/) }
  }
})

test('빈 일반 양식도 0원 미확정 상태로 다운로드되고 한국 날짜를 쓴다', async () => {
  const q = buildQuoteForForm({}, [], { formType: 'general' })
  const zip = await JSZip.loadAsync(await buildMipingQuoteXlsx({ campaign: { name: '빈 계획' }, quote: q, templateBytes: await template('general'), exportedAt: '2026-11-23T16:00:00Z' }))
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string')
  assert.match(sheet, /2026-11-24/); assert.equal(q.incomplete, true)
})
