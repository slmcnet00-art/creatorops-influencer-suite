# CreatorOps 개발정의서

작성일: 2026-05-21  
문서 목적: 현재까지 개발된 CreatorOps 인플루언서 운영 플랫폼의 기능 검토용 정의서

## 1. 프로젝트 개요

CreatorOps는 브랜드에 맞는 인플루언서와 틱톡 공동구매 셀러를 발굴, 대량 섭외, 협업 운영해서 조회수와 전환이 나오는 콘텐츠를 제작하고 캠페인 KPI에 도달하기 위한 팀 기반 인플루언서 운영 플랫폼이다.

현재 버전은 프론트엔드 중심의 프로토타입이며, 브라우저 `localStorage`에 데이터를 저장한다. 이는 1인 기능 검토용 범위이고, 실제 운영 버전에서는 팀원이 로그인해서 같은 워크스페이스를 함께 보는 백엔드 서버, 공유 DB, 계정 권한, 감사 로그, API 키 보안 관리가 필수다.

## 2. 개발 목표

- 여러 브랜드의 인플루언서 캠페인을 분리 관리한다.
- 팀원이 로그인해서 같은 브랜드/캠페인 데이터를 함께 확인하고 역할에 따라 수정한다.
- 긴 캠페인 브리프를 붙여넣으면 제품, 후킹포인트, 희망 인플루언서 조건을 자동 분석해 실제 검색에 쓸 발굴 조건과 캠페인 초안을 세팅한다.
- YouTube Data API와 Google Programmable Search를 연결해 실제 크리에이터 채널/프로필을 발굴하고 후보 DB에 저장한다.
- 실제 후보를 AI 추천 형태로 점수화한다.
- 브랜드/제품 관련 학습자료와 인플루언서 브랜드 가이드를 엑셀, Google Sheets, 문서 첨부로 등록해 추천 이유와 제안 메시지에 반영한다.
- 조회수, 공동구매 주문, 전환 링크 클릭, 판매 코드 성과 등 캠페인 KPI를 중심으로 운영한다.
- 틱톡 공동구매 셀러를 대량 발굴하고 메시지 검토함에 일괄 저장해 대량 섭외를 진행한다.
- 추천 이유, 페르소나 적합성, 리스크, 제안 메시지 초안을 함께 기록한다.
- 자동 추천 기반 섭외와 수동 섭외를 구분한다.
- 공개 협업 이메일, Instagram DM, TikTok DM 등 연락 채널을 분리하고 이메일 자동 발송과 DM 수동 보조를 구분한다.
- 섭외 완료된 인플루언서 풀을 저장하고 클라이언트 컨펌용 지표를 제공한다.
- 콘텐츠 업로드 후 조회수, 댓글, 공유 등 성과 데이터를 기록하고 보고서로 다운로드한다.
- 배송 정보와 수동 지급 상태를 관리하되 자동 송금/자동정산은 제외한다.

## 3. 화면 구조

| 메뉴 | 목적 | 현재 구현 내용 |
| --- | --- | --- |
| 대시보드 | 브랜드 전체 현황과 PM 실행 관리 | 워크플로우 지표, 캠페인/추천/메시지/성과/섭외풀/배송 수동 정산 현황, PM 우선순위 맵, PM 실행 보드, 데이터 소스 원장 |
| 발굴 | 크리에이터/셀러 실제 검색 및 AI 추천 | AI 브리프 조건 세팅, 실제 웹 발굴, 브랜드 조건 설정, AI 매칭 실행, 틱톡 셀러 대량 저장, 추천 후보 카드, 크리에이터 발굴 리스트, 상세 프로필 |
| 캠페인 | KPI 기반 캠페인 운영 | 캠페인 파이프라인, KPI 목표, 셀러 섭외 목표, 캠페인 상세, 섭외 완료 풀, 배송/수동 정산 관리 |
| 리포트 | 콘텐츠 성과 관리 | 콘텐츠 추적 등록, 조회수/좋아요/댓글/공유/저장/전환 기록, CSV/HTML 보고서 다운로드 |
| 메시지 | 제안/응답 운영 | 메시지 검토함, 발송 완료, 응답 처리, 섭외 완료 저장 |
| 데이터 관리 모달 | 데이터 수집/백업 | 공개 프로필 팔로워 수집, YouTube 공식 지표 가져오기, 워크스페이스 백업 |
| 팀 관리 | 공동 작업 관리 | 운영 버전 필수 기능. 팀원 초대, 역할 권한, 클라이언트 보기 전용 링크, 감사 로그 필요 |

