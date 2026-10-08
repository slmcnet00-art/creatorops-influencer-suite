// Local regression tests with synthetic API data; not compliance evidence.
// Run a local preview first, then: node scripts/test-youtube-compliance-ui.mjs
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5192'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local test server required')
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const data = {
    video: { id: 'fixture1234', title: 'Synthetic UI test video', url: 'https://youtube.com/watch?v=fixture1234', views: 1000, likes: 10, comments: 2 },
    channel: { id: 'fixture-channel', title: 'Synthetic UI test channel', subscribers: 12345, videos: 10 },
    calls: [], checkedAt: new Date().toISOString(),
  }
  await page.route('**/youtube/compliance-demo', route => route.fulfill({ json: { data } }))
  await page.goto(base + '/youtube-api-review')
  await page.getByRole('button', { name: 'Run live request', exact: true }).click()
  await page.locator('.yt-review-channel-stats').waitFor()
  assert.ok((await page.locator('.yt-review-channel-stats').innerText()).includes('Subscribers'))
  console.log('PASS: demo uses Subscribers with synthetic API response')
  await page.goto(base + '/?review=youtube')
  await page.getByRole('button', { name: 'References', exact: true }).click()
  await page.locator('.reference-card').first().waitFor()
  assert.ok((await page.locator('.reference-card').first().innerText()).includes('Subscribers'))
  assert.ok((await page.locator('.youtube-data-policy-note').innerText()).includes('read-only'))
  await page.getByRole('button', { name: 'Discovery', exact: true }).click()
  await page.locator('#discovery select').first().selectOption('YouTube')
  assert.equal(await page.locator('#discovery').getByRole('button', { name: /^(Excel|Client export|Google Sheets)$/ }).count(), 0)
  assert.ok((await page.locator('.profile-panel').innerText()).includes('Subscribers'))
  const staleLabels = page.locator('.profile-panel').getByText('followers', { exact: true })
  assert.equal(await staleLabels.count(), 0, await staleLabels.evaluateAll(nodes => nodes.map(n => n.parentElement.outerHTML).join('\n')))
  console.log('PASS: English reference/detail labels, notice and YouTube export controls')
  await page.goto(base + '/')
  await page.getByRole('button', { name: '발굴', exact: true }).click()
  await page.locator('#discovery select').first().selectOption('YouTube')
  assert.ok((await page.locator('#discovery').innerText()).includes('Subscribers 최소'))
  assert.equal(await page.locator('#discovery').getByRole('button', { name: /^(엑셀|광고주용|시트)$/ }).count(), 0)
  await page.locator('#discovery select').first().selectOption('Instagram')
  assert.ok((await page.locator('#discovery').innerText()).includes('팔로워 최소'))
  assert.equal(await page.locator('#discovery').getByRole('button', { name: '엑셀', exact: true }).count(), 1)
  console.log('PASS: Korean YouTube Subscribers, Instagram followers, platform-specific export controls')
} finally {
  await browser.close()
}
