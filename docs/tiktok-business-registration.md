# TikTok Business 등록 값

| TikTok 화면 | 값 |
| --- | --- |
| App logo | `https://creatorops-influencer-suite.onrender.com/creatorops-app-icon.png` — 512×512 PNG, 기존 CreatorOps 브랜드 마크 |
| Advertiser redirect URLs | `https://creatorops-suite-api.onrender.com/oauth/tiktok/advertiser/callback` |
| TikTok account holder redirect URL | `https://creatorops-suite-api.onrender.com/oauth/tiktok/account/callback` |
| 웹사이트 | `https://creatorops-influencer-suite.onrender.com/` |
| 개인정보처리방침 | `https://creatorops-influencer-suite.onrender.com/privacy` |
| 이용약관 | `https://creatorops-influencer-suite.onrender.com/terms` |

등록 값은 공개 `GET /oauth/tiktok/registration`에서도 조회한다. 콜백을 직접 방문하면 등록 주소라는 안내만 표시한다. 연결 성공으로 표시하지 않는다.

## 실제 연결 시작 조건

관리자 화면 `/admin?section=tiktok`에서 서버 키 등록과 인증 저장 상태를 확인한다. 포털에 해당 인증 완료 주소를 저장한 뒤 확인란을 선택하고 **광고주 연결 준비 → TikTok에서 승인 화면 열기** 순서로 진행한다. 이 화면은 승인을 자동 제출하지 않는다. 계정 소유자 연결은 승인된 계정 scope 설정이 준비되었을 때만 활성화된다.

- 서버의 `TIKTOK_BUSINESS_APP_ID`, `TIKTOK_BUSINESS_APP_SECRET`에 **TikTok API for Business의 해당 앱** 값을 등록해야 한다. Research/Commercial Content API 앱의 키를 대신 사용하지 않는다.
- 계정 소유자 인증에는 승인된 실제 scope를 `TIKTOK_BUSINESS_ACCOUNT_SCOPES`에 설정해야 한다. 범위를 임의로 요청하지 않는다.
- 관리자 인증을 포함해 `GET /oauth/tiktok/advertiser/auth-url` 또는 `GET /oauth/tiktok/account/auth-url`을 호출한다. 반환한 URL로 광고주/계정 소유자가 직접 승인한다. 포털 예시 URL의 `your_custom_params`를 실제 연결에 사용하지 않는다.
- 등록한 URI와 시작 URL의 URI가 정확히 일치해야 한다. 홈 주소로 대체하거나 OAuth 쿼리를 지우는 리디렉션을 사용하지 않는다.
- 승인 후 코드는 서버에서 교환한다. 토큰은 기존 암호화 저장소에 저장하며, public registration·status·콜백 화면에 노출하지 않는다. 관리자 상태 조회는 `GET /admin/tiktok-business/status`이다.
- 10분짜리 일회용 state를 DB CAS로 소진해 재사용·동시 중복·인증 종류 불일치를 거부한다. code 교환은 자동 재시도하지 않는다.

## 현재 제공 범위

등록용 아이콘·콜백, 관리자용 인증 시작 API, 토큰 교환·암호화 저장·상태 조회와 승인 후 사용할 읽기 전용 성과 조회 API를 제공한다. **키 등록과 앱 권한 승인·실제 계정 승인은 별개다.** 실계정 토큰 교환과 성과 조회는 조건을 갖춘 후 별도 검증한다. 토큰 자동 갱신, Discovery 수집, 이벤트 전송, 광고 생성 UI는 이 변경에 포함하지 않는다.

## 승인 대기 중 준비한 성과 조회

`POST /admin/tiktok-business/reports`는 기존 Owner/Admin 인증을 요구한다. 기본값은 비활성화이며 저장소·TikTok 호출 전에 `503 approval_required`로 차단한다. **승인 대기 중 실데이터를 조회하거나 승인된 것으로 표시하지 않는다.** 승인 후 광고주의 직접 인증과 보고 권한을 확인한 뒤에만 운영 담당자가 서버에 `TIKTOK_BUSINESS_REPORTING_ENABLED=true`를 설정하고 재배포한다. 이 설정 자체가 TikTok의 권한 승인을 증명하지는 않는다.

