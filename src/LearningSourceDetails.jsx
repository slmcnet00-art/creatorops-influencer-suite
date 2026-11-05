export default function LearningSourceDetails({ trace }) {
  return <details className="creator-rate-details">
    <summary>학습자료 적용 내역</summary>
    {!trace ? <p>이전 생성물에는 자료 적용 기록이 없습니다. 다시 생성하면 사용한 자료와 버전을 확인할 수 있습니다.</p> : <>
      <p>관리자 정책 {trace.version || '버전 미지정'} · 자료 본문을 참고해 생성합니다. 모델 자체를 재훈련하는 방식은 아닙니다.</p>
      {trace.editorialReview && <>
        <p>초안 작성 후 출처·기능·촬영안을 다시 검토한 제안입니다. 제작 승인이나 성과 보장을 뜻하지 않습니다.</p>
        {trace.editorialReview.correctedIssues?.length > 0 && <ul>{trace.editorialReview.correctedIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
      </>}
      {trace.sources?.length ? <ul>{trace.sources.map(source => <li key={source.citationId}>
        {source.name} · {trace.citedSourceIds?.includes(source.id) ? '결과에 적용 출처 표시' : '입력에 포함'}{source.truncated ? ' · 관련 부분 발췌' : ''}
      </li>)}</ul> : <p>읽을 수 있는 학습자료 본문이 없습니다. 관리자에서 자료를 등록·동기화한 후 다시 생성하세요.</p>}
      {trace.unavailable?.length > 0 && <p>본문 미확보·입력 한도로 제외된 자료 {trace.unavailable.length}개: {trace.unavailable.map(item => item.name).join(', ')}</p>}
      <small>출처 표시는 생성에 참고했다는 기록입니다. 전략의 효과는 실제 집행 결과로 검증해야 합니다.</small>
    </>}
  </details>
}
