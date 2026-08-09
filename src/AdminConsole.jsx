import { useEffect, useMemo, useRef, useState } from 'react'
import readSheet from 'read-excel-file/browser'
import {
  Activity, ArrowLeft, Bot, CheckCircle2, ChevronRight, Clock3, Database,
  FileClock, FileText, KeyRound, LayoutDashboard, Paperclip, Play, RefreshCw,
  Save, ShieldCheck, Trash2, UsersRound, Workflow,
} from 'lucide-react'
import './AdminConsole.css'

const defaultPolicies = [
  { id: 'creator-recommendation', name: 'AI 인플루언서 추천', description: '캠페인 브리프와 실제 후보 데이터를 바탕으로 추천 근거, 제안 각도, 주의점을 생성합니다.', systemPrompt: '브랜드 적합성과 조회 성과를 우선하되 제공된 원천 데이터만 사용합니다. 확인되지 않은 수치를 만들지 않습니다.', rules: '조회수 폭발력, 평균 조회수, 참여율, 콘텐츠 적합성, 데이터 신뢰도를 함께 평가합니다.', version: 'v1.0', status: 'active', attachments: [] },
  { id: 'campaign-strategy', name: '캠페인 전략 생성', description: '브랜드·제품·타깃·KPI를 바탕으로 실행 가능한 캠페인 전략을 생성합니다.', systemPrompt: '브랜드 목표를 실행 구조, 콘텐츠 메시지, 채널별 역할, KPI로 구체화합니다.', rules: '허위 후기, 여론 조작, 성과 보장은 제안하지 않습니다. 합법적인 협찬·광고 전략만 생성합니다.', version: 'v1.0', status: 'active', attachments: [] },
  { id: 'content-guide', name: '인플루언서 가이드 생성', description: '캠페인 전략과 저장한 제작 레퍼런스를 크리에이터 전달용 가이드로 변환합니다.', systemPrompt: '크리에이터가 바로 촬영할 수 있도록 원메시지, 후킹, 컷 구성, 필수 노출, 금지 표현을 구체적으로 작성합니다.', rules: '내부 계산식과 raw 데이터 ID는 최종 가이드에 노출하지 않습니다.', version: 'v1.0', status: 'active', attachments: [] },
  { id: 'outreach-message', name: '제안 메시지 생성', description: '후보별 추천 근거와 캠페인 조건을 친근하고 답변하기 쉬운 제안 메시지로 만듭니다.', systemPrompt: '실제 콘텐츠를 확인한 듯한 구체적인 칭찬과 답변하기 쉬운 질문을 포함합니다.', rules: '과장, 압박, 복붙투 문장을 피하고 광고 표기 안내를 자연스럽게 포함합니다.', version: 'v1.0', status: 'active', attachments: [] },
  { id: 'reference-analysis', name: '레퍼런스 분석', description: '저장한 콘텐츠에서 재사용할 후킹 구조, 장면, CTA를 추출합니다.', systemPrompt: '원문을 복제하지 않고 구조와 정보 배열만 분석해 새 캠페인에 맞게 변형합니다.', rules: '분석 대상은 사용자가 저장한 콘텐츠로 제한하며, 분석은 저장 이후 명시적으로 실행합니다.', version: 'v1.0', status: 'active', attachments: [] },
]

const defaultAutomations = [
  { id: 'utm', name: 'UTM·숏링크 생성', schedule: '요청 시', enabled: true, status: '정상', lastRun: '-' },
  { id: 'report', name: '리포트 API 적재·추출', schedule: '매일 1회', enabled: true, status: '설정 필요', lastRun: '-' },
  { id: 'reference', name: '레퍼런스 수집', schedule: '매일 2회', enabled: true, status: '검토 필요', lastRun: '-' },
  { id: 'access', name: '회원가입·권한 배정', schedule: '이벤트 발생 시', enabled: true, status: '정상', lastRun: '-' },
]

function tone(status) {
  if (status === '정상' || status === 'active') return 'ok'
  if (status === '오류') return 'error'
  return 'warning'
}

function mergePolicies(localPolicies = [], remotePolicies = []) {
  return defaultPolicies.map((base) => ({
    ...base,
    ...(localPolicies.find((item) => item.id === base.id) || {}),
    ...(remotePolicies.find((item) => item.featureKey === base.id || item.id === base.id) || {}),
    id: base.id,
  }))
}

async function extractAttachment(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  let text
  if (extension === 'xlsx') {
    const rows = await readSheet(file)
    text = rows.map((row) => row.map((cell) => String(cell ?? '')).join('\t')).join('\n')
  } else {
    text = await file.text()
  }
  return {
    id: `${Date.now()}-${file.name}`,
    name: file.name,
    type: file.type || extension || 'text',
    size: file.size,
    text: text.slice(0, 120000),
    uploadedAt: new Date().toISOString(),
  }
}

