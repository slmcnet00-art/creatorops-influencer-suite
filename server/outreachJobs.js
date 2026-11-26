const JOB_NAME = 'outreach-gmail-batch'
const STALE_MS = 15 * 60 * 1000
const error = (status, message) => Object.assign(new Error(message), { status })

// Tokens and email bodies exist only in the live worker closure, never in job metadata.
export function createOutreachJobs({ getClient, workspaceId, authorize, normalizeItem, executeBatch, schedule = fn => setImmediate(fn), now = () => new Date() }) {
  const client = () => {
    const db = getClient()
    if (!db) throw error(503, '발송 작업 저장소가 연결되지 않았습니다.')
    return db
  }
  const present = row => {
    const data = row.metadata || {}
    const stale = row.status === 'running' && now().getTime() - Date.parse(data.updatedAt || row.started_at) > STALE_MS
    return { id: String(row.id), status: stale ? 'manual_check_required' : data.state || (row.status === 'running' ? 'running' : row.status === 'success' ? 'completed' : 'failed'),
      requested: data.requested || 0, processed: data.processed || 0, results: data.results || [], policy: data.policy || {}, message: stale ? '작업이 중단됐을 수 있습니다. Gmail에서 발송 여부를 확인해주세요. 자동 재발송하지 않습니다.' : row.detail || '', updatedAt: data.updatedAt || row.started_at }
  }
  async function update(id, metadata, status = 'running', detail = '') {
    const { data, error: failure } = await client().from('job_runs')
      .update({ status, metadata, detail, ...(status !== 'running' ? { finished_at: now().toISOString() } : {}) })
      .eq('id', id).eq('workspace_id', workspaceId).eq('job_name', JOB_NAME).eq('status', 'running').select('id').maybeSingle()
    if (failure) throw failure
    if (!data) throw error(409, '이미 종료된 발송 작업입니다.')
  }
  async function start(request) {
    const input = request.body || {}
    if (String(input.workspaceId || workspaceId) !== workspaceId) throw error(403, '워크스페이스가 일치하지 않습니다.')
    if (!input.accessToken || typeof input.accessToken !== 'string' || !input.accessToken.trim()) throw error(401, 'Gmail 연결이 필요합니다.')
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 20) throw error(400, '발송 대상은 1~20건이어야 합니다.')
    const items = input.items.map(normalizeItem)
    await authorize(request, items)
    const metadata = { state: 'queued', requested: items.length, processed: 0, results: [], campaignIds: [...new Set(items.map(item => item.campaignId))], actorId: request.workspaceUser.id, updatedAt: now().toISOString() }
    const { data: row, error: failure } = await client().from('job_runs').insert({ workspace_id: workspaceId, job_name: JOB_NAME, status: 'running', metadata, detail: '발송 대기' }).select('*').single()
    if (failure) throw error(failure.code === '23505' ? 409 : 503, failure.code === '23505' ? '진행 중인 발송 작업을 먼저 확인해주세요.' : '발송 작업을 저장하지 못했습니다. 메일을 발송하지 않았습니다.')
    schedule(async () => {
      let progress = { ...metadata, state: 'running' }
      try {
        await update(row.id, progress)
        const data = await executeBatch({ ...request, body: { ...input, items }, onOutreachProgress: async results => {
          progress = { ...progress, processed: results.length, results: [...results], updatedAt: now().toISOString() }
          await update(row.id, progress)
        } })
        progress = { ...progress, processed: data.results.length, results: data.results, policy: data.policy, state: data.results.some(result => result.status === 'failed') ? 'completed_with_errors' : 'completed', updatedAt: now().toISOString() }
        await update(row.id, progress, 'success', '발송 작업 종료')
      } catch (failure) {
        progress = { ...progress, state: 'failed', updatedAt: now().toISOString() }
        await update(row.id, progress, 'failed', '발송 작업이 중단됐습니다. 처리 결과와 Gmail 발송함을 확인해주세요.').catch(() => {})
        // Durable per-recipient claims still block uncertain deliveries; never replay this worker.
        void failure
      }
    })
    return present(row)
  }
  async function read(request, id) {
    const { data: row, error: failure } = await client().from('job_runs').select('*').eq('id', id).eq('workspace_id', workspaceId).eq('job_name', JOB_NAME).maybeSingle()
    if (failure) throw failure
    if (!row) throw error(404, '발송 작업을 찾지 못했습니다.')
    await authorize(request, (row.metadata?.campaignIds || []).map(campaignId => ({ campaignId })))
    return present(row)
  }
  async function latest(request) {
    await authorize(request, [])
    const { data: row, error: failure } = await client().from('job_runs').select('id')
      .eq('workspace_id', workspaceId).eq('job_name', JOB_NAME).eq('metadata->>actorId', request.workspaceUser.id)
      .order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (failure) throw failure
    return row ? read(request, row.id) : null
  }
  async function close(request, id) {
    const job = await read(request, id)
    if (request.body?.confirmed !== true || job.status !== 'manual_check_required') throw error(409, '중단된 작업의 Gmail 발송 여부를 확인한 후 종료해주세요.')
    const { data: row, error: failure } = await client().from('job_runs').select('*').eq('id', id).eq('workspace_id', workspaceId).eq('job_name', JOB_NAME).maybeSingle()
    if (failure) throw failure
    const metadata = { ...row.metadata, state: 'closed_after_manual_review', updatedAt: now().toISOString() }
    await update(id, metadata, 'failed', '운영자가 Gmail 확인 후 작업을 종료했습니다. 메일을 재발송하지 않았습니다.')
    return present({ ...row, status: 'failed', metadata })
  }
  return { start, read, latest, close }
}
