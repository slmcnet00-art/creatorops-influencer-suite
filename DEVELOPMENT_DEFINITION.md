# CreatorOps 기능정의서

작성일: 2026-06-19  
문서 목적: 현재까지 구현된 CreatorOps 인플루언서 운영 플랫폼의 기능 범위, 화면 구성, 데이터 구조, API 연동 준비 상태, 미완료 항목을 기능 검토용으로 정리한다.

## 1. 서비스 목적

CreatorOps는 브랜드에 맞는 인플루언서를 발굴하고, 섭외 메시지 작성/발송 관리, 섭외 완료 풀 관리, 배송/수동 정산 관리, 콘텐츠 업로드 성과 추적, 리포트 다운로드까지 한 번에 운영하기 위한 팀 기반 인플루언서 캠페인 관리 플랫폼이다.

핵심 목적은 단순 인플루언서 DB 조회가 아니라 다음 흐름을 운영하는 것이다.

1. 브랜드와 제품 조건을 입력한다.
2. AI와 공개 API 기반으로 브랜드 페르소나에 맞는 후보를 발굴한다.
3. 후보별 추천 이유와 데이터 출처를 기록한다.
4. 자동/수동 섭외를 분리해 메시지 검토함에서 운영한다.
5. 섭외 완료된 인플루언서 풀을 캠페인별로 저장한다.
6. 배송 정보와 지급 예정 상태를 수동 관리한다.
7. 업로드 링크, 조회수, 댓글, 공유, 저장, 전환을 기록한다.
8. 광고주 전달용 리스트와 성과 보고서를 엑셀/CSV/HTML로 다운로드한다.
9. TikTok 공동구매 셀러처럼 대량 섭외가 필요한 캠페인도 별도 흐름으로 관리한다.

## 2. 현재 구현 상태 요약

현재 버전은 프론트 MVP와 API 서버 스캐폴딩이 함께 구현된 상태다.

| 영역 | 구현 상태 | 비고 |
| --- | --- | --- |
| 프론트 UI | 구현 완료 | React/Vite 기반, Render 정적 배포 |
| 브랜드/캠페인/발굴/메시지/리포트/레퍼런스 화면 | 구현 완료 | 좌측 메뉴로 분리 |
| 다중 브랜드 관리 | 구현 완료 | 브랜드별 캠페인/후보/메시지 컨텍스트 분리 |
| 캠페인 선택 컨텍스트 | 구현 완료 | 발굴/메시지/리포트 상단에서 캠페인 선택 |
| 캠페인 생성/상세 | 구현 완료 | 생성 모달 확대, 상세 모달 대형화 |
| AI 추천 후보 | 구현 완료 | 현재는 로컬 점수화/룰 기반 |
| 실제 후보 발굴 | 부분 구현 | YouTube/Google API 또는 API 서버 프록시 필요 |
| 메시지 검토함 | 구현 완료 | 상세 보기, 복사, 연락 채널 열기, 선택/전체 선택, 일괄 발송 완료, 발송/응답 로그, 응답 메모 |
| 섭외 완료 풀 | 구현 완료 | 캠페인 상세 안에서 캠페인별 저장 및 광고주 컨펌용 지표/추천 근거 표시 |
| 배송/수동 정산 | 구현 완료 | 자동 송금 제외, 수동 기록 중심 |
| 리포트 | 구현 완료 | 콘텐츠/계정/성과 데이터 기반 다운로드 |
| 콘텐츠 레퍼런스 | 구현 완료 | 인기 영상/이미지 저장 및 제작 레퍼런스 차용 |
| 팀 권한 설정 UI | 구현 완료 | 실제 Auth/DB 권한은 Supabase 연결 필요 |
| Supabase 공유 저장소 | 스캐폴딩 완료 | `workspace_snapshots` SQL 제공 |
| Node API 서버 | 스캐폴딩 완료 | YouTube/Google/OpenAI/Gmail 예약 엔드포인트 |
| Render 배포 | 프론트 완료 | API 서비스는 Render Blueprint Sync/환경변수 필요 |

## 3. 화면 구조

