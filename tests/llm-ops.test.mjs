import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createLlmOps, estimateCost, summarizeLlmRuns } from '../server/llmOps.js'
import { seal, unseal } from '../server/integrationStore.js'
import { memorySupabase } from './helpers/memorySupabase.mjs'

const env = { LLM_OPS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), OPENAI_MODEL: 'fixture-model' }
const prompt = '비공개 관리자 전략과 customer@example.com'
const context = { featureKey: 'campaign-strategy', policyVersion: 'v7' }
const provider = async () => ({ text: '검증된 결과', payload: { usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 30 } } } })
function fixture() { return memorySupabase({ workspaces: [{ id: 'test', updated_at: '2026-01-01T00:00:00Z', settings: { llmOpsPricing: { 'fixture-model': { input: 1, cachedInput: 0.25, output: 2 } } } }] }) }
async function start(t, ops) {
  const app = express(); app.use(express.json())
  ops.register(app, (req, _res, next) => {
    if (req.headers.authorization !== 'Bearer admin-fixture') return next(Object.assign(Error('admin required'), { status: 403 }))
    req.adminUser = { id: null }; next()
  }, provider)
  app.use((e, _req, res, _next) => res.status(e.status || 500).json({ error: e.message }))
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); t.after(() => server.close())
  return async (path, options = {}) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/admin/llm-ops${path}`, { ...options, headers: { Authorization: 'Bearer admin-fixture', 'Content-Type': 'application/json', ...options.headers } })
    return { status: r.status, body: await r.json() }
  }
}
test('LLM 호출은 암호화된 입력/출력·토큰·요율 스냅샷을 저장하며 상세는 관리자만 본다', async t => {
  const client = fixture(), ops = createLlmOps({ getClient: () => client, workspaceId: 'test', env })
  assert.equal(await ops.execute(prompt, context, provider), '검증된 결과')
  const row = client.tables.ai_generation_runs[0]
  assert.equal(row.status, 'success')
  assert.equal(JSON.stringify(row).includes(prompt), false)
  assert.equal(JSON.stringify(row).includes('검증된 결과'), false)
  assert.equal(unseal(row.input_payload.encryptedInput, env).prompt, prompt)
  assert.equal(row.output_payload.usage.cachedInputTokens, 30)
  assert.equal(row.output_payload.estimatedCostUsd, 0.0001175)
  const call = await start(t, ops)
  assert.equal((await call('', { headers: { Authorization: 'Bearer viewer' } })).status, 403)
  const list = await call('')
  assert.equal(list.body.data.summary.success, 1)
  assert.equal(JSON.stringify(list.body).includes('encryptedInput'), false)
  assert.equal((await call(`/runs/${row.id}`)).body.data.input, prompt)
})
test('기록 실패/암호화 키 미설정 시 모델을 호출하지 않는다', async () => {
  let calls = 0
  const p = async () => { calls++; return provider() }
  const client = fixture(); client.failInsert = 'ai_generation_runs'
  await assert.rejects(createLlmOps({ getClient: () => client, workspaceId: 'test', env }).execute(prompt, context, p), { status: 503 })
  await assert.rejects(createLlmOps({ getClient: () => client, workspaceId: 'test', env: {} }).execute(prompt, context, p), { status: 503 })
  assert.equal(calls, 0)
})
test('모델/출력 검증 실패는 실패 이력으로 기록되고 확인 없는 재실행·동시 재실행을 차단한다', async t => {
  const client = fixture(), ops = createLlmOps({ getClient: () => client, workspaceId: 'test', env })
  await assert.rejects(ops.execute(prompt, context, async () => { throw Error('upstream failed') }))
  assert.equal(client.tables.ai_generation_runs[0].status, 'failed')
  const call = await start(t, ops), id = client.tables.ai_generation_runs[0].id
  assert.equal((await call(`/runs/${id}/retry`, { method: 'POST', body: '{}' })).status, 400)
  const retry = { method: 'POST', body: JSON.stringify({ confirm: true }) }
  const results = await Promise.all([call(`/runs/${id}/retry`, retry), call(`/runs/${id}/retry`, retry)])
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
  assert.equal(client.tables.ai_generation_runs.length, 2)
  assert.equal(client.tables.ai_generation_runs[1].input_payload.retryOf, id)
  const invalid = createLlmOps({ getClient: () => client, workspaceId: 'test', env, validateOutput() { throw Error('invalid JSON') } })
  await assert.rejects(invalid.execute(prompt, context, provider), /invalid JSON/)
  assert.equal(client.tables.ai_generation_runs.at(-1).status, 'failed')
})
test('비용 미산정은 무료로 간주하지 않고 요율 변경은 과거 비용을 바꾸지 않는다', async () => {
  assert.equal(estimateCost({ inputTokens: 100, outputTokens: 1 }, null), null)
  const summary = summarizeLlmRuns([{ state: 'failed', estimatedCostUsd: null }, { state: 'success', estimatedCostUsd: 0.1 }])
  assert.equal(summary.unpricedCount, 1); assert.equal(summary.estimatedCostUsd, 0.1)
  const client = fixture(), ops = createLlmOps({ getClient: () => client, workspaceId: 'test', env })
  await ops.execute(prompt, context, provider)
  client.tables.workspaces[0].settings.llmOpsPricing['fixture-model'].input = 999
  assert.equal(client.tables.ai_generation_runs[0].output_payload.estimatedCostUsd, 0.0001175)
})
test('30일이 지난 원문은 삭제하고 모델/정책/사용량 이력은 유지한다', async () => {
  const client = fixture(), ops = createLlmOps({ getClient: () => client, workspaceId: 'test', env })
  await ops.execute(prompt, context, provider)
  client.tables.ai_generation_runs[0].created_at = '2020-01-01T00:00:00Z'
  const result = await ops.purgeExpired()
  assert.equal(result.cleared, 1)
  const row = client.tables.ai_generation_runs[0]
  assert.equal(row.input_payload.encryptedInput, undefined)
  assert.equal(row.output_payload.encryptedOutput, undefined)
  assert.equal(row.output_payload.usage.inputTokens, 100)
  assert.equal(row.prompt_version, 'v7')
  assert.throws(() => unseal({ ...seal(prompt, env), tag: Buffer.alloc(16).toString('base64') }, env))
})
