import { config as loadEnv } from 'dotenv'
import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

/* global document */

loadEnv()
loadEnv({ path: '.env.local', override: false })

const app = express()
const port = Number(process.env.PORT || 8787)
const DISCOVERY_RESULT_LIMIT = 1000
const REFERENCE_RESULT_LIMIT = 500
const PROFILE_SNAPSHOT_ENRICH_LIMIT = 80
const MIN_DISCOVERY_FOLLOWERS = 1000
const MIN_REFERENCE_KNOWN_VIEWS = 500_000
const MIN_REFERENCE_QUALITY_SCORE = 45
const SEARCH_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const SEARCH_CACHE_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const WORKSPACE_ID = process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || 'miping-main'
const searchCache = new Map()
let tiktokCommercialTokenCache = { token: '', expiresAt: 0 }
let supabaseAdminClient
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function isAllowedCorsOrigin(origin) {
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true

  try {
    const requestedUrl = new URL(origin)
    const isLocalHost = requestedUrl.hostname === 'localhost' || requestedUrl.hostname === '127.0.0.1'
    if (!isLocalHost) return false

    return allowedOrigins.some((allowedOrigin) => {
      try {
        const allowedUrl = new URL(allowedOrigin)
        const allowedIsLocalHost = allowedUrl.hostname === 'localhost' || allowedUrl.hostname === '127.0.0.1'
        return allowedIsLocalHost && allowedUrl.protocol === requestedUrl.protocol && allowedUrl.port === requestedUrl.port
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedCorsOrigin(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`Origin not allowed: ${origin}`))
  },
}))
app.use(express.json({ limit: '1mb' }))

const DISCOVERY_STOP_WORDS = new Set([
  'creator', 'creators', 'influencer', 'influencers', 'review', 'reviews', 'campaign', 'product', 'service', 'brand', 'official', 'profile', 'video', 'content', 'channel', 'shorts', 'reels', 'tiktok', 'instagram', 'youtube',
  '\uD06C\uB9AC\uC5D0\uC774\uD130', '\uC778\uD50C\uB8E8\uC5B8\uC11C', '\uB9AC\uBDF0', '\uD6C4\uAE30', '\uCEA0\uD398\uC778', '\uBE0C\uB79C\uB4DC', '\uC81C\uD488', '\uCC44\uB110', '\uC601\uC0C1', '\uCF58\uD150\uCE20', '\uC20F\uCE20', '\uB9B4\uC2A4',
])

const DISCOVERY_GENERIC_TERMS = new Set([
  'food', 'cook', 'cooking', 'beauty', 'makeup', 'skincare', 'kbeauty', 'korean', 'cosmetic', 'pet', 'dog', 'cat', 'fashion', 'fitness', 'travel', 'daily', 'life', 'lifestyle',
  '\uD478\uB4DC', '\uC74C\uC2DD', '\uBDF0\uD2F0', '\uD654\uC7A5\uD488', '\uC2A4\uD0A8\uCF00\uC5B4', '\uD3AB', '\uBC18\uB824', '\uAC15\uC544\uC9C0', '\uACE0\uC591\uC774', '\uD328\uC158', '\uC6B4\uB3D9', '\uC5EC\uD589',
])

function tokenizeDiscoveryIntent(query) {
  return [...new Set(String(query || '')
    .toLowerCase()
    .replace(/[(){}"'~!?:;|/\\]|\[|\]/g, ' ')
    .split(/[\s,.#]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .filter((term) => !DISCOVERY_STOP_WORDS.has(term)))]
}

function buildDiscoveryIntentContext(query) {
  const baseTokens = tokenizeDiscoveryIntent(query)
  const queryText = String(query || '').toLowerCase()
  const expansionTokens = []
  if (hasBeautyDiscoveryIntent(queryText)) expansionTokens.push('beauty', 'skincare', 'kbeauty', 'korean')
  if (hasFoodDiscoveryIntent(queryText)) {
    expansionTokens.push(
      'food',
      'recipe',
      'cook',
      'cooking',
      'homecooking',
      'koreanfood',
      '\uC9D1\uBC25',
      '\uD648\uCFE1',
      '\uBC18\uCC2C',
      '\uB3C4\uC2DC\uB77D',
      '\uD55C\uC2DD',
    )
  }
  if (hasPetDiscoveryIntent(queryText)) expansionTokens.push('pet', 'dog', 'cat')
  const tokens = [...new Set([...baseTokens, ...expansionTokens])]
  const requiredTokens = tokens.filter((term) => !DISCOVERY_GENERIC_TERMS.has(term))
  const genericTokens = tokens.filter((term) => DISCOVERY_GENERIC_TERMS.has(term))
  return { tokens, requiredTokens, genericTokens }
}

function compactDiscoveryQuery(query) {
  const context = buildDiscoveryIntentContext(query)
  const terms = context.tokens.length ? context.tokens : String(query || '').split(/\s+/).filter(Boolean)
  return terms.join(' ').replace(/\s+/g, ' ').trim()
}

function getDiscoveryIntentText(item = {}) {
  return [
    item.name,
    item.handle,
    item.title,
    item.description,
    item.snippet,
    item.sourceTitle,
    item.sourceSnippet,
    item.channelTitle,
    item.profileUrl,
    item.url,
    item.hook,
    item.analysis,
  ].filter(Boolean).join(' ').toLowerCase()
}

function scoreDiscoveryIntentMatch(item, context) {
  const text = getDiscoveryIntentText(item)
  const requiredMatches = context.requiredTokens.filter((term) => text.includes(term)).length
  const genericMatches = context.genericTokens.filter((term) => text.includes(term)).length
  const tokenMatches = context.tokens.filter((term) => text.includes(term)).length
  return requiredMatches * 5 + genericMatches * 2 + tokenMatches
}

function isDiscoveryIntentMatch(item, context) {
  if (!context.tokens.length) return true
  const text = getDiscoveryIntentText(item)
  const score = scoreDiscoveryIntentMatch(item, context)
  if (context.requiredTokens.length) return context.requiredTokens.some((term) => text.includes(term))
  return score > 0
}


function passesMinimumDiscoveryScale(item = {}) {
  const followers = Number(item.followers || item.accountFollowers || 0)
  const averageViews = Number(item.averageViews || item.avgViews || item.views || 0)
  if (!followers) return !averageViews || averageViews >= MIN_DISCOVERY_FOLLOWERS
  return followers >= MIN_DISCOVERY_FOLLOWERS
}

function filterAndRankDiscoveryIntent(items, query) {
  const context = buildDiscoveryIntentContext(query)
  if (!context.tokens.length) return items
  const scoredItems = items
    .map((item) => ({ ...item, queryIntentScore: scoreDiscoveryIntentMatch(item, context) }))
    .sort((a, b) => b.queryIntentScore - a.queryIntentScore)
  const strictMatches = scoredItems.filter((item) => isDiscoveryIntentMatch(item, context))
  if (strictMatches.length) return strictMatches

  const categoryMatches = scoredItems.filter((item) => {
    const text = getDiscoveryIntentText(item)
    return context.genericTokens.some((term) => text.includes(term))
      || context.tokens.some((term) => text.includes(term))
  })
  if (categoryMatches.length) return categoryMatches

  return []
}

function sanitizeAiPromptValue(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\uFFFD/g, '')
      .replace(/\?{2,}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  if (Array.isArray(value)) return value.map(sanitizeAiPromptValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeAiPromptValue(item)]))
  }
  return value
}


app.get('/health', (request, response) => {
  response.json({
    ok: true,
    service: 'creatorops-api',
    version: process.env.RENDER_GIT_COMMIT || 'local',
  })
})

function getDataRoomLogStatus() {
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
  const missingEnv = [
    !hasSupabaseUrl ? 'SUPABASE_URL' : '',
    !hasServiceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : '',
    !WORKSPACE_ID ? 'WORKSPACE_ID' : '',
  ].filter(Boolean)
  return {
    configured: hasSupabaseUrl && hasServiceRoleKey,
    hasSupabaseUrl,
    hasServiceRoleKey,
    missingEnv,
    workspaceId: WORKSPACE_ID,
    readinessLevel: hasSupabaseUrl && hasServiceRoleKey ? 'ready_to_check_tables' : 'missing_environment',
    requiredEnv: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WORKSPACE_ID'],
    requiredTables: [
      'workspaces',
      'raw_data_sources',
      'metric_definitions',
      'external_search_events',
      'external_report_imports',
      'external_report_rows',
      'metric_snapshots',
    ],
    nextActions: missingEnv.length
      ? [
          'Set the missing environment variables on the Render API service, not the static frontend service.',
          'Use the Supabase service_role key only on the backend API service.',
          'Redeploy the API service after changing environment variables.',
          'Open /data-room/status again and confirm all required tables return OK.',
        ]
      : [
          'Confirm all required tables return OK.',
          'Run a discovery or reference search and verify a new external_search_events row appears.',
        ],
  }
}

app.get('/data-room/status', async (request, response) => {
  const status = getDataRoomLogStatus()
  if (!status.configured) {
    response.json({
      ok: false,
      service: 'creatorops-api',
      dataRoomLogging: status,
      message: 'Data room API logging is not configured on this server.',
    })
    return
  }

  const supabase = getSupabaseAdminClient()
  const checks = {}

  for (const table of status.requiredTables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
      checks[table] = error
        ? { ok: false, message: error.message }
        : { ok: true, count: count ?? 0 }
    } catch (error) {
      checks[table] = { ok: false, message: error.message }
    }
  }

  const ok = Object.values(checks).every((item) => item.ok)
  response.json({
    ok,
    service: 'creatorops-api',
    dataRoomLogging: status,
    checks,
    tableStatus: ok ? 'ready' : 'schema_or_permission_issue',
    message: ok
      ? 'Data room API logging can write raw events after collection requests.'
      : 'Data room API logging is configured, but one or more tables are not reachable.',
  })
})

function getSearchCacheKey(scope, value) {
  return `${scope}:${JSON.stringify(value)}`
}

function readSearchCache(key, { allowStale = false } = {}) {
  const entry = searchCache.get(key)
  if (!entry) return null
  const age = Date.now() - entry.createdAt
  if (age <= SEARCH_CACHE_TTL_MS || (allowStale && age <= SEARCH_CACHE_STALE_TTL_MS)) {
    return JSON.parse(JSON.stringify(entry.value))
  }
  searchCache.delete(key)
  return null
}

function writeSearchCache(key, value) {
  searchCache.set(key, {
    createdAt: Date.now(),
    value: JSON.parse(JSON.stringify(value)),
  })
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return supabaseAdminClient
}

const DATA_ROOM_RAW_SOURCE_META = {
  'RAW-EXT-SEARCH-001': {
    category: '외부 검색 원본',
    name: '외부 검색 원본 결과',
    method: 'API',
    cycle: '검색 요청 시',
    dashboardArea: '발굴, 레퍼런스, 데이터룸',
  },
  'RAW-EXT-CHN-001': {
    category: 'SNS 채널 수집',
    name: 'SNS 채널/프로필 공개 지표',
    method: 'API / 공개 snapshot',
    cycle: '채널 조회 시',
    dashboardArea: '발굴, 리포트, 데이터룸',
  },
  'RAW-EXT-CONT-001': {
    category: '콘텐츠 조회수',
    name: '콘텐츠 공개 성과 지표',
    method: 'API / 공개 snapshot',
    cycle: '콘텐츠 조회/갱신 시',
    dashboardArea: '리포트, 레퍼런스, 데이터룸',
  },
  'RAW-EXT-REF-001': {
    category: '콘텐츠 레퍼런스',
    name: '콘텐츠 레퍼런스 검색 결과',
    method: 'API / 외부 검색',
    cycle: '레퍼런스 검색 시',
    dashboardArea: '레퍼런스, 콘텐츠 가이드, 데이터룸',
  },
  'RAW-EXT-ENG-001': {
    category: '콘텐츠 반응지표',
    name: '좋아요/댓글/공유/저장 공개 반응지표',
    method: 'API / 공개 snapshot',
    cycle: '성과 갱신 시',
    dashboardArea: '리포트, 데이터룸',
  },
  'RAW-EXT-SERP-001': {
    category: '검색 결과 URL 추론',
    name: '검색 결과 URL 추론 raw',
    method: 'Search API',
    cycle: '검색 요청 시',
    dashboardArea: '발굴, 레퍼런스, 데이터룸',
  },
  'RAW-EXT-TT-RESEARCH-001': {
    category: 'TikTok 승인 API',
    name: 'TikTok Research API raw',
    method: 'TikTok Research API',
    cycle: '승인 API 수집 시',
    dashboardArea: '발굴, 레퍼런스, 리포트, 데이터룸',
  },
  'RAW-EXT-TT-COMMERCIAL-001': {
    category: 'TikTok 상업 콘텐츠 API',
    name: 'TikTok Commercial Content API raw',
    method: 'TikTok Commercial Content API',
    cycle: '상업 콘텐츠 검색 시',
    dashboardArea: '레퍼런스, 브랜드 추적, 데이터룸',
  },
  'RAW-EXT-TT-SNAPSHOT-001': {
    category: 'TikTok 공개 스냅샷',
    name: 'TikTok 공개 화면 스냅샷 raw',
    method: 'Public snapshot / 수동 검증',
    cycle: '저장/검증 시',
    dashboardArea: '발굴, 리포트, 레퍼런스, 데이터룸',
  },
  'RAW-EXT-IG-BUSINESS-001': {
    category: 'Instagram 승인 API',
    name: 'Instagram Graph API / Business Discovery raw',
    method: 'Instagram Graph API',
    cycle: '승인 API 수집 시',
    dashboardArea: '발굴, 브랜드 추적, 리포트, 데이터룸',
  },
  'RAW-EXT-IG-CREATOR-AUTH-001': {
    category: 'Instagram 인증 인사이트',
    name: 'Instagram 크리에이터 인증 인사이트 raw',
    method: 'Creator OAuth / Media kit',
    cycle: '크리에이터 승인 갱신 시',
    dashboardArea: '리포트, 후보 검증, 데이터룸',
  },
  'RAW-EXT-IG-SNAPSHOT-001': {
    category: 'Instagram 공개 스냅샷',
    name: 'Instagram 공개 프로필/릴스 스냅샷 raw',
    method: 'Public snapshot / 수동 검증',
    cycle: '저장/검증 시',
    dashboardArea: '발굴, 레퍼런스, 리포트, 데이터룸',
  },
}

async function ensureDataRoomWorkspace(supabase) {
  const { error } = await supabase
    .from('workspaces')
    .upsert(
      {
        id: WORKSPACE_ID,
        name: WORKSPACE_ID,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
  if (error) throw error
}

async function ensureDataRoomRawSource(supabase, rawSourceId) {
  if (!rawSourceId) return
  const meta = DATA_ROOM_RAW_SOURCE_META[rawSourceId] || {
    category: '외부 수집',
    name: rawSourceId,
    method: 'API',
    cycle: '요청 시',
    dashboardArea: '데이터룸',
  }
  const { error } = await supabase
    .from('raw_data_sources')
    .upsert(
      {
        id: rawSourceId,
        workspace_id: WORKSPACE_ID,
        scope: 'external',
        category: meta.category,
        name: meta.name,
        description: `${meta.name} API raw log source`,
        collection_method: meta.method,
        collection_cycle: meta.cycle,
        source_location: 'CreatorOps API server',
        storage_location: 'external_search_events',
        dashboard_area: meta.dashboardArea,
        owner_dept: '데이터/개발팀',
        ops_owner: 'Data Operator',
        tech_owner: 'Backend',
        status: 'ok',
        quality_issue: '',
        log_location: 'external_search_events',
        active: true,
        metadata: {
          managedBy: 'api-raw-logger',
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
  if (error) throw error
}

function compactRawLogPayload(value, maxLength = 180000) {
  const json = JSON.stringify(value ?? {})
  if (json.length <= maxLength) return value ?? {}
  return {
    truncated: true,
    originalLength: json.length,
    preview: json.slice(0, maxLength),
  }
}

function getErrorLogPayload(error) {
  return {
    status: Number(error?.status || 500),
    message: error?.message || 'Unexpected server error.',
    name: error?.name || 'Error',
  }
}

async function safeLogExternalCollectionEvent({
  rawSourceId = 'RAW-EXT-SEARCH-001',
  provider,
  endpoint,
  query = '',
  platform = '',
  country = '',
  category = '',
  requestPayload = {},
  responsePayload = {},
  resultCount = 0,
  status = 'success',
  errorMessage = '',
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    if (process.env.DATA_ROOM_LOG_VERBOSE === 'true') {
      console.warn(`Data room API log skipped: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing (${endpoint})`)
    }
    return { status: 'skipped' }
  }

  try {
    await ensureDataRoomWorkspace(supabase)
    await ensureDataRoomRawSource(supabase, rawSourceId)
    const { error } = await supabase.from('external_search_events').insert({
      workspace_id: WORKSPACE_ID,
      raw_source_id: rawSourceId,
      provider,
      endpoint,
      query,
      platform,
      country,
      category,
      request_payload: compactRawLogPayload(requestPayload),
      response_payload: compactRawLogPayload(responsePayload),
      result_count: Number(resultCount || 0),
      status,
      error_message: errorMessage || null,
    })
    if (error) throw error
    return { status: 'logged' }
  } catch (error) {
    console.warn(`Data room API log failed (${endpoint}): ${error.message}`)
    return { status: 'failed', message: error.message }
  }
}

function isQuotaExceededError(error) {
  return error?.status === 403 && /quota/i.test(String(error.message || ''))
}

app.post('/youtube/channel', async (request, response, next) => {
  const endpoint = '/youtube/channel'
  const lookup = String(request.body?.lookup || '').trim()
  try {
    if (!lookup) throw httpError(400, 'lookup is required.')

    const channel = await fetchYouTubeChannelSnapshot(lookup)
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-CHN-001',
      provider: 'youtube-data-api',
      endpoint,
      query: lookup,
      platform: 'YouTube',
      requestPayload: { lookup },
      responsePayload: { data: channel },
      resultCount: channel ? 1 : 0,
    })
    response.json({ data: channel })
  } catch (error) {
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-CHN-001',
      provider: 'youtube-data-api',
      endpoint,
      query: lookup,
      platform: 'YouTube',
      requestPayload: { lookup },
      responsePayload: getErrorLogPayload(error),
      status: 'failed',
      errorMessage: error.message,
    })
    next(error)
  }
})

app.post('/discovery/youtube/search', async (request, response, next) => {
  const endpoint = '/discovery/youtube/search'
  const query = String(request.body?.query || '').trim()
  const country = String(request.body?.country || 'KR').trim()
  const maxResults = clamp(Number(request.body?.maxResults || 24), 1, DISCOVERY_RESULT_LIMIT)
  try {
    if (!query) throw httpError(400, 'query is required.')

    const creators = await searchYouTubeCreators(query, maxResults, country)
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-SEARCH-001',
      provider: 'youtube-data-api',
      endpoint,
      query,
      platform: 'YouTube',
      country,
      requestPayload: { query, country, maxResults },
      responsePayload: { data: creators },
      resultCount: creators.length,
    })
    response.json({ data: creators })
  } catch (error) {
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-SEARCH-001',
      provider: 'youtube-data-api',
      endpoint,
      query,
      platform: 'YouTube',
      country,
      requestPayload: { query, country, maxResults },
      responsePayload: getErrorLogPayload(error),
      status: 'failed',
      errorMessage: error.message,
    })
    next(error)
  }
})

