export const competitorDataBlueprints = [
  {
    name: 'Modash',
    pattern: '검색 API와 상세 리포트 분리',
    takeaway: '1차 후보 검색은 가볍게, 오디언스/협찬/연락처 검증은 최종 후보에만 수행',
    avoid: '외부 리포트 API 의존 없이 우리 DB에 스냅샷과 검증 이력을 축적',
  },
  {
    name: 'HypeAuditor',
    pattern: '품질 점수와 사기 위험 중심 리포트',
    takeaway: '팔로워 수보다 참여율, 오디언스 품질, 가짜 팔로워 위험을 컨펌 기준으로 노출',
    avoid: '블랙박스 점수 복제 대신 근거 지표와 계산 출처를 함께 저장',
  },
  {
    name: 'CreatorIQ',
    pattern: '크리에이터/콘텐츠/성과 그래프',
    takeaway: '공식 플랫폼 데이터와 캠페인 성과 데이터를 결합해 장기 학습 자산을 만듦',
    avoid: '타사 그래프를 사지 않고 섭외 성공률, 실제 단가, 실제 조회수를 자체 자산화',
  },
  {
    name: 'Traackr',
    pattern: '벤치마크와 ROI 운영 데이터',
    takeaway: '후보 발굴보다 캠페인 이후 성과/ROI/재섭외 판단 데이터가 핵심',
    avoid: '단순 DB가 아니라 브랜드별 의사결정 로그와 리포트 자동화를 강화',
  },
]

const CREATOROPS_API_BASE_URL = import.meta.env.VITE_CREATOROPS_API_BASE_URL || ''
const CREATOROPS_API_TIMEOUT_MS = 15000

function formatCreatorOpsApiFailure(path, response, payload = {}, fallbackText = '') {
  const status = Number(response?.status || 0)
  const statusHints = {
    400: '요청 파라미터를 확인해야 합니다.',
    401: 'API 키가 없거나 인증이 만료되었습니다.',
    402: '결제/크레딧 설정이 필요합니다.',
    403: 'API 권한 또는 허용 도메인을 확인해야 합니다.',
    404: '배포된 API 서버에 해당 라우트가 없습니다. 백엔드 배포 반영이 필요합니다.',
    408: 'API 응답 시간이 초과되었습니다.',
    429: '쿼터 초과 또는 속도 제한 상태입니다.',
    500: '서버 처리 오류입니다.',
    502: '외부 API 응답 변환 중 오류입니다.',
    503: '외부 API가 일시적으로 불안정합니다.',
  }
  const upstreamMessage =
    payload?.message ||
    payload?.error?.message ||
    (typeof payload?.error === 'string' ? payload.error : '') ||
    fallbackText ||
    response?.statusText ||
    ''
  if (status === 402) {
    return `${path} · 402: 검색 API 크레딧 또는 결제 설정이 필요합니다.`
  }
  const hint = statusHints[status] || 'CreatorOps API 요청에 실패했습니다.'
  const details = upstreamMessage ? ` (${String(upstreamMessage).slice(0, 180)})` : ''
  return `${path} · ${status || 'network'}: ${hint}${details}`
}

