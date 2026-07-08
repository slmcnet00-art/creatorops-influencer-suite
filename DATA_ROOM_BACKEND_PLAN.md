# CreatorOps Data Room Backend Plan

작성일: 2026-07-06

## 목적

현재 CreatorOps는 프론트 MVP와 어드민 데이터룸 화면이 먼저 구현되어 있다. 운영 순서는 다음처럼 재정렬한다.

1. 백엔드: 데이터 폴더링과 raw 데이터 적재 설계
2. 프론트엔드: 1번 raw/metric 구조를 기반으로 화면 및 와이어프레임 설계
3. 데이터룸 적재: 실제 raw, import row, metric snapshot을 DB에 저장
4. MVP 개발 및 내부 테스트

이 문서는 1번과 3번을 보완하기 위한 기준 문서다.

## 현재 상태 진단

| 영역 | 현재 상태 | 부족한 점 |
| --- | --- | --- |
| 프론트 데이터룸 | raw/metric 카탈로그, 상세 패널, 기능-데이터 커버리지 표시 | 실제 DB 적재 테이블과 1:1 연결은 아직 약함 |
| Supabase | workspace, auth, outreach, content tracking, performance snapshot 기본 테이블 있음 | raw 데이터 registry, external report import, metric catalog, data quality 로그 부족 |
| 외부 API | YouTube/Google/Brave/TikTok reference search 일부 연결 | 수집 job 단위 저장, 원본 응답 저장, 실패 로그 표준화 부족 |
| 외부 리포트 | 브랜드/영상 모니터 엑셀 컬럼 분석 완료 | 업로드 파일 파싱 및 시트별 row 적재 미구현 |
| 프론트 기능 | 캠페인, 발굴, 그룹, 메시지, 리포트, 레퍼런스 화면 구현 | 모든 수치가 데이터룸 raw에서 온다는 강제 규칙은 미완성 |

## 데이터 폴더링 원칙

데이터는 화면 단위가 아니라 원천과 신뢰도 기준으로 나눈다.

```text
data_room
├─ registry
│  ├─ raw_data_sources
│  ├─ metric_definitions
│  └─ workflow_data_dependencies
├─ ingestion
│  ├─ external_report_imports
│  ├─ external_report_rows
│  ├─ external_search_events
│  └─ job_runs
├─ normalized
│  ├─ creators
│  ├─ creator_metric_sources
│  ├─ content_tracking
│  ├─ performance_snapshots
│  ├─ brand_tracking_sources
│  └─ benchmark_content_sources
├─ calculated
│  ├─ metric_snapshots
│  ├─ data_quality_reviews
│  └─ recommendation_scores
└─ audit
   ├─ ai_generation_runs
   ├─ export_events
   └─ audit_logs
```

## Raw 데이터 저장 원칙

- 원본 raw는 삭제하지 않는다.
- raw row에는 `source_type`, `source_name`, `source_file`, `sheet_name`, `row_index`, `payload`, `normalized_ref`를 남긴다.
- 계산에 쓰인 raw ID를 metric snapshot에 저장한다.
- 프론트는 DB에 없는 수치를 확정값처럼 보여주지 않는다.
- API/크롤링/수동 업로드/외부 리포트는 모두 같은 import/job 로그 구조에 연결한다.

## Raw 데이터 카탈로그 우선순위

| 우선순위 | Raw ID | 데이터명 | 적재 방식 | 저장 테이블 |
| --- | --- | --- | --- | --- |
| P0 | RAW-INT-BRD-001 | 브랜드/제품 브리프 | 앱 입력 | workspace_snapshots -> future normalized brand tables |
| P0 | RAW-INT-CMP-001 | 캠페인/성과 보고서 자료 | 앱 입력 | workspace_snapshots -> future campaigns |
| P0 | RAW-INT-INF-001 | 인플루언서 리스트/후보 풀 | 앱 입력/API 결과 | workspace_snapshots -> future creators |
| P0 | RAW-EXT-CONT-001 | 콘텐츠 조회수 | API/수동 | content_tracking, performance_snapshots |
| P0 | RAW-EXT-ENG-001 | 좋아요/댓글/공유/저장 | API/수동 | performance_snapshots |
| P1 | RAW-EXT-SEARCH-001 | 외부 검색 원본 결과 | API | external_search_events |
| P1 | RAW-INT-QUALITY-001 | 데이터 품질 판정 로그 | 계산 엔진 | data_quality_reviews |
| P1 | RAW-EXT-MON-INF-001 | 외부 브랜드 모니터 인플루언서 리포트 | 엑셀 업로드 | external_report_imports, external_report_rows |
| P1 | RAW-EXT-MON-VIDEO-001 | 외부 영상 모니터 상세/일별 리포트 | 엑셀 업로드 | external_report_imports, external_report_rows, performance_snapshots |
| P1 | RAW-EXT-MON-WB-001 | 외부 워크벤치 델타/기여도 리포트 | 엑셀 업로드 | external_report_imports, external_report_rows, metric_snapshots |
| P2 | RAW-INT-AI-001 | AI 생성 실행 로그 | API | ai_generation_runs |
| P2 | RAW-INT-EXPORT-001 | 다운로드/내보내기 로그 | 프론트/API 이벤트 | export_events |
| P2 | RAW-EXT-UNSUPPORTED-001 | 미지원/부분지원 플랫폼 지표 | 보류/수동/인증 | data_quality_reviews, unsupported_metric_requests |

