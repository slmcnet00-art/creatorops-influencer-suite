import { useEffect, useState } from 'react'

const features = [['campaign-strategy', '캠페인 전략'], ['creator-recommendation', '인플루언서 추천'], ['content-guide', '콘텐츠 가이드'], ['outreach-message', '섭외 문구']]
const initial = { featureKey: 'campaign-strategy', topic: '', feedback: '', judgment: '', principle: '', runId: '' }
const stateNames = { pending: '검토 대기', approved: '다음 생성에 적용', rejected: '반려', retired: '적용 중지' }
export default function DecisionMemoryPanel({ apiBaseUrl, accessToken, sourceRun }) {
  const [data, setData] = useState(null), [form, setForm] = useState(initial), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBaseUrl}/admin/decision-memory`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
      .then(async r => { const b = await r.json(); if (!r.ok) throw Error(b.message || '판단 기억을 불러오지 못했습니다.'); return b.data })
      .then(setData).catch(e => { if (!controller.signal.aborted) setNotice(e.message) })
    return () => controller.abort()
  }, [apiBaseUrl, accessToken, refresh])
  async function write(path, body) {
    setBusy(true); setNotice('')
    try {
      const r = await fetch(`${apiBaseUrl}/admin/decision-memory${path}`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, revision: data.revision }) })
      const b = await r.json(); if (!r.ok) throw Error(b.message || '저장하지 못했습니다.')
      setData(b.data); setNotice('저장했습니다. 승인된 원칙은 이후 서버 AI 생성부터 적용됩니다.'); return true
    } catch (e) { setNotice(e.message); setRefresh(n => n + 1); return false }
    finally { setBusy(false) }
  }
  function field(key, label, maxLength) {
    return <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>{label}<textarea required rows={3} maxLength={maxLength} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>
  }
  return <section className="admin-band decision-memory" style={{ minWidth: 0 }}>
    <div className="admin-section-heading"><div><span>DECISION MEMORY</span><h2>피드백 · 판단 사례 · 운영 원칙</h2><p>피드백을 사례로 보관하고 승인한 원칙만 다음 AI 생성에 참고합니다. 모델 자체를 재학습하지 않습니다.</p></div><button className="admin-secondary" disabled={busy} onClick={() => setRefresh(n => n + 1)}>새로고침</button></div>
    <p>이곳의 원칙은 선택한 기능에서 모든 브랜드에 공통 적용됩니다. 브랜드 전용 전략은 관리자 정책에서 관리하세요. 개인정보·원본 메시지·영상 통계 대신 일반화한 피드백과 판단 이유만 입력하세요.</p>
    {notice && <p role="status">{notice}</p>}
    <form onSubmit={async e => { e.preventDefault(); if (await write('', { ...form, runId: form.runId || null })) setForm(initial) }}>
      <div className="llm-filters"><label>적용 기능<select value={form.featureKey} onChange={e => setForm({ ...form, featureKey: e.target.value })}>{features.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
        <label>관련 AI 호출 번호 (선택)<input type="number" min="1" value={form.runId} onChange={e => setForm({ ...form, runId: e.target.value })} /></label></div>
      {sourceRun && <button type="button" className="admin-secondary" onClick={() => setForm({ ...form, runId: String(sourceRun.id), featureKey: sourceRun.featureKey })}>현재 확인 중인 호출 #{sourceRun.id} 연결</button>}
      {field('topic', '판단 주제 (예: 섭외 제목의 표현)', 100)}{field('feedback', '받은 피드백 · 개선할 점', 1500)}{field('judgment', '판단 사례 · 변경 이유와 결과', 1500)}{field('principle', '다음에 적용할 원칙 · 적용 조건과 예외', 1000)}
      <button className="admin-primary" disabled={busy || !data}>판단 사례와 원칙 후보 저장</button>
    </form>
    <p>기록 {data?.cases.length ?? 0}/200개 · 기능별 승인 최대 20개 · 저장 후 별도 승인 필요. 서로 다른 입력의 성과가 자동으로 개선되었다고 판단하지 않습니다.</p>
    {data?.cases.map(c => <article key={c.id} style={{ borderTop: '1px solid #ddd', padding: '16px 0', overflowWrap: 'anywhere' }}>
      <h3>{c.topic} · {stateNames[c.state]} · v{c.version}</h3><p>{features.find(([id]) => id === c.featureKey)?.[1]}{c.runId ? ` · 호출 #${c.runId}` : ''}</p>
      <p><b>피드백:</b> {c.feedback}</p><p><b>판단 사례:</b> {c.judgment}</p><p><b>운영 원칙:</b> {c.principle}</p>
      <div className="llm-filters">{c.state !== 'approved' && <button className="admin-secondary" disabled={busy} onClick={() => { if (window.confirm('이 원칙을 모든 브랜드의 해당 AI 기능에 적용할까요?')) write(`/${c.id}/review`, { action: 'approve' }) }}>{c.state === 'retired' ? '이전 원칙 다시 승인' : '승인하여 다음 생성에 반영'}</button>}
        {c.state === 'pending' && <button className="admin-secondary" disabled={busy} onClick={() => write(`/${c.id}/review`, { action: 'reject' })}>반려</button>}
        {c.state === 'approved' && <button className="admin-secondary" disabled={busy} onClick={() => write(`/${c.id}/review`, { action: 'retire' })}>적용 중지</button>}</div>
      <details><summary>검토 이력 ({c.history.length})</summary>{c.history.map((h, i) => <p key={i}>{h.action} · {new Date(h.at).toLocaleString('ko-KR')}</p>)}</details>
    </article>)}
  </section>
}