app.post('/discovery/google-profiles/search', async (request, response, next) => {
  const endpoint = '/discovery/google-profiles/search'
  const query = String(request.body?.query || '').trim()
  const platform = normalizeProfileDiscoveryPlatform(request.body?.platform || 'all')
  const country = String(request.body?.country || 'KR').trim()
  const maxResults = clamp(Number(request.body?.maxResults || 24), 1, DISCOVERY_RESULT_LIMIT)
  try {
    if (!query) throw httpError(400, 'query is required.')

    const profiles = await searchGoogleProfiles(query, platform, maxResults, country)
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-SEARCH-001',
      provider: 'google-custom-search',
      endpoint,
      query,
      platform,
      country,
      requestPayload: { query, platform, country, maxResults },
      responsePayload: { data: profiles },
      resultCount: profiles.length,
    })
    response.json({ data: profiles })
  } catch (error) {
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-SEARCH-001',
      provider: 'google-custom-search',
      endpoint,
      query,
      platform,
      country,
      requestPayload: { query, platform, country, maxResults },
      responsePayload: getErrorLogPayload(error),
      status: 'failed',
      errorMessage: error.message,
    })
    next(error)
  }
})

app.post('/references/search', async (request, response, next) => {
  const endpoint = '/references/search'
  const query = String(request.body?.query || '').trim()
  const country = String(request.body?.country || 'KR').trim()
  const platform = String(request.body?.platform || 'YouTube').trim()
  const sort = String(request.body?.sort || 'virality').trim()
  const maxResults = clamp(Number(request.body?.maxResults || 36), 1, REFERENCE_RESULT_LIMIT)
  try {
    if (!query) throw httpError(400, 'query is required.')

    const references = await searchContentReferences({ query, country, platform, sort, maxResults })
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-REF-001',
      provider: 'content-reference-search',
      endpoint,
      query,
      platform,
      country,
      requestPayload: { query, country, platform, sort, maxResults },
      responsePayload: { references },
      resultCount: references.length,
    })
    response.json({ data: { references } })
  } catch (error) {
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-REF-001',
      provider: 'content-reference-search',
      endpoint,
      query,
      platform,
      country,
      requestPayload: { query, country, platform, sort, maxResults },
      responsePayload: getErrorLogPayload(error),
      status: 'failed',
      errorMessage: error.message,
    })
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

app.post('/ai/recommendations/enrich', async (request, response, next) => {
  try {
    const { brand, campaign, candidates } = request.body || {}
    const safeCandidates = Array.isArray(candidates) ? candidates.slice(0, 50) : []
    if (!safeCandidates.length) throw httpError(400, 'candidates are required.')

    const prompt = buildRecommendationEnrichmentPrompt({ brand, campaign, candidates: safeCandidates })
    const rawText = await callOpenAIText(prompt)
    const parsed = parseAiJsonObject(rawText)
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(normalizeRecommendationEnrichmentItem).filter(Boolean)
      : []

    response.json({
      data: {
        items,
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        promptVersion: 'recommendation-enrichment-v1',
        sourceRawIds: ['RAW-INT-CMP-BRIEF-001', 'RAW-INT-BRD-001', 'RAW-INT-INF-001', 'RAW-INT-AI-POLICY-001'],
        metricIds: ['MET-AI-001', 'MET-AI-003', 'MET-AI-004', 'MET-AI-006', 'MET-LLM-001', 'MET-LLM-002'],
      },
    })
  } catch (error) {
    next(error)
  }
})

app.post('/public/profile-snapshot', async (request, response, next) => {
  const endpoint = '/public/profile-snapshot'
  const url = String(request.body?.url || '').trim()
  const platform = inferReferencePlatform(url)
  try {
    if (!url) throw httpError(400, 'url is required.')

    const snapshot = await fetchPublicProfileSnapshot(url)
    await safeLogExternalCollectionEvent({
      rawSourceId: isSupportedReferenceContentUrl(url, platform) ? 'RAW-EXT-CONT-001' : 'RAW-EXT-CHN-001',
      provider: 'public-profile-snapshot',
      endpoint,
      query: url,
      platform,
      requestPayload: { url },
      responsePayload: { data: snapshot },
      resultCount: snapshot ? 1 : 0,
    })
    response.json({ data: snapshot })
  } catch (error) {
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-CHN-001',
      provider: 'public-profile-snapshot',
      endpoint,
      query: url,
      platform,
      requestPayload: { url },
      responsePayload: getErrorLogPayload(error),
      status: 'failed',
      errorMessage: error.message,
    })
    next(error)
  }
})

