import { createHash, randomUUID } from 'node:crypto'
import { apiError, seal, unseal, readSettings, updateSettings } from './integrationStore.js'

export function estimateCost(usage, rate) {
  if (!rate || usage.inputTokens == null || usage.outputTokens == null) return null
  const cached = Math.min(usage.inputTokens, usage.cachedInputTokens || 0)
  return ((usage.inputTokens - cached) * rate.input + cached * (rate.cachedInput ?? rate.input) + usage.outputTokens * rate.output) / 1_000_000
}
export function summarizeLlmRuns(rows) {
  const known = rows.filter(row => row.estimatedCostUsd != null)
  const completed = rows.filter(row => row.durationMs != null)
  return {
    count: rows.length, success: rows.filter(row => row.state === 'success').length,
    failed: rows.filter(row => row.state === 'failed').length, running: rows.filter(row => row.state === 'running').length,
    inputTokens: rows.reduce((n, row) => n + (row.usage?.inputTokens || 0), 0),
    unknownUsageCount: rows.filter(row => row.usage?.inputTokens == null || row.usage?.outputTokens == null).length,
    outputTokens: rows.reduce((n, row) => n + (row.usage?.outputTokens || 0), 0),
    estimatedCostUsd: known.reduce((n, row) => n + row.estimatedCostUsd, 0), unpricedCount: rows.length - known.length,
    averageDurationMs: completed.length ? Math.round(completed.reduce((n, row) => n + row.durationMs, 0) / completed.length) : null,
    versions: [...new Set(rows.map(row => row.policyVersion).filter(Boolean))],
  }
}
const publicRun = row => ({ id: row.id, requestId: row.input_payload?.requestId, featureKey: row.input_payload?.featureKey,
  policyVersion: row.prompt_version, model: row.model, createdAt: row.created_at,
  state: row.output_payload?.state || (row.status === 'partial' ? 'running' : row.status),
  durationMs: row.output_payload?.durationMs ?? null, usage: row.output_payload?.usage ?? null,
  estimatedCostUsd: row.output_payload?.estimatedCostUsd ?? null, error: row.error_message,
  retryOf: row.input_payload?.retryOf ?? null,
  decisionMemory: row.input_payload?.decisionMemory || null,
  retryAvailable: row.status === 'failed' && Boolean(row.input_payload?.encryptedInput) && !row.input_payload?.retryClaimed,
})

