export const metricDefinitions = {
  'search-reach': {
    name: '후보 구독자·팔로워 합계',
    formula: '현재 발굴 필터에 맞는 후보의 구독자·팔로워 수 합계',
    period: '후보별 마지막 관측값',
    limitation: '여러 계정을 함께 팔로우하는 사람이 중복 포함됩니다. 실제 도달 인원과 구분합니다.',
  },
  'expected-views': {
    name: '후보 예상 조회수',
    formula: '현재 발굴 필터에 맞는 후보의 평균 조회수 합계',
    period: 'YouTube는 최근 180일 공개 영상 최대 12개 표본. 다른 자료는 제공된 기간 기준',
    limitation: 'YouTube는 표본 5개 이상일 때 상하 20%를 제외하고, 부족하면 단순평균합니다. 업로드 후 실제 성과는 별도로 확인합니다.',
  },
  'average-engagement': {
    name: '조회수 기준 참여율',
    formula: '(좋아요 + 댓글 + 공유 + 저장 합계) ÷ 조회수 합계 × 100',
    period: '현재 브랜드 리포트에 연결된 콘텐츠',
    limitation: '반응 합계가 0이면 제공된 참여율 × 조회수로 반응을 환산하는 기존 계산을 사용합니다. 누락 반응은 합계에 포함되지 않아 부분 지표가 될 수 있습니다.',
  },
  'recruiting-progress': {
    name: '캠페인 목표 달성률',
    formula: '설정된 캠페인 KPI별 달성률을 각각 최대 100%로 제한한 뒤 산술평균하고 반올림',
    period: '선택한 캠페인 운영 현황',
    limitation: '조회·전환·주문·섭외·매출 중 목표가 설정된 KPI가 계산 대상입니다. 목표가 없으면 목표 미설정으로 표시합니다.',
  },
  revenue: {
    name: '실제 매출',
    formula: '캠페인의 구매 이벤트 금액 합계 − 환불 이벤트 금액 합계, 최솟값 0',
    period: '캠페인에 연결된 전환 이벤트',
    limitation: '이벤트가 없으면 캠페인의 수동 실제 매출을 사용합니다. VAT 포함 여부는 원천 입력 기준으로 별도 확인해야 합니다.',
  },
  spend: {
    name: '실제 지출',
    formula: '이행 기록 지급액 + 운영 기록 실제 비용 합계와 캠페인 실제 지출 중 큰 값, 최솟값 0',
    period: '캠페인에 연결된 비용 기록',
    limitation: '원가·대행 수수료·VAT가 자동 포함되는 것으로 간주하지 않습니다. 각 입력의 포함 범위를 확인해야 합니다.',
  },
  'reference-observation': {
    name: '콘텐츠 원천 수치',
    formula: '저장된 콘텐츠 조회·반응의 관측값',
    period: '콘텐츠별 마지막 수집 시점',
    limitation: '공개 페이지 수집과 수동 입력은 공식 API 응답과 구분해 출처를 확인합니다. 표시되지 않은 반응은 미확인입니다.',
  },
}

export function knownMetricCount(rows, field) {
  return rows.filter((row) => {
    const value = row[field]
    const availability = row.metric_availability?.[field]
    return !row.metricsPending && !['unavailable', 'unverified', 'missing', 'restricted'].includes(availability) &&
      value !== null && value !== undefined && value !== '' && typeof value !== 'boolean' &&
      Number.isFinite(Number(value)) && Number(value) >= 0 &&
      !(row.needsVerification && Number(value) === 0)
  }).length
}

export function metricObservationSummary(rows = []) {
  const dates = rows.map((row) => row.youtubeRecentMetrics?.collectedAt || row.sourceCollectedAtIso || row.metricsUpdatedAt || row.fetchedAt)
    .filter((value) => value && Number.isFinite(Date.parse(value))).map((value) => Date.parse(value))
  const sources = [...new Set(rows.flatMap((row) => [row.source, row.sourceName, ...(Array.isArray(row.metricSources) ? row.metricSources : []).map((item) => item?.source)])
    .filter((value) => typeof value === 'string' && value.trim()))]
  return { sources, dated: dates.length, oldest: dates.length ? new Date(Math.min(...dates)).toISOString() : '' }
}
