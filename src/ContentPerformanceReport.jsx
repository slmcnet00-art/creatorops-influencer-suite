import { useState } from 'react'
import { CONTENT_METRICS, contentMetricHistory, metricValue, contentThumbnail } from '../shared/contentMetricHistory.js'

const labels = { views: '조회수', likes: '좋아요', comments: '댓글', shares: '공유', saves: '저장' }
const number = value => value === null ? '미확인' : value.toLocaleString('ko-KR')
const time = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value.replaceAll('-', '.') : new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const publicUrl = value => /^https?:\/\//i.test(String(value || '')) ? value : ''

function HistoryChart({ points, field }) {
  const measured = points.filter(point => point[field] !== null)
  if (measured.length < 2) return <p className="client-report-empty">{labels[field]} 관측값이 2건 이상 쌓이면 추이가 표시됩니다.</p>
  const start = Date.parse(measured[0].measuredAt)
  const end = Date.parse(measured.at(-1).measuredAt)
  const max = Math.max(1, ...measured.map(point => point[field]))
  const delta = measured.at(-1)[field] - measured[0][field]
  // Missing observations break the line rather than imply a measurement at that time.
  const segments = []
  for (const point of points) {
    if (point[field] === null) { segments.push([]); continue }
    if (!segments.length) segments.push([])
    segments.at(-1).push(`${45 + (Date.parse(point.measuredAt) - start) / (end - start) * 530},${135 - point[field] / max * 110}`)
  }
  return <div className="content-trend">
    <p>{labels[field]} · 첫 관측 대비 {delta > 0 ? '+' : ''}{number(delta)} · 누적 관측값</p>
    <svg viewBox="0 0 600 160" role="img" aria-label={`${labels[field]} ${number(measured[0][field])}에서 ${number(measured.at(-1)[field])}까지 변화`}>
      <line x1="45" x2="575" y1="135" y2="135" stroke="#dfe5ed" />
      <text x="5" y="25">{number(max)}</text><text x="20" y="135">0</text>
      {segments.filter(segment => segment.length).map((segment, index) => <polyline key={index} points={segment.join(' ')} fill="none" stroke="#2460cc" strokeWidth="2" />)}
    </svg>
    <div className="content-trend-dates"><span>{time(measured[0].measuredAt)}</span><span>{time(measured.at(-1).measuredAt)}</span></div>
  </div>
}

export default function ContentPerformanceReport({ posts = [] }) {
  const [field, setField] = useState('views')
  return <section className="client-content-performance" aria-label="전체 업로드 콘텐츠 성과">
    <div className="client-report-section-title"><h4>전체 업로드 콘텐츠 · {posts.length}건</h4>
      <label>추이 지표 <select value={field} onChange={event => setField(event.target.value)}>{CONTENT_METRICS.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select></label>
    </div>
    <p>매출과 별도로 콘텐츠 반응을 확인합니다. 최근 30일의 실제 수집 시점 기준이며, 미확인 수치는 합계에서 제외합니다.</p>
    <div className="content-reaction-totals">{CONTENT_METRICS.map(key => {
      const known = posts.map(post => metricValue(post, key)).filter(value => value !== null)
      return <div key={key}><span>{labels[key]}</span><strong>{known.length ? number(known.reduce((sum, value) => sum + value, 0)) : '미확인'}</strong><small>{known.length}/{posts.length}건 확인</small></div>
    })}</div>
    {!posts.length && <p className="client-report-empty">업로드 URL을 등록하면 영상별 썸네일과 반응 수치를 확인할 수 있습니다.</p>}
    {posts.map((post, index) => {
      const points = contentMetricHistory(post)
      const url = publicUrl(post.url || post.contentUrl)
      const thumbnail = contentThumbnail(post)
      const collected = post.sourceCollectedAtIso || post.checkedAt || post.fetchedAt
      return <article className="content-performance-row" key={post.id || url || index}>
        <div className="content-performance-identity">
          <div className={`content-performance-thumbnail${/youtube/i.test(post.platform || '') ? ' is-youtube' : ''}`}>{thumbnail ? <img src={thumbnail} alt={`${post.title || '콘텐츠'} 썸네일`} loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} /> : null}<span>썸네일 미제공</span></div>
          <div><strong>{post.title || '제목 미입력'}</strong><small>{post.platform || '플랫폼 미입력'} · {collected && Number.isFinite(Date.parse(collected)) ? `수집 ${time(collected)}` : '수집 시각 미확인'}</small>
            {post.publishedAt && <small>게시 {Number.isFinite(Date.parse(post.publishedAt)) ? time(post.publishedAt) : post.publishedAt}</small>}
            {url && <a href={url} target="_blank" rel="noreferrer">원본 열기 ↗</a>}
          </div>
        </div>
        <dl className="content-performance-metrics">{CONTENT_METRICS.map(key => <div key={key}><dt>{labels[key]}</dt><dd>{number(metricValue(post, key))}</dd></div>)}</dl>
        <details className="content-performance-history"><summary>개별 영상 추이 · {points.length}회 관측</summary>
          <HistoryChart points={points} field={field} />
          {!!points.length && <div className="content-history-table"><table><caption>실제 관측 이력 · 한국시간</caption><thead><tr><th>수집 시각</th>{CONTENT_METRICS.map(key => <th key={key}>{labels[key]}</th>)}<th>출처</th></tr></thead>
            <tbody>{points.map(point => <tr key={point.measuredAt}><td>{time(point.measuredAt)}</td>{CONTENT_METRICS.map(key => <td key={key}>{number(point[key])}</td>)}<td>{point.source || '미확인'}</td></tr>)}</tbody></table></div>}
        </details>
      </article>
    })}
  </section>
}
