const REQUIRED_DATA_ROOM_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']

export const REQUIRED_DATA_ROOM_TABLES = [
  'workspaces',
  'raw_data_sources',
  'metric_definitions',
  'external_search_events',
  'utm_tracking_rows',
  'external_report_imports',
  'external_report_rows',
  'metric_snapshots',
  'creator_profile_snapshots',
  'creator_contact_points',
  'creator_rates',
  'content_metric_snapshots',
  'creator_operations',
  'content_templates',
]

const STATE_MESSAGES = {
  configured: 'Configuration is present. Run the read-only check to verify access.',
  missing_configuration: 'Required server configuration is missing.',
  partial_configuration: 'Some required server configuration is missing.',
  authorization_required: 'OAuth is configured. A user must authorize Gmail before sending.',
}

function hasValue(env, name) {
  return Boolean(String(env[name] || '').trim())
}

function missingNames(env, names) {
  return names.filter((name) => !hasValue(env, name))
}

function configuredIntegration({ key, label, env, requiredEnv, description }) {
  const missingEnvironment = missingNames(env, requiredEnv)
  const configured = missingEnvironment.length === 0
  const state = configured
    ? 'configured'
    : missingEnvironment.length === requiredEnv.length
      ? 'missing_configuration'
      : 'partial_configuration'

  return {
    key,
    label,
    description,
    configured,
    state,
    message: STATE_MESSAGES[state],
    missingEnvironment,
    testMode: 'read_only',
  }
}

export function getConfigurationReadiness(env = process.env) {
  const youtube = configuredIntegration({
    key: 'youtube',
    label: 'YouTube Data API',
    description: 'Public video metadata lookup',
    env,
    requiredEnv: ['YOUTUBE_DATA_API_KEY'],
  })
  const googleSearch = configuredIntegration({
    key: 'google-search',
    label: 'Google Search/CX',
    description: 'Public profile search',
    env,
    requiredEnv: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'],
  })
  const openai = configuredIntegration({
    key: 'openai',
    label: 'OpenAI',
    description: 'Configured model access',
    env,
    requiredEnv: ['OPENAI_API_KEY'],
  })
  const dataRoomEnv = {
    ...env,
    SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  }
  const dataRoom = configuredIntegration({
    key: 'data-room',
    label: 'Supabase data room',
    description: `${REQUIRED_DATA_ROOM_TABLES.length} required tables`,
    env: dataRoomEnv,
    requiredEnv: REQUIRED_DATA_ROOM_ENV,
  })

  const gmailRequiredEnv = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI']
  const gmailMissingEnvironment = missingNames(env, gmailRequiredEnv)
  const gmailConfigured = gmailMissingEnvironment.length === 0
  const authUrlReady = hasValue(env, 'GMAIL_CLIENT_ID') && hasValue(env, 'GOOGLE_OAUTH_REDIRECT_URI')
  const gmailState = gmailConfigured
    ? 'authorization_required'
    : gmailMissingEnvironment.length === gmailRequiredEnv.length
      ? 'missing_configuration'
      : 'partial_configuration'
  const gmail = {
    key: 'gmail-oauth',
    label: 'Google/Gmail OAuth',
    description: 'Gmail send authorization',
    configured: gmailConfigured,
    state: gmailState,
    message: STATE_MESSAGES[gmailState],
    missingEnvironment: gmailMissingEnvironment,
    authUrlReady,
    tokenExchangeReady: gmailConfigured,
    requiresUserAuthorization: gmailConfigured,
    testMode: 'configuration_only',
  }

  return [youtube, googleSearch, openai, dataRoom, gmail]
}

function classifyProbeResponse(response) {
  if (response.ok) return 'ready'
  if (response.status === 429) return 'rate_limited'
  if (response.status === 401 || response.status === 403) return 'credential_error'
  return 'unavailable'
}

function probeMessage(state, status) {
  if (state === 'ready') return 'Read-only request succeeded.'
  if (state === 'rate_limited') return 'The provider accepted the route but is currently rate limited.'
  if (state === 'credential_error') return `The provider rejected the configured credential (HTTP ${status}).`
  return `The provider returned HTTP ${status}.`
}

async function probeRequest(fetchImpl, url, options = {}, timeoutMs = 10_000) {
  const startedAt = Date.now()
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (response.body?.cancel) await response.body.cancel().catch(() => {})
    const state = classifyProbeResponse(response)
    return {
      state,
      ok: state === 'ready',
      httpStatus: response.status,
      latencyMs: Date.now() - startedAt,
      message: probeMessage(state, response.status),
    }
  } catch (error) {
    return {
      state: 'unavailable',
      ok: false,
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      message: error?.name === 'TimeoutError'
        ? 'The read-only request timed out.'
        : 'The provider could not be reached.',
    }
  }
}

