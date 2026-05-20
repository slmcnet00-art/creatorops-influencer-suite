# CreatorOps 데이터 구축 전략

Nox API나 경쟁사 API를 가져오지 않고, 합법적으로 확보 가능한 데이터와 우리 자체 운영 데이터를 결합해 정확도를 높인다.

## 핵심 원칙

- 모든 지표는 `source`, `method`, `confidence`, `freshness`를 함께 저장한다.
- 검색용 얕은 데이터와 컨펌용 깊은 검증 데이터를 분리한다.
- Instagram/TikTok 비공식 우회 크롤링은 제품 핵심 의존성으로 두지 않는다.
- 공식 API, 공개 웹, 크리에이터 인증, 자체 캠페인 성과 DB를 교차 검증한다.
- 외부 데이터 벤더를 쓰더라도 최종 자산은 우리 DB에 쌓이는 응답률, 실제 단가, 실제 성과다.

## 경쟁사에서 참고할 방식

| 경쟁사 | 참고할 방식 | 우리가 가져갈 구조 |
| --- | --- | --- |
| Modash | Search API와 상세 리포트 분리 | 1차 후보는 저비용 검색, 최종 후보만 깊은 검증 |
| HypeAuditor | 오디언스 품질, 가짜 팔로워, 참여율 중심 리포트 | 클라이언트 컨펌 카드에 품질/위험/근거 지표 노출 |
| CreatorIQ | 장기 크리에이터/콘텐츠/성과 그래프 | 캠페인 결과와 실제 견적을 자체 학습 자산으로 누적 |
| Traackr | 벤치마크, ROI, 장기 운영 데이터 | 발굴보다 성과 보고와 재섭외 판단 데이터를 강화 |

## 우리 데이터 레이어

1. 공식 API
   - YouTube Data API: 채널 통계, 공개 영상 통계, 최근 콘텐츠 조회/댓글.
   - Google Sheets/Gmail/Drive: 내보내기, 제안 발송, 보고서 저장.
   - 현재 MVP에는 YouTube API 키와 채널 ID/@핸들을 입력해 공식 채널 통계를 후보 DB에 반영하는 어댑터를 포함한다.

2. 공개 웹/미디어킷 수집
   - 크리에이터 홈페이지, 링크트리, 공개 이메일, 미디어킷, 협업 페이지.
   - 수집 시점과 원본 URL을 반드시 저장한다.

3. 크리에이터 인증 연결
   - 인플루언서가 직접 연결한 계정에서 도달, 저장, 공유 등 고정밀 인사이트 수집.
   - 캠페인 집행 전후의 정확한 리포트를 만드는 핵심 레이어.

4. AI 추정/보정
   - 브랜드 적합도, 예상 단가, 메시지 개인화, 추천 이유 생성.
   - 추정값은 신뢰도를 낮게 표시하고 실제 응답/견적/성과로 계속 보정한다.

5. 자체 성과 DB
   - 응답률, 섭외 완료율, 실제 견적, 콘텐츠 조회수, 댓글, 공유, 전환, 클라이언트 승인 이력.
   - 시간이 지날수록 외부 데이터보다 더 강한 경쟁력이 된다.

## 데이터 스키마 방향

```txt
creator
- id
- platform
- handle
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
- sentAt
- repliedAt
- quotedPrice
- finalPrice
- status
```

## 운영 순서

1. 브랜드 조건으로 1차 후보를 만든다.
2. 공개 지표와 공식 API로 팔로워/평균 조회/참여율을 계산한다.
3. AI가 브랜드 적합도와 추천 이유를 만든다.
4. 제안 전 최종 후보만 깊은 검증을 수행한다.
5. 섭외 완료 풀에는 클라이언트 컨펌 지표와 데이터 출처를 함께 저장한다.
6. 콘텐츠 업로드 후 성과를 추적하고 실제 결과를 다음 추천 모델에 반영한다.
