import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createOutreachJobs } from '../server/outreachJobs.js'
import { memorySupabase } from './helpers/memorySupabase.mjs'
import { sendAndWatchOutreachJob, watchOutreachJob, applyOutreachJobResults, outreachJobStorageKey } from '../src/outreachJobClient.js'

function fixture(executeBatch) {
  const db = memorySupabase(), scheduled = []
  const jobs = createOutreachJobs({ getClient: () => db, workspaceId: 'w', normalizeItem: item => item,
    authorize: async request => { if (request.workspaceUser.role !== 'Owner') throw Object.assign(new Error('forbidden'), { status: 403 }) },
    schedule: fn => scheduled.push(fn), executeBatch, now: () => new Date('2026-11-26T00:00:00Z') })
  const request = { workspaceUser: { id: 'u', role: 'Owner' }, body: { workspaceId: 'w', accessToken: 'PRIVATE_TOKEN', items: [{ id: 'i', campaignId: 'c', message: 'PRIVATE_EMAIL_BODY', to: 'test@example.invalid' }] } }
  return { db, jobs, scheduled, request }
}

test('queue acknowledges before sending, records progress and never stores tokens or email bodies', async () => {
  let executed = false
  const f = fixture(async req => { executed = true; await req.onOutreachProgress([{ id: 'i', status: 'sent' }]); return { results: [{ id: 'i', status: 'sent' }], policy: {} } })
  const job = await f.jobs.start(f.request)
  assert.equal(job.status, 'queued')
  assert.equal(executed, false)
  assert.doesNotMatch(JSON.stringify(f.db.tables.job_runs), /PRIVATE_TOKEN|PRIVATE_EMAIL_BODY|test@example/)
  await f.scheduled[0]()
  const done = await f.jobs.read(f.request, job.id)
  assert.equal(done.status, 'completed')
  assert.equal(done.processed, 1)
  assert.doesNotMatch(JSON.stringify(f.db.tables.job_runs), /PRIVATE_TOKEN|PRIVATE_EMAIL_BODY/)
})

test('partial batch failures remain visible and unauthorized reads or submissions fail', async () => {
  const f = fixture(async () => ({ results: [{ id: 'i', status: 'failed', requiresManualReview: true }], policy: {} }))
  const job = await f.jobs.start(f.request)
  await f.scheduled[0]()
  assert.equal((await f.jobs.read(f.request, job.id)).status, 'completed_with_errors')
  const denied = { ...f.request, workspaceUser: { id: 'other', role: 'Client' } }
  await assert.rejects(f.jobs.read(denied, job.id), { status: 403 })
  await assert.rejects(f.jobs.start(denied), { status: 403 })
})

test('interrupted job is manual review only and closing it never schedules another send', async () => {
  const f = fixture(async () => { throw new Error('must not send') })
  const job = await f.jobs.start(f.request)
  f.db.tables.job_runs[0].metadata.updatedAt = '2026-11-25T20:00:00Z'
  assert.equal((await f.jobs.read(f.request, job.id)).status, 'manual_check_required')
  await assert.rejects(f.jobs.close(f.request, job.id), { status: 409 })
  const closed = await f.jobs.close({ ...f.request, body: { confirmed: true } }, job.id)
  assert.equal(closed.status, 'closed_after_manual_review')
  assert.equal(f.scheduled.length, 1)
})

test('browser sends once and polls without tokens in GET; resume never submits again', async () => {
  const calls = [], events = [], responses = [{ data: { id: '1' } }, { data: { id: '1', status: 'running', processed: 1 } }, { data: { id: '1', status: 'completed', processed: 2 } }]
  const fetcher = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => responses.shift() } }
  await sendAndWatchOutreachJob({ baseUrl: 'https://example.invalid', headers: { Authorization: 'Bearer workspace' }, body: { accessToken: 'gmail-secret' }, fetcher, sleep: async () => {}, onProgress: row => events.push(row.processed) })
  assert.deepEqual(events, [1, 2])
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 1)
  assert.ok(calls.slice(1).every(call => !JSON.stringify(call).includes('gmail-secret')))
  await watchOutreachJob({ baseUrl: 'https://example.invalid', jobId: '1', headers: {}, fetcher: async (_url, options) => { assert.equal(options.method, undefined); return { ok: true, json: async () => ({ data: { status: 'completed' } }) } } })
})

test('job reconciliation handles legacy numeric IDs and storage keys are user scoped', () => {
  const workspace = { outreach: [{ id: 42, status: '승인 대기' }] }
  const next = applyOutreachJobResults(workspace, [{ id: '42', reason: 'duplicate', providerMessageId: 'gmail' }], 'now')
  assert.equal(next.outreach[0].status, '발송 완료')
  assert.notEqual(outreachJobStorageKey('w', 'u1'), outreachJobStorageKey('w', 'u2'))
  assert.equal(outreachJobStorageKey('w', ''), '')
})

test('a lost browser job ID can be recovered on another PC by the same authorized user', async () => {
  const f = fixture(async () => ({ results: [], policy: {} }))
  const started = await f.jobs.start(f.request)
  assert.equal((await f.jobs.latest(f.request)).id, started.id)
  assert.equal(await f.jobs.latest({ ...f.request, workspaceUser: { id: 'other', role: 'Owner' } }), null)
})

test('job acceptance fails before sending when persistence is unavailable', async () => {
  const f = fixture(async () => { throw new Error('must not execute') })
  f.db.failInsert = 'job_runs'
  await assert.rejects(f.jobs.start(f.request), { status: 503 })
  assert.equal(f.scheduled.length, 0)
})

test('migration and schema enforce a single running email job per workspace', () => {
  const migration = readFileSync(new URL('../supabase/migrations/202611260004_outreach_background_jobs.sql', import.meta.url), 'utf8')
  const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  const index = migration.match(/create unique index[\s\S]*?;/)[0]
  assert.ok(schema.includes(index))
  assert.match(index, /workspace_id/)
  assert.match(index, /status = 'running'/)
})

test('logging out aborts progress polling without resending or updating another session', async () => {
  const controller = new AbortController()
  let polls = 0, updates = 0
  await assert.rejects(watchOutreachJob({ baseUrl: 'https://example.invalid', headers: {}, jobId: '1', signal: controller.signal,
    fetcher: async () => { polls++; controller.abort(); return { ok: true, json: async () => ({ data: { status: 'running' } }) } },
    onProgress: () => { updates++ } }), { name: 'AbortError' })
  assert.equal(polls, 1)
  assert.equal(updates, 0)
})
