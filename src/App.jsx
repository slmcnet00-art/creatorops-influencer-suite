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
  Globe2,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TrendingUp,
  UsersRound,
  Video,
  WalletCards,
  X,
} from 'lucide-react'
import { readSheet } from 'read-excel-file/browser'
import './App.css'
import AdminDataRoom from './AdminDataRoom'
import {
  getBackendConfig,
  getAuthSession,
  loadCloudWorkspace,
  onAuthStateChange,
  saveCloudWorkspace,
  signInWithEmail,
  signOut,
} from './backendSync'
import {
  buildCreatorSourceEvidence,
  calculateDataCoverage,
  dataConnectorBlueprints,
  fetchYouTubeChannelSnapshot,
  fetchPublicProfileSnapshot,
  refreshContentMetrics,
  searchContentReferences,
  searchGoogleProfileDiscovery,
  searchYouTubeCreatorDiscovery,
} from './dataConnectors'

const STORE_KEY = 'creatorops.workspace.v2'
const TRACKING_DAILY_REFRESH_KEY = 'creatorops.tracking.lastDailyRefresh'
const GMAIL_AUTH_STORE_KEY = 'creatorops.gmailAuth.v1'
const GMAIL_MIN_SEND_DELAY_MS = 20000
const GMAIL_MAX_SEND_DELAY_MS = 60000

const influencerBrandGuideTemplate = `# 인플루언서 브랜드 가이드

## 업체/브랜드 기본 정보
- 상호명:
- 브랜드명:
- 담당자:
- 이메일:
- 홈페이지:
- 브랜드 채널: Instagram / YouTube / TikTok

## 캠페인 목적
- 목적:
- 활용처: 브랜딩 / SNS 업로드 / 광고 소재 / 상세페이지 / 구매 전환 / 공동구매
- KPI:

## 기존 진행 사례
- 만족했던 사례:
- 불만족했던 사례:
- 참고 링크:

## 원메시지
- 영상에서 반드시 전달해야 할 한 문장:

## 타깃 페르소나
- 연령/성별/라이프스타일:
- 주요 고민:
- 구매를 망설이는 이유:
- 구매를 결심하는 조건:

## USP / 셀링 포인트
1.
2.
3.
4.
5.

## 영상 제작 방향
- 영상 유형: 상세 리뷰 / 감성 브랜딩 / 인터뷰 / 룩북 / 언박싱 / 사용법 시연 / 비교 리뷰 / 공동구매
- 벤치마킹 링크:
- 따라야 할 점:
- 피해야 할 점:

## 영상 내러티브
1. 첫 3초 후킹:
2. 문제/공감 상황:
3. 제품 사용 장면:
4. 구매 전 망설임 해소:
5. CTA:

## 자막 / 나레이션 / 배경음악
- 자막:
- 나레이션:
- 배경음악:
- 폰트/이미지 저작권:

## 크리에이터 전달 사항
- 세로형 9:16 비율
- 첫 3초 후킹 필수
- 가능하면 30초 이내
- 페르소나에 맞는 공감 스크립트
- 상업적 이용 가능한 폰트/음원/이미지만 사용

## 금지/주의 표현
-

## 검수 체크리스트
- [ ] 원메시지가 첫 3초 안에 드러나는가?
- [ ] 타깃 페르소나가 공감할 상황이 있는가?
- [ ] USP가 장면으로 보여지는가?
- [ ] 과장 표현, 의학적 효능 단정, 경쟁사 실명 비교가 없는가?
- [ ] 상업적 이용 가능한 폰트/음원/이미지를 사용했는가?
- [ ] CTA가 자연스럽게 연결되는가?
`

const minimumVisibleFollowers = 1000

const defaultDiscoveryFilters = {
  country: 'KR',
  minFollowers: String(minimumVisibleFollowers),
  maxFollowers: '',
  minAverageViews: '',
  minEngagement: '',
  maxPrice: '',
  minFit: '',
}

const discoveryFilterLabels = {
  country: '국가',
  minFollowers: '팔로워 최소',
  maxFollowers: '팔로워 최대',
  minAverageViews: '평균 조회 최소',
  minEngagement: '참여율 최소',
  maxPrice: '예상 단가 최대',
  minFit: '매칭 점수 최소',
}

const contactChannelCatalog = {
  email: {
    id: 'email',
    label: '이메일 자동 발송',
    shortLabel: '이메일',
    deliveryMode: '자동 발송 가능',
    tone: 'email-channel',
    description: '공개 협업 이메일이나 미디어킷 주소가 확인된 후보에게 Gmail/Outlook API로 발송',
    notice: '대량 발송은 수신 거부, 발송량 제한, 중복 발송 방지 로그를 함께 관리해야 합니다.',
  },
  instagram_dm: {
    id: 'instagram_dm',
    label: 'Instagram DM',
    shortLabel: 'IG DM',
    deliveryMode: '승인형/수동',
    tone: 'instagram-channel',
    description: 'Instagram Professional 계정과 Meta 앱 승인 전에는 프로필 링크를 열어 수동 발송',
    notice: 'API 발송은 계정/권한/앱 리뷰가 필요하므로 운영 초기에는 DM 자동 발송 대상에서 제외합니다.',
  },
  tiktok_dm: {
    id: 'tiktok_dm',
    label: 'TikTok DM',
    shortLabel: 'TikTok DM',
    deliveryMode: '수동 링크',
    tone: 'tiktok-channel',
    description: '공개 이메일과 링크인바이오를 우선 확인하고 TikTok 앱 DM은 수동 보조로 처리',
    notice: 'TikTok은 대량 DM 자동 발송을 핵심 연동으로 두지 않고 메시지 복사와 프로필 이동만 제공합니다.',
  },
  manual_other: {
    id: 'manual_other',
    label: '기타 수동 채널',
    shortLabel: '수동',
    deliveryMode: '수동 기록',
    tone: 'manual-channel',
    description: '카카오 채널, 문자, WhatsApp, 에이전시 연락 등 별도 채널로 발송 후 상태만 기록',
    notice: '외부 채널 발송 내역은 발송 완료, 응답, 섭외 완료 상태로 남겨 추적합니다.',
  },
}

const contactChannelOptions = Object.values(contactChannelCatalog)

const defaultCreators = [
  {
    id: 1,
    isDemo: true,
    name: '민서로그',
    handle: '@minseo.log',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
    platform: 'YouTube',
    profileUrl: 'https://www.youtube.com/@minseo.log',
    contactEmail: 'partnership@minseolog.example',
    preferredContactChannel: 'email',
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
    isDemo: true,
    name: '테크노트 준',
    handle: '@technote_jun',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
    platform: 'YouTube',
    profileUrl: 'https://www.youtube.com/@technote_jun',
    contactEmail: 'biz@technotejun.example',
    preferredContactChannel: 'email',
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
    isDemo: true,
    name: '하루식탁',
    handle: '@haru.table',
    avatar:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
    platform: 'Instagram',
    profileUrl: 'https://www.instagram.com/haru.table',
    contactEmail: 'hello@harutable.example',
    preferredContactChannel: 'email',
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
    isDemo: true,
    name: '핏모먼트',
    handle: '@fitmoment.kr',
    avatar:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
    platform: 'TikTok',
    profileUrl: 'https://www.tiktok.com/@fitmoment.kr',
    contactEmail: '',
    preferredContactChannel: 'tiktok_dm',
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
    isDemo: true,
    name: '캠핑해나',
    handle: '@camp.haena',
    avatar:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80',
    platform: 'Instagram',
    profileUrl: 'https://www.instagram.com/camp.haena',
    contactEmail: '',
    preferredContactChannel: 'instagram_dm',
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
    isDemo: true,
    name: '소비왕 랩',
    handle: '@sobiking_lab',
    avatar:
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80',
    platform: 'TikTok',
    profileUrl: 'https://www.tiktok.com/@sobiking_lab',
    contactEmail: 'collab@sobiking.example',
    preferredContactChannel: 'email',
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
    brandId: 201,
    name: '스프링 세럼 런칭',
    owner: 'Brand A',
    status: '라이브',
    budget: 42000000,
    spend: 28700000,
    revenue: 94200000,
    deadline: '5월 28일',
    objective: '구매 전환',
    campaignType: '제안형',
    mission: '세럼 7일 사용 후 루틴형 리뷰 1건 + 스토리 리마인드 2회',
    reward: '제품 제공 + 콘텐츠 1건 250만원 기준',
    approvalFlow: '가이드 전달 → 원고/컷 검수 → 게시 확인 → 성과 리포트',
    commerceMetric: 'UTM 링크와 쿠폰 코드 전환',
    kpiGoal: '조회수 50만 이상 · 구매 전환 800건',
    targetViews: 500000,
    targetConversions: 800,
    targetOrders: 0,
    targetRevenue: 90000000,
    recommendationTargetCount: 8,
    sellerRecruitTarget: 0,
    progress: 68,
    creatorIds: [1, 3, 6],
    stages: [34, 21, 18, 12],
    createdAt: '데모 데이터',
  },
  {
    id: 102,
    brandId: 202,
    name: 'AI 노트북 프리오더',
    owner: 'Brand B',
    status: '섭외',
    budget: 62000000,
    spend: 11400000,
    revenue: 28100000,
    deadline: '6월 4일',
    objective: '예약 판매',
    campaignType: '커머스/제휴',
    mission: 'AI 기능 데모 영상 1건 + 예약판매 링크 고정댓글',
    reward: '고정비 + 예약 전환 커미션',
    approvalFlow: '제품 데모 가이드 → 기술 검수 → 링크/코드 확인 → 라이브 추적',
    commerceMetric: '예약 판매 코드와 랜딩 전환',
    kpiGoal: '예약 판매 300건 · 전환 링크 클릭 3,000건',
    targetViews: 350000,
    targetConversions: 3000,
    targetOrders: 300,
    targetRevenue: 80000000,
    recommendationTargetCount: 12,
    sellerRecruitTarget: 12,
    progress: 36,
    creatorIds: [2, 6],
    stages: [52, 19, 9, 3],
    createdAt: '데모 데이터',
  },
  {
    id: 103,
    brandId: 203,
    name: '헬시 스낵 챌린지',
    owner: 'Brand C',
    status: '리포트',
    budget: 28000000,
    spend: 24600000,
    revenue: 61100000,
    deadline: '오늘',
    objective: '공동구매 전환',
    campaignType: '틱톡 공동구매 셀러',
    mission: '틱톡 셀러 공동구매 숏폼 1건 + 라이브/댓글 구매 유도 + 고정 링크 운영',
    reward: '제품 패키지 + 판매 커미션 + 우수 셀러 보너스',
    approvalFlow: '셀러 대량 섭외 → 샘플 발송 → 판매 스크립트 검수 → 콘텐츠/라이브 추적',
    commerceMetric: '공동구매 코드, 판매 건수, 전환 링크, 조회수',
    kpiGoal: '틱톡 조회수 120만 · 공동구매 주문 600건',
    targetViews: 1200000,
    targetConversions: 0,
    targetOrders: 600,
    targetRevenue: 70000000,
    recommendationTargetCount: 50,
    sellerRecruitTarget: 50,
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
  learningMaterials: [
    {
      id: 9101,
      title: '제품 핵심 브리프',
      sourceType: '데모 학습자료',
      sourceName: '내부 브리프',
      summary: '저자극 장벽 세럼은 민감 피부도 매일 사용할 수 있는 장벽 케어 제품이다.',
      keywords: '저자극, 장벽 케어, 민감 피부, 데일리 루틴',
      doSay: '피부 장벽, 매일 쓰기 편한 사용감, 성분 중심 리뷰',
      dontSay: '즉시 치료, 의학적 효능, 과장 전후 비교',
      createdAt: '데모 데이터',
    },
  ],
}

const defaultBrands = [
  {
    id: 201,
    name: '스킨케어 D2C 브랜드',
    owner: 'Brand A',
    color: '#0071e3',
    brief: defaultBrandBrief,
  },
  {
    id: 202,
    name: 'AI 노트북 브랜드',
    owner: 'Brand B',
    color: '#7d4cf0',
    brief: {
      ...defaultBrandBrief,
      brandName: 'AI 노트북 브랜드',
      product: 'AI 노트북 프리오더',
      persona: '생산성과 성능을 꼼꼼히 비교하는 24-44세 직장인/크리에이터',
      goal: '예약 판매',
      platforms: ['YouTube', 'TikTok'],
      categories: ['테크', '리뷰'],
      keywords: '노트북, AI툴, 생산성, 언박싱, 가성비',
      exclusions: '논란, 과장 광고',
      minFollowers: 200000,
      maxPrice: 6500000,
    },
  },
  {
    id: 203,
    name: '헬시 스낵 브랜드',
    owner: 'Brand C',
    color: '#2fbf71',
    brief: {
      ...defaultBrandBrief,
      brandName: '헬시 스낵 브랜드',
      product: '헬시 스낵 챌린지',
      persona: '건강한 간식과 루틴을 찾는 20-30대 활동형 소비자',
      goal: '브랜드 검색량',
      platforms: ['Instagram', 'TikTok'],
      categories: ['푸드', '피트니스', '리뷰'],
      keywords: '집밥, 밀키트, 홈트, 다이어트, 생활용품',
      exclusions: '도박, 과장 광고',
      minFollowers: 100000,
      maxPrice: 4500000,
    },
  },
]

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

const defaultContentReferences = [
]

const defaultRecommendations = [
  {
    id: 4101,
    creatorId: 1,
    campaignId: 101,
    brandId: 201,
    score: 96,
    persona: '성분 중심 스킨케어 탐색층 · 여성 73% · YouTube 중심',
    reasons: [
      '스킨케어, 데일리룩, 올리브영 키워드가 제품 페르소나와 직접 연결됨',
      '124만 팔로워와 평균 조회 28.4만으로 런칭 초반 도달 확보 가능',
      '브랜드 안정성 98, 가짜 팔로워 위험 3%로 리스크가 낮음',
    ],
    risk: '즉시 제안 가능',
    message: buildFriendlyProposalMessage(defaultCreators[0], defaultBrandBrief, defaultCampaigns[0]),
    createdAt: '데모 데이터',
  },
  {
    id: 4102,
    creatorId: 3,
    campaignId: 101,
    brandId: 201,
    score: 91,
    persona: '생활 루틴형 구매층 · 여성 81% · Instagram 중심',
    reasons: [
      '집밥, 밀키트, 키친웨어 콘텐츠 안에 자연스러운 루틴형 제품 노출 가능',
      '참여율 7.2%로 댓글/저장 반응이 강한 편',
      '브랜드 안정성 99, 가짜 팔로워 위험 2%로 신뢰도가 높음',
    ],
    risk: '콘텐츠 콘셉트 조율 필요',
    message: buildFriendlyProposalMessage(defaultCreators[2], defaultBrandBrief, defaultCampaigns[0]),
    createdAt: '데모 데이터',
  },
]

const deliveryStatusOptions = ['배송 준비', '발송 대기', '발송 완료', '정산 완료']

const createEmptyFulfillmentDraft = () => ({
  campaignId: '',
  creatorId: '',
  paymentDate: '',
  recipient: '',
  handle: '',
  phone: '',
  address: '',
  bank: '',
  accountNumber: '',
  accountHolder: '',
  paymentAmount: '',
  courier: '',
  trackingNumber: '',
  deliveryStatus: '배송 준비',
  memo: '',
})

const defaultFulfillmentRecords = [
  {
    id: 601,
    creatorId: 3,
    campaignId: 103,
    paymentDate: '5월 20일',
    recipient: '샘플 수취인',
    handle: '@sample.creator',
    phone: '010-0000-0000',
    address: '서울시 샘플 주소',
    bank: '카카오뱅크',
    accountNumber: '3333-00-0000000',
    accountHolder: '샘플 예금주',
    paymentAmount: 31500,
    courier: '택배사 미정',
    trackingNumber: '',
    deliveryStatus: '배송 준비',
    memo: '데모용 샘플입니다. 실제 개인정보는 운영자가 직접 입력하세요.',
    createdAt: '데모 데이터',
  },
]

const defaultWorkspace = {
  team: {
    id: 'team-miping',
    name: '미핑기획 CreatorOps 팀',
    sharedPoolScope: 'team',
  },
  accounts: [
    {
      id: 'acct-owner',
      name: '운영 총괄',
      email: 'owner@miping.co.kr',
      role: 'Owner',
      status: '활성',
      brandIds: [201, 202, 203],
      lastActive: '오늘',
    },
    {
      id: 'acct-manager',
      name: '브랜드 매니저',
      email: 'manager@miping.co.kr',
      role: 'Manager',
      status: '활성',
      brandIds: [201],
      lastActive: '오늘',
    },
    {
      id: 'acct-client',
      name: '클라이언트 뷰어',
      email: 'client@brand.co.kr',
      role: 'Client',
      status: '초대됨',
      brandIds: [201],
      lastActive: '초대 대기',
    },
  ],
  activeAccountId: 'acct-owner',
  brands: defaultBrands,
  activeBrandId: defaultBrands[0].id,
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
  fulfillmentRecords: defaultFulfillmentRecords,
  trackedPosts: defaultTrackedPosts,
  contentReferences: defaultContentReferences,
  savedProductionReferenceIds: [],
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
const briefPlatformOptions = ['YouTube', 'Instagram', 'TikTok', 'TikTok 셀러']
const categoryOptions = ['전체', '뷰티', '테크', '푸드', '피트니스', '아웃도어', '펫', '리뷰', '공동구매']
const discoveryCategoryIntentTerms = {
  '\uBDF0\uD2F0': ['\uBDF0\uD2F0', '\uD654\uC7A5\uD488', '\uBA54\uC774\uD06C\uC5C5', '\uC2A4\uD0A8\uCF00\uC5B4', 'beauty', 'makeup', 'skincare', 'cosmetic'],
  '\uD14C\uD06C': ['\uD14C\uD06C', '\uAC00\uC804', '\uB514\uBC14\uC774\uC2A4', 'it', 'tech', 'gadget', 'device'],
  '\uD478\uB4DC': ['\uD478\uB4DC', '\uC694\uB9AC', '\uC74C\uC2DD', '\uBA39\uBC29', '\uB9DB\uC9D1', '\uB808\uC2DC\uD53C', '\uC2DD\uD488', '\uAC04\uC2DD', 'food', 'cook', 'cooking', 'recipe', 'mukbang', 'snack'],
  '\uD53C\uD2B8\uB2C8\uC2A4': ['\uD53C\uD2B8\uB2C8\uC2A4', '\uC6B4\uB3D9', '\uD5EC\uC2A4', '\uB2E4\uC774\uC5B4\uD2B8', 'fitness', 'workout', 'gym', 'diet'],
  '\uC544\uC6C3\uB3C4\uC5B4': ['\uC544\uC6C3\uB3C4\uC5B4', '\uCEA0\uD551', '\uB4F1\uC0B0', '\uC5EC\uD589', 'outdoor', 'camping', 'hiking', 'travel'],
  '\uD3AB': ['\uD3AB', '\uBC18\uB824', '\uAC15\uC544\uC9C0', '\uACE0\uC591\uC774', '\uB315\uB315', 'pet', 'dog', 'cat'],
  '\uB9AC\uBDF0': ['\uB9AC\uBDF0', '\uD6C4\uAE30', '\uC5B8\uBC15\uC2F1', 'review', 'unboxing'],
  '\uACF5\uB3D9\uAD6C\uB9E4': ['\uACF5\uB3D9\uAD6C\uB9E4', '\uACF5\uAD6C', '\uC140\uB7EC', '\uCEE4\uBA38\uC2A4', 'commerce', 'seller'],
}
const referenceCountryPresets = ['전체', 'KR', 'US', 'JP', 'CN', 'SEA', 'EU']
const discoveryCountryOptions = ['전체', 'KR', 'US', 'JP', 'CN', 'GB', 'VN', 'TH', 'ID', 'PH', 'SG', 'MY', 'TW']
const campaignStatuses = ['섭외', '콘텐츠 제작', '라이브', '리포트', '완료']
const campaignTypeOptions = ['제안형', '공개모집', '앰배서더', '커머스/제휴', 'UGC/숏폼', '틱톡 공동구매 셀러']

const teamRoleCatalog = {
  Owner: {
    label: 'Owner',
    description: '팀/계정/권한/전체 브랜드를 관리합니다.',
    permissions: ['전체 데이터', '권한 부여', '삭제/초기화', '다운로드'],
  },
  Admin: {
    label: 'Admin',
    description: '브랜드와 캠페인 운영을 관리합니다.',
    permissions: ['브랜드 관리', '캠페인 관리', '데이터 다운로드'],
  },
  Manager: {
    label: 'Manager',
    description: '배정된 브랜드의 발굴, 메시지, 리포트를 운영합니다.',
    permissions: ['발굴', '메시지', '리포트'],
  },
  Client: {
    label: 'Client',
    description: '배정된 브랜드의 승인용 풀과 리포트를 봅니다.',
    permissions: ['컨펌 보기', '리포트 보기'],
  },
  Analyst: {
    label: 'Analyst',
    description: '데이터 품질과 성과 리포트만 확인합니다.',
    permissions: ['데이터 검토', '리포트 보기'],
  },
}

const competitorBenchmarks = [
  {
    name: 'NoxInfluencer',
    strength: '대규모 크리에이터 데이터, 랭킹, 브랜드 인텔리전스, API Data Service',
    gapToClose: '검색 후보마다 출처/갱신일/검증상태를 남기고 브랜드 협업 흔적을 추적해야 함',
  },
  {
    name: 'Modash',
    strength: '발굴-관리-트래킹-정산이 연결된 워크플로우, 공개 프로필 기반 검색, Shopify/Gmail 연동',
    gapToClose: '팀 인박스, 자동 콘텐츠 수집, 커머스 전환 추적 연결이 필요함',
  },
  {
    name: 'HypeAuditor',
    strength: '오디언스 품질, 진성 팔로워, fraud detection, 캠페인 리포팅',
    gapToClose: '팔로워 증가 이상치, 참여율 품질, 오디언스 지역/연령 신뢰도 점수를 분리해야 함',
  },
  {
    name: 'Upfluence/GRIN',
    strength: '커머스/제휴/기프팅/크리에이터 관계관리와 운영 자동화',
    gapToClose: '배송/샘플/계약/사용권/성과 리포트를 캠페인 단위로 연결해야 함',
  },
]

const dataAccuracyRoadmap = [
  {
    title: 'Source Ledger',
    detail: '팔로워, 평균조회수, 참여율마다 수집 URL, 수집일, 수집방식, 신뢰도를 별도 기록',
  },
  {
    title: 'Cross Check',
    detail: 'YouTube Data API, 공개 프로필 입력, Google Search/CX 결과를 같은 후보에 병합해 차이를 표시',
  },
  {
    title: 'Fraud Signals',
    detail: '비정상 팔로워 증가, 낮은 댓글 품질, 조회수 대비 참여율 편차를 리스크 점수로 분리',
  },
  {
    title: 'Freshness SLA',
    detail: '핵심 후보는 24~72시간 내 갱신, 예시/미검증 후보는 검증 대기 배지로 차단',
  },
]

function normalizeBrand(brand, index = 0) {
  const fallback = defaultBrands[index] ?? defaultBrands[0]
  const brief = {
    ...defaultBrandBrief,
    ...(fallback?.brief ?? {}),
    ...(brand?.brief ?? {}),
    brandName: brand?.brief?.brandName ?? brand?.name ?? fallback.name,
  }
  brief.learningMaterials = brand?.brief?.learningMaterials ?? fallback?.brief?.learningMaterials ?? defaultBrandBrief.learningMaterials ?? []

  return {
    id: Number(brand?.id) || fallback.id || createId(),
    name: brand?.name || brief.brandName,
    owner: brand?.owner || fallback.owner || brand?.name || brief.brandName,
    color: brand?.color || fallback.color || '#0071e3',
    brief,
  }
}

function inferBrandIdForCampaign(campaign, brands) {
  if (campaign.brandId && brands.some((brand) => brand.id === campaign.brandId)) {
    return campaign.brandId
  }

  const matchedBrand = brands.find(
    (brand) =>
      brand.owner === campaign.owner ||
      brand.name === campaign.owner ||
      campaign.name?.includes(brand.brief.product) ||
      campaign.name?.includes(brand.name),
  )

  if (matchedBrand) return matchedBrand.id
  if (campaign.name?.includes('노트북')) return 202
  if (campaign.name?.includes('스낵')) return 203
  return brands[0]?.id ?? defaultBrands[0].id
}

function getCampaignRecommendationTarget(campaign = {}, fallback = {}) {
  const explicitTarget = Number(campaign.recommendationTargetCount ?? fallback.recommendationTargetCount ?? 0)
  const sellerTarget = Number(campaign.sellerRecruitTarget ?? fallback.sellerRecruitTarget ?? 0)
  const target = explicitTarget || sellerTarget || 8
  return clampNumber(Math.round(target), 1, 1000)
}

function normalizeCampaign(campaign, brands) {
  const fallback =
    defaultCampaigns.find((item) => item.id === campaign.id) ??
    defaultCampaigns.find((item) => item.name === campaign.name)
  const targets = inferCampaignTargets(campaign, fallback)
  const schedule = {
    recruitStart: campaign.schedule?.recruitStart ?? campaign.recruitStartDate ?? fallback?.schedule?.recruitStart ?? '',
    recruitEnd: campaign.schedule?.recruitEnd ?? campaign.recruitEndDate ?? campaign.deadline ?? fallback?.schedule?.recruitEnd ?? fallback?.deadline ?? '',
    uploadDue: campaign.schedule?.uploadDue ?? campaign.uploadDueDate ?? fallback?.schedule?.uploadDue ?? '',
    reportDue: campaign.schedule?.reportDue ?? campaign.reportDueDate ?? fallback?.schedule?.reportDue ?? '',
  }

  return {
    ...campaign,
    brandId: inferBrandIdForCampaign(campaign, brands),
    campaignType: campaign.campaignType ?? fallback?.campaignType ?? '제안형',
    mission: campaign.mission ?? fallback?.mission ?? '브랜드 브리프에 맞춘 콘텐츠 미션',
    reward: campaign.reward ?? fallback?.reward ?? '제품 제공 + 협의 리워드',
    approvalFlow: campaign.approvalFlow ?? fallback?.approvalFlow ?? '브리프 전달 → 콘텐츠 검수 → 게시 확인 → 성과 리포트',
    commerceMetric: campaign.commerceMetric ?? fallback?.commerceMetric ?? '조회/댓글/공유와 전환 링크',
    kpiGoal: campaign.kpiGoal ?? fallback?.kpiGoal ?? '조회수/전환 KPI 미정',
    targetViews: targets.targetViews,
    targetConversions: targets.targetConversions,
    targetOrders: targets.targetOrders,
    targetRevenue: targets.targetRevenue,
    sellerRecruitTarget: Number(campaign.sellerRecruitTarget ?? fallback?.sellerRecruitTarget ?? 0),
    recommendationTargetCount: getCampaignRecommendationTarget(campaign, fallback),
    schedule,
  }
}

function getCampaignSchedule(campaign) {
  return [
    {
      key: 'recruitStart',
      label: '모집 시작',
      date: campaign?.schedule?.recruitStart || campaign?.recruitStartDate || '',
      helper: '후보 발굴/제안 발송 시작',
    },
    {
      key: 'recruitEnd',
      label: '모집 마감',
      date: campaign?.schedule?.recruitEnd || campaign?.recruitEndDate || campaign?.deadline || '',
      helper: '섭외 완료 풀 확정',
    },
    {
      key: 'uploadDue',
      label: '업로드 완료',
      date: campaign?.schedule?.uploadDue || campaign?.uploadDueDate || '',
      helper: '콘텐츠 링크 수집 마감',
    },
    {
      key: 'reportDue',
      label: '보고 완료',
      date: campaign?.schedule?.reportDue || campaign?.reportDueDate || '',
      helper: '성과 리포트 전달',
    },
  ]
}

function getContactChannel(channelId) {
  return contactChannelCatalog[channelId] ?? contactChannelCatalog.manual_other
}

function normalizeHandleSegment(handle) {
  return String(handle || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^\/+|\/+$/g, '')
}

function getRecommendedContactChannelId(creator) {
  if (creator?.preferredContactChannel && contactChannelCatalog[creator.preferredContactChannel]) {
    return creator.preferredContactChannel
  }
  if (creator?.contactEmail) return 'email'
  if (creator?.platform === 'Instagram') return 'instagram_dm'
  if (creator?.platform === 'TikTok') return 'tiktok_dm'
  if (creator?.platform === 'YouTube') return 'email'
  return 'manual_other'
}

function getCreatorProfileUrl(creator, channelId) {
  if (!creator) return ''
  if (creator.profileUrl) return creator.profileUrl

  const handle = normalizeHandleSegment(creator.handle)
  if (!handle) return ''
  if (channelId === 'instagram_dm') return `https://www.instagram.com/${handle}`
  if (channelId === 'tiktok_dm') return `https://www.tiktok.com/@${handle}`
  if (creator.platform === 'YouTube') return `https://www.youtube.com/${handle.startsWith('@') ? handle : `@${handle}`}`
  return ''
}

function getContactUrl(creator, channelId, message = '', campaignName = '') {
  if (!creator) return ''
  if (channelId === 'email') {
    if (!creator.contactEmail) return ''
    const subject = encodeURIComponent(`${campaignName || '브랜드 캠페인'} 협업 제안`)
    const body = encodeURIComponent(message)
    return `mailto:${creator.contactEmail}?subject=${subject}&body=${body}`
  }
  return getCreatorProfileUrl(creator, channelId)
}

function buildContactPlan(creator, channelId, message = '', campaignName = '') {
  const id = channelId && contactChannelCatalog[channelId] ? channelId : getRecommendedContactChannelId(creator)
  const channel = getContactChannel(id)
  return {
    ...channel,
    url: getContactUrl(creator, id, message, campaignName),
  }
}

function hasDuplicateSentOutreach(item, outreach = []) {
  if (!item?.creatorId || !item?.campaignId) return false
  return outreach.some((candidate) =>
    candidate.id !== item.id &&
    candidate.creatorId === item.creatorId &&
    candidate.campaignId === item.campaignId &&
    (candidate.sentAt || candidate.status === '발송 완료'),
  )
}

function randomSendDelayMs() {
  return Math.round(GMAIL_MIN_SEND_DELAY_MS + Math.random() * (GMAIL_MAX_SEND_DELAY_MS - GMAIL_MIN_SEND_DELAY_MS))
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function buildOutreachTimeline(item = {}) {
  const events = [
    {
      label: '메시지 생성',
      detail: item.reason || item.source || '후보에게 보낼 제안 메시지를 만들었습니다.',
      createdAt: item.createdAt || '-',
    },
  ]

  if (item.sentAt) {
    events.push({
      label: '발송 완료',
      detail: item.deliveryMode || '발송 완료로 기록했습니다.',
      createdAt: item.sentAt,
    })
  }

  if (item.responseAt || item.responseNote || item.status === '?묐떟') {
    events.push({
      label: '응답 확인',
      detail: item.responseNote || '응답 상태로 기록했습니다.',
      createdAt: item.responseAt || item.updatedAt || '-',
    })
  }

  if (item.recruitedAt || item.status === '??쇅 ?꾨즺') {
    events.push({
      label: '섭외 완료',
      detail: item.recruitmentNote || '섭외 완료 풀에 저장했습니다.',
      createdAt: item.recruitedAt || item.updatedAt || '-',
    })
  }

  return [...events, ...(item.outreachEvents ?? [])]
}

function normalizeCreator(creator) {
  const fallback =
    defaultCreators.find((item) => item.id === creator.id) ??
    defaultCreators.find((item) => item.handle === creator.handle)
  const nextCreator = {
    ...creator,
    avatar: normalizeCreatorAvatar(creator, fallback),
    contactEmail: creator.contactEmail ?? fallback?.contactEmail ?? '',
    profileUrl: creator.profileUrl ?? fallback?.profileUrl ?? '',
    preferredContactChannel: creator.preferredContactChannel ?? fallback?.preferredContactChannel,
    isDemo: creator.isDemo ?? fallback?.isDemo ?? false,
  }

  return {
    ...nextCreator,
    preferredContactChannel: getRecommendedContactChannelId(nextCreator),
  }
}

function normalizeCreatorAvatar(creator = {}, fallback = {}) {
  const avatar = creator.avatar ?? fallback?.avatar ?? ''
  const platform = creator.platform || fallback?.platform || ''

  if (platform === 'TikTok' && (isSearchEngineThumbnailAsset(avatar) || isPlatformLogoAsset(avatar))) {
    return getDefaultCreatorAvatar(platform)
  }

  if (!avatar) return getDefaultCreatorAvatar(platform)
  return avatar
}

function isLowQualitySavedCreator(creator = {}) {
  if (creator.platform !== 'TikTok') return false
  const isSearchCandidate =
    creator.status === '실제 검색 후보' ||
    creator.needsVerification ||
    String(creator.sourceNote || '').includes('실제 공개 검색') ||
    String(creator.sourceUrl || creator.profileUrl || '').includes('tiktok.com')
  const hasMetrics = Number(creator.followers || 0) > 0 || Number(creator.averageViews || 0) > 0
  const name = String(creator.name || '')
  const looksLikeCaption =
    name.length >= 48 ||
    (name.match(/#/g) || []).length >= 2 ||
    (/추천|입양|ㅋㅋ|ㅎㅎ|릴스|챌린지|viral|fyp/i.test(name) && name.length >= 24)
  const looksOffTopicForCreatorDiscovery = /낚시|붕어|차박|카니발|캠핑|입양|게임|roblox|adopt me/i.test(name)

  return isSearchCandidate && ((!hasMetrics && looksLikeCaption) || looksOffTopicForCreatorDiscovery)
}

function getDefaultCreatorAvatar(platform = '') {
  if (platform === 'TikTok') {
    return 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80'
  }
  if (platform === 'Instagram') {
    return 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80'
  }
  return 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80'
}

function normalizeOutreachItem(item, creators = [], campaigns = []) {
  const creator = creators.find((creatorItem) => creatorItem.id === item.creatorId)
  const campaign = campaigns.find((campaignItem) => campaignItem.id === item.campaignId)
  const channelId = item.channel ?? item.contactChannel ?? getRecommendedContactChannelId(creator)
  const contactPlan = buildContactPlan(creator, channelId, item.message, campaign?.name)

  return {
    ...item,
    channel: contactPlan.id,
    deliveryMode: item.deliveryMode ?? contactPlan.deliveryMode,
    complianceNote: item.complianceNote ?? contactPlan.notice,
  }
}

function normalizeWorkspace(saved) {
  const isVerificationCreator = (creator) =>
    creator?.handle === '@open.metric.test' || creator?.name === '오픈메트릭 테스트'
  const verificationCreatorIds = (saved?.creators ?? []).filter(isVerificationCreator).map((creator) => creator.id)
  const normalizedActivities = (saved?.activities ?? defaultWorkspace.activities)
    .filter(
      (activity) =>
        !String(activity.text || '').includes('오픈메트릭 테스트') &&
        !String(activity.text || '').includes('open.metric.test'),
    )
    .map((activity) => ({
      ...activity,
      text: normalizeUiCopy(activity.text),
    }))
  const normalizedBrands = saved?.brands?.length
    ? saved.brands.map((brand, index) => normalizeBrand(brand, index))
    : defaultBrands.map((brand, index) =>
        index === 0 && saved?.brandBrief
          ? normalizeBrand({ ...brand, brief: { ...brand.brief, ...saved.brandBrief } }, index)
          : normalizeBrand(brand, index),
      )
  const normalizedCampaigns = (saved?.campaigns?.length ? saved.campaigns : defaultWorkspace.campaigns).map((campaign) =>
    normalizeCampaign(campaign, normalizedBrands),
  )
  const normalizedCreators = (saved?.creators?.length
    ? saved.creators.filter((creator) => !isVerificationCreator(creator) && !isLowQualitySavedCreator(creator))
    : defaultWorkspace.creators
  ).map((creator) => normalizeCreator(creator))
  const normalizedOutreach = (saved?.outreach ?? defaultWorkspace.outreach).map((item) =>
    normalizeOutreachItem(item, normalizedCreators, normalizedCampaigns),
  )
  const activeBrandId = normalizedBrands.some((brand) => brand.id === saved?.activeBrandId)
    ? saved.activeBrandId
    : normalizedBrands[0]?.id

  return {
    ...defaultWorkspace,
    ...saved,
    team: {
      ...defaultWorkspace.team,
      ...(saved?.team ?? {}),
    },
    accounts: saved?.accounts?.length ? saved.accounts : defaultWorkspace.accounts,
    activeAccountId:
      saved?.accounts?.some((account) => account.id === saved?.activeAccountId)
        ? saved.activeAccountId
        : defaultWorkspace.activeAccountId,
    brands: normalizedBrands,
    activeBrandId,
    creators: normalizedCreators,
    campaigns: normalizedCampaigns,
    brandBrief: {
      ...normalizedBrands[0].brief,
    },
    shortlist: saved?.shortlist?.filter((id) => !verificationCreatorIds.includes(id)) ?? defaultWorkspace.shortlist,
    recommendations: saved?.recommendations?.length ? saved.recommendations : defaultWorkspace.recommendations,
    outreach: normalizedOutreach,
    recruitedPool: saved?.recruitedPool ?? defaultWorkspace.recruitedPool,
    quotes: saved?.quotes ?? defaultWorkspace.quotes,
    fulfillmentRecords: saved?.fulfillmentRecords ?? defaultWorkspace.fulfillmentRecords,
    trackedPosts: saved?.trackedPosts ?? defaultWorkspace.trackedPosts,
    contentReferences: normalizeContentReferences(saved?.contentReferences ?? defaultWorkspace.contentReferences),
    savedProductionReferenceIds: saved?.savedProductionReferenceIds ?? defaultWorkspace.savedProductionReferenceIds,
    activities: normalizedActivities,
  }
}

function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key)
      return saved ? normalizeWorkspace(JSON.parse(saved)) : normalizeWorkspace(fallback)
    } catch {
      return normalizeWorkspace(fallback)
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

function compactOptionalNumber(value, fallback = '\uC218\uC9D1 \uD544\uC694') {
  const numeric = Number(value || 0)
  return numeric > 0 ? compactNumber(numeric) : fallback
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

function contentEngagementRate(post) {
  const views = Number(post?.views || 0)
  if (!views) return 0
  const interactions =
    Number(post.likes || 0) +
    Number(post.comments || 0) +
    Number(post.shares || 0) +
    Number(post.saves || 0)
  return (interactions / views) * 100
}

function normalizeNumericTarget(value) {
  if (value === null || value === undefined || value === '') return 0
  return Number(String(value).replace(/[^\d.-]/g, '')) || 0
}

function extractKpiNumber(text, patterns = []) {
  const source = String(text || '')
  const matchedPattern = patterns.find((pattern) => pattern.test(source))
  if (!matchedPattern) return 0

  const match = source.match(matchedPattern)
  const rawValue = match?.[1]
  const unit = match?.[2] || ''
  if (!rawValue) return 0

  const numericValue = Number(String(rawValue).replace(/,/g, ''))
  if (!Number.isFinite(numericValue)) return 0
  if (unit === '억') return numericValue * 100000000
  if (unit === '만') return numericValue * 10000
  if (unit === '천') return numericValue * 1000
  return numericValue
}

function inferCampaignTargets(campaign = {}, fallback = {}) {
  const kpiGoal = campaign.kpiGoal ?? fallback?.kpiGoal ?? ''
  const targetViews = normalizeNumericTarget(campaign.targetViews ?? fallback?.targetViews) ||
    extractKpiNumber(kpiGoal, [/조회수\s*([0-9.,]+)\s*(억|만|천)?/])
  const targetConversions = normalizeNumericTarget(campaign.targetConversions ?? fallback?.targetConversions) ||
    extractKpiNumber(kpiGoal, [/(?:전환|클릭)\s*([0-9.,]+)\s*(억|만|천)?/])
  const targetOrders = normalizeNumericTarget(campaign.targetOrders ?? fallback?.targetOrders) ||
    extractKpiNumber(kpiGoal, [/(?:주문|예약 판매|판매)\s*([0-9.,]+)\s*(억|만|천)?/])
  const targetRevenue = normalizeNumericTarget(campaign.targetRevenue ?? fallback?.targetRevenue)

  return {
    targetViews,
    targetConversions,
    targetOrders,
    targetRevenue,
  }
}

function getCampaignKpiSummary(campaign, posts = [], recruitedPool = []) {
  const campaignPosts = posts.filter((post) => post.campaignId === campaign.id)
  const campaignPool = recruitedPool.filter((item) => item.campaignId === campaign.id)
  const actualViews = campaignPosts.reduce((sum, post) => sum + Number(post.views || 0), 0)
  const actualConversions = campaignPosts.reduce((sum, post) => sum + Number(post.conversions || 0), 0)
  const actualOrders = Number(campaign.orders || campaign.actualOrders || 0)
  const actualRevenue = Number(campaign.revenue || 0)
  const actualRecruited = campaignPool.length
  const metrics = [
    {
      key: 'views',
      label: '조회수',
      actual: actualViews,
      target: Number(campaign.targetViews || 0),
      displayActual: compactNumber(actualViews),
      displayTarget: compactNumber(Number(campaign.targetViews || 0)),
    },
    {
      key: 'conversions',
      label: '전환',
      actual: actualConversions,
      target: Number(campaign.targetConversions || 0),
      displayActual: compactNumber(actualConversions),
      displayTarget: compactNumber(Number(campaign.targetConversions || 0)),
    },
    {
      key: 'orders',
      label: '주문',
      actual: actualOrders,
      target: Number(campaign.targetOrders || 0),
      displayActual: compactNumber(actualOrders),
      displayTarget: compactNumber(Number(campaign.targetOrders || 0)),
    },
    {
      key: 'recruited',
      label: '섭외',
      actual: actualRecruited,
      target: Number(campaign.sellerRecruitTarget || 0),
      displayActual: `${actualRecruited}명`,
      displayTarget: `${Number(campaign.sellerRecruitTarget || 0)}명`,
    },
    {
      key: 'revenue',
      label: '매출',
      actual: actualRevenue,
      target: Number(campaign.targetRevenue || 0),
      displayActual: won(actualRevenue),
      displayTarget: won(Number(campaign.targetRevenue || 0)),
    },
  ].filter((metric) => metric.target > 0)
  const progress =
    metrics.length === 0
      ? 0
      : Math.round(
          metrics.reduce((sum, metric) => sum + Math.min(100, Math.round((metric.actual / Math.max(metric.target, 1)) * 100)), 0) /
            metrics.length,
        )

  return {
    campaignId: campaign.id,
    metrics,
    progress,
    missingTargets: ['targetViews', 'targetConversions', 'targetOrders', 'targetRevenue'].filter(
      (field) => !Number(campaign[field] || 0),
    ),
  }
}

function maskPhone(value) {
  const text = String(value || '').trim()
  const digits = text.replace(/\D/g, '')
  if (!text) return '번호 미입력'
  if (digits.length >= 8) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
  }
  return text.replace(/\d(?=\d{2})/g, '*')
}

function maskAccount(value) {
  const text = String(value || '').trim()
  if (!text) return '계좌 미입력'
  if (text.length <= 8) return text.replace(/\d/g, '*')
  return `${text.slice(0, 4)}****${text.slice(-4)}`
}

function compactAddress(value) {
  const text = String(value || '').trim()
  if (!text) return '주소 미입력'
  return text.length > 18 ? `${text.slice(0, 18)}...` : text
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

function normalizeUiCopy(value) {
  return String(value ?? '')
    .replaceAll('메시지 큐', '메시지 검토함')
    .replaceAll('제안/응답 큐', '제안/응답 발송')
    .replaceAll('초대 큐', '메시지 검토함')
    .replaceAll('승인 큐', '검토함')
}

function getLearningMaterials(brief) {
  return Array.isArray(brief?.learningMaterials) ? brief.learningMaterials : []
}

function buildLearningContext(brief) {
  const materials = getLearningMaterials(brief).slice(0, 4)
  if (!materials.length) return ''

  return materials
    .map((item) =>
      [
        item.title,
        item.summary,
        item.keywords ? `키워드: ${item.keywords}` : '',
        item.doSay ? `강조: ${item.doSay}` : '',
        item.dontSay ? `주의: ${item.dontSay}` : '',
      ]
        .filter(Boolean)
        .join(' / '),
    )
    .join('\n')
}

function pickLearningCell(row, headers, names) {
  for (const name of names) {
    const index = headers.findIndex((header) => header.replace(/\s/g, '').toLowerCase() === name.replace(/\s/g, '').toLowerCase())
    if (index >= 0 && row[index]) return row[index]
  }
  return ''
}

function buildLearningMaterialsFromRows(rawRows, sourceType, sourceName = '') {
  const normalizedRows = rawRows
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some(Boolean))
  if (!normalizedRows.length) return []

  const firstRow = normalizedRows[0]
  const headerHints = ['제목', '항목', '내용', '요약', '키워드', '권장표현', '금지표현', 'title', 'summary', 'keywords']
  const hasHeader = firstRow.some((cell) => headerHints.some((hint) => cell.toLowerCase().includes(hint.toLowerCase())))
  const headers = hasHeader ? firstRow : []
  const rows = hasHeader ? normalizedRows.slice(1) : normalizedRows

  return rows.map((row, index) => {
    const title =
      pickLearningCell(row, headers, ['제목', '항목', '구분', 'title', 'name']) ||
      row[0] ||
      `학습자료 ${index + 1}`
    const summary =
      pickLearningCell(row, headers, ['내용', '요약', '핵심내용', '설명', 'content', 'summary']) ||
      (hasHeader ? row.filter(Boolean).slice(1, 4).join(' / ') : row.filter(Boolean).slice(1).join(' / '))
    const keywords = pickLearningCell(row, headers, ['키워드', 'keywords', 'keyword'])
    const doSay = pickLearningCell(row, headers, ['권장표현', '강조', 'dosay', 'do', 'message'])
    const dontSay = pickLearningCell(row, headers, ['금지표현', '주의', 'dontsay', 'avoid', 'risk'])

    return {
      id: createId() + index,
      title,
      sourceType,
      sourceName,
      summary,
      keywords,
      doSay,
      dontSay,
      createdAt: nowLabel(),
    }
  })
}

function buildGuideLearningMaterial(text, sourceName = '') {
  const clean = String(text || '').trim()
  if (!clean) return null
  const lines = clean.split(/\r?\n/).map((line) => line.replace(/^[-#*\d.\s]+/, '').trim()).filter(Boolean)
  const doSay = lines
    .filter((line) => /원메시지|USP|셀링|후킹|페르소나|CTA|전달/.test(line))
    .slice(0, 8)
    .join(' / ')
  const dontSay = lines
    .filter((line) => /금지|주의|피해야|과장|저작권|실명/.test(line))
    .slice(0, 8)
    .join(' / ')

  return {
    id: createId(),
    title: sourceName ? `캠페인 브랜드 가이드 · ${sourceName}` : '캠페인 브랜드 가이드',
    sourceType: '캠페인 생성 첨부',
    sourceName,
    summary: lines.slice(0, 16).join(' / ').slice(0, 900),
    keywords: lines
      .filter((line) => /캠페인|목적|원메시지|페르소나|USP|영상|후킹|CTA/.test(line))
      .slice(0, 10)
      .join(', '),
    doSay,
    dontSay,
    createdAt: nowLabel(),
  }
}

function buildFriendlyProposalMessage(creator, brief, campaign) {
  const topicText = creator.topics.slice(0, 3).join(', ')
  const campaignName = campaign?.name ?? `${brief.product} 캠페인`
  const deadlineText = campaign?.deadline ? `일정은 ${campaign.deadline} 전후로 보고 있습니다.` : '일정은 편하신 시점에 맞춰 조율하고 싶습니다.'
  const keywordText = keywordList(brief.keywords).slice(0, 3).join(', ') || topicText
  const matchContext = creator.needsVerification
    ? `현재 공개 프로필과 최근 콘텐츠 수치를 확인하는 단계지만, ${creator.audience} 조건과 ${creator.platform} 중심 콘텐츠 방향이 저희가 찾는 "${brief.persona}" 페르소나와 잘 맞는다고 판단했습니다.`
    : `특히 ${creator.audience} 오디언스와 ${creator.platform}에서의 평균 조회 ${compactNumber(creator.averageViews)}, 참여율 ${percent(creator.engagement)}이 저희가 찾는 "${brief.persona}" 페르소나와 잘 맞았습니다.`
  const learningContext = buildLearningContext(brief)
  const learningText = learningContext
    ? `\n\n브랜드 학습자료 기준으로는 아래 포인트를 특히 지키겠습니다.\n${learningContext}`
    : ''

  return `${creator.name}님 안녕하세요. ${brief.brandName}의 ${campaignName} 협업을 제안드리고 싶어 연락드립니다.

최근 ${topicText} 콘텐츠 흐름을 보면서, ${brief.product}를 억지스럽지 않고 신뢰감 있게 소개할 수 있는 분이라고 느꼈어요. ${matchContext}

이번 캠페인은 ${keywordText} 키워드를 중심으로, 팔로워분들이 실제로 궁금해할 만한 사용 맥락을 함께 만들어보고 싶습니다. ${deadlineText}${learningText}

가능하시다면 편하게 번호로만 답장 주셔도 괜찮습니다.
1. 관심 있어요
2. 일정/단가를 먼저 보고 싶어요
3. 이번에는 어렵지만 다음 제안은 받고 싶어요

가능한 콘텐츠 형식, 진행 가능 일정, 희망 단가를 알려주시면 그에 맞춰 제안서와 가이드를 바로 정리해드리겠습니다. 감사합니다.`
}

function buildInfluencerContentGuide({ brand, brief, campaign, creators = [] }) {
  const seedType = campaign.guideSeedType || '무가시딩'
  const channel = campaign.guideChannel || 'Instagram Reels'
  const campaignName = campaign.name || `${brief.product} 인플루언서 캠페인`
  const oneMessage =
    campaign.oneMessage ||
    `${brief.product}는 ${brief.persona || '타깃 고객'}에게 실제 사용 맥락에서 설득되는 선택지입니다.`
  const rawHooks =
    campaign.hookPoints ||
    [
      `${brief.product}를 처음 봤을 때 생기는 궁금증`,
      `가격, 성분, 사용성, 상황 중 하나를 첫 3초에 제시`,
      `직접 사용 장면과 결과 느낌을 과장 없이 연결`,
      `댓글로 질문이 나올 만한 비교 포인트`,
    ].join('\n')
  const hooks = rawHooks
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*•\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 12)
  const creatorSummary = creators.length
    ? creators
        .slice(0, 8)
        .map((creator) => `- ${creator.name} (${creator.platform}, ${creator.handle})`)
        .join('\n')
    : '- 섭외 확정 전이면 채널별 후보에게 공통 전달'
  const learningContext = buildLearningContext(brief)
  const seedingRule = {
    무가시딩:
      '제품 제공 중심. 금전 리워드가 없는 대신 크리에이터의 자연스러운 사용 경험과 자율 표현을 존중한다. 업로드 강제처럼 보이는 표현은 피하고, 필수 고지/금지 표현만 명확히 전달한다.',
    유가시딩:
      '유료 협업. 산출물, 일정, 검수, 수정 범위, 광고/협찬 표기를 명확히 합의한다. 원메시지는 지키되 크리에이터 말투를 살릴 수 있게 예시형으로 제공한다.',
    '공동구매 셀러':
      '조회수보다 전환과 구매 맥락이 중요하다. 가격/혜택/사용 시나리오/구매 링크 또는 코드 안내를 자연스럽게 연결하고, 판매 압박보다 문제 해결 흐름을 우선한다.',
    '모집형 체험단':
      '다수 크리에이터가 같은 기준으로 제작할 수 있게 공통 미션, 필수 컷, 제출 방식, 마감일을 선명하게 제시한다. 과장된 후기나 결과 보장 표현은 금지한다.',
  }[seedType]
  const channelRule = {
    'Instagram Reels':
      '첫 1-2초 썸네일/자막 후킹이 중요하다. 세로 9:16, 15-45초, 자막 중심으로 제품 사용 장면과 감정 반응을 빠르게 보여준다.',
    TikTok:
      '문제 제기-반전-사용 장면-댓글 유도 흐름이 적합하다. 말투는 짧고 직접적으로, 챌린지/비교/실험형 구성이 잘 맞는다.',
    'YouTube Shorts':
      '검색/추천 유입을 고려해 제목형 첫 문장과 명확한 결론이 필요하다. 30-60초 안에 문제, 사용, 판단, CTA를 닫는다.',
    'YouTube Longform':
      '상세 리뷰, 비교, 사용 전후 맥락을 충분히 설명한다. 챕터형 구성과 고정댓글 링크/쿠폰 안내를 포함한다.',
    'Multi Channel':
      '릴스/틱톡/쇼츠는 첫 3초 후킹과 사용 장면, YouTube 롱폼은 정보 구조와 비교 포인트를 강화한다.',
  }[channel]

  return `# ${brand.name} ${campaignName} 인플루언서 콘텐츠 가이드

## 1. 캠페인 개요
- 브랜드: ${brand.name}
- 제품/서비스: ${brief.product || '-'}
- 협업 유형: ${seedType}
- 권장 채널: ${channel}
- 캠페인 목표: ${campaign.objective || brief.goal || '-'}
- KPI: ${campaign.kpiGoal || '조회수, 댓글, 저장/공유, 전환 링크 클릭, 구매/문의'}
- 마감/업로드 일정: ${campaign.deadline || '협의'}
- 리워드/제공 조건: ${campaign.reward || '제품 제공 및 조건 협의'}

## 2. 콘텐츠 원메시지
${oneMessage}

## 3. 후킹포인트
${hooks.map((hook, index) => `${index + 1}. ${hook}`).join('\n')}

## 4. ${seedType} 운영 원칙
${seedingRule}

## 5. ${channel} 제작 방향
${channelRule}

## 6. 권장 구성
1. 첫 3초: 가격, 문제, 상황, 비교, 감정 중 하나로 시청 이유를 만든다.
2. 문제 공감: 타깃 고객이 겪는 불편을 실제 상황으로 보여준다.
3. 제품 사용: 손에 들고 쓰는 장면, 디테일 컷, 사용 전후 느낌을 담는다.
4. 판단 근거: 왜 이 제품을 선택할 만한지 한 문장으로 정리한다.
5. CTA: 댓글 질문, 링크 확인, 쿠폰/공동구매, 저장 유도 중 캠페인 목적에 맞게 마무리한다.

## 7. UGC 공통 가이드라인
- 영상 비율: 9:16 세로형, 최소 1080×1920 권장
- 자막: 나레이션 동시 자막 필수, 핵심 키워드는 색상 또는 굵기로 강조
- 컷 전환: 한 장면 1-3초 기준, "나레이션 한 문장 = 컷 하나" 원칙
- 제품 노출: 라벨/패키지 정면 노출, 최종 컷에 제품 풀샷 포함
- 톤: 과장 리액션보다 실험 리포터/뷰티 에디터처럼 담백하게, 감정보다 팩트와 사용 근거 중심

## 8. STEP별 자막/나레이션/연출 가이드
| STEP | 구간 | 자막/화면 문구 | 나레이션 방향 | 연출 |
| --- | --- | --- | --- | --- |
| 1. Hook | 0-3초 | ${hooks[0] || oneMessage} | 시청자가 바로 멈출 수 있게 문제/가격/상황을 단정적으로 제시 | 얼굴 클로즈업, 제품/상황 컷, 강한 자막 |
| 2. Problem | 3-10초 | 타깃이 겪는 불편 한 문장 | "저도 이럴 때 불편했어요"처럼 공감형으로 연결 | 실제 사용 전 상황, 비교 컷 |
| 3. Solution | 10-25초 | ${brief.product || '제품'} 핵심 포인트 | 제품이 문제를 어떻게 해결하는지 원메시지 중심으로 설명 | 제품 라벨, 손 사용, 디테일 컷 |
| 4. Proof | 25-40초 | 근거/성분/수치/사용감 | 과장 없이 사용감과 판단 근거 제시 | 텍스트 그래픽, 전후 느낌, 테스트 컷 |
| 5. CTA | 마지막 | 댓글/링크/저장/공동구매 안내 | 강요보다 자연스러운 다음 행동 안내 | 제품 풀샷, 고정댓글/링크 안내 |

## 9. 필수 포함 요소
- 제품명 또는 브랜드명이 자연스럽게 노출되는 장면
- 원메시지를 크리에이터 본인 말투로 풀어낸 문장
- 사용 장면 또는 제품 디테일 컷
- 협찬/광고 표기 등 채널 정책에 맞는 고지
- 금지 표현을 피한 캡션과 자막

## 10. 금지/주의 표현
- 의학적 효능, 치료, 즉각 개선, 과장 전후 비교
- 경쟁사 실명 비방
- 실제와 다른 가격/혜택/성분/성능 표현
- 크리에이터가 경험하지 않은 내용을 경험처럼 말하는 표현
${brief.exclusions ? `- 브랜드 추가 제외 표현: ${brief.exclusions}` : ''}

## 11. 캡션 예시
${brief.product || '제품'}를 직접 써보면서 가장 먼저 느낀 포인트는 "${oneMessage}"였어요.  
자세한 사용감과 구매/참여 정보는 본문 또는 고정댓글에서 확인해주세요.

## 12. 필수 키워드
${keywordList(`${brief.product}, ${brief.keywords}`).slice(0, 8).map((keyword) => `- ${keyword}`).join('\n') || '- 제품명 / 브랜드명 / 캠페인 핵심 키워드'}

## 13. 채널별 체크리스트
- Instagram Reels/TikTok/Shorts: 9:16, 첫 3초 자막, 제품 사용 장면, 짧은 CTA
- YouTube Longform: 챕터, 장단점, 링크/쿠폰 고정댓글, 상세 사용 조건
- Multi Channel: 숏폼은 후킹/사용 장면, 롱폼은 상세 비교/구매 정보, 전 채널 협찬 고지

## 14. 검수/제출
- 초안 제출: ${campaign.approvalFlow || '브리프 전달 → 초안 검수 → 수정 반영 → 게시 확인'}
- 제출물: 영상 원본 또는 게시 링크, 썸네일/캡션, 성과 확인용 링크
- 성과 기록: 조회수, 댓글, 저장/공유, 클릭, 구매/문의 전환

## 15. 배정 후보
${creatorSummary}
${learningContext ? `\n## 16. 브랜드 학습자료 반영 메모\n${learningContext}` : ''}
`
}

function buildRecommendation(creator, brief, campaign) {
  const learningMaterials = getLearningMaterials(brief)
  const learningKeywordText = learningMaterials.map((item) => `${item.keywords}, ${item.doSay}`).join(', ')
  const wantedKeywords = keywordList(`${brief.keywords}, ${learningKeywordText}`)
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
  const pendingMetrics = hasPendingMetrics(creator)
  const platformFit = matchesBriefPlatform(creator, brief.platforms) ? 18 : -8
  const categoryFit = brief.categories.includes(creator.category) ? 18 : -4
  const scaleFit = pendingMetrics ? 4 : creator.followers >= Number(brief.minFollowers) ? 12 : -10
  const budgetFit = pendingMetrics || creator.price <= Number(brief.maxPrice) ? 8 : -12
  const engagementFit = pendingMetrics ? 4 : Math.min(14, Math.round(creator.engagement * 1.6))
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
    pendingMetrics
      ? '실제 프로필 URL을 확보했으며 팔로워/평균 조회는 후속 수집 필요'
      : `${compactNumber(creator.followers)} 팔로워와 평균 조회 ${compactNumber(creator.averageViews)}로 캠페인 도달 예측 가능`,
    creator.sourceNote || '',
    pendingMetrics ? '데이터 출처 원장에 검색 출처와 검증 대기 상태 기록' : `브랜드 안정성 ${creator.brandSafety}, 가짜 팔로워 위험 ${creator.fakeRisk}%`,
    pendingMetrics ? '단가는 실제 지표 확인 후 산정 필요' : `${campaign?.name ?? brief.goal} 목표에 맞춘 예상 단가 ${won(creator.price)}`,
  ].filter(Boolean)
  const risk = exclusionHits.length
    ? `제외 키워드 감지: ${exclusionHits.join(', ')}`
    : creator.fakeRisk > 9
      ? '팔로워 품질 검토 필요'
      : creator.needsVerification
        ? '공개 수치 검증 후 제안'
        : '즉시 제안 가능'

  return {
    id: createId(),
    creatorId: creator.id,
    campaignId: campaign?.id,
    score,
    persona,
    reasons,
    risk,
    message: buildFriendlyProposalMessage(creator, brief, campaign),
    createdAt: nowLabel(),
  }
}

function getCreatorDataQuality(creator) {
  if (!creator) {
    return {
      score: 0,
      level: 'No data',
      tone: 'low',
      flags: ['프로필 미선택'],
    }
  }

  const evidence = buildCreatorSourceEvidence(creator)
  const averageConfidence = evidence.reduce((sum, source) => sum + Number(source.confidence || 0), 0) / Math.max(evidence.length, 1)
  const pendingPenalty = hasPendingMetrics(creator) || creator.needsVerification ? 12 : 0
  const fakeRiskPenalty = Math.min(14, Math.round(Number(creator.fakeRisk || 0) * 0.8))
  const officialBonus = creator.platform === 'YouTube' ? 6 : 0
  const metricSourceBonus = creator.metricSources?.length ? 4 : 0
  const score = clampNumber(Math.round(averageConfidence + officialBonus + metricSourceBonus - pendingPenalty - fakeRiskPenalty), 0, 100)

  const level = score >= 86 ? '검증 높음' : score >= 72 ? '운영 가능' : score >= 58 ? '추가 검증' : '보류 권장'
  const tone = score >= 86 ? 'high' : score >= 72 ? 'medium' : 'low'
  const flags = [
    creator.platform === 'YouTube' ? '공식 API 연결 가능' : '공개 프로필 수집',
    creator.metricSources?.length ? '수집 출처 보유' : '출처 보강 필요',
    creator.needsVerification ? '팔로워/조회 검증 대기' : '핵심 지표 입력됨',
    Number(creator.fakeRisk || 0) >= 10 ? '가짜 팔로워 위험 점검' : '위험 낮음',
  ]

  return { score, level, tone, flags }
}

function getReferenceVirality(reference) {
  const views = Number(reference?.views || 0)
  const followers = Number(reference?.accountFollowers || 0)
  if (!followers) return 0
  return views / followers
}

function getReferencePerformanceLabel(reference) {
  const views = Number(reference?.views || 0)
  const virality = getReferenceVirality(reference)
  if (views >= 500000 && virality >= 2) return `조회 ${compactNumber(views)} · 팔로워 대비 ${virality.toFixed(1)}x 터진 콘텐츠`
  if (views >= 500000) return `조회 ${compactNumber(views)} 이상 고조회 레퍼런스`
  if (virality >= 2) return `팔로워 대비 ${virality.toFixed(1)}x 반응 레퍼런스`
  return '공개 반응 기반 제작 레퍼런스'
}

function buildReferenceScriptBlueprint(reference, brief = {}, campaign = {}) {
  const product = brief.product || campaign.product || '제품'
  const persona = brief.persona || campaign.persona || '타깃 고객'
  const oneMessage =
    campaign.oneMessage ||
    `${product}가 ${persona}의 실제 사용 맥락에서 선택될 이유를 보여준다`
  const hook = reference.hook || reference.title || '첫 3초에 문제와 결과를 동시에 보여준다'
  const proof =
    reference.analysis ||
    '조회/저장/댓글이 나온 이유를 후킹, 장면 전환, CTA 구조로 분해한다.'
  const applyIdea =
    reference.applyIdea ||
    '원본 문장과 화면은 복제하지 않고 구조만 차용한다.'

  return [
    `원본 레퍼런스 구조: ${hook}`,
    `터진 이유 가설: ${proof}`,
    `우리 브랜드 원메시지: ${oneMessage}`,
    `변형 스크립트: "요즘 ${persona}가 가장 먼저 고민하는 건 결국 사용 전후의 차이입니다. ${product}는 이 장면에서 바로 확인할 수 있어요."`,
    '컷 구성: 1) 문제/호기심 컷 2) 제품 등장 컷 3) 실제 사용 컷 4) 전후/근거 컷 5) 댓글/링크 CTA 컷',
    `가이드 반영: ${applyIdea}`,
    '주의: 원본 영상의 문장, 자막, 음악, 화면 구도를 그대로 복제하지 말고 후킹 구조와 정보 배열만 변형한다.',
  ].join('\n')
}

function buildProductionReferenceMaterial(reference, brief = {}, campaign = {}) {
  const performance = getReferencePerformanceLabel(reference)
  const scriptBlueprint = buildReferenceScriptBlueprint(reference, brief, campaign)
  const sourceName = [reference.platform, reference.mediaType, reference.country || '국가 미입력', performance]
    .filter(Boolean)
    .join(' · ')

  return {
    id: createId(),
    title: `제작 레퍼런스 변형 가이드 · ${reference.title}`,
    sourceType: '콘텐츠 레퍼런스 루프',
    sourceName,
    summary: [
      performance,
      `원본 링크: ${reference.url || '-'}`,
      `핵심 분석: ${reference.analysis || reference.hook || reference.title}`,
      `변형 방향: ${reference.applyIdea || '후킹 구조, 장면 순서, CTA 질문을 브랜드 메시지에 맞게 재구성'}`,
      scriptBlueprint,
    ]
      .filter(Boolean)
      .join('\n'),
    keywords: [
      reference.platform,
      reference.mediaType,
      reference.country,
      '50만 이상 조회 레퍼런스',
      '후킹 포인트',
      '변형 스크립트',
      '콘텐츠 가이드',
    ]
      .filter(Boolean)
      .join(', '),
    doSay: scriptBlueprint,
    dontSay:
      '원본 영상/이미지/자막/음원/문장을 그대로 복제하지 말 것. 타 브랜드명, 경쟁사 비교 단정, 과장 효능 표현은 제외할 것.',
    createdAt: nowLabel(),
  }
}

function inferPlatformFromUrl(value) {
  try {
    const hostname = new URL(String(value || '')).hostname.replace(/^www\./, '').toLowerCase()
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'YouTube'
    if (hostname.includes('instagram.com')) return 'Instagram'
    if (hostname.includes('tiktok.com')) return 'TikTok'
  } catch {
    return ''
  }
  return ''
}

function inferMediaTypeFromUrl(value, platform) {
  const raw = String(value || '')
  if (platform === 'Instagram' && /\/p\//i.test(raw)) return '이미지'
  return platform ? '영상' : ''
}

function normalizeContentReferences(references = []) {
  return (references || [])
    .map((item) => normalizeContentReference(item))
    .filter(Boolean)
}

function normalizeContentReference(item) {
  if (!item) return null
  const platform = item.platform || inferPlatformFromUrl(item.url)
  const normalized = {
    ...item,
    platform,
    mediaType: item.mediaType || inferMediaTypeFromUrl(item.url, platform) || '영상',
    title: cleanReferenceDisplayText(item.title),
    hook: cleanReferenceDisplayText(item.hook),
    analysis: cleanReferenceDisplayText(item.analysis),
    applyIdea: cleanReferenceDisplayText(item.applyIdea),
    thumbnailUrl: isPlatformLogoAsset(item.thumbnailUrl) ? '' : item.thumbnailUrl,
  }

  if (isLowQualitySavedReference(normalized)) return null
  return normalized
}

function isLowQualitySavedReference(item) {
  const platform = item.platform || inferPlatformFromUrl(item.url)
  if (['Instagram', 'TikTok'].includes(platform) && !isValidReferenceContentUrl(item.url, platform)) return true

  const title = cleanReferenceDisplayText(item.title).toLowerCase()
  const analysis = cleanReferenceDisplayText(item.analysis).toLowerCase()
  if (/(^|[\s(])@?reel\b/.test(title) || /reel raffle/.test(title)) return true
  if (title.includes('instagram photos and videos') && analysis.includes('instagram photos and videos')) return true
  return false
}

function isValidReferenceContentUrl(value, platform = inferPlatformFromUrl(value)) {
  try {
    const url = new URL(String(value || ''))
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
    const segments = url.pathname.split('/').filter(Boolean)

    if (platform === 'Instagram') {
      return hostname.includes('instagram.com') &&
        ['reel', 'p'].includes(segments[0]) &&
        /^[A-Za-z0-9_-]{5,}$/.test(segments[1] || '')
    }

    if (platform === 'TikTok') {
      return hostname.includes('tiktok.com') &&
        segments[0]?.startsWith('@') &&
        segments[1] === 'video' &&
        /^[0-9]{8,}$/.test(segments[2] || '')
    }

    if (platform === 'YouTube') {
      return hostname.includes('youtube.com') || hostname.includes('youtu.be')
    }
  } catch {
    return false
  }

  return Boolean(value)
}

function cleanReferenceDisplayText(value) {
  let text = String(value || '')
  for (let index = 0; index < 3; index += 1) {
    const next = text
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    if (next === text) break
    text = next
  }
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function isPlatformLogoAsset(value) {
  return /(instagram\.com\/static|static\.cdninstagram\.com|tiktokcdn.*logo|tiktok.*logo|favicon|apple-touch-icon|rs:fit:32:32)/i.test(String(value || ''))
}

function isSearchEngineThumbnailAsset(value) {
  return /(imgs\.search\.brave\.com|encrypted-tbn|googleusercontent\.com\/.*(thumbnail|favicon)|gstatic\.com\/images)/i.test(String(value || ''))
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

function exportBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function safeFilePart(value) {
  return String(value || 'guide')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'guide'
}

function splitGuideLines(guide) {
  return String(guide || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function stripMarkdown(line) {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^\[[ x]\]\s*/i, '')
}

function matchesBriefPlatform(creator, platforms = []) {
  if (platforms.includes(creator.platform)) return true
  return creator.platform === 'TikTok' && platforms.includes('TikTok 셀러')
}

function hasFinalConsonant(value) {
  const charCode = String(value || '').trim().charCodeAt(String(value || '').trim().length - 1)
  return Number.isFinite(charCode) && charCode >= 0xac00 && charCode <= 0xd7a3 && (charCode - 0xac00) % 28 > 0
}

function withKoreanJosa(value, pair) {
  const text = String(value || '').trim()
  if (!text) return ''
  const [withFinal, withoutFinal] = pair.split('/')
  return `${text}${hasFinalConsonant(text) ? withFinal : withoutFinal}`
}

function buildInfluencerStrategy({ brand, brief, campaign, creators = [], recommendations = [], learningMaterials = [] }) {
  const selectedPlatforms = (brief.platforms?.length ? brief.platforms : ['Instagram', 'TikTok']).filter(Boolean)
  const selectedCategories = (brief.categories?.length ? brief.categories : ['리뷰']).filter((item) => item !== '전체')
  const realCreators = creators.filter((creator) => !isExampleCreator(creator))
  const matchedCreators = realCreators.filter((creator) => matchesBriefPlatform(creator, selectedPlatforms))
  const sellerMode = selectedPlatforms.includes('TikTok 셀러') || campaign?.campaignType?.includes('셀러')
  const campaignGoal = campaign?.kpiGoal || brief.goal || '조회수와 전환을 함께 보는 캠페인'
  const budget = Number(campaign?.budget || 0)
  const maxCreatorFee = Number(brief.maxPrice || 0)
  const estimatedSlots = maxCreatorFee ? Math.max(3, Math.floor((budget || maxCreatorFee * 5) / Math.max(maxCreatorFee, 1))) : 6
  const learningKeywords = learningMaterials
    .map((item) => item.doSay || item.keywords || item.summary)
    .filter(Boolean)
    .slice(0, 4)
  const forbidden = keywordList(brief.exclusions).slice(0, 5)
  const primaryPlatform = sellerMode ? 'TikTok 셀러' : selectedPlatforms[0] ?? 'Instagram'
  const productText = brief.product || '제품'
  const personaText = brief.persona || '핵심 고객'
  const strategyType = sellerMode
    ? 'Scale-up / 공동구매 셀러 확장'
    : campaign?.objective?.includes('전환') || brief.goal?.includes('전환')
      ? 'Launch-to-Conversion'
      : 'Launch / 브랜드 인지도 확장'

  const castingMix = [
    sellerMode
      ? `TikTok 공동구매 셀러 ${Math.max(10, Number(campaign?.sellerRecruitTarget || 20))}명: 구매 링크/코드 운영 가능 여부를 우선 필터링`
      : `${primaryPlatform} 메인 크리에이터 ${Math.min(estimatedSlots, 5)}명: 첫 주 Anchor 콘텐츠와 신뢰 증명 담당`,
    `마이크로/미드 인플루언서 ${Math.max(4, Math.min(12, estimatedSlots * 2))}명: 댓글 질문, 저장/공유, 사용 상황 확산 담당`,
    `${selectedCategories.slice(0, 3).join(', ') || '브랜드 핏'} 카테고리 후보: 페르소나 적합성과 과거 콘텐츠 톤을 우선 검수`,
  ]

  const hookLines = [
    `M2 Number Shock: "${withKoreanJosa(productText, '을/를')} ${personaText} 기준으로 가격/효용 숫자로 먼저 보여주기"`,
    `M5 Physical Artifact: 실제 제품, 패키지, 사용 장면, 측정표처럼 조작하기 어려운 증거를 첫 5초 안에 노출`,
    `M7 Specificity Overload: 성분, 사이즈, 사용 기간, 전환 조건처럼 구체 숫자를 자막에 넣기`,
    `M6 Counter-Instinct Casting: 해당 카테고리에 까다로운 리뷰어가 인정하는 구조로 신뢰 확보`,
    sellerMode
      ? 'M3 Stakes: 공동구매 혜택, 마감, 코드 조건을 명확히 보여주되 과장/허위 긴급성은 금지'
      : 'M1 Confession Arc: 처음엔 의심했지만 실제 사용 후 인정하는 리뷰 흐름',
  ]

  const kpiPlan = [
    `도달/조회: ${campaign?.targetViews ? compactNumber(campaign.targetViews) : '캠페인 목표 조회수'} 대비 후보별 예상 조회 기여도 기록`,
    `참여: 댓글 질문, 저장, 공유를 콘텐츠별로 수집하고 평균 참여율 ${brief.minEngagement || '목표'} 기준으로 비교`,
    `전환: ${campaign?.commerceMetric || 'UTM 링크, 쿠폰 코드, 공동구매 링크'} 기준으로 주문/문의/클릭을 분리 기록`,
    `운영: 제안 발송, 응답, 섭외 완료, 콘텐츠 게시, 리포트까지 상태 로그를 남김`,
  ]

  const budgetPlan = budget
    ? [
        `콘텐츠 제작/출연료 55%: ${won(Math.round(budget * 0.55))}`,
        `마이크로/셀러 확장 25%: ${won(Math.round(budget * 0.25))}`,
        `성과 리워드/추가 콘텐츠 10%: ${won(Math.round(budget * 0.1))}`,
        `리포트/운영/예비비 10%: ${won(Math.round(budget * 0.1))}`,
      ]
    : [
        `최대 단가 ${won(maxCreatorFee)} 기준으로 메인 후보와 마이크로 후보를 분리`,
        '확정 예산 입력 후 메인/확산/성과 리워드 비중을 자동 산정',
      ]

  return `# ${brand.name || brief.brandName} 인플루언서 전략 초안

## 1. 전략 유형
- 유형: ${strategyType}
- 목표: ${campaignGoal}
- 핵심 제품: ${productText}
- 타깃 페르소나: ${personaText}
- 우선 채널: ${selectedPlatforms.join(', ')}

## 2. Big Idea
${withKoreanJosa(productText, '을/를')} 단순 협찬 리뷰가 아니라 "${withKoreanJosa(personaText, '이/가')} 실제 구매를 결정하는 증거 콘텐츠"로 설계합니다. 첫 콘텐츠는 신뢰 증명, 두 번째 흐름은 사용 상황, 세 번째 흐름은 구매/문의 전환으로 나눕니다.

## 3. 캐스팅 전략
${castingMix.map((item) => `- ${item}`).join('\n')}
- 현재 실제 후보 풀: ${matchedCreators.length}명 / AI 추천 후보: ${recommendations.length}명

## 4. 콘텐츠 후킹 포인트
${hookLines.map((item) => `- ${item}`).join('\n')}

## 5. 채널별 운영
${selectedPlatforms.map((platform) => {
    if (platform === 'TikTok 셀러') return '- TikTok 셀러: 대량 후보 발굴 → 메시지 검토함 → 샘플/조건 확인 → 공동구매 링크/코드 운영'
    if (platform === 'YouTube') return '- YouTube: 5분 이상 상세 리뷰 또는 Shorts 미러링으로 검색형 신뢰 콘텐츠 확보'
    if (platform === 'Instagram') return '- Instagram: 릴스 첫 3초 후킹, 스토리 리마인드, 저장 유도 Q&A 구성'
    if (platform === 'TikTok') return '- TikTok: 짧은 문제 제기, 사용 장면, 댓글 유도형 CTA로 반복 노출'
    return `- ${platform}: 채널 특성에 맞춰 첫 3초 후킹과 CTA를 분리`
  }).join('\n')}

## 6. KPI 설계
${kpiPlan.map((item) => `- ${item}`).join('\n')}

## 7. 예산/섭외 구조
${budgetPlan.map((item) => `- ${item}`).join('\n')}

## 8. 브랜드 학습자료 반영
${learningKeywords.length ? learningKeywords.map((item) => `- 강조: ${item}`).join('\n') : '- 등록된 학습자료가 없으므로 제품 USP, 금지 표현, 상세페이지 문구를 먼저 넣는 것을 권장'}
${forbidden.length ? forbidden.map((item) => `- 금지/주의: ${item}`).join('\n') : '- 금지 표현은 캠페인 생성 전 별도 확인'}

## 9. 컴플라이언스 게이트
- 모든 콘텐츠에 #광고, #협찬 또는 유료광고 포함 표기를 명시
- 가짜 후기, 무표기 커뮤니티 시딩, 경쟁사 실명 비방은 제외
- 의학적 효능, 과장 전후 비교, 허위 긴급성 표현은 검수 단계에서 차단
- 최종 실행 전 GO / MODIFY / HOLD / STOP 컨펌을 받음

## 10. 다음 액션
1. 실제 후보 발굴에서 공개 프로필 데이터를 수집
2. AI 매칭 실행으로 후보 리스트 생성
3. 메시지 검토함에서 제안 문구 확인
4. 섭외 완료 풀과 콘텐츠 성과를 리포트로 추적
`
}

async function exportGuideDocx(filenameBase, guide) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')
  const lines = splitGuideLines(guide)
  const children = lines.map((line) => {
    if (line.startsWith('# ')) {
      return new Paragraph({
        text: stripMarkdown(line),
        heading: HeadingLevel.TITLE,
        spacing: { after: 240 },
      })
    }

    if (line.startsWith('## ')) {
      return new Paragraph({
        text: stripMarkdown(line),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 120 },
      })
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line) || /^-\s*\[[ x]\]/i.test(line)) {
      return new Paragraph({
        children: [new TextRun(stripMarkdown(line))],
        bullet: { level: 0 },
        spacing: { after: 90 },
      })
    }

    return new Paragraph({
      children: [new TextRun(stripMarkdown(line))],
      spacing: { after: 120 },
    })
  })

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })
  const blob = await Packer.toBlob(document)
  exportBlob(`${filenameBase}.docx`, blob)
}

async function exportGuidePptx(filenameBase, guide) {
  const { default: pptxgen } = await import('pptxgenjs')
  const lines = splitGuideLines(guide)
  const title = stripMarkdown(lines.find((line) => line.startsWith('# ')) || '인플루언서 콘텐츠 가이드')
  const sections = []
  let current = { title, bullets: [] }

  lines.forEach((line) => {
    if (line.startsWith('## ')) {
      if (current.bullets.length) sections.push(current)
      current = { title: stripMarkdown(line), bullets: [] }
      return
    }
    if (!line.startsWith('# ')) current.bullets.push(stripMarkdown(line))
  })
  if (current.bullets.length) sections.push(current)

  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'CreatorOps'
  pptx.subject = title
  pptx.title = title
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
    lang: 'ko-KR',
  }

  const cover = pptx.addSlide()
  cover.background = { color: 'F5F7FA' }
  cover.addText(title, {
    x: 0.65,
    y: 1.15,
    w: 11.0,
    h: 0.8,
    fontFace: 'Aptos Display',
    fontSize: 32,
    bold: true,
    color: '111827',
    fit: 'shrink',
  })
  cover.addText('원메시지, 후킹포인트, 채널별 제작 기준을 한 장표 흐름으로 정리했습니다.', {
    x: 0.68,
    y: 2.05,
    w: 10.2,
    h: 0.45,
    fontSize: 15,
    color: '5B6472',
    fit: 'shrink',
  })
  cover.addShape(pptx.ShapeType.rect, {
    x: 0.68,
    y: 3.15,
    w: 5.4,
    h: 0.12,
    color: '0071E3',
    line: { color: '0071E3' },
  })

  sections.slice(0, 12).forEach((section, index) => {
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }
    slide.addText(`${String(index + 1).padStart(2, '0')}`, {
      x: 0.55,
      y: 0.4,
      w: 0.7,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: '0071E3',
    })
    slide.addText(section.title, {
      x: 1.15,
      y: 0.35,
      w: 10.5,
      h: 0.55,
      fontFace: 'Aptos Display',
      fontSize: 23,
      bold: true,
      color: '111827',
      fit: 'shrink',
    })
    const bullets = section.bullets.slice(0, 7).map((item) => ({ text: item, options: { bullet: { indent: 16 } } }))
    slide.addText(bullets.length ? bullets : '세부 내용은 캠페인 브리프를 기준으로 보완하세요.', {
      x: 1.15,
      y: 1.25,
      w: 10.4,
      h: 4.8,
      fontSize: 15,
      color: '273142',
      breakLine: false,
      fit: 'shrink',
      valign: 'top',
      paraSpaceAfterPt: 10,
    })
  })

  await pptx.writeFile({ fileName: `${filenameBase}.pptx` })
}

async function openGuideGoogleDraft(guide) {
  try {
    await navigator.clipboard?.writeText(guide)
  } catch {
    // Clipboard permission can be blocked by the browser; opening docs still gives the user a destination.
  }
  window.open('https://docs.new', '_blank', 'noopener,noreferrer')
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function exportExcelFile(filename, sheetName, rows) {
  const safeSheetName = sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1'
  const xmlRows = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const isNumber = typeof cell === 'number' && Number.isFinite(cell)
            return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`
          })
          .join('')}</Row>`,
    )
    .join('')
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeXml(safeSheetName)}">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`

  exportFile(filename, 'application/vnd.ms-excel;charset=utf-8', workbook)
}

function rowsToTsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) =>
          String(cell ?? '')
            .replaceAll('\t', ' ')
            .replaceAll('\r', ' ')
            .replaceAll('\n', ' '),
        )
        .join('\t'),
    )
    .join('\n')
}

function parseDiscoveryFilterValue(value) {
  const cleaned = String(value ?? '').replaceAll(',', '').trim()
  if (!cleaned) return null

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function hasDiscoveryFilterValue(value) {
  return parseDiscoveryFilterValue(value) !== null
}

function getCreatorViralityRatio(creator) {
  const followers = Number(creator?.followers || 0)
  const averageViews = Number(creator?.averageViews || 0)
  if (!averageViews) return 0
  if (!followers) return 1
  return averageViews / Math.max(followers, 1)
}

function getCreatorPerformanceScore(creator) {
  if (!creator) return 0
  const averageViews = Number(creator.averageViews || 0)
  const engagement = Number(creator.engagement || 0)
  const fit = Number(creator.fit || 0)
  const virality = getCreatorViralityRatio(creator)
  const viewScore = Math.min(46, Math.log10(averageViews + 1) * 7.5)
  const viralScore = Math.min(30, virality * 18)
  const engagementScore = Math.min(16, engagement * 2)
  const fitScore = Math.min(12, fit * 0.12)
  const pendingPenalty = hasPendingMetrics(creator) && !averageViews ? 18 : 0
  return clampNumber(Math.round(viewScore + viralScore + engagementScore + fitScore - pendingPenalty), 0, 100)
}

function compareCreatorsByDiscoveryPriority(a, b) {
  const performanceGap = getCreatorPerformanceScore(b) - getCreatorPerformanceScore(a)
  if (performanceGap) return performanceGap
  const viewGap = Number(b.averageViews || 0) - Number(a.averageViews || 0)
  if (viewGap) return viewGap
  return Number(b.fit || 0) - Number(a.fit || 0)
}

function parseOpenMetric(value) {
  const normalized = String(value ?? '').trim().toLowerCase().replaceAll(',', '')
  if (!normalized) return 0

  const numeric = Number.parseFloat(normalized.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(numeric)) return 0

  if (normalized.includes('억')) return Math.round(numeric * 100000000)
  if (normalized.includes('만')) return Math.round(numeric * 10000)
  if (normalized.includes('k')) return Math.round(numeric * 1000)
  if (normalized.includes('m')) return Math.round(numeric * 1000000)

  return Math.round(numeric)
}

function parseFollowerText(value) {
  const text = String(value ?? '').trim().toLowerCase().replaceAll(',', '')
  if (!text) return null

  const numeric = Number.parseFloat(text.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(numeric)) return null

  if (text.includes('억')) return Math.round(numeric * 100000000)
  if (text.includes('만')) return Math.round(numeric * 10000)
  if (text.includes('천')) return Math.round(numeric * 1000)
  if (text.includes('k')) return Math.round(numeric * 1000)
  if (text.includes('m')) return Math.round(numeric * 1000000)

  return Math.round(numeric)
}

function uniqueList(items) {
  return Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)))
}

function joinKeywords(items) {
  return uniqueList(items).join(', ')
}

function extractBriefSection(text, heading, nextHeadings = []) {
  const lines = String(text || '').split(/\r?\n/)
  const startIndex = lines.findIndex((line) => line.trim().replace(/\s/g, '').startsWith(heading.replace(/\s/g, '')))
  if (startIndex < 0) return ''

  const nextIndex = lines.findIndex((line, index) => {
    if (index <= startIndex) return false
    const compactLine = line.trim().replace(/\s/g, '')
    return nextHeadings.some((nextHeading) => compactLine.startsWith(nextHeading.replace(/\s/g, '')))
  })

  return lines
    .slice(startIndex + 1, nextIndex > startIndex ? nextIndex : undefined)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function parseInfluencerTargets(text) {
  const source = String(text || '')
  const platformPatterns = [
    { platform: 'YouTube', label: 'YouTube', pattern: /(YT|YouTube|유튜브)[^,\n]*/gi },
    { platform: 'Instagram', label: 'Instagram', pattern: /(IG|Instagram|인스타|펫스타그램)[^,\n]*/gi },
    { platform: 'TikTok', label: 'TikTok', pattern: /(TikTok|틱톡)[^,\n]*/gi },
  ]

  return platformPatterns.flatMap(({ platform, label, pattern }) =>
    Array.from(source.matchAll(pattern)).map((match) => {
      const segment = match[0]
      const count = Number(segment.match(/(\d+)\s*(명|개|팀)?/)?.[1] ?? 0)
      const rangeMatch = segment.match(/([0-9.,]+)\s*(천|만|억|k|m)?\s*[~-]\s*([0-9.,]+)\s*(천|만|억|k|m)?/i)
      const unit = rangeMatch?.[4] || rangeMatch?.[2] || ''
      const minFollowers = rangeMatch ? parseFollowerText(`${rangeMatch[1]}${rangeMatch[2] || unit}`) : null
      const maxFollowers = rangeMatch ? parseFollowerText(`${rangeMatch[3]}${unit}`) : null
      const persona = segment.replace(/^\s*(YT|YouTube|유튜브|IG|Instagram|인스타|TikTok|틱톡)\s*/i, '').trim()

      return {
        platform,
        label,
        count,
        minFollowers,
        maxFollowers,
        persona: persona || `${label} 후보`,
        raw: segment.trim(),
      }
    }),
  )
}

function buildAutoBriefSetup(rawText) {
  const text = String(rawText || '').trim()
  if (!text) return null

  const productSection = extractBriefSection(text, '제품', ['희망인플루언서', '후킹포인트'])
  const targetSection = extractBriefSection(text, '희망인플루언서', ['제품', '후킹포인트'])
  const hookSection = extractBriefSection(text, '후킹포인트', ['제품', '희망인플루언서']) || text
  const hookLines = hookSection
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 14)

  const product = productSection.split(/\r?\n/).find(Boolean) || '캠페인 제품'
  const targets = parseInfluencerTargets(targetSection || text)
  const platforms = uniqueList(targets.map((target) => target.platform)).filter((item) => platformOptions.includes(item))
  const categoryHints = [
    text.includes('펫') || text.includes('강아지') || text.includes('반려견') || text.includes('켄넬') ? '펫' : '',
    text.includes('공동구매') ? '공동구매' : '',
    text.includes('리뷰') || text.includes('비교') ? '리뷰' : '',
    text.includes('여행') || text.includes('차량') ? '아웃도어' : '',
  ]
  const categories = uniqueList(categoryHints).filter((item) => categoryOptions.includes(item))
  const minFollowers = Math.min(...targets.map((target) => target.minFollowers).filter(Boolean))
  const maxFollowers = Math.max(...targets.map((target) => target.maxFollowers).filter(Boolean))
  const hasFollowerRange = Number.isFinite(minFollowers) && Number.isFinite(maxFollowers)
  const priceMatch = text.match(/[₩￦]\s*[\d,]+/)
  const hasTravelUseCase = /IATA|항공|비행기|좌석|차량|안전벨트/i.test(text)
  const hasAnxietyUseCase = /분리불안|자발적으로|거부|환불|강아지가/i.test(text)
  const hasProofUseCase = /검증|그래프|측정|규격|비포애프터|Day\s*\d+/i.test(text)
  const keywordHints = [
    product,
    '반려견 이동장',
    text.includes('켄넬') ? '켄넬' : '',
    hasTravelUseCase ? 'IATA 항공 규격' : '',
    hasTravelUseCase ? '차량 안전벨트 고정' : '',
    hasTravelUseCase ? '비행기 좌석 아래 수납' : '',
    hasAnxietyUseCase ? '분리불안' : '',
    hasAnxietyUseCase ? '펫 퍼스펙티브' : '',
    hasProofUseCase ? '행동 검증' : '',
    text.includes('사이즈') ? '견체중별 사이즈' : '',
    priceMatch ? `${priceMatch[0].replace(/\s/g, '')} 가격 우위` : '',
    text.includes('환불') ? '30일 환불 약속' : '',
  ]
  const exclusions = [
    text.includes('거명') ? '경쟁사 실명 거명' : '',
    /IATA|항공/i.test(text) ? '항공사 승인 과장' : '',
    text.includes('분리불안') ? '의학적 치료 효능 과장' : '',
    '안전 보장 단정',
  ]
  const targetSummary = targets
    .map((target) => {
      const range = target.minFollowers && target.maxFollowers
        ? `${compactNumber(target.minFollowers)}~${compactNumber(target.maxFollowers)}`
        : '팔로워 범위 미정'
      return `${target.label} ${target.count || '-'}명 · ${range} · ${target.persona}`
    })
    .join(' / ')
  const hookSummary = hookLines.slice(0, 8).join(' / ')
  const persona = categories.includes('펫')
    ? '반려견 이동, 여행, 차량 이동, 펫 라이프 콘텐츠를 신뢰감 있게 설명할 수 있는 펫 채널/펫스타그램 운영자'
    : `${product} 사용 맥락을 실제 경험처럼 설명할 수 있는 크리에이터`
  const campaignType = text.includes('공동구매') ? '커머스/제휴' : '제안형'
  const objective = priceMatch || text.includes('환불') || text.includes('구매') ? '구매 전환' : '브랜드 인지도'

  return {
    product,
    hooks: hookLines,
    targets,
    brandBrief: {
      product,
      persona,
      keywords: joinKeywords(keywordHints),
      exclusions: joinKeywords(exclusions),
      platforms: platforms.length ? platforms : ['YouTube', 'Instagram'],
      categories: categories.length ? categories : ['리뷰'],
      minFollowers: hasFollowerRange ? minFollowers : 5000,
      maxPrice: defaultBrandBrief.maxPrice,
    },
    discovery: {
      query: joinKeywords(['펫', '강아지', '반려견', '켄넬', product, '펫스타그램', '펫 채널']),
      platform: '전체',
      category: categories[0] ?? '전체',
      filters: {
        minFollowers: hasFollowerRange ? String(minFollowers) : '',
        maxFollowers: hasFollowerRange ? String(maxFollowers) : '',
        minAverageViews: '',
        minEngagement: '',
        maxPrice: '',
        minFit: '75',
      },
    },
    campaign: {
      name: `${product} 인플루언서 섭외`,
      objective,
      campaignType,
      mission: hookLines.length
        ? `후킹포인트 중 1~2개를 선택해 실제 사용 시나리오로 제작: ${hookSummary}`
        : `${product} 사용 경험과 구매 이유를 자연스럽게 보여주는 콘텐츠`,
      reward: '제품 제공 + 협의 단가',
      approvalFlow: '브리프 전달 → 후킹포인트 선택 → 원고/자막 검수 → 게시 확인 → 성과 리포트',
      commerceMetric: '전환 링크, 쿠폰코드, 조회수, 댓글, 공유, 저장',
      kpiGoal: targetSummary || '플랫폼별 후보 섭외 후 조회수/전환 KPI 검증',
      targetViews: '',
      targetConversions: '',
      targetOrders: '',
      targetRevenue: '',
      recommendationTargetCount: String(targets.reduce((sum, target) => sum + (target.count || 0), 0) || ''),
      sellerRecruitTarget: String(targets.reduce((sum, target) => sum + (target.count || 0), 0) || ''),
    },
    learningMaterial: {
      id: createId(),
      title: `${product} 후킹포인트`,
      sourceType: 'AI 브리프 자동 세팅',
      sourceName: '붙여넣기 브리프',
      summary: hookSummary || text.slice(0, 240),
      keywords: joinKeywords(keywordHints),
      doSay: hookLines.slice(0, 6).join(' / '),
      dontSay: joinKeywords(exclusions),
      createdAt: nowLabel(),
    },
    summary: {
      targetSummary,
      hookSummary,
      platformSummary: platforms.length ? platforms.join(', ') : 'YouTube, Instagram',
      candidateTargetCount: targets.reduce((sum, target) => sum + (target.count || 0), 0) || 8,
    },
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function buildBriefDiscoveryCreators(setup, existingCreators = []) {
  const targetFallbacks = [
    { platform: 'YouTube', label: 'YouTube', count: 3, minFollowers: 50000, maxFollowers: 500000, persona: '펫 채널', raw: 'YouTube 펫 채널' },
    { platform: 'Instagram', label: 'Instagram', count: 5, minFollowers: 5000, maxFollowers: 30000, persona: '펫스타그램', raw: 'Instagram 펫스타그램' },
  ]
  const targets = setup.targets.length ? setup.targets : targetFallbacks
  const existingByKey = new Map(existingCreators.filter((creator) => creator.discoveryKey).map((creator) => [creator.discoveryKey, creator]))
  const category = setup.brandBrief.categories[0] ?? '리뷰'
  const topicKeywords = keywordList(setup.brandBrief.keywords).slice(0, 6)
  const hookTopics = setup.hooks
    .map((hook) => hook.replace(/[()[\]₩￦0-9,+~-]/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4)
  const topics = uniqueList([setup.product, category, ...topicKeywords, ...hookTopics]).slice(0, 7)
  const avatarPool = [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=160&q=80',
    'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=160&q=80',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=160&q=80',
    'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=160&q=80',
  ]
  const nameTemplates = {
    YouTube: ['펫 이동장 리뷰 채널', '강아지 여행 브이로그', '반려견 안전 이동 채널', '소형견 케어 채널'],
    Instagram: ['펫스타그램 이동생활', '소형견 데일리그램', '반려견 여행그램', '강아지 켄넬핏', '펫용품 실사용그램'],
    TikTok: ['펫 숏폼 셀러', '강아지 생활템 리뷰어', '반려견 공동구매 셀러'],
  }
  let serial = 0

  return targets.flatMap((target) => {
    const count = clampNumber(Number(target.count) || 3, 1, 20)
    const minFollowers = Number(target.minFollowers || (target.platform === 'Instagram' ? 5000 : 50000))
    const maxFollowers = Number(target.maxFollowers || (target.platform === 'Instagram' ? 30000 : 500000))
    const range = Math.max(maxFollowers - minFollowers, 1)
    const templates = nameTemplates[target.platform] ?? [`${setup.product} 리뷰 후보`]

    return Array.from({ length: count }).map((_, index) => {
      serial += 1
      const discoveryKey = `ai-brief:${setup.product}:${target.platform}:${target.raw || target.persona}:${index + 1}`
      const existing = existingByKey.get(discoveryKey)
      const followers = Math.round(minFollowers + (range * (index + 1)) / (count + 1))
      const viewRatio = target.platform === 'Instagram' ? 0.48 : target.platform === 'TikTok' ? 0.64 : 0.36
      const averageViews = Math.round(followers * viewRatio)
      const engagement = Number((target.platform === 'Instagram' ? 6.8 - index * 0.35 : 5.3 - index * 0.25).toFixed(1))
      const fit = clampNumber(92 - index * 2 + (target.platform === 'Instagram' ? 1 : 0), 78, 96)
      const sourceCollectedAt = nowLabel()
      const metricSources = [
        {
          metric: '팔로워',
          source: 'AI 브리프 기반 발굴 목표치',
          method: `${target.raw || target.persona} 조건의 팔로워 범위에서 우선 검증 후보 생성`,
          confidence: 46,
          freshness: sourceCollectedAt,
          value: followers,
        },
        {
          metric: '평균 조회',
          source: 'AI 추정/보정 모델',
          method: '플랫폼별 팔로워 대비 예상 조회율로 1차 추정, 공개 콘텐츠 수집 후 교체 필요',
          confidence: 42,
          freshness: sourceCollectedAt,
          value: averageViews,
        },
      ]

      return {
        ...(existing ?? {}),
        id: existing?.id ?? createId() + serial,
        name: existing?.name ?? `${templates[index % templates.length]} ${String(index + 1).padStart(2, '0')}`,
        handle: existing?.handle ?? `@${target.platform.toLowerCase()}.pet.discovery${String(index + 1).padStart(2, '0')}`,
        avatar: existing?.avatar ?? avatarPool[(serial - 1) % avatarPool.length],
        platform: target.platform,
        profileUrl: existing?.profileUrl ?? '',
        contactEmail: existing?.contactEmail ?? '',
        preferredContactChannel: 'manual_other',
        category,
        country: 'KR',
        followers,
        averageViews,
        engagement,
        growth: existing?.growth ?? Number((4.5 + index * 0.7).toFixed(1)),
        fit,
        brandSafety: clampNumber(94 - index, 86, 98),
        fakeRisk: clampNumber(5 + index, 4, 14),
        cpm: existing?.cpm ?? (target.platform === 'YouTube' ? 7800 : 5200),
        price: existing?.price ?? Math.max(250000, Math.round(averageViews * (target.platform === 'YouTube' ? 18 : 14))),
        audience: `${target.persona || target.label} · ${compactNumber(minFollowers)}~${compactNumber(maxFollowers)} 조건 매칭`,
        city: 'KR',
        lastPost: 'AI 발굴 · 검증 대기',
        status: 'AI 발굴 후보',
        topics,
        sourceUrl: existing?.sourceUrl ?? '',
        sourceCollectedAt,
        sourceNote: '브리프 기준 1차 후보입니다. 실제 공개 프로필 URL과 최신 팔로워/조회수 검증 후 제안하세요.',
        discoveryKey,
        isSynthetic: true,
        needsVerification: true,
        metricSources,
      }
    })
  })
}

function isExampleCreator(creator) {
  if (!creator) return false
  return Boolean(
    creator.isDemo ||
      creator.isSynthetic ||
      String(creator.discoveryKey || '').startsWith('ai-brief:'),
  )
}

function hasPendingMetrics(creator) {
  return Boolean(creator?.metricsPending || (creator?.needsVerification && !Number(creator.followers)))
}

function displayMetric(value, pendingText = '수집 필요') {
  return value ? compactNumber(value) : pendingText
}

function detectDiscoveryResultCountry(result) {
  const officialCountry = String(result?.country || '').trim().toUpperCase()
  const platform = result?.platform || ''
  if (officialCountry && result?.countryConfidence === 'official') return officialCountry
  if (officialCountry && result?.countryConfidence === 'detected') return officialCountry
  if (officialCountry && platform === 'YouTube' && result?.verifiedMetrics) return officialCountry

  const text = [result?.profileUrl, result?.name, result?.handle, result?.snippet, result?.sourceTitle, result?.sourceSnippet]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

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

function buildDiscoverySearchText({ query, category, brandBrief, selectedCampaign }) {
  const manualQuery = String(query || '').replace(/\s+/g, ' ').trim()
  const selectedCategory = category && category !== '\uC804\uCCB4' ? category : ''

  if (manualQuery) {
    return uniqueList([manualQuery, selectedCategory]).join(' ').trim()
  }

  return [
    selectedCategory,
    selectedCampaign?.product,
    selectedCampaign?.searchKeywords,
    selectedCampaign?.targetPersona,
    brandBrief.product,
    brandBrief.keywords,
    brandBrief.persona,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getDiscoveryIntentTerms(query, category) {
  const manualTerms = keywordList(query)
  const categoryTerms = category && category !== '\uC804\uCCB4' ? discoveryCategoryIntentTerms[category] ?? [category] : []
  return uniqueList([...manualTerms, ...categoryTerms])
    .map((term) => String(term).trim().toLowerCase())
    .filter((term) => term.length >= 2)
}

function discoveryResultMatchesIntent(result, terms) {
  if (!terms.length) return true
  const searchable = [
    result?.name,
    result?.handle,
    result?.snippet,
    result?.profileUrl,
    result?.source,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return terms.some((term) => searchable.includes(term))
}

function buildRealDiscoveryCreator(result, brief, fallbackCategory, index = 0) {
  const followers = Number(result.followers || 0)
  const averageViews = Number(result.averageViews || 0)
  const verifiedMetrics = Boolean(result.verifiedMetrics && followers)
  const observedMetrics = Boolean(followers || averageViews)
  const platform = result.platform || 'Instagram'
  const collectedAt = nowLabel()
  const isExpandedCandidate = result.discoveryMatchType === 'expanded'
  const detectedCountry = detectDiscoveryResultCountry(result)
  const topicCandidates = keywordList(`${brief.keywords}, ${brief.product}`).slice(0, 5)
  const metricSources = [
    {
      metric: '프로필 URL',
      source: result.source || '공개 웹 검색',
      method: '검색 API 결과에서 프로필 URL, 제목, 설명 수집',
      confidence: 82,
      freshness: collectedAt,
      originalUrl: result.profileUrl,
      value: result.profileUrl,
    },
    {
      metric: '팔로워',
      source: verifiedMetrics || followers ? result.source : '수집 필요',
      method: verifiedMetrics
        ? '공식 API 통계'
        : followers
          ? '검색 스니펫/공개 프로필에서 추출한 공개 수치'
          : '공개 프로필/공식 API로 후속 수집 필요',
      confidence: verifiedMetrics ? 96 : followers ? 62 : 0,
      freshness: collectedAt,
      value: followers,
    },
    {
      metric: '평균 조회',
      source: verifiedMetrics || averageViews ? result.source : '수집 필요',
      method: verifiedMetrics
        ? '공식 채널 통계 기반 계산'
        : averageViews
          ? '검색 스니펫/공개 콘텐츠에서 추출한 공개 수치'
          : '최근 콘텐츠 공개 지표로 후속 계산 필요',
      confidence: verifiedMetrics ? 78 : averageViews ? 58 : 0,
      freshness: collectedAt,
      value: averageViews,
    },
  ]
  const metricFit = verifiedMetrics ? Math.min(14, Math.round((averageViews / Math.max(followers, 1)) * 100)) : 4
  const keywordText = `${result.name} ${result.handle} ${result.snippet || ''}`.toLowerCase()
  const keywordHits = keywordList(brief.keywords).filter((keyword) => keywordText.includes(keyword)).length

  return {
    id: createId() + index,
    name: result.name || result.handle || '실제 검색 후보',
    handle: result.handle || deriveHandleFromUrl(result.profileUrl),
    avatar:
      result.avatar ||
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
    platform,
    profileUrl: result.profileUrl,
    contactEmail: '',
    preferredContactChannel: platform === 'YouTube' ? 'email' : platform === 'TikTok' ? 'tiktok_dm' : 'instagram_dm',
    category: fallbackCategory || brief.categories?.[0] || '리뷰',
    country: detectedCountry,
    followers,
    averageViews,
    engagement: verifiedMetrics ? Number(Math.min(12, Math.max(1.5, (averageViews / Math.max(followers, 1)) * 100)).toFixed(1)) : 0,
    growth: 0,
    fit: clampNumber(76 + keywordHits * 4 + metricFit, 68, 94),
    brandSafety: verifiedMetrics ? 94 : 86,
    fakeRisk: verifiedMetrics ? 6 : 0,
    cpm: platform === 'YouTube' ? 7800 : 5600,
    price: averageViews ? Math.round(averageViews * (platform === 'YouTube' ? 18 : 14)) : 0,
    audience: verifiedMetrics
      ? `${result.source} 공식/공개 지표 기반`
      : `${result.source || '공개 웹 검색'} 결과 · 팔로워/조회수 후속 수집 필요`,
    city: detectedCountry || 'Unverified',
    lastPost: verifiedMetrics ? '공식 지표 수집' : '실제 프로필 발견',
    status: verifiedMetrics ? '실제 데이터 확인' : isExpandedCandidate ? '보류 추천' : '실제 검색 후보',
    topics: uniqueList([brief.product, fallbackCategory, ...topicCandidates, result.snippet || '공개 검색']).slice(0, 7),
    sourceUrl: result.profileUrl,
    sourceCollectedAt: collectedAt,
    sourceNote: verifiedMetrics
      ? `${result.source}로 실제 채널과 공개 통계를 가져왔습니다.`
      : observedMetrics
        ? `${isExpandedCandidate ? '확장 검색 후보입니다. ' : ''}실제 공개 검색 결과에서 프로필 URL과 일부 공개 수치를 가져왔습니다. 평균 조회/참여율은 후속 검증이 필요합니다.`
        : `${isExpandedCandidate ? '확장 검색 후보입니다. ' : ''}실제 공개 검색 결과에서 프로필 URL을 가져왔습니다. 팔로워와 평균 조회는 공식 API 또는 공개 프로필 수집으로 검증해야 합니다.`,
    needsVerification: !verifiedMetrics,
    metricsPending: !observedMetrics,
    metricSources,
  }
}

function deriveHandleFromUrl(value) {
  const text = String(value || '').trim()
  if (!text) return '@public.creator'

  try {
    const url = new URL(text.startsWith('http') ? text : `https://${text}`)
    const lastSegment = url.pathname.split('/').filter(Boolean).at(-1)
    return lastSegment ? `@${lastSegment.replace(/^@/, '')}` : '@public.creator'
  } catch {
    return text.startsWith('@') ? text : `@${text.replace(/^@/, '')}`
  }
}

const dataRoomRawStatuses = ['전체', '정상', '지연', '오류', '중단', '미수집']
const dataRoomMetricStatuses = ['전체', '정상', '지연', '오류', '검증 필요']
const dataRoomScopes = ['전체', '내부', '외부']

function buildAdminRawDataCatalog({
  creators,
  outreach,
  campaigns,
  recruitedPool,
  fulfillmentRecords,
  trackedPosts,
  contentReferences,
  brands,
  backendConfig,
  activeBrand,
}) {
  const nowText = new Date().toLocaleString('ko-KR')
  const nextDaily = '매일 09:00'
  const storageBase = backendConfig?.hasSupabase ? 'Supabase public schema' : 'localStorage creatorops.workspace.v2'
  const externalSnapshotStatus = trackedPosts.length ? '정상' : '지연'

  return [
    {
      id: 'RAW-INT-CRM-001',
      name: 'CRM 발송 데이터',
      scope: '내부',
      category: 'CRM/메시지',
      description: '제안 메시지 검토함, 발송 완료, 응답, 섭외 완료 상태 로그',
      purpose: 'CRM 효율, 응답률, 전환율, 메시지 운영 병목 확인',
      method: 'CRM 연동',
      cycle: '실시간 저장 / 수동 갱신',
      lastCollectedAt: outreach.length ? nowText : '-',
      nextCollectAt: '이벤트 발생 시',
      status: outreach.length ? '정상' : '미수집',
      sourceLocation: '메시지 > 제안/응답 발송',
      storageLocation: `${storageBase} / outreach`,
      dashboardArea: '대시보드, 메시지, 캠페인 파이프라인',
      metricIds: ['MET-CRM-001', 'MET-CRM-002', 'MET-CRM-003', 'MET-CRM-004', 'MET-CRM-005'],
      ownerDept: '운영팀',
      opsOwner: 'Campaign Operator',
      techOwner: 'Backend/Data',
      qualityIssue: outreach.length ? '중복 발송, 수신 거부, 채널 누락 점검 필요' : '발송 이력이 없어 지표 계산 불가',
      logLocation: 'browser local log / future: outreach_events',
      note: `${outreach.length}건 메시지 레코드`,
      active: true,
    },
    {
      id: 'RAW-INT-INF-001',
      name: '인플루언서 리스트 데이터',
      scope: '내부',
      category: '크리에이터 풀',
      description: '발굴 후보, 메시지 전 후보 풀, 섭외 완료 풀에 저장된 크리에이터 프로필',
      purpose: '후보 품질, 풀 규모, 카테고리/등급별 분포 확인',
      method: 'DB 연동',
      cycle: '저장/삭제/수정 시',
      lastCollectedAt: creators.length ? nowText : '-',
      nextCollectAt: '이벤트 발생 시',
      status: creators.length ? '정상' : '미수집',
      sourceLocation: '발굴, 메시지 전 후보 풀, 캠페인 섭외 완료 풀',
      storageLocation: `${storageBase} / creators, recruitedPool`,
      dashboardArea: '대시보드, 발굴, 캠페인, 메시지',
      metricIds: ['MET-POOL-001', 'MET-POOL-002', 'MET-POOL-003', 'MET-POOL-004', 'MET-POOL-005'],
      ownerDept: '운영팀',
      opsOwner: 'Creator Manager',
      techOwner: 'Frontend/Data',
      qualityIssue: '팔로워/평균조회/참여율 누락, 국가 추정 오류, 중복 핸들',
      logLocation: 'future: creator_profile_snapshots',
      note: `${creators.length}명 / 섭외 완료 ${recruitedPool.length}명`,
      active: true,
    },
    {
      id: 'RAW-INT-CMP-001',
      name: '캠페인/성과 보고서 자료',
      scope: '내부',
      category: '캠페인 운영',
      description: '캠페인 브리프, 목표 KPI, 일정, 업로드 링크, 성과 보고서 생성 기록',
      purpose: '캠페인 진행률, 리포트 생성률, 리드타임 계산',
      method: 'DB 연동',
      cycle: '캠페인 수정/리포트 생성 시',
      lastCollectedAt: campaigns.length ? nowText : '-',
      nextCollectAt: '이벤트 발생 시',
      status: campaigns.length ? '정상' : '미수집',
      sourceLocation: '캠페인 상세, 리포트 > 콘텐츠 추적 등록',
      storageLocation: `${storageBase} / campaigns, trackedPosts`,
      dashboardArea: '캠페인, 리포트, 고객사 보고서',
      metricIds: ['MET-CMP-001', 'MET-CMP-002', 'MET-CMP-003', 'MET-CMP-004'],
      ownerDept: 'PM/운영팀',
      opsOwner: 'Campaign PM',
      techOwner: 'Frontend/Data',
      qualityIssue: trackedPosts.length ? '업로드 링크별 플랫폼 매칭 확인 필요' : '추적 콘텐츠가 없어 성과 지표 공백',
      logLocation: 'future: campaign_audit_logs',
      note: `${campaigns.length}개 캠페인 / 추적 콘텐츠 ${trackedPosts.length}건`,
      active: true,
    },
    {
      id: 'RAW-INT-FIN-001',
      name: '계약/정산 관련 내부 데이터',
      scope: '내부',
      category: '계약/정산',
      description: '견적, 계약 상태, 배송, 계좌, 수동 정산 상태',
      purpose: '계약 완료율, 정산 완료율, 미정산 건수, 리드타임 계산',
      method: '수동 업로드',
      cycle: '운영자 입력 시',
      lastCollectedAt: fulfillmentRecords.length ? nowText : '-',
      nextCollectAt: '운영자 입력 시',
      status: fulfillmentRecords.length ? '정상' : '미수집',
      sourceLocation: '캠페인 상세 > 배송/정산 수동 관리',
      storageLocation: `${storageBase} / quotes, fulfillmentRecords`,
      dashboardArea: '캠페인, 내부 운영 리포트',
      metricIds: ['MET-FIN-001', 'MET-FIN-002', 'MET-FIN-003', 'MET-FIN-004'],
      ownerDept: '운영/재무',
      opsOwner: 'Ops Finance',
      techOwner: 'Frontend/Data',
      qualityIssue: '개인정보/계좌정보 접근 권한, 정산 상태 누락',
      logLocation: 'future: settlement_change_logs',
      note: `${fulfillmentRecords.length}건 배송/정산 레코드`,
      active: true,
    },
    {
      id: 'RAW-INT-BRD-001',
      name: '고객사/브랜드 운영 데이터',
      scope: '내부',
      category: '브랜드/고객사',
      description: '브랜드, 제품/서비스, 타깃 페르소나, 금지 키워드, 학습자료',
      purpose: 'AI 추천, 메시지 생성, 가이드 생성의 기준 데이터',
      method: 'DB 연동',
      cycle: '브랜드/캠페인 수정 시',
      lastCollectedAt: brands.length ? nowText : '-',
      nextCollectAt: '이벤트 발생 시',
      status: brands.length ? '정상' : '미수집',
      sourceLocation: '브랜드 설정, 캠페인 생성/수정',
      storageLocation: `${storageBase} / brands, brand.brief`,
      dashboardArea: '대시보드, 캠페인, 발굴, 메시지',
      metricIds: ['MET-CMP-001', 'MET-POOL-003'],
      ownerDept: 'CS/PM',
      opsOwner: 'Brand Manager',
      techOwner: 'Frontend/Data',
      qualityIssue: '브리프 부족 시 AI 추천 품질 저하',
      logLocation: 'future: brand_brief_versions',
      note: `${activeBrand?.name ?? '선택 브랜드'} 기준`,
      active: true,
    },
    {
      id: 'RAW-INT-OPS-001',
      name: '기타 내부 운영 데이터',
      scope: '내부',
      category: '운영 로그',
      description: '운영 메모, 데이터 품질 이슈, 권한/팀 계정, 변경 이력',
      purpose: 'CS 추적, 담당자 지정, 권한별 접근 제어',
      method: 'DB 연동',
      cycle: '이벤트 발생 시',
      lastCollectedAt: nowText,
      nextCollectAt: '이벤트 발생 시',
      status: '정상',
      sourceLocation: '설정, 어드민 데이터룸',
      storageLocation: `${storageBase} / team, accounts, auditLog`,
      dashboardArea: '설정, 어드민 데이터룸',
      metricIds: [],
      ownerDept: '운영/개발',
      opsOwner: 'Admin',
      techOwner: 'Engineering',
      qualityIssue: '운영 메모 표준화 필요',
      logLocation: 'future: admin_activity_logs',
      note: '권한 관리와 데이터 변경 이력의 원천',
      active: true,
    },
    {
      id: 'RAW-EXT-CHN-001',
      name: '외부 채널 데이터',
      scope: '외부',
      category: 'SNS 채널',
      description: 'YouTube/Instagram/TikTok 공개 프로필, 채널 URL, 핸들, 팔로워',
      purpose: '채널별 후보 발굴, 데이터 품질 점수, 채널 성과 비교',
      method: 'API / 크롤링',
      cycle: '검색 시 / 매일 재검증',
      lastCollectedAt: creators.some((creator) => creator.sourceNote) ? nowText : '-',
      nextCollectAt: nextDaily,
      status: creators.some((creator) => creator.sourceNote) ? '정상' : '지연',
      sourceLocation: 'YouTube Data API, Brave Search, public profile snapshot',
      storageLocation: `${storageBase} / creators.metricSources`,
      dashboardArea: '발굴, 메시지 전 후보 풀, 데이터 품질 배지',
      metricIds: ['MET-POOL-001', 'MET-SNS-006', 'MET-CONT-003'],
      ownerDept: '데이터팀',
      opsOwner: 'Data Operator',
      techOwner: 'API/Data',
      qualityIssue: 'Instagram/TikTok 공식 검색 API 제한으로 수집 신뢰도 차등 적용',
      logLocation: 'server logs / future: profile_snapshot_jobs',
      note: 'YouTube는 공식 API, TikTok/Instagram은 보조 수집',
      active: true,
    },
    {
      id: 'RAW-EXT-SNS-001',
      name: 'SNS 채널 수집 데이터',
      scope: '외부',
      category: 'SNS API',
      description: 'YouTube 채널/영상 API, TikTok public mirror, Instagram render snapshot',
      purpose: '팔로워, 평균 조회수, 최근 콘텐츠 기준 검증',
      method: 'API',
      cycle: '검색 시 / 콘텐츠 등록 시',
      lastCollectedAt: nowText,
      nextCollectAt: nextDaily,
      status: '정상',
      sourceLocation: 'server/index.js profile-snapshot endpoints',
      storageLocation: `${storageBase} / publicSnapshotStatus, metricSources`,
      dashboardArea: '발굴, 리포트, 어드민 데이터룸',
      metricIds: ['MET-SNS-001', 'MET-CONT-001', 'MET-CONT-002'],
      ownerDept: '데이터팀',
      opsOwner: 'Data QA',
      techOwner: 'Backend',
      qualityIssue: '외부 페이지 구조 변경, 렌더링 실패, quota 초과',
      logLocation: 'Render service logs / profile-snapshot',
      note: 'Browserless 토큰 연결 시 Instagram reels 품질 개선',
      active: true,
    },
    {
      id: 'RAW-EXT-CONT-001',
      name: '콘텐츠 조회수',
      scope: '외부',
      category: '콘텐츠 성과',
      description: '업로드 링크별 조회수, 최근 갱신 시각, 플랫폼별 수집 상태',
      purpose: '콘텐츠 성과, 성장률, KPI 달성률 계산',
      method: 'API / 크롤링 / 수동 업로드',
      cycle: '매일 자동 / 새로고침 즉시',
      lastCollectedAt: trackedPosts.length ? nowText : '-',
      nextCollectAt: nextDaily,
      status: externalSnapshotStatus,
      sourceLocation: 'YouTube videos.list, public content snapshot, 수동 입력',
      storageLocation: `${storageBase} / trackedPosts.views`,
      dashboardArea: '리포트, 고객사 리포트, 캠페인 KPI',
      metricIds: ['MET-SNS-001', 'MET-CONT-001', 'MET-CONT-004'],
      ownerDept: '데이터팀',
      opsOwner: 'Report Operator',
      techOwner: 'Backend/Data',
      qualityIssue: trackedPosts.length ? '플랫폼별 갱신 주기 차이' : '업로드 링크 미등록',
      logLocation: 'server logs / tracking refresh',
      note: `${trackedPosts.length}건 콘텐츠 추적`,
      active: true,
    },
    {
      id: 'RAW-EXT-ENG-001',
      name: '좋아요/댓글/공유/저장 반응지표',
      scope: '외부',
      category: '콘텐츠 반응',
      description: '콘텐츠별 좋아요, 댓글, 공유, 저장, 전환 수치',
      purpose: '참여율, 반응률, 이상치 탐지, 고객사 리포트',
      method: 'API / 크롤링 / 수동 업로드',
      cycle: '매일 자동 / 새로고침 즉시',
      lastCollectedAt: trackedPosts.length ? nowText : '-',
      nextCollectAt: nextDaily,
      status: trackedPosts.some((post) => Number(post.likes || post.comments || post.shares || post.saves) > 0) ? '정상' : '지연',
      sourceLocation: 'SNS API/public snapshot/수동 입력',
      storageLocation: `${storageBase} / trackedPosts.likes, comments, shares, saves`,
      dashboardArea: '리포트, 콘텐츠 성과 상세',
      metricIds: ['MET-SNS-002', 'MET-SNS-003', 'MET-SNS-004', 'MET-SNS-005', 'MET-SNS-006'],
      ownerDept: '데이터팀',
      opsOwner: 'Report Operator',
      techOwner: 'Backend/Data',
      qualityIssue: 'Instagram/TikTok 저장 수는 공개 수집이 제한될 수 있음',
      logLocation: 'server logs / tracking refresh',
      note: `좋아요 ${compactNumber(trackedPosts.reduce((sum, post) => sum + Number(post.likes || 0), 0))}`,
      active: true,
    },
    {
      id: 'RAW-EXT-REF-001',
      name: '레퍼런스 콘텐츠 수집 지표',
      scope: '외부',
      category: '레퍼런스',
      description: '인기 영상/이미지 레퍼런스 URL, 썸네일, 조회수, 반응, 적용 메모',
      purpose: '제작 가이드, 후킹포인트, 변형 스크립트 생성',
      method: 'API / 크롤링',
      cycle: '검색 시 / 저장 시',
      lastCollectedAt: contentReferences.length ? nowText : '-',
      nextCollectAt: '검색 요청 시',
      status: contentReferences.length ? '정상' : '미수집',
      sourceLocation: 'YouTube Data API, Brave Search, public snapshot',
      storageLocation: `${storageBase} / contentReferences`,
      dashboardArea: '레퍼런스, 캠페인 가이드 생성',
      metricIds: ['MET-BENCH-001', 'MET-BENCH-002', 'MET-BENCH-003'],
      ownerDept: '콘텐츠팀',
      opsOwner: 'Creative Planner',
      techOwner: 'Backend/Data',
      qualityIssue: '무관 콘텐츠, 낮은 조회수, 깨진 썸네일 제외 규칙 필요',
      logLocation: 'server logs / references/search',
      note: `${contentReferences.length}개 저장 레퍼런스`,
      active: true,
    },
    {
      id: 'RAW-EXT-BENCH-001',
      name: '경쟁/벤치마크 콘텐츠 데이터',
      scope: '외부',
      category: '벤치마크',
      description: '경쟁 콘텐츠, 카테고리 평균 조회수, 벤치마크 반응률',
      purpose: '경쟁 콘텐츠 대비 성과지수, 카테고리별 평균 반응률',
      method: 'API / 크롤링 / 수동 업로드',
      cycle: '주 1회 / 캠페인 생성 시',
      lastCollectedAt: contentReferences.length ? nowText : '-',
      nextCollectAt: '매주 월요일 09:00',
      status: contentReferences.length ? '검증 필요' : '미수집',
      sourceLocation: '레퍼런스 검색, 경쟁사 URL, 외부 공개 콘텐츠',
      storageLocation: `${storageBase} / benchmarkSnapshots`,
      dashboardArea: '레퍼런스, 리포트, 전략 생성',
      metricIds: ['MET-BENCH-002', 'MET-BENCH-003', 'MET-BENCH-004'],
      ownerDept: '전략/데이터',
      opsOwner: 'Strategist',
      techOwner: 'Data Engineer',
      qualityIssue: '경쟁 콘텐츠 카테고리 태깅과 국가 판별 검증 필요',
      logLocation: 'future: benchmark_collection_jobs',
      note: '벤치마크 파이프라인 확장 대상',
      active: false,
    },
  ]
}

function buildAdminMetricCatalog({ rawData, outreach, creators, campaigns, recruitedPool, fulfillmentRecords, trackedPosts, contentReferences }) {
  const rawName = (id) => rawData.find((item) => item.id === id)?.name ?? id
  const nowText = new Date().toLocaleString('ko-KR')
  const rawRefs = {
    crm: ['RAW-INT-CRM-001'],
    pool: ['RAW-INT-INF-001', 'RAW-EXT-CHN-001'],
    campaign: ['RAW-INT-CMP-001', 'RAW-INT-BRD-001'],
    finance: ['RAW-INT-FIN-001'],
    sns: ['RAW-EXT-CONT-001', 'RAW-EXT-ENG-001'],
    reference: ['RAW-EXT-REF-001', 'RAW-EXT-BENCH-001'],
  }
  const rows = [
    ['MET-CRM-001', '발송 수', 'CRM 효율 번들', '내부', '발송 완료 상태의 메시지 수', 'count(outreach.status = 발송 완료 or 응답)', rawRefs.crm, '최근 30일', '실시간', '정상', '어드민 대시보드, 메시지', '증가 추세가 정상이나 중복 발송은 별도 경고', '동일 creator/campaign/channel 2회 이상', '높음', '운영팀', 'outreach_events / Gmail send logs', `${outreach.length}건`],
    ['MET-CRM-002', '오픈율', 'CRM 효율 번들', '내부', '이메일 오픈 수 / 발송 수', 'opened_count / sent_count * 100', rawRefs.crm, '최근 30일', '일 1회', '검증 필요', '내부 보고서', 'Gmail/메일 추적 픽셀 연동 전까지 검증 필요', '0% 또는 90% 이상', '중간', '운영/개발', 'mail_tracking_events', '이메일 추적 연동 후 활성'],
    ['MET-CRM-003', '클릭률', 'CRM 효율 번들', '내부', '링크 클릭 수 / 발송 수', 'clicked_count / sent_count * 100', rawRefs.crm, '최근 30일', '일 1회', '검증 필요', '내부 보고서', '링크 리다이렉트/UTM 연동 필요', '0% 장기 지속', '중간', '마케팅Ops', 'link_click_events', 'UTM 링크 생성 기능 필요'],
    ['MET-CRM-004', '응답률', 'CRM 효율 번들', '내부', '응답 상태 메시지 수 / 발송 수', 'response_count / sent_count * 100', rawRefs.crm, '최근 30일', '실시간', '정상', '대시보드, 메시지', '채널별로 분리 해석', '평균 대비 50% 이하', '높음', '운영팀', 'outreach.status history', `${outreach.filter((item) => item.status === '응답').length}건 응답`],
    ['MET-CRM-005', '전환율', 'CRM 효율 번들', '내부', '섭외 완료 수 / 제안 발송 수', 'recruited_count / sent_count * 100', ['RAW-INT-CRM-001', 'RAW-INT-INF-001'], '캠페인 기간', '실시간', '정상', '대시보드, 캠페인', '캠페인 난이도와 보상 조건에 따라 해석', '10% 미만', '높음', '운영팀', 'recruitedPool + outreach', `${recruitedPool.length}명 섭외 완료`],
    ['MET-POOL-001', '전체 인플루언서 수', '인플루언서 풀 관리 번들', '내부', '저장된 전체 크리에이터 수', 'count(creators)', rawRefs.pool, '전체', '실시간', '정상', '발굴, 데이터룸', '중복 제거 전후 수를 함께 확인', '전일 대비 -30% 이상', '높음', '데이터팀', 'creators table', `${creators.length}명`],
    ['MET-POOL-002', '활성 인플루언서 수', '인플루언서 풀 관리 번들', '내부', '상태가 활성/검증 가능인 크리에이터 수', 'count(creators where active and not blocked)', rawRefs.pool, '전체', '실시간', '정상', '발굴, 메시지', '프로필 링크 접근 가능 여부 포함', '활성 비율 50% 이하', '중간', '운영팀', 'creator status logs', '향후 active flag 분리'],
    ['MET-POOL-003', '카테고리별 인플루언서 수', '인플루언서 풀 관리 번들', '내부', '카테고리 그룹별 크리에이터 분포', 'groupBy(creators.category).count', rawRefs.pool, '전체', '실시간', '정상', '발굴, 전략', '브랜드 카테고리와 후보군 균형 확인', '기타 카테고리 40% 이상', '중간', '운영팀', 'creator category map', '카테고리 표준화 필요'],
    ['MET-POOL-004', '등급별 인플루언서 수', '인플루언서 풀 관리 번들', '내부', 'fit/data quality 점수 기준 등급별 수', 'groupBy(score_band(fit, dataQuality)).count', rawRefs.pool, '전체', '실시간', '정상', '발굴, 대시보드', 'A/B/C 등급별 섭외 우선순위', 'A등급 0건', '중간', '데이터팀', 'creator scoring logs', '등급 정책 확정 필요'],
    ['MET-POOL-005', '최근 업데이트 인플루언서 수', '인플루언서 풀 관리 번들', '내부', '최근 7일 내 수정/수집된 크리에이터 수', 'count(creators.updatedAt >= now-7d)', rawRefs.pool, '최근 7일', '일 1회', '검증 필요', '데이터룸', '수집 활동량 지표', '0건 7일 이상', '중간', '데이터팀', 'creator snapshots', 'updatedAt 도입 필요'],
    ['MET-CMP-001', '섭외 진행률', '캠페인 운영 번들', '내부', '섭외 완료 수 / 목표 인원 수', 'recruited_count / campaign.recommendationTargetCount * 100', ['RAW-INT-CMP-001', 'RAW-INT-INF-001'], '캠페인 기간', '실시간', '정상', '캠페인, 대시보드', '목표 인원 미설정 시 해석 제한', '마감 3일 전 50% 미만', '높음', 'PM/운영', 'campaign + recruitedPool', `${campaigns.length}개 캠페인`],
    ['MET-CMP-002', '콘텐츠 업로드 완료율', '캠페인 운영 번들', '내부', '업로드 완료 콘텐츠 수 / 섭외 완료 수', 'uploaded_content_count / recruited_count * 100', ['RAW-INT-CMP-001', 'RAW-EXT-CONT-001'], '캠페인 기간', '일 1회', trackedPosts.length ? '정상' : '지연', '리포트, 캠페인', '업로드 링크 미등록 시 낮게 표시', '업로드 마감 후 80% 미만', '높음', '운영팀', 'trackedPosts status', `${trackedPosts.length}건 콘텐츠`],
    ['MET-CMP-003', '보고서 생성률', '캠페인 운영 번들', '내부', '보고서 생성 캠페인 수 / 전체 캠페인 수', 'report_generated_campaigns / campaigns * 100', rawRefs.campaign, '월간', '일 1회', '정상', '리포트', '완료 캠페인 기준으로 해석', '완료 캠페인 중 0건', '중간', 'PM', 'report export logs', 'export log 테이블 필요'],
    ['MET-CMP-004', '캠페인별 운영 리드타임', '캠페인 운영 번들', '내부', '모집 시작일부터 보고 완료일까지 일수', 'dateDiff(reportDoneAt, recruitingStartAt)', rawRefs.campaign, '캠페인 기간', '일 1회', '검증 필요', '내부 보고서', '일정 필드 입력률 확인 필요', '목표 대비 +30% 초과', '중간', 'PM', 'campaign schedule fields', '스케줄 필드 정규화 필요'],
    ['MET-FIN-001', '계약 완료율', '계약/정산 번들', '내부', '계약 완료 건수 / 섭외 완료 건수', 'contract_done / recruited_count * 100', ['RAW-INT-FIN-001', 'RAW-INT-INF-001'], '캠페인 기간', '실시간', '검증 필요', '내부 보고서', '계약 상태 입력 표준화 필요', '70% 미만', '중간', '운영/재무', 'quote + contract status', '계약 모듈 확장 예정'],
    ['MET-FIN-002', '정산 완료율', '계약/정산 번들', '내부', '정산 완료 건수 / 지급 대상 건수', 'settlement_done / settlement_target * 100', rawRefs.finance, '월간', '실시간', '정상', '캠페인 내부', '자동정산 제외, 수동정산 기준', '마감 후 90% 미만', '높음', '재무/운영', 'fulfillmentRecords', `${fulfillmentRecords.length}건`],
    ['MET-FIN-003', '미정산 건수', '계약/정산 번들', '내부', '정산 완료가 아닌 지급 대상 건수', 'count(paymentStatus != done)', rawRefs.finance, '월간', '실시간', '정상', '내부 보고서', '금액과 함께 봐야 함', '10건 이상', '높음', '재무', 'fulfillmentRecords', '개인정보 접근 제한 필요'],
    ['MET-FIN-004', '평균 정산 리드타임', '계약/정산 번들', '내부', '업로드 완료일부터 정산 완료일까지 평균 일수', 'avg(dateDiff(settlementDoneAt, uploadDoneAt))', rawRefs.finance, '월간', '일 1회', '검증 필요', '내부 보고서', '날짜 입력 누락 시 왜곡', '14일 초과', '중간', '재무/운영', 'settlement date logs', '날짜 필드 도입 필요'],
    ['MET-SNS-001', '조회수', 'SNS 반응 번들', '외부', '콘텐츠별 공개 조회수', 'sum(trackedPosts.views)', rawRefs.sns, '캠페인 기간', '매일/즉시', trackedPosts.length ? '정상' : '지연', '리포트, 고객사 리포트', '플랫폼별 수집 신뢰도 구분', '전일 대비 -20% 감소', '중간', '데이터팀', 'tracking refresh logs', `${compactNumber(trackedPosts.reduce((sum, post) => sum + Number(post.views || 0), 0))} 조회`],
    ['MET-SNS-002', '좋아요 수', 'SNS 반응 번들', '외부', '콘텐츠별 좋아요 합계', 'sum(trackedPosts.likes)', rawRefs.sns, '캠페인 기간', '매일/즉시', '정상', '리포트', '플랫폼별 숨김 정책 고려', '조회수 대비 0.1% 미만', '중간', '데이터팀', 'tracking refresh logs', '수동 입력 허용'],
    ['MET-SNS-003', '댓글 수', 'SNS 반응 번들', '외부', '콘텐츠별 댓글 합계', 'sum(trackedPosts.comments)', rawRefs.sns, '캠페인 기간', '매일/즉시', '정상', '리포트', '댓글 유도형 콘텐츠와 구분', '0건 지속', '중간', '데이터팀', 'tracking refresh logs', '댓글 품질 분석은 후속'],
    ['MET-SNS-004', '공유 수', 'SNS 반응 번들', '외부', '콘텐츠별 공유 합계', 'sum(trackedPosts.shares)', rawRefs.sns, '캠페인 기간', '매일/즉시', '검증 필요', '리포트', '플랫폼별 공개 여부 차이 큼', '0건 장기 지속', '낮음', '데이터팀', 'tracking refresh logs', 'YouTube/Instagram 일부 제한'],
    ['MET-SNS-005', '저장 수', 'SNS 반응 번들', '외부', '콘텐츠별 저장 합계', 'sum(trackedPosts.saves)', rawRefs.sns, '캠페인 기간', '매일/즉시', '검증 필요', '리포트', '대부분 플랫폼에서 공개 제한', '수집 불가', '낮음', '데이터팀', 'tracking refresh logs', '수동 입력 또는 크리에이터 캡처 필요'],
    ['MET-SNS-006', '참여율', 'SNS 반응 번들', '외부', '좋아요+댓글+공유+저장 / 조회수', '(likes+comments+shares+saves)/views*100', rawRefs.sns, '캠페인 기간', '매일/즉시', '정상', '대시보드, 리포트', '조회수 0이면 계산 제외', '20% 초과 또는 0.1% 미만', '중간', '데이터팀', 'metric calculation logs', '이상치 플래그 필요'],
    ['MET-CONT-001', '평균 조회수', '콘텐츠 성과 번들', '외부', '콘텐츠별 조회수 평균', 'avg(trackedPosts.views)', ['RAW-EXT-CONT-001'], '캠페인 기간', '매일/즉시', '정상', '리포트', '게시 후 경과일 함께 확인', '카테고리 평균 대비 -50%', '중간', '데이터팀', 'trackedPosts', '초기 24시간은 별도 표시'],
    ['MET-CONT-002', '콘텐츠별 반응률', '콘텐츠 성과 번들', '외부', '콘텐츠별 참여율', 'engagement / views * 100 by content', rawRefs.sns, '캠페인 기간', '매일/즉시', '정상', '리포트 상세', '소형 계정은 변동성 큼', '평균 대비 3표준편차', '중간', '데이터팀', 'metric calculation logs', '콘텐츠별 이상치 확인'],
    ['MET-CONT-003', '채널별 성과 비교', '콘텐츠 성과 번들', '외부', 'YouTube/Instagram/TikTok별 조회/참여 비교', 'groupBy(platform).sum/views/engagement', ['RAW-EXT-CHN-001', 'RAW-EXT-CONT-001'], '캠페인 기간', '일 1회', '정상', '리포트', '플랫폼별 알고리즘 차이를 감안', '한 채널만 80% 이상 편중', '중간', 'PM/데이터', 'platform group metrics', '채널 믹스 최적화에 사용'],
    ['MET-CONT-004', '콘텐츠 성장률', '콘텐츠 성과 번들', '외부', '전일 대비 조회수 증가율', '(views_today-views_yesterday)/views_yesterday*100', ['RAW-EXT-CONT-001'], '최근 7일', '매일', '검증 필요', '리포트', '일별 스냅샷 저장 후 활성화', '음수 전환', '중간', '데이터팀', 'daily_content_snapshots', '스냅샷 테이블 필요'],
    ['MET-BENCH-001', '레퍼런스 콘텐츠 수', '레퍼런스/벤치마크 번들', '외부', '저장된 제작 레퍼런스 콘텐츠 수', 'count(contentReferences)', ['RAW-EXT-REF-001'], '전체', '실시간', '정상', '레퍼런스', '저장된 레퍼런스만 계산', '0건', '높음', '콘텐츠팀', 'contentReferences', `${contentReferences.length}개`],
    ['MET-BENCH-002', '벤치마크 평균 조회수', '레퍼런스/벤치마크 번들', '외부', '벤치마크 콘텐츠 조회수 평균', 'avg(reference.views)', rawRefs.reference, '최근 30일', '검색/저장 시', contentReferences.length ? '정상' : '지연', '전략, 리포트', '50만 이상 터진 콘텐츠 중심', '평균 5만 미만', '중간', '전략/데이터', 'references/search logs', '검색 품질에 따라 변동'],
    ['MET-BENCH-003', '카테고리별 평균 반응률', '레퍼런스/벤치마크 번들', '외부', '카테고리별 레퍼런스 참여율 평균', 'groupBy(category).avg(engagementRate)', rawRefs.reference, '최근 30일', '주 1회', '검증 필요', '전략, 가이드 생성', '카테고리 태깅 정확도 확인', '태깅 없음 30% 이상', '중간', '전략/데이터', 'benchmark tag logs', '카테고리 태깅 자동화 필요'],
    ['MET-BENCH-004', '경쟁 콘텐츠 대비 성과지수', '레퍼런스/벤치마크 번들', '외부', '우리 콘텐츠 조회/반응을 벤치마크 평균과 비교', '(campaign_score / benchmark_score) * 100', ['RAW-EXT-CONT-001', 'RAW-EXT-ENG-001', 'RAW-EXT-BENCH-001'], '캠페인 기간', '일 1회', '검증 필요', '고객사 리포트', '100 이상이면 벤치마크 상회', '70 미만', '중간', 'PM/데이터', 'benchmark metric logs', '벤치마크 표본 수 표시 필요'],
  ]

  return rows.map(([id, name, bundle, scope, description, formula, rawIds, period, refreshCycle, status, displayLocation, interpretation, outlierRule, reliability, ownerDept, errorLocation, note]) => ({
    id,
    name,
    bundle,
    scope,
    description,
    formula,
    rawIds,
    rawNames: rawIds.map(rawName),
    period,
    refreshCycle,
    lastCalculatedAt: nowText,
    status,
    displayLocation,
    interpretation,
    outlierRule,
    reliability,
    ownerDept,
    errorLocation,
    note,
  }))
}

function buildDataRoomExtendedRawCatalog({ rawData, backendConfig, creators, outreach, contentReferences }) {
  const nowText = new Date().toLocaleString('ko-KR')
  const storageBase = backendConfig?.hasSupabase ? 'Supabase public schema' : 'localStorage creatorops.workspace.v2'
  const apiStatus = backendConfig?.apiBaseUrl ? '정상' : '지연'
  const baseIds = new Set(rawData.map((item) => item.id))
  const append = (items) => [...rawData, ...items.filter((item) => !baseIds.has(item.id))]

  return append([
    {
      id: 'RAW-EXT-SEARCH-001',
      name: '외부 검색 원본 결과',
      scope: '외부',
      category: '검색 원천',
      description: 'YouTube, Google/Brave, TikTok Commercial Content API 검색 요청과 원본 응답',
      purpose: '발굴/레퍼런스 결과가 어떤 검색어, 국가, 플랫폼, 페이지에서 나왔는지 추적',
      method: 'API / 검색 연동',
      cycle: '검색 요청 시',
      lastCollectedAt: nowText,
      nextCollectAt: '검색 요청 시',
      status: apiStatus,
      sourceLocation: 'server /discovery/*, /references/search',
      storageLocation: `${storageBase} / future: external_search_events`,
      dashboardArea: '발굴, 레퍼런스, 데이터룸 수집 로그',
      metricIds: ['MET-OPS-001', 'MET-AI-003', 'MET-BENCH-001'],
      ownerDept: '데이터팀',
      opsOwner: 'Data Operator',
      techOwner: 'Backend/Data',
      qualityIssue: '검색 API가 요약 결과만 주는 경우 원문 페이지/노출 순위 보존 필요',
      logLocation: 'Render API logs / future: external_search_events',
      note: '키워드별 수동 검수가 아니라 검색 원본을 저장해 재현 가능성을 확보',
      active: true,
    },
    {
      id: 'RAW-INT-AI-001',
      name: 'AI 생성 실행 로그',
      scope: '내부',
      category: 'AI 생성',
      description: 'AI 추천, 전략, 제안 메시지, 콘텐츠 가이드 생성 입력값/출력값/모델/버전',
      purpose: 'AI가 어떤 raw 데이터 조합으로 추천/메시지/가이드를 만들었는지 설명 가능하게 저장',
      method: 'API / DB 연동',
      cycle: 'AI 실행 시',
      lastCollectedAt: nowText,
      nextCollectAt: 'AI 실행 시',
      status: backendConfig?.apiBaseUrl ? '검증 필요' : '지연',
      sourceLocation: 'OpenAI API, local scoring engine',
      storageLocation: `${storageBase} / future: ai_generation_runs`,
      dashboardArea: 'AI 추천, 메시지, 캠페인 전략, 가이드 생성',
      metricIds: ['MET-AI-001', 'MET-AI-002', 'MET-AI-003', 'MET-GUIDE-001'],
      ownerDept: 'PM/데이터',
      opsOwner: 'PM',
      techOwner: 'AI/Data',
      qualityIssue: '프롬프트 버전과 사용 raw 데이터 ID를 함께 저장해야 재현 가능',
      logLocation: 'server logs / future: ai_generation_runs',
      note: `${outreach.length}건 메시지와 ${creators.length}명 후보를 AI 입력으로 사용 가능`,
      active: true,
    },
    {
      id: 'RAW-INT-EXPORT-001',
      name: '내보내기/다운로드 로그',
      scope: '내부',
      category: '내보내기',
      description: '엑셀, Google Sheets, DOCX, PPT, 보고서 다운로드 실행 이력',
      purpose: '광고주 전달본과 내부 데이터 버전을 연결하고 고객사 전달 이력을 추적',
      method: '프론트 이벤트 / DB 연동',
      cycle: '내보내기 실행 시',
      lastCollectedAt: nowText,
      nextCollectAt: '내보내기 실행 시',
      status: '검증 필요',
      sourceLocation: 'export handlers, Google Sheets/Docs export flow',
      storageLocation: `${storageBase} / future: export_events`,
      dashboardArea: '발굴, AI 추천, 리포트, 캠페인 가이드',
      metricIds: ['MET-EXPORT-001'],
      ownerDept: '운영/CS',
      opsOwner: 'Campaign Operator',
      techOwner: 'Frontend/Data',
      qualityIssue: '현재는 파일 생성 중심이라 다운로드 결과와 버전 로그 테이블 필요',
      logLocation: 'browser local log / future: export_events',
      note: '광고주 전달 리스트와 리포트 산출물의 원천 버전을 남기는 번들',
      active: true,
    },
    {
      id: 'RAW-INT-AUTH-001',
      name: '팀 계정/권한 데이터',
      scope: '내부',
      category: '권한/계정',
      description: '팀, 계정, 역할, 브랜드/캠페인 접근 권한, 초대 상태',
      purpose: '같은 팀이 같은 풀을 보고 Google Ads처럼 관리 권한을 부여',
      method: 'Auth / DB 연동',
      cycle: '권한 변경 시',
      lastCollectedAt: nowText,
      nextCollectAt: '권한 변경 시',
      status: backendConfig?.hasSupabase ? '정상' : '지연',
      sourceLocation: 'Supabase Auth, Settings > 팀 권한',
      storageLocation: `${storageBase} / workspaces, workspace_members`,
      dashboardArea: '설정, 데이터룸, 전체 메뉴 접근 제어',
      metricIds: ['MET-AUTH-001'],
      ownerDept: '운영/개발',
      opsOwner: 'Admin',
      techOwner: 'Backend/Auth',
      qualityIssue: '초대/역할 변경 감사 로그와 캠페인 단위 권한 분리 필요',
      logLocation: 'Supabase auth logs / future: permission_audit_logs',
      note: '프론트 접근 가능 섹션과 데이터 접근 권한의 기준 데이터',
      active: true,
    },
    {
      id: 'RAW-INT-QUALITY-001',
      name: '데이터 품질 판정 로그',
      scope: '내부',
      category: '데이터 품질',
      description: '운영 가능, 검증 대기, 보류 권장, 중복/국가/팔로워/조회수 필터 판정 사유',
      purpose: '후보와 레퍼런스가 왜 노출/제외됐는지 운영자가 추적',
      method: '계산 엔진 / DB 연동',
      cycle: '수집/매칭/필터 실행 시',
      lastCollectedAt: nowText,
      nextCollectAt: '수집/매칭/필터 실행 시',
      status: '검증 필요',
      sourceLocation: 'creator scoring, reference filter, country/platform validation',
      storageLocation: `${storageBase} / future: data_quality_reviews`,
      dashboardArea: '발굴, AI 추천, 레퍼런스, 데이터룸',
      metricIds: ['MET-AI-002', 'MET-OPS-002'],
      ownerDept: '데이터팀',
      opsOwner: 'Data QA',
      techOwner: 'Data Engineer',
      qualityIssue: '국가 추정, 팔로워 미수집, 낮은 조회수 레퍼런스 제외 기준을 로그로 남겨야 함',
      logLocation: 'future: data_quality_reviews',
      note: '모든 키워드를 사람이 검수하지 않기 위한 자동 판정 근거 저장소',
      active: true,
    },
    {
      id: 'RAW-EXT-UNSUPPORTED-001',
      name: '미지원/부분지원 플랫폼 지표 보류 번들',
      scope: '외부',
      category: '플랫폼 제한',
      description: 'Instagram/TikTok 저장, 공유, 정확한 팔로워/조회수 등 공식 권한 없이는 제한되는 지표',
      purpose: '데이터룸에 없는 지표가 프론트에서 임의로 보이지 않도록 보류/대체 수집 상태를 명시',
      method: '인증 인사이트 / 수동 업로드 / 대체 공개 지표',
      cycle: '권한 확보 또는 수동 업로드 시',
      lastCollectedAt: '-',
      nextCollectAt: '권한 확보 후',
      status: '부분지원',
      sourceLocation: 'Instagram Graph API, TikTok Research/Commercial API, creator screenshot',
      storageLocation: `${storageBase} / future: unsupported_metric_requests`,
      dashboardArea: '발굴, 레퍼런스, 리포트',
      metricIds: ['MET-OPS-002', 'MET-SNS-004', 'MET-SNS-005'],
      ownerDept: '데이터/PM',
      opsOwner: 'PM',
      techOwner: 'Backend/Data',
      qualityIssue: '공개 검색만으로는 정확 수치가 보장되지 않으므로 UI에는 수집 필요/검증 필요로 표시',
      logLocation: 'future: unsupported_metric_requests',
      note: '데이터 구현 전에는 기능을 과장하지 않고 보류 번들에서 관리',
      active: true,
    },
  ])
}

function buildDataRoomExtendedMetricCatalog({ metrics, rawData, creators, contentReferences }) {
  const rawName = (id) => rawData.find((item) => item.id === id)?.name ?? id
  const nowText = new Date().toLocaleString('ko-KR')
  const rows = [
    ['MET-AI-001', '브랜드-크리에이터 적합도', 'AI 매칭/가치생성 번들', '내부', '브랜드 브리프와 후보 프로필/성과를 조합한 매칭 점수', 'weighted(brand_keywords, category_fit, avg_views, engagement, risk)', ['RAW-INT-BRD-001', 'RAW-INT-INF-001', 'RAW-EXT-CHN-001', 'RAW-INT-QUALITY-001'], '캠페인 기준', '후보 갱신 시', '정상', '발굴, AI 추천', '80점 이상 우선 제안, 60점 미만 보류', '데이터 품질 50점 미만', '중간', 'PM/데이터', 'ai_generation_runs + data_quality_reviews', `${creators.length}명 후보 기준`],
    ['MET-AI-002', '데이터 품질 점수', 'AI 매칭/가치생성 번들', '내부', '공식 API 여부, 최신성, 국가/플랫폼 일치, 팔로워/조회수 확인 여부', 'official_source*35 + freshness*20 + metric_completeness*25 + country_match*20', ['RAW-INT-QUALITY-001', 'RAW-EXT-SEARCH-001', 'RAW-EXT-UNSUPPORTED-001'], '검색/저장 시', '실시간', '검증 필요', '발굴, 레퍼런스, 데이터룸', '80점 이상 운영 가능, 60점 이하는 보류 권장', '팔로워 미수집+국가 불일치', '중간', '데이터팀', 'data_quality_reviews', '키워드별 수동 검수 대체 지표'],
    ['MET-AI-003', '후보 우선순위 점수', 'AI 매칭/가치생성 번들', '내부', '조회수 성장성, 팔로워 대비 터진 콘텐츠, 브랜드 적합도, 연락 가능성 결합', 'fit_score*0.35 + virality_score*0.3 + engagement_score*0.2 + contactability*0.15', ['RAW-INT-INF-001', 'RAW-EXT-SEARCH-001', 'RAW-EXT-CHN-001', 'RAW-INT-AI-001'], '캠페인 기준', '후보 매칭 시', '정상', 'AI 추천, 메시지 전 후보 풀', '상위 점수부터 메시지 후보로 전환', '연락처 없음+데이터 품질 낮음', '중간', 'PM/데이터', 'creator scoring logs', '팔로워보다 조회수/터진 콘텐츠 우선 전략 반영'],
    ['MET-GUIDE-001', '레퍼런스 변형 가이드 생성률', '콘텐츠 가이드 번들', '내부', '저장 레퍼런스가 캠페인 가이드/스크립트로 전환된 비율', 'guide_reference_count / saved_reference_count * 100', ['RAW-EXT-REF-001', 'RAW-INT-AI-001'], '캠페인 기준', '가이드 생성 시', '검증 필요', '캠페인 상세, 레퍼런스', '저장만 하고 가이드 반영이 안 되면 운영 누락', '저장 레퍼런스 5개 이상인데 0%', '중간', '콘텐츠팀', 'ai_generation_runs / content_guides', `${contentReferences.length}개 레퍼런스`],
    ['MET-OPS-001', '외부 수집 성공률', '데이터 운영 번들', '외부', '외부 검색/API 요청 중 성공한 요청 비율', 'successful_collection_jobs / total_collection_jobs * 100', ['RAW-EXT-SEARCH-001'], '최근 24시간', '실시간', '검증 필요', '데이터룸, 설정 API 테스트', '95% 이상 정상, 80% 미만 장애 검토', '연속 3회 실패', '중간', '데이터/개발', 'Render API logs', '수집 로그 테이블 연결 필요'],
    ['MET-OPS-002', '미지원 데이터 비율', '데이터 운영 번들', '외부', '프론트 표시 항목 중 부분지원/미지원 raw에 의존하는 비율', 'unsupported_metric_count / visible_metric_count * 100', ['RAW-EXT-UNSUPPORTED-001', 'RAW-INT-QUALITY-001'], '전체', '일 1회', '검증 필요', '데이터룸, 리포트', '비율이 높을수록 공식 API/OAuth 우선순위 상승', '30% 이상', '중간', 'PM/데이터', 'unsupported_metric_requests', '프론트에는 검증 필요/수집 필요로 표시'],
    ['MET-EXPORT-001', '전달 산출물 생성 수', '내보내기 번들', '내부', '엑셀/시트/문서/리포트로 광고주에게 전달 가능한 산출물 생성 수', 'count(export_events)', ['RAW-INT-EXPORT-001'], '최근 30일', '실시간', '검증 필요', '대시보드, 리포트, 발굴', '클라이언트 전달 이력과 연결', '다운로드 실패 1건 이상', '중간', 'CS/운영', 'export_events', '실제 DB 로그 연결 전까지 브라우저 이벤트 중심'],
    ['MET-AUTH-001', '권한 커버리지', '팀/권한 번들', '내부', '팀 멤버가 접근 가능한 브랜드/캠페인/데이터룸 범위', 'assigned_permission_count / required_permission_count * 100', ['RAW-INT-AUTH-001', 'RAW-INT-OPS-001'], '전체', '권한 변경 시', '정상', '설정, 데이터룸', '팀 단위 풀 공유와 관리권한 기준', 'Owner 없는 워크스페이스', '높음', '운영/개발', 'permission_audit_logs', 'Supabase Auth와 workspace_members 기준'],
  ]

  const existingIds = new Set(metrics.map((item) => item.id))
  const extraMetrics = rows
    .filter(([id]) => !existingIds.has(id))
    .map(([id, name, bundle, scope, description, formula, rawIds, period, refreshCycle, status, displayLocation, interpretation, outlierRule, reliability, ownerDept, errorLocation, note]) => ({
      id,
      name,
      bundle,
      scope,
      description,
      formula,
      rawIds,
      rawNames: rawIds.map(rawName),
      period,
      refreshCycle,
      lastCalculatedAt: nowText,
      status,
      displayLocation,
      interpretation,
      outlierRule,
      reliability,
      ownerDept,
      errorLocation,
      note,
    }))

  return [...metrics, ...extraMetrics]
}

function buildDataRoomWorkflowCoverage({ rawData, metrics }) {
  const rawIds = new Set(rawData.map((item) => item.id))
  const metricIds = new Set(metrics.map((item) => item.id))
  const coverage = [
    ['WF-DASHBOARD', '대시보드 운영 현황', '대시보드', ['RAW-INT-CRM-001', 'RAW-INT-INF-001', 'RAW-INT-CMP-001', 'RAW-EXT-CONT-001'], ['MET-CRM-004', 'MET-CMP-001', 'MET-SNS-001'], '캠페인/메시지/콘텐츠 성과를 현재 워크스페이스 기준으로 집계', '프론트 카드 수치는 데이터룸 계산지표 기준으로 표시'],
    ['WF-CAMPAIGN', '캠페인 파이프라인', '캠페인', ['RAW-INT-CMP-001', 'RAW-INT-BRD-001', 'RAW-INT-FIN-001'], ['MET-CMP-001', 'MET-CMP-002', 'MET-CMP-004'], '캠페인 브리프, 일정, 섭외 완료, 배송/정산 레코드를 캠페인 ID로 묶음', '캠페인 없는 배송/정산/후보 풀은 노출하지 않음'],
    ['WF-DISCOVERY', '크리에이터 발굴 검색', '발굴', ['RAW-EXT-SEARCH-001', 'RAW-EXT-CHN-001', 'RAW-INT-QUALITY-001'], ['MET-AI-002', 'MET-AI-003'], '검색 원본 결과를 수집하고 국가/플랫폼/최소 팔로워/평균 조회수 기준으로 품질 판정', '데이터룸에 검색 원천이 없으면 실제 발굴 결과로 쓰지 않음'],
    ['WF-AI-RECOMMEND', 'AI 추천 후보와 근거', '발굴', ['RAW-INT-BRD-001', 'RAW-INT-INF-001', 'RAW-INT-AI-001', 'RAW-INT-QUALITY-001'], ['MET-AI-001', 'MET-AI-002', 'MET-AI-003'], '브랜드 브리프와 후보 성과/품질 점수를 조합해 추천 이유와 리스크 생성', '추천 근거에는 사용 raw ID와 품질 점수가 남아야 함'],
    ['WF-CANDIDATE-POOL', '메시지 전 후보 풀', '발굴/메시지', ['RAW-INT-INF-001', 'RAW-INT-QUALITY-001'], ['MET-POOL-001', 'MET-AI-003'], '저장된 후보만 메시지 전 풀로 이동하고 삭제 시 메시지 대기 리스트와 함께 정리', '풀에 없는 후보는 메시지 일괄 생성 대상이 아님'],
    ['WF-MESSAGE', '제안/응답 발송', '메시지', ['RAW-INT-CRM-001', 'RAW-INT-AI-001', 'RAW-INT-EXPORT-001'], ['MET-CRM-001', 'MET-CRM-004', 'MET-CRM-005'], '이메일 가능 후보는 발송 로그, DM 대상은 작업용 엑셀/복사 로그로 분리', 'DM 우회 자동화는 정책상 raw로 두지 않고 작업 로그만 관리'],
    ['WF-REPORT', '콘텐츠 추적/리포트', '리포트', ['RAW-INT-CMP-001', 'RAW-EXT-CONT-001', 'RAW-EXT-ENG-001', 'RAW-EXT-UNSUPPORTED-001'], ['MET-SNS-001', 'MET-SNS-006', 'MET-CONT-001', 'MET-CONT-004'], '업로드 URL 기준으로 공개 지표를 갱신하고 미지원 지표는 수집 필요로 표시', '데이터룸에 저장되지 않은 수치는 보고서에 확정값으로 표시하지 않음'],
    ['WF-REFERENCE', '콘텐츠 레퍼런스 검색/저장', '레퍼런스', ['RAW-EXT-SEARCH-001', 'RAW-EXT-REF-001', 'RAW-EXT-BENCH-001', 'RAW-INT-QUALITY-001'], ['MET-BENCH-001', 'MET-BENCH-002', 'MET-BENCH-003'], '50만 이상 또는 팔로워 대비 터진 콘텐츠를 우선 수집하고 품질 기준 미달은 제외', '검색 결과 원문이 없는 레퍼런스는 저장 링크 검증 대상으로 둠'],
    ['WF-GUIDE', '전략/콘텐츠 가이드 생성', '캠페인 상세/레퍼런스', ['RAW-INT-BRD-001', 'RAW-INT-CMP-001', 'RAW-EXT-REF-001', 'RAW-INT-AI-001'], ['MET-GUIDE-001', 'MET-BENCH-002'], '브리프와 저장 레퍼런스를 원메시지/후킹/스크립트 구조로 변환', '가이드 생성 산출물은 AI 실행 로그와 export 로그에 남김'],
    ['WF-EXPORT', '엑셀/시트/DOCX/PPT 내보내기', '발굴/리포트/캠페인', ['RAW-INT-EXPORT-001', 'RAW-INT-INF-001', 'RAW-INT-CMP-001'], ['MET-EXPORT-001'], '광고주 전달 산출물 생성 시 데이터 버전과 다운로드 종류를 기록', '내보내기 로그가 없으면 전달본 기준 추적 불가'],
    ['WF-AUTH', '팀/권한 설정', '설정/데이터룸', ['RAW-INT-AUTH-001', 'RAW-INT-OPS-001'], ['MET-AUTH-001'], '워크스페이스/브랜드/캠페인 단위 권한으로 같은 풀 접근 범위 제어', '권한 데이터룸 없는 화면은 내부 운영자 전용으로 제한'],
  ]

  return coverage.map(([id, featureName, frontendArea, itemRawIds, itemMetricIds, algorithm, rule]) => {
    const missingRaw = itemRawIds.filter((rawId) => !rawIds.has(rawId))
    const missingMetrics = itemMetricIds.filter((metricId) => !metricIds.has(metricId))
    const hasUnsupported = itemRawIds.includes('RAW-EXT-UNSUPPORTED-001')
    return {
      id,
      featureName,
      frontendArea,
      rawIds: itemRawIds,
      metricIds: itemMetricIds,
      algorithm,
      rule,
      status: missingRaw.length || missingMetrics.length ? '오류' : hasUnsupported ? '검증 필요' : '정상',
      missingRaw,
      missingMetrics,
    }
  })
}

function buildDataRoomPendingBundles({ backendConfig }) {
  const storageBase = backendConfig?.hasSupabase ? 'Supabase public schema' : 'localStorage creatorops.workspace.v2'
  return [
    {
      id: 'PENDING-INSIGHTS-001',
      name: 'Instagram/TikTok 인증 인사이트',
      status: '부분지원',
      reason: '공개 검색만으로는 저장/공유/정확 조회수/정확 팔로워를 항상 보장할 수 없음',
      source: '크리에이터 OAuth, TikTok/Instagram 승인 API, 업로드 스크린샷',
      storage: `${storageBase} / future: creator_authenticated_insights`,
      nextAction: '공식 권한 승인 전까지 프론트에는 수집 필요/검증 필요로 표시',
    },
    {
      id: 'PENDING-DM-001',
      name: 'DM 대량 발송 자동화',
      status: '중단',
      reason: '플랫폼 정책상 사람처럼 우회 발송하는 자동화는 운영 리스크가 큼',
      source: '이메일 발송 로그, DM 작업용 엑셀, 프로필 열기/복사 로그',
      storage: `${storageBase} / future: dm_work_orders`,
      nextAction: '이메일 가능한 후보는 이메일, 그 외는 작업 큐/엑셀로 분리',
    },
    {
      id: 'PENDING-RAW-ARCHIVE-001',
      name: '검색 원문 아카이브',
      status: '검증 필요',
      reason: '외부 검색 결과가 변동되므로 검색 시점의 원본 응답과 필터 사유를 저장해야 함',
      source: 'Brave/Google/YouTube/TikTok search responses',
      storage: `${storageBase} / future: external_search_events`,
      nextAction: 'API 응답 payload, query, country, platform, rejected reason 저장',
    },
    {
      id: 'PENDING-PROMPT-001',
      name: 'AI 프롬프트/모델 버전 레지스트리',
      status: '검증 필요',
      reason: '추천/전략/가이드 결과를 재현하려면 프롬프트와 raw ID 조합이 필요',
      source: 'OpenAI request/response metadata',
      storage: `${storageBase} / future: ai_generation_runs`,
      nextAction: '모델명, 프롬프트 버전, 입력 raw ID, 출력 요약 저장',
    },
  ]
}

function App() {
  const [workspace, setWorkspace] = usePersistentState(STORE_KEY, defaultWorkspace)
  const backendConfig = useMemo(() => getBackendConfig(), [])
  const [cloudSyncStatus, setCloudSyncStatus] = useState({
    mode: backendConfig.hasSupabase ? 'connecting' : 'local',
    label: backendConfig.hasSupabase ? 'Supabase 연결 확인 중' : '로컬 MVP 저장',
    detail: backendConfig.hasSupabase
      ? `워크스페이스 ${backendConfig.workspaceId} 데이터를 불러오는 중입니다.`
      : 'VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정하면 팀 공유 DB로 전환됩니다.',
    updatedAt: '',
  })
  const [apiTestStatus, setApiTestStatus] = useState({
    running: false,
    checkedAt: '',
    results: [],
  })
  const [authSession, setAuthSession] = useState(null)
  const [authEmail, setAuthEmail] = useState('')
  const [cloudWorkspaceLoaded, setCloudWorkspaceLoaded] = useState(!backendConfig.hasSupabase)
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('전체')
  const [category, setCategory] = useState('전체')
  const [discoveryFilters, setDiscoveryFilters] = useState(defaultDiscoveryFilters)
  const [activeDiscoveryPoolView, setActiveDiscoveryPoolView] = useState('search')
  const [selectedCreatorId, setSelectedCreatorId] = useState(workspace.creators[0]?.id)
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    workspace.campaigns.find((campaign) => campaign.brandId === workspace.activeBrandId)?.id ?? workspace.campaigns[0]?.id,
  )
  const [activeSection, setActiveSection] = useState('dashboard')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)
  const [youtubeSyncing, setYoutubeSyncing] = useState(false)
  const [realDiscoverySearching, setRealDiscoverySearching] = useState(false)
  const [showExampleCreators, setShowExampleCreators] = useState(false)
  const [selectedRecommendationIds, setSelectedRecommendationIds] = useState([])
  const [selectedDiscoveryCreatorIds, setSelectedDiscoveryCreatorIds] = useState([])
  const [discoveryPage, setDiscoveryPage] = useState(1)
  const [selectedCandidatePoolIds, setSelectedCandidatePoolIds] = useState([])
  const [candidatePoolQuery, setCandidatePoolQuery] = useState('')
  const [candidatePoolPage, setCandidatePoolPage] = useState(1)
  const [selectedOutreachIds, setSelectedOutreachIds] = useState([])
  const [gmailAuth, setGmailAuth] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(GMAIL_AUTH_STORE_KEY) || 'null')
    } catch {
      return null
    }
  })
  const [gmailSending, setGmailSending] = useState(false)
  const [outreachStatusFilter, setOutreachStatusFilter] = useState('전체')
  const [outreachSearchQuery, setOutreachSearchQuery] = useState('')
  const [outreachResponseNote, setOutreachResponseNote] = useState('')
  const [realDiscoveryDraft, setRealDiscoveryDraft] = useState({
    youtubeApiKey: '',
    googleApiKey: '',
    googleCx: '',
    maxResults: '300',
  })
  const [briefAutoDraft, setBriefAutoDraft] = useState({
    rawText: '',
    result: null,
  })
  const [proposalText, setProposalText] = useState(
    buildFriendlyProposalMessage(defaultCreators[0], defaultBrandBrief, defaultCampaigns[0]),
  )
  const [proposalChannel, setProposalChannel] = useState(getRecommendedContactChannelId(defaultCreators[0]))
  const [campaignDraft, setCampaignDraft] = useState({
    name: '',
    budget: '',
    deadline: '',
    recruitStartDate: '',
    recruitEndDate: '',
    uploadDueDate: '',
    reportDueDate: '',
    product: '',
    objective: '브랜드 인지도',
    campaignType: '제안형',
    targetPersona: '',
    searchKeywords: '',
    exclusionKeywords: '',
    minFollowers: '',
    maxCreatorFee: '',
    preferredPlatforms: '',
    mission: '',
    reward: '',
    approvalFlow: '',
    commerceMetric: '',
    kpiGoal: '',
    targetViews: '',
    targetConversions: '',
    targetOrders: '',
    targetRevenue: '',
    recommendationTargetCount: '',
    sellerRecruitTarget: '',
    brandGuideAttachments: [],
    campaignGuideMaterials: [],
    guideSeedType: '무가시딩',
    guideChannel: 'Instagram Reels',
    oneMessage: '',
    hookPoints: '',
    influencerStrategy: '',
    generatedContentGuide: '',
  })
  const [campaignEditDraft, setCampaignEditDraft] = useState(null)
  const [brandDraft, setBrandDraft] = useState({
    name: '',
    owner: '',
    product: '',
    persona: '',
    keywords: '',
    minFollowers: '',
    maxPrice: '',
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
    contactEmail: '',
    profileUrl: '',
    preferredContactChannel: 'instagram_dm',
  })
  const [youtubeDraft, setYoutubeDraft] = useState({
    apiKey: '',
    lookup: '',
  })
  const [publicProfileDraft, setPublicProfileDraft] = useState({
    profileUrl: '',
    platform: 'Instagram',
    name: '',
    handle: '',
    category: '리뷰',
    followers: '',
    averageViews: '',
    note: '',
  })
  const [trackingDraft, setTrackingDraft] = useState({
    campaignId: '',
    creatorId: 'auto',
    platform: 'Instagram',
    title: '',
    url: '',
    creatorName: '',
    creatorHandle: '',
    creatorAvatar: '',
    creatorFollowers: '',
    profileUrl: '',
    snapshotSource: '',
    snapshotCheckedAt: '',
    views: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
    conversions: '',
  })
  const [trackingSnapshotLoading, setTrackingSnapshotLoading] = useState(false)
  const [referenceDraft, setReferenceDraft] = useState({
    mediaType: '영상',
    platform: 'TikTok',
    country: 'KR',
    title: '',
    url: '',
    thumbnailUrl: '',
    views: '',
    accountFollowers: '',
    likes: '',
    comments: '',
    shares: '',
    publishedAt: '',
    hook: '',
    analysis: '',
    applyIdea: '',
  })
  const [referenceFilters, setReferenceFilters] = useState({
    query: '',
    appliedQuery: '',
    country: '전체',
    mediaType: '전체',
    platform: '전체',
    sort: 'virality',
    maxResults: '36',
  })
  const [referencePage, setReferencePage] = useState(1)
  const [referenceSearchStatus, setReferenceSearchStatus] = useState({
    mode: 'idle',
    message: '',
  })
  const [referenceSearchResultUrls, setReferenceSearchResultUrls] = useState(null)
  const [isReferenceManualFormOpen, setIsReferenceManualFormOpen] = useState(false)
  const [dataRoomRawTab, setDataRoomRawTab] = useState('전체')
  const [dataRoomRawStatus, setDataRoomRawStatus] = useState('전체')
  const [dataRoomRawCategory, setDataRoomRawCategory] = useState('전체')
  const [dataRoomRawMethod, setDataRoomRawMethod] = useState('전체')
  const [dataRoomRawOwner, setDataRoomRawOwner] = useState('전체')
  const [dataRoomRawQuery, setDataRoomRawQuery] = useState('')
  const [dataRoomMetricTab, setDataRoomMetricTab] = useState('전체')
  const [dataRoomMetricStatus, setDataRoomMetricStatus] = useState('전체')
  const [dataRoomMetricBundle, setDataRoomMetricBundle] = useState('전체')
  const [dataRoomMetricQuery, setDataRoomMetricQuery] = useState('')
  const [selectedDataRoomItem, setSelectedDataRoomItem] = useState({ type: 'raw', id: 'RAW-INT-CRM-001' })
  const [fulfillmentDraft, setFulfillmentDraft] = useState(createEmptyFulfillmentDraft)

  const {
    brands,
    activeBrandId,
    creators,
    campaigns,
    shortlist,
    recommendations,
    outreach,
    recruitedPool,
    quotes,
    fulfillmentRecords,
    trackedPosts,
    contentReferences,
    savedProductionReferenceIds,
    activities,
    team,
    accounts,
    activeAccountId,
  } = workspace

  const currentAccount = accounts.find((account) => account.id === activeAccountId) ?? accounts[0] ?? defaultWorkspace.accounts[0]
  const currentRole = teamRoleCatalog[currentAccount?.role] ?? teamRoleCatalog.Manager
  const canManagePermissions = currentAccount?.role === 'Owner' || currentAccount?.role === 'Admin'
  const accessibleSectionIds = useMemo(() => {
    if (currentAccount?.role === 'Client') return ['dashboard', 'campaigns', 'report', 'references', 'settings']
    if (currentAccount?.role === 'Analyst') return ['dashboard', 'report', 'dataRoom', 'settings']
    return ['dashboard', 'campaigns', 'discovery', 'messages', 'report', 'references', 'dataRoom', 'settings']
  }, [currentAccount?.role])
  const visibleSection = accessibleSectionIds.includes(activeSection) ? activeSection : accessibleSectionIds[0]
  const canAccessSection = (sectionId) => accessibleSectionIds.includes(sectionId)
  const accessibleBrands = useMemo(
    () =>
      currentAccount?.role === 'Owner' || currentAccount?.role === 'Admin'
        ? brands
        : brands.filter((brand) => currentAccount?.brandIds?.includes(brand.id)),
    [brands, currentAccount],
  )
  const activeBrand = brands.find((brand) => brand.id === activeBrandId) ?? brands[0] ?? defaultBrands[0]
  const brandBrief = activeBrand?.brief ?? defaultBrandBrief
  const brandCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.brandId === activeBrand.id),
    [activeBrand.id, campaigns],
  )
  const selectedCampaign =
    brandCampaigns.find((campaign) => campaign.id === selectedCampaignId) ?? brandCampaigns[0]
  const activeCampaignIdSet = useMemo(
    () => new Set(brandCampaigns.map((campaign) => campaign.id)),
    [brandCampaigns],
  )
  const activeRecommendations = useMemo(
    () =>
      recommendations.filter(
        (recommendation) => {
          const creator = creators.find((item) => item.id === recommendation.creatorId)
          return (
            (showExampleCreators || !isExampleCreator(creator)) &&
            (recommendation.brandId === activeBrand.id ||
              activeCampaignIdSet.has(recommendation.campaignId))
          )
        },
      ),
    [activeBrand.id, activeCampaignIdSet, creators, recommendations, showExampleCreators],
  )
  const selectedCampaignRecommendations = useMemo(
    () =>
      selectedCampaign
        ? activeRecommendations.filter((recommendation) => recommendation.campaignId === selectedCampaign.id)
        : activeRecommendations,
    [activeRecommendations, selectedCampaign],
  )
  const selectedRecommendations = useMemo(
    () => selectedCampaignRecommendations.filter((recommendation) => selectedRecommendationIds.includes(recommendation.id)),
    [selectedCampaignRecommendations, selectedRecommendationIds],
  )
  const allRecommendationsSelected =
    selectedCampaignRecommendations.length > 0 && selectedRecommendations.length === selectedCampaignRecommendations.length
  const activeOutreach = useMemo(
    () => outreach.filter((item) => activeCampaignIdSet.has(item.campaignId)),
    [activeCampaignIdSet, outreach],
  )
  const activeOutreachDetail = modal?.type === 'outreachDetail'
    ? activeOutreach.find((item) => item.id === modal.itemId)
    : null
  const activeOutreachDetailCreator = activeOutreachDetail
    ? creators.find((creator) => creator.id === activeOutreachDetail.creatorId)
    : null
  const activeOutreachDetailCampaign = activeOutreachDetail
    ? campaigns.find((campaign) => campaign.id === activeOutreachDetail.campaignId)
    : null
  const activeOutreachDetailPlan = activeOutreachDetail
    ? buildContactPlan(
        activeOutreachDetailCreator,
        activeOutreachDetail.channel,
        activeOutreachDetail.message,
        activeOutreachDetailCampaign?.name,
      )
    : null
  const activeDmBulkItems = modal?.type === 'dmBulk'
    ? (modal.ids ?? []).map((id) => activeOutreach.find((item) => item.id === id)).filter(Boolean)
    : []
  const activeDmBulkIndex = activeDmBulkItems.length
    ? Math.min(Math.max(Number(modal?.index || 0), 0), activeDmBulkItems.length - 1)
    : 0
  const activeDmBulkItem = activeDmBulkItems[activeDmBulkIndex] ?? null
  const activeDmBulkCreator = activeDmBulkItem
    ? creators.find((creator) => creator.id === activeDmBulkItem.creatorId)
    : null
  const activeDmBulkCampaign = activeDmBulkItem
    ? campaigns.find((campaign) => campaign.id === activeDmBulkItem.campaignId)
    : null
  const activeDmBulkPlan = activeDmBulkItem
    ? buildContactPlan(activeDmBulkCreator, activeDmBulkItem.channel, activeDmBulkItem.message, activeDmBulkCampaign?.name)
    : null
  const activeRecruitedPool = useMemo(
    () => recruitedPool.filter((item) => activeCampaignIdSet.has(item.campaignId)),
    [activeCampaignIdSet, recruitedPool],
  )
  const activeQuotes = useMemo(
    () => quotes.filter((item) => activeCampaignIdSet.has(item.campaignId)),
    [activeCampaignIdSet, quotes],
  )
  const activeFulfillmentRecords = useMemo(
    () => fulfillmentRecords.filter((item) => activeCampaignIdSet.has(item.campaignId)),
    [activeCampaignIdSet, fulfillmentRecords],
  )
  const fulfillmentCreatorOptions = useMemo(() => {
    const recruitedCreatorIds = new Set(activeRecruitedPool.map((item) => item.creatorId))
    const recruitedCreators = creators.filter((creator) => recruitedCreatorIds.has(creator.id))
    return recruitedCreators.length ? recruitedCreators : creators
  }, [activeRecruitedPool, creators])
  const activeTrackedPosts = useMemo(
    () => trackedPosts.filter((post) => activeCampaignIdSet.has(post.campaignId)),
    [activeCampaignIdSet, trackedPosts],
  )
  const selectedCampaignOutreach = useMemo(
    () =>
      selectedCampaign
        ? activeOutreach.filter((item) => item.campaignId === selectedCampaign.id)
        : activeOutreach,
    [activeOutreach, selectedCampaign],
  )
  const searchedCampaignOutreach = useMemo(() => {
    const normalizedQuery = outreachSearchQuery.trim().toLowerCase()
    if (!normalizedQuery) return selectedCampaignOutreach

    return selectedCampaignOutreach.filter((item) => {
      const creator = creators.find((candidate) => candidate.id === item.creatorId)
      const campaign = campaigns.find((candidate) => candidate.id === item.campaignId)
      const searchableText = [
        item.status,
        item.channel,
        item.deliveryMode,
        item.source,
        item.reason,
        item.message,
        item.sentAt,
        item.respondedAt,
        creator?.name,
        creator?.handle,
        creator?.platform,
        creator?.country,
        creator?.category,
        creator?.email,
        campaign?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedQuery)
    })
  }, [campaigns, creators, outreachSearchQuery, selectedCampaignOutreach])
  const outreachStatusFilters = useMemo(
    () => [
      {
        key: '전체',
        label: '전체',
        count: searchedCampaignOutreach.length,
        helper: '전체 메시지',
      },
      {
        key: '승인 대기',
        label: '검토함',
        count: searchedCampaignOutreach.filter((item) => item.status === '승인 대기').length,
        helper: '문구 확인 후 발송 처리',
      },
      {
        key: '발송 완료',
        label: '발송완료',
        count: searchedCampaignOutreach.filter((item) => item.status === '발송 완료').length,
        helper: '응답 대기 및 후속 확인',
      },
      {
        key: '응답',
        label: '응답',
        count: searchedCampaignOutreach.filter((item) => item.status === '응답').length,
        helper: '조건 확인 후 섭외 완료',
      },
    ],
    [searchedCampaignOutreach],
  )
  const filteredCampaignOutreach = useMemo(
    () =>
      outreachStatusFilter === '\uC804\uCCB4'
        ? searchedCampaignOutreach
        : searchedCampaignOutreach.filter((item) => item.status === outreachStatusFilter),
    [outreachStatusFilter, searchedCampaignOutreach],
  )
  const selectedOutreachItems = useMemo(
    () => selectedCampaignOutreach.filter((item) => selectedOutreachIds.includes(item.id)),
    [selectedCampaignOutreach, selectedOutreachIds],
  )
  const selectedEmailOutreachItems = useMemo(
    () =>
      selectedOutreachItems.filter((item) => {
        const creator = creators.find((candidate) => candidate.id === item.creatorId)
        const channelId = item.channel || getRecommendedContactChannelId(creator)
        return channelId === 'email' && Boolean(creator?.contactEmail)
      }),
    [creators, selectedOutreachItems],
  )
  const selectedDmOutreachItems = useMemo(
    () =>
      selectedOutreachItems.filter((item) => {
        const creator = creators.find((candidate) => candidate.id === item.creatorId)
        const channelId = item.channel || getRecommendedContactChannelId(creator)
        return ['instagram_dm', 'tiktok_dm'].includes(channelId) && Boolean(getCreatorProfileUrl(creator, channelId))
      }),
    [creators, selectedOutreachItems],
  )
  const selectedDuplicateOutreachCount = useMemo(
    () => selectedOutreachItems.filter((item) => hasDuplicateSentOutreach(item, outreach)).length,
    [outreach, selectedOutreachItems],
  )
  const gmailConnected = Boolean(gmailAuth?.accessToken && Number(gmailAuth.expiresAt || 0) > Date.now() + 60000)
  const allOutreachSelected =
    filteredCampaignOutreach.length > 0 &&
    filteredCampaignOutreach.every((item) => selectedOutreachIds.includes(item.id))
  const selectedCampaignTrackedPosts = useMemo(
    () =>
      selectedCampaign
        ? activeTrackedPosts.filter((post) => post.campaignId === selectedCampaign.id)
        : activeTrackedPosts,
    [activeTrackedPosts, selectedCampaign],
  )
  const selectedCampaignRecruitedPool = useMemo(
    () =>
      selectedCampaign
        ? activeRecruitedPool.filter((item) => item.campaignId === selectedCampaign.id)
        : activeRecruitedPool,
    [activeRecruitedPool, selectedCampaign],
  )
  const selectedCampaignReferences = useMemo(
    () =>
      contentReferences.filter(
        (item) => activeCampaignIdSet.has(item.campaignId) && item.savedAt !== '데모 데이터',
      ),
    [activeCampaignIdSet, contentReferences],
  )
  const referenceCountryOptions = useMemo(
    () => [
      ...referenceCountryPresets,
      ...Array.from(new Set(selectedCampaignReferences.map((item) => item.country).filter(Boolean)))
        .filter((country) => !referenceCountryPresets.includes(country)),
    ],
    [selectedCampaignReferences],
  )
  const visibleReferences = useMemo(() => {
    const searchTerm = referenceFilters.appliedQuery.trim().toLowerCase()
    const hasScopedSearchResults = Array.isArray(referenceSearchResultUrls)
    const resultUrlSet = new Set((referenceSearchResultUrls ?? []).map((url) => String(url || '').toLowerCase()))
    const filtered = selectedCampaignReferences.filter(
      (item) =>
        (!hasScopedSearchResults || resultUrlSet.has(String(item.url || '').toLowerCase())) &&
        (referenceFilters.country === '전체' || item.country === referenceFilters.country) &&
        (referenceFilters.mediaType === '전체' || item.mediaType === referenceFilters.mediaType) &&
        (referenceFilters.platform === '전체' || item.platform === referenceFilters.platform) &&
        (!searchTerm ||
          [item.title, item.hook, item.analysis, item.applyIdea, item.platform, item.country]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchTerm)),
    )
    return [...filtered].sort((a, b) => {
      if (referenceFilters.sort === 'virality') return getReferenceVirality(b) - getReferenceVirality(a)
      if (referenceFilters.sort === 'shares') return Number(b.shares || 0) - Number(a.shares || 0)
      if (referenceFilters.sort === 'recent') return Number(b.id || 0) - Number(a.id || 0)
      return Number(b.views || 0) - Number(a.views || 0)
    })
  }, [referenceFilters, referenceSearchResultUrls, selectedCampaignReferences])
  const referencePageSize = 12
  const referenceTotalPages = Math.max(1, Math.ceil(visibleReferences.length / referencePageSize))
  const safeReferencePage = Math.min(Math.max(referencePage, 1), referenceTotalPages)
  const paginatedReferences = useMemo(() => {
    const start = (safeReferencePage - 1) * referencePageSize
    return visibleReferences.slice(start, start + referencePageSize)
  }, [safeReferencePage, visibleReferences])

  const savedProductionReferences = useMemo(
    () => selectedCampaignReferences.filter((item) => savedProductionReferenceIds.includes(item.id)),
    [savedProductionReferenceIds, selectedCampaignReferences],
  )
  const referenceTotals = useMemo(
    () =>
      visibleReferences.reduce(
        (summary, item) => ({
          views: summary.views + Number(item.views || 0),
          shares: summary.shares + Number(item.shares || 0),
          videos: summary.videos + (item.mediaType === '영상' ? 1 : 0),
          images: summary.images + (item.mediaType === '이미지' ? 1 : 0),
        }),
        { views: 0, shares: 0, videos: 0, images: 0 },
      ),
    [visibleReferences],
  )
  const candidatePoolAllCreators = useMemo(() => {
    return getCreatorsByIds(creators, shortlist)
  }, [creators, shortlist])
  const candidatePoolCreators = useMemo(() => {
    const normalizedQuery = candidatePoolQuery.trim().toLowerCase()
    if (!normalizedQuery) return candidatePoolAllCreators

    return candidatePoolAllCreators.filter((creator) => {
      const searchableText = [
        creator.name,
        creator.handle,
        creator.platform,
        creator.country,
        creator.category,
        creator.status,
        creator.email,
        creator.source,
        ...(creator.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedQuery)
    })
  }, [candidatePoolAllCreators, candidatePoolQuery])
  const candidatePoolPageSize = 20
  const candidatePoolTotalPages = Math.max(1, Math.ceil(candidatePoolCreators.length / candidatePoolPageSize))
  const safeCandidatePoolPage = Math.min(Math.max(candidatePoolPage, 1), candidatePoolTotalPages)
  const visibleCandidatePoolCreators = useMemo(() => {
    const start = (safeCandidatePoolPage - 1) * candidatePoolPageSize
    return candidatePoolCreators.slice(start, start + candidatePoolPageSize)
  }, [candidatePoolCreators, safeCandidatePoolPage])
  const selectedCandidatePoolCreators = useMemo(
    () => candidatePoolCreators.filter((creator) => selectedCandidatePoolIds.includes(creator.id)),
    [candidatePoolCreators, selectedCandidatePoolIds],
  )
  const selectedVisibleCandidatePoolCreators = useMemo(
    () => visibleCandidatePoolCreators.filter((creator) => selectedCandidatePoolIds.includes(creator.id)),
    [selectedCandidatePoolIds, visibleCandidatePoolCreators],
  )
  const allCandidatePoolSelected =
    visibleCandidatePoolCreators.length > 0 && selectedVisibleCandidatePoolCreators.length === visibleCandidatePoolCreators.length

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!backendConfig.hasSupabase) return undefined

    let cancelled = false
    getAuthSession()
      .then((session) => {
        if (!cancelled) setAuthSession(session)
      })
      .catch(() => {
        if (!cancelled) setAuthSession(null)
      })

    const unsubscribe = onAuthStateChange((event, session) => {
      setAuthSession(session)
      if (event === 'SIGNED_IN') showToast('팀 공유 DB 로그인 세션이 연결됐어요.')
      if (event === 'SIGNED_OUT') showToast('팀 공유 DB에서 로그아웃했어요.')
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [backendConfig.hasSupabase])

  useEffect(() => {
    if (!trackedPosts.length) return undefined
    const today = new Date().toISOString().slice(0, 10)
    if (window.localStorage.getItem(TRACKING_DAILY_REFRESH_KEY) === today) return undefined

    const timer = window.setTimeout(() => {
      refreshTracking({ mode: 'daily-auto' })
    }, 250)

    return () => window.clearTimeout(timer)
    // Daily refresh is gated by TRACKING_DAILY_REFRESH_KEY; adding refreshTracking retriggers this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedPosts.length])

  const filteredCreators = useMemo(() => {
    const queryTerms = query
      .split(/[,\s]+/)
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 2)
    const minFollowers = parseDiscoveryFilterValue(discoveryFilters.minFollowers)
    const effectiveMinFollowers = minFollowers ?? minimumVisibleFollowers
    const maxFollowers = parseDiscoveryFilterValue(discoveryFilters.maxFollowers)
    const minAverageViews = parseDiscoveryFilterValue(discoveryFilters.minAverageViews)
    const minEngagement = parseDiscoveryFilterValue(discoveryFilters.minEngagement)
    const maxPrice = parseDiscoveryFilterValue(discoveryFilters.maxPrice)
    const minFit = parseDiscoveryFilterValue(discoveryFilters.minFit)
    const selectedCountry = String(discoveryFilters.country || '전체')

    return creators
      .filter((creator) => {
        if (!showExampleCreators && isExampleCreator(creator)) return false
        const pendingMetrics = hasPendingMetrics(creator)
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
          (!queryTerms.length || queryTerms.some((term) => searchable.includes(term))) &&
          (platform === '전체' || creator.platform === platform) &&
          (category === '전체' || creator.category === category) &&
          (selectedCountry === '전체' || creator.country === selectedCountry || creator.city === selectedCountry) &&
          (pendingMetrics || creator.followers >= effectiveMinFollowers) &&
          (pendingMetrics || maxFollowers === null || creator.followers <= maxFollowers) &&
          (pendingMetrics || minAverageViews === null || creator.averageViews >= minAverageViews) &&
          (pendingMetrics || minEngagement === null || creator.engagement >= minEngagement) &&
          (pendingMetrics || maxPrice === null || creator.price <= maxPrice) &&
          (minFit === null || creator.fit >= minFit)
        )
      })
      .sort(compareCreatorsByDiscoveryPriority)
  }, [category, creators, discoveryFilters, platform, query, showExampleCreators])

  const discoveryPageSize = 20
  const discoveryTotalPages = Math.max(1, Math.ceil(filteredCreators.length / discoveryPageSize))
  const safeDiscoveryPage = Math.min(Math.max(discoveryPage, 1), discoveryTotalPages)
  const visibleDiscoveryCreators = useMemo(() => {
    const start = (safeDiscoveryPage - 1) * discoveryPageSize
    return filteredCreators.slice(start, start + discoveryPageSize)
  }, [filteredCreators, safeDiscoveryPage])

  const selectedCreator =
    filteredCreators.find((creator) => creator.id === selectedCreatorId) ??
    filteredCreators[0] ??
    (showExampleCreators ? creators.find((creator) => creator.id === selectedCreatorId) : undefined) ??
    creators.find((creator) => !isExampleCreator(creator)) ??
    (showExampleCreators ? creators[0] : undefined)
  const selectedDiscoveryCreators = useMemo(
    () => filteredCreators.filter((creator) => selectedDiscoveryCreatorIds.includes(creator.id)),
    [filteredCreators, selectedDiscoveryCreatorIds],
  )
  const selectedVisibleDiscoveryCreators = useMemo(
    () => visibleDiscoveryCreators.filter((creator) => selectedDiscoveryCreatorIds.includes(creator.id)),
    [selectedDiscoveryCreatorIds, visibleDiscoveryCreators],
  )
  const allDiscoveryCreatorsSelected =
    visibleDiscoveryCreators.length > 0 && selectedVisibleDiscoveryCreators.length === visibleDiscoveryCreators.length


  const selectedCreatorOutreach = activeOutreach.filter((item) => item.creatorId === selectedCreator?.id)
  const selectedCreatorQuotes = activeQuotes.filter((item) => item.creatorId === selectedCreator?.id)
  const selectedCreatorQuality = getCreatorDataQuality(selectedCreator)
  const autoOutreachCount = activeOutreach.filter((item) => item.source === '자동').length
  const bulkOutreachCount = activeOutreach.filter((item) => item.source === '대량 섭외').length
  const manualOutreachCount = activeOutreach.filter((item) => item.source !== '자동' && item.source !== '대량 섭외').length
  const dataCoverage = useMemo(() => calculateDataCoverage(creators), [creators])
  const selectedSourceEvidence = useMemo(
    () => buildCreatorSourceEvidence(selectedCreator),
    [selectedCreator],
  )
  const tikTokSellerCandidates = useMemo(
    () =>
      creators
        .filter(
          (creator) =>
            !isExampleCreator(creator) &&
            creator.platform === 'TikTok' &&
            creator.averageViews >= 50000 &&
            creator.engagement >= 4 &&
            creator.price <= Number(brandBrief.maxPrice || 999999999),
        )
        .sort((a, b) => b.averageViews * b.engagement - a.averageViews * a.engagement),
    [brandBrief.maxPrice, creators],
  )

  const trackedTotals = useMemo(
    () =>
      activeTrackedPosts.reduce(
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
    [activeTrackedPosts],
  )
  const selectedCampaignTrackedTotals = useMemo(
    () =>
      selectedCampaignTrackedPosts.reduce(
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
    [selectedCampaignTrackedPosts],
  )
  const selectedCampaignTrackedAverageEngagement = useMemo(
    () =>
      selectedCampaignTrackedPosts.length
        ? selectedCampaignTrackedPosts.reduce((sum, post) => sum + contentEngagementRate(post), 0) /
          selectedCampaignTrackedPosts.length
        : 0,
    [selectedCampaignTrackedPosts],
  )

  const campaignKpiSummaries = useMemo(
    () =>
      brandCampaigns.map((campaign) => getCampaignKpiSummary(campaign, activeTrackedPosts, activeRecruitedPool)),
    [activeRecruitedPool, activeTrackedPosts, brandCampaigns],
  )

  const selectedCampaignKpi = useMemo(
    () => campaignKpiSummaries.find((summary) => summary.campaignId === selectedCampaign?.id),
    [campaignKpiSummaries, selectedCampaign?.id],
  )

  const fulfillmentTotals = useMemo(
    () =>
      activeFulfillmentRecords.reduce(
        (summary, item) => ({
          amount: summary.amount + Number(item.paymentAmount || 0),
          pending: summary.pending + (item.deliveryStatus === '정산 완료' ? 0 : 1),
          sent: summary.sent + (item.deliveryStatus === '발송 완료' || item.deliveryStatus === '정산 완료' ? 1 : 0),
        }),
        { amount: 0, pending: 0, sent: 0 },
      ),
    [activeFulfillmentRecords],
  )

  const totals = useMemo(() => {
    const reach = filteredCreators.reduce((sum, creator) => sum + creator.followers, 0)
    const views = filteredCreators.reduce((sum, creator) => sum + creator.averageViews, 0)
    const engagement =
      filteredCreators.reduce((sum, creator) => sum + creator.engagement, 0) /
      Math.max(filteredCreators.length, 1)
    const budget = brandCampaigns.reduce((sum, campaign) => sum + campaign.budget, 0)
    const revenue = brandCampaigns.reduce((sum, campaign) => sum + campaign.revenue, 0)
    const spend = brandCampaigns.reduce((sum, campaign) => sum + campaign.spend, 0)

    return {
      reach,
      views,
      engagement,
      budget,
      spend,
      revenue,
      roi: revenue / Math.max(spend, 1),
    }
  }, [brandCampaigns, filteredCreators])

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
        value: Math.min(95, 65 + activeOutreach.filter((item) => item.status === '응답').length * 7),
        tone: 'amber',
      },
    ],
    [activeOutreach, creators],
  )

  const activeDiscoveryFilterCount = useMemo(
    () =>
      Object.entries(discoveryFilters).filter(([field, value]) =>
        field === 'country'
          ? Boolean(value && value !== '전체')
          : hasDiscoveryFilterValue(value),
      ).length,
    [discoveryFilters],
  )

  const discoveryFilterSummary = useMemo(
    () =>
      Object.entries(discoveryFilters)
        .filter(([field, value]) =>
          field === 'country'
            ? Boolean(value && value !== '전체')
            : hasDiscoveryFilterValue(value),
        )
        .map(([field, value]) => `${discoveryFilterLabels[field]} ${value}`)
        .join(' · '),
    [discoveryFilters],
  )

  const workflowSignals = useMemo(
    () => [
      {
        label: '데이터 발굴',
        value: `${filteredCreators.length}명`,
        detail: activeDiscoveryFilterCount > 0 ? `${activeDiscoveryFilterCount}개 조건` : '전체 후보',
        icon: <Search size={17} />,
        tone: 'blue',
      },
      {
        label: 'AI 추천',
        value: `${activeRecommendations.length}명`,
        detail: '근거/페르소나 생성',
        icon: <Target size={17} />,
        tone: 'green',
      },
      {
        label: '틱톡 셀러',
        value: `${tikTokSellerCandidates.length}명`,
        detail: '공동구매 대량 섭외 후보',
        icon: <UsersRound size={17} />,
        tone: 'violet',
      },
      {
        label: '메시지 검토함',
        value: `${activeOutreach.length}건`,
        detail: `자동 ${autoOutreachCount} · 대량 ${bulkOutreachCount} · 수동 ${manualOutreachCount}`,
        icon: <Send size={17} />,
        tone: 'amber',
      },
      {
        label: '성과 추적',
        value: `${activeTrackedPosts.length}건`,
        detail: `${compactNumber(trackedTotals.views)} 조회`,
        icon: <BarChart3 size={17} />,
        tone: 'slate',
      },
      {
        label: '리소스 풀',
        value: `${activeRecruitedPool.length}명`,
        detail: '재섭외 자산',
        icon: <UsersRound size={17} />,
        tone: 'violet',
      },
      {
        label: '배송/수동 정산',
        value: `${activeFulfillmentRecords.length}건`,
        detail: `미완료 ${fulfillmentTotals.pending} · ${won(fulfillmentTotals.amount)}`,
        icon: <WalletCards size={17} />,
        tone: 'slate',
      },
    ],
    [
      activeDiscoveryFilterCount,
      activeFulfillmentRecords.length,
      activeOutreach.length,
      activeRecommendations.length,
      activeRecruitedPool.length,
      activeTrackedPosts.length,
      autoOutreachCount,
      bulkOutreachCount,
      filteredCreators.length,
      fulfillmentTotals.amount,
      fulfillmentTotals.pending,
      manualOutreachCount,
      tikTokSellerCandidates.length,
      trackedTotals.views,
    ],
  )

  const dataRoomRawData = useMemo(
    () =>
      buildDataRoomExtendedRawCatalog({
        rawData: buildAdminRawDataCatalog({
          creators,
          outreach,
          campaigns,
          recruitedPool,
          fulfillmentRecords,
          trackedPosts,
          contentReferences,
          brands,
          backendConfig,
          activeBrand,
        }),
        backendConfig,
        creators,
        outreach,
        contentReferences,
      }),
    [activeBrand, backendConfig, brands, campaigns, contentReferences, creators, fulfillmentRecords, outreach, recruitedPool, trackedPosts],
  )
  const dataRoomMetrics = useMemo(
    () =>
      buildDataRoomExtendedMetricCatalog({
        metrics: buildAdminMetricCatalog({
          rawData: dataRoomRawData,
          outreach,
          creators,
          campaigns,
          recruitedPool,
          fulfillmentRecords,
          trackedPosts,
          contentReferences,
        }),
        rawData: dataRoomRawData,
        creators,
        contentReferences,
      }),
    [campaigns, contentReferences, creators, dataRoomRawData, fulfillmentRecords, outreach, recruitedPool, trackedPosts],
  )
  const dataRoomWorkflowCoverage = useMemo(
    () => buildDataRoomWorkflowCoverage({ rawData: dataRoomRawData, metrics: dataRoomMetrics }),
    [dataRoomMetrics, dataRoomRawData],
  )
  const dataRoomPendingBundles = useMemo(
    () => buildDataRoomPendingBundles({ backendConfig }),
    [backendConfig],
  )
  const dataRoomRawCategories = useMemo(
    () => ['전체', ...new Set(dataRoomRawData.map((item) => item.category))],
    [dataRoomRawData],
  )
  const dataRoomRawMethods = useMemo(
    () => ['전체', ...new Set(dataRoomRawData.flatMap((item) => item.method.split('/').map((method) => method.trim())))],
    [dataRoomRawData],
  )
  const dataRoomRawOwners = useMemo(
    () => ['전체', ...new Set(dataRoomRawData.map((item) => item.ownerDept))],
    [dataRoomRawData],
  )
  const dataRoomMetricBundles = useMemo(
    () => ['전체', ...new Set(dataRoomMetrics.map((item) => item.bundle))],
    [dataRoomMetrics],
  )
  const filteredDataRoomRawData = useMemo(() => {
    const normalizedQuery = dataRoomRawQuery.trim().toLowerCase()
    return dataRoomRawData.filter((item) => {
      const matchesTab = dataRoomRawTab === '전체' || item.scope === dataRoomRawTab
      const matchesStatus = dataRoomRawStatus === '전체' || item.status === dataRoomRawStatus
      const matchesCategory = dataRoomRawCategory === '전체' || item.category === dataRoomRawCategory
      const matchesMethod = dataRoomRawMethod === '전체' || item.method.includes(dataRoomRawMethod)
      const matchesOwner = dataRoomRawOwner === '전체' || item.ownerDept === dataRoomRawOwner
      const matchesQuery =
        !normalizedQuery ||
        [
          item.id,
          item.name,
          item.description,
          item.purpose,
          item.sourceLocation,
          item.storageLocation,
          item.dashboardArea,
          item.opsOwner,
          item.techOwner,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      return matchesTab && matchesStatus && matchesCategory && matchesMethod && matchesOwner && matchesQuery
    })
  }, [dataRoomRawCategory, dataRoomRawData, dataRoomRawMethod, dataRoomRawOwner, dataRoomRawQuery, dataRoomRawStatus, dataRoomRawTab])
  const filteredDataRoomMetrics = useMemo(() => {
    const normalizedQuery = dataRoomMetricQuery.trim().toLowerCase()
    return dataRoomMetrics.filter((item) => {
      const matchesTab = dataRoomMetricTab === '전체' || item.scope === dataRoomMetricTab
      const matchesStatus = dataRoomMetricStatus === '전체' || item.status === dataRoomMetricStatus
      const matchesBundle = dataRoomMetricBundle === '전체' || item.bundle === dataRoomMetricBundle
      const matchesQuery =
        !normalizedQuery ||
        [
          item.id,
          item.name,
          item.bundle,
          item.description,
          item.formula,
          item.rawNames.join(' '),
          item.displayLocation,
          item.ownerDept,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      return matchesTab && matchesStatus && matchesBundle && matchesQuery
    })
  }, [dataRoomMetricBundle, dataRoomMetricQuery, dataRoomMetricStatus, dataRoomMetricTab, dataRoomMetrics])
  const groupedDataRoomMetrics = useMemo(
    () =>
      [...new Set(filteredDataRoomMetrics.map((item) => item.bundle))].map((bundle) => ({
        bundle,
        metrics: filteredDataRoomMetrics.filter((item) => item.bundle === bundle),
      })),
    [filteredDataRoomMetrics],
  )
  const dataRoomSummary = useMemo(
    () => ({
      rawTotal: dataRoomRawData.length,
      rawOk: dataRoomRawData.filter((item) => item.status === '정상').length,
      rawDelayed: dataRoomRawData.filter((item) => item.status === '지연').length,
      rawError: dataRoomRawData.filter((item) => item.status === '오류').length,
      rawPaused: dataRoomRawData.filter((item) => item.status === '중단').length,
      internal: dataRoomRawData.filter((item) => item.scope === '내부').length,
      external: dataRoomRawData.filter((item) => item.scope === '외부').length,
      metricTotal: dataRoomMetrics.length,
      metricError: dataRoomMetrics.filter((item) => item.status === '오류').length,
      lastSync: new Date().toLocaleString('ko-KR'),
    }),
    [dataRoomMetrics, dataRoomRawData],
  )
  const activeDataRoomDetail =
    selectedDataRoomItem.type === 'metric'
      ? dataRoomMetrics.find((item) => item.id === selectedDataRoomItem.id) ?? dataRoomMetrics[0]
      : dataRoomRawData.find((item) => item.id === selectedDataRoomItem.id) ?? dataRoomRawData[0]

  const pageMeta = {
    dashboard: {
      eyebrow: 'Overview',
      title: '대시보드',
      description: `${activeBrand.name} 전체 운영 현황`,
    },
    discovery: {
      eyebrow: 'Creator Discovery',
      title: '크리에이터 발굴',
      description: `${brandBrief.product}에 맞는 후보 추천과 검색`,
    },
    references: {
      eyebrow: 'Content Reference',
      title: '콘텐츠 레퍼런스',
      description: `${selectedCampaign?.name ?? activeBrand.name} 제작에 차용할 영상/이미지 레퍼런스`,
    },
    dataRoom: {
      eyebrow: 'Admin Data Room',
      title: '어드민 데이터룸',
      description: 'raw 데이터, 수집 위치, 계산지표, 품질 이슈를 추적하는 내부 관리 화면',
    },
    campaigns: {
      eyebrow: 'Campaign Operations',
      title: '캠페인',
      description: `${brandCampaigns.length}개 캠페인 · 섭외 완료 풀 · 배송/수동 정산`,
    },
    report: {
      eyebrow: 'Performance Report',
      title: '리포트',
      description: '콘텐츠 성과 추적과 보고서 다운로드',
    },
    messages: {
      eyebrow: 'Outreach',
      title: '메시지',
      description: '제안 메시지 검토, 발송, 응답 관리',
    },
    settings: {
      eyebrow: 'Workspace Settings',
      title: '설정',
      description: '팀 계정, 권한, 데이터 정확도 기준 관리',
    },
  }[visibleSection] ?? {
    eyebrow: 'Creator intelligence OS',
    title: '인플루언서 마케팅 운영 콘솔',
    description: `${activeBrand.name} · ${brandBrief.product}`,
  }

  useEffect(() => {
    let cancelled = false

    async function hydrateCloudWorkspace() {
      if (!backendConfig.hasSupabase) return

      try {
        const result = await loadCloudWorkspace()
        if (cancelled) return

        if (result.status === 'auth_required') {
          setCloudSyncStatus({
            mode: 'auth',
            label: 'Supabase Auth login required',
            detail: result.message || 'Sign in before using the shared workspace.',
            updatedAt: '',
          })
        } else if (result.workspace) {
          setWorkspace(normalizeWorkspace(result.workspace))
          setCloudSyncStatus({
            mode: 'cloud',
            label: 'Supabase 공유 DB 연결됨',
            detail: `워크스페이스 ${backendConfig.workspaceId} 데이터를 불러왔습니다.`,
            updatedAt: result.updatedAt || '',
          })
        } else {
          setCloudSyncStatus({
            mode: 'cloud',
            label: 'Supabase 공유 DB 준비됨',
            detail: '아직 저장된 워크스페이스가 없어 현재 로컬 데이터를 첫 스냅샷으로 저장합니다.',
            updatedAt: '',
          })
        }
      } catch (error) {
        setCloudSyncStatus({
          mode: 'error',
          label: '클라우드 동기화 오류',
          detail: error instanceof Error ? error.message : 'Supabase 연결을 확인해주세요.',
          updatedAt: '',
        })
      } finally {
        if (!cancelled) setCloudWorkspaceLoaded(true)
      }
    }

    hydrateCloudWorkspace()

    return () => {
      cancelled = true
    }
  }, [backendConfig.hasSupabase, backendConfig.workspaceId, setWorkspace])

  useEffect(() => {
    if (!backendConfig.hasSupabase || !cloudWorkspaceLoaded) return undefined

    const timeout = window.setTimeout(async () => {
      try {
        const result = await saveCloudWorkspace(workspace)
        if (result.status === 'auth_required') {
          setCloudSyncStatus({
            mode: 'auth',
            label: 'Supabase Auth login required',
            detail: result.message || 'Sign in before saving the shared workspace.',
            updatedAt: '',
          })
          return
        }
        setCloudSyncStatus((current) => ({
          ...current,
          mode: 'cloud',
          label: 'Supabase 공유 DB 자동 저장됨',
          detail: `워크스페이스 ${backendConfig.workspaceId}에 최신 운영 데이터를 저장했습니다.`,
          updatedAt: new Date().toISOString(),
        }))
      } catch (error) {
        setCloudSyncStatus({
          mode: 'error',
          label: '클라우드 저장 오류',
          detail: error instanceof Error ? error.message : 'Supabase 저장 권한과 테이블 정책을 확인해주세요.',
          updatedAt: '',
        })
      }
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [backendConfig.hasSupabase, backendConfig.workspaceId, cloudWorkspaceLoaded, workspace])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_oauth') !== '1') return undefined

    const apiBaseUrl = backendConfig.apiBaseUrl?.replace(/\/$/, '')
    const code = params.get('code')
    const error = params.get('error')
    const cleanUrl = window.location.pathname + (window.location.hash || '')
    window.history.replaceState({}, document.title, cleanUrl)

    if (error) {
      showToast('Gmail connection failed: ' + error)
      return undefined
    }

    if (!apiBaseUrl || !code) {
      showToast('Gmail connection needs the API server and authorization code.')
      return undefined
    }

    let cancelled = false
    async function exchangeGoogleCode() {
      try {
        const response = await fetch(apiBaseUrl + '/oauth/google/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || 'Failed to exchange Gmail authorization code.')
        const nextAuth = {
          accessToken: payload.data?.accessToken,
          refreshToken: payload.data?.refreshToken || '',
          expiresAt: Date.now() + Math.max(Number(payload.data?.expiresIn || 3600) - 60, 60) * 1000,
          connectedAt: new Date().toISOString(),
          scope: payload.data?.scope || '',
        }
        if (!nextAuth.accessToken) throw new Error('Gmail access token is empty.')
        if (cancelled) return
        window.localStorage.setItem(GMAIL_AUTH_STORE_KEY, JSON.stringify(nextAuth))
        setGmailAuth(nextAuth)
        showToast('Gmail account connected. You can now send selected email outreach.')
      } catch (exchangeError) {
        if (!cancelled) showToast(exchangeError instanceof Error ? exchangeError.message : 'Gmail connection failed.')
      }
    }

    exchangeGoogleCode()

    return () => {
      cancelled = true
    }
  }, [backendConfig.apiBaseUrl])

  const showToast = (message) => setToast(message)

  const updateWorkspace = (mutator) => {
    setWorkspace((current) => mutator(current))
  }

  const syncWorkspaceNow = async () => {
    if (!backendConfig.hasSupabase) {
      showToast('Supabase 환경변수를 설정하면 팀 공유 DB에 저장할 수 있어요.')
      return
    }

    try {
      const result = await saveCloudWorkspace(workspace)
      if (result.status === 'auth_required') {
        setCloudSyncStatus({
          mode: 'auth',
          label: 'Supabase Auth login required',
          detail: result.message || 'Sign in before saving the shared workspace.',
          updatedAt: '',
        })
        showToast('Sign in to save the shared workspace.')
        return
      }
      setCloudSyncStatus({
        mode: 'cloud',
        label: 'Supabase 공유 DB 수동 저장됨',
        detail: `워크스페이스 ${backendConfig.workspaceId}에 현재 데이터를 저장했습니다.`,
        updatedAt: new Date().toISOString(),
      })
      showToast('팀 공유 DB에 현재 워크스페이스를 저장했어요.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Supabase 저장 중 오류가 발생했어요.'
      setCloudSyncStatus({
        mode: 'error',
        label: '클라우드 저장 오류',
        detail: message,
        updatedAt: '',
      })
      showToast(message)
    }
  }

  const requestAuthLink = async () => {
    const email = authEmail.trim()
    if (!email) {
      showToast('로그인 링크를 받을 이메일을 입력해주세요.')
      return
    }

    try {
      await signInWithEmail(email)
      showToast(`${email}로 로그인 링크를 보냈어요.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '로그인 링크 발송에 실패했어요.')
    }
  }

  const disconnectAuth = async () => {
    try {
      await signOut()
      setAuthSession(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '로그아웃에 실패했어요.')
    }
  }

  const testProductionApis = async () => {
    if (!backendConfig.apiBaseUrl) {
      showToast('VITE_CREATOROPS_API_BASE_URL을 먼저 연결해야 API 서버 테스트가 가능해요.')
      setApiTestStatus({
        running: false,
        checkedAt: new Date().toISOString(),
        results: [
          {
            key: 'api-base',
            label: 'CreatorOps API 서버',
            detail: '프론트 환경변수 VITE_CREATOROPS_API_BASE_URL',
            status: 'fail',
            result: 'API 서버 URL이 비어 있습니다.',
          },
        ],
      })
      return
    }

    const apiBaseUrl = backendConfig.apiBaseUrl.replace(/\/$/, '')
    const postJson = async (path, body) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `${path} 요청 실패`)
      }
      return payload
    }
    const checks = [
      {
        key: 'health',
        label: 'API 서버',
        detail: 'Render 백엔드 /health',
        run: async () => {
          const response = await fetch(`${apiBaseUrl}/health`)
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || !payload.ok) throw new Error(payload?.message || '서버 health 응답 실패')
          return `정상 · ${payload.service || 'creatorops-api'}`
        },
      },
      {
        key: 'youtube',
        label: 'YouTube Data API',
        detail: '채널 검색/통계 조회',
        run: async () => {
          const payload = await postJson('/discovery/youtube/search', {
            query: '반려견 켄넬 크리에이터',
            maxResults: 1,
          })
          return `${payload?.data?.length || 0}건 응답`
        },
      },
      {
        key: 'google-search',
        label: 'Google Search/CX',
        detail: 'Instagram/TikTok 공개 프로필 검색',
        run: async () => {
          const payload = await postJson('/discovery/google-profiles/search', {
            query: 'pet influencer Korea',
            platform: 'TikTok',
            maxResults: 1,
          })
          return `${payload?.data?.length || 0}건 응답`
        },
      },
      {
        key: 'openai',
        label: 'OpenAI',
        detail: '제안 메시지 생성',
        run: async () => {
          const payload = await postJson('/ai/outreach-message', {
            creator: { name: '테스트 크리에이터', platform: 'TikTok', category: '반려동물' },
            brand: { brandName: 'CreatorOps Test', product: '이동식 켄넬' },
            campaign: { name: 'API 연결 테스트', oneMessage: '안전하고 편한 이동식 켄넬' },
          })
          return payload?.data?.message ? '메시지 생성 성공' : '응답은 왔지만 메시지가 비어 있음'
        },
      },
    ]

    setApiTestStatus({ running: true, checkedAt: '', results: [] })

    const results = []
    for (const check of checks) {
      try {
        const result = await check.run()
        results.push({ ...check, status: 'success', result })
      } catch (error) {
        results.push({
          ...check,
          status: 'fail',
          result: error instanceof Error ? error.message : '연결 실패',
        })
      }
      setApiTestStatus({ running: true, checkedAt: '', results: [...results] })
    }

    const failedCount = results.filter((item) => item.status === 'fail').length
    setApiTestStatus({
      running: false,
      checkedAt: new Date().toISOString(),
      results,
    })
    showToast(failedCount ? `API 테스트 완료 · ${failedCount}개 확인 필요` : 'API 테스트가 모두 통과했어요.')
  }

  const switchBrand = (brandId) => {
    const nextBrandId = Number(brandId)
    const nextBrand = brands.find((brand) => brand.id === nextBrandId)
    if (!nextBrand) return

    updateWorkspace((current) => ({
      ...current,
      activeBrandId: nextBrandId,
    }))
    setSelectedCampaignId(campaigns.find((campaign) => campaign.brandId === nextBrandId)?.id)
    showToast(`${nextBrand.name} 워크스페이스로 전환했어요.`)
  }

  const switchAccount = (accountId) => {
    const nextAccount = accounts.find((account) => account.id === accountId)
    if (!nextAccount) return
    const nextBrandId = nextAccount.brandIds?.[0] ?? activeBrandId

    setCandidatePoolPage(1)
    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          activeAccountId: nextAccount.id,
          activeBrandId: nextBrandId,
        },
        'team',
        `${nextAccount.name} 계정으로 권한 컨텍스트 전환`,
      ),
    )
    setSelectedCampaignId(campaigns.find((campaign) => campaign.brandId === nextBrandId)?.id)
    setActiveSection(
      nextAccount.role === 'Client' ? 'campaigns' : nextAccount.role === 'Analyst' ? 'report' : 'dashboard',
    )
  }

  const updateAccountRole = (accountId, role) => {
    if (!canManagePermissions) {
      showToast('Owner 또는 Admin만 계정 권한을 변경할 수 있습니다.')
      return
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          accounts: current.accounts.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  role,
                }
              : account,
          ),
        },
        'team',
        `${accounts.find((account) => account.id === accountId)?.name ?? '계정'} 권한을 ${role}로 변경`,
      ),
    )
  }

  const toggleAccountBrandAccess = (accountId, brandId) => {
    if (!canManagePermissions) {
      showToast('Owner 또는 Admin만 브랜드 접근권한을 변경할 수 있습니다.')
      return
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          accounts: current.accounts.map((account) => {
            if (account.id !== accountId) return account
            const brandIds = new Set(account.brandIds ?? [])
            if (brandIds.has(brandId)) brandIds.delete(brandId)
            else brandIds.add(brandId)
            return {
              ...account,
              brandIds: [...brandIds],
            }
          }),
        },
        'team',
        '브랜드 접근권한 업데이트',
      ),
    )
  }

  const runDataSourceAudit = () => {
    updateWorkspace((current) =>
      appendActivity(
        current,
        'data',
        `데이터 소스 점검 · 평균 신뢰도 ${dataCoverage.confidence}% · 공식 API 대상 ${dataCoverage.officialReady}명`,
      ),
    )
    showToast('후보별 데이터 출처와 신뢰도 원장을 갱신했어요.')
  }

  const syncYouTubeChannel = async (event) => {
    event.preventDefault()
    setYoutubeSyncing(true)

    try {
      const snapshot = await fetchYouTubeChannelSnapshot(youtubeDraft)
      const existingCreator = creators.find(
        (creator) =>
          creator.platform === 'YouTube' &&
          (creator.handle.toLowerCase() === snapshot.handle.toLowerCase() ||
            creator.name.toLowerCase() === snapshot.name.toLowerCase()),
      )
      const nextCreator = {
        ...(existingCreator ?? {}),
        id: existingCreator?.id ?? createId(),
        name: snapshot.name,
        handle: snapshot.handle,
        avatar:
          snapshot.avatar ||
          existingCreator?.avatar ||
          'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=160&q=80',
        platform: 'YouTube',
        category: existingCreator?.category ?? '리뷰',
        country: snapshot.country,
        followers: snapshot.followers,
        averageViews: snapshot.averageViews,
        engagement: existingCreator?.engagement ?? 4.2,
        growth: existingCreator?.growth ?? 0,
        fit: existingCreator?.fit ?? 82,
        brandSafety: existingCreator?.brandSafety ?? 94,
        fakeRisk: existingCreator?.fakeRisk ?? 5,
        cpm: existingCreator?.cpm ?? 6800,
        price: existingCreator?.price ?? Math.max(500000, Math.round(snapshot.averageViews * 22)),
        audience: existingCreator?.audience ?? 'YouTube 공식 채널 통계 기반 · 오디언스 인증 필요',
        city: existingCreator?.city ?? 'KR',
        lastPost: 'YouTube API 동기화',
        status: '공식 지표 확인',
        topics: existingCreator?.topics?.length
          ? existingCreator.topics
          : ['YouTube 공식 API', '공개 채널', '정밀 검증 대상'],
      }

      updateWorkspace((current) => {
        const nextCreators = existingCreator
          ? current.creators.map((creator) => (creator.id === existingCreator.id ? nextCreator : creator))
          : [nextCreator, ...current.creators]

        return appendActivity(
          {
            ...current,
            creators: nextCreators,
            shortlist: current.shortlist.includes(nextCreator.id)
              ? current.shortlist
              : [...current.shortlist, nextCreator.id],
          },
          'data',
          `${snapshot.name} YouTube 공식 지표 동기화 · 구독자 ${compactNumber(snapshot.followers)}`,
        )
      })
      setSelectedCreatorId(nextCreator.id)
      setYoutubeDraft((current) => ({ ...current, lookup: '' }))
      showToast(`${snapshot.name} 공식 YouTube 지표를 후보 DB에 반영했어요.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'YouTube 연동 중 오류가 발생했어요.')
    } finally {
      setYoutubeSyncing(false)
    }
  }

  const savePublicProfileSnapshot = (event) => {
    event.preventDefault()
    const followers = parseOpenMetric(publicProfileDraft.followers)

    if (!followers) {
      showToast('공개 프로필에 보이는 팔로워 수를 입력해주세요.')
      return
    }

    const handle = publicProfileDraft.handle || deriveHandleFromUrl(publicProfileDraft.profileUrl)
    const averageViews =
      parseOpenMetric(publicProfileDraft.averageViews) || Math.round(followers * 0.18)
    const existingCreator = creators.find(
      (creator) =>
        creator.platform === publicProfileDraft.platform &&
        creator.handle.toLowerCase() === handle.toLowerCase(),
    )
    const collectedAt = nowLabel()
    const sourceUrl = publicProfileDraft.profileUrl || `${publicProfileDraft.platform} 공개 프로필`
    const metricSources = [
      {
        metric: '팔로워',
        source: '공개 프로필 화면 확인',
        method: `${publicProfileDraft.platform} 공개 URL에 표시된 팔로워 수 입력`,
        confidence: 80,
        freshness: collectedAt,
        originalUrl: sourceUrl,
        value: followers,
      },
      {
        metric: '평균 조회',
        source: publicProfileDraft.averageViews ? '공개 콘텐츠 화면 확인' : '팔로워 기반 임시 추정',
        method: publicProfileDraft.averageViews
          ? '최근 콘텐츠에 표시된 공개 조회 수 입력'
          : '평균 조회 미입력으로 팔로워 대비 18% 임시 추정',
        confidence: publicProfileDraft.averageViews ? 74 : 56,
        freshness: collectedAt,
        originalUrl: sourceUrl,
        value: averageViews,
      },
    ]
    const nextCreator = {
      ...(existingCreator ?? {}),
      id: existingCreator?.id ?? createId(),
      name: publicProfileDraft.name || existingCreator?.name || handle.replace('@', ''),
      handle,
      avatar:
        existingCreator?.avatar ||
        'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=160&q=80',
      platform: publicProfileDraft.platform,
      category: publicProfileDraft.category,
      country: existingCreator?.country ?? 'KR',
      followers,
      averageViews,
      engagement: existingCreator?.engagement ?? 4.5,
      growth: existingCreator?.growth ?? 0,
      fit: existingCreator?.fit ?? 80,
      brandSafety: existingCreator?.brandSafety ?? 92,
      fakeRisk: existingCreator?.fakeRisk ?? 8,
      cpm: existingCreator?.cpm ?? 6000,
      price: existingCreator?.price ?? Math.max(300000, Math.round(averageViews * 18)),
      audience: existingCreator?.audience ?? '공개 프로필 수치 기반 · 오디언스 인증 필요',
      city: existingCreator?.city ?? 'KR',
      lastPost: '공개 수치 수집',
      status: '공개 데이터 확인',
      topics: existingCreator?.topics?.length
        ? existingCreator.topics
        : ['공개 프로필', '팔로워 수집', publicProfileDraft.category],
      sourceUrl,
      sourceCollectedAt: collectedAt,
      sourceNote: publicProfileDraft.note,
      metricSources,
    }

    updateWorkspace((current) => {
      const nextCreators = existingCreator
        ? current.creators.map((creator) => (creator.id === existingCreator.id ? nextCreator : creator))
        : [nextCreator, ...current.creators]

      return appendActivity(
        {
          ...current,
          creators: nextCreators,
          shortlist: current.shortlist.includes(nextCreator.id)
            ? current.shortlist
            : [...current.shortlist, nextCreator.id],
        },
        'data',
        `${nextCreator.name} 공개 팔로워 수집 · ${compactNumber(followers)} · ${sourceUrl}`,
      )
    })
    setSelectedCreatorId(nextCreator.id)
    setPublicProfileDraft({
      profileUrl: '',
      platform: publicProfileDraft.platform,
      name: '',
      handle: '',
      category: publicProfileDraft.category,
      followers: '',
      averageViews: '',
      note: '',
    })
    showToast(`${nextCreator.name} 공개 팔로워 수치를 후보 DB에 저장했어요.`)
  }

  const createBrand = (event) => {
    event.preventDefault()
    const nextBrand = normalizeBrand({
      id: createId(),
      name: brandDraft.name || '신규 브랜드',
      owner: brandDraft.owner || brandDraft.name || 'New Brand',
      color: '#0071e3',
      brief: {
        ...defaultBrandBrief,
        brandName: brandDraft.name || '신규 브랜드',
        product: brandDraft.product || '신규 캠페인 제품',
        persona: brandDraft.persona || '구매 가능성이 높은 핵심 타깃',
        keywords: brandDraft.keywords || '리뷰, 추천, 사용 후기',
        minFollowers: Number(brandDraft.minFollowers) || 100000,
        maxPrice: Number(brandDraft.maxPrice) || 5000000,
      },
    })

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          brands: [nextBrand, ...current.brands],
          activeBrandId: nextBrand.id,
        },
        'brand',
        `${nextBrand.name} 브랜드 워크스페이스 생성`,
      ),
    )
    setBrandDraft({
      name: '',
      owner: '',
      product: '',
      persona: '',
      keywords: '',
      minFollowers: '',
      maxPrice: '',
    })
    setSelectedCampaignId(undefined)
    setModal(null)
    showToast(`${nextBrand.name} 브랜드를 추가했어요.`)
  }

  const jumpTo = (section) => {
    if (!canAccessSection(section)) {
      showToast('현재 계정 권한으로 접근할 수 없는 화면입니다.')
      return
    }
    setActiveSection(section)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const toggleDiscoveryCreatorSelection = (creatorId) => {
    setSelectedDiscoveryCreatorIds((current) =>
      current.includes(creatorId)
        ? current.filter((id) => id !== creatorId)
        : [...current, creatorId],
    )
  }

  const toggleAllDiscoveryCreators = () => {
    const visibleIds = visibleDiscoveryCreators.map((creator) => creator.id)
    setSelectedDiscoveryCreatorIds((current) =>
      allDiscoveryCreatorsSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    )
  }

  const toggleCandidatePoolSelection = (creatorId) => {
    setSelectedCandidatePoolIds((current) =>
      current.includes(creatorId)
        ? current.filter((id) => id !== creatorId)
        : [...current, creatorId],
    )
  }

  const toggleAllCandidatePoolCreators = () => {
    const visibleIds = visibleCandidatePoolCreators.map((creator) => creator.id)
    setSelectedCandidatePoolIds((current) =>
      allCandidatePoolSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    )
  }

  const removeCandidatePoolCreators = (creatorIds) => {
    const ids = Array.from(new Set(creatorIds)).filter(Boolean)

    if (!ids.length) {
      showToast('Select candidates to remove first.')
      return
    }

    const removeIdSet = new Set(ids)
    const removedOutreachIds = activeOutreach
      .filter((item) => removeIdSet.has(item.creatorId))
      .map((item) => item.id)
    const removedOutreachIdSet = new Set(removedOutreachIds)

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          shortlist: current.shortlist.filter((id) => !removeIdSet.has(id)),
          outreach: current.outreach.filter(
            (item) => !(removeIdSet.has(item.creatorId) && activeCampaignIdSet.has(item.campaignId)),
          ),
        },
        'shortlist',
        `Removed ${ids.length} creators from pre-outreach pool and message list`,
      ),
    )

    setSelectedCandidatePoolIds((current) => current.filter((id) => !removeIdSet.has(id)))
    setSelectedOutreachIds((current) => current.filter((id) => !removedOutreachIdSet.has(id)))
    showToast(`Removed ${ids.length} candidates from pool and message list.`)
  }

  const removeSelectedCandidatePoolCreators = () => {
    removeCandidatePoolCreators(selectedCandidatePoolCreators.map((creator) => creator.id))
  }

  const buildCreatorProposalRecord = (creator, campaign, source = '수동') => {
    const message = buildFriendlyProposalMessage(creator, brandBrief, campaign)
    const contactPlan = buildContactPlan(creator, getRecommendedContactChannelId(creator), message, campaign.name)

    return {
      id: createId() + creator.id,
      creatorId: creator.id,
      campaignId: campaign.id,
      source,
      status: '승인 대기',
      channel: contactPlan.id,
      deliveryMode: contactPlan.deliveryMode,
      complianceNote: contactPlan.notice,
      message,
      reason: `발굴 리스트 선택 제안 · ${creator.platform} · 팔로워 ${displayMetric(creator.followers)} · 평균 조회 ${displayMetric(creator.averageViews)} · 매칭 ${creator.fit ?? '-'}점`,
      score: creator.fit,
      createdAt: nowLabel(),
    }
  }

  const saveSelectedDiscoveryCreatorsToCandidatePool = () => {
    if (!selectedDiscoveryCreators.length) {
      showToast('후보 풀에 저장할 인플루언서를 먼저 선택하세요.')
      return
    }

    const selectedIds = selectedDiscoveryCreators.map((creator) => creator.id)

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          shortlist: Array.from(new Set([...current.shortlist, ...selectedIds])),
        },
        'shortlist',
        `발굴 리스트 ${selectedIds.length}명 메시지 전 후보 풀 저장`,
      ),
    )
    setSelectedCandidatePoolIds(selectedIds)
    setCandidatePoolPage(1)
    setActiveDiscoveryPoolView('candidate')
    showToast(`선택한 인플루언서 ${selectedIds.length}명을 메시지 전 후보 풀에 저장했어요.`)
  }

  const queueSelectedDiscoveryCreators = () => {
    const campaign = selectedCampaign

    if (!campaign) {
      showToast('선택 후보에게 제안하려면 현재 브랜드에 캠페인이 필요합니다.')
      setModal({ type: 'create' })
      return
    }

    if (!selectedDiscoveryCreators.length) {
      showToast('제안 메시지를 만들 인플루언서를 먼저 선택하세요.')
      return
    }

    const records = selectedDiscoveryCreators.map((creator) => buildCreatorProposalRecord(creator, campaign, '수동'))

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: [...records, ...current.outreach],
          shortlist: Array.from(new Set([...current.shortlist, ...records.map((record) => record.creatorId)])),
        },
        'outreach',
        `발굴 리스트 ${records.length}명 제안 메시지 검토함 저장`,
      ),
    )
    setSelectedCandidatePoolIds(records.map((record) => record.creatorId))
    setCandidatePoolPage(1)
    setActiveDiscoveryPoolView('candidate')
    setSelectedDiscoveryCreatorIds([])
    showToast(`선택한 인플루언서 ${records.length}명을 후보 풀에 저장하고 제안 메시지를 검토함에 넣었어요.`)
  }

  const queueSelectedCandidatePoolCreators = () => {
    const campaign = selectedCampaign

    if (!campaign) {
      showToast('후보 풀에서 메시지를 만들려면 캠페인이 필요합니다.')
      setModal({ type: 'create' })
      return
    }

    if (!selectedCandidatePoolCreators.length) {
      showToast('메시지로 보낼 후보를 먼저 선택하세요.')
      return
    }

    const records = selectedCandidatePoolCreators.map((creator) => buildCreatorProposalRecord(creator, campaign, '후보 풀'))

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: [...records, ...current.outreach],
        },
        'outreach',
        `후보 풀 ${records.length}명 제안 메시지 검토함 저장`,
      ),
    )
    setSelectedCandidatePoolIds([])
    showToast(`후보 풀 ${records.length}명의 제안 메시지를 검토함에 넣었어요.`)
  }

  const resetSearch = () => {
    setQuery('')
    setPlatform('전체')
    setCategory('전체')
    setDiscoveryFilters(defaultDiscoveryFilters)
    setSelectedDiscoveryCreatorIds([])
    setSelectedCandidatePoolIds([])
    setCandidatePoolQuery('')
    setDiscoveryPage(1)
    setCandidatePoolPage(1)
    showToast('검색 조건을 초기화했어요.')
  }

  const updateDiscoveryFilter = (field, value) => {
    setDiscoveryPage(1)
    setDiscoveryFilters((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const applyBrandBriefToDiscoveryFilters = () => {
    setDiscoveryFilters((current) => ({
      ...current,
      minFollowers: String(brandBrief.minFollowers || ''),
      maxPrice: String(brandBrief.maxPrice || ''),
    }))
    showToast('브랜드 조건의 팔로워와 단가 기준을 발굴 필터에 적용했어요.')
  }

  const applyAiBriefAutoSetup = () => {
    const setup = buildAutoBriefSetup(briefAutoDraft.rawText)
    if (!setup) {
      showToast('자동 세팅할 브리프 내용을 먼저 붙여넣어주세요.')
      return
    }

    const previewCandidateCount = buildBriefDiscoveryCreators(setup, creators).length
    const nextBrief = {
      ...brandBrief,
      ...setup.brandBrief,
      learningMaterials: [setup.learningMaterial, ...getLearningMaterials(brandBrief)].slice(0, 80),
    }

    updateWorkspace((current) => {
      const nextBrands = current.brands.map((brand) => {
        if (brand.id !== current.activeBrandId) return brand

        return {
          ...brand,
          brief: nextBrief,
        }
      })

      return appendActivity(
        {
          ...current,
          brands: nextBrands,
          brandBrief:
            current.activeBrandId === current.brands[0]?.id
              ? {
                  ...current.brandBrief,
                  ...nextBrief,
                }
              : current.brandBrief,
        },
        'brief',
        `${activeBrand.name} AI 브리프 자동 세팅 · ${setup.product} · 실제 발굴 조건 ${previewCandidateCount}명`,
      )
    })
    setQuery(setup.discovery.query)
    setPlatform(setup.discovery.platform)
    setCategory(setup.discovery.category)
    setDiscoveryFilters(setup.discovery.filters)
    setCampaignDraft((current) => ({
      ...current,
      ...setup.campaign,
    }))
    setBriefAutoDraft((current) => ({
      ...current,
      result: {
        ...setup.summary,
        candidateTargetCount: previewCandidateCount,
      },
    }))
    showToast(`${setup.product} 조건을 세팅했어요. 실제 후보는 아래 '실제 웹 발굴'로 가져오세요.`)
  }

  const saveFilter = () => {
    const filterDescription = [
      platform,
      category,
      query,
      discoveryFilterSummary,
    ].filter(Boolean).join(' · ')

    updateWorkspace((current) =>
      appendActivity(current, 'filter', `필터 저장: ${filterDescription || '전체 후보'}`),
    )
    showToast('현재 검색 필터를 운영 기록에 저장했어요.')
  }

  const toggleBriefList = (field, value) => {
    updateWorkspace((current) => {
      const currentBrand = current.brands.find((brand) => brand.id === current.activeBrandId) ?? current.brands[0]
      const currentValues = currentBrand.brief[field]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value]

      return {
        ...current,
        brandBrief: current.activeBrandId === current.brands[0]?.id
          ? {
              ...current.brandBrief,
              [field]: nextValues,
            }
          : current.brandBrief,
        brands: current.brands.map((brand) =>
          brand.id === current.activeBrandId
            ? {
                ...brand,
                brief: {
                  ...brand.brief,
                  [field]: nextValues,
                },
              }
            : brand,
        ),
      }
    })
  }

  const downloadCampaignGuideTemplate = () => {
    const filledTemplate = influencerBrandGuideTemplate
      .replace('- 브랜드명:', `- 브랜드명: ${activeBrand.name}`)
      .replace('- 목적:', `- 목적: ${campaignDraft.objective || brandBrief.goal || ''}`)
      .replace('- KPI:', `- KPI: ${campaignDraft.kpiGoal || ''}`)
      .replace('- 영상에서 반드시 전달해야 할 한 문장:', `- 영상에서 반드시 전달해야 할 한 문장: ${brandBrief.product ? `${brandBrief.product}의 핵심 메시지` : ''}`)
      .replace('- 연령/성별/라이프스타일:', `- 연령/성별/라이프스타일: ${brandBrief.persona || ''}`)
      .replace('- 금지/주의 표현', `- 금지/주의 표현\n${brandBrief.exclusions || '-'}`)

    exportFile(
      `creatorops-${activeBrand.name || 'brand'}-influencer-guide.md`,
      'text/markdown;charset=utf-8',
      filledTemplate,
    )
    showToast('인플루언서 브랜드 가이드 양식을 다운로드했어요.')
  }

  const buildCampaignBriefFromDraft = (draft = campaignDraft) => ({
    ...brandBrief,
    product: draft.product || brandBrief.product,
    persona: draft.targetPersona || brandBrief.persona,
    keywords: draft.searchKeywords || brandBrief.keywords,
    exclusions: draft.exclusionKeywords || brandBrief.exclusions,
    minFollowers: draft.minFollowers || brandBrief.minFollowers,
    maxPrice: draft.maxCreatorFee || brandBrief.maxPrice,
    platforms: draft.preferredPlatforms ? keywordList(draft.preferredPlatforms) : brandBrief.platforms,
    learningMaterials: [
      ...(draft.campaignGuideMaterials ?? []),
      ...getLearningMaterials(brandBrief),
    ].slice(0, 80),
  })

  const attachCampaignGuideFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const attachment = {
      id: createId(),
      name: file.name,
      type: file.type || file.name.split('.').pop()?.toLowerCase() || 'file',
      size: file.size,
      uploadedAt: nowLabel(),
      learningMaterialCount: 0,
    }

    try {
      let materials = []
      if (/\.xlsx$/i.test(file.name)) {
        materials = buildLearningMaterialsFromRows(await readSheet(file), '캠페인 브랜드 가이드 첨부', file.name)
      } else if (/\.(md|txt|csv|tsv)$/i.test(file.name)) {
        const text = await file.text()
        const guideMaterial = buildGuideLearningMaterial(text, file.name)
        materials = guideMaterial ? [guideMaterial] : []
      } else if (/\.docx$/i.test(file.name)) {
        showToast('Word 가이드는 첨부 기록으로 저장돼요. 본문 자동 학습은 서버 파싱 연결 후 지원됩니다.')
      } else {
        showToast('지원하지 않는 파일 형식입니다. .docx, .md, .txt, .csv, .tsv, .xlsx를 첨부해주세요.')
        return
      }

      const nextAttachment = {
        ...attachment,
        learningMaterialCount: materials.length,
      }

      setCampaignDraft((current) => ({
        ...current,
        brandGuideAttachments: [nextAttachment, ...(current.brandGuideAttachments ?? [])].slice(0, 8),
        campaignGuideMaterials: [...materials, ...(current.campaignGuideMaterials ?? [])].slice(0, 20),
      }))
      showToast(
        materials.length
          ? `${file.name} 첨부 완료 · 브랜드 학습자료 ${materials.length}건으로 반영 예정`
          : `${file.name} 첨부 완료`,
      )
    } catch {
      showToast('가이드 파일을 읽지 못했어요. 파일 형식이나 내용을 확인해주세요.')
    } finally {
      event.target.value = ''
    }
  }

  const runRealDiscoverySearch = async () => {
    const searchText = buildDiscoverySearchText({ query, category, brandBrief, selectedCampaign })
    const intentTerms = getDiscoveryIntentTerms(query, category)
    const maxResults = Math.min(Math.max(Number(realDiscoveryDraft.maxResults) || 300, 1), 1000)
    const youtubeApiKey = realDiscoveryDraft.youtubeApiKey.trim() || youtubeDraft.apiKey.trim()
    const hasServerApi = Boolean(backendConfig.apiBaseUrl)
    const hasProfileSearch = hasServerApi || (realDiscoveryDraft.googleApiKey.trim() && realDiscoveryDraft.googleCx.trim())
    const discoveryCountry =
      discoveryFilters.country && discoveryFilters.country !== '전체'
        ? discoveryFilters.country
        : activeBrand.country || 'KR'

    if (!hasServerApi && !youtubeApiKey && !hasProfileSearch) {
      showToast('실제 발굴은 CreatorOps API 서버 또는 YouTube/프로필 검색 API 키를 연결해야 합니다.')
      return
    }

    setRealDiscoverySearching(true)

    try {
      const results = []
      const wantsYouTube = platform === '전체' || platform === 'YouTube'

      if (wantsYouTube && (hasServerApi || youtubeApiKey)) {
        results.push(
          ...(await searchYouTubeCreatorDiscovery({
            apiKey: youtubeApiKey,
            query: searchText,
            country: discoveryCountry,
            maxResults,
          })),
        )
      }

      if (hasProfileSearch && platform !== 'YouTube') {
        results.push(
          ...(await searchGoogleProfileDiscovery({
            apiKey: realDiscoveryDraft.googleApiKey,
            cx: realDiscoveryDraft.googleCx,
            query: searchText,
            platform,
            country: discoveryCountry,
            maxResults,
          })),
        )
      }

      const matchingResults = intentTerms.length
        ? results.filter((result) => discoveryResultMatchesIntent(result, intentTerms))
        : results
      const discoveredCreators = matchingResults.map((result, index) =>
        buildRealDiscoveryCreator(
          result,
          brandBrief,
          category === '\uC804\uCCB4' ? brandBrief.categories?.[0] : category,
          index + 1,
        ),
      )

      if (!discoveredCreators.length) {
        showToast(
          results.length
            ? '검색 결과가 현재 키워드/카테고리 조건과 맞지 않아 저장하지 않았어요. 검색어를 조금 넓혀주세요.'
            : '실제 검색 결과에서 가져올 프로필을 찾지 못했어요. 검색어를 더 구체화해주세요.',
        )
        return
      }

      let selectedNextId = discoveredCreators[0].id

      updateWorkspace((current) => {
        const keyFor = (creator) => String(creator.profileUrl || `${creator.platform}:${creator.handle}`).toLowerCase()
        const existingByKey = new Map(current.creators.map((creator) => [keyFor(creator), creator]))
        const mergedCreators = discoveredCreators.map((creator) => {
          const existing = existingByKey.get(keyFor(creator))
          const nextCreator = existing ? { ...existing, ...creator, id: existing.id, isDemo: false, isSynthetic: false } : creator
          if (creator.id === selectedNextId) selectedNextId = nextCreator.id
          return nextCreator
        })
        const mergedKeys = new Set(mergedCreators.map(keyFor))
        const realRecommendations = mergedCreators
          .map((creator) => ({
            ...buildRecommendation(creator, brandBrief, selectedCampaign),
            brandId: activeBrand.id,
            source: '실제 공개 검색',
          }))
          .sort((a, b) => b.score - a.score)

        return appendActivity(
          {
            ...current,
            creators: [
              ...mergedCreators,
              ...current.creators.filter((creator) => !mergedKeys.has(keyFor(creator))),
            ],
            recommendations: [
              ...realRecommendations,
              ...current.recommendations.filter(
                (recommendation) =>
                  !mergedCreators.some((creator) => creator.id === recommendation.creatorId && recommendation.brandId === activeBrand.id),
              ),
            ].slice(0, 2000),
            shortlist: Array.from(
              new Set([...current.shortlist, ...mergedCreators.slice(0, 3).map((creator) => creator.id)]),
            ),
          },
          'data',
          `${activeBrand.name} 실제 공개 발굴 · ${mergedCreators.length}명 저장`,
        )
      })
      setShowExampleCreators(false)
      setSelectedCreatorId(selectedNextId)
      setDiscoveryPage(1)
      showToast(`실제 공개 검색 결과 ${discoveredCreators.length}명을 발굴 리스트에 저장했어요.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '실제 발굴 검색 중 오류가 발생했어요.')
    } finally {
      setRealDiscoverySearching(false)
    }
  }

  const runAiDiscovery = () => {
    const campaignMinFollowers = Number(selectedCampaign?.minFollowers || brandBrief.minFollowers)
    const campaignMaxCreatorFee = Number(selectedCampaign?.maxCreatorFee || brandBrief.maxPrice)
    const campaignPlatforms = selectedCampaign?.preferredPlatforms
      ? keywordList(selectedCampaign.preferredPlatforms)
      : brandBrief.platforms
    const eligibleCreators = creators.filter(
      (creator) => {
        const pendingMetrics = hasPendingMetrics(creator)
        return (
          !isExampleCreator(creator) &&
          (pendingMetrics || creator.followers >= campaignMinFollowers) &&
          (pendingMetrics || creator.price <= campaignMaxCreatorFee) &&
          matchesBriefPlatform(creator, campaignPlatforms)
        )
      },
    )
    const ranked = eligibleCreators
      .map((creator) => ({
        ...buildRecommendation(creator, brandBrief, selectedCampaign),
        brandId: activeBrand.id,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, getCampaignRecommendationTarget(selectedCampaign))

    if (!ranked.length) {
      const realCreatorCount = creators.filter((creator) => !isExampleCreator(creator)).length
      showToast(
        realCreatorCount
          ? '현재 캠페인 조건에 맞는 후보가 없습니다. 팔로워/단가/플랫폼 조건을 조정해보세요.'
          : '먼저 아래 실제 웹 발굴을 실행해서 후보를 모아주세요.',
      )
      return
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          recommendations: ranked,
          shortlist: Array.from(new Set([...current.shortlist, ...ranked.slice(0, 3).map((item) => item.creatorId)])),
        },
        'ai',
        `${selectedCampaign?.name ?? activeBrand.name} 조건으로 AI 후보 ${ranked.length}명 추출`,
      ),
    )
    showToast(`캠페인 조건 기준으로 후보 ${ranked.length}명을 추천했어요.`)
  }

  const buildRecommendationOutreachRecord = (recommendation, creator, campaign) => {
    const message = buildFriendlyProposalMessage(creator, brandBrief, campaign)
    const contactPlan = buildContactPlan(creator, getRecommendedContactChannelId(creator), message, campaign.name)

    return {
      id: createId() + creator.id,
      creatorId: creator.id,
      campaignId: campaign.id,
      source: '자동',
      status: '승인 대기',
      channel: contactPlan.id,
      deliveryMode: contactPlan.deliveryMode,
      complianceNote: contactPlan.notice,
      message,
      reason: recommendation.reasons.join(' / '),
      score: recommendation.score,
      createdAt: nowLabel(),
    }
  }

  const queueRecommendation = (recommendation) => {
    const creator = creators.find((item) => item.id === recommendation.creatorId)
    const campaign = brandCampaigns.find((item) => item.id === recommendation.campaignId) ?? selectedCampaign
    if (!creator || !campaign) {
      showToast('메시지를 저장하려면 현재 브랜드에 캠페인이 필요합니다.')
      return
    }

    const record = buildRecommendationOutreachRecord(recommendation, creator, campaign)

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: [record, ...current.outreach],
        },
        'outreach',
        `${creator.name} 제안 메시지 검토함 저장`,
      ),
    )
    showToast(`${creator.name} 제안 메시지를 검토함에 저장했어요.`)
  }

  const toggleRecommendationSelection = (recommendationId) => {
    setSelectedRecommendationIds((current) =>
      current.includes(recommendationId)
        ? current.filter((id) => id !== recommendationId)
        : [...current, recommendationId],
    )
  }

  const toggleAllRecommendations = () => {
    setSelectedRecommendationIds(allRecommendationsSelected ? [] : selectedCampaignRecommendations.map((item) => item.id))
  }

  const saveSelectedRecommendations = () => {
    const creatorIds = selectedRecommendations.map((recommendation) => recommendation.creatorId)

    if (!creatorIds.length) {
      showToast('쇼트리스트에 저장할 AI 후보를 먼저 선택하세요.')
      return
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          shortlist: Array.from(new Set([...current.shortlist, ...creatorIds])),
        },
        'shortlist',
        `AI 추천 후보 ${creatorIds.length}명 쇼트리스트 저장`,
      ),
    )
    showToast(`선택한 AI 후보 ${creatorIds.length}명을 쇼트리스트에 저장했어요.`)
  }

  const queueSelectedRecommendations = () => {
    if (!selectedRecommendations.length) {
      showToast('메시지 검토함으로 보낼 AI 후보를 먼저 선택하세요.')
      return
    }

    const records = selectedRecommendations
      .map((recommendation) => {
        const creator = creators.find((item) => item.id === recommendation.creatorId)
        const campaign = brandCampaigns.find((item) => item.id === recommendation.campaignId) ?? selectedCampaign
        return creator && campaign ? buildRecommendationOutreachRecord(recommendation, creator, campaign) : null
      })
      .filter(Boolean)

    if (!records.length) {
      showToast('선택 후보를 메시지로 저장하려면 현재 브랜드에 캠페인이 필요합니다.')
      return
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: [...records, ...current.outreach],
          shortlist: Array.from(new Set([...current.shortlist, ...records.map((record) => record.creatorId)])),
        },
        'outreach',
        `AI 추천 후보 ${records.length}명 제안 메시지 검토함 저장`,
      ),
    )
    setSelectedRecommendationIds([])
    showToast(`선택한 AI 후보 ${records.length}명의 제안 메시지를 검토함에 저장했어요.`)
  }

  const openProposalModal = () => {
    if (!selectedCampaign) {
      showToast('제안 메시지를 만들려면 현재 브랜드에 캠페인을 먼저 생성해주세요.')
      setModal({ type: 'create' })
      return
    }
    if (selectedCreator && selectedCampaign) {
      setProposalText(buildFriendlyProposalMessage(selectedCreator, brandBrief, selectedCampaign))
      setProposalChannel(getRecommendedContactChannelId(selectedCreator))
    }
    setModal({ type: 'proposal' })
  }

  const openQuoteModal = () => {
    if (!selectedCampaign) {
      showToast('견적을 요청하려면 현재 브랜드에 캠페인을 먼저 생성해주세요.')
      setModal({ type: 'create' })
      return
    }
    setModal({ type: 'quote' })
  }

  const openFulfillmentModal = (campaignOverride = selectedCampaign) => {
    if (!campaignOverride) {
      showToast('배송/수동 정산을 관리하려면 현재 브랜드에 캠페인을 먼저 생성해주세요.')
      setModal({ type: 'create' })
      return
    }

    const recruitedCreator =
      fulfillmentCreatorOptions.find((creator) => creator.id === selectedCreator?.id) ?? fulfillmentCreatorOptions[0]

    setFulfillmentDraft({
      ...createEmptyFulfillmentDraft(),
      campaignId: campaignOverride.id,
      creatorId: recruitedCreator?.id ?? '',
      recipient: recruitedCreator?.name ?? '',
      handle: recruitedCreator?.handle ?? '',
      accountHolder: recruitedCreator?.name ?? '',
    })
    setModal({ type: 'fulfillment' })
  }

  const exportPerformanceReport = () => {
    const rows = [
      [
        'campaign',
        'campaign_status',
        'creator',
        'handle',
        'platform',
        'category',
        'followers',
        'creator_average_views',
        'creator_engagement_rate',
        'creator_data_quality',
        'profile_url',
        'content_title',
        'url',
        'content_status',
        'views',
        'likes',
        'comments',
        'shares',
        'saves',
        'content_engagement_rate',
        'conversions',
        'last_checked',
      ],
      ...selectedCampaignTrackedPosts.map((post) => {
        const campaign = brandCampaigns.find((item) => item.id === post.campaignId)
        const creator = creators.find((item) => item.id === post.creatorId)
        return [
          campaign?.name ?? '',
          campaign?.status ?? '',
          creator?.name ?? '',
          creator?.handle ?? '',
          post.platform,
          creator?.category ?? '',
          creator?.followers ?? '',
          creator?.averageViews ?? '',
          creator ? percent(creator.engagement) : '',
          creator ? `${getCreatorDataQuality(creator).score}% ${getCreatorDataQuality(creator).level}` : '',
          creator?.profileUrl ?? '',
          post.title,
          post.url,
          post.status,
          post.views,
          post.likes,
          post.comments,
          post.shares,
          post.saves,
          percent(contentEngagementRate(post)),
          post.conversions,
          post.lastChecked,
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const reportName = selectedCampaign?.name ?? activeBrand.name
    const topPosts = [...selectedCampaignTrackedPosts]
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
      .slice(0, 3)
    const recruitedRows = selectedCampaignRecruitedPool
      .map((poolItem) => {
        const creator = creators.find((item) => item.id === poolItem.creatorId)
        const quality = getCreatorDataQuality(creator)
        return `<tr><td>${escapeXml(creator?.name ?? '')}</td><td>${escapeXml(creator?.handle ?? '')}</td><td>${escapeXml(creator?.platform ?? '')}</td><td>${escapeXml(creator ? compactNumber(creator.followers) : '-')}</td><td>${escapeXml(creator ? compactNumber(creator.averageViews) : '-')}</td><td>${escapeXml(creator ? percent(creator.engagement) : '-')}</td><td>${quality.score}% ${escapeXml(quality.level)}</td><td>${escapeXml(poolItem.status)}</td></tr>`
      })
      .join('')
    const topPostRows = topPosts
      .map((post) => {
        const creator = creators.find((item) => item.id === post.creatorId)
        return `<tr><td>${escapeXml(post.title)}</td><td>${escapeXml(creator?.name ?? '')}</td><td><a href="${escapeXml(post.url)}" target="_blank">${escapeXml(post.url)}</a></td><td>${escapeXml(compactNumber(post.views))}</td><td>${escapeXml(percent(contentEngagementRate(post)))}</td><td>${escapeXml(compactNumber(post.conversions))}</td></tr>`
      })
      .join('')
    const enrichedSummary = `<section class="block"><h2>Client Summary</h2><div class="metric"><strong>KPI progress</strong><span>${selectedCampaignKpi?.progress ?? 0}%</span></div><div class="metric"><strong>Recruited creators</strong><span>${selectedCampaignRecruitedPool.length}</span></div><div class="metric"><strong>Avg engagement</strong><span>${percent(selectedCampaignTrackedAverageEngagement)}</span></div><p class="sub">Report scope: ${escapeXml(reportName)} campaign. Recruitment, uploads, and performance are grouped by the selected campaign context.</p></section><section class="block"><h2>Approved Creator Pool</h2><table><thead><tr><th>creator</th><th>handle</th><th>platform</th><th>followers</th><th>average_views</th><th>engagement</th><th>data_quality</th><th>status</th></tr></thead><tbody>${recruitedRows || '<tr><td colspan="8">No recruited creator pool yet.</td></tr>'}</tbody></table></section><section class="block"><h2>Top Content</h2><table><thead><tr><th>content</th><th>creator</th><th>url</th><th>views</th><th>engagement</th><th>conversions</th></tr></thead><tbody>${topPostRows || '<tr><td colspan="6">No tracked content yet.</td></tr>'}</tbody></table></section><section class="block"><h2>Next Actions</h2><ul><li>Prioritize creators with high engagement-to-view efficiency for a second post or TikTok seller conversion.</li><li>Re-verify candidates below 72 data quality points with official APIs, profile snapshots, or upload links.</li><li>Before client delivery, fill missing upload links and refresh latest views/comments/shares.</li></ul></section>`
    const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>CreatorOps Performance Report</title><style>body{font-family:system-ui,sans-serif;margin:32px;color:#15201d}h1{margin-bottom:4px}.sub{color:#66736f;margin:0 0 22px}.metric{display:inline-block;min-width:140px;margin:0 10px 14px 0;padding:12px;border:1px solid #dce4e1;border-radius:8px;background:#f7faf9}.metric strong{display:block;color:#68736f;font-size:12px}.metric span{display:block;margin-top:5px;font-size:22px;font-weight:800}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #dce4e1;padding:8px;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#eef2f1}a{color:#0071e3}</style><h1>CreatorOps 성과 보고서</h1><p class="sub">${activeBrand.name} · ${reportName} · 업로드 인플루언서/계정/링크/성과 지표 상세</p><div class="metric"><strong>업로드 콘텐츠</strong><span>${selectedCampaignTrackedPosts.length}건</span></div><div class="metric"><strong>조회수</strong><span>${compactNumber(selectedCampaignTrackedTotals.views)}</span></div><div class="metric"><strong>댓글</strong><span>${compactNumber(selectedCampaignTrackedTotals.comments)}</span></div><div class="metric"><strong>공유</strong><span>${compactNumber(selectedCampaignTrackedTotals.shares)}</span></div><div class="metric"><strong>전환</strong><span>${compactNumber(selectedCampaignTrackedTotals.conversions)}</span></div><table><thead><tr>${rows[0].map((cell) => `<th>${escapeXml(cell)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr>${row.map((cell, index) => index === 10 || index === 12 ? `<td><a href="${escapeXml(cell)}" target="_blank">${escapeXml(cell)}</a></td>` : `<td>${escapeXml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></html>`
    exportFile(`creatorops-performance-report-${normalizeHandleSegment(reportName)}.csv`, 'text/csv;charset=utf-8', csv)
    const enrichedHtml = html.replace('<style>', '<style>.block{margin-top:28px}ul{padding-left:20px;line-height:1.7}').replace('</html>', `${enrichedSummary}</html>`)
    exportFile(`creatorops-performance-report-${normalizeHandleSegment(reportName)}.html`, 'text/html;charset=utf-8', enrichedHtml)
    showToast('성과 CSV와 HTML 보고서를 다운로드했어요.')
  }

  const getRecommendationRows = () => [
    [
      '순위',
      '추천 점수',
      '크리에이터',
      '핸들',
      '플랫폼',
      '카테고리',
      '팔로워',
      '평균 조회',
      '참여율',
      '예상 단가',
      '페르소나',
      '추천 이유',
      '리스크',
      '권장 연락 채널',
      '발송 방식',
      '데이터 상태',
      '수집 메모',
      '메시지 초안',
      '캠페인',
      '생성 시점',
    ],
    ...selectedCampaignRecommendations.map((recommendation, index) => {
      const creator = creators.find((item) => item.id === recommendation.creatorId)
      const campaign = brandCampaigns.find((item) => item.id === recommendation.campaignId)
      const friendlyMessage = creator
        ? buildFriendlyProposalMessage(creator, brandBrief, campaign ?? selectedCampaign)
        : recommendation.message
      const contactPlan = buildContactPlan(creator, getRecommendedContactChannelId(creator), friendlyMessage, campaign?.name)

      return [
        index + 1,
        recommendation.score,
        creator?.name ?? '',
        creator?.handle ?? '',
        creator?.platform ?? '',
        creator?.category ?? '',
        hasPendingMetrics(creator) ? '수집 필요' : creator?.followers ?? 0,
        hasPendingMetrics(creator) ? '수집 필요' : creator?.averageViews ?? 0,
        hasPendingMetrics(creator) ? '수집 필요' : creator?.engagement ?? 0,
        creator?.price || '산정 전',
        recommendation.persona,
        recommendation.reasons.join(' / '),
        recommendation.risk,
        contactPlan.label,
        contactPlan.deliveryMode,
        creator?.needsVerification ? '공개 수치 검증 대기' : '확인 데이터',
        creator?.sourceNote ?? '',
        friendlyMessage,
        campaign?.name ?? selectedCampaign?.name ?? '',
        recommendation.createdAt,
      ]
    }),
  ]

  const getDiscoveryRows = () => [
    [
      '크리에이터',
      '핸들',
      '플랫폼',
      '카테고리',
      '지역',
      '팔로워',
      '평균 조회',
      '참여율',
      '성장률',
      '매칭 점수',
      '브랜드 안정성',
      '가짜 팔로워 위험',
      '예상 단가',
      '오디언스',
      '상태',
      '키워드',
      '권장 연락 채널',
      '발송 방식',
      '데이터 상태',
      '수집 메모',
      '쇼트리스트',
      '제안 기록 수',
      '견적 기록 수',
    ],
    ...filteredCreators.map((creator) => {
      const contactPlan = buildContactPlan(creator)
      return [
        creator.name,
        creator.handle,
        creator.platform,
        creator.category,
        creator.city,
        hasPendingMetrics(creator) ? '수집 필요' : creator.followers,
        hasPendingMetrics(creator) ? '수집 필요' : creator.averageViews,
        hasPendingMetrics(creator) ? '수집 필요' : creator.engagement,
        creator.growth,
        creator.fit,
        creator.brandSafety,
        creator.fakeRisk,
        creator.price || '산정 전',
        creator.audience,
        creator.status,
        creator.topics.join(', '),
        contactPlan.label,
        contactPlan.deliveryMode,
        creator.needsVerification ? '공개 수치 검증 대기' : '확인 데이터',
        creator.sourceNote ?? '',
        shortlist.includes(creator.id) ? 'Y' : 'N',
        activeOutreach.filter((item) => item.creatorId === creator.id).length,
        activeQuotes.filter((item) => item.creatorId === creator.id).length,
      ]
    }),
  ]

  const buildAdvertiserListRows = (sourceType = 'recommendations') => {
    const selectedCampaignName = selectedCampaign?.name ?? brandBrief.product ?? '캠페인'
    const title = `${activeBrand.name}_${selectedCampaignName}_광고주 전달 리스트`
    const sourceItems =
      sourceType === 'pool'
        ? activeRecruitedPool
            .map((item) => {
              const creator = creators.find((creatorItem) => creatorItem.id === item.creatorId)
              const campaign = brandCampaigns.find((campaignItem) => campaignItem.id === item.campaignId) ?? selectedCampaign
              return creator ? { creator, campaign, note: item.note || '섭외 완료 후보' } : null
            })
            .filter(Boolean)
        : sourceType === 'discovery'
          ? filteredCreators.map((creator) => ({
              creator,
              campaign: selectedCampaign,
              note: creator.sourceNote || creator.status || '발굴 후보',
            }))
          : selectedCampaignRecommendations
              .map((recommendation) => {
                const creator = creators.find((creatorItem) => creatorItem.id === recommendation.creatorId)
                const campaign = brandCampaigns.find((campaignItem) => campaignItem.id === recommendation.campaignId) ?? selectedCampaign
                return creator
                  ? {
                      creator,
                      campaign,
                      note: recommendation.reasons?.slice(0, 2).join(' / ') || recommendation.persona,
                    }
                  : null
              })
              .filter(Boolean)

    const previousGroup = { value: '' }
    const rows = sourceItems.map(({ creator, campaign, note }, index) => {
      const combinedPrice = Math.max(1, Math.round(Number(creator.price || 0) / 10000))
      const shortsPrice = creator.platform === 'YouTube' ? Math.max(1, Math.round(combinedPrice * 0.72)) : ''
      const reelsPrice = creator.platform === 'Instagram' || creator.platform === 'TikTok'
        ? Math.max(1, Math.round(combinedPrice * 0.62))
        : Math.max(1, Math.round(combinedPrice * 0.52))
      const group = creator.followers >= 100000
        ? 'A\n(팔로워 10만+)'
        : creator.averageViews >= Math.max(creator.followers, 1)
          ? 'B\n(인게이지먼트 중심)'
          : 'C\n(브랜드 핏 추천)'
      const visibleGroup = previousGroup.value === group ? '' : group
      previousGroup.value = group
      const profileUrl = creator.profileUrl || getCreatorProfileUrl(creator, getRecommendedContactChannelId(creator))
      const schedule = campaign?.deadline && campaign.deadline !== '일정 미정'
        ? `${campaign.deadline} 전후 업로드 가능`
        : '추후협의 필요'
      const licensePrice = creator.price ? `${Math.max(20, Math.round(combinedPrice * 0.35))}만원` : '협의'
      const remarks = [
        creator.needsVerification ? '공개 수치 검증 대기' : '',
        note,
        creator.platform !== 'Instagram' ? `${creator.platform} 중심` : '',
      ].filter(Boolean).join(' / ')

      return [
        index + 1,
        visibleGroup,
        creator.category,
        normalizeHandleSegment(creator.handle) || creator.name,
        profileUrl,
        hasPendingMetrics(creator) ? '수집 필요' : Number(creator.followers || 0),
        hasPendingMetrics(creator) ? '수집 필요' : Number(creator.averageViews || 0),
        combinedPrice,
        shortsPrice,
        reelsPrice,
        licensePrice,
        schedule,
        remarks,
      ]
    })
    const numericRows = rows.filter((row) => typeof row[5] === 'number')
    const totalFollowers = numericRows.reduce((sum, row) => sum + Number(row[5] || 0), 0)
    const totalViews = numericRows.reduce((sum, row) => sum + Number(row[6] || 0), 0)
    const totalCombinedPrice = rows.reduce((sum, row) => sum + Number(row[7] || 0), 0)

    return [
      [title, '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['NO', '구분', '카테고리', '닉네임', '인스타주소', '팔로워수', '평균 조회수', '릴스+숏츠 단가', '숏츠단가', '릴스단가', '2차 라이센스 단가(6개월)', '진행일정', '비고'],
      ...rows,
      ['합계', '', '', '', '', totalFollowers, totalViews, totalCombinedPrice, '', '', '', '(단가 단위: 만원, 라이센스는 기본 6개월 기준)', ''],
    ]
  }

  const sendRowsToGoogleSheets = async (rows, label) => {
    const tsv = rowsToTsv(rows)
    const sheetWindow = window.open('https://sheets.new', '_blank')

    if (sheetWindow) {
      sheetWindow.opener = null
    }

    try {
      await navigator.clipboard.writeText(tsv)
      showToast(
        sheetWindow
          ? `${label} 데이터를 복사했어요. 새 Google Sheet에서 붙여넣기만 하면 됩니다.`
          : `${label} 데이터를 복사했어요. 팝업이 차단되면 sheets.new를 열어 붙여넣으면 됩니다.`,
      )
    } catch {
      exportFile(`${label}.tsv`, 'text/tab-separated-values;charset=utf-8', tsv)
      showToast(
        sheetWindow
          ? '클립보드 권한이 없어 TSV 파일로 내려받았어요. Google Sheet에 가져오면 됩니다.'
          : '클립보드 권한이 없어 TSV 파일로 내려받았어요. 팝업이 차단되면 sheets.new에서 가져오면 됩니다.',
      )
    }
  }

  const exportRecommendationsExcel = () => {
    exportExcelFile('creatorops-ai-recommendations.xls', 'AI 추천 리스트', getRecommendationRows())
    showToast('AI 추천 리스트를 엑셀로 다운로드했어요.')
  }

  const exportAdvertiserListExcel = (sourceType = 'recommendations') => {
    const label = sourceType === 'pool' ? '섭외완료' : sourceType === 'discovery' ? '발굴후보' : 'AI추천'
    exportExcelFile(
      `creatorops-advertiser-shortform-list-${label}.xls`,
      '리스트업A',
      buildAdvertiserListRows(sourceType),
    )
    showToast('광고주 전달용 숏폼 후보 리스트를 엑셀로 다운로드했어요.')
  }

  const sendRecommendationsToSheets = () => {
    sendRowsToGoogleSheets(getRecommendationRows(), 'AI 추천 리스트')
  }

  const exportDiscoveryExcel = () => {
    exportExcelFile('creatorops-creator-discovery.xls', '크리에이터 발굴', getDiscoveryRows())
    showToast('크리에이터 발굴 리스트를 엑셀로 다운로드했어요.')
  }

  const getCandidatePoolRows = () => [
    [
      '이름',
      '핸들',
      '플랫폼',
      '카테고리',
      '팔로워',
      '평균 조회',
      '참여율',
      '매칭 점수',
      '예상 단가',
      '브랜드 안정성',
      '가짜 팔로워 위험',
      '프로필 링크',
      '연락 링크',
      '권장 연락 채널',
      '발송 방식',
      '데이터 상태',
      '수집 메모',
      '현재 캠페인',
    ],
    ...candidatePoolCreators.map((creator) => {
      const channelId = getRecommendedContactChannelId(creator)
      const profileUrl = getCreatorProfileUrl(creator, channelId)
      const contactPlan = buildContactPlan(creator, channelId, '', selectedCampaign?.name)
      return [
        creator.name,
        creator.handle,
        creator.platform,
        creator.category,
        hasPendingMetrics(creator) ? '수집 필요' : creator.followers,
        hasPendingMetrics(creator) ? '수집 필요' : creator.averageViews,
        hasPendingMetrics(creator) ? '수집 필요' : creator.engagement,
        creator.fit,
        creator.price || '산정 전',
        creator.brandSafety,
        creator.fakeRisk,
        profileUrl || '링크 없음',
        contactPlan.url || profileUrl || '링크 없음',
        contactPlan.label,
        contactPlan.deliveryMode,
        creator.needsVerification ? '공개 수치 검증 대기' : '확인 데이터',
        creator.sourceNote ?? creator.status ?? '',
        selectedCampaign?.name ?? '캠페인 미선택',
      ]
    }),
  ]

  const exportCandidatePoolExcel = () => {
    exportExcelFile('creatorops-pre-outreach-pool.xls', '메시지 전 후보 풀', getCandidatePoolRows())
    showToast('메시지 전 후보 풀을 엑셀로 다운로드했어요.')
  }

  const getDmWorkRows = () => [
    [
      'Task No',
      'Status',
      'Campaign',
      'Creator',
      'Handle',
      'Platform',
      'Category',
      'Profile URL',
      'DM Message',
      'Operator Instruction',
      'Duplicate Status',
      'Followers',
      'Average Views',
      'Engagement',
      'Fit Score',
      'Work Note',
    ],
    ...selectedDmOutreachItems.map((item, index) => {
      const creator = creators.find((candidate) => candidate.id === item.creatorId)
      const campaign = brandCampaigns.find((candidate) => candidate.id === item.campaignId) ?? selectedCampaign
      const channelId = item.channel || getRecommendedContactChannelId(creator)
      const profileUrl = getCreatorProfileUrl(creator, channelId)
      const duplicate = hasDuplicateSentOutreach(item, outreach)
      return [
        index + 1,
        item.status,
        campaign?.name ?? 'No campaign',
        creator?.name ?? 'Unknown creator',
        creator?.handle ?? '',
        creator?.platform ?? channelId,
        creator?.category ?? '',
        profileUrl || 'Profile link required',
        item.message,
        'Copy message > open profile > send manually > mark sent in CreatorOps',
        duplicate ? 'BLOCKED: already sent for this campaign' : 'OK',
        creator ? (hasPendingMetrics(creator) ? 'Needs collection' : creator.followers) : '',
        creator ? (hasPendingMetrics(creator) ? 'Needs collection' : creator.averageViews) : '',
        creator?.engagement ?? '',
        creator?.fit ?? '',
        item.reason ?? '',
      ]
    }),
  ]

  const exportSelectedDmWorkExcel = () => {
    if (!selectedDmOutreachItems.length) {
      showToast('Select Instagram/TikTok DM candidates first.')
      return
    }
    exportExcelFile('creatorops-dm-work-queue.xls', 'DM Work Queue', getDmWorkRows())
    showToast('DM work Excel exported for ' + selectedDmOutreachItems.length + ' candidates.')
  }

  const sendDiscoveryToSheets = () => {
    sendRowsToGoogleSheets(getDiscoveryRows(), '크리에이터 발굴')
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
    setSelectedCampaignId(defaultWorkspace.campaigns.find((campaign) => campaign.brandId === defaultWorkspace.activeBrandId)?.id)
    setModal(null)
    showToast('데모 데이터로 초기화했어요.')
  }

  const openCampaign = (campaign) => {
    setSelectedCampaignId(campaign.id)
    setCampaignEditDraft(null)
    setModal({ type: 'campaign', campaignId: campaign.id })
  }

  const buildCampaignEditDraft = (campaign = {}) => ({
    name: campaign.name || '',
    product: campaign.product || '',
    objective: campaign.objective || '브랜드 인지도',
    campaignType: campaign.campaignType || '제안형',
    targetPersona: campaign.targetPersona || '',
    searchKeywords: campaign.searchKeywords || '',
    exclusionKeywords: campaign.exclusionKeywords || '',
    preferredPlatforms: campaign.preferredPlatforms || '',
    minFollowers: campaign.minFollowers ? String(campaign.minFollowers) : '',
    maxCreatorFee: campaign.maxCreatorFee ? String(campaign.maxCreatorFee) : '',
    budget: campaign.budget ? String(campaign.budget) : '',
    deadline: campaign.deadline || '',
    recruitStartDate: campaign.schedule?.recruitStart || '',
    recruitEndDate: campaign.schedule?.recruitEnd || '',
    uploadDueDate: campaign.schedule?.uploadDue || '',
    reportDueDate: campaign.schedule?.reportDue || '',
    kpiGoal: campaign.kpiGoal || '',
    sellerRecruitTarget: campaign.sellerRecruitTarget ? String(campaign.sellerRecruitTarget) : '',
    recommendationTargetCount: campaign.recommendationTargetCount ? String(campaign.recommendationTargetCount) : '',
    targetViews: campaign.targetViews ? String(campaign.targetViews) : '',
    targetConversions: campaign.targetConversions ? String(campaign.targetConversions) : '',
    targetOrders: campaign.targetOrders ? String(campaign.targetOrders) : '',
    targetRevenue: campaign.targetRevenue ? String(campaign.targetRevenue) : '',
    mission: campaign.mission || '',
    reward: campaign.reward || '',
    approvalFlow: campaign.approvalFlow || '',
    commerceMetric: campaign.commerceMetric || '',
  })

  const updateCampaignEditField = (field, value) => {
    setCampaignEditDraft((current) => ({
      ...(current || buildCampaignEditDraft(activeCampaignForModal)),
      [field]: value,
    }))
  }

  const saveCampaignEdit = () => {
    if (!activeCampaignForModal || !campaignEditDraft) return

    const nextBudget = Number(campaignEditDraft.budget) || activeCampaignForModal.budget
    const nextCampaign = {
      ...activeCampaignForModal,
      name: campaignEditDraft.name || activeCampaignForModal.name,
      product: campaignEditDraft.product || activeCampaignForModal.product,
      objective: campaignEditDraft.objective,
      campaignType: campaignEditDraft.campaignType,
      targetPersona: campaignEditDraft.targetPersona,
      searchKeywords: campaignEditDraft.searchKeywords,
      exclusionKeywords: campaignEditDraft.exclusionKeywords,
      preferredPlatforms: campaignEditDraft.preferredPlatforms,
      minFollowers: normalizeNumericTarget(campaignEditDraft.minFollowers),
      maxCreatorFee: normalizeNumericTarget(campaignEditDraft.maxCreatorFee),
      budget: nextBudget,
      spend: Math.min(activeCampaignForModal.spend || 0, nextBudget),
      deadline: campaignEditDraft.recruitEndDate || campaignEditDraft.deadline || activeCampaignForModal.deadline,
      schedule: {
        recruitStart: campaignEditDraft.recruitStartDate,
        recruitEnd: campaignEditDraft.recruitEndDate || campaignEditDraft.deadline,
        uploadDue: campaignEditDraft.uploadDueDate,
        reportDue: campaignEditDraft.reportDueDate,
      },
      kpiGoal: campaignEditDraft.kpiGoal,
      sellerRecruitTarget: Number(campaignEditDraft.sellerRecruitTarget) || 0,
      recommendationTargetCount: Number(campaignEditDraft.recommendationTargetCount) || 0,
      targetViews: normalizeNumericTarget(campaignEditDraft.targetViews),
      targetConversions: normalizeNumericTarget(campaignEditDraft.targetConversions),
      targetOrders: normalizeNumericTarget(campaignEditDraft.targetOrders),
      targetRevenue: normalizeNumericTarget(campaignEditDraft.targetRevenue),
      mission: campaignEditDraft.mission,
      reward: campaignEditDraft.reward,
      approvalFlow: campaignEditDraft.approvalFlow,
      commerceMetric: campaignEditDraft.commerceMetric,
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          campaigns: current.campaigns.map((campaign) =>
            campaign.id === activeCampaignForModal.id ? nextCampaign : campaign,
          ),
        },
        'campaign',
        `${nextCampaign.name} 캠페인 상세 수정`,
      ),
    )
    setCampaignEditDraft(null)
    showToast(`${nextCampaign.name} 캠페인 정보를 수정했어요.`)
  }

  const getCampaignContentGuide = (campaign) =>
    campaign?.generatedContentGuide ||
    buildInfluencerContentGuide({
      brand: activeBrand,
      brief: buildCampaignBriefFromCampaign(campaign),
      campaign,
      creators: getCreatorsByIds(creators, campaign?.creatorIds ?? []),
    })

  const buildCampaignBriefFromCampaign = (campaign = {}) => ({
    ...brandBrief,
    product: campaign.product || brandBrief.product,
    persona: campaign.targetPersona || brandBrief.persona,
    keywords: campaign.searchKeywords || brandBrief.keywords,
    exclusions: campaign.exclusionKeywords || brandBrief.exclusions,
    minFollowers: campaign.minFollowers || brandBrief.minFollowers,
    maxPrice: campaign.maxCreatorFee || brandBrief.maxPrice,
    platforms: campaign.preferredPlatforms ? keywordList(campaign.preferredPlatforms) : brandBrief.platforms,
    learningMaterials: getLearningMaterials(brandBrief),
  })

  const generateCampaignStrategyForDetail = (campaign) => {
    if (!campaign) return
    const campaignBrief = buildCampaignBriefFromCampaign(campaign)
    const strategy = buildInfluencerStrategy({
      brand: activeBrand,
      brief: campaignBrief,
      campaign,
      creators,
      recommendations: activeRecommendations,
      learningMaterials: campaignBrief.learningMaterials,
    })

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          campaigns: current.campaigns.map((item) =>
            item.id === campaign.id ? { ...item, influencerStrategy: strategy } : item,
          ),
        },
        'campaign',
        `${campaign.name} 인플루언서 전략 생성`,
      ),
    )
    showToast(`${campaign.name} 인플루언서 전략을 생성했어요.`)
  }

  const generateCampaignGuideForDetail = (campaign) => {
    if (!campaign) return
    const guide = buildInfluencerContentGuide({
      brand: activeBrand,
      brief: buildCampaignBriefFromCampaign(campaign),
      campaign,
      creators: getCreatorsByIds(creators, campaign.creatorIds ?? []),
    })

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          campaigns: current.campaigns.map((item) =>
            item.id === campaign.id ? { ...item, generatedContentGuide: guide } : item,
          ),
        },
        'campaign',
        `${campaign.name} 인플루언서 가이드 생성`,
      ),
    )
    showToast(`${campaign.name} 인플루언서 가이드를 생성했어요.`)
  }

  const downloadCampaignContentGuide = async (campaign, format = 'docx') => {
    if (!campaign) return
    const guide = getCampaignContentGuide(campaign)
    const filenameBase = `creatorops-${safeFilePart(activeBrand.name || 'brand')}-${safeFilePart(campaign.name || 'campaign')}-content-guide`

    if (format === 'pptx') {
      await exportGuidePptx(filenameBase, guide)
    } else if (format === 'google') {
      await openGuideGoogleDraft(guide)
    } else {
      await exportGuideDocx(filenameBase, guide)
    }

    showToast(format === 'google' ? `${campaign.name} 가이드를 복사하고 Google 문서를 열었어요.` : `${campaign.name} 콘텐츠 가이드를 ${format === 'pptx' ? 'PPT' : 'DOCX'}로 다운로드했어요.`)
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
    const campaignBrief = buildCampaignBriefFromDraft(campaignDraft)
    const nextCampaign = {
      id: createId(),
      brandId: activeBrand.id,
      name: campaignDraft.name || '신규 인플루언서 캠페인',
      owner: activeBrand.owner || activeBrand.name,
      status: '섭외',
      budget,
      spend: Math.min(Math.round(estimatedCost * 0.15), budget),
      revenue: Math.round(budget * 0.85),
      deadline: campaignDraft.recruitEndDate || campaignDraft.deadline || '일정 미정',
      schedule: {
        recruitStart: campaignDraft.recruitStartDate,
        recruitEnd: campaignDraft.recruitEndDate || campaignDraft.deadline,
        uploadDue: campaignDraft.uploadDueDate,
        reportDue: campaignDraft.reportDueDate,
      },
      product: campaignBrief.product,
      objective: campaignDraft.objective,
      campaignType: campaignDraft.campaignType || '제안형',
      targetPersona: campaignBrief.persona,
      searchKeywords: campaignBrief.keywords,
      exclusionKeywords: campaignBrief.exclusions,
      minFollowers: normalizeNumericTarget(campaignBrief.minFollowers),
      maxCreatorFee: normalizeNumericTarget(campaignBrief.maxPrice),
      preferredPlatforms: campaignBrief.platforms.join(', '),
      mission:
        campaignDraft.mission ||
        `${campaignBrief.product}를 ${campaignBrief.persona}에게 자연스럽게 소개하는 콘텐츠`,
      reward: campaignDraft.reward || '제품 제공 + 협의 리워드',
      approvalFlow: campaignDraft.approvalFlow || '브리프 전달 → 콘텐츠 검수 → 게시 확인 → 성과 리포트',
      commerceMetric: campaignDraft.commerceMetric || '조회/댓글/공유와 전환 링크',
      kpiGoal: campaignDraft.kpiGoal || '조회수/전환 KPI 미정',
      targetViews: normalizeNumericTarget(campaignDraft.targetViews),
      targetConversions: normalizeNumericTarget(campaignDraft.targetConversions),
      targetOrders: normalizeNumericTarget(campaignDraft.targetOrders),
      targetRevenue: normalizeNumericTarget(campaignDraft.targetRevenue),
      sellerRecruitTarget: Number(campaignDraft.sellerRecruitTarget) || 0,
      recommendationTargetCount: Number(campaignDraft.recommendationTargetCount) || 0,
      brandGuideAttachments: campaignDraft.brandGuideAttachments ?? [],
      guideSeedType: campaignDraft.guideSeedType,
      guideChannel: campaignDraft.guideChannel,
      oneMessage: campaignDraft.oneMessage,
      hookPoints: campaignDraft.hookPoints,
      influencerStrategy: campaignDraft.influencerStrategy,
      generatedContentGuide: campaignDraft.generatedContentGuide,
      progress: 12,
      creatorIds: [...shortlist],
      stages: [Math.max(18, shortlist.length * 8), 8, 3, 1],
      createdAt: nowLabel(),
    }

    updateWorkspace((current) => {
      const guideMaterials = campaignDraft.campaignGuideMaterials ?? []
      const nextBrands = guideMaterials.length
        ? current.brands.map((brand) => {
            if (brand.id !== activeBrand.id) return brand
            return {
              ...brand,
              brief: {
                ...brand.brief,
                learningMaterials: [...guideMaterials, ...getLearningMaterials(brand.brief)].slice(0, 80),
              },
            }
          })
        : current.brands

      return appendActivity(
        {
          ...current,
          brands: nextBrands,
          brandBrief:
            current.activeBrandId === current.brands[0]?.id && guideMaterials.length
              ? nextBrands.find((brand) => brand.id === activeBrand.id)?.brief ?? current.brandBrief
              : current.brandBrief,
          campaigns: [nextCampaign, ...current.campaigns],
        },
        'campaign',
        `${nextCampaign.name} 생성 · ${shortlist.length}명 배정 · 가이드 ${nextCampaign.brandGuideAttachments.length}개`,
      )
    })
    setSelectedCampaignId(nextCampaign.id)
    setCampaignDraft({
      name: '',
      budget: '',
      deadline: '',
      recruitStartDate: '',
      recruitEndDate: '',
      uploadDueDate: '',
      reportDueDate: '',
      product: '',
      objective: '브랜드 인지도',
      campaignType: '제안형',
      targetPersona: '',
      searchKeywords: '',
      exclusionKeywords: '',
      minFollowers: '',
      maxCreatorFee: '',
      preferredPlatforms: '',
      mission: '',
      reward: '',
      approvalFlow: '',
      commerceMetric: '',
      kpiGoal: '',
      targetViews: '',
      targetConversions: '',
      targetOrders: '',
      targetRevenue: '',
      recommendationTargetCount: '',
      sellerRecruitTarget: '',
      brandGuideAttachments: [],
      campaignGuideMaterials: [],
      guideSeedType: '무가시딩',
      guideChannel: 'Instagram Reels',
      oneMessage: '',
      hookPoints: '',
      influencerStrategy: '',
      generatedContentGuide: '',
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
      profileUrl: creatorDraft.profileUrl,
      contactEmail: creatorDraft.contactEmail,
      preferredContactChannel: creatorDraft.preferredContactChannel,
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
      contactEmail: '',
      profileUrl: '',
      preferredContactChannel: 'instagram_dm',
    })
    setSelectedCreatorId(nextCreator.id)
    setModal(null)
    showToast(`${nextCreator.name}을(를) 등록하고 저장했어요.`)
  }

  const sendProposal = (event) => {
    event.preventDefault()
    const campaign = selectedCampaign
    if (!campaign || !selectedCreator) {
      showToast('먼저 현재 브랜드에 캠페인을 만들어주세요.')
      return
    }
    const contactPlan = buildContactPlan(selectedCreator, proposalChannel, proposalText, campaign.name)
    const record = {
      id: createId(),
      creatorId: selectedCreator.id,
      campaignId: campaign.id,
      source: '수동',
      status: '승인 대기',
      channel: contactPlan.id,
      deliveryMode: contactPlan.deliveryMode,
      complianceNote: contactPlan.notice,
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
    showToast(`${selectedCreator.name} 제안 메시지를 검토함에 저장했어요.`)
  }

  const requestQuote = () => {
    const campaign = selectedCampaign
    if (!campaign || !selectedCreator) {
      showToast('먼저 현재 브랜드에 캠페인을 만들어주세요.')
      return
    }
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

  const mergeTrackingSnapshotDraft = (current, snapshot, url) => {
    const metrics = snapshot?.metrics || {}
    const inferredPlatform = snapshot?.platform || inferPlatformFromUrl(url) || current.platform
    const inferredHandle = snapshot?.handle || deriveHandleFromUrl(url)
    const inferredName = String(inferredHandle || '').replace(/^@/, '') || snapshot?.title || 'Public creator'

    return {
      ...current,
      platform: inferredPlatform,
      title: snapshot?.title || current.title,
      creatorId: current.creatorId || 'auto',
      creatorName: current.creatorName || inferredName,
      creatorHandle: current.creatorHandle || inferredHandle,
      creatorAvatar: current.creatorAvatar || snapshot?.image || '',
      creatorFollowers: metrics.followers ? String(metrics.followers) : current.creatorFollowers,
      profileUrl: current.profileUrl || snapshot?.profileUrl || snapshot?.authorUrl || url,
      snapshotSource: snapshot?.source || 'Public link snapshot',
      snapshotCheckedAt: nowLabel(),
      views: metrics.views ? String(metrics.views) : current.views,
      likes: metrics.likes ? String(metrics.likes) : current.likes,
      comments: metrics.comments ? String(metrics.comments) : current.comments,
      shares: metrics.shares ? String(metrics.shares) : current.shares,
      saves: metrics.saves ? String(metrics.saves) : current.saves,
    }
  }

  const importTrackingSnapshot = async () => {
    const url = trackingDraft.url.trim()
    if (!url) {
      showToast('Enter the uploaded content URL first.')
      return
    }

    try {
      setTrackingSnapshotLoading(true)
      const snapshot = await fetchPublicProfileSnapshot(url)
      if (!snapshot) {
        showToast('API server is required to read public content data.')
        return
      }

      setTrackingDraft((current) => mergeTrackingSnapshotDraft(current, snapshot, url))
      showToast('Public content data was added. Empty fields can be edited manually.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not read public content data.')
    } finally {
      setTrackingSnapshotLoading(false)
    }
  }

  const createTrackedPost = async (event) => {
    event.preventDefault()
    const campaignId = Number(trackingDraft.campaignId) || selectedCampaign?.id
    const uploadedUrl = trackingDraft.url.trim()

    if (!campaignId) {
      showToast('Select a campaign to track this content.')
      return
    }
    if (!uploadedUrl) {
      showToast('The uploaded content URL is required for tracking.')
      return
    }

    let effectiveDraft = trackingDraft
    if (!effectiveDraft.snapshotSource) {
      try {
        setTrackingSnapshotLoading(true)
        const snapshot = await fetchPublicProfileSnapshot(uploadedUrl)
        if (snapshot) {
          effectiveDraft = mergeTrackingSnapshotDraft(effectiveDraft, snapshot, uploadedUrl)
          setTrackingDraft(effectiveDraft)
        }
      } catch {
        effectiveDraft = {
          ...effectiveDraft,
          platform: effectiveDraft.platform || inferPlatformFromUrl(uploadedUrl) || 'Instagram',
          creatorHandle: effectiveDraft.creatorHandle || deriveHandleFromUrl(uploadedUrl),
          profileUrl: effectiveDraft.profileUrl || uploadedUrl,
        }
      } finally {
        setTrackingSnapshotLoading(false)
      }
    }

    const requestedCreatorId = Number(effectiveDraft.creatorId)
    const platform = effectiveDraft.platform || inferPlatformFromUrl(uploadedUrl) || 'Instagram'
    const handle = effectiveDraft.creatorHandle || deriveHandleFromUrl(effectiveDraft.profileUrl || uploadedUrl)
    const creatorName = effectiveDraft.creatorName || String(handle || '').replace(/^@/, '') || 'Public creator'
    const profileUrl = effectiveDraft.profileUrl || uploadedUrl
    const hasManualMetrics = [
      effectiveDraft.views,
      effectiveDraft.likes,
      effectiveDraft.comments,
      effectiveDraft.shares,
      effectiveDraft.saves,
      effectiveDraft.conversions,
    ].some((value) => String(value || '').trim())

    const savedPostTitle = effectiveDraft.title || 'New campaign content'
    let savedCreatorName = creatorName

    updateWorkspace((current) => {
      let creatorId = requestedCreatorId
      let nextCreators = current.creators

      if (!creatorId) {
        const normalizedProfileUrl = profileUrl.toLowerCase()
        const normalizedHandle = String(handle || '').toLowerCase()
        const existingCreator = current.creators.find((creator) => {
          const creatorProfileUrl = String(creator.profileUrl || creator.sourceUrl || '').toLowerCase()
          const creatorHandle = String(creator.handle || '').toLowerCase()
          return (
            (normalizedProfileUrl && creatorProfileUrl && creatorProfileUrl === normalizedProfileUrl) ||
            (normalizedHandle && creatorHandle && creatorHandle === normalizedHandle)
          )
        })

        if (existingCreator) {
          creatorId = existingCreator.id
          savedCreatorName = existingCreator.name
        } else {
          creatorId = createId()
          const followers = Number(effectiveDraft.creatorFollowers || 0)
          const views = Number(effectiveDraft.views || 0)
          const engagement = views
            ? Number((((Number(effectiveDraft.likes || 0) + Number(effectiveDraft.comments || 0)) / Math.max(views, 1)) * 100).toFixed(1))
            : 0
          const nextCreator = {
            id: creatorId,
            isDemo: false,
            name: creatorName,
            handle,
            avatar:
              effectiveDraft.creatorAvatar ||
              'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80',
            platform,
            profileUrl,
            contactEmail: '',
            preferredContactChannel: platform === 'YouTube' ? 'email' : platform === 'TikTok' ? 'tiktok_dm' : 'instagram_dm',
            category: '\uB9AC\uBDF0',
            country: activeBrand.country || 'KR',
            followers,
            averageViews: views,
            engagement,
            growth: 0,
            fit: 78,
            brandSafety: 80,
            fakeRisk: 0,
            cpm: 0,
            price: views ? Math.max(200000, Math.round(views * (platform === 'YouTube' ? 18 : 14))) : 0,
            audience: 'Content tracking URL import',
            city: '',
            lastPost: nowLabel(),
            status: 'Content uploaded',
            topics: [activeBrand.category || 'Campaign', platform],
            source: effectiveDraft.snapshotSource || 'Content tracking URL',
            sourceUrl: uploadedUrl,
            metricsPending: !followers && !views,
            needsVerification: !effectiveDraft.snapshotSource,
          }
          nextCreators = [nextCreator, ...current.creators]
          savedCreatorName = nextCreator.name
        }
      }

      const nextPost = {
        id: createId(),
        campaignId,
        creatorId,
        platform,
        title: savedPostTitle,
        url: uploadedUrl,
        status: hasManualMetrics ? '\uCD94\uC801 \uC911' : '\uC790\uB3D9 \uAC31\uC2E0 \uB300\uAE30',
        publishedAt: nowLabel(),
        views: Number(effectiveDraft.views) || 0,
        likes: Number(effectiveDraft.likes) || 0,
        comments: Number(effectiveDraft.comments) || 0,
        shares: Number(effectiveDraft.shares) || 0,
        saves: Number(effectiveDraft.saves) || 0,
        conversions: Number(effectiveDraft.conversions) || 0,
        metricsSource: effectiveDraft.snapshotSource || (hasManualMetrics ? '\uC218\uB3D9 \uC785\uB825' : '\uC5C5\uB85C\uB4DC \uB9C1\uD06C \uB4F1\uB85D'),
        lastChecked: effectiveDraft.snapshotCheckedAt || (hasManualMetrics ? nowLabel() : '\uC790\uB3D9 \uAC31\uC2E0 \uB300\uAE30'),
      }

      return appendActivity(
        {
          ...current,
          creators: nextCreators,
          trackedPosts: [nextPost, ...current.trackedPosts],
        },
        'tracking',
        savedPostTitle + ' content tracking registered - ' + savedCreatorName,
      )
    })

    setTrackingDraft({
      campaignId: '',
      creatorId: 'auto',
      platform: 'Instagram',
      title: '',
      url: '',
      creatorName: '',
      creatorHandle: '',
      creatorAvatar: '',
      creatorFollowers: '',
      profileUrl: '',
      snapshotSource: '',
      snapshotCheckedAt: '',
      views: '',
      likes: '',
      comments: '',
      shares: '',
      saves: '',
      conversions: '',
    })
    setModal(null)
    showToast('Content tracking was saved. New creators are added automatically from the link.')
  }

  const createFulfillmentRecord = (event) => {
    event.preventDefault()
    const campaignId = Number(fulfillmentDraft.campaignId) || selectedCampaign?.id
    const creatorId = Number(fulfillmentDraft.creatorId) || selectedCreator?.id
    const creator = creators.find((item) => item.id === creatorId)
    const paymentAmount = Number(String(fulfillmentDraft.paymentAmount || '').replace(/[^\d]/g, '')) || 0
    const recipient = fulfillmentDraft.recipient.trim() || creator?.name || ''

    if (!campaignId || !recipient) {
      showToast('캠페인과 수취인을 입력해야 배송/수동 정산 기록을 저장할 수 있어요.')
      return
    }

    const nextRecord = {
      id: createId(),
      campaignId,
      creatorId,
      paymentDate: fulfillmentDraft.paymentDate.trim() || nowLabel(),
      recipient,
      handle: fulfillmentDraft.handle.trim() || creator?.handle || '',
      phone: fulfillmentDraft.phone.trim(),
      address: fulfillmentDraft.address.trim(),
      bank: fulfillmentDraft.bank.trim(),
      accountNumber: fulfillmentDraft.accountNumber.trim(),
      accountHolder: fulfillmentDraft.accountHolder.trim() || recipient,
      paymentAmount,
      courier: fulfillmentDraft.courier.trim(),
      trackingNumber: fulfillmentDraft.trackingNumber.trim(),
      deliveryStatus: fulfillmentDraft.deliveryStatus,
      memo: fulfillmentDraft.memo.trim(),
      createdAt: nowLabel(),
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          fulfillmentRecords: [nextRecord, ...(current.fulfillmentRecords ?? [])],
        },
        'fulfillment',
        `${recipient} 배송/수동 정산 기록 저장 · ${won(paymentAmount)}`,
      ),
    )
    setFulfillmentDraft(createEmptyFulfillmentDraft())
    setModal(null)
    showToast('배송/수동 정산 기록을 저장했어요.')
  }

  const advanceFulfillmentStatus = (recordId) => {
    const currentRecord = fulfillmentRecords.find((item) => item.id === recordId)
    if (!currentRecord) return

    const currentIndex = deliveryStatusOptions.indexOf(currentRecord.deliveryStatus)
    const nextStatus = deliveryStatusOptions[Math.min(currentIndex + 1, deliveryStatusOptions.length - 1)]

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          fulfillmentRecords: (current.fulfillmentRecords ?? []).map((item) =>
            item.id === recordId ? { ...item, deliveryStatus: nextStatus } : item,
          ),
        },
        'fulfillment',
        `${currentRecord.recipient} 배송/수동 정산 상태 ${nextStatus}`,
      ),
    )
    showToast(`배송/수동 정산 상태를 ${nextStatus}로 업데이트했어요.`)
  }

  function applyEstimatedTrackingRefresh(post, isAuto) {
    const viewLift = Math.max(180, Math.round(post.views * 0.08))
    return {
      ...post,
      views: post.views + viewLift,
      likes: post.likes + Math.round(viewLift * 0.045),
      comments: post.comments + Math.round(viewLift * 0.004),
      shares: post.shares + Math.round(viewLift * 0.006),
      saves: post.saves + Math.round(viewLift * 0.01),
      conversions: post.conversions + Math.round(viewLift * 0.0018),
      metricsSource: isAuto ? '일일 추정 갱신' : '즉시 추정 갱신',
      lastChecked: nowLabel(),
    }
  }

  async function refreshTracking({ mode = 'manual' } = {}) {
    const isAuto = mode === 'daily-auto'
    const targetPosts = selectedCampaignTrackedPosts.length ? selectedCampaignTrackedPosts : trackedPosts

    if (backendConfig.apiBaseUrl && targetPosts.length) {
      try {
        const payload = await refreshContentMetrics(targetPosts)
        const refreshed = Array.isArray(payload?.posts) ? payload.posts : []
        const refreshedById = new Map(refreshed.map((post) => [post.id, post]))

        updateWorkspace((current) =>
          appendActivity(
            {
              ...current,
              trackedPosts: current.trackedPosts.map((post) => {
                const next = refreshedById.get(post.id)
                if (!next || next.status === 'manual_required' || next.status === 'unsupported') {
                  return {
                    ...post,
                    metricsSource: next?.message || post.metricsSource || '수동 확인 필요',
                    lastChecked: nowLabel(),
                  }
                }
                return {
                  ...post,
                  views: Number(next.views ?? post.views),
                  likes: Number(next.likes ?? post.likes),
                  comments: Number(next.comments ?? post.comments),
                  shares: Number(next.shares ?? post.shares),
                  saves: Number(next.saves ?? post.saves),
                  metricsSource: next.source || '공식 API 갱신',
                  lastChecked: nowLabel(),
                }
              }),
            },
            'tracking',
            isAuto ? '콘텐츠 성과 일일 공식 API 갱신' : '콘텐츠 성과 공식 API 즉시 갱신',
          ),
        )
        window.localStorage.setItem(TRACKING_DAILY_REFRESH_KEY, new Date().toISOString().slice(0, 10))
        if (!isAuto) {
          showToast(`성과 데이터 ${refreshed.length}건을 갱신했어요. Instagram/TikTok은 수동 확인이 필요할 수 있어요.`)
        }
        return
      } catch (error) {
        if (!isAuto) {
          showToast(error instanceof Error ? `API 갱신 실패: ${error.message}` : 'API 갱신 실패로 추정 갱신을 적용합니다.')
        }
      }
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          trackedPosts: current.trackedPosts.map((post) => applyEstimatedTrackingRefresh(post, isAuto)),
        },
        'tracking',
        isAuto ? '콘텐츠 성과 일일 자동 갱신' : '콘텐츠 성과 즉시 갱신',
      ),
    )
    window.localStorage.setItem(TRACKING_DAILY_REFRESH_KEY, new Date().toISOString().slice(0, 10))
    if (!isAuto) {
      showToast('콘텐츠 조회수, 댓글, 공유 데이터를 즉시 갱신했어요.')
    }
  }

  const copyOutreachMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message)
      showToast('제안 메시지를 복사했어요. DM 수동 발송 시 그대로 붙여넣으면 됩니다.')
    } catch {
      showToast('클립보드 권한이 없어 복사하지 못했어요. 메시지 검토함에서 직접 선택해 복사해주세요.')
    }
  }

  const connectGmail = async () => {
    if (!backendConfig.apiBaseUrl) {
      showToast('Gmail needs the CreatorOps API server.')
      return
    }

    try {
      const apiBaseUrl = backendConfig.apiBaseUrl.replace(/\/$/, '')
      const response = await fetch(apiBaseUrl + '/oauth/google/auth-url?state=creatorops-gmail')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.data?.url) throw new Error(payload?.message || 'Failed to create Gmail authorization URL.')
      window.location.href = payload.data.url
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start Gmail connection.')
    }
  }

  const disconnectGmail = () => {
    window.localStorage.removeItem(GMAIL_AUTH_STORE_KEY)
    setGmailAuth(null)
    showToast('Gmail disconnected.')
  }

  const sendSelectedOutreachEmails = async () => {
    if (!selectedOutreachItems.length) {
      showToast('Select messages to send first.')
      return
    }
    if (!selectedEmailOutreachItems.length) {
      showToast('No selected item has a verified email. Use copy/profile open for DM candidates.')
      return
    }
    if (!backendConfig.apiBaseUrl) {
      showToast('Gmail needs the CreatorOps API server.')
      return
    }
    if (!gmailConnected) {
      showToast('Connect Gmail first.')
      return
    }

    setGmailSending(true)
    const apiBaseUrl = backendConfig.apiBaseUrl.replace(/\/$/, '')
    const sentIds = []
    const failures = []

    for (let index = 0; index < selectedEmailOutreachItems.length; index += 1) {
      const item = selectedEmailOutreachItems[index]
      const creator = creators.find((candidate) => candidate.id === item.creatorId)
      const campaign = brandCampaigns.find((candidate) => candidate.id === item.campaignId)

      if (hasDuplicateSentOutreach(item, outreach)) {
        failures.push({ item, message: 'Duplicate send blocked for this campaign and creator.' })
        continue
      }

      if (sentIds.length > 0) {
        const delayMs = randomSendDelayMs()
        showToast(`Waiting ${Math.round(delayMs / 1000)}s before the next Gmail send.`)
        await wait(delayMs)
      }

      try {
        const response = await fetch(apiBaseUrl + '/outreach/gmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: gmailAuth.accessToken,
            to: creator?.contactEmail,
            subject: `${campaign?.name || 'Brand campaign'} collaboration proposal`,
            message: item.message,
          }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || 'Gmail send failed')
        sentIds.push(item.id)
      } catch (error) {
        failures.push({ item, message: error instanceof Error ? error.message : 'Send failed' })
      }
    }

    setGmailSending(false)

    if (failures.some((failure) => /accessToken|token|401|invalid/i.test(failure.message))) {
      window.localStorage.removeItem(GMAIL_AUTH_STORE_KEY)
      setGmailAuth(null)
    }

    if (sentIds.length) {
      const selectedIds = new Set(sentIds)
      const eventTime = nowLabel()
      updateWorkspace((current) =>
        appendActivity(
          {
            ...current,
            outreach: current.outreach.map((outreachItem) =>
              selectedIds.has(outreachItem.id)
                ? { ...outreachItem, status: '\uBC1C\uC1A1 \uC644\uB8CC', sentAt: outreachItem.sentAt || eventTime, deliveryMode: 'Gmail API send' }
                : outreachItem,
            ),
          },
          'outreach',
          `Sent ${sentIds.length} outreach messages via Gmail API`,
        ),
      )
      setSelectedOutreachIds((current) => current.filter((id) => !selectedIds.has(id)))
    }

    if (failures.length) {
      showToast(`Gmail send: ${sentIds.length} succeeded, ${failures.length} failed: ${failures[0].message}`)
    } else {
      showToast(`Gmail send completed for ${sentIds.length} messages.`)
    }
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

  const startDmBulkMode = () => {
    if (!selectedDmOutreachItems.length) {
      showToast('Select Instagram/TikTok DM candidates first.')
      return
    }
    setModal({ type: 'dmBulk', ids: selectedDmOutreachItems.map((item) => item.id), index: 0 })
  }

  const moveDmBulk = (offset) => {
    setModal((current) => {
      if (current?.type !== 'dmBulk') return current
      const ids = current.ids ?? []
      const nextIndex = Math.min(Math.max(Number(current.index || 0) + offset, 0), Math.max(ids.length - 1, 0))
      return { ...current, index: nextIndex }
    })
  }

  const markDmBulkSentAndNext = (itemId) => {
    markOutreachSent(itemId)
    setSelectedOutreachIds((current) => current.filter((id) => id !== itemId))
    if (activeDmBulkIndex >= activeDmBulkItems.length - 1) {
      setModal(null)
      showToast('DM work queue completed.')
      return
    }
    moveDmBulk(1)
  }
  const toggleOutreachSelection = (itemId) => {
    setSelectedOutreachIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    )
  }

  const toggleAllOutreachItems = () => {
    const visibleIds = filteredCampaignOutreach.map((item) => item.id)
    setSelectedOutreachIds((current) =>
      allOutreachSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    )
  }

  const markSelectedOutreachSent = () => {
    if (!selectedOutreachItems.length) {
      showToast('Select messages to mark as sent first.')
      return
    }

    const allowedItems = selectedOutreachItems.filter((item) => !hasDuplicateSentOutreach(item, outreach))
    const blockedCount = selectedOutreachItems.length - allowedItems.length
    if (!allowedItems.length) {
      showToast('All selected messages were blocked as duplicate sends.')
      return
    }

    const selectedIds = new Set(allowedItems.map((item) => item.id))
    const eventTime = nowLabel()
    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: current.outreach.map((item) =>
            selectedIds.has(item.id)
              ? { ...item, status: '\uBC1C\uC1A1 \uC644\uB8CC', sentAt: item.sentAt || eventTime }
              : item,
          ),
        },
        'outreach',
        `Marked ${selectedIds.size} outreach messages as sent`,
      ),
    )
    setSelectedOutreachIds([])
    showToast(blockedCount ? `Marked ${selectedIds.size}; blocked ${blockedCount} duplicate sends.` : `Marked ${selectedIds.size} messages as sent.`)
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

  const saveOutreachResponseNote = (itemId) => {
    const note = outreachResponseNote.trim()
    if (!note) {
      showToast('저장할 응답 메모를 입력해주세요.')
      return
    }

    const eventTime = nowLabel()
    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: current.outreach.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  responseNote: note,
                  responseAt: item.responseAt || eventTime,
                  updatedAt: eventTime,
                  outreachEvents: [
                    ...(item.outreachEvents ?? []),
                    {
                      id: createId(),
                      type: 'note',
                      label: '응답 메모',
                      detail: note,
                      createdAt: eventTime,
                    },
                  ],
                }
              : item,
          ),
        },
        'outreach',
        '인플루언서 응답 메모 저장',
      ),
    )
    showToast('응답 메모와 로그를 저장했어요.')
  }

  const openOutreachDetail = (itemId) => {
    const item = activeOutreach.find((outreachItem) => outreachItem.id === itemId)
    setOutreachResponseNote(item?.responseNote ?? '')
    setModal({ type: 'outreachDetail', itemId })
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
              channel: outreachItem.channel ?? getRecommendedContactChannelId(creator),
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

  const saveContentReference = async (event) => {
    event.preventDefault()

    if (!selectedCampaign) {
      showToast('레퍼런스를 묶을 캠페인을 먼저 선택하세요.')
      return
    }

    if (!referenceDraft.url.trim()) {
      showToast('저장할 레퍼런스 링크를 먼저 입력해주세요.')
      return
    }

    let snapshot = null
    try {
      snapshot = await fetchPublicProfileSnapshot(referenceDraft.url.trim())
    } catch (error) {
      showToast(error instanceof Error ? `자동 수집 실패: ${error.message}` : '자동 수집에 실패했지만 입력값으로 저장합니다.')
    }

    const metrics = snapshot?.metrics || {}
    const autoTitle = snapshot?.title || ''
    const autoDescription = snapshot?.description || ''
    const autoPlatform = snapshot?.platform || inferPlatformFromUrl(referenceDraft.url) || referenceDraft.platform
    const autoMediaType = snapshot?.mediaType || inferMediaTypeFromUrl(referenceDraft.url, autoPlatform) || referenceDraft.mediaType

    const nextReference = {
      id: createId(),
      campaignId: selectedCampaign.id,
      mediaType: autoMediaType,
      platform: autoPlatform,
      country: referenceDraft.country || 'KR',
      title: referenceDraft.title.trim() || autoTitle || '링크 저장 레퍼런스',
      url: referenceDraft.url.trim(),
      thumbnailUrl: referenceDraft.thumbnailUrl.trim() || snapshot?.image || '',
      views: Number(referenceDraft.views || metrics.views || 0),
      accountFollowers: Number(referenceDraft.accountFollowers || metrics.followers || 0),
      likes: Number(referenceDraft.likes || metrics.likes || 0),
      comments: Number(referenceDraft.comments || metrics.comments || 0),
      shares: Number(referenceDraft.shares || metrics.shares || 0),
      publishedAt: referenceDraft.publishedAt || snapshot?.publishedAt || (snapshot ? '자동 수집' : '링크 저장'),
      hook: referenceDraft.hook.trim(),
      analysis: referenceDraft.analysis.trim() || autoDescription,
      applyIdea: referenceDraft.applyIdea.trim(),
      source: snapshot?.source || 'Manual link save',
      confidence: snapshot?.confidence || 40,
      savedAt: nowLabel(),
    }

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          contentReferences: [nextReference, ...(current.contentReferences ?? [])],
        },
        'reference',
        `${selectedCampaign.name} 콘텐츠 레퍼런스 저장 · ${nextReference.mediaType} · ${nextReference.platform}`,
      ),
    )
    setReferenceDraft({
      mediaType: '영상',
      platform: 'TikTok',
      country: 'KR',
      title: '',
      url: '',
      thumbnailUrl: '',
      views: '',
      accountFollowers: '',
      likes: '',
      comments: '',
      shares: '',
      publishedAt: '',
      hook: '',
      analysis: '',
      applyIdea: '',
    })
    showToast(snapshot ? '링크 정보를 자동 수집해서 레퍼런스로 저장했어요.' : '자동 수집 없이 입력값으로 레퍼런스를 저장했어요.')
  }

  const importReferenceSnapshot = async () => {
    const url = referenceDraft.url.trim()
    if (!url) {
      showToast('값을 가져올 레퍼런스 링크를 먼저 입력해주세요.')
      return
    }

    try {
      const snapshot = await fetchPublicProfileSnapshot(url)
      if (!snapshot) {
        showToast('API 서버가 연결되어야 공개 레퍼런스 값을 가져올 수 있어요.')
        return
      }

      const metrics = snapshot.metrics || {}
      const inferredPlatform = snapshot.platform || inferPlatformFromUrl(url) || 'Other'
      const inferredMediaType = snapshot.mediaType || inferMediaTypeFromUrl(url, inferredPlatform) || '영상'
      setReferenceDraft((current) => ({
        ...current,
        mediaType: inferredMediaType,
        platform: inferredPlatform,
        title: snapshot.title || current.title,
        thumbnailUrl: snapshot.image || current.thumbnailUrl,
        views: metrics.views ? String(metrics.views) : '',
        accountFollowers: metrics.followers ? String(metrics.followers) : '',
        likes: metrics.likes ? String(metrics.likes) : '',
        comments: metrics.comments ? String(metrics.comments) : '',
        shares: metrics.shares ? String(metrics.shares) : '',
        analysis: snapshot.description || current.analysis,
        publishedAt: snapshot.publishedAt || '공개 스냅샷 수집',
      }))

      showToast('공개 레퍼런스 값을 가져왔어요. 공개되지 않은 지표는 비워둘게요.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '레퍼런스 값을 가져오지 못했어요.')
    }
  }

  const applyReferenceSearch = async (event) => {
    event.preventDefault()
    const query = referenceFilters.query.trim()
    setReferencePage(1)
    setReferenceSearchResultUrls([])
    setReferenceFilters((current) => ({
      ...current,
      appliedQuery: '',
    }))

    if (!query) {
      setReferenceSearchStatus({ mode: 'idle', message: '' })
      showToast('전체 레퍼런스를 표시합니다.')
      return
    }

    if (!selectedCampaign) {
      showToast('레퍼런스를 저장할 캠페인을 먼저 선택하세요.')
      return
    }

    try {
      setReferenceSearchStatus({ mode: 'loading', message: '인기 콘텐츠 레퍼런스를 검색 중입니다.' })
      const payload = await searchContentReferences({
        query,
        country: referenceFilters.country === '전체' ? activeBrand.country || 'KR' : referenceFilters.country,
        platform: referenceFilters.platform === '전체' ? 'all' : referenceFilters.platform,
        sort: referenceFilters.sort,
        maxResults: Math.min(Math.max(Number(referenceFilters.maxResults) || 36, 1), 100),
      })

      if (!payload) {
        setReferenceSearchStatus({
          mode: 'error',
          message: 'API 서버 연결 후 실제 레퍼런스 검색을 실행할 수 있어요.',
        })
        return
      }

      const incoming = normalizeContentReferences(
        (payload.references || []).map((item, index) => ({
          ...item,
          id: item.id || `reference-${createId()}-${index}`,
          campaignId: selectedCampaign.id,
          country: item.country || referenceFilters.country || activeBrand.country || 'KR',
          mediaType: item.mediaType || '영상',
          platform: item.platform || 'YouTube',
          savedAt: nowLabel(),
        })),
      )
      const resultUrls = incoming.map((item) => item.url).filter(Boolean)
      const existingUrls = new Set((contentReferences ?? []).map((item) => String(item.url || '').toLowerCase()))
      const newCount = incoming.filter((item) => !existingUrls.has(String(item.url || '').toLowerCase())).length

      updateWorkspace((current) => {
        const existingUrls = new Set((current.contentReferences ?? []).map((item) => String(item.url || '').toLowerCase()))
        const freshReferences = incoming.filter((item) => !existingUrls.has(String(item.url || '').toLowerCase()))
        return appendActivity(
          {
            ...current,
            contentReferences: [...freshReferences, ...(current.contentReferences ?? [])],
          },
          'reference',
          `${selectedCampaign.name} 레퍼런스 검색 · ${query} · ${freshReferences.length}개 추가`,
        )
      })

      setReferencePage(1)
      setReferenceSearchResultUrls(resultUrls)
      setReferenceFilters((current) => ({
        ...current,
        appliedQuery: '',
      }))
      setReferenceSearchStatus({
        mode: 'success',
        message: `${incoming.length}개 검색, 중복 제외 후 ${newCount}개 새 레퍼런스를 추가했습니다.`,
      })
      showToast(`${incoming.length}개 레퍼런스를 검색했어요. 새로 추가된 항목은 ${newCount}개입니다.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '레퍼런스 검색에 실패했어요.'
      setReferenceSearchStatus({ mode: 'error', message })
      showToast(message)
    }
  }

  const resetReferenceSearch = () => {
    setReferencePage(1)
    setReferenceSearchResultUrls(null)
    setReferenceFilters({
      query: '',
      appliedQuery: '',
      country: '전체',
      mediaType: '전체',
      platform: '전체',
      sort: 'virality',
      maxResults: '36',
    })
    setReferenceSearchStatus({ mode: 'idle', message: '' })
    showToast('레퍼런스 필터를 초기화했어요.')
  }

  const toggleProductionReference = (referenceId) => {
    const reference = contentReferences.find((item) => item.id === referenceId)
    updateWorkspace((current) => {
      const exists = current.savedProductionReferenceIds?.includes(referenceId)
      return appendActivity(
        {
          ...current,
          savedProductionReferenceIds: exists
            ? current.savedProductionReferenceIds.filter((id) => id !== referenceId)
            : [...(current.savedProductionReferenceIds ?? []), referenceId],
        },
        'reference',
        exists ? `제작 레퍼런스 저장 해제 · ${reference?.title ?? referenceId}` : `제작 레퍼런스 저장 · ${reference?.title ?? referenceId}`,
      )
    })
    showToast(
      savedProductionReferenceIds.includes(referenceId)
        ? '제작 레퍼런스 저장을 해제했어요.'
        : '제작 레퍼런스로 저장했어요.',
    )
  }

  const borrowReferenceForGuide = (reference) => {
    if (!reference) return

    const material = buildProductionReferenceMaterial(reference, brandBrief, selectedCampaign)

    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          brands: current.brands.map((brand) =>
            brand.id === activeBrand.id
              ? {
                  ...brand,
                  brief: {
                    ...brand.brief,
                    learningMaterials: [material, ...getLearningMaterials(brand.brief)].slice(0, 80),
                  },
                }
              : brand,
          ),
        },
        'reference',
        `${reference.title} 제작 레퍼런스를 브랜드 학습자료에 차용`,
      ),
    )
    showToast('제작 레퍼런스를 브랜드 학습자료에 차용했어요.')
  }

  const activeCampaignForModal =
    modal?.type === 'campaign'
      ? brandCampaigns.find((campaign) => campaign.id === modal.campaignId)
      : selectedCampaign
  const campaignModalPool = activeCampaignForModal
    ? activeRecruitedPool.filter((item) => item.campaignId === activeCampaignForModal.id)
    : []
  const campaignModalFulfillment = activeCampaignForModal
    ? activeFulfillmentRecords.filter((item) => item.campaignId === activeCampaignForModal.id)
    : []
  const campaignModalFulfillmentAmount = campaignModalFulfillment.reduce(
    (sum, item) => sum + Number(item.paymentAmount || 0),
    0,
  )
  const campaignModalTrackedPosts = activeCampaignForModal
    ? activeTrackedPosts.filter((post) => post.campaignId === activeCampaignForModal.id)
    : []
  const campaignModalTrackedTotals = campaignModalTrackedPosts.reduce(
    (summary, post) => ({
      views: summary.views + Number(post.views || 0),
      likes: summary.likes + Number(post.likes || 0),
      comments: summary.comments + Number(post.comments || 0),
      shares: summary.shares + Number(post.shares || 0),
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  )
  const campaignModalAverageEngagement = campaignModalTrackedTotals.views
    ? (campaignModalTrackedTotals.likes + campaignModalTrackedTotals.comments + campaignModalTrackedTotals.shares) /
      campaignModalTrackedTotals.views
    : 0
  const campaignModalKpi = campaignKpiSummaries.find((summary) => summary.campaignId === activeCampaignForModal?.id)

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

        <div className="brand-switcher">
          <div className="brand-switcher-head">
            <span className="mini-label">Brand Workspace</span>
            <button className="icon-button mini-icon-button" type="button" title="브랜드 추가" onClick={() => setModal({ type: 'brand' })}>
              <Plus size={15} />
            </button>
          </div>
          <label>
            <span>관리 브랜드</span>
            <select value={activeBrand.id} onChange={(event) => switchBrand(event.target.value)}>
              {accessibleBrands.map((brand) => (
                <option value={brand.id} key={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <p>{team.name} · {currentAccount.name} · {currentRole.label}</p>
        </div>

        <nav className="nav-list" aria-label="주요 메뉴">
          <NavButton
            active={visibleSection === 'dashboard'}
            icon={<LayoutDashboard size={18} />}
            label="대시보드"
            onClick={() => jumpTo('dashboard')}
          />
          {canAccessSection('campaigns') && (
            <NavButton
              active={visibleSection === 'campaigns'}
              icon={<Target size={18} />}
              label="캠페인"
              onClick={() => jumpTo('campaigns')}
            />
          )}
          {canAccessSection('discovery') && (
            <NavButton
              active={visibleSection === 'discovery'}
              icon={<UsersRound size={18} />}
              label="발굴"
              onClick={() => jumpTo('discovery')}
            />
          )}
          {canAccessSection('messages') && (
            <NavButton
              active={visibleSection === 'messages'}
              icon={<MessageSquare size={18} />}
              label="메시지"
              onClick={() => jumpTo('messages')}
            />
          )}
          {canAccessSection('report') && (
            <NavButton
              active={visibleSection === 'report'}
              icon={<BarChart3 size={18} />}
              label="리포트"
              onClick={() => jumpTo('report')}
            />
          )}
          {canAccessSection('references') && (
            <NavButton
              active={visibleSection === 'references'}
              icon={<ImageIcon size={18} />}
              label="레퍼런스"
              onClick={() => jumpTo('references')}
            />
          )}
          {canAccessSection('dataRoom') && (
            <NavButton
              active={visibleSection === 'dataRoom'}
              icon={<Database size={18} />}
              label="데이터룸"
              onClick={() => jumpTo('dataRoom')}
            />
          )}
        </nav>

        <div className="team-block">
          <span className="mini-label">Team Access</span>
          <strong>{accounts.length}개 계정 · {accessibleBrands.length}개 브랜드 접근</strong>
          <div className="team-meter">
            <span style={{ width: `${Math.min(40 + accounts.length * 12 + accessibleBrands.length * 8, 94)}%` }} />
          </div>
          <p>{currentRole.description}</p>
        </div>
        <div className="sidebar-bottom-actions">
          <button
            className={`sidebar-settings-button ${visibleSection === 'settings' ? 'active' : ''}`}
            type="button"
            title="??"
            aria-label="??"
            onClick={() => jumpTo('settings')}
          >
            <Settings size={19} />
          </button>
          <div className="legal-links" aria-label="Legal links">
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
            <span>·</span>
            <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar" id="dashboard">
          <div>
            <span className="eyebrow">{pageMeta.eyebrow}</span>
            <h1>{pageMeta.title}</h1>
            <p className="topbar-subtitle">{pageMeta.description}</p>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button" title="검색 초기화" onClick={resetSearch}>
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" type="button" title="데이터 관리" onClick={() => setModal({ type: 'data' })}>
              <Database size={18} />
            </button>
          </div>
        </header>

        {['discovery', 'messages', 'report'].includes(visibleSection) && (
          <section className="campaign-context-bar" aria-label="현재 작업 캠페인">
            <div className="campaign-context-main">
              <span className="mini-label">Campaign Context</span>
              <label>
                <Target size={16} />
                <select
                  value={selectedCampaign?.id ?? ''}
                  onChange={(event) => setSelectedCampaignId(Number(event.target.value))}
                  disabled={!brandCampaigns.length}
                >
                  {brandCampaigns.length === 0 ? (
                    <option value="">캠페인 없음</option>
                  ) : (
                    brandCampaigns.map((campaign) => (
                      <option value={campaign.id} key={campaign.id}>
                        {campaign.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <p>
                {selectedCampaign
                  ? `${selectedCampaign.status} · ${selectedCampaign.owner} · 마감 ${selectedCampaign.deadline}`
                  : '발굴, 메시지, 리포트를 묶을 캠페인을 먼저 생성해주세요.'}
              </p>
            </div>
            <div className="campaign-context-metrics">
              <Stat label={'AI \uCD94\uCC9C'} value={`${selectedCampaignRecommendations.length}/${getCampaignRecommendationTarget(selectedCampaign)}\uBA85`} />
              <Stat label="메시지" value={`${selectedCampaignOutreach.length}건`} />
              <Stat label="업로드" value={`${selectedCampaignTrackedPosts.length}건`} />
              <Stat label="섭외완료" value={`${selectedCampaignRecruitedPool.length}명`} />
            </div>
            <div className="campaign-context-actions">
              <button className="secondary-button compact-button" type="button" onClick={() => setModal({ type: 'create' })}>
                <Plus size={15} />
                캠페인 생성
              </button>
              {selectedCampaign && (
                <button className="primary-button compact-button" type="button" onClick={() => openCampaign(selectedCampaign)}>
                  열기
                </button>
              )}
            </div>
          </section>
        )}

        {visibleSection === 'dashboard' && (
          <>
            <section className="workflow-strip" aria-label="인플루언서 운영 흐름">
              {workflowSignals.map((signal) => (
                <WorkflowSignal key={signal.label} signal={signal} />
              ))}
            </section>

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
                delta={`${activeQuotes.length}건 견적`}
                detail="현재 검색 결과"
              />
              <MetricCard
                icon={<WalletCards size={19} />}
                label="섭외 완료 풀"
                value={`${totals.roi.toFixed(2)}x`}
                delta={`${activeRecruitedPool.length}명 저장`}
                detail={won(totals.revenue)}
              />
            </section>
          </>
        )}

        {visibleSection === 'dataRoom' && (
          <AdminDataRoom
            summary={dataRoomSummary}
            rawData={filteredDataRoomRawData}
            groupedMetrics={groupedDataRoomMetrics}
            workflowCoverage={dataRoomWorkflowCoverage}
            pendingBundles={dataRoomPendingBundles}
            rawTab={dataRoomRawTab}
            setRawTab={setDataRoomRawTab}
            rawStatus={dataRoomRawStatus}
            setRawStatus={setDataRoomRawStatus}
            rawCategory={dataRoomRawCategory}
            setRawCategory={setDataRoomRawCategory}
            rawMethod={dataRoomRawMethod}
            setRawMethod={setDataRoomRawMethod}
            rawOwner={dataRoomRawOwner}
            setRawOwner={setDataRoomRawOwner}
            rawQuery={dataRoomRawQuery}
            setRawQuery={setDataRoomRawQuery}
            metricTab={dataRoomMetricTab}
            setMetricTab={setDataRoomMetricTab}
            metricStatus={dataRoomMetricStatus}
            setMetricStatus={setDataRoomMetricStatus}
            metricBundle={dataRoomMetricBundle}
            setMetricBundle={setDataRoomMetricBundle}
            metricQuery={dataRoomMetricQuery}
            setMetricQuery={setDataRoomMetricQuery}
            rawCategories={dataRoomRawCategories}
            rawMethods={dataRoomRawMethods}
            rawOwners={dataRoomRawOwners}
            metricBundles={dataRoomMetricBundles}
            selectedItem={selectedDataRoomItem}
            setSelectedItem={setSelectedDataRoomItem}
            activeDetail={activeDataRoomDetail}
            rawStatuses={dataRoomRawStatuses}
            metricStatuses={dataRoomMetricStatuses}
            scopes={dataRoomScopes}
            onLog={() => showToast('선택한 raw 데이터의 수집 로그 위치를 확인하세요. 실제 로그 테이블 연결 시 상세 로그가 열립니다.')}
            onRefreshRaw={() => showToast('수동 재수집 요청이 등록되었습니다. 실제 작업 큐 연결 시 job id를 표시합니다.')}
            onMetricLog={() => showToast('계산 로그 위치와 최근 계산 상태를 확인합니다.')}
            onRecalculate={() => showToast('계산지표 재계산 요청이 등록되었습니다. 실제 큐 연결 시 재계산 job id를 표시합니다.')}
          />
        )}
        {visibleSection === 'settings' && (
          <section className="settings-grid">
            <section className="panel settings-sync-panel">
              <div className="panel-heading">
                <div>
                  <span className="mini-label">Production Connection</span>
                  <h2>운영 연결 상태</h2>
                </div>
                <div className="panel-heading-actions">
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={testProductionApis}
                    disabled={apiTestStatus.running}
                  >
                    <ShieldCheck size={16} />
                    {apiTestStatus.running ? '테스트 중' : 'API 연결 테스트'}
                  </button>
                  <button className="primary-button compact-button" type="button" onClick={syncWorkspaceNow}>
                    <RefreshCw size={16} />
                    지금 공유 DB 저장
                  </button>
                </div>
              </div>
              <div className={`sync-status-card ${cloudSyncStatus.mode}`}>
                <Database size={22} />
                <div>
                  <strong>{cloudSyncStatus.label}</strong>
                  <p>{cloudSyncStatus.detail}</p>
                  {cloudSyncStatus.updatedAt && (
                    <small>마지막 동기화 {new Date(cloudSyncStatus.updatedAt).toLocaleString('ko-KR')}</small>
                  )}
                </div>
              </div>
              {backendConfig.hasSupabase && (
                <div className="auth-connect-card">
                  <div>
                    <span className="mini-label">Supabase Auth</span>
                    <strong>{authSession?.user?.email || '팀 공유 DB 로그인 필요'}</strong>
                    <p>
                      같은 팀이 같은 후보 풀과 캠페인 데이터를 보려면 Supabase Auth 세션이 필요합니다.
                    </p>
                  </div>
                  {authSession ? (
                    <button className="secondary-button compact-button" type="button" onClick={disconnectAuth}>
                      로그아웃
                    </button>
                  ) : (
                    <div className="auth-connect-actions">
                      <input
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        placeholder="team@example.com"
                        type="email"
                      />
                      <button className="primary-button compact-button" type="button" onClick={requestAuthLink}>
                        로그인 링크 발송
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="integration-checklist">
                <article className={backendConfig.hasSupabase ? 'ready' : ''}>
                  <strong>팀 공유 DB/Auth</strong>
                  <span>
                    {backendConfig.hasSupabase
                      ? authSession
                        ? 'Supabase Auth 로그인됨'
                        : 'Supabase env 연결됨 · 로그인 필요'
                      : 'Supabase env 필요'}
                  </span>
                </article>
                <article className={backendConfig.apiBaseUrl ? 'ready' : ''}>
                  <strong>API 키 서버 보관</strong>
                  <span>{backendConfig.apiBaseUrl || 'VITE_CREATOROPS_API_BASE_URL 필요'}</span>
                </article>
                <article className="ready">
                  <strong>워크스페이스</strong>
                  <span>{backendConfig.workspaceId}</span>
                </article>
              </div>
              <div className="api-test-panel">
                <div>
                  <strong>실제 발굴/AI 생성 테스트</strong>
                  <p>
                    API 서버, YouTube, Google Search/CX, OpenAI를 순서대로 확인합니다.
                    OpenAI 테스트는 짧은 제안 메시지 1건을 생성합니다.
                  </p>
                  {apiTestStatus.checkedAt && (
                    <small>마지막 테스트 {new Date(apiTestStatus.checkedAt).toLocaleString('ko-KR')}</small>
                  )}
                </div>
                <div className="api-test-grid">
                  {apiTestStatus.results.length ? (
                    apiTestStatus.results.map((result) => (
                      <article className={result.status === 'success' ? 'ready' : 'error'} key={result.key}>
                        {result.status === 'success' ? <CheckCircle2 size={17} /> : <X size={17} />}
                        <div>
                          <strong>{result.label}</strong>
                          <span>{result.detail}</span>
                          <small>{result.result}</small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <article>
                      <Database size={17} />
                      <div>
                        <strong>대기 중</strong>
                        <span>Render 환경변수를 입력한 뒤 API 연결 테스트를 누르세요.</span>
                        <small>{backendConfig.apiBaseUrl || 'API 서버 URL 미연결'}</small>
                      </div>
                    </article>
                  )}
                </div>
              </div>
            </section>
            <section className="panel settings-main-panel">
              <div className="panel-heading">
                <div>
                  <span className="mini-label">Team Permission</span>
                  <h2>팀 계정 및 권한</h2>
                </div>
                <span className="result-count">{accounts.length}개 계정</span>
              </div>
              <div className="settings-current-account">
                <div>
                  <strong>{team.name}</strong>
                  <p>같은 팀 계정은 같은 크리에이터 풀과 캠페인 데이터를 공유하고, 역할과 브랜드 접근권한으로 볼 수 있는 범위를 나눕니다.</p>
                </div>
                <label>
                  현재 계정
                  <select value={currentAccount.id} onChange={(event) => switchAccount(event.target.value)}>
                    {accounts.map((account) => (
                      <option value={account.id} key={account.id}>
                        {account.name} · {account.role}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="team-account-list settings-account-list">
                {accounts.map((account) => {
                  const role = teamRoleCatalog[account.role] ?? teamRoleCatalog.Manager
                  return (
                    <article className={account.id === currentAccount.id ? 'active-account-card' : ''} key={account.id}>
                      <div>
                        <strong>{account.name}</strong>
                        <span>{account.email}</span>
                        <small>{account.status} · 최근 활동 {account.lastActive}</small>
                      </div>
                      <select
                        value={account.role}
                        onChange={(event) => updateAccountRole(account.id, event.target.value)}
                        disabled={!canManagePermissions}
                      >
                        {Object.keys(teamRoleCatalog).map((roleKey) => (
                          <option value={roleKey} key={roleKey}>
                            {roleKey}
                          </option>
                        ))}
                      </select>
                      <p>{role.description}</p>
                      <div className="account-brand-access">
                        {brands.map((brand) => (
                          <button
                            className={account.brandIds?.includes(brand.id) ? 'selected' : ''}
                            type="button"
                            key={brand.id}
                            onClick={() => toggleAccountBrandAccess(account.id, brand.id)}
                            disabled={!canManagePermissions || account.role === 'Owner'}
                          >
                            {brand.name}
                          </button>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <aside className="settings-side-panel">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="mini-label">Role Matrix</span>
                    <h2>관리 권한</h2>
                  </div>
                </div>
                <div className="role-permission-grid settings-role-grid">
                  {Object.values(teamRoleCatalog).map((role) => (
                    <article key={role.label}>
                      <strong>{role.label}</strong>
                      <p>{role.description}</p>
                      <span>{role.permissions.join(' · ')}</span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="mini-label">Data Accuracy</span>
                    <h2>정확도 운영 기준</h2>
                  </div>
                </div>
                <div className="accuracy-roadmap-grid settings-accuracy-grid">
                  {dataAccuracyRoadmap.map((item) => (
                    <article key={item.title}>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          </section>
        )}

        {visibleSection === 'discovery' && (
          <>
        <section className="discovery-pool-switcher" aria-label="발굴 풀 보기 전환">
          <button
            className={activeDiscoveryPoolView === 'search' ? 'active' : ''}
            type="button"
            onClick={() => setActiveDiscoveryPoolView('search')}
          >
            <Search size={15} />
            발굴 서치 풀
            <span>{filteredCreators.length}명</span>
          </button>
          <button
            className={activeDiscoveryPoolView === 'candidate' ? 'active' : ''}
            type="button"
            onClick={() => setActiveDiscoveryPoolView('candidate')}
          >
            <BookmarkCheck size={15} />
            메시지 전 후보 풀
            <span>{candidatePoolCreators.length}명</span>
          </button>
        </section>

        {activeDiscoveryPoolView === 'search' && (
          <>
        <div className="discovery-workspace">
          <section className="discovery-flow-guide" aria-label="발굴 작업 순서">
            <article>
              <span>1</span>
              <div>
                <strong>캠페인 조건 확인</strong>
                <p>{selectedCampaign?.name ?? '캠페인 선택'} 기준으로 제품/타깃/키워드를 확인합니다.</p>
              </div>
            </article>
            <article>
              <span>2</span>
              <div>
                <strong>실제 후보 발굴</strong>
                <p>플랫폼, 국가, 팔로워/조회 조건을 잡고 공개 검색을 실행합니다.</p>
              </div>
            </article>
            <article>
              <span>3</span>
              <div>
                <strong>AI 매칭</strong>
                <p>발굴 후보를 브랜드 핏, 데이터 신뢰도, 리스크 기준으로 재정렬합니다.</p>
              </div>
            </article>
            <article>
              <span>4</span>
              <div>
                <strong>후보 풀 저장</strong>
                <p>선택 후보를 메시지 전 후보 풀로 보내 제안 메시지를 만듭니다.</p>
              </div>
            </article>
          </section>
        <section className="ai-grid">
          <section className="panel ai-brief-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Step 1 · Conditions</span>
                <h2>발굴 조건 준비</h2>
              </div>
              <div className="panel-heading-actions">
                <button className="primary-button compact-button" type="button" onClick={runAiDiscovery}>
                  <Target size={16} />
                  AI 매칭 실행
                </button>
              </div>
            </div>
            <div className="brief-auto-setup">
              <div className="brief-auto-head">
                <div>
                  <span className="mini-label">AI Brief Setup</span>
                  <strong>브리프 붙여넣기 + 초안 세팅</strong>
                  <p>제품/타깃/키워드 같은 브랜드 공통값을 빠르게 채웁니다. 예산, KPI, 원메시지, 후킹포인트는 캠페인 생성에서 캠페인별로 관리합니다.</p>
                </div>
                <button className="primary-button compact-button" type="button" onClick={applyAiBriefAutoSetup}>
                  조건 세팅
                </button>
              </div>
              <textarea
                value={briefAutoDraft.rawText}
                onChange={(event) => setBriefAutoDraft({ rawText: event.target.value, result: null })}
                placeholder={`후킹포인트 (콘텐츠 예시)\n₩35,600 + IATA 항공 규격 자막 화면 가득\n비행기 좌석 아래에 켄넬 들어가는 사진\n\n제품\n이동식 켄넬\n\n희망 인플루언서\nYT 펫 채널 3 (5만~50만), IG 펫스타그램 5 (5천~3만)`}
              />
              {briefAutoDraft.result && (
                <div className="brief-auto-result">
                  <span>{briefAutoDraft.result.platformSummary}</span>
                  <strong>{briefAutoDraft.result.targetSummary || '희망 인플루언서 조건 분석 완료'}</strong>
                  <small>목표 후보 {briefAutoDraft.result.candidateTargetCount}명 조건 세팅 · 아래 실제 웹 발굴 후 후보 매칭으로 추천</small>
                  <p>{briefAutoDraft.result.hookSummary || '후킹포인트를 학습자료에 반영했습니다.'}</p>
                </div>
              )}
            </div>
            <div className="campaign-brief-summary">
              <div>
                <span className="mini-label">Campaign Brief</span>
                <strong>{selectedCampaign?.name ?? '캠페인을 먼저 선택하세요'}</strong>
                <p>제품, 타깃, 키워드, 학습자료, 인플루언서 전략은 캠페인 생성에서 관리하고 발굴 화면에서는 선택 캠페인 기준으로 후보를 찾습니다.</p>
              </div>
              <div className="campaign-brief-summary-grid">
                <Stat label="제품/서비스" value={selectedCampaign?.product || brandBrief.product || '-'} />
                <Stat label="타깃" value={selectedCampaign?.targetPersona || brandBrief.persona || '-'} />
                <Stat label="키워드" value={selectedCampaign?.searchKeywords || brandBrief.keywords || '-'} />
                <Stat label="후보 조건" value={`${compactNumber(selectedCampaign?.minFollowers || brandBrief.minFollowers)}+ · ${won(selectedCampaign?.maxCreatorFee || brandBrief.maxPrice)}`} />
              </div>
              <div className="campaign-brief-actions">
                <button className="secondary-button compact-button" type="button" onClick={() => setModal({ type: 'create' })}>
                  <Plus size={15} />
                  캠페인 생성
                </button>
                {selectedCampaign && (
                  <button className="primary-button compact-button" type="button" onClick={() => openCampaign(selectedCampaign)}>
                    캠페인 상세
                  </button>
                )}
              </div>
            </div>
            <div className="brief-toggles">
              <div>
                <span className="mini-label">플랫폼</span>
                {briefPlatformOptions.map((option) => (
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
                <span className="mini-label">Step 3 · AI Matching</span>
                <h2>AI 추천 후보와 근거</h2>
              </div>
              <div className="panel-heading-actions">
                <button
                  className="secondary-button compact-button"
                  type="button"
                  title="AI 추천 리스트 엑셀 다운로드"
                  onClick={exportRecommendationsExcel}
                >
                  <Download size={16} />
                  엑셀
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  title="광고주 전달용 숏폼 리스트 다운로드"
                  onClick={() => exportAdvertiserListExcel('recommendations')}
                >
                  광고주용
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  title="AI 추천 리스트 Google Sheets로 보내기"
                  onClick={sendRecommendationsToSheets}
                >
                  시트
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={toggleAllRecommendations}
                  disabled={!selectedCampaignRecommendations.length}
                >
                  {allRecommendationsSelected ? '전체 해제' : '전체 선택'}
                </button>
                <span className="result-count">{`${selectedCampaignRecommendations.length}/${getCampaignRecommendationTarget(selectedCampaign)}\uBA85`}</span>
              </div>
            </div>
            {selectedCampaignRecommendations.length > 0 && (
              <div className="recommendation-selection-bar">
                <div>
                  <strong>{selectedRecommendations.length}명 선택</strong>
                  <span>선택한 후보를 쇼트리스트에 저장하거나 제안 메시지를 검토함으로 보냅니다.</span>
                </div>
                <div>
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={saveSelectedRecommendations}
                    disabled={!selectedRecommendations.length}
                  >
                    <BookmarkCheck size={15} />
                    쇼트리스트 저장
                  </button>
                  <button
                    className="primary-button compact-button"
                    type="button"
                    onClick={queueSelectedRecommendations}
                    disabled={!selectedRecommendations.length}
                  >
                    <Send size={15} />
                    제안 메시지 생성
                  </button>
                </div>
              </div>
            )}
            <div className="recommendation-list">
              {selectedCampaignRecommendations.length === 0 ? (
                <div className="empty-state compact-empty">
                  <Target size={22} />
                  <strong>아직 AI 추천 결과가 없습니다.</strong>
                  <p>2단계 실제 후보 발굴을 먼저 실행한 뒤, 1단계의 AI 매칭 실행 버튼을 누르세요.</p>
                </div>
              ) : (
                selectedCampaignRecommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    creator={creators.find((creator) => creator.id === recommendation.creatorId)}
                    checked={selectedRecommendationIds.includes(recommendation.id)}
                    onSelect={() => setSelectedCreatorId(recommendation.creatorId)}
                    onToggle={() => toggleRecommendationSelection(recommendation.id)}
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
                <span className="mini-label">Step 2 · Live Discovery</span>
                <h2>크리에이터 발굴</h2>
              </div>
              <div className="panel-heading-actions">
                <button className="icon-button" type="button" title="필터 저장" onClick={saveFilter}>
                  <SlidersHorizontal size={18} />
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  title="크리에이터 발굴 엑셀 다운로드"
                  onClick={exportDiscoveryExcel}
                >
                  <Download size={16} />
                  엑셀
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  title="광고주 전달용 숏폼 리스트 다운로드"
                  onClick={() => exportAdvertiserListExcel('discovery')}
                >
                  광고주용
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  title="크리에이터 발굴 Google Sheets로 보내기"
                  onClick={sendDiscoveryToSheets}
                >
                  시트
                </button>
                <button className="secondary-button compact-button" type="button" onClick={() => setModal({ type: 'creator' })}>
                  <Plus size={16} />
                  후보 등록
                </button>
                <button className="primary-button compact-button" type="button" onClick={runRealDiscoverySearch} disabled={realDiscoverySearching}>
                  <Search size={16} />
                  {realDiscoverySearching ? '검색 중' : '실제 웹 발굴'}
                </button>
              </div>
            </div>

            <div className="filter-bar">
              <label className="search-box">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setDiscoveryPage(1)
                  }}
                  placeholder="크리에이터, 카테고리, 키워드"
                />
              </label>

              <SelectPill
                icon={<Filter size={16} />}
                value={platform}
                options={platformOptions}
                onChange={(value) => {
                  setPlatform(value)
                  setDiscoveryPage(1)
                }}
                label="플랫폼"
              />
              <SelectPill
                icon={<ChevronDown size={16} />}
                value={category}
                options={categoryOptions}
                onChange={(value) => {
                  setCategory(value)
                  setDiscoveryPage(1)
                }}
                label="카테고리"
              />
              <SelectPill
                icon={<Globe2 size={16} />}
                value={discoveryFilters.country}
                options={discoveryCountryOptions}
                onChange={(value) => updateDiscoveryFilter('country', value)}
                label="국가"
              />
            </div>

            <div className="real-discovery-panel">
              <div className="real-discovery-copy">
                <span className="mini-label">Live Discovery</span>
                <strong>예시 후보 숨김 · 실제 공개 검색 결과만 저장</strong>
                <p>YouTube는 공식 Data API로 채널과 구독자/평균 조회를 가져오고, Instagram/TikTok은 Brave Search로 공개 프로필 URL을 찾은 뒤 수치를 검증 대기로 남깁니다.</p>
              </div>
              {backendConfig.apiBaseUrl ? (
                <div className="real-discovery-server-card">
                  <span>서버 API 연결됨</span>
                  <strong>YouTube · Instagram · TikTok 실제 검색 사용 가능</strong>
                  <p>API 키는 Render 환경변수에서 관리되므로 화면에 입력하지 않아도 됩니다.</p>
                </div>
              ) : (
                <div className="real-discovery-fields">
                  <label>
                    YouTube API Key
                    <input
                      type="password"
                      value={realDiscoveryDraft.youtubeApiKey}
                      onChange={(event) => setRealDiscoveryDraft({ ...realDiscoveryDraft, youtubeApiKey: event.target.value })}
                      placeholder="YouTube Data API 키"
                    />
                  </label>
                  <label>
                    Search API Key
                    <input
                      type="password"
                      value={realDiscoveryDraft.googleApiKey}
                      onChange={(event) => setRealDiscoveryDraft({ ...realDiscoveryDraft, googleApiKey: event.target.value })}
                      placeholder="프로필 검색 API 키"
                    />
                  </label>
                  <label>
                    Search CX
                    <input
                      value={realDiscoveryDraft.googleCx}
                      onChange={(event) => setRealDiscoveryDraft({ ...realDiscoveryDraft, googleCx: event.target.value })}
                      placeholder="Google CSE 사용 시 검색엔진 ID"
                    />
                  </label>
                  <label>
                    가져올 수
                    <input
                      inputMode="numeric"
                      value={realDiscoveryDraft.maxResults}
                      onChange={(event) => setRealDiscoveryDraft({ ...realDiscoveryDraft, maxResults: event.target.value })}
                      placeholder="100 / 300 / 1000"
                    />
                  </label>
                </div>
              )}
              <div className="real-discovery-actions">
                <button className="primary-button compact-button" type="button" onClick={runRealDiscoverySearch} disabled={realDiscoverySearching}>
                  <Search size={16} />
                  {realDiscoverySearching ? '검색 중' : '실제 검색'}
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => {
                    setShowExampleCreators((current) => !current)
                    setDiscoveryPage(1)
                  }}
                >
                  {showExampleCreators ? '예시 숨김' : '예시 보기'}
                </button>
              </div>
            </div>

            <div className="performance-filter-panel">
              <div className="performance-filter-heading">
                <div>
                  <span className="mini-label">Performance Criteria</span>
                  <strong>팔로워·평균 조회수 조건</strong>
                </div>
                <div className="performance-filter-actions">
                  <span>{activeDiscoveryFilterCount > 0 ? `${activeDiscoveryFilterCount}개 조건 적용` : '전체 후보 기준'}</span>
                  <button className="secondary-button compact-button" type="button" onClick={applyBrandBriefToDiscoveryFilters}>
                    브랜드 조건 적용
                  </button>
                  <button className="secondary-button compact-button" type="button" onClick={resetSearch}>
                    초기화
                  </button>
                </div>
              </div>
              <div className="performance-filter-grid">
                <label>
                  <span>팔로워 최소</span>
                  <input
                    inputMode="numeric"
                    value={discoveryFilters.minFollowers}
                    onChange={(event) => updateDiscoveryFilter('minFollowers', event.target.value)}
                    placeholder="100000"
                  />
                </label>
                <label>
                  <span>팔로워 최대</span>
                  <input
                    inputMode="numeric"
                    value={discoveryFilters.maxFollowers}
                    onChange={(event) => updateDiscoveryFilter('maxFollowers', event.target.value)}
                    placeholder="1000000"
                  />
                </label>
                <label>
                  <span>평균 조회 최소</span>
                  <input
                    inputMode="numeric"
                    value={discoveryFilters.minAverageViews}
                    onChange={(event) => updateDiscoveryFilter('minAverageViews', event.target.value)}
                    placeholder="50000"
                  />
                </label>
                <label>
                  <span>참여율 최소</span>
                  <input
                    inputMode="decimal"
                    value={discoveryFilters.minEngagement}
                    onChange={(event) => updateDiscoveryFilter('minEngagement', event.target.value)}
                    placeholder="5"
                  />
                </label>
                <label>
                  <span>예상 단가 최대</span>
                  <input
                    inputMode="numeric"
                    value={discoveryFilters.maxPrice}
                    onChange={(event) => updateDiscoveryFilter('maxPrice', event.target.value)}
                    placeholder="5000000"
                  />
                </label>
                <label>
                  <span>매칭 점수 최소</span>
                  <input
                    inputMode="numeric"
                    value={discoveryFilters.minFit}
                    onChange={(event) => updateDiscoveryFilter('minFit', event.target.value)}
                    placeholder="80"
                  />
                </label>
              </div>
            </div>

            {filteredCreators.length > 0 && (
              <div className="recommendation-selection-bar creator-selection-bar">
                <div>
                  <strong>{selectedDiscoveryCreators.length}명 선택</strong>
                  <span>선택한 후보를 메시지 전 후보 풀에 저장하거나 바로 제안 메시지를 생성합니다.</span>
                </div>
                <div>
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={toggleAllDiscoveryCreators}
                  >
                    {allDiscoveryCreatorsSelected ? '전체 해제' : '전체 선택'}
                  </button>
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={saveSelectedDiscoveryCreatorsToCandidatePool}
                    disabled={!selectedDiscoveryCreators.length}
                  >
                    <BookmarkCheck size={15} />
                    후보 풀 저장
                  </button>
                  <button
                    className="primary-button compact-button"
                    type="button"
                    onClick={queueSelectedDiscoveryCreators}
                    disabled={!selectedDiscoveryCreators.length}
                  >
                    <Send size={15} />
                    선택 제안 넣기
                  </button>
                </div>
              </div>
            )}

            {filteredCreators.length > discoveryPageSize && (
              <PaginationControls
                page={safeDiscoveryPage}
                totalPages={discoveryTotalPages}
                totalItems={filteredCreators.length}
                pageSize={discoveryPageSize}
                onPageChange={setDiscoveryPage}
              />
            )}

            <div className="creator-list creator-card-list">
              {filteredCreators.length === 0 ? (
                <div className="empty-state">
                  <Search size={22} />
                  <strong>실제 발굴 후보가 없습니다.</strong>
                  <p>선택한 캠페인/검색어 기준으로 `실제 웹 발굴`을 실행하면 공개 검색 결과가 이 리스트에 저장됩니다.</p>
                  <button type="button" onClick={resetSearch}>
                    전체 후보 보기
                  </button>
                  <button type="button" onClick={() => {
                    setShowExampleCreators(true)
                    setDiscoveryPage(1)
                  }}>
                    예시 후보 보기
                  </button>
                </div>
              ) : (
                visibleDiscoveryCreators.map((creator) => {
                  const recommendation = buildRecommendation(creator, brandBrief, selectedCampaign)

                  return (
                    <RecommendationCard
                      key={creator.id}
                      recommendation={recommendation}
                      creator={creator}
                      active={selectedCreator?.id === creator.id}
                      checked={selectedDiscoveryCreatorIds.includes(creator.id)}
                      profileUrl={getCreatorProfileUrl(creator, getRecommendedContactChannelId(creator))}
                      saved={shortlist.includes(creator.id)}
                      onSelect={() => setSelectedCreatorId(creator.id)}
                      onToggle={() => toggleDiscoveryCreatorSelection(creator.id)}
                      onSave={() => toggleShortlist(creator)}
                    />
                  )
                })
              )}
            </div>

            {filteredCreators.length > discoveryPageSize && (
              <PaginationControls
                page={safeDiscoveryPage}
                totalPages={discoveryTotalPages}
                totalItems={filteredCreators.length}
                pageSize={discoveryPageSize}
                onPageChange={setDiscoveryPage}
              />
            )}
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
                <Stat label="팔로워" value={displayMetric(selectedCreator.followers)} />
                <Stat label="평균 조회" value={displayMetric(selectedCreator.averageViews)} />
                <Stat label="참여율" value={hasPendingMetrics(selectedCreator) ? '수집 필요' : percent(selectedCreator.engagement)} />
                <Stat label="예상 단가" value={selectedCreator.price ? won(selectedCreator.price) : '산정 전'} />
                <Stat label="데이터 신뢰도" value={`${selectedCreatorQuality.score}%`} />
                <Stat label="검증 상태" value={selectedCreatorQuality.level} />
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
                {selectedCreator.sourceNote && <small className="source-note">{selectedCreator.sourceNote}</small>}
                <div className="topic-row">
                  {selectedCreator.topics.map((topic) => (
                    <span key={topic}>{topic}</span>
                  ))}
                </div>
              </div>

              <div className="source-ledger">
                <div className="source-ledger-heading">
                  <span className="mini-label">Source Ledger</span>
                  <strong>데이터 출처/신뢰도</strong>
                </div>
                <div className="data-quality-flags">
                  {selectedCreatorQuality.flags.map((flag) => (
                    <span key={flag}>{flag}</span>
                  ))}
                </div>
                {selectedSourceEvidence.slice(0, 4).map((source) => (
                  <article className="source-ledger-row" key={source.metric}>
                    <div>
                      <strong>{source.metric}</strong>
                      <span>{source.source}</span>
                    </div>
                    <small>{source.confidence}%</small>
                  </article>
                ))}
              </div>

              <div className="history-strip">
                <Stat label="제안 기록" value={`${selectedCreatorOutreach.length}건`} />
                <Stat label="견적 기록" value={`${selectedCreatorQuotes.length}건`} />
              </div>

              <div className="profile-actions">
                <button className="primary-button" type="button" onClick={openProposalModal}>
                  <Send size={17} />
                  제안 보내기
                </button>
                <button className="secondary-button" type="button" onClick={openQuoteModal}>
                  <ClipboardList size={17} />
                  견적 요청
                </button>
              </div>
            </aside>
          )}
        </section>
        </div>
          </>
        )}

        {activeDiscoveryPoolView === 'candidate' && (
        <section className="panel candidate-pool-panel">
          <div className="panel-heading">
            <div>
              <span className="mini-label">Pre-Outreach Pool</span>
              <h2>메시지 전 후보 풀</h2>
            </div>
            <div className="panel-heading-actions">
              <span className="result-count">{candidatePoolCreators.length}명</span>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={exportCandidatePoolExcel}
                disabled={!candidatePoolCreators.length}
              >
                <Download size={16} />
                엑셀
              </button>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={toggleAllCandidatePoolCreators}
                disabled={!candidatePoolCreators.length}
              >
                {allCandidatePoolSelected ? '전체 해제' : '전체 선택'}
              </button>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={removeSelectedCandidatePoolCreators}
                disabled={!selectedCandidatePoolCreators.length}
              >
                <X size={15} />
                Remove selected
              </button>
              <button
                className="primary-button compact-button"
                type="button"
                onClick={queueSelectedCandidatePoolCreators}
                disabled={!selectedCandidatePoolCreators.length}
              >
                <Send size={15} />
                선택 메시지 생성
              </button>
            </div>
          </div>
          <div className="candidate-pool-summary">
            <Stat label="저장 후보" value={`${shortlist.length}명`} />
            <Stat label="메시지 전" value={`${candidatePoolCreators.length}명`} />
            <Stat label="선택됨" value={`${selectedCandidatePoolCreators.length}명`} />
            <Stat label="현재 캠페인" value={selectedCampaign?.name ?? '미선택'} />
          </div>
          <div className="candidate-pool-search-bar">
            <label aria-label="Search pre-outreach candidates">
              <Search size={16} />
              <input
                type="search"
                value={candidatePoolQuery}
                onChange={(event) => {
                  setCandidatePoolQuery(event.target.value)
                  setCandidatePoolPage(1)
                }}
                placeholder={'\uC774\uB984, \uD578\uB4E4, \uD50C\uB7AB\uD3FC, \uAD6D\uAC00, \uCE74\uD14C\uACE0\uB9AC \uAC80\uC0C9'}
              />
            </label>
            {candidatePoolQuery && (
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => {
                  setCandidatePoolQuery('')
                  setCandidatePoolPage(1)
                }}
              >
                <X size={15} />
                Clear
              </button>
            )}
            <span>{candidatePoolCreators.length} / {candidatePoolAllCreators.length}</span>
          </div>
          {candidatePoolCreators.length > candidatePoolPageSize && (
            <PaginationControls
              page={safeCandidatePoolPage}
              totalPages={candidatePoolTotalPages}
              totalItems={candidatePoolCreators.length}
              pageSize={candidatePoolPageSize}
              onPageChange={setCandidatePoolPage}
            />
          )}

          <div className="candidate-pool-list creator-card-list">
            {candidatePoolCreators.length === 0 ? (
              <div className="empty-state compact-empty">
                <UsersRound size={22} />
                <strong>메시지 전 후보가 없습니다.</strong>
                <p>발굴 리스트나 AI 추천에서 후보를 저장하면 이곳에 쌓이고, 메시지 검토함으로 보내기 전까지 관리할 수 있습니다.</p>
              </div>
            ) : (
              visibleCandidatePoolCreators.map((creator) => {
                const channelId = getRecommendedContactChannelId(creator)
                const profileUrl = getCreatorProfileUrl(creator, channelId)
                const contactPlan = buildContactPlan(creator, channelId, '', selectedCampaign?.name)
                const recommendation = buildRecommendation(creator, brandBrief, selectedCampaign)

                return (
                  <RecommendationCard
                    key={creator.id}
                    recommendation={recommendation}
                    creator={creator}
                    active={selectedCreator?.id === creator.id}
                    checked={selectedCandidatePoolIds.includes(creator.id)}
                    profileUrl={profileUrl}
                    contactUrl={contactPlan.url}
                    contactLabel={contactPlan.shortLabel || contactPlan.label}
                    saved={shortlist.includes(creator.id)}
                    onSelect={() => setSelectedCreatorId(creator.id)}
                    onToggle={() => toggleCandidatePoolSelection(creator.id)}
                    onSave={() => toggleShortlist(creator)}
                    onRemove={() => removeCandidatePoolCreators([creator.id])}
                  />
                )
              })
            )}
          </div>

          {candidatePoolCreators.length > candidatePoolPageSize && (
            <PaginationControls
              page={safeCandidatePoolPage}
              totalPages={candidatePoolTotalPages}
              totalItems={candidatePoolCreators.length}
              pageSize={candidatePoolPageSize}
              onPageChange={setCandidatePoolPage}
            />
          )}
        </section>
        )}
          </>
        )}

        {visibleSection === 'references' && (
        <section className="panel reference-board-panel">
          <div className="panel-heading">
            <div>
              <span className="mini-label">Content Reference</span>
              <h2>인기 콘텐츠 레퍼런스</h2>
            </div>
            <div className="panel-heading-actions">
              <span className="result-count">
                영상 {referenceTotals.videos} · 이미지 {referenceTotals.images}
              </span>
            </div>
          </div>

          <div className="reference-summary">
            <Stat label="레퍼런스" value={`${visibleReferences.length}/${selectedCampaignReferences.length}개`} />
            <Stat label="제작 저장" value={`${savedProductionReferences.length}개`} />
            <Stat label="누적 조회" value={compactNumber(referenceTotals.views)} />
            <Stat label="누적 공유" value={compactNumber(referenceTotals.shares)} />
          </div>

          <div className="reference-country-tabs" aria-label="레퍼런스 국가 빠른 필터">
            {referenceCountryOptions.map((countryOption) => (
              <button
                className={referenceFilters.country === countryOption ? 'active' : ''}
                type="button"
                key={countryOption}
                onClick={() => {
                  setReferenceFilters({ ...referenceFilters, country: countryOption })
                  setReferencePage(1)
                }}
              >
                {countryOption}
              </button>
            ))}
          </div>

          <form className="reference-search-bar" onSubmit={applyReferenceSearch}>
            <label>
              <Search size={17} />
              <input
                value={referenceFilters.query}
                onChange={(event) => {
                  setReferenceFilters({ ...referenceFilters, query: event.target.value })
                  setReferencePage(1)
                }}
                placeholder="키워드 검색: 제품, 후킹, 썸네일, CTA, 플랫폼"
              />
            </label>
            <label className="compact-count-input">
              <span>가져올 수</span>
              <input
                inputMode="numeric"
                value={referenceFilters.maxResults}
                onChange={(event) => setReferenceFilters({ ...referenceFilters, maxResults: event.target.value })}
                placeholder="36"
              />
            </label>
            <button className="primary-button compact-button" type="submit" disabled={referenceSearchStatus.mode === 'loading'}>
              {referenceSearchStatus.mode === 'loading' ? <RefreshCw size={15} /> : <Search size={15} />}
              {referenceSearchStatus.mode === 'loading' ? '검색 중' : '검색하기'}
            </button>
            <button className="secondary-button compact-button" type="button" onClick={resetReferenceSearch}>
              초기화
            </button>
          </form>
          {referenceSearchStatus.message && (
            <div className={`reference-search-status ${referenceSearchStatus.mode}`}>
              {referenceSearchStatus.message}
            </div>
          )}

          <div className="reference-filter-heading">
            <div>
              <span className="mini-label">Result Filter</span>
              <strong>검색 결과 필터</strong>
              <p>위 검색으로 추가된 레퍼런스와 저장된 레퍼런스를 국가, 미디어, 플랫폼, 순위 기준으로 좁혀봅니다.</p>
            </div>
          </div>

          <div className="reference-filter-bar">
            <label>
              <span>국가</span>
              <select
                value={referenceFilters.country}
                onChange={(event) => {
                  setReferenceFilters({ ...referenceFilters, country: event.target.value })
                  setReferencePage(1)
                }}
              >
                {referenceCountryOptions.map((countryOption) => (
                  <option key={countryOption}>{countryOption}</option>
                ))}
              </select>
            </label>
            <label>
              <span>미디어</span>
              <select
                value={referenceFilters.mediaType}
                onChange={(event) => {
                  setReferenceFilters({ ...referenceFilters, mediaType: event.target.value })
                  setReferencePage(1)
                }}
              >
                <option>전체</option>
                <option>영상</option>
                <option>이미지</option>
              </select>
            </label>
            <label>
              <span>플랫폼</span>
              <select
                value={referenceFilters.platform}
                onChange={(event) => {
                  setReferenceFilters({ ...referenceFilters, platform: event.target.value })
                  setReferencePage(1)
                }}
              >
                <option>전체</option>
                <option>TikTok</option>
                <option>Instagram</option>
                <option>YouTube</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              <span>순위 기준</span>
              <select
                value={referenceFilters.sort}
                onChange={(event) => {
                  setReferenceFilters({ ...referenceFilters, sort: event.target.value })
                  setReferencePage(1)
                }}
              >
                <option value="virality">{'\uD314\uB85C\uC6CC \uB300\uBE44 \uD130\uC9C4 \uCF58\uD150\uCE20'}</option>
                <option value="views">{'\uC870\uD68C\uC218 \uC21C\uC704'}</option>
                <option value="shares">공유 순위</option>
                <option value="recent">최근 등록순</option>
              </select>
            </label>
          </div>

          <div className="reference-list">
            {paginatedReferences.map((item, index) => (
              <article className="reference-card" key={item.id}>
                {(() => {
                  const isSavedForProduction = savedProductionReferenceIds.includes(item.id)
                  return (
                    <button
                      className={`reference-save-button ${isSavedForProduction ? 'saved' : ''}`}
                      type="button"
                      title={isSavedForProduction ? '제작 레퍼런스 저장 해제' : '제작 레퍼런스로 저장'}
                      onClick={() => toggleProductionReference(item.id)}
                    >
                      {isSavedForProduction ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      <span>{isSavedForProduction ? '저장됨' : '저장'}</span>
                    </button>
                  )
                })()}
                <div className="reference-media">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" />
                  ) : (
                    <div className="reference-media-placeholder">
                      {item.mediaType === '영상' ? <Video size={24} /> : <ImageIcon size={24} />}
                      <span>{item.platform}</span>
                      <small>썸네일 없음</small>
                    </div>
                  )}
                </div>
                <div className="reference-body">
                  <div className="tracked-post-head">
                    <span className="reference-rank-chip">#{(safeReferencePage - 1) * referencePageSize + index + 1}</span>
                    <span className="type-chip">{item.mediaType}</span>
                    <span className="type-chip">{item.platform}</span>
                    <span className="type-chip">{item.country || '국가 미입력'}</span>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.publishedAt} · 저장 {item.savedAt}</p>
                  <div className="tracked-account-meta">
                    <span>조회 {compactOptionalNumber(item.views)}</span>
                    <span>팔로워 {item.accountFollowers ? compactNumber(item.accountFollowers) : '-'}</span>
                    <span>폭발 {getReferenceVirality(item) ? `${getReferenceVirality(item).toFixed(1)}x` : '-'}</span>
                    <span>좋아요 {compactOptionalNumber(item.likes, '-')}</span>
                    <span>댓글 {compactOptionalNumber(item.comments, '-')}</span>
                    <span>공유 {compactOptionalNumber(item.shares, '-')}</span>
                  </div>
                  <div className="reference-insight-grid">
                    <div>
                      <span>후킹</span>
                      <p>{item.hook || '후킹 포인트 미입력'}</p>
                    </div>
                    <div>
                      <span>분석</span>
                      <p>{item.analysis || '분석 메모 미입력'}</p>
                    </div>
                    <div>
                      <span>적용</span>
                      <p>{item.applyIdea || '캠페인 적용 아이디어 미입력'}</p>
                    </div>
                  </div>
                </div>
                <a className="reference-open-link" href={item.url} target="_blank" rel="noreferrer">
                  <ArrowUpRight size={17} />
                </a>
              </article>
            ))}
            {!visibleReferences.length && (
              <div className="empty-state compact-empty">
                <Video size={22} />
                <strong>조건에 맞는 레퍼런스가 없습니다.</strong>
                <p>검색 결과 필터를 조정하거나 새 키워드로 레퍼런스를 검색하세요.</p>
              </div>
            )}
          </div>

          {visibleReferences.length > referencePageSize && (
            <PaginationControls
              page={safeReferencePage}
              totalPages={referenceTotalPages}
              totalItems={visibleReferences.length}
              pageSize={referencePageSize}
              onPageChange={setReferencePage}
            />
          )}

          <div className="reference-manual-toggle">
            <div>
              <span className="mini-label">Save Link</span>
              <strong>레퍼런스 링크 저장</strong>
              <p>저장하고 싶은 URL만 넣으면 제목, 썸네일, 조회수, 좋아요, 댓글을 먼저 자동 수집한 뒤 저장합니다.</p>
            </div>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() => setIsReferenceManualFormOpen((current) => !current)}
            >
              {isReferenceManualFormOpen ? '링크 저장 닫기' : '링크 저장 열기'}
            </button>
          </div>

{isReferenceManualFormOpen && (
          <form className="reference-form" onSubmit={saveContentReference}>
            <div className="reference-url-check-row">
              <label>
                <span>레퍼런스 URL</span>
                <input
                  value={referenceDraft.url}
                  onChange={(event) => setReferenceDraft({ ...referenceDraft, url: event.target.value })}
                  placeholder="저장할 영상/이미지 링크를 붙여넣으세요"
                />
              </label>
              <button className="secondary-button compact-button" type="button" onClick={importReferenceSnapshot}>
                <RefreshCw size={15} />
                확인하기
              </button>
            </div>
            <div className="reference-import-row">
              <span>URL 확인 후 공개 데이터로 제목, 썸네일, 조회수, 좋아요, 댓글을 채웁니다. 채워진 값은 아래에서 수정할 수 있어요.</span>
            </div>
            <div className="reference-form-grid">
              <label>
                <span>미디어</span>
                <select
                  value={referenceDraft.mediaType}
                  onChange={(event) => setReferenceDraft({ ...referenceDraft, mediaType: event.target.value })}
                >
                  <option>영상</option>
                  <option>이미지</option>
                </select>
              </label>
              <label>
                <span>플랫폼</span>
                <select
                  value={referenceDraft.platform}
                  onChange={(event) => setReferenceDraft({ ...referenceDraft, platform: event.target.value })}
                >
                  <option>TikTok</option>
                  <option>Instagram</option>
                  <option>YouTube</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                <span>국가</span>
                <input
                  value={referenceDraft.country}
                  onChange={(event) => setReferenceDraft({ ...referenceDraft, country: event.target.value.toUpperCase() })}
                  placeholder="KR, US, JP"
                />
              </label>
            </div>
            <div className="reference-form-grid two">
              <label>
                <span>조회수</span>
                <input
                  inputMode="numeric"
                  value={referenceDraft.views}
                  onChange={(event) => setReferenceDraft({ ...referenceDraft, views: event.target.value })}
                  placeholder="1280000"
                />
              </label>
              <label>
                <span>계정 팔로워</span>
                <input
                  inputMode="numeric"
                  value={referenceDraft.accountFollowers}
                  onChange={(event) => setReferenceDraft({ ...referenceDraft, accountFollowers: event.target.value })}
                  placeholder="185000"
                />
              </label>
            </div>
            <label>
              <span>제목</span>
              <input
                value={referenceDraft.title}
                onChange={(event) => setReferenceDraft({ ...referenceDraft, title: event.target.value })}
                placeholder="요즘 조회수 높은 영상/이미지 레퍼런스 제목"
              />
            </label>
            <label>
              <span>이미지/썸네일 URL</span>
              <input
                value={referenceDraft.thumbnailUrl}
                onChange={(event) => setReferenceDraft({ ...referenceDraft, thumbnailUrl: event.target.value })}
                placeholder="자동 수집되며, 필요하면 직접 수정"
              />
            </label>
            <div className="reference-form-grid four">
              <label>
                <span>좋아요</span>
                <input inputMode="numeric" value={referenceDraft.likes} onChange={(event) => setReferenceDraft({ ...referenceDraft, likes: event.target.value })} />
              </label>
              <label>
                <span>댓글</span>
                <input inputMode="numeric" value={referenceDraft.comments} onChange={(event) => setReferenceDraft({ ...referenceDraft, comments: event.target.value })} />
              </label>
              <label>
                <span>공유</span>
                <input inputMode="numeric" value={referenceDraft.shares} onChange={(event) => setReferenceDraft({ ...referenceDraft, shares: event.target.value })} />
              </label>
              <label>
                <span>업로드일</span>
                <input value={referenceDraft.publishedAt} onChange={(event) => setReferenceDraft({ ...referenceDraft, publishedAt: event.target.value })} placeholder="최근 7일" />
              </label>
            </div>
            <div className="reference-form-grid three">
              <label>
                <span>후킹 포인트</span>
                <textarea value={referenceDraft.hook} onChange={(event) => setReferenceDraft({ ...referenceDraft, hook: event.target.value })} placeholder="첫 3초, 썸네일, 가격/권위/감정 훅" />
              </label>
              <label>
                <span>AI 분석 메모</span>
                <textarea value={referenceDraft.analysis} onChange={(event) => setReferenceDraft({ ...referenceDraft, analysis: event.target.value })} placeholder="왜 조회수/저장/공유가 나왔는지" />
              </label>
              <label>
                <span>우리 캠페인 적용</span>
                <textarea value={referenceDraft.applyIdea} onChange={(event) => setReferenceDraft({ ...referenceDraft, applyIdea: event.target.value })} placeholder="가이드에 반영할 컷, 카피, CTA" />
              </label>
            </div>
            <div className="reference-form-actions">
              <button className="primary-button compact-button" type="submit">
                <Plus size={15} />
                레퍼런스 저장
              </button>
            </div>
          </form>
          )}

          <div className="production-reference-shelf">
            <div className="production-reference-head">
              <div>
                <span className="mini-label">Saved for Production</span>
                <strong>제작 레퍼런스 저장 리스트</strong>
                <p>50만+ 조회 또는 팔로워 대비 터진 콘텐츠를 변형 스크립트로 바꿔 캠페인 가이드에 반영합니다.</p>
              </div>
              <span>{savedProductionReferences.length}개 저장됨</span>
            </div>
            {savedProductionReferences.length === 0 ? (
              <div className="empty-state compact-empty">
                <Bookmark size={22} />
                <strong>아직 저장된 제작 레퍼런스가 없습니다.</strong>
                <p>아래 영상/이미지 카드에서 저장을 누르면 제작 레퍼런스로 따로 모입니다.</p>
              </div>
            ) : (
              <div className="production-reference-list">
                {savedProductionReferences.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.mediaType} · {item.platform} · {item.country || '국가 미입력'} · 폭발 {getReferenceVirality(item) ? `${getReferenceVirality(item).toFixed(1)}x` : '-'}</span>
                    </div>
                    <div className="production-reference-actions">
                      <button className="secondary-button compact-button" type="button" onClick={() => borrowReferenceForGuide(item)}>
                        제작 가이드에 차용
                      </button>
                      <button className="icon-button" type="button" title="저장 해제" onClick={() => toggleProductionReference(item.id)}>
                        <BookmarkCheck size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

        </section>
        )}

        {(visibleSection === 'campaigns' || visibleSection === 'report') && (
          <section className={`bottom-grid ${visibleSection === 'campaigns' || visibleSection === 'report' ? 'single-column-view' : ''}`}>
          {visibleSection === 'campaigns' && (
          <section className="panel campaign-panel" id="campaigns">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Campaigns</span>
                <h2>캠페인 파이프라인</h2>
              </div>
              <div className="panel-heading-actions">
                <button className="primary-button compact-button" type="button" onClick={() => setModal({ type: 'create' })}>
                  <Plus size={16} />
                  캠페인 생성
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="캠페인 요약"
                  onClick={() => setModal({ type: 'campaignSummary' })}
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>

            <div className="campaign-list">
              {brandCampaigns.length === 0 ? (
                <div className="empty-state compact-empty">
                  <Target size={22} />
                  <strong>현재 브랜드에 캠페인이 없습니다.</strong>
                  <button type="button" onClick={() => setModal({ type: 'create' })}>
                    캠페인 생성
                  </button>
                </div>
              ) : (
                brandCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    creators={getCreatorsByIds(creators, campaign.creatorIds)}
                    kpiSummary={campaignKpiSummaries.find((summary) => summary.campaignId === campaign.id)}
                    onOpen={() => openCampaign(campaign)}
                  />
                ))
              )}
            </div>
          </section>
          )}
          {visibleSection === 'report' && (
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
                <button className="icon-button" type="button" title="성과 데이터 즉시 갱신" onClick={refreshTracking}>
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
                <span className="mini-label">선택 캠페인 매출</span>
                <strong>{won(selectedCampaign?.revenue ?? 0)}</strong>
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
              <Stat label="추적 콘텐츠" value={`${selectedCampaignTrackedPosts.length}건`} />
              <Stat label="조회수" value={compactNumber(selectedCampaignTrackedTotals.views)} />
              <Stat label="댓글" value={compactNumber(selectedCampaignTrackedTotals.comments)} />
              <Stat label="공유" value={compactNumber(selectedCampaignTrackedTotals.shares)} />
              <Stat label="저장" value={compactNumber(selectedCampaignTrackedTotals.saves)} />
              <Stat label="전환" value={compactNumber(selectedCampaignTrackedTotals.conversions)} />
              <Stat label="평균 참여율" value={percent(selectedCampaignTrackedAverageEngagement)} />
              <Stat label="업로드 인플루언서" value={`${new Set(selectedCampaignTrackedPosts.map((post) => post.creatorId)).size}명`} />
            </div>

            <div className="campaign-kpi-report">
              {(selectedCampaignKpi ? [selectedCampaignKpi] : []).map((summary) => {
                const campaign = brandCampaigns.find((item) => item.id === summary.campaignId)
                return (
                  <article key={summary.campaignId}>
                    <div>
                      <strong>{campaign?.name ?? '캠페인'}</strong>
                      <span>{summary.metrics.length ? `목표 대비 ${summary.progress}%` : '구조화 KPI 필요'}</span>
                    </div>
                    <div className="pm-progress-bar">
                      <span style={{ width: `${summary.progress}%` }} />
                    </div>
                    <p>
                      {summary.metrics.slice(0, 3).map((metric) => `${metric.label} ${metric.displayActual}/${metric.displayTarget}`).join(' · ') ||
                        '캠페인 생성에서 목표 조회수/전환/주문/매출을 입력하세요.'}
                    </p>
                  </article>
                )
              })}
            </div>

            <div className="tracked-content-list">
              {selectedCampaignTrackedPosts.map((post) => {
                const creator = creators.find((item) => item.id === post.creatorId)
                const campaign = brandCampaigns.find((item) => item.id === post.campaignId)
                const engagementRate = contentEngagementRate(post)
                return (
                  <article className="tracked-post" key={post.id}>
                    <div className="tracked-post-main">
                      <div className="tracked-post-head">
                        <span className="status-chip success-chip">{post.status}</span>
                        <span className="type-chip">{campaign?.name ?? '캠페인 미지정'}</span>
                      </div>
                      <strong>{post.title}</strong>
                      <p>{creator?.name ?? '알 수 없음'} · {creator?.handle ?? '핸들 미입력'} · {post.platform} · {post.lastChecked}</p>
                      <div className="tracked-account-meta">
                        <span>팔로워 {creator ? compactNumber(creator.followers) : '-'}</span>
                        <span>평균 조회 {creator ? compactNumber(creator.averageViews) : '-'}</span>
                        <span>계정 참여율 {creator ? percent(creator.engagement) : '-'}</span>
                        <span>{creator?.category ?? '카테고리 미입력'}</span>
                      </div>
                    <div className="tracked-links">
                      <span className="tracking-source-chip">{post.metricsSource || post.status || '추적 중'}</span>
                      {creator?.profileUrl && (
                        <a href={creator.profileUrl} target="_blank" rel="noreferrer">
                          계정 보기
                          </a>
                        )}
                        <a href={post.url} target="_blank" rel="noreferrer">
                          업로드 링크
                        </a>
                      </div>
                    </div>
                    <div className="post-metrics">
                      <span>{compactNumber(post.views)} 조회</span>
                      <span>{compactNumber(post.likes)} 좋아요</span>
                      <span>{compactNumber(post.comments)} 댓글</span>
                      <span>{compactNumber(post.shares)} 공유</span>
                      <span>{compactNumber(post.saves)} 저장</span>
                      <span>{compactNumber(post.conversions)} 전환</span>
                      <strong>{percent(engagementRate)} 참여율</strong>
                    </div>
                  </article>
                )
              })}
              {!selectedCampaignTrackedPosts.length && (
                <div className="empty-state compact-empty">
                  <BarChart3 size={22} />
                  <strong>아직 추적 중인 업로드 콘텐츠가 없습니다.</strong>
                  <p>콘텐츠 추적 등록에서 인플루언서와 업로드 링크를 먼저 저장하세요. 조회수/댓글/공유는 자동 갱신 또는 수동 보정으로 누적합니다.</p>
                </div>
              )}
            </div>

            <div className="insight-strip">
              <Target size={18} />
              <p>현재 쇼트리스트 예상 총 단가 {won(getCreatorsByIds(creators, shortlist).reduce((sum, creator) => sum + creator.price, 0))} · 선택 캠페인 추적 전환 {compactNumber(selectedCampaignTrackedTotals.conversions)}</p>
            </div>
          </section>
          )}
        </section>
        )}

        {(visibleSection === 'messages' || visibleSection === 'campaigns' || visibleSection === 'dashboard') && (
        <section className={`ops-grid ${visibleSection !== 'messages' ? 'single-column-view' : 'messages-workspace'}`}>
          {visibleSection === 'messages' && (
          <section className="panel message-panel" id="messages">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Outreach</span>
                <h2>제안/응답 발송</h2>
              </div>
              <button className="icon-button" type="button" title="메시지 검토함" onClick={() => setModal({ type: 'messages' })}>
                <MessageSquare size={18} />
              </button>
            </div>
            <div className="outreach-guidance">
              {contactChannelOptions.slice(0, 3).map((channel) => (
                <article key={channel.id}>
                  <span className={`channel-chip ${channel.tone}`}>{channel.shortLabel}</span>
                  <strong>{channel.label}</strong>
                  <p>{channel.description}</p>
                  <small>{channel.notice}</small>
                </article>
              ))}
            </div>
            <div className="message-stage-board" aria-label="메시지 운영 상태">
              {outreachStatusFilters.map((filter) => (
                <button
                  className={outreachStatusFilter === filter.key ? 'active' : ''}
                  type="button"
                  key={filter.key}
                  onClick={() => setOutreachStatusFilter(filter.key)}
                >
                  <span>{filter.label}</span>
                  <strong>{filter.count}건</strong>
                  <p>{filter.helper}</p>
                </button>
              ))}
              <article>
                <span>연락 채널</span>
                <strong>{new Set(selectedCampaignOutreach.map((item) => item.channel || 'manual_other')).size}개</strong>
                <p>이메일, DM, 수동 채널 분리</p>
              </article>
            </div>
            <div className="message-search-bar">
              <label aria-label="Search outreach messages">
                <Search size={16} />
                <input
                  type="search"
                  value={outreachSearchQuery}
                  onChange={(event) => setOutreachSearchQuery(event.target.value)}
                  placeholder={'\uC774\uB984, \uD578\uB4E4, \uCEA0\uD398\uC778, \uCC44\uB110, \uBA54\uC2DC\uC9C0 \uAC80\uC0C9'}
                />
              </label>
              {outreachSearchQuery && (
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => setOutreachSearchQuery('')}
                >
                  <X size={15} />
                  Clear
                </button>
              )}
              <span>{filteredCampaignOutreach.length} / {selectedCampaignOutreach.length}</span>
            </div>
            <div className="message-bulk-toolbar">
              <label className="selection-check">
                <input
                  type="checkbox"
                  checked={allOutreachSelected}
                  disabled={!filteredCampaignOutreach.length}
                  onChange={toggleAllOutreachItems}
                />
                전체 선택
              </label>
              <span>{selectedOutreachItems.length} selected / {selectedEmailOutreachItems.length} email / {selectedDmOutreachItems.length} DM / {selectedDuplicateOutreachCount} duplicate-blocked / Gmail {gmailConnected ? 'connected' : 'not connected'}</span>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={gmailConnected ? disconnectGmail : connectGmail}
              >
                {gmailConnected ? 'Disconnect Gmail' : 'Connect Gmail'}
              </button>
              <button
                className="primary-button compact-button"
                type="button"
                disabled={!selectedEmailOutreachItems.length || !gmailConnected || gmailSending}
                onClick={sendSelectedOutreachEmails}
              >
                <Send size={15} />
                {gmailSending ? 'Sending' : 'Send selected emails'}
              </button>
              <button
                className="secondary-button compact-button"
                type="button"
                disabled={!selectedDmOutreachItems.length}
                onClick={startDmBulkMode}
              >
                DM work mode
              </button>
              <button
                className="secondary-button compact-button"
                type="button"
                disabled={!selectedDmOutreachItems.length}
                onClick={exportSelectedDmWorkExcel}
              >
                <Download size={15} />
                Download DM Excel
              </button>
              <button
                className="secondary-button compact-button"
                type="button"
                disabled={!selectedOutreachItems.length}
                onClick={markSelectedOutreachSent}
              >
                Mark as sent only
              </button>
            </div>
            <div className="record-list">
              {filteredCampaignOutreach.length === 0 ? (
                <div className="empty-state compact-empty">
                  <MessageSquare size={22} />
                  <strong>현재 필터에 해당하는 메시지가 없습니다.</strong>
                  <p>상단 상태 필터를 전체로 바꾸거나 후보를 메시지 검토함으로 보내세요.</p>
                </div>
              ) : (
              filteredCampaignOutreach.map((item) => (
                <OutreachItem
                  key={item.id}
                  item={item}
                  creator={creators.find((creator) => creator.id === item.creatorId)}
                  campaign={brandCampaigns.find((campaign) => campaign.id === item.campaignId)}
                  selected={selectedOutreachIds.includes(item.id)}
                  onToggleSelect={() => toggleOutreachSelection(item.id)}
                  onCopy={() => copyOutreachMessage(item.message)}
                  onOpenDetail={() => openOutreachDetail(item.id)}
                  onMarkSent={() => markOutreachSent(item.id)}
                  onMarkResponse={() => markOutreachResponse(item.id)}
                  onComplete={() => completeRecruitment(item.id)}
                />
              ))
              )}
            </div>
          </section>
          )}
          {visibleSection === 'dashboard' && (
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
          )}
        </section>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}

      {modal && (
        <Modal
          title={modalTitle(modal.type)}
          variant={
            modal.type === 'campaign'
              ? 'campaign-modal-card'
              : modal.type === 'create'
                ? 'campaign-create-modal'
                : modal.type === 'outreachDetail'
                  ? 'outreach-detail-card'
                  : ''
          }
          onClose={() => setModal(null)}
        >
          {modal.type === 'brand' && (
            <form className="modal-form" onSubmit={createBrand}>
              <label>
                브랜드명
                <input
                  value={brandDraft.name}
                  onChange={(event) => setBrandDraft({ ...brandDraft, name: event.target.value })}
                  placeholder="예: 프리미엄 라이프스타일 브랜드"
                />
              </label>
              <label>
                회사/클라이언트명
                <input
                  value={brandDraft.owner}
                  onChange={(event) => setBrandDraft({ ...brandDraft, owner: event.target.value })}
                  placeholder="예: Brand D"
                />
              </label>
              <label>
                제품/서비스
                <input
                  value={brandDraft.product}
                  onChange={(event) => setBrandDraft({ ...brandDraft, product: event.target.value })}
                  placeholder="예: 고단백 식사 대용 쉐이크"
                />
              </label>
              <label>
                타깃 페르소나
                <input
                  value={brandDraft.persona}
                  onChange={(event) => setBrandDraft({ ...brandDraft, persona: event.target.value })}
                  placeholder="예: 운동과 식단을 함께 관리하는 20-30대"
                />
              </label>
              <label>
                포함 키워드
                <input
                  value={brandDraft.keywords}
                  onChange={(event) => setBrandDraft({ ...brandDraft, keywords: event.target.value })}
                  placeholder="헬스, 다이어트, 루틴, 리뷰"
                />
              </label>
              <div className="modal-two-col">
                <label>
                  최소 팔로워
                  <input
                    inputMode="numeric"
                    value={brandDraft.minFollowers}
                    onChange={(event) => setBrandDraft({ ...brandDraft, minFollowers: event.target.value })}
                    placeholder="100000"
                  />
                </label>
                <label>
                  최대 단가
                  <input
                    inputMode="numeric"
                    value={brandDraft.maxPrice}
                    onChange={(event) => setBrandDraft({ ...brandDraft, maxPrice: event.target.value })}
                    placeholder="5000000"
                  />
                </label>
              </div>
              <button className="primary-button" type="submit">
                <Plus size={17} />
                브랜드 추가하고 전환
              </button>
            </form>
          )}

          {modal.type === 'create' && (
            <form className="modal-form campaign-create-form" onSubmit={createCampaign}>
              <div className="campaign-form-section campaign-form-intro">
                <div>
                  <span className="mini-label">Step 1</span>
                  <strong>기본 정보</strong>
                  <p>캠페인 이름과 목적을 먼저 정리합니다.</p>
                </div>
                <div className="quote-box">
                  <Target size={22} />
                  <div>
                    <strong>{activeBrand.name}</strong>
                    <span>현재 선택된 브랜드에 캠페인을 생성합니다.</span>
                  </div>
                </div>
                <label>
                  캠페인명
                  <input
                    value={campaignDraft.name}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, name: event.target.value })}
                    placeholder="예: 여름 신제품 런칭"
                  />
                </label>
                <div className="modal-two-col">
                  <label>
                    목표
                    <select
                      value={campaignDraft.objective}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, objective: event.target.value })}
                    >
                      <option>브랜드 인지도</option>
                      <option>구매 전환</option>
                      <option>공동구매 전환</option>
                      <option>예약 판매</option>
                      <option>앱 설치</option>
                    </select>
                  </label>
                  <label>
                    캠페인 타입
                    <select
                      value={campaignDraft.campaignType}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, campaignType: event.target.value })}
                    >
                      {campaignTypeOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="campaign-guide-panel campaign-condition-panel">
                <div>
                  <span className="mini-label">Step 2 · Campaign Targeting</span>
                  <strong>캠페인별 발굴 조건</strong>
                  <p>이번 캠페인에서만 달라지는 타깃, 검색 키워드, 후보 규모와 단가 조건입니다. 비워두면 브랜드 공통 프로필의 기본값을 사용합니다.</p>
                </div>
                <div className="modal-two-col">
                  <label>
                    제품/서비스
                    <input
                      value={campaignDraft.product}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, product: event.target.value })}
                      placeholder={brandBrief.product || '예: 이동식 켄넬'}
                    />
                  </label>
                  <label>
                    이번 캠페인 타깃
                    <input
                      value={campaignDraft.targetPersona}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, targetPersona: event.target.value })}
                      placeholder={brandBrief.persona || '예: 반려견과 여행을 자주 하는 20-40대 보호자'}
                    />
                  </label>
                </div>
                <div className="modal-two-col">
                  <label>
                    캠페인 검색 키워드
                    <input
                      value={campaignDraft.searchKeywords}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, searchKeywords: event.target.value })}
                      placeholder={brandBrief.keywords || '예: 펫 여행, 켄넬, 차량 이동, 항공 이동'}
                    />
                  </label>
                  <label>
                    제외 키워드/주의 표현
                    <input
                      value={campaignDraft.exclusionKeywords}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, exclusionKeywords: event.target.value })}
                      placeholder={brandBrief.exclusions || '예: 과장 광고, 비교 브랜드 실명 언급'}
                    />
                  </label>
                </div>
                <div className="modal-two-col">
                  <label>
                    후보 최소 팔로워
                    <input
                      inputMode="numeric"
                      value={campaignDraft.minFollowers}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, minFollowers: event.target.value })}
                      placeholder={String(brandBrief.minFollowers || '5000')}
                    />
                  </label>
                  <label>
                    후보 최대 단가
                    <input
                      inputMode="numeric"
                      value={campaignDraft.maxCreatorFee}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, maxCreatorFee: event.target.value })}
                      placeholder={String(brandBrief.maxPrice || '1500000')}
                    />
                  </label>
                </div>
                <div className="modal-two-col">
                  <label>
                    우선 발굴 플랫폼
                    <input
                      value={campaignDraft.preferredPlatforms}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, preferredPlatforms: event.target.value })}
                      placeholder={brandBrief.platforms.join(', ') || 'YouTube, Instagram, TikTok'}
                    />
                  </label>
                  <label>
                    AI 추천 목표 인원
                    <input
                      inputMode="numeric"
                      value={campaignDraft.recommendationTargetCount}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, recommendationTargetCount: event.target.value })}
                      placeholder="8"
                    />
                  </label>
                </div>
              </div>
              <div className="campaign-guide-panel">
                <div>
                  <span className="mini-label">Creator Delivery Assets</span>
                  <strong>브랜드/제품 학습자료</strong>
                  <p>이번 캠페인의 상세페이지, USP, 금지/주의 표현, 기존 성과 자료를 첨부하면 가이드와 메시지에 반영합니다.</p>
                </div>
                <div className="campaign-guide-actions">
                  <button className="secondary-button compact-button" type="button" onClick={downloadCampaignGuideTemplate}>
                    <Download size={16} />
                    양식 다운로드
                  </button>
                  <label className="guide-file-input">
                    가이드 첨부
                    <input accept=".docx,.md,.txt,.csv,.tsv,.xlsx" type="file" onChange={attachCampaignGuideFile} />
                  </label>
                </div>
                {(campaignDraft.brandGuideAttachments ?? []).length > 0 && (
                  <div className="guide-attachment-list">
                    {campaignDraft.brandGuideAttachments.map((item) => (
                      <span key={item.id}>
                        {item.name} · {Math.max(1, Math.round(item.size / 1024))}KB
                        {item.learningMaterialCount ? ` · 학습자료 ${item.learningMaterialCount}건` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="campaign-form-section-head campaign-budget-head">
                <span className="mini-label">Step 3</span>
                <strong>예산과 마감</strong>
                <p>섭외 가능 범위와 최종 마감 기준을 먼저 정합니다.</p>
              </div>
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
                마감일
                <input
                  value={campaignDraft.deadline}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, deadline: event.target.value })}
                  placeholder="6월 30일"
                />
              </label>
              <div className="campaign-schedule-fields">
                <div className="campaign-form-section-head">
                  <span className="mini-label">Step 4 · Campaign Schedule</span>
                  <strong>일정</strong>
                  <p>모집부터 업로드, 보고 완료까지의 기준일입니다.</p>
                </div>
                <label>
                  모집 시작일
                  <input
                    value={campaignDraft.recruitStartDate}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, recruitStartDate: event.target.value })}
                    placeholder="예: 6월 1일"
                  />
                </label>
                <label>
                  모집 마감일
                  <input
                    value={campaignDraft.recruitEndDate}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, recruitEndDate: event.target.value })}
                    placeholder="예: 6월 10일"
                  />
                </label>
                <label>
                  업로드 완료일
                  <input
                    value={campaignDraft.uploadDueDate}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, uploadDueDate: event.target.value })}
                    placeholder="예: 6월 20일"
                  />
                </label>
                <label>
                  보고 완료일
                  <input
                    value={campaignDraft.reportDueDate}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, reportDueDate: event.target.value })}
                    placeholder="예: 6월 28일"
                  />
                </label>
              </div>
              <div className="campaign-form-section-head campaign-kpi-head">
                <span className="mini-label">Step 5</span>
                <strong>KPI 목표</strong>
                <p>리포트 기준이 되는 조회수, 전환, 주문, 매출 목표입니다.</p>
              </div>
              <div className="modal-two-col">
                <label>
                  KPI 목표
                  <input
                    value={campaignDraft.kpiGoal}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, kpiGoal: event.target.value })}
                    placeholder="예: 조회수 100만 · 주문 500건"
                  />
                </label>
                <label>
                  셀러 섭외 목표
                  <input
                    inputMode="numeric"
                    value={campaignDraft.sellerRecruitTarget}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, sellerRecruitTarget: event.target.value })}
                    placeholder="50"
                  />
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  목표 조회수
                  <input
                    inputMode="numeric"
                    value={campaignDraft.targetViews}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, targetViews: event.target.value })}
                    placeholder="1200000"
                  />
                </label>
                <label>
                  목표 전환
                  <input
                    inputMode="numeric"
                    value={campaignDraft.targetConversions}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, targetConversions: event.target.value })}
                    placeholder="3000"
                  />
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  목표 주문
                  <input
                    inputMode="numeric"
                    value={campaignDraft.targetOrders}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, targetOrders: event.target.value })}
                    placeholder="600"
                  />
                </label>
                <label>
                  목표 매출
                  <input
                    inputMode="numeric"
                    value={campaignDraft.targetRevenue}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, targetRevenue: event.target.value })}
                    placeholder="70000000"
                  />
                </label>
              </div>
              <div className="campaign-form-section-head campaign-ops-head">
                <span className="mini-label">Step 6</span>
                <strong>운영 조건</strong>
                <p>섭외 후 전달할 미션, 리워드, 검수 흐름입니다.</p>
              </div>
              <label>
                미션/가이드라인
                <textarea
                  value={campaignDraft.mission}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, mission: event.target.value })}
                  placeholder="예: 제품 사용 장면 3컷 이상, 핵심 메시지 2개 포함, 해시태그 필수"
                />
              </label>
              <div className="modal-two-col">
                <label>
                  리워드/지급 기준
                  <input
                    value={campaignDraft.reward}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, reward: event.target.value })}
                    placeholder="예: 제품 제공 + 150만원"
                  />
                </label>
                <label>
                  커머스/성과 지표
                  <input
                    value={campaignDraft.commerceMetric}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, commerceMetric: event.target.value })}
                    placeholder="예: UTM, 쿠폰, 저장/공유"
                  />
                </label>
              </div>
              <label>
                검수/승인 플로우
                <input
                  value={campaignDraft.approvalFlow}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, approvalFlow: event.target.value })}
                  placeholder="브리프 전달 → 원고 검수 → 게시 확인 → 리포트"
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
              <label>
                프로필 URL
                <input
                  value={creatorDraft.profileUrl}
                  onChange={(event) => setCreatorDraft({ ...creatorDraft, profileUrl: event.target.value })}
                  placeholder="https://www.instagram.com/creator"
                />
              </label>
              <label>
                협업 이메일
                <input
                  value={creatorDraft.contactEmail}
                  onChange={(event) => setCreatorDraft({ ...creatorDraft, contactEmail: event.target.value })}
                  placeholder="creator@brandmail.com"
                />
              </label>
              <label>
                기본 연락 채널
                <select
                  value={creatorDraft.preferredContactChannel}
                  onChange={(event) => setCreatorDraft({ ...creatorDraft, preferredContactChannel: event.target.value })}
                >
                  {contactChannelOptions.map((channel) => (
                    <option key={channel.id} value={channel.id}>{channel.label}</option>
                  ))}
                </select>
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
                연락 채널
                <select value={proposalChannel} onChange={(event) => setProposalChannel(event.target.value)}>
                  {contactChannelOptions.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.label} · {channel.deliveryMode}
                    </option>
                  ))}
                </select>
              </label>
              <div className="contact-policy-note compact-note">
                <ShieldCheck size={18} />
                <div>
                  <strong>{buildContactPlan(selectedCreator, proposalChannel).label}</strong>
                  <p>{buildContactPlan(selectedCreator, proposalChannel).notice}</p>
                </div>
              </div>
              <label>
                제안 메시지
                <textarea
                  className="proposal-textarea"
                  value={proposalText}
                  onChange={(event) => setProposalText(event.target.value)}
                />
              </label>
              <button className="primary-button" type="submit">
                <Send size={17} />
                메시지 검토함 저장
              </button>
            </form>
          )}

          {modal.type === 'tracking' && (
            <form className="modal-form" onSubmit={createTrackedPost}>
              <div className="quote-box">
                <BarChart3 size={22} />
                <div>
                  <strong>업로드 링크 기준으로 추적합니다</strong>
                  <span>조회수, 좋아요, 댓글, 공유는 매일 바뀌므로 필수값이 아닙니다. 링크를 먼저 저장하고 API/수동 갱신으로 최신화합니다.</span>
                </div>
              </div>
              <label>
                캠페인
                <select
                  value={trackingDraft.campaignId || selectedCampaign?.id || ''}
                  onChange={(event) => setTrackingDraft({ ...trackingDraft, campaignId: event.target.value })}
                >
                  {brandCampaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </label>
              <label>
                크리에이터
                <select
                  value={trackingDraft.creatorId || 'auto'}
                  onChange={(event) => setTrackingDraft({ ...trackingDraft, creatorId: event.target.value })}
                >
                  <option value="auto">Auto from content link</option>
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
                콘텐츠 URL · 필수
                <input
                  value={trackingDraft.url}
                  onChange={(event) => setTrackingDraft({ ...trackingDraft, url: event.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... 또는 Instagram/TikTok 업로드 링크"
                />
              </label>
              <div className="reference-url-check-row">
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={importTrackingSnapshot}
                  disabled={!trackingDraft.url.trim() || trackingSnapshotLoading}
                >
                  <RefreshCw size={15} />
                  {trackingSnapshotLoading ? 'Checking' : 'Check link'}
                </button>
                <span>{trackingDraft.snapshotSource ? trackingDraft.snapshotSource : 'Title, platform, metrics, and creator identity are filled from public data when available.'}</span>
              </div>
              {(trackingDraft.creatorName || trackingDraft.creatorHandle || trackingDraft.creatorFollowers) && (
                <div className="quote-box compact-note-box">
                  <UsersRound size={18} />
                  <div>
                    <strong>{trackingDraft.creatorName || 'Auto creator'}</strong>
                    <span>{[trackingDraft.creatorHandle, trackingDraft.creatorFollowers ? 'Followers ' + displayMetric(Number(trackingDraft.creatorFollowers)) : '', trackingDraft.snapshotCheckedAt].filter(Boolean).join(' / ')}</span>
                  </div>
                </div>
              )}
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
                  조회수 · 선택
                  <input inputMode="numeric" value={trackingDraft.views} onChange={(event) => setTrackingDraft({ ...trackingDraft, views: event.target.value })} placeholder="120000" />
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  좋아요 · 선택
                  <input inputMode="numeric" value={trackingDraft.likes} onChange={(event) => setTrackingDraft({ ...trackingDraft, likes: event.target.value })} placeholder="5400" />
                </label>
                <label>
                  댓글 · 선택
                  <input inputMode="numeric" value={trackingDraft.comments} onChange={(event) => setTrackingDraft({ ...trackingDraft, comments: event.target.value })} placeholder="320" />
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  공유 · 선택
                  <input inputMode="numeric" value={trackingDraft.shares} onChange={(event) => setTrackingDraft({ ...trackingDraft, shares: event.target.value })} placeholder="180" />
                </label>
                <label>
                  저장 · 선택
                  <input inputMode="numeric" value={trackingDraft.saves} onChange={(event) => setTrackingDraft({ ...trackingDraft, saves: event.target.value })} placeholder="900" />
                </label>
              </div>
              <label>
                전환 · 선택
                <input inputMode="numeric" value={trackingDraft.conversions} onChange={(event) => setTrackingDraft({ ...trackingDraft, conversions: event.target.value })} placeholder="80" />
              </label>
              <button className="primary-button" type="submit">
                <Plus size={17} />
                추적 항목 저장
              </button>
            </form>
          )}

          {modal.type === 'fulfillment' && (
            <form className="modal-form" onSubmit={createFulfillmentRecord}>
              <div className="quote-box">
                <WalletCards size={22} />
                <div>
                  <strong>배송/수동 정산 정보</strong>
                  <span>클라이언트 컨펌 후 필요한 배송, 계좌, 지급 예정 정보를 한 번에 저장합니다. 자동 송금은 포함하지 않습니다.</span>
                </div>
              </div>
              <div className="modal-two-col">
                <label>
                  캠페인
                  <select
                    value={fulfillmentDraft.campaignId || selectedCampaign?.id || ''}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, campaignId: event.target.value })}
                  >
                    {brandCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  크리에이터
                  <select
                    value={fulfillmentDraft.creatorId || selectedCreator?.id || ''}
                    onChange={(event) => {
                      const nextCreator = creators.find((creator) => creator.id === Number(event.target.value))
                      setFulfillmentDraft({
                        ...fulfillmentDraft,
                        creatorId: event.target.value,
                        recipient: nextCreator?.name ?? fulfillmentDraft.recipient,
                        handle: nextCreator?.handle ?? fulfillmentDraft.handle,
                        accountHolder: nextCreator?.name ?? fulfillmentDraft.accountHolder,
                      })
                    }}
                  >
                    {fulfillmentCreatorOptions.map((creator) => (
                      <option key={creator.id} value={creator.id}>{creator.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  결제일
                  <input
                    value={fulfillmentDraft.paymentDate}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, paymentDate: event.target.value })}
                    placeholder="5월 20일"
                  />
                </label>
                <label>
                  결제금액
                  <input
                    inputMode="numeric"
                    value={fulfillmentDraft.paymentAmount}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, paymentAmount: event.target.value })}
                    placeholder="31500"
                  />
                </label>
              </div>
              <div className="modal-two-col">
                <label>
                  수취인
                  <input
                    value={fulfillmentDraft.recipient}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, recipient: event.target.value })}
                    placeholder="수취인명"
                  />
                </label>
                <label>
                  아이디
                  <input
                    value={fulfillmentDraft.handle}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, handle: event.target.value })}
                    placeholder="@creator.handle"
                  />
                </label>
              </div>
              <label>
                번호
                <input
                  value={fulfillmentDraft.phone}
                  onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, phone: event.target.value })}
                  placeholder="010-0000-0000"
                />
              </label>
              <label>
                주소
                <input
                  value={fulfillmentDraft.address}
                  onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, address: event.target.value })}
                  placeholder="배송 주소"
                />
              </label>
              <div className="modal-two-col">
                <label>
                  은행
                  <input
                    value={fulfillmentDraft.bank}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, bank: event.target.value })}
                    placeholder="카카오뱅크"
                  />
                </label>
                <label>
                  계좌번호
                  <input
                    value={fulfillmentDraft.accountNumber}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, accountNumber: event.target.value })}
                    placeholder="3333-00-0000000"
                  />
                </label>
              </div>
              <label>
                예금주
                <input
                  value={fulfillmentDraft.accountHolder}
                  onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, accountHolder: event.target.value })}
                  placeholder="예금주명"
                />
              </label>
              <div className="modal-two-col">
                <label>
                  배송상태
                  <select
                    value={fulfillmentDraft.deliveryStatus}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, deliveryStatus: event.target.value })}
                  >
                    {deliveryStatusOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  택배사
                  <input
                    value={fulfillmentDraft.courier}
                    onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, courier: event.target.value })}
                    placeholder="CJ대한통운"
                  />
                </label>
              </div>
              <label>
                운송장번호
                <input
                  value={fulfillmentDraft.trackingNumber}
                  onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, trackingNumber: event.target.value })}
                  placeholder="운송장번호"
                />
              </label>
              <label>
                메모
                <textarea
                  value={fulfillmentDraft.memo}
                  onChange={(event) => setFulfillmentDraft({ ...fulfillmentDraft, memo: event.target.value })}
                  placeholder="샘플 발송 특이사항, 수동 지급 확인 메모"
                />
              </label>
              <button className="primary-button" type="submit">
                <Plus size={17} />
                배송/수동 정산 기록 저장
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
                <div className="campaign-badges">
                  <span className="status-chip">{activeCampaignForModal.status}</span>
                  <span className="type-chip">{activeCampaignForModal.campaignType ?? '제안형'}</span>
                </div>
                <h3>{activeCampaignForModal.name}</h3>
                <p>{activeCampaignForModal.objective}</p>
                <div className="campaign-detail-actions">
                  {campaignEditDraft ? (
                    <>
                      <button className="primary-button compact-button" type="button" onClick={saveCampaignEdit}>
                        <CheckCircle2 size={16} />
                        수정 저장
                      </button>
                      <button className="secondary-button compact-button" type="button" onClick={() => setCampaignEditDraft(null)}>
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      onClick={() => setCampaignEditDraft(buildCampaignEditDraft(activeCampaignForModal))}
                    >
                      <SlidersHorizontal size={16} />
                      캠페인 수정
                    </button>
                  )}
                </div>
              </div>
              {campaignEditDraft && (
                <div className="campaign-edit-panel">
                  <div>
                    <span className="mini-label">Edit Campaign</span>
                    <strong>캠페인 입력값 수정</strong>
                    <p>저장하면 상세, 발굴 조건, 리포트 KPI 기준에 바로 반영됩니다.</p>
                  </div>
                  <div className="modal-two-col">
                    <label>
                      캠페인명
                      <input value={campaignEditDraft.name} onChange={(event) => updateCampaignEditField('name', event.target.value)} />
                    </label>
                    <label>
                      제품/서비스
                      <input value={campaignEditDraft.product} onChange={(event) => updateCampaignEditField('product', event.target.value)} />
                    </label>
                  </div>
                  <div className="modal-two-col">
                    <label>
                      목표
                      <select value={campaignEditDraft.objective} onChange={(event) => updateCampaignEditField('objective', event.target.value)}>
                        <option>브랜드 인지도</option>
                        <option>구매 전환</option>
                        <option>공동구매 전환</option>
                        <option>예약 판매</option>
                        <option>앱 설치</option>
                      </select>
                    </label>
                    <label>
                      캠페인 타입
                      <select value={campaignEditDraft.campaignType} onChange={(event) => updateCampaignEditField('campaignType', event.target.value)}>
                        {campaignTypeOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    이번 캠페인 타깃
                    <input value={campaignEditDraft.targetPersona} onChange={(event) => updateCampaignEditField('targetPersona', event.target.value)} />
                  </label>
                  <div className="modal-two-col">
                    <label>
                      검색 키워드
                      <input value={campaignEditDraft.searchKeywords} onChange={(event) => updateCampaignEditField('searchKeywords', event.target.value)} />
                    </label>
                    <label>
                      제외 키워드/주의 표현
                      <input value={campaignEditDraft.exclusionKeywords} onChange={(event) => updateCampaignEditField('exclusionKeywords', event.target.value)} />
                    </label>
                  </div>
                  <div className="modal-two-col">
                    <label>
                      후보 최소 팔로워
                      <input inputMode="numeric" value={campaignEditDraft.minFollowers} onChange={(event) => updateCampaignEditField('minFollowers', event.target.value)} />
                    </label>
                    <label>
                      후보 최대 단가
                      <input inputMode="numeric" value={campaignEditDraft.maxCreatorFee} onChange={(event) => updateCampaignEditField('maxCreatorFee', event.target.value)} />
                    </label>
                  </div>
                  <div className="modal-two-col">
                    <label>
                      우선 발굴 플랫폼
                      <input value={campaignEditDraft.preferredPlatforms} onChange={(event) => updateCampaignEditField('preferredPlatforms', event.target.value)} />
                    </label>
                    <label>
                      AI 추천 목표 인원
                      <input inputMode="numeric" value={campaignEditDraft.recommendationTargetCount} onChange={(event) => updateCampaignEditField('recommendationTargetCount', event.target.value)} />
                    </label>
                  </div>
                  <div className="modal-two-col">
                    <label>
                      예산
                      <input inputMode="numeric" value={campaignEditDraft.budget} onChange={(event) => updateCampaignEditField('budget', event.target.value)} />
                    </label>
                    <label>
                      마감일
                      <input value={campaignEditDraft.deadline} onChange={(event) => updateCampaignEditField('deadline', event.target.value)} />
                    </label>
                  </div>
                  <div className="campaign-edit-schedule-grid">
                    <label>
                      모집 시작일
                      <input value={campaignEditDraft.recruitStartDate} onChange={(event) => updateCampaignEditField('recruitStartDate', event.target.value)} />
                    </label>
                    <label>
                      모집 마감일
                      <input value={campaignEditDraft.recruitEndDate} onChange={(event) => updateCampaignEditField('recruitEndDate', event.target.value)} />
                    </label>
                    <label>
                      업로드 완료일
                      <input value={campaignEditDraft.uploadDueDate} onChange={(event) => updateCampaignEditField('uploadDueDate', event.target.value)} />
                    </label>
                    <label>
                      보고 완료일
                      <input value={campaignEditDraft.reportDueDate} onChange={(event) => updateCampaignEditField('reportDueDate', event.target.value)} />
                    </label>
                  </div>
                  <div className="modal-two-col">
                    <label>
                      KPI 목표
                      <input value={campaignEditDraft.kpiGoal} onChange={(event) => updateCampaignEditField('kpiGoal', event.target.value)} />
                    </label>
                    <label>
                      셀러 섭외 목표
                      <input inputMode="numeric" value={campaignEditDraft.sellerRecruitTarget} onChange={(event) => updateCampaignEditField('sellerRecruitTarget', event.target.value)} />
                    </label>
                  </div>
                  <div className="campaign-edit-schedule-grid">
                    <label>
                      목표 조회수
                      <input inputMode="numeric" value={campaignEditDraft.targetViews} onChange={(event) => updateCampaignEditField('targetViews', event.target.value)} />
                    </label>
                    <label>
                      목표 전환
                      <input inputMode="numeric" value={campaignEditDraft.targetConversions} onChange={(event) => updateCampaignEditField('targetConversions', event.target.value)} />
                    </label>
                    <label>
                      목표 주문
                      <input inputMode="numeric" value={campaignEditDraft.targetOrders} onChange={(event) => updateCampaignEditField('targetOrders', event.target.value)} />
                    </label>
                    <label>
                      목표 매출
                      <input inputMode="numeric" value={campaignEditDraft.targetRevenue} onChange={(event) => updateCampaignEditField('targetRevenue', event.target.value)} />
                    </label>
                  </div>
                  <label>
                    미션/가이드라인
                    <textarea value={campaignEditDraft.mission} onChange={(event) => updateCampaignEditField('mission', event.target.value)} />
                  </label>
                  <div className="modal-two-col">
                    <label>
                      리워드/지급 기준
                      <input value={campaignEditDraft.reward} onChange={(event) => updateCampaignEditField('reward', event.target.value)} />
                    </label>
                    <label>
                      커머스/성과 지표
                      <input value={campaignEditDraft.commerceMetric} onChange={(event) => updateCampaignEditField('commerceMetric', event.target.value)} />
                    </label>
                  </div>
                  <label>
                    검수/승인 플로우
                    <input value={campaignEditDraft.approvalFlow} onChange={(event) => updateCampaignEditField('approvalFlow', event.target.value)} />
                  </label>
                  <div className="campaign-edit-actions">
                    <button className="primary-button compact-button" type="button" onClick={saveCampaignEdit}>
                      <CheckCircle2 size={16} />
                      수정 저장
                    </button>
                    <button className="secondary-button compact-button" type="button" onClick={() => setCampaignEditDraft(null)}>
                      취소
                    </button>
                  </div>
                </div>
              )}
              <div className="modal-grid">
                <Stat label="예산" value={won(activeCampaignForModal.budget)} />
                <Stat label="집행" value={won(activeCampaignForModal.spend)} />
                <Stat label="예상 매출" value={won(activeCampaignForModal.revenue)} />
                <Stat label="진행률" value={`${activeCampaignForModal.progress}%`} />
                <Stat label={'AI \uCD94\uCC9C \uBAA9\uD45C'} value={`${getCampaignRecommendationTarget(activeCampaignForModal)}\uBA85`} />
                <Stat label="셀러 목표" value={`${activeCampaignForModal.sellerRecruitTarget ?? 0}명`} />
              </div>
              <div className="campaign-schedule-timeline">
                <div className="campaign-schedule-head">
                  <div>
                    <span className="mini-label">Campaign Schedule</span>
                    <strong>모집부터 보고까지 일정</strong>
                  </div>
                  <span className="campaign-context-chip">마감 {activeCampaignForModal.deadline ?? '미정'}</span>
                </div>
                <div className="campaign-schedule-steps">
                  {getCampaignSchedule(activeCampaignForModal).map((step, index) => (
                    <article className={step.date ? '' : 'schedule-empty'} key={step.key}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.date || '일정 미정'}</p>
                        <small>{step.helper}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              {selectedCampaignKpi?.metrics?.length > 0 && (
                <div className="campaign-kpi-detail">
                  <div>
                    <span className="mini-label">KPI Achievement</span>
                    <strong>목표 대비 {selectedCampaignKpi.progress}%</strong>
                  </div>
                  <div className="campaign-kpi-grid">
                    {selectedCampaignKpi.metrics.map((metric) => (
                      <article key={metric.key}>
                        <span>{metric.label}</span>
                        <strong>{metric.displayActual}</strong>
                        <small>목표 {metric.displayTarget}</small>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              <div className="campaign-playbook">
                <article>
                  <span>제품/서비스</span>
                  <p>{activeCampaignForModal.product || brandBrief.product || '제품/서비스 미입력'}</p>
                </article>
                <article>
                  <span>타깃/검색 키워드</span>
                  <p>
                    {[
                      activeCampaignForModal.targetPersona,
                      activeCampaignForModal.searchKeywords,
                    ].filter(Boolean).join(' · ') || '타깃/키워드 미입력'}
                  </p>
                </article>
                <article>
                  <span>후보 조건</span>
                  <p>
                    {[
                      activeCampaignForModal.preferredPlatforms,
                      activeCampaignForModal.minFollowers ? `최소 ${compactNumber(activeCampaignForModal.minFollowers)} 팔로워` : '',
                      activeCampaignForModal.maxCreatorFee ? `최대 ${won(activeCampaignForModal.maxCreatorFee)}` : '',
                    ].filter(Boolean).join(' · ') || '브랜드 공통 프로필의 기본 발굴 조건 사용'}
                  </p>
                </article>
                <article>
                  <span>제외 키워드/주의 표현</span>
                  <p>{activeCampaignForModal.exclusionKeywords || brandBrief.exclusions || '제외 조건 없음'}</p>
                </article>
                <article>
                  <span>KPI 목표</span>
                  <p>{activeCampaignForModal.kpiGoal ?? '조회수/전환 KPI 미정'}</p>
                </article>
                <article>
                  <span>미션/가이드라인</span>
                  <p>{activeCampaignForModal.mission ?? '캠페인 미션을 아직 입력하지 않았습니다.'}</p>
                </article>
                <article>
                  <span>리워드/지급 기준</span>
                  <p>{activeCampaignForModal.reward ?? '제품 제공 또는 협의 리워드'}</p>
                </article>
                <article>
                  <span>검수/승인 플로우</span>
                  <p>{activeCampaignForModal.approvalFlow ?? '브리프 전달 → 콘텐츠 검수 → 게시 확인 → 리포트'}</p>
                </article>
                <article>
                  <span>커머스/성과 지표</span>
                  <p>{activeCampaignForModal.commerceMetric ?? '조회/댓글/공유와 전환 링크'}</p>
                </article>
              </div>
              <div className="campaign-guide-detail">
                <span className="mini-label">Influencer Strategy</span>
                <strong>인플루언서 전략</strong>
                <p>캠페인 조건, 후보 풀, KPI를 바탕으로 캐스팅 믹스와 메시지 방향을 생성합니다.</p>
                <div className="campaign-guide-actions">
                  <button
                    className="primary-button compact-button"
                    type="button"
                    onClick={() => generateCampaignStrategyForDetail(activeCampaignForModal)}
                  >
                    <Target size={16} />
                    전략 생성
                  </button>
                  {activeCampaignForModal.influencerStrategy && (
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      onClick={() => exportFile(
                        `creatorops-${safeFilePart(activeBrand.name || 'brand')}-${safeFilePart(activeCampaignForModal.name || 'campaign')}-influencer-strategy.md`,
                        'text/markdown;charset=utf-8',
                        activeCampaignForModal.influencerStrategy,
                      )}
                    >
                      <Download size={16} />
                      전략 다운로드
                    </button>
                  )}
                </div>
                {activeCampaignForModal.influencerStrategy && (
                  <div className="content-guide-preview">
                    <span>전략 미리보기</span>
                    <pre>{activeCampaignForModal.influencerStrategy.slice(0, 900)}</pre>
                  </div>
                )}
              </div>
              {(activeCampaignForModal.brandGuideAttachments ?? []).length > 0 && (
                <div className="campaign-guide-detail">
                  <span className="mini-label">Brand Guide Attachments</span>
                  <strong>첨부된 인플루언서 브랜드 가이드</strong>
                  <div className="guide-attachment-list">
                    {activeCampaignForModal.brandGuideAttachments.map((item) => (
                      <span key={item.id}>
                        {item.name} · {item.uploadedAt}
                        {item.learningMaterialCount ? ` · 학습자료 ${item.learningMaterialCount}건 반영` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="campaign-guide-detail">
                <span className="mini-label">Generated Content Guide</span>
                <strong>인플루언서 전달용 콘텐츠 가이드</strong>
                <p>
                  {activeCampaignForModal.guideSeedType ?? '무가시딩'} · {activeCampaignForModal.guideChannel ?? 'Instagram Reels'} · 원메시지/후킹포인트 기반
                </p>
                <div className="campaign-guide-actions">
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={() => generateCampaignGuideForDetail(activeCampaignForModal)}
                  >
                    <FileText size={16} />
                    가이드 생성
                  </button>
                  <button
                    className="primary-button compact-button"
                    type="button"
                    onClick={() => downloadCampaignContentGuide(activeCampaignForModal, 'docx')}
                  >
                    <Download size={16} />
                    DOCX 다운로드
                  </button>
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={() => downloadCampaignContentGuide(activeCampaignForModal, 'pptx')}
                  >
                    <Download size={16} />
                    PPT 다운로드
                  </button>
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={() => downloadCampaignContentGuide(activeCampaignForModal, 'google')}
                  >
                    <FileText size={16} />
                    Google 문서 열기
                  </button>
                </div>
              </div>
              <div className="assignment-list">
                <span className="mini-label">배정 크리에이터</span>
                {getCreatorsByIds(creators, activeCampaignForModal.creatorIds).map((creator) => (
                  <span key={creator.id}>{creator.name}</span>
                ))}
              </div>
              <ClientApprovalBoard
                campaign={activeCampaignForModal}
                poolItems={campaignModalPool}
                creators={creators}
                trackedPosts={campaignModalTrackedPosts}
                trackedTotals={campaignModalTrackedTotals}
                averageEngagement={campaignModalAverageEngagement}
                kpi={campaignModalKpi}
                onReport={() => {
                  setModal(null)
                  jumpTo('report')
                }}
              />
              <div className="campaign-ops-detail-grid">
                <section className="campaign-ops-detail">
                  <div className="campaign-ops-detail-head">
                    <div>
                      <span className="mini-label">Recruited Pool</span>
                      <strong>이 캠페인의 섭외 완료 풀</strong>
                    </div>
                    <span className="campaign-context-chip">{campaignModalPool.length}명</span>
                  </div>
                  <div className="pool-list compact-list">
                    {campaignModalPool.length === 0 ? (
                      <div className="empty-state compact-empty">
                        <UsersRound size={22} />
                        <strong>이 캠페인에 섭외 완료된 인플루언서가 없습니다.</strong>
                        <p>메시지 화면에서 섭외 완료 저장을 누르면 이 캠페인 상세에 쌓입니다.</p>
                      </div>
                    ) : (
                      campaignModalPool.map((item) => (
                        <PoolItem
                          key={item.id}
                          item={item}
                          creator={creators.find((creator) => creator.id === item.creatorId)}
                          campaign={activeCampaignForModal}
                        />
                      ))
                    )}
                  </div>
                </section>

                <section className="campaign-ops-detail">
                  <div className="campaign-ops-detail-head">
                    <div>
                      <span className="mini-label">Logistics</span>
                      <strong>이 캠페인의 배송/수동 정산</strong>
                    </div>
                    <div className="campaign-ops-actions">
                      <span className="campaign-context-chip">{campaignModalFulfillment.length}건 · {won(campaignModalFulfillmentAmount)}</span>
                      <button
                        className="secondary-button compact-button"
                        type="button"
                        onClick={() => openFulfillmentModal(activeCampaignForModal)}
                      >
                        <Plus size={15} />
                        기록 추가
                      </button>
                    </div>
                  </div>
                  <div className="fulfillment-list compact-list">
                    {campaignModalFulfillment.length === 0 ? (
                      <div className="empty-state compact-empty">
                        <WalletCards size={22} />
                        <strong>이 캠페인에 연결된 배송/정산 기록이 없습니다.</strong>
                        <p>기록 추가를 누르면 이 캠페인이 자동으로 선택됩니다.</p>
                      </div>
                    ) : (
                      campaignModalFulfillment.map((item) => (
                        <FulfillmentItem
                          key={item.id}
                          item={item}
                          creator={creators.find((creator) => creator.id === item.creatorId)}
                          campaign={activeCampaignForModal}
                          onAdvance={() => advanceFulfillmentStatus(item.id)}
                        />
                      ))
                    )}
                  </div>
                </section>
              </div>
              <button className="primary-button" type="button" onClick={() => advanceCampaign(activeCampaignForModal.id)}>
                <TrendingUp size={17} />
                다음 단계로 이동하고 저장
              </button>
            </div>
          )}

          {modal.type === 'campaignSummary' && (
            <div className="modal-stack">
              {brandCampaigns.map((campaign) => (
                <button className="summary-row" type="button" key={campaign.id} onClick={() => openCampaign(campaign)}>
                  <span className="status-chip">{campaign.status}</span>
                  <strong>{campaign.name}</strong>
                  <small>{campaign.progress}%</small>
                </button>
              ))}
            </div>
          )}

          {modal.type === 'outreachDetail' && activeOutreachDetail && (
            <div className="modal-stack outreach-detail-modal">
              <div className="outreach-detail-hero">
                <div>
                  <span className={`status-chip ${activeOutreachDetail.status === '응답' || activeOutreachDetail.status === '발송 완료' ? 'success-chip' : ''}`}>
                    {activeOutreachDetail.status}
                  </span>
                  <span className={`channel-chip ${activeOutreachDetailPlan?.tone ?? 'manual-channel'}`}>
                    {activeOutreachDetailPlan?.shortLabel ?? '수동'}
                  </span>
                </div>
                <strong>{activeOutreachDetailCreator?.name ?? '크리에이터 정보 없음'}</strong>
                <p>{activeOutreachDetailCampaign?.name ?? '캠페인 없음'} · {activeOutreachDetail.createdAt}</p>
              </div>
              <div className="outreach-detail-grid">
                <article>
                  <span>연락 방식</span>
                  <strong>{activeOutreachDetailPlan?.label ?? '수동 확인'}</strong>
                  <p>{activeOutreachDetailPlan?.description}</p>
                </article>
                <article>
                  <span>추천/발송 근거</span>
                  <strong>{activeOutreachDetail.source ?? '수동'}</strong>
                  <p>{activeOutreachDetail.reason || '캠페인 조건에 맞춰 생성한 제안 메시지입니다.'}</p>
                </article>
              </div>
              <div className="outreach-timeline-panel">
                <div className="timeline-heading">
                  <span>발송/응답 로그</span>
                  <strong>{buildOutreachTimeline(activeOutreachDetail).length}건 기록</strong>
                </div>
                <div className="outreach-timeline-list">
                  {buildOutreachTimeline(activeOutreachDetail).map((event, index) => (
                    <article key={`${event.label}-${event.createdAt}-${index}`}>
                      <span>{event.createdAt}</span>
                      <strong>{event.label}</strong>
                      <p>{event.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
              <div className="response-note-panel">
                <label>
                  응답 메모
                  <textarea
                    rows={3}
                    value={outreachResponseNote}
                    onChange={(event) => setOutreachResponseNote(event.target.value)}
                    placeholder="예: 단가 문의, 샘플 수령 가능, 일정 조율 필요, 거절 사유 등"
                  />
                </label>
                <button className="secondary-button compact-button" type="button" onClick={() => saveOutreachResponseNote(activeOutreachDetail.id)}>
                  응답 메모 저장
                </button>
              </div>
              <div className="outreach-message-preview">
                <span>제안 메시지 전문</span>
                <pre>{activeOutreachDetail.message}</pre>
              </div>
              <div className="outreach-detail-actions">
                <button className="secondary-button compact-button" type="button" onClick={() => copyOutreachMessage(activeOutreachDetail.message)}>
                  복사
                </button>
                {activeOutreachDetailPlan?.url && (
                  <a className="secondary-button compact-button" href={activeOutreachDetailPlan.url} target="_blank" rel="noreferrer">
                    <ArrowUpRight size={14} />
                    연락 채널 열기
                  </a>
                )}
                {activeOutreachDetail.status === '승인 대기' && (
                  <button className="secondary-button compact-button" type="button" onClick={() => markOutreachSent(activeOutreachDetail.id)}>
                    발송 완료
                  </button>
                )}
                {activeOutreachDetail.status !== '응답' && (
                  <button className="secondary-button compact-button" type="button" onClick={() => markOutreachResponse(activeOutreachDetail.id)}>
                    응답 처리
                  </button>
                )}
                {(activeOutreachDetail.status === '응답' || activeOutreachDetail.status === '발송 완료') && (
                  <button className="primary-button compact-button" type="button" onClick={() => completeRecruitment(activeOutreachDetail.id)}>
                    섭외 완료 풀 저장
                  </button>
                )}
              </div>
            </div>
          )}

          {modal.type === 'dmBulk' && activeDmBulkItem && (
            <div className="modal-stack outreach-detail-modal">
              <div className="outreach-detail-hero">
                <div>
                  <span className="status-chip">DM work mode</span>
                  <span className={`channel-chip ${activeDmBulkPlan?.tone ?? 'manual-channel'}`}>{activeDmBulkPlan?.shortLabel ?? 'DM'}</span>
                </div>
                <strong>{activeDmBulkCreator?.name ?? 'Unknown creator'}</strong>
                <p>{activeDmBulkCampaign?.name ?? 'No campaign'} / {activeDmBulkIndex + 1} of {activeDmBulkItems.length}</p>
              </div>
              <div className="outreach-detail-grid">
                <article>
                  <span>Step 1</span>
                  <strong>Copy message</strong>
                  <p>Copy the prepared proposal, then paste it into the platform DM window manually.</p>
                </article>
                <article>
                  <span>Step 2</span>
                  <strong>Open profile</strong>
                  <p>Use the profile link to send the DM from your logged-in Instagram or TikTok account.</p>
                </article>
              </div>
              <div className="outreach-message-preview">
                <span>Message</span>
                <pre>{activeDmBulkItem.message}</pre>
              </div>
              <div className="outreach-detail-actions">
                <button className="secondary-button compact-button" type="button" onClick={() => moveDmBulk(-1)} disabled={activeDmBulkIndex === 0}>
                  Previous
                </button>
                <button className="secondary-button compact-button" type="button" onClick={() => copyOutreachMessage(activeDmBulkItem.message)}>
                  Copy message
                </button>
                {activeDmBulkPlan?.url && (
                  <a className="secondary-button compact-button" href={activeDmBulkPlan.url} target="_blank" rel="noreferrer">
                    <ArrowUpRight size={14} />
                    Open profile
                  </a>
                )}
                <button className="primary-button compact-button" type="button" onClick={() => markDmBulkSentAndNext(activeDmBulkItem.id)}>
                  Mark sent and next
                </button>
                <button className="secondary-button compact-button" type="button" onClick={() => moveDmBulk(1)} disabled={activeDmBulkIndex >= activeDmBulkItems.length - 1}>
                  Skip / next
                </button>
              </div>
            </div>
          )}
          {modal.type === 'messages' && (
            <div className="modal-stack">
              <div className="contact-policy-note">
                <ShieldCheck size={20} />
                <div>
                  <strong>연락 채널 운영 안내</strong>
                  <p>이메일은 공개 협업 주소가 확인된 후보에게 자동 발송 대상으로 두고, Instagram/TikTok DM은 계정 정책과 승인 범위를 확인하기 전까지 메시지 복사와 프로필 이동 중심으로 운영합니다.</p>
                </div>
              </div>
              {activeOutreach.length === 0 ? (
                <div className="message-item">
                  <strong>아직 발송 기록이 없습니다.</strong>
                  <p>크리에이터 상세 패널에서 제안 보내기를 실행하면 여기에 기록됩니다.</p>
                </div>
              ) : (
                activeOutreach.map((item) => (
                  <OutreachItem
                    key={item.id}
                    item={item}
                    creator={creators.find((creator) => creator.id === item.creatorId)}
                    campaign={brandCampaigns.find((campaign) => campaign.id === item.campaignId)}
                    selected={selectedOutreachIds.includes(item.id)}
                    onToggleSelect={() => toggleOutreachSelection(item.id)}
                    onCopy={() => copyOutreachMessage(item.message)}
                    onOpenDetail={() => openOutreachDetail(item.id)}
                    onMarkSent={() => markOutreachSent(item.id)}
                    onMarkResponse={() => markOutreachResponse(item.id)}
                    onComplete={() => completeRecruitment(item.id)}
                  />
                ))
              )}
              <button className="primary-button" type="button" onClick={openProposalModal}>
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
                  <span>현재 데이터는 이 브라우저에만 저장됩니다. 팀 공유용 운영 DB 연결이 필요합니다.</span>
                </div>
              </div>
              <div className="quote-box">
                <UsersRound size={22} />
                <div>
                  <strong>팀 워크스페이스 전환 예정</strong>
                  <span>운영 버전은 팀원이 로그인해 같은 브랜드/캠페인 데이터를 함께 보고 권한별로 수정합니다.</span>
                </div>
              </div>
              <div className="modal-grid">
                <Stat label="브랜드" value={`${brands.length}개`} />
                <Stat label="현재 캠페인" value={`${brandCampaigns.length}개`} />
                <Stat label="현재 제안" value={`${activeOutreach.length}건`} />
                <Stat label="현재 섭외 완료" value={`${activeRecruitedPool.length}명`} />
                <Stat label="공유 상태" value="로컬 전용" />
                <Stat label="데이터 신뢰도" value={`${dataCoverage.confidence}%`} />
                <Stat label="공식 API 대상" value={`${dataCoverage.officialReady}명`} />
              </div>
              <div className="team-permission-panel">
                <div className="team-permission-head">
                  <div>
                    <span className="mini-label">Team Permission</span>
                    <strong>{team.name}</strong>
                    <p>같은 팀 계정은 같은 크리에이터 풀과 캠페인 데이터를 공유하고, 역할/브랜드 단위로 접근권한을 나눕니다.</p>
                  </div>
                  <label>
                    현재 계정
                    <select value={currentAccount.id} onChange={(event) => switchAccount(event.target.value)}>
                      {accounts.map((account) => (
                        <option value={account.id} key={account.id}>
                          {account.name} · {account.role}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="team-account-list">
                  {accounts.map((account) => {
                    const role = teamRoleCatalog[account.role] ?? teamRoleCatalog.Manager
                    return (
                      <article className={account.id === currentAccount.id ? 'active-account-card' : ''} key={account.id}>
                        <div>
                          <strong>{account.name}</strong>
                          <span>{account.email}</span>
                          <small>{account.status} · 최근 활동 {account.lastActive}</small>
                        </div>
                        <select
                          value={account.role}
                          onChange={(event) => updateAccountRole(account.id, event.target.value)}
                          disabled={!canManagePermissions}
                        >
                          {Object.keys(teamRoleCatalog).map((roleKey) => (
                            <option value={roleKey} key={roleKey}>
                              {roleKey}
                            </option>
                          ))}
                        </select>
                        <p>{role.description}</p>
                        <div className="account-brand-access">
                          {brands.map((brand) => (
                            <button
                              className={account.brandIds?.includes(brand.id) ? 'selected' : ''}
                              type="button"
                              key={brand.id}
                              onClick={() => toggleAccountBrandAccess(account.id, brand.id)}
                              disabled={!canManagePermissions || account.role === 'Owner'}
                            >
                              {brand.name}
                            </button>
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
                <div className="role-permission-grid">
                  {Object.values(teamRoleCatalog).map((role) => (
                    <article key={role.label}>
                      <strong>{role.label}</strong>
                      <p>{role.description}</p>
                      <span>{role.permissions.join(' · ')}</span>
                    </article>
                  ))}
                </div>
              </div>
              <div className="benchmark-panel">
                <div>
                  <span className="mini-label">Competitive Benchmark</span>
                  <strong>경쟁사 기준 보완 항목</strong>
                </div>
                <div className="benchmark-grid">
                  {competitorBenchmarks.map((item) => (
                    <article key={item.name}>
                      <strong>{item.name}</strong>
                      <p>{item.strength}</p>
                      <small>{item.gapToClose}</small>
                    </article>
                  ))}
                </div>
              </div>
              <div className="accuracy-roadmap-panel">
                <div>
                  <span className="mini-label">Data Accuracy</span>
                  <strong>데이터 정확도 개선 원칙</strong>
                </div>
                <div className="accuracy-roadmap-grid">
                  {dataAccuracyRoadmap.map((item) => (
                    <article key={item.title}>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
              <form className="public-profile-form" onSubmit={savePublicProfileSnapshot}>
                <div>
                  <strong>공개 프로필 팔로워 수집</strong>
                  <p>Instagram, TikTok, YouTube 등 공개 화면에 보이는 팔로워 수치를 출처 URL과 함께 저장합니다.</p>
                </div>
                <label>
                  <span>프로필 URL</span>
                  <input
                    value={publicProfileDraft.profileUrl}
                    onChange={(event) => setPublicProfileDraft({ ...publicProfileDraft, profileUrl: event.target.value })}
                    placeholder="https://www.instagram.com/creator"
                  />
                </label>
                <div className="modal-two-col">
                  <label>
                    <span>플랫폼</span>
                    <select
                      value={publicProfileDraft.platform}
                      onChange={(event) => setPublicProfileDraft({ ...publicProfileDraft, platform: event.target.value })}
                    >
                      {platformOptions.filter((option) => option !== '전체').map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>카테고리</span>
                    <select
                      value={publicProfileDraft.category}
                      onChange={(event) => setPublicProfileDraft({ ...publicProfileDraft, category: event.target.value })}
                    >
                      {categoryOptions.filter((option) => option !== '전체').map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="modal-two-col">
                  <label>
                    <span>크리에이터명</span>
                    <input
                      value={publicProfileDraft.name}
                      onChange={(event) => setPublicProfileDraft({ ...publicProfileDraft, name: event.target.value })}
                      placeholder="예: 민서로그"
                    />
                  </label>
                  <label>
                    <span>핸들</span>
                    <input
                      value={publicProfileDraft.handle}
                      onChange={(event) => setPublicProfileDraft({ ...publicProfileDraft, handle: event.target.value })}
                      placeholder="@creator"
                    />
                  </label>
                </div>
                <div className="modal-two-col">
                  <label>
                    <span>팔로워 수</span>
                    <input
                      value={publicProfileDraft.followers}
                      onChange={(event) => setPublicProfileDraft({ ...publicProfileDraft, followers: event.target.value })}
                      placeholder="12.4만 또는 124000"
                    />
                  </label>
                  <label>
                    <span>평균 조회</span>
                    <input
                      value={publicProfileDraft.averageViews}
                      onChange={(event) => setPublicProfileDraft({ ...publicProfileDraft, averageViews: event.target.value })}
                      placeholder="선택 입력"
                    />
                  </label>
                </div>
                <label>
                  <span>확인 메모</span>
                  <input
                    value={publicProfileDraft.note}
                    onChange={(event) => setPublicProfileDraft({ ...publicProfileDraft, note: event.target.value })}
                    placeholder="예: 공개 프로필 상단 팔로워 수 확인"
                  />
                </label>
                <button className="primary-button" type="submit">
                  <Database size={17} />
                  공개 수치 저장
                </button>
              </form>
              <form className="youtube-sync-form" onSubmit={syncYouTubeChannel}>
                <div>
                  <strong>YouTube 공식 지표 가져오기</strong>
                  <p>API 키와 채널 ID 또는 @핸들을 넣으면 구독자, 전체 조회수, 영상 수 기반 평균 조회를 후보 DB에 저장합니다.</p>
                </div>
                <label>
                  <span>API Key</span>
                  <input
                    type="password"
                    value={youtubeDraft.apiKey}
                    onChange={(event) => setYoutubeDraft({ ...youtubeDraft, apiKey: event.target.value })}
                    placeholder="Google Cloud YouTube Data API 키"
                  />
                </label>
                <label>
                  <span>채널 ID 또는 @핸들</span>
                  <input
                    value={youtubeDraft.lookup}
                    onChange={(event) => setYoutubeDraft({ ...youtubeDraft, lookup: event.target.value })}
                    placeholder="@creator 또는 UC..."
                  />
                </label>
                <button className="primary-button" type="submit" disabled={youtubeSyncing}>
                  <RefreshCw size={17} />
                  {youtubeSyncing ? '조회 중' : '공식 지표 조회'}
                </button>
              </form>
              <div className="modal-source-list">
                {dataConnectorBlueprints.map((connector) => (
                  <article key={connector.name}>
                    <div>
                      <strong>{connector.name}</strong>
                      <span>{connector.status}</span>
                    </div>
                    <p>{connector.scope}</p>
                    <small>신뢰도 {connector.confidence}% · {connector.cost}</small>
                  </article>
                ))}
              </div>
              <button className="secondary-button" type="button" onClick={runDataSourceAudit}>
                <ShieldCheck size={17} />
                데이터 소스 점검
              </button>
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
    brand: '브랜드 추가',
    create: '캠페인 실행 조건 입력',
    creator: '크리에이터 등록',
    proposal: '제안 보내기',
    tracking: '콘텐츠 추적 등록',
    fulfillment: '배송/수동 정산 기록',
    quote: '견적 요청',
    campaign: '캠페인 상세',
    campaignSummary: '캠페인 요약',
    messages: '메시지 검토함',
    outreachDetail: '제안 메시지 상세',
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

function WorkflowSignal({ signal }) {
  return (
    <article className={`workflow-card ${signal.tone}`}>
      <div className="workflow-icon">{signal.icon}</div>
      <div>
        <span>{signal.label}</span>
        <strong>{signal.value}</strong>
        <small>{signal.detail}</small>
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

function buildPaginationPages(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const pages = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) pages.push('gap-start')
  for (let item = start; item <= end; item += 1) pages.push(item)
  if (end < totalPages - 1) pages.push('gap-end')
  pages.push(totalPages)

  return pages
}

function PaginationControls({ page, totalPages, totalItems, pageSize, onPageChange }) {
  const pages = buildPaginationPages(page, totalPages)
  const start = totalItems ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(totalItems, page * pageSize)

  return (
    <nav className="pagination-bar" aria-label="Discovery results pages">
      <span>{start}-{end} / {totalItems}</span>
      <div className="pagination-pages">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Prev
        </button>
        {pages.map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              className={item === page ? 'active' : ''}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="pagination-gap">...</span>
          ),
        )}
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </nav>
  )
}

function RecommendationCard({
  recommendation,
  creator,
  checked,
  active = false,
  onSelect,
  onToggle,
  onQueue,
  onSave,
  onRemove,
  saved = false,
  profileUrl,
  contactUrl,
  contactLabel,
}) {
  if (!creator) return null
  const pendingMetrics = hasPendingMetrics(creator)
  const dataQuality = getCreatorDataQuality(creator)
  const creatorContactUrl = contactUrl || profileUrl
  const primaryReason = recommendation.reasons?.[0] || '브랜드 조건과 후보 데이터를 기준으로 매칭했습니다.'
  const detailReasons = recommendation.reasons?.slice(1, 4) ?? []

  return (
    <article className={`recommendation-card ${active ? 'active' : ''} ${checked ? 'selected' : ''}`}>
      <div className="recommendation-top">
        <label className="recommendation-check" aria-label={`${creator.name} 선택`}>
          <input type="checkbox" checked={checked} onChange={onToggle} />
          <span />
        </label>
        <button type="button" onClick={onSelect}>
          <img src={creator.avatar} alt="" />
          <div>
            <strong>{creator.name}</strong>
            <span>{recommendation.persona}</span>
          </div>
        </button>
        <div className="ai-score">{recommendation.score}</div>
      </div>
      <div className="recommendation-fit-strip">
        <span>브랜드 핏 {creator.fit ?? recommendation.score}</span>
        <span>안전성 {creator.brandSafety ?? '-'}</span>
        <span>가짜 팔로워 위험 {creator.fakeRisk ?? '-'}%</span>
        <span>{creator.status ?? '검토 대기'}</span>
      </div>
      <div className="recommendation-metrics" aria-label={`${creator.name} 핵심 성과 지표`}>
        <span>팔로워 {displayMetric(creator.followers)}</span>
        <span>평균 조회 {displayMetric(creator.averageViews)}</span>
        <span>참여율 {pendingMetrics ? '수집 필요' : percent(creator.engagement)}</span>
        <span>데이터 {dataQuality.score} · {dataQuality.level}</span>
        {creator.needsVerification && <span>공개 수치 검증 대기</span>}
      </div>
      <div className="recommendation-reason-summary">
        <span>핵심 근거</span>
        <p>{primaryReason}</p>
      </div>
      {detailReasons.length > 0 && (
        <details className="recommendation-reasons">
          <summary>근거 자세히 보기</summary>
          <ul>
            {detailReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="recommendation-footer">
        <span>{recommendation.risk}</span>
        <div className="recommendation-footer-actions">
          {creatorContactUrl && (
            <a
              className="secondary-button compact-button"
              href={creatorContactUrl}
              target={creatorContactUrl.startsWith('mailto:') ? undefined : '_blank'}
              rel={creatorContactUrl.startsWith('mailto:') ? undefined : 'noreferrer'}
              onClick={(event) => event.stopPropagation()}
            >
              <ArrowUpRight size={15} />
              {contactLabel || '\uCC44\uB110 \uBCF4\uAE30'}
            </a>
          )}
          {onSave && (
            <button className="secondary-button compact-button" type="button" onClick={onSave}>
              {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
              {saved ? '\uC800\uC7A5\uB428' : '\uC800\uC7A5'}
            </button>
          )}
          {onRemove && (
            <button className="secondary-button compact-button" type="button" onClick={onRemove}>
              <X size={15} />
              Remove
            </button>
          )}
          {onQueue && (
            <button className="secondary-button compact-button" type="button" onClick={onQueue}>
              {'\uBA54\uC2DC\uC9C0 \uAC80\uD1A0\uD568'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function CampaignCard({ campaign, creators, kpiSummary, onOpen }) {
  return (
    <article className="campaign-row">
      <div className="campaign-main">
        <div>
          <div className="campaign-badges">
            <span className="status-chip">{campaign.status}</span>
            <span className="type-chip">{campaign.campaignType ?? '제안형'}</span>
          </div>
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
      <div className="campaign-playbook-preview">
        <span>{campaign.kpiGoal ?? 'KPI 미정'}</span>
        <span>{campaign.mission ?? '미션 미입력'}</span>
        <span>{campaign.reward ?? '리워드 협의'}</span>
      </div>
      {kpiSummary?.metrics?.length > 0 && (
        <div className="campaign-kpi-preview">
          <div>
            <span>KPI 달성률</span>
            <strong>{kpiSummary.progress}%</strong>
          </div>
          {kpiSummary.metrics.slice(0, 3).map((metric) => (
            <span key={metric.key}>
              {metric.label} {metric.displayActual}/{metric.displayTarget}
            </span>
          ))}
        </div>
      )}
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

function OutreachItem({
  item,
  creator,
  campaign,
  selected = false,
  onToggleSelect,
  onCopy,
  onOpenDetail,
  onMarkSent,
  onMarkResponse,
  onComplete,
}) {
  const awaitingApproval = item.status === '승인 대기'
  const canComplete = item.status === '응답' || item.status === '발송 완료'
  const sourceTone = item.source === '자동' ? 'auto-source' : item.source === '대량 섭외' ? 'bulk-source' : 'manual-source'
  const contactPlan = buildContactPlan(creator, item.channel, item.message, campaign?.name)

  return (
    <article className="record-item">
      {onToggleSelect && (
        <label className="record-select" aria-label={`${creator?.name ?? '메시지'} 선택`}>
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
        </label>
      )}
      <div>
        <span className={`status-chip ${item.status === '응답' || item.status === '발송 완료' ? 'success-chip' : ''}`}>{item.status}</span>
        <span className={`source-chip ${sourceTone}`}>{item.source ?? '수동'}</span>
        <span className={`channel-chip ${contactPlan.tone}`}>{contactPlan.shortLabel}</span>
        <strong>{creator?.name ?? '알 수 없는 후보'}</strong>
        <p>{campaign?.name ?? '캠페인 없음'} · {item.createdAt}</p>
        <p>{contactPlan.deliveryMode} · {contactPlan.description}</p>
        {item.reason && <p>{item.reason}</p>}
      </div>
      <div className="record-actions">
        <button className="primary-button compact-button" type="button" onClick={onOpenDetail}>
          상세 보기
        </button>
        <button className="secondary-button compact-button" type="button" onClick={onCopy}>
          복사
        </button>
        {contactPlan.url && (
          <a className="secondary-button compact-button" href={contactPlan.url} target="_blank" rel="noreferrer">
            <ArrowUpRight size={14} />
            연락 채널 열기
          </a>
        )}
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

function FulfillmentItem({ item, creator, campaign, onAdvance }) {
  const statusDone = item.deliveryStatus === '발송 완료' || item.deliveryStatus === '정산 완료'
  const isSettled = item.deliveryStatus === '정산 완료'
  const creatorProof = creator
    ? `${compactNumber(creator.followers)} 팔로워 · 평균 조회 ${compactNumber(creator.averageViews)} · 참여율 ${percent(creator.engagement)} · 브랜드 적합성 ${creator.fit}점`
    : '크리에이터 지표를 연결하면 자동 표시됩니다.'

  return (
    <article className="fulfillment-item">
      <div className="fulfillment-item-top">
        <div>
          <div className="item-chip-row">
            <span className="campaign-context-chip strong-context">{campaign?.name ?? '캠페인 없음'}</span>
            <span className={`status-chip ${statusDone ? 'success-chip' : ''}`}>{item.deliveryStatus}</span>
          </div>
          <strong>{item.recipient || creator?.name || '수취인 미입력'}</strong>
          <p>{item.handle || creator?.handle || '아이디 미입력'} · {item.paymentDate}</p>
        </div>
        <div className="fulfillment-amount">
          <span>결제금액</span>
          <strong>{won(item.paymentAmount)}</strong>
        </div>
      </div>

      <div className="fulfillment-meta-grid">
        <div>
          <span>번호</span>
          <strong>{maskPhone(item.phone)}</strong>
        </div>
        <div>
          <span>주소</span>
          <strong>{compactAddress(item.address)}</strong>
        </div>
        <div>
          <span>정산 계좌</span>
          <strong>{item.bank || '은행 미입력'} · {maskAccount(item.accountNumber)}</strong>
        </div>
        <div>
          <span>배송</span>
          <strong>{item.courier || '택배사 미정'} · {item.trackingNumber || '운송장 미입력'}</strong>
        </div>
      </div>

      <div className="fulfillment-proof">
        <span>클라이언트 컨펌 지표</span>
        <p>{creatorProof}</p>
        {item.memo && <small>{item.memo}</small>}
        {!isSettled && (
          <button className="secondary-button compact-button" type="button" onClick={onAdvance}>
            다음 상태로 업데이트
          </button>
        )}
      </div>
    </article>
  )
}

function PoolItem({ item, creator, campaign }) {
  if (!creator) return null

  const topics = creator.topics?.length ? creator.topics.join(', ') : '주요 토픽 미입력'
  const sourceTone = item.source === '자동' ? 'auto-source' : item.source === '대량 섭외' ? 'bulk-source' : 'manual-source'
  const confirmMetrics = [
    ['팔로워', compactNumber(creator.followers)],
    ['평균 조회', compactNumber(creator.averageViews)],
    ['참여율', percent(creator.engagement)],
    ['예상 단가', won(creator.price)],
  ]

  return (
    <article className="pool-item">
      <div className="pool-item-top">
        <img src={creator.avatar} alt="" />
        <div className="pool-creator-main">
          <div className="item-chip-row">
            <span className="campaign-context-chip strong-context">{campaign?.name ?? '캠페인 없음'}</span>
            <span className={`source-chip ${sourceTone}`}>{item.source}</span>
          </div>
          <strong>{creator.name}</strong>
          <p>
            {creator.handle} · {creator.platform} · {creator.category}
          </p>
        </div>
        <div className="client-confirm-badge">
          <span>클라이언트 컨펌</span>
          <strong>{item.status}</strong>
        </div>
      </div>
      <div className="confirm-metric-grid">
        {confirmMetrics.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="pool-confirm-body">
        <div>
          <span>캠페인</span>
          <strong>{campaign?.name ?? '캠페인 없음'}</strong>
          <p>
            {campaign?.objective ?? '목적 미정'} · 마감 {campaign?.deadline ?? '미정'} · {item.createdAt}
          </p>
        </div>
        <div>
          <span>컨펌 포인트</span>
          <strong>{compactNumber(creator.followers)} 팔로워 / 평균 조회 {compactNumber(creator.averageViews)}</strong>
          <p>{item.note}</p>
        </div>
        <div>
          <span>브랜드 적합성</span>
          <strong>매칭 {creator.fit ?? '-'}점 · 세이프티 {creator.brandSafety ?? '-'}점</strong>
          <p>{creator.audience ?? '오디언스 미입력'} · 가짜 팔로워 위험 {creator.fakeRisk ?? '-'}% · {topics}</p>
        </div>
      </div>
    </article>
  )
}

function ClientApprovalBoard({
  campaign,
  poolItems,
  creators,
  trackedPosts,
  trackedTotals,
  averageEngagement,
  kpi,
  onReport,
}) {
  if (!campaign) return null

  return (
    <section className="panel client-view-panel client-view-panel-embedded">
      <div className="panel-heading">
        <div>
          <span className="mini-label">Client Approval View</span>
          <h2>광고주 컨펌 보드</h2>
        </div>
        {onReport && (
          <button className="primary-button compact-button" type="button" onClick={onReport}>
            <BarChart3 size={15} />
            리포트 확인
          </button>
        )}
      </div>
      <div className="client-view-grid">
        <Stat label="선택 캠페인" value={campaign.name ?? '캠페인 미선택'} />
        <Stat label="섭외 완료" value={`${poolItems.length}명`} />
        <Stat label="업로드 콘텐츠" value={`${trackedPosts.length}건`} />
        <Stat label="누적 조회" value={compactNumber(trackedTotals.views)} />
        <Stat label="평균 참여율" value={percent(averageEngagement)} />
        <Stat label="KPI 달성률" value={`${kpi?.progress ?? 0}%`} />
      </div>
      <div className="client-approval-list">
        {poolItems.slice(0, 6).map((poolItem) => {
          const creator = creators.find((item) => item.id === poolItem.creatorId)
          const quality = getCreatorDataQuality(creator)
          return (
            <article key={poolItem.id}>
              <div>
                <strong>{creator?.name ?? '크리에이터'}</strong>
                <span>{creator?.handle ?? '-'} · {creator?.platform ?? '-'} · {poolItem.status}</span>
              </div>
              <div>
                <span>팔로워 {creator ? compactNumber(creator.followers) : '-'}</span>
                <span>평균 조회 {creator ? compactNumber(creator.averageViews) : '-'}</span>
                <span>참여율 {creator ? percent(creator.engagement) : '-'}</span>
                <span>데이터 {quality.score}</span>
              </div>
              <div className="client-approval-proof">
                <span>예상 비용 {creator ? won(creator.price) : '-'}</span>
                <span>브랜드 핏 {creator?.fit ?? '-'}점</span>
                <span>가짜 팔로워 위험 {creator?.fakeRisk ?? '-'}%</span>
                <p>{poolItem.note || creator?.sourceNote || '브랜드 적합도, 콘텐츠 톤, 최근 성과 기준으로 컨펌 검토가 필요합니다.'}</p>
              </div>
            </article>
          )
        })}
        {!poolItems.length && (
          <div className="empty-state compact-empty">
            <UsersRound size={22} />
            <strong>아직 컨펌할 섭외 완료 풀이 없습니다.</strong>
            <p>메시지 화면에서 섭외 완료 저장을 누르면 이 캠페인 상세에 컨펌 후보가 쌓입니다.</p>
          </div>
        )}
      </div>
    </section>
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

function Modal({ title, children, onClose, variant = '' }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-card ${variant}`}
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


