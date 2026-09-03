# CreatorOps YouTube API Services Compliance Review — Resolution Response

Prepared: September 3, 2026
API Client: CreatorOps Influencer Suite
Production client: https://creatorops-influencer-suite.onrender.com
Compliance demonstration: https://creatorops-influencer-suite.onrender.com/youtube-api-review

## 제출 전 확인 사항

**반드시 Google Cloud Console에서 YouTube Data API를 사용하는 프로젝트 번호가 `55286976424` 하나뿐인지 확인하세요.**

- 하나뿐이면 아래 영문 회신을 그대로 제출합니다.
- 개발·테스트·운영용 등 다른 프로젝트가 있으면 1번 답변의 프로젝트 번호 목록을 모두 추가해야 합니다.
- 여러 프로젝트를 쿼터 우회 목적으로 사용하면 안 됩니다.

## 메일 해석

YouTube 측은 기존 회신을 검토한 결과 CreatorOps API Client가 YouTube API Services 약관 및 정책을 준수하지 않는 항목을 발견했으며, 첨부 PDF에 적힌 모든 위반사항과 확인 질문에 대해 영업일 7일 이내에 해결 내용과 증빙을 보내 달라고 요청했습니다.

이번 PDF의 지적사항은 다음과 같습니다.

1. YouTube API Client에 사용하는 Google Cloud 프로젝트 번호가 여러 개인지 확인하고, 여러 개라면 모두 제출할 것.
2. 서비스 약관에 YouTube 서비스 약관 링크뿐 아니라 “CreatorOps를 사용하면 YouTube 서비스 약관의 적용을 받는 데 동의한다”는 명시적 문구를 넣을 것.
3. 개인정보처리방침을 쉽게 접근할 수 있게 제공하고, YouTube API 사용 사실·수집 데이터·이용 목적·처리 및 공유·쿠키/로컬 저장소·삭제/철회 방법·연락처를 명시할 것.
4. 사용자가 입력한 검색어와 URL이 YouTube에서 어떻게 사용되는지 명확히 설명하고, YouTube의 `followers` 표기를 `Subscribers`로 수정할 것.
5. 비승인 공개 YouTube API 데이터와 통계를 30일 이내에 갱신 또는 삭제하고 최신값만 표시할 것.
6. YouTube 전체 검색 결과의 일괄 다운로드 기능을 제거할 것.

## 영문 회신 메일 — 제출용

**Subject: Re: YouTube API Services Compliance Review — Resolutions for CreatorOps Influencer Suite**

Dear YouTube API Services Team,

Thank you for your review and for providing the detailed ToS Violations Report. We reviewed every item and implemented the following resolutions in the production CreatorOps Influencer Suite API Client.

### 1. Developer Policy III.D.1(c) — Google Cloud project numbers

CreatorOps Influencer Suite currently uses one Google Cloud project for its YouTube API Services integration:

- Project number: **55286976424**

We do not use multiple Google Cloud project numbers for this API Client.

### 2. Developer Policy III.A.1 — YouTube Terms of Service

We updated our Terms of Service and the API Client interface to display a direct link to the YouTube Terms of Service and the following express statement:

“By using CreatorOps Influencer Suite, users agree to be bound by the YouTube Terms of Service.”

Evidence:

- CreatorOps Terms of Service: https://creatorops-influencer-suite.onrender.com/terms
- YouTube API review page: https://creatorops-influencer-suite.onrender.com/youtube-api-review
- The registration screen now requires users to affirmatively accept the CreatorOps Terms, YouTube Terms of Service, and Privacy Policy before creating an account.

### 3. Developer Policy III.A.2(a), (b), (c), (d), (e), (g), and (i) — Privacy Policy

We published a prominent, directly accessible Privacy Policy and linked it from the API Client, the registration/login area, the Terms of Service, and the compliance demonstration page.

The updated Privacy Policy now:

- clearly states that CreatorOps uses YouTube API Services;
- links to the Google Privacy Policy and YouTube Terms of Service;
- identifies the public channel/video metadata and user-provided search terms or URLs that may be processed;
- explains how the data is accessed, collected, stored, and used;
- explains internal access and processing by service providers;
- explains the use of necessary cookies, browser local storage, and similar technologies;
- explains the 30-day refresh/deletion rule for Non-Authorized public YouTube API Data;
- provides Google OAuth revocation and data-deletion information; and
- provides our contact address, mipingplanai@gmail.com.

Evidence:

- CreatorOps Privacy Policy: https://creatorops-influencer-suite.onrender.com/privacy
- Google Privacy Policy: https://policies.google.com/privacy

### 4. Developer Policy III.C.4 — Use of user-provided data and YouTube terminology

We added a clear in-product notice explaining that user-entered search terms and public channel/video URLs are used only to request read-only public metadata from the YouTube Data API. CreatorOps does not use those inputs to upload, publish, comment on, edit, or delete content on YouTube.

We also changed the YouTube audience label from “Followers” to “Subscribers” in the discovery filters and content reference cards.

### 5. Developer Policy III.E.4(a)–(g) — 30-day refresh/deletion and current display

We implemented a scheduled daily retention operation for Non-Authorized public YouTube API Data. The production process:

- refreshes tracked public content data;
- deletes YouTube creator-profile snapshots, content-metric snapshots, and raw YouTube API search-event records older than 30 calendar days;
- removes API-derived values from saved workspace records when they cannot be refreshed within 30 days;
- preserves only user-provided operational identifiers such as a saved public URL when required for the user’s campaign workflow; and
- does not display expired API-derived statistics until they are collected again.

This operation is part of the daily production automation scheduled at 00:00 KST and is also visible to administrators as “YouTube API 30-day refresh/deletion.”

### 6. Bulk download of YouTube API search results

We removed the Excel, advertiser-file, and Google Sheets bulk-export controls when YouTube is selected in creator discovery. We also added defensive export filtering so YouTube API result rows are excluded from mixed-platform exports.

The remaining “Open original” action opens the public content directly on YouTube and does not embed or download the video.

### Production review links

- API Client: https://creatorops-influencer-suite.onrender.com
- Compliance demonstration: https://creatorops-influencer-suite.onrender.com/youtube-api-review
- Terms of Service: https://creatorops-influencer-suite.onrender.com/terms
- Privacy Policy: https://creatorops-influencer-suite.onrender.com/privacy

We have attached screenshots showing the revised Terms acceptance, Privacy Policy, YouTube-only discovery interface without bulk export controls, “Subscribers” terminology, and the 30-day retention control.

Please let us know if you need any additional evidence or clarification. Thank you for your review.

Sincerely,
Mipingplan / CreatorOps Influencer Suite
mipingplanai@gmail.com

## 권장 첨부 증빙

1. `01-terms-youtube-agreement.png` — 약관의 명시적 동의 문구와 YouTube 약관 링크
2. `02-privacy-youtube-api-disclosures.png` — YouTube API 사용, 데이터 항목, 공유, 쿠키, 30일, 연락처
3. `03-signup-explicit-consent.png` — 회원가입 동의 체크박스
4. `04-youtube-discovery-no-bulk-export.png` — YouTube 선택 상태에서 엑셀·광고주용·시트 버튼이 없는 화면 및 읽기 전용 안내
5. `05-youtube-subscribers-label.png` — 콘텐츠 레퍼런스 카드의 구독자/Subscribers 표기
6. `06-admin-youtube-retention.png` — 관리자 자동화의 YouTube API 30일 갱신·삭제 작업
7. 짧은 스크린캐스트 — 위 1~6을 한 번에 보여주고 운영 URL과 날짜가 보이도록 녹화

## 제출 전 체크리스트

- [ ] 프로젝트 번호 `55286976424`만 사용하는지 Google Cloud Console에서 확인
- [ ] 운영 `/terms`, `/privacy`가 로그인 화면으로 돌아가지 않고 실제 정책 페이지로 열리는지 확인
- [ ] 스크린샷 1~6 첨부
- [ ] 가능하면 수정된 운영 흐름의 1~2분 스크린캐스트 첨부
- [ ] 영업일 7일 이내 회신
