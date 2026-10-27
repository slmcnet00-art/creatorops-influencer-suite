import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createOsWebhooks, isPublicAddress, validateWebhookUrl, webhookSignature } from '../server/osWebhooks.js'
import { memorySupabase } from './helpers/memorySupabase.mjs'

test('웹훅은 내부망·메타데이터·mapped IPv6·비 HTTPS·쿼리 자격증명을 차단한다', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1']) assert.equal(isPublicAddress(address), false)
  for (const url of ['http://example.com/hook', 'https://user:pass@example.com/hook', 'https://example.com:8443/hook', 'https://example.com/hook?token=secret']) await assert.rejects(validateWebhookUrl(url), { status: 400 })
  await assert.rejects(validateWebhookUrl('https://example.com/hook', async () => [{ address: '127.0.0.1', family: 4 }]), { status: 400 })
  assert.equal((await validateWebhookUrl('https://example.com/hook', async () => [{ address: '8.8.8.8', family: 4 }])).address.address, '8.8.8.8')
})
test('웹훅 서명은 타임스탬프와 원문 본문을 함께 검증한다', () => {
  const secret = 'fixture-secret', body = '{"type":"campaign.created"}', timestamp = '12345'
  assert.equal(webhookSignature(secret, timestamp, body), `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`)
  assert.notEqual(webhookSignature(secret, timestamp, body), webhookSignature(secret, timestamp, `${body} `))
})
function fixture() { return memorySupabase({ workspaces: [{ id: 'test', settings: { osWebhook: { url: 'https://example.com/hook', enabled: true, events: ['campaign.created'] } }, updated_at: '2026-01-01T00:00:00Z' }] }) }
test('알림은 DB에 저장되고 서로 다른 프로세스가 동시에 처리해도 하나만 선점한다', async () => {
  const client = fixture(), env = { CREATOROPS_OS_WEBHOOK_SECRET: 'fixture-'.repeat(6) }, received = []
  const options = { getClient: () => client, workspaceId: 'test', env, send: async (_url, event) => { received.push(event.id); return 204 } }
  const a = createOsWebhooks(options), b = createOsWebhooks(options)
  const published = await a.publish('campaign.created', { campaignId: 'c' })
  assert.equal(published.queued, true)
  assert.equal((await a.publish('operation.completed', {})).queued, false)
  await Promise.all([a.drain(), b.drain()])
  assert.deepEqual(received, [published.eventId])
  assert.equal(client.tables.job_runs[0].status, 'success')
})
test('실패한 알림은 재시작 후에도 같은 이벤트 ID로 재시도하며 비활성화하면 발송하지 않는다', async () => {
  const client = fixture(), env = { CREATOROPS_OS_WEBHOOK_SECRET: 'fixture-'.repeat(6) }
  const a = createOsWebhooks({ getClient: () => client, workspaceId: 'test', env, send: async () => { throw Error('offline') } })
  const event = await a.publish('campaign.created', {})
  await a.drain()
  assert.equal(client.tables.job_runs[0].status, 'running')
  client.tables.job_runs[0].metadata.nextAttemptAt = '2020-01-01T00:00:00Z'
  const sent = [], b = createOsWebhooks({ getClient: () => client, workspaceId: 'test', env, send: async (_url, e) => { sent.push(e.id); return 200 } })
  client.tables.workspaces[0].settings.osWebhook.enabled = false
  await b.drain(); assert.equal(sent.length, 0)
  client.tables.workspaces[0].settings.osWebhook.enabled = true
  await b.drain(); assert.deepEqual(sent, [event.eventId])
})