| 메뉴 | 목적 | 주요 기능 |
| --- | --- | --- |
| 대시보드 | 전체 캠페인 운영 현황 | KPI 요약, 활동 로그, 브랜드/캠페인 상태 확인 |
| 캠페인 | 캠페인 생성 및 운영 | 캠페인 파이프라인, 상세 보기, 일정, KPI, 섭외 완료 풀, 배송/수동 정산 |
| 발굴 | 후보 검색과 추천 | 브랜드 조건 설정, 브리프 자동 세팅, 실제 웹 발굴, AI 추천, 수동 발굴, 메시지 전 후보 풀 |
| 메시지 | 섭외 메시지 운영 | 캠페인별 메시지 검토함, 상태 보드, 상세 보기, 복사, 연락 채널 열기, 발송/응답/섭외 완료 처리 |
| 리포트 | 성과 기록/보고 | 콘텐츠 추적, 조회수/댓글/공유/저장/전환, 리포트 다운로드 |
| 레퍼런스 | 제작 참고 콘텐츠 관리 | 국가/플랫폼/조회수/팔로워 대비 터진 콘텐츠 필터, 영상/이미지 저장, 제작 레퍼런스 차용 |
| 설정 | 팀/권한/운영 연결 | 팀 계정 역할, 브랜드 접근권한, Supabase/API 연결 상태 |

## 4. 주요 기능 정의

### 4.1 브랜드 관리

- 여러 브랜드를 등록하고 현재 작업 브랜드를 전환할 수 있다.
- 브랜드 조건에는 브랜드명, 제품/서비스, 타깃 페르소나, 포함 키워드, 제외 키워드, 플랫폼, 카테고리, 최소 팔로워, 최대 단가가 포함된다.
- 제품 학습자료를 엑셀, CSV/TSV, Google Sheets 공개 CSV 링크, 텍스트 붙여넣기로 등록할 수 있다.
- 등록된 학습자료는 추천 이유, 후보 매칭, 제안 메시지, 콘텐츠 가이드에 반영되는 전제로 설계되어 있다.

### 4.2 캠페인 생성

- 캠페인명, 예산, 목적, 캠페인 타입, 마감일, 모집 시작/마감, 업로드 완료일, 보고 완료일을 입력한다.
- KPI 목표는 조회수, 전환, 주문, 매출, TikTok 셀러 모집 목표로 분리된다.
- 미션/가이드라인, 리워드 지급 기준, 검수/승인 플로우, 커머스 성과 지표를 입력한다.
- 캠페인 생성 모달은 대형 모달로 확대되었고 4열 그리드로 구성되어 스크롤 부담을 줄였다.
- 생성 버튼은 하단 sticky 형태로 고정되어 긴 입력 화면에서도 저장 액션이 보인다.

### 4.3 캠페인 상세

- 캠페인 상세 모달은 대형 화면으로 열리며 운영 정보가 넓게 표시된다.
- 모집 시작, 모집 마감, 업로드 완료, 보고 완료 일정이 표시된다.
- KPI 목표와 현재 성과가 함께 표시된다.
- 캠페인별 섭외 완료 풀, 배송/수동 정산 기록, 콘텐츠 가이드, 배정 인플루언서를 확인한다.
- 캠페인 안에서 섭외 완료 풀과 배송/수동 정산을 확인하도록 구성해 캠페인 귀속성이 명확하다.

### 4.4 콘텐츠 가이드 생성

- 캠페인 생성 시 인플루언서 브랜드 가이드 양식을 다운로드할 수 있다.
- `.docx`, `.md`, `.txt`, `.csv`, `.tsv`, `.xlsx` 가이드 파일을 첨부할 수 있다.
- 무가시딩, 유가시딩, 공동구매 셀러, 모집형 체험단 등 작업 유형을 선택한다.
- Instagram Reels, TikTok, YouTube Shorts, YouTube Longform, Multi Channel 등 채널을 선택한다.
- 콘텐츠 원메시지와 후킹포인트를 입력하면 전달용 콘텐츠 가이드를 생성할 수 있다.
- 생성된 가이드는 DOCX, PPT, Google 문서 열기 형태로 내보낼 수 있다.

### 4.5 크리에이터 발굴

- 브랜드 조건과 캠페인 컨텍스트에 맞춰 후보를 필터링한다.
- 브리프 붙여넣기 기능으로 제품, 후킹포인트, 희망 채널, 팔로워 범위, 목표 인원을 자동 분석한다.
- 발굴 필터에는 플랫폼, 카테고리, 팔로워, 평균 조회수, 참여율, 예상 단가, 매칭 점수가 포함된다.
- YouTube Data API 연결 시 실제 채널 검색과 구독자/평균 조회수 수집이 가능하도록 구현되어 있다.
- Google Programmable Search 연결 시 Instagram/TikTok/YouTube 공개 프로필 URL을 가져올 수 있다.
- 실제 공개 검색 결과만 후보 DB에 저장하며, 검증되지 않은 수치는 `수집 필요`로 남긴다.

