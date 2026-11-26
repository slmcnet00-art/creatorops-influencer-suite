# CreatorOps 코드 리뷰 수정 지시서

코드 리뷰(2026-11-25, 커밋 `5ce6b87` 기준)에서 나온 결함을 수정 작업 단위로 정리한 문서다.
이 문서만 읽고 작업할 수 있도록 위치·현상·수정 방향·완료 조건을 적었다.

## 작업 규칙

- 줄 번호는 커밋 `5ce6b87` 기준이다. 어긋나면 함수명·문자열로 다시 찾는다.
- 한 작업(ID)마다 커밋을 나눈다. 작업 범위 밖 리팩터링은 하지 않는다.
- 작업마다 `tests/*.test.mjs`에 회귀 테스트를 추가한다. 기존 테스트는 지우거나 건너뛰지 않는다.
- 매 작업 후 `npm test`, `npm run lint`, `npm run build`가 통과해야 한다. (현재 226개 통과, lint 경고 없음)
- DB 변경은 `supabase/migrations/`에 새 파일로 추가하고 `supabase/schema.sql`에도 같은 내용을 반영한다. 기존 마이그레이션 파일은 고치지 않는다.
- "확인 필요"라고 표시된 항목은 먼저 재현하거나 코드로 확인한 뒤, 사실이 아니면 수정하지 말고 그 이유를 보고한다.
- 제품 동작을 바꾸는 결정이 필요한 항목은 "결정 필요"로 표시했다. 임의로 정하지 말고 질문한다.

## 배경

- React 19 + Vite SPA(`src/`), Express API(`server/`), Supabase(인증·DB, `supabase/`).
- 워크스페이스 상태 전체가 하나의 객체로 `localStorage['creatorops.workspace.v2']`에 저장된다.
- 클라우드 저장은 스냅샷 방식이다.
  - `workspace_snapshots`: 워크스페이스당 1행, Owner/Admin만 읽기·쓰기.
  - `brand_scoped_snapshots`: (워크스페이스, 브랜드)당 1행.
  - 쓰기는 `src/snapshotConcurrency.js`의 `compareAndSwapSnapshot`(`updated_at` 일치 조건부 UPDATE)을 쓴다.
  - 클라이언트는 10초 폴링으로 원격 변경을 감지한다.
- 역할: Owner, Admin, Manager, Marketer, Analyst, Client. Owner/Admin은 전체 브랜드, 나머지는 `brand_memberships`에 있는 브랜드만.

---

## P0 — 권한·보안

### SEC-1. 전 멤버에게 열린 테이블을 브랜드·역할 범위로 좁힌다

- 위치: `supabase/schema.sql:891-898`(outreach_messages), `:929-956`(creator_contact_points, creator_rates 등), `:1050-1056`(utm_tracking_rows)
- 현상: 정책이 `for all … using (is_workspace_member(workspace_id))`다. 한 브랜드만 배정된 Client·Analyst도 anon 키와 자기 JWT로 직접 질의하면 전 브랜드의 크리에이터 연락처, 합의 단가, 발송 메일 본문을 읽고 삭제할 수 있다. `outreach_messages`의 수신거부 행(`status in ('suppressed','campaign_suppressed')`)도 지울 수 있어 서버의 "Owner/Admin만 전역 수신거부 변경" 규칙(`server/index.js:2527`)이 무력화된다.
- 수정:
  - `outreach_messages`: 클라이언트 쓰기 정책을 제거한다(서버가 service role로만 쓴다). 읽기는 Owner/Admin/Manager/Marketer로 제한한다. 클라이언트가 이 테이블에 직접 쓰는 코드가 있는지 `src/backendSync.js`에서 먼저 확인하고, 있으면 서버 API 경유로 바꾼다.
  - `creator_contact_points`, `creator_rates`: 쓰기는 Owner/Admin(현재 전체 스냅샷 저장 시에만 동기화됨, `src/backendSync.js:380-491`), 읽기는 `has_brand_access(workspace_id, brand_id)`로 제한한다.
  - `utm_tracking_rows`: 읽기를 `has_brand_access`로 제한한다.
  - 같은 구간의 나머지 "Members can manage …" 정책(content_metric_snapshots, creator_profile_snapshots 등)도 쓰기에서 Client를 제외한다.
- 완료 조건: 새 마이그레이션 + `schema.sql` 반영. 정책 텍스트를 검사하는 테스트 추가(`tests/access-control.test.mjs` 방식 참고). 기존 자동 저장이 Owner/Admin 계정에서 계속 동작한다.

### SEC-2. 전역 정의 행을 비멤버가 수정할 수 없게 한다

- 위치: `supabase/schema.sql:987-991, 1009-1021`
- 현상: `raw_data_sources`, `metric_definitions`, `metric_definition_versions`의 `for all` 정책이 `workspace_id is null or is_workspace_member(...)`다. 가입만 한 사용자도 `workspace_id is null`인 전역 행을 수정·삭제할 수 있다.
- 수정: 쓰기 정책에서 `workspace_id is null or` 분기를 제거한다. 읽기 정책의 분기는 유지한다.
- 완료 조건: 마이그레이션 + `schema.sql` 반영, 정책 텍스트 테스트.

### SEC-3. 발송 수신자 형식 검증과 헤더 주입 차단

