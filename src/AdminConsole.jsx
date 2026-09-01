import { useEffect, useMemo, useRef, useState } from 'react'
import readSheet from 'read-excel-file/browser'
import {
  Activity, ArrowLeft, Bot, CheckCircle2, ChevronRight, CircleX, Clock3, Database,
  Building2, CheckSquare2, ChevronDown, FileClock, FileText, KeyRound,
  LayoutDashboard, Play, RefreshCw, Save, Search, ShieldCheck,
  Trash2, UploadCloud, UserRoundCog, UsersRound, Workflow,
} from 'lucide-react'
import './AdminConsole.css'

const knowledgeFileExtensions = new Set(['txt', 'md', 'csv', 'json', 'xlsx'])
const maxKnowledgeFileCount = 20

function fileExtension(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || ''
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

const accountRoles = ['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst', 'Client']
const fullAccessRoles = new Set(['Owner', 'Admin'])
const accessPageSize = 8

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
  const extension = fileExtension(file.name)
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
    extension,
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
  onTestApis, apiTestStatus, canManagePermissions = false,
}) {
  const [section, setSection] = useState('overview')
  const [policies, setPolicies] = useState(() => mergePolicies(adminConfig?.policies))
  const [automations, setAutomations] = useState(adminConfig?.automations?.length ? adminConfig.automations : defaultAutomations)
  const [selectedPolicyId, setSelectedPolicyId] = useState('creator-recommendation')
  const [saveState, setSaveState] = useState('')
  const [isFileDragActive, setIsFileDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const apiBaseUrl = String(backendConfig?.apiBaseUrl || '').replace(/\/$/, '')
  const selectedPolicy = policies.find((item) => item.id === selectedPolicyId) || policies[0]
  const [accessView, setAccessView] = useState('accounts')
  const [accessSearch, setAccessSearch] = useState('')
  const [accessRoleFilter, setAccessRoleFilter] = useState('전체')
  const [accessStatusFilter, setAccessStatusFilter] = useState('전체')
  const [accessBrandFilter, setAccessBrandFilter] = useState('전체')
  const [accessPage, setAccessPage] = useState(1)
  const [selectedAccountIds, setSelectedAccountIds] = useState([])
  const [expandedAccountId, setExpandedAccountId] = useState(null)
  const [expandedBrandId, setExpandedBrandId] = useState(null)
  const [bulkRole, setBulkRole] = useState('')
  const [bulkBrandId, setBulkBrandId] = useState('')
  const [brandSearch, setBrandSearch] = useState('')

  const accountStatuses = useMemo(() => [...new Set(accounts.map((account) => account.status).filter(Boolean))], [accounts])
  const filteredAccounts = useMemo(() => {
    const keyword = accessSearch.trim().toLowerCase()
    return accounts.filter((account) => {
      const hasBrandAccess = fullAccessRoles.has(account.role) || account.brandIds?.includes(accessBrandFilter)
      return (!keyword || `${account.name || ''} ${account.email || ''}`.toLowerCase().includes(keyword))
        && (accessRoleFilter === '전체' || account.role === accessRoleFilter)
        && (accessStatusFilter === '전체' || account.status === accessStatusFilter)
        && (accessBrandFilter === '전체' || hasBrandAccess)
    })
  }, [accessBrandFilter, accessRoleFilter, accessSearch, accessStatusFilter, accounts])
  const accessPageCount = Math.max(1, Math.ceil(filteredAccounts.length / accessPageSize))
  const currentAccessPage = Math.min(accessPage, accessPageCount)
  const visibleAccounts = filteredAccounts.slice((currentAccessPage - 1) * accessPageSize, currentAccessPage * accessPageSize)
  const selectedAccounts = accounts.filter((account) => selectedAccountIds.includes(account.id))
  const filteredBrands = useMemo(() => {
    const keyword = brandSearch.trim().toLowerCase()
    return brands.filter((brand) => !keyword || String(brand.name || '').toLowerCase().includes(keyword))
  }, [brandSearch, brands])

  const accountBrandCount = (account) => fullAccessRoles.has(account.role) ? brands.length : (account.brandIds?.length || 0)
  const getBrandAccounts = (brandId) => accounts.filter((account) => fullAccessRoles.has(account.role) || account.brandIds?.includes(brandId))
  const toggleVisibleAccounts = () => {
    const visibleIds = visibleAccounts.map((account) => account.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedAccountIds.includes(id))
    setSelectedAccountIds((selected) => allSelected
      ? selected.filter((id) => !visibleIds.includes(id))
      : [...new Set([...selected, ...visibleIds])])
  }
  const applyBulkRole = () => {
    if (!canManagePermissions || !bulkRole) return
    selectedAccounts.forEach((account) => onUpdateAccountRole?.(account.id, bulkRole))
    setBulkRole('')
  }
  const applyBulkBrand = (mode) => {
    if (!canManagePermissions || !bulkBrandId) return
    selectedAccounts.forEach((account) => {
      if (fullAccessRoles.has(account.role)) return
      const assigned = account.brandIds?.includes(bulkBrandId)
      if ((mode === 'add' && !assigned) || (mode === 'remove' && assigned)) {
        onToggleBrandAccess?.(account.id, bulkBrandId)
      }
    })
  }

  useEffect(() => {
    if (!apiBaseUrl) return
    fetch(`${apiBaseUrl}/admin/ai-configs`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('설정을 불러오지 못했습니다.')))
      .then((result) => {
        const nextPolicies = mergePolicies(policies, result.data?.configs || [])
        setPolicies(nextPolicies)
        onUpdateAdminConfig?.({
          ...(adminConfig || {}),
          policies: nextPolicies,
          automations,
          source: 'server',
          syncedAt: new Date().toISOString(),
        })
      })
      .catch(() => setSaveState('서버 설정을 불러오지 못해 로컬 설정을 표시합니다.'))
    // Initial server hydration only. Later changes are persisted explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!apiBaseUrl) {
      updatePolicy(nextPolicy)
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
      const nextPolicies = mergePolicies(policies, [result.data?.config || nextPolicy])
      setPolicies(nextPolicies)
      persistLocal(nextPolicies, automations)
      setSaveState(status === 'active' ? '활성 정책으로 저장했습니다. 다음 AI 실행부터 반영됩니다.' : '초안으로 저장했습니다. AI 실행에는 반영되지 않습니다.')
    } catch {
      setSaveState('서버 저장에 실패해 기존 활성 설정을 유지합니다. 연결 상태를 확인한 뒤 다시 저장하세요.')
    }
  }

  const handleFiles = async (files) => {
    const selected = [...files]
    if (!selected.length) return
    const existing = selectedPolicy.attachments || []
    const availableCount = Math.max(0, maxKnowledgeFileCount - existing.length)
    const invalid = selected.filter((file) => !knowledgeFileExtensions.has(fileExtension(file.name)))
    const existingKeys = new Set(existing.map((file) => `${String(file.name || '').toLowerCase()}::${Number(file.size || 0)}`))
    const duplicate = selected.filter((file) => existingKeys.has(`${file.name.toLowerCase()}::${file.size}`))
    const candidates = selected
      .filter((file) => knowledgeFileExtensions.has(fileExtension(file.name)))
      .filter((file) => !existingKeys.has(`${file.name.toLowerCase()}::${file.size}`))
    const accepted = candidates.slice(0, availableCount)
    const overLimitCount = Math.max(0, candidates.length - accepted.length)

    if (!accepted.length) {
      if (!availableCount) setSaveState('학습자료는 기능별로 최대 20개까지 첨부할 수 있습니다.')
      else if (invalid.length) setSaveState(`지원하지 않는 형식입니다: ${invalid.map((file) => file.name).join(', ')} · TXT, MD, CSV, JSON, XLSX만 첨부할 수 있습니다.`)
      else setSaveState('이미 첨부된 동일한 파일입니다.')
      return
    }
    setSaveState('자료를 읽는 중...')
    const results = await Promise.allSettled(accepted.map(extractAttachment))
    const attachments = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
    const failedCount = results.length - attachments.length
    if (attachments.length) updatePolicy({ attachments: [...existing, ...attachments] })
    const notices = [`${attachments.length}개 자료를 읽었습니다.`]
    if (invalid.length) notices.push(`지원하지 않는 형식 ${invalid.length}개 제외`)
    if (duplicate.length) notices.push(`중복 ${duplicate.length}개 제외`)
    if (overLimitCount) notices.push(`20개 제한 초과 ${overLimitCount}개 제외`)
    if (failedCount) notices.push(`읽기 실패 ${failedCount}개`)
    notices.push('저장하면 다음 AI 실행부터 참고합니다.')
    setSaveState(notices.join(' · '))
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
            <div className="admin-knowledge-heading"><div><strong>학습자료</strong><small>TXT, MD, CSV, JSON, XLSX만 첨부할 수 있습니다.</small></div><span className="admin-knowledge-count">{(selectedPolicy.attachments || []).length} / {maxKnowledgeFileCount}</span></div>
            <input ref={fileInputRef} hidden multiple type="file" accept=".txt,.md,.csv,.json,.xlsx" onChange={(event) => { handleFiles(event.target.files); event.target.value = '' }} />
            <div
              className={`admin-knowledge-dropzone ${isFileDragActive ? 'active' : ''} ${(selectedPolicy.attachments || []).length >= maxKnowledgeFileCount ? 'disabled' : ''}`}
              role="button"
              tabIndex={(selectedPolicy.attachments || []).length >= maxKnowledgeFileCount ? -1 : 0}
              aria-disabled={(selectedPolicy.attachments || []).length >= maxKnowledgeFileCount}
              onClick={() => (selectedPolicy.attachments || []).length < maxKnowledgeFileCount && fileInputRef.current?.click()}
              onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && (selectedPolicy.attachments || []).length < maxKnowledgeFileCount) fileInputRef.current?.click() }}
              onDragEnter={(event) => { event.preventDefault(); if ((selectedPolicy.attachments || []).length < maxKnowledgeFileCount) setIsFileDragActive(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setIsFileDragActive(false) }}
              onDrop={(event) => { event.preventDefault(); setIsFileDragActive(false); handleFiles(event.dataTransfer.files) }}
            >
              <UploadCloud size={22} />
              <span><strong>{(selectedPolicy.attachments || []).length >= maxKnowledgeFileCount ? '첨부 가능한 20개를 모두 등록했습니다.' : '파일을 끌어놓거나 클릭해서 첨부'}</strong><small>문서 양식 없이 원본 자료를 바로 연결합니다. 최대 20개</small></span>
            </div>
            {(selectedPolicy.attachments || []).length ? <div className="admin-attachment-list">{selectedPolicy.attachments.map((file) => <div key={file.id}><span className="admin-file-extension">{file.extension || fileExtension(file.name)}</span><span><strong>{file.name}</strong><small>{formatFileSize(file.size)} · {(file.text?.length || 0).toLocaleString()}자 추출</small></span><button type="button" title="삭제" onClick={() => updatePolicy({ attachments: selectedPolicy.attachments.filter((item) => item.id !== file.id) })}><Trash2 size={14} /></button></div>)}</div> : <div className="admin-empty-knowledge"><FileText size={18} /> 연결된 학습자료가 없습니다.</div>}
          </div>
          <div className="admin-policy-meta"><label>버전<input value={selectedPolicy.version || ''} onChange={(event) => updatePolicy({ version: event.target.value })} /></label><label>상태<select value={selectedPolicy.status || 'draft'} onChange={(event) => updatePolicy({ status: event.target.value })}><option value="draft">초안</option><option value="active">활성</option></select></label></div>
          {saveState && <p className="admin-save-state">{saveState}</p>}
          <div className="admin-editor-actions"><button type="button" onClick={() => savePolicyToServer('draft')}><Save size={15} /> 초안 저장</button><button className="primary" type="button" onClick={() => savePolicyToServer('active')}><Play size={15} /> 저장하고 활성화</button></div>
        </section>
      </div>}

      {section === 'automation' && <div className="admin-page"><section className="admin-band"><div className="admin-section-heading"><div><span>AUTOMATION</span><h2>운영 매크로</h2></div></div><div className="admin-table"><div className="admin-table-head"><span>작업</span><span>주기</span><span>상태</span><span>최근 실행</span><span>활성</span><span /></div>{automations.map((item) => <div className="admin-table-row" key={item.id}><strong>{item.name}</strong><input value={item.schedule} onChange={(event) => saveAutomations(automations.map((row) => row.id === item.id ? { ...row, schedule: event.target.value } : row))} /><span className={`admin-state ${tone(item.status)}`}>{item.status}</span><span>{item.lastRun}</span><input type="checkbox" checked={item.enabled} onChange={() => saveAutomations(automations.map((row) => row.id === item.id ? { ...row, enabled: !row.enabled } : row))} /><button type="button" disabled={!item.enabled} onClick={() => saveAutomations(automations.map((row) => row.id === item.id ? { ...row, lastRun: '방금' } : row))}><Play size={14} /> 실행</button></div>)}</div></section>
        <section className="admin-band"><div className="admin-section-heading"><div><span>연결 상태</span><h2>백엔드·API</h2></div><button type="button" onClick={onTestApis} disabled={apiTestStatus?.running}><RefreshCw size={15} /> {apiTestStatus?.running ? '진단 중' : '읽기 전용 진단'}</button></div><div className="admin-connection-grid"><div><Database /><strong>공유 DB</strong><span>{backendConfig?.hasSupabase ? '설정됨' : '설정 필요'}</span></div><div><KeyRound /><strong>API 서버</strong><span>{apiBaseUrl ? '연결 주소 설정됨' : '미연결'}</span></div>{(apiTestStatus?.results || []).map((item) => <div className={`api-${item.status || 'unknown'}`} key={item.key || item.id || item.name}>{item.status === 'fail' ? <CircleX /> : item.status === 'action' ? <Clock3 /> : <CheckCircle2 />}<strong>{item.name || item.label}</strong><span>{item.result || item.status}</span></div>)}</div></section>
      </div>}

      {section === 'access' && <div className="admin-page admin-access-page">
        <section className="admin-access-summary">
          <article><UserRoundCog size={18} /><span>전체 계정</span><strong>{accounts.length}</strong><small>활성 {accounts.filter((item) => item.status === '활성').length}</small></article>
          <article><Building2 size={18} /><span>브랜드 DB</span><strong>{brands.length}</strong><small>브랜드별 접근 분리</small></article>
          <article><ShieldCheck size={18} /><span>전체 접근</span><strong>{accounts.filter((item) => fullAccessRoles.has(item.role)).length}</strong><small>Owner · Admin</small></article>
          <article><Clock3 size={18} /><span>확인 필요</span><strong>{accounts.filter((item) => item.status && item.status !== '활성').length}</strong><small>초대·테스트 계정</small></article>
        </section>

        <section className="admin-band admin-access-workspace">
          <div className="admin-section-heading admin-access-heading">
            <div><span>ACCESS CONTROL</span><h2>계정·브랜드 권한 운영</h2><p>사용자 설정과 같은 권한 원장을 사용합니다. 여기서 변경한 역할과 브랜드 접근 범위는 사용자 화면에도 즉시 반영됩니다.</p></div>
            <div className="admin-access-switch" aria-label="권한 보기 기준">
              <button className={accessView === 'accounts' ? 'active' : ''} type="button" onClick={() => setAccessView('accounts')}><UsersRound size={15} /> 계정별</button>
              <button className={accessView === 'brands' ? 'active' : ''} type="button" onClick={() => setAccessView('brands')}><Building2 size={15} /> 브랜드별</button>
            </div>
          </div>

          {accessView === 'accounts' ? <>
            <div className="admin-access-toolbar">
              <label className="admin-access-search"><Search size={15} /><input value={accessSearch} onChange={(event) => { setAccessSearch(event.target.value); setAccessPage(1) }} placeholder="이름 또는 이메일 검색" /></label>
              <select aria-label="역할 필터" value={accessRoleFilter} onChange={(event) => { setAccessRoleFilter(event.target.value); setAccessPage(1) }}><option>전체</option>{accountRoles.map((role) => <option key={role}>{role}</option>)}</select>
              <select aria-label="상태 필터" value={accessStatusFilter} onChange={(event) => { setAccessStatusFilter(event.target.value); setAccessPage(1) }}><option>전체</option>{accountStatuses.map((status) => <option key={status}>{status}</option>)}</select>
              <select aria-label="브랜드 필터" value={accessBrandFilter} onChange={(event) => { setAccessBrandFilter(event.target.value); setAccessPage(1) }}><option value="전체">전체 브랜드</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
            </div>

            <div className="admin-bulk-toolbar">
              <label className="admin-bulk-selection"><input type="checkbox" checked={visibleAccounts.length > 0 && visibleAccounts.every((item) => selectedAccountIds.includes(item.id))} onChange={toggleVisibleAccounts} /><CheckSquare2 size={15} /><strong>{selectedAccountIds.length}명 선택</strong></label>
              <div className="admin-bulk-actions">
                <select value={bulkRole} onChange={(event) => setBulkRole(event.target.value)} disabled={!canManagePermissions || !selectedAccountIds.length}><option value="">역할 선택</option>{accountRoles.map((role) => <option key={role}>{role}</option>)}</select>
                <button type="button" onClick={applyBulkRole} disabled={!bulkRole || !selectedAccountIds.length || !canManagePermissions}>역할 적용</button>
                <select value={bulkBrandId} onChange={(event) => setBulkBrandId(event.target.value)} disabled={!canManagePermissions || !selectedAccountIds.length}><option value="">브랜드 선택</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
                <button type="button" onClick={() => applyBulkBrand('add')} disabled={!bulkBrandId || !selectedAccountIds.length || !canManagePermissions}>접근 추가</button>
                <button type="button" onClick={() => applyBulkBrand('remove')} disabled={!bulkBrandId || !selectedAccountIds.length || !canManagePermissions}>접근 해제</button>
              </div>
            </div>

            <div className="admin-access-list">
              <div className="admin-access-list-head"><span /><span>계정</span><span>역할</span><span>상태</span><span>브랜드</span><span>최근 활동</span><span /></div>
              {visibleAccounts.map((account) => {
                const expanded = expandedAccountId === account.id
                const full = fullAccessRoles.has(account.role)
                return <div className={`admin-access-row ${expanded ? 'expanded' : ''}`} key={account.id}>
                  <input type="checkbox" checked={selectedAccountIds.includes(account.id)} onChange={() => setSelectedAccountIds((selected) => selected.includes(account.id) ? selected.filter((id) => id !== account.id) : [...selected, account.id])} />
                  <div className="admin-account-identity"><strong>{account.name}</strong><small>{account.email}</small></div>
                  <select value={account.role} disabled={!canManagePermissions} onChange={(event) => onUpdateAccountRole?.(account.id, event.target.value)}>{accountRoles.map((role) => <option key={role}>{role}</option>)}</select>
                  <span className={`admin-access-state ${account.status === '활성' ? 'ok' : 'warning'}`}>{account.status || '미확인'}</span>
                  <span className="admin-access-count">{full ? '전체' : `${accountBrandCount(account)}개`}</span>
                  <span className="admin-access-last">{account.lastActive || '-'}</span>
                  <button className={`admin-access-expand ${expanded ? 'active' : ''}`} type="button" title="브랜드 권한 상세" onClick={() => setExpandedAccountId(expanded ? null : account.id)}><ChevronDown size={16} /></button>
                  {expanded && <div className="admin-access-row-detail">
                    <div><strong>브랜드 접근 범위</strong><small>{full ? '이 역할은 모든 브랜드 DB에 접근합니다.' : '허용할 브랜드를 선택하세요.'}</small></div>
                    <div className="admin-brand-checkbox-grid">{brands.map((brand) => <label key={brand.id}><input type="checkbox" checked={full || account.brandIds?.includes(brand.id) || false} disabled={full || !canManagePermissions} onChange={() => onToggleBrandAccess?.(account.id, brand.id)} />{brand.name}</label>)}</div>
                  </div>}
                </div>
              })}
              {!visibleAccounts.length && <div className="admin-access-empty">조건에 맞는 계정이 없습니다.</div>}
            </div>

            <div className="admin-access-pagination"><span>{filteredAccounts.length}개 계정 · {currentAccessPage}/{accessPageCount} 페이지</span><div><button type="button" disabled={currentAccessPage === 1} onClick={() => setAccessPage((page) => Math.max(1, page - 1))}>이전</button>{Array.from({ length: accessPageCount }, (_, index) => index + 1).slice(Math.max(0, currentAccessPage - 3), Math.max(5, currentAccessPage + 2)).map((page) => <button className={page === currentAccessPage ? 'active' : ''} type="button" key={page} onClick={() => setAccessPage(page)}>{page}</button>)}<button type="button" disabled={currentAccessPage === accessPageCount} onClick={() => setAccessPage((page) => Math.min(accessPageCount, page + 1))}>다음</button></div></div>
          </> : <>
            <div className="admin-brand-toolbar"><label className="admin-access-search"><Search size={15} /><input value={brandSearch} onChange={(event) => setBrandSearch(event.target.value)} placeholder="브랜드 검색" /></label><span>{filteredBrands.length}개 브랜드</span></div>
            <div className="admin-brand-directory">
              {filteredBrands.map((brand) => {
                const brandAccounts = getBrandAccounts(brand.id)
                const expanded = expandedBrandId === brand.id
                const roleSummary = accountRoles.map((role) => [role, brandAccounts.filter((account) => account.role === role).length]).filter(([, count]) => count)
                return <article className={expanded ? 'expanded' : ''} key={brand.id}>
                  <button className="admin-brand-row-main" type="button" onClick={() => setExpandedBrandId(expanded ? null : brand.id)}>
                    <span className="admin-brand-icon"><Building2 size={17} /></span><span><strong>{brand.name}</strong><small>{brand.client || '브랜드 워크스페이스'}</small></span><b>{brandAccounts.length}명</b><span className="admin-role-mix">{roleSummary.map(([role, count]) => `${role} ${count}`).join(' · ') || '배정 없음'}</span><ChevronDown size={16} />
                  </button>
                  {expanded && <div className="admin-brand-members">{brandAccounts.length ? brandAccounts.map((account) => <div className="admin-brand-member" key={account.id}><span><strong>{account.name}</strong><small>{account.email}</small></span><span className={`admin-access-state ${account.status === '활성' ? 'ok' : 'warning'}`}>{account.status || '미확인'}</span><select value={account.role} disabled={!canManagePermissions} onChange={(event) => onUpdateAccountRole?.(account.id, event.target.value)}>{accountRoles.map((role) => <option key={role}>{role}</option>)}</select>{fullAccessRoles.has(account.role) ? <small>전체 브랜드 권한</small> : <button type="button" disabled={!canManagePermissions} onClick={() => onToggleBrandAccess?.(account.id, brand.id)}>접근 해제</button>}</div>) : <div className="admin-access-empty">이 브랜드에 배정된 계정이 없습니다.</div>}</div>}
                </article>
              })}
            </div>
          </>}
        </section>
      </div>}

      {section === 'audit' && <div className="admin-page"><section className="admin-band"><div className="admin-section-heading"><div><span>AUDIT TRAIL</span><h2>변경·실행 이력</h2></div><small>{auditRows.length}건</small></div><div className="admin-audit-list">{auditRows.length ? auditRows.map((row) => <div key={row.id}><span>{row.type}</span><strong>{row.text}</strong><small>{row.source} · {row.time || '시간 기록 없음'}</small></div>) : <div className="admin-empty"><Clock3 /> 아직 저장된 감사 로그가 없습니다.</div>}</div></section></div>}
    </main>
  </div>
}
