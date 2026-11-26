# 이메일 발송 작업과 진행 조회

선택 수신자 확인 → 작업 등록 → 백그라운드 순차 발송 → 진행 상황 조회 순서입니다.
실제 발송 전에 기존 캠페인·역할 권한, 수신 거부, 캠페인별 일일 50건 한도와 수신자별 중복 방지를 그대로 적용합니다.
한 작업은 최대 20건이며 기존 발송 간격을 유지합니다.

| 요청 | 보내는 값 | 결과 |
|---|---|---|
| POST /outreach/jobs | Bearer 운영 로그인, workspaceId, Gmail accessToken, items | 202와 작업 id. 저장이 실패하면 발송하지 않음 |
| GET /outreach/jobs/:id | Bearer 운영 로그인과 작업 id | 상태, 요청·처리 건수, 항목별 결과, 발송 정책 |
| GET /outreach/jobs | Bearer 운영 로그인 | 현재 사용자의 최근 작업. 다른 PC에서도 조회 가능 |
| POST /outreach/jobs/:id/close | Bearer 운영 로그인, confirmed: true | 15분 이상 중단된 작업만 수동 종료. 재발송하지 않음 |

items는 기존 발송 API의 id, campaignId, creatorId, to, subject, message, idempotencyKey를 사용합니다.
작업 조회도 연결된 모든 캠페인의 브랜드 권한을 확인합니다. 작업 저장소를 클라이언트가 직접 수정하지 않습니다.

작업 상태는 queued, running, completed, completed_with_errors, failed, manual_check_required, closed_after_manual_review입니다.
브라우저를 닫거나 새로고침해도 서버는 작업을 계속합니다. 메시지 화면의 ‘최근 발송 진행 상황 조회’는 메일을 다시 보내지 않습니다.
서버가 재시작되면 Gmail 토큰을 보관하지 않았으므로 작업을 자동 재실행하지 않습니다. 15분 넘게 진행 기록이 없는 작업은 Gmail 발송함에서 확인한 뒤 종료합니다.
Gmail 토큰·메일 본문은 작업 메타데이터나 브라우저 작업 번호 저장소에 기록하지 않습니다. 기존 발송 이력 저장은 유지합니다.

배포 전 `202611260004_outreach_background_jobs.sql`을 적용해야 합니다. 여러 서버가 같은 워크스페이스에서 동시에 새 발송 작업을 접수하는 것을 막는 고유 인덱스입니다.
현재 작업에서는 운영 DB에 적용하거나 실제 메일을 발송하지 않았습니다.