export default function AdminConsole({
  summary = {}, dataRoom, accounts = [], brands = [], currentAccount,
  activities = [], apiEvents = [], backendConfig, adminConfig,
  onUpdateAdminConfig, onUpdateAccountRole, onToggleBrandAccess,
  onTestApis, apiTestStatus,
}) {
  const [section, setSection] = useState('overview')
  const [policies, setPolicies] = useState(() => mergePolicies(adminConfig?.policies))
  const [automations, setAutomations] = useState(adminConfig?.automations?.length ? adminConfig.automations : defaultAutomations)
  const [selectedPolicyId, setSelectedPolicyId] = useState('creator-recommendation')
  const [saveState, setSaveState] = useState('')
  const fileInputRef = useRef(null)
  const apiBaseUrl = String(backendConfig?.apiBaseUrl || '').replace(/\/$/, '')
  const selectedPolicy = policies.find((item) => item.id === selectedPolicyId) || policies[0]

  useEffect(() => {
    if (!apiBaseUrl) return
    fetch(`${apiBaseUrl}/admin/ai-configs`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('설정을 불러오지 못했습니다.')))
      .then((result) => setPolicies((current) => mergePolicies(current, result.data?.configs || [])))
      .catch(() => setSaveState('서버 설정을 불러오지 못해 로컬 설정을 표시합니다.'))
  }, [apiBaseUrl])

  const auditRows = useMemo(() => [
    ...apiEvents.map((item, index) => ({ id: item.id || `api-${index}`, type: item.event_type || 'api', text: item.message || item.endpoint || 'API 수집 이벤트', time: item.created_at || '', source: 'API' })),
    ...activities.map((item, index) => ({ id: item.id || `activity-${index}`, type: item.type || 'operation', text: item.text || item.label || String(item), time: item.time || item.createdAt || '', source: '워크스페이스' })),
  ].slice(0, 80), [activities, apiEvents])

  const persistLocal = (nextPolicies = policies, nextAutomations = automations) => {
    onUpdateAdminConfig?.({ ...(adminConfig || {}), policies: nextPolicies, automations: nextAutomations, updatedAt: new Date().toISOString() })
  }

  const updatePolicy = (patch) => {
    const next = policies.map((item) => item.id === selectedPolicy.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)
    setPolicies(next)
    persistLocal(next)
  }

  const savePolicyToServer = async (status = selectedPolicy.status) => {
    const nextPolicy = { ...selectedPolicy, status, updatedAt: new Date().toISOString() }
    updatePolicy(nextPolicy)
    if (!apiBaseUrl) {
      setSaveState('브라우저에 저장했습니다. API 서버 연결 후 서버에도 동기화됩니다.')
      return
    }
    setSaveState('저장 중...')
    try {
      const response = await fetch(`${apiBaseUrl}/admin/ai-configs/${nextPolicy.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nextPolicy),
      })
      if (!response.ok) throw new Error('저장 실패')
      const result = await response.json()
      setPolicies((current) => mergePolicies(current, [result.data?.config]))
      setSaveState(status === 'active' ? '활성 정책으로 저장했습니다. 다음 AI 실행부터 반영됩니다.' : '초안으로 저장했습니다. AI 실행에는 반영되지 않습니다.')
    } catch {
      setSaveState('서버 저장에 실패했습니다. 브라우저에는 저장되어 있습니다.')
    }
  }

  const handleFiles = async (files) => {
    const selected = [...files]
    if (!selected.length) return
    setSaveState('자료를 읽는 중...')
    try {
      const attachments = await Promise.all(selected.map(extractAttachment))
      updatePolicy({ attachments: [...(selectedPolicy.attachments || []), ...attachments].slice(0, 20) })
      setSaveState(`${attachments.length}개 자료를 읽었습니다. 저장하면 다음 AI 실행부터 참고합니다.`)
    } catch {
      setSaveState('자료를 읽지 못했습니다. TXT, MD, CSV, JSON, XLSX 형식을 확인해주세요.')
    }
  }

  const saveAutomations = (next) => { setAutomations(next); persistLocal(policies, next) }
  const navigation = [
    ['overview', '운영 개요', LayoutDashboard], ['data', '데이터룸', Database], ['policy', 'AI 학습 관리', Bot],
    ['automation', '자동화', Workflow], ['access', '계정·브랜드 권한', UsersRound], ['audit', '감사 로그', FileClock],
  ]

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><span><ShieldCheck size={18} /></span><div><strong>CreatorOps Admin</strong><small>운영 콘솔</small></div></div>
      <nav>{navigation.map(([id, label, Icon]) => <button className={section === id ? 'active' : ''} type="button" key={id} onClick={() => setSection(id)}><Icon size={17} />{label}</button>)}</nav>
      <a className="admin-back-link" href="/"><ArrowLeft size={16} /> 사용자 화면</a>
    </aside>
    <main className="admin-main">
      <header className="admin-header"><div><span className="admin-eyebrow">ADMIN WORKSPACE</span><h1>{navigation.find(([id]) => id === section)?.[1]}</h1></div><div className="admin-account"><span>{currentAccount?.name || '관리자'}</span><strong>{currentAccount?.role || 'Admin'}</strong></div></header>

      {section === 'overview' && <div className="admin-page">
        <section className="admin-summary-grid">
          <article><Database /><span>Raw 데이터</span><strong>{summary.rawTotal || 0}개</strong><small>정상 {summary.rawOk || 0} · 확인 {(summary.rawDelayed || 0) + (summary.rawError || 0)}</small></article>
          <article><Activity /><span>계산지표</span><strong>{summary.metricTotal || 0}개</strong><small>오류 {summary.metricError || 0}</small></article>
          <article><Bot /><span>활성 AI 정책</span><strong>{policies.filter((item) => item.status === 'active').length}/{policies.length}</strong><small>프롬프트·학습자료 적용</small></article>
          <article><UsersRound /><span>운영 계정</span><strong>{accounts.length}개</strong><small>브랜드 DB {brands.length}개</small></article>
        </section>
        <section className="admin-band"><div className="admin-section-heading"><div><span>오늘 확인할 것</span><h2>운영 상태</h2></div></div><div className="admin-action-list">
          <button type="button" onClick={() => setSection('policy')}><span className="admin-status-dot ok" /><div><strong>AI 학습 정책</strong><small>기능별 프롬프트와 첨부자료를 관리합니다.</small></div><ChevronRight size={16} /></button>
          <button type="button" onClick={() => setSection('data')}><span className={`admin-status-dot ${summary.rawError ? 'error' : 'ok'}`} /><div><strong>데이터 수집 품질</strong><small>오류 {summary.rawError || 0}개 · 지연 {summary.rawDelayed || 0}개</small></div><ChevronRight size={16} /></button>
          <button type="button" onClick={() => setSection('automation')}><span className="admin-status-dot warning" /><div><strong>자동화 설정</strong><small>{automations.filter((item) => item.status !== '정상').length}개 작업 확인 필요</small></div><ChevronRight size={16} /></button>
        </div></section>
      </div>}

      {section === 'data' && <div className="admin-data-room">{dataRoom}</div>}

      {section === 'policy' && <div className="admin-page admin-policy-layout">
        <section className="admin-policy-list"><div className="admin-section-heading"><div><span>기능 목록</span><h2>AI 학습 및 생성 정책</h2></div></div>
          {policies.map((policy) => <button className={policy.id === selectedPolicy.id ? 'active' : ''} type="button" key={policy.id} onClick={() => setSelectedPolicyId(policy.id)}><div><strong>{policy.name}</strong><small>{policy.description}</small></div><span className={`admin-state ${tone(policy.status)}`}>{policy.status === 'active' ? '활성' : '초안'}</span></button>)}
        </section>
        <section className="admin-policy-editor">
          <div className="admin-section-heading"><div><span>AI CONTROL</span><h2>{selectedPolicy.name}</h2></div><span className={`admin-state ${tone(selectedPolicy.status)}`}>{selectedPolicy.status === 'active' ? '활성' : '초안'}</span></div>
          <p className="admin-policy-help">활성 정책은 다음 AI 실행부터 자동으로 프롬프트에 합쳐집니다. 첨부자료는 원문 파일이 아니라 추출된 텍스트 지식으로 저장되어 추천·생성 시 참고됩니다.</p>
          <label>기능 설명<textarea value={selectedPolicy.description || ''} onChange={(event) => updatePolicy({ description: event.target.value })} /></label>
          <label>관리자 프롬프트<textarea className="large" value={selectedPolicy.systemPrompt || ''} onChange={(event) => updatePolicy({ systemPrompt: event.target.value })} placeholder="AI가 반드시 따라야 할 역할, 우선순위, 판단 기준을 입력하세요." /></label>
          <label>운영 규칙<textarea className="large" value={selectedPolicy.rules || ''} onChange={(event) => updatePolicy({ rules: event.target.value })} placeholder="금지 규칙, 필수 출력 항목, 검증 기준을 입력하세요." /></label>
          <div className="admin-knowledge-block">
            <div className="admin-knowledge-heading"><div><strong>학습자료</strong><small>TXT, MD, CSV, JSON, XLSX · 최대 20개</small></div><button type="button" onClick={() => fileInputRef.current?.click()}><Paperclip size={14} /> 자료 첨부</button></div>
            <input ref={fileInputRef} hidden multiple type="file" accept=".txt,.md,.csv,.json,.xlsx" onChange={(event) => { handleFiles(event.target.files); event.target.value = '' }} />
            {(selectedPolicy.attachments || []).length ? <div className="admin-attachment-list">{selectedPolicy.attachments.map((file) => <div key={file.id}><FileText size={15} /><span><strong>{file.name}</strong><small>{Math.ceil((file.text?.length || 0) / 1000)}천 자 추출</small></span><button type="button" title="삭제" onClick={() => updatePolicy({ attachments: selectedPolicy.attachments.filter((item) => item.id !== file.id) })}><Trash2 size={14} /></button></div>)}</div> : <div className="admin-empty-knowledge">아직 첨부한 자료가 없습니다.</div>}
          </div>
          <div className="admin-policy-meta"><label>버전<input value={selectedPolicy.version || ''} onChange={(event) => updatePolicy({ version: event.target.value })} /></label><label>상태<select value={selectedPolicy.status || 'draft'} onChange={(event) => updatePolicy({ status: event.target.value })}><option value="draft">초안</option><option value="active">활성</option></select></label></div>
          {saveState && <p className="admin-save-state">{saveState}</p>}
          <div className="admin-editor-actions"><button type="button" onClick={() => savePolicyToServer('draft')}><Save size={15} /> 초안 저장</button><button className="primary" type="button" onClick={() => savePolicyToServer('active')}><Play size={15} /> 저장하고 활성화</button></div>
        </section>
      </div>}

      {section === 'automation' && <div className="admin-page"><section className="admin-band"><div className="admin-section-heading"><div><span>AUTOMATION</span><h2>운영 매크로</h2></div></div><div className="admin-table"><div className="admin-table-head"><span>작업</span><span>주기</span><span>상태</span><span>최근 실행</span><span>활성</span><span /></div>{automations.map((item) => <div className="admin-table-row" key={item.id}><strong>{item.name}</strong><input value={item.schedule} onChange={(event) => saveAutomations(automations.map((row) => row.id === item.id ? { ...row, schedule: event.target.value } : row))} /><span className={`admin-state ${tone(item.status)}`}>{item.status}</span><span>{item.lastRun}</span><input type="checkbox" checked={item.enabled} onChange={() => saveAutomations(automations.map((row) => row.id === item.id ? { ...row, enabled: !row.enabled } : row))} /><button type="button" disabled={!item.enabled} onClick={() => saveAutomations(automations.map((row) => row.id === item.id ? { ...row, lastRun: '방금' } : row))}><Play size={14} /> 실행</button></div>)}</div></section>
        <section className="admin-band"><div className="admin-section-heading"><div><span>연결 상태</span><h2>백엔드·API</h2></div><button type="button" onClick={onTestApis} disabled={apiTestStatus?.running}><RefreshCw size={15} /> 연결 테스트</button></div><div className="admin-connection-grid"><div><Database /><strong>공유 DB</strong><span>{backendConfig?.hasSupabase ? '설정됨' : '설정 필요'}</span></div><div><KeyRound /><strong>API 서버</strong><span>{apiBaseUrl ? '연결 주소 설정됨' : '미연결'}</span></div>{(apiTestStatus?.results || []).map((item) => <div key={item.id || item.name}><CheckCircle2 /><strong>{item.name || item.label}</strong><span>{item.result || item.status}</span></div>)}</div></section>
      </div>}

      {section === 'access' && <div className="admin-page"><section className="admin-band"><div className="admin-section-heading"><div><span>ACCESS CONTROL</span><h2>계정 역할·브랜드 DB</h2></div></div><div className="admin-account-table">{accounts.map((account) => <article key={account.id}><div className="admin-account-identity"><strong>{account.name}</strong><small>{account.email}</small></div><select value={account.role} onChange={(event) => onUpdateAccountRole?.(account.id, event.target.value)}>{['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst', 'Client'].map((role) => <option key={role}>{role}</option>)}</select><div className="admin-brand-access">{brands.map((brand) => { const full = ['Owner', 'Admin'].includes(account.role); const checked = full || account.brandIds?.includes(brand.id); return <label key={brand.id}><input type="checkbox" checked={checked} disabled={full} onChange={() => onToggleBrandAccess?.(account.id, brand.id)} />{brand.name}</label> })}</div></article>)}</div></section></div>}

      {section === 'audit' && <div className="admin-page"><section className="admin-band"><div className="admin-section-heading"><div><span>AUDIT TRAIL</span><h2>변경·실행 이력</h2></div><small>{auditRows.length}건</small></div><div className="admin-audit-list">{auditRows.length ? auditRows.map((row) => <div key={row.id}><span>{row.type}</span><strong>{row.text}</strong><small>{row.source} · {row.time || '시간 기록 없음'}</small></div>) : <div className="admin-empty"><Clock3 /> 아직 저장된 감사 로그가 없습니다.</div>}</div></section></div>}
    </main>
  </div>
}
