import { useMemo, useState } from 'react'
import ClientReportOverview from './ClientReportOverview.jsx'
import ContentPerformanceReport from './ContentPerformanceReport.jsx'
import { buildCampaignReportAnalytics, reportObservedTrend } from '../shared/campaignReportAnalytics.js'
import { CONTENT_METRICS } from '../shared/contentMetricHistory.js'
import './campaignReport.css'

const REPORT_TABS = [
  ['summary', '종합 요약'], ['creators', '인플루언서별'], ['content', '콘텐츠별'],
  ['traffic', '유입·구매'], ['analysis', '분석·다음 전략'],
]
const labels = { views: '조회수', likes: '좋아요', comments: '댓글', shares: '공유', saves: '저장' }
const number = value => value == null ? '미확인' : Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
const money = value => value == null ? '미확인' : `${number(value)}원`
const ratio = value => value == null ? '미확인' : `${number(value)}%`
const url = value => /^https?:\/\//i.test(String(value || '')) ? value : ''

function Metric({ data }) {
  return <>{number(data.value)}{data.total > 0 && <small>{data.known}/{data.total}건 확인{data.known < data.total && data.known > 0 ? ' · 부분 합계' : ''}</small>}</>
}

function DataTable({ caption, headers, children }) {
  return <div className="campaign-report-table" role="region" aria-label={caption} tabIndex={0}><table><caption>{caption}</caption><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

function ObservedTrend({ posts }) {
  const [field, setField] = useState('views')
  const points = useMemo(() => reportObservedTrend(posts, field), [posts, field])
  const max = Math.max(1, ...points.map(point => point.value))
  return <section className="campaign-report-section" aria-label="통합 추이">
    <div className="campaign-report-section-heading"><h4>통합 추이</h4><label>추이 지표 <select value={field} onChange={event => setField(event.target.value)}>{CONTENT_METRICS.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select></label></div>
    <p>최근 30일 · 한국시간 · 같은 콘텐츠의 하루 마지막 실제 관측값을 합산합니다. 관측되지 않은 날은 채우지 않습니다. 집계 콘텐츠 수가 다르면 증감 비교에 주의하세요.</p>
    {points.length ? <><div className="campaign-report-trend" role="img" aria-label={`${labels[field]} 실제 관측 ${points.length}일 추이`}>
      {points.map(point => <div key={point.day}><strong>{number(point.value)}</strong><div className="campaign-report-trend-track"><span style={{ height: `${point.value / max * 100}%` }} /></div><span>{point.day.slice(5)}</span><small>{point.observed}/{point.total}건</small></div>)}
    </div><details><summary>실제 관측값 표</summary><DataTable caption={`${labels[field]} 일별 확인 범위`} headers={['관측일', labels[field], '관측 콘텐츠']}>
      {points.map(point => <tr key={point.day}><th scope="row">{point.day}</th><td>{number(point.value)}</td><td>{point.observed}/{point.total}건</td></tr>)}
    </DataTable></details></> : <p className="client-report-empty">실제 수집 이력이 아직 없습니다. ‘성과 갱신’ 또는 콘텐츠별 관측값 등록 후 표시됩니다. 현재 수치만으로 과거 추이를 만들지 않습니다.</p>}
  </section>
}

function CreatorComparison({ report }) {
  const [sort, setSort] = useState('views')
  const rows = report.rows.slice().sort((a, b) => {
    const value = row => sort === 'views' ? row.views.value : sort === 'cost' ? row.cost : row.cpv
    const av = value(a), bv = value(b)
    return av == null ? bv == null ? 0 : 1 : bv == null ? -1 : sort === 'views' ? bv - av : av - bv
  })
  return <>
    <section className="campaign-report-section">
      <div className="campaign-report-section-heading"><h4>인플루언서별 비교표</h4><label>정렬 <select value={sort} onChange={event => setSort(event.target.value)}><option value="views">확인 조회수 높은 순</option><option value="cpv">조회당 비용 낮은 순</option><option value="cost">기록 비용 낮은 순</option></select></label></div>
      <p>선택 캠페인 배정 인원과 추적 콘텐츠의 크리에이터를 비교합니다. 미확인 값은 0으로 간주하지 않으며, 평균 조회수·견적 단가는 실제 실적으로 합산하지 않습니다.</p>
      <DataTable caption={`선택 캠페인 인플루언서 ${rows.length}명 비교`} headers={['인플루언서', '등급', '콘텐츠', '조회수', '좋아요', '댓글', '공유', '저장', '기록 비용', '참여율']}>
        {rows.map(row => <tr key={row.creator.id}><th scope="row">{url(row.creator.profileUrl) ? <a href={row.creator.profileUrl} target="_blank" rel="noreferrer">{row.creator.name}</a> : row.creator.name}<small>{row.creator.platform || '플랫폼 미확인'} · {row.creator.handle || '계정 미입력'}</small><small>{row.grade.followers == null ? '구독자·팔로워 미확인' : `${number(row.grade.followers)} 구독자·팔로워`}</small></th><td>{row.grade.label}</td><td>{row.posts.length}건</td>{CONTENT_METRICS.map(key => <td key={key}><Metric data={row[key]} /></td>)}<td>{money(row.cost)}</td><td>{ratio(row.engagementRate)}</td></tr>)}
        {!rows.length && <tr><td colSpan="10">배정 인원 또는 크리에이터가 연결된 콘텐츠가 아직 없습니다.</td></tr>}
      </DataTable>
    </section>
    <section className="campaign-report-section">
      <h4>비용 효율</h4><p>실제 비용과 조회·반응이 모두 확인된 범위만 계산합니다. 비용은 지급 기록 우선, 없으면 운영 비용을 사용하며 같은 비용을 이중 합산하지 않습니다. 캠페인 총액을 인원수로 임의 배분하지 않습니다.</p>
      <DataTable caption="인플루언서별 기록 비용 대비 효율" headers={['인플루언서', '기록 비용', 'CPV · 조회당', 'CPM · 1,000회당', 'CPE · 반응당']}>
        {rows.map(row => <tr key={row.creator.id}><th scope="row">{row.creator.name}</th><td>{money(row.cost)}</td><td>{money(row.cpv)}</td><td>{money(row.cpm)}</td><td>{money(row.cpe)}</td></tr>)}
        {!rows.length && <tr><td colSpan="5">비용을 연결할 인플루언서가 없습니다.</td></tr>}
      </DataTable>
      <small>참여율 = (좋아요 + 댓글 + 공유 + 저장) ÷ 조회수 × 100. CPE와 참여율은 해당 반응 지표가 모두 확인된 콘텐츠만 계산합니다.</small>
    </section>
    <section className="campaign-report-section"><h4>등급별 비교</h4><p>데이터 정의의 구독자·팔로워 등급을 사용합니다. 합계가 일부만 확인되면 확인 범위를 함께 표시합니다.</p>
      <DataTable caption="구독자·팔로워 등급별 실적" headers={['등급', '인원', '콘텐츠', '조회수', '반응 수 · 확인분', '기록 비용']}>
        {report.gradeRows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.creators}명</td><td>{row.posts}건</td><td><Metric data={row.views} /></td><td>{number(row.reactions)}</td><td>{money(row.cost)}<small>{row.costKnown}/{row.creators}명 비용 확인</small></td></tr>)}
        {!report.gradeRows.length && <tr><td colSpan="6">등급별로 비교할 인원이 없습니다.</td></tr>}
      </DataTable>
    </section>
    <section className="campaign-report-section"><h4>콘텐츠 형식별 비교</h4><p>개별 콘텐츠에 기록된 형식을 우선합니다. 캠페인에 형식이 여러 개 지정돼 있으면 개별 형식을 추측하지 않습니다.</p>
      <DataTable caption="형식별 실제 콘텐츠 성과" headers={['형식', '콘텐츠', '조회수', '콘텐츠당 조회수', '참여율']}>
        {report.formatRows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.posts}건</td><td><Metric data={row.views} /></td><td>{row.views.known === row.posts && row.posts ? number(row.views.value / row.posts) : '미확인'}</td><td>{ratio(row.engagementRate)}</td></tr>)}
        {!report.formatRows.length && <tr><td colSpan="5">업로드 콘텐츠가 연결되면 형식별 비교가 표시됩니다.</td></tr>}
      </DataTable>
    </section>
    <ObservedTrend posts={report.posts} />
  </>
}

