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
    const country = String(request.body?.country || 'KR').trim()
    const maxResults = clamp(Number(request.body?.maxResults || 24), 1, 100)
    if (!query) throw httpError(400, 'query is required.')

    const creators = await searchYouTubeCreators(query, maxResults, country)
    response.json({ data: creators })
  } catch (error) {
    next(error)
  }
})

app.post('/discovery/google-profiles/search', async (request, response, next) => {
  try {
    const query = String(request.body?.query || '').trim()
    const platform = normalizeProfileDiscoveryPlatform(request.body?.platform || 'all')
    const country = String(request.body?.country || 'KR').trim()
    const maxResults = clamp(Number(request.body?.maxResults || 24), 1, 100)
    if (!query) throw httpError(400, 'query is required.')

    const profiles = await searchGoogleProfiles(query, platform, maxResults, country)
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
    const maxResults = clamp(Number(request.body?.maxResults || 36), 1, 100)
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

async function searchYouTubeCreators(query, maxResults, country = 'KR') {
  const results = []
  const seen = new Set()

  for (const searchQuery of buildCreatorDiscoveryQueries(query)) {
    const creators = await fetchYouTubeCreatorsForQuery(searchQuery, maxResults, country)
    for (const creator of creators) {
      const key = creator.channelId || creator.id || creator.profileUrl
      if (!key || seen.has(key)) continue
      seen.add(key)
      results.push(creator)
      if (results.length >= maxResults) return results
    }
  }

  return results
}

async function fetchYouTubeCreatorsForQuery(query, maxResults, country = 'KR') {
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const regionCode = normalizeRegionCode(country) || 'KR'
  const channelIds = []
  let pageToken = ''

  while (channelIds.length < maxResults) {
    const searchParams = new URLSearchParams({
      part: 'snippet',
      type: 'channel',
      q: query,
      maxResults: String(Math.min(50, maxResults - channelIds.length)),
      regionCode,
      relevanceLanguage: getDiscoveryLanguage(regionCode),
      key,
    })
    if (pageToken) searchParams.set('pageToken', pageToken)
    const searchPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
    channelIds.push(...(searchPayload.items || []).map((item) => item.id?.channelId).filter(Boolean))
    pageToken = searchPayload.nextPageToken || ''
    if (!pageToken) break
  }

  const uniqueChannelIds = [...new Set(channelIds)].slice(0, maxResults)
  if (!uniqueChannelIds.length) return []

  const channels = []
  for (const idChunk of chunkArray(uniqueChannelIds, 50)) {
    const channelParams = new URLSearchParams({
      part: 'snippet,statistics',
      id: idChunk.join(','),
      key,
    })
    const channelPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${channelParams}`)
    channels.push(...(channelPayload.items || []))
  }

  return channels.map((channel) => normalizeYouTubeChannel(channel, {}, regionCode))
}

function buildCreatorDiscoveryQueries(query) {
  const cleanQuery = String(query || '').replace(/\s+/g, ' ').trim()
  const queries = [cleanQuery]
  const lower = cleanQuery.toLowerCase()

  if (/화장품|뷰티|메이크업|스킨케어|코스메틱|올리브영|beauty|makeup|skincare|cosmetic/.test(lower)) {
    queries.push('Korean beauty review', 'beauty review Korea', 'K beauty creator')
  }
  if (/반려|강아지|고양이|펫|켄넬|애견|pet|dog|cat|kennel/.test(lower)) {
    queries.push('Korean pet channel', 'dog product review Korea', 'pet creator Korea')
  }
  if (/푸드|음식|먹방|간식|맛집|food|snack/.test(lower)) {
    queries.push('Korean food review', 'food creator Korea')
  }
  if (/패션|룩북|의류|fashion|lookbook/.test(lower)) {
    queries.push('Korean fashion creator', 'fashion review Korea')
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 4)
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
  const regionCode = normalizeRegionCode(country)
  const videoIds = []

  for (const searchQuery of buildYouTubeReferenceQueries(query)) {
    const searchParams = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      q: searchQuery,
      maxResults: String(Math.min(25, maxResults - videoIds.length)),
      order: sort === 'recent' ? 'date' : sort === 'shares' ? 'rating' : 'viewCount',
      safeSearch: 'none',
      key,
    })
    if (regionCode) searchParams.set('regionCode', regionCode)
    if (regionCode === 'KR') searchParams.set('relevanceLanguage', 'ko')
    if (regionCode === 'JP') searchParams.set('relevanceLanguage', 'ja')
    if (regionCode === 'US') searchParams.set('relevanceLanguage', 'en')

    let searchPayload
    try {
      searchPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
    } catch (error) {
      if (error.status !== 400 || !String(error.message || '').includes('invalid filter')) throw error
      searchParams.delete('regionCode')
      searchParams.delete('relevanceLanguage')
      searchParams.delete('safeSearch')
      searchParams.delete('order')
      searchPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
    }
    videoIds.push(...(searchPayload.items || []).map((item) => item.id?.videoId).filter(Boolean))
    if (videoIds.length >= maxResults) break
  }

  const uniqueVideoIds = [...new Set(videoIds)].slice(0, maxResults)
  if (!uniqueVideoIds.length) return []

  const videos = []
  for (const idChunk of chunkArray(uniqueVideoIds, 50)) {
    const videoParams = new URLSearchParams({
      part: 'snippet,statistics',
      id: idChunk.join(','),
      key,
    })
    const videoPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${videoParams}`)
    videos.push(...(videoPayload.items || []))
  }
  const channelIds = [...new Set(videos.map((item) => item.snippet?.channelId).filter(Boolean))]
  const channelMap = await fetchYouTubeChannelStatsMap(channelIds)

  return videos.map((item) => normalizeYouTubeReference(item, channelMap, regionCode || country || 'GLOBAL'))
}

function buildYouTubeReferenceQueries(query) {
  const cleanQuery = String(query || '').replace(/\s+/g, ' ').trim()
  return [
    cleanQuery,
    `${cleanQuery} review`,
    `${cleanQuery} viral`,
    `${cleanQuery} shorts`,
    `${cleanQuery} comparison`,
  ].filter(Boolean)
}

async function fetchYouTubeChannelStatsMap(channelIds) {
  if (!channelIds.length) return new Map()
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const channels = []
  for (const idChunk of chunkArray(channelIds, 50)) {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: idChunk.join(','),
      key,
    })
    const payload = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${params}`)
    channels.push(...(payload.items || []))
  }
  return new Map(channels.map((channel) => [channel.id, normalizeYouTubeChannel(channel)]))
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
  const referenceUrl = `https://www.youtube.com/watch?v=${item.id}`
  const detectedCountry = channel.country || detectProfileCountry({
    profileUrl: referenceUrl,
    title: snippet.title,
    snippet: snippet.description,
    handle: snippet.channelTitle || channel.name,
  })

  return {
    id: `ytref:${item.id}`,
    mediaType: '영상',
    platform: 'YouTube',
    country: detectedCountry,
    searchCountry: country || '',
    countryConfidence: channel.country ? 'official' : detectedCountry ? 'detected' : 'unverified',
    title: snippet.title || 'YouTube reference',
    url: referenceUrl,
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
  const regionCode = normalizeRegionCode(country)
  const items = []

  for (const referenceQuery of buildReferenceSearchQueries(siteQuery, query, platform)) {
    for (let page = 0; page < Math.ceil(maxResults / 20) && items.length < maxResults * 3; page += 1) {
      const params = new URLSearchParams({
        q: referenceQuery,
        count: '20',
        safesearch: 'moderate',
        offset: String(page * 20),
      })
      if (regionCode) params.set('country', regionCode)

      const payload = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': key,
        },
      })
      const pageItems = payload.web?.results || []
      items.push(...pageItems)
      if (pageItems.length < 20) break
    }
    if (items.length >= maxResults * 3) break
  }

  const normalized = items
    .map((item) => normalizeWebReferenceSearchItem(item, platform, regionCode || country || 'GLOBAL'))
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, maxResults)

  if (!isPublicSnapshotEnabled()) return normalized

  const maxSnapshotEnrichment = maxResults > 40 ? 40 : maxResults
  const enrichedHead = await Promise.all(normalized.slice(0, maxSnapshotEnrichment).map(async (item) => {
    const snapshot = await fetchPublicProfileSnapshot(item.url).catch(() => null)
    if (!snapshot) {
      return item
    }

    const metrics = snapshot.metrics || {}
    return {
      ...item,
      title: item.title || snapshot.title,
      thumbnailUrl: selectReferenceThumbnail(item.thumbnailUrl, snapshot.image),
      views: metrics.views ?? item.views,
      accountFollowers: metrics.followers ?? item.accountFollowers,
      likes: metrics.likes ?? item.likes,
      comments: metrics.comments ?? item.comments,
      shares: metrics.shares ?? item.shares,
      analysis: snapshot.description || item.analysis,
      source: `${item.source} + ${snapshot.source}`,
      confidence: Math.max(item.confidence, snapshot.confidence || 0),
    }
  }))

  return [...enrichedHead, ...normalized.slice(maxSnapshotEnrichment)]
}

