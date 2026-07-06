# CreatorOps 데이터 구축 전략

경쟁사 API를 가져오지 않고, 합법적으로 확보 가능한 데이터와 우리 자체 운영 데이터를 결합해 정확도를 높인다.
목표는 브랜드에 맞는 인플루언서와 틱톡 공동구매 셀러를 발굴하고, 대량 섭외와 콘텐츠 성과 추적을 통해 조회수/전환/주문 KPI에 도달하는 것이다.

## 실행 순서 보정

현재 MVP는 화면과 데이터룸 표시 카탈로그가 먼저 고도화되었으므로, 운영 개발 순서는 아래처럼 재정렬한다.

1. 백엔드: 데이터 폴더링과 raw 데이터 적재 설계
2. 프론트엔드: 백엔드 raw/metric 구조 기반 화면 설계와 와이어프레임
3. 데이터룸 적재: raw source, import row, metric snapshot, quality log 저장
4. MVP 개발 및 내부 테스트

1번과 3번의 상세 설계는 `DATA_ROOM_BACKEND_PLAN.md`를 기준으로 한다.

## 핵심 원칙

- 모든 지표는 `source`, `method`, `confidence`, `freshness`를 함께 저장한다.
- 검색용 얕은 데이터와 컨펌용 깊은 검증 데이터를 분리한다.
- Instagram/TikTok 비공식 우회 크롤링은 제품 핵심 의존성으로 두지 않는다.
- 공식 API, 공개 웹, 크리에이터 인증, 자체 캠페인 성과 DB를 교차 검증한다.
- 외부 데이터 벤더를 쓰더라도 최종 자산은 우리 DB에 쌓이는 응답률, 실제 단가, 실제 성과다.
- 대량 연락은 공개 협업 이메일 기반 자동 발송을 우선하고, Instagram/TikTok DM은 승인형 또는 수동 보조 채널로 분리한다.
- 자동 송금/자동정산 API는 1차 범위에서 제외하고, 배송 정보와 지급 예정액/지급 상태만 수동 기록한다.
- 운영 버전은 한 명의 브라우저 저장소가 아니라 팀 공유 DB, 로그인, 역할 권한, 감사 로그를 전제로 한다.

## 경쟁사에서 참고할 방식

| 경쟁사 | 참고할 방식 | 우리가 가져갈 구조 |
| --- | --- | --- |
| REVU | 공개모집형 체험단과 섭외형 서비스를 분리 | 캠페인 타입을 공개모집/제안형/앰배서더/커머스로 구분 |
| TAGby | 타겟 설정, 미션, 리워드, 게시물 모니터링, 통계 보고서 | 캠페인 생성 시 미션/리워드/검수 플로우를 필수 운영 정보로 저장 |
| Aspire | 인바운드 마켓플레이스와 아웃바운드 탐색, 장기 관계 관리 | 지원형/직접 제안형을 같은 파이프라인에서 관리하고 재섭외 이력을 유지 |
| Upfluence | 브랜드 팬/고객 기반 발굴과 AI 메일링 | 브랜드 적합도, 메시지 개인화, 고객/팬 소스 필드를 확장 |
| Influencity | Discover, IRM/Data, Campaigns, Reports 분리 | 대시보드/발굴/캠페인/리포트/메시지를 독립 화면으로 운영 |
| GRIN | 제품 발송, 할인 코드, 커미션, ROI 연결 | 리워드/커머스 지표를 캠페인 필드로 저장하고 성과 리포트와 연결 |
| Modash | Search API와 상세 리포트 분리 | 1차 후보는 저비용 검색, 최종 후보만 깊은 검증 |
| HypeAuditor | 오디언스 품질, 가짜 팔로워, 참여율 중심 리포트 | 클라이언트 컨펌 카드에 품질/위험/근거 지표 노출 |
| CreatorIQ | 장기 크리에이터/콘텐츠/성과 그래프 | 캠페인 결과와 실제 견적을 자체 학습 자산으로 누적 |
| Traackr | 벤치마크, ROI, 장기 운영 데이터 | 발굴보다 성과 보고와 재섭외 판단 데이터를 강화 |

## 우리 데이터 레이어

