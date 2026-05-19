import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TrendingUp,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react'
import './App.css'

const STORE_KEY = 'creatorops.workspace.v2'

const defaultCreators = [
  {
    id: 1,
    name: '민서로그',
    handle: '@minseo.log',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
    platform: 'YouTube',
    category: '뷰티',
    country: 'KR',
    followers: 1240000,
    averageViews: 284000,
    engagement: 5.8,
    growth: 12.4,
    fit: 94,
    brandSafety: 98,
    fakeRisk: 3,
    cpm: 8200,
    price: 6800000,
    audience: '여성 73% · 18-34',
    city: '서울',
    lastPost: '2시간 전',
    status: '협업 가능',
    topics: ['스킨케어', '데일리룩', '올리브영'],
  },
  {
    id: 2,
    name: '테크노트 준',
    handle: '@technote_jun',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
    platform: 'YouTube',
    category: '테크',
    country: 'KR',
    followers: 892000,
    averageViews: 196000,
    engagement: 4.7,
    growth: 8.9,
    fit: 89,
    brandSafety: 96,
    fakeRisk: 5,
    cpm: 9600,
    price: 5400000,
    audience: '남성 68% · 24-44',
    city: '판교',
    lastPost: '어제',
    status: '견적 필요',
    topics: ['노트북', 'AI툴', '생산성'],
  },
  {
    id: 3,
    name: '하루식탁',
    handle: '@haru.table',
    avatar:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
    platform: 'Instagram',
    category: '푸드',
    country: 'KR',
    followers: 418000,
    averageViews: 99000,
    engagement: 7.2,
    growth: 18.1,
    fit: 92,
    brandSafety: 99,
    fakeRisk: 2,
    cpm: 6100,
    price: 2600000,
    audience: '여성 81% · 25-39',
    city: '부산',
    lastPost: '5시간 전',
    status: '우선 추천',
    topics: ['밀키트', '집밥', '키친웨어'],
  },
  {
    id: 4,
    name: '핏모먼트',
    handle: '@fitmoment.kr',
    avatar:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
    platform: 'TikTok',
    category: '피트니스',
    country: 'KR',
    followers: 653000,
    averageViews: 322000,
    engagement: 8.9,
    growth: 23.6,
    fit: 86,
    brandSafety: 93,
    fakeRisk: 8,
    cpm: 5200,
    price: 3900000,
    audience: '남성 54% · 18-29',
    city: '대구',
    lastPost: '3시간 전',
    status: '응답 빠름',
    topics: ['홈트', '보충제', '다이어트'],
  },
  {
    id: 5,
    name: '캠핑해나',
    handle: '@camp.haena',
    avatar:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80',
    platform: 'Instagram',
    category: '아웃도어',
    country: 'KR',
    followers: 274000,
    averageViews: 74000,
    engagement: 6.4,
    growth: 10.2,
    fit: 82,
    brandSafety: 97,
    fakeRisk: 4,
    cpm: 5800,
    price: 1800000,
    audience: '여성 58% · 27-42',
    city: '강릉',
    lastPost: '오늘',
    status: '콘텐츠 강점',
    topics: ['캠핑장비', '차박', '여행'],
  },
  {
    id: 6,
    name: '소비왕 랩',
    handle: '@sobiking_lab',
    avatar:
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80',
    platform: 'TikTok',
    category: '리뷰',
    country: 'KR',
    followers: 518000,
    averageViews: 241000,
    engagement: 6.9,
    growth: 16.7,
    fit: 88,
    brandSafety: 91,
    fakeRisk: 11,
    cpm: 4700,
    price: 3100000,
    audience: '혼합 51:49 · 18-34',
    city: '인천',
    lastPost: '1시간 전',
    status: '단가 효율',
    topics: ['가성비', '언박싱', '생활용품'],
  },
]

const defaultCampaigns = [
  {
    id: 101,
    name: '스프링 세럼 런칭',
    owner: 'Brand A',
    status: '라이브',
    budget: 42000000,
    spend: 28700000,
    revenue: 94200000,
    deadline: '5월 28일',
    objective: '구매 전환',
    progress: 68,
    creatorIds: [1, 3, 6],
    stages: [34, 21, 18, 12],
    createdAt: '데모 데이터',
  },
  {
    id: 102,
    name: 'AI 노트북 프리오더',
    owner: 'Brand B',
    status: '섭외',
    budget: 62000000,
    spend: 11400000,
    revenue: 28100000,
    deadline: '6월 4일',
    objective: '예약 판매',
    progress: 36,
    creatorIds: [2, 6],
    stages: [52, 19, 9, 3],
    createdAt: '데모 데이터',
  },
  {
    id: 103,
    name: '헬시 스낵 챌린지',
    owner: 'Brand C',
    status: '리포트',
    budget: 28000000,
    spend: 24600000,
    revenue: 61100000,
    deadline: '오늘',
    objective: '브랜드 검색량',
    progress: 91,
    creatorIds: [3, 4],
    stages: [41, 33, 24, 21],
    createdAt: '데모 데이터',
  },
]

const defaultBrandBrief = {
  brandName: '스킨케어 D2C 브랜드',
  product: '저자극 장벽 세럼',
  persona: '성분을 꼼꼼히 보고 합리적으로 구매하는 20-30대 여성',
  goal: '구매 전환',
  platforms: ['YouTube', 'Instagram', 'TikTok'],
  categories: ['뷰티', '리뷰', '푸드'],
  keywords: '스킨케어, 데일리룩, 올리브영, 가성비, 리뷰',
  exclusions: '논란, 도박, 과장 광고',
  minFollowers: 100000,
  maxPrice: 7000000,
  tone: '정중하지만 자연스러운 제안',
}

const defaultTrackedPosts = [
  {
    id: 3001,
    campaignId: 101,
    creatorId: 1,
    platform: 'YouTube',
    title: '장벽 세럼 7일 사용 리뷰',
    url: 'https://youtube.com/watch?v=demo-serum',
    status: '추적 중',
    publishedAt: '오늘 09:30',
    views: 184000,
    likes: 9200,
    comments: 612,
    shares: 840,
    saves: 0,
    conversions: 312,
    lastChecked: '오늘 11:40',
  },
  {
    id: 3002,
    campaignId: 101,
    creatorId: 3,
    platform: 'Instagram',
    title: '아침 루틴 속 세럼 릴스',
    url: 'https://instagram.com/reel/demo-serum',
    status: '추적 중',
    publishedAt: '어제 18:10',
    views: 92000,
    likes: 7600,
    comments: 348,
    shares: 420,
    saves: 1280,
    conversions: 144,
    lastChecked: '오늘 11:20',
  },
]

const defaultRecommendations = [
  {
    id: 4101,
    creatorId: 1,
    campaignId: 101,
    score: 96,
    persona: '성분 중심 스킨케어 탐색층 · 여성 73% · YouTube 중심',
    reasons: [
      '스킨케어, 데일리룩, 올리브영 키워드가 제품 페르소나와 직접 연결됨',
      '124만 팔로워와 평균 조회 28.4만으로 런칭 초반 도달 확보 가능',
      '브랜드 안정성 98, 가짜 팔로워 위험 3%로 리스크가 낮음',
    ],
    risk: '즉시 제안 가능',
    message:
      '민서로그님 안녕하세요. 스킨케어 D2C 브랜드의 저자극 장벽 세럼 캠페인 제안드립니다. 스킨케어와 데일리룩 콘텐츠 톤이 저희 타깃 페르소나와 잘 맞아 협업을 제안드리고 싶습니다.',
    createdAt: '데모 데이터',
  },
  {
    id: 4102,
    creatorId: 3,
    campaignId: 101,
    score: 91,
    persona: '생활 루틴형 구매층 · 여성 81% · Instagram 중심',
    reasons: [
      '집밥, 밀키트, 키친웨어 콘텐츠 안에 자연스러운 루틴형 제품 노출 가능',
      '참여율 7.2%로 댓글/저장 반응이 강한 편',
      '브랜드 안정성 99, 가짜 팔로워 위험 2%로 신뢰도가 높음',
    ],
    risk: '콘텐츠 콘셉트 조율 필요',
    message:
      '하루식탁님 안녕하세요. 일상 루틴 속에서 자연스럽게 소개할 수 있는 저자극 장벽 세럼 캠페인을 제안드립니다. 브랜드 톤과 팔로워 반응이 잘 맞는다고 판단했습니다.',
    createdAt: '데모 데이터',
  },
]

