import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import ffmpeg from 'ffmpeg-static'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const outputDir = join(root, 'youtube-compliance-review-20260901')
const rawDir = join(outputDir, 'raw')
const appBaseUrl = process.env.REVIEW_BASE_URL || 'https://creatorops-influencer-suite.onrender.com'
const rawCreatorOpsVideo = join(outputDir, 'creatorops-thumbnail-flow-raw.webm')
const rawYouTubeVideo = join(outputDir, 'youtube-original-playback-raw.webm')
const finalVideo = join(outputDir, 'CreatorOps-YouTube-Thumbnail-Original-View-HD.mp4')

mkdirSync(rawDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
})
const creatorOpsPage = await context.newPage()
creatorOpsPage.setDefaultTimeout(35_000)

async function ensureCaption(page) {
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

async function caption(page, message, waitMs = 4_000) {
  await ensureCaption(page)
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

async function clearHighlights(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-previous-review-outline]').forEach((element) => {
      element.style.outline = element.dataset.previousReviewOutline || ''
      element.style.outlineOffset = ''
      delete element.dataset.previousReviewOutline
    })
  })
}

// 1. Confirm the highlighted field on the dedicated compliance review page.
await creatorOpsPage.goto(`${appBaseUrl}/youtube-api-review`, { waitUntil: 'networkidle', timeout: 60_000 })
await caption(creatorOpsPage, '1. The highlighted field is the YouTube video thumbnail returned by youtube.videos.list in snippet.thumbnails.', 5_000)

await creatorOpsPage.getByRole('button', { name: 'Run live request', exact: true }).click()
const successMessage = creatorOpsPage.getByText('Live response received', { exact: true })
await successMessage.waitFor({ state: 'visible', timeout: 40_000 })
const reviewSnapshot = await creatorOpsPage.evaluate(() => (
  JSON.parse(window.sessionStorage.getItem('creatorops.youtubeReviewSnapshot.v1') || 'null')
))
const reviewThumbnail = creatorOpsPage.locator('.yt-review-video-summary img')
await reviewThumbnail.scrollIntoViewIfNeeded()
await highlight(reviewThumbnail)
await creatorOpsPage.screenshot({ path: join(outputDir, '01-highlighted-api-thumbnail.png') })
await caption(creatorOpsPage, 'This thumbnail is a public preview field. It is not an embedded video player.', 5_000)
await clearHighlights(creatorOpsPage)

// 2. Show the same thumbnail in the actual Content Reference workflow.
await creatorOpsPage.goto(`${appBaseUrl}/?review=youtube&lang=en`, { waitUntil: 'networkidle', timeout: 60_000 })
await creatorOpsPage.locator('body[data-youtube-review-mode="ready"]').waitFor({ state: 'visible', timeout: 20_000 })
await creatorOpsPage.getByRole('button', { name: 'References', exact: true }).click()
await creatorOpsPage.waitForTimeout(1_200)

const referenceCard = creatorOpsPage.locator('.reference-card').filter({ hasText: reviewSnapshot?.video?.title || '' }).first()
await referenceCard.scrollIntoViewIfNeeded()
await highlight(referenceCard, '#16a34a')
await creatorOpsPage.screenshot({ path: join(outputDir, '02-content-reference-thumbnail.png') })
await caption(creatorOpsPage, '2. The same thumbnail is displayed in the actual CreatorOps Content Reference workflow.', 5_000)
await clearHighlights(creatorOpsPage)

const openOriginal = referenceCard.locator('.reference-open-link')
await highlight(openOriginal, '#2563eb')
await caption(creatorOpsPage, '3. The user selects Open original to view the public video on YouTube.', 4_000)

const popupPromise = context.waitForEvent('page', { timeout: 20_000 })
await openOriginal.click()
const youtubePage = await popupPromise
youtubePage.setDefaultTimeout(35_000)
const creatorOpsVideo = creatorOpsPage.video()
if (!creatorOpsVideo) throw new Error('CreatorOps page video was not created.')
await creatorOpsPage.close()
await creatorOpsVideo.saveAs(rawCreatorOpsVideo)

// 3. Show that playback happens on the original YouTube watch page, not inside CreatorOps.
await youtubePage.waitForLoadState('domcontentloaded', { timeout: 60_000 })
await youtubePage.bringToFront()
await caption(youtubePage, '4. A new browser tab opens the original YouTube watch page. The video is not embedded inside CreatorOps.', 5_000)

const youtubeVideoElement = youtubePage.locator('video').first()
let playbackStarted = false
try {
  await youtubeVideoElement.waitFor({ state: 'visible', timeout: 25_000 })
  await youtubeVideoElement.evaluate((video) => {
    video.muted = true
  })
  const largePlayButton = youtubePage.locator('.ytp-large-play-button').first()
  if (await largePlayButton.isVisible().catch(() => false)) {
    await largePlayButton.click()
  } else {
    await youtubeVideoElement.click()
  }
  await youtubePage.waitForTimeout(3_500)
  playbackStarted = await youtubeVideoElement.evaluate((video) => video.currentTime > 0 && !video.paused)
} catch {
  playbackStarted = false
}

await youtubePage.screenshot({ path: join(outputDir, '03-youtube-original-playback.png') })
await caption(youtubePage, 'Playback is provided by YouTube on the original watch page. CreatorOps does not download, re-host, or stream the video.', 6_000)

const youtubePageVideo = youtubePage.video()
if (!youtubePageVideo) throw new Error('YouTube page video was not created.')
await youtubePage.close()
await youtubePageVideo.saveAs(rawYouTubeVideo)
await context.close()
await browser.close()

execFileSync(ffmpeg, [
  '-y',
  '-i', rawCreatorOpsVideo,
  '-i', rawYouTubeVideo,
  '-filter_complex', '[0:v]setpts=PTS-STARTPTS[v0];[1:v]setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[outv]',
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '19',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  finalVideo,
], { stdio: 'inherit' })

const verification = {
  createdAt: new Date().toISOString(),
  appBaseUrl,
  reviewVideoTitle: reviewSnapshot?.video?.title || '',
  reviewVideoUrl: reviewSnapshot?.video?.url || '',
  playbackStarted,
  finalVideo,
}
writeFileSync(join(outputDir, 'verification.json'), `${JSON.stringify(verification, null, 2)}\n`, 'utf8')

console.log(JSON.stringify(verification, null, 2))
