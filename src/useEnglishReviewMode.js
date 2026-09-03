import { useEffect } from 'react'

const exactTranslations = new Map([
  ['운영 CRM', 'Operations CRM'],
  ['브랜드 워크스페이스', 'Brand workspace'],
  ['관리 브랜드', 'Managed brand'],
  ['스킨케어 D2C 브랜드', 'Skincare D2C Brand'],
  ['AI 노트북 브랜드', 'AI Laptop Brand'],
  ['헬시 스낵 브랜드', 'Healthy Snack Brand'],
  ['대시보드', 'Dashboard'],
  ['캠페인', 'Campaigns'],
  ['캠페인 운영', 'Campaign operations'],
  ['캠페인 파이프라인', 'Campaign pipeline'],
  ['제안형', 'Proposal'],
  ['캠페인 상세 보기', 'View campaign'],
  ['KPI 달성률', 'KPI attainment'],
  ['구매 전환', 'Purchase conversions'],
  ['제품 제공', 'Product seeding'],
  ['스토리 리마인드', 'Story reminders'],
  ['집행', 'Spent'],
  ['전환', 'Conversions'],
  ['매출', 'Revenue'],
  ['발굴', 'Discovery'],
  ['후보 그룹', 'Candidate groups'],
  ['메시지', 'Messages'],
  ['리포트', 'Reports'],
  ['레퍼런스', 'References'],
  ['콘텐츠 레퍼런스', 'Content references'],
  ['인기 콘텐츠 레퍼런스', 'Popular content references'],
  ['콘텐츠 레퍼런스 찾기', 'Find content references'],
  ['콘텐츠 검색·저장', 'Search and save content'],
  ['저장 콘텐츠 리스트', 'Saved content list'],
  ['브랜드 검색 및 추적', 'Brand discovery and tracking'],
  ['경쟁사 저장기능', 'Save competitor brands'],
  ['영상', 'Video'],
  ['이미지', 'Image'],
  ['미디어', 'Media'],
  ['순위 기준', 'Sort by'],
  ['검색 필터', 'Search filters'],
  ['검색 결과 필터', 'Filter results'],
  ['검색하기', 'Search'],
  ['검색 중', 'Searching'],
  ['가져올 수', 'Results'],
  ['링크로 찾기', 'Find by URL'],
  ['링크 입력 닫기', 'Close URL input'],
  ['조회수 순위', 'Most viewed'],
  ['공유 순위', 'Most shared'],
  ['최근 등록순', 'Recently added'],
  ['API raw 미리보기', 'API raw preview'],
  ['추천 판단', 'Recommendation'],
  ['원천 상태', 'Source status'],
  ['다음 액션', 'Next action'],
  ['검증 필요', 'Verification required'],
  ['운영 가능', 'Operational'],
  ['우선 제안', 'Priority outreach'],
  ['후보 유지', 'Keep candidate'],
  ['데이터룸 근거 보기', 'View data sources'],
  ['핵심 근거', 'Key evidence'],
  ['근거 자세히 보기', 'View evidence'],
  ['공식 API 연결 가능', 'Official API available'],
  ['수집 출처 보유', 'Collection source recorded'],
  ['팔로워/조회 검증 대기', 'Follower/view verification pending'],
  ['위험 낮음', 'Low risk'],
  ['검색 초기화', 'Reset search'],
  ['검증 높음', 'High confidence'],
  ['신뢰 높음', 'High confidence'],
  ['즉시 제안 가능', 'Ready for outreach'],
  ['실제 단가 입력', 'Enter actual rate'],
  ['데이터 출처', 'Data sources'],
  ['데이터 출처/신뢰도', 'Data sources / confidence'],
  ['핵심 지표 연결됨', 'Core metrics linked'],
  ['저장', 'Save'],
  ['저장됨', 'Saved'],
  ['제작 저장', 'Production saves'],
  ['제작 레퍼런스 저장 리스트', 'Production reference list'],
  ['팔로워 대비 터진 콘텐츠', 'Breakout versus followers'],
  ['좋아요', 'Likes'],
  ['댓글', 'Comments'],
  ['공유', 'Shares'],
  ['폭발', 'Viral multiple'],
  ['데이터룸', 'Data room'],
  ['프랙티스', 'Practice'],
  ['개인정보', 'Privacy'],
  ['약관', 'Terms'],
  ['현재 캠페인', 'Current campaign'],
  ['스프링 세럼 런칭', 'Spring Serum Launch'],
  ['크리에이터 발굴', 'Creator discovery'],
  ['발굴 서치 풀', 'Discovery results'],
  ['메시지 전 후보 풀', 'Pre-outreach pool'],
  ['캠페인 조건 확인', 'Review campaign brief'],
  ['실제 후보 발굴', 'Live creator discovery'],
  ['AI 매칭', 'AI matching'],
  ['후보 풀 저장', 'Save candidate pool'],
  ['발굴 조건 준비', 'Prepare discovery criteria'],
  ['실제 웹 발굴', 'Run live web discovery'],
  ['실제 검색', 'Run live search'],
  ['실제 후보 검색 중', 'Searching live candidates'],
  ['브리프 세팅', 'Brief setup'],
  ['브리프 붙여넣기 + 초안 세팅', 'Paste brief and set initial criteria'],
  ['희망 인플루언서 조건 분석 완료', 'Creator criteria analyzed'],
  ['캠페인 브리프', 'Campaign brief'],
  ['신규 인플루언서 캠페인', 'New influencer campaign'],
  ['캠페인 생성', 'Create campaign'],
  ['캠페인 삭제', 'Delete campaign'],
  ['플랫폼', 'Platform'],
  ['카테고리', 'Category'],
  ['국가', 'Country'],
  ['전체', 'All'],
  ['뷰티', 'Beauty'],
  ['테크', 'Tech'],
  ['푸드', 'Food'],
  ['피트니스', 'Fitness'],
  ['아웃도어', 'Outdoor'],
  ['펫', 'Pet'],
  ['리뷰', 'Review'],
  ['공동구매', 'Group buying'],
  ['검색', 'Search'],
  ['조건 세팅', 'Set criteria'],
  ['AI 매칭 실행', 'Run AI matching'],
  ['후보 등록', 'Add candidate'],
  ['엑셀', 'Excel'],
  ['광고주용', 'Client export'],
  ['시트', 'Google Sheets'],
  ['서버 API 연결됨', 'Server API connected'],
  ['예시 후보 숨김', 'Hide sample candidates'],
  ['예시 보기', 'Show sample candidates'],
  ['발굴 조건', 'Discovery criteria'],
  ['팔로워·평균 조회수 조건', 'Follower and average-view criteria'],
  ['팔로워 최소', 'Minimum followers'],
  ['팔로워 최대', 'Maximum followers'],
  ['구독자·평균 조회수 조건', 'Subscriber and average-view criteria'],
  ['구독자 최소', 'Minimum subscribers'],
  ['구독자 최대', 'Maximum subscribers'],
  ['평균 조회 최소', 'Minimum average views'],
  ['참여율 최소', 'Minimum engagement rate'],
  ['예상 단가 최대', 'Maximum estimated fee'],
  ['매칭 점수 최소', 'Minimum match score'],
  ['브랜드 조건 적용', 'Apply brand criteria'],
  ['초기화', 'Reset'],
  ['전체 선택', 'Select all'],
  ['선택 제안 넣기', 'Create proposal'],
  ['채널 보기', 'View channel'],
  ['상세 보기', 'View details'],
  ['열기', 'Open'],
  ['라이브', 'Live'],
  ['마감', 'Deadline'],
  ['목표', 'Target'],
  ['추천', 'Recommendations'],
  ['AI 추천', 'AI recommendations'],
  ['AI 추천 후보와 근거', 'Recommended creators and rationale'],
  ['1. 실제 웹 발굴', '1. Run live web discovery'],
  ['2. AI 매칭 실행', '2. Run AI matching'],
  ['3. 후보 풀 저장', '3. Save candidate pool'],
  ['TikTok 셀러', 'TikTok seller'],
  ['0/8명', '0/8'],
  ['0명', '0'],
  ['3명', '3'],
  ['1건', '1'],
  ['2건', '2'],
  ['10만+', '100K+'],
  ['명', 'creators'],
  ['건', 'items'],
  ['업로드', 'Uploads'],
  ['섭외완료', 'Recruited'],
  ['데모 후보 보기', 'Show demo candidates'],
  ['전체 후보 보기', 'View all candidates'],
  ['예시 후보 보기', 'View sample candidates'],
  ['추천 엔진 상태', 'Recommendation engine status'],
  ['OpenAI 보강 미검증', 'OpenAI enrichment not verified'],
  ['API 테스트', 'Test API'],
  ['LLM raw 보기', 'View LLM raw'],
  ['원천 추적 지표', 'Source-traceable metrics'],
  ['AI 추천 기준', 'AI recommendation criteria'],
  ['추천 후보와 근거', 'Recommended creators and rationale'],
  ['아직 AI 추천 결과가 없습니다.', 'No AI recommendations yet.'],
  ['발굴 영역으로 이동', 'Go to discovery'],
  ['추천 후보를 선택하세요.', 'Select a recommended creator.'],
  ['제품/서비스', 'Product / service'],
  ['타깃', 'Audience'],
  ['키워드', 'Keywords'],
  ['후보 조건', 'Creator criteria'],
  ['캠페인 상세', 'Campaign details'],
  ['저자극 장벽 세럼', 'Low-irritation barrier serum'],
  ['성분을 꼼꼼히 보고 합리적으로 구매하는 20-30대 여성', 'Value-conscious women aged 20-39 who carefully review ingredients'],
  ['스킨케어, 데일리룩, 올리브영, 가성비, 리뷰', 'skincare, daily routine, Olive Young, value, review'],
  ['왼쪽 AI 추천 리스트에서 후보를 누르면 이곳에서 팔로워, 평균 조회, 예상 단가, 추천 근거와 데이터룸 원천을 바로 확인합니다.', 'Select a creator on the left to review followers, average views, estimated fee, recommendation rationale and source records here.'],
  ['예시 후보 숨김 · 실제 공개 검색 결과만 저장', 'Sample candidates hidden · Only live public search results are saved'],
  ['팔로워 규모보다 조회 효율, 실제 성과 학습, 브랜드 적합도를 먼저 봅니다.', 'Prioritizes view efficiency, observed performance and brand fit over follower count alone.'],
  ['정상', 'Healthy'],
  ['검증 대기', 'Verification pending'],
  ['전체 현황', 'Overview'],
  ['오늘 먼저 처리할 일', "Today's priorities"],
  ['캠페인 기준 확인', 'Review campaign brief'],
  ['후보 발굴', 'Discover creators'],
  ['메시지 발송', 'Send outreach'],
  ['콘텐츠/브랜드 추적', 'Track content and brands'],
  ['캠페인 열기', 'Open campaign'],
  ['발굴로 이동', 'Open discovery'],
  ['검토 대상', 'Pending review'],
  ['메시지 열기', 'Open messages'],
  ['리포트 보기', 'Open reports'],
  ['핵심 지표', 'Key metrics'],
  ['검색 도달', 'Discovery reach'],
  ['예상 조회수', 'Estimated views'],
  ['평균 참여율', 'Average engagement rate'],
  ['섭외 전환률', 'Recruitment conversion rate'],
  ['섭외 완료', 'Recruited'],
  ['운영 세부', 'Operations'],
  ['작업 로그', 'Activity log'],
  ['오늘', 'Today'],
  ['정책', 'Policy'],
  ['담당', 'Owner'],
  ['점검', 'Review'],
  ['정책 raw 보기', 'View policy source'],
  ['조회 성과', 'View performance'],
  ['뷰 효율', 'View efficiency'],
  ['실제 성과 학습', 'Observed performance learning'],
  ['최대 +18점', 'Up to +18 points'],
  ['전략 반영', 'Strategy alignment'],
  ['최대 +8점', 'Up to +8 points'],
  ['리스크/제외어', 'Risk and exclusions'],
  ['감점/보류', 'Penalty or hold'],
  ['성과 우선', 'Performance first'],
  ['효율 검증', 'Efficiency validation'],
  ['캠페인 핏', 'Campaign fit'],
  ['데이터 신뢰도', 'Data confidence'],
  ['1. 브리프 적합', '1. Brief fit'],
  ['2. 성과 효율', '2. Performance efficiency'],
  ['3. 실제 학습', '3. Observed learning'],
  ['4. 리스크 게이트', '4. Risk gate'],
  ['보류 기준:', 'Hold criteria:'],
  ['점수 가중치:', 'Scoring weights:'],
  ['섭외 진행률', 'Recruitment progress'],
  ['데이터 발굴', 'Live discovery'],
  ['틱톡 셀러', 'TikTok sellers'],
  ['메시지 검토함', 'Message review queue'],
  ['성과 추적', 'Performance tracking'],
  ['리소스 풀', 'Reusable creator pool'],
  ['배송/수동 정산', 'Shipping / manual settlement'],
  ['견적', 'Estimate'],
])