function TrafficReport({ report, onTracking }) {
  const { traffic } = report
  return <>
    <section className="campaign-report-section"><h4>유입부터 구매까지</h4><p>같은 캠페인에 연결된 기록만 집계합니다. 링크 생성은 클릭·구매 확인과 다릅니다. 조회수를 클릭이나 매출로 환산하지 않습니다.</p>
      <dl className="campaign-report-facts"><div><dt>추적 링크</dt><dd>{traffic.links.length}개</dd></div><div><dt>관측 클릭</dt><dd>{number(traffic.clicks)}</dd></div><div><dt>구매 기록</dt><dd>{number(traffic.purchases)}</dd></div><div><dt>환불 기록</dt><dd>{number(traffic.refunds)}</dd></div><div><dt>환불 반영 매출</dt><dd>{money(traffic.revenue)}</dd></div></dl>
      <p>구매·환불 출처: {traffic.source || '연결 대기'}. 주문 귀속 기록이 있으면 이를 우선하고 이벤트를 다시 더하지 않습니다. 같은 주문 ID의 같은 이벤트는 한 번만 셉니다.</p>
      <button type="button" className="secondary-button compact-button" onClick={onTracking}>캠페인 링크·추적 설정</button>
    </section>
    <section className="campaign-report-section"><h4>비용과 매출 연결</h4>
      <dl className="campaign-report-facts"><div><dt>기록 집행 비용</dt><dd>{money(report.cost)}</dd></div><div><dt>ROAS</dt><dd>{report.costComplete && report.cost > 0 && report.revenue !== null ? ratio(report.revenue / report.cost * 100) : '미확인'}</dd></div><div><dt>구매당 비용 · CPA</dt><dd>{report.costComplete && report.cost !== null && traffic.purchases > 0 ? money(report.cost / traffic.purchases) : '미확인'}</dd></div></dl>
      <p>구매 기록 수는 고유 구매자 수와 다릅니다. CPA는 기록된 구매 건수 기준이며, 기여 기간·중복 채널 귀속은 별도 검수해야 합니다. 전환 수집이 연결되지 않았으면 미확인으로 표시합니다.</p>
    </section>
    <DataTable caption="캠페인별 발급 UTM 링크" headers={['크리에이터', '매체', '캠페인', '원본/숏링크']}>
      {traffic.links.map((link, index) => <tr key={link.id || index}><th scope="row">{link.creatorName || link.creator_name || '계정 미입력'}</th><td>{link.utm_source || link.utmParams?.utm_source || link.platform || '미입력'}</td><td>{link.utm_campaign || link.utmParams?.utm_campaign || '미입력'}</td><td>{url(link.shortUrl || link.short_url || link.url) ? <a href={link.shortUrl || link.short_url || link.url} target="_blank" rel="noreferrer">링크 열기</a> : '링크 미입력'}</td></tr>)}
      {!traffic.links.length && <tr><td colSpan="4">발급된 링크가 없습니다. 링크·추적 설정에서 캠페인과 크리에이터를 연결하세요.</td></tr>}
    </DataTable>
  </>
}

