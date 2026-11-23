import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { campaignWorkbookSheets, buildReportXlsx } from '../src/reportWorkbook.js'
import { contentThumbnail } from '../shared/contentMetricHistory.js'

test('client report keeps unknown metrics and missing collection dates, and scopes source rows explicitly', () => {
  const sheets = campaignWorkbookSheets({ brand: { name: '브랜드' }, campaign: { name: '캠페인' }, posts: [{ views: 0, likes: 1156, comments: 4, metric_availability: { views: 'unverified' }, title: '실제 제목', publishedAt: '2026-08-26', url: 'https://instagram.com/p/real/' }], exportedAt: '2026-11-23T00:00:00Z' })
  assert.deepEqual(sheets[0].rows.find(row => row[0] === '조회수'), ['조회수', '미확인', '0/1건 확인'])
  assert.equal(sheets[1].rows[0][11], '미기재')
  assert.equal(sheets[2].rows.length, 0)
})
test('xlsx has frozen headers, custom widths, real numeric cells and safe external links', async () => {
  const sheets = campaignWorkbookSheets({ brand: { name: 'A&B' }, campaign: { name: '가독성 검증' }, posts: [{ views: 0, likes: 1000, comments: null, title: '=HYPERLINK("bad")', url: 'https://instagram.com/p/real/?x=1&y=2' }] })
  const zip = await JSZip.loadAsync(await buildReportXlsx(sheets))
  const xml = await zip.file('xl/worksheets/sheet2.xml').async('string')
  assert.match(xml, /ySplit="5"/)
  assert.match(xml, /customWidth="1"/)
  assert.match(xml, /<autoFilter ref="A5:M6"/)
  assert.match(xml, /<c r="F6" s="4"><v>0<\/v><\/c>/)
  assert.match(xml, /<c r="D6" s="0" t="inlineStr"/)
  assert.doesNotMatch(xml, /<f>/)
  assert.match(await zip.file('xl/worksheets/_rels/sheet2.xml.rels').async('string'), /x=1&amp;y=2/)
})
test('image carousel uses its first provided image as the thumbnail', () => {
  assert.equal(contentThumbnail({ images: [{ url: 'https://example.com/first.jpg' }, { url: 'https://example.com/second.jpg' }], thumbnailUrl: 'https://example.com/cover.jpg' }), 'https://example.com/first.jpg')
  assert.equal(contentThumbnail({ images: ['javascript:bad'], thumbnailUrl: 'https://example.com/cover.jpg' }), 'https://example.com/cover.jpg')
})
