import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const outputDir = join(root, 'youtube-compliance-review-20260827')
const rawDir = join(outputDir, 'raw')
const appBaseUrl = process.env.REVIEW_BASE_URL || 'http://127.0.0.1:5173'
const ffmpeg = join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
const rawVideo = join(outputDir, 'creatorops-youtube-api-field-display-raw.webm')
const finalVideo = join(outputDir, 'CreatorOps-YouTube-API-Field-Display-HD.mp4')

mkdirSync(rawDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
})
const page = await context.newPage()
page.setDefaultTimeout(30_000)
let reviewSnapshot = null

async function ensureCaption() {
  await page.evaluate(() => {
    let node = document.getElementById('youtube-review-caption')
    if (!node) {
      node = document.createElement('div')
      node.id = 'youtube-review-caption'
      Object.assign(node.style, {
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        width: 'min(1540px, calc(100vw - 72px))',
        padding: '15px 22px',
        borderRadius: '10px',
        color: '#fff',
        background: 'rgba(10, 15, 25, 0.94)',
        border: '1px solid rgba(255,255,255,0.28)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.32)',
        font: '600 23px/1.4 Arial, sans-serif',
        textAlign: 'center',
        pointerEvents: 'none',
      })
      document.body.appendChild(node)
    }
  })
}

async function caption(message, waitMs = 5_000) {
  await ensureCaption()
  await page.locator('#youtube-review-caption').evaluate((node, value) => {
    node.textContent = value
  }, message)
  await page.waitForTimeout(waitMs)
}

async function highlight(locator, color = '#ef4444') {
  await locator.evaluate((element, outlineColor) => {
    element.dataset.previousReviewOutline = element.style.outline || ''
    element.style.outline = `5px solid ${outlineColor}`
    element.style.outlineOffset = '5px'
    element.style.borderRadius = '8px'
  }, color)
}

async function clearHighlights() {
  await page.evaluate(() => {
    document.querySelectorAll('[data-previous-review-outline]').forEach((element) => {
      element.style.outline = element.dataset.previousReviewOutline || ''
      element.style.outlineOffset = ''
      delete element.dataset.previousReviewOutline
    })
  })
}

// Part 1: run the production request and keep the returned API values on screen.
await page.goto(`${appBaseUrl}/youtube-api-review`, { waitUntil: 'networkidle', timeout: 60_000 })
await page.screenshot({ path: join(outputDir, '01-review-home.png') })
await caption('1. This is the CreatorOps YouTube Data API review client. It uses public, read-only YouTube data.', 5_000)

const workflow = page.locator('#workflow')
await workflow.scrollIntoViewIfNeeded()
await highlight(workflow)
await caption('2. search.list discovers public content. channels.list and videos.list retrieve the public fields displayed by CreatorOps.', 7_000)
await clearHighlights()

const liveDemo = page.locator('#live-demo')
await liveDemo.scrollIntoViewIfNeeded()
await highlight(liveDemo)
await caption('3. A public YouTube video URL is sent to the production API server. No API key is shown in the browser.', 6_000)
await clearHighlights()

await page.getByRole('button', { name: 'Run live request', exact: true }).click()
const successMessage = page.getByText('Live response received', { exact: true })
const errorMessage = page.locator('.yt-review-alert')
await Promise.race([
  successMessage.waitFor({ state: 'visible', timeout: 35_000 }),
  errorMessage.waitFor({ state: 'visible', timeout: 35_000 }),
])

if (await successMessage.isVisible()) {
  reviewSnapshot = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('creatorops.youtubeReviewSnapshot.v1') || 'null'))
  const resultPanel = successMessage.locator('xpath=..')
  await resultPanel.scrollIntoViewIfNeeded()
  await highlight(resultPanel, '#16a34a')
  await page.screenshot({ path: join(outputDir, '02-live-api-response.png') })
  await caption('4. This is the live API response: video title, publish date, views, likes, comments, channel ID, subscribers, and video count.', 10_000)
  await caption('The response panel also records videos.list and channels.list success plus the exact verification timestamp.', 7_000)
  await clearHighlights()
} else {
  await errorMessage.scrollIntoViewIfNeeded()
  await highlight(errorMessage)
  await page.screenshot({ path: join(outputDir, '02-live-api-error.png') })
  await caption('4. The client shows the real API error without substituting sample data. The request and requested resource parts remain visible.', 9_000)
  await clearHighlights()
}

// Part 2: show where the same fields appear in the actual CreatorOps workflow.
await page.goto(`${appBaseUrl}/?review=youtube&lang=en`, { waitUntil: 'networkidle', timeout: 60_000 })
await page.locator('body[data-youtube-review-mode="ready"]').waitFor({ state: 'visible', timeout: 20_000 })
await caption('5. Now we open the actual CreatorOps operations client in the temporary English review mode.', 5_000)
await page.getByRole('button', { name: 'Discovery', exact: true }).click()
await page.waitForTimeout(1_200)

const youtubeBriefControl = page.getByRole('button', { name: 'YouTube', exact: true })
await youtubeBriefControl.scrollIntoViewIfNeeded()
await highlight(youtubeBriefControl)
await caption('6. Discovery is for finding YouTube influencers and channels. The highlighted selector limits influencer discovery to YouTube.', 7_000)
await clearHighlights()

const creatorCard = page.locator('.creator-list .recommendation-card').first()
await creatorCard.scrollIntoViewIfNeeded()
await highlight(creatorCard, '#16a34a')
await page.screenshot({ path: join(outputDir, '03-influencer-discovery.png') })
await caption('7. The channels.list response appears in the existing influencer result card: channel identity, subscribers, and channel performance.', 8_000)
await caption('Average views, engagement, match score, and estimated fee are CreatorOps calculations shown separately in the same operational card.', 8_000)
await clearHighlights()

await page.getByRole('button', { name: 'References', exact: true }).click()
await page.waitForTimeout(1_200)
const contentReferenceTab = page.getByRole('button', { name: /Find content references/i }).first()
await contentReferenceTab.scrollIntoViewIfNeeded()
await highlight(contentReferenceTab)
await caption('8. References is a separate workflow for finding content references, not influencers.', 7_000)
await clearHighlights()

const referenceCard = page.locator('.reference-card').filter({ hasText: reviewSnapshot?.video?.title || '' }).first()
await referenceCard.scrollIntoViewIfNeeded()
await highlight(referenceCard, '#16a34a')
await page.screenshot({ path: join(outputDir, '04-content-reference.png') })
await caption('9. The videos.list response appears in the existing content reference card with thumbnail, title, views, likes, comments, and publish date.', 9_000)
await clearHighlights()

await caption('CreatorOps uses these public fields for read-only discovery and evaluation. It does not upload, edit, or delete YouTube content.', 8_000)

const video = page.video()
if (!video) throw new Error('Playwright did not create a video artifact.')
await page.close()
await video.saveAs(rawVideo)
await context.close()
await browser.close()

execFileSync(ffmpeg, [
  '-y',
  '-ss', '0.25',
  '-i', rawVideo,
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '19',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  finalVideo,
], { stdio: 'inherit' })

for (const [name, second] of [['frame-first', '2'], ['frame-api-response', '34'], ['frame-influencer-discovery', '58'], ['frame-content-reference', '80']]) {
  execFileSync(ffmpeg, ['-y', '-ss', second, '-i', finalVideo, '-frames:v', '1', join(outputDir, `${name}.png`)], { stdio: 'ignore' })
}

console.log(JSON.stringify({ appBaseUrl, rawVideo, finalVideo }, null, 2))
