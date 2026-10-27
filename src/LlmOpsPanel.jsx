import DecisionMemoryPanel from './DecisionMemoryPanel.jsx'
import { useEffect, useMemo, useState } from 'react'
import { Activity, RefreshCw, Search } from 'lucide-react'
import './LlmOpsPanel.css'

const features = [['creator-recommendation', '인플루언서 추천'], ['campaign-strategy', '캠페인 전략'], ['content-guide', '콘텐츠 가이드'], ['outreach-message', '섭외 문구']]
const count = n => Number(n || 0).toLocaleString('ko-KR')
const money = n => `$${Number(n || 0).toFixed(6)}`
export default function LlmOpsPanel({ apiBaseUrl, accessToken }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const [feature, setFeature] = useState(''), [status, setStatus] = useState(''), [refresh, setRefresh] = useState(0)
  const [detail, setDetail] = useState(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const [pricing, setPricing] = useState({ model: '', input: '', cachedInput: '', output: '' })
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ feature, status })
    Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      setLoading(true); setError(''); setData(null)
      return fetch(`${apiBaseUrl}/admin/llm-ops?${query}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
    })
      .then(async r => { const body = await r.json(); if (!r.ok) throw Error(body.message || 'LLM 운영 이력을 불러오지 못했습니다.'); return body.data })
      .then(value => {
        if (controller.signal.aborted) return
        setData(value)
        setPricing(current => current.model ? current : { model: value.model, input: value.pricing?.[value.model]?.input ?? '', cachedInput: value.pricing?.[value.model]?.cachedInput ?? '', output: value.pricing?.[value.model]?.output ?? '' })
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [accessToken, apiBaseUrl, feature, status, refresh])
  const versions = useMemo(() => {
    const map = new Map()
    for (const row of data?.runs || []) {
      const key = `${row.featureKey}:${row.policyVersion}:${row.model}`
      const group = map.get(key) || { feature: row.featureKey, version: row.policyVersion, model: row.model, count: 0, failed: 0 }
      group.count++; if (row.state === 'failed') group.failed++
      map.set(key, group)
    }
    return [...map.values()]
  }, [data])
  async function request(path, options = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers })
    const body = await response.json()
    if (!response.ok) throw Error(body.message || body.error || '요청에 실패했습니다.')
    return body.data
  }
  async function inspect(id) {
    setBusy(true); setNotice(''); setDetail(null)
    try { setDetail(await request(`/admin/llm-ops/runs/${id}`)) }
    catch (error) { setNotice(error.message) }
    finally { setBusy(false) }
  }
  async function retry() {
    if (!window.confirm('기존 입력과 정책 버전으로 모델을 다시 호출합니다. 추가 비용이 발생할 수 있습니다. 실행할까요?')) return
    setBusy(true); setNotice('')
    try {
      const result = await request(`/admin/llm-ops/runs/${detail.id}/retry`, { method: 'POST', body: JSON.stringify({ confirm: true }) })
      setNotice('재실행을 기록했습니다. 결과는 캠페인에 자동 적용되지 않습니다.')
      setDetail(current => ({ ...current, retryOutput: result.output })); setRefresh(n => n + 1)
    } catch (error) { setNotice(error.message); setRefresh(n => n + 1) }
    finally { setBusy(false) }
  }
  async function savePricing(event) {
    event.preventDefault(); setBusy(true); setNotice('')
    try {
      await request('/admin/llm-ops/pricing', { method: 'PUT', body: JSON.stringify({ model: pricing.model || data?.model,
        input: Number(pricing.input), output: Number(pricing.output), cachedInput: Number(pricing.cachedInput) }) })
      setNotice('요율을 저장했습니다. 이후 호출부터 해당 요율로 비용을 추정합니다.'); setRefresh(n => n + 1)
    } catch (error) { setNotice(error.message) }
    finally { setBusy(false) }
  }
  const summary = data?.summary
  return <div className="admin-page llm-ops">
    <DecisionMemoryPanel apiBaseUrl={apiBaseUrl} accessToken={accessToken} sourceRun={detail} />
    <section className="admin-band">
      <div className="admin-section-heading"><div><span>LLM OPERATIONS</span><h2>AI 호출·사용량·오류</h2><p>앞으로 발생하는 서버 AI 호출을 기록합니다. 기존 기록을 소급 생성하지 않습니다.</p></div>
        <button className="admin-secondary" disabled={loading || busy} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={16} /> 새로고침</button></div>
      <div className="llm-filters"><label>기능<select value={feature} onChange={e => setFeature(e.target.value)}><option value="">전체 기능</option>{features.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>상태<select value={status} onChange={e => setStatus(e.target.value)}><option value="">전체 상태</option><option value="success">성공</option><option value="failed">실패</option><option value="partial">진행·결과 확인 필요</option></select></label></div>
      {loading && <p role="status">호출 이력을 불러오고 있습니다.</p>}
      {error && <p role="alert" className="llm-error">{error}</p>}
      {notice && <p role="status" className="llm-notice">{notice}</p>}
      {summary && <><div className="llm-cards">
        <article><span>조회 범위 호출</span><strong>{count(summary.count)}건</strong><small>성공 {count(summary.success)} · 실패 {count(summary.failed)} · 진행 {count(summary.running)}</small></article>
        <article><span>입력 / 출력 토큰</span><strong>{count(summary.inputTokens)} / {count(summary.outputTokens)}</strong></article>
        <article><span>평균 처리시간</span><strong>{summary.averageDurationMs == null ? '기록 없음' : `${(summary.averageDurationMs / 1000).toFixed(1)}초`}</strong></article>
        <article><span>입력 요율 기준 추정비용</span><strong>{!summary.count ? '기록 없음' : summary.unpricedCount === summary.count ? '비용 미산정' : money(summary.estimatedCostUsd)}</strong><small>비용 미산정 {count(summary.unpricedCount)}건 · 실제 청구액과 다를 수 있음</small></article>
      </div><p className="llm-note">선택 조건에 맞는 최근 최대 {data.summaryLimit}건 집계 · 목록 최대 {data.displayedLimit}건. 응답에 기록된 사용량만 합산하며, 사용량 미확인 {count(summary.unknownUsageCount)}건입니다. 중단된 호출은 진행·결과 확인 필요로 남을 수 있습니다.</p></>}
      {!loading && data && !data.runs.length && <div className="admin-empty"><Activity />아직 기록된 AI 호출이 없습니다. 전략·가이드·섭외 문구 등을 생성하면 여기에 표시됩니다.</div>}
      {!!data?.runs.length && <div className="llm-table-scroll"><table><thead><tr><th>시간</th><th>기능 / 정책</th><th>모델</th><th>상태</th><th>입력 / 출력 토큰</th><th>시간 / 추정비용</th><th>확인</th></tr></thead><tbody>
        {data.runs.map(row => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString('ko-KR')}</td><td>{features.find(([id]) => id === row.featureKey)?.[1] || row.featureKey}<small>{row.policyVersion || '버전 없음'}</small></td><td>{row.model}</td>
          <td>{({ success: '성공', failed: '실패', running: '진행·확인 필요' })[row.state] || row.state}</td><td>{row.usage ? `${count(row.usage.inputTokens)} / ${count(row.usage.outputTokens)}` : '미기록'}</td>
          <td>{row.durationMs == null ? '-' : `${(row.durationMs / 1000).toFixed(1)}초`}<small>{row.estimatedCostUsd == null ? '비용 미산정' : money(row.estimatedCostUsd)}</small></td>
          <td><button className="admin-secondary" disabled={busy} onClick={() => inspect(row.id)}><Search size={14} /> 상세</button></td></tr>)}
      </tbody></table></div>}
    </section>
    {detail && <section className="admin-band llm-detail"><div className="admin-section-heading"><div><span>GENERATION #{detail.id}</span><h2>입력·출력 및 오류</h2><p>관리자 전용 암호화 기록 · 정책 {detail.policyVersion || '없음'}</p></div><button className="admin-secondary" onClick={() => setDetail(null)}>상세 닫기</button></div>
      <h3>참고한 운영 원칙</h3><p>{detail.decisionMemory?.rules?.length ? detail.decisionMemory.rules.map(r => `${r.caseId} (v${r.version})`).join(', ') : '승인 원칙 적용 없음'}</p><h3>입력</h3><pre>{detail.input}</pre><h3>출력</h3><pre>{detail.output || '출력 없음'}</pre>{detail.errorDetail && <p role="alert" className="llm-error">{detail.errorDetail}</p>}
      {detail.retryAvailable && <button className="admin-secondary" disabled={busy} onClick={retry}>실패 호출 재실행</button>}
      {detail.retryOutput && <><h3>재실행 결과 · 캠페인 자동 반영 없음</h3><pre>{detail.retryOutput}</pre></>}
    </section>}
    {!!versions.length && <section className="admin-band"><h2>기능·정책·모델별 운영 비교</h2><p>현재 표시된 목록 기준입니다. 서로 다른 입력을 포함하므로 동일 조건의 품질 평가를 의미하지 않습니다.</p><div className="llm-table-scroll"><table><thead><tr><th>기능</th><th>버전</th><th>모델</th><th>호출</th><th>실패</th></tr></thead><tbody>{versions.map((v, i) => <tr key={i}><td>{v.feature}</td><td>{v.version}</td><td>{v.model}</td><td>{v.count}</td><td>{v.failed}</td></tr>)}</tbody></table></div></section>}
    <section className="admin-band"><h2>비용 계산 요율</h2><p>모델별 100만 토큰당 USD를 입력합니다. 미설정 비용은 0원으로 간주하지 않습니다.</p>
      {data?.pricing && <p className="llm-note">저장된 모델: {Object.keys(data.pricing).join(', ') || '없음'}</p>}
      <form className="llm-pricing" onSubmit={savePricing}><label>모델<input required value={pricing.model || data?.model || ''} onChange={e => setPricing({ ...pricing, model: e.target.value })} /></label>
        {[['input', '입력 USD'], ['cachedInput', '캐시 입력 USD'], ['output', '출력 USD']].map(([id, label]) => <label key={id}>{label}<input required type="number" min="0" max="10000" step="any" value={pricing[id]} onChange={e => setPricing({ ...pricing, [id]: e.target.value })} /></label>)}
        <button className="admin-secondary" disabled={busy || !data} type="submit">요율 저장</button></form>
    </section>
  </div>
}
