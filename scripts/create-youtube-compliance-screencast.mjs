import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outputDir = path.join(root, 'youtube-quota-evidence')
const videoDir = path.join(outputDir, 'playwright-video')
const finalVideo = path.join(outputDir, 'creatorops-youtube-api-compliance-screencast.webm')
const appUrl = 'https://creatorops-influencer-suite.onrender.com'
const durationMultiplier = 1.8

fs.mkdirSync(videoDir, { recursive: true })
if (fs.existsSync(finalVideo)) fs.unlinkSync(finalVideo)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: videoDir,
    size: { width: 1440, height: 900 },
  },
})
await context.addInitScript(() => {
  window.localStorage.setItem('creatorops.practiceTour.completed.v1', 'completed')
})

const page = await context.newPage()
page.setDefaultTimeout(7000)

async function dismissPracticeTour() {
  await page.evaluate(() => {
    window.localStorage.setItem('creatorops.practiceTour.completed.v1', 'completed')
    document.querySelectorAll('.practice-tour-backdrop').forEach((node) => node.remove())
  })
}

async function injectOverlay() {
  await page.evaluate(() => {
    const existing = document.getElementById('creatorops-compliance-overlay')
    if (existing) existing.remove()
    document.querySelectorAll('.practice-tour-backdrop').forEach((node) => node.remove())

    const overlay = document.createElement('div')
    overlay.id = 'creatorops-compliance-overlay'
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.zIndex = '2147483647'
    overlay.style.pointerEvents = 'none'
    overlay.style.fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'

    overlay.innerHTML = `
      <div id="creatorops-compliance-topbar" style="
        position: absolute;
        top: 14px;
        left: 18px;
        right: 18px;
        min-height: 48px;
        border: 1px solid rgba(15,23,42,.16);
        border-radius: 14px;
        background: rgba(255,255,255,.94);
        box-shadow: 0 18px 44px rgba(15,23,42,.12);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 10px 16px;
      ">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="
            width: 34px;
            height: 34px;
            border-radius: 10px;
            background: #111827;
            color: #fff;
            display:flex;
            align-items:center;
            justify-content:center;
            font-weight:800;
          ">CO</div>
          <div>
            <div style="font-size:14px;font-weight:800;color:#111827;">CreatorOps YouTube API Compliance Review</div>
            <div id="creatorops-compliance-url" style="font-size:12px;color:#64748b;">${location.href}</div>
          </div>
        </div>
        <div style="font-size:12px;font-weight:800;color:#0369a1;background:#e0f2fe;border:1px solid #bae6fd;border-radius:999px;padding:7px 11px;">
          Public YouTube metadata only
        </div>
      </div>
      <div id="creatorops-compliance-caption" style="
        position: absolute;
        left: 28px;
        right: 28px;
        bottom: 24px;
        border-radius: 18px;
        background: rgba(2,6,23,.88);
        color: #fff;
        padding: 18px 22px;
        box-shadow: 0 22px 70px rgba(15,23,42,.34);
        font-size: 21px;
        line-height: 1.45;
        font-weight: 650;
      "></div>
    `
    document.body.appendChild(overlay)

    window.__creatoropsSetCaption = (text) => {
      const caption = document.getElementById('creatorops-compliance-caption')
      const url = document.getElementById('creatorops-compliance-url')
      if (caption) caption.textContent = text
      if (url) url.textContent = location.href
    }
  })
}

async function caption(text, ms = 5200) {
  await dismissPracticeTour()
  await injectOverlay()
  await page.evaluate((value) => window.__creatoropsSetCaption?.(value), text)
  await page.waitForTimeout(Math.round(ms * durationMultiplier))
}

async function goto(url, text, ms = 5200) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1200)
  await dismissPracticeTour()
  await caption(text, ms)
}