1. 공식 API
   - YouTube Data API: 채널 통계, 공개 영상 통계, 최근 콘텐츠 조회/댓글.
   - Google Sheets/Gmail/Drive: 내보내기, 공개 협업 이메일 발송, 보고서 저장.
   - 현재 MVP에는 YouTube API 키와 채널 ID/@핸들을 입력해 공식 채널 통계를 후보 DB에 반영하는 어댑터를 포함한다.
   - 발굴 화면에서는 YouTube Data API 키로 `search.list` 채널 검색과 `channels.list` 통계 수집을 실행해 실제 채널을 후보 DB에 저장한다.

2. 공개 웹/미디어킷 수집
   - 크리에이터 홈페이지, 링크트리, 공개 이메일, 미디어킷, 협업 페이지.
   - 수집 시점과 원본 URL을 반드시 저장한다.
   - 공개 프로필에 보이는 팔로워/평균 조회 수치는 `공개 프로필 팔로워 수집` 폼으로 출처 URL, 확인 시점, 신뢰도와 함께 저장한다.
   - 발굴 화면에서는 Google Programmable Search API Key/CX로 Instagram/TikTok/YouTube 공개 프로필 URL을 가져온다.
   - 검색 결과만으로 팔로워/평균 조회를 확정하지 않고 `수집 필요`로 표시한 뒤 후속 공식 API, 공개 프로필 수집, 크리에이터 인증 데이터로 보강한다.

3. 브랜드/제품 학습자료
   - 제품 브리프, 상세페이지 문구, 권장 표현, 금지 표현, 기존 성과, 고객 리뷰를 브랜드별 학습자료로 저장한다.
   - MVP는 엑셀 `.xlsx`, CSV/TSV, Google Sheets 붙여넣기, 공개 Google Sheet CSV URL을 입력 경로로 지원한다.
   - 추천 점수 보정, 추천 이유 생성, 제안 메시지의 강조/주의 문구에 반영한다.
   - 긴 캠페인 브리프를 붙여넣으면 제품, 후킹포인트, 희망 인플루언서 플랫폼/인원/팔로워 범위를 구조화해 브랜드 조건과 발굴 필터로 변환한다.
   - 브리프 자체는 실제 후보를 만들지 않고, 실제 후보는 공식 API 또는 공개 검색 결과로만 후보 DB에 저장한다.
   - 운영 버전에서는 문서 원본, 업로드한 팀원, 버전, 승인 상태, 만료일을 함께 관리한다.

4. 크리에이터 인증 연결
   - 인플루언서가 직접 연결한 계정에서 도달, 저장, 공유 등 고정밀 인사이트 수집.
   - 캠페인 집행 전후의 정확한 리포트를 만드는 핵심 레이어.

5. AI 추정/보정
   - 브랜드 적합도, 예상 단가, 메시지 개인화, 추천 이유 생성.
   - 추정값은 신뢰도를 낮게 표시하고 실제 응답/견적/성과로 계속 보정한다.

6. 자체 성과 DB
   - 응답률, 섭외 완료율, 실제 견적, 콘텐츠 조회수, 댓글, 공유, 전환, 클라이언트 승인 이력.
   - 시간이 지날수록 외부 데이터보다 더 강한 경쟁력이 된다.

7. 팀 워크스페이스 DB
   - 팀원, 역할, 브랜드별 접근 권한, 클라이언트 보기 권한, 다운로드 이력을 저장한다.
   - 배송/수동 정산 정보는 제한된 역할만 접근할 수 있도록 분리한다.
   - 모든 주요 변경은 감사 로그로 남긴다.

8. 틱톡 공동구매 셀러 성과 DB
   - 셀러 후보, 판매 코드, 공동구매 링크, 샘플 발송, 콘텐츠 URL, 주문 수, 매출, 전환율을 캠페인별로 저장한다.
   - 대량 섭외 출처, 응답률, 실제 판매 성과를 다음 셀러 추천 모델에 반영한다.