app.post('/tracking/refresh', async (request, response, next) => {
  const endpoint = '/tracking/refresh'
  const posts = Array.isArray(request.body?.posts) ? request.body.posts : []
  try {
    const refreshed = await refreshTrackedPosts(posts)
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-CONT-001',
      provider: 'tracking-refresh',
      endpoint,
      query: `${posts.length} posts`,
      requestPayload: { posts },
      responsePayload: { posts: refreshed },
      resultCount: refreshed.length,
    })
    response.json({ data: { posts: refreshed } })
  } catch (error) {
    await safeLogExternalCollectionEvent({
      rawSourceId: 'RAW-EXT-CONT-001',
      provider: 'tracking-refresh',
      endpoint,
      query: `${posts.length} posts`,
      requestPayload: { posts },
      responsePayload: getErrorLogPayload(error),
      status: 'failed',
      errorMessage: error.message,
    })
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
  const cacheKey = getSearchCacheKey('youtube-creators', { query, maxResults, country })
  const cached = readSearchCache(cacheKey)
  if (cached) return cached

  const results = []
  const seen = new Set()
  const searchLimit = Math.min(Math.max(maxResults * 4, maxResults), DISCOVERY_RESULT_LIMIT)

  try {
    for (const searchQuery of buildCreatorDiscoveryQueries(query)) {
      const [channelCreators, contentCreators] = await Promise.all([
        fetchYouTubeCreatorsForQuery(searchQuery, searchLimit, country),
        fetchYouTubeCreatorsFromVideosForQuery(searchQuery, searchLimit, country),
      ])
      const creators = [...contentCreators, ...channelCreators]
      for (const creator of creators) {
        const key = creator.channelId || creator.id || creator.profileUrl
        if (!key || seen.has(key)) continue
        seen.add(key)
        results.push(creator)
      }
    }

    const creators = filterAndRankDiscoveryIntent(filterProductSpecificEvidence(results, query), query)
      .filter(passesMinimumDiscoveryScale)
      .slice(0, maxResults)
    writeSearchCache(cacheKey, creators)
    return creators
  } catch (error) {
    const stale = readSearchCache(cacheKey, { allowStale: true })
    if (stale && isQuotaExceededError(error)) return stale
    throw error
  }
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

async function fetchYouTubeCreatorsFromVideosForQuery(query, maxResults, country = 'KR') {
  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const regionCode = normalizeRegionCode(country) || 'KR'
  const channelEvidence = new Map()
  let pageToken = ''

  while (channelEvidence.size < maxResults) {
    const searchParams = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults: String(Math.min(50, maxResults - channelEvidence.size)),
      order: 'relevance',
      safeSearch: 'none',
      regionCode,
      relevanceLanguage: getDiscoveryLanguage(regionCode),
      key,
    })
    if (pageToken) searchParams.set('pageToken', pageToken)

    const searchPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
    for (const item of searchPayload.items || []) {
      const channelId = item.snippet?.channelId
      if (!channelId || channelEvidence.has(channelId)) continue
      channelEvidence.set(channelId, {
        sourceTitle: item.snippet?.title || '',
        sourceSnippet: item.snippet?.description || '',
        matchedVideoId: item.id?.videoId || '',
        matchedVideoUrl: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : '',
      })
    }
    pageToken = searchPayload.nextPageToken || ''
    if (!pageToken) break
  }

  const channelIds = [...channelEvidence.keys()].slice(0, maxResults)
  if (!channelIds.length) return []

  const channels = []
  for (const idChunk of chunkArray(channelIds, 50)) {
    const channelParams = new URLSearchParams({
      part: 'snippet,statistics',
      id: idChunk.join(','),
      key,
    })
    const channelPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${channelParams}`)
    channels.push(...(channelPayload.items || []))
  }

  return channels.map((channel) => {
    const evidence = channelEvidence.get(channel.id) || {}
    return {
      ...normalizeYouTubeChannel(channel, {}, regionCode),
      source: 'YouTube Data API search.list(video) + channels.list',
      sourceTitle: evidence.sourceTitle,
      sourceSnippet: evidence.sourceSnippet,
      matchedContentUrl: evidence.matchedVideoUrl,
      matchedVideoId: evidence.matchedVideoId,
    }
  })
}

function buildCreatorDiscoveryQueries(query) {
  const cleanQuery = compactDiscoveryQuery(query)
  const aliasedQuery = expandProductSearchAliases(cleanQuery)
  const queries = [cleanQuery, aliasedQuery, `${aliasedQuery} review`, `${aliasedQuery} influencer`]
  const lower = cleanQuery.toLowerCase()
  if (hasBeautyDiscoveryIntent(lower)) {
    queries.push('Korean beauty review', 'beauty review Korea', 'K beauty creator', '\uD55C\uAD6D \uBDF0\uD2F0 \uB9AC\uBDF0', '\uC2A4\uD0A8\uCF00\uC5B4 \uB9AC\uBDF0')
  }
  if (hasPetDiscoveryIntent(lower)) {
    queries.push('Korean pet channel', 'dog product review Korea', 'pet creator Korea', '\uBC18\uB824\uACAC \uB9AC\uBDF0')
  }
  if (hasFoodDiscoveryIntent(lower)) {
    queries.push('Korean food review', 'food creator Korea', '\uD55C\uAD6D \uC694\uB9AC \uB9AC\uBDF0')
  }
  if (hasFashionDiscoveryIntent(lower)) {
    queries.push('Korean fashion creator', 'fashion review Korea', '\uD328\uC158 \uB8E9\uBD81')
  }

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

  return [...new Set(queries.filter(Boolean))].slice(0, 8)
}

function hasBeautyDiscoveryIntent(text) {
  return /beauty|makeup|skincare|cosmetic|cosmetics|serum|\uBDF0\uD2F0|\uD654\uC7A5\uD488|\uBA54\uC774\uD06C\uC5C5|\uC2A4\uD0A8\uCF00\uC5B4|\uC138\uB7FC|\uC7A5\uBCBD|\uBBFC\uAC10/.test(text)
}

function hasPetDiscoveryIntent(text) {
  return /pet|dog|cat|kennel|carrier|crate|\uBC18\uB824|\uAC15\uC544\uC9C0|\uACE0\uC591\uC774|\uCF04\uB12C|\uC774\uB3D9\uC7A5/.test(text)
}

function hasFoodDiscoveryIntent(text) {
  return /food|cook|cooking|recipe|snack|meal|home\s*cook|home\s*meal|\uD478\uB4DC|\uC694\uB9AC|\uB808\uC2DC\uD53C|\uC74C\uC2DD|\uAC04\uC2DD|\uB9DB\uC9D1|\uBC00\uD0A4\uD2B8|\uC9D1\uBC25|\uD648\uCFE1|\uBC18\uCC2C|\uB3C4\uC2DC\uB77D|\uD55C\uC2DD/.test(text)
}

function hasFashionDiscoveryIntent(text) {
  return /fashion|lookbook|style|outfit|\uD328\uC158|\uB8E9\uBD81|\uC758\uB958|\uC2A4\uD0C0\uC77C/.test(text)
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
      }).catch((error) => {
        if (isRecoverableReferenceSearchError(error)) return []
        throw error
      })
      results.push(...youtubeResults)
      continue
    }

    if (targetPlatform === 'TikTok' && isTikTokCommercialContentConfigured()) {
      const tiktokResults = await searchTikTokCommercialContentReferences({
        query,
        country,
        maxResults: perPlatformLimit,
      }).catch((error) => {
        if ([400, 401, 403, 404, 429].includes(error.status)) return []
        throw error
      })
      results.push(...tiktokResults)
      if (tiktokResults.length >= perPlatformLimit) continue
    }

    if (!process.env.BRAVE_SEARCH_API_KEY) {
      continue
    }

    const webResults = await searchWebContentReferences({
      query,
      country,
      platform: targetPlatform,
      maxResults: perPlatformLimit,
    }).catch((error) => {
      if (isRecoverableReferenceSearchError(error)) return []
      throw error
    })
    results.push(...webResults)
  }

  const deduped = filterProductSpecificEvidence(dedupeContentReferences(results), query)
  const qualified = filterReferenceQuality(deduped, query)
  const relaxed = qualified.length ? qualified : buildRelaxedContentReferences(deduped, query)
  const relevant = filterAndRankDiscoveryIntent(relaxed, query)
  const finalResults = relevant.length ? relevant : hasProductSpecificEvidenceTerms(query) ? [] : relaxed
  debugReferenceSearch('summary', {
    query,
    country,
    platform,
    normalizedPlatform,
    raw: results.length,
    deduped: deduped.length,
    qualified: qualified.length,
    relaxed: relaxed.length,
    relevant: relevant.length,
    final: finalResults.length,
  })
  return sortContentReferences(finalResults, sort).slice(0, maxResults)
}

function debugReferenceSearch(label, payload) {
  if (String(process.env.DEBUG_REFERENCE_SEARCH || '').toLowerCase() !== 'true') return
  console.log(`[reference:${label}] ${JSON.stringify(payload)}`)
}

async function searchYouTubeVideoReferences({ query, country, sort, maxResults }) {
  const cacheKey = getSearchCacheKey('youtube-references', { query, country, sort, maxResults })
  const cached = readSearchCache(cacheKey)
  if (cached) {
    const validatedCache = hasProductSpecificEvidenceTerms(query)
      ? filterProductSpecificEvidence(cached, query)
      : cached
    if (validatedCache.length) return validatedCache
  }

  const key = requireEnv('YOUTUBE_DATA_API_KEY')
  const regionCode = normalizeRegionCode(country)
  const videoIds = []
  const searchLimit = Math.min(Math.max(maxResults * 4, maxResults), 100)

  try {
    for (const searchQuery of buildYouTubeReferenceQueries(query)) {
      const searchParams = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q: searchQuery,
        maxResults: String(Math.min(25, searchLimit - videoIds.length)),
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
      if (videoIds.length >= searchLimit) break
    }

    const uniqueVideoIds = [...new Set(videoIds)].slice(0, searchLimit)
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

    const normalizedReferences = videos.map((item) => normalizeYouTubeReference(item, channelMap, regionCode || country || 'GLOBAL'))
    const evidenceReferences = hasProductSpecificEvidenceTerms(query)
      ? filterProductSpecificEvidence(normalizedReferences, query)
      : normalizedReferences
    const references = filterAndRankDiscoveryIntent(evidenceReferences, query).slice(0, maxResults)
    writeSearchCache(cacheKey, references)
    return references
  } catch (error) {
    const stale = readSearchCache(cacheKey, { allowStale: true })
    if (stale && isQuotaExceededError(error)) return stale
    throw error
  }
}

function buildYouTubeReferenceQueries(query) {
  const cleanQuery = compactDiscoveryQuery(query)
  const aliasedQuery = expandProductSearchAliases(cleanQuery)
  const lower = aliasedQuery.toLowerCase()
  const hasProductTerms = hasProductSpecificEvidenceTerms(query)
  const queries = [
    cleanQuery,
    aliasedQuery,
    `${aliasedQuery} review`,
    `${aliasedQuery} shorts`,
    `${aliasedQuery} comparison`,
    `${aliasedQuery} how to`,
  ].filter(Boolean)
  if (!hasProductTerms && hasBeautyDiscoveryIntent(lower)) {
    queries.push('Korean skincare review shorts', 'K beauty serum review', '\uC2A4\uD0A8\uCF00\uC5B4 \uB9AC\uBDF0 \uC20F\uCE20')
  }
  if (!hasProductTerms && hasPetDiscoveryIntent(lower)) {
    queries.push('Korean pet product review shorts', '\uBC18\uB824\uACAC \uC81C\uD488 \uB9AC\uBDF0 \uC20F\uCE20')
  }
  if (!hasProductTerms && hasFoodDiscoveryIntent(lower)) {
    queries.push('Korean food review shorts', '\uC694\uB9AC \uB808\uC2DC\uD53C \uC20F\uCE20')
  }
  return [...new Set(queries.filter(Boolean))]
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

function isTikTokCommercialContentConfigured() {
  return Boolean(
    process.env.TIKTOK_COMMERCIAL_ACCESS_TOKEN ||
    (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
  )
}

async function getTikTokCommercialAccessToken() {
  if (process.env.TIKTOK_COMMERCIAL_ACCESS_TOKEN) {
    return process.env.TIKTOK_COMMERCIAL_ACCESS_TOKEN
  }

  if (tiktokCommercialTokenCache.token && tiktokCommercialTokenCache.expiresAt > Date.now() + 60000) {
    return tiktokCommercialTokenCache.token
  }

  const clientKey = requireEnv('TIKTOK_CLIENT_KEY')
  const clientSecret = requireEnv('TIKTOK_CLIENT_SECRET')
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  })

  const payload = await fetchJson('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const token = payload.access_token
  if (!token) throw httpError(502, 'TikTok client access token was not returned.')

  const ttlMs = Math.max(Number(payload.expires_in || 7200) - 120, 60) * 1000
  tiktokCommercialTokenCache = {
    token,
    expiresAt: Date.now() + ttlMs,
  }
  return token
}

async function searchTikTokCommercialContentReferences({ query, country, maxResults }) {
  const token = await getTikTokCommercialAccessToken()
  const regionCode = normalizeRegionCode(country)
  const fields = 'id,create_date,create_timestamp,label,brand_names,creator,videos'
  const maxCount = Math.min(50, Math.max(1, Number(maxResults || 10)))
  const results = []
  let searchId = ''

  for (let page = 0; page < Math.ceil(maxResults / maxCount) && results.length < maxResults; page += 1) {
    const body = {
      filters: {
        content_published_date_range: getTikTokCommercialDateRange(),
      },
      max_count: maxCount,
    }

    if (isSupportedTikTokCommercialCountry(regionCode)) {
      body.filters.creator_country_code = regionCode
    }
    if (searchId) body.search_id = searchId

    const params = new URLSearchParams({ fields })
    const payload = await fetchJson(`https://open.tiktokapis.com/v2/research/adlib/commercial_content/query/?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const pageItems = payload.data?.commercial_contents || payload.commercial_contents || []
    results.push(
      ...pageItems
        .map((item) => normalizeTikTokCommercialContentReference(item, regionCode || country || 'GLOBAL'))
        .filter(Boolean)
        .filter((item) => matchesReferenceQuery(item, query)),
    )

    const hasMore = Boolean(payload.data?.has_more || payload.has_more)
    searchId = payload.data?.search_id || payload.search_id || searchId
    if (!hasMore || !searchId) break
  }

  return results.slice(0, maxResults)
}