function NextStrategy({ report, onStrategy, onOperations, onContent }) {
  const measured = report.rows.filter(row => row.views.value !== null && row.views.known === row.posts.length && row.posts.length)
  const best = measured.slice().sort((a, b) => b.views.value - a.views.value)[0]
  const efficient = report.rows.filter(row => row.cpv !== null).sort((a, b) => a.cpv - b.cpv)[0]
  return <section className="campaign-report-section" aria-label="성과 분석과 다음 실행"><h4>확인된 근거 → 다음 실행</h4>
    <ol className="campaign-report-decisions">
      <li><strong>{best ? `확인 조회수 상위: ${best.creator.name}` : '조회수 비교 근거 수집'}</strong><p>{best ? `${best.posts.length}개 콘텐츠 합계 ${number(best.views.value)}회입니다. 업로드 수·국가·형식이 다른 경우 단순 순위만으로 재섭외를 확정하지 않습니다.` : '조회수가 확인된 업로드 콘텐츠가 없습니다. 원본 링크와 실제 수집 지표부터 연결하세요.'}</p><button type="button" className="secondary-button compact-button" onClick={onContent}>콘텐츠 근거 확인</button></li>
      <li><strong>{efficient ? `비용 비교 검토: ${efficient.creator.name}` : '비용 확인 후 재섭외 판단'}</strong><p>{efficient ? `확인된 조회당 비용은 ${money(efficient.cpv)}입니다. 구매 데이터가 없으면 판매 효율이 검증된 후보로 판단하지 않습니다.` : '실제 지급·운영 비용을 연결하면 CPV·CPM·CPE를 비교할 수 있습니다. 견적 단가를 실제 지출로 대신하지 않습니다.'}</p><button type="button" className="secondary-button compact-button" onClick={onOperations}>비용·정산 확인</button></li>
      <li><strong>다음 캠페인 전략에 반영</strong><p>성과 수치와 콘텐츠 구조를 검토한 뒤 캠페인의 전략·가이드 화면에서 다음 실행안을 생성하거나 수정하세요. 이 분석만으로 자동 승인·발송하지 않습니다.</p><button type="button" className="primary-button compact-button" onClick={onStrategy}>캠페인 전략·가이드 열기</button></li>
    </ol>
    {report.unmatched > 0 && <p className="campaign-report-quality">크리에이터 연결이 필요한 콘텐츠 {report.unmatched}건이 있습니다. 이름이 비슷하다는 이유로 실적을 다른 사람에게 합산하지 않았습니다.</p>}
  </section>
}

