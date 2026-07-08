# Report Field Source Audit

작성일: 2026-07-08

이 문서는 과거 전달받은 엑셀 보고서 항목을 기준으로, 각 컬럼이 `API raw`, `계산지표`, `보완 raw` 중 어디에서 와야 하는지 판정한 기준표다. 원칙은 하나다.

> 프론트 화면에 보이는 모든 수치는 데이터룸의 raw 데이터 또는 계산지표에 연결되어야 한다. 연결이 없으면 화면에 표시하지 않거나 `데이터 미연결`로 표시한다.

## 판정 기준

| 구분 | 의미 | 데이터룸 처리 |
| --- | --- | --- |
| API raw | YouTube Data API, TikTok Research API, Instagram Graph API, 검색 API 등 승인된 API 응답에서 직접 받는 원천값 | `external_search_events`, `api_raw_events`, `content_tracking`, `performance_snapshots`에 원본 응답과 정규화 row 저장 |
| 계산지표 | raw 값들을 조합해서 만드는 지표 | `metric_definitions`에 계산식 등록, `metric_snapshots`에 계산 결과 저장 |
| 보완 raw | API로 안정 수집이 어렵거나 내부 시스템에서 와야 하는 값 | 엑셀 업로드, CRM, 광고비, 커머스 전환, 견적/단가 테이블, 수동 검수 raw로 저장 |
| 미지원/권한 필요 | 공식 API 권한 또는 계정 연결 없이는 임의 제3자 데이터를 안정적으로 가져올 수 없는 값 | `RAW-EXT-UNSUPPORTED-001` 또는 `data_quality_reviews`에 기록하고 프론트에서는 신뢰도/미연결 표시 |

## API 가능 범위 요약

| 플랫폼/소스 | API로 가능한 값 | 제한/보완 필요 |
| --- | --- | --- |
| YouTube Data API | 채널명, 채널 URL/ID, 국가 일부, 구독자 수, 채널 총 조회수, 영상 수, 영상 제목/설명/게시일, 영상 조회수, 좋아요 수, 댓글 수 | 공유 수, 저장 수, 가격, 판매/전환, 광고비는 제공하지 않음. 평균 조회수/참여율/성장률은 계산 필요 |
| TikTok Research API | 승인 시 영상 검색, 키워드/해시태그/국가 조건, 영상 조회수, 좋아요, 댓글, 공유, 즐겨찾기 수, 작성자 username, region_code, 게시일, 설명 | 계정 팔로워/상세 프로필은 별도 승인/엔드포인트 여부 확인 필요. 가격, 전환, 매출은 제공하지 않음 |
| Instagram Graph API | 권한이 있는 비즈니스/크리에이터 계정 또는 협력 계정의 미디어/인사이트 일부 | 임의 제3자 인스타 콘텐츠 전체를 검색하고 팔로워/조회수/저장을 대량 수집하는 용도는 공식 API만으로 제한적 |
| 검색 API | 후보 URL, 제목, 스니펫, 썸네일 후보, 공개 페이지 발견 | 팔로워/조회수/참여율 자체가 아니라 URL 발견용 raw다. 지표는 플랫폼 API 또는 보완 raw가 필요 |
| 내부 CRM/광고/커머스 | 발송, 오픈, 클릭, 응답, 전환, 매출, 비용, 정산 상태 | 외부 플랫폼 API가 아니라 내부 raw다. ROAS/ROI/CPA류 계산의 필수 원천 |

## 1. 브랜드 모니터 인플루언서 리포트 컬럼

데이터룸 raw ID: `RAW-EXT-MON-INF-001`