function mergeProbe(integration, probe) {
  return {
    ...integration,
    ...probe,
    configured: integration.configured,
    missingEnvironment: integration.missingEnvironment,
    testMode: integration.testMode,
  }
}

function summarize(integrations, probed) {
  const readyStates = new Set(['ready', 'configured'])
  const userActionStates = new Set(['authorization_required'])
  const ready = integrations.filter((item) => readyStates.has(item.state)).length
  const requiresUserAction = integrations.filter((item) => userActionStates.has(item.state)).length
  const blocked = integrations.length - ready - requiresUserAction
  const needsAction = requiresUserAction + blocked
  const state = blocked === 0 && requiresUserAction > 0
    ? 'ready_with_user_action'
    : blocked === 0
    ? probed ? 'ready' : 'configured'
    : ready === 0
      ? 'not_ready'
      : 'partial'

  return {
    state,
    total: integrations.length,
    ready,
    requiresUserAction,
    blocked,
    needsAction,
    probed,
  }
}

export async function buildReadinessReport({
  env = process.env,
  probe = false,
  fetchImpl = globalThis.fetch,
  dataRoomProbe,
  timeoutMs = 10_000,
} = {}) {
  const configured = getConfigurationReadiness(env)
  if (!probe) {
    return {
      checkedAt: new Date().toISOString(),
      mode: 'configuration_only',
      summary: summarize(configured, false),
      integrations: configured,
      safety: {
        readOnly: true,
        emailSent: false,
        contentGenerated: false,
        dataWritten: false,
        secretsIncluded: false,
      },
    }
  }

  const integrations = await Promise.all(configured.map(async (integration) => {
    if (!integration.configured) return integration

    if (integration.key === 'gmail-oauth') {
      return {
        ...integration,
        state: 'authorization_required',
        message: 'OAuth configuration is complete. User authorization was not attempted and no email was sent.',
      }
    }

    if (integration.key === 'data-room') {
      if (typeof dataRoomProbe !== 'function') {
        return {
          ...integration,
          state: 'unavailable',
          message: 'The data room checker is unavailable.',
        }
      }
      try {
        const result = await dataRoomProbe()
        return mergeProbe(integration, {
          state: result.ok ? 'ready' : 'unavailable',
          ok: Boolean(result.ok),
          message: result.ok
            ? `${result.readyTables}/${result.requiredTables} required tables are readable.`
            : `${result.readyTables}/${result.requiredTables} required tables are readable.`,
          tableStatus: result.tableStatus,
          readyTables: result.readyTables,
          requiredTables: result.requiredTables,
        })
      } catch {
        return mergeProbe(integration, {
          state: 'unavailable',
          ok: false,
          message: 'The data room could not be checked.',
        })
      }
    }

    if (integration.key === 'youtube') {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.search = new URLSearchParams({
        part: 'id',
        id: 'dQw4w9WgXcQ',
        key: env.YOUTUBE_DATA_API_KEY,
      })
      return mergeProbe(integration, await probeRequest(fetchImpl, url, {}, timeoutMs))
    }

    if (integration.key === 'google-search') {
      const url = new URL('https://www.googleapis.com/customsearch/v1')
      url.search = new URLSearchParams({
        key: env.GOOGLE_SEARCH_API_KEY,
        cx: env.GOOGLE_SEARCH_CX,
        q: 'site:youtube.com creator',
        num: '1',
        safe: 'active',
      })
      return mergeProbe(integration, await probeRequest(fetchImpl, url, {}, timeoutMs))
    }

    if (integration.key === 'openai') {
      const model = encodeURIComponent(env.OPENAI_MODEL || 'gpt-4.1-mini')
      return mergeProbe(integration, await probeRequest(
        fetchImpl,
        `https://api.openai.com/v1/models/${model}`,
        { headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` } },
        timeoutMs,
      ))
    }

    return integration
  }))

  return {
    checkedAt: new Date().toISOString(),
    mode: 'safe_read_only',
    summary: summarize(integrations, true),
    integrations,
    safety: {
      readOnly: true,
      emailSent: false,
      contentGenerated: false,
      dataWritten: false,
      secretsIncluded: false,
    },
  }
}