## 4. 핵심 기능 정의

### 4.1 멀티 브랜드 워크스페이스

- 여러 브랜드를 등록하고 선택할 수 있다.
- 브랜드별로 캠페인, 추천 후보, 메시지, 섭외 완료 풀, 콘텐츠 성과를 분리해서 보여준다.
- 브랜드 조건에는 브랜드명, 제품/서비스, 타깃 페르소나, 포함/제외 키워드, 플랫폼, 카테고리, 최소 팔로워, 최대 단가가 포함된다.
- 브랜드 조건에는 브랜드/제품 학습자료를 등록할 수 있으며, 제품 브리프, 상세페이지 문구, 권장 표현, 금지 표현, 기존 성과 데이터를 엑셀 `.xlsx`, CSV/TSV, Google Sheets 붙여넣기, 공개 Google Sheet CSV URL로 입력한다.
- 등록된 학습자료는 브랜드별로 저장되고, AI 추천 키워드와 제안 메시지의 강조/주의 문구에 반영된다.
- 운영 버전에서는 워크스페이스 단위로 팀원을 초대하고, 브랜드별 접근 권한을 부여한다.

### 4.1.1 PM 실행 보드

- 대시보드에서 운영 전환 준비도를 `Readiness` 점수로 표시한다.
- PM 관점의 핵심 항목은 실제 후보 발굴, AI 추천/메시지, 팀 공유 DB, 발송/응답 운영, 성과/리포트다.
- 각 항목은 상태, 담당 역할, 다음 액션, 근거 지표, 진행률을 함께 보여준다.
- 현재 핵심 병목을 별도 카드로 표시해 다음 개발 우선순위를 빠르게 판단한다.
- PM 우선순위 맵은 팀 공유 DB/권한, KPI 구조화, 실제 후보 데이터 수집, 발송/응답 운영 로그를 P0/P1로 나눠 표시한다.
- KPI 구조화 항목은 이번 버전에서 1차 반영되어 캠페인별 목표 조회수, 전환, 주문, 매출, 섭외 목표와 달성률을 확인할 수 있다.
- localStorage 기반 MVP에서는 팀 공유 DB와 자동 발송이 병목으로 표시되며, Supabase/Auth/Gmail API 연결 후 준비도가 올라가는 구조다.

### 4.2 실제 웹 발굴과 AI 추천 후보

- `브리프 붙여넣기 + 조건 세팅`은 제품명, 콘텐츠 후킹포인트, 희망 인플루언서 플랫폼/인원/팔로워 범위를 분석한다.
- 분석 결과는 브랜드 조건, 발굴 검색어, 발굴 필터, 캠페인 생성 초안, 브랜드/제품 학습자료에 반영된다.
- 예: `YT 펫 채널 3 (5만~50만), IG 펫스타그램 5 (5천~3만)` 입력 시 YouTube/Instagram, 펫 카테고리, 팔로워 5천~50만, 켄넬/반려견 키워드를 세팅한다.
- 실제 후보는 `실제 웹 발굴`에서 API를 연결해 가져온다.
- YouTube는 YouTube Data API의 `search.list`와 `channels.list`로 실제 채널, 구독자, 전체 조회수, 평균 조회를 저장한다.
- Instagram/TikTok은 Google Programmable Search로 실제 공개 프로필 URL을 가져오며, 팔로워/평균 조회는 후속 공식 API 또는 공개 프로필 수집 전까지 `수집 필요`로 표시한다.
- 예시/초안 후보는 기본 발굴 리스트에서 숨기고, `예시 보기`를 눌렀을 때만 노출한다.
- 브랜드 조건과 캠페인 조건을 기준으로 후보를 점수화한다.
- 추천 카드에는 추천 점수, 페르소나, 팔로워, 평균 조회, 참여율, 추천 이유, 리스크가 표시된다.
- 추천 후보 리스트는 엑셀 다운로드와 Google Sheets 전송을 지원한다.
- AI 추천 후보, 크리에이터 발굴, 섭외 완료 풀에서는 광고주 전달용 숏폼 후보 리스트를 샘플 엑셀 구조와 유사하게 다운로드할 수 있다.
- 광고주 전달용 리스트 컬럼은 `NO`, `구분`, `카테고리`, `닉네임`, `인스타주소/프로필주소`, `팔로워수`, `평균 조회수`, `릴스+숏츠 단가`, `숏츠단가`, `릴스단가`, `2차 라이센스 단가`, `진행일정`, `비고`로 구성한다.
- 제안 메시지는 친근한 답변 유도형 문체로 자동 생성된다.

