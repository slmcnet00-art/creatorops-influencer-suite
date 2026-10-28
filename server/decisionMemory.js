import { randomUUID } from 'node:crypto'
import { apiError, readSettings, updateSettings, seal, unseal } from './integrationStore.js'

const features = new Set(['creator-recommendation', 'campaign-strategy', 'content-guide', 'outreach-message'])
const empty = () => ({ revision: 0, cases: [] })
export function createDecisionMemory({ getClient, workspaceId, env = process.env, audit = async () => {} }) {
  const decode = settings => settings.decisionMemoryVault ? unseal(settings.decisionMemoryVault, env) : empty()
  async function read() { return decode((await readSettings(getClient(), workspaceId)).settings || {}) }
  async function mutate(revision, fn) {
    let result
    await updateSettings(getClient(), workspaceId, settings => {
      const memory = decode(settings)
      if (!Number.isInteger(revision) || memory.revision !== revision) throw apiError(409, '다른 관리자가 변경했습니다. 새로고침 후 다시 시도하세요.')
      fn(memory); memory.revision++; result = memory
      return { ...settings, decisionMemoryVault: seal(memory, env) }
    })
    return result
  }
  async function retrieve(featureKey) {
    const memory = await read()
    const rules = memory.cases.filter(c => c.state === 'approved' && c.featureKey === featureKey)
    if (rules.length > 20) throw apiError(409, '기능별 승인 원칙은 최대 20개입니다. 오래된 원칙을 중지하세요.')
    return { revision: memory.revision, rules: rules.map(c => ({ caseId: c.id, version: c.version, topic: c.topic, principle: c.principle })) }
  }
  function register(app, requireAdmin) {
    app.get('/admin/decision-memory', requireAdmin, async (req, res, next) => {
      try {
        const data = await read()
        await audit({ actorId: req.adminUser.id, action: 'decision-memory.viewed', targetType: 'decision-memory', targetId: workspaceId }).catch(() => {})
        res.set('Cache-Control', 'no-store').json({ data })
      } catch (e) { next(e) }
    })
    app.post('/admin/decision-memory', requireAdmin, async (req, res, next) => {
      try {
        const { revision, featureKey, topic, feedback, judgment, principle, runId } = req.body
        if (!features.has(featureKey)) throw apiError(400, '지원하는 AI 기능을 선택하세요.')
        for (const [key, value, max] of [['topic', topic, 100], ['feedback', feedback, 1500], ['judgment', judgment, 1500], ['principle', principle, 1000]]) {
          if (typeof value !== 'string' || !value.trim() || value.length > max) throw apiError(400, `${key}: 내용을 확인하세요 (최대 ${max}자).`)
        }
        if (runId != null && !/^\d+$/.test(String(runId))) throw apiError(400, '호출 번호를 확인하세요.')
        if (runId != null) {
          const { data, error } = await getClient().from('ai_generation_runs').select('id,input_payload').eq('workspace_id', workspaceId).eq('run_type', 'llm-call').eq('id', runId).maybeSingle()
          if (error) throw error
          if (!data || data.input_payload?.featureKey !== featureKey) throw apiError(400, '이 기능에 해당하는 호출이 아닙니다.')
        }
        const id = randomUUID(), now = new Date().toISOString()
        const result = await mutate(revision, m => {
          if (m.cases.length >= 200) throw apiError(409, '사례 저장 한도(200개)에 도달했습니다. 관리자 점검이 필요합니다.')
          m.cases.unshift({ id, featureKey, topic: topic.trim(), feedback: feedback.trim(), judgment: judgment.trim(), principle: principle.trim(), runId: runId || null,
            state: 'pending', version: 1, createdAt: now, createdBy: req.adminUser.id, history: [{ action: 'proposed', at: now, by: req.adminUser.id }] })
        })
        await audit({ action: 'decision-memory.proposed', actorId: req.adminUser.id, targetType: 'decision-case', targetId: id }).catch(() => {})
        res.status(201).json({ data: result })
      } catch (e) { next(e) }
    })
    app.post('/admin/decision-memory/:id/review', requireAdmin, async (req, res, next) => {
      try {
        const { revision, action } = req.body
        if (!['approve', 'reject', 'retire'].includes(action)) throw apiError(400, '검토 작업을 확인하세요.')
        const result = await mutate(revision, m => {
          const c = m.cases.find(c => c.id === req.params.id)
          if (!c) throw apiError(404, '사례를 찾지 못했습니다.')
          if (c.history.length >= 100) throw apiError(409, '검토 이력 한도에 도달했습니다. 새 사례로 제안하세요.')
          if (action === 'approve') {
            if (c.state === 'approved') throw apiError(409, '이미 승인된 원칙입니다.')
            const active = m.cases.filter(x => x.state === 'approved' && x.featureKey === c.featureKey)
            if (active.length >= 20) throw apiError(409, '기능별 최대 20개 원칙만 적용할 수 있습니다.')
            if (active.some(x => x.topic.toLowerCase() === c.topic.toLowerCase())) throw apiError(409, '같은 주제의 승인 원칙이 있습니다. 기존 원칙을 중지한 후 승인하세요.')
          }
          if (action === 'retire' && c.state !== 'approved') throw apiError(409, '승인된 원칙만 중지할 수 있습니다.')
          if (action === 'reject' && c.state !== 'pending') throw apiError(409, '검토 대기 사례만 반려할 수 있습니다.')
          c.state = { approve: 'approved', reject: 'rejected', retire: 'retired' }[action]
          c.version++; c.history.push({ action, at: new Date().toISOString(), by: req.adminUser.id })
        })
        await audit({ action: `decision-memory.${action}`, actorId: req.adminUser.id, targetType: 'decision-case', targetId: req.params.id }).catch(() => {})
        res.json({ data: result })
      } catch (e) { next(e) }
    })
  }
  async function observe() {
    const memory = await read()
    return { revision: memory.revision, states: memory.cases.filter(c => c.featureKey !== 'outreach-message').map(c => ({
      id: c.id, version: c.version, status: { approved: 'approved', retired: 'revoked', pending: 'pending', rejected: 'rejected' }[c.state] || 'unknown',
    })) }
  }
  return { register, retrieve, observe }
}
