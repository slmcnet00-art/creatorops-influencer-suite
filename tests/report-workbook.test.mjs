import { readFileSync } from 'node:fs'
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


test('NUM-7: demo metrics never enter report totals, content rows or XLSX history', async () => {
  const posts = [{ id: 'real', title: 'real content', views: 100, likes: 10 }, { id: 'demo', sourceType: 'demo', title: 'DO_NOT_EXPORT_DEMO', views: 1320000, likes: 86400, metricHistory: [{ measuredAt: new Date().toISOString(), views: 1320000 }] }]
  const sheets = campaignWorkbookSheets({ posts })
  assert.equal(sheets[0].rows.find(row => row[0] === '조회수')[1], 100)
  assert.equal(sheets[1].rows.length, 1)
  assert.equal(sheets[2].rows.length, 0)
  const zip = await JSZip.loadAsync(await buildReportXlsx(sheets))
  for (const name of Object.keys(zip.files).filter(name => name.startsWith('xl/worksheets/') && name.endsWith('.xml'))) assert.ok(!(await zip.file(name).async('string')).includes('DO_NOT_EXPORT_DEMO'))
})


test('NUM-7: production seed button and handler are guarded; report inputs exclude demo', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /import\.meta\.env\.DEV && <button[^>]+onClick=\{seedReportDemoData\}/)
  assert.match(app, /const seedReportDemoData = \(\) => \{\s*if \(!import\.meta\.env\.DEV\) return/)
  assert.ok(app.includes("storedTrackedPosts.filter(post => post.sourceType !== 'demo')"))
})

test('partial individual costs stay labelled and do not become a settled campaign ROAS', () => {
  const sheets = campaignWorkbookSheets({ brand: { name: '검증' }, campaign: { name: '검증' }, cost: 5000, revenue: 10000, costComplete: false })
  assert.match(sheets[0].rows.find(row => row[0] === '실제 집행비 (원)')[2], /전체 비용 확인 필요/)
  assert.equal(sheets[0].rows.find(row => row[0] === '매출 대비 집행 효율')[1], '계산 대기')
})