async function callCreatorOpsApi(path, body) {
  if (!CREATOROPS_API_BASE_URL) return null

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), CREATOROPS_API_TIMEOUT_MS)
  let response
  let payload

  try {
    response = await fetch(`${CREATOROPS_API_BASE_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      payload = await response.json().catch(() => ({}))
    } else {
      const text = await response.text().catch(() => '')
      payload = { message: text }
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('CreatorOps API 응답이 지연되었습니다. 쿼터, 결제, 서버 로그를 확인하세요.', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(formatCreatorOpsApiFailure(path, response, payload))
  }

  return payload?.data ?? payload
}

export const marketBenchmarkBlueprints = [
  {
    market: 'Korea',
    competitor: 'REVU',
    pattern: '공개모집형 체험단과 섭외형 REVU Select를 분리',
    supplement: '캠페인 타입을 공개모집/제안형/앰배서더/커머스로 나누고, 지원자 검토 흐름을 추가',
    status: '캠페인 타입 반영',
  },
  {
    market: 'Korea',
    competitor: 'TAGby',
    pattern: '타겟 설정, 미션, 리워드, 게시물 모니터링, 통계 보고서가 한 흐름',
    supplement: '캠페인 생성 시 미션/리워드/검수 플로우를 저장하고 상세에서 바로 확인',
    status: '미션/리워드 반영',
  },
  {
    market: 'Global',
    competitor: 'Aspire',
    pattern: '인바운드 마켓플레이스와 아웃바운드 탐색을 함께 운영',
    supplement: '지원형 캠페인과 직접 제안형 캠페인을 같은 파이프라인에서 구분 관리',
    status: '운영 구조 반영',
  },
  {
    market: 'Global',
    competitor: 'Upfluence',
    pattern: '브랜드 팬/고객 기반 크리에이터 발굴과 AI 메일링 어시스턴트',
    supplement: '브랜드 적합도와 친근한 제안 메시지를 결합하고 고객/팬 소스 필드를 확장 예정',
    status: '메시지 강화 완료',
  },
  {
    market: 'Global',
    competitor: 'Influencity',
    pattern: 'Discovery, IRM/Data, Campaigns, Reports로 분리된 올인원 구조',
    supplement: '대시보드/발굴/캠페인/리포트/메시지를 독립 화면으로 분리하고 데이터 원장을 추가',
    status: '화면 구조 반영',
  },
  {
    market: 'Global',
    competitor: 'GRIN',
    pattern: '제품 발송, 할인 코드, 커미션, ROI까지 커머스 운영 연결',
    supplement: '캠페인에 커머스 지표와 리워드/지급 기준을 추가해 ROI 리포트와 연결',
    status: '커머스 필드 반영',
  },
]

export const dataConnectorBlueprints = [
  {
    name: 'YouTube Data API',
    status: '공식 API 연동 대상',
    scope: '채널 구독자, 전체 조회수, 공개 영상 수, 최근 영상 조회/댓글',
    confidence: 96,
    cadence: '일 1회 + 캠페인 콘텐츠 수동 갱신',
    cost: '기본 쿼터 내 저비용',
  },
  {
    name: '공개 웹/미디어킷 크롤러',
    status: '백엔드 수집기 필요',
    scope: '프로필 URL, 공개 이메일, 링크트리, 미디어킷, 협업 안내 페이지',
    confidence: 78,
    cadence: '주 1회 스냅샷',
    cost: '서버/프록시보다 큐 관리 비용이 핵심',
  },
  {
    name: '크리에이터 인증 연결',
    status: '고정밀 데이터 레이어',
    scope: 'Instagram/TikTok/YouTube 본인 인증 인사이트, 도달, 저장, 공유',
    confidence: 98,
    cadence: '캠페인 기간 매일',
    cost: 'OAuth와 동의 플로우 구축 필요',
  },
  {
    name: 'Google Sheets/Gmail/Drive',
    status: '운영 자동화 연동',
    scope: '추천/발굴/섭외 풀 내보내기, 제안 발송, 보고서 저장',
    confidence: 94,
    cadence: '사용자 실행 시 즉시',
    cost: '대부분 기본 한도 내 운영 가능',
  },
  {
    name: 'AI 추정/보정 모델',
    status: '우리 자체 계산',
    scope: '브랜드 적합도, 예상 단가, 메시지 개인화, 컨펌 요약',
    confidence: 68,
    cadence: '후보 갱신 또는 캠페인 생성 시',
    cost: '후보 전체가 아니라 압축 리스트에만 실행',
  },
  {
    name: '자체 성과 DB',
    status: '핵심 자산',
    scope: '응답률, 실제 견적, 섭외 완료, 콘텐츠 성과, 클라이언트 승인 이력',
    confidence: 100,
    cadence: '업무 발생 시 누적',
    cost: 'DB 저장 비용은 낮고 장기 경쟁력은 큼',
  },
]

const CREATOR_RAW_SOURCE_IDS = {
  youtubeChannel: 'RAW-EXT-CHN-001',
  searchInference: 'RAW-EXT-SERP-001',
  tiktokResearch: 'RAW-EXT-TT-RESEARCH-001',
  tiktokCommercial: 'RAW-EXT-TT-COMMERCIAL-001',
  tiktokSnapshot: 'RAW-EXT-TT-SNAPSHOT-001',
  instagramBusiness: 'RAW-EXT-IG-BUSINESS-001',
  instagramCreatorAuth: 'RAW-EXT-IG-CREATOR-AUTH-001',
  instagramSnapshot: 'RAW-EXT-IG-SNAPSHOT-001',
}

const OFFICIAL_CREATOR_RAW_IDS = new Set([
  CREATOR_RAW_SOURCE_IDS.youtubeChannel,
  CREATOR_RAW_SOURCE_IDS.tiktokResearch,
  CREATOR_RAW_SOURCE_IDS.tiktokCommercial,
  CREATOR_RAW_SOURCE_IDS.instagramBusiness,
  CREATOR_RAW_SOURCE_IDS.instagramCreatorAuth,
])

const SNAPSHOT_CREATOR_RAW_IDS = new Set([
  CREATOR_RAW_SOURCE_IDS.searchInference,
  CREATOR_RAW_SOURCE_IDS.tiktokSnapshot,
  CREATOR_RAW_SOURCE_IDS.instagramSnapshot,
])

function clampConfidence(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
}

function collectCreatorSourceText(creator) {
  return [
    creator.source,
    creator.sourceLabel,
    creator.sourceMethod,
    creator.discoverySource,
    creator.notes,
    creator.rawSourceId,
    ...(creator.dataContract?.rawIds || []),
    ...(creator.metricSources || []).flatMap((source) => [
      source.source,
      source.method,
      source.rawId,
      source.status,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function resolveCreatorRawSource(creator) {
  const platform = creator?.platform || ''
  const sourceText = collectCreatorSourceText(creator || {})

  if (platform === 'YouTube') {
    return {
      rawId: CREATOR_RAW_SOURCE_IDS.youtubeChannel,
      source: 'YouTube Data API / 채널 공개 통계',
      method: 'channels.list + videos.list',
      confidence: 96,
      freshness: '검색/갱신 시',
      status: '정상',
    }
  }

  if (platform === 'TikTok') {
    if (/commercial content|adlib|business|ads/i.test(sourceText)) {
      return {
        rawId: CREATOR_RAW_SOURCE_IDS.tiktokCommercial,
        source: 'TikTok Commercial Content API',
        method: 'commercial_content.query 공개 광고/상업 콘텐츠 검색',
        confidence: 88,
        freshness: '레퍼런스 검색 시',
        status: '정상',
      }
    }
    if (/research api|research/i.test(sourceText)) {
      return {
        rawId: CREATOR_RAW_SOURCE_IDS.tiktokResearch,
        source: 'TikTok Research API',
        method: '승인 범위 내 공개 콘텐츠/계정 연구 데이터 조회',
        confidence: 82,
        freshness: '검색/갱신 시',
        status: '검증 필요',
      }
    }
    if (/snapshot|public|render|profile|brave|google|search|manual/i.test(sourceText)) {
      return {
        rawId: CREATOR_RAW_SOURCE_IDS.tiktokSnapshot,
        source: 'TikTok 공개 화면 스냅샷',
        method: '공개 프로필/영상 모음 화면 스냅샷 후 수치 정규화',
        confidence: 68,
        freshness: '스냅샷 저장 시',
        status: '검증 필요',
      }
    }
  }

  if (platform === 'Instagram') {
    if (/graph|business/i.test(sourceText)) {
      return {
        rawId: CREATOR_RAW_SOURCE_IDS.instagramBusiness,
        source: 'Instagram Graph API / Business Discovery',
        method: '비즈니스/크리에이터 공개 계정 및 미디어 지표 조회',
        confidence: 86,
        freshness: '검색/갱신 시',
        status: '정상',
      }
    }
    if (/oauth|auth|media kit|insight|creator authorized/i.test(sourceText)) {
      return {
        rawId: CREATOR_RAW_SOURCE_IDS.instagramCreatorAuth,
        source: 'Instagram 크리에이터 인증 인사이트',
        method: '크리에이터 동의 후 미디어킷/Insights 데이터 수집',
        confidence: 90,
        freshness: '크리에이터 승인 갱신 시',
        status: '정상',
      }
    }
    if (/snapshot|render|public|profile|reel|brave|google|search|manual/i.test(sourceText)) {
      return {
        rawId: CREATOR_RAW_SOURCE_IDS.instagramSnapshot,
        source: 'Instagram 공개 프로필/릴스 스냅샷',
        method: '공개 검색 결과와 프로필/릴스 화면 스냅샷 정규화',
        confidence: 64,
        freshness: '스냅샷 저장 시',
        status: '검증 필요',
      }
    }
  }

  return {
    rawId: CREATOR_RAW_SOURCE_IDS.searchInference,
    source: '검색 결과 URL 추론 raw',
    method: '검색 API 결과 URL, 스니펫, 썸네일 기반 후보 추론',
    confidence: 58,
    freshness: '검색 시',
    status: '검증 필요',
  }
}

function sourceOverride(creator, metric) {
  return creator?.metricSources?.find((source) => source.metric === metric)
}

function buildEvidenceItem(creator, metric, fallback, confidenceOffset = 0, overrideDefaults = {}) {
  const override = sourceOverride(creator, metric)
  const confidence = override?.confidence ?? overrideDefaults.confidence ?? fallback.confidence + confidenceOffset
  return {
    metric,
    source: override?.source ?? overrideDefaults.source ?? fallback.source,
    method: override?.method ?? overrideDefaults.method ?? fallback.method,
    confidence: clampConfidence(confidence),
    freshness: override?.freshness ?? overrideDefaults.freshness ?? fallback.freshness,
    rawId: override?.rawId ?? overrideDefaults.rawId ?? fallback.rawId,
    status: override?.status ?? overrideDefaults.status ?? fallback.status,
  }
}

export function buildCreatorSourceEvidence(creator) {
  if (!creator) return []

  const fallback = resolveCreatorRawSource(creator)

  return [
    buildEvidenceItem(creator, '팔로워', fallback),
    buildEvidenceItem(creator, '평균 조회', fallback, -4, {
      method: '최근 콘텐츠 공개 조회수 평균 또는 API 통계',
    }),
    buildEvidenceItem(creator, '참여율', fallback, -10, {
      source: `${fallback.source} + 반응지표 계산`,
      method: '(좋아요 + 댓글 + 공유 + 저장) / 조회수 또는 팔로워',
    }),
    buildEvidenceItem(creator, '오디언스/가짜 팔로워', fallback, 0, {
      source: '품질 검증/리스크 모델',
      method: '성장 급등, 반복 댓글, 카테고리 불일치, 인증 인사이트 교차검증',
      confidence: Math.min(fallback.confidence, 62),
      status: fallback.status === '정상' ? '검증 필요' : fallback.status,
    }),
    buildEvidenceItem(creator, '예상 단가', fallback, 0, {
      source: '자체 단가/CPV 추정 모델',
      method: '플랫폼/카테고리/평균 조회/참여율/브랜드 안정성 가중치',
      confidence: 58,
      freshness: '견적 응답 수집 후 보정',
      status: '검증 필요',
    }),
  ]
}

export function calculateDataCoverage(creators) {
  const creatorEvidence = creators.map((creator) => ({
    creator,
    evidence: buildCreatorSourceEvidence(creator),
  }))
  const evidence = creatorEvidence.flatMap((item) => item.evidence)
  const confidence =
    evidence.reduce((sum, item) => sum + item.confidence, 0) / Math.max(evidence.length, 1)
  const officialReady = creatorEvidence.filter((item) =>
    item.evidence.some((source) => OFFICIAL_CREATOR_RAW_IDS.has(source.rawId)),
  ).length
  const profileSnapshots = creatorEvidence.filter((item) =>
    item.evidence.some((source) => SNAPSHOT_CREATOR_RAW_IDS.has(source.rawId)),
  ).length
  const estimatedFields = evidence.filter((item) => item.confidence < 70).length

  return {
    confidence: Math.round(confidence),
    officialReady,
    profileSnapshots,
    estimatedFields,
    totalSignals: evidence.length,
  }
}

export async function fetchYouTubeChannelSnapshot({ apiKey, lookup }) {
  const cleanKey = String(apiKey || '').trim()
  const cleanLookup = String(lookup || '').trim()

  if (CREATOROPS_API_BASE_URL) {
    return callCreatorOpsApi('/youtube/channel', { lookup: cleanLookup })
  }

  if (!cleanKey) {
    throw new Error('YouTube API 키가 필요합니다.')
  }

  if (!cleanLookup) {
    throw new Error('채널 ID 또는 @핸들을 입력해주세요.')
  }

  const parsedLookup = parseYouTubeLookup(cleanLookup)
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    key: cleanKey,
  })

  if (parsedLookup.type === 'id') {
    params.set('id', parsedLookup.value)
  } else {
    params.set('forHandle', parsedLookup.value)
  }

  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`)
  const payload = await response.json()

  if (!response.ok) {
    const message = payload?.error?.message || 'YouTube 공식 지표를 가져오지 못했습니다.'
    throw new Error(message)
  }

  const channel = payload.items?.[0]
  if (!channel) {
    throw new Error('일치하는 YouTube 채널을 찾지 못했습니다.')
  }

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
      : `@${String(snippet.title || 'youtube').toLowerCase().replace(/\s+/g, '')}`

  return {
    channelId: channel.id,
    name: snippet.title || 'YouTube Creator',
    handle,
    avatar: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
    followers: subscribers,
    averageViews,
    totalViews: viewCount,
    videoCount,
    description: snippet.description || '',
    country: snippet.country || '',
    source: 'YouTube Data API',
  }
}