function buildReferenceSearchQueries(siteQuery, query, platform) {
  const cleanQuery = String(query || '').replace(/\s+/g, ' ').trim()
  const platformBoost =
    platform === 'Instagram'
      ? '-inurl:/explore/ -inurl:/accounts/'
      : platform === 'TikTok'
        ? '-inurl:/music/ -inurl:/tag/'
        : ''
  return [
    `${siteQuery} ${cleanQuery} ${platformBoost}`.trim(),
    `${siteQuery} "${cleanQuery}" ${platformBoost}`.trim(),
    `${siteQuery} ${cleanQuery} viral popular ${platformBoost}`.trim(),
  ]
}

function normalizeWebReferenceSearchItem(item, platform, country) {
  const url = item.url || item.link || ''
  if (!url) return null
  const inferredPlatform = platform === 'all' ? inferReferencePlatform(url) : platform
  if (!['Instagram', 'TikTok'].includes(inferredPlatform)) return null
  if (!isSupportedReferenceContentUrl(url, inferredPlatform)) return null

  const title = cleanReferenceText(item.title || '')
  const description = cleanReferenceText(item.description || item.snippet || '')
  if (isLowValueReferenceResult({ title, description, url, platform: inferredPlatform })) return null

  const analysis = isLowValueReferenceText(description)
    ? '공개 검색 결과에서 콘텐츠 URL을 확인했습니다. 세부 성과 지표는 플랫폼 API 또는 수동 확인이 필요합니다.'
    : description
  const detectedCountry = detectProfileCountry({ profileUrl: url, title, snippet: description })

  return {
    id: `webref:${inferredPlatform}:${url}`,
    mediaType: inferReferenceMediaType(url, inferredPlatform),
    platform: inferredPlatform,
    country: detectedCountry,
    searchCountry: country || '',
    countryConfidence: detectedCountry ? 'detected' : 'unverified',
    title: title || `${inferredPlatform} reference`,
    url,
    thumbnailUrl: selectReferenceThumbnail(item.thumbnail?.src, item.profile?.img),
    views: null,
    accountFollowers: null,
    likes: null,
    comments: null,
    shares: null,
    publishedAt: 'public search result',
    hook: buildReferenceHook(title, description),
    analysis: analysis || '공개 검색 결과에서 콘텐츠 URL을 확인했습니다. 세부 성과 지표는 플랫폼 API 또는 수동 확인이 필요합니다.',
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
  if (platform === 'Instagram') return '(site:instagram.com/reel OR site:instagram.com/p)'
  if (platform === 'TikTok') return 'site:tiktok.com'
  return '((site:instagram.com/reel OR site:instagram.com/p) OR site:tiktok.com)'
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

function isSupportedReferenceContentUrl(value, platform) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
    const segments = url.pathname.split('/').filter(Boolean)
    if (platform === 'TikTok') {
      return hostname.includes('tiktok.com') &&
        segments[0]?.startsWith('@') &&
        segments[1] === 'video' &&
        /^[0-9]{8,}$/.test(segments[2] || '')
    }
    if (platform === 'Instagram') {
      return hostname.includes('instagram.com') &&
        ['reel', 'p'].includes(segments[0]) &&
        /^[A-Za-z0-9_-]{5,}$/.test(segments[1] || '')
    }
  } catch {
    return false
  }
  return false
}

