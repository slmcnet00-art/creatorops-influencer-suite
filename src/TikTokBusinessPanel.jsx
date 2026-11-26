import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { validateTikTokAuthorizationLink } from './tiktokAuthorizationLink.js'
import './TikTokBusinessPanel.css'

export default function TikTokBusinessPanel({ apiBaseUrl, accessToken }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(''), [links, setLinks] = useState({})
  const [confirmed, setConfirmed] = useState({})
  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setLoading(true); setError(''); setData(null); setLinks({}); setConfirmed({})
      if (!apiBaseUrl || !accessToken) throw Error('관리자 로그인과 운영 API 연결이 필요합니다.')
      const response = await fetch(`${apiBaseUrl}/admin/tiktok-business/status`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
      const body = await response.json()
      if (!response.ok) throw Error(body.message || 'TikTok 연결 상태를 확인하지 못했습니다.')
      if (!controller.signal.aborted) setData(body.data)
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [apiBaseUrl, accessToken, refresh])

  async function prepare(kind) {
    if (busy || !confirmed[kind]) return
    setBusy(kind); setError(''); setLinks(current => ({ ...current, [kind]: '' }))
    try {
      const response = await fetch(`${apiBaseUrl}/oauth/tiktok/${kind}/auth-url`, { headers: { Authorization: `Bearer ${accessToken}` } })
      const body = await response.json()
      if (!response.ok) throw Error(body.message || '승인 링크를 준비하지 못했습니다.')
      const expected = kind === 'advertiser' ? data.registration.advertiserRedirectUrl : data.registration.accountRedirectUrl
      const url = validateTikTokAuthorizationLink(body.data.url, kind, expected)
      setLinks(current => ({ ...current, [kind]: url }))
    } catch (error) { setError(error.message) }
    finally { setBusy('') }
  }

  return <div className="admin-page tiktok-business-panel">
    <section className="admin-band">
      <div className="admin-section-heading"><div><span>TIKTOK CONNECTION</span><h2>TikTok 계정 연결</h2><p>서버 키 등록과 계정 소유자의 승인을 구분해 확인합니다.</p></div>
        <button className="secondary-button" type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading || Boolean(busy)}><RefreshCw size={16} /> 상태 새로고침</button>
      </div>
      {loading && <p role="status">연결 상태 확인 중…</p>}
      {error && <p role="alert">{error}</p>}
      {data && <>
        <p><strong>서버 키 등록: {data.configured ? '완료' : '설정 필요'}</strong> · 인증 정보 저장 {data.connections.length}건</p>
        <p>키 등록만으로 TikTok 권한 승인이나 데이터 수집이 완료되지는 않습니다. 승인된 계정과 권한 범위 안에서만 사용할 수 있습니다.</p>
        <div className="tiktok-connection-grid">
          {[['advertiser', '광고주 계정', '광고주가 승인한 계정과 권한의 인증 정보를 저장합니다.', data.configured], ['account', 'TikTok 계정 소유자', '본인 TikTok 계정의 승인된 정보·콘텐츠 범위를 연결합니다.', data.accountAuthorizationReady]].map(([kind, title, description, ready]) => <article className="tiktok-connection-card" key={kind}>
            <h3>{title}</h3><p>{description}</p>
            <p>TikTok 포털에 저장할 인증 완료 주소</p><code className="tiktok-redirect-value">{kind === 'advertiser' ? data.registration.advertiserRedirectUrl : data.registration.accountRedirectUrl}</code>
            <label className="tiktok-redirect-confirm"><input type="checkbox" disabled={!ready || Boolean(busy)} checked={Boolean(confirmed[kind])} onChange={event => setConfirmed(current => ({ ...current, [kind]: event.target.checked }))} />{title} 인증 주소를 TikTok 포털에 저장했습니다.</label>
            <button className="primary-button" type="button" disabled={!ready || !confirmed[kind] || Boolean(busy)} onClick={() => prepare(kind)}>{busy === kind ? '승인 링크 준비 중…' : kind === 'advertiser' ? '광고주 연결 준비' : 'TikTok 계정 연결 준비'}</button>
            {!ready && <p>{kind === 'account' ? '승인된 계정 권한 범위를 서버에 설정한 후 연결할 수 있습니다.' : '앱 ID와 Secret의 서버 등록이 필요합니다.'}</p>}
            {links[kind] && <div role="status"><a href={links[kind]} target="_blank" rel="noopener noreferrer">TikTok에서 승인 화면 열기 <ExternalLink size={14} /></a><p>승인은 TikTok 화면에서 직접 진행하세요. 링크는 10분 동안 유효하며, 만료되면 다시 준비하세요.</p></div>}
          </article>)}
        </div>
        {data.connections.length > 0 && <section><h3>저장된 인증</h3><ul>{data.connections.map(item => <li key={item.id}>{item.kind === 'advertiser' ? '광고주 계정' : 'TikTok 계정'} · {item.connectedAt ? new Date(item.connectedAt).toLocaleString('ko-KR') : '시각 미확인'}{item.expiresAt ? ` · 만료 예정 ${new Date(item.expiresAt).toLocaleString('ko-KR')}` : ''}</li>)}</ul><p>인증 후 이 화면에서 상태를 새로고침하세요. 실제 수집 API의 접근 가능 여부는 별도 확인이 필요합니다.</p></section>}
        <details><summary>앱 등록 주소 확인</summary><dl>{[['앱 아이콘 PNG', data.registration.appIconUrl], ['광고주 인증 완료 주소', data.registration.advertiserRedirectUrl], ['계정 소유자 인증 완료 주소', data.registration.accountRedirectUrl]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd><a href={value} target="_blank" rel="noreferrer">{value}</a></dd></div>)}</dl></details>
      </>}
    </section>
  </div>
}