export async function searchYouTubeCreatorDiscovery({ apiKey, query, country = 'KR', maxResults = 8 }) {
  const cleanKey = String(apiKey || '').trim()
  const cleanQuery = String(query || '').trim()
  const cleanCountry = normalizeDiscoveryCountry(country)

  if (CREATOROPS_API_BASE_URL) {
    return callCreatorOpsApi('/discovery/youtube/search', {
      query: cleanQuery,
      country: cleanCountry,
      maxResults,
    })
  }

  if (!cleanKey) {
    throw new Error('YouTube 실제 검색에는 YouTube Data API 키가 필요합니다.')
  }

  if (!cleanQuery) {
    throw new Error('검색어를 입력해주세요.')
  }

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    q: cleanQuery,
    maxResults: String(Math.min(Math.max(Number(maxResults) || 36, 1), 50)),
    key: cleanKey,
  })
  if (cleanCountry) {
    searchParams.set('regionCode', cleanCountry)
    searchParams.set('relevanceLanguage', getDiscoveryLanguage(cleanCountry))
  }

  const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`)
  const searchPayload = await searchResponse.json()

  if (!searchResponse.ok) {
    const message = searchPayload?.error?.message || 'YouTube 채널 검색에 실패했습니다.'
    throw new Error(message)
  }

  const channelIds = Array.from(
    new Set((searchPayload.items || []).map((item) => item.id?.channelId).filter(Boolean)),
  )

  if (!channelIds.length) return []

  const channelParams = new URLSearchParams({
    part: 'snippet,statistics',
    id: channelIds.join(','),
    key: cleanKey,
  })
  const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`)
  const channelPayload = await channelResponse.json()

  if (!channelResponse.ok) {
    const message = channelPayload?.error?.message || 'YouTube 채널 통계를 가져오지 못했습니다.'
    throw new Error(message)
  }

  return (channelPayload.items || []).map((channel) => {
    const statistics = channel.statistics || {}
    const snippet = channel.snippet || {}
    const subscribers = Number(statistics.subscriberCount || 0)
    const viewCount = Number(statistics.viewCount || 0)
    const videoCount = Number(statistics.videoCount || 0)
    const averageViews = videoCount > 0 ? Math.round(viewCount / videoCount) : 0
    const handle = snippet.customUrl?.startsWith('@')
      ? snippet.customUrl
      : `channel/${channel.id}`

    return {
      id: channel.id,
      platform: 'YouTube',
      name: snippet.title || 'YouTube Creator',
      handle: handle.startsWith('@') ? handle : `@${handle.replace(/^channel\//, '')}`,
      profileUrl: snippet.customUrl?.startsWith('@')
        ? `https://www.youtube.com/${snippet.customUrl}`
        : `https://www.youtube.com/channel/${channel.id}`,
      avatar: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
      followers: subscribers,
      averageViews,
      totalViews: viewCount,
      videoCount,
      description: snippet.description || '',
      country: snippet.country || '',
      source: 'YouTube Data API',
      verifiedMetrics: true,
    }
  })
}

