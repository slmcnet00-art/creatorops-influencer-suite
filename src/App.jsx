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
import {
  getBackendConfig,
  loadCloudWorkspace,
  saveCloudWorkspace,
} from './backendSync'
import {
  buildCreatorSourceEvidence,
  calculateDataCoverage,
  dataConnectorBlueprints,
  fetchYouTubeChannelSnapshot,
  searchGoogleProfileDiscovery,
  searchYouTubeCreatorDiscovery,
} from './dataConnectors'

const STORE_KEY = 'creatorops.workspace.v2'
const TRACKING_DAILY_REFRESH_KEY = 'creatorops.tracking.lastDailyRefresh'

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

const defaultDiscoveryFilters = {
  minFollowers: '',
  maxFollowers: '',
  minAverageViews: '',
  minEngagement: '',
  maxPrice: '',
  minFit: '',
}

const discoveryFilterLabels = {
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

const seedingTypeOptions = ['무가시딩', '유가시딩', '공동구매 셀러', '모집형 체험단']
const contentGuideChannelOptions = ['Instagram Reels', 'TikTok', 'YouTube Shorts', 'YouTube Longform', 'Multi Channel']

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
  {
    id: 9201,
    campaignId: 101,
    mediaType: '영상',
    platform: 'TikTok',
    country: 'KR',
    title: '첫 3초 가격/효능 훅 릴스',
    url: 'https://www.tiktok.com/@demo/video/beauty-hook',
    thumbnailUrl: '',
    views: 1280000,
    accountFollowers: 185000,
    likes: 84000,
    comments: 3200,
    shares: 6100,
    publishedAt: '최근 7일',
    hook: '첫 화면에 가격 비교와 사용 전후를 동시에 배치',
    analysis: '숫자형 훅, 즉시 사용 장면, 댓글 유도 질문이 결합되어 저장/공유가 높음',
    applyIdea: '캠페인 가이드에 첫 3초 가격/권위/사용 장면 3요소를 필수 컷으로 반영',
    savedAt: '데모 데이터',
  },
  {
    id: 9202,
    campaignId: 103,
    mediaType: '이미지',
    platform: 'Instagram',
    country: 'KR',
    title: '사이즈 비교형 캐러셀 썸네일',
    url: 'https://www.instagram.com/p/demo-pet-carousel/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=640&q=80',
    views: 420000,
    accountFollowers: 32000,
    likes: 23800,
    comments: 940,
    shares: 1800,
    publishedAt: '최근 30일',
    hook: '제품 사이즈표와 실제 사용 사진을 첫 장에서 같이 제시',
    analysis: '구매 전 의문을 이미지 한 장으로 해결해 댓글 질문을 줄이고 저장률을 높이는 구조',
    applyIdea: '이미지 레퍼런스 기반 사이즈표, 비교컷, 사용컷을 가이드에 포함',
    savedAt: '데모 데이터',
  },
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
  savedProductionReferenceIds: [9201],
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
const referenceCountryPresets = ['전체', 'KR', 'US', 'JP', 'CN', 'SEA', 'EU']
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
    ? saved.creators.filter((creator) => !isVerificationCreator(creator))
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
    contentReferences: saved?.contentReferences ?? defaultWorkspace.contentReferences,
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

function parseDelimitedLine(line, delimiter) {
  const cells = []
  let current = ''
  let quoted = false

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
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

function parseLearningText(text, sourceType, sourceName = '') {
  const clean = String(text || '').trim()
  if (!clean) return []

  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const delimiter = clean.includes('\t') ? '\t' : ','
  const rows = lines.map((line) => parseDelimitedLine(line, delimiter))
  return buildLearningMaterialsFromRows(rows, sourceType, sourceName)
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

function googleSheetCsvUrl(value) {
  const url = String(value || '').trim()
  const match = url.match(/\/spreadsheets\/d\/([^/]+)/)
  if (!match) return url
  const gid = url.match(/[?&#]gid=(\d+)/)?.[1] ?? '0'
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
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

function buildRealDiscoveryCreator(result, brief, fallbackCategory, index = 0) {
  const followers = Number(result.followers || 0)
  const averageViews = Number(result.averageViews || 0)
  const verifiedMetrics = Boolean(result.verifiedMetrics && followers)
  const platform = result.platform || 'Instagram'
  const collectedAt = nowLabel()
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
      source: verifiedMetrics ? result.source : '수집 필요',
      method: verifiedMetrics ? '공식 API 통계' : '공개 프로필/공식 API로 후속 수집 필요',
      confidence: verifiedMetrics ? 96 : 0,
      freshness: collectedAt,
      value: followers,
    },
    {
      metric: '평균 조회',
      source: verifiedMetrics ? result.source : '수집 필요',
      method: verifiedMetrics ? '공식 채널 통계 기반 계산' : '최근 콘텐츠 공개 지표로 후속 계산 필요',
      confidence: verifiedMetrics ? 78 : 0,
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
    country: result.country || 'KR',
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
    city: result.country || 'KR',
    lastPost: verifiedMetrics ? '공식 지표 수집' : '실제 프로필 발견',
    status: verifiedMetrics ? '실제 데이터 확인' : '실제 검색 후보',
    topics: uniqueList([brief.product, fallbackCategory, ...topicCandidates, result.snippet || '공개 검색']).slice(0, 7),
    sourceUrl: result.profileUrl,
    sourceCollectedAt: collectedAt,
    sourceNote: verifiedMetrics
      ? `${result.source}로 실제 채널과 공개 통계를 가져왔습니다.`
      : '실제 공개 검색 결과에서 프로필 URL을 가져왔습니다. 팔로워와 평균 조회는 공식 API 또는 공개 프로필 수집으로 검증해야 합니다.',
    needsVerification: !verifiedMetrics,
    metricsPending: !verifiedMetrics,
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
  const [selectedCandidatePoolIds, setSelectedCandidatePoolIds] = useState([])
  const [selectedOutreachIds, setSelectedOutreachIds] = useState([])
  const [outreachResponseNote, setOutreachResponseNote] = useState('')
  const [realDiscoveryDraft, setRealDiscoveryDraft] = useState({
    youtubeApiKey: '',
    googleApiKey: '',
    googleCx: '',
    maxResults: '8',
  })
  const [briefAutoDraft, setBriefAutoDraft] = useState({
    rawText: '',
    result: null,
  })
  const [influencerStrategy, setInfluencerStrategy] = useState('')
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
    objective: '브랜드 인지도',
    campaignType: '제안형',
    mission: '',
    reward: '',
    approvalFlow: '',
    commerceMetric: '',
    kpiGoal: '',
    targetViews: '',
    targetConversions: '',
    targetOrders: '',
    targetRevenue: '',
    sellerRecruitTarget: '',
    brandGuideAttachments: [],
    campaignGuideMaterials: [],
    guideSeedType: '무가시딩',
    guideChannel: 'Instagram Reels',
    oneMessage: '',
    hookPoints: '',
    generatedContentGuide: '',
  })
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
  const [learningDraft, setLearningDraft] = useState({
    sheetUrl: '',
    pasteText: '',
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
    conversions: '',
  })
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
    sort: 'views',
  })
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
    if (currentAccount?.role === 'Analyst') return ['dashboard', 'report', 'settings']
    return ['dashboard', 'campaigns', 'discovery', 'messages', 'report', 'references', 'settings']
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
  const selectedOutreachItems = useMemo(
    () => selectedCampaignOutreach.filter((item) => selectedOutreachIds.includes(item.id)),
    [selectedCampaignOutreach, selectedOutreachIds],
  )
  const allOutreachSelected =
    selectedCampaignOutreach.length > 0 && selectedOutreachItems.length === selectedCampaignOutreach.length
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
    () => contentReferences.filter((item) => activeCampaignIdSet.has(item.campaignId)),
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
    const filtered = selectedCampaignReferences.filter(
      (item) =>
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
  }, [referenceFilters, selectedCampaignReferences])
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
  const candidatePoolCreators = useMemo(() => {
    const messagedCreatorIds = new Set(selectedCampaignOutreach.map((item) => item.creatorId))
    return getCreatorsByIds(creators, shortlist).filter((creator) => !messagedCreatorIds.has(creator.id))
  }, [creators, selectedCampaignOutreach, shortlist])
  const selectedCandidatePoolCreators = useMemo(
    () => candidatePoolCreators.filter((creator) => selectedCandidatePoolIds.includes(creator.id)),
    [candidatePoolCreators, selectedCandidatePoolIds],
  )
  const allCandidatePoolSelected =
    candidatePoolCreators.length > 0 && selectedCandidatePoolCreators.length === candidatePoolCreators.length

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!trackedPosts.length) return undefined
    const today = new Date().toISOString().slice(0, 10)
    if (window.localStorage.getItem(TRACKING_DAILY_REFRESH_KEY) === today) return undefined

    const timer = window.setTimeout(() => {
      setWorkspace((current) =>
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
                metricsSource: '일일 자동 갱신',
                lastChecked: nowLabel(),
              }
            }),
          },
          'tracking',
          '콘텐츠 성과 일일 자동 갱신',
        ),
      )
      window.localStorage.setItem(TRACKING_DAILY_REFRESH_KEY, today)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [setWorkspace, trackedPosts.length])

  const filteredCreators = useMemo(() => {
    const queryTerms = query
      .split(/[,\s]+/)
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 2)
    const minFollowers = parseDiscoveryFilterValue(discoveryFilters.minFollowers)
    const maxFollowers = parseDiscoveryFilterValue(discoveryFilters.maxFollowers)
    const minAverageViews = parseDiscoveryFilterValue(discoveryFilters.minAverageViews)
    const minEngagement = parseDiscoveryFilterValue(discoveryFilters.minEngagement)
    const maxPrice = parseDiscoveryFilterValue(discoveryFilters.maxPrice)
    const minFit = parseDiscoveryFilterValue(discoveryFilters.minFit)

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
          (pendingMetrics || minFollowers === null || creator.followers >= minFollowers) &&
          (pendingMetrics || maxFollowers === null || creator.followers <= maxFollowers) &&
          (pendingMetrics || minAverageViews === null || creator.averageViews >= minAverageViews) &&
          (pendingMetrics || minEngagement === null || creator.engagement >= minEngagement) &&
          (pendingMetrics || maxPrice === null || creator.price <= maxPrice) &&
          (minFit === null || creator.fit >= minFit)
        )
      })
      .sort((a, b) => b.fit - a.fit)
  }, [category, creators, discoveryFilters, platform, query, showExampleCreators])

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
  const allDiscoveryCreatorsSelected =
    filteredCreators.length > 0 && selectedDiscoveryCreators.length === filteredCreators.length

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
  const activeLearningMaterials = getLearningMaterials(brandBrief)
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
    () => Object.values(discoveryFilters).filter(hasDiscoveryFilterValue).length,
    [discoveryFilters],
  )

  const discoveryFilterSummary = useMemo(
    () =>
      Object.entries(discoveryFilters)
        .filter(([, value]) => hasDiscoveryFilterValue(value))
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

        if (result.workspace) {
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
        await saveCloudWorkspace(workspace)
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
      await saveCloudWorkspace(workspace)
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
    setSelectedDiscoveryCreatorIds(allDiscoveryCreatorsSelected ? [] : filteredCreators.map((creator) => creator.id))
  }

  const toggleCandidatePoolSelection = (creatorId) => {
    setSelectedCandidatePoolIds((current) =>
      current.includes(creatorId)
        ? current.filter((id) => id !== creatorId)
        : [...current, creatorId],
    )
  }

  const toggleAllCandidatePoolCreators = () => {
    setSelectedCandidatePoolIds(allCandidatePoolSelected ? [] : candidatePoolCreators.map((creator) => creator.id))
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
    setSelectedDiscoveryCreatorIds([])
    showToast(`선택한 인플루언서 ${records.length}명의 제안 메시지를 검토함에 저장했어요.`)
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
    showToast('검색 조건을 초기화했어요.')
  }

  const updateDiscoveryFilter = (field, value) => {
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

  const updateBrandBrief = (field, value) => {
    updateWorkspace((current) => ({
      ...current,
      brandBrief: current.activeBrandId === current.brands[0]?.id
        ? {
            ...current.brandBrief,
            [field]: value,
          }
        : current.brandBrief,
      brands: current.brands.map((brand) =>
        brand.id === current.activeBrandId
          ? {
              ...brand,
              name: field === 'brandName' ? value : brand.name,
              brief: {
                ...brand.brief,
                [field]: value,
              },
            }
          : brand,
      ),
    }))
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

  const saveLearningMaterials = (materials, sourceLabel) => {
    if (!materials.length) {
      showToast('저장할 브랜드 학습자료가 없습니다. 시트 내용을 확인해주세요.')
      return
    }

    updateWorkspace((current) => {
      const nextBrands = current.brands.map((brand) => {
        if (brand.id !== current.activeBrandId) return brand
        const currentMaterials = getLearningMaterials(brand.brief)
        return {
          ...brand,
          brief: {
            ...brand.brief,
            learningMaterials: [...materials, ...currentMaterials].slice(0, 80),
          },
        }
      })
      const activeBrandForUpdate = nextBrands.find((brand) => brand.id === current.activeBrandId)

      return appendActivity(
        {
          ...current,
          brands: nextBrands,
          brandBrief:
            current.activeBrandId === current.brands[0]?.id && activeBrandForUpdate
              ? activeBrandForUpdate.brief
              : current.brandBrief,
        },
        'brand',
        `${activeBrand.name} 브랜드 학습자료 ${materials.length}건 저장 · ${sourceLabel}`,
      )
    })
    showToast(`브랜드 학습자료 ${materials.length}건을 저장했어요.`)
  }

  const importLearningPaste = () => {
    const materials = parseLearningText(learningDraft.pasteText, 'Google Sheets 붙여넣기', '붙여넣기')
    saveLearningMaterials(materials, 'Google Sheets 붙여넣기')
    if (materials.length) setLearningDraft((draft) => ({ ...draft, pasteText: '' }))
  }

  const importLearningSheetUrl = async () => {
    const url = googleSheetCsvUrl(learningDraft.sheetUrl)
    if (!url) {
      showToast('Google Sheet 공개 CSV URL 또는 공유 링크를 입력해주세요.')
      return
    }

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('시트 데이터를 가져오지 못했습니다.')
      const text = await response.text()
      const materials = parseLearningText(text, 'Google Sheets URL', learningDraft.sheetUrl)
      saveLearningMaterials(materials, 'Google Sheets URL')
    } catch {
      showToast('공개 CSV/게시 링크만 자동 가져올 수 있어요. 비공개 시트는 범위를 복사해 붙여넣어주세요.')
    }
  }

  const importLearningFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (/\.xls$/i.test(file.name)) {
      showToast('구형 .xls 파일은 .xlsx 또는 CSV/TSV로 저장한 뒤 업로드해주세요.')
      event.target.value = ''
      return
    }

    try {
      const materials = /\.xlsx$/i.test(file.name)
        ? buildLearningMaterialsFromRows(await readSheet(file), '엑셀 업로드', file.name)
        : parseLearningText(await file.text(), '엑셀/CSV 업로드', file.name)
      saveLearningMaterials(materials, file.name)
    } catch {
      showToast('파일을 읽지 못했어요. .xlsx, CSV 또는 TSV 형식인지 확인해주세요.')
    } finally {
      event.target.value = ''
    }
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

  const buildCampaignContentGuideFromDraft = (draft = campaignDraft) =>
    buildInfluencerContentGuide({
      brand: activeBrand,
      brief: brandBrief,
      campaign: draft,
      creators: getCreatorsByIds(creators, shortlist),
    })

  const generateCampaignContentGuide = () => {
    const nextGuide = buildCampaignContentGuideFromDraft()
    setCampaignDraft((current) => ({
      ...current,
      generatedContentGuide: nextGuide,
    }))
    showToast('인플루언서 전달용 콘텐츠 가이드를 생성했어요.')
  }

  const downloadGeneratedCampaignContentGuide = async (format = 'docx') => {
    const guide = campaignDraft.generatedContentGuide || buildCampaignContentGuideFromDraft()
    const filenameBase = `creatorops-${safeFilePart(activeBrand.name || 'brand')}-${safeFilePart(campaignDraft.name || 'campaign')}-content-guide`

    if (format === 'pptx') {
      await exportGuidePptx(filenameBase, guide)
    } else if (format === 'google') {
      await openGuideGoogleDraft(guide)
    } else {
      await exportGuideDocx(filenameBase, guide)
    }

    if (!campaignDraft.generatedContentGuide) {
      setCampaignDraft((current) => ({
        ...current,
        generatedContentGuide: guide,
      }))
    }
    showToast(format === 'google' ? '가이드 본문을 복사하고 Google 문서를 열었어요.' : `콘텐츠 가이드를 ${format === 'pptx' ? 'PPT' : 'DOCX'}로 다운로드했어요.`)
  }

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
    const searchText = [query, brandBrief.product, brandBrief.keywords, brandBrief.persona]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    const maxResults = Math.min(Math.max(Number(realDiscoveryDraft.maxResults) || 8, 1), 20)
    const youtubeApiKey = realDiscoveryDraft.youtubeApiKey.trim() || youtubeDraft.apiKey.trim()
    const hasGoogleSearch = realDiscoveryDraft.googleApiKey.trim() && realDiscoveryDraft.googleCx.trim()

    if (!youtubeApiKey && !hasGoogleSearch) {
      showToast('실제 발굴은 YouTube Data API 키 또는 Google Search API 키/CX를 연결해야 합니다.')
      return
    }

    setRealDiscoverySearching(true)

    try {
      const results = []
      const wantsYouTube = platform === '전체' || platform === 'YouTube'

      if (wantsYouTube && youtubeApiKey) {
        results.push(
          ...(await searchYouTubeCreatorDiscovery({
            apiKey: youtubeApiKey,
            query: searchText,
            maxResults,
          })),
        )
      }

      if (hasGoogleSearch) {
        results.push(
          ...(await searchGoogleProfileDiscovery({
            apiKey: realDiscoveryDraft.googleApiKey,
            cx: realDiscoveryDraft.googleCx,
            query: searchText,
            platform,
            maxResults,
          })),
        )
      }

      const discoveredCreators = results.map((result, index) =>
        buildRealDiscoveryCreator(
          result,
          brandBrief,
          category === '전체' ? brandBrief.categories?.[0] : category,
          index + 1,
        ),
      )

      if (!discoveredCreators.length) {
        showToast('실제 검색 결과에서 가져올 프로필을 찾지 못했어요. 검색어를 더 구체화해주세요.')
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
            ].slice(0, 100),
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
      showToast(`실제 공개 검색 결과 ${discoveredCreators.length}명을 발굴 리스트에 저장했어요.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '실제 발굴 검색 중 오류가 발생했어요.')
    } finally {
      setRealDiscoverySearching(false)
    }
  }

  const runAiDiscovery = () => {
    const eligibleCreators = creators.filter(
      (creator) => {
        const pendingMetrics = hasPendingMetrics(creator)
        return (
          !isExampleCreator(creator) &&
          (pendingMetrics || creator.followers >= Number(brandBrief.minFollowers)) &&
          (pendingMetrics || creator.price <= Number(brandBrief.maxPrice)) &&
          matchesBriefPlatform(creator, brandBrief.platforms)
        )
      },
    )
    const ranked = eligibleCreators
      .map((creator) => ({
        ...buildRecommendation(creator, brandBrief, selectedCampaign),
        brandId: activeBrand.id,
      }))
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
        `${activeBrand.name} 조건으로 AI 후보 ${ranked.length}명 추출`,
      ),
    )
    showToast(`AI가 브랜드 페르소나 기준으로 후보 ${ranked.length}명을 추출했어요.`)
  }

  const generateInfluencerStrategy = () => {
    const strategy = buildInfluencerStrategy({
      brand: activeBrand,
      brief: brandBrief,
      campaign: selectedCampaign,
      creators,
      recommendations: activeRecommendations,
      learningMaterials: activeLearningMaterials,
    })
    setInfluencerStrategy(strategy)
    showToast('브랜드 조건 기반 인플루언서 전략을 생성했어요.')
  }

  const downloadInfluencerStrategy = () => {
    const strategy =
      influencerStrategy ||
      buildInfluencerStrategy({
        brand: activeBrand,
        brief: brandBrief,
        campaign: selectedCampaign,
        creators,
        recommendations: activeRecommendations,
        learningMaterials: activeLearningMaterials,
      })
    exportFile(
      `creatorops-${safeFilePart(activeBrand.name || brandBrief.brandName)}-influencer-strategy.md`,
      'text/markdown;charset=utf-8',
      strategy,
    )
    if (!influencerStrategy) setInfluencerStrategy(strategy)
    showToast('인플루언서 전략 문서를 다운로드했어요.')
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
    setModal({ type: 'campaign', campaignId: campaign.id })
  }

  const getCampaignContentGuide = (campaign) =>
    campaign?.generatedContentGuide ||
    buildInfluencerContentGuide({
      brand: activeBrand,
      brief: brandBrief,
      campaign,
      creators: getCreatorsByIds(creators, campaign?.creatorIds ?? []),
    })

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
    const generatedContentGuide = campaignDraft.generatedContentGuide || buildCampaignContentGuideFromDraft(campaignDraft)
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
      objective: campaignDraft.objective,
      campaignType: campaignDraft.campaignType || '제안형',
      mission:
        campaignDraft.mission ||
        `${brandBrief.product}를 ${brandBrief.persona}에게 자연스럽게 소개하는 콘텐츠`,
      reward: campaignDraft.reward || '제품 제공 + 협의 리워드',
      approvalFlow: campaignDraft.approvalFlow || '브리프 전달 → 콘텐츠 검수 → 게시 확인 → 성과 리포트',
      commerceMetric: campaignDraft.commerceMetric || '조회/댓글/공유와 전환 링크',
      kpiGoal: campaignDraft.kpiGoal || '조회수/전환 KPI 미정',
      targetViews: normalizeNumericTarget(campaignDraft.targetViews),
      targetConversions: normalizeNumericTarget(campaignDraft.targetConversions),
      targetOrders: normalizeNumericTarget(campaignDraft.targetOrders),
      targetRevenue: normalizeNumericTarget(campaignDraft.targetRevenue),
      sellerRecruitTarget: Number(campaignDraft.sellerRecruitTarget) || 0,
      brandGuideAttachments: campaignDraft.brandGuideAttachments ?? [],
      guideSeedType: campaignDraft.guideSeedType,
      guideChannel: campaignDraft.guideChannel,
      oneMessage: campaignDraft.oneMessage,
      hookPoints: campaignDraft.hookPoints,
      generatedContentGuide,
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
      objective: '브랜드 인지도',
      campaignType: '제안형',
      mission: '',
      reward: '',
      approvalFlow: '',
      commerceMetric: '',
      kpiGoal: '',
      targetViews: '',
      targetConversions: '',
      targetOrders: '',
      targetRevenue: '',
      sellerRecruitTarget: '',
      brandGuideAttachments: [],
      campaignGuideMaterials: [],
      guideSeedType: '무가시딩',
      guideChannel: 'Instagram Reels',
      oneMessage: '',
      hookPoints: '',
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

  const createTrackedPost = (event) => {
    event.preventDefault()
    const campaignId = Number(trackingDraft.campaignId) || selectedCampaign?.id
    const creatorId = Number(trackingDraft.creatorId) || selectedCreator?.id
    if (!campaignId || !creatorId) {
      showToast('추적할 캠페인과 크리에이터를 먼저 선택해주세요.')
      return
    }
    if (!trackingDraft.url.trim()) {
      showToast('자동 추적을 위해 업로드 링크는 반드시 입력해주세요.')
      return
    }
    const hasManualMetrics = [
      trackingDraft.views,
      trackingDraft.likes,
      trackingDraft.comments,
      trackingDraft.shares,
      trackingDraft.saves,
      trackingDraft.conversions,
    ].some((value) => String(value || '').trim())
    const nextPost = {
      id: createId(),
      campaignId,
      creatorId,
      platform: trackingDraft.platform,
      title: trackingDraft.title || '신규 캠페인 콘텐츠',
      url: trackingDraft.url.trim(),
      status: hasManualMetrics ? '추적 중' : '자동 갱신 대기',
      publishedAt: nowLabel(),
      views: Number(trackingDraft.views) || 0,
      likes: Number(trackingDraft.likes) || 0,
      comments: Number(trackingDraft.comments) || 0,
      shares: Number(trackingDraft.shares) || 0,
      saves: Number(trackingDraft.saves) || 0,
      conversions: Number(trackingDraft.conversions) || 0,
      metricsSource: hasManualMetrics ? '수동 입력' : '업로드 링크 등록',
      lastChecked: hasManualMetrics ? nowLabel() : '자동 갱신 대기',
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
      conversions: '',
    })
    setModal(null)
    showToast('콘텐츠 추적 항목을 저장했어요.')
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

  const refreshTracking = ({ mode = 'manual' } = {}) => {
    const isAuto = mode === 'daily-auto'
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
              metricsSource: isAuto ? '일일 자동 갱신' : '즉시 갱신',
              lastChecked: nowLabel(),
            }
          }),
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

  const toggleOutreachSelection = (itemId) => {
    setSelectedOutreachIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    )
  }

  const toggleAllOutreachItems = () => {
    setSelectedOutreachIds(allOutreachSelected ? [] : selectedCampaignOutreach.map((item) => item.id))
  }

  const markSelectedOutreachSent = () => {
    if (!selectedOutreachItems.length) {
      showToast('발송 완료로 처리할 메시지를 먼저 선택해주세요.')
      return
    }

    const selectedIds = new Set(selectedOutreachItems.map((item) => item.id))
    const eventTime = nowLabel()
    updateWorkspace((current) =>
      appendActivity(
        {
          ...current,
          outreach: current.outreach.map((item) =>
            selectedIds.has(item.id)
              ? { ...item, status: '발송 완료', sentAt: item.sentAt || eventTime }
              : item,
          ),
        },
        'outreach',
        `선택 메시지 ${selectedIds.size}건 발송 완료 처리`,
      ),
    )
    setSelectedOutreachIds([])
    showToast(`선택한 메시지 ${selectedIds.size}건을 발송 완료로 기록했어요.`)
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

  const saveContentReference = (event) => {
    event.preventDefault()

    if (!selectedCampaign) {
      showToast('레퍼런스를 묶을 캠페인을 먼저 선택하세요.')
      return
    }

    if (!referenceDraft.title.trim() || !referenceDraft.url.trim()) {
      showToast('레퍼런스 제목과 링크는 필수입니다.')
      return
    }

    const nextReference = {
      id: createId(),
      campaignId: selectedCampaign.id,
      mediaType: referenceDraft.mediaType,
      platform: referenceDraft.platform,
      country: referenceDraft.country || 'KR',
      title: referenceDraft.title.trim(),
      url: referenceDraft.url.trim(),
      thumbnailUrl: referenceDraft.thumbnailUrl.trim(),
      views: Number(referenceDraft.views || 0),
      accountFollowers: Number(referenceDraft.accountFollowers || 0),
      likes: Number(referenceDraft.likes || 0),
      comments: Number(referenceDraft.comments || 0),
      shares: Number(referenceDraft.shares || 0),
      publishedAt: referenceDraft.publishedAt || '수동 등록',
      hook: referenceDraft.hook.trim(),
      analysis: referenceDraft.analysis.trim(),
      applyIdea: referenceDraft.applyIdea.trim(),
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
    showToast('콘텐츠 레퍼런스를 저장했어요.')
  }

  const applyReferenceSearch = (event) => {
    event.preventDefault()
    setReferenceFilters((current) => ({
      ...current,
      appliedQuery: current.query,
    }))
    showToast(referenceFilters.query.trim() ? '레퍼런스 검색 결과를 적용했어요.' : '전체 레퍼런스를 표시합니다.')
  }

  const resetReferenceSearch = () => {
    setReferenceFilters({
      query: '',
      appliedQuery: '',
      country: '전체',
      mediaType: '전체',
      platform: '전체',
      sort: 'views',
    })
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

    const material = {
      id: createId(),
      title: `제작 레퍼런스 · ${reference.title}`,
      sourceType: '콘텐츠 레퍼런스',
      sourceName: `${reference.platform} · ${reference.mediaType} · ${reference.country || '국가 미입력'}`,
      summary: reference.analysis || reference.hook || reference.applyIdea || reference.title,
      keywords: `${reference.platform}, ${reference.mediaType}, ${reference.country || ''}`.trim(),
      doSay: [reference.hook, reference.applyIdea].filter(Boolean).join(' / '),
      dontSay: '',
      createdAt: nowLabel(),
    }

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
              <Stat label="AI 추천" value={`${selectedCampaignRecommendations.length}명`} />
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

        {visibleSection === 'settings' && (
          <section className="settings-grid">
            <section className="panel settings-sync-panel">
              <div className="panel-heading">
                <div>
                  <span className="mini-label">Production Connection</span>
                  <h2>운영 연결 상태</h2>
                </div>
                <button className="primary-button compact-button" type="button" onClick={syncWorkspaceNow}>
                  <RefreshCw size={16} />
                  지금 공유 DB 저장
                </button>
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
              <div className="integration-checklist">
                <article className={backendConfig.hasSupabase ? 'ready' : ''}>
                  <strong>팀 공유 DB/Auth</strong>
                  <span>{backendConfig.hasSupabase ? 'Supabase env 연결됨' : 'Supabase env 필요'}</span>
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
        <section className="ai-grid">
          <section className="panel ai-brief-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">AI Discovery</span>
                <h2>브랜드 조건 설정</h2>
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
                  <strong>브리프 붙여넣기 + 조건 세팅</strong>
                  <p>제품, 후킹포인트, 희망 인플루언서 조건을 붙여넣으면 실제 검색에 쓸 브랜드 조건과 발굴 필터를 세팅합니다.</p>
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
                  <small>목표 후보 {briefAutoDraft.result.candidateTargetCount}명 조건 세팅 · 실제 후보는 아래 실제 웹 발굴로 수집</small>
                  <p>{briefAutoDraft.result.hookSummary || '후킹포인트를 학습자료에 반영했습니다.'}</p>
                </div>
              )}
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
            <div className="strategy-builder">
              <div className="strategy-builder-head">
                <div>
                  <span className="mini-label">Influencer Strategy</span>
                  <strong>인플루언서 전략 짜기</strong>
                  <p>브랜드, 제품, 타깃, KPI, 예산, 학습자료를 기준으로 캐스팅 믹스와 콘텐츠 후킹, KPI 운영안을 먼저 정리합니다.</p>
                </div>
                <div className="strategy-actions">
                  <button className="primary-button compact-button" type="button" onClick={generateInfluencerStrategy}>
                    <Target size={16} />
                    전략 생성
                  </button>
                  <button className="secondary-button compact-button" type="button" onClick={downloadInfluencerStrategy}>
                    <Download size={16} />
                    다운로드
                  </button>
                </div>
              </div>
              {influencerStrategy ? (
                <div className="strategy-preview">
                  <span>생성된 전략 미리보기</span>
                  <pre>{influencerStrategy.slice(0, 1600)}</pre>
                </div>
              ) : (
                <div className="strategy-empty">
                  <FileText size={18} />
                  <span>전략을 생성하면 추천 후보를 고르기 전 캐스팅 기준과 콘텐츠 방향이 이곳에 정리됩니다.</span>
                </div>
              )}
            </div>
            <div className="learning-materials">
              <div className="learning-head">
                <div>
                  <span className="mini-label">Brand Learning</span>
                  <strong>브랜드/제품 학습자료</strong>
                  <p>제품 브리프, 상세페이지 문구, 금지표현, 기존 성과를 엑셀 파일 또는 Google Sheets로 넣으면 추천 이유와 제안 메시지에 반영합니다.</p>
                </div>
                <span className="result-count">{activeLearningMaterials.length}건</span>
              </div>

              <div className="learning-import-grid">
                <label className="learning-file-input">
                  엑셀/CSV 업로드
                  <input accept=".csv,.tsv,.txt,.xlsx" type="file" onChange={importLearningFile} />
                  <small>.xlsx, CSV, TSV 지원</small>
                </label>
                <label>
                  Google Sheet URL
                  <input
                    value={learningDraft.sheetUrl}
                    onChange={(event) => setLearningDraft({ ...learningDraft, sheetUrl: event.target.value })}
                    placeholder="공개 시트 URL 또는 CSV 게시 링크"
                  />
                </label>
                <button className="secondary-button compact-button" type="button" onClick={importLearningSheetUrl}>
                  시트 가져오기
                </button>
              </div>

              <label className="learning-paste">
                Google Sheets 범위 붙여넣기
                <textarea
                  value={learningDraft.pasteText}
                  onChange={(event) => setLearningDraft({ ...learningDraft, pasteText: event.target.value })}
                  placeholder="제목\t내용\t키워드\t권장표현\t금지표현"
                />
              </label>
              <button className="secondary-button compact-button learning-save-button" type="button" onClick={importLearningPaste}>
                붙여넣기 저장
              </button>

              <div className="learning-list">
                {activeLearningMaterials.length === 0 ? (
                  <p>아직 등록된 학습자료가 없습니다.</p>
                ) : (
                  activeLearningMaterials.slice(0, 4).map((item) => (
                    <article key={item.id}>
                      <span>{item.sourceType}</span>
                      <strong>{item.title}</strong>
                      <p>{item.summary || item.keywords || '내용 미입력'}</p>
                      {item.dontSay && <small>주의: {item.dontSay}</small>}
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="panel ai-result-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Recommended Personas</span>
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
                <span className="result-count">{selectedCampaignRecommendations.length}명</span>
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
                  <p>현재 선택한 캠페인 기준으로 AI 매칭을 실행하세요.</p>
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
                <span className="mini-label">Discovery</span>
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

            <div className="real-discovery-panel">
              <div className="real-discovery-copy">
                <span className="mini-label">Live Discovery</span>
                <strong>예시 후보 숨김 · 실제 공개 검색 결과만 저장</strong>
                <p>YouTube는 공식 Data API로 채널과 구독자/평균 조회를 가져오고, Instagram/TikTok은 Google Programmable Search로 실제 프로필 URL을 가져온 뒤 수치를 검증 대기로 남깁니다.</p>
              </div>
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
                  Google Search Key
                  <input
                    type="password"
                    value={realDiscoveryDraft.googleApiKey}
                    onChange={(event) => setRealDiscoveryDraft({ ...realDiscoveryDraft, googleApiKey: event.target.value })}
                    placeholder="Programmable Search API 키"
                  />
                </label>
                <label>
                  Search CX
                  <input
                    value={realDiscoveryDraft.googleCx}
                    onChange={(event) => setRealDiscoveryDraft({ ...realDiscoveryDraft, googleCx: event.target.value })}
                    placeholder="검색엔진 ID"
                  />
                </label>
                <label>
                  가져올 수
                  <input
                    inputMode="numeric"
                    value={realDiscoveryDraft.maxResults}
                    onChange={(event) => setRealDiscoveryDraft({ ...realDiscoveryDraft, maxResults: event.target.value })}
                    placeholder="8"
                  />
                </label>
              </div>
              <div className="real-discovery-actions">
                <button className="primary-button compact-button" type="button" onClick={runRealDiscoverySearch} disabled={realDiscoverySearching}>
                  <Search size={16} />
                  {realDiscoverySearching ? '검색 중' : '실제 검색'}
                </button>
                <button className="secondary-button compact-button" type="button" onClick={() => setShowExampleCreators((current) => !current)}>
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
                  <span>발굴 리스트에서 선택한 인플루언서에게 한 번에 제안 메시지를 생성합니다.</span>
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

            <div className="creator-list">
              {filteredCreators.length === 0 ? (
                <div className="empty-state">
                  <Search size={22} />
                  <strong>실제 발굴 후보가 없습니다.</strong>
                  <p>API 키를 연결하고 `실제 웹 발굴`을 실행하면 공개 검색 결과가 이 리스트에 저장됩니다.</p>
                  <button type="button" onClick={resetSearch}>
                    전체 후보 보기
                  </button>
                  <button type="button" onClick={() => setShowExampleCreators(true)}>
                    예시 후보 보기
                  </button>
                </div>
              ) : (
                filteredCreators.map((creator) => (
                  <CreatorRow
                    key={creator.id}
                    creator={creator}
                    active={selectedCreator?.id === creator.id}
                    saved={shortlist.includes(creator.id)}
                    checked={selectedDiscoveryCreatorIds.includes(creator.id)}
                    onSelect={() => {
                      setSelectedCreatorId(creator.id)
                      showToast(`${creator.name} 분석 패널을 열었어요.`)
                    }}
                    onSave={() => toggleShortlist(creator)}
                    onToggle={() => toggleDiscoveryCreatorSelection(creator.id)}
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
                onClick={toggleAllCandidatePoolCreators}
                disabled={!candidatePoolCreators.length}
              >
                {allCandidatePoolSelected ? '전체 해제' : '전체 선택'}
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
          <div className="candidate-pool-list">
            {candidatePoolCreators.length === 0 ? (
              <div className="empty-state compact-empty">
                <UsersRound size={22} />
                <strong>메시지 전 후보가 없습니다.</strong>
                <p>발굴 리스트나 AI 추천에서 후보를 저장하면 이곳에 쌓이고, 메시지 검토함으로 보내기 전까지 관리할 수 있습니다.</p>
              </div>
            ) : (
              candidatePoolCreators.map((creator) => (
                <CreatorRow
                  key={creator.id}
                  creator={creator}
                  active={selectedCreator?.id === creator.id}
                  saved={shortlist.includes(creator.id)}
                  checked={selectedCandidatePoolIds.includes(creator.id)}
                  onSelect={() => setSelectedCreatorId(creator.id)}
                  onSave={() => toggleShortlist(creator)}
                  onToggle={() => toggleCandidatePoolSelection(creator.id)}
                />
              ))
            )}
          </div>
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
                onClick={() => setReferenceFilters({ ...referenceFilters, country: countryOption })}
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
                onChange={(event) => setReferenceFilters({ ...referenceFilters, query: event.target.value })}
                placeholder="키워드 검색: 제품, 후킹, 썸네일, CTA, 플랫폼"
              />
            </label>
            <button className="primary-button compact-button" type="submit">
              <Search size={15} />
              검색하기
            </button>
            <button className="secondary-button compact-button" type="button" onClick={resetReferenceSearch}>
              초기화
            </button>
          </form>

          <div className="reference-filter-bar">
            <label>
              <span>국가</span>
              <select
                value={referenceFilters.country}
                onChange={(event) => setReferenceFilters({ ...referenceFilters, country: event.target.value })}
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
                onChange={(event) => setReferenceFilters({ ...referenceFilters, mediaType: event.target.value })}
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
                onChange={(event) => setReferenceFilters({ ...referenceFilters, platform: event.target.value })}
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
                onChange={(event) => setReferenceFilters({ ...referenceFilters, sort: event.target.value })}
              >
                <option value="views">조회수 순위</option>
                <option value="virality">팔로워 대비 터진 순위</option>
                <option value="shares">공유 순위</option>
                <option value="recent">최근 등록순</option>
              </select>
            </label>
          </div>

          <div className="reference-list">
            {visibleReferences.map((item, index) => (
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
                    <div>
                      {item.mediaType === '영상' ? <Video size={24} /> : <ImageIcon size={24} />}
                    </div>
                  )}
                </div>
                <div className="reference-body">
                  <div className="tracked-post-head">
                    <span className="reference-rank-chip">#{index + 1}</span>
                    <span className="type-chip">{item.mediaType}</span>
                    <span className="type-chip">{item.platform}</span>
                    <span className="type-chip">{item.country || '국가 미입력'}</span>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.publishedAt} · 저장 {item.savedAt}</p>
                  <div className="tracked-account-meta">
                    <span>조회 {compactNumber(item.views)}</span>
                    <span>팔로워 {item.accountFollowers ? compactNumber(item.accountFollowers) : '-'}</span>
                    <span>폭발 {getReferenceVirality(item) ? `${getReferenceVirality(item).toFixed(1)}x` : '-'}</span>
                    <span>좋아요 {compactNumber(item.likes)}</span>
                    <span>댓글 {compactNumber(item.comments)}</span>
                    <span>공유 {compactNumber(item.shares)}</span>
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
                <p>국가, 미디어, 플랫폼 필터를 조정하거나 새 영상/이미지 레퍼런스를 저장하세요.</p>
              </div>
            )}
          </div>

          <form className="reference-form" onSubmit={saveContentReference}>
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
            <div className="reference-form-grid two">
              <label>
                <span>콘텐츠 링크</span>
                <input
                  value={referenceDraft.url}
                  onChange={(event) => setReferenceDraft({ ...referenceDraft, url: event.target.value })}
                  placeholder="https://..."
                />
              </label>
              <label>
                <span>이미지/썸네일 URL</span>
                <input
                  value={referenceDraft.thumbnailUrl}
                  onChange={(event) => setReferenceDraft({ ...referenceDraft, thumbnailUrl: event.target.value })}
                  placeholder="이미지 레퍼런스 또는 썸네일 URL"
                />
              </label>
            </div>
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

          <div className="production-reference-shelf">
            <div className="production-reference-head">
              <div>
                <span className="mini-label">Saved for Production</span>
                <strong>제작 레퍼런스 저장 리스트</strong>
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
        <section className={`ops-grid ${visibleSection !== 'messages' ? 'single-column-view' : ''}`}>
          {visibleSection === 'messages' && (
          <section className="panel" id="messages">
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
              <article>
                <span>검토함</span>
                <strong>{selectedCampaignOutreach.filter((item) => item.status === '승인 대기').length}건</strong>
                <p>문구 확인 후 발송 처리</p>
              </article>
              <article>
                <span>발송완료</span>
                <strong>{selectedCampaignOutreach.filter((item) => item.status === '발송 완료').length}건</strong>
                <p>응답 대기 및 후속 확인</p>
              </article>
              <article>
                <span>응답</span>
                <strong>{selectedCampaignOutreach.filter((item) => item.status === '응답').length}건</strong>
                <p>조건 확인 후 섭외 완료</p>
              </article>
              <article>
                <span>연락 채널</span>
                <strong>{new Set(selectedCampaignOutreach.map((item) => item.channel || 'manual_other')).size}개</strong>
                <p>이메일, DM, 수동 채널 분리</p>
              </article>
            </div>
            <div className="message-bulk-toolbar">
              <label className="selection-check">
                <input
                  type="checkbox"
                  checked={allOutreachSelected}
                  disabled={!selectedCampaignOutreach.length}
                  onChange={toggleAllOutreachItems}
                />
                전체 선택
              </label>
              <span>{selectedOutreachItems.length}건 선택</span>
              <button
                className="primary-button compact-button"
                type="button"
                disabled={!selectedOutreachItems.length}
                onClick={markSelectedOutreachSent}
              >
                <Send size={15} />
                선택 메시지 발송 완료
              </button>
            </div>
            <div className="record-list">
              {selectedCampaignOutreach.length === 0 ? (
                <div className="empty-state compact-empty">
                  <MessageSquare size={22} />
                  <strong>아직 검토할 제안 메시지가 없습니다.</strong>
                  <p>현재 선택한 캠페인의 AI 추천 후보나 크리에이터 상세에서 제안 메시지를 저장해보세요.</p>
                </div>
              ) : (
              selectedCampaignOutreach.map((item) => (
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
          variant={modal.type === 'campaign' ? 'campaign-modal-card' : modal.type === 'create' ? 'campaign-create-modal' : ''}
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
              <div className="campaign-guide-panel">
                <div>
                  <span className="mini-label">Creator Delivery Assets</span>
                  <strong>브랜드 가이드 첨부/양식</strong>
                  <p>캠페인 원메시지, USP, 금지/주의 표현처럼 크리에이터에게 전달할 자료만 이곳에서 관리합니다.</p>
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
              <div className="campaign-guide-panel content-guide-builder">
                <div>
                  <span className="mini-label">Content Guide Generator</span>
                  <strong>인플루언서 가이드 생성하기</strong>
                  <p>무가시딩/유가시딩/공동구매 유형과 채널 특성에 맞춰 원메시지, 후킹포인트, 필수 컷, 금지 표현을 전달용 가이드로 작성합니다.</p>
                </div>
                <div className="modal-two-col">
                  <label>
                    협업 유형
                    <select
                      value={campaignDraft.guideSeedType}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, guideSeedType: event.target.value })}
                    >
                      {seedingTypeOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    전달 채널
                    <select
                      value={campaignDraft.guideChannel}
                      onChange={(event) => setCampaignDraft({ ...campaignDraft, guideChannel: event.target.value })}
                    >
                      {contentGuideChannelOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  콘텐츠 원메시지
                  <input
                    value={campaignDraft.oneMessage}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, oneMessage: event.target.value })}
                    placeholder="예: 이 제품은 실제 사용 상황에서 가격보다 안정감이 설득 포인트다."
                  />
                </label>
                <label>
                  후킹포인트
                  <textarea
                    value={campaignDraft.hookPoints}
                    onChange={(event) => setCampaignDraft({ ...campaignDraft, hookPoints: event.target.value })}
                    placeholder={'예: 첫 3초 가격/혜택 자막\n실제 사용 장면\n비교 포인트\n댓글 유도 질문'}
                  />
                </label>
                <div className="campaign-guide-actions">
                  <button className="secondary-button compact-button" type="button" onClick={generateCampaignContentGuide}>
                    <FileText size={16} />
                    생성하기
                  </button>
                  <button className="primary-button compact-button" type="button" onClick={() => downloadGeneratedCampaignContentGuide('docx')}>
                    <Download size={16} />
                    DOCX
                  </button>
                  <button className="secondary-button compact-button" type="button" onClick={() => downloadGeneratedCampaignContentGuide('pptx')}>
                    <Download size={16} />
                    PPT
                  </button>
                  <button className="secondary-button compact-button" type="button" onClick={() => downloadGeneratedCampaignContentGuide('google')}>
                    <FileText size={16} />
                    Google 문서
                  </button>
                </div>
                {campaignDraft.generatedContentGuide && (
                  <div className="content-guide-preview">
                    <span>생성된 가이드 미리보기</span>
                    <pre>{campaignDraft.generatedContentGuide.slice(0, 900)}</pre>
                  </div>
                )}
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
              <label>
                마감일
                <input
                  value={campaignDraft.deadline}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, deadline: event.target.value })}
                  placeholder="6월 30일"
                />
              </label>
              <div className="campaign-schedule-fields">
                <span className="mini-label">Campaign Schedule</span>
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
                콘텐츠 URL · 필수
                <input
                  value={trackingDraft.url}
                  onChange={(event) => setTrackingDraft({ ...trackingDraft, url: event.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... 또는 Instagram/TikTok 업로드 링크"
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
              </div>
              <div className="modal-grid">
                <Stat label="예산" value={won(activeCampaignForModal.budget)} />
                <Stat label="집행" value={won(activeCampaignForModal.spend)} />
                <Stat label="예상 매출" value={won(activeCampaignForModal.revenue)} />
                <Stat label="진행률" value={`${activeCampaignForModal.progress}%`} />
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

function CreatorRow({ creator, active, saved, checked, onSelect, onSave, onToggle }) {
  const pendingMetrics = hasPendingMetrics(creator)
  const dataQuality = getCreatorDataQuality(creator)
  return (
    <article className={`creator-row ${active ? 'active' : ''} ${checked ? 'selected' : ''}`}>
      <label className="recommendation-check creator-check" aria-label={`${creator.name} 선택`}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span />
      </label>
      <button className="creator-button" type="button" onClick={onSelect}>
        <img src={creator.avatar} alt="" />
        <div className="creator-copy">
          <div>
            <strong>{creator.name}</strong>
            <span>{creator.handle}</span>
            {creator.needsVerification && <span className="creator-status-chip">검증 대기</span>}
          </div>
          <p>
            {creator.category} · {creator.city} · {creator.lastPost}
          </p>
          <div className="creator-quality-row">
            <span className={`data-quality-chip ${dataQuality.tone}`}>
              데이터 {dataQuality.score} · {dataQuality.level}
            </span>
          </div>
        </div>
      </button>

      <div className="creator-numbers">
        <span>{creator.platform}</span>
        <strong>{pendingMetrics ? '팔로워 수집 필요' : `${compactNumber(creator.followers)} 팔로워`}</strong>
        <small>
          {pendingMetrics
            ? '평균 조회/참여율 검증 대기'
            : `${compactNumber(creator.averageViews)} 평균 조회 · ${percent(creator.engagement)}`}
        </small>
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

function RecommendationCard({ recommendation, creator, checked, onSelect, onToggle, onQueue }) {
  if (!creator) return null
  const pendingMetrics = hasPendingMetrics(creator)
  const dataQuality = getCreatorDataQuality(creator)

  return (
    <article className={`recommendation-card ${checked ? 'selected' : ''}`}>
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
      <ul>
        {recommendation.reasons.slice(0, 3).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="recommendation-footer">
        <span>{recommendation.risk}</span>
        <button className="secondary-button compact-button" type="button" onClick={onQueue}>
          메시지 검토함
        </button>
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