- 위치: `server/index.js:5104-5121`(`buildGmailRawMessage`), `:5314-5324`(`normalizeOutreachDeliveryItem`), `:2280`(단건 경로)
- 현상: 수신자를 trim·소문자화만 한다. `a@x.com, optout@y.com`이나 `\r\nBcc: …`가 든 값이 그대로 `To:` 헤더에 들어간다. 수신거부 조회(`getOutreachRecipientBlocks`, `:5326`)는 정확 일치라 걸리지 않고, 일일 한도도 1건으로만 센다.
- 수정:
  - `normalizeOutreachDeliveryItem`과 단건 경로에서 `isValidOutreachEmail`(`server/outreachSuppression.js`)로 검증하고 실패 시 400.
  - `isValidOutreachEmail`의 정규식을 단일 주소만 허용하도록 강화한다(`,` `;` `<` `>` 및 제어문자 거부).
  - `buildGmailRawMessage`에서 `to`에 CR/LF가 있으면 예외를 던진다(이중 방어).
- 완료 조건: 쉼표 구분 다중 주소, CRLF 포함 주소, `Name <a@b.com>` 형식이 400으로 거부되는 테스트(`tests/outreach-suppression.test.mjs`, `tests/outreach-route-regressions.test.mjs`).

### SEC-4. Admin의 Owner 승격·변경 차단

- 위치: `server/accessPolicy.js`(`prepareMemberAccessUpdate`), `server/index.js:1884-1988`, `supabase/schema.sql:847-850`
- 현상: Admin이 자신이나 타인을 Owner로 바꾸거나 Owner를 강등할 수 있다(마지막 Owner 보호만 있음).
- 수정: `prepareMemberAccessUpdate`에 요청자 역할 인자를 추가한다. 요청자가 Owner가 아니면 (a) 대상의 현재 역할이 Owner인 경우와 (b) 새 역할이 Owner인 경우를 403으로 거부한다. 라우트에서 `request.adminUser.role`을 넘긴다. DB 정책도 `workspace_members`의 Owner 행 변경과 Owner 역할 부여를 Owner만 하도록 좁힌다.
- 완료 조건: `tests/access-control.test.mjs`에 Admin→Owner 승격, Admin의 Owner 강등 거부 케이스.

### SEC-5. 로그아웃 시 로컬 민감 데이터 제거, Gmail 토큰을 사용자에 묶기

- 위치: `src/App.jsx:11475-11482`(`disconnectAuth`), `:11306`, `:15911`(토큰 저장), `:15887-15913`(`getFreshGmailAccessToken`), `:15941`(`disconnectGmail`), `:8112-8113`(로컬 계정 폴백), `:11035-11044`
- 현상:
  - 로그아웃해도 `creatorops.gmailAuth.v1`(gmail.send refresh token)과 워크스페이스 데이터가 localStorage에 남는다. 같은 브라우저의 다음 사용자가 이전 사용자 Gmail로 발송하게 되고, 권한 없는 브랜드 데이터가 메모리에 남는다.
  - `workspaceAccess`가 null(조회 실패·로딩 중)이면 로컬 `accounts`의 기본값 `acct-owner`로 폴백한다.
- 수정:
  - `disconnectAuth`에서 Gmail 키와 워크스페이스 저장 키를 지우고 상태를 초기화한다.
  - 저장하는 Gmail 인증 객체에 Supabase `user.id`를 넣고, 읽을 때 현재 세션 사용자와 다르면 폐기한다.
  - Supabase가 설정된 환경(`backendConfig.hasSupabase`)에서는 `workspaceAccess`가 없을 때 Owner로 폴백하지 않고 접근 없음으로 처리한다. Supabase 미설정 로컬 모드의 동작은 유지한다.
- 완료 조건: 로직을 순수 함수로 뽑아 테스트(사용자 불일치 시 토큰 폐기, 폴백 차단).
- 결정 필요: refresh token을 서버 보관(`provider_connections.token_ref`)으로 옮길지 여부. 이번 범위에서는 하지 않는다.

### SEC-6. 비용 발생 API의 역할 제한과 요청 제한

- 위치: `server/index.js:134-135`(`PROTECTED_API_PATHS`), `:969-1001`(`requireWorkspaceAccess`), `:2109`(`/tracking/refresh`)
- 현상: AI 생성·검색·스냅샷 수집이 활성 멤버 여부만 확인한다. Client 계정도 OpenAI·YouTube 쿼터를 쓸 수 있고 요청 수 제한이 없다.
- 수정: `/ai/*`, `/discovery/*`, `/references/search`, `/public/profile-snapshot`, `/tracking/refresh`에 역할 검사(Owner/Admin/Manager/Marketer, 읽기성 검색은 Analyst 포함)를 추가한다. OS 서비스 토큰 역할(`OSService`, `OSDiscoveryRead`)은 기존대로 통과시킨다. 사용자별 분당 요청 수 제한을 메모리 기반으로 추가한다(의존성 추가 없이).
- 완료 조건: Client 역할 403 테스트, 한도 초과 429 테스트.

### SEC-7. 인증 없는 진단 엔드포인트와 오류 메시지 노출

- 위치: `server/index.js:401-429`(`/data-room/status`), `:1818`(`/ai/policy-status`), `:2672-2682`(오류 핸들러)
- 현상: `/data-room/status`가 인증 없이 테이블 이름, 행 수(`count: 'exact'` 전체 카운트), DB 오류 메시지를 반환한다. 오류 핸들러는 500에서도 `error.message`를 그대로 내보낸다.
- 수정: `/data-room/status`에 `requireAdminWorkspaceAccess`, `/ai/policy-status`에 `requireWorkspaceAccess`를 건다. 프런트 호출부가 인증 헤더를 보내는지 확인해 맞춘다. 오류 핸들러는 status ≥ 500이면 고정 문구만 반환하고 원문은 서버 로그에 남긴다. `/health`, `/readiness`는 그대로 둔다(배포 점검 스크립트 `scripts/check-production.mjs`가 쓰는지 확인).
- 완료 조건: 미인증 401 테스트, 500 응답에 내부 메시지가 없는 테스트.

