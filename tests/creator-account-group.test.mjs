import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import JSZip from 'jszip'
import { creatorAccountGroup } from '../shared/creatorAccountGroup.js'
import { buildQuoteForForm } from '../shared/campaignQuote.js'
import { buildMipingQuoteXlsx } from '../src/mipingQuoteWorkbook.js'
import { contentThumbnail } from '../shared/contentMetricHistory.js'

test('데이터 정의 경계는 상위 그룹 이상이며 원천 미확인과 합산 팔로워로 등급을 만들지 않는다', () => {
  for (const [followers, label] of [[1, '나노'], [9999, '나노'], [10000, '마이크로'], [49999, '마이크로'], [50000, '미드'], [99999, '미드'], [100000, '매크로'], [299999, '매크로'], [300000, '메가']]) assert.equal(creatorAccountGroup({ followers }).label, label)
  for (const followers of [null, undefined, '', false, -1, 'bad', Infinity, 0]) assert.equal(creatorAccountGroup({ followers, combinedFollowers: 1000000 }).id, 'unknown')
  assert.equal(creatorAccountGroup({ followers: 0, followerSource: '수동 실측' }).label, '나노')
  assert.equal(creatorAccountGroup({ followers: 200000, metric_availability: { followers: 'unverified' } }).id, 'unknown')
})

test('발굴 분류와 두 견적서 등급은 같고 원본 등급·시딩 유형과 금액은 보존된다', async () => {
  const creators = [{ id: 1, name: 'One', platform: 'Instagram', tier: '매크로 (100K+)', followers: 1241, actualPrice: 2000000 }, { id: 2, name: 'Two', platform: 'Instagram', followers: 2000, actualPrice: 2000000 }, { id: 3, name: 'Three', tier: 'paid seeding', platform: 'TikTok', followers: 60000, actualPrice: 100000 }]
  const campaign = { name: '분류 검증', creatorIds: [1, 2, 3] }
  for (const formType of ['general', 'list']) {
    const quote = buildQuoteForForm(campaign, creators, { formType })
    assert.equal(quote.items[0].grade, creatorAccountGroup(creators[0]).label)
    assert.equal(quote.items.at(-1).grade, '미드')
    assert.match(quote.items[0].note, /원본 등급: 매크로/)
    assert.match(quote.items.at(-1).note, /협업 유형: paid seeding/)
    assert.equal(quote.creatorSubtotal, 4100000)
    const templateBytes = await fs.readFile(new URL(`../public/templates/miping-${formType}-quote.xlsx`, import.meta.url))
    const zip = await JSZip.loadAsync(await buildMipingQuoteXlsx({ campaign, quote, templateBytes }))
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string')
    assert.match(sheet, /나노/); assert.match(sheet, /미드/); assert.match(sheet, /등급/)
    assert.doesNotMatch(sheet, /mergeCell ref="A6:B6"/)
  }
  const grouped = buildQuoteForForm({ creatorIds: [2, 4] }, [creators[1], { ...creators[1], id: 4, followers: 3000 }])
  assert.equal(grouped.items.length, 1); assert.equal(grouped.items[0].quantity, 2)
})

test('이미지형 콘텐츠 첫장과 Instagram 이미지 필드만 썸네일로 사용하고 영상 URL은 피한다', () => {
  assert.equal(contentThumbnail({ images: [{ display_url: 'https://example.com/first.jpg' }], thumbnailUrl: 'https://example.com/cover.jpg' }), 'https://example.com/first.jpg')
  assert.equal(contentThumbnail({ thumbnail_url: 'https://example.com/reel.jpg' }), 'https://example.com/reel.jpg')
  assert.equal(contentThumbnail({ media: [{ url: 'https://example.com/video.mp4' }], thumbnailUrl: 'https://example.com/cover.jpg' }), 'https://example.com/cover.jpg')
  assert.equal(contentThumbnail({ images: ['javascript:bad'] }), '')
})
