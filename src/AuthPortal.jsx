import { useState } from 'react'
import { ArrowRight, CheckCircle2, KeyRound, Mail, Radio, ShieldCheck, UsersRound } from 'lucide-react'
import {
  requestPasswordReset,
  signInWithEmail,
  signInWithPassword,
  signUpWithPassword,
} from './backendSync'
import './AuthPortal.css'

function go(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function AuthPortal({ initialMode = 'login', configured = true, onAuthenticated }) {
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({
    fullName: '',
    companyName: '',
    email: '',
    password: '',
    passwordConfirm: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!configured) {
      setError('인증 서버 설정이 필요합니다. 운영 관리자에게 문의해 주세요.')
      return
    }
    if (!form.email.trim() || !form.password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }
    if (mode === 'signup' && form.password !== form.passwordConfirm) {
      setError('비밀번호가 서로 일치하지 않습니다.')
      return
    }
    if (mode === 'signup' && form.password.length < 8) {
      setError('비밀번호는 8자 이상으로 입력해 주세요.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        const result = await signUpWithPassword({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          companyName: form.companyName.trim(),
        })
        if (result.needsEmailConfirmation) {
          setMode('check-email')
          setMessage(`${form.email.trim()}로 인증 메일을 보냈습니다.`)
        } else {
          onAuthenticated?.(result.session)
          go('/')
        }
      } else {
        const result = await signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        })
        onAuthenticated?.(result.session)
        go('/')
      }
    } catch (submitError) {
      setError(submitError.message || '인증 처리 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const sendMagicLink = async () => {
    if (!form.email.trim()) {
      setError('이메일을 먼저 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await signInWithEmail(form.email.trim())
      setMode('check-email')
      setMessage(`${form.email.trim()}로 로그인 링크를 보냈습니다.`)
    } catch (linkError) {
      setError(linkError.message || '로그인 링크를 보내지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (!form.email.trim()) {
      setError('가입한 이메일을 먼저 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await requestPasswordReset(form.email.trim())
      setMessage('비밀번호 재설정 메일을 보냈습니다.')
    } catch (resetError) {
      setError(resetError.message || '재설정 메일을 보내지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = () => {
    const next = mode === 'signup' ? 'login' : 'signup'
    setMode(next)
    setError('')
    setMessage('')
    go(`/${next}`)
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <span><Radio size={18} /></span>
          CreatorOps
        </div>
        <div className="auth-story-copy">
          <p className="auth-eyebrow">INFLUENCER OPERATIONS</p>
          <h1>브랜드와 크리에이터의 협업을 한곳에서 운영하세요.</h1>
          <p>캠페인 생성부터 발굴, 후보 그룹, 메시지, 성과 추적까지 같은 팀이 동일한 데이터를 봅니다.</p>
        </div>
        <div className="auth-proof-list">
          <div><UsersRound size={18} /><span>브랜드별 팀 워크스페이스</span></div>
          <div><ShieldCheck size={18} /><span>계정 등급과 브랜드 접근 권한</span></div>
          <div><CheckCircle2 size={18} /><span>데이터룸 기반 운영 기록</span></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {mode === 'check-email' ? (
            <div className="auth-confirmation">
              <span className="auth-confirmation-icon"><Mail size={24} /></span>
              <p className="auth-eyebrow">EMAIL VERIFICATION</p>
              <h2>이메일을 확인해 주세요</h2>
              <p>{message}</p>
              <p className="auth-muted">
                이메일 인증 후 로그인하면 관리자 승인 대기 화면으로 이동합니다.
                관리자가 브랜드와 역할을 배정하면 해당 워크스페이스를 함께 볼 수 있습니다.
              </p>
              <button type="button" className="auth-primary" onClick={() => setMode('login')}>
                로그인으로 돌아가기 <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <p className="auth-eyebrow">{mode === 'signup' ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</p>
              <h2>{mode === 'signup' ? 'CreatorOps 시작하기' : '로그인'}</h2>
              <p className="auth-intro">
                {mode === 'signup'
                  ? '계정을 만든 뒤 이메일 인증과 관리자 승인을 완료해 주세요.'
                  : '팀에서 사용하는 업무용 계정으로 로그인하세요.'}
              </p>

              <form onSubmit={submit}>
                {mode === 'signup' && (
                  <div className="auth-grid">
                    <label>
                      <span>이름</span>
                      <input value={form.fullName} onChange={update('fullName')} autoComplete="name" required />
                    </label>
                    <label>
                      <span>회사/팀</span>
                      <input value={form.companyName} onChange={update('companyName')} autoComplete="organization" required />
                    </label>
                  </div>
                )}
                <label>
                  <span>이메일</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={update('email')}
                    autoComplete="email"
                    placeholder="name@company.com"
                    required
                  />
                </label>
                <label>
                  <span>비밀번호</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={update('password')}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder="8자 이상"
                    required
                  />
                </label>
                {mode === 'signup' && (
                  <label>
                    <span>비밀번호 확인</span>
                    <input
                      type="password"
                      value={form.passwordConfirm}
                      onChange={update('passwordConfirm')}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                )}
                {error && <p className="auth-error">{error}</p>}
                {message && <p className="auth-message">{message}</p>}
                <button className="auth-primary" type="submit" disabled={busy}>
                  {busy ? '처리 중...' : mode === 'signup' ? '계정 만들기' : '로그인'}
                  {!busy && <ArrowRight size={17} />}
                </button>
              </form>

              {mode === 'login' && (
                <div className="auth-secondary-actions">
                  <button type="button" onClick={sendMagicLink} disabled={busy}>
                    <Mail size={15} /> 이메일 링크로 로그인
                  </button>
                  <button type="button" onClick={resetPassword} disabled={busy}>
                    <KeyRound size={15} /> 비밀번호 재설정
                  </button>
                </div>
              )}
              <div className="auth-switch">
                {mode === 'signup' ? '이미 계정이 있나요?' : '처음 사용하시나요?'}
                <button type="button" onClick={switchMode}>
                  {mode === 'signup' ? '로그인' : '회원가입'}
                </button>
              </div>
            </>
          )}
        </div>
        <p className="auth-legal">가입하면 서비스 이용약관과 개인정보처리방침에 동의하게 됩니다.</p>
      </section>
    </main>
  )
}