---

## P1 — 데이터 유실(동기화)

### SYNC-1. 내 브랜드 저장을 원격 변경으로 오인해 로컬 편집을 덮어쓰는 문제

- 위치: `src/App.jsx:11186-11199`(브랜드 워처), `:11207-11250`(브랜드 저장), `src/backendSync.js:786-813`(`watchBrandCloudWorkspaces`)
- 현상: 저장 성공 시 `brandCloudVersionsRef`만 갱신하고 `brandCloudSignatureRef`와 워처의 마지막 버전은 갱신하지 않는다. 다음 폴링이 항상 "updated"가 되어 `mergeBrandCloudWorkspaces`가 서버 사본으로 로컬을 덮고 `skipNextBrandCloudSaveRef`를 세운다. 마지막 저장 이후의 편집(디바운스 1초 + 지연, 연속 입력 중이면 그 전체)이 알림 없이 사라진다.
- 수정:
  - 저장 성공 시 서명도 갱신해 자기 저장은 원격 변경으로 보지 않게 한다.
  - 원격 변경을 병합할 때 저장 대기 중인 로컬 변경이 있으면 병합을 미루거나 충돌 상태로 전환한다. 조용히 덮어쓰지 않는다.
  - 전체 스냅샷 워처(`:11065-11086`)에도 같은 보호를 넣는다.
- 완료 조건: 판정 로직을 순수 함수로 분리해 테스트(자기 저장 후 폴링 → 병합 없음, 대기 중 편집 + 원격 변경 → 편집 보존).

### SYNC-2. 두 Owner/Admin 세션 간 저장 핑퐁과 거짓 충돌 (확인 필요)

- 위치: `src/App.jsx:11065-11141`, `:11207-11250`
- 현상(코드 추적, 미재현): 전체 워처는 `skipNextCloudSaveRef`만, 브랜드 워처는 `skipNextBrandCloudSaveRef`만 세워서 한쪽 병합이 다른 쪽 저장을 유발한다. 두 세션이 약 10초 주기로 번갈아 저장하거나, 변경이 없는데 `conflict`로 자동 저장이 멈춘다. 두 저장 effect가 `authSession` 객체에 의존해 토큰 갱신만으로도 저장이 발생한다.
- 수정: 병합 결과가 마지막 저장본과 내용상 같으면 저장하지 않게 한다(직렬화 비교 또는 해시). effect 의존성을 `authSession` 객체 대신 사용자 ID로 좁힌다.
- 완료 조건: 먼저 두 브라우저 세션으로 재현 여부를 보고한다. 재현되면 수정 + 테스트.

### SYNC-3. 여러 브랜드에 걸친 크리에이터가 옛 사본으로 되돌아가는 문제

- 위치: `shared/brandWorkspaceSnapshots.js:36-46`
- 현상: 병합이 `creatorMap.set(id, creator)`를 `brand_id` 순서로 수행해 마지막 브랜드의 사본이 수정 시각과 무관하게 이긴다. A에서 `actualPrice`를 900,000으로 고쳐도 B의 옛 500,000이 덮고, 다음 자동 저장으로 A에도 다시 써진다.
- 수정: 스냅샷의 `updated_at`이 더 최신인 쪽 사본이 이기게 한다. 호출부(`src/backendSync.js:609-619, 707-715`)가 `updated_at`을 넘기는지 확인해 맞춘다.
- 완료 조건: `tests/cross-device-workspace.test.mjs`에 "최신 브랜드 스냅샷의 크리에이터가 유지된다" 테스트.

### SYNC-4. 서버 일일 작업이 버전 확인 없이 스냅샷을 통째로 덮어쓰는 문제

- 위치: `server/index.js:1164-1212`(`runTrackingRefreshOperation`), `:1115-1152`(`runYouTubeRetentionOperation`)
- 현상: 스냅샷 전체를 읽고 외부 API를 최대 수십 건 호출한 뒤 무조건 UPDATE한다. 그 사이 사용자가 저장한 편집이 사라진다.
- 수정: `compareAndSwapSnapshot`(서버의 `server/companyOs.js`가 이미 쓰는 방식)으로 쓰고, 충돌 시 최신본을 다시 읽어 변경분(`trackedPosts`의 갱신된 항목, 보존 대상 필드)만 다시 적용해 최대 3회 재시도한다.
- 완료 조건: `tests/helpers/memorySupabase.mjs`를 써서 "읽기와 쓰기 사이에 다른 저장이 끼면 그 변경이 보존된다" 테스트.

### SYNC-5. 일일 추적 갱신이 50건에서 끊기는 문제

- 위치: `server/index.js:3973-3974`(`refreshTrackedPosts`의 `slice(0, 50)`), `:1185-1186`(`AUTOMATION_TRACKING_LIMIT` 기본 100)
- 현상: 배치는 최대 100건을 넘기지만 내부에서 앞 50건만 처리한다. 순환이 없어 51번째 이후는 영영 갱신되지 않는다. 또 50건을 `Promise.all`로 동시에 처리해, 인스타그램 게시물이 많으면 Chromium이 동시에 여러 개 뜬다(`:4406`).
- 수정: 배치 경로는 50건 단위로 나눠 순차 처리한다. 한도를 넘는 게시물은 마지막 갱신 시각이 오래된 순으로 골라 매일 순환되게 한다. 동시 실행 수를 제한한다(예: 5). `/tracking/refresh` API의 요청당 50건 상한은 유지하되 초과분은 잘라내지 말고 400으로 알린다.
- 완료 조건: 120건 입력 시 처리 대상 선택이 오래된 순이고 누락이 순환되는 테스트(`tests/operations-jobs.test.mjs`).

