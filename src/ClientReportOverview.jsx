import ContentPerformanceReport from './ContentPerformanceReport.jsx'
import { metricObservationSummary } from '../shared/metricDefinitions.js'

const number = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
const money = value => `${number(value)}원`
const observed = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

export default function ClientReportOverview({ brand, campaign, performance, kpi, posts = [], hasCost, hasRevenue }) {
  const total = performance.total
  const observation = metricObservationSummary(posts)
  const ranked = posts.filter(post => observed(post.views)).slice().sort((a, b) => Number(b.views) - Number(a.views)).slice(0, 5)
  const highest = Math.max(1, ...ranked.map(post => Number(post.views)))
  const stages = total ? [
    ['발굴 후보', total.discovered, '명'], ['연락 기록', total.contacted, '건'],
    ['회신 기록', total.responded, '건'], ['섭외 완료', total.recruited, '명'], ['업로드 콘텐츠', total.uploaded, '건'],
  ] : []
  const stageMax = Math.max(1, ...stages.map(stage => stage[1]))
  return <section className="client-report" aria-label="광고주 캠페인 성과 요약">
    <header className="client-report-heading">
      <div><span className="client-report-brand">{brand.name} · 캠페인 성과 보고서</span>
        <h3>{campaign?.name || '캠페인을 선택하세요'}</h3>
        <p>모집 {campaign?.schedule?.recruitStart || '시작일 미입력'} — {campaign?.schedule?.recruitEnd || '마감일 미입력'} · 업로드 마감 {campaign?.schedule?.uploadDue || '미입력'}</p>
      </div>
      <span className="client-report-basis">{posts.length ? `${posts.length}건 콘텐츠 추적 중` : '콘텐츠 연결 대기'}</span>
    </header>

    <div className="client-report-kpis">
      <div><span>기록된 매출</span><strong>{hasRevenue && total ? money(total.revenue) : '연결 필요'}</strong><small>구매·환불 또는 운영 입력 기준</small></div>
      <div><span>기록된 집행 비용</span><strong>{hasCost && total ? money(total.cost) : '연결 필요'}</strong><small>예산과 실제 지출을 구분</small></div>
      <div><span>매출 대비 집행 효율</span><strong>{hasCost && hasRevenue && total?.cost > 0 ? `${number(total.roas)}%` : '계산 대기'}</strong><small>매출 ÷ 비용 × 100 · 귀속 검수 필요</small></div>
      <div><span>추적 조회수</span><strong>{ranked.length && total ? `${number(total.views)}회` : '수집 필요'}</strong><small>선택 캠페인 업로드 콘텐츠 누적값</small></div>
    </div>

    <div className="client-report-grid">
      <section className="client-report-block">
        <h4>목표 대비 성과</h4>
        <p>설정한 목표와 실제 기록을 함께 비교합니다.</p>
        {kpi?.metrics.length ? kpi.metrics.map(metric => <div className="client-goal" key={metric.key}>
          <div><strong>{metric.label}</strong><span>{metric.displayActual} <small>/ {metric.displayTarget}</small></span></div>
          <progress max="100" value={Math.min(100, Math.max(0, metric.actual / metric.target * 100))} aria-label={`${metric.label} 목표 달성률`} />
          <small>{number(metric.actual / metric.target * 100)}% 달성 · 등록된 실제값 기준</small>
        </div>) : <p className="client-report-empty">캠페인에 목표를 입력하면 달성률을 비교할 수 있습니다.</p>}
      </section>
      <section className="client-report-block">
        <h4>섭외부터 업로드까지</h4>
        <p>단계별 인원·기록 건수입니다. 단계 간 전환율은 별도 검증합니다.</p>
        {stages.map(([label, value, unit]) => <div className="client-stage" key={label}>
          <span>{label}</span><div className="client-stage-track"><span style={{ width: `${value / stageMax * 100}%` }} /></div>
          <strong>{number(value)}{unit}</strong>
        </div>)}
        {!stages.length && <p className="client-report-empty">캠페인을 선택하면 진행 현황을 표시합니다.</p>}
      </section>
    </div>

    <section className="client-report-block client-content-ranking">
      <div className="client-report-section-title"><h4>조회 상위 콘텐츠</h4><span>선택 캠페인 · 최대 5건</span></div>
      {ranked.length ? <ol>{ranked.map((post, index) => <li key={post.id || post.url || index}>
        <span className="client-content-rank">{String(index + 1).padStart(2, '0')}</span>
        <div className="client-content-name">{post.url ? <a href={post.url} target="_blank" rel="noreferrer">{post.title || '콘텐츠 원본 열기'}</a> : <strong>{post.title || '제목 미입력'}</strong>}<small>{post.platform || '플랫폼 확인 필요'}</small></div>
        <div className="client-stage-track"><span style={{ width: `${Number(post.views) / highest * 100}%` }} /></div>
        <strong>{number(post.views)}회</strong>
      </li>)}</ol> : <p className="client-report-empty">콘텐츠 URL을 등록하고 조회수를 수집하면 비교할 수 있습니다.</p>}
    </section>

    <ContentPerformanceReport posts={posts} />

    <footer className="client-report-review">
      <div><strong>다음 검토</strong><p>{!posts.length ? '업로드 URL을 연결하고 콘텐츠 지표를 수집하세요.' : !hasCost || !hasRevenue ? '집행 비용과 구매·환불 데이터를 연결해 비용 대비 성과를 확인하세요.' : '조회 상위 소재의 반응과 전환을 함께 검토해 다음 캠페인의 재사용 후보를 선정하세요.'}</p></div>
      <small>수집일 확인 {observation.dated}/{posts.length}건 · {observation.oldest ? `가장 오래된 수집 ${new Date(observation.oldest).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}` : '수집 시각 확인 필요'}</small>
    </footer>
  </section>
}