| 엑셀 컬럼 | 판정 | API/계산/보완 기준 | 연결 계산지표 |
| --- | --- | --- | --- |
| Influencers | API raw | YouTube 채널 title, TikTok username/display name, Instagram 권한 계정 username. 검색 API 결과는 후보 URL 발견까지만 인정 | `MET-EXT-INF-001` |
| Channel link | API raw | 검색 API 또는 플랫폼 API에서 발견한 canonical URL 저장 | `MET-EXT-INF-001` |
| External monitor link | 보완 raw | 과거 보고서 추적용 내부 감사 링크. 프론트 노출 금지 | 없음 |
| Subscribers | API raw / 권한 필요 | YouTube `channels.statistics.subscriberCount` 가능. TikTok/Instagram은 승인 또는 계정 연결 필요 | `MET-EXT-INF-002`, `MET-CONT-005` |
| Region | API raw + 계산 | YouTube channel country, TikTok region_code, 프로필/언어 기반 보정 | 후보 필터, 데이터 신뢰도 |
| Language | 계산지표 | 프로필명, 설명, 최근 콘텐츠 자막/설명 텍스트로 언어 감지 | 후보 필터, 데이터 신뢰도 |
| Average views | 계산지표 | 최근 N개 콘텐츠 조회수 평균. API raw가 없으면 보완 리포트 값 사용 | `MET-EXT-INF-002`, `MET-CONT-005` |
| Total Views | API raw / 계산지표 | YouTube 채널 총 조회수 또는 추적 콘텐츠 조회수 합계. 캠페인 기준이면 `sum(content.views)` | `MET-EXT-INF-002`, `MET-EXT-VIDEO-001` |
| Engagement rate | 계산지표 | `(likes + comments + shares + saves) / views`. 없는 항목은 제외하고 신뢰도 표시 | `MET-EXT-VIDEO-002`, `MET-SNS-006` |
| Videos | API raw / 계산지표 | 채널 영상 수 또는 추적 대상 콘텐츠 수 | `MET-EXT-INF-001` |
| The last video | 계산지표 | 추적 콘텐츠의 `max(published_at)` | 최신성 SLA |
| Price | 보완 raw + 계산지표 | 플랫폼 공식 API 값이 아님. 내부 견적, 과거 집행 단가, 카테고리 CPM/CPV 벤치마크로 산출 | 신규 `MET-PRICE-001` 필요 |

## 2. Video Monitor Data 리포트 컬럼

데이터룸 raw ID: `RAW-EXT-MON-VIDEO-001`

