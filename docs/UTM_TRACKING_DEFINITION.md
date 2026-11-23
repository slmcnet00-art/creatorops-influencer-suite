# CreatorOps UTM 운영 정의

2026-11-23 · 현재 buildInfluencerTrackingAsset 구현 기준.

## 발급 단위와 원본

브랜드·캠페인·크리에이터별 링크를 발급한다. 최종 랜딩 URL은 캠페인의 landingUrl, productUrl, trackingUrl, 브랜드 홈페이지 순으로 선택한다. 실운영 전 상품 URL과 국가별 판매처를 확인한다.

| 항목 | 현재 생성 규칙 | 예시 |
| --- | --- | --- |
| utm_source | 크리에이터 플랫폼을 URL용 문자열로 변환 | instagram, youtube, tiktok |
| utm_medium | influencer 고정 | influencer |
| utm_campaign | 캠페인 이름 우선, 없으면 캠페인 ID | campaign ID 또는 현재 이름의 slug |
| utm_content | 크리에이터 핸들 우선, 없으면 이름·ID | creator handle의 slug |
| utm_term | 현재 자동 생성 대상에 없음 | 별도 키워드 분류가 필요하면 정의 후 적용 |

같은 캠페인·크리에이터의 여러 콘텐츠를 각각 구분하려면 콘텐츠 식별자를 추가하는 후속 스키마가 필요하다. 현재 링크는 캠페인·크리에이터 단위다. 캠페인 이름 변경 시 utm_campaign 문자열도 바뀔 수 있으므로, DB에서는 내부 campaignId·creatorId를 조인키로 사용한다.

## 확인할 값

| 단계 | 의미 | 원천 |
| --- | --- | --- |
| 링크 클릭 | CreatorOps 숏링크 리다이렉트 요청 기록 | shortLinkClickLogs |
| 방문·세션 | 랜딩 사이트가 기록한 방문·세션 | GA4 등 인증된 분석 원천 |
| 구매·환불 | 브랜드 주문 데이터 또는 전환 이벤트 | orderAttributionLogs, conversionEvents 및 연결 주문 원천 |
| 쿠폰 사용 | 크리에이터 쿠폰 사용 기록 | couponRedemptionLogs |

클릭·세션·주문은 서로 다른 값이다. UTM 링크 생성만으로 구매수·매출을 관측할 수 없다. 현재 숏링크 요청 수에는 반복 방문이나 봇 요청이 포함될 수 있어 고유 방문자로 표시하지 않는다. 주문 ID와 캠페인·크리에이터 매핑을 보존하고, 쿠폰과 링크로 같은 주문이 두 번 집계되지 않는지 확인한다. 전환 인정 기간과 귀속 모델은 연결한 원천별로 기록한다.

## Amazon 판매처

아마존 외부 유입의 구매 성과를 측정할 때는 Amazon Attribution의 적격 계정에서 발급한 태그가 포함된 URL을 연결한다. 국가·상품 ASIN·브랜드/판매 계정·크리에이터별 링크와 발급 기준을 등록한다. 구매수·매출은 해당 Attribution 보고서를 연동하거나 검증된 원본 보고서로 가져와야 한다.

사용자가 말한 PA는 Amazon Associates 파트너 태그 또는 PA API 범위로 확인했다. 연결 목적별로 다음 항목을 구분한다.

| 목적 | 준비할 항목 | 집계 근거 |
| --- | --- | --- |
| 제휴 링크 식별·제휴 수익 확인 | Associates Store/Tracking ID, 해당 국가의 태그가 포함된 상품 링크 | Associates Tracking ID별 원본 보고서의 클릭·주문·배송·수수료 |
| 상품명·이미지·상품 정보 조회 | 승인된 Associates 계정의 Creators API 자격증명과 파트너 태그 | Creators API 상품 카탈로그 응답 |
| 브랜드가 진행한 외부 캠페인의 아마존 구매 성과 | Amazon Attribution 적격 계정, 캠페인/크리에이터별 태그 링크와 보고서 접근 | Attribution의 상품상세조회·구매·매출 |

Associates 태그는 보통 URL의 tag 파라미터에 포함된다. 사용자가 제공할 초기 정보는 국가/마켓플레이스, 상품 ASIN 또는 URL, 파트너 태그다. 태그를 등록한 뒤에도 실제 제휴 수익을 대시보드에 표시하려면 원본 보고서를 별도 연결해야 한다. 상품조회 API의 응답을 구매·수수료 실적으로 사용하지 않는다.

Amazon 공식 문서는 PA-API 5의 종료와 Creators API 전환을 안내하므로 신규 상품조회는 Creators API를 기준으로 준비한다. 비밀 자격증명은 관리자 비밀 저장소에 설정하고 링크·UTM·일반 문서에 기록하지 않는다.

현재 CreatorOps에는 Amazon Attribution 태그 자동 발급이나 성과 조회 연결을 이 문서만으로 추가하지 않았다. 발급된 Amazon URL의 추적 파라미터는 유지해야 하며, UTM을 더한 최종 URL·숏링크의 실제 리다이렉트와 귀속은 운영 계정에서 검증해야 한다.

공식 참고 문서

- Amazon Attribution 안내 — https://advertising.amazon.com/library/guides/basics-of-amazon-attribution
- PA API 전환 안내 — https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation
- Associates 태그 확인 — https://affiliate-program.amazon.com/help/node/topic/G6253GFSARDQENZR
- Tracking ID 보고서 — https://affiliate-program.amazon.com/help/node/topic/G5KVDATAT5RKBBBG