const phraseTranslations = [
  ['저자극 장벽 세럼에 맞는 후보 추천과 검색', 'Recommend and search creators for a low-irritation barrier serum'],
  ['검색어, 국가, 플랫폼, 팔로워/조회수 조건을 확인한 뒤 실제 웹 발굴과 AI 매칭을 순서대로 실행하세요.', 'Review the keyword, country, platform, follower and view criteria, then run live web discovery and AI matching.'],
  ['캠페인 조건을 기준으로 실제 웹 발굴을 실행하고, 보낼 후보만 메시지 전 후보 풀로 저장합니다.', 'Run live web discovery from the campaign brief and save only selected creators to the pre-outreach pool.'],
  ['YouTube는 공식 Data API로 채널과 구독자/평균 조회를 가져오고, Instagram/TikTok은 Brave Search로 공개 프로필 URL을 찾은 뒤 수치를 검증 대기로 남깁니다.', 'YouTube uses the official Data API to retrieve public channels, subscriber counts and average views. Instagram and TikTok use public profile discovery and remain pending verification.'],
  ['YouTube · Instagram · TikTok 실제 검색 사용 가능', 'Live search is available for YouTube, Instagram and TikTok'],
  ['검색 결과를 많이 모으는 공간입니다.', 'This area collects live creator discovery results.'],
  ['콘텐츠 추적에서 저장한 개별 영상/이미지는 아래 검색 결과 목록과 하단 제작 저장 리스트에서 확인합니다.', 'Find saved videos and images in the content results below and in the production reference list.'],
  ['검색은 공개 수치만 가져옵니다. 저장한 레퍼런스만 분석하고 가이드 차용에 사용합니다.', 'Search retrieves public metrics only. Only saved references are analyzed and considered for guide reuse.'],
  ['위 검색으로 추가된 레퍼런스와 저장된 레퍼런스를 국가, 미디어, 플랫폼, 순위 기준으로 좁혀봅니다.', 'Filter searched and saved references by country, media, platform, and ranking.'],
  ['키워드 검색: 제품, 후킹, 썸네일, CTA, 플랫폼', 'Search by product, hook, thumbnail, CTA, or platform'],
  ['스프링 세럼 런칭 제작에 사용할 영상/이미지 레퍼런스', 'Video and image references for Spring Serum Launch'],
  ['선택한 후보를 메시지 전 후보 풀에 저장하거나 바로 제안 메시지를 생성합니다.', 'Save selected creators to the pre-outreach pool or create an outreach message.'],
  [' 관심층', ' audience'],
  [' 중심', ' focused'],
  ['조회 ', 'Views '],
  ['팔로워 ', 'Followers '],
  ['좋아요 ', 'Likes '],
  ['댓글 ', 'Comments '],
  ['공유 ', 'Shares '],
  ['저장 ', 'Saved '],
  ['명 선택', ' creators selected'],
  ['영상 ', 'Video '],
  [' · 이미지 ', ' · Images '],
  ['개 콘텐츠 raw', ' content records'],
  ['제작 저장 ', 'production saves '],
  ['플랫폼/국가/조회수 조건으로 후보를 찾고, 선택한 후보만 메시지 전 후보 풀로 보냅니다.', 'Find creators by platform, country and performance criteria, then send only selected creators to the pre-outreach pool.'],
  ['AI 추천은 저장된 검색 결과 풀을 기준으로 점수화합니다. 먼저 실제 웹 발굴로 후보를 모은 뒤 AI 매칭을 실행하세요.', 'AI recommendations score the saved live discovery pool. First collect candidates, then run AI matching.'],
  ['브리프 기준으로 실제 후보 검색을 먼저 실행하세요.', 'Run live creator discovery from the campaign brief first.'],
  ['캠페인 기준으로 발굴, 그룹, 메시지, 리포트가 이어집니다.', 'Discovery, candidate groups, outreach and reports stay connected to this campaign.'],
  ['크리에이터, 카테고리, 키워드', 'Creator, category or keyword'],
  ['목표 후보', 'Target candidates'],
  ['조건 세팅', 'criteria configured'],
  ['실제 후보는 아래 실제 웹 발굴 후 후보 매칭으로 추천', 'Live candidates are recommended after web discovery and matching'],
  ['1단계 · 조건 확인', 'Step 1 · Review criteria'],
  ['2단계 · 실제 후보 발굴', 'Step 2 · Live creator discovery'],
  ['3단계 · AI 매칭', 'Step 3 · AI matching'],
  ['4단계 · 후보 풀 저장', 'Step 4 · Save candidate pool'],
  ['라이브 · 스킨케어 D2C 브랜드 · 마감 5월 28일', 'Live · Skincare D2C Brand · Deadline May 28'],
  ['AI 추천0/8명', 'AI recommendations 0/8'],
  ['AI recommendations0/8명', 'AI recommendations 0/8'],
  ['메시지1건', 'Messages 1'],
  ['Messages1건', 'Messages 1'],
  ['업로드2건', 'Uploads 2'],
  ['Uploads2건', 'Uploads 2'],
  ['섭외완료0명', 'Recruited 0'],
  ['Recruited0명', 'Recruited 0'],
  ['크리에이터 조건 10만+', 'Creator criteria 100K+'],
  ['스프링 세럼 런칭 기준으로 제품/타깃/키워드를 확인합니다.', 'Review product, audience and keywords for Spring Serum Launch.'],
  ['Spring Serum Launch 기준으로 제품/타깃/키워드를 확인합니다.', 'Review product, audience and keywords for Spring Serum Launch.'],
  ['기준으로 제품/타깃/키워드를 확인합니다.', 'campaign: review product, audience and keywords.'],
  ['플랫폼, 국가, 팔로워/조회 조건을 잡고 공개 검색을 실행합니다.', 'Set platform, country, follower and view criteria, then run a public search.'],
  ['발굴 후보를 브랜드 핏, 데이터 신뢰도, 리스크 기준으로 재정렬합니다.', 'Rerank discovered creators by brand fit, data confidence and risk.'],
  ['선택 후보를 메시지 전 후보 풀로 보내 제안 메시지를 만듭니다.', 'Move selected creators to the pre-outreach pool and create outreach messages.'],
  ['제품/타깃/키워드 같은 브랜드 공통값을 빠르게 채웁니다. 예산, KPI, 원메시지, 후킹포인트는 캠페인 생성에서 캠페인별로 관리합니다.', 'Fill shared brand values such as product, audience and keywords. Budget, KPIs, core message and hooks are managed per campaign.'],
  ['제품, 타깃, 키워드, 학습자료, 인플루언서 전략은 캠페인 생성에서 관리하고 발굴 화면에서는 선택 캠페인 기준으로 후보를 찾습니다.', 'Product, audience, keywords, learning materials and influencer strategy are managed in the campaign. Discovery uses the selected campaign brief.'],
  ['선택 캠페인 조건', 'Selected campaign criteria'],
  ['제품/서비스, 타깃, 키워드, 후보 조건을 확인한 뒤 검색합니다.', 'Review product, audience, keywords and creator criteria before searching.'],
  ['2개 조건 적용', '2 criteria applied'],
  ['현재 선택한 캠페인 기준으로 AI 매칭을 실행하세요.', 'Run AI matching for the selected campaign.'],
  ['API 키는 Render 환경변수에서 관리되므로 화면에 입력하지 않아도 됩니다.', 'API keys are stored in Render environment variables and are never entered in the client UI.'],
  ['API 테스트를 실행하면 추천 보강 라우트와 키 상태를 확인합니다.', 'Run the API test to verify the recommendation enrichment route and API-key status.'],
  ['선택한 캠페인/검색어 기준으로 `실제 웹 발굴`을 실행하면 공개 검색 결과가 이 리스트에 저장됩니다.', 'Run live web discovery for the selected campaign and query to save public search results in this list.'],
  ['실제 발굴 후보가 없습니다.', 'No live discovery results yet.'],
  ['공식 Data API', 'official Data API'],
  ['구독자', 'Subscribers'],
  ['평균 조회', 'average views'],
  ['팔로워', 'followers'],
  ['조회수', 'views'],
  ['참여율', 'engagement rate'],
  ['예상 단가', 'estimated fee'],
  ['매칭 점수', 'match score'],
  ['캠페인 기준으로 발굴, 후보 저장, 메시지 발송, 성과 추적을 이어서 진행합니다.', 'Continue from campaign brief to discovery, candidate saving, outreach and performance tracking.'],
  ['브리프 기준으로 실제 후보 검색을 먼저 실행하세요.', 'Run live creator discovery from the campaign brief first.'],
  ['업로드 링크를 등록하면 리포트와 레퍼런스 분석에 반영됩니다.', 'Register content URLs to update reports and reference analysis.'],
  ['조회/반응 raw 기준', 'Based on source view and engagement records'],
  ['현재 검색 결과', 'Current discovery results'],
  ['0건 표시', '0 items shown'],
  ['필터 후보 합산', 'Filtered candidate total'],
  ['전략 기준 점수', 'Strategy score'],
  ['데이터룸', 'Data room'],
  ['원천', 'source'],
  ['계산', 'calculation'],
  ['10만+', '100K+'],
  ['스킨케어 D2C 브랜드 전체 운영 현황', 'Skincare D2C Brand operations overview'],
  ['발굴 → 후보 저장 → 메시지 발송 → 성과 추적 순서로 이어집니다', 'Workflow: discovery → candidate saving → outreach → performance tracking'],
  ['라이브 · 마감 5월 28일 · 목표 8명', 'Live · Deadline May 28 · Target 8 creators'],
  ['0/8명 추천 완료', '0 of 8 recommendations completed'],
  ['1건 검토 대상', '1 item pending review'],
  ['1건 표시 · 이메일 0건 · DM 0건', '1 item shown · 0 email · 0 DM'],
  ['2건 콘텐츠 추적 · 0개 브랜드 저장', '2 content items tracked · 0 brands saved'],
  ['업로드 링크 성과와 경쟁/레퍼런스 변화를 같이 확인합니다.', 'Review uploaded-content performance together with brand and reference changes.'],
  ['0명 후보 평균조회 합산', '0 creators · combined average views'],
  ['후보 평균조회 raw 기반 추정', 'Estimated from source average-view records'],
  ['0명 섭외 완료', '0 creators recruited'],
  ['스프링 세럼 런칭 캠페인 라이브 상태 확인', 'Reviewed live status for Spring Serum Launch'],
  ['민서로그에게 제안 메시지 발송', 'Sent an outreach message to Minseolog'],
  ['테크노트 준 견적 요청 생성', 'Created an estimate request for Technote Jun'],
  ['followers 규모보다 조회 효율, 실제 성과 학습, 캠페인 핏을 우선하는 성과형 추천 정책', 'Performance-first recommendation policy prioritizing view efficiency, observed performance and campaign fit over follower count'],
  ['최소 followers 1천명', 'Minimum 1,000 followers'],
  ['average views 5만+ 또는 followers 대비 조회 0.2x+', '50K+ average views or 0.2x+ views per follower'],
  ['데이터 품질 58점+', 'Data quality score 58+'],
  ['80점 이상 우선 제안', 'Prioritize candidates scoring 80+'],
  ['평균조회 · 폭발계수 · 실제 업로드 성과', 'Average views · breakout ratio · observed upload performance'],
  ['engagement rate · 예상 CPV · 예산 대비 조회 효율', 'Engagement rate · estimated CPV · budget-to-view efficiency'],
  ['브랜드/카테고리/국가/전략 키워드 적합도', 'Brand, category, country and strategy-keyword fit'],
  ['수집 source, 최신성, 이상치, 리스크 점검', 'Collection source, freshness, anomaly and risk checks'],
  ['브랜드/제품/국가/카테고리/전략 키워드가 후보 프로필과 맞는지 먼저 확인', 'First verify that brand, product, country, category and strategy keywords match the creator profile'],
  ['average views수, followers 대비 조회 폭발계수, engagement rate, 예상 CPV를 점수화', 'Score average views, views-per-follower breakout ratio, engagement rate and estimated CPV'],
  ['리포트/업로드 추적/Video Monitor raw에서 확인된 성과가 있을 때만 다음 추천에 보정', 'Adjust future recommendations only when performance is observed in reports, upload tracking or video-monitor source records'],
  ['데이터 품질, 국가 불일치, 제외 키워드, 낮은 조회 효율 후보는 보류 또는 검증으로 분류', 'Place candidates on hold or verification when data quality is low, country mismatches, excluded keywords appear or view efficiency is weak'],
  ['followers 1천 미만 / average views 5만 미만 + 폭발계수 0.2x 미만 / average views 1만 미만 / 데이터 품질 58점 미만', 'Under 1,000 followers / under 50K average views plus breakout ratio below 0.2x / under 10K average views / data quality below 58'],
  ['조회 성과 32% / 뷰 효율 16% / 실제 성과 학습 최대 +18점 / 전략 반영 최대 +8점 / 리스크/제외어 감점/보류', 'View performance 32% / view efficiency 16% / observed learning up to +18 / strategy alignment up to +8 / risk and exclusion penalties'],
  ['source raw: 후보 프로필, 채널 수치, 콘텐츠 성과, 외부 리포트, 캠페인 전략/가이드', 'Source records: creator profile, channel metrics, content performance, imported reports and campaign strategy/guide'],
]

