import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createDecisionMemory } from '../server/decisionMemory.js'
import { createLlmOps } from '../server/llmOps.js'
import { unseal } from '../server/integrationStore.js'
import { memorySupabase } from './helpers/memorySupabase.mjs'
const env = { LLM_OPS_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64') }
const proposal = { featureKey: 'outreach-message', topic: '메일 제목', feedback: '제목에 내부 등급이 나타남', judgment: '내부 분류는 상대방에게 불필요하다', principle: '제목에 내부 등급을 쓰지 않는다. 브랜드와 협업 취지를 표현한다.' }
async function fixture(t) {
  const client = memorySupabase({ workspaces: [{ id: 'test', settings: { unrelated: true }, updated_at: '2026-01-01T00:00:00Z' }] })
  const memory = createDecisionMemory({ getClient: () => client, workspaceId: 'test', env })
  const app = express(); app.use(express.json()); memory.register(app, (req, res, next) => {
    if (req.headers.authorization !== 'Bearer admin') return res.status(403).json({ error: 'forbidden' })
    req.adminUser = { id: null }; next()
  }); app.use((e, _req, res, _next) => res.status(e.status || 500).json({ message: e.message }))
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); t.after(() => server.close())
  async function call(path = '', body, auth = 'admin') {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/admin/decision-memory${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, body: await r.json() }
  }
  const ops = createLlmOps({ getClient: () => client, workspaceId: 'test', env, retrieveMemory: memory.retrieve })
  return { client, memory, call, ops }
}
test('관리자만 사례를 읽고 저장하며 원문은 암호화되고 기존 설정은 보존된다', async t => {
  const { call, client } = await fixture(t)
  assert.equal((await call('', undefined, 'member')).status, 403)
  assert.equal((await call('', { ...proposal, revision: 0 }, 'member')).status, 403)
  assert.equal((await call('', { ...proposal, revision: 0 })).status, 201)
  assert.equal(client.tables.workspaces[0].settings.unrelated, true)
  assert.equal(JSON.stringify(client.tables).includes(proposal.feedback), false)
  assert.equal((await call()).body.data.cases[0].judgment, proposal.judgment)
})
test('대기 원칙은 적용하지 않으며 승인 원칙만 해당 기능에 주입하고 근거 버전을 기록한다', async t => {
  const { call, memory, ops, client } = await fixture(t)
  const saved = (await call('', { ...proposal, revision: 0 })).body.data
  assert.deepEqual((await memory.retrieve('outreach-message')).rules, [])
  const approved = await call(`/${saved.cases[0].id}/review`, { action: 'approve', revision: 1 })
  assert.equal(approved.status, 200)
  assert.deepEqual((await memory.retrieve('campaign-strategy')).rules, [])
  let actual
  await ops.execute('Base administrator policy', { featureKey: 'outreach-message' }, async prompt => { actual = prompt; return { text: 'result' } })
  assert.ok(actual.includes(proposal.principle))
  assert.equal(client.tables.ai_generation_runs[0].input_payload.decisionMemory.rules[0].caseId, saved.cases[0].id)
  assert.equal(client.tables.ai_generation_runs[0].input_payload.decisionMemory.rules[0].version, 2)
  assert.ok(unseal(client.tables.ai_generation_runs[0].input_payload.encryptedInput, env).prompt.includes(proposal.principle))
})
test('동시 수정과 중복 승인·같은 주제 충돌은 덮어쓰지 않고 거부한다', async t => {
  const { call } = await fixture(t)
  const first = await call('', { ...proposal, revision: 0 })
  assert.equal((await call('', { ...proposal, revision: 0 })).status, 409)
  const id = first.body.data.cases[0].id
  assert.equal((await call(`/${id}/review`, { action: 'approve', revision: 1 })).status, 200)
  assert.equal((await call(`/${id}/review`, { action: 'approve', revision: 2 })).status, 409)
  const second = await call('', { ...proposal, revision: 2 })
  assert.equal((await call(`/${second.body.data.cases[0].id}/review`, { action: 'approve', revision: 3 })).status, 409)
})
test('중지한 원칙은 다음 실행에서 제외되고 재승인하면 검토 이력과 버전이 증가한다', async t => {
  const { call, memory } = await fixture(t)
  const id = (await call('', { ...proposal, revision: 0 })).body.data.cases[0].id
  await call(`/${id}/review`, { action: 'approve', revision: 1 })
  await call(`/${id}/review`, { action: 'retire', revision: 2 })
  assert.equal((await memory.retrieve('outreach-message')).rules.length, 0)
  const result = await call(`/${id}/review`, { action: 'approve', revision: 3 })
  assert.equal(result.body.data.cases[0].version, 4)
  assert.equal(result.body.data.cases[0].history.length, 4)
})
test('재시도는 승인된 고정 입력을 유지하고 회수된 원칙은 재사용하지 않는다', async t => {
  const { ops, client, call, memory } = await fixture(t)
  const proposed = (await call('', { ...proposal, revision: 0 })).body.data
  const id = proposed.cases[0].id
  const approved = (await call('/'+id+'/review', { revision: proposed.revision, action: 'approve' })).body.data
  const active = await memory.retrieve(proposal.featureKey)
  const trace = { revision: active.revision, rules: active.rules.map(r=>({caseId:r.caseId,version:r.version})) }
  let actual
  await ops.execute('Pinned prompt with old rule', { featureKey: 'outreach-message', retryOf: 99, decisionMemory: trace }, async prompt => { actual = prompt; return { text: 'retry' } })
  assert.equal(actual, 'Pinned prompt with old rule')
  assert.deepEqual(client.tables.ai_generation_runs[0].input_payload.decisionMemory, trace)
  await call('/'+id+'/review', { revision: approved.revision, action: 'retire' })
  let calls=0
  await assert.rejects(ops.execute('Pinned prompt with old rule', { featureKey: 'outreach-message', retryOf: 99, decisionMemory: trace }, async()=>{calls++;return {text:'must not run'}}),e=>e.status===409)
  assert.equal(calls,0);assert.equal(client.tables.ai_generation_runs.length,1)
})
test('유효하지 않은 기능·빈 피드백·존재하지 않는 호출 연결을 거부한다', async t => {
  const { call } = await fixture(t)
  for (const patch of [{ featureKey: 'unknown' }, { feedback: '' }, { principle: 'x'.repeat(1001) }, { runId: 999 }]) {
    assert.equal((await call('', { ...proposal, ...patch, revision: 0 })).status, 400)
  }
  assert.equal((await call()).body.data.revision, 0)
})