### SYNC-6. 저장 실패가 화면에 보이지 않는 문제

- 위치: `src/App.jsx:11225-11243`, `src/backendSync.js:753-762`, `:660-683`, `src/snapshotConcurrency.js:11-18`
- 현상: 브랜드 저장 결과가 `auth_required`/`forbidden`/`invalid`면 아무 처리도 없다. 세션이 만료돼도 배지는 "공유됨"이다. RLS에 막힌 UPDATE는 0행을 반환해 `conflict`로 잘못 보고된다. 파생 테이블 동기화 실패(`dataRoomRawSync`, `creatorOperationsSync`)도 화면에서 읽지 않는다.
- 수정: `conflict`·`saved` 외의 상태를 동기화 상태 배지에 오류로 표시하고 재로그인 등 다음 행동을 안내한다. 파생 테이블 동기화 실패도 같은 방식으로 드러낸다.
- 완료 조건: 상태 → 표시 매핑을 순수 함수로 분리해 테스트.

### SYNC-7. 파생 테이블 동기화가 "전체 삭제 후 재삽입"인 문제

- 위치: `src/backendSync.js:380-392`(`replaceWorkspaceGeneratedRows`), `:337-347`, `:402`
- 현상: 900ms 자동 저장마다 `creator_contact_points`, `creator_rates` 전체를 지우고 500행씩 다시 넣는다. 트랜잭션이 없어 중간 실패나 두 관리자 동시 저장 시 테이블이 비거나 중복된다. 앱에서 지운 UTM 로그는 `utm_tracking_rows`에서 지워지지 않는다. `brandId` 없는 크리에이터에는 저장하는 관리자의 활성 브랜드가 찍혀 저장마다 바뀐다.
- 수정: 결정적 ID(워크스페이스 + 크리에이터 + 구분)를 키로 한 upsert로 바꾸고, 현재 집합에 없는 행만 삭제한다. 필요한 유니크 제약은 마이그레이션으로 추가한다. `brandId`가 없으면 활성 브랜드를 찍지 말고 null로 둔다.
- 완료 조건: 같은 입력으로 두 번 실행해도 행 수가 같고, 중간 실패 시 기존 행이 남는 테스트.

### SYNC-8. 빈 컬렉션에 데모 데이터가 되살아나는 문제

- 위치: `src/App.jsx:1818-1831, 1886`(`normalizeWorkspace`)
- 현상: `saved.campaigns?.length ? saved.campaigns : defaultWorkspace.campaigns` 형태라, 저장된 워크스페이스의 캠페인·크리에이터·추천·브랜드가 0건이면 데모가 들어온다. 데모 캠페인(예산 4,200만/6,200만/2,800만)이 합계에 섞이고 클라우드에 저장된다.
- 수정: 저장본이 없을 때(`saved`가 null/undefined)만 데모를 쓰고, 배열이 존재하면 빈 배열이라도 그대로 쓴다.
- 완료 조건: 빈 배열 입력 → 빈 배열 유지 테스트.

### SYNC-9. 발굴 재검색이 담당자 입력값을 지우는 문제

- 위치: `src/App.jsx:12940-12950`, `:5596-5653`(`buildRealDiscoveryCreator`)
- 현상: `{ ...existing, ...creator, actualPrice, id }`로 병합해, 새 검색 결과의 빈 `contactEmail`, 기본값 `preferredContactChannel`, `engagement: 0`, `engagementVerified: false` 등이 기존 값을 덮는다.
- 수정: 새 결과의 값이 비어 있거나 기본값이면 기존 값을 유지하는 병합 함수를 만든다. 담당자 입력 필드(연락처, 선호 채널, 검증된 참여율, 실제 단가, 메모, 상태)는 항상 기존 값을 우선한다.
- 완료 조건: `tests/discovery-selection.test.mjs`에 병합 테스트.

### SYNC-10. ID 충돌

- 위치: `src/App.jsx:2013-2015`(`createId`), 사용처 `:2489, 5289, 10653, 10690, 10855, 10904, 12381, 13219, 14056` 등
- 현상: `Date.now() + Math.floor(Math.random() * 1000)`. 한 루프에서 여러 건을 만들면 겹친다(섭외 50건이면 약 70%). 겹치면 한 크리에이터의 메일 제목·본문이 다른 레코드에 저장되어 발송되고, 한 건의 발송 결과가 두 행에 표시된다. `createId() + creator.id`는 숫자 덧셈이라 해결이 안 된다.
- 수정: `createId()`를 충돌 없는 ID로 바꾼다(`crypto.randomUUID()`). 기존 저장 데이터의 숫자 ID와 `===` 비교가 섞여 있으므로, ID 비교가 문자열·숫자 혼용에도 동작하는지 사용처를 점검한다(`String(a) === String(b)`). 기존 데이터의 ID는 바꾸지 않는다.
- 완료 조건: 1만 건 연속 생성 시 중복 0 테스트. 기존 숫자 ID 데이터 로드 테스트가 계속 통과.

### SYNC-11. localStorage 쓰기 보호

- 위치: `src/App.jsx:1987-2000`(`usePersistentState`)
- 현상: effect 안의 `setItem`에 try/catch가 없고 에러 바운더리도 없다. 용량 초과(`QuotaExceededError`) 시 앱 전체가 내려간다. 탭 간 `storage` 이벤트도 듣지 않는다.
- 수정: `setItem`을 try/catch로 감싸고 실패 시 사용자에게 알린다. 최상위에 에러 바운더리를 추가한다. (탭 간 동기화는 이번 범위 아님.)
- 완료 조건: 쓰기 실패 시 예외가 전파되지 않는 테스트.

