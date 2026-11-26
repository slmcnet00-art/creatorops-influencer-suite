import { Radio } from 'lucide-react'
import { lazy } from 'react'
import './WorkspaceConnectionGate.css'

const AuthPortal = lazy(() => import('./AuthPortal.jsx'))

export default function WorkspaceConnectionGate({ authReady, session, accessError, membership, syncStatus, onSignOut }) {
  if (authReady && !session) return <AuthPortal initialMode="login" />

  const accessDenied = authReady && session && !accessError && membership?.status !== 'active'
  const error = accessError || (accessDenied ? '이 계정에는 팀 워크스페이스 접근 권한이 없습니다. 운영 관리자에게 계정과 브랜드 권한을 확인해 주세요.' : '')
    || (syncStatus?.mode === 'error' || syncStatus?.mode === 'auth' ? syncStatus.detail : '')

  return (
    <main className="workspace-connection-page">
      <section className="workspace-connection-card" aria-live="polite">
        <span className="workspace-connection-brand"><Radio size={22} /> CreatorOps</span>
        <h1>{error ? '공유 데이터를 불러오지 못했습니다' : '팀 공유 데이터를 불러오고 있습니다'}</h1>
        <p>{error || '로그인과 브랜드 접근 권한을 확인한 뒤 저장된 캠페인과 후보 그룹을 불러옵니다.'}</p>
        {session?.user?.email && <small>현재 로그인: {session.user.email}</small>}
        {error && (
          <div className="workspace-connection-actions">
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>다시 불러오기</button>
            <button type="button" className="secondary-button" onClick={onSignOut}>다른 계정으로 로그인</button>
          </div>
        )}
      </section>
    </main>
  )
}
