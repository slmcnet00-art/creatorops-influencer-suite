import { useRef, useState } from 'react'
import {
  AlertTriangle,
  ClipboardList,
  Database,
  Filter,
  GitBranch,
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

function MiniStat({ label, value }) {
  return (
    <article className="data-room-summary-card">
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
    source: '외부 모니터링 API',
    use: '브랜드/경쟁사 기준 관련 크리에이터, 언급량, 예상 노출을 행 단위로 적재',
  },
  {
    id: 'RAW-EXT-MON-VIDEO-001',
    name: 'Video Monitor Data API raw',
    source: '외부 모니터링 API',
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
  rawData,
  allRawData = rawData,
  groupedMetrics,
  workflowCoverage,
  pendingBundles,
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
  metricQuery,
  setMetricQuery,
  rawCategories,
  rawMethods,
  rawOwners,
  metricBundles,
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
  apiEvents,
  onRefreshApiEvents,
  onLog,
  onRefreshRaw,
  onMetricLog,
  onRecalculate,
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [apiDiagnosticsOpen, setApiDiagnosticsOpen] = useState(false)
  const rawRegistryRef = useRef(null)
  const metricRegistryRef = useRef(null)
  const scrollToRegistryTarget = (selector, fallbackRef) => {
    window.setTimeout(() => {
      const target = document.querySelector(selector)
      ;(target || fallbackRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }
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
    setSelectedItem({ type: 'metric', id: metricId })
    setDetailOpen(true)
    if (options.scroll) {
      setMetricTab('전체')
      setMetricStatus('전체')
      setMetricBundle('전체')
      setMetricQuery('')
      scrollToRegistryTarget(`[data-metric-id="${String(metricId).replace(/"/g, '\\"')}"]`, metricRegistryRef)
    }
  }
  const rawRegistry = allRawData?.length ? allRawData : rawData
  const externalReportRawIds = new Set(externalReportRawTypes.map((item) => item.id))
  const apiRawIds = new Set(apiRawTypes.map((item) => item.id))
  const externalReportRawCount = rawRegistry.filter((item) => externalReportRawIds.has(item.id)).length
  const externalApiRawCount = rawRegistry.filter((item) => apiRawIds.has(item.id)).length
  const apiLogCount = apiEvents?.length || 0
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
    setRawQuery('RAW-EXT-MON')
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
      <section className="data-room-summary" aria-label="어드민 데이터룸 요약">
        <MiniStat label="Raw 전체" value={`${summary.rawTotal}개`} />
        <MiniStat label="정상 수집" value={`${summary.rawOk}개`} />
        <MiniStat label="지연" value={`${summary.rawDelayed}개`} />
        <MiniStat label="오류" value={`${summary.rawError}개`} />
        <MiniStat label="중단" value={`${summary.rawPaused}개`} />
        <MiniStat label="내부/외부" value={`${summary.internal}/${summary.external}`} />
        <MiniStat label="계산지표" value={`${summary.metricTotal}개`} />
        <MiniStat label="지표 오류" value={`${summary.metricError}개`} />
        <MiniStat label="마지막 동기화" value={summary.lastSync} />
      </section>

      <section className="panel data-room-import-panel">
        <div>
          <span className="mini-label">Raw Report Ingestion</span>
          <h2>리포트 raw 적재</h2>
          <div className="data-room-source-counters" aria-label="raw source counters">
            <button type="button" onClick={showExternalReportRaw}>리포트 raw {externalReportRawCount}개</button>
          </div>
        </div>
        <div className="data-room-import-actions">
          <button className="secondary-button compact-button" type="button" onClick={onDownloadExternalReportTemplate}>
            보완 raw 양식
          </button>
          <label className="primary-button compact-button">
            엑셀 업로드
            <input type="file" accept=".xlsx,.xls" hidden onChange={onImportExternalReport} />
          </label>
        </div>
      </section>

      <section className="panel data-room-api-status-panel">
        <div className="api-status-compact-row">
          <div>
            <span className="mini-label">API Raw Logging Status</span>
            <h2>API raw 적재 상태</h2>
          </div>
          <div className="api-status-compact-actions">
            <span className={`data-status ${apiStatus?.ok ? 'ok' : 'warning'}`}>
              {apiStatus?.ok ? '연결됨' : '설정 확인 필요'}
            </span>
            <span className="api-log-count">로그 {apiLogCount}건</span>
            <button className="secondary-button compact-button" type="button" onClick={showExternalApiRaw}>
              API raw {externalApiRawCount}개
            </button>
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
              <strong>{apiStatus?.ok ? 'Data room API logging ready' : 'Data room API logging needs setup'}</strong>
              <small>
                workspace {apiStatus.payload.dataRoomLogging.workspaceId} · SUPABASE_URL{' '}
                {apiStatus.payload.dataRoomLogging.hasSupabaseUrl ? 'OK' : 'missing'} · SERVICE_ROLE{' '}
                {apiStatus.payload.dataRoomLogging.hasServiceRoleKey ? 'OK' : 'missing'}
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
            <strong>Missing backend environment</strong>
            <div className="api-status-check-grid">
              {apiStatus.payload.dataRoomLogging.missingEnv.map((key) => (
                <span className="api-status-check error" key={key}>{key}</span>
              ))}
            </div>
          </div>
        )}
        {apiDiagnosticsOpen && apiStatus?.payload?.dataRoomLogging?.nextActions?.length > 0 && (
          <div className="api-status-action-box">
            <strong>Next actions</strong>
            <ol>
              {apiStatus.payload.dataRoomLogging.nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className={`panel data-room-api-log-panel ${apiEvents?.length ? '' : 'compact'}`}>
        <div className="panel-heading">
          <div>
            <span className="mini-label">API Raw Event Log</span>
            <h2>최근 API 수집 로그</h2>
          </div>
          <button className="secondary-button compact-button" type="button" onClick={onRefreshApiEvents}>
            새로고침
          </button>
        </div>
        <div className="api-event-list">
          {apiEvents?.length ? (
            apiEvents.map((event) => (
              <button type="button" className="api-event-row" key={event.id} onClick={() => setSelectedItem({ type: 'raw', id: event.raw_source_id })}>
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
              아직 저장된 API 수집 로그가 없습니다. 발굴/레퍼런스/콘텐츠 갱신 API를 실행하면 이곳에 raw 이벤트가 쌓입니다.
            </div>
          )}
        </div>
      </section>

      <section className="data-room-layout">
        <div className="data-room-main">
          <section className="panel data-room-panel" ref={rawRegistryRef}>
            <div className="panel-heading">
              <div>
                <span className="mini-label">Raw Data Registry</span>
                <h2>Raw 데이터 관리</h2>
              </div>
              <div className="panel-heading-actions">
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
              <span>원천 구분</span>
              <button type="button" onClick={showExternalReportRaw}>리포트 raw</button>
              <button type="button" onClick={showExternalApiRaw}>API raw</button>
              <button type="button" onClick={showAllRaw}>전체 raw</button>
              <small>긴 설명은 상단이 아니라 행 클릭 후 상세에서 확인합니다.</small>
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
                        <span>{item.opsOwner} / {item.techOwner}</span>
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
                <span className="mini-label">Calculated Metrics Registry</span>
                <h2>계산지표 관리</h2>
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

            <div className="filter-bar data-room-filters">
              <label className="search-box">
                <Search size={16} />
                <input
                  value={metricQuery}
                  onChange={(event) => setMetricQuery(event.target.value)}
                  placeholder="지표명, 계산식, raw 데이터 검색"
                />
              </label>
              <SelectPill label="상태" icon={<Filter size={15} />} value={metricStatus} options={metricStatuses} onChange={setMetricStatus} />
              <SelectPill label="번들" icon={<ClipboardList size={15} />} value={metricBundle} options={metricBundles} onChange={setMetricBundle} />
            </div>

            <div className="metric-bundle-list">
              {groupedMetrics.map((group) => (
                <article className="metric-bundle" key={group.bundle}>
                  <div className="metric-bundle-heading">
                    <strong>{group.bundle}</strong>
                    <span>{group.metrics.length}개 세부지표</span>
                  </div>
                  <div className="metric-bundle-items">
                    {group.metrics.map((metric) => (
                      <button
                        type="button"
                        data-metric-id={metric.id}
                        className={`metric-row-button ${selectedItem.type === 'metric' && selectedItem.id === metric.id ? 'active' : ''}`}
                        key={metric.id}
                        onClick={() => selectMetric(metric.id)}
                      >
                        <div>
                          <span>{metric.id}</span>
                          <strong>{metric.name}</strong>
                          <small>{metric.description}</small>
                        </div>
                        <code>{metric.formula}</code>
                        <StatusPill status={metric.status} />
                      </button>
                    ))}
                  </div>
                </article>
              ))}
              {!groupedMetrics.length && <div className="empty-table-cell">조건에 맞는 계산지표가 없습니다.</div>}
            </div>

            <div className="data-room-actions-row">
              <button className="secondary-button compact-button" type="button" onClick={onMetricLog}>오류 로그 확인</button>
              <button className="primary-button compact-button" type="button" onClick={onRecalculate}>재계산 요청</button>
            </div>
          </section>

          <section className="panel data-room-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Admin Workflow Coverage</span>
                <h2>기능-데이터 커버리지</h2>
                <p>프론트 화면은 이 표에 연결된 raw 데이터와 계산지표를 기준으로만 운영합니다.</p>
              </div>
              <StatusPill status={workflowCoverage.every((item) => item.status === '정상') ? '정상' : '검증 필요'} />
            </div>

            <div className="workflow-coverage-list">
              {workflowCoverage.map((item) => (
                <article className="workflow-coverage-card" key={item.id}>
                  <div className="workflow-coverage-title">
                    <GitBranch size={16} />
                    <div>
                      <strong>{item.featureName}</strong>
                      <span>{item.frontendArea}</span>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                  <p>{item.algorithm}</p>
                  <LinkedChipList label="사용 raw 데이터" items={item.rawIds} emptyText="연결 raw 없음" onClick={(id) => selectRaw(id, { scroll: true })} />
                  <LinkedChipList label="생성/사용 지표" items={item.metricIds} emptyText="연결 지표 없음" onClick={(id) => selectMetric(id, { scroll: true })} />
                  <small>{item.rule}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="panel data-room-panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Exception Data Bundles</span>
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
              <span className="mini-label">Detail Inspector</span>
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
                <div><dt>담당</dt><dd>{activeDetail.ownerDept} · {activeDetail.opsOwner} · {activeDetail.techOwner}</dd></div>
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
              <LinkedChipList label="사용 raw 데이터" items={activeDetail.rawIds} emptyText="연결 raw 없음" onClick={(id) => selectRaw(id, { scroll: true })} />
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