### 4.6 AI 추천 후보

- 후보별 매칭 점수, 추천 이유, 리스크, 제안 메시지 초안을 생성한다.
- AI 추천 후보 카드에는 팔로워, 평균 조회수, 참여율이 바로 표시된다.
- 후보를 선택해 쇼트리스트 저장 또는 메시지 검토함으로 일괄 전송할 수 있다.
- AI 추천 리스트는 엑셀 다운로드와 Google Sheets 전송 흐름을 지원한다.
- 현재 AI 추천은 로컬 룰/스코어링 중심이며, OpenAI API 서버 연결 후 고도화 가능하다.

### 4.7 메시지 운영

- 메시지 화면은 캠페인 선택 컨텍스트 기준으로 메시지를 보여준다.
- 메시지 상태 보드가 추가되어 검토함, 발송완료, 응답, 연락 채널 수를 한눈에 볼 수 있다.
- 메시지 목록에서 개별 선택, 전체 선택, 선택 메시지 일괄 발송 완료 처리가 가능하다.
- 각 메시지에는 `상세 보기`, `복사`, `연락 채널 열기`, `응답 처리` 액션이 있다.
- 기존 `열기` 링크는 인앱 브라우저에서 아무 반응이 없어 보일 수 있어 `상세 보기` 모달로 개선했다.
- 상세 보기 모달에서는 크리에이터, 캠페인, 상태, 연락 방식, 추천/발송 근거, 발송/응답 로그, 제안 메시지 전문을 확인한다.
- 상세 보기에서 응답 메모를 저장하면 메시지 운영 로그에 누적된다.
- 상세 보기에서 메시지 복사, 연락 채널 열기, 발송 완료, 응답 처리, 섭외 완료 풀 저장이 가능하다.
- 이메일은 공개 협업 이메일이 확인된 후보에게 Gmail/Outlook API 발송 대상으로 두고, 초기에는 복사/수동 확인 흐름을 지원한다.
- Instagram/TikTok DM은 정책과 권한 승인 전까지 자동 발송이 아니라 수동 보조 채널로 운영한다.

### 4.8 섭외 완료 풀

- 응답 또는 발송 완료 상태의 후보를 섭외 완료 풀로 저장할 수 있다.
- 섭외 완료 풀은 캠페인별로 귀속된다.
- 광고주 컨펌 보드는 대시보드가 아니라 캠페인 상세 내부에서 확인한다.
- 광고주 컨펌에 필요한 팔로워, 평균 조회수, 참여율, 예상 단가, 브랜드 적합도, 가짜 팔로워 위험, 데이터 품질, 추천/컨펌 근거가 표시된다.
- 섭외 완료 풀은 엑셀 다운로드와 Google Sheets 전송 흐름을 지원한다.

### 4.9 배송/수동 정산

- 자동 송금/자동정산은 1차 범위에서 제외한다.
- 수취인, 아이디, 전화번호, 주소, 은행, 계좌번호, 예금주, 지급 예정액, 결제일, 배송 상태를 기록한다.
- 전화번호와 계좌번호는 화면에서 일부 마스킹 처리한다.
- 배송 상태는 배송 준비, 발송 대기, 발송 완료, 정산 완료 등으로 관리한다.
- 배송/수동 정산 기록은 캠페인 상세 안에서 확인한다.

### 4.10 리포트

- 업로드한 인플루언서, 계정 정보, 업로드 링크, 조회수, 좋아요, 댓글, 공유, 저장, 전환을 기록한다.
- 캠페인별 콘텐츠 성과와 KPI 달성률을 확인한다.
- CSV와 HTML 보고서를 다운로드할 수 있다.
- 보고서에는 섭외 완료 풀, 상위 콘텐츠, KPI 진행률, 다음 액션이 포함된다.

### 4.11 콘텐츠 레퍼런스