```json
{
  "connectionId": "광고주 연결 상태에서 반환한 advertiser:… 식별자",
  "advertiserId": "그 연결에서 승인된 문자열 광고 계정 ID",
  "startDate": "2026-11-01",
  "endDate": "2026-11-03",
  "page": 1,
  "pageSize": 100
}
```

- 복호화한 토큰은 서버 내부에서만 사용한다. 숫자 계정 ID, 미승인 계정, 만료·손상된 인증은 외부 호출 전에 거부한다. 계정 ID는 JavaScript 안전 정수보다 길 수 있으므로 문자열로 전달한다.
- TikTok Marketing API **v2.0**의 고정 `/report/integrated/get/`에 POST한다. v1.3의 `data_level`, `report_type` 필드를 혼용하지 않는다. API 이름의 get과 달리 현재 공식 Request 표의 HTTP 메서드는 POST다.
- 캠페인×날짜 기준으로 캠페인명·비용·노출·클릭·전환·통화·시간대를 요청한다. 최대 30일, 한 번에 1~100행, 한 페이지만 읽는다. 다음 페이지는 응답의 `pagination.nextPage`로 요청하며 자동 전체 순회는 하지 않는다.
- 응답은 `source`, `mode: live`, 수집 시각, 조회 계정·기간, `rows`, `pagination`, `warnings`, 해석 주의사항을 포함한다. 운영 API에 모의 데이터 폴백은 없다. 테스트의 모의 응답은 실제 승인·실데이터 검증을 대신하지 않는다.
- 미제공 값은 `null`이며 실제 0과 구분한다. 비용·전환 수는 원본 소수 문자열을 보존하고, 계정 ID를 숫자로 변환하지 않는다. 날짜는 광고 계정 시간대 기준이며 다른 통화를 합산하지 않는다. 광고 전환은 TikTok 귀속 기준이므로 UTM 유입·전체 구매와 동일하다고 해석하지 않는다.
- 동시 처리 2건·요청 시작 최소 200ms 간격으로 제한한다(서버 프로세스별). 권한 오류·429·5xx·타임아웃에 자동 재시도하지 않는다. HTTP 429에는 제한된 `Retry-After`를 전달한다. HTTP 200 안의 TikTok 오류 코드도 성공으로 처리하지 않는다.
- 잘못된 계정·기간·페이지 응답은 거부하고, 동기 보고서의 광고 20,000개 제한이나 제공 불가 지표 안내는 경고로 반환한다. 이 API로 전체 광고 데이터를 수집했다고 간주하지 않는다.
- 감사 로그에는 조회 행 수·기간·페이지 등 최소 정보만 기록한다. 외부 오류 원문, 토큰, Secret, 원본 보고서를 로그에 넣지 않는다. 조회 응답은 `Cache-Control: no-store`다.

승인 후 확인 순서: 추가 권한 승인 확인 → 콜백 URI 일치 확인 → 광고주 직접 인증 → 저장된 광고 계정·만료 상태 확인 → 성과 조회 활성화 → 하루·한 페이지 조회 → TikTok Ads Manager와 통화·시간대·귀속 기준을 맞춰 수치 비교. TikTok 공식 문서는 동기 API와 Ads Manager 다운로드의 집계 범위가 다를 수 있다고 안내한다.

공식 보고서 계약: [동기 보고서 v2.0](https://business-api.tiktok.com/portal/docs/run-a-synchronous-report/v2.0).

IP Allowlist와 Request Signing은 별도 보안 설정이다. 클라이언트 연결 전에는 포털 기본 상태를 유지한다. Sandbox는 운영 데이터 조회를 대신하지 않는다. Allowlist Management는 특정 제한 기능 추가 승인용이므로 실제 필요한 기능과 대조 후 신청한다.

공식 근거: [광고주 인증](https://business-api.tiktok.com/gateway/docs/index?doc_id=1738373141733378), [API별 인증 비교](https://business-api.tiktok.com/gateway/docs/index?doc_id=1766037914914818), [Allowlist FAQ](https://business-api.tiktok.com/portal/docs/faqs-overview/v1.3).
