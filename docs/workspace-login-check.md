# 공유 워크스페이스 로그인 회귀 확인

운영 환경에 Supabase가 설정되어 있으면 로그인/권한 확인 및 전체·브랜드 공유 데이터 로딩을 마친 뒤 운영 화면을 표시한다. 로그아웃·권한 없음·연결 오류 상태에서 예시 브랜드/후보 그룹을 표시하지 않는다. 기존 브라우저 저장 데이터는 삭제하지 않는다. 로컬 미설정 환경 및 기존 YouTube 심사 화면은 유지한다.

`scripts/test-workspace-login.py`는 실제 App과 Supabase 클라이언트를 실행하며 인증·REST 요청을 테스트 브라우저에서 모두 가로챈다. 실제 계정/비밀번호/DB를 사용하지 않는다. Python Playwright 설치가 필요하다.

PowerShell에서 별도 터미널로 테스트 Vite 서버 실행:

```powershell
$env:VITE_SUPABASE_URL='https://workspace-test.supabase.co'
$env:VITE_SUPABASE_ANON_KEY='public-fixture-key'
$env:VITE_WORKSPACE_ID='test-workspace'
$env:VITE_CREATOROPS_API_BASE_URL=''
npm run dev -- --host 127.0.0.1 --port 5198 --strictPort
```

다른 터미널에서 `python scripts/test-workspace-login.py` 실행. 로그아웃, 정상 로그인 후 공유 그룹 및 새로고침, 권한 없음, DB 오류, 빈 그룹에 예시가 재등장하지 않는지 확인한다. 운영 로그인은 실제 계정으로 별도 확인해야 한다.
