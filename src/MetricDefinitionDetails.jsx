import { metricDefinitions, metricObservationSummary } from '../shared/metricDefinitions.js'

export default function MetricDefinitionDetails({ metricKey, rows, sample }) {
  const definition = metricDefinitions[metricKey]
  if (!definition) return null
  const observation = rows ? metricObservationSummary(rows) : null
  return <details className="creator-rate-details">
    <summary>지표 기준 확인</summary>
    <p>{definition.formula}</p>
    <p>기준 기간 · {definition.period}</p>
    {sample && <p>{sample}</p>}
    {observation && <>
      <p>기록된 출처 · {observation.sources.join(' · ') || '출처 확인 필요'}</p>
      <p>수집일 · {observation.oldest
        ? `${new Date(observation.oldest).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}부터 · ${observation.dated}/${rows.length}건 확인`
        : '수집일 확인 필요'}</p>
    </>}
    <p>{definition.limitation}</p>
  </details>
}