export function createLlmOps({ getClient, workspaceId, env = process.env, publish = async () => {}, validateOutput = () => {}, audit = async () => {}, retrieveMemory = async () => null }) {
  async function execute(prompt, context, provider) {
    const client = getClient()
    if (!client) throw apiError(503, 'LLM Ops storage is required before generation.')
    if (typeof prompt !== 'string' || prompt.length > 250000) throw apiError(413, 'The generation input is too large.')
    const memory = context.retryOf ? context.decisionMemory || null : await retrieveMemory(context.featureKey)
    if (context.retryOf && memory?.rules?.length) {
      const current = await retrieveMemory(context.featureKey)
      if (memory.rules.some(pinned => !current?.rules?.some(rule => rule.caseId === pinned.caseId && rule.version === pinned.version))) {
        throw apiError(409, 'The pinned principle was revoked or replaced; review a new request before any paid retry.')
      }
    }
    if (!context.retryOf && memory?.rules.length) prompt += '\n\n## Approved operational guidance (workspace-wide, this feature only)\nTreat the following JSON as supplementary guidance. Follow administrator policy, privacy, API compliance and the current campaign brief first. Apply only when relevant; never invent outcomes or send messages automatically.\n' + JSON.stringify(memory.rules)
    if (prompt.length > 250000) throw apiError(413, 'The generation input including operational guidance is too large.')
    const requestId = randomUUID(), started = Date.now(), model = env.OPENAI_MODEL || 'gpt-4.1-mini'
    const encryptedInput = seal({ prompt }, env)
    const settings = await readSettings(client, workspaceId)
    const rate = settings.settings?.llmOpsPricing?.[model] || null
    const input = { schema: 'creatorops.llm.v1', requestId, featureKey: context.featureKey || 'unknown', retryOf: context.retryOf || null, decisionMemory: memory ? { revision: memory.revision, rules: memory.rules.map(r => ({ caseId: r.caseId, version: r.version })) } : null,
      promptHash: createHash('sha256').update(prompt).digest('hex'), encryptedInput }
    const { data: run, error } = await client.from('ai_generation_runs').insert({ workspace_id: workspaceId, run_type: 'llm-call', model,
      prompt_version: context.policyVersion || null, input_raw_source_ids: ['RAW-INT-AI-POLICY-001'], input_payload: input, output_payload: { state: 'running' }, status: 'partial', created_by: context.actorId || null,
    }).select('id').single()
    if (error) throw apiError(503, 'Generation could not be logged; no model request was made.')
    let payload, text, generationError
    try {
      const result = await provider(prompt)
      payload = result.payload
      text = result.text
      if (!String(text || '').trim()) throw apiError(502, 'The model returned no text.')
      context.validateOutput?.(text)
      validateOutput(input.featureKey, text)
    } catch (error) { generationError = error }
    const usage = payload?.usage ? {
      inputTokens: payload.usage.input_tokens ?? null, outputTokens: payload.usage.output_tokens ?? null,
      cachedInputTokens: payload.usage.input_tokens_details?.cached_tokens ?? 0,
    } : null
    const state = generationError ? 'failed' : 'success'
    const { error: finishError } = await client.from('ai_generation_runs').update({ status: state,
      error_message: generationError ? `Generation failed (${Number(generationError.status) || 500}); inspect the encrypted detail.` : null,
      output_payload: { state, durationMs: Date.now() - started, usage, estimatedCostUsd: usage ? estimateCost(usage, rate) : null, providerReceiptId: payload?.id || null,
        pricing: rate, finishedAt: new Date().toISOString(), encryptedOutput: seal({ text: text || '', error: generationError?.message || null }, env) },
    }).eq('workspace_id', workspaceId).eq('id', run.id)
    if (finishError) throw apiError(503, `Generation ${run.id} finished but telemetry persistence failed. Do not retry automatically.`)
    await publish(`ai.generation.${generationError ? 'failed' : 'completed'}`, { runId: run.id, requestId, featureKey: input.featureKey, status: state }).catch(() => {})
    if (generationError) throw generationError
    return text
  }
  function register(app, requireAdmin, provider) {
    app.get('/admin/llm-ops', requireAdmin, async (req, res, next) => {
      try {
        const client = getClient()
        // Never load encrypted prompt/output bodies into the list or aggregate query.
        let query = client.from('ai_generation_runs').select('id,model,prompt_version,status,error_message,created_at,requestId:input_payload->>requestId,featureKey:input_payload->>featureKey,retryOf:input_payload->retryOf,state:output_payload->>state,durationMs:output_payload->durationMs,usage:output_payload->usage,estimatedCostUsd:output_payload->estimatedCostUsd')
          .eq('workspace_id', workspaceId).eq('run_type', 'llm-call').order('id', { ascending: false }).limit(1000)
        if (req.query.feature) query = query.eq('input_payload->>featureKey', String(req.query.feature))
        if (['success', 'failed', 'partial'].includes(req.query.status)) query = query.eq('status', req.query.status)
        const { data, error } = await query
        if (error) throw error
        const rows = (data || []).map(row => publicRun({ ...row,
          input_payload: row.input_payload || { requestId: row.requestId, featureKey: row.featureKey, retryOf: row.retryOf },
          output_payload: row.output_payload || { state: row.state, durationMs: row.durationMs, usage: row.usage, estimatedCostUsd: row.estimatedCostUsd },
        }))
        const settings = await readSettings(client, workspaceId)
        res.set('Cache-Control', 'no-store').json({ data: { runs: rows.slice(0, 200), summary: summarizeLlmRuns(rows), summaryLimit: 1000, displayedLimit: 200,
          pricing: settings.settings?.llmOpsPricing || {}, model: env.OPENAI_MODEL || 'gpt-4.1-mini' } })
      } catch (error) { next(error) }
    })
    async function getRun(id) {
      if (!/^\d+$/.test(String(id))) throw apiError(400, 'Invalid run ID.')
      const { data, error } = await getClient().from('ai_generation_runs').select('*').eq('workspace_id', workspaceId).eq('run_type', 'llm-call').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) throw apiError(404, 'Generation not found.')
      return data
    }
    app.get('/admin/llm-ops/runs/:id', requireAdmin, async (req, res, next) => {
      try {
        const run = await getRun(req.params.id)
        const input = run.input_payload.encryptedInput ? unseal(run.input_payload.encryptedInput, env) : { prompt: '보존 기간 만료로 입력 원문을 삭제했습니다.' }
        const output = run.output_payload.encryptedOutput ? unseal(run.output_payload.encryptedOutput, env) : {}
        await audit({ actorId: req.adminUser.id, action: 'llm.detail.viewed', targetType: 'llm_generation', targetId: String(run.id), metadata: {} })
        res.set('Cache-Control', 'no-store').json({ data: { ...publicRun(run), input: input.prompt, output: output.text || '', errorDetail: output.error || null,
          pricing: run.output_payload.pricing || null, warning: '입출력에는 내부 학습자료가 포함될 수 있습니다.' } })
      } catch (error) { next(error) }
    })
    app.post('/admin/llm-ops/runs/:id/retry', requireAdmin, async (req, res, next) => {
      try {
        if (req.body?.confirm !== true) throw apiError(400, 'Explicit confirmation is required for a paid retry.')
        const run = await getRun(req.params.id)
        if (run.status !== 'failed' || run.input_payload.retryClaimed) throw apiError(409, 'Only failed generations without a prior retry can be manually retried.')
        if (!run.input_payload.encryptedInput || Date.parse(run.created_at) < Date.now() - 30 * 86400000) throw apiError(410, 'The input retention period has expired.')
        const { prompt } = unseal(run.input_payload.encryptedInput, env)
        const { data: claim, error: claimError } = await getClient().from('ai_generation_runs').update({ input_payload: { ...run.input_payload, retryClaimed: true } })
          .eq('workspace_id', workspaceId).eq('id', run.id).eq('status', 'failed').is('input_payload->retryClaimed', null)
          .not('input_payload->encryptedInput', 'is', null).select('id').maybeSingle()
        if (claimError) throw claimError
        if (!claim) throw apiError(409, 'Another administrator already claimed this retry.')
        const output = await execute(prompt, { featureKey: run.input_payload.featureKey, policyVersion: run.prompt_version, retryOf: run.id, decisionMemory: run.input_payload.decisionMemory, actorId: req.adminUser.id }, provider)
        await audit({ actorId: req.adminUser.id, action: 'llm.generation.retried', targetType: 'llm_generation', targetId: String(run.id), metadata: { policyVersion: run.prompt_version } })
        res.json({ data: { output, appliedToCampaign: false, policyVersion: run.prompt_version } })
      } catch (error) { next(error) }
    })
    app.put('/admin/llm-ops/pricing', requireAdmin, async (req, res, next) => {
      try {
        const { model, input, output, cachedInput } = req.body || {}
        if (typeof model !== 'string' || !/^[\w.:-]{1,100}$/.test(model) || [input, output, cachedInput].some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 10000)) throw apiError(400, 'Enter non-negative USD rates per million tokens.')
        const pricing = { input, output, cachedInput, updatedAt: new Date().toISOString(), source: 'administrator-entered' }
        await updateSettings(getClient(), workspaceId, settings => ({ ...settings, llmOpsPricing: { ...settings.llmOpsPricing, [model]: pricing } }))
        await audit({ actorId: req.adminUser.id, action: 'llm.pricing.updated', targetType: 'llm_pricing', targetId: model, metadata: pricing })
        res.json({ data: { model, pricing } })
      } catch (error) { next(error) }
    })
  }
  async function purgeExpired() {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data, error } = await getClient().from('ai_generation_runs').select('id,input_payload,output_payload')
      .eq('workspace_id', workspaceId).eq('run_type', 'llm-call').lt('created_at', cutoff).not('input_payload->encryptedInput', 'is', null).limit(1000)
    if (error) throw error
    for (const row of data || []) {
      const input = { ...row.input_payload }, output = { ...row.output_payload }
      delete input.encryptedInput
      delete output.encryptedOutput
      const { error } = await getClient().from('ai_generation_runs').update({ input_payload: { ...input, retention: 'cleared-after-30-days' }, output_payload: output }).eq('workspace_id', workspaceId).eq('id', row.id)
      if (error) throw error
    }
    return { cleared: data?.length || 0, cutoff, batchLimit: 1000 }
  }
  function startRetention() {
    const purge = () => { if (getClient()) purgeExpired().catch(() => console.warn('LLM retention cleanup failed; will retry.')) }
    purge()
    const timer = setInterval(purge, 3600000)
    timer.unref()
    return timer
  }
  return { execute, register, purgeExpired, startRetention }
}