function normalizeTikTokCommercialContentReference(item, country) {
  const creator = item.creator || {}
  const videos = Array.isArray(item.videos) ? item.videos : Array.isArray(item.video) ? item.video : []
  const video = videos[0] || {}
  const username = creator.username || creator.display_name || creator.handle || ''
  const creatorHandle = username ? `@${String(username).replace(/^@/, '')}` : ''
  const brandNames = Array.isArray(item.brand_names) ? item.brand_names.filter(Boolean) : []
  const label = Array.isArray(item.label) ? item.label.join(', ') : String(item.label || '')
  const titleParts = [brandNames.join(', '), creatorHandle, label].filter(Boolean)
  const title = titleParts.length ? titleParts.join(' - ') : `TikTok commercial content ${item.id || ''}`.trim()
  const videoId = video.id || item.id || ''
  const url = video.url || video.share_url || (creatorHandle && videoId ? `https://www.tiktok.com/${creatorHandle}/video/${videoId}` : '')
  const publishedAt = normalizeTikTokCommercialDate(item.create_date, item.create_timestamp)
  const detectedCountry = detectProfileCountry({
    profileUrl: url,
    title,
    snippet: label,
    handle: creatorHandle,
  })

  return {
    id: `ttcommercial:${item.id || videoId || url}`,
    mediaType: '\uC601\uC0C1',
    platform: 'TikTok',
    country: detectedCountry || country || 'GLOBAL',
    searchCountry: country || '',
    countryConfidence: detectedCountry ? 'detected' : isSupportedTikTokCommercialCountry(country) ? 'official' : 'unverified',
    title,
    url,
    thumbnailUrl: video.cover_image_url || video.thumbnail_url || '',
    views: Number(video.view_count || video.views || 0) || null,
    accountFollowers: Number(creator.followers_count || creator.follower_count || creator.followers || 0) || null,
    likes: Number(video.like_count || video.likes || 0) || null,
    comments: Number(video.comment_count || video.comments || 0) || null,
    shares: Number(video.share_count || video.shares || 0) || null,
    publishedAt,
    hook: buildReferenceHook(title, label),
    analysis: 'TikTok Commercial Content API result. Use this as an official-reference signal for branded or paid content formats, then verify engagement metrics before final selection.',
    applyIdea: 'Borrow the creator framing, brand disclosure pattern, opening hook, and product proof sequence for the campaign guide.',
    channelTitle: creatorHandle,
    source: 'TikTok Commercial Content API',
    confidence: 88,
  }
}

function getTikTokCommercialDateRange() {
  const days = clamp(Number(process.env.TIKTOK_COMMERCIAL_DATE_WINDOW_DAYS || 365), 1, 1200)
  const maxDate = new Date()
  const minDate = new Date(maxDate)
  minDate.setUTCDate(maxDate.getUTCDate() - days)
  const earliest = new Date(Date.UTC(2022, 9, 2))
  if (minDate < earliest) minDate.setTime(earliest.getTime())
  return {
    min: formatTikTokCommercialDate(minDate),
    max: formatTikTokCommercialDate(maxDate),
  }
}

function formatTikTokCommercialDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

function normalizeTikTokCommercialDate(dateValue, timestampValue) {
  const direct = String(dateValue || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct
  if (/^\d{8}$/.test(direct)) return `${direct.slice(0, 4)}-${direct.slice(4, 6)}-${direct.slice(6, 8)}`
  const timestamp = Number(timestampValue || 0)
  if (timestamp > 0) {
    const ms = timestamp > 100000000000 ? timestamp : timestamp * 1000
    return new Date(ms).toISOString().slice(0, 10)
  }
  return 'public API result'
}

function isSupportedTikTokCommercialCountry(country) {
  return new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL',
    'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  ]).has(normalizeRegionCode(country))
}

function matchesReferenceQuery(reference, query) {
  const haystack = normalizeTextForSearch([
    reference.title,
    reference.hook,
    reference.analysis,
    reference.applyIdea,
    reference.channelTitle,
    reference.url,
  ].filter(Boolean).join(' '))
  const tokens = getReferenceQueryTokens(query)
  if (!tokens.length) return true
  return tokens.some((token) => textIncludesReferenceToken(haystack, token))
}

function isRecoverableReferenceSearchError(error) {
  return [400, 401, 403, 408, 409, 422, 429, 500, 502, 503, 504].includes(Number(error?.status || 0))
}

function normalizeTextForSearch(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}\s@#_-]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function getReferenceQueryTokens(query) {
  const cleanQuery = normalizeTextForSearch(query)
  const lowerQuery = String(query || '').toLowerCase()
  const context = buildDiscoveryIntentContext(query)
  const categoryTerms = inferDiscoveryCategoryTerms(lowerQuery).flatMap((term) => normalizeTextForSearch(term).split(/\s+/))
  const categoryAliases = []

  if (hasBeautyDiscoveryIntent(lowerQuery)) {
    categoryAliases.push('beauty', 'kbeauty', 'k-beauty', 'skincare', 'skin-care', 'makeup', 'cosmetic', 'cosmetics', 'oliveyoung')
  }
  if (hasFoodDiscoveryIntent(lowerQuery)) {
    categoryAliases.push('food', 'recipe', 'cook', 'cooking', 'homecook', 'homecooking', 'koreanfood', 'k-food')
  }
  if (hasPetDiscoveryIntent(lowerQuery)) {
    categoryAliases.push('pet', 'dog', 'cat', 'puppy', 'kitten', 'kennel', 'carrier', 'crate')
  }
  if (hasFashionDiscoveryIntent(lowerQuery)) {
    categoryAliases.push('fashion', 'style', 'lookbook', 'outfit')
  }

  return [...new Set([
    ...cleanQuery.split(/\s+/),
    ...context.tokens,
    ...categoryTerms,
    ...categoryAliases,
  ]
    .map((token) => normalizeTextForSearch(token))
    .filter((token) => token.length > 1))]
}

function textIncludesReferenceToken(text, token) {
  if (!token) return false
  if (text.includes(token)) return true
  const compactText = text.replace(/[\s_-]+/g, '')
  const compactToken = token.replace(/[\s_-]+/g, '')
  return compactToken.length > 1 && compactText.includes(compactToken)
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
  const rawResultLimit = Math.max(maxResults * 10, 80)

  for (const referenceQuery of buildReferenceSearchQueries(siteQuery, query, platform)) {
    for (let page = 0; page < Math.ceil(maxResults / 20) && items.length < rawResultLimit; page += 1) {
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
      }).catch((error) => {
        if ([400, 422].includes(error.status)) return { web: { results: [] } }
        throw error
      })
      const pageItems = payload.web?.results || []
      debugReferenceSearch('brave-page', {
        platform,
        referenceQuery,
        page,
        count: pageItems.length,
        sample: pageItems.slice(0, 3).map((item) => item.url || item.link || ''),
      })
      items.push(...pageItems)
      if (pageItems.length < 20) break
    }
  }

  const normalized = items
    .map((item) => normalizeWebReferenceSearchItem(item, platform, regionCode || country || 'GLOBAL', query))
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, Math.max(maxResults * 2, maxResults))
  debugReferenceSearch('normalized', {
    platform,
    rawItems: items.length,
    normalized: normalized.length,
    sample: normalized.slice(0, 5).map((item) => item.url),
  })

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
  const lowerQuery = cleanQuery.toLowerCase()
  const categoryTerms = inferDiscoveryCategoryTerms(lowerQuery)
  const platformBoost =
    platform === 'Instagram'
      ? '-inurl:/explore/ -inurl:/accounts/ -inurl:/tags/'
      : platform === 'TikTok'
        ? '-inurl:/music/ -inurl:/tag/ -inurl:/discover/ -inurl:/live/'
        : ''
  const queries = [
    `${siteQuery} ${cleanQuery} ${platformBoost}`.trim(),
    `${siteQuery} "${cleanQuery}" ${platformBoost}`.trim(),
    `${siteQuery} ${cleanQuery} viral popular ${platformBoost}`.trim(),
  ]

  if (['Instagram', 'TikTok', 'all'].includes(platform)) {
    if (hasBeautyDiscoveryIntent(lowerQuery)) {
      queries.push(
        `${siteQuery} kbeauty skincare viral ${platformBoost}`.trim(),
        `${siteQuery} korean skincare review viral ${platformBoost}`.trim(),
        platform === 'TikTok' ? 'kbeauty tiktok viral' : '',
        platform === 'TikTok' ? 'skincare routine tiktok viral' : '',
        platform === 'TikTok' ? 'tiktok beauty review viral' : '',
        platform === 'Instagram' ? 'kbeauty instagram reel viral' : '',
        platform === 'Instagram' ? 'skincare instagram reel viral' : '',
      )
    }
    if (hasFoodDiscoveryIntent(lowerQuery)) {
      queries.push(
        `${siteQuery} "${cleanQuery}" "\uC9D1\uBC25" ${platformBoost}`.trim(),
        `${siteQuery} "\uC9D1\uBC25" "\uB808\uC2DC\uD53C" ${platformBoost}`.trim(),
        `${siteQuery} "\uC9D1\uBC25" "\uBC18\uCC2C" ${platformBoost}`.trim(),
        `${siteQuery} "\uC9D1\uBC25" "\uB3C4\uC2DC\uB77D" ${platformBoost}`.trim(),
        `${siteQuery} korean food recipe viral ${platformBoost}`.trim(),
        `${siteQuery} food review viral ${platformBoost}`.trim(),
        platform === 'TikTok' ? 'korean food tiktok viral' : '',
        platform === 'TikTok' ? 'home cooking tiktok viral' : '',
        platform === 'Instagram' ? 'korean food instagram reel viral' : '',
      )
    }
    if (hasPetDiscoveryIntent(lowerQuery)) {
      queries.push(
        `${siteQuery} pet product review viral ${platformBoost}`.trim(),
        `${siteQuery} dog product review viral ${platformBoost}`.trim(),
        platform === 'TikTok' ? 'pet product tiktok viral' : '',
        platform === 'Instagram' ? 'pet product instagram reel viral' : '',
      )
    }
    categoryTerms.forEach((term) => {
      queries.push(`${siteQuery} "${term}" viral ${platformBoost}`.trim())
      if (platform === 'TikTok') queries.push(`${term} tiktok viral`)
      if (platform === 'Instagram') queries.push(`${term} instagram reel viral`)
    })
  }

  return [...new Set(queries.filter(Boolean))]
}

function normalizeWebReferenceSearchItem(item, platform, country, query = '') {
  const url = item.url || item.link || ''
  if (!url) return null
  const inferredPlatform = platform === 'all' ? inferReferencePlatform(url) : platform
  if (!['Instagram', 'TikTok'].includes(inferredPlatform)) return null
  if (!isSupportedReferenceContentUrl(url, inferredPlatform)) return null

  const title = cleanReferenceText(item.title || '')
  const description = cleanReferenceText(item.description || item.snippet || '')
  if (isLowValueReferenceResult({ title, description, url, platform: inferredPlatform })) return null

  const metrics = extractPublicMetrics(`${title} ${description}`)
  const analysis = isLowValueReferenceText(description)
    ? '공개 검색 결과에서 콘텐츠 URL을 확인했습니다. 세부 성과 지표는 플랫폼 API 또는 수동 확인이 필요합니다.'
    : description
  const detectedCountry = detectProfileCountry({ profileUrl: url, title, snippet: description })

  const reference = {
    id: `webref:${inferredPlatform}:${url}`,
    mediaType: inferReferenceMediaType(url, inferredPlatform),
    platform: inferredPlatform,
    country: detectedCountry,
    searchCountry: country || '',
    countryConfidence: detectedCountry ? 'detected' : 'unverified',
    title: title || `${inferredPlatform} reference`,
    url,
    thumbnailUrl: selectReferenceThumbnail(item.thumbnail?.src, item.profile?.img),
    views: metrics.views,
    accountFollowers: metrics.followers,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    publishedAt: 'public search result',
    hook: buildReferenceHook(title, description),
    analysis: analysis || '공개 검색 결과에서 콘텐츠 URL을 확인했습니다. 세부 성과 지표는 플랫폼 API 또는 수동 확인이 필요합니다.',
    applyIdea: 'Use the hook, thumbnail structure, caption angle, and comment-driving question as a production reference.',
    source: 'Brave Search API',
    confidence: 72,
  }
  return {
    ...reference,
    referenceQualityScore: scoreReferenceQuality(reference, query),
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
  const combinedText = `${normalizedTitle} ${normalizedDescription}`

  if (!normalizedTitle && !normalizedDescription) return true
  if (/(^|[\s(])@?reel\b/i.test(normalizedTitle)) return true
  if (/reel raffle/i.test(normalizedTitle)) return true
  if (/(instagram photos and videos|create an account or log in to instagram|view this post on instagram)/i.test(combinedText)) return true
  if (/(tiktok - make your day|tiktok - trends start here|watch trending videos|log in to tiktok|download tiktok)/i.test(normalizedTitle)) return true
  if (isPlatformLogoThumbnail(url)) return true

  if (platform === 'Instagram' && ['instagram', 'instagram reels'].includes(normalizedTitle)) return true
  if (platform === 'TikTok' && ['tiktok', 'tiktok video'].includes(normalizedTitle)) return true
  return false
}

function isLowValueReferenceText(value) {
  return /we cannot provide a description|create an account or log in|instagram photos and videos|watch trending videos|download tiktok/i.test(String(value || ''))
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

function filterReferenceQuality(items, query) {
  return items
    .map((item) => ({
      ...item,
      referenceQualityScore: scoreReferenceQuality(item, query),
    }))
    .filter((item) => isUsableContentReference(item, query))
    .sort((a, b) => Number(b.referenceQualityScore || 0) - Number(a.referenceQualityScore || 0))
}

function buildRelaxedContentReferences(items, query) {
  return items
    .filter((item) => isRelaxedUsableContentReference(item, query))
    .map((item) => ({
      ...item,
      source: `${item.source || 'Public search'} · verification required`,
      analysis:
        item.analysis ||
        '공개 검색 결과에서 콘텐츠 URL을 찾았습니다. 조회수/팔로워/공유 수치는 플랫폼 정책상 추가 스냅샷 또는 수동 검증이 필요합니다.',
      referenceQualityScore: Math.max(scoreReferenceQuality(item, query), matchesReferenceQuery(item, query) ? 52 : 45),
    }))
    .sort((a, b) => Number(b.referenceQualityScore || 0) - Number(a.referenceQualityScore || 0))
}

function isRelaxedUsableContentReference(item = {}, query = '') {
  if (!item.url || !item.title) return false
  const platform = item.platform || inferReferencePlatform(item.url)
  if (!['Instagram', 'TikTok'].includes(platform)) return false
  if (!isSupportedReferenceContentUrl(item.url, platform)) return false
  if (getReferenceQueryTokens(query).length && !matchesReferenceQuery(item, query)) return false
  if (isLowValueReferenceResult({
    title: item.title,
    description: item.analysis || item.hook || '',
    url: item.thumbnailUrl || item.url,
    platform,
  })) return false
  return true
}

function isUsableContentReference(item = {}, query = '') {
  if (!item.url || !item.title) return false
  const platform = item.platform || inferReferencePlatform(item.url)
  if (['Instagram', 'TikTok'].includes(platform)) {
    if (!isSupportedReferenceContentUrl(item.url, platform)) return false
    if (isLowValueReferenceResult({
      title: item.title,
      description: item.analysis || item.hook || '',
      url: item.thumbnailUrl || item.url,
      platform,
    })) return false
    const knownEngagement = [
      item.views,
      item.likes,
      item.comments,
      item.shares,
      item.accountFollowers,
    ].some((value) => Number(value || 0) > 0)
    const knownContentEngagement = [
      item.views,
      item.likes,
      item.comments,
      item.shares,
    ].some((value) => Number(value || 0) > 0)
    if (!item.thumbnailUrl && !knownContentEngagement) return false
    if (/brave search api/i.test(String(item.source || '')) && !item.thumbnailUrl && !knownEngagement) return false
    if (!item.thumbnailUrl && isLowValueReferenceText(`${item.title} ${item.analysis || ''}`)) return false
    if (getReferenceQueryTokens(query).length && !matchesReferenceQuery(item, query)) return false
  }
  return scoreReferenceQuality(item, query) >= MIN_REFERENCE_QUALITY_SCORE
}

function scoreReferenceQuality(item = {}, query = '') {
  const platform = item.platform || inferReferencePlatform(item.url)
  let score = 0
  if (item.url) score += 10
  if (!['Instagram', 'TikTok'].includes(platform) || isSupportedReferenceContentUrl(item.url, platform)) score += 25
  if (item.thumbnailUrl && !isPlatformLogoThumbnail(item.thumbnailUrl)) score += 20
  if (item.title && !isGenericReferenceTitle(item.title, platform)) score += 18
  if (matchesReferenceQuery(item, query)) score += 12

  const views = Number(item.views || 0)
  const followers = Number(item.accountFollowers || item.followers || 0)
  const engagement = Number(item.likes || 0) + Number(item.comments || 0) + Number(item.shares || 0)
  if (views >= MIN_REFERENCE_KNOWN_VIEWS) score += Math.min(22, Math.log10(views) * 4)
  if (followers > 0 && views > 0) score += Math.min(15, (views / followers) * 4)
  if (engagement > 0) score += Math.min(12, Math.log10(engagement + 1) * 3)
  if (/official|commercial content api|youtube data api/i.test(String(item.source || ''))) score += 8
  if (isLowValueReferenceText(`${item.title || ''} ${item.analysis || ''}`)) score -= 20
  if (isGenericReferenceTitle(item.title, platform)) score -= 25
  if (views > 0 && views < MIN_REFERENCE_KNOWN_VIEWS) score -= 45
  return clamp(Math.round(score), 0, 100)
}

function isGenericReferenceTitle(title, platform) {
  const normalizedTitle = cleanReferenceText(title).toLowerCase()
  if (!normalizedTitle) return true
  if (platform === 'Instagram') {
    return /^(instagram|instagram reels|\(?@?reel\)?|.*instagram photos and videos)$/.test(normalizedTitle)
  }
  if (platform === 'TikTok') {
    return /^(tiktok|tiktok video|tiktok - make your day|tiktok - trends start here)$/.test(normalizedTitle)
  }
  return false
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
      const priorityGap = getReferenceViralPriority(b) - getReferenceViralPriority(a)
      if (priorityGap !== 0) return priorityGap
      const aFollowers = Number(a.accountFollowers || a.followers || 0)
      const bFollowers = Number(b.accountFollowers || b.followers || 0)
      const aRatio = aFollowers ? Number(a.views || 0) / aFollowers : -1
      const bRatio = bFollowers ? Number(b.views || 0) / bFollowers : -1
      if (bRatio !== aRatio) return bRatio - aRatio
      const viewGap = Number(b.views || 0) - Number(a.views || 0)
      if (viewGap !== 0) return viewGap
      const engagementGap = getReferenceEngagement(b) - getReferenceEngagement(a)
      if (engagementGap !== 0) return engagementGap
      return Number(b.referenceQualityScore || 0) - Number(a.referenceQualityScore || 0)
    }
    if (sort === 'shares') return Number(b.shares || 0) - Number(a.shares || 0)
    const viewGap = Number(b.views || 0) - Number(a.views || 0)
    if (viewGap !== 0) return viewGap
    const engagementGap = getReferenceEngagement(b) - getReferenceEngagement(a)
    if (engagementGap !== 0) return engagementGap
    return Number(b.referenceQualityScore || 0) - Number(a.referenceQualityScore || 0)
  })
}

function getReferenceViralPriority(item = {}) {
  const views = Number(item.views || 0)
  const followers = Number(item.accountFollowers || item.followers || 0)
  const ratio = followers ? views / followers : 0
  if (views >= MIN_REFERENCE_KNOWN_VIEWS || ratio >= 5) return 2
  if (!views) return 1
  return 0
}

