const terminal = new Set(['completed', 'completed_with_errors', 'failed', 'manual_check_required', 'closed_after_manual_review'])
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

export function outreachJobStorageKey(workspaceId, userId) {
  return userId ? `creatorops.outreachJob.v1:${encodeURIComponent(workspaceId)}:${encodeURIComponent(userId)}` : ''
}

export async function watchOutreachJob({ baseUrl, headers, jobId, onProgress, fetcher = fetch, sleep = wait, maxPolls = 400, signal }) {
  for (let index = 0; index < maxPolls; index += 1) {
    signal?.throwIfAborted()
    const response = await fetcher(`${baseUrl}/outreach/jobs/${encodeURIComponent(jobId)}`, { headers, signal })
    const payload = await response.json()
    if (!response.ok) throw Object.assign(new Error(payload.message || '발송 진행 상황을 불러오지 못했습니다.'), { status: response.status, jobId })
    signal?.throwIfAborted()
    const job = payload.data
    onProgress?.(job)
    if (terminal.has(job.status)) return job
    await sleep(1500)
  }
  throw Object.assign(new Error('진행 상황 조회를 잠시 멈췄습니다. 조회 재개 버튼으로 확인해주세요. 메일을 다시 발송하지 마세요.'), { jobId })
}

export async function sendAndWatchOutreachJob({ baseUrl, headers, body, onCreated, onProgress, fetcher = fetch, sleep, signal }) {
  signal?.throwIfAborted()
  const response = await fetcher(`${baseUrl}/outreach/jobs`, { method: 'POST', headers, body: JSON.stringify(body), signal })
  const payload = await response.json()
  if (!response.ok) throw Object.assign(new Error(payload.message || '발송 작업을 등록하지 못했습니다.'), { status: response.status })
  if (!payload.data?.id) throw new Error('발송 작업 번호를 확인하지 못했습니다.')
  signal?.throwIfAborted()
  onCreated?.(payload.data.id)
  return watchOutreachJob({ baseUrl, headers, jobId: payload.data.id, onProgress, fetcher, sleep, signal })
}

export function applyOutreachJobResults(workspace, results, sentAt) {
  const ids = new Set(results.filter(item => item.status === 'sent' || (item.reason === 'duplicate' && item.providerMessageId)).map(item => String(item.id)))
  let changed = false
  const outreach = (workspace.outreach || []).map(item => {
    if (!ids.has(String(item.id)) || item.status === '발송 완료') return item
    changed = true
    return { ...item, status: '발송 완료', sentAt: item.sentAt || sentAt, deliveryMode: 'Gmail API send' }
  })
  return changed ? { ...workspace, outreach } : workspace
}