- 레퍼런스는 별도 메뉴로 분리되어 리포트 아래에 위치한다.
- 인기 영상/이미지 리스트가 먼저 보이고, 이후 필터와 검색으로 좁힐 수 있다.
- 필터는 국가, 미디어 유형, 플랫폼, 조회수 순, 팔로워 대비 터진 콘텐츠 순, 공유 수, 최신순을 지원한다.
- 레퍼런스를 저장하고 나중에 제작 레퍼런스로 차용할 수 있다.
- 저장한 제작 레퍼런스는 브랜드 학습자료에 반영할 수 있다.

### 4.12 팀/권한 설정

- 설정은 좌측 하단 톱니바퀴로 이동했다.
- 팀 계정, 역할, 브랜드 접근권한을 UI에서 확인/수정할 수 있다.
- 역할은 Owner, Admin, Manager, Client, Analyst 기준으로 구성되어 있다.
- 현재는 프론트 상태 기반 UI이며, 실제 운영에서는 Supabase Auth와 RLS 기반 권한 적용이 필요하다.

### 4.13 공유 저장소와 API 서버

- `src/backendSync.js`에 Supabase 워크스페이스 동기화 레이어가 추가되었다.
- Supabase 환경변수가 없으면 기존 localStorage 방식으로 동작한다.
- Supabase 환경변수가 있으면 `workspace_snapshots` 테이블에 워크스페이스 JSON을 자동 저장한다.
- `supabase/schema.sql`에 운영용 기본 SQL이 포함되어 있다.
- `server/index.js`에 Node/Express API 서버가 추가되었다.
- API 서버는 YouTube, Google Programmable Search, OpenAI, Gmail 예약 엔드포인트를 제공한다.

## 5. 데이터 구조

| 데이터 | 주요 필드 |
| --- | --- |
| brand | id, name, owner, color, brief |
| brandBrief | brandName, product, persona, keywords, exclusions, platforms, categories, minFollowers, maxPrice, learningMaterials |
| brandLearningMaterial | id, title, sourceType, sourceName, summary, keywords, doSay, dontSay, createdAt |
| campaign | id, brandId, name, owner, budget, spend, revenue, deadline, schedule, objective, campaignType, mission, reward, approvalFlow, commerceMetric, kpiGoal, targetViews, targetConversions, targetOrders, targetRevenue, sellerRecruitTarget, brandGuideAttachments, campaignGuideMaterials, generatedContentGuide, creatorIds |
| creator | id, name, handle, profileUrl, contactEmail, preferredContactChannel, platform, category, followers, averageViews, engagement, price, audience, fit, brandSafety, fakeRisk, metricSources, needsVerification, sourceNote |
| recommendation | id, creatorId, campaignId, brandId, score, persona, reasons, risk, message |
| outreach | id, creatorId, campaignId, source, channel, deliveryMode, complianceNote, status, message, reason, sentAt, createdAt |
| recruitedPool | id, creatorId, campaignId, source, channel, status, note, createdAt |
| fulfillmentRecord | id, campaignId, creatorId, recipient, handle, phone, address, bank, accountNumber, accountHolder, paymentAmount, courier, trackingNumber, deliveryStatus, memo |
| trackedPost | id, campaignId, creatorId, platform, title, url, views, likes, comments, shares, saves, conversions, lastChecked |
| contentReference | id, campaignId, mediaType, platform, country, title, url, thumbnailUrl, views, accountFollowers, likes, comments, shares, publishedAt, hook, analysis, applyIdea |
| workspace | team, accounts, activeAccountId, brands, campaigns, creators, recommendations, outreach, recruitedPool, fulfillmentRecords, trackedPosts, contentReferences, activities |
| workspaceSnapshot | workspace_id, payload, updated_at, created_at |
| auditLog | workspace_id, actor_id, action, target_type, target_id, metadata, created_at |

## 6. API 정의

API 상세 계약은 `API_INTEGRATION_CONTRACT.md`에 별도로 정리되어 있다.

| API | 상태 | 설명 |
| --- | --- | --- |
| GET `/health` | 구현 | API 서버 헬스체크 |
| POST `/youtube/channel` | 구현 | YouTube 채널 ID 또는 핸들로 채널 지표 조회 |
| POST `/discovery/youtube/search` | 구현 | YouTube 채널 검색 및 지표 수집 |
| POST `/discovery/google-profiles/search` | 구현 | Google Programmable Search 기반 공개 프로필 URL 검색 |
| POST `/ai/outreach-message` | 구현 | OpenAI 기반 섭외 제안 메시지 생성 |
| POST `/ai/content-guide` | 구현 | OpenAI 기반 콘텐츠 가이드 생성 |
| POST `/outreach/gmail/send` | 예약 | Gmail OAuth 토큰 저장소 연결 전까지 501 반환 |