## 외부 엑셀 리포트 적재 설계

컬럼 단위로 API raw, 계산지표, 보완 raw 중 어디에서 가져와야 하는지는 [REPORT_FIELD_SOURCE_AUDIT.md](./REPORT_FIELD_SOURCE_AUDIT.md)를 기준으로 한다. 프론트에 표시되는 수치는 이 판정표에 있는 raw ID와 metric ID를 연결해야 하며, 연결되지 않은 값은 표시하지 않는다.

### 1. 외부 브랜드 모니터 인플루언서

파일 예시:

- `brand_monitor_influencers_202607187.xlsx`

확인된 컬럼:

- Influencers
- Channel link
- External monitor link
- Subscribers
- Region
- Language
- Average views
- Total Views
- Engagement rate
- Videos
- The last video
- Price

적재:

- `external_report_imports.report_type = brand_monitor_influencers`
- `external_report_rows.sheet_name = 0`
- `external_report_rows.payload`에 원본 row 저장
- 정규화 대상: creator profile, metric source, benchmark candidate

### 2. Video Monitor Data

파일 예시:

- `Video_Monitor_Data_20260706154757037.xlsx`

시트:

- Monitor Project Summary
- Monitor Project Details
- Daily Change

확인된 주요 컬럼:

- Project Name
- Platform
- KOL Channel Name
- KOL Channel URL
- Sponsor Video Title
- Sponsor Video URL
- Followers
- Views
- Comments
- Likes
- Shares
- collects
- Engagement Rate
- Tracking URL Clicks
- Installs
- Sales Quantity
- Sales Volume
- Amount Spent
- CPM/CPE/CPC/CPI/CPS/CPV
- ROAS/ROI
- Est. Video Value
- Date/Monitor Time

적재:

- `external_report_imports.report_type = video_monitor_data`
- project summary는 metric snapshot으로 변환
- project details는 content_tracking/performance_snapshots로 변환 가능
- daily change는 performance_snapshots의 captured_at 기준 row로 변환

### 3. Video Monitor Workbench

파일 예시:

- `Video_Monitor_Workbench_20260706.xlsx`

시트:

- Summary
- Delta Ranking
- Views Likes Comments Trend
- Influencer Contribution
- Label Contribution
- Label Distribution

확인된 주요 컬럼:

- Views Delta
- Engagement Delta
- Engagement Rate Delta
- Influencer Contribution Rate
- Label Contribution Rate
- Views/Likes/Comments Trend

적재:

- `external_report_imports.report_type = video_monitor_workbench`
- Delta Ranking은 benchmark content source와 metric snapshot으로 변환
- Influencer Contribution은 creator contribution metric으로 변환
- Label Contribution/Distribution은 소재/후킹 라벨 성과 metric으로 변환

## 계산지표 생성 구조

| 지표 번들 | 지표 | 사용 raw |
| --- | --- | --- |
| SNS 반응 | 조회수, 좋아요, 댓글, 공유, 저장, 참여율 | RAW-EXT-CONT-001, RAW-EXT-ENG-001 |
| 콘텐츠 성과 | 평균 조회수, 콘텐츠 성장률, 채널별 성과 | RAW-EXT-CONT-001, RAW-EXT-MON-VIDEO-001 |
| 브랜드/경쟁 추적 | 저장 브랜드 수, 경쟁 콘텐츠 평균 조회수 | RAW-EXT-BRAND-001, RAW-EXT-MON-INF-001 |
| 외부 리포트/벤치마크 | 외부 모니터 인플루언서 수, 평균 단가, 델타 랭킹, 기여도 | RAW-EXT-MON-INF-001, RAW-EXT-MON-VIDEO-001, RAW-EXT-MON-WB-001 |
| AI 매칭 | 브랜드-크리에이터 적합도, 후보 우선순위 | RAW-INT-BRD-001, RAW-INT-INF-001, RAW-INT-QUALITY-001 |
| 데이터 운영 | 수집 성공률, 미지원 데이터 비율 | RAW-EXT-SEARCH-001, RAW-EXT-UNSUPPORTED-001 |

