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

export function buildCreatorSourceEvidence(creator) {
  if (!creator) return []

  const isYouTube = creator.platform === 'YouTube'
  const isConnectedPlatform = isYouTube
  const publicSnapshotSource = `${creator.platform} 공개 프로필 스냅샷`
  const sourceOverride = (metric) => creator.metricSources?.find((source) => source.metric === metric)

  return [
    {
      metric: '팔로워',
      source: sourceOverride('팔로워')?.source ?? (isConnectedPlatform ? 'YouTube Data API 검증 대상' : publicSnapshotSource),
      method: sourceOverride('팔로워')?.method ?? (isConnectedPlatform ? 'channels.list statistics' : '공개 프로필/미디어킷 주기 수집'),
      confidence: sourceOverride('팔로워')?.confidence ?? (isConnectedPlatform ? 96 : 72),
      freshness: sourceOverride('팔로워')?.freshness ?? (isConnectedPlatform ? '일 1회 갱신' : '주 1회 스냅샷'),
    },
    {
      metric: '평균 조회',
      source: sourceOverride('평균 조회')?.source ?? (isConnectedPlatform ? 'YouTube videos.list 계산' : '최근 콘텐츠 공개 지표 계산'),
      method: sourceOverride('평균 조회')?.method ?? '최근 N개 콘텐츠 중앙값/평균값 혼합',
      confidence: sourceOverride('평균 조회')?.confidence ?? (isConnectedPlatform ? 92 : 70),
      freshness: sourceOverride('평균 조회')?.freshness ?? '캠페인 후보 갱신 시',
    },
    {
      metric: '참여율',
      source: '공개 반응 데이터 계산',
      method: '(좋아요 + 댓글 + 공유 추정) / 팔로워',
      confidence: creator.platform === 'Instagram' ? 66 : 74,
      freshness: '콘텐츠 스냅샷 기준',
    },
    {
      metric: '오디언스/가짜 팔로워',
      source: '공개 신호 + 인증 데이터 우선',
      method: '성장 급등, 반복 댓글, 카테고리 불일치, 인증 인사이트 교차검증',
      confidence: 62,
      freshness: '검증 단계에서 재계산',
    },
    {
      metric: '예상 단가',
      source: '우리 CPM 모델',
      method: '플랫폼/카테고리/평균 조회/참여율/브랜드 안정성 가중치',
      confidence: 58,
      freshness: '견적 응답 수집 후 보정',
    },
  ]
}

export function calculateDataCoverage(creators) {
  const evidence = creators.flatMap((creator) => buildCreatorSourceEvidence(creator))
  const confidence =
    evidence.reduce((sum, item) => sum + item.confidence, 0) / Math.max(evidence.length, 1)
  const officialReady = creators.filter((creator) => creator.platform === 'YouTube').length
  const profileSnapshots = creators.length
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
    country: snippet.country || 'KR',
    source: 'YouTube Data API',
  }
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