const attributeNames = ['placeholder', 'title', 'aria-label']

function translateValue(value) {
  if (!value || !/[가-힣]/.test(value)) return value
  const trimmed = value.trim()
  if (exactTranslations.has(trimmed)) {
    return value.replace(trimmed, exactTranslations.get(trimmed))
  }

  let translated = value
  for (const [source, target] of phraseTranslations) {
    translated = translated.replaceAll(source, target)
  }
  translated = translated
    .replace(/(\d+)\s*명\s*섭외\s*완료/g, '$1 creators recruited')
    .replace(/(\d+)\s*명\s*저장/g, '$1 creators saved')
    .replace(/(\d+)\s*명\s*후보/g, '$1 candidates')
    .replace(/(\d+)\s*명/g, '$1 creators')
    .replace(/(\d+)\s*건\s*계산/g, '$1 calculations')
    .replace(/(\d+)\s*건/g, '$1 items')
    .replace(/(\d+)\s*개\s*브랜드/g, '$1 brands')
    .replace(/(\d+)\s*개/g, '$1 items')
    .replace(/오늘\s+(\d{1,2}:\d{2})/g, 'Today $1')
  return translated
}

function translateTree(root) {
  if (!root) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)

  textNodes.forEach((node) => {
    if (node.parentElement?.closest('script, style, textarea, [data-review-no-translate]')) return
    const translated = translateValue(node.nodeValue)
    if (translated !== node.nodeValue) node.nodeValue = translated
  })

  if (root.nodeType !== Node.ELEMENT_NODE) return
  const elements = [root, ...root.querySelectorAll('*')]
  elements.forEach((element) => {
    attributeNames.forEach((attributeName) => {
      const current = element.getAttribute?.(attributeName)
      if (!current) return
      const translated = translateValue(current)
      if (translated !== current) element.setAttribute(attributeName, translated)
    })
  })
}