## 3번 데이터룸 적재 MVP 범위

P0:

1. `raw_data_sources`에 화면에서 쓰는 모든 raw ID 등록
2. `metric_definitions`에 계산지표 등록
3. `content_tracking` + `performance_snapshots`로 리포트 수치 저장
4. `external_search_events`로 발굴/레퍼런스 검색 원문 저장

P1:

1. 엑셀 업로드 import job 생성
2. 파일별/시트별 row를 `external_report_rows.payload`에 저장
3. Brand Monitor/Video Monitor/Workbench 컬럼 매핑
4. 정규화 가능한 row는 creator/content/metric snapshot으로 연결

P2:

1. AI 추천 실행 로그 저장
2. export 이벤트 저장
3. data quality review 자동 생성

## 2026-07-06 구현 반영

현재 코드에 반영된 범위:

1. 프론트 데이터룸 raw/metric 카탈로그를 Supabase `raw_data_sources`, `metric_definitions`에 동기화하는 `syncDataRoomRegistry`를 추가했다.
2. 어드민 데이터룸 진입 시 registry를 자동 동기화한다.
3. 어드민 데이터룸에 외부 엑셀 리포트 업로드 영역을 추가했다.
4. 파일명 기준으로 아래 리포트를 식별한다.
   - `brand_monitor_influencers*` -> `RAW-EXT-MON-INF-001`
   - `Video_Monitor_Data*` -> `RAW-EXT-MON-VIDEO-001`
   - `Video_Monitor_Workbench*` -> `RAW-EXT-MON-WB-001`
5. 업로드된 엑셀은 시트별로 파싱하여 `external_report_imports`, `external_report_rows`에 저장한다.
6. 외부 리포트 import row count는 초기 `metric_snapshots`로 남겨 추후 정규화 검증의 출발점으로 사용한다.
7. `/youtube/channel`, `/discovery/*`, `/references/search`, `/public/profile-snapshot`, `/tracking/refresh` API 성공/실패 응답을 `external_search_events`에 자동 저장한다.
8. 어드민 데이터룸에서 최근 API 수집 로그 20건을 확인할 수 있다.

아직 남은 범위:

1. Supabase SQL Editor에서 `supabase/schema.sql`을 실제 운영 프로젝트에 적용해야 한다.
2. `external_report_rows.payload`를 creators/content/performance snapshot으로 정규화하는 서버 job이 필요하다.
3. 모든 고객용 대시보드 수치가 `metric_snapshots`를 우선 조회하도록 읽기 계층을 분리해야 한다.

## MVP 내부 테스트 체크리스트

- 브랜드/캠페인 생성 후 raw_data_sources에서 관련 raw 확인
- 발굴 검색 실행 후 external_search_events에 query/platform/country/result_count 저장
- 후보 저장 후 creator metric source 또는 workspace snapshot에 근거 저장
- 콘텐츠 추적 등록 후 performance_snapshots에 조회/좋아요/댓글 저장
- 외부 엑셀 업로드 후 external_report_imports에 파일 기록 저장
- 외부 엑셀 시트별 row 수가 external_report_rows에 맞게 저장
- 데이터룸에서 raw ID 클릭 시 원천 위치, 저장 위치, 연결 지표 확인
- 리포트 화면의 수치가 performance_snapshots 또는 external_report_rows에서 설명 가능

## 아직 정리/개발이 필요한 부분

1. 프론트 데이터룸 카탈로그를 DB `raw_data_sources`, `metric_definitions`에서 우선 읽도록 전환
2. 외부 리포트 row -> normalized creator/content/metric 변환기 구현
3. OpenAI 추천/메시지/가이드 실행 로그 저장
4. 미지원 지표는 `unsupported_metric_requests` 또는 `data_quality_reviews`에 등록하고 프론트에는 검증 필요로 표시
5. 데이터룸에서 raw -> metric -> frontend area 역추적 테스트 자동화