| 엑셀 컬럼/시트 | 판정 | API/계산/보완 기준 | 연결 계산지표 |
| --- | --- | --- | --- |
| Project Name | 내부 raw | 캠페인/리포트 프로젝트명 | `MET-CMP-001` |
| Date Created | 내부 raw | 프로젝트 생성일 또는 업로드 import 일시 | 리포트 생성 로그 |
| Date Published | API raw | YouTube `snippet.publishedAt`, TikTok `create_time`, Instagram 권한 미디어 timestamp | 최신성 SLA |
| Platform | API raw / 내부 raw | 링크 파싱 또는 API 응답에서 플랫폼 정규화 | 채널별 성과 비교 |
| KOL Channel Name | API raw | 플랫폼 profile/channel title 또는 username | `MET-EXT-INF-001` |
| UserName | API raw | 플랫폼 handle, username | `MET-EXT-INF-001` |
| Influencer Location | API raw + 계산 | TikTok region_code, YouTube country, 프로필/언어 기반 추정 | 데이터 신뢰도 |
| Influencer Language | 계산지표 | 프로필/캡션/설명 텍스트 언어 감지 | 데이터 신뢰도 |
| KOL Channel URL | API raw | 검색/API로 확인된 canonical profile/channel URL | 후보/리포트 링크 |
| Sponsor Video Title | API raw / 수동 | 공개 콘텐츠 제목/캡션. API 실패 시 등록자가 수동 보정 | 콘텐츠 추적 |
| Video Description | API raw | 영상 설명/캡션 | 가이드/레퍼런스 분석 |
| Sponsor Video URL | API raw / 내부 raw | 콘텐츠 추적 등록 URL | 콘텐츠 추적 |
| Followers | API raw / 권한 필요 | YouTube channel subscriber, TikTok/Instagram은 승인/권한 필요. 없으면 보완 raw | `MET-EXT-INF-002` |
| Views | API raw | YouTube/TikTok은 가능. Instagram은 권한 계정/인사이트 중심, 제3자 임의 수집은 제한 | `MET-EXT-VIDEO-001`, `MET-SNS-001` |
| Comments | API raw | YouTube/TikTok 가능. Instagram은 권한/공개 필드 범위 내 | `MET-EXT-VIDEO-001`, `MET-SNS-003` |
| Likes | API raw | YouTube/TikTok 가능. Instagram은 권한/공개 필드 범위 내 | `MET-EXT-VIDEO-001`, `MET-SNS-002` |
| Shares | API raw / 권한 필요 | TikTok Research API는 영상 share_count 가능. YouTube는 공식 공개 API에서 공유 수 제공 안 함 | `MET-SNS-004` |
| collects / saves | API raw / 권한 필요 | TikTok favorites_count 가능. Instagram saved는 권한 인사이트 중심. YouTube는 저장 수 없음 | `MET-SNS-005` |
| Engagement Rate | 계산지표 | `(likes + comments + shares + saves) / views` | `MET-EXT-VIDEO-002`, `MET-SNS-006` |
| Tracking URL Clicks | 내부 raw | UTM/단축링크/CRM 클릭 로그 필요 | `MET-CRM-003`, 신규 `MET-CONV-001` |
| Installs | 내부 raw | 앱 어트리뷰션/광고/커머스 이벤트 raw 필요 | 신규 `MET-CONV-002` |
| Sales Quantity | 내부 raw | 커머스 주문/전환 raw 필요 | 신규 `MET-CONV-003` |
| Sales Volume | 내부 raw | 커머스 매출 raw 필요 | 신규 `MET-CONV-004` |
| Amount Spent | 내부 raw | 캠페인 비용, 광고비, 인플루언서 지급 예정액 raw 필요 | `MET-CMP-001`, 신규 `MET-COST-001` |
| CPM | 계산지표 | `amount_spent / views * 1000` | 신규 `MET-COST-002` |
| CPE | 계산지표 | `amount_spent / engagement_count` | 신규 `MET-COST-003` |
| CPC | 계산지표 | `amount_spent / clicks` | 신규 `MET-COST-004` |
| CPI | 계산지표 | `amount_spent / installs` | 신규 `MET-COST-005` |
| CPS | 계산지표 | `amount_spent / sales_quantity` | 신규 `MET-COST-006` |
| CPV | 계산지표 | `amount_spent / views` | 신규 `MET-COST-007` |
| ROAS | 계산지표 | `sales_volume / amount_spent` | 신규 `MET-CONV-005` |
| ROI | 계산지표 | `(sales_volume - amount_spent) / amount_spent` | 신규 `MET-CONV-006` |
| est. video value | 계산지표 | `views * benchmark_cpv` 또는 `views / 1000 * benchmark_cpm`. 벤치마크 raw 필요 | 신규 `MET-VALUE-001` |
| Daily Change rows | API raw + 계산지표 | 일별 snapshot raw를 저장하고 `metric_t - metric_t-1`로 delta 계산 | `MET-EXT-VIDEO-003` |

## 3. Video Monitor Workbench 리포트 컬럼

데이터룸 raw ID: `RAW-EXT-MON-WB-001`