async function clickText(text, captionText, ms = 5200) {
  await injectOverlay()
  const locator = page.getByText(text, { exact: false }).first()
  try {
    await locator.click({ timeout: 4500 })
    await page.waitForTimeout(1000)
  } catch {
    await page.evaluate((label) => {
      const candidates = [...document.querySelectorAll('button, a, [role="button"], div, span')]
      const found = candidates.find((node) => node.textContent?.includes(label))
      found?.scrollIntoView({ behavior: 'instant', block: 'center' })
    }, text)
    await page.waitForTimeout(700)
  }
  await caption(captionText, ms)
}

async function scrollToMiddle(text, ms = 4800) {
  await injectOverlay()
  await page.evaluate(() => window.scrollTo({ top: Math.max(0, document.body.scrollHeight * 0.42), behavior: 'smooth' }))
  await page.waitForTimeout(1100)
  await caption(text, ms)
}

await goto(
  appUrl,
  'Hello. This screencast explains how CreatorOps uses YouTube API Services in the production client location, and why we need additional quota for campaign-based public creator discovery and reporting.',
  6500,
)

await goto(
  `${appUrl}/privacy`,
  'Our public Privacy Policy explains that YouTube API Services are used for public YouTube channel and public video metadata only. We do not request private YouTube account data.',
  6200,
)

await goto(
  `${appUrl}/terms`,
  'Our Terms of Service are also public. CreatorOps does not use YouTube API Services to upload, modify, delete, or send messages through YouTube.',
  6200,
)

await goto(
  `${appUrl}?youtube_compliance_review=1`,
  'CreatorOps is campaign based. A user starts from a brand campaign brief, then searches for public creators, saves candidates, tracks published campaign content, and generates reports.',
  6200,
)

await clickText(
  '캠페인',
  'Each campaign can include many keywords, countries, categories, and creator conditions. The quota increase is needed because marketers must validate many public YouTube channels and videos before selecting a final creator pool.',
  6500,
)

await clickText(
  '발굴',
  'In Creator Discovery, users search by keyword, country, platform, and category. For YouTube, CreatorOps uses public search and public channel metadata to find relevant creators and validate whether they match the campaign brief.',
  7000,
)

await scrollToMiddle(
  'The discovery step is quota-heavy because one useful candidate list may require multiple keyword searches, channel checks, and duplicate filtering. We save results so the same public data does not need to be fetched repeatedly.',
  6200,
)

await clickText(
  '후보 그룹',
  'After discovery, users save selected creators into candidate pools or reusable groups. YouTube API Services are not used for outreach. The API is used only to support public discovery and public evaluation data.',
  6500,
)

await clickText(
  '메시지',
  'The Message area only prepares outreach operations. It does not send messages through YouTube API Services. This keeps YouTube API usage limited to public metadata, not communication actions.',
  6200,
)

await clickText(
  '레퍼런스',
  'The Reference area helps users find public high-performing content examples. For YouTube, the app can use public video metadata such as title, thumbnail, URL, views, likes, comments, channel information, and collection timestamp.',
  7000,
)

await scrollToMiddle(
  'Quota is also needed here because marketers compare several keywords and regions to understand what content is working. CreatorOps stores public metadata and links only. It does not download, copy, or republish YouTube videos.',
  6000,
)

await clickText(
  '리포트',
  'In Reports, users register public YouTube upload URLs from campaign creators. Public metrics such as views, likes, and comments are refreshed where available and used for campaign performance reports.',
  6800,
)

await caption(
  'Reporting creates repeated public metadata checks over time. For example, a campaign may track many creator videos daily during the campaign period. We batch and reuse stored results, but the normal quota can still be too small for campaign operations.',
  6200,
)

await caption(
  'The quota increase is needed for three documented workflows: public creator discovery, public video reference research, and scheduled public campaign metric refreshes. We do not use the API for private data, uploads, modifications, deletions, or messaging.',
  6500,
)

await caption(
  'In summary, additional quota lets CreatorOps support legitimate campaign-scale public discovery and reporting while keeping API usage limited, documented, and focused on public YouTube metadata only. Thank you.',
  7600,
)

const video = page.video()
if (!video) {
  throw new Error('Playwright did not create a video artifact.')
}

await page.close()
await video.saveAs(finalVideo)
await context.close()
await browser.close()
console.log(finalVideo)