const defaultWorkspace = {
  creators: defaultCreators,
  campaigns: defaultCampaigns,
  brandBrief: defaultBrandBrief,
  shortlist: [1, 3, 6],
  recommendations: defaultRecommendations,
  outreach: [
    {
      id: 501,
      creatorId: 1,
      campaignId: 101,
      source: '수동',
      status: '발송',
      message: '세럼 런칭 캠페인 제안서 발송',
      createdAt: '오늘 10:24',
    },
    {
      id: 502,
      creatorId: 3,
      campaignId: 103,
      source: '자동',
      status: '응답',
      message: '스낵 챌린지 일정 확인 완료',
      createdAt: '어제 16:10',
    },
  ],
  recruitedPool: [
    {
      id: 801,
      creatorId: 3,
      campaignId: 103,
      source: '자동',
      status: '섭외 완료',
      note: '푸드/생활 루틴 콘텐츠 반응이 좋아 재섭외 후보로 저장',
      createdAt: '어제 17:30',
    },
  ],
  quotes: [
    {
      id: 701,
      creatorId: 2,
      campaignId: 102,
      amount: 5400000,
      status: '견적 대기',
      createdAt: '오늘 09:12',
    },
  ],
  trackedPosts: defaultTrackedPosts,
  activities: [
    {
      id: 9001,
      type: 'campaign',
      text: '스프링 세럼 런칭 캠페인 라이브 상태 확인',
      createdAt: '오늘 11:20',
    },
    {
      id: 9002,
      type: 'outreach',
      text: '민서로그에게 제안 메시지 발송',
      createdAt: '오늘 10:24',
    },
    {
      id: 9003,
      type: 'quote',
      text: '테크노트 준 견적 요청 생성',
      createdAt: '오늘 09:12',
    },
  ],
}

const platformOptions = ['전체', 'YouTube', 'Instagram', 'TikTok']
const categoryOptions = ['전체', '뷰티', '테크', '푸드', '피트니스', '아웃도어', '리뷰']
const campaignStatuses = ['섭외', '콘텐츠 제작', '라이브', '리포트', '완료']

function normalizeWorkspace(saved) {
  return {
    ...defaultWorkspace,
    ...saved,
    creators: saved?.creators?.length ? saved.creators : defaultWorkspace.creators,
    campaigns: saved?.campaigns?.length ? saved.campaigns : defaultWorkspace.campaigns,
    brandBrief: {
      ...defaultWorkspace.brandBrief,
      ...(saved?.brandBrief ?? {}),
    },
    shortlist: saved?.shortlist ?? defaultWorkspace.shortlist,
    recommendations: saved?.recommendations?.length ? saved.recommendations : defaultWorkspace.recommendations,
    outreach: saved?.outreach ?? defaultWorkspace.outreach,
    recruitedPool: saved?.recruitedPool ?? defaultWorkspace.recruitedPool,
    quotes: saved?.quotes ?? defaultWorkspace.quotes,
    trackedPosts: saved?.trackedPosts ?? defaultWorkspace.trackedPosts,
    activities: saved?.activities ?? defaultWorkspace.activities,
  }
}

function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key)
      return saved ? normalizeWorkspace(JSON.parse(saved)) : fallback
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

function nowLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

function createId() {
  return Date.now() + Math.floor(Math.random() * 1000)
}