---

## P2 — 금액·성과 수치 오류

### NUM-1. 단가 미산정 크리에이터가 1만 원으로 표시되는 문제

- 위치: `src/App.jsx:13664-13671`, 합계 `:13708`
- 현상: `Math.max(1, Math.round(price / 10000))`이 0원을 1(만 원)로 만든다. 광고주용 목록과 합계에 들어간다.
- 수정: 단가가 0/미산정이면 해당 칸을 "협의"(같은 행의 라이선스 칸과 같은 표기)로 두고 합계에서 제외한다.
- 완료 조건: 단가 0 입력 → "협의", 합계 불포함 테스트.

### NUM-2. 발송 멘트 변경 시 확정 금액·수기 본문·발송 기록이 덮이는 문제

- 위치: `src/App.jsx:15737-15754`(`rebuildOutreachForMessageType`), 호출부 `:15756`, `:23637`, `:15849-15858`(`applyOutreachFixedOfferAmount`)
- 현상: 상태 확인 없이 `commercialTerms`를 다시 계산하고 제목·본문을 재생성한다. 확정한 고정 제안 금액이 자동 추정가로 돌아가고, 손으로 고친 본문과 이미 발송 완료된 건의 기록 본문도 다시 써진다. `applyOutreachFixedOfferAmount`는 반대로 선택된 프리셋을 되돌린다.
- 수정: 발송 완료·응답 등 발송 이후 상태의 건은 재생성 대상에서 제외한다. 사용자가 확정한 금액은 유지한다. `manualEdited`인 건은 덮어쓰기 전에 확인을 받는다. 금액 적용 시 기존 프리셋·채널을 유지한다.
- 완료 조건: 위 네 가지 각각의 테스트.

### NUM-3. 외부 리포트 행이 전 브랜드·캠페인 리포트를 대체하는 문제

- 위치: `src/App.jsx:9137-9143, 9184-9187`, `BRAND_SCOPED_ARRAY_KEYS`
- 현상: `externalReportRows`에 브랜드·캠페인 ID가 없고, 한 건이라도 있으면 `reportVideoRows`가 캠페인의 추적 게시물 대신 그 파일을 쓴다. 한 번 올리면 모든 브랜드·캠페인의 합계가 그 파일 수치가 된다.
- 수정: 업로드 시 행에 `brandId`, `campaignId`를 기록하고, 리포트는 현재 캠페인의 행만 쓴다. `externalReportRows`를 브랜드 범위 키에 추가한다. ID가 없는 기존 행은 어느 캠페인에도 자동 적용하지 않는다.
- 결정 필요: ID 없는 기존 행을 버릴지, 사용자가 캠페인을 지정하게 할지.
- 완료 조건: 캠페인 A에 올린 행이 캠페인 B 합계에 영향을 주지 않는 테스트.

### NUM-4. 외부 리포트 재업로드 시 갱신 안 됨·이중 합산

- 위치: `src/App.jsx:4808-4829`(`dedupeExternalReportRows`), 호출부 `:10426, 10608, 10826`
- 현상: 키가 원천·유형·URL·크리에이터·제목·시트명·행 번호이고 먼저 본 행이 이긴다. 같은 파일의 다음 주 버전을 올리면 새 수치가 버려지고, 행 순서가 바뀌면 같은 URL이 두 번 합산된다.
- 수정: 콘텐츠 식별(URL 우선, 없으면 크리에이터+제목)로 키를 잡고 가져온 시각이 최신인 행이 이기게 한다.
- 완료 조건: 같은 URL·높은 조회수 재업로드 → 최신 값 1건만 남는 테스트.

### NUM-5. 엑셀 열 매칭·숫자 해석 오류

- 위치: `src/App.jsx:4717-4729`(`getPayloadValue`), `:4731-4755`(`parseMetricNumber`, `parseRatePercent`)
- 현상:
  - 정확히 맞는 헤더가 없으면 별칭을 "포함"하는 첫 헤더를 쓴다. `er`이 "Followers"에, `id`가 "Video Title"에, `name`이 "Creator name"에 걸린다.
  - `parseRatePercent`는 1 이하 숫자에 100을 곱해 0.8(%)를 80%로 만든다.
  - `parseMetricNumber`의 `/m|million/`, `/k|thousand/`가 문자열 어디에나 걸려 "5 comments"가 500만, "300 KRW"가 30만이 된다.
- 수정: 부분 일치는 3글자 이상 별칭에 한해 단어 경계로만 허용한다. 단위 접미사는 숫자 바로 뒤에 붙은 경우만 인정한다(`^\s*[\d.,]+\s*(k|m|천|만|억)?\s*$` 형태). 비율은 열 전체를 보고 판단한다(모든 값이 1 이하이면 비율, 아니면 퍼센트).
- 완료 조건: 위 사례 각각의 테스트.

### NUM-6. 일괄 업로드 처리부의 깨진 한글 리터럴

