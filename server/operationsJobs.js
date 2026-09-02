export const OPERATION_JOB_KEYS = new Set(['tracking-refresh', 'metric-recalculation', 'daily-operations'])

export const AUTOMATED_METRIC_DEFINITIONS = [
  { id: 'MET-SNS-001', name: '조회수', formula: 'sum(content_metric_snapshots.views)', rawSourceIds: ['RAW-EXT-CONT-001'] },
  { id: 'MET-SNS-002', name: '좋아요 수', formula: 'sum(content_metric_snapshots.likes)', rawSourceIds: ['RAW-EXT-ENG-001'] },
  { id: 'MET-SNS-003', name: '댓글 수', formula: 'sum(content_metric_snapshots.comments)', rawSourceIds: ['RAW-EXT-ENG-001'] },
  { id: 'MET-SNS-004', name: '공유 수', formula: 'sum(content_metric_snapshots.shares)', rawSourceIds: ['RAW-EXT-ENG-001'] },
  { id: 'MET-OPS-001', name: '외부 수집 성공률', formula: 'successful_collection_jobs / total_collection_jobs * 100', rawSourceIds: ['RAW-EXT-SEARCH-001'] },
]

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeOperationJobName(value) {
  const name = String(value || '').trim()
  return OPERATION_JOB_KEYS.has(name) ? name : ''
}

export function aggregateOperationalMetrics(contentRows = [], collectionRows = []) {
  const totals = contentRows.reduce((result, row) => ({
    views: result.views + number(row.views),
    likes: result.likes + number(row.likes),
    comments: result.comments + number(row.comments),
    shares: result.shares + number(row.shares),
  }), { views: 0, likes: 0, comments: 0, shares: 0 })
  const collectionTotal = collectionRows.length
  const collectionSuccess = collectionRows.filter((row) => row.status === 'success').length
  const collectionSuccessRate = collectionTotal ? (collectionSuccess / collectionTotal) * 100 : 0

  return [
    { metricId: 'MET-SNS-001', value: totals.views, sourceRowIds: contentRows.map((row) => row.id).filter(Number.isInteger) },
    { metricId: 'MET-SNS-002', value: totals.likes, sourceRowIds: contentRows.map((row) => row.id).filter(Number.isInteger) },
    { metricId: 'MET-SNS-003', value: totals.comments, sourceRowIds: contentRows.map((row) => row.id).filter(Number.isInteger) },
    { metricId: 'MET-SNS-004', value: totals.shares, sourceRowIds: contentRows.map((row) => row.id).filter(Number.isInteger) },
    {
      metricId: 'MET-OPS-001',
      value: collectionSuccessRate,
      sourceRowIds: collectionRows.map((row) => row.id).filter(Number.isInteger),
      valueJson: { success: collectionSuccess, total: collectionTotal },
    },
  ]
}

