import { useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  Database,
  Filter,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from 'lucide-react'

function statusClass(status = '') {
  if (status === '정상') return 'ok'
  if (status === '지연' || status === '검증 필요' || status === '부분지원') return 'warning'
  if (status === '오류') return 'error'
  if (status === '중단') return 'paused'
  return 'empty'
}

function SelectPill({ icon, label, value, options, onChange }) {
  return (
    <label className="select-pill">
      {icon}
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function StatusPill({ status }) {
  return <span className={`data-status ${statusClass(status)}`}>{status}</span>
}

const ownerDisplayLabels = {
  'Backend/Data': '백엔드/데이터',
  'Frontend/Data': '프론트/데이터',
  'Backend/Login': '백엔드/로그인',
  Backend: '백엔드',
  Engineering: '개발팀',
  'API/Data': 'API/데이터',
  'AI/Data': 'AI/데이터',
  'Data Engineer': '데이터 엔지니어',
  'Data Operator': '데이터 운영',
  'Data QA': '데이터 검수',
  'Report Operator': '리포트 운영',
  'Creative Planner': '콘텐츠 기획',
  Strategist: '전략 기획',
  'Brand Analyst': '브랜드 분석',
  'Brand Manager': '브랜드 매니저',
  'Creator Manager': '크리에이터 운영',
  'Ops Finance': '운영/재무',
  Admin: '운영 관리자',
  PM: 'PM',
}

function ownerLabel(value) {
  return ownerDisplayLabels[value] ?? value
}

function MiniStat({ label, value, tone }) {
  return (
    <article className={`data-room-summary-card${tone ? ` tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function LinkedChipList({ label, items, emptyText, onClick }) {
  return (
    <div className="linked-chip-list">
      <span>{label}</span>
      {items?.length ? (
        items.map((item) => (
          <button type="button" key={item} onClick={() => onClick?.(item)}>
            {item}
          </button>
        ))
      ) : (
        <small>{emptyText}</small>
      )}
    </div>
  )
}

function rawText(item = {}) {
  return [
    item.id,
    item.name,
    item.description,
    item.scope,
    item.category,
    item.method,
    item.cycle,
    item.source,
    item.sourceLocation,
    item.storageLocation,
    item.ownerDept,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isManualRaw(item = {}) {
  const text = rawText(item)
  return /수동|업로드|엑셀|파일|스프레드시트|sheet|csv|xlsx|manual|localstorage|보고서|보완/.test(text)
}

function classifyRawResponsibility(item = {}) {
  const text = rawText(item)

  if (/higgsfield|heygen|provider|생성 provider|이미지 생성|영상 생성|provider job/.test(text)) {
    return 'provider'
  }

  if (/openai|llm|ai\/데이터|프롬프트|전략|가이드|추천|분석\/생성|카피 생성/.test(text)) {
    return 'ai'
  }

  if (/크롤|crawler|수집기|공개 레퍼런스|벤치마크|피드 수집|공개 콘텐츠/.test(text)) {
    return 'crawler'
  }

  if (/api|youtube|instagram|tiktok|meta|google|brave|search|sns|채널\/프로필|매체/.test(text)) {
    return 'mediaApi'
  }

  if (item.scope === '내부' || /db|내부|브랜드|sku|utm|crm|운영 로그|권한|workspace/.test(text)) {
    return 'db'
  }

  return item.scope === '외부' ? 'crawler' : 'db'
}

function getRawComposition(rawIds = [], rawById = new Map()) {
  return Array.from(new Set(rawIds)).reduce(
    (acc, rawId) => {
      const raw = rawById.get(rawId)
      if (!raw) {
        acc.missing += 1
      } else if (isManualRaw(raw)) {
        acc.manual += 1
      } else {
        acc.automated += 1
      }
      return acc
    },
    { manual: 0, automated: 0, missing: 0 },
  )
}

const externalReportRawTypes = [
  {
    id: 'RAW-EXT-MON-WB-001',
    name: 'Video Monitor Workbench 리포트',
    source: '외부 리포트 엑셀 업로드',
    use: '워크벤치 요약, 랭킹, 변화량, 기여도 테이블을 벤치마크 raw로 적재',
  },
  {
    id: 'RAW-EXT-MANUAL-001',
    name: '수동 외부 보고서 보완 raw',
    source: '외부 리포트 엑셀 업로드',
    use: 'API로 재수집할 수 없는 과거 보고서/광고주 전달 파일을 보완 원천으로 적재',
  },
]

const apiRawTypes = [
  {
    id: 'RAW-EXT-MON-INF-001',
    name: '브랜드 모니터 인플루언서 API raw',
    source: '모니터링 API',
    use: '브랜드/경쟁사 기준 관련 크리에이터, 언급량, 예상 노출을 행 단위로 적재',
  },
  {
    id: 'RAW-EXT-MON-VIDEO-001',
    name: 'Video Monitor Data API raw',
    source: '모니터링 API',
    use: '영상별 조회수, 좋아요, 댓글, 참여율, 일자별 변화 raw를 적재',
  },
  {
    id: 'RAW-EXT-SEARCH-001',
    name: '검색/발굴 API raw',
    source: 'YouTube Data API, Search API, 공개 프로필 수집',
    use: '키워드/국가/플랫폼 조건으로 후보 URL과 기본 프로필 후보를 수집',
  },
  {
    id: 'RAW-EXT-CHN-001',
    name: '채널/프로필 API raw',
    source: 'YouTube channels, Instagram/TikTok 공개 프로필 확인',
    use: '팔로워, 채널명, 국가 추정, 검증 상태와 원천 URL을 저장',
  },
  {
    id: 'RAW-EXT-CONT-001',
    name: '콘텐츠 성과 API raw',
    source: 'YouTube videos, 공개 콘텐츠 링크 스냅샷',
    use: '업로드 링크의 조회수, 좋아요, 댓글, 저장/공유 가능 지표를 추적',
  },
  {
    id: 'RAW-EXT-REF-001',
    name: '콘텐츠 레퍼런스 API raw',
    source: 'Search API + 공개 메타데이터',
    use: '터진 콘텐츠 검색 결과와 저장 레퍼런스를 제작 가이드 재료로 저장',
  },
]

export default function AdminDataRoom({
  summary,
  rawData = [],
  allRawData = rawData,
  groupedMetrics = [],
  allMetrics = [],
  workflowCoverage = [],
  pendingBundles = [],
  rawTab,
  setRawTab,
  rawStatus,
  setRawStatus,
  rawCategory,
  setRawCategory,
  rawMethod,
  setRawMethod,
  rawOwner,
  setRawOwner,
  rawQuery,
  setRawQuery,
  metricTab,
  setMetricTab,
  metricStatus,
  setMetricStatus,
  metricBundle,
  setMetricBundle,
  setMetricQuery,
  rawCategories,
  rawMethods,
  rawOwners,
  selectedItem,
  setSelectedItem,
  activeDetail,
  rawStatuses,
  metricStatuses,
  scopes,
  onImportExternalReport,
  onDownloadExternalReportTemplate,
  apiStatus,
  onRefreshApiStatus,
  apiEvents = [],
  onRefreshApiEvents,
  onLog,
  onRefreshRaw,
  onMetricLog,
  onRecalculate,
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [apiDiagnosticsOpen, setApiDiagnosticsOpen] = useState(false)
  const [openMetricBundles, setOpenMetricBundles] = useState({})
  const rawRegistryRef = useRef(null)
  const metricRegistryRef = useRef(null)
  const importPanelRef = useRef(null)
  const apiStatusPanelRef = useRef(null)
  const apiLogPanelRef = useRef(null)
  const scrollToPanel = (ref) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }
  const scrollToRegistryTarget = (selector, fallbackRef) => {
    window.setTimeout(() => {
      const target = document.querySelector(selector)
      ;(target || fallbackRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }
  const metricRegistry = allMetrics?.length ? allMetrics : groupedMetrics.flatMap((group) => group.metrics)
  const bonusMetricBundleName = 'LLM 번외 데이터 번들'
  const isCoreMetricBundle = (bundle) => bundle !== bonusMetricBundleName
  const visibleMetricRegistry = metricRegistry.filter((metric) => isCoreMetricBundle(metric.bundle))
  const metricBundleOptions = ['전체', ...new Set(visibleMetricRegistry.map((metric) => metric.bundle))]
  const selectedMetricBundle = metricBundleOptions.includes(metricBundle) ? metricBundle : '전체'
  const metricBundleKey = (scope, bundle) => `${scope || '전체'}__${bundle || '미분류'}`
  const metricBundleDomId = (scope, bundle) =>
    `metric-bundle-${Array.from(metricBundleKey(scope, bundle))
      .map((character) => character.charCodeAt(0).toString(36))
      .join('-')}`
  const getMetricById = (metricId) => metricRegistry.find((metric) => metric.id === metricId)
  const toggleMetricBundle = (scope, bundle) => {
    const key = metricBundleKey(scope, bundle)
    setOpenMetricBundles((current) => ({ ...current, [key]: !current[key] }))
  }
  const openMetricBundle = (metric) => {
    if (!metric) return
    setOpenMetricBundles((current) => ({
      ...current,
      [metricBundleKey(metric.scope, metric.bundle)]: true,
    }))
  }
  const jumpToMetricBundle = (bundle) => {
    const nextBundle = metricBundleOptions.includes(bundle) ? bundle : '전체'
    setMetricBundle(nextBundle)
    if (nextBundle === '전체') {
      scrollToPanel(metricRegistryRef)
      return
    }
    const targetMetric = visibleMetricRegistry.find((metric) => metric.bundle === nextBundle && (metricTab === '전체' || metric.scope === metricTab))
    if (!targetMetric) return
    openMetricBundle(targetMetric)
    window.setTimeout(() => {
      document.getElementById(metricBundleDomId(targetMetric.scope, targetMetric.bundle))?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 120)
  }
  const metricStatusBase = visibleMetricRegistry.filter((metric) => {
    const matchesTab = metricTab === '전체' || metric.scope === metricTab
    const matchesBundle = selectedMetricBundle === '전체' || metric.bundle === selectedMetricBundle
    return matchesTab && matchesBundle
  })
  const metricStatusCounts = metricStatuses.reduce((acc, status) => {
    acc[status] = status === '전체' ? metricStatusBase.length : metricStatusBase.filter((metric) => metric.status === status).length
    return acc
  }, {})
  const metricScopeGroups = scopes
    .filter((scope) => scope !== '전체' && (metricTab === '전체' || metricTab === scope))
    .map((scope) => ({
      scope,
      groups: groupedMetrics
        .map((group) => ({
          ...group,
          metrics: group.metrics.filter((metric) => metric.scope === scope && isCoreMetricBundle(metric.bundle)),
        }))
        .filter((group) => group.metrics.length),
    }))
    .filter((group) => group.groups.length)
  const selectRaw = (rawId, options = {}) => {
    setSelectedItem({ type: 'raw', id: rawId })
    setDetailOpen(true)
    if (options.scroll) {
      setRawTab('전체')
      setRawStatus('전체')
      setRawCategory('전체')
      setRawMethod('전체')
      setRawOwner('전체')
      setRawQuery('')
      scrollToRegistryTarget(`[data-raw-id="${String(rawId).replace(/"/g, '\\"')}"]`, rawRegistryRef)
    }
  }
  const selectMetric = (metricId, options = {}) => {
    const metric = getMetricById(metricId)
    openMetricBundle(metric)
    setSelectedItem({ type: 'metric', id: metricId })
    setDetailOpen(true)
    if (options.scroll) {
      setMetricTab('전체')
      setMetricStatus('전체')
      setMetricBundle('전체')
      setMetricQuery('')
      if (metric) {
        window.setTimeout(() => {
          document.getElementById(metricBundleDomId(metric.scope, metric.bundle))?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        }, 120)
      }
      scrollToRegistryTarget(`[data-metric-id="${String(metricId).replace(/"/g, '\\"')}"]`, metricRegistryRef)
    }
  }
  const rawRegistry = allRawData?.length ? allRawData : rawData
  const rawById = new Map(rawRegistry.map((item) => [item.id, item]))
  const externalReportRawIds = new Set(externalReportRawTypes.map((item) => item.id))
  const apiRawIds = new Set(apiRawTypes.map((item) => item.id))
  const externalReportRawCount = rawRegistry.filter((item) => externalReportRawIds.has(item.id)).length
  const externalApiRawCount = rawRegistry.filter((item) => apiRawIds.has(item.id)).length
  const apiLogCount = apiEvents?.length || 0
  const coverageSummary = workflowCoverage.reduce(
    (acc, item) => {
      acc.total += 1
      if (item.status === '정상') acc.ok += 1
      if (item.status === '오류') acc.error += 1
      if (item.status !== '정상') acc.needsReview += 1
      acc.missingRaw += item.missingRaw?.length || 0
      acc.missingMetrics += item.missingMetrics?.length || 0
      acc.conditionalRaw += item.conditionalRawIds?.length || 0
      acc.conditionalRawAvailable += item.availableConditionalRaw?.length || 0
      return acc
    },
    { total: 0, ok: 0, needsReview: 0, error: 0, missingRaw: 0, missingMetrics: 0, conditionalRaw: 0, conditionalRawAvailable: 0 },
  )
  const responsibilityCounts = rawRegistry.reduce(
    (acc, item) => {
      const key = classifyRawResponsibility(item)
      acc[key] += 1
      return acc
    },
    { mediaApi: 0, crawler: 0, ai: 0, provider: 0, db: 0 },
  )
  const responsibilityGroups = [
    {
      key: 'mediaApi',
      label: '매체/API',
      count: responsibilityCounts.mediaApi,
      description: '광고 계정 세팅, 성과 수집, 예산/ON-OFF처럼 매체 권한이 필요한 원천입니다.',
      query: 'API raw',
      tab: '외부',
    },
    {
      key: 'crawler',
      label: '크롤러/수집기',
      count: responsibilityCounts.crawler,
      description: '공개 레퍼런스, 피드, 경쟁사 소재처럼 API 한계가 있는 자료 수집 영역입니다.',
      query: '레퍼런스',
      tab: '전체',
    },
    {
      key: 'ai',
      label: 'OpenAI 분석/생성',
      count: responsibilityCounts.ai,
      description: '전략, 카피, 프롬프트, 리포트 코멘트, 위닝 패턴 분석처럼 판단/생성하는 영역입니다.',
      query: 'AI',
      tab: '전체',
    },
    {
      key: 'provider',
      label: '생성 Provider',
      count: responsibilityCounts.provider,
      description: 'Higgsfield, HeyGen 등 이미지/영상 생성 결과와 provider job을 관리하는 영역입니다.',
      query: 'Provider',
      tab: '전체',
    },
    {
      key: 'db',
      label: '내부 DB',
      count: responsibilityCounts.db,
      description: '브랜드, SKU, UTM, 미디어믹스, 운영 로그처럼 솔루션 내부 기준 데이터입니다.',
      query: '',
      tab: '내부',
    },
  ]
  const workflowStatusSummary = workflowCoverage.reduce(
    (acc, item) => {
      const hasExceptionRaw = item.rawIds?.includes('RAW-EXT-UNSUPPORTED-001')
      if (item.status === '정상') acc.complete += 1
      else if (item.status === '오류') acc.missing += 1
      else if (hasExceptionRaw || item.status === '부분지원') acc.exception += 1
      else acc.partial += 1
      return acc
    },
    { complete: 0, partial: 0, exception: 0, missing: 0 },
  )
  const workflowRawIds = Array.from(new Set(workflowCoverage.flatMap((item) => item.rawIds || [])))
  const workflowMetricIds = Array.from(new Set(workflowCoverage.flatMap((item) => item.metricIds || [])))
  const workflowComposition = {
    ...getRawComposition(workflowRawIds, rawById),
    computed: workflowMetricIds.length,
  }
  const jumpToCoverageIssue = (item) => {
    const firstMissingRaw = item.missingRaw?.[0]
    const firstMissingMetric = item.missingMetrics?.[0]
    if (firstMissingRaw) {
      selectRaw(firstMissingRaw, { scroll: true })
      return
    }
    if (firstMissingMetric) {
      selectMetric(firstMissingMetric, { scroll: true })
    }
  }
  const focusResponsibilityGroup = (group) => {
    setRawTab(group.tab)
    setRawStatus('전체')
    setRawCategory('전체')
    setRawMethod('전체')
    setRawOwner('전체')
    setRawQuery(group.query)
    scrollToPanel(rawRegistryRef)
  }
  const renderLineageTokens = (ids = [], type = 'raw') => (
    <div className="lineage-token-stack">
      {ids.length ? (
        ids.slice(0, 4).map((id) => (
          <button
            type="button"
            className="lineage-token"
            key={id}
            onClick={() => (type === 'metric' ? selectMetric(id, { scroll: true }) : selectRaw(id, { scroll: true }))}
          >
            {id}
          </button>
        ))
      ) : (
        <small>연결 없음</small>
      )}
      {ids.length > 4 ? <small>+{ids.length - 4}개</small> : null}
    </div>
  )
  const getWorkflowTreatment = (item, composition) => {
    if (item.missingRaw?.length || item.missingMetrics?.length || composition.missing) return '누락 raw/지표 등록 필요'
    if (item.rawIds?.includes('RAW-EXT-UNSUPPORTED-001')) return '번외 raw로 보류 관리'
    if (item.missingConditionalRaw?.length) return '조건부 raw 적재 시 반영'
    return '매핑 완료'
  }
  const currentRawSource = (() => {
    if (rawQuery === '리포트 raw') return 'report'
    if (rawQuery === 'API raw') return 'api'
    return 'all'
  })()
  const showAllRaw = () => {
    setRawTab('전체')
    setRawStatus('전체')
    setRawCategory('전체')
    setRawMethod('전체')
    setRawOwner('전체')
    setRawQuery('')
  }
  const showExternalReportRaw = () => {
    setRawTab('외부')
    setRawStatus('전체')
    setRawCategory('전체')
    setRawMethod('전체')
    setRawOwner('전체')
    setRawQuery('리포트 raw')
  }
  const showExternalApiRaw = () => {
    setRawTab('외부')
    setRawStatus('전체')
    setRawCategory('전체')
    setRawMethod('전체')
    setRawOwner('전체')
    setRawQuery('API raw')
  }

  return (
    <section className="data-room-page">
      <section className="data-room-summary-wrap" aria-label="어드민 데이터룸 요약">
        <div className="dashboard-section-label">
          <span className="mini-label">핵심 지표</span>
          <small>수집 상태 요약</small>
        </div>
        <div className="data-room-summary primary">
          <MiniStat label="Raw 전체" value={`${summary.rawTotal}개`} />
          <MiniStat label="정상 수집" value={`${summary.rawOk}개`} tone="ok" />
          <MiniStat label="오류" value={`${summary.rawError}개`} tone="error" />
          <MiniStat label="계산지표" value={`${summary.metricTotal}개`} />
        </div>
        <div className="data-room-summary secondary">
          <MiniStat label="지연" value={`${summary.rawDelayed}개`} tone="warning" />
          <MiniStat label="중단" value={`${summary.rawPaused}개`} tone="paused" />
          <MiniStat label="내부/외부" value={`${summary.internal}/${summary.external}`} />
          <MiniStat label="지표 오류" value={`${summary.metricError}개`} tone="error" />
          <MiniStat label="마지막 동기화" value={summary.lastSync} />
        </div>
      </section>

      <section className="panel data-room-ops-panel" aria-label="data room operation checks">
        <div className="data-room-ops-heading">
          <div>
            <span className="mini-label">{'\uC6B4\uC601 \uC810\uAC80'}</span>
            <h2>{'\uB370\uC774\uD130\uB8F8 \uC624\uB298 \uD655\uC778\uD560 \uAC83'}</h2>
          </div>
          <small>{'\uC5C5\uB85C\uB4DC, API \uC0C1\uD0DC, \uB85C\uADF8, \uC9C0\uD45C \uC5F0\uACB0\uC744 \uBC14\uB85C \uC810\uAC80\uD569\uB2C8\uB2E4.'}</small>
        </div>
        <div className="data-room-ops-grid">
          <button type="button" onClick={() => scrollToPanel(importPanelRef)}>
            <small>{'\uB9AC\uD3EC\uD2B8 raw'}</small>
            <strong>{externalReportRawCount}{'\uAC1C'}</strong>
            <span>{externalReportRawCount ? '\uC5C5\uB85C\uB4DC \uC6D0\uCC9C \uD655\uC778' : '\uBCF4\uC644 \uC5D1\uC140 \uC5C5\uB85C\uB4DC \uB300\uAE30'}</span>
          </button>
          <button type="button" onClick={() => scrollToPanel(apiStatusPanelRef)}>
            <small>{'API raw'}</small>
            <strong>{externalApiRawCount}{'\uAC1C'}</strong>
            <span>{apiStatus?.ok ? '\uC801\uC7AC \uAC00\uB2A5' : '\uC124\uC815 \uD655\uC778 \uD544\uC694'}</span>
          </button>
          <button type="button" onClick={() => scrollToPanel(apiLogPanelRef)}>
            <small>{'\uC218\uC9D1 \uB85C\uADF8'}</small>
            <strong>{apiLogCount}{'\uAC74'}</strong>
            <span>{apiLogCount ? '\uCD5C\uADFC \uC774\uBCA4\uD2B8 \uD655\uC778' : '\uBC1C\uAD74/\uB808\uD37C\uB7F0\uC2A4 \uC2E4\uD589 \uD6C4 \uB204\uC801'}</span>
          </button>
          <button type="button" onClick={() => scrollToPanel(metricRegistryRef)}>
            <small>{'\uC9C0\uD45C \uC5F0\uACB0'}</small>
            <strong>{coverageSummary.ok}/{coverageSummary.total}</strong>
            <span>{coverageSummary.needsReview ? '\uB204\uB77D raw/\uC9C0\uD45C \uD655\uC778' : '\uD504\uB860\uD2B8 \uC5F0\uACB0 \uC815\uC0C1'}</span>
          </button>
        </div>
      </section>

      <section className="panel data-responsibility-panel" aria-label="데이터룸 구분 목록">
        <div className="data-room-map-heading">
          <div>
            <span className="mini-label">DATA RESPONSIBILITY MAP</span>
            <h2>데이터룸 구분 목록</h2>
            <p>프론트 기능은 아래 raw 처리 주체를 통해 수집, 판단, 생성, 저장 경로를 분리합니다.</p>
          </div>
          <span className="section-count-badge">5개 구분</span>
        </div>
        <div className="responsibility-card-grid">
          {responsibilityGroups.map((group) => (
            <button
              type="button"
              className={`responsibility-card ${group.key}`}
              key={group.key}
              onClick={() => focusResponsibilityGroup(group)}
            >
              <span>{group.label}</span>
              <strong>{group.count}개</strong>
              <p>{group.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="panel data-room-snapshot-panel" aria-label="raw to metric snapshots">
        <div>
          <span className="mini-label">LIVE PIPELINE STORAGE</span>
          <h2>Raw to metric snapshots</h2>
          <p>운영 대시보드가 마지막으로 계산한 raw 정규화와 계산지표 스냅샷을 이곳에서 확인합니다.</p>
        </div>
        <div className="snapshot-strip">
          <span>최근 동기화 {summary.lastSync}</span>
          <span>raw {summary.rawTotal}개</span>
          <span>계산지표 {summary.metricTotal}개</span>
          <span>프론트 매핑 {coverageSummary.ok}/{coverageSummary.total}</span>
        </div>
      </section>

      <section className="panel data-room-panel data-room-dashboard-map">
        <div className="panel-heading">
          <div>
            <span className="mini-label">DATAROOM TO DASHBOARD</span>
            <h2>프론트 기능 raw 매핑 검증</h2>
            <p>프론트에 보이는 기능은 반드시 데이터룸 raw 데이터와 계산지표에 연결됩니다. 정식 API가 없으면 번외 raw 또는 수동 업로드 raw로 계산 흐름을 유지합니다.</p>
          </div>
          <div className="coverage-score-grid" aria-label="프론트 기능 raw 매핑 상태">
            <span className="ok"><strong>{workflowStatusSummary.complete}</strong>완료</span>
            <span className="warning"><strong>{workflowStatusSummary.partial}</strong>부분</span>
            <span className="info"><strong>{workflowStatusSummary.exception}</strong>번외</span>
            <span className="error"><strong>{workflowStatusSummary.missing}</strong>누락</span>
          </div>
        </div>
        <div className="dashboard-map-chip-row">
          <span>수동 데이터 {workflowComposition.manual}개</span>
          <span>자동 데이터 {workflowComposition.automated}개</span>
          <span>계산데이터 {workflowComposition.computed}개</span>
          {workflowComposition.missing ? <span>미등록 raw {workflowComposition.missing}개</span> : null}
        </div>
        <div className="workflow-coverage-table-wrap">
          <table className="workflow-coverage-table">
            <thead>
              <tr>
                <th>영역</th>
                <th>프론트 기능</th>
                <th>연결 raw 데이터</th>
                <th>데이터 구성</th>
                <th>연결 계산지표</th>
                <th>상태</th>
                <th>데이터룸 처리</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {workflowCoverage.map((item) => {
                const composition = getRawComposition(item.rawIds || [], rawById)
                return (
                  <tr key={item.id}>
                    <td><strong>{item.frontendArea}</strong></td>
                    <td>
                      <strong>{item.featureName}</strong>
                      <span>{item.rule}</span>
                    </td>
                    <td>{renderLineageTokens(item.rawIds || [], 'raw')}</td>
                    <td>
                      <div className="data-composition-chips">
                        <span>수동 {composition.manual}</span>
                        <span>자동 {composition.automated}</span>
                        <span>계산 {item.metricIds?.length || 0}</span>
                        {composition.missing ? <span className="error">미등록 {composition.missing}</span> : null}
                      </div>
                    </td>
                    <td>{renderLineageTokens(item.metricIds || [], 'metric')}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td>
                      {(item.missingRaw?.length || item.missingMetrics?.length || composition.missing) ? (
                        <button className="coverage-action-button" type="button" onClick={() => jumpToCoverageIssue(item)}>
                          누락 확인
                        </button>
                      ) : (
                        <span className="coverage-note">{getWorkflowTreatment(item, composition)}</span>
                      )}
                    </td>
                    <td><span className="coverage-note">{item.algorithm}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel data-room-import-panel" ref={importPanelRef}>
        <div>
          <span className="mini-label">리포트 원천 적재</span>
          <h2>리포트 raw 적재</h2>
          <p>엑셀 보완 raw는 여기서 업로드하고, 적재된 원천은 아래 Raw 데이터 관리에서 확인합니다.</p>
        </div>
        <div className="data-room-import-actions">
          <span className="section-count-badge">리포트 raw {externalReportRawCount}개</span>
          <button className="secondary-button compact-button" type="button" onClick={onDownloadExternalReportTemplate}>
            보완 raw 양식
          </button>
          <label className="primary-button compact-button">
            엑셀 업로드
            <input type="file" accept=".xlsx,.xls" hidden onChange={onImportExternalReport} />
          </label>
        </div>
      </section>

      <section className="panel data-room-api-status-panel" ref={apiStatusPanelRef}>
        <div className="api-status-compact-row">
          <div>
            <span className="mini-label">API 원천 적재</span>
            <h2>API raw 적재 상태</h2>
          </div>
          <div className="api-status-compact-actions">
            <span className="section-count-badge">API raw {externalApiRawCount}개</span>
            <span className={`data-status ${apiStatus?.ok ? 'ok' : 'warning'}`}>
              {apiStatus?.ok ? '연결됨' : '설정 확인 필요'}
            </span>
            <span className="api-log-count">로그 {apiLogCount}건</span>
            <button className="secondary-button compact-button" type="button" onClick={onRefreshApiStatus}>
              상태 확인
            </button>
            <button className="secondary-button compact-button" type="button" onClick={() => setApiDiagnosticsOpen((value) => !value)}>
              {apiDiagnosticsOpen ? '진단 닫기' : '진단 보기'}
            </button>
          </div>
        </div>
        {apiDiagnosticsOpen && apiStatus?.payload?.dataRoomLogging && (
          <div className={`sync-status-card ${apiStatus?.ok ? 'success' : 'warning'}`}>
            <Database size={22} />
            <div>
              <strong>{apiStatus?.ok ? '데이터룸 API 적재 준비 완료' : '데이터룸 API 적재 설정 필요'}</strong>
              <small>
                워크스페이스 {apiStatus.payload.dataRoomLogging.workspaceId} · API 이벤트 저장{' '}
                {apiStatus.payload.dataRoomLogging.hasSupabaseUrl && apiStatus.payload.dataRoomLogging.hasServiceRoleKey
                  ? '가능'
                  : '설정 필요'}
              </small>
            </div>
          </div>
        )}
        {apiDiagnosticsOpen && apiStatus?.payload?.checks && (
          <div className="api-status-check-grid">
            {Object.entries(apiStatus.payload.checks).map(([table, check]) => (
              <span className={`api-status-check ${check.ok ? 'ok' : 'error'}`} key={table}>
                {table}: {check.ok ? `OK ${check.count ?? 0}` : check.message}
              </span>
            ))}
          </div>
        )}
        {apiDiagnosticsOpen && apiStatus?.payload?.dataRoomLogging?.missingEnv?.length > 0 && (
          <div className="api-status-action-box">
            <strong>누락된 서버 환경변수</strong>
            <div className="api-status-check-grid">
              {apiStatus.payload.dataRoomLogging.missingEnv.map((key) => (
                <span className="api-status-check error" key={key}>{key}</span>
              ))}
            </div>
          </div>
        )}
        {apiDiagnosticsOpen && apiStatus?.payload?.dataRoomLogging?.nextActions?.length > 0 && (
          <div className="api-status-action-box">
            <strong>다음 조치</strong>
            <ol>
              {apiStatus.payload.dataRoomLogging.nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </div>
        )}
        <div className="api-status-log-preview" ref={apiLogPanelRef}>
          <div className="api-status-log-heading">
            <div>
              <strong>최근 수집 로그</strong>
              <small>{apiLogCount ? `최근 ${Math.min(apiEvents.length, 3)}건 표시 · 전체 ${apiLogCount}건` : '아직 저장된 API 이벤트가 없습니다.'}</small>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={onRefreshApiEvents}>
              새로고침
            </button>
          </div>
          <div className="api-event-list">
            {apiEvents?.length ? (
              apiEvents.slice(0, 3).map((event) => (
                <button type="button" className="api-event-row" key={event.id} onClick={() => selectRaw(event.raw_source_id, { scroll: true })}>
                  <span className={`data-status ${event.status === 'success' ? 'ok' : event.status === 'partial' ? 'warning' : 'error'}`}>{event.status}</span>
                  <strong>{event.provider}</strong>
                  <span>{event.endpoint}</span>
                  <span>{event.platform || '-'} · {event.country || '-'}</span>
                  <span className="api-event-query">{event.query || '-'}</span>
                  <span>{event.result_count}건</span>
                  <small>{event.error_message || new Date(event.created_at).toLocaleString('ko-KR')}</small>
                </button>
              ))
            ) : (
              <div className="api-event-empty">
                발굴, 레퍼런스, 콘텐츠 갱신 API를 실행하면 이곳에 최근 raw 수집 이벤트가 표시됩니다.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="data-room-layout">
        <div className="data-room-main">
          <section className="panel data-room-panel" ref={rawRegistryRef}>
            <div className="panel-heading">
              <div>
                <span className="mini-label">Raw 데이터 저장소</span>
                <h2>Raw 데이터 관리</h2>
              </div>
              <div className="panel-heading-actions">
                <span className="section-count-badge">전체 raw {rawRegistry.length}개</span>
                {scopes.map((scope) => (
                  <button
                    className={`segmented-button ${rawTab === scope ? 'active' : ''}`}
                    type="button"
                    key={scope}
                    onClick={() => setRawTab(scope)}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-bar data-room-filters">
              <label className="search-box">
                <Search size={16} />
                <input
                  value={rawQuery}
                  onChange={(event) => setRawQuery(event.target.value)}
                  placeholder="데이터명, 원천 위치, 담당자 검색"
                />
              </label>
              <SelectPill label="상태" icon={<Filter size={15} />} value={rawStatus} options={rawStatuses} onChange={setRawStatus} />
              <SelectPill label="카테고리" icon={<Database size={15} />} value={rawCategory} options={rawCategories} onChange={setRawCategory} />
              <SelectPill label="수집 방식" icon={<RefreshCw size={15} />} value={rawMethod} options={rawMethods} onChange={setRawMethod} />
              <SelectPill label="소유 부서" icon={<UsersRound size={15} />} value={rawOwner} options={rawOwners} onChange={setRawOwner} />
            </div>

            <div className="raw-source-shortcuts">
              <span>표시 범위</span>
              <button
                type="button"
                aria-label="리포트 원천 데이터만 보기"
                className={currentRawSource === 'report' ? 'active' : ''}
                onClick={showExternalReportRaw}
              >
                리포트 원천
              </button>
              <button
                type="button"
                aria-label="API 원천 데이터만 보기"
                className={currentRawSource === 'api' ? 'active' : ''}
                onClick={showExternalApiRaw}
              >
                API 원천
              </button>
              <button
                type="button"
                aria-label="전체 원천 데이터 보기"
                className={currentRawSource === 'all' ? 'active' : ''}
                onClick={showAllRaw}
              >
                전체 원천
              </button>
            </div>

            <div className="data-room-table-wrap">
              <table className="data-room-table">
                <thead>
                  <tr>
                    <th>데이터 ID</th>
                    <th>데이터명</th>
                    <th>구분</th>
                    <th>카테고리</th>
                    <th>수집 방식/주기</th>
                    <th>상태</th>
                    <th>원천 위치</th>
                    <th>저장 위치</th>
                    <th>연결 지표</th>
                    <th>담당</th>
                  </tr>
                </thead>
                <tbody>
                  {rawData.map((item) => (
                    <tr
                      key={item.id}
                      data-raw-id={item.id}
                      className={selectedItem.type === 'raw' && selectedItem.id === item.id ? 'active' : ''}
                      onClick={() => selectRaw(item.id)}
                    >
                      <td><strong>{item.id}</strong></td>
                      <td>
                        <strong>{item.name}</strong>
                        <span>{item.description}</span>
                      </td>
                      <td>{item.scope}</td>
                      <td>{item.category}</td>
                      <td>
                        <strong>{item.method}</strong>
                        <span>{item.cycle}</span>
                      </td>
                      <td><StatusPill status={item.status} /></td>
                      <td>{item.sourceLocation}</td>
                      <td>{item.storageLocation}</td>
                      <td>{item.metricIds.length ? item.metricIds.join(', ') : '-'}</td>
                      <td>
                        <strong>{item.ownerDept}</strong>
                        <span>{ownerLabel(item.opsOwner)} / {ownerLabel(item.techOwner)}</span>
                      </td>
                    </tr>
                  ))}
                  {!rawData.length && (
                    <tr><td colSpan="10" className="empty-table-cell">조건에 맞는 raw 데이터가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-room-actions-row">
              <button className="secondary-button compact-button" type="button" onClick={onLog}>수집 로그 보기</button>
              <button className="primary-button compact-button" type="button" onClick={onRefreshRaw}>재수집 요청</button>
            </div>
          </section>

          <section className="panel data-room-panel" ref={metricRegistryRef}>
            <div className="panel-heading">
              <div>
                <span className="mini-label">계산지표 저장소</span>
                <h2>계산지표 관리</h2>
                <p>현재 앱에서 쓰는 실제 계산지표 번들을 내부/외부 기준으로 접어 관리합니다.</p>
              </div>
              <div className="panel-heading-actions">
                {scopes.map((scope) => (
                  <button
                    className={`segmented-button ${metricTab === scope ? 'active' : ''}`}
                    type="button"
                    key={scope}
                    onClick={() => setMetricTab(scope)}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-bar data-room-filters metric-filter-bar">
              <div className="metric-status-chip-row" aria-label="계산 상태 필터">
                {metricStatuses.map((status) => (
                  <button
                    type="button"
                    className={`status-filter-chip ${metricStatus === status ? 'active' : ''} ${statusClass(status)}`}
                    key={status}
                    onClick={() => setMetricStatus(status)}
                  >
                    {status}
                    <span>{metricStatusCounts[status] ?? 0}</span>
                  </button>
                ))}
              </div>
              <SelectPill
                label="번들 바로가기"
                icon={<ClipboardList size={15} />}
                value={selectedMetricBundle}
                options={metricBundleOptions}
                onChange={jumpToMetricBundle}
              />
            </div>

            <div className="metric-bundle-list">
              {metricScopeGroups.map((scopeGroup) => (
                <section className="metric-scope-group" key={scopeGroup.scope}>
                  <div className="metric-scope-heading">
                    <span>{scopeGroup.scope}</span>
                    <small>{scopeGroup.groups.reduce((sum, group) => sum + group.metrics.length, 0)}개 지표</small>
                  </div>
                  {scopeGroup.groups.map((group) => {
                    const bundleKey = metricBundleKey(scopeGroup.scope, group.bundle)
                    const isOpen = Boolean(openMetricBundles[bundleKey])
                    const okCount = group.metrics.filter((metric) => metric.status === '정상').length
                    const reviewCount = group.metrics.filter((metric) => ['검증 필요', '지연'].includes(metric.status)).length
                    const errorCount = group.metrics.filter((metric) => metric.status === '오류').length
                    return (
                      <article className={`metric-bundle ${isOpen ? 'open' : ''}`} id={metricBundleDomId(scopeGroup.scope, group.bundle)} key={bundleKey}>
                        <button
                          type="button"
                          className="metric-bundle-heading"
                          aria-expanded={isOpen}
                          onClick={() => toggleMetricBundle(scopeGroup.scope, group.bundle)}
                        >
                          <div>
                            <span className="mini-label">{scopeGroup.scope} 지표 번들</span>
                            <strong>{group.bundle}</strong>
                            <small>{group.metrics.length}개 세부지표</small>
                          </div>
                          <div className="metric-bundle-badges">
                            <span className="metric-count-badge ok">정상 {okCount}</span>
                            <span className="metric-count-badge warning">검증 {reviewCount}</span>
                            {errorCount ? <span className="metric-count-badge error">오류 {errorCount}</span> : null}
                            <ChevronDown size={18} className="metric-bundle-chevron" />
                          </div>
                        </button>
                        {isOpen && (
                          <div className="metric-bundle-items">
                            {group.metrics.map((metric) => (
                              <button
                                type="button"
                                data-metric-id={metric.id}
                                className={`metric-row-button ${selectedItem.type === 'metric' && selectedItem.id === metric.id ? 'active' : ''}`}
                                key={metric.id}
                                onClick={() => selectMetric(metric.id)}
                              >
                                <div className="metric-row-main">
                                  <span>{metric.id}</span>
                                  <strong>{metric.name}</strong>
                                  <small>{metric.description}</small>
                                </div>
                                <div className="metric-row-raw">
                                  <span>사용 raw</span>
                                  <small>{metric.rawNames?.slice(0, 2).join(' · ') || '연결 raw 없음'}</small>
                                </div>
                                <code className="metric-formula-chip">{metric.formula}</code>
                                <StatusPill status={metric.status} />
                              </button>
                            ))}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </section>
              ))}
              {!metricScopeGroups.length && <div className="empty-table-cell">조건에 맞는 계산지표가 없습니다.</div>}
            </div>

            <div className="data-room-actions-row">
              <button className="secondary-button compact-button" type="button" onClick={onMetricLog}>오류 로그 확인</button>
              <button className="primary-button compact-button" type="button" onClick={onRecalculate}>재계산 요청</button>
            </div>
          </section>

          <section className="panel data-room-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">번외 데이터</span>
                <h2>번외 데이터 번들</h2>
                <p>공식 API나 현재 저장소로 완전히 구현되지 않은 기능은 여기에서 보류/대체 수집 기준을 추적합니다.</p>
              </div>
              <AlertTriangle size={18} />
            </div>
            <div className="pending-bundle-list">
              {pendingBundles.map((bundle) => (
                <article className="pending-bundle-card" key={bundle.id}>
                  <div>
                    <strong>{bundle.name}</strong>
                    <StatusPill status={bundle.status} />
                  </div>
                  <p>{bundle.reason}</p>
                  <dl>
                    <div><dt>대체 원천</dt><dd>{bundle.source}</dd></div>
                    <div><dt>저장 위치</dt><dd>{bundle.storage}</dd></div>
                    <div><dt>다음 액션</dt><dd>{bundle.nextAction}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </div>

        {detailOpen && activeDetail && (
        <aside className="panel data-room-detail-panel data-room-detail-drawer" role="complementary" aria-label="데이터룸 상세">
          <div className="panel-heading">
            <div>
              <span className="mini-label">상세 보기</span>
              <h2>{selectedItem.type === 'metric' ? '지표 상세' : 'Raw 데이터 상세'}</h2>
            </div>
            <div className="panel-heading-actions">
              <StatusPill status={activeDetail?.status} />
              <button className="icon-button" type="button" title="닫기" onClick={() => setDetailOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </div>

          {activeDetail && selectedItem.type === 'raw' && (
            <div className="data-room-detail-stack">
              <div className="detail-title-block">
                <strong>{activeDetail.name}</strong>
                <span>{activeDetail.id} · {activeDetail.scope} · {activeDetail.category}</span>
              </div>
              <dl>
                <div><dt>수집 목적</dt><dd>{activeDetail.purpose}</dd></div>
                <div><dt>수집 방식</dt><dd>{activeDetail.method}</dd></div>
                <div><dt>최근/다음 수집</dt><dd>{activeDetail.lastCollectedAt} / {activeDetail.nextCollectAt}</dd></div>
                <div><dt>원천 위치</dt><dd>{activeDetail.sourceLocation}</dd></div>
                <div><dt>저장 위치</dt><dd>{activeDetail.storageLocation}</dd></div>
                <div><dt>대시보드 사용</dt><dd>{activeDetail.dashboardArea}</dd></div>
                <div><dt>품질 이슈</dt><dd>{activeDetail.qualityIssue}</dd></div>
                <div><dt>오류 로그</dt><dd>{activeDetail.logLocation}</dd></div>
                <div><dt>담당</dt><dd>{activeDetail.ownerDept} · {ownerLabel(activeDetail.opsOwner)} · {ownerLabel(activeDetail.techOwner)}</dd></div>
                <div><dt>활성 상태</dt><dd>{activeDetail.active ? '활성' : '비활성/검증 필요'}</dd></div>
              </dl>
              <LinkedChipList label="연결 계산지표" items={activeDetail.metricIds} emptyText="연결 지표 없음" onClick={(id) => selectMetric(id, { scroll: true })} />
              <label className="ops-note-box">
                <span>운영 메모</span>
                <textarea readOnly value={`${activeDetail.note}\n담당자는 품질 이슈와 수집 로그를 확인하고 필요 시 재수집 또는 비활성 처리합니다.`} />
              </label>
            </div>
          )}

          {activeDetail && selectedItem.type === 'metric' && (
            <div className="data-room-detail-stack">
              <div className="detail-title-block">
                <strong>{activeDetail.name}</strong>
                <span>{activeDetail.id} · {activeDetail.bundle} · {activeDetail.scope}</span>
              </div>
              <dl>
                <div><dt>지표 설명</dt><dd>{activeDetail.description}</dd></div>
                <div><dt>계산식</dt><dd><code>{activeDetail.formula}</code></dd></div>
                <div><dt>기준 기간/갱신</dt><dd>{activeDetail.period} / {activeDetail.refreshCycle}</dd></div>
                <div><dt>최근 계산</dt><dd>{activeDetail.lastCalculatedAt}</dd></div>
                <div><dt>표시 위치</dt><dd>{activeDetail.displayLocation}</dd></div>
                <div><dt>해석 기준</dt><dd>{activeDetail.interpretation}</dd></div>
                <div><dt>이상치 기준</dt><dd>{activeDetail.outlierRule}</dd></div>
                <div><dt>신뢰도</dt><dd>{activeDetail.reliability}</dd></div>
                <div><dt>담당 부서</dt><dd>{activeDetail.ownerDept}</dd></div>
                <div><dt>오류 확인 위치</dt><dd>{activeDetail.errorLocation}</dd></div>
              </dl>
              <LinkedChipList label="필수 raw 데이터" items={activeDetail.rawIds} emptyText="연결 raw 없음" onClick={(id) => selectRaw(id, { scroll: true })} />
              {activeDetail.conditionalRawIds?.length ? (
                <LinkedChipList
                  label={activeDetail.conditionalLabel ?? '조건부 raw 데이터'}
                  items={activeDetail.conditionalRawIds}
                  emptyText="조건부 raw 없음"
                  onClick={(id) => selectRaw(id, { scroll: true })}
                />
              ) : null}
              <label className="ops-note-box">
                <span>운영 메모</span>
                <textarea readOnly value={`${activeDetail.note}\n계산 오류 시 raw 데이터 수집 상태와 계산 로그를 함께 확인합니다.`} />
              </label>
            </div>
          )}
        </aside>
        )}
      </section>
    </section>
  )
}