- 위치: `src/App.jsx:10614-10744, 10831-10942`, `:1692, 1700`
- 현상: 한글 문자열이 `'???'`, `'?묐떟'` 등으로 깨져 있다(인코딩 손상). 한글 헤더(조회수·좋아요·댓글) 시트는 수치가 0으로 들어가고, 게시물 상태·제목·그룹명에 `'?? ???'` 같은 값이 저장된다. `buildOutreachTimeline`의 `'?묐떟'`, `'??쇅 ?꾨즺'` 비교는 절대 참이 되지 않는다.
- 수정: 파일 전체에서 깨진 리터럴을 찾아(`grep -n "'[^']*??[^']*'"` 및 `?묐떟` 류) 복원한다. 올바른 값은 같은 파일에서 정상 동작하는 원본 행 처리부(`:10590-10595`)의 헤더 별칭과 상태 상수("응답", "섭외 완료" 등)를 기준으로 한다. 뜻을 확정할 수 없는 문자열은 추측해 채우지 말고 목록으로 보고한다.
- 완료 조건: 한글 헤더 시트 업로드 시 조회수·좋아요·댓글이 정상 파싱되는 테스트. 소스에 `'???'` 형태 리터럴이 남지 않는다.

### NUM-7. 데모 성과 버튼이 실제 리포트를 오염시키는 문제

- 위치: `src/App.jsx:17169-17235`(`seedReportDemoData`), 버튼 `:21502`
- 현상: 확인 없이 가짜 게시물 4건(조회수 최대 132만, 전환 438)을 `trackedPosts`에 넣는다. `sourceType: 'demo'`를 걸러내는 곳이 없어 합계, KPI, 고객용 엑셀까지 들어간다.
- 수정: 운영 빌드에서는 버튼을 숨긴다(`import.meta.env.DEV` 또는 명시적 플래그). 그리고 `sourceType === 'demo'` 게시물은 리포트 합계와 모든 내보내기에서 제외한다.
- 완료 조건: demo 게시물이 합계·엑셀 행에서 빠지는 테스트.

### NUM-8. 성과 갱신이 알던 값을 null·빈 값으로 덮는 문제

- 위치: `shared/contentMetricHistory.js:26-34`(`recordContentMetrics`), 서버 `server/index.js:4035-4050, 4070-4083`
- 현상: `{...previous, ...measurement}`라서 YouTube 갱신이 보내는 `shares: null`, `saves: null`, 숨김 처리된 `likes: null`, `title: ''`, `status: 'refreshed'`가 기존 값을 덮는다.
- 수정: 지표 필드는 측정값이 null이면 기존 값을 유지한다. `title`은 빈 값이면 유지한다. 측정의 `status`는 게시물의 업무 상태 필드를 덮지 않게 별도 필드(예: `lastRefreshStatus`)에 둔다. 호출부가 `status === 'refreshed'`에 의존하는 곳(`server/index.js:1216`, 클라이언트 `refreshTracking`)을 함께 맞춘다.
- 추가: `contentMetricHistory`(`:16-24`)는 `at > now`인 점을 버리는데, `now`는 브라우저 시각이고 측정 시각은 서버 시각이다. 서버 시계가 조금만 빨라도 관측점이 누락된다. 허용 오차(예: 5분)를 둔다.
- 완료 조건: `tests/content-metric-history.test.mjs`에 null 보존, 상태 보존, 2초 앞선 측정 시각 보존 테스트.

### NUM-9. 예산 추천이 실제 집행액을 반영하지 않는 문제

- 위치: `src/campaignBudget.js:2-7`, 호출부 `src/App.jsx:8260, 13161, 18413, 20875`(`:21260`만 실제 집행액 전달)
- 현상: `budget - campaign.spend`를 쓰는데 사용자 생성 캠페인의 `spend`는 항상 0이다(`:14958`). 실제 집행액은 `getActualSpend(...)`에만 있다.
- 수정: 모든 호출부가 `getActualSpend` 결과를 넘기게 한다.
- 완료 조건: `tests/budget-recommendations.test.mjs`에 집행액 반영 테스트.

### NUM-10. 금액 문자열 파싱 불일치

- 위치: `src/performanceMetrics.js:5-7, 17-22`, `src/campaignBudget.js:2`, `shared/campaignQuote.js:4`, `src/App.jsx:15584, 15832`
- 현상: `'500,000'`이 NaN 또는 0이 되어 집행액·예산·견적에 퍼진다(`shared/creatorRates.js`의 `toCreatorRateNumber`만 쉼표를 처리). 입력 파싱은 `replace(/[^\d]/g, '')`라 `31500.5`가 315005, `80만`이 80이 된다.
- 수정: 금액 파싱 함수를 `shared/`에 하나 두고(쉼표, 소수점, `만`·`억` 단위 처리, 해석 불가 시 null) 위 위치에서 모두 쓴다.
- 추가(`src/App.jsx:15584`, `:13405`, `:21328`): 지급액을 입력하지 않으면 0으로 저장되어 리포트가 "실제 집행비 0원"으로 확정 표시한다. 미입력은 null로 저장해 "연결 필요"로 나오게 한다.
- 완료 조건: 파싱 함수 단위 테스트, 미입력 → "연결 필요" 테스트(`tests/report-workbook.test.mjs`).

### NUM-11. 리포트 게시일이 "미기재"로 나오는 문제

- 위치: `src/App.jsx:15505`, `src/reportWorkbook.js:8-12, 32`
- 현상: 수동 등록 시 `publishedAt: nowLabel()`("11월 25일 오후 01:49" 형식)을 저장해 `Date.parse`가 실패한다. 값 자체도 게시일이 아니라 등록 시각이다. 같은 시트의 `creators.find(c => c.id === post.creatorId)`는 문자열·숫자 ID가 섞이면 크리에이터명이 빈다.
- 수정: 게시일은 ISO 문자열로 저장하고, 모르면 비워 둔다(등록 시각은 별도 필드). ID 비교는 문자열로 통일한다.
- 완료 조건: `tests/report-workbook.test.mjs`에 테스트.

### NUM-12. AI 브리프 자동 설정의 반려견 하드코딩