export async function searchGoogleProfileDiscovery({ apiKey, cx, query, platform, country = 'KR', maxResults = 8 }) {
  const cleanKey = String(apiKey || '').trim()
  const cleanCountry = normalizeDiscoveryCountry(country)
  const cleanCx = String(cx || '').trim()
  const cleanQuery = String(query || '').trim()
  const cleanPlatform = platform === '전체' || String(platform || '').toLowerCase() === 'all' ? '' : platform

  if (CREATOROPS_API_BASE_URL) {
    return callCreatorOpsApi('/discovery/google-profiles/search', {
      query: cleanQuery,
      platform: cleanPlatform || 'all',
      country: cleanCountry,
      maxResults,
    })
  }

  if (!cleanKey || !cleanCx) {
    throw new Error('Instagram/TikTok 실제 웹 검색에는 Google Programmable Search API 키와 CX가 필요합니다.')
  }

  if (!cleanQuery) {
    throw new Error('검색어를 입력해주세요.')
  }

  const platformQueries = cleanPlatform
    ? [cleanPlatform]
    : ['Instagram', 'TikTok', 'YouTube']
  const results = []

  for (const itemPlatform of platformQueries) {
    const siteQuery = getPlatformSiteQuery(itemPlatform)
    const params = new URLSearchParams({
      key: cleanKey,
      cx: cleanCx,
      q: `${siteQuery} ${cleanQuery}`,
      num: String(Math.min(Math.max(Number(maxResults) || 36, 1), 10)),
      gl: cleanCountry ? cleanCountry.toLowerCase() : 'kr',
      safe: 'active',
    })
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`)
    const payload = await response.json()

    if (!response.ok) {
      const message = payload?.error?.message || 'Google 공개 웹 검색에 실패했습니다.'
      throw new Error(message)
    }

    results.push(
      ...(payload.items || [])
        .map((item) => normalizeProfileSearchItem(item, itemPlatform))
        .filter(Boolean),
    )
  }

  return dedupeProfileResults(results).slice(0, Math.min(Math.max(Number(maxResults) || 36, 1), 100))
}

export async function refreshContentMetrics(posts) {
  if (!CREATOROPS_API_BASE_URL) return null

  return callCreatorOpsApi('/tracking/refresh', {
    posts: (posts || []).map((post) => ({
      id: post.id,
      platform: post.platform,
      url: post.url,
    })),
  })
}

export async function fetchPublicProfileSnapshot(url) {
  if (!CREATOROPS_API_BASE_URL) return null
  return callCreatorOpsApi('/public/profile-snapshot', { url })
}

export async function searchContentReferences({ query, country, platform, sort, maxResults = 12 }) {
  if (!CREATOROPS_API_BASE_URL) return null
  return callCreatorOpsApi('/references/search', {
    query,
    country,
    platform,
    sort,
    maxResults,
  })
}

function normalizeDiscoveryCountry(value) {
  const clean = String(value || '').trim().toUpperCase()
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

function getPlatformSiteQuery(platform) {
  if (platform === 'Instagram') return 'site:instagram.com'
  if (platform === 'TikTok') return 'site:tiktok.com/@'
  return 'site:youtube.com'
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
  const title = stripHtml(item.title || '').replace(/\s*[-|•].*$/, '').trim()
  return {
    id: `${platform}:${handle}`,
    platform,
    name: title || handle.replace('@', ''),
    handle,
    profileUrl,
    snippet: stripHtml(item.snippet || ''),
    source: 'Google Programmable Search',
    verifiedMetrics: false,
  }
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  if (channelMatch) {
    return { type: 'id', value: channelMatch[1] }
  }

  const handleMatch = value.match(/youtube\.com\/@([\w.-]+)/i)
  if (handleMatch) {
    return { type: 'handle', value: `@${handleMatch[1]}` }
  }

  if (/^UC[\w-]+$/.test(value)) {
    return { type: 'id', value }
  }

  return {
    type: 'handle',
    value: value.startsWith('@') ? value : `@${value}`,
  }
}
