import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCampaignQuote, campaignQuoteSheets } from '../shared/campaignQuote.js'
import { campaignContactMessage, defaultContactTemplate, renderContactTemplate, CONTACT_TEMPLATE_PRESETS, withContactPreset } from '../shared/campaignContact.js'
import { getCreatorRateSummary, withCreatorRate } from '../shared/creatorRates.js'
import { creatorAudience, creatorProfileImage } from '../shared/creatorProfilePresentation.js'
import { referencedBrandCreatorIds } from '../shared/brandCreatorReferences.js'
import { buildReportXlsx } from '../src/reportWorkbook.js'
import JSZip from 'jszip'

const creator = { id: 1, name: '크리에이터', platform: 'Instagram', actualPrice: 200000, followers: null, combinedFollowers: 12345 }
const campaign = { id: 1, name: '뷰티 협업', product: '에센스', brandName: '테스트 브랜드', creatorIds: [1, 2], contentFormats: ['숏폼'], budget: 0 }
test('견적은 배정 후보만 반영하고 수량·운영비·배송비·VAT를 합산하며 미확인 금액을 0원 견적으로 만들지 않는다', () => {
  const rows = [creator, { id: 2, name: '미확인', platform: 'TikTok' }, { id: 3, actualPrice: 999999 }]
  const q = buildCampaignQuote(campaign, rows, { managementRate: 10, shippingUnitCost: 3000, vatRate: 10 })
  assert.equal(q.items.length, 2); assert.equal(q.creatorSubtotal, 200000)
  assert.equal(q.subtotal, 226000); assert.equal(q.total, 248600)
  assert.equal(q.unknownCount, 1); assert.equal(q.incomplete, true); assert.equal(q.budget, 0)
  const edited = buildCampaignQuote(campaign, rows, { creatorOverrides: { 1: { quantity: 2, unitPrice: 100000 }, 2: { included: false } }, additionalCost: 5000, vatRate: 0 })
  assert.equal(edited.total, 205000); assert.equal(edited.unknownCount, 0)
  assert.equal(buildCampaignQuote(campaign, rows, { creatorOverrides: { 1: { unitPrice: '' } } }).items[0].unitPrice, null)
  assert.equal(buildCampaignQuote(campaign, rows, { creatorOverrides: { 1: { unitPrice: 0 } } }).items[0].total, 0)
  assert.equal(creator.actualPrice, 200000)
})
test('원본 제안가는 계산 추정치보다 우선하되 확정가로 표시하지 않고 실제 합의가 최우선이다', () => {
  const source = { ...creator, actualPrice: null, proposedPrice: 50000, proposedPriceCurrency: 'KRW', averageViews: 50000 }
  assert.equal(getCreatorRateSummary(source).effectivePrice, 50000)
  assert.match(getCreatorRateSummary(source).label, /미확정/)
  assert.equal(getCreatorRateSummary(withCreatorRate(source)).effectivePrice, 50000)
  assert.equal(getCreatorRateSummary({ ...source, actualPrice: 70000 }).effectivePrice, 70000)
  assert.notEqual(getCreatorRateSummary({ ...source, proposedPriceCurrency: 'USD' }).effectivePrice, 50000)
})
test('견적 Excel은 캠페인·수신처·세금·미확인 상태를 포함하고 숫자는 실제 숫자로 저장한다', async () => {
  const q = buildCampaignQuote(campaign, [creator])
  const sheets = campaignQuoteSheets(campaign, { name: '광고주' }, q, { note: '2차 활용 별도' })
  const zip = await JSZip.loadAsync(await buildReportXlsx(sheets))
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string')
  assert.match(sheet, /뷰티 협업 견적서/); assert.match(sheet, /광고주/); assert.match(sheet, /부가세/)
  assert.match(sheet, /<v>200000<\/v>/); assert.match(sheet, /2차 활용 별도/)
})
test('컨택 양식은 현재 제품·이름·조건을 반영하고 오래된 브랜드·일정·담당자·가짜 친분을 포함하지 않는다', () => {
  for (const language of ['ko', 'en', 'ja', 'zh-CN']) for (const channel of ['email', 'dm']) {
    const out = campaignContactMessage(campaign, language, channel, { creatorName: 'Jamie', offer: '조건 확인', replyRequest: '회신 요청' })
    assert.match(out.body, /Jamie/); assert.match(out.body, /에센스/); assert.match(out.body, /조건 확인/)
    assert.doesNotMatch(out.body, /\{\{|2025|이태이|바닐라코|최근 한 달|즐겨|인상 깊/)
    assert.notEqual(defaultContactTemplate(language, 'email').body, defaultContactTemplate(language, 'dm').body)
  }
  assert.throws(() => renderContactTemplate('{{password}}'), /지원하지/)
  const edited = campaignContactMessage({ ...campaign, contactTemplates: { 'email:en': { subject: '{{brand}} for {{creatorName}}', body: '{{product}} / {{offer}}' } } }, 'en', 'email', { creatorName: 'Jamie', offer: 'Gifted' })
  assert.equal(edited.subject, '테스트 브랜드 for Jamie'); assert.equal(edited.body, '에센스 / Gifted')
})
test('합산 팔로워를 채널 팔로워로 오인하지 않고 실제 이미지와 미확인 사진을 구분한다', () => {
  assert.equal(creatorAudience(creator).value, 12345); assert.match(creatorAudience(creator).label, /합산/)
  assert.equal(creatorAudience({ ...creator, followers: 500 }).value, 500)
  assert.equal(creatorAudience({}).value, null)
  assert.equal(creatorProfileImage({ avatar: 'https://images.unsplash.com/photo-stock' }), '')
  assert.equal(creatorProfileImage({ socialProfiles: [{ avatar: 'https://example.com/real.jpg' }] }), 'https://example.com/real.jpg')
})
test('브랜드 저장 시 캠페인·즐겨찾기에만 연결된 후보도 보존된다', () => {
  const ids = referencedBrandCreatorIds({ brandId: 8, creators: [{ id: 5, brandId: 8 }, { id: 6, brandId: 9 }], campaigns: [{ creatorIds: [1] }], records: [{ creatorIds: [2] }, { memberIds: [3] }, { creatorId: 4 }] })
  assert.deepEqual([...ids].sort(), ['1', '2', '3', '4', '5'])
})

test('발송 멘트 후보는 제안 유형과 독립적이며 기존 캠페인 양식과 각 후보별 수정본을 보존한다', () => {
  assert.deepEqual(CONTACT_TEMPLATE_PRESETS.map(p => p.id), ['basic_proposal', 'miping_contact'])
  const legacy = { ...campaign, contactTemplates: { 'email:en': { subject: 'Legacy {{brand}}', body: 'Original {{creatorName}}' } } }
  assert.equal(campaignContactMessage(withContactPreset(legacy, 'miping_contact'), 'en', 'email', { creatorName: 'Jamie' }).body, 'Original Jamie')
  assert.notEqual(campaignContactMessage(withContactPreset(legacy, 'basic_proposal'), 'en', 'email', { creatorName: 'Jamie' }).body, 'Original Jamie')
  const saved = { ...legacy, contactTemplatePreset: 'basic_proposal', contactTemplates: { 'email:en': { subject: 'Basic', body: 'Short {{creatorName}}' } }, contactTemplateLibrary: {
    basic_proposal: { 'email:en': { subject: 'Basic', body: 'Short {{creatorName}}' } },
    miping_contact: legacy.contactTemplates,
  } }
  assert.equal(campaignContactMessage(withContactPreset(saved, 'miping_contact'), 'en', 'email', { creatorName: 'Jamie' }).body, 'Original Jamie')
  assert.equal(campaignContactMessage(withContactPreset(saved, 'basic_proposal'), 'en', 'email', { creatorName: 'Jamie' }).body, 'Short Jamie')
  assert.equal(legacy.contactTemplates['email:en'].body, 'Original {{creatorName}}')
  for (const language of ['ko', 'en', 'ja', 'zh-CN']) for (const channel of ['email', 'dm']) {
    assert.notEqual(defaultContactTemplate(language, channel, 'basic_proposal').body, defaultContactTemplate(language, channel, 'miping_contact').body)
  }
})