9. 연락 채널 라우팅 DB
   - 후보별 공개 협업 이메일, 프로필 URL, 권장 연락 채널, 발송 방식, 정책 메모를 저장한다.
   - 이메일은 Gmail/Outlook API 자동 발송 대상으로 두고, 수신 거부와 발송량 제한, 중복 발송 방지 로그를 연결한다.
   - Instagram DM은 Meta 권한/앱 리뷰 전까지 수동 링크와 메시지 복사로 운영하고, 승인 이후에도 제한된 범위만 자동화한다.
   - TikTok DM은 대량 자동 발송 핵심 의존성으로 두지 않고 공개 이메일/링크인바이오/프로필 이동 중심으로 처리한다.

## 데이터 스키마 방향

```txt
creator
- id
- platform
- handle
- profileUrl
- contactEmail
- preferredContactChannel
- followers
- averageViews
- engagement
- audience
- estimatedPrice
- brandSafety
- fakeRisk

creator_metric_source
- creatorId
- metric
- value
- source
- method
- confidence
- collectedAt
- originalUrl

brand_learning_material
- brandId
- title
- sourceType
- sourceName
- summary
- keywords
- doSay
- dontSay
- uploadedBy
- createdAt

brief_auto_setup
- brandId
- rawText
- parsedProduct
- hookLines
- targetPlatforms
- targetCounts
- followerRanges
- generatedKeywords
- generatedAt

campaign_performance
- campaignId
- creatorId
- contentUrl
- views
- likes
- comments
- shares
- saves
- conversions
- source
- checkedAt

outreach_result
- brandId
- campaignId
- creatorId
- channel
- deliveryMode
- complianceNote
- sentAt
- repliedAt
- quotedPrice
- finalPrice
- status

fulfillment_record
- campaignId
- creatorId
- recipient
- phone
- address
- bank
- accountNumber
- accountHolder
- paymentAmount
- deliveryStatus
- courier
- trackingNumber
- paidManuallyAt

seller_performance
- campaignId
- creatorId
- sellerCode
- groupBuyUrl
- orders
- revenue
- conversionRate
- contentUrl
- checkedAt

workspace_member
- workspaceId
- userId
- role
- status
- invitedAt
- joinedAt

brand_permission
- workspaceId
- brandId
- userId
- role

audit_log
- workspaceId
- userId
- action
- targetType
- targetId
- createdAt
```

## 운영 순서

1. 브랜드 조건과 제품/타깃 페르소나를 설정한다.
2. 캠페인 KPI를 조회수, 전환, 주문, 매출, 셀러 섭외 목표로 설정한다.
3. 캠페인 브리프가 있으면 붙여넣어 제품, 후킹포인트, 희망 인플루언서 조건을 자동 구조화하고 검색 조건으로 세팅한다.
4. 브랜드/제품 학습자료를 엑셀 또는 Google Sheets로 등록해 제품 포인트와 금지 표현을 고정한다.
5. YouTube Data API 또는 Google Programmable Search를 연결해 실제 채널/프로필 URL을 후보 DB에 저장한다.
6. 공개 지표와 공식 API로 팔로워/평균 조회/참여율을 계산한다.
7. AI가 브랜드 적합도와 추천 이유를 만들고 학습자료의 강조/주의 내용을 반영한다.
8. 틱톡 공동구매 캠페인은 셀러 후보를 대량 섭외 검토함에 저장한다.
9. 연락 채널을 이메일 자동 발송, Instagram DM 승인형/수동, TikTok DM 수동 보조로 분류한다.
10. 제안 전 최종 후보만 깊은 검증을 수행한다.
11. 섭외 완료 풀에는 클라이언트 컨펌 지표와 데이터 출처를 함께 저장한다.
12. 제품 배송과 수동 지급 상태를 기록하되 자동 송금은 실행하지 않는다.
13. 팀원 역할에 따라 조회/수정/다운로드 권한을 제한하고 감사 로그를 남긴다.
14. 콘텐츠 업로드 후 성과를 추적하고 실제 결과를 다음 추천 모델에 반영한다.

## TikTok Commercial Content API Update

- TikTok Commercial Content API is connected to the content reference search flow.
- It is used for official commercial/ad content references and disclosure patterns.
- It does not replace a general TikTok creator profile or follower database.
- KR/US creator discovery still needs public search, creator opt-in data, and manual/approved verification because the Commercial Content API country filters are EEA-focused.
