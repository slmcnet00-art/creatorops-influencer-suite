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

등록용 아이콘·콜백, 관리자용 인증 시작 API, 토큰 교환·암호화 저장·상태 조회를 제공한다. **실제 앱 Secret 등록, TikTok 권한 승인 및 실제 계정 승인을 완료했다는 뜻은 아니다.** 실계정 토큰 교환은 이 조건을 갖춘 후 별도 검증한다. 토큰 자동 갱신, 광고 성과 수집, Discovery 수집, 이벤트 전송, 광고 생성 UI는 이 변경에 포함하지 않는다.

IP Allowlist와 Request Signing은 별도 보안 설정이다. 클라이언트 연결 전에는 포털 기본 상태를 유지한다. Sandbox는 운영 데이터 조회를 대신하지 않는다. Allowlist Management는 특정 제한 기능 추가 승인용이므로 실제 필요한 기능과 대조 후 신청한다.

공식 근거: [광고주 인증](https://business-api.tiktok.com/gateway/docs/index?doc_id=1738373141733378), [API별 인증 비교](https://business-api.tiktok.com/gateway/docs/index?doc_id=1766037914914818), [Allowlist FAQ](https://business-api.tiktok.com/portal/docs/faqs-overview/v1.3).