필요 환경변수:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_WORKSPACE_ID`
- `VITE_CREATOROPS_API_BASE_URL`
- `YOUTUBE_DATA_API_KEY`
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_CX`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`

## 7. 배포 상태

| 항목 | 상태 |
| --- | --- |
| GitHub 저장소 | 반영 완료 |
| Render 프론트 | 배포 완료 |
| Render API | Blueprint Sync 또는 API 서비스 생성 필요 |
| Supabase DB | SQL 제공, 프로젝트 생성 및 환경변수 입력 필요 |
| API 키 | 사용자가 발급 후 Render 환경변수 입력 필요 |

운영 점검 명령:

```bash
npm run production:check
```

Render API 서비스 자동 생성 보조 명령:

```bash
npm run render:create-api
```

단, `render:create-api`는 `RENDER_API_KEY`와 `RENDER_OWNER_ID`가 필요하다.

## 8. 명시적 제외 범위

- 자동 송금/자동정산
- PG 결제 자동화
- 인플루언서에게 무제한 자동 DM 발송
- Instagram/TikTok 비공식 DM 자동화
- Nox/Modash 등 경쟁사 API 직접 사용
- 비공개 데이터 무단 수집
- 계정 없이 여러 사용자가 같은 localStorage를 공유하는 방식
- 클라이언트에게 계좌번호/정산 개인정보를 노출하는 방식

## 9. 보안/운영 고려사항

- 현재 프론트 MVP는 localStorage 기반이므로 개인정보/계좌정보 운영 저장소로 적합하지 않다.
- 운영 버전에서는 Supabase 또는 별도 백엔드 DB, Auth, 역할 권한, RLS, 감사 로그가 필요하다.
- API 키는 브라우저에 저장하지 않고 서버 환경변수로 관리해야 한다.
- 이메일 자동 발송은 수신 거부, 중복 발송 방지, 발송량 제한, 발송 로그가 필요하다.
- Instagram/TikTok DM은 정책 승인 전까지 수동 보조 채널로 유지한다.
- 다운로드/내보내기 로그와 개인정보 접근 로그가 필요하다.

## 10. 다음 개발 우선순위

1. Render에서 `creatorops-suite-api` 서비스 생성 또는 Blueprint Sync
2. Supabase 프로젝트 생성 및 `supabase/schema.sql` 실행
3. Render 환경변수에 Supabase/YouTube/Google/OpenAI 키 입력
4. 프론트 `VITE_CREATOROPS_API_BASE_URL`을 API 서비스 URL로 연결
5. OpenAI 기반 실제 추천/메시지/가이드 생성 프론트 연결
6. Gmail OAuth 토큰 저장소와 실제 이메일 발송 로그 연결
7. Supabase Auth 기반 팀 초대, 역할 권한, 브랜드 접근권한 실제 적용
8. 다운로드/발송/권한 변경 감사 로그 구현
9. Instagram/TikTok 공개 프로필 수집 정책 검토 및 크리에이터 인증 데이터 흐름 설계
10. TikTok 공동구매 셀러 성과 데이터 구조와 리포트 고도화

## 11. 기능 검토 체크리스트

- 브랜드별 캠페인/후보/메시지/리포트가 분리되는가?
- 캠페인 선택 컨텍스트가 발굴/메시지/리포트에서 일관되게 적용되는가?
- 캠페인 생성 화면이 충분히 넓고 스크롤 부담이 줄었는가?
- 메시지 상세 보기에서 제안문 전문과 연락 채널을 명확히 확인할 수 있는가?
- 섭외 완료 풀에서 광고주 컨펌에 필요한 팔로워/조회수/참여율/단가가 보이는가?
- 배송/수동 정산 정보가 캠페인에 귀속되어 관리되는가?
- 레퍼런스가 발굴이 아니라 별도 메뉴에서 인기 콘텐츠 중심으로 탐색되는가?
- 리포트가 업로드 링크, 계정 정보, 조회수, 댓글, 공유, 저장, 전환까지 포함하는가?
- API 키가 프론트가 아니라 서버 환경변수로 이동할 준비가 되어 있는가?
- 팀 단위 사용을 위해 Auth/DB/RLS로 넘어갈 설계가 준비되어 있는가?
