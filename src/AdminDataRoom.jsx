import {
  AlertTriangle,
  ClipboardList,
  Database,
  Filter,
  GitBranch,
  RefreshCw,
  Search,
  UsersRound,
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

export default function AdminDataRoom({
  summary,
  rawData,
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
  importStatus,
  onImportExternalReport,
  onLog,
  onRefreshRaw,
  onMetricLog,
  onRecalculate,
}) {
  const selectRaw = (rawId) => setSelectedItem({ type: 'raw', id: rawId })
  const selectMetric = (metricId) => setSelectedItem({ type: 'metric', id: metricId })

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
          <h2>외부 리포트 raw 적재</h2>
          <p>
            녹스 브랜드 모니터, Video Monitor Data, Workbench 엑셀을 업로드하면 데이터룸의 외부 raw 저장소에 행 단위로 적재합니다.
          </p>
        </div>
        <div className="data-room-import-actions">
          <span>{importStatus}</span>
          <label className="primary-button compact-button">
            엑셀 업로드
            <input type="file" accept=".xlsx,.xls" hidden onChange={onImportExternalReport} />
          </label>
        </div>
      </section>

      <section className="data-room-layout">
        <div className="data-room-main">
          <section className="panel data-room-panel">
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

          <section className="panel data-room-panel">
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
                  <LinkedChipList label="사용 raw 데이터" items={item.rawIds} emptyText="연결 raw 없음" onClick={selectRaw} />
                  <LinkedChipList label="생성/사용 지표" items={item.metricIds} emptyText="연결 지표 없음" onClick={selectMetric} />
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

        <aside className="panel data-room-detail-panel">
          <div className="panel-heading">
            <div>
              <span className="mini-label">Detail Inspector</span>
              <h2>{selectedItem.type === 'metric' ? '지표 상세' : 'Raw 데이터 상세'}</h2>
            </div>
            <StatusPill status={activeDetail?.status} />
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
              <LinkedChipList label="연결 계산지표" items={activeDetail.metricIds} emptyText="연결 지표 없음" onClick={selectMetric} />
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
              <LinkedChipList label="사용 raw 데이터" items={activeDetail.rawIds} emptyText="연결 raw 없음" onClick={selectRaw} />
              <label className="ops-note-box">
                <span>운영 메모</span>
                <textarea readOnly value={`${activeDetail.note}\n계산 오류 시 raw 데이터 수집 상태와 계산 로그를 함께 확인합니다.`} />
              </label>
            </div>
          )}
        </aside>
      </section>
    </section>
  )
}