### 4.3 크리에이터 발굴

- 검색어, 플랫폼, 카테고리 조건으로 후보를 필터링한다.
- 기본 상태에서는 데모/초안 후보를 숨기고 실제 API/수동 수집 후보만 표시한다.
- 추가 필터로 최소 팔로워, 최대 팔로워, 최소 평균 조회, 최소 참여율, 최대 단가, 최소 매칭 점수를 설정할 수 있다.
- 발굴 리스트는 엑셀 다운로드와 Google Sheets 전송을 지원한다.
- 발굴 리스트는 광고주에게 후보군을 컨펌받기 위한 숏폼 리스트 양식 다운로드를 지원한다.
- 후보 상세 패널에는 팔로워, 평균 조회, 참여율, 예상 단가, 브랜드 안정성, 오디언스, 데이터 출처, 검증 대기 메모가 표시된다.
- 틱톡 셀러 후보는 평균 조회, 참여율, 단가 조건을 기준으로 대량 섭외 대상으로 분류한다.

### 4.4 데이터 소스 원장

- 후보별 주요 지표의 출처, 수집 방식, 신뢰도, 갱신 주기를 표시한다.
- YouTube는 공식 YouTube Data API 연동 어댑터가 포함되어 있다.
- Instagram/TikTok 등은 현재 공개 프로필 수치를 운영자가 입력하고 출처 URL과 메모를 저장하는 MVP 방식이다.
- 실제 운영 시 공식 API, 공개 웹/미디어킷, 크리에이터 인증 데이터, 자체 성과 DB를 결합하는 구조로 확장한다.

### 4.5 메시지 검토함

- AI 추천 후보에서 메시지를 검토함에 저장하면 `자동` 출처로 기록된다.
- 크리에이터 상세에서 직접 제안 메시지를 작성하면 `수동` 출처로 기록된다.
- 메시지 검토함에는 권장 연락 채널, 발송 방식, 정책 안내가 함께 표시된다.
- 이메일은 공개 협업 이메일 또는 미디어킷 주소가 확인된 후보에게 Gmail/Outlook API 기반 자동 발송 대상으로 둔다.
- Instagram DM은 Professional 계정, Meta 앱 권한, 앱 리뷰가 필요한 승인형 채널로 보고 운영 초기에는 프로필 열기와 메시지 복사 중심으로 처리한다.
- TikTok DM은 대량 자동 DM 핵심 연동으로 두지 않고 공개 이메일, 링크인바이오, TikTok 프로필 이동, 수동 DM 발송 보조로 운영한다.
- 상태는 승인 대기, 발송 완료, 응답, 섭외 완료로 관리한다.
- 섭외 완료 처리 시 해당 크리에이터가 섭외 완료 풀에 저장되고 캠페인 배정 후보에도 반영된다.

### 4.6 캠페인 관리

- 캠페인 생성 시 예산, 마감일, 목표, 캠페인 타입을 입력한다.
- 캠페인 타입은 제안형, 공개모집, 앰배서더, 커머스/제휴, UGC/숏폼, 틱톡 공동구매 셀러로 구분한다.
- 캠페인 생성 시 인플루언서 브랜드 가이드 양식을 다운로드할 수 있고, 작성된 `.docx`, `.md`, `.txt`, `.csv`, `.tsv`, `.xlsx` 가이드를 첨부할 수 있다.
- 첨부된 가이드는 캠페인 상세에 기록되며, 텍스트/시트형 파일은 브랜드 학습자료로도 반영된다.
- 미션/가이드라인, 리워드/지급 기준, 검수/승인 플로우, 커머스/성과 지표, KPI 목표, 목표 조회수, 목표 전환, 목표 주문, 목표 매출, 셀러 섭외 목표를 저장한다.
- 캠페인 상세에서 진행률, 집행금액, 예상 매출, KPI 목표 대비 달성률, 배정 크리에이터, 운영 가이드를 확인할 수 있다.

### 4.6.1 KPI 기반 운영

