export default function CampaignArchiveSummary({ archive }) {
  if (!archive) return null
  const shipments = archive.shipments || []
  const accounts = new Set(shipments.map(row => row.handle?.trim().toLowerCase()).filter(Boolean)).size
  const days = Object.entries(shipments.reduce((counts, row) => {
    const day = row.shippedAt || '발송일 미기재'
    counts[day] = (counts[day] || 0) + 1
    return counts
  }, {})).sort(([a], [b]) => a.localeCompare(b))
  const max = Math.max(1, ...days.map(([, count]) => count))
  return <section className="campaign-archive-summary" aria-label="제공 자료 기반 운영 현황">
    <div className="client-report-section-title"><h4>제공 자료 기반 운영 현황</h4><span>발송과 업로드를 구분해 집계</span></div>
    <div className="archive-summary-figures">
      <div><span>제품 발송 기록</span><strong>{shipments.length}건</strong><small>{accounts}개 고유 계정</small></div>
      <div><span>업로드 링크 확인</span><strong>{archive.uploadCount || 0}건</strong><small>발송 기록만으로 업로드 완료를 판단하지 않습니다.</small></div>
    </div>
    <div className="archive-shipment-days">{days.map(([day, count]) => <div key={day}><span>{day}</span><div className="client-stage-track"><span style={{ width: `${count / max * 100}%` }}/></div><strong>{count}건</strong></div>)}</div>
    <details className="archive-shipment-details"><summary>발송 내역 {shipments.length}건 보기</summary><div className="content-history-table"><table><caption>원본 발송 기록 · 수령자 개인정보 제외</caption><thead><tr><th>계정</th><th>제품</th><th>발송일</th><th>원본 행</th></tr></thead><tbody>{shipments.map(row => <tr key={row.id}><td>{/^https?:\/\//.test(row.profileUrl || '') ? <a href={row.profileUrl} target="_blank" rel="noreferrer">{row.handle}</a> : row.handle}</td><td>{row.product}</td><td>{row.shippedAt || '미기재'}</td><td>{row.sourceRow}</td></tr>)}</tbody></table></div></details>
    {archive.notes?.length > 0 && <details className="archive-shipment-details"><summary>원본 집계 기준과 확인 사항</summary><ul>{archive.notes.map(note => <li key={note}>{note}</li>)}</ul></details>}
  </section>
}