export function isYouTubeEnglishReviewMode() {
  const params = new URLSearchParams(window.location.search)
  return window.location.pathname === '/youtube-api-review' || params.get('review') === 'youtube'
}

export function useEnglishReviewMode(enabled) {
  useEffect(() => {
    if (!enabled) return undefined

    document.documentElement.lang = 'en'
    document.body.dataset.youtubeReviewMode = 'loading'

    const banner = document.createElement('div')
    banner.id = 'creatorops-actual-client-review-banner'
    banner.dataset.reviewNoTranslate = 'true'
    banner.innerHTML = '<strong>YouTube API Compliance Review</strong><span>Actual CreatorOps client · Read-only public metadata</span>'
    document.body.appendChild(banner)

    const style = document.createElement('style')
    style.id = 'creatorops-actual-client-review-style'
    style.textContent = `
      #creatorops-actual-client-review-banner {
        position: fixed; top: 14px; right: 18px; z-index: 2147483000;
        display: flex; gap: 10px; align-items: center; padding: 10px 14px;
        border: 1px solid #bfdbfe; border-radius: 8px; background: rgba(239, 246, 255, .97);
        box-shadow: 0 10px 28px rgba(15, 23, 42, .14); color: #1e3a8a;
        font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        pointer-events: none;
      }
      #creatorops-actual-client-review-banner span { color: #475569; font-weight: 500; }
    `
    document.head.appendChild(style)

    let scheduled = false
    const applyTranslations = () => {
      scheduled = false
      translateTree(document.body)
      document.body.dataset.youtubeReviewMode = 'ready'
    }
    const scheduleTranslations = () => {
      if (scheduled) return
      scheduled = true
      window.requestAnimationFrame(applyTranslations)
    }
    const observer = new MutationObserver(scheduleTranslations)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true })
    scheduleTranslations()

    return () => {
      observer.disconnect()
      banner.remove()
      style.remove()
      delete document.body.dataset.youtubeReviewMode
    }
  }, [enabled])
}