| 시트/컬럼 | 판정 | API/계산/보완 기준 | 연결 계산지표 |
| --- | --- | --- | --- |
| Summary - Project Count | 계산지표 | 해당 관측 기간의 프로젝트 수 | `MET-EXT-WB-001` |
| Summary - Observation Window | 내부 raw | 리포트 기준 기간 | 리포트 필터 |
| Summary - Views Delta | 계산지표 | `views_at_end - views_at_start` | `MET-EXT-WB-001` |
| Summary - Views Delta Percent | 계산지표 | `views_delta / views_at_start` | `MET-EXT-WB-001` |
| Summary - Engagement Delta | 계산지표 | `engagement_at_end - engagement_at_start` | `MET-EXT-WB-001` |
| Summary - Engagement Rate Delta | 계산지표 | `er_at_end - er_at_start` | `MET-EXT-WB-001` |
| Summary - Active Content | 계산지표 | 관측 기간 내 조회/반응 변화가 있는 콘텐츠 수 | `MET-EXT-WB-001` |
| Delta Ranking | 계산지표 | 콘텐츠별 delta를 정렬 | `MET-EXT-WB-001` |
| Views Likes Comments Trend | 계산지표 | `performance_snapshots` 일별 집계 | `MET-EXT-VIDEO-003` |
| Influencer Contribution | 계산지표 | `creator_delta / total_delta` | `MET-EXT-WB-002` |
| Label Contribution | 계산지표 | `label_delta / total_delta`. 라벨 raw가 없으면 낮은 신뢰도 | `MET-EXT-WB-003` |
| Label Distribution | 계산지표 | 라벨별 콘텐츠/조회/반응 비중 | `MET-EXT-WB-003` |

## 데이터룸에 추가로 필요한 원천 raw

| Raw ID 제안 | 데이터명 | 필요한 이유 |
| --- | --- | --- |
| `RAW-INT-COST-001` | 캠페인 비용/지급 예정액 raw | CPM, CPE, CPC, CPV, ROI 계산 |
| `RAW-INT-CONV-001` | 클릭/전환/주문/매출 raw | ROAS, ROI, 전환율, CPS 계산 |
| `RAW-INT-PRICE-001` | 인플루언서 견적/단가 벤치마크 raw | Price, 예상 영상가치, 예산 추천 계산 |
| `RAW-EXT-SNAPSHOT-001` | 콘텐츠 일별 스냅샷 raw | 성장률, 델타 랭킹, 기여도 계산 |
| `RAW-INT-LABEL-001` | 콘텐츠 라벨/후킹/소재 태그 raw | 라벨 기여도, 가이드 차용 추천 계산 |
| `RAW-EXT-UNSUPPORTED-001` | 미지원/권한 필요 지표 raw | Instagram/TikTok 권한 실패, 저장/공유 미지원 등 표시 |

## 프론트 표시 원칙

1. `API raw`가 없고 `계산지표`도 없으면 해당 카드는 숨긴다.
2. 계산지표는 반드시 `formula`, `used_raw_ids`, `confidence`, `last_calculated_at`을 가진다.
3. Instagram/TikTok처럼 권한 상태에 따라 값이 달라지는 플랫폼은 `데이터 신뢰도`를 함께 표시한다.
4. 가격/예상 가치/ROAS는 플랫폼 API 값처럼 보이면 안 된다. 반드시 `내부 비용 raw + 벤치마크 모델`에서 계산된 값으로 표시한다.
5. 과거 엑셀 보고서와 같은 형태의 다운로드는 `external_report_rows`와 `metric_snapshots`를 조합해서 재생성한다.

## 공식 API 근거

- YouTube Data API `videos` resource는 `statistics.viewCount`, `statistics.likeCount`, `statistics.commentCount`를 제공한다.
- YouTube Data API `channels` resource는 `statistics.viewCount`, `statistics.subscriberCount`, `statistics.videoCount`를 제공한다.
- TikTok Research API `Query Videos`는 승인된 Research API 기준으로 `region_code`, `view_count`, `like_count`, `comment_count`, `share_count`, `favorites_count`, `username` 등을 요청 필드로 제공한다.
- Instagram은 권한 기반 Graph API/Insights 중심이다. 임의 제3자 콘텐츠의 팔로워/조회/저장을 대량으로 안정 수집하는 기능은 보완 raw 또는 권한 연결이 필요하다.