- 위치: `src/App.jsx:5120-5133, 5170, 5244-5248, 5291`, 호출부 `:12544`
- 현상: `keywordHints`에 항상 `'반려견 이동장'`이 들어가고, 발굴 검색어는 항상 펫 키워드이며, 합성 후보 이름·핸들도 펫 채널이다. 다른 업종 브리프를 넣어도 같다.
- 수정: 하드코딩된 업종 문자열을 제거하고 브리프 본문에서 추출한 제품·카테고리 키워드로 대체한다. 추출이 안 되면 빈 값으로 두고 사용자 입력을 요청한다.
- 완료 조건: 스킨케어 브리프 입력 시 결과에 펫 관련 문자열이 없는 테스트.

### NUM-13. 추적 갱신의 날짜·범위 오류

- 위치: `src/App.jsx:8953-8974`, `:15657`, `:15694-15715`
- 현상:
  - 일자 키가 `toISOString().slice(0,10)`(UTC)이라 "하루"가 한국 시간 09시에 바뀐다.
  - 요청 전에 키를 먼저 기록해, 실패해도 그날은 다시 시도하지 않는다.
  - 선택된 캠페인의 게시물만 API로 보내면서 전체 `trackedPosts`에 `lastChecked`를 찍는다. 갱신하지 않은 다른 캠페인도 "방금 확인"으로 보인다.
- 수정: 일자 키는 KST 기준(`server/outreachPolicy.js`의 `getKstDayWindow`와 같은 방식). 키는 성공 후 기록. `lastChecked`는 실제로 보낸 게시물에만 기록.
- 완료 조건: 순수 함수로 분리해 테스트.

### NUM-14. 예시 판별이 실제 크리에이터를 숨기는 문제

- 위치: `src/operationalCandidates.js:3`(`isExampleCreator`), `src/trackingDestination.js:4, 14`
- 현상: `instagram.com/example.studio`, `@example`, `hello@example.co.kr`가 예시로 판정되어 운영 화면·견적·리포트 입력에서 빠진다. 반대로 `https://brand.example?utm=…`, `https://brand.example:8443/p`는 무효화 정규식에 안 걸려 자리표시자 로그가 활성으로 남는다.
- 수정: 예시 판별은 예약 도메인(`example.com/.org/.net`, `.example`, `.test`, `.invalid`)의 호스트 일치로만 한다. 두 파일의 판정을 같은 함수로 통일한다.
- 완료 조건: `tests/tracking-destination.test.mjs` 등에 위 사례 테스트.

---

## P3 — 발송 흐름

### OUT-1. 일괄 발송 전 확인

- 위치: `src/App.jsx:21890-21898` → `sendSelectedOutreachEmails`(`:16014`)
- 현상: 한 번 클릭으로 실제 메일이 최대 20통 나간다. 수신자 미리보기·확인이 없다.
- 수정: 발송 전 수신자 수와 주소 목록, 캠페인명을 보여주는 확인 단계를 넣는다(기존 수신거부 확인 `:16151`과 같은 방식).

### OUT-2. "발송 가능" 표시와 실제 발송 대상 통일

- 위치: `src/App.jsx:24600-24605`(`getCreatorContactEmail` 사용), `:8478`, `:16075`(`creator.contactEmail`만 사용)
- 현상: `businessEmail`·`publicEmail`·`email`만 있는 크리에이터는 "이메일 자동 발송 가능"으로 보이지만 배치에서 조용히 제외된다.
- 수정: 세 곳 모두 `getCreatorContactEmail`을 쓴다.
- 완료 조건: `businessEmail`만 있는 크리에이터가 발송 대상에 포함되는 테스트.

### OUT-3. 배치 발송 결과 정합

- 위치: 클라이언트 `src/App.jsx:16083-16126`, 서버 `server/index.js:2376-2512`
- 현상:
  - 배치는 최대 20건 × 10초 간격의 단일 HTTP 요청이다. 중간에 끊겨도 서버는 계속 보내고, 재시도는 전부 `skipped/duplicate`(이미 보낸 건은 `providerMessageId` 포함)로 돌아오는데 클라이언트는 이를 "중복 차단"으로만 세고 행을 "승인 대기"로 둔다.
  - 서버 catch(`:2466-2476`)의 `persistOutreachDelivery`에 `.catch`가 없어 DB 기록 실패 시 루프 전체가 500으로 끝나고, 이미 보낸 건의 결과도 반환되지 않는다(단건 경로 `:2346`은 `.catch` 있음).
  - 5xx·네트워크 오류 건은 DB에 `sending`으로 남아 재시도도 정리도 되지 않는다.
  - `src/App.jsx:16103`의 `/accessToken|token|401|invalid/i`가 "invalid" 등 무관한 실패 문구에도 걸려 Gmail 연결을 지운다.
- 수정:
  - 클라이언트: `duplicate`이면서 `providerMessageId`가 있는 결과는 발송 완료로 반영한다.
  - 서버: catch의 기록 실패를 잡아 해당 건만 `failed`로 돌리고 루프를 계속한다.
  - 서버: `sending` 상태로 일정 시간(예: 15분) 지난 행을 "수동 확인 필요"로 표시하는 조회를 정책 응답에 포함하거나, 관리자 화면에서 볼 수 있게 한다. 자동 재발송은 하지 않는다(중복 발송 방지 우선).
  - Gmail 연결 해제는 서버가 401을 반환한 경우(상태 코드 기준)로만 한정한다.