function compactNumber(value) {
  return new Intl.NumberFormat('ko-KR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function won(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function getCreatorsByIds(creators, ids) {
  return ids.map((id) => creators.find((creator) => creator.id === id)).filter(Boolean)
}

function keywordList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function buildRecommendation(creator, brief, campaign) {
  const wantedKeywords = keywordList(brief.keywords)
  const exclusions = keywordList(brief.exclusions)
  const creatorText = [
    creator.name,
    creator.handle,
    creator.category,
    creator.platform,
    creator.audience,
    creator.status,
    ...creator.topics,
  ]
    .join(' ')
    .toLowerCase()

  const keywordHits = wantedKeywords.filter((keyword) => creatorText.includes(keyword))
  const exclusionHits = exclusions.filter((keyword) => creatorText.includes(keyword))
  const platformFit = brief.platforms.includes(creator.platform) ? 18 : -8
  const categoryFit = brief.categories.includes(creator.category) ? 18 : -4
  const scaleFit = creator.followers >= Number(brief.minFollowers) ? 12 : -10
  const budgetFit = creator.price <= Number(brief.maxPrice) ? 12 : -12
  const engagementFit = Math.min(14, Math.round(creator.engagement * 1.6))
  const safetyFit = Math.round((creator.brandSafety - creator.fakeRisk) / 8)
  const keywordFit = Math.min(18, keywordHits.length * 6)
  const score = Math.max(
    32,
    Math.min(
      99,
      Math.round(40 + platformFit + categoryFit + scaleFit + budgetFit + engagementFit + safetyFit + keywordFit - exclusionHits.length * 12),
    ),
  )
  const persona = `${creator.category} 관심층 · ${creator.audience} · ${creator.platform} 중심`
  const reasons = [
    `${brief.product}과 연결되는 키워드 ${keywordHits.length ? keywordHits.join(', ') : creator.topics.slice(0, 2).join(', ')} 보유`,
    `${compactNumber(creator.followers)} 팔로워와 평균 조회 ${compactNumber(creator.averageViews)}로 캠페인 도달 예측 가능`,
    `브랜드 안정성 ${creator.brandSafety}, 가짜 팔로워 위험 ${creator.fakeRisk}%`,
    `${campaign?.name ?? brief.goal} 목표에 맞춘 예상 단가 ${won(creator.price)}`,
  ]
  const risk = exclusionHits.length
    ? `제외 키워드 감지: ${exclusionHits.join(', ')}`
    : creator.fakeRisk > 9
      ? '팔로워 품질 검토 필요'
      : '즉시 제안 가능'

  return {
    id: createId(),
    creatorId: creator.id,
    campaignId: campaign?.id,
    score,
    persona,
    reasons,
    risk,
    message: `${creator.name}님 안녕하세요. ${brief.brandName}의 ${brief.product} 캠페인 제안드립니다. ${creator.topics.slice(0, 2).join(', ')} 콘텐츠 톤이 저희가 찾는 "${brief.persona}" 페르소나와 잘 맞아 협업을 제안드리고 싶습니다. 가능하신 일정과 단가 확인 부탁드립니다.`,
    createdAt: nowLabel(),
  }
}

function appendActivity(workspace, type, text) {
  return {
    ...workspace,
    activities: [
      {
        id: createId(),
        type,
        text,
        createdAt: nowLabel(),
      },
      ...workspace.activities,
    ].slice(0, 40),
  }
}

function exportFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [workspace, setWorkspace] = usePersistentState(STORE_KEY, defaultWorkspace)
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('전체')
  const [category, setCategory] = useState('전체')
  const [selectedCreatorId, setSelectedCreatorId] = useState(workspace.creators[0]?.id)
  const [selectedCampaignId, setSelectedCampaignId] = useState(workspace.campaigns[0]?.id)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)
  const [proposalText, setProposalText] = useState(
    '안녕하세요. 브랜드 캠페인 협업 제안드립니다. 콘텐츠 콘셉트와 일정 확인 부탁드립니다.',
  )
  const [campaignDraft, setCampaignDraft] = useState({
    name: '',
    owner: '',
    budget: '',
    deadline: '',
    objective: '브랜드 인지도',
  })
  const [creatorDraft, setCreatorDraft] = useState({
    name: '',
    handle: '',
    platform: 'Instagram',
    category: '리뷰',
    city: '서울',
    followers: '',
    averageViews: '',
    engagement: '',
    price: '',
    topics: '',
  })
  const [trackingDraft, setTrackingDraft] = useState({
    campaignId: '',
    creatorId: '',
    platform: 'Instagram',
    title: '',
    url: '',
    views: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
  })

  const {
    creators,
    campaigns,
    brandBrief,
    shortlist,
    recommendations,
    outreach,
    recruitedPool,
    quotes,
    trackedPosts,
    activities,
  } = workspace

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredCreators = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return creators
      .filter((creator) => {
        const searchable = [
          creator.name,
          creator.handle,
          creator.category,
          creator.platform,
          creator.city,
          ...creator.topics,
        ]
          .join(' ')
          .toLowerCase()

        return (
          (!normalized || searchable.includes(normalized)) &&
          (platform === '전체' || creator.platform === platform) &&
          (category === '전체' || creator.category === category)
        )
      })
      .sort((a, b) => b.fit - a.fit)
  }, [category, creators, platform, query])

  const selectedCreator =
    creators.find((creator) => creator.id === selectedCreatorId) ??
    filteredCreators[0] ??
    creators[0]

  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0]

  const selectedCreatorOutreach = outreach.filter((item) => item.creatorId === selectedCreator?.id)
  const selectedCreatorQuotes = quotes.filter((item) => item.creatorId === selectedCreator?.id)
  const selectedCampaignPosts = trackedPosts.filter((post) => post.campaignId === selectedCampaign?.id)
  const autoOutreachCount = outreach.filter((item) => item.source === '자동').length
  const manualOutreachCount = outreach.filter((item) => item.source !== '자동').length

  const trackedTotals = useMemo(
    () =>
      trackedPosts.reduce(
        (summary, post) => ({
          views: summary.views + Number(post.views || 0),
          likes: summary.likes + Number(post.likes || 0),
          comments: summary.comments + Number(post.comments || 0),
          shares: summary.shares + Number(post.shares || 0),
          saves: summary.saves + Number(post.saves || 0),
          conversions: summary.conversions + Number(post.conversions || 0),
        }),
        { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, conversions: 0 },
      ),
    [trackedPosts],
  )

  const totals = useMemo(() => {
    const reach = filteredCreators.reduce((sum, creator) => sum + creator.followers, 0)
    const views = filteredCreators.reduce((sum, creator) => sum + creator.averageViews, 0)
    const engagement =
      filteredCreators.reduce((sum, creator) => sum + creator.engagement, 0) /
      Math.max(filteredCreators.length, 1)
    const budget = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0)
    const revenue = campaigns.reduce((sum, campaign) => sum + campaign.revenue, 0)
    const spend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0)

    return {
      reach,
      views,
      engagement,
      budget,
      spend,
      revenue,
      roi: revenue / Math.max(spend, 1),
    }
  }, [campaigns, filteredCreators])

  const scoreBands = useMemo(
    () => [
      {
        label: '브랜드 핏',
        value: Math.round(
          creators.reduce((sum, creator) => sum + creator.fit, 0) / Math.max(creators.length, 1),
        ),
        tone: 'green',
      },
      {
        label: '평균 안정성',
        value: Math.round(
          creators.reduce((sum, creator) => sum + creator.brandSafety, 0) /
            Math.max(creators.length, 1),
        ),
        tone: 'blue',
      },
      {
        label: '응답 가능성',
        value: Math.min(95, 65 + outreach.filter((item) => item.status === '응답').length * 7),
        tone: 'amber',
      },
    ],
    [creators, outreach],
  )

  const showToast = (message) => setToast(message)

  const updateWorkspace = (mutator) => {
    setWorkspace((current) => mutator(current))
  }

  const jumpTo = (section) => {
    setActiveSection(section)

    if (section === 'messages') {
      setModal({ type: 'messages' })
      return
    }

    window.document
      .getElementById(section)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleShortlist = (creator) => {
    const exists = shortlist.includes(creator.id)

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          shortlist: exists
            ? current.shortlist.filter((id) => id !== creator.id)
            : [...current.shortlist, creator.id],
        },
        'shortlist',
        exists ? `${creator.name} 쇼트리스트 해제` : `${creator.name} 쇼트리스트 저장`,
      ),
    )
    showToast(exists ? `${creator.name} 저장을 해제했어요.` : `${creator.name}을(를) 쇼트리스트에 저장했어요.`)
  }

  const resetSearch = () => {
    setQuery('')
    setPlatform('전체')
    setCategory('전체')
    showToast('검색 조건을 초기화했어요.')
  }

  const saveFilter = () => {
    updateWorkspace((current) =>
      appendActivity(current, 'filter', `필터 저장: ${platform} · ${category}${query ? ` · ${query}` : ''}`),
    )
    showToast('현재 검색 필터를 운영 기록에 저장했어요.')
  }

  const updateBrandBrief = (field, value) => {
    updateWorkspace((current) => ({
      ...current,
      brandBrief: {
        ...current.brandBrief,
        [field]: value,
      },
    }))
  }

  const toggleBriefList = (field, value) => {
    updateWorkspace((current) => {
      const currentValues = current.brandBrief[field]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value]

      return {
        ...current,
        brandBrief: {
          ...current.brandBrief,
          [field]: nextValues,
        },
      }
    })
  }

  const runAiDiscovery = () => {
    const eligibleCreators = creators.filter(
      (creator) =>
        creator.followers >= Number(brandBrief.minFollowers) &&
        creator.price <= Number(brandBrief.maxPrice) &&
        brandBrief.platforms.includes(creator.platform),
    )
    const ranked = eligibleCreators
      .map((creator) => buildRecommendation(creator, brandBrief, selectedCampaign))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          recommendations: ranked,
          shortlist: Array.from(new Set([...current.shortlist, ...ranked.slice(0, 3).map((item) => item.creatorId)])),
        },
        'ai',
        `${brandBrief.brandName} 조건으로 AI 후보 ${ranked.length}명 추출`,
      ),
    )
    showToast(`AI가 브랜드 페르소나 기준으로 후보 ${ranked.length}명을 추출했어요.`)
  }

  const queueRecommendation = (recommendation) => {
    const creator = creators.find((item) => item.id === recommendation.creatorId)
    const campaign = campaigns.find((item) => item.id === recommendation.campaignId) ?? selectedCampaign
    if (!creator || !campaign) return

    const record = {
      id: createId(),
      creatorId: creator.id,
      campaignId: campaign.id,
      source: '자동',
      status: '승인 대기',
      message: recommendation.message,
      reason: recommendation.reasons.join(' / '),
      score: recommendation.score,
      createdAt: nowLabel(),
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: [record, ...current.outreach],
        },
        'outreach',
        `${creator.name} 제안 메시지 승인 큐 생성`,
      ),
    )
    showToast(`${creator.name} 제안 메시지를 승인 큐에 넣었어요.`)
  }

  const exportCsvReport = () => {
    const rows = [
      [
        'campaign',
        'status',
        'owner',
        'budget',
        'spend',
        'revenue',
        'creator_count',
        'creators',
        'deadline',
      ],
      ...campaigns.map((campaign) => {
        const campaignCreators = getCreatorsByIds(creators, campaign.creatorIds)
          .map((creator) => creator.name)
          .join(' / ')

        return [
          campaign.name,
          campaign.status,
          campaign.owner,
          campaign.budget,
          campaign.spend,
          campaign.revenue,
          campaign.creatorIds.length,
          campaignCreators,
          campaign.deadline,
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    exportFile('creatorops-campaign-report.csv', 'text/csv;charset=utf-8', csv)
    showToast('CSV 리포트를 다운로드했어요.')
  }

  const exportPerformanceReport = () => {
    const rows = [
      [
        'campaign',
        'creator',
        'platform',
        'content_title',
        'url',
        'views',
        'likes',
        'comments',
        'shares',
        'saves',
        'conversions',
        'last_checked',
      ],
      ...trackedPosts.map((post) => {
        const campaign = campaigns.find((item) => item.id === post.campaignId)
        const creator = creators.find((item) => item.id === post.creatorId)
        return [
          campaign?.name ?? '',
          creator?.name ?? '',
          post.platform,
          post.title,
          post.url,
          post.views,
          post.likes,
          post.comments,
          post.shares,
          post.saves,
          post.conversions,
          post.lastChecked,
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>CreatorOps Report</title><style>body{font-family:system-ui,sans-serif;margin:32px;color:#15201d}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dce4e1;padding:8px;text-align:left}th{background:#eef2f1}.metric{display:inline-block;margin:0 16px 16px 0}</style><h1>CreatorOps 성과 보고서</h1><div class="metric"><strong>조회수</strong><br>${compactNumber(trackedTotals.views)}</div><div class="metric"><strong>댓글</strong><br>${compactNumber(trackedTotals.comments)}</div><div class="metric"><strong>공유</strong><br>${compactNumber(trackedTotals.shares)}</div><div class="metric"><strong>전환</strong><br>${compactNumber(trackedTotals.conversions)}</div><table><thead><tr>${rows[0].map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></html>`
    exportFile('creatorops-performance-report.csv', 'text/csv;charset=utf-8', csv)
    exportFile('creatorops-performance-report.html', 'text/html;charset=utf-8', html)
    showToast('성과 CSV와 HTML 보고서를 다운로드했어요.')
  }

  const exportWorkspace = () => {
    exportFile(
      'creatorops-workspace-backup.json',
      'application/json;charset=utf-8',
      JSON.stringify(workspace, null, 2),
    )
    showToast('현재 워크스페이스 백업 JSON을 다운로드했어요.')
  }

  const resetWorkspace = () => {
    if (!window.confirm('로컬에 저장된 작업 데이터를 데모 데이터로 초기화할까요?')) return
    setWorkspace(defaultWorkspace)
    setSelectedCreatorId(defaultWorkspace.creators[0].id)
    setSelectedCampaignId(defaultWorkspace.campaigns[0].id)
    setModal(null)
    showToast('데모 데이터로 초기화했어요.')
  }

  const openCampaign = (campaign) => {
    setSelectedCampaignId(campaign.id)
    setModal({ type: 'campaign', campaignId: campaign.id })
  }

  const advanceCampaign = (campaignId) => {
    updateWorkspace((current) => {
      const campaign = current.campaigns.find((item) => item.id === campaignId)
      const nextCampaigns = current.campaigns.map((item) => {
        if (item.id !== campaignId) return item
        const statusIndex = campaignStatuses.indexOf(item.status)
        const nextStatus = campaignStatuses[Math.min(statusIndex + 1, campaignStatuses.length - 1)]
        const nextSpend = Math.min(item.budget, item.spend + Math.round(item.budget * 0.15))

        return {
          ...item,
          status: nextStatus,
          progress: Math.min(item.progress + 14, 100),
          spend: nextSpend,
          revenue: item.revenue + Math.round(item.budget * 0.22),
          stages: item.stages.map((stage, index) => stage + (index === statusIndex ? 8 : 3)),
        }
      })

      return appendActivity(
        {
          ...current,
          campaigns: nextCampaigns,
        },
        'campaign',
        `${campaign?.name ?? '캠페인'} 다음 단계 이동`,
      )
    })
    showToast('캠페인 상태, 집행액, 성과 예측을 업데이트했어요.')
  }

  const createCampaign = (event) => {
    event.preventDefault()
    const assignedCreators = getCreatorsByIds(creators, shortlist)
    const estimatedCost = assignedCreators.reduce((sum, creator) => sum + creator.price, 0)
    const budget = Number(campaignDraft.budget) || Math.max(estimatedCost, 15000000)
    const nextCampaign = {
      id: createId(),
      name: campaignDraft.name || '신규 인플루언서 캠페인',
      owner: campaignDraft.owner || 'New Brand',
      status: '섭외',
      budget,
      spend: Math.min(Math.round(estimatedCost * 0.15), budget),
      revenue: Math.round(budget * 0.85),
      deadline: campaignDraft.deadline || '일정 미정',
      objective: campaignDraft.objective,
      progress: 12,
      creatorIds: [...shortlist],
      stages: [Math.max(18, shortlist.length * 8), 8, 3, 1],
      createdAt: nowLabel(),
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          campaigns: [nextCampaign, ...current.campaigns],
        },
        'campaign',
        `${nextCampaign.name} 생성 · ${shortlist.length}명 배정`,
      ),
    )
    setSelectedCampaignId(nextCampaign.id)
    setCampaignDraft({
      name: '',
      owner: '',
      budget: '',
      deadline: '',
      objective: '브랜드 인지도',
    })
    setModal(null)
    showToast(`${nextCampaign.name} 캠페인을 저장했어요. 새로고침해도 남습니다.`)
    window.setTimeout(() => jumpTo('campaigns'), 120)
  }

  const createCreator = (event) => {
    event.preventDefault()
    const followers = Number(creatorDraft.followers) || 10000
    const averageViews = Number(creatorDraft.averageViews) || Math.round(followers * 0.18)
    const engagement = Number(creatorDraft.engagement) || 4.5
    const price = Number(creatorDraft.price) || Math.round(averageViews * 18)
    const nextCreator = {
      id: createId(),
      name: creatorDraft.name || '신규 크리에이터',
      handle: creatorDraft.handle || '@new.creator',
      avatar:
        'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=160&q=80',
      platform: creatorDraft.platform,
      category: creatorDraft.category,
      country: 'KR',
      followers,
      averageViews,
      engagement,
      growth: 7.4,
      fit: Math.min(96, Math.round(72 + engagement * 2.5)),
      brandSafety: 94,
      fakeRisk: 6,
      cpm: Math.max(3500, Math.round(price / Math.max(averageViews / 1000, 1))),
      price,
      audience: '혼합 오디언스 · 직접 입력',
      city: creatorDraft.city || '서울',
      lastPost: '직접 등록',
      status: '신규 등록',
      topics: creatorDraft.topics
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean)
        .slice(0, 5),
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          creators: [nextCreator, ...current.creators],
          shortlist: [...current.shortlist, nextCreator.id],
        },
        'creator',
        `${nextCreator.name} 등록 및 쇼트리스트 추가`,
      ),
    )
    setCreatorDraft({
      name: '',
      handle: '',
      platform: 'Instagram',
      category: '리뷰',
      city: '서울',
      followers: '',
      averageViews: '',
      engagement: '',
      price: '',
      topics: '',
    })
    setSelectedCreatorId(nextCreator.id)
    setModal(null)
    showToast(`${nextCreator.name}을(를) 등록하고 저장했어요.`)
  }

  const sendProposal = (event) => {
    event.preventDefault()
    const campaign = selectedCampaign
    const record = {
      id: createId(),
      creatorId: selectedCreator.id,
      campaignId: campaign.id,
      source: '수동',
      status: '승인 대기',
      message: proposalText,
      reason: '수동 작성 제안 메시지',
      createdAt: nowLabel(),
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: [record, ...current.outreach],
        },
        'outreach',
        `${selectedCreator.name}에게 ${campaign.name} 제안 발송`,
      ),
    )
    setModal(null)
    showToast(`${selectedCreator.name} 제안 메시지를 승인 큐에 저장했어요.`)
  }

  const requestQuote = () => {
    const campaign = selectedCampaign
    const record = {
      id: createId(),
      creatorId: selectedCreator.id,
      campaignId: campaign.id,
      amount: selectedCreator.price,
      status: '견적 대기',
      createdAt: nowLabel(),
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          quotes: [record, ...current.quotes],
        },
        'quote',
        `${selectedCreator.name} 견적 요청 · ${won(selectedCreator.price)}`,
      ),
    )
    setModal(null)
    showToast(`${selectedCreator.name} 견적 요청 기록을 저장했어요.`)
  }

  const createTrackedPost = (event) => {
    event.preventDefault()
    const campaignId = Number(trackingDraft.campaignId) || selectedCampaign?.id
    const creatorId = Number(trackingDraft.creatorId) || selectedCreator?.id
    const nextPost = {
      id: createId(),
      campaignId,
      creatorId,
      platform: trackingDraft.platform,
      title: trackingDraft.title || '신규 캠페인 콘텐츠',
      url: trackingDraft.url || 'https://example.com/content',
      status: '추적 중',
      publishedAt: nowLabel(),
      views: Number(trackingDraft.views) || 0,
      likes: Number(trackingDraft.likes) || 0,
      comments: Number(trackingDraft.comments) || 0,
      shares: Number(trackingDraft.shares) || 0,
      saves: Number(trackingDraft.saves) || 0,
      conversions: 0,
      lastChecked: nowLabel(),
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          trackedPosts: [nextPost, ...current.trackedPosts],
        },
        'tracking',
        `${nextPost.title} 콘텐츠 추적 등록`,
      ),
    )
    setTrackingDraft({
      campaignId: '',
      creatorId: '',
      platform: 'Instagram',
      title: '',
      url: '',
      views: '',
      likes: '',
      comments: '',
      shares: '',
      saves: '',
    })
    setModal(null)
    showToast('콘텐츠 추적 항목을 저장했어요.')
  }

  const refreshTracking = () => {
    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          trackedPosts: current.trackedPosts.map((post) => {
            const viewLift = Math.max(180, Math.round(post.views * 0.08))
            return {
              ...post,
              views: post.views + viewLift,
              likes: post.likes + Math.round(viewLift * 0.045),
              comments: post.comments + Math.round(viewLift * 0.004),
              shares: post.shares + Math.round(viewLift * 0.006),
              saves: post.saves + Math.round(viewLift * 0.01),
              conversions: post.conversions + Math.round(viewLift * 0.0018),
              lastChecked: nowLabel(),
            }
          }),
        },
        'tracking',
        '콘텐츠 성과 추적 데이터 갱신',
      ),
    )
    showToast('콘텐츠 조회수, 댓글, 공유 데이터를 갱신했어요.')
  }

  const markOutreachSent = (itemId) => {
    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: current.outreach.map((item) =>
            item.id === itemId ? { ...item, status: '발송 완료', sentAt: nowLabel() } : item,
          ),
        },
        'outreach',
        '승인 대기 메시지를 발송 완료로 저장',
      ),
    )
    showToast('메시지를 발송 완료로 기록했어요.')
  }

  const markOutreachResponse = (itemId) => {
    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: current.outreach.map((item) =>
            item.id === itemId ? { ...item, status: '응답' } : item,
          ),
        },
        'outreach',
        '아웃리치 응답 상태 업데이트',
      ),
    )
    showToast('응답 상태를 저장했어요.')
  }

  const completeRecruitment = (itemId) => {
    updateWorkspace((current) => {
      const outreachItem = current.outreach.find((item) => item.id === itemId)
      const creator = current.creators.find((item) => item.id === outreachItem?.creatorId)
      const campaign = current.campaigns.find((item) => item.id === outreachItem?.campaignId)

      if (!outreachItem || !creator || !campaign) return current

      const alreadySaved = current.recruitedPool.some(
        (item) => item.creatorId === creator.id && item.campaignId === campaign.id,
      )
      const nextPool = alreadySaved
        ? current.recruitedPool
        : [
            {
              id: createId(),
              creatorId: creator.id,
              campaignId: campaign.id,
              source: outreachItem.source ?? '수동',
              status: '섭외 완료',
              note: outreachItem.reason ?? `${campaign.name} 캠페인 섭외 완료`,
              createdAt: nowLabel(),
            },
            ...current.recruitedPool,
          ]

      return appendActivity(
        {
          ...current,
          outreach: current.outreach.map((item) =>
            item.id === itemId ? { ...item, status: '섭외 완료' } : item,
          ),
          recruitedPool: nextPool,
          campaigns: current.campaigns.map((item) =>
            item.id === campaign.id && !item.creatorIds.includes(creator.id)
              ? { ...item, creatorIds: [...item.creatorIds, creator.id] }
              : item,
          ),
        },
        'recruited',
        `${creator.name} 섭외 완료 풀 저장`,
      )
    })
    showToast('섭외 완료 인플루언서 풀에 저장했어요.')
  }

  const activeCampaignForModal =
    modal?.type === 'campaign'
      ? campaigns.find((campaign) => campaign.id === modal.campaignId)
      : selectedCampaign

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Radio size={18} />
          </div>
          <div>
            <strong>CreatorOps</strong>
            <span>Local CRM</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="주요 메뉴">
          <NavButton
            active={activeSection === 'dashboard'}
            icon={<LayoutDashboard size={18} />}
            label="대시보드"
            onClick={() => jumpTo('dashboard')}
          />
          <NavButton
            active={activeSection === 'discovery'}
            icon={<UsersRound size={18} />}
            label="발굴"
            onClick={() => jumpTo('discovery')}
          />
          <NavButton
            active={activeSection === 'campaigns'}
            icon={<Target size={18} />}
            label="캠페인"
            onClick={() => jumpTo('campaigns')}
          />
          <NavButton
            active={activeSection === 'report'}
            icon={<BarChart3 size={18} />}
            label="리포트"
            onClick={() => jumpTo('report')}
          />
          <NavButton
            active={activeSection === 'messages'}
            icon={<MessageSquare size={18} />}
            label="메시지"
            onClick={() => jumpTo('messages')}
          />
        </nav>

        <div className="team-block">
          <span className="mini-label">로컬 저장소</span>
          <strong>{campaigns.length}개 캠페인</strong>
          <div className="team-meter">
            <span style={{ width: `${Math.min(60 + outreach.length * 6, 94)}%` }} />
          </div>
          <p>자동 {autoOutreachCount}건 · 수동 {manualOutreachCount}건</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar" id="dashboard">
          <div>
            <span className="eyebrow">Persistent creator workspace</span>
            <h1>인플루언서 마케팅 운영 콘솔</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button" title="검색 초기화" onClick={resetSearch}>
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" type="button" title="CSV 리포트 다운로드" onClick={exportCsvReport}>
              <Download size={18} />
            </button>
            <button className="icon-button" type="button" title="데이터 관리" onClick={() => setModal({ type: 'data' })}>
              <Database size={18} />
            </button>
            <button className="primary-button" type="button" onClick={() => setModal({ type: 'create' })}>
              <Plus size={17} />
              캠페인 생성
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label="핵심 지표">
          <MetricCard
            icon={<UsersRound size={19} />}
            label="검색 도달"
            value={compactNumber(totals.reach)}
            delta={`${shortlist.length}명 저장`}
            detail={`${filteredCreators.length}명 후보`}
          />
          <MetricCard
            icon={<Eye size={19} />}
            label="예상 조회수"
            value={compactNumber(totals.views)}
            delta={`자동 ${autoOutreachCount} · 수동 ${manualOutreachCount}`}
            detail="필터 후보 합산"
          />
          <MetricCard
            icon={<TrendingUp size={19} />}
            label="평균 참여율"
            value={percent(totals.engagement)}
            delta={`${quotes.length}건 견적`}
            detail="현재 검색 결과"
          />
          <MetricCard
            icon={<WalletCards size={19} />}
            label="섭외 완료 풀"
            value={`${totals.roi.toFixed(2)}x`}
            delta={`${recruitedPool.length}명 저장`}
            detail={won(totals.revenue)}
          />
        </section>

        <section className="ai-grid">
          <section className="panel ai-brief-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">AI Discovery</span>
                <h2>브랜드 조건 설정</h2>
              </div>
              <button className="primary-button compact-button" type="button" onClick={runAiDiscovery}>
                <Target size={16} />
                AI 매칭 실행
              </button>
            </div>
            <div className="brief-form">
              <label>
                브랜드
                <input value={brandBrief.brandName} onChange={(event) => updateBrandBrief('brandName', event.target.value)} />
              </label>
              <label>
                제품/서비스
                <input value={brandBrief.product} onChange={(event) => updateBrandBrief('product', event.target.value)} />
              </label>
              <label className="wide-field">
                타깃 페르소나
                <input value={brandBrief.persona} onChange={(event) => updateBrandBrief('persona', event.target.value)} />
              </label>
              <label>
                최소 팔로워
                <input
                  inputMode="numeric"
                  value={brandBrief.minFollowers}
                  onChange={(event) => updateBrandBrief('minFollowers', event.target.value)}
                />
              </label>
              <label>
                최대 단가
                <input
                  inputMode="numeric"
                  value={brandBrief.maxPrice}
                  onChange={(event) => updateBrandBrief('maxPrice', event.target.value)}
                />
              </label>
              <label className="wide-field">
                포함 키워드
                <input value={brandBrief.keywords} onChange={(event) => updateBrandBrief('keywords', event.target.value)} />
              </label>
              <label className="wide-field">
                제외 키워드
                <input value={brandBrief.exclusions} onChange={(event) => updateBrandBrief('exclusions', event.target.value)} />
              </label>
            </div>
            <div className="brief-toggles">
              <div>
                <span className="mini-label">플랫폼</span>
                {platformOptions
                  .filter((option) => option !== '전체')
                  .map((option) => (
                    <button
                      className={`toggle-chip ${brandBrief.platforms.includes(option) ? 'selected' : ''}`}
                      type="button"
                      key={option}
                      onClick={() => toggleBriefList('platforms', option)}
                    >
                      {option}
                    </button>
                  ))}
              </div>
              <div>
                <span className="mini-label">카테고리</span>
                {categoryOptions
                  .filter((option) => option !== '전체')
                  .map((option) => (
                    <button
                      className={`toggle-chip ${brandBrief.categories.includes(option) ? 'selected' : ''}`}
                      type="button"
                      key={option}
                      onClick={() => toggleBriefList('categories', option)}
                    >
                      {option}
                    </button>
                  ))}
              </div>
            </div>
          </section>

          <section className="panel ai-result-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Recommended Personas</span>
                <h2>AI 추천 후보와 근거</h2>
              </div>
              <span className="result-count">{recommendations.length}명</span>
            </div>
            <div className="recommendation-list">
              {recommendations.length === 0 ? (
                <div className="empty-state compact-empty">
                  <Target size={22} />
                  <strong>아직 AI 추천 결과가 없습니다.</strong>
                  <p>브랜드 조건을 설정하고 AI 매칭을 실행하세요.</p>
                </div>
              ) : (
                recommendations.slice(0, 4).map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    creator={creators.find((creator) => creator.id === recommendation.creatorId)}
                    onSelect={() => setSelectedCreatorId(recommendation.creatorId)}
                    onQueue={() => queueRecommendation(recommendation)}
                  />
                ))
              )}
            </div>
          </section>
        </section>

        <section className="work-grid">
          <section className="panel discovery-panel" id="discovery">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Discovery</span>
                <h2>크리에이터 발굴</h2>
              </div>
              <div className="panel-heading-actions">
                <button className="icon-button" type="button" title="필터 저장" onClick={saveFilter}>
                  <SlidersHorizontal size={18} />
                </button>
                <button className="secondary-button compact-button" type="button" onClick={() => setModal({ type: 'creator' })}>
                  <Plus size={16} />
                  후보 등록
                </button>
              </div>
            </div>

            <div className="filter-bar">
              <label className="search-box">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="크리에이터, 카테고리, 키워드"
                />
              </label>

              <SelectPill
                icon={<Filter size={16} />}
                value={platform}
                options={platformOptions}
                onChange={setPlatform}
                label="플랫폼"
              />
              <SelectPill
                icon={<ChevronDown size={16} />}
                value={category}
                options={categoryOptions}
                onChange={setCategory}
                label="카테고리"
              />
            </div>

            <div className="creator-list">
              {filteredCreators.length === 0 ? (
                <div className="empty-state">
                  <Search size={22} />
                  <strong>조건에 맞는 크리에이터가 없습니다.</strong>
                  <button type="button" onClick={resetSearch}>
                    전체 후보 보기
                  </button>
                </div>
              ) : (
                filteredCreators.map((creator) => (
                  <CreatorRow
                    key={creator.id}
                    creator={creator}
                    active={selectedCreator?.id === creator.id}
                    saved={shortlist.includes(creator.id)}
                    onSelect={() => {
                      setSelectedCreatorId(creator.id)
                      showToast(`${creator.name} 분석 패널을 열었어요.`)
                    }}
                    onSave={() => toggleShortlist(creator)}
                  />
                ))
              )}
            </div>
          </section>

          {selectedCreator && (
            <aside className="panel profile-panel">
              <div className="profile-header">
                <img src={selectedCreator.avatar} alt="" />
                <button
                  className="icon-button"
                  type="button"
                  title={shortlist.includes(selectedCreator.id) ? '저장 해제' : '저장'}
                  onClick={() => toggleShortlist(selectedCreator)}
                >
                  {shortlist.includes(selectedCreator.id) ? (
                    <BookmarkCheck size={18} />
                  ) : (
                    <Bookmark size={18} />
                  )}
                </button>
              </div>

              <div className="profile-title">
                <span>{selectedCreator.platform}</span>
                <h2>{selectedCreator.name}</h2>
                <p>{selectedCreator.handle}</p>
              </div>

              <div className="fit-score">
                <div>
                  <span className="mini-label">Match score</span>
                  <strong>{selectedCreator.fit}</strong>
                </div>
                <div className="score-ring" style={{ '--score': `${selectedCreator.fit}%` }}>
                  <span>{selectedCreator.fit}</span>
                </div>
              </div>

              <div className="profile-stats">
                <Stat label="팔로워" value={compactNumber(selectedCreator.followers)} />
                <Stat label="평균 조회" value={compactNumber(selectedCreator.averageViews)} />
                <Stat label="참여율" value={percent(selectedCreator.engagement)} />
                <Stat label="예상 단가" value={won(selectedCreator.price)} />
              </div>

              <div className="audience-panel">
                <div className="safety-row">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>브랜드 안정성 {selectedCreator.brandSafety}</strong>
                    <span>가짜 팔로워 위험 {selectedCreator.fakeRisk}%</span>
                  </div>
                </div>
                <p>{selectedCreator.audience}</p>
                <div className="topic-row">
                  {selectedCreator.topics.map((topic) => (
                    <span key={topic}>{topic}</span>
                  ))}
                </div>
              </div>

              <div className="history-strip">
                <Stat label="제안 기록" value={`${selectedCreatorOutreach.length}건`} />
                <Stat label="견적 기록" value={`${selectedCreatorQuotes.length}건`} />
              </div>

              <div className="profile-actions">
                <button className="primary-button" type="button" onClick={() => setModal({ type: 'proposal' })}>
                  <Send size={17} />
                  제안 보내기
                </button>
                <button className="secondary-button" type="button" onClick={() => setModal({ type: 'quote' })}>
                  <ClipboardList size={17} />
                  견적 요청
                </button>
              </div>
            </aside>
          )}
        </section>

        <section className="bottom-grid">
          <section className="panel campaign-panel" id="campaigns">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Campaigns</span>
                <h2>캠페인 파이프라인</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                title="캠페인 요약"
                onClick={() => setModal({ type: 'campaignSummary' })}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="campaign-list">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  creators={getCreatorsByIds(creators, campaign.creatorIds)}
                  onOpen={() => openCampaign(campaign)}
                />
              ))}
            </div>
          </section>

          <section className="panel report-panel" id="report">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Report</span>
                <h2>성과 모니터링</h2>
              </div>
              <div className="panel-heading-actions">
                <button className="icon-button" type="button" title="콘텐츠 추적 등록" onClick={() => setModal({ type: 'tracking' })}>
                  <Plus size={18} />
                </button>
                <button className="icon-button" type="button" title="추적 데이터 갱신" onClick={refreshTracking}>
                  <RefreshCw size={18} />
                </button>
                <button className="icon-button" type="button" title="성과 보고서 다운로드" onClick={exportPerformanceReport}>
                  <Download size={18} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="리포트 검토"
                  onClick={() => {
                    updateWorkspace((current) => appendActivity(current, 'report', '리포트 검토 완료'))
                    showToast('리포트 검토 완료 상태로 저장했어요.')
                  }}
                >
                  <CheckCircle2 size={18} />
                </button>
              </div>
            </div>

            <div className="report-summary">
              <div>
                <span className="mini-label">예상 전환 매출</span>
                <strong>{won(totals.revenue)}</strong>
              </div>
              <BarChart3 size={24} />
            </div>

            <div className="score-list">
              {scoreBands.map((item) => (
                <div className="score-row" key={item.label}>
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <div className={`score-bar ${item.tone}`}>
                    <span style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="tracking-metrics">
              <Stat label="추적 콘텐츠" value={`${trackedPosts.length}건`} />
              <Stat label="조회수" value={compactNumber(trackedTotals.views)} />
              <Stat label="댓글" value={compactNumber(trackedTotals.comments)} />
              <Stat label="공유" value={compactNumber(trackedTotals.shares)} />
            </div>

            <div className="tracked-content-list">
              {selectedCampaignPosts.slice(0, 3).map((post) => {
                const creator = creators.find((item) => item.id === post.creatorId)
                return (
                  <article className="tracked-post" key={post.id}>
                    <div>
                      <span className="status-chip success-chip">{post.status}</span>
                      <strong>{post.title}</strong>
                      <p>{creator?.name ?? '알 수 없음'} · {post.platform} · {post.lastChecked}</p>
                    </div>
                    <div className="post-metrics">
                      <span>{compactNumber(post.views)} 조회</span>
                      <span>{compactNumber(post.comments)} 댓글</span>
                      <span>{compactNumber(post.shares)} 공유</span>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="insight-strip">
              <Target size={18} />
              <p>현재 쇼트리스트 예상 총 단가 {won(getCreatorsByIds(creators, shortlist).reduce((sum, creator) => sum + creator.price, 0))} · 추적 전환 {compactNumber(trackedTotals.conversions)}</p>
            </div>
          </section>
        </section>

        <section className="ops-grid">
          <section className="panel" id="messages">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Outreach</span>
                <h2>제안/응답 큐</h2>
              </div>
              <button className="icon-button" type="button" title="메시지 센터" onClick={() => setModal({ type: 'messages' })}>
                <MessageSquare size={18} />
              </button>
            </div>
            <div className="record-list">
              {outreach.slice(0, 5).map((item) => (
                <OutreachItem
                  key={item.id}
                  item={item}
                  creator={creators.find((creator) => creator.id === item.creatorId)}
                  campaign={campaigns.find((campaign) => campaign.id === item.campaignId)}
                  onMarkSent={() => markOutreachSent(item.id)}
                  onMarkResponse={() => markOutreachResponse(item.id)}
                  onComplete={() => completeRecruitment(item.id)}
                />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Recruited Pool</span>
                <h2>섭외 완료 풀</h2>
              </div>
              <UsersRound size={19} />
            </div>
            <div className="pool-list">
              {recruitedPool.length === 0 ? (
                <div className="empty-state compact-empty">
                  <UsersRound size={22} />
                  <strong>아직 섭외 완료된 인플루언서가 없습니다.</strong>
                  <p>제안/응답 큐에서 섭외 완료 저장을 누르면 이곳에 쌓입니다.</p>
                </div>
              ) : (
                recruitedPool.slice(0, 6).map((item) => (
                  <PoolItem
                    key={item.id}
                    item={item}
                    creator={creators.find((creator) => creator.id === item.creatorId)}
                    campaign={campaigns.find((campaign) => campaign.id === item.campaignId)}
                  />
                ))
              )}
            </div>
          </section>

          <section className="panel wide-log-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Activity</span>
                <h2>작업 로그</h2>
              </div>
              <History size={19} />
            </div>
            <div className="activity-list">
              {activities.slice(0, 8).map((activity) => (
                <article className="activity-item" key={activity.id}>
                  <span>{activity.type}</span>
                  <strong>{activity.text}</strong>
                  <small>{activity.createdAt}</small>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}

      {modal && (
        <Modal title={modalTitle(modal.type)} onClose={() => setModal(null)}>
          {modal.type === 'create' && (
            <form className="modal-form" onSubmit={createCampaign}>
              <label>
                캠페인명
                <input
                  value={campaignDraft.name}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, name: event.target.value })}
                  placeholder="예: 여름 신제품 런칭"
                />
              </label>
              <label>
                브랜드
                <input
                  value={campaignDraft.owner}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, owner: event.target.value })}
                  placeholder="예: Brand D"
                />
              </label>
              <label>
                예산
                <input
                  inputMode="numeric"
                  value={campaignDraft.budget}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, budget: event.target.value })}
                  placeholder="30000000"
                />
              </label>
              <label>
                목표
                <select
                  value={campaignDraft.objective}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, objective: event.target.value })}
                >
                  <option>브랜드 인지도</option>
                  <option>구매 전환</option>
                  <option>예약 판매</option>
                  <option>앱 설치</option>
                </select>
              </label>
              <label>
                마감일
                <input
                  value={campaignDraft.deadline}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, deadline: event.target.value })}
                  placeholder="6월 30일"
                />
              </label>
              <div className="assignment-list">
                <span className="mini-label">배정 후보</span>
                {getCreatorsByIds(creators, shortlist).length === 0 ? (
                  <p>쇼트리스트에 저장된 후보가 없습니다.</p>
                ) : (
                  getCreatorsByIds(creators, shortlist).map((creator) => (
                    <span key={creator.id}>{creator.name}</span>
                  ))
                )}
              </div>
              <button className="primary-button" type="submit">
                <Plus size={17} />
                생성하고 저장
              </button>
            </form>
          )}

          {modal.type === 'creator' && (
            <form className="modal-form" onSubmit={createCreator}>
              <label>
                이름
                <input
                  value={creatorDraft.name}
                  onChange={(event) => setCreatorDraft({ ...creatorDraft, name: event.target.value })}
                  placeholder="예: 리뷰하는 지우"
                />
              </label>
              <label>
                핸들
                <input
                  value={creatorDraft.handle}
                  onChange={(event) => setCreatorDraft({ ...creatorDraft, handle: event.target.value })}
                  placeholder="@creator.handle"
                />
              </label>
              <div className="modal-two-col">
                <label>
                  플랫폼
                  <select
                    value={creatorDraft.platform}
                    onChange={(event) => setCreatorDraft({ ...creatorDraft, platform: event.target.value })}
                  >
                    <option>Instagram</option>
                    <option>YouTube</option>
                    <option>TikTok</option>
                  </select>
                </label>
                <label>
                  카테고리
                  <select
                    value={creatorDraft.category}
                    onChange={(event) => setCreatorDraft({ ...creatorDraft, category: event.target.value })}
                  >
                    {categoryOptions
                      .filter((option) => option !== '전체')
                      .map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  팔로워
                  <input
                    inputMode="numeric"
                    value={creatorDraft.followers}
                    onChange={(event) => setCreatorDraft({ ...creatorDraft, followers: event.target.value })}
                    placeholder="250000"
                  />
                </label>
                <label>
                  평균 조회
                  <input
                    inputMode="numeric"
                    value={creatorDraft.averageViews}
                    onChange={(event) => setCreatorDraft({ ...creatorDraft, averageViews: event.target.value })}
                    placeholder="48000"
                  />
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  참여율
                  <input
                    inputMode="decimal"
                    value={creatorDraft.engagement}
                    onChange={(event) => setCreatorDraft({ ...creatorDraft, engagement: event.target.value })}
                    placeholder="5.4"
                  />
                </label>
                <label>
                  예상 단가
                  <input
                    inputMode="numeric"
                    value={creatorDraft.price}
                    onChange={(event) => setCreatorDraft({ ...creatorDraft, price: event.target.value })}
                    placeholder="1800000"
                  />
                </label>
              </div>
              <label>
                지역
                <input
                  value={creatorDraft.city}
                  onChange={(event) => setCreatorDraft({ ...creatorDraft, city: event.target.value })}
                  placeholder="서울"
                />
              </label>
              <label>
                키워드
                <input
                  value={creatorDraft.topics}
                  onChange={(event) => setCreatorDraft({ ...creatorDraft, topics: event.target.value })}
                  placeholder="리뷰, 생활용품, 가성비"
                />
              </label>
              <button className="primary-button" type="submit">
                <Plus size={17} />
                후보 등록하고 저장
              </button>
            </form>
          )}

          {modal.type === 'proposal' && selectedCreator && selectedCampaign && (
            <form className="modal-form" onSubmit={sendProposal}>
              <div className="modal-person">
                <img src={selectedCreator.avatar} alt="" />
                <div>
                  <strong>{selectedCreator.name}</strong>
                  <span>{selectedCampaign.name} · {selectedCreator.handle}</span>
                </div>
              </div>
              <label>
                제안 메시지
                <textarea value={proposalText} onChange={(event) => setProposalText(event.target.value)} />
              </label>
              <button className="primary-button" type="submit">
                <Send size={17} />
                메시지 승인 큐 저장
              </button>
            </form>
          )}

          {modal.type === 'tracking' && (
            <form className="modal-form" onSubmit={createTrackedPost}>
              <label>
                캠페인
                <select
                  value={trackingDraft.campaignId || selectedCampaign?.id || ''}
                  onChange={(event) => setTrackingDraft({ ...trackingDraft, campaignId: event.target.value })}
                >
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </label>
              <label>
                크리에이터
                <select
                  value={trackingDraft.creatorId || selectedCreator?.id || ''}
                  onChange={(event) => setTrackingDraft({ ...trackingDraft, creatorId: event.target.value })}
                >
                  {creators.map((creator) => (
                    <option key={creator.id} value={creator.id}>{creator.name}</option>
                  ))}
                </select>
              </label>
              <label>
                콘텐츠 제목
                <input
                  value={trackingDraft.title}
                  onChange={(event) => setTrackingDraft({ ...trackingDraft, title: event.target.value })}
                  placeholder="예: 세럼 7일 사용 리뷰"
                />
              </label>
              <label>
                콘텐츠 URL
                <input
                  value={trackingDraft.url}
                  onChange={(event) => setTrackingDraft({ ...trackingDraft, url: event.target.value })}
                  placeholder="https://..."
                />
              </label>
              <div className="modal-two-col">
                <label>
                  플랫폼
                  <select
                    value={trackingDraft.platform}
                    onChange={(event) => setTrackingDraft({ ...trackingDraft, platform: event.target.value })}
                  >
                    <option>Instagram</option>
                    <option>YouTube</option>
                    <option>TikTok</option>
                  </select>
                </label>
                <label>
                  조회수
                  <input inputMode="numeric" value={trackingDraft.views} onChange={(event) => setTrackingDraft({ ...trackingDraft, views: event.target.value })} placeholder="120000" />
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  좋아요
                  <input inputMode="numeric" value={trackingDraft.likes} onChange={(event) => setTrackingDraft({ ...trackingDraft, likes: event.target.value })} placeholder="5400" />
                </label>
                <label>
                  댓글
                  <input inputMode="numeric" value={trackingDraft.comments} onChange={(event) => setTrackingDraft({ ...trackingDraft, comments: event.target.value })} placeholder="320" />
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  공유
                  <input inputMode="numeric" value={trackingDraft.shares} onChange={(event) => setTrackingDraft({ ...trackingDraft, shares: event.target.value })} placeholder="180" />
                </label>
                <label>
                  저장
                  <input inputMode="numeric" value={trackingDraft.saves} onChange={(event) => setTrackingDraft({ ...trackingDraft, saves: event.target.value })} placeholder="900" />
                </label>
              </div>
              <button className="primary-button" type="submit">
                <Plus size={17} />
                추적 항목 저장
              </button>
            </form>
          )}

          {modal.type === 'quote' && selectedCreator && selectedCampaign && (
            <div className="modal-stack">
              <div className="quote-box">
                <FileText size={22} />
                <div>
                  <strong>{selectedCreator.name} 예상 견적</strong>
                  <span>{selectedCampaign.name} · 콘텐츠 1건 기준 {won(selectedCreator.price)}</span>
                </div>
              </div>
              <div className="modal-grid">
                <Stat label="예상 CPV" value={won(Math.round(selectedCreator.cpm / 100))} />
                <Stat label="브랜드 안정성" value={`${selectedCreator.brandSafety}`} />
                <Stat label="응답 가능 상태" value={selectedCreator.status} />
                <Stat label="중복 위험" value={`${selectedCreator.fakeRisk}%`} />
              </div>
              <button className="primary-button" type="button" onClick={requestQuote}>
                <ClipboardList size={17} />
                견적 요청 저장
              </button>
            </div>
          )}

          {modal.type === 'campaign' && activeCampaignForModal && (
            <div className="modal-stack">
              <div className="campaign-detail">
                <span className="status-chip">{activeCampaignForModal.status}</span>
                <h3>{activeCampaignForModal.name}</h3>
                <p>{activeCampaignForModal.objective}</p>
              </div>
              <div className="modal-grid">
                <Stat label="예산" value={won(activeCampaignForModal.budget)} />
                <Stat label="집행" value={won(activeCampaignForModal.spend)} />
                <Stat label="예상 매출" value={won(activeCampaignForModal.revenue)} />
                <Stat label="진행률" value={`${activeCampaignForModal.progress}%`} />
              </div>
              <div className="assignment-list">
                <span className="mini-label">배정 크리에이터</span>
                {getCreatorsByIds(creators, activeCampaignForModal.creatorIds).map((creator) => (
                  <span key={creator.id}>{creator.name}</span>
                ))}
              </div>
              <button className="primary-button" type="button" onClick={() => advanceCampaign(activeCampaignForModal.id)}>
                <TrendingUp size={17} />
                다음 단계로 이동하고 저장
              </button>
            </div>
          )}

          {modal.type === 'campaignSummary' && (
            <div className="modal-stack">
              {campaigns.map((campaign) => (
                <button className="summary-row" type="button" key={campaign.id} onClick={() => openCampaign(campaign)}>
                  <span className="status-chip">{campaign.status}</span>
                  <strong>{campaign.name}</strong>
                  <small>{campaign.progress}%</small>
                </button>
              ))}
            </div>
          )}

          {modal.type === 'messages' && (
            <div className="modal-stack">
              {outreach.length === 0 ? (
                <div className="message-item">
                  <strong>아직 발송 기록이 없습니다.</strong>
                  <p>크리에이터 상세 패널에서 제안 보내기를 실행하면 여기에 기록됩니다.</p>
                </div>
              ) : (
                outreach.map((item) => (
                  <OutreachItem
                    key={item.id}
                    item={item}
                    creator={creators.find((creator) => creator.id === item.creatorId)}
                    campaign={campaigns.find((campaign) => campaign.id === item.campaignId)}
                    onMarkSent={() => markOutreachSent(item.id)}
                    onMarkResponse={() => markOutreachResponse(item.id)}
                    onComplete={() => completeRecruitment(item.id)}
                  />
                ))
              )}
              <button className="primary-button" type="button" onClick={() => setModal({ type: 'proposal' })}>
                <Send size={17} />
                현재 후보에게 메시지 작성
              </button>
            </div>
          )}

          {modal.type === 'data' && (
            <div className="modal-stack">
              <div className="quote-box">
                <Database size={22} />
                <div>
                  <strong>브라우저 로컬 DB 사용 중</strong>
                  <span>캠페인, 후보, 제안, 견적, 로그가 localStorage에 저장됩니다.</span>
                </div>
              </div>
              <div className="modal-grid">
                <Stat label="크리에이터" value={`${creators.length}명`} />
                <Stat label="캠페인" value={`${campaigns.length}개`} />
                <Stat label="제안" value={`${outreach.length}건`} />
                <Stat label="섭외 완료" value={`${recruitedPool.length}명`} />
              </div>
              <button className="primary-button" type="button" onClick={exportWorkspace}>
                <Download size={17} />
                워크스페이스 백업
              </button>
              <button className="secondary-button" type="button" onClick={resetWorkspace}>
                <RotateCcw size={17} />
                데모 데이터로 초기화
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function modalTitle(type) {
  return {
    create: '캠페인 생성',
    creator: '크리에이터 등록',
    proposal: '제안 보내기',
    tracking: '콘텐츠 추적 등록',
    quote: '견적 요청',
    campaign: '캠페인 상세',
    campaignSummary: '캠페인 요약',
    messages: '메시지 센터',
    data: '데이터 관리',
  }[type]
}

function NavButton({ active, icon, label, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} type="button" title={label} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function MetricCard({ icon, label, value, delta, detail }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <div>
        <em>{delta}</em>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function SelectPill({ icon, value, options, onChange, label }) {
  return (
    <label className="select-pill">
      {icon}
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function CreatorRow({ creator, active, saved, onSelect, onSave }) {
  return (
    <article className={`creator-row ${active ? 'active' : ''}`}>
      <button className="creator-button" type="button" onClick={onSelect}>
        <img src={creator.avatar} alt="" />
        <div className="creator-copy">
          <div>
            <strong>{creator.name}</strong>
            <span>{creator.handle}</span>
          </div>
          <p>
            {creator.category} · {creator.city} · {creator.lastPost}
          </p>
        </div>
      </button>

      <div className="creator-numbers">
        <span>{creator.platform}</span>
        <strong>{compactNumber(creator.followers)}</strong>
        <small>{percent(creator.engagement)}</small>
      </div>

      <div className="match-cell">
        <span style={{ width: `${creator.fit}%` }} />
        <strong>{creator.fit}</strong>
      </div>

      <button
        className="icon-button save-button"
        type="button"
        title={saved ? '저장됨' : '저장'}
        onClick={onSave}
      >
        {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </button>
    </article>
  )
}

function RecommendationCard({ recommendation, creator, onSelect, onQueue }) {
  if (!creator) return null

  return (
    <article className="recommendation-card">
      <div className="recommendation-top">
        <button type="button" onClick={onSelect}>
          <img src={creator.avatar} alt="" />
          <div>
            <strong>{creator.name}</strong>
            <span>{recommendation.persona}</span>
          </div>
        </button>
        <div className="ai-score">{recommendation.score}</div>
      </div>
      <ul>
        {recommendation.reasons.slice(0, 3).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="recommendation-footer">
        <span>{recommendation.risk}</span>
        <button className="secondary-button compact-button" type="button" onClick={onQueue}>
          메시지 큐
        </button>
      </div>
    </article>
  )
}

function CampaignCard({ campaign, creators, onOpen }) {
  return (
    <article className="campaign-row">
      <div className="campaign-main">
        <div>
          <span className="status-chip">{campaign.status}</span>
          <h3>{campaign.name}</h3>
          <p>
            {campaign.owner} · {creators.length}명 배정
          </p>
        </div>
        <button className="icon-button" type="button" title="열기" onClick={onOpen}>
          <ArrowUpRight size={18} />
        </button>
      </div>
      <button
        className="stage-bars stage-button"
        type="button"
        aria-label={`${campaign.name} 상세 열기`}
        onClick={onOpen}
      >
        {campaign.stages.map((stage, index) => (
          <span key={`${campaign.id}-${stage}-${index}`} style={{ height: `${stage + 18}px` }} />
        ))}
      </button>
      <div className="campaign-meta">
        <span>
          <CalendarDays size={15} />
          {campaign.deadline}
        </span>
        <span>{won(campaign.spend)} 집행</span>
      </div>
      <div className="assigned-creators">
        {creators.slice(0, 3).map((creator) => (
          <span key={creator.id}>{creator.name}</span>
        ))}
      </div>
      <div className="progress-line">
        <span style={{ width: `${campaign.progress}%` }} />
      </div>
    </article>
  )
}

function OutreachItem({ item, creator, campaign, onMarkSent, onMarkResponse, onComplete }) {
  const awaitingApproval = item.status === '승인 대기'
  const canComplete = item.status === '응답' || item.status === '발송 완료'

  return (
    <article className="record-item">
      <div>
        <span className={`status-chip ${item.status === '응답' || item.status === '발송 완료' ? 'success-chip' : ''}`}>{item.status}</span>
        <span className={`source-chip ${item.source === '자동' ? 'auto-source' : 'manual-source'}`}>{item.source ?? '수동'}</span>
        <strong>{creator?.name ?? '알 수 없는 후보'}</strong>
        <p>{campaign?.name ?? '캠페인 없음'} · {item.createdAt}</p>
        {item.reason && <p>{item.reason}</p>}
      </div>
      <div className="record-actions">
        {awaitingApproval && (
          <button className="secondary-button compact-button" type="button" onClick={onMarkSent}>
            발송 완료
          </button>
        )}
        {item.status !== '응답' && (
          <button className="secondary-button compact-button" type="button" onClick={onMarkResponse}>
            응답 처리
          </button>
        )}
        {canComplete && (
          <button className="primary-button compact-button" type="button" onClick={onComplete}>
            섭외 완료 저장
          </button>
        )}
      </div>
    </article>
  )
}

function PoolItem({ item, creator, campaign }) {
  if (!creator) return null

  return (
    <article className="pool-item">
      <img src={creator.avatar} alt="" />
      <div>
        <span className={`source-chip ${item.source === '자동' ? 'auto-source' : 'manual-source'}`}>{item.source}</span>
        <strong>{creator.name}</strong>
        <p>{campaign?.name ?? '캠페인 없음'} · {item.createdAt}</p>
        <small>{item.note}</small>
      </div>
    </article>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" title="닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export default App
