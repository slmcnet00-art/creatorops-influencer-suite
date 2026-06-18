import 'dotenv/config'
import cors from 'cors'
import express from 'express'

const app = express()
const port = Number(process.env.PORT || 8787)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`Origin not allowed: ${origin}`))
  },
}))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (request, response) => {
  response.json({
    ok: true,
    service: 'creatorops-api',
    version: process.env.RENDER_GIT_COMMIT || 'local',
  })
})

app.post('/youtube/channel', async (request, response, next) => {
  try {
    const lookup = String(request.body?.lookup || '').trim()
    if (!lookup) throw httpError(400, 'lookup is required.')

    const channel = await fetchYouTubeChannelSnapshot(lookup)
    response.json({ data: channel })
  } catch (error) {
    next(error)
  }
})

app.post('/discovery/youtube/search', async (request, response, next) => {
  try {
    const query = String(request.body?.query || '').trim()
    const maxResults = clamp(Number(request.body?.maxResults || 8), 1, 20)
    if (!query) throw httpError(400, 'query is required.')

    const creators = await searchYouTubeCreators(query, maxResults)
    response.json({ data: creators })
  } catch (error) {
    next(error)
  }
})

app.post('/discovery/google-profiles/search', async (request, response, next) => {
  try {
    const query = String(request.body?.query || '').trim()
    const platform = String(request.body?.platform || 'all')
    const maxResults = clamp(Number(request.body?.maxResults || 8), 1, 10)
    if (!query) throw httpError(400, 'query is required.')

    const profiles = await searchGoogleProfiles(query, platform, maxResults)
    response.json({ data: profiles })
  } catch (error) {
    next(error)
  }
})

app.post('/ai/outreach-message', async (request, response, next) => {
  try {
    const { creator, brand, campaign } = request.body || {}
    const prompt = [
      '한국어로 친근하고 성의 있는 인플루언서 협업 제안 메시지를 작성해줘.',
      '답장이 오기 쉽도록 구체적인 칭찬, 브랜드 적합 이유, 협업 조건 확인 질문을 포함해.',
      `Creator: ${JSON.stringify(creator || {})}`,
      `Brand: ${JSON.stringify(brand || {})}`,
      `Campaign: ${JSON.stringify(campaign || {})}`,
    ].join('\n')
    const message = await callOpenAIText(prompt)
    response.json({ data: { message } })
  } catch (error) {
    next(error)
  }
})

app.post('/ai/content-guide', async (request, response, next) => {
  try {
    const { brand, campaign, seedingType, channel, references } = request.body || {}
    const prompt = [
      '인플루언서에게 전달할 콘텐츠 가이드를 한국어로 작성해줘.',
      '구성: 원메시지, 후킹포인트, 촬영 시나리오, 채널별 주의사항, 금지표현, 검수 체크리스트.',
      `Brand: ${JSON.stringify(brand || {})}`,
      `Campaign: ${JSON.stringify(campaign || {})}`,
      `Seeding type: ${seedingType || ''}`,
      `Channel: ${channel || ''}`,
      `References: ${JSON.stringify(references || [])}`,
    ].join('\n')
    const guide = await callOpenAIText(prompt)
    response.json({ data: { guide } })
  } catch (error) {
    next(error)
  }
})

app.post('/outreach/gmail/send', async (request, response, next) => {
  try {
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
      throw httpError(501, 'Gmail OAuth is not configured. Use manual approval/copy flow until OAuth is connected.')
    }
    throw httpError(501, 'Gmail send requires per-user OAuth token storage. Endpoint contract is reserved.')
  } catch (error) {
    next(error)
  }
})

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }
  const status = error.status || 500
  response.status(status).json({
    error: status >= 500 ? 'internal_error' : 'request_error',
    message: error.message || 'Unexpected server error.',
  })
})

app.listen(port, () => {
  console.log(`CreatorOps API listening on ${port}`)
})

async function fetchYouTubeChannelSnapshot(lookup) {
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const parsed = parseYouTubeLookup(lookup)
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    key,
  })
  if (parsed.type === 'id') {
    params.set('id', parsed.value)
  } else {
    params.set('forHandle', parsed.value)
  }

  const payload = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${params}`)
  const channel = payload.items?.[0]
  if (!channel) throw httpError(404, 'Matching YouTube channel was not found.')
  return normalizeYouTubeChannel(channel, parsed)
}

async function searchYouTubeCreators(query, maxResults) {
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    q: query,
    maxResults: String(maxResults),
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    key,
  })
  const searchPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
  const channelIds = [...new Set((searchPayload.items || []).map((item) => item.id?.channelId).filter(Boolean))]
  if (!channelIds.length) return []

  const channelParams = new URLSearchParams({
    part: 'snippet,statistics',
    id: channelIds.join(','),
    key,
  })
  const channelPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${channelParams}`)
  return (channelPayload.items || []).map((channel) => normalizeYouTubeChannel(channel))
}

