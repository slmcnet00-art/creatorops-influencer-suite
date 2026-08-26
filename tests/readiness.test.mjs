import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildReadinessReport,
  getConfigurationReadiness,
  REQUIRED_DATA_ROOM_TABLES,
} from '../server/readiness.js'

const completeEnv = {
  YOUTUBE_DATA_API_KEY: 'youtube-secret-value',
  GOOGLE_SEARCH_API_KEY: 'google-secret-value',
  GOOGLE_SEARCH_CX: 'google-cx-value',
  BRAVE_SEARCH_API_KEY: 'brave-secret-value',
  OPENAI_API_KEY: 'openai-secret-value',
  OPENAI_MODEL: 'gpt-4.1-mini',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'supabase-secret-value',
  GMAIL_CLIENT_ID: 'gmail-client-value',
  GMAIL_CLIENT_SECRET: 'gmail-secret-value',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://creatorops.example/oauth/google/callback',
}

test('Gmail readiness uses the same environment names as the OAuth routes', () => {
  const integrations = getConfigurationReadiness(completeEnv)
  const gmail = integrations.find((item) => item.key === 'gmail-oauth')

  assert.equal(gmail.configured, true)
  assert.equal(gmail.authUrlReady, true)
  assert.equal(gmail.tokenExchangeReady, true)
  assert.equal(gmail.state, 'authorization_required')
  assert.deepEqual(gmail.missingEnvironment, [])
})

test('Gmail readiness distinguishes an auth URL from complete token-exchange configuration', () => {
  const integrations = getConfigurationReadiness({
    GMAIL_CLIENT_ID: 'gmail-client-value',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://creatorops.example/oauth/google/callback',
  })
  const gmail = integrations.find((item) => item.key === 'gmail-oauth')

  assert.equal(gmail.configured, false)
  assert.equal(gmail.authUrlReady, true)
  assert.equal(gmail.tokenExchangeReady, false)
  assert.equal(gmail.state, 'partial_configuration')
  assert.deepEqual(gmail.missingEnvironment, ['GMAIL_CLIENT_SECRET'])
})

test('live readiness probes are GET-only and never include secrets in the report', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options })
    return { ok: true, status: 200 }
  }

  const report = await buildReadinessReport({
    env: completeEnv,
    probe: true,
    fetchImpl,
    dataRoomProbe: async () => ({
      ok: true,
      tableStatus: 'ready',
      readyTables: REQUIRED_DATA_ROOM_TABLES.length,
      requiredTables: REQUIRED_DATA_ROOM_TABLES.length,
    }),
  })

  assert.equal(report.mode, 'safe_read_only')
  assert.equal(report.summary.state, 'ready_with_user_action')
  assert.equal(report.summary.ready, 4)
  assert.equal(report.summary.requiresUserAction, 1)
  assert.equal(report.summary.blocked, 0)
  assert.equal(report.safety.emailSent, false)
  assert.equal(report.safety.contentGenerated, false)
  assert.equal(report.safety.dataWritten, false)
  assert.equal(requests.length, 3)
  assert.ok(requests.every((request) => request.options.method === 'GET'))
  assert.ok(requests.every((request) => request.options.body === undefined))
  const profileSearchRequest = requests.find((request) => request.url.includes('search.brave.com'))
  assert.ok(profileSearchRequest)
  assert.equal(profileSearchRequest.options.headers['X-Subscription-Token'], completeEnv.BRAVE_SEARCH_API_KEY)

  const serialized = JSON.stringify(report)
  for (const secret of Object.values(completeEnv)) {
    assert.equal(serialized.includes(secret), false)
  }
})

test('provider errors are classified without returning provider payloads or request URLs', async () => {
  const report = await buildReadinessReport({
    env: completeEnv,
    probe: true,
    fetchImpl: async (url) => ({
      ok: false,
      status: String(url).includes('openai.com') ? 401 : 429,
    }),
    dataRoomProbe: async () => ({
      ok: false,
      tableStatus: 'schema_or_permission_issue',
      readyTables: 12,
      requiredTables: REQUIRED_DATA_ROOM_TABLES.length,
    }),
  })

  assert.equal(report.summary.state, 'not_ready')
  assert.equal(report.integrations.find((item) => item.key === 'openai').state, 'credential_error')
  assert.equal(report.integrations.find((item) => item.key === 'youtube').state, 'rate_limited')
  assert.equal(report.integrations.find((item) => item.key === 'profile-search').state, 'rate_limited')
  assert.equal(report.integrations.find((item) => item.key === 'data-room').state, 'unavailable')
  assert.equal(JSON.stringify(report).includes('openai-secret-value'), false)
})

test('profile search readiness falls back to Google CSE only when Brave is not configured', async () => {
  const requests = []
  const { BRAVE_SEARCH_API_KEY: _unused, ...googleOnlyEnv } = completeEnv
  const report = await buildReadinessReport({
    env: googleOnlyEnv,
    probe: true,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options })
      return { ok: true, status: 200 }
    },
    dataRoomProbe: async () => ({
      ok: true,
      tableStatus: 'ready',
      readyTables: REQUIRED_DATA_ROOM_TABLES.length,
      requiredTables: REQUIRED_DATA_ROOM_TABLES.length,
    }),
  })

  const profileSearch = report.integrations.find((item) => item.key === 'profile-search')
  assert.equal(profileSearch.provider, 'google-cse')
  assert.equal(profileSearch.state, 'ready')
  assert.ok(requests.some((request) => request.url.includes('googleapis.com/customsearch')))
  assert.ok(requests.every((request) => !request.url.includes('search.brave.com')))
})
