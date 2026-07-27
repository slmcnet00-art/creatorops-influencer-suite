import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileClock,
  KeyRound,
  LayoutDashboard,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  UsersRound,
  Workflow,
} from 'lucide-react'
import './AdminConsole.css'

const POLICY_KEY = 'creatorops.admin.policies.v1'
const AUTOMATION_KEY = 'creatorops.admin.automations.v1'

const defaultPolicies = [
  {
    id: 'campaign-strategy',
    name: '캠페인 전략 생성',
    description: '브랜드·제품·타깃·KPI를 바탕으로 실행 전략과 검증 가능한 콘텐츠 방향을 생성합니다.',
    version: 'v1.3',
    status: '승인',
    updatedAt: '오늘',
    rules:
      '실제 사용자 경험과 공개된 근거만 사용합니다. 허위 후기, 신분 은폐, 커뮤니티 여론 조작은 생성하지 않습니다.',
  },
  {
    id: 'creator-recommendation',
    name: 'AI 인플루언서 추천',
    description: '캠페인 브리프 적합도, 평균 조회수, 조회 폭발력, 참여율, 데이터 신뢰도를 함께 평가합니다.',
    version: 'v1.5',
    status: '승인',
    updatedAt: '오늘',
    rules: '브리프 30 · 조회 성과 25 · 조회 폭발력 20 · 참여율 15 · 데이터 신뢰도 10',
  },
]

const defaultAutomations = [
  { id: 'utm', name: 'UTM·숏링크 생성', schedule: '요청 시', enabled: true, status: '정상', lastRun: '오늘 10:23' },
  { id: 'report', name: '리포트 API 적재·추출', schedule: '매일 1회', enabled: true, status: '설정 필요', lastRun: '대기' },
  { id: 'reference', name: '레퍼런스 수집', schedule: '매일 2회', enabled: true, status: '점검 필요', lastRun: '오늘 09:10' },
  { id: 'access', name: '회원가입·권한 배정', schedule: '이벤트 발생 시', enabled: true, status: '정상', lastRun: '오늘 08:42' },
]

function readStore(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return Array.isArray(value) ? value : fallback
  } catch {
    return fallback
  }
}

function tone(status) {
  if (status === '정상' || status === '승인') return 'ok'
  if (status === '오류') return 'error'
  return 'warning'
}

