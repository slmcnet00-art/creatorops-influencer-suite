const count = value => Number(value || 0).toLocaleString('ko-KR')
export default function YouTubeEvidenceDetails({ creator }) {
  if (String(creator?.platform || '').toLowerCase() !== 'youtube') return null
  const data = creator.youtubeRecentMetrics, relevance = creator.recentRelevance
  return <details className="creator-rate-details">
    <summary>최근 영상 검증</summary>
    {!data ? <p>이전 수집 자료입니다. 새로 검색하거나 채널 지표를 동기화하면 최근 영상과 형식별 조회수를 확인할 수 있습니다.</p> : <>
      <p>최근 {data.windowDays}일 내 공개 영상 최대 12개 중 {data.sampleCount}개 확인 · {data.method}. 광고 전환 성과나 전체 채널의 확정 성과는 아닙니다.</p>
      <dl>{['숏폼', '롱폼'].map(format => {
        const row = data.formatMetrics?.[format]
        return <div key={format}><dt>{format} · 확인된 형식</dt><dd>{row?.sampleCount ? `${count(row.averageViews)}회 · 표본 ${row.sampleCount}개, 계산 ${row.usedCount}개 · ${row.method}` : '확인된 표본 없음'}</dd></div>
      })}</dl>
      <p>숏폼 추정 {data.inferredShortCount}개{data.inferredShortCount ? ` · 추정 표본 평균 ${count(data.inferredAverageViewsByFormat?.숏폼)}회` : ''} · 형식 미확인 {data.unknownFormatCount}개</p>
      <p>3분 이하·썸네일 비율만으로 Shorts를 확정하지 않습니다. #shorts 표시는 추정이며, 추정·미확인 조회수는 확정 형식의 단가 계산에 사용하지 않습니다.</p>
      {relevance && <p>{relevance.matches == null ? relevance.reason : `${relevance.reason} · 관련 영상 ${relevance.matchingCount}/${relevance.sampleCount}개`}</p>}
      {relevance?.evidence?.length > 0 && <ul>{relevance.evidence.map(item => <li key={item.videoId}><a href={item.url} target="_blank" rel="noreferrer">{item.title || '근거 영상 원본 열기'}</a></li>)}</ul>}
      <small>수집: {data.collectedAt}</small>
    </>}
  </details>
}
