# CreatorOps Workflow Specification

이 문서는 CreatorOps Influencer Suite의 업무 흐름, 데이터 구조, GitHub 게시 절차를 정리한 문서입니다.

## 목표

브랜드가 원하는 조건에 맞춰 AI가 인플루언서 후보를 찾고, 추천 이유와 페르소나를 기록하며, 자동/수동 섭외를 분류하고, 콘텐츠 업로드 후 성과 데이터를 추적해 보고서로 다운로드할 수 있는 시스템을 만든다.

## 주요 사용자 흐름

### 1. 브랜드 조건 설정

운영자는 다음 값을 입력한다.

- 브랜드명
- 제품 또는 서비스
- 타깃 페르소나
- 포함 키워드
- 제외 키워드
- 선호 플랫폼
- 선호 카테고리
- 최소 팔로워
- 최대 협업 단가

### 2. AI 후보 추천

앱은 저장된 인플루언서 후보 데이터에서 브랜드 조건과 맞는 후보를 점수화한다.

기록되는 값:

- 추천 점수
- 추천 페르소나
- 추천 이유
- 리스크 또는 검토 포인트
- 메시지 초안
- 연결 캠페인

### 3. 자동/수동 섭외 분류

섭외 큐는 두 종류로 분리된다.

- 자동 섭외: AI 추천 결과에서 `메시지 큐`를 누르면 생성
- 수동 섭외: 크리에이터 상세에서 직접 `제안 보내기`를 누르면 생성

상태 흐름:

```text
승인 대기 -> 발송 완료 -> 응답 -> 섭외 완료
```

### 4. 섭외 완료 풀

응답 또는 발송 완료 상태의 섭외를 `섭외 완료 저장`하면 별도 풀에 저장된다.

저장되는 값:

- 인플루언서
- 캠페인
- 자동/수동 출처
- 섭외 완료 상태
- 저장 사유 또는 추천 이유
- 저장 시점

### 5. 콘텐츠 성과 추적

콘텐츠가 업로드되면 다음 값을 기록한다.

- 캠페인
- 인플루언서
- 플랫폼
- 콘텐츠 제목
- 콘텐츠 URL
- 조회수
- 좋아요
- 댓글
- 공유
- 저장
- 전환 수
- 마지막 확인 시점

### 6. 보고서 다운로드

앱은 다음 보고서를 다운로드한다.

- 캠페인 CSV
- 성과 CSV
- HTML 성과 보고서
- 전체 워크스페이스 JSON 백업

## 데이터 저장 방식

현재 MVP는 브라우저 `localStorage`에 저장한다.

저장 키:

```text
creatorops.workspace.v2
```

주요 데이터 컬렉션:

- `brandBrief`
- `creators`
- `campaigns`
- `recommendations`
- `outreach`
- `recruitedPool`
- `trackedPosts`
- `quotes`
- `activities`

## 실제 외부 연동 시 필요한 것

현재 앱은 로컬 MVP이며, 외부 플랫폼으로 실제 검색/발송/성과 수집을 하려면 다음 연동이 필요하다.

- OpenAI API: 후보 탐색, 추천 이유 생성, 메시지 초안 생성
- YouTube Data API: 채널/영상 검색, 조회수/댓글/좋아요 수집
- Instagram Graph API: 비즈니스/크리에이터 계정 기반 콘텐츠 데이터 수집
- TikTok for Business 또는 승인된 API: 콘텐츠 성과 수집
- 이메일 또는 메시징 발송 API: 실제 제안 발송
- 서버/DB: 팀 단위 저장, 스케줄러, 인증, 감사 로그

## GitHub에 저장하는 방법

현재 프로젝트 폴더는 Git 저장소지만 원격 저장소가 아직 연결되어 있지 않다.

GitHub CLI 로그인:

```bash
gh auth login
```

새 공개 저장소 생성 후 푸시:

```bash
gh repo create creatorops-influencer-suite --public --source . --remote origin --push
```

이미 만든 저장소에 연결:

```bash
git remote add origin https://github.com/USER/REPO.git
git push -u origin master
```

게시 후 README는 GitHub 저장소 첫 화면에서 바로 확인할 수 있고, 이 문서는 아래 경로로 접근할 수 있다.

```text
https://github.com/USER/REPO/blob/master/CREATOROPS_WORKFLOW.md
```