- 결정 필요: 배치를 단일 요청에서 "작업 생성 + 진행 조회" 방식으로 바꿀지. 이번 범위에서는 위 정합만 맞춘다.
- 완료 조건: `tests/outreach-route-regressions.test.mjs`에 기록 실패 시 나머지 결과 반환, 중복+providerMessageId 반영 테스트.

### OUT-4. 후속 메일이 "중복"으로 막히는 문제 (결정 필요)

- 위치: `src/App.jsx:16078`(`idempotencyKey: ${campaignId}:${creatorId}:email`), 서버 기본값 `server/index.js:5322`
- 현상: 캠페인당 크리에이터 1회만 발송된다. 내용을 고쳐 다시 보내거나 리마인드를 보내면 조용히 건너뛴다.
- 결정 필요: 의도된 정책이면 UI에 "이미 발송됨"을 명시한다. 후속 메일을 허용할 거면 키에 메시지 유형(1차/리마인드 등)을 넣는다.

### OUT-5. Gmail OAuth 코드 교환이 취소되는 문제 (확인 필요)

- 위치: `src/App.jsx:11252-11319`
- 현상(코드 추적, 미재현): effect가 `gmailClock`(60초 주기)과 `authSession?.access_token`에 의존한다. 토큰 교환 요청 중 둘 중 하나가 바뀌면 cleanup이 `cancelled`를 세워 성공 응답을 버린다. 일회용 코드와 state는 이미 소비되어 사용자는 아무 안내 없이 미연결 상태로 남는다.
- 수정: 교환을 한 번만 실행되게 하고(ref 가드), 응답 처리를 effect 재실행과 분리한다. `gmailClock`을 의존성에서 뺀다.

---

## P4 — 그 밖의 정리

- **MISC-1.** `deleteCampaign`(`src/App.jsx:14006-14020`)이 `quotes`, `creatorOperations`, `conversionEvents`, `candidatePoolEvidence`, `contentReferences`, `creatorGroups`, `contentTemplates`의 해당 캠페인 행을 남긴다. 함께 삭제한다.
- **MISC-2.** 후보 풀에서 크리에이터를 빼면 발송·응답 완료된 섭외 기록까지 브랜드 전체에서 지워진다(`src/App.jsx:12271-12279`, 확인 필요). 발송 이후 기록은 보존한다.
- **MISC-3.** 저장한 브랜드 모니터링 항목이 다음 로드에서 삭제된다(`src/App.jsx:3828-3831`, `:16596`). 브랜드 홈페이지 URL이 콘텐츠 URL 검증에 걸리기 때문이다. 모니터링 항목은 이 필터에서 제외한다.
- **MISC-4.** `creator.topics` 전개에 방어가 없다(`src/App.jsx:3396, 9049`). `normalizeCreator`에서 빈 배열로 기본값을 준다.
- **MISC-5.** 모니터링 브랜드의 크리에이터 수가 `items.length * 37`로 지어낸 값이다(`src/App.jsx:8577`). 실제 수를 쓰거나 표시를 없앤다.
- **MISC-6.** `rowsToTsv` 결과를 스프레드시트에 붙여넣을 때 `=`, `+`, `-`, `@`로 시작하는 값이 수식으로 해석될 수 있다. 앞에 `'`를 붙인다.
- **MISC-7.** 지식 URL 가져오기의 사설 주소 검사(`server/index.js:632-664`)가 DNS 조회 후 `fetch`에서 다시 조회한다. `server/osWebhooks.js`의 `deliverWebhook`처럼 검증한 주소에 고정한다.
- **MISC-8.** `requireCronAccess`(`server/index.js:1055-1068`)의 비밀값 비교를 `matchesSecret`(`server/integrationStore.js`)으로 바꾼다.
- **MISC-9.** `outreachDeliveryMemory`(`server/index.js:81`)가 무한히 커진다. 항목 수 상한 또는 만료를 둔다.
- **MISC-10.** `playwright`를 서버가 런타임에 `import('playwright')`로 쓰는데 `devDependencies`의 `@playwright/test`를 통해서만 들어온다(확인 필요). 배포 환경이 dev 의존성을 빼면 조용히 실패하므로 `dependencies`로 옮긴다.
- **MISC-11.** `AdminConsole`이 정책당 최대 20 × 120KB의 첨부 텍스트를 `workspace.adminConfig`에 넣어 매 자동 저장마다 스냅샷과 localStorage에 쓴다. 서버 설정(`workspaces.settings.aiFeatureConfigs`)에 이미 저장되므로 로컬 상태에는 메타데이터만 둔다.

---

## 손대지 않을 것

검토 결과 정상으로 확인된 부분이다. 관련 작업 중에도 동작을 바꾸지 않는다.

- 견적 계산과 엑셀 수식(`shared/campaignQuote.js`, `src/mipingQuoteWorkbook.js`): 공급가·대행수수료·VAT·합계 일치.
- 엑셀 쓰기의 문자열 처리(`inlineStr` + XML 이스케이프).
- 웹훅 전송의 주소 고정(`server/osWebhooks.js`).
- 발송 중복 방지의 DB 선점(`server/outreachDelivery.js`의 `claimDelivery`).
- OAuth state 검증(`src/App.jsx:11262-11275`), `matchesSecret`, `compareAndSwapSnapshot`.

## 권장 진행 순서

1. SEC-1, SEC-2, SEC-3, SEC-4 (DB 정책과 서버 검증, 범위가 작고 위험이 큼)
2. SYNC-1, SYNC-3, SYNC-4, SYNC-10 (데이터 유실의 주된 원인)
3. NUM-1, NUM-6, NUM-7, NUM-8 (고객에게 나가는 수치)
4. OUT-1, OUT-2, OUT-3
5. 나머지 P0–P3, 그다음 P4
