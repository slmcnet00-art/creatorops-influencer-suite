import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const reviewUrl = process.env.REVIEW_URL || 'http://localhost:5173/youtube-api-review'
const packageDir = path.join(root, 'youtube-compliance-review-20260818')
const videoDir = path.join(packageDir, 'playwright-video')
const webmPath = path.join(packageDir, 'CreatorOps-YouTube-API-Review-HD.webm')
const mp4Path = path.join(packageDir, 'CreatorOps-YouTube-API-Review-HD.mp4')
const ffmpegPath = path.join(
  process.env.LOCALAPPDATA || '',
  'ms-playwright',
  'ffmpeg-1011',
  'ffmpeg-win64.exe',
)

fs.mkdirSync(videoDir, { recursive: true })
for (const filePath of [webmPath, mp4Path]) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: videoDir, size: { width: 1920, height: 1080 } },
})
const page = await context.newPage()
page.setDefaultTimeout(12000)

async function setCaption(text) {
  await page.evaluate((caption) => {
    let node = document.getElementById('creatorops-review-caption')
    if (!node) {
      node = document.createElement('div')
      node.id = 'creatorops-review-caption'
      Object.assign(node.style, {
        position: 'fixed', left: '40px', right: '40px', bottom: '28px',
        zIndex: '2147483647', padding: '18px 24px', borderRadius: '12px',
        background: 'rgba(15, 23, 42, .94)', color: '#fff',
        boxShadow: '0 20px 50px rgba(15, 23, 42, .28)',
        font: '600 22px/1.45 -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif',
        pointerEvents: 'none',
      })
      document.body.appendChild(node)
    }
    node.textContent = caption
  }, text)
}

async function pause(text, duration = 5200) {
  await setCaption(text)
  await page.waitForTimeout(duration)
}

async function screenshot(name) {
  await page.screenshot({ path: path.join(packageDir, name), fullPage: false })
}

await page.goto(reviewUrl, { waitUntil: 'networkidle', timeout: 60000 })
await pause(
  'Step 1. This English review page demonstrates how CreatorOps uses YouTube Data API v3 in the actual API client.',
  6500,
)
await screenshot('01-english-review-home.png')

await page.locator('#workflow').scrollIntoViewIfNeeded()
await pause(
  'Step 2. The workflow uses search.list for discovery, channels.list for public channel verification, and videos.list for public video metrics.',
  7000,
)
await screenshot('02-api-workflow.png')

await page.locator('#live-demo').scrollIntoViewIfNeeded()
await pause(
  'Step 3. We now submit a public YouTube video URL. CreatorOps requests only public video and channel metadata from the live backend.',
  5600,
)
await page.getByRole('button', { name: /Run live request/i }).click()
await page.waitForTimeout(3500)
await pause(
  'The result panel records the real API response. If the current quota is exhausted, the page shows that quota response without substituting sample data.',
  7000,
)
await screenshot('03-live-api-request.png')

await page.locator('#data-controls').scrollIntoViewIfNeeded()
await pause(
  'Step 4. CreatorOps stores public metadata with source and collection timestamps, refreshes it for campaign reporting, and supports deletion by workspace.',
  7000,
)
await screenshot('04-data-controls.png')

await pause(
  'Additional quota is required because each campaign repeats keyword discovery, channel verification, video verification, duplicate filtering, and scheduled metric refreshes across many creators.',
  8000,
)
await pause(
  'CreatorOps does not access private videos or private audience data, and does not upload, modify, delete, or message through YouTube API Services. Thank you for reviewing our request.',
  8000,
)

const video = page.video()
if (!video) throw new Error('Playwright did not create a video artifact.')
await page.close()
await video.saveAs(webmPath)
await context.close()
await browser.close()

if (fs.existsSync(ffmpegPath)) {
  try {
    execFileSync(
      ffmpegPath,
      ['-y', '-i', webmPath, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
      { stdio: 'pipe' },
    )
  } catch (error) {
    console.warn(`MP4 conversion skipped: ${error.message}`)
  }
}

console.log(JSON.stringify({ reviewUrl, webmPath, mp4Path: fs.existsSync(mp4Path) ? mp4Path : null }, null, 2))