- 캠페인은 단순 게시 완료가 아니라 조회수, 댓글, 공유, 저장, 전환, 주문, 판매 코드 성과 등 KPI 달성을 목표로 관리한다.
- 캠페인별 KPI 목표 텍스트와 별도로 `targetViews`, `targetConversions`, `targetOrders`, `targetRevenue`, `sellerRecruitTarget`를 분리 저장한다.
- 캠페인 카드와 상세 화면에는 목표 대비 달성률과 핵심 KPI의 실제/목표 수치가 표시된다.
- 리포트에서는 콘텐츠 성과와 섭외 완료 풀을 누적해 캠페인별 KPI 달성률을 비교한다.
- 콘텐츠 추적 등록 시 조회수, 좋아요, 댓글, 공유, 저장, 전환을 함께 입력한다.

### 4.6.2 틱톡 공동구매 셀러 대량 섭외

- 틱톡 플랫폼 후보 중 평균 조회, 참여율, 예상 단가 조건을 만족하는 후보를 공동구매 셀러 후보로 분류한다.
- `틱톡 셀러 대량 저장` 버튼으로 셀러 후보를 메시지 검토함에 일괄 저장한다.
- 대량 섭외 출처는 `대량 섭외`로 기록해 AI 자동 추천, 수동 작성과 구분한다.
- 공동구매 제안 메시지는 제품 포인트, KPI, 판매 코드/전환 링크, 샘플/조건 확인 답변 옵션을 포함한다.
- 캠페인에는 셀러 섭외 목표 인원을 저장하고, 향후에는 셀러별 판매 건수와 커미션 데이터를 연결한다.

### 4.7 섭외 완료 풀

- 섭외 완료된 크리에이터를 브랜드/캠페인 기준으로 저장한다.
- 클라이언트 컨펌에 필요한 팔로워, 평균 조회, 참여율, 예상 단가, 오디언스, 브랜드 적합성, 브랜드 안정성, 가짜 팔로워 위험을 함께 보여준다.
- 섭외 완료 풀은 엑셀 다운로드와 Google Sheets 전송을 지원한다.
- 섭외 완료 풀은 광고주 컨펌/공유용 숏폼 리스트 양식 다운로드를 지원한다.

### 4.8 배송/수동 정산 관리

- 자동 송금/자동정산은 현재 범위에서 제외한다.
- 수취인, 아이디, 전화번호, 주소, 은행, 계좌번호, 예금주, 지급 예정액, 배송 상태, 택배사, 운송장번호, 메모를 기록한다.
- 배송/수동 정산 상태는 배송 준비, 발송 대기, 발송 완료, 정산 완료로 관리한다.
- 화면 미리보기에서는 전화번호와 계좌번호를 일부 마스킹한다.
- 엑셀/Google Sheets 전송 시 운영자가 입력한 원본값이 포함되므로 전송 전 확인창을 띄운다.
- 배송/수동 정산 데이터는 엑셀 다운로드와 Google Sheets 전송을 지원한다.

### 4.9 콘텐츠 성과 추적 및 리포트

- 콘텐츠 URL, 플랫폼, 제목, 조회수, 좋아요, 댓글, 공유, 저장 수를 기록한다.
- 추적 데이터 갱신 기능으로 데모 성과 수치를 업데이트할 수 있다.
- 리포트 화면에서 조회수, 댓글, 공유, 전환 데이터를 요약한다.
- 성과 보고서는 CSV와 HTML 형태로 다운로드된다.

### 4.10 파일 내보내기 및 백업

- AI 추천 리스트 엑셀 다운로드
- 크리에이터 발굴 리스트 엑셀 다운로드
- 섭외 완료 풀 엑셀 다운로드
- 배송/수동 정산 엑셀 다운로드
- 각 리스트 Google Sheets 전송
- 성과 CSV/HTML 보고서 다운로드
- 전체 워크스페이스 JSON 백업

### 4.11 팀 협업 및 권한 관리

현재 MVP는 브라우저 localStorage 기반이라 한 명의 브라우저에서만 데이터가 유지된다. 운영 제품은 반드시 공유 DB와 인증을 연결해 팀 단위로 동작해야 한다.

필수 역할은 다음과 같다.

| 역할 | 권한 |
| --- | --- |
| Owner | 결제/설정/팀원 초대/모든 데이터 수정 |
| Admin | 브랜드, 캠페인, 후보, 메시지, 리포트 전체 관리 |
| Manager | 담당 브랜드/캠페인 운영, 메시지 검토, 섭외 완료 처리 |
| Viewer | 데이터 조회, 리포트 확인, 다운로드 제한 가능 |
| Client Viewer | 클라이언트 컨펌용 화면 조회, 댓글/승인만 가능 |

팀 협업 기능 요구사항:

- 이메일 또는 초대 링크로 팀원을 초대한다.
- 팀원은 같은 워크스페이스의 브랜드/캠페인 데이터를 실시간 또는 준실시간으로 확인한다.
- 브랜드별, 캠페인별 접근 권한을 설정한다.
- 누가 후보를 추가했는지, 누가 메시지를 발송 처리했는지, 누가 다운로드했는지 로그를 남긴다.
- 클라이언트는 내부 정산/계좌 정보 없이 컨펌에 필요한 지표와 캠페인 진행 상태만 볼 수 있어야 한다.
- 배송/수동 정산 정보는 Owner/Admin 등 제한된 역할만 볼 수 있어야 한다.

## 5. 데이터 구조

| 데이터 | 주요 필드 |
| --- | --- |
| brand | id, name, owner, color, brief |
| brandBrief | brandName, product, persona, keywords, exclusions, platforms, categories, minFollowers, maxPrice, learningMaterials |
| briefAutoSetup | rawText, parsedProduct, hookLines, targetPlatforms, targetCounts, followerRanges, generatedAt |
| brandLearningMaterial | id, title, sourceType, sourceName, summary, keywords, doSay, dontSay, createdAt |
| creator | id, name, handle, profileUrl, contactEmail, preferredContactChannel, platform, category, followers, averageViews, engagement, price, audience, fit, brandSafety, fakeRisk, metricSources, discoveryKey, needsVerification, sourceNote |
| campaign | id, brandId, name, owner, budget, spend, revenue, deadline, objective, campaignType, mission, reward, approvalFlow, commerceMetric, kpiGoal, targetViews, targetConversions, targetOrders, targetRevenue, sellerRecruitTarget, brandGuideAttachments, creatorIds |
| recommendation | id, creatorId, campaignId, brandId, score, persona, reasons, risk, message |
| outreach | id, creatorId, campaignId, source, channel, deliveryMode, complianceNote, status, message, reason, sentAt, createdAt |
| recruitedPool | id, creatorId, campaignId, source, channel, status, note, createdAt |
| fulfillmentRecord | id, campaignId, creatorId, recipient, handle, phone, address, bank, accountNumber, accountHolder, paymentAmount, courier, trackingNumber, deliveryStatus, memo |
| trackedPost | id, campaignId, creatorId, platform, title, url, views, likes, comments, shares, saves, conversions, lastChecked |
| sellerPerformance | id, campaignId, creatorId, sellerCode, orders, revenue, conversionRate, checkedAt |
| activity | id, type, text, createdAt |
| workspace | id, name, ownerUserId, plan, createdAt |
| workspaceMember | id, workspaceId, userId, role, status, invitedAt, joinedAt |
| brandPermission | id, workspaceId, brandId, userId, role |
| auditLog | id, workspaceId, userId, action, targetType, targetId, metadata, createdAt |

## 6. API 연동 현황

| API/연동 | 현재 상태 | 비고 |
| --- | --- | --- |
| OpenAI API | 미연동, 설계 대상 | 실제 AI 리서치/추천/메시지 생성용 |
| YouTube Data API | MVP 실제 검색/동기화 구현 | API 키로 채널 검색, 구독자, 전체 조회수, 영상 수 기반 평균 조회를 후보 DB에 반영 |
| Google Programmable Search | MVP 실제 프로필 검색 구현 | API Key/CX로 Instagram/TikTok/YouTube 공개 프로필 URL을 검색해 후보 DB에 저장 |
| Google Sheets | MVP 전송/학습자료 가져오기 구현 | TSV 복사 후 새 Google Sheet에 붙여넣는 방식, 학습자료는 붙여넣기 또는 공개 CSV URL 가져오기 |
| Google Drive/Gmail | 미연동, 설계 대상 | 보고서 저장, 공개 협업 이메일 기반 제안 발송용 |
| Instagram Messaging/API | 미연동, 심사 필요 | Professional 계정, Meta 권한, 앱 리뷰 후 승인형 DM 검토. MVP는 수동 링크/복사 |
| TikTok API | 미연동, 제한 검토 필요 | 대량 DM 자동 발송은 제외. 공개 이메일/링크인바이오/수동 DM 보조 중심 |
| TikTok Shop/공동구매 데이터 | 미연동, 설계 대상 | 셀러 후보 발굴, 판매 코드, 주문 성과, 공동구매 리포트 연동 검토 |
| Supabase/DB | 미연동, 운영 필수 | localStorage를 대체할 운영 DB 후보 |
| Auth/Team | 미연동, 운영 필수 | 팀원 로그인, 초대, 역할 권한, 클라이언트 보기 권한 필요 |
| GitHub 저장 | 문서화 대상 | `.md`, 백업 파일 저장소로 활용 가능 |