function isLowValueReferenceResult({ title, description, url, platform }) {
  const normalizedTitle = cleanReferenceText(title).toLowerCase()
  const normalizedDescription = cleanReferenceText(description).toLowerCase()

  if (/(^|[\s(])@?reel\b/i.test(normalizedTitle)) return true
  if (/reel raffle/i.test(normalizedTitle)) return true
  if (/(instagram photos and videos|create an account or log in to instagram)/i.test(normalizedTitle) && !normalizedDescription) return true
  if (isPlatformLogoThumbnail(url)) return true

  if (platform === 'Instagram' && normalizedTitle === 'instagram') return true
  if (platform === 'TikTok' && normalizedTitle === 'tiktok') return true
  return false
}

function isLowValueReferenceText(value) {
  return /we cannot provide a description|create an account or log in|instagram photos and videos/i.test(String(value || ''))
}

function isPlatformLogoThumbnail(value) {
  return /(instagram\.com\/static|static\.cdninstagram\.com|tiktokcdn.*logo|tiktok.*logo|favicon|apple-touch-icon|rs:fit:32:32)/i.test(String(value || ''))
}

function selectReferenceThumbnail(...candidates) {
  return candidates.find((candidate) => {
    const value = String(candidate || '')
    if (!value) return false
    return !isPlatformLogoThumbnail(value)
  }) || ''
}

function cleanReferenceText(value) {
  return decodeHtmlEntities(stripHtml(value)).replace(/\s+/g, ' ').trim()
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

async function searchGoogleProfiles(query, platform, maxResults, country = 'KR') {
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return searchBraveProfiles(query, platform, maxResults, country)
  }

  return searchGoogleCseProfiles(query, platform, maxResults, country)
}

async function searchBraveProfiles(query, platform, maxResults, country = 'KR') {
  const key = requireEnv('BRAVE_SEARCH_API_KEY')
  const platforms = getProfileDiscoveryPlatforms(platform)
  const regionCode = normalizeRegionCode(country) || 'KR'
  const platformTarget = Math.max(1, Math.ceil(maxResults / platforms.length))
  const perPlatformCount = Math.max(10, Math.ceil(maxResults * 2))
  const results = []

  for (const itemPlatform of platforms) {
    const platformResults = []
    for (const profileQuery of buildStrictProfileSearchQueries(itemPlatform, query)) {
      for (let page = 0; page < Math.ceil(perPlatformCount / 20) && platformResults.length < platformTarget * 3; page += 1) {
        const params = new URLSearchParams({
          q: profileQuery,
          count: '20',
          safesearch: 'moderate',
          country: regionCode,
          offset: String(page * 20),
        })
        const payload = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params}`, {
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': key,
          },
        }).catch((error) => {
          if ([400, 422].includes(error.status)) return { web: { results: [] } }
          throw error
        })
        const pageItems = payload.web?.results || []
        platformResults.push(
          ...dedupeProfileResults(
            pageItems
              .map((item) => normalizeProfileSearchItem(item, itemPlatform, 'Brave Search API', regionCode))
              .filter(Boolean),
          ),
        )
        if (pageItems.length < 20) break
      }
      if (dedupeProfileResults(platformResults).length >= platformTarget * 3) break
    }
    results.push(...dedupeProfileResults(platformResults).slice(0, platformTarget * 3))
  }

  const enriched = await enrichProfileResults(dedupeProfileResults(results).slice(0, maxResults * 3))
  return filterProfileDiscoveryResults(enriched, query).slice(0, maxResults)
}

// Kept only to avoid changing old deployment snapshots that may still reference the legacy query builder.
// eslint-disable-next-line no-unused-vars
function buildBraveProfileSearchQueries(platform, query) {
  const cleanQuery = String(query || '').replace(/\s+/g, ' ').trim()
  const queries = []
  const lower = cleanQuery.toLowerCase()

  if (platform === 'Instagram') {
    queries.push(`site:instagram.com "${cleanQuery}" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    if (/화장품|뷰티|메이크업|스킨케어|beauty|makeup|skincare/.test(lower)) {
      queries.push('site:instagram.com "뷰티 리뷰" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/')
    }
    if (/반려|강아지|고양이|펫|켄넬|pet|dog|cat/.test(lower)) {
      queries.push('site:instagram.com "펫스타그램" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/')
    }
  } else if (platform === 'TikTok') {
    queries.push(`site:tiktok.com/@ ${cleanQuery}`)
    queries.push(`site:tiktok.com ${cleanQuery}`)
    if (/화장품|뷰티|메이크업|스킨케어|beauty|makeup|skincare/.test(lower)) {
      queries.push('site:tiktok.com/@ 뷰티 리뷰')
    }
    if (/반려|강아지|고양이|펫|켄넬|pet|dog|cat/.test(lower)) {
      queries.push('site:tiktok.com/@ 강아지 펫')
    }
  } else {
    queries.push(`${getPlatformSiteQuery(platform)} ${cleanQuery}`.trim())
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 3)
}

function buildStrictProfileSearchQueries(platform, query) {
  const cleanQuery = String(query || '').replace(/\s+/g, ' ').trim()
  const queries = []
  const lower = cleanQuery.toLowerCase()
  const categoryTerms = inferDiscoveryCategoryTerms(lower)

  if (platform === 'Instagram') {
    queries.push(`site:instagram.com "${cleanQuery}" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    queries.push(`site:instagram.com ${cleanQuery} influencer creator -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    if (/beauty|makeup|skincare|cosmetic|cosmetics/.test(lower)) {
      queries.push('site:instagram.com "beauty review" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/')
    }
    if (/pet|dog|cat|kennel|carrier|crate/.test(lower)) {
      queries.push('site:instagram.com "pet creator" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/')
    }
    categoryTerms.forEach((term) => {
      queries.push(`site:instagram.com "${term}" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    })
  } else if (platform === 'TikTok') {
    queries.push(`site:tiktok.com/@ "${cleanQuery}" -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
    queries.push(`site:tiktok.com/@ ${cleanQuery} -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
    queries.push(`site:tiktok.com/@ ${cleanQuery} creator influencer -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
    queries.push(`site:tiktok.com/@ ${cleanQuery}`)
    queries.push(`site:tiktok.com ${cleanQuery}`)
    if (/beauty|makeup|skincare|cosmetic|cosmetics/.test(lower)) {
      queries.push('site:tiktok.com/@ "beauty review" -inurl:/video/ -inurl:/music/')
      queries.push('site:tiktok.com "beauty review"')
    }
    if (/pet|dog|cat|kennel|carrier|crate/.test(lower)) {
      queries.push('site:tiktok.com/@ "pet creator" -inurl:/video/ -inurl:/music/')
      queries.push('site:tiktok.com "pet creator"')
    }
    categoryTerms.forEach((term) => {
      queries.push(`site:tiktok.com/@ "${term}" -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
    })
  } else {
    queries.push(`${getPlatformSiteQuery(platform)} ${cleanQuery}`.trim())
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 12)
}

function inferDiscoveryCategoryTerms(lowerQuery) {
  const terms = []
  if (/pet|dog|cat|kennel|carrier|crate|강아지|반려견|반려동물|고양이|켄넬|이동장/.test(lowerQuery)) {
    terms.push('pet creator', 'dog review', 'pet influencer')
  }
  if (/beauty|makeup|skincare|cosmetic|cosmetics|뷰티|화장품|메이크업|스킨케어/.test(lowerQuery)) {
    terms.push('beauty creator', 'skincare review', 'makeup influencer')
  }
  if (/food|snack|맛집|먹방|간식|푸드/.test(lowerQuery)) {
    terms.push('food creator', 'snack review')
  }
  if (/fashion|lookbook|패션|룩북|의류/.test(lowerQuery)) {
    terms.push('fashion creator', 'lookbook')
  }
  return terms
}

async function searchGoogleCseProfiles(query, platform, maxResults, country = 'KR') {
  const key = requireEnv('GOOGLE_SEARCH_API_KEY')
  const cx = requireEnv('GOOGLE_SEARCH_CX')
  const platforms = getProfileDiscoveryPlatforms(platform)
  const regionCode = normalizeRegionCode(country) || 'KR'
  const platformTarget = Math.max(1, Math.ceil(maxResults / platforms.length))
  const results = []

  for (const itemPlatform of platforms) {
    for (let start = 1; start <= Math.min(platformTarget * 3, 91) && results.length < maxResults * 3; start += 10) {
      const params = new URLSearchParams({
        key,
        cx,
        q: `${getPlatformSiteQuery(itemPlatform)} ${query}`,
        num: String(Math.min(platformTarget, 10)),
        start: String(start),
        gl: regionCode.toLowerCase(),
        safe: 'active',
      })
      const payload = await fetchJson(`https://www.googleapis.com/customsearch/v1?${params}`)
      const pageItems = payload.items || []
      results.push(
        ...pageItems
          .map((item) => normalizeProfileSearchItem(item, itemPlatform, 'Google Programmable Search', regionCode))
          .filter(Boolean),
      )
      if (pageItems.length < 10) break
    }
  }

  const enriched = await enrichProfileResults(dedupeProfileResults(results).slice(0, maxResults * 3))
  return filterProfileDiscoveryResults(enriched, query).slice(0, maxResults)
}

async function enrichProfileResults(deduped) {
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

function normalizeProfileDiscoveryPlatform(value) {
  const platform = String(value || '').trim()
  if (!platform || platform === 'all' || platform === '전체') return 'all'
  if (/instagram|인스타/i.test(platform)) return 'Instagram'
  if (/tiktok|틱톡/i.test(platform)) return 'TikTok'
  if (/youtube|유튜브/i.test(platform)) return 'YouTube'
  return 'all'
}

function getProfileDiscoveryPlatforms(platform) {
  if (platform === 'all') return ['Instagram', 'TikTok']
  return [platform]
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

  if (isTikTokUrl(safeUrl) && isTikTokPublicMirrorEnabled()) {
    const tiktokSnapshot = await fetchTikTokPublicStatsSnapshot(safeUrl).catch(() => null)
    if (tiktokSnapshot?.metrics?.followers) return tiktokSnapshot
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

async function fetchTikTokPublicStatsSnapshot(url) {
  const handle = extractTikTokHandle(url)
  if (!handle) throw httpError(400, 'TikTok handle could not be parsed from the URL.')

  const params = new URLSearchParams({ unique_id: handle })
  const payload = await fetchTikTokMirrorJson(params)

  if (payload.code !== 0 || !payload.data?.user) {
    throw httpError(502, 'TikTok public stats mirror did not return user data.')
  }

  const user = payload.data.user || {}
  const stats = payload.data.stats || {}
  const followers = Number(stats.followerCount || 0)
  const likes = Number(stats.heartCount || stats.heart || 0)
  const videoCount = Number(stats.videoCount || 0)
  const averageViews = videoCount && likes ? Math.round(likes / Math.max(videoCount, 1)) : null

  return {
    title: user.nickname || handle,
    description: user.signature || '',
    image: user.avatarLarger || user.avatarMedium || user.avatarThumb || '',
    handle: `@${user.uniqueId || handle}`,
    platform: 'TikTok',
    mediaType: '영상',
    metrics: {
      followers: followers || null,
      views: averageViews,
      likes,
      comments: null,
      shares: null,
      saves: null,
      videos: videoCount || null,
    },
    source: 'TikTok public mirror snapshot',
    confidence: 58,
    status: 'snapshot_ready',
    url,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchTikTokMirrorJson(params) {
  const endpoints = [
    `https://www.tikwm.com/api/user/info?${params}`,
    `https://tikwm.com/api/user/info?${params}`,
  ]
  let lastError = null

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(endpoint, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CreatorOpsPublicSnapshot/1.0 (+https://creatorops-influencer-suite.onrender.com)',
        },
      })
      if (payload?.code === 0 && payload.data?.user && payload.data?.stats) return payload
      lastError = httpError(502, 'TikTok public stats mirror returned empty user data.')
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || httpError(502, 'TikTok public stats mirror failed.')
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

  const preferSnapshotIdentity =
    profile.platform === 'TikTok' && String(snapshot.source || '').includes('TikTok public mirror')

  return {
    ...profile,
    name: preferSnapshotIdentity ? snapshot.title || profile.name || profile.handle : profile.name || snapshot.title || profile.handle,
    avatar: preferSnapshotIdentity ? snapshot.image || profile.avatar || '' : profile.avatar || snapshot.image || '',
    followers: snapshot.metrics?.followers || profile.followers,
    averageViews: snapshot.metrics?.views || profile.averageViews,
    description: profile.description || snapshot.description || profile.snippet,
    snippet: profile.snippet || snapshot.description,
    source: snapshot.source ? `${profile.source || 'Public search'} + ${snapshot.source}` : profile.source,
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

function normalizeYouTubeChannel(channel, parsedLookup = {}, fallbackCountry = 'KR') {
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
    country: snippet.country || '',
    searchCountry: fallbackCountry || '',
    countryConfidence: snippet.country ? 'official' : 'unverified',
    source: 'YouTube Data API',
    verifiedMetrics: true,
  }
}

function normalizeProfileSearchItem(item, platform, source = 'Public Search API', country = 'KR') {
  const link = item.link || item.formattedUrl || item.url || ''
  if (!link) return null

  try {
    const url = new URL(link)
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
    const segments = url.pathname.split('/').filter(Boolean)

    if (platform === 'Instagram') {
      if (!hostname.includes('instagram.com')) return null
      const handle = segments[0]
      if (!isInstagramProfileHandle(handle)) return null
      return buildSearchResult(item, platform, `@${handle}`, `https://www.instagram.com/${handle}`, source, country)
    }

    if (platform === 'TikTok') {
      if (!hostname.includes('tiktok.com')) return null
      const handle = segments.find((segment) => segment.startsWith('@'))
      if (!handle) return null
      return buildSearchResult(item, platform, handle, `https://www.tiktok.com/${handle}`, source, country, {
        fromContentUrl: segments.includes('video'),
      })
    }

    if (platform === 'YouTube') {
      if (!hostname.includes('youtube.com')) return null
      const handle = segments.find((segment) => segment.startsWith('@')) || segments.find((segment) => segment.startsWith('UC'))
      if (!handle) return null
      const profileUrl = handle.startsWith('@')
        ? `https://www.youtube.com/${handle}`
        : `https://www.youtube.com/channel/${handle}`
      return buildSearchResult(item, platform, handle.startsWith('@') ? handle : `@${handle}`, profileUrl, source, country)
    }
  } catch {
    return null
  }

  return null
}

function detectProfileCountry({ profileUrl = '', title = '', snippet = '', handle = '' } = {}) {
  const text = [profileUrl, title, snippet, handle].filter(Boolean).join(' ').toLowerCase()
  if (!text) return ''

  if (/\.kr(?:\/|$)|korea|south korea|seoul|busan|incheon|gangnam|hongdae/i.test(text)) return 'KR'
  if (/\.jp(?:\/|$)|japan|tokyo|osaka|kyoto|yokohama/i.test(text)) return 'JP'
  if (/\.cn(?:\/|$)|china|beijing|shanghai/i.test(text)) return 'CN'
  if (/taiwan|taipei|\.tw(?:\/|$)/i.test(text)) return 'TW'
  if (/vietnam|viet nam|hanoi|saigon|ho chi minh|\.vn(?:\/|$)/i.test(text)) return 'VN'
  if (/thailand|bangkok|\.th(?:\/|$)/i.test(text)) return 'TH'
  if (/indonesia|jakarta|\.id(?:\/|$)/i.test(text)) return 'ID'
  if (/philippines|manila|\.ph(?:\/|$)/i.test(text)) return 'PH'
  if (/singapore|\.sg(?:\/|$)/i.test(text)) return 'SG'
  if (/malaysia|kuala lumpur|\.my(?:\/|$)/i.test(text)) return 'MY'
  if (/united kingdom|\buk\b|london|england|\.co\.uk(?:\/|$)|\.uk(?:\/|$)/i.test(text)) return 'GB'
  if (/united states|\busa\b|\bus\b|new york|los angeles|california|\.us(?:\/|$)/i.test(text)) return 'US'

  return ''
}

function buildSearchResult(item, platform, handle, profileUrl, source, country = 'KR', options = {}) {
  const title = cleanReferenceText(item.title || '')
    .replace(/\s*[-|].*$/, '')
    .replace(/\s*•.*$/, '')
    .trim()
  const snippet = cleanReferenceText(item.snippet || item.description || '')
  const metricText = `${title} ${snippet}`
  const publicMetrics = extractPublicMetrics(metricText)
  const detectedCountry = detectProfileCountry({ profileUrl, title, snippet, handle })

  return {
    id: `${platform}:${handle}`,
    platform,
    name: platform === 'TikTok' && options.fromContentUrl ? handle.replace('@', '') : title || handle.replace('@', ''),
    handle,
    profileUrl,
    country: detectedCountry,
    searchCountry: country,
    countryConfidence: detectedCountry ? 'detected' : 'unverified',
    snippet,
    sourceTitle: title,
    sourceSnippet: snippet,
    avatar: selectProfileAvatarCandidate(platform, item),
    followers: publicMetrics.followers || extractMetricFromTextSafe(metricText, 'followers') || null,
    averageViews: publicMetrics.views || extractMetricFromTextSafe(metricText, 'views') || null,
    source,
    verifiedMetrics: false,
  }
}

function selectProfileAvatarCandidate(platform, item) {
  if (platform === 'TikTok') {
    return selectReferenceThumbnail(item.profile?.img)
  }
  return selectReferenceThumbnail(item.profile?.img, item.thumbnail?.src)
}

function isInstagramProfileHandle(handle) {
  if (!handle) return false
  const blocked = new Set([
    'p',
    'reel',
    'tv',
    'stories',
    'explore',
    'accounts',
    'about',
    'developer',
    'direct',
    'directory',
    'privacy',
    'legal',
    'reels',
    'tags',
    'popular',
    'blog',
    'press',
    'help',
    'web',
  ])
  if (blocked.has(handle.toLowerCase())) return false
  return /^[a-z0-9._]{2,30}$/i.test(handle)
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
  if (platform === 'Instagram') return 'site:instagram.com -inurl:/p/ -inurl:/reel/ -inurl:/stories/'
  if (platform === 'TikTok') return 'site:tiktok.com/@ -inurl:/video/ -inurl:/music/'
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

function filterProfileDiscoveryResults(results, query) {
  const context = buildProfileDiscoveryQueryContextV2(query)
  const scoredResults = results.map((profile) => ({
    ...profile,
    discoveryRelevanceScore: scoreProfileDiscoveryRelevance(profile, context),
  }))
  const strictResults = scoredResults
    .filter((profile) => isUsableProfileDiscoveryResultV2(profile, context, 'strict'))
    .map((profile) => ({ ...profile, discoveryMatchLevel: '정확 후보' }))
  const strictKeys = new Set(strictResults.map((profile) => `${profile.platform}:${profile.profileUrl || profile.handle}`.toLowerCase()))
  const expandedResults = scoredResults
    .filter((profile) => !strictKeys.has(`${profile.platform}:${profile.profileUrl || profile.handle}`.toLowerCase()))
    .filter((profile) => isUsableProfileDiscoveryResultV2(profile, context, 'expanded'))
    .map((profile) => ({ ...profile, discoveryMatchLevel: '확장 후보' }))

  const typedStrictResults = strictResults.map((profile) => ({ ...profile, discoveryMatchType: 'strict' }))
  const typedExpandedResults = expandedResults.map((profile) => ({ ...profile, discoveryMatchType: 'expanded' }))

  return [...typedStrictResults, ...typedExpandedResults]
    .sort((a, b) => {
      if (a.discoveryMatchLevel !== b.discoveryMatchLevel) {
        return a.discoveryMatchLevel === '정확 후보' ? -1 : 1
      }
      if (b.discoveryRelevanceScore !== a.discoveryRelevanceScore) {
        return b.discoveryRelevanceScore - a.discoveryRelevanceScore
      }
      return Number(b.followers || 0) - Number(a.followers || 0)
    })
}

// eslint-disable-next-line no-unused-vars
function buildProfileDiscoveryQueryContext(query) {
  const tokens = String(query || '')
    .toLowerCase()
    .split(/[\s,./|()[\]{}"'`~!?:;]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
  const stopWords = new Set([
    'creator',
    'creators',
    'influencer',
    'influencers',
    'review',
    'reviews',
    'campaign',
    'product',
    'service',
    'brand',
    'official',
    'profile',
    'video',
    '콘텐츠',
    '크리에이터',
    '인플루언서',
    '캠페인',
    '브랜드',
    '제품',
    '서비스',
    '후보',
    '리뷰',
    '추천',
    '사용',
    '설명',
    '타깃',
    '페르소나',
  ])
  const genericCategoryWords = new Set([
    'pet',
    'dog',
    'cat',
    'beauty',
    'makeup',
    'skincare',
    'food',
    'fashion',
    '강아지',
    '반려견',
    '반려동물',
    '고양이',
    '펫',
    '뷰티',
    '화장품',
  ])
  const uniqueTokens = [...new Set(tokens.filter((term) => !stopWords.has(term)))]
  const distinctiveTokens = uniqueTokens.filter((term) => !genericCategoryWords.has(term))

  return {
    tokens: uniqueTokens,
    requiredTokens: distinctiveTokens.length ? distinctiveTokens : uniqueTokens,
  }
}

function getProfileDiscoverySearchText(profile) {
  return [
    profile.name,
    profile.handle,
    profile.profileUrl,
    profile.snippet,
    profile.description,
    profile.sourceTitle,
    profile.sourceSnippet,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function scoreProfileDiscoveryRelevance(profile, context) {
  const text = getProfileDiscoverySearchText(profile)
  const matchedTokens = context.tokens.filter((term) => text.includes(term)).length
  const matchedRequiredTokens = context.requiredTokens.filter((term) => text.includes(term)).length
  const hasMetrics = Number(profile.followers || 0) > 0 || Number(profile.averageViews || 0) > 0
  const hasSnapshot = profile.publicSnapshotStatus === 'snapshot_ready'
  const hasRealProfileImage = /tiktokcdn|cdninstagram|yt3\.ggpht|googleusercontent/i.test(String(profile.avatar || ''))
  const captionPenalty = profile.platform === 'TikTok' && looksLikeContentCaption(profile.name) ? 3 : 0

  return matchedTokens + matchedRequiredTokens * 2 + (hasMetrics ? 2 : 0) + (hasSnapshot ? 2 : 0) + (hasRealProfileImage ? 1 : 0) - captionPenalty
}

// eslint-disable-next-line no-unused-vars
function isUsableProfileDiscoveryResult(profile, context) {
  if (!profile?.profileUrl) return false
  const text = getProfileDiscoverySearchText(profile)
  const requiredMatches = context.requiredTokens.filter((term) => text.includes(term)).length
  const hasMetrics = Number(profile.followers || 0) > 0 || Number(profile.averageViews || 0) > 0
  const hasRequiredMatch = !context.requiredTokens.length || requiredMatches > 0

  if (!hasRequiredMatch) return false

  if (profile.platform === 'TikTok') {
    if (!hasMetrics && looksLikeContentCaption(profile.name)) return false
    if (hasBlockedDiscoveryTopic(text)) return false
  }

  return true
}

function hasBlockedDiscoveryTopic(text) {
  return /adopt me|roblox|game|gaming|낚시|붕어|차박|카니발|캠핑|입양|게임/i.test(String(text || ''))
}

function looksLikeContentCaption(value) {
  const text = String(value || '').trim()
  if (!text) return false
  if (text.length >= 48) return true
  if ((text.match(/#/g) || []).length >= 2) return true
  return /추천|입양|ㅋㅋ|ㅎㅎ|릴스|챌린지|viral|fyp/i.test(text) && text.length >= 24
}

function buildProfileDiscoveryQueryContextV2(query) {
  const rawTokens = String(query || '')
    .toLowerCase()
    .split(/[\s,./|()[\]{}"'`~!?:;]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
  const stopWords = new Set([
    'creator',
    'creators',
    'influencer',
    'influencers',
    'review',
    'reviews',
    'campaign',
    'product',
    'service',
    'brand',
    'official',
    'profile',
    'video',
    'content',
    '콘텐츠',
    '크리에이터',
    '인플루언서',
    '캠페인',
    '브랜드',
    '제품',
    '서비스',
    '후보',
    '리뷰',
    '추천',
    '사용',
    '설명',
    '타깃',
    '페르소나',
  ])
  const genericCategoryWords = new Set([
    'pet',
    'dog',
    'cat',
    'beauty',
    'makeup',
    'skincare',
    'food',
    'fashion',
    '강아지',
    '반려견',
    '반려동물',
    '고양이',
    '펫',
    '뷰티',
    '화장품',
  ])
  const tokens = [...new Set(rawTokens.filter((term) => !stopWords.has(term)))]
  const requiredTokens = tokens.filter((term) => !genericCategoryWords.has(term))
  const genericTokens = tokens.filter((term) => genericCategoryWords.has(term))

  return { tokens, requiredTokens, genericTokens }
}

function isUsableProfileDiscoveryResultV2(profile, context, mode = 'strict') {
  if (!profile?.profileUrl) return false
  const text = getProfileDiscoverySearchText(profile)
  const requiredMatches = context.requiredTokens.filter((term) => text.includes(term)).length
  const genericMatches = context.genericTokens.filter((term) => text.includes(term)).length
  const tokenMatches = context.tokens.filter((term) => text.includes(term)).length
  const hasMetrics = Number(profile.followers || 0) > 0 || Number(profile.averageViews || 0) > 0
  const hasRequiredMatch = !context.requiredTokens.length || requiredMatches > 0
  const hasCategoryMatch = genericMatches > 0 || tokenMatches > 0

  if (mode === 'strict' && !hasRequiredMatch) return false
  if (mode === 'expanded' && !hasCategoryMatch && !hasMetrics) return false

  if (profile.platform === 'TikTok') {
    if (!hasMetrics && looksLikeContentCaptionV2(profile.name)) return false
    if (hasBlockedDiscoveryTopicV2(text)) return false
  }

  return true
}

function hasBlockedDiscoveryTopicV2(text) {
  return /adopt me|roblox|game|gaming|낚시|붕어|차박|카니발|캠핑|입양|게임/i.test(String(text || ''))
}

function looksLikeContentCaptionV2(value) {
  const text = String(value || '').trim()
  if (!text) return false
  if (text.length >= 64) return true
  if ((text.match(/#/g) || []).length >= 4) return true
  return /입양|ㅋㅋ|ㅎㅎ|릴스|챌린지|viral|fyp/i.test(text) && text.length >= 30
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

function isTikTokUrl(value) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
    return hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')
  } catch {
    return false
  }
}

function extractTikTokHandle(value) {
  try {
    const url = new URL(String(value || '').trim())
    const segments = url.pathname.split('/').filter(Boolean)
    const handle = segments.find((segment) => segment.startsWith('@')) || ''
    return handle.replace(/^@/, '')
  } catch {
    const match = String(value || '').match(/@([A-Za-z0-9._-]+)/)
    return match?.[1] || ''
  }
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

function isTikTokPublicMirrorEnabled() {
  return String(process.env.TIKTOK_PUBLIC_MIRROR_ENABLED || 'true').toLowerCase() !== 'false'
}

function getPublicSnapshotTimeoutMs() {
  return clamp(Number(process.env.PUBLIC_SNAPSHOT_TIMEOUT_MS || 8000), 1500, 20000)
}

function normalizeRegionCode(value) {
  const clean = String(value || '').trim().toUpperCase()
  if (clean === '\uC804\uCCB4') return ''
  if (!clean || clean === '전체' || clean === 'ALL' || clean === 'GLOBAL') return ''
  return /^[A-Z]{2}$/.test(clean) ? clean : ''
}

function getDiscoveryLanguage(country) {
  const languages = {
    KR: 'ko',
    JP: 'ja',
    CN: 'zh-Hans',
    TW: 'zh-Hant',
    US: 'en',
    GB: 'en',
    SG: 'en',
    MY: 'ms',
    TH: 'th',
    VN: 'vi',
    ID: 'id',
    PH: 'en',
  }
  return languages[country] || 'en'
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
    const value = parseMetricNumberSafe(match?.[1], match?.[2])
    if (value) return value
  }
  return null
}

// eslint-disable-next-line no-unused-vars
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

function parseMetricNumberSafe(rawNumber, rawUnit = '') {
  if (!rawNumber) return null
  const base = Number(String(rawNumber).replace(/,/g, ''))
  if (!Number.isFinite(base)) return null

  const unit = String(rawUnit || '').trim().toLowerCase()
  const multiplierByUnit = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
    '\uCC9C': 1_000,
    '\uB9CC': 10_000,
    '\uC5B5': 100_000_000,
  }

  return Math.round(base * (multiplierByUnit[unit] || 1))
}

function extractMetricFromTextSafe(text, metric) {
  const normalized = decodeHtmlEntities(String(text || '')).replace(/\s+/g, ' ')
  const patterns = metric === 'followers'
    ? [
        /\uD314\uB85C\uC6CC\s*([\d.,]+)\s*([KMB]|\uCC9C|\uB9CC|\uC5B5)?/i,
        /([\d.,]+)\s*([KMB]|\uCC9C|\uB9CC|\uC5B5)?\s*\uD314\uB85C\uC6CC/i,
      ]
    : [
        /\uC870\uD68C\s*([\d.,]+)\s*([KMB]|\uCC9C|\uB9CC|\uC5B5)?/i,
        /([\d.,]+)\s*([KMB]|\uCC9C|\uB9CC|\uC5B5)?\s*\uC870\uD68C/i,
      ]

  return firstMetric(normalized, patterns)
}

function decodeHtmlEntities(value) {
  let decoded = String(value || '')
  for (let index = 0; index < 3; index += 1) {
    const next = decoded
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    if (next === decoded) break
    decoded = next
  }
  return decoded
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

function chunkArray(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
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