function AdminConsole({
  summary,
  dataRoom,
  accounts,
  brands,
  currentAccount,
  canManagePermissions,
  activities,
  apiEvents,
  backendConfig,
  onUpdateAccountRole,
  onToggleBrandAccess,
  onTestApis,
  apiTestStatus,
}) {
  const [section, setSection] = useState('overview')
  const [policies, setPolicies] = useState(() => readStore(POLICY_KEY, defaultPolicies))
  const [automations, setAutomations] = useState(() => readStore(AUTOMATION_KEY, defaultAutomations))
  const [selectedPolicyId, setSelectedPolicyId] = useState(defaultPolicies[0].id)
  const [runMessage, setRunMessage] = useState('')
  const selectedPolicy = policies.find((item) => item.id === selectedPolicyId) ?? policies[0]

  const auditRows = useMemo(() => {
    const workspaceRows = (activities || []).map((item, index) => ({
      id: item.id || `activity-${index}`,
      type: item.type || 'operation',
      text: item.text || item.label || String(item),
      time: item.time || item.createdAt || item.date || '',
      source: '워크스페이스',
    }))
    const apiRows = (apiEvents || []).map((item, index) => ({
      id: item.id || `api-${index}`,
      type: item.event_type || item.type || 'api',
      text: item.message || item.endpoint || item.source || 'API 수집 이벤트',
      time: item.created_at || item.createdAt || '',
      source: 'API',
    }))
    return [...apiRows, ...workspaceRows].slice(0, 80)
  }, [activities, apiEvents])

  const savePolicies = (next) => {
    setPolicies(next)
    localStorage.setItem(POLICY_KEY, JSON.stringify(next))
  }

  const updatePolicy = (patch) => {
    savePolicies(policies.map((item) => (item.id === selectedPolicy.id ? { ...item, ...patch, updatedAt: '방금' } : item)))
  }

  const saveAutomations = (next) => {
    setAutomations(next)
    localStorage.setItem(AUTOMATION_KEY, JSON.stringify(next))
  }

  const runAutomation = (automation) => {
    const next = automations.map((item) =>
      item.id === automation.id ? { ...item, lastRun: '방금', status: item.id === 'report' ? '설정 필요' : '정상' } : item,
    )
    saveAutomations(next)
    setRunMessage(`${automation.name} 실행 요청을 기록했습니다.`)
  }

  if (!canManagePermissions) {
    return (
      <main className="admin-access-denied">
        <ShieldCheck size={32} />
        <h1>관리자 권한이 필요합니다</h1>
        <p>Owner 또는 Admin 계정만 운영 콘솔에 접근할 수 있습니다.</p>
        <a href="/">사용자 화면으로 돌아가기</a>
      </main>
    )
  }

  const navigation = [
    ['overview', '운영 개요', LayoutDashboard],
    ['data', '데이터룸', Database],
    ['policy', 'AI 정책', Bot],
    ['automation', '자동화', Workflow],
    ['access', '팀·브랜드 권한', UsersRound],
    ['audit', '감사 로그', FileClock],
  ]

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span><ShieldCheck size={18} /></span>
          <div><strong>CreatorOps Admin</strong><small>운영 콘솔</small></div>
        </div>
        <nav>
          {navigation.map(([id, label, Icon]) => (
            <button className={section === id ? 'active' : ''} type="button" key={id} onClick={() => setSection(id)}>
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <a className="admin-back-link" href="/"><ArrowLeft size={16} /> 사용자 화면</a>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">ADMIN WORKSPACE</span>
            <h1>{navigation.find(([id]) => id === section)?.[1]}</h1>
          </div>
          <div className="admin-account">
            <span>{currentAccount?.name}</span>
            <strong>{currentAccount?.role}</strong>
          </div>
        </header>

        {section === 'overview' && (
          <div className="admin-page">
            <section className="admin-summary-grid">
              <article><Database /><span>Raw 데이터</span><strong>{summary.rawTotal}개</strong><small>정상 {summary.rawOk} · 확인 {summary.rawDelayed + summary.rawError}</small></article>
              <article><Activity /><span>계산지표</span><strong>{summary.metricTotal}개</strong><small>오류 {summary.metricError}</small></article>
              <article><Workflow /><span>자동화</span><strong>{automations.filter((item) => item.enabled).length}/{automations.length}</strong><small>활성 작업</small></article>
              <article><UsersRound /><span>운영 계정</span><strong>{accounts.length}개</strong><small>브랜드 DB {brands.length}개</small></article>
            </section>

            <section className="admin-band">
              <div className="admin-section-heading">
                <div><span>우선 점검</span><h2>오늘 확인할 운영 항목</h2></div>
                <button type="button" onClick={() => setSection('data')}>데이터룸 열기 <ChevronRight size={15} /></button>
              </div>
              <div className="admin-action-list">
                <button type="button" onClick={() => setSection('data')}>
                  <span className={`admin-status-dot ${summary.rawError ? 'error' : 'ok'}`} />
                  <div><strong>수집 오류·지연</strong><small>오류 {summary.rawError}개 · 지연 {summary.rawDelayed}개</small></div>
                  <ChevronRight size={16} />
                </button>
                <button type="button" onClick={() => setSection('automation')}>
                  <span className="admin-status-dot warning" />
                  <div><strong>자동화 설정</strong><small>{automations.filter((item) => item.status !== '정상').length}개 작업 확인 필요</small></div>
                  <ChevronRight size={16} />
                </button>
                <button type="button" onClick={() => setSection('policy')}>
                  <span className="admin-status-dot ok" />
                  <div><strong>AI 정책 버전</strong><small>{policies.map((item) => `${item.name} ${item.version}`).join(' · ')}</small></div>
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>

            <section className="admin-band">
              <div className="admin-section-heading">
                <div><span>데이터 흐름</span><h2>운영 파이프라인</h2></div>
              </div>
              <div className="admin-pipeline">
                {['정책 설정', '자동 수집', 'Raw 적재', '지표 계산', '운영 승인', '사용자 화면'].map((label, index) => (
                  <div key={label}><b>{index + 1}</b><span>{label}</span>{index < 5 && <ChevronRight size={15} />}</div>
                ))}
              </div>
            </section>
          </div>
        )}

        {section === 'data' && <div className="admin-data-room">{dataRoom}</div>}

        {section === 'policy' && (
          <div className="admin-page admin-policy-layout">
            <section className="admin-policy-list">
              <div className="admin-section-heading"><div><span>정책 목록</span><h2>AI 생성·추천 기준</h2></div></div>
              {policies.map((policy) => (
                <button className={policy.id === selectedPolicy.id ? 'active' : ''} type="button" key={policy.id} onClick={() => setSelectedPolicyId(policy.id)}>
                  <div><strong>{policy.name}</strong><small>{policy.description}</small></div>
                  <span className={`admin-state ${tone(policy.status)}`}>{policy.status}</span>
                </button>
              ))}
            </section>
            <section className="admin-policy-editor">
              <div className="admin-section-heading">
                <div><span>POLICY EDITOR</span><h2>{selectedPolicy.name}</h2></div>
                <span className={`admin-state ${tone(selectedPolicy.status)}`}>{selectedPolicy.status}</span>
              </div>
              <label>정책 설명<textarea value={selectedPolicy.description} onChange={(event) => updatePolicy({ description: event.target.value })} /></label>
              <label>판단 규칙<textarea className="large" value={selectedPolicy.rules} onChange={(event) => updatePolicy({ rules: event.target.value })} /></label>
              <div className="admin-policy-meta">
                <label>버전<input value={selectedPolicy.version} onChange={(event) => updatePolicy({ version: event.target.value })} /></label>
                <label>상태<select value={selectedPolicy.status} onChange={(event) => updatePolicy({ status: event.target.value })}><option>초안</option><option>검토</option><option>승인</option></select></label>
              </div>
              <div className="admin-editor-actions">
                <button type="button" onClick={() => updatePolicy({ status: '검토' })}><Play size={15} /> 테스트 기록</button>
                <button className="primary" type="button" onClick={() => updatePolicy({ status: '승인' })}><Save size={15} /> 저장·승인</button>
              </div>
            </section>
          </div>
        )}

        {section === 'automation' && (
          <div className="admin-page">
            <section className="admin-band">
              <div className="admin-section-heading">
                <div><span>AUTOMATION</span><h2>운영 매크로</h2></div>
                {runMessage && <small className="admin-run-message">{runMessage}</small>}
              </div>
              <div className="admin-table">
                <div className="admin-table-head"><span>작업</span><span>주기</span><span>상태</span><span>최근 실행</span><span>활성</span><span /></div>
                {automations.map((automation) => (
                  <div className="admin-table-row" key={automation.id}>
                    <strong>{automation.name}</strong>
                    <select value={automation.schedule} onChange={(event) => saveAutomations(automations.map((item) => item.id === automation.id ? { ...item, schedule: event.target.value } : item))}>
                      <option>요청 시</option><option>이벤트 발생 시</option><option>매일 1회</option><option>매일 2회</option><option>매시간</option>
                    </select>
                    <span className={`admin-state ${tone(automation.status)}`}>{automation.status}</span>
                    <span>{automation.lastRun}</span>
                    <input type="checkbox" checked={automation.enabled} onChange={() => saveAutomations(automations.map((item) => item.id === automation.id ? { ...item, enabled: !item.enabled } : item))} />
                    <button type="button" disabled={!automation.enabled} onClick={() => runAutomation(automation)}><Play size={14} /> 실행</button>
                  </div>
                ))}
              </div>
            </section>
            <section className="admin-band">
              <div className="admin-section-heading">
                <div><span>연결 상태</span><h2>백엔드·API</h2></div>
                <button type="button" onClick={onTestApis} disabled={apiTestStatus?.running}><RefreshCw size={15} /> {apiTestStatus?.running ? '테스트 중' : '연결 테스트'}</button>
              </div>
              <div className="admin-connection-grid">
                <div><Database /><strong>공유 DB</strong><span>{backendConfig?.hasSupabase ? '설정됨' : '설정 필요'}</span></div>
                <div><KeyRound /><strong>API 서버</strong><span>{backendConfig?.apiBaseUrl ? '연결 주소 설정됨' : '미연결'}</span></div>
                {(apiTestStatus?.results || []).map((item) => <div key={item.id || item.name}><CheckCircle2 /><strong>{item.name || item.label}</strong><span>{item.result || item.status}</span></div>)}
              </div>
            </section>
          </div>
        )}

        {section === 'access' && (
          <div className="admin-page">
            <section className="admin-band">
              <div className="admin-section-heading"><div><span>ACCESS CONTROL</span><h2>계정별 역할·브랜드 DB</h2></div></div>
              <div className="admin-account-table">
                {accounts.map((account) => (
                  <article key={account.id}>
                    <div className="admin-account-identity"><strong>{account.name}</strong><small>{account.email}</small></div>
                    <select value={account.role} onChange={(event) => onUpdateAccountRole(account.id, event.target.value)}>
                      {['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst', 'Client'].map((role) => <option key={role}>{role}</option>)}
                    </select>
                    <div className="admin-brand-access">
                      {brands.map((brand) => {
                        const fullAccess = account.role === 'Owner' || account.role === 'Admin'
                        const checked = fullAccess || account.brandIds?.includes(brand.id)
                        return <label key={brand.id}><input type="checkbox" checked={checked} disabled={fullAccess} onChange={() => onToggleBrandAccess(account.id, brand.id)} />{brand.name}</label>
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {section === 'audit' && (
          <div className="admin-page">
            <section className="admin-band">
              <div className="admin-section-heading"><div><span>AUDIT TRAIL</span><h2>변경·실행 이력</h2></div><small>{auditRows.length}건 표시</small></div>
              <div className="admin-audit-list">
                {auditRows.length ? auditRows.map((row) => (
                  <div key={row.id}><span>{row.type}</span><strong>{row.text}</strong><small>{row.source} · {row.time || '시간 기록 없음'}</small></div>
                )) : <div className="admin-empty"><Clock3 /> 아직 저장된 감사 로그가 없습니다.</div>}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminConsole
