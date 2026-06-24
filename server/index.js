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

app.post('/references/search', async (request, response, next) => {
  try {
    const query = String(request.body?.query || '').trim()
    const country = String(request.body?.country || 'KR').trim()
    const platform = String(request.body?.platform || 'YouTube').trim()
    const sort = String(request.body?.sort || 'views').trim()
    const maxResults = clamp(Number(request.body?.maxResults || 12), 1, 25)
    if (!query) throw httpError(400, 'query is required.')

    const references = await searchContentReferences({ query, country, platform, sort, maxResults })
    response.json({ data: { references } })
  } catch (error) {
    next(error)
  }
})

app.post('/ai/outreach-message', async (request, response, next) => {
  try {
    const { creator, brand, campaign } = request.body || {}
    const prompt = buildOutreachMessagePrompt(creator, brand, campaign)
    const message = await callOpenAIText(prompt)
    response.json({ data: { message } })
  } catch (error) {
    next(error)
  }
})

app.post('/ai/content-guide', async (request, response, next) => {
  try {
    const { brand, campaign, seedingType, channel, references } = request.body || {}
    const prompt = buildContentGuidePrompt({ brand, campaign, seedingType, channel, references })
    const guide = await callOpenAIText(prompt)
    response.json({ data: { guide } })
  } catch (error) {
    next(error)
  }
})

app.post('/public/profile-snapshot', async (request, response, next) => {
  try {
    const url = String(request.body?.url || '').trim()
    if (!url) throw httpError(400, 'url is required.')

    const snapshot = await fetchPublicProfileSnapshot(url)
    response.json({ data: snapshot })
  } catch (error) {
    next(error)
  }
})

app.post('/tracking/refresh', async (request, response, next) => {
  try {
    const posts = Array.isArray(request.body?.posts) ? request.body.posts : []
    const refreshed = await refreshTrackedPosts(posts)
    response.json({ data: { posts: refreshed } })
  } catch (error) {
    next(error)
  }
})

app.get('/oauth/google/auth-url', (request, response, next) => {
  try {
    const clientId = requireEnv('GMAIL_CLIENT_ID')
    const redirectUri = requireEnv('GOOGLE_OAUTH_REDIRECT_URI')
    const state = String(request.query?.state || 'creatorops')
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ]
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes.join(' '),
      state,
    })
    response.json({ data: { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` } })
  } catch (error) {
    next(error)
  }
})

app.get('/oauth/google/callback', (request, response, next) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://creatorops-influencer-suite.onrender.com'
    const params = new URLSearchParams()
    if (request.query?.code) params.set('code', String(request.query.code))
    if (request.query?.state) params.set('state', String(request.query.state))
    if (request.query?.error) params.set('error', String(request.query.error))
    response.redirect(`${frontendUrl.replace(/\/$/, '')}/?google_oauth=1&${params}`)
  } catch (error) {
    next(error)
  }
})

app.post('/oauth/google/token', async (request, response, next) => {
  try {
    const code = String(request.body?.code || '').trim()
    if (!code) throw httpError(400, 'code is required.')

    const payload = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: requireEnv('GMAIL_CLIENT_ID'),
        client_secret: requireEnv('GMAIL_CLIENT_SECRET'),
        redirect_uri: requireEnv('GOOGLE_OAUTH_REDIRECT_URI'),
        grant_type: 'authorization_code',
      }),
    })
    response.json({
      data: {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        expiresIn: payload.expires_in,
        scope: payload.scope,
        tokenType: payload.token_type,
      },
    })
  } catch (error) {
    next(error)
  }
})

app.post('/outreach/gmail/send', async (request, response, next) => {
  try {
    const accessToken = String(request.body?.accessToken || '').trim()
    const to = String(request.body?.to || '').trim()
    const subject = String(request.body?.subject || 'CreatorOps collaboration proposal').trim()
    const message = String(request.body?.message || '').trim()
    if (!accessToken) throw httpError(401, 'Google accessToken is required.')
    if (!to || !message) throw httpError(400, 'to and message are required.')

    const raw = buildGmailRawMessage({ to, subject, message })
    const payload = await fetchJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })
    response.json({ data: { id: payload.id, threadId: payload.threadId } })
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

async function searchContentReferences({ query, country, platform, sort, maxResults }) {
  const normalizedPlatform = normalizeReferencePlatform(platform)
  const targetPlatforms = normalizedPlatform === 'all'
    ? ['YouTube', 'Instagram', 'TikTok']
    : [normalizedPlatform]
  const perPlatformLimit = Math.max(1, Math.ceil(maxResults / targetPlatforms.length))
  const results = []

  for (const targetPlatform of targetPlatforms) {
    if (targetPlatform === 'YouTube') {
      const youtubeResults = await searchYouTubeVideoReferences({
        query,
        country,
        sort,
        maxResults: perPlatformLimit,
      })
      results.push(...youtubeResults)
      continue
    }

    if (!process.env.BRAVE_SEARCH_API_KEY && normalizedPlatform === 'all') {
      continue
    }

    const webResults = await searchWebContentReferences({
      query,
      country,
      platform: targetPlatform,
      maxResults: perPlatformLimit,
    })
    results.push(...webResults)
  }

  return sortContentReferences(dedupeContentReferences(results), sort).slice(0, maxResults)
}

async function searchYouTubeVideoReferences({ query, country, sort, maxResults }) {
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(maxResults),
    order: sort === 'recent' ? 'date' : sort === 'shares' ? 'rating' : 'viewCount',
    safeSearch: 'none',
    videoEmbeddable: 'true',
    key,
  })
  const regionCode = normalizeRegionCode(country)
  if (regionCode) searchParams.set('regionCode', regionCode)
  if (regionCode === 'KR') searchParams.set('relevanceLanguage', 'ko')
  if (regionCode === 'JP') searchParams.set('relevanceLanguage', 'ja')
  if (regionCode === 'US') searchParams.set('relevanceLanguage', 'en')

  const searchPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
  const videoIds = [...new Set((searchPayload.items || []).map((item) => item.id?.videoId).filter(Boolean))]
  if (!videoIds.length) return []

  const videoParams = new URLSearchParams({
    part: 'snippet,statistics',
    id: videoIds.join(','),
    key,
  })
  const videoPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${videoParams}`)
  const videos = videoPayload.items || []
  const channelIds = [...new Set(videos.map((item) => item.snippet?.channelId).filter(Boolean))]
  const channelMap = await fetchYouTubeChannelStatsMap(channelIds)

  return videos.map((item) => normalizeYouTubeReference(item, channelMap, regionCode || country || 'GLOBAL'))
}

async function fetchYouTubeChannelStatsMap(channelIds) {
  if (!channelIds.length) return new Map()
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    id: channelIds.join(','),
    key,
  })
  const payload = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${params}`)
  return new Map((payload.items || []).map((channel) => [channel.id, normalizeYouTubeChannel(channel)]))
}

function normalizeYouTubeReference(item, channelMap, country) {
  const snippet = item.snippet || {}
  const statistics = item.statistics || {}
  const channel = channelMap.get(snippet.channelId) || {}
  const thumbnails = snippet.thumbnails || {}
  const views = Number(statistics.viewCount || 0)
  const likes = Number(statistics.likeCount || 0)
  const comments = Number(statistics.commentCount || 0)
  const followers = Number(channel.followers || 0)
  const virality = followers ? views / followers : 0
  const publishedDate = snippet.publishedAt ? snippet.publishedAt.slice(0, 10) : ''

  return {
    id: `ytref:${item.id}`,
    mediaType: '영상',
    platform: 'YouTube',
    country: country || 'GLOBAL',
    title: snippet.title || 'YouTube reference',
    url: `https://www.youtube.com/watch?v=${item.id}`,
    thumbnailUrl:
      thumbnails.maxres?.url ||
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      '',
    views,
    accountFollowers: followers,
    likes,
    comments,
    shares: null,
    publishedAt: publishedDate || '업로드일 미확인',
    hook: buildReferenceHook(snippet.title, snippet.description),
    analysis: `YouTube 인기 영상 검색 결과입니다. 조회 ${views.toLocaleString('ko-KR')}회, 좋아요 ${likes.toLocaleString('ko-KR')}개, 댓글 ${comments.toLocaleString('ko-KR')}개${virality ? `, 팔로워 대비 ${virality.toFixed(1)}x` : ''}.`,
    applyIdea: '썸네일 구도, 첫 문장, 댓글을 만든 질문 구조를 캠페인 가이드에 차용',
    channelTitle: snippet.channelTitle || channel.name || '',
    source: 'YouTube Data API search.list + videos.list',
    confidence: 96,
  }
}