async function searchGoogleProfiles(query, platform, maxResults) {
  const key = requireEnv('GOOGLE_SEARCH_API_KEY')
  const cx = requireEnv('GOOGLE_SEARCH_CX')
  const platforms = platform && platform !== 'all' ? [platform] : ['Instagram', 'TikTok', 'YouTube']
  const results = []

  for (const itemPlatform of platforms) {
    const params = new URLSearchParams({
      key,
      cx,
      q: `${getPlatformSiteQuery(itemPlatform)} ${query}`,
      num: String(maxResults),
      gl: 'kr',
      safe: 'active',
    })
    const payload = await fetchJson(`https://www.googleapis.com/customsearch/v1?${params}`)
    results.push(
      ...(payload.items || [])
        .map((item) => normalizeProfileSearchItem(item, itemPlatform))
        .filter(Boolean),
    )
  }

  return dedupeProfileResults(results).slice(0, maxResults)
}

async function callOpenAIText(prompt) {
  const key = requireEnv('OPENAI_API_KEY')
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  const payload = await fetchJson('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.7,
    }),
  })
  return payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join('\n') || ''
}

function normalizeYouTubeChannel(channel, parsedLookup = {}) {
  const statistics = channel.statistics || {}
  const snippet = channel.snippet || {}
  const subscribers = Number(statistics.subscriberCount || 0)
  const viewCount = Number(statistics.viewCount || 0)
  const videoCount = Number(statistics.videoCount || 0)
  const averageViews = videoCount > 0 ? Math.round(viewCount / videoCount) : 0
  const handle = snippet.customUrl?.startsWith('@')
    ? snippet.customUrl
    : parsedLookup.type === 'handle'
      ? parsedLookup.value
      : `@${channel.id}`

  return {
    id: channel.id,
    channelId: channel.id,
    platform: 'YouTube',
    name: snippet.title || 'YouTube Creator',
    handle,
    profileUrl: handle.startsWith('@')
      ? `https://www.youtube.com/${handle}`
      : `https://www.youtube.com/channel/${channel.id}`,
    avatar: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
    followers: subscribers,
    averageViews,
    totalViews: viewCount,
    videoCount,
    description: snippet.description || '',
    country: snippet.country || 'KR',
    source: 'YouTube Data API',
    verifiedMetrics: true,
  }
}

function normalizeProfileSearchItem(item, platform) {
  const link = item.link || item.formattedUrl || ''
  if (!link) return null

  try {
    const url = new URL(link)
    const hostname = url.hostname.replace(/^www\./, '')
    const segments = url.pathname.split('/').filter(Boolean)

    if (platform === 'Instagram') {
      if (!hostname.includes('instagram.com')) return null
      const handle = segments[0]
      if (!handle || ['p', 'reel', 'tv', 'stories', 'explore', 'accounts'].includes(handle)) return null
      return buildSearchResult(item, platform, `@${handle}`, `https://www.instagram.com/${handle}`)
    }

    if (platform === 'TikTok') {
      if (!hostname.includes('tiktok.com')) return null
      const handle = segments.find((segment) => segment.startsWith('@'))
      if (!handle) return null
      return buildSearchResult(item, platform, handle, `https://www.tiktok.com/${handle}`)
    }

    if (platform === 'YouTube') {
      if (!hostname.includes('youtube.com')) return null
      const handle = segments.find((segment) => segment.startsWith('@')) || segments.find((segment) => segment.startsWith('UC'))
      if (!handle) return null
      const profileUrl = handle.startsWith('@')
        ? `https://www.youtube.com/${handle}`
        : `https://www.youtube.com/channel/${handle}`
      return buildSearchResult(item, platform, handle.startsWith('@') ? handle : `@${handle}`, profileUrl)
    }
  } catch {
    return null
  }

  return null
}

function buildSearchResult(item, platform, handle, profileUrl) {
  return {
    id: `${platform}:${handle}`,
    platform,
    name: stripHtml(item.title || '').replace(/\s*[-|].*$/, '').trim() || handle.replace('@', ''),
    handle,
    profileUrl,
    snippet: stripHtml(item.snippet || ''),
    source: 'Google Programmable Search',
    verifiedMetrics: false,
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw httpError(response.status, payload?.error?.message || payload?.message || 'External API request failed.')
  }
  return payload
}

function getPlatformSiteQuery(platform) {
  if (platform === 'Instagram') return 'site:instagram.com'
  if (platform === 'TikTok') return 'site:tiktok.com/@'
  return 'site:youtube.com'
}

function dedupeProfileResults(results) {
  const seen = new Set()
  return results.filter((item) => {
    const key = `${item.platform}:${item.profileUrl || item.handle}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseYouTubeLookup(value) {
  const channelMatch = value.match(/youtube\.com\/channel\/(UC[\w-]+)/i)
  if (channelMatch) return { type: 'id', value: channelMatch[1] }

  const handleMatch = value.match(/youtube\.com\/@([\w.-]+)/i)
  if (handleMatch) return { type: 'handle', value: `@${handleMatch[1]}` }

  if (/^UC[\w-]+$/.test(value)) return { type: 'id', value }

  return {
    type: 'handle',
    value: value.startsWith('@') ? value : `@${value}`,
  }
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw httpError(501, `${name} is not configured.`)
  return value
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}
