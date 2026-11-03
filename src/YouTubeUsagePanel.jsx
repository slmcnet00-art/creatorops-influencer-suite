import { useEffect, useState } from 'react'
import './YouTubeUsagePanel.css'

const names = { search: '유튜버·레퍼런스 검색', default: '채널·영상 상세 조회' }
const levels = { normal: '정상', warning: '80% 이상 · 주의', critical: '95% 이상 · 한도 임박', exhausted: '100% 이상 · 한도 도달', 'upstream-quota-error': 'YouTube에서 한도 오류 수신' }
const number = n => Number(n).toLocaleString('ko-KR')
export default function YouTubeUsagePanel({ apiBaseUrl, accessToken }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true), [updated, setUpdated] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setLoading(true); setError('')
      return fetch(`${apiBaseUrl}/admin/youtube-usage`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
        .then(async r => { const b = await r.json(); if (!r.ok) throw Error(b.message || '사용량을 확인하지 못했습니다.'); return b.data })
        .then(value => { if (!controller.signal.aborted) { setData(value); setUpdated(new Date().toLocaleTimeString('ko-KR')) } })
        .catch(e => { if (!controller.signal.aborted) setError(e.message) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    })
    const timer = setInterval(() => setRefresh(n => n + 1), 60000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [apiBaseUrl, accessToken, refresh])
  return <div className="admin-page youtube-usage">
    <section className="admin-band"><div className="admin-section-heading"><div><h2>YouTube API 사용량과 한도</h2><p>검색과 상세 조회의 일일 한도를 따로 관리합니다. 모든 광고주·캠페인의 서버 호출을 합산합니다.</p></div>
      <button className="admin-secondary" disabled={loading} onClick={() => setRefresh(n => n + 1)}>사용량 새로고침</button></div>
      {loading && <p role="status">사용량 확인 중…</p>}{error && <p role="alert" className="youtube-usage-error">{error} {data ? '아래는 이전 조회값입니다.' : '미확인 사용량을 0으로 표시하지 않습니다.'}</p>}
      {data && <><p>할당량 날짜 {data.day} · 미국 태평양 시간 자정에 초기화 · 마지막 확인 {updated} · 1분마다 갱신</p>
        <div className="youtube-usage-grid">{data.buckets.map(b => <article className={`youtube-usage-meter is-${b.level}`} key={b.bucket}>
          <h3>{names[b.bucket]}</h3><p className="youtube-usage-state" role={b.level === 'normal' ? 'status' : 'alert'}>{levels[b.level]}</p>
          <p><strong>{number(b.used)}</strong> / {number(b.dailyLimit)} {b.bucket === 'search' ? '회' : 'units'}</p>
          <progress max={b.dailyLimit} value={Math.min(b.used, b.dailyLimit)} aria-label={`${names[b.bucket]} 일일 사용률`} />
          <dl><div><dt>일일 사용률</dt><dd>{b.percent}%</dd></div><div><dt>서버 집계 기준 잔여</dt><dd>{number(b.remaining)}</dd></div><div><dt>{data.month} 누적 사용량</dt><dd>{number(b.monthUsed)}</dd></div></dl>
          {b.level !== 'normal' && <p>신규 검색 빈도를 줄이고 기존 결과를 재사용하세요. 한도 오류가 있으면 Google Cloud의 실제 잔여량을 확인하세요.</p>}
        </article>)}</div>
        <p>집계 시작: {data.trackingSince ? new Date(data.trackingSince).toLocaleString('ko-KR') : '아직 호출 기록 없음'}</p>
        <p>{data.note} {data.warning}</p><p>이 화면은 API 호출 시도 기준의 예상 차감량입니다. 실패·잘못된 요청도 포함하며, 캐시 재사용은 추가 호출로 세지 않습니다. 월 누적은 사용 실적이며 별도의 월 할당량이 아닙니다.</p>
        <p>80% 주의 → 95% 한도 임박 → 100% 한도 도달 경고를 표시합니다. 이 경고는 자동 발송·결제·증액 신청을 수행하지 않습니다.</p>
        <a href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas?project=creatorops-beta" target="_blank" rel="noreferrer">Google Cloud 공식 할당량 확인</a>
      </>}
    </section>
  </div>
}