export default function CampaignReport({ activeTab, onTabChange, brand, campaign, creators, posts, performance, kpi, fulfillment, operations, links, clicks, orders, conversions, onStrategy, onOperations, onTracking, children }) {
  const report = useMemo(() => buildCampaignReportAnalytics({ campaign, creators, posts, fulfillment, operations, links, clicks, orders, conversions }), [campaign, creators, posts, fulfillment, operations, links, clicks, orders, conversions])
  const navigate = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = REPORT_TABS.findIndex(([key]) => key === activeTab)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? REPORT_TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + REPORT_TABS.length) % REPORT_TABS.length
    onTabChange(REPORT_TABS[next][0])
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus()
  }
  const summaryPerformance = { ...performance, total: performance.total ? { ...performance.total, cost: report.cost ?? 0, revenue: report.revenue ?? 0, roas: report.cost > 0 && report.revenue !== null ? report.revenue / report.cost * 100 : 0 } : null }
  return <div className="campaign-report-workspace">
    <nav className="campaign-report-tabs" role="tablist" aria-label="캠페인 리포트 탭">{REPORT_TABS.map(([key, label]) => <button key={key} id={`report-tab-${key}`} type="button" role="tab" aria-selected={activeTab === key} aria-controls={`report-panel-${key}`} tabIndex={activeTab === key ? 0 : -1} onClick={() => onTabChange(key)} onKeyDown={navigate}>{label}</button>)}</nav>
    <section className="campaign-report-tab-panel" role="tabpanel" id={`report-panel-${activeTab}`} aria-labelledby={`report-tab-${activeTab}`} tabIndex={0}>
      <p className="campaign-report-context">{brand.name} · {campaign?.name || '선택된 캠페인 없음'} · 실제 업로드 {report.posts.length}건 · 조회수 {report.totals.views.known}/{report.posts.length}건 확인 · {report.costCoverage.campaignTotal ? '캠페인 비용 총액 기록 있음' : `개별 비용 ${report.costCoverage.known}/${report.costCoverage.total}명 확인 · 합계는 확인분`}</p>
      {report.unallocatedCost != null && <p className="campaign-report-quality">크리에이터와 연결되지 않은 기록 비용 {money(report.unallocatedCost)}이 총액에 포함돼 있습니다. 개인별 비용으로 임의 배분하지 않았습니다.</p>}
      {activeTab === 'summary' && <><ClientReportOverview brand={brand} campaign={campaign} performance={summaryPerformance} kpi={kpi} posts={report.posts} hasCost={report.cost !== null} hasRevenue={report.revenue !== null} hasEfficiency={report.costComplete} showContent={false} /><section className="campaign-report-section"><h4>콘텐츠 반응 요약</h4><dl className="campaign-report-facts">{CONTENT_METRICS.map(key => <div key={key}><dt>{labels[key]}</dt><dd><Metric data={report.totals[key]} /></dd></div>)}</dl></section><ObservedTrend posts={report.posts} /></>}
      {activeTab === 'creators' && <CreatorComparison report={report} />}
      {activeTab === 'content' && <ContentPerformanceReport posts={report.posts} />}
      {activeTab === 'traffic' && <TrafficReport report={report} onTracking={onTracking} />}
      {activeTab === 'analysis' && <><NextStrategy report={report} onStrategy={onStrategy} onOperations={onOperations} onContent={() => onTabChange('content')} />{children}</>}
    </section>
  </div>
}