function buildReferenceHook(title, description) {
  const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim()
  const cleanDescription = String(description || '').replace(/\s+/g, ' ').trim()
  if (cleanTitle) return cleanTitle.length > 72 ? `${cleanTitle.slice(0, 72)}...` : cleanTitle
  return cleanDescription.length > 72 ? `${cleanDescription.slice(0, 72)}...` : cleanDescription
}

async function searchWebContentReferences({ query, country, platform, maxResults }) {
  const key = requireEnv('BRAVE_SEARCH_API_KEY')
  const siteQuery = getReferenceSiteQuery(platform)
  const params = new URLSearchParams({
    q: `${siteQuery} ${query}`.trim(),
    count: String(Math.min(Math.max(maxResults, 1), 20)),
    safesearch: 'moderate',
    freshness: 'pm',
  })
  const regionCode = normalizeRegionCode(country)
  if (regionCode) params.set('country', regionCode)

  const payload = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': key,
    },
  })
  const items = payload.web?.results || []
  const normalized = items
    .map((item) => normalizeWebReferenceSearchItem(item, platform, regionCode || country || 'GLOBAL'))
    .filter(Boolean)

  if (!isPublicSnapshotEnabled()) return normalized

  return Promise.all(
    normalized.map(async (item) => {
      const snapshot = await fetchPublicProfileSnapshot(item.url).catch(() => null)
      if (!snapshot) return item
      const metrics = snapshot.metrics || {}
      return {
        ...item,
        title: item.title || snapshot.title,
        thumbnailUrl: item.thumbnailUrl || snapshot.image || '',
        views: metrics.views ?? item.views,
        accountFollowers: metrics.followers ?? item.accountFollowers,
        likes: metrics.likes ?? item.likes,
        comments: metrics.comments ?? item.comments,
        shares: metrics.shares ?? item.shares,
        analysis: snapshot.description || item.analysis,
        source: `${item.source} + ${snapshot.source}`,
        confidence: Math.max(item.confidence, snapshot.confidence || 0),
      }
    }),
  )
}

function normalizeWebReferenceSearchItem(item, platform, country) {
  const url = item.url || item.link || ''
  if (!url) return null
  const inferredPlatform = platform === 'all' ? inferReferencePlatform(url) : platform
  if (!['Instagram', 'TikTok'].includes(inferredPlatform)) return null

  const title = stripHtml(item.title || '')
  const description = stripHtml(item.description || item.snippet || '')
  return {
    id: `webref:${inferredPlatform}:${url}`,
    mediaType: inferReferenceMediaType(url, inferredPlatform),
    platform: inferredPlatform,
    country: country || 'GLOBAL',
    title: title || `${inferredPlatform} reference`,
    url,
    thumbnailUrl: item.thumbnail?.src || item.profile?.img || '',
    views: null,
    accountFollowers: null,
    likes: null,
    comments: null,
    shares: null,
    publishedAt: 'public search result',
    hook: buildReferenceHook(title, description),
    analysis: description || 'Brave Search public web result. Performance metrics need platform API, creator authorization, or public snapshot verification.',
    applyIdea: 'Use the hook, thumbnail structure, caption angle, and comment-driving question as a production reference.',
    source: 'Brave Search API',
    confidence: 72,
  }
}

function normalizeReferencePlatform(value) {
  const platform = String(value || '').trim()
  if (!platform || platform === '전체' || platform === 'all') return 'all'
  if (/instagram/i.test(platform)) return 'Instagram'
  if (/tiktok/i.test(platform)) return 'TikTok'
  if (/youtube/i.test(platform)) return 'YouTube'
  return platform
}

function getReferenceSiteQuery(platform) {
  if (platform === 'Instagram') return '(site:instagram.com/reel/ OR site:instagram.com/p/)'
  if (platform === 'TikTok') return 'site:tiktok.com/@ inurl:/video/'
  return '(site:instagram.com/reel/ OR site:instagram.com/p/ OR site:tiktok.com/@ inurl:/video/)'
}

function inferReferencePlatform(value) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
    if (hostname.includes('instagram.com')) return 'Instagram'
    if (hostname.includes('tiktok.com')) return 'TikTok'
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'YouTube'
  } catch {
    return 'Other'
  }
  return 'Other'
}

function inferReferenceMediaType(value, platform) {
  if (platform === 'Instagram' && /\/p\//i.test(value)) return '이미지'
  return '영상'
}

function dedupeContentReferences(results) {
  const seen = new Set()
  return results.filter((item) => {
    const key = String(item.url || item.id || '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortContentReferences(results, sort) {
  return [...results].sort((a, b) => {
    if (sort === 'recent') return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))
    if (sort === 'virality') {
      const aRatio = Number(a.views || 0) / Math.max(Number(a.accountFollowers || 0), 1)
      const bRatio = Number(b.views || 0) / Math.max(Number(b.accountFollowers || 0), 1)
      return bRatio - aRatio
    }
    if (sort === 'shares') return Number(b.shares || 0) - Number(a.shares || 0)
    return Number(b.views || 0) - Number(a.views || 0)
  })
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

  const deduped = dedupeProfileResults(results).slice(0, maxResults)
  if (!isPublicSnapshotEnabled()) return deduped

  const enriched = await Promise.all(
    deduped.map(async (profile) => {
      const snapshot = await fetchPublicProfileSnapshot(profile.profileUrl).catch((error) => ({
        status: 'snapshot_failed',
        message: error.message,
      }))
      return mergeProfileSnapshot(profile, snapshot)
    }),
  )
  return enriched
}

async function refreshTrackedPosts(posts) {
  const safePosts = posts.slice(0, 50)
  return Promise.all(
    safePosts.map(async (post) => {
      const platform = String(post.platform || '').toLowerCase()
      if (platform.includes('youtube')) {
        return fetchYouTubeVideoMetrics(post)
      }

      if (isPublicSnapshotEnabled() && (platform.includes('instagram') || platform.includes('tiktok'))) {
        return fetchPublicContentMetrics(post)
      }

      return {
        id: post.id,
        platform: post.platform,
        status: 'manual_required',
        message: `${post.platform || 'This platform'} metrics require creator authorization or manual verification.`,
      }
    }),
  )
}

async function fetchYouTubeVideoMetrics(post) {
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const videoId = extractYouTubeVideoId(post.url)
  if (!videoId) {
    return {
      id: post.id,
      platform: post.platform || 'YouTube',
      status: 'manual_required',
      message: 'YouTube video ID could not be parsed from the upload URL.',
    }
  }

  const params = new URLSearchParams({
    part: 'snippet,statistics',
    id: videoId,
    key,
  })
  const payload = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  const item = payload.items?.[0]
  if (!item) {
    return {
      id: post.id,
      platform: 'YouTube',
      status: 'manual_required',
      message: 'YouTube video was not found or is not publicly accessible.',
    }
  }

  const statistics = item.statistics || {}
  return {
    id: post.id,
    platform: 'YouTube',
    status: 'refreshed',
    videoId,
    title: item.snippet?.title || '',
    views: Number(statistics.viewCount || 0),
    likes: Number(statistics.likeCount || 0),
    comments: Number(statistics.commentCount || 0),
    shares: null,
    saves: null,
    source: 'YouTube Data API videos.list',
    checkedAt: new Date().toISOString(),
  }
}

async function fetchPublicContentMetrics(post) {
  const snapshot = await fetchPublicProfileSnapshot(post.url)
  const metrics = snapshot.metrics || {}

  if (!metrics.views && !metrics.likes && !metrics.comments) {
    return {
      id: post.id,
      platform: post.platform,
      status: 'manual_required',
      message: 'Public page snapshot did not expose reliable performance metrics.',
      source: snapshot.source,
    }
  }

  return {
    id: post.id,
    platform: post.platform,
    status: 'refreshed',
    title: snapshot.title || '',
    views: metrics.views ?? null,
    likes: metrics.likes ?? null,
    comments: metrics.comments ?? null,
    shares: metrics.shares ?? null,
    saves: metrics.saves ?? null,
    source: snapshot.source,
    checkedAt: new Date().toISOString(),
  }
}

async function fetchPublicProfileSnapshot(url) {
  const safeUrl = validatePublicSnapshotUrl(url)
  const youtubeVideoId = extractYouTubeVideoId(safeUrl)
  if (youtubeVideoId && process.env.YOUTUBE_DATA_API_KEY) {
    return fetchYouTubeReferenceSnapshot(safeUrl, youtubeVideoId)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getPublicSnapshotTimeoutMs())

  try {
    const response = await fetch(safeUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'User-Agent': 'CreatorOpsPublicSnapshot/1.0 (+https://creatorops-influencer-suite.onrender.com)',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()
    if (!response.ok) {
      throw httpError(response.status, `Public snapshot request failed with ${response.status}.`)
    }

    const snapshot = contentType.includes('json')
      ? normalizeJsonSnapshot(JSON.parse(text), safeUrl)
      : normalizeHtmlSnapshot(text, safeUrl)

    return {
      ...snapshot,
      status: 'snapshot_ready',
      url: safeUrl,
      fetchedAt: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchYouTubeReferenceSnapshot(url, videoId) {
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    id: videoId,
    key,
  })
  const payload = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  const item = payload.items?.[0]
  if (!item) {
    throw httpError(404, 'YouTube video was not found or is not publicly accessible.')
  }

  const snippet = item.snippet || {}
  const statistics = item.statistics || {}
  const thumbnails = snippet.thumbnails || {}
  const channelMap = await fetchYouTubeChannelStatsMap(snippet.channelId ? [snippet.channelId] : [])
  const channel = channelMap.get(snippet.channelId) || {}
  const image =
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    ''

  return {
    title: snippet.title || '',
    description: snippet.description || '',
    image,
    handle: snippet.channelTitle ? `@${snippet.channelTitle}` : inferHandleFromUrl(url),
    platform: 'YouTube',
    mediaType: '영상',
    publishedAt: snippet.publishedAt ? snippet.publishedAt.slice(0, 10) : '',
    metrics: {
      followers: Number(channel.followers || 0) || null,
      views: Number(statistics.viewCount || 0),
      likes: Number(statistics.likeCount || 0),
      comments: Number(statistics.commentCount || 0),
      shares: null,
      saves: null,
    },
    source: 'YouTube Data API videos.list',
    confidence: 96,
    status: 'snapshot_ready',
    url,
    fetchedAt: new Date().toISOString(),
  }
}

function normalizeHtmlSnapshot(html, url) {
  const plain = stripHtml(html)
  const title =
    pickMetaContent(html, 'og:title') ||
    pickMetaContent(html, 'twitter:title') ||
    pickTitle(html) ||
    ''
  const description =
    pickMetaContent(html, 'og:description') ||
    pickMetaContent(html, 'description') ||
    pickMetaContent(html, 'twitter:description') ||
    ''
  const image = pickMetaContent(html, 'og:image') || pickMetaContent(html, 'twitter:image') || ''
  const combined = `${title} ${description} ${plain.slice(0, 8000)}`

  return {
    title: decodeHtmlEntities(title),
    description: decodeHtmlEntities(description),
    image,
    handle: inferHandleFromUrl(url),
    metrics: extractPublicMetrics(combined),
    source: 'Public page snapshot',
    confidence: description ? 64 : 42,
  }
}

function normalizeJsonSnapshot(payload, url) {
  const text = JSON.stringify(payload || {})
  return {
    title: payload?.title || payload?.author_name || '',
    description: payload?.description || '',
    image: payload?.thumbnail_url || '',
    handle: payload?.author_name ? `@${String(payload.author_name).replace(/^@/, '')}` : inferHandleFromUrl(url),
    metrics: extractPublicMetrics(text),
    source: 'Public oEmbed/JSON snapshot',
    confidence: 68,
  }
}

function mergeProfileSnapshot(profile, snapshot) {
  if (!snapshot || snapshot.status === 'snapshot_failed') {
    return {
      ...profile,
      publicSnapshotStatus: snapshot?.status || 'snapshot_failed',
      publicSnapshotMessage: snapshot?.message || 'Public snapshot failed.',
    }
  }

  return {
    ...profile,
    name: profile.name || snapshot.title || profile.handle,
    avatar: profile.avatar || snapshot.image || '',
    followers: snapshot.metrics?.followers || profile.followers,
    averageViews: snapshot.metrics?.views || profile.averageViews,
    description: profile.description || snapshot.description || profile.snippet,
    snippet: profile.snippet || snapshot.description,
    metricSources: [
      ...(profile.metricSources || []),
      {
        metric: 'public_snapshot',
        source: snapshot.source,
        confidence: snapshot.confidence,
        freshness: 'on demand',
      },
    ],
    publicSnapshotStatus: snapshot.status,
    publicSnapshotFetchedAt: snapshot.fetchedAt,
    verifiedMetrics: Boolean(profile.verifiedMetrics),
  }
}

function buildOutreachMessagePrompt(creator = {}, brand = {}, campaign = {}) {
  return [
    'Write a warm, sincere influencer collaboration proposal message in Korean.',
    'The goal is to receive a reply. Make it sound like a real brand manager wrote a polite first DM or email, not a stiff sales script.',
    'Include:',
    '- one specific compliment that suggests the creator content was actually reviewed',
    '- why the brand/product fits the creator persona',
    '- the core campaign proposal, reward/product support/schedule when available',
    '- a friendly question asking whether they are interested and what conditions they prefer',
    '- a short note about ad/sponsorship disclosure and guide compliance',
    'Avoid exaggerated performance guarantees, fake review requests, coercive wording, and overly long brand introductions.',
    `Creator: ${JSON.stringify(creator || {})}`,
    `Brand: ${JSON.stringify(brand || {})}`,
    `Campaign: ${JSON.stringify(campaign || {})}`,
  ].join('\\n')
}

function buildContentGuidePrompt({ brand = {}, campaign = {}, seedingType = '', channel = '', references = [] } = {}) {
  return [
    'Write an influencer content guide in Korean for direct delivery to creators.',
    'Use a document structure that a brand manager can share immediately, while making the shooting direction concrete and creator-friendly.',
    'Required sections:',
    '1. Campaign goal and one-message',
    '2. At least five content hook points',
    '3. Channel-specific shooting scenarios and shot/cut structure',
    '4. Required exposure elements and optional elements',
    '5. Example captions, subtitles, and talking points',
    '6. Prohibited expressions and ad/sponsorship disclosure guidance',
    '7. Deliverable checklist and post-upload performance tracking items',
    'Adjust reward, CTA, and conversion tracking guidance based on whether the campaign is unpaid seeding, paid seeding, group-buying, or seller recruitment.',
    `Brand: ${JSON.stringify(brand || {})}`,
    `Campaign: ${JSON.stringify(campaign || {})}`,
    `Seeding type: ${seedingType || ''}`,
    `Channel: ${channel || ''}`,
    `References: ${JSON.stringify(references || [])}`,
  ].join('\\n')
}

function buildGmailRawMessage({ to, subject, message }) {
  const headers = [
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
  ]
  const raw = `${headers.join('\r\n')}\r\n\r\n${message}`
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function encodeMimeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value || ''), 'utf8').toString('base64')}?=`
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

function extractYouTubeVideoId(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    const url = new URL(raw)
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.split('/').filter(Boolean)[0] || ''
    }
    if (url.hostname.includes('youtube.com')) {
      const watchId = url.searchParams.get('v')
      if (watchId) return watchId
      const segments = url.pathname.split('/').filter(Boolean)
      const shortIndex = segments.findIndex((segment) => ['shorts', 'embed', 'live'].includes(segment))
      if (shortIndex >= 0) return segments[shortIndex + 1] || ''
    }
  } catch {
    const match = raw.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{8,})/)
    if (match) return match[1]
  }

  return /^[\w-]{8,}$/.test(raw) ? raw : ''
}

function validatePublicSnapshotUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw httpError(400, 'A valid public URL is required.')
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw httpError(400, 'Only http and https URLs are supported.')
  }

  const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
  const allowedHosts = [
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'youtu.be',
    'threads.net',
  ]
  if (!allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    throw httpError(400, `Unsupported public snapshot host: ${hostname}`)
  }

  return url.toString()
}

function isPublicSnapshotEnabled() {
  return String(process.env.PUBLIC_SNAPSHOT_ENABLED || 'true').toLowerCase() !== 'false'
}

function getPublicSnapshotTimeoutMs() {
  return clamp(Number(process.env.PUBLIC_SNAPSHOT_TIMEOUT_MS || 8000), 1500, 20000)
}

function normalizeRegionCode(value) {
  const clean = String(value || '').trim().toUpperCase()
  if (!clean || clean === '전체' || clean === 'ALL' || clean === 'GLOBAL') return ''
  return /^[A-Z]{2}$/.test(clean) ? clean : ''
}

function pickMetaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return ''
}

function pickTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1] || ''
}

function inferHandleFromUrl(value) {
  try {
    const url = new URL(value)
    const segments = url.pathname.split('/').filter(Boolean)
    const handle = segments.find((segment) => segment.startsWith('@')) || segments[0] || ''
    return handle ? `@${handle.replace(/^@/, '')}` : ''
  } catch {
    return ''
  }
}

function extractPublicMetrics(text) {
  const normalized = decodeHtmlEntities(String(text || '')).replace(/\s+/g, ' ')
  return {
    followers: firstMetric(normalized, [
      /([\d.,]+)\s*([KMB])?\s*(?:followers|follower)/i,
      /팔로워\s*([\d.,]+)\s*([만천억KMB])?/i,
      /([\d.,]+)\s*([만천억KMB])?\s*팔로워/i,
    ]),
    views: firstMetric(normalized, [
      /([\d.,]+)\s*([KMB])?\s*(?:views|view)/i,
      /조회수\s*([\d.,]+)\s*([만천억KMB])?/i,
      /([\d.,]+)\s*([만천억KMB])?\s*회\s*조회/i,
    ]),
    likes: firstMetric(normalized, [
      /([\d.,]+)\s*([KMB])?\s*(?:likes|like)/i,
      /좋아요\s*([\d.,]+)\s*([만천억KMB])?/i,
      /([\d.,]+)\s*([만천억KMB])?\s*개?\s*좋아요/i,
    ]),
    comments: firstMetric(normalized, [
      /([\d.,]+)\s*([KMB])?\s*(?:comments|comment)/i,
      /댓글\s*([\d.,]+)\s*([만천억KMB])?/i,
      /([\d.,]+)\s*([만천억KMB])?\s*개?\s*댓글/i,
    ]),
    shares: firstMetric(normalized, [
      /([\d.,]+)\s*([KMB])?\s*(?:shares|share)/i,
      /공유\s*([\d.,]+)\s*([만천억KMB])?/i,
    ]),
    saves: firstMetric(normalized, [
      /([\d.,]+)\s*([KMB])?\s*(?:saves|save)/i,
      /저장\s*([\d.,]+)\s*([만천억KMB])?/i,
    ]),
  }
}

function firstMetric(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const value = parseMetricNumber(match?.[1], match?.[2])
    if (value) return value
  }
  return null
}

function parseMetricNumber(rawNumber, rawUnit = '') {
  if (!rawNumber) return null
  const base = Number(String(rawNumber).replace(/,/g, ''))
  if (!Number.isFinite(base)) return null
  const unit = String(rawUnit || '').toLowerCase()
  const multiplier =
    unit === 'k' || unit === '천'
      ? 1_000
      : unit === 'm' || unit === '만'
        ? unit === '만'
          ? 10_000
          : 1_000_000
        : unit === 'b' || unit === '억'
          ? unit === '억'
            ? 100_000_000
            : 1_000_000_000
          : 1
  return Math.round(base * multiplier)
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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