## 7. 명시적 제외 범위

- 자동 송금/자동정산 API 연동
- PG 결제 수납 자동화
- 오픈뱅킹/펌뱅킹 자동 지급
- 인플루언서에게 무제한 자동 DM 발송
- Instagram/TikTok 비승인 대량 DM 자동화
- Nox/Modash 등 경쟁사 API 직접 사용
- Instagram/TikTok 비공식 우회 크롤링을 핵심 의존성으로 사용
- 계정 없이 여러 사용자가 같은 localStorage를 공유하는 방식
- 클라이언트에게 내부 계좌/정산 개인정보를 노출하는 방식

## 8. 개인정보 및 보안 고려사항

- 현재 MVP는 localStorage 기반이므로 팀 공유와 개인정보 운영 저장소로 적합하지 않다.
- 전화번호, 주소, 계좌번호는 화면에서 일부 마스킹하지만 브라우저 저장소에는 입력값이 남는다.
- 운영 버전에서는 서버 DB 암호화, 접근 권한, 다운로드 로그, 개인정보 보관 기간 정책이 필요하다.
- API 키는 프론트엔드에 저장하지 않고 서버 환경변수로 관리해야 한다.
- 팀 공유 버전에서는 사용자별 권한, 세션 만료, 2단계 인증, 감사 로그가 필요하다.

## 9. 기능 검토 체크리스트

- 브랜드별 데이터 분리가 충분한가?
- 브랜드/제품 학습자료가 추천 후보와 제안 메시지 품질을 높이는 방식으로 반영되는가?
- 브리프 붙여넣기만으로 제품, 후킹포인트, 플랫폼별 후보 조건, 팔로워 범위가 자동 세팅되는가?
- 캠페인 목적이 조회수/전환/주문 KPI 중심으로 설계되어 있는가?
- AI 추천 후보 카드에 클라이언트 설득용 지표가 충분한가?
- 발굴 필터가 실제 영업 조건과 맞는가?
- 틱톡 공동구매 셀러를 대량으로 저장하고 관리하는 흐름이 충분한가?
- 제안 메시지 톤이 답장을 유도하는가?
- 연락 채널이 이메일 자동 발송, Instagram DM 수동/승인형, TikTok DM 수동 보조로 명확히 분리되는가?
- 자동/수동 섭외 구분이 운영 흐름에 맞는가?
- 섭외 완료 풀의 컨펌 정보가 클라이언트 검토에 충분한가?
- 배송/수동 정산 항목이 실제 지급/배송 업무에 충분한가?
- 엑셀/Google Sheets 내보내기 컬럼이 실무 양식과 맞는가?
- 리포트에 필요한 성과 지표가 충분한가?
- 운영 버전에서 필요한 권한/보안/감사 로그 범위가 정해졌는가?
- 팀원 역할별로 볼 수 있는 브랜드/캠페인/정산 정보가 분리되어 있는가?
- 클라이언트가 볼 화면과 내부 운영자가 볼 화면이 명확히 나뉘어 있는가?

## 10. 다음 개발 우선순위 제안

1. Supabase 또는 백엔드 DB 연결
2. Auth 기반 팀 계정, 초대, 역할 권한, 클라이언트 보기 권한 추가
3. 감사 로그와 다운로드 로그 추가
4. 배송/수동 정산 데이터 암호화 저장 및 접근 권한 분리
5. KPI 구조화: targetViews, targetOrders, targetRevenue, sellerRecruitTarget 분리 저장
6. 틱톡 공동구매 셀러 대량 발굴/대량 섭외 파이프라인 고도화
7. 브랜드/제품 학습자료를 백엔드 DB와 벡터 검색으로 구조화
8. OpenAI API 기반 브리프 구조화, 후킹포인트 분류, 플랫폼별 발굴 조건 생성 고도화
9. Gmail/Outlook API 기반 이메일 발송, 수신 거부, 발송량 제한, 중복 발송 방지 로그 추가
10. Instagram/TikTok DM은 승인형/수동 보조 발송 플로우로 분리
11. OpenAI API 기반 실제 후보 리서치/추천 생성
12. Google OAuth 기반 Sheets/Drive/Gmail 정식 연동
13. YouTube Data API 서버 연동 전환
14. Instagram/TikTok은 인증 기반 데이터 수집 플로우 설계