function getReferenceEngagement(item = {}) {
  return Number(item.likes || 0) + Number(item.comments || 0) + Number(item.shares || 0)
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
  const evidenceResults = filterProductSpecificEvidence(enriched, query)
  if (hasProductSpecificEvidenceTerms(query) && !evidenceResults.length) return []
  return filterProfileDiscoveryResults(evidenceResults, query).slice(0, maxResults)
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
  const aliasedQuery = expandProductSearchAliases(cleanQuery)
  const queries = []
  const lower = aliasedQuery.toLowerCase()
  const categoryTerms = inferDiscoveryCategoryTerms(lower)

  if (platform === 'Instagram') {
    queries.push(`site:instagram.com "${cleanQuery}" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    queries.push(`site:instagram.com "${aliasedQuery}" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    queries.push(`site:instagram.com/reel "${aliasedQuery}"`)
    queries.push(`site:instagram.com/p "${aliasedQuery}"`)
    queries.push(`site:instagram.com ${cleanQuery} influencer creator -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    if (/beauty|makeup|skincare|cosmetic|cosmetics/.test(lower)) {
      queries.push('site:instagram.com "beauty review" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/')
    }
    if (/pet|dog|cat|kennel|carrier|crate/.test(lower)) {
      queries.push('site:instagram.com "pet creator" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/')
    }
    if (hasFoodDiscoveryIntent(lower)) {
      queries.push(`site:instagram.com "\uC9D1\uBC25" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
      queries.push(`site:instagram.com "\uD648\uCFE1" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
      queries.push(`site:instagram.com "\uBC18\uCC2C" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
      queries.push(`site:instagram.com "\uB3C4\uC2DC\uB77D" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    }
    categoryTerms.forEach((term) => {
      queries.push(`site:instagram.com "${term}" "@" -inurl:/p/ -inurl:/reel/ -inurl:/stories/`)
    })
  } else if (platform === 'TikTok') {
    queries.push(`site:tiktok.com/@ "${cleanQuery}" -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
    queries.push(`site:tiktok.com/@ "${aliasedQuery}" -inurl:/music/ -inurl:/tag/`)
    queries.push(`site:tiktok.com/@ "${aliasedQuery}" "/video/"`)
    queries.push(`site:tiktok.com "${aliasedQuery}"`)
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
    if (hasFoodDiscoveryIntent(lower)) {
      queries.push(`site:tiktok.com/@ "\uC9D1\uBC25" -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
      queries.push(`site:tiktok.com/@ "\uD648\uCFE1" -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
      queries.push(`site:tiktok.com/@ "\uBC18\uCC2C" -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
      queries.push(`site:tiktok.com "\uC9D1\uBC25"`)
      queries.push(`site:tiktok.com "\uD648\uCFE1"`)
    }
    categoryTerms.forEach((term) => {
      queries.push(`site:tiktok.com/@ "${term}" -inurl:/video/ -inurl:/music/ -inurl:/tag/`)
    })
  } else {
    queries.push(`${getPlatformSiteQuery(platform)} ${cleanQuery}`.trim())
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 12)
}

function expandProductSearchAliases(query) {
  const cleanQuery = String(query || '').replace(/\s+/g, ' ').trim()
  const lower = cleanQuery.toLowerCase()
  const aliases = []

  if (/\uBC14\uB2D0\uB77C\uCF54|banila/.test(lower)) aliases.push('banila co')
  if (/\uD074\uB80C\uC9D5\s*\uBC24|cleansing\s*balm|clean\s*it\s*zero/.test(lower)) {
    aliases.push('clean it zero', 'cleansing balm')
  }
  if (/\uCF04\uB12C|\uC774\uB3D9\uC7A5|kennel|pet\s*carrier|dog\s*carrier|travel\s*crate|crate/.test(lower)) {
    aliases.push('pet carrier', 'dog carrier', 'kennel crate', '\uAC15\uC544\uC9C0 \uC774\uB3D9\uC7A5')
  }
  if (/\uBDF0\uD2F0|\uD654\uC7A5|\uC2A4\uD0A8\uCF00\uC5B4|beauty|skincare|cosmetic/.test(lower)) {
    aliases.push('k beauty', 'skincare review')
  }

  return [...new Set([cleanQuery, ...aliases].filter(Boolean))]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferDiscoveryCategoryTerms(lowerQuery) {
  const terms = []
  if (hasBeautyDiscoveryIntent(lowerQuery)) {
    terms.push('beauty creator', 'skincare review', 'makeup influencer', '\uBDF0\uD2F0 \uB9AC\uBDF0', '\uC2A4\uD0A8\uCF00\uC5B4')
  }
  if (hasPetDiscoveryIntent(lowerQuery)) {
    terms.push('pet creator', 'dog review', 'pet influencer', '\uBC18\uB824\uACAC \uB9AC\uBDF0')
  }
  if (hasFoodDiscoveryIntent(lowerQuery)) {
    terms.push(
      'food creator',
      'snack review',
      'home cooking',
      'korean food',
      '\uC694\uB9AC \uB808\uC2DC\uD53C',
      '\uC9D1\uBC25',
      '\uD648\uCFE1',
      '\uBC18\uCC2C',
      '\uB3C4\uC2DC\uB77D',
      '\uD55C\uC2DD',
    )
  }
  if (hasFashionDiscoveryIntent(lowerQuery)) {
    terms.push('fashion creator', 'lookbook', '\uD328\uC158 \uB8E9\uBD81')
  }
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
  return [...new Set(terms)]
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
  const evidenceResults = filterProductSpecificEvidence(enriched, query)
  if (hasProductSpecificEvidenceTerms(query) && !evidenceResults.length) return []
  return filterProfileDiscoveryResults(evidenceResults, query).slice(0, maxResults)
}

async function enrichProfileResults(deduped) {
  if (!isPublicSnapshotEnabled()) return deduped

  const priorityHead = deduped.slice(0, PROFILE_SNAPSHOT_ENRICH_LIMIT)
  const untouchedTail = deduped.slice(PROFILE_SNAPSHOT_ENRICH_LIMIT)
  const enriched = await Promise.all(
    priorityHead.map(async (profile) => {
      const snapshot = await fetchPublicProfileSnapshot(profile.profileUrl).catch((error) => ({
        status: 'snapshot_failed',
        message: error.message,
      }))
      return mergeProfileSnapshot(profile, snapshot)
    }),
  )
  return [...enriched, ...untouchedTail]
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
    const tiktokVideoId = extractTikTokVideoId(safeUrl)
    if (tiktokVideoId) {
      const tiktokVideoSnapshot = await fetchTikTokPublicVideoSnapshot(safeUrl).catch(() => null)
      if (tiktokVideoSnapshot?.metrics?.views || tiktokVideoSnapshot?.metrics?.likes) return tiktokVideoSnapshot
    }

    const tiktokSnapshot = await fetchTikTokPublicStatsSnapshot(safeUrl).catch(() => null)
    if (tiktokSnapshot?.metrics?.followers) return tiktokSnapshot
  }

  if (isInstagramUrl(safeUrl) && isInstagramRenderedSnapshotEnabled()) {
    const instagramSnapshot = await fetchInstagramRenderedReelsSnapshot(safeUrl).catch(() => null)
    if (instagramSnapshot?.recentVideos?.length) return instagramSnapshot
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
  const videoCollection = await fetchTikTokPublicUserVideosSnapshot(handle).catch(() => null)
  const averageViews = videoCollection?.averageViews || (videoCount && likes ? Math.round(likes / Math.max(videoCount, 1)) : null)

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
      topViews: videoCollection?.topViews || null,
    },
    recentVideos: videoCollection?.videos || [],
    source: videoCollection?.videos?.length
      ? 'TikTok public mirror snapshot + TikTok public video collection snapshot'
      : 'TikTok public mirror snapshot',
    confidence: videoCollection?.videos?.length ? 72 : 58,
    status: 'snapshot_ready',
    url,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchTikTokPublicUserVideosSnapshot(handle, count = 12) {
  if (!handle) return null
  await delay(1100)
  const payload = await fetchTikTokMirrorUserVideosJson(handle, count)
  const videos = (payload.data?.videos || [])
    .map((video) => normalizeTikTokCollectionVideo(video, handle))
    .filter(Boolean)
  if (!videos.length) return null

  const viewCounts = videos.map((video) => Number(video.views || 0)).filter((views) => views > 0)
  const averageViews = viewCounts.length
    ? Math.round(viewCounts.reduce((sum, views) => sum + views, 0) / viewCounts.length)
    : null
  const topViews = viewCounts.length ? Math.max(...viewCounts) : null

  return {
    videos,
    averageViews,
    topViews,
    count: videos.length,
    hasMore: Boolean(payload.data?.hasMore),
    cursor: payload.data?.cursor || '',
  }
}

function normalizeTikTokCollectionVideo(video = {}, fallbackHandle = '') {
  const videoId = video.video_id || video.id || ''
  if (!videoId) return null
  const authorHandle = video.author?.unique_id || fallbackHandle
  const url = authorHandle ? `https://www.tiktok.com/@${authorHandle}/video/${videoId}` : ''
  const views = Number(video.play_count || video.view_count || video.views || 0)
  const likes = Number(video.digg_count || video.like_count || video.likes || 0)
  const comments = Number(video.comment_count || video.comments || 0)
  const shares = Number(video.share_count || video.shares || 0)
  const saves = Number(video.collect_count || video.save_count || video.saves || 0)

  return {
    id: videoId,
    title: video.title || '',
    url,
    thumbnailUrl: video.cover || video.origin_cover || video.ai_dynamic_cover || '',
    views: views || null,
    likes: likes || null,
    comments: comments || null,
    shares: shares || null,
    saves: saves || null,
    publishedAt: normalizeTikTokVideoPublishedAt(video.create_time),
    country: video.region || '',
  }
}

async function fetchTikTokPublicVideoSnapshot(url) {
  const payload = await fetchTikTokMirrorVideoJson(url)
  const video = payload.data || {}
  if (payload.code !== 0 || !video.id) {
    throw httpError(502, 'TikTok public video mirror did not return video data.')
  }

  const author = video.author || {}
  const handle = author.unique_id || extractTikTokHandle(url)
  const followers = Number(author.follower_count || author.followers || 0)
  const views = Number(video.play_count || video.view_count || video.views || 0)
  const likes = Number(video.digg_count || video.like_count || video.likes || 0)
  const comments = Number(video.comment_count || video.comments || 0)
  const shares = Number(video.share_count || video.shares || 0)
  const saves = Number(video.collect_count || video.save_count || video.saves || 0)

  return {
    title: video.title || '',
    description: video.title || '',
    image: video.cover || video.origin_cover || video.ai_dynamic_cover || author.avatar || '',
    handle: handle ? `@${String(handle).replace(/^@/, '')}` : inferHandleFromUrl(url),
    platform: 'TikTok',
    mediaType: '\uC601\uC0C1',
    publishedAt: normalizeTikTokVideoPublishedAt(video.create_time),
    metrics: {
      followers: followers || null,
      views: views || null,
      likes: likes || null,
      comments: comments || null,
      shares: shares || null,
      saves: saves || null,
    },
    source: 'TikTok public video mirror snapshot',
    confidence: views || likes ? 78 : 58,
    status: 'snapshot_ready',
    url,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchTikTokMirrorVideoJson(url) {
  const params = new URLSearchParams({ url })
  const endpoints = [
    `https://www.tikwm.com/api/?${params}`,
    `https://tikwm.com/api/?${params}`,
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
      if (payload?.code === 0 && payload.data?.id) return payload
      lastError = httpError(502, 'TikTok public video mirror returned empty data.')
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || httpError(502, 'TikTok public video mirror failed.')
}

async function fetchTikTokMirrorUserVideosJson(handle, count = 12) {
  const params = new URLSearchParams({
    unique_id: String(handle || '').replace(/^@/, ''),
    count: String(clamp(Number(count || 12), 1, 35)),
  })
  const endpoints = [
    `https://www.tikwm.com/api/user/posts?${params}`,
    `https://tikwm.com/api/user/posts?${params}`,
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
      if (payload?.code === 0 && Array.isArray(payload.data?.videos)) return payload
      lastError = httpError(502, 'TikTok public video collection returned empty data.')
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || httpError(502, 'TikTok public video collection failed.')
}

async function fetchInstagramRenderedReelsSnapshot(url) {
  const handle = extractInstagramProfileHandle(url)
  if (!handle) throw httpError(400, 'Instagram profile handle could not be parsed from the URL.')

  const externalSnapshot = await fetchInstagramExternalRenderedReelsSnapshot(handle).catch(() => null)
  if (externalSnapshot?.recentVideos?.length) return externalSnapshot

  const { chromium } = await import('playwright')
  const executablePath = getChromiumExecutablePath()
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  }
  if (executablePath) launchOptions.executablePath = executablePath

  const browser = await chromium.launch(launchOptions)
  try {
    const page = await browser.newPage({
      viewport: { width: 1365, height: 1800 },
      locale: 'ko-KR',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    })
    const reelsUrl = `https://www.instagram.com/${handle}/reels/`
    await page.goto(reelsUrl, { waitUntil: 'domcontentloaded', timeout: getInstagramRenderTimeoutMs() })
    await page.waitForTimeout(getInstagramRenderWaitMs())

    const rendered = await page.evaluate(() => {
      const bodyText = document.body?.innerText || ''
      const title = document.title || ''
      const image = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
      const links = [...document.querySelectorAll('a[href*="/reel/"]')]
        .map((anchor) => ({
          url: anchor.href,
          text: (anchor.innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim(),
        }))
        .filter((item) => item.url && item.text)
      return { bodyText, title, image, links }
    })

    const videos = dedupeInstagramRenderedVideos(rendered.links)
    if (!videos.length) {
      throw httpError(502, 'Instagram rendered reels grid did not expose video cards.')
    }

    const viewCounts = videos.map((video) => Number(video.views || 0)).filter((views) => views > 0)
    const averageViews = viewCounts.length
      ? Math.round(viewCounts.reduce((sum, views) => sum + views, 0) / viewCounts.length)
      : null
    const topViews = viewCounts.length ? Math.max(...viewCounts) : null
    const followers = extractMetricFromTextSafe(rendered.bodyText, 'followers')

    return {
      title: rendered.title || handle,
      description: rendered.bodyText.slice(0, 1000),
      image: rendered.image || '',
      handle: `@${handle}`,
      platform: 'Instagram',
      mediaType: '\uC601\uC0C1',
      metrics: {
        followers: followers || null,
        views: averageViews,
        likes: null,
        comments: null,
        shares: null,
        saves: null,
        videos: videos.length,
        topViews,
      },
      recentVideos: videos,
      source: 'Instagram rendered reels grid snapshot',
      confidence: 76,
      status: 'snapshot_ready',
      url: `https://www.instagram.com/${handle}/reels/`,
      fetchedAt: new Date().toISOString(),
    }
  } finally {
    await browser.close().catch(() => {})
  }
}

function dedupeInstagramRenderedVideos(links = []) {
  const seen = new Set()
  return links
    .map((item) => {
      const url = String(item.url || '').split('?')[0]
      const views = parseSocialMetricText(item.text)
      if (!url || !views || seen.has(url)) return null
      seen.add(url)
      return {
        id: extractInstagramShortcode(url),
        title: '',
        url,
        thumbnailUrl: '',
        views,
        likes: null,
        comments: null,
        shares: null,
        saves: null,
        publishedAt: '',
        country: '',
      }
    })
    .filter(Boolean)
    .slice(0, 24)
}

async function fetchInstagramExternalRenderedReelsSnapshot(handle) {
  const customEndpoint = process.env.INSTAGRAM_RENDER_API_URL || ''
  if (customEndpoint) {
    const customSnapshot = await fetchInstagramCustomRenderSnapshot(customEndpoint, handle).catch(() => null)
    if (customSnapshot?.recentVideos?.length) return customSnapshot
  }

  if (process.env.BROWSERLESS_TOKEN) {
    const browserlessSnapshot = await fetchInstagramBrowserlessContentSnapshot(handle).catch(() => null)
    if (browserlessSnapshot?.recentVideos?.length) return browserlessSnapshot
  }

  return null
}

async function fetchInstagramCustomRenderSnapshot(endpoint, handle) {
  const reelsUrl = `https://www.instagram.com/${handle}/reels/`
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (process.env.INSTAGRAM_RENDER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.INSTAGRAM_RENDER_API_KEY}`
  }

  const payload = await fetchJson(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      platform: 'Instagram',
      handle,
      url: reelsUrl,
      waitMs: getInstagramRenderWaitMs(),
      timeoutMs: getInstagramRenderTimeoutMs(),
    }),
  })

  return normalizeInstagramRenderedPayload(payload?.data || payload, handle, 'Instagram external render API snapshot')
}

async function fetchInstagramBrowserlessContentSnapshot(handle) {
  const reelsUrl = `https://www.instagram.com/${handle}/reels/`
  const baseUrl = String(process.env.BROWSERLESS_CONTENT_URL || 'https://production-sfo.browserless.io/content').trim()
  const endpoint = appendQueryParam(baseUrl, 'token', process.env.BROWSERLESS_TOKEN)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: reelsUrl,
      gotoOptions: {
        waitUntil: 'networkidle0',
        timeout: getInstagramRenderTimeoutMs(),
      },
      waitForTimeout: getInstagramRenderWaitMs(),
    }),
  })
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()
  if (!response.ok) {
    throw httpError(response.status, 'Browserless Instagram render request failed.')
  }

  if (contentType.includes('json')) {
    const payload = JSON.parse(text)
    const normalized = normalizeInstagramRenderedPayload(payload?.data || payload, handle, 'Browserless Instagram render snapshot')
    if (normalized?.recentVideos?.length) return normalized
  }

  return normalizeInstagramRenderedPayload(
    {
      html: text,
      links: extractInstagramReelLinksFromHtml(text),
      bodyText: stripHtml(text),
    },
    handle,
    'Browserless Instagram render snapshot',
  )
}

function normalizeInstagramRenderedPayload(payload = {}, handle, source) {
  const links = Array.isArray(payload.links)
    ? payload.links
    : Array.isArray(payload.reels)
      ? payload.reels
      : Array.isArray(payload.recentVideos)
        ? payload.recentVideos
        : []
  const videos = payload.recentVideos?.length
    ? payload.recentVideos.map((video) => ({
        id: video.id || extractInstagramShortcode(video.url),
        title: video.title || '',
        url: video.url,
        thumbnailUrl: video.thumbnailUrl || video.thumbnail || '',
        views: Number(video.views || 0) || null,
        likes: Number(video.likes || 0) || null,
        comments: Number(video.comments || 0) || null,
        shares: Number(video.shares || 0) || null,
        saves: Number(video.saves || 0) || null,
        publishedAt: video.publishedAt || '',
        country: video.country || '',
      })).filter((video) => video.url && video.views)
    : dedupeInstagramRenderedVideos(links)
  if (!videos.length) return null

  const viewCounts = videos.map((video) => Number(video.views || 0)).filter((views) => views > 0)
  const averageViews = viewCounts.length
    ? Math.round(viewCounts.reduce((sum, views) => sum + views, 0) / viewCounts.length)
    : null
  const topViews = viewCounts.length ? Math.max(...viewCounts) : null
  const bodyText = payload.bodyText || payload.text || stripHtml(payload.html || '')
  const followers = Number(payload.metrics?.followers || payload.followers || 0)
    || extractMetricFromTextSafe(bodyText, 'followers')

  return {
    title: payload.title || handle,
    description: String(bodyText || '').slice(0, 1000),
    image: payload.image || payload.thumbnailUrl || '',
    handle: `@${handle}`,
    platform: 'Instagram',
    mediaType: '\uC601\uC0C1',
    metrics: {
      followers: followers || null,
      views: averageViews,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      videos: videos.length,
      topViews,
    },
    recentVideos: videos.slice(0, 24),
    source,
    confidence: 78,
    status: 'snapshot_ready',
    url: `https://www.instagram.com/${handle}/reels/`,
    fetchedAt: new Date().toISOString(),
  }
}

function extractInstagramReelLinksFromHtml(html) {
  const links = []
  const pattern = /<a\b[^>]*href=["']([^"']*\/reel\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match = pattern.exec(String(html || ''))
  while (match) {
    links.push({
      url: normalizeInstagramLinkUrl(match[1]),
      text: stripHtml(match[2]),
    })
    match = pattern.exec(String(html || ''))
  }
  return links
}

function normalizeInstagramLinkUrl(value) {
  const raw = decodeHtmlEntities(String(value || '')).split('?')[0]
  if (!raw) return ''
  if (raw.startsWith('http')) return raw
  return `https://www.instagram.com${raw.startsWith('/') ? '' : '/'}${raw}`
}

function appendQueryParam(value, key, paramValue) {
  const url = new URL(String(value || '').trim())
  if (paramValue) url.searchParams.set(key, paramValue)
  return url.toString()
}

function parseSocialMetricText(value) {
  const text = String(value || '').replace(/\s+/g, '').trim()
  const match = text.match(/^([\d.,]+)([KMBkmb]|\uCC9C|\uB9CC|\uC5B5)?$/)
  return parseMetricNumberSafe(match?.[1], match?.[2])
}

function extractInstagramShortcode(value) {
  try {
    const url = new URL(String(value || '').trim())
    const segments = url.pathname.split('/').filter(Boolean)
    const contentIndex = segments.findIndex((segment) => ['p', 'reel', 'tv'].includes(segment))
    return contentIndex >= 0 ? segments[contentIndex + 1] || '' : ''
  } catch {
    const match = String(value || '').match(/\/(?:p|reel|tv)\/([^/?#]+)/)
    return match?.[1] || ''
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
  const platform = inferReferencePlatform(url)
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
  const publicMetrics = extractPublicMetrics(combined)
  const structuredMetrics = platform === 'Instagram' ? extractInstagramPublicMetrics(html, description) : {}

  return {
    title: decodeHtmlEntities(title),
    description: decodeHtmlEntities(description),
    image,
    handle: platform === 'Instagram' ? inferInstagramHandleFromHtml(html, url) : inferHandleFromUrl(url),
    platform: platform === 'Other' ? undefined : platform,
    mediaType: inferReferenceMediaType(url, platform),
    metrics: mergeMetricObjects(publicMetrics, structuredMetrics),
    source: platform === 'Instagram' ? 'Instagram public page snapshot' : 'Public page snapshot',
    confidence: platform === 'Instagram' && Object.values(structuredMetrics).some(Boolean) ? 72 : description ? 64 : 42,
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

function extractInstagramPublicMetrics(html, description = '') {
  const decodedHtml = decodeHtmlEntities(String(html || ''))
  const decodedDescription = decodeHtmlEntities(String(description || ''))
  const searchText = `${decodedDescription} ${decodedHtml.slice(0, 120000)}`

  const fromDescription = extractInstagramDescriptionMetrics(decodedDescription)
  const fromJson = {
    views: firstJsonMetric(decodedHtml, [
      'video_view_count',
      'video_play_count',
      'play_count',
      'view_count',
      'ig_play_count',
    ]),
    likes: firstJsonMetric(decodedHtml, [
      'like_count',
      'edge_media_preview_like.count',
      'edge_liked_by.count',
    ]),
    comments: firstJsonMetric(decodedHtml, [
      'comment_count',
      'edge_media_to_comment.count',
    ]),
    shares: firstJsonMetric(decodedHtml, [
      'share_count',
      'reshare_count',
    ]),
    saves: firstJsonMetric(decodedHtml, [
      'save_count',
      'saved_count',
    ]),
    followers: firstJsonMetric(decodedHtml, [
      'follower_count',
      'edge_followed_by.count',
    ]),
  }

  const fromLooseText = {
    views: extractMetricFromTextSafe(searchText, 'views'),
    followers: extractMetricFromTextSafe(searchText, 'followers'),
  }

  return mergeMetricObjects(fromLooseText, fromJson, fromDescription)
}

function extractInstagramDescriptionMetrics(description = '') {
  const text = decodeHtmlEntities(description).replace(/\s+/g, ' ')
  const english = text.match(/([\d.,]+)\s*([KMB])?\s+likes?,\s*([\d.,]+)\s*([KMB])?\s+comments?/i)
  if (english) {
    return {
      likes: parseMetricNumberSafe(english[1], english[2]),
      comments: parseMetricNumberSafe(english[3], english[4]),
    }
  }

  const koreanLikes = text.match(/\uC88B\uC544\uC694\s*([\d.,]+)\s*([KMB]|\uCC9C|\uB9CC|\uC5B5)?/i)
    || text.match(/([\d.,]+)\s*([KMB]|\uCC9C|\uB9CC|\uC5B5)?\s*\uAC1C?\s*\uC88B\uC544\uC694/i)
  const koreanComments = text.match(/\uB313\uAE00\s*([\d.,]+)\s*([KMB]|\uCC9C|\uB9CC|\uC5B5)?/i)
    || text.match(/([\d.,]+)\s*([KMB]|\uCC9C|\uB9CC|\uC5B5)?\s*\uAC1C?\s*\uB313\uAE00/i)

  return {
    likes: parseMetricNumberSafe(koreanLikes?.[1], koreanLikes?.[2]),
    comments: parseMetricNumberSafe(koreanComments?.[1], koreanComments?.[2]),
  }
}

function firstJsonMetric(text, keys) {
  for (const key of keys) {
    const value = extractJsonMetric(text, key)
    if (value) return value
  }
  return null
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function extractJsonMetric(text, key) {
  if (!text || !key) return null
  if (key.includes('.')) {
    const [parentKey, childKey] = key.split('.')
    const parentPattern = new RegExp(`["']${escapeRegExp(parentKey)}["']\\s*:\\s*\\{[^{}]{0,900}?["']${escapeRegExp(childKey)}["']\\s*:\\s*([\\d.,]+)`, 'i')
    const parentMatch = text.match(parentPattern)
    const parentValue = parseMetricNumberSafe(parentMatch?.[1])
    if (parentValue) return parentValue
  }

  const patterns = [
    new RegExp(`["']${escapeRegExp(key)}["']\\s*:\\s*([\\d.,]+)`, 'i'),
    new RegExp(`&quot;${escapeRegExp(key)}&quot;\\s*:\\s*([\\d.,]+)`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const value = parseMetricNumberSafe(match?.[1])
    if (value) return value
  }
  return null
}

function mergeMetricObjects(...sources) {
  return sources.reduce((merged, source) => {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && !merged[key]) {
        merged[key] = value
      }
    })
    return merged
  }, {})
}

function inferInstagramHandleFromHtml(html, url) {
  const ogUrl = pickMetaContent(html, 'og:url')
  const fromOgUrl = inferInstagramHandleFromUrl(ogUrl)
  if (fromOgUrl) return fromOgUrl

  const fromUrl = inferInstagramHandleFromUrl(url)
  if (fromUrl) return fromUrl

  const title = decodeHtmlEntities(pickMetaContent(html, 'og:title') || pickTitle(html) || '')
  const titleMatch = title.match(/@([A-Za-z0-9._]{2,30})/)
  return titleMatch?.[1] ? `@${titleMatch[1]}` : inferHandleFromUrl(url)
}

function inferInstagramHandleFromUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    const segments = url.pathname.split('/').filter(Boolean)
    const blocked = new Set(['p', 'reel', 'tv', 'stories', 'explore'])
    const handle = segments.find((segment) => !blocked.has(segment.toLowerCase()) && isInstagramProfileHandle(segment))
    return handle ? `@${handle}` : ''
  } catch {
    return ''
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
  const cleanCreator = sanitizeAiPromptValue(creator)
  const cleanBrand = sanitizeAiPromptValue(brand)
  const cleanCampaign = sanitizeAiPromptValue(campaign)
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
    'If any input field looks garbled, mojibake, question-mark placeholders, or empty, do not quote it. Use a neutral natural Korean phrase instead.',
    'Never output question-mark placeholders or broken Korean. Keep the whole message in clean Korean.',
    `Creator: ${JSON.stringify(cleanCreator || {})}`,
    `Brand: ${JSON.stringify(cleanBrand || {})}`,
    `Campaign: ${JSON.stringify(cleanCampaign || {})}`,
  ].join('\\n')
}

function buildContentGuidePrompt({ brand = {}, campaign = {}, seedingType = '', channel = '', references = [] } = {}) {
  const cleanBrand = sanitizeAiPromptValue(brand)
  const cleanCampaign = sanitizeAiPromptValue(campaign)
  const cleanReferences = sanitizeAiPromptValue(references)
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
    'If source data contains garbled characters or placeholders, rewrite that part naturally instead of copying it.',
    `Brand: ${JSON.stringify(cleanBrand || {})}`,
    `Campaign: ${JSON.stringify(cleanCampaign || {})}`,
    `Seeding type: ${sanitizeAiPromptValue(seedingType) || ''}`,
    `Channel: ${sanitizeAiPromptValue(channel) || ''}`,
    `References: ${JSON.stringify(cleanReferences || [])}`,
  ].join('\\n')
}

function buildRecommendationEnrichmentPrompt({ brand = {}, campaign = {}, candidates = [] } = {}) {
  const cleanBrand = sanitizeAiPromptValue(brand)
  const cleanCampaign = sanitizeAiPromptValue(campaign)
  const cleanCandidates = sanitizeAiPromptValue(candidates)
  return [
    'You are an influencer campaign strategist for a Korean B2B SaaS operations tool.',
    'The candidates below were already ranked by deterministic raw-data scoring. Do not invent numbers, followers, views, emails, or metrics.',
    'Use only the supplied candidate data. Your job is to enrich the top candidates with human-readable reasoning, a campaign angle, and a warmer outreach message.',
    'Write Korean copy for user-facing fields. Keep each field concise and practical.',
    'Return JSON only. No markdown, no commentary.',
    'Required JSON shape:',
    '{"items":[{"recommendationId":"string","creatorId":"string","aiSummary":"string","aiReasons":["string","string","string"],"outreachAngle":"string","riskNote":"string","message":"string"}]}',
    'Rules:',
    '- aiSummary: one sentence explaining why this creator is a fit.',
    '- aiReasons: up to 3 concrete reasons tied to the supplied data.',
    '- outreachAngle: one specific proposal angle or content hook.',
    '- riskNote: short caveat if metrics are weak or verification is needed. Empty string if no issue.',
    '- message: friendly Korean first-contact email/DM. Include a specific compliment, campaign fit, proposal, and a reply-friendly question. Mention ad disclosure naturally.',
    '- Never copy broken/mojibake text. Rewrite naturally if any input looks corrupted.',
    `Brand: ${JSON.stringify(cleanBrand || {})}`,
    `Campaign: ${JSON.stringify(cleanCampaign || {})}`,
    `Candidates: ${JSON.stringify(cleanCandidates || [])}`,
  ].join('\\n')
}

function parseAiJsonObject(text = '') {
  const trimmed = String(text || '').trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed)
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    const candidate = fenced?.[1] || (firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : '')
    if (!candidate) throw httpError(502, 'AI response was not valid JSON.')
    try {
      return JSON.parse(candidate)
    } catch {
      throw httpError(502, 'AI response was not valid JSON.')
    }
  }
}

function normalizeRecommendationEnrichmentItem(item = {}) {
  const recommendationId = String(item.recommendationId || '').trim()
  const creatorId = String(item.creatorId || '').trim()
  if (!recommendationId || !creatorId) return null

  return {
    recommendationId,
    creatorId,
    aiSummary: String(item.aiSummary || '').trim().slice(0, 500),
    aiReasons: Array.isArray(item.aiReasons)
      ? item.aiReasons.map((reason) => String(reason || '').trim()).filter(Boolean).slice(0, 3)
      : [],
    outreachAngle: String(item.outreachAngle || '').trim().slice(0, 500),
    riskNote: String(item.riskNote || '').trim().slice(0, 500),
    message: String(item.message || '').trim().slice(0, 2500),
  }
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
      if (!isTikTokProfileHandle(handle)) return null
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

function isTikTokProfileHandle(handle) {
  if (!handle || handle === '@') return false
  const normalized = String(handle).replace(/^@/, '')
  const blocked = new Set([
    '',
    'tag',
    'music',
    'video',
    'discover',
    'login',
    'about',
    'business',
    'creators',
  ])
  if (blocked.has(normalized.toLowerCase())) return false
  return /^[a-z0-9._]{2,30}$/i.test(normalized)
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const statusHints = {
      400: 'request parameters need review',
      401: 'API key or authentication is missing',
      402: 'billing or credits are required',
      403: 'API permission or allowed origin needs review',
      404: 'upstream endpoint was not found',
      408: 'upstream request timed out',
      429: 'quota or rate limit exceeded',
      500: 'upstream service error',
      502: 'upstream response parsing failed',
      503: 'upstream service is temporarily unavailable',
    }
    const upstreamMessage = payload?.error?.message || payload?.message || response.statusText || 'External API request failed.'
    const host = (() => {
      try {
        return new URL(url).hostname
      } catch {
        return 'external-api'
      }
    })()
    throw httpError(
      response.status,
      `${host} ${response.status}: ${statusHints[response.status] || 'request failed'} (${String(upstreamMessage).slice(0, 220)})`,
    )
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
  const evidenceResults = filterProductSpecificEvidence(results, query)
  const scoredResults = evidenceResults.map((profile) => ({
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
    'serum',
    'food',
    'cook',
    'cooking',
    'recipe',
    'fashion',
    '\uBDF0\uD2F0',
    '\uD654\uC7A5\uD488',
    '\uBA54\uC774\uD06C\uC5C5',
    '\uC2A4\uD0A8\uCF00\uC5B4',
    '\uC138\uB7FC',
    '\uD478\uB4DC',
    '\uC694\uB9AC',
    '\uB808\uC2DC\uD53C',
    '\uBC18\uB824',
    '\uAC15\uC544\uC9C0',
    '\uACE0\uC591\uC774',
    '\uD328\uC158',
    '\uB8E9\uBD81',
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
  if (looksLikeBrandOrPlatformAccount(profile)) return false
  const text = getProfileDiscoverySearchText(profile)
  const requiredMatches = context.requiredTokens.filter((term) => text.includes(term)).length
  const genericMatches = context.genericTokens.filter((term) => text.includes(term)).length
  const tokenMatches = context.tokens.filter((term) => text.includes(term)).length
  const hasMetrics = Number(profile.followers || 0) > 0 || Number(profile.averageViews || 0) > 0
  const hasRequiredMatch = !context.requiredTokens.length || requiredMatches > 0
  const hasCategoryMatch = genericMatches > 0 || tokenMatches > 0

  if (mode === 'strict' && !hasRequiredMatch) return false
  if (mode === 'expanded' && !hasCategoryMatch) return false

  if (profile.platform === 'TikTok') {
    if (!hasMetrics && looksLikeContentCaptionV2(profile.name)) return false
    if (hasBlockedDiscoveryTopicV2(text)) return false
  }

  return true
}

function filterProductSpecificEvidence(items, query) {
  const terms = getProductSpecificEvidenceTerms(query)
  if (!terms.length) return items
  return (items || []).filter((item) => {
    const text = normalizeSearchEvidenceText([
      item.name,
      item.handle,
      item.title,
      item.description,
      item.snippet,
      item.sourceTitle,
      item.sourceSnippet,
      item.channelTitle,
      item.profileUrl,
      item.url,
      item.matchedContentUrl,
      item.hook,
      item.analysis,
    ].filter(Boolean).join(' '))
    return terms.some((term) => text.includes(term))
  })
}

function hasProductSpecificEvidenceTerms(query) {
  return getProductSpecificEvidenceTerms(query).length > 0
}

function getProductSpecificEvidenceTerms(query) {
  const text = normalizeSearchEvidenceText(query)
  const compactText = text.replace(/\s+/g, '')
  const terms = []
  if (text.includes('\uBC14\uB2D0\uB77C\uCF54') || compactText.includes('\uBC14\uB2D0\uB77C\uCF54') || text.includes('banila')) {
    terms.push('\uBC14\uB2D0\uB77C\uCF54', 'banila', 'banila co', 'banilaco')
  }
  if (
    text.includes('\uD074\uB80C\uC9D5\uBC24') ||
    compactText.includes('\uD074\uB80C\uC9D5\uBC24') ||
    text.includes('cleansing balm') ||
    text.includes('clean it zero')
  ) {
    terms.push('\uD074\uB80C\uC9D5\uBC24', '\uD074\uB80C\uC9D5 \uBC24', 'cleansing balm', 'clean it zero', 'cleanitzero')
  }
  if (
    text.includes('\uCF04\uB12C') ||
    compactText.includes('\uCF04\uB12C') ||
    text.includes('\uC774\uB3D9\uC7A5') ||
    compactText.includes('\uC774\uB3D9\uC7A5') ||
    text.includes('kennel') ||
    text.includes('pet carrier') ||
    text.includes('dog carrier') ||
    text.includes('travel crate') ||
    text.includes('crate')
  ) {
    terms.push(
      '\uCF04\uB12C',
      '\uC774\uB3D9\uC7A5',
      '\uAC15\uC544\uC9C0 \uC774\uB3D9\uC7A5',
      '\uBC18\uB824\uACAC \uC774\uB3D9\uC7A5',
      'kennel',
      'pet carrier',
      'dog carrier',
      'travel crate',
      'crate',
    )
  }
  return [...new Set(terms)]
}

function normalizeSearchEvidenceText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/clean\s*it\s*zero/g, 'clean it zero')
    .replace(/clean[\s_-]*itzero/g, 'cleanitzero')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeBrandOrPlatformAccount(profile = {}) {
  const text = [
    profile.name,
    profile.handle,
    profile.profileUrl,
    profile.description,
    profile.sourceTitle,
  ].filter(Boolean).join(' ').toLowerCase()
  if (!text) return false
  const creatorSignal = /(creator|influencer|reviewer|blogger|artist|model|personal|daily|\uD06C\uB9AC\uC5D0\uC774\uD130|\uC778\uD50C\uB8E8\uC5B8\uC11C|\uB9AC\uBDF0\uC5B4|\uBE14\uB85C\uAC70|\uBDF0\uC2A4\uD0C0)/.test(text)
  if (/instagram'?s @creators|@creators|@influencer|creator marketplace/.test(text)) return true
  if (/(?:^|[@._\s-])official(?:[._\s-]|$)|official(?:[._\s-]|$)/.test(text)) return true
  if (!creatorSignal && /(beauty\s*global|seoul\s*beauty|korean\s*skincare|beauty\s*barn|cosmetic\s*shop|skincare\s*shop|skin\s*care\s*shop|derma\s*factory)/.test(text)) return true
  if (!creatorSignal && /(^|[._\s-])(global|store|shop|mall|brand|cosmetics|clinic|factory|lab|company|co|inc|india|usa|uae)([._\s-]|$)/.test(text)) return true
  if (/(^|[._\s-])(official|brand|store|shop|mall|korea|kr)([._\s-]|$)/.test(text)) {
    return !creatorSignal
  }
  return false
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

function isInstagramUrl(value) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
    return hostname === 'instagram.com' || hostname.endsWith('.instagram.com')
  } catch {
    return false
  }
}

function extractInstagramProfileHandle(value) {
  try {
    const url = new URL(String(value || '').trim())
    const segments = url.pathname.split('/').filter(Boolean)
    const blocked = new Set(['p', 'reel', 'tv', 'stories', 'explore', 'accounts', 'direct'])
    const directHandle = segments.find((segment) => !blocked.has(segment.toLowerCase()) && isInstagramProfileHandle(segment))
    if (directHandle) return directHandle
  } catch {
    const match = String(value || '').match(/instagram\.com\/([A-Za-z0-9._]{2,30})/i)
    if (match?.[1] && isInstagramProfileHandle(match[1])) return match[1]
  }
  return ''
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

function extractTikTokVideoId(value) {
  try {
    const url = new URL(String(value || '').trim())
    const segments = url.pathname.split('/').filter(Boolean)
    const videoIndex = segments.findIndex((segment) => segment === 'video')
    if (videoIndex >= 0) return segments[videoIndex + 1] || ''
  } catch {
    const match = String(value || '').match(/\/video\/(\d{8,})/)
    return match?.[1] || ''
  }
  return ''
}

function normalizeTikTokVideoPublishedAt(value) {
  const timestamp = Number(value || 0)
  if (!timestamp) return ''
  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000
  return new Date(milliseconds).toISOString().slice(0, 10)
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

function isInstagramRenderedSnapshotEnabled() {
  return String(process.env.INSTAGRAM_RENDER_SNAPSHOT_ENABLED || 'true').toLowerCase() !== 'false'
}

function isTikTokPublicMirrorEnabled() {
  return String(process.env.TIKTOK_PUBLIC_MIRROR_ENABLED || 'true').toLowerCase() !== 'false'
}

function getPublicSnapshotTimeoutMs() {
  return clamp(Number(process.env.PUBLIC_SNAPSHOT_TIMEOUT_MS || 8000), 1500, 20000)
}

function getInstagramRenderTimeoutMs() {
  return clamp(Number(process.env.INSTAGRAM_RENDER_TIMEOUT_MS || 30000), 8000, 60000)
}

function getInstagramRenderWaitMs() {
  return clamp(Number(process.env.INSTAGRAM_RENDER_WAIT_MS || 8000), 2500, 20000)
}

function getChromiumExecutablePath() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean)

  return candidates.find((candidate) => existsSync(candidate)) || ''
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
