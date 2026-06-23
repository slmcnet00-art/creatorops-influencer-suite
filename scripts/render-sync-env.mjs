import 'dotenv/config'
import { config as loadDotenv } from 'dotenv'

const envFile = process.env.RENDER_ENV_FILE || '.render-env.local'
loadDotenv({ path: envFile, override: false })

const apiKey = process.env.RENDER_API_KEY
const apiServiceName = process.env.RENDER_API_SERVICE_NAME || 'creatorops-suite-api'
const staticServiceName = process.env.RENDER_STATIC_SERVICE_NAME || 'creatorops-influencer-suite'

if (!apiKey) {
  console.error('RENDER_API_KEY is required.')
  console.error(`Put it in ${envFile} or set it in your shell environment.`)
  process.exit(1)
}

const apiEnvKeys = [
  'YOUTUBE_DATA_API_KEY',
  'GOOGLE_SEARCH_API_KEY',
  'GOOGLE_SEARCH_CX',
  'BRAVE_SEARCH_API_KEY',
  'PUBLIC_SNAPSHOT_ENABLED',
  'PUBLIC_SNAPSHOT_TIMEOUT_MS',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'CRON_SECRET',
]

const staticEnvKeys = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_WORKSPACE_ID',
  'VITE_CREATOROPS_API_BASE_URL',
]

const services = await listServices()
const apiService = findServiceByName(services, apiServiceName)
const staticService = findServiceByName(services, staticServiceName)

if (!apiService) {
  console.error(`Render service not found: ${apiServiceName}`)
  console.error(`Available services: ${services.map((service) => service.name).filter(Boolean).join(', ')}`)
  process.exit(1)
}

await syncServiceEnv(apiService, apiEnvKeys)

if (staticService) {
  await syncServiceEnv(staticService, staticEnvKeys)
} else {
  console.warn(`Static service not found: ${staticServiceName}. Skipped frontend env sync.`)
}

console.log('Render environment sync completed.')

async function listServices() {
  const all = []
  let cursor = ''

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: '100' })
    if (cursor) params.set('cursor', cursor)
    const payload = await renderFetch(`/v1/services?${params}`)
    const pageItems = Array.isArray(payload) ? payload : payload.services || payload.data || []
    all.push(...pageItems.map((item) => item.service || item))
    cursor = payload.nextCursor || payload.cursor || ''
    if (!cursor) break
  }

  return all
}

function findServiceByName(services, name) {
  return services.find((service) => service.name === name || service.serviceDetails?.name === name)
}

async function syncServiceEnv(service, keys) {
  const serviceId = service.id
  const serviceName = service.name || service.serviceDetails?.name || serviceId
  const entries = keys
    .map((key) => ({ key, value: process.env[key] }))
    .filter((entry) => typeof entry.value === 'string' && entry.value.length > 0)

  if (!entries.length) {
    console.warn(`No environment variables provided for ${serviceName}.`)
    return
  }

  console.log(`Syncing ${entries.length} environment variables to ${serviceName}...`)
  for (const entry of entries) {
    await renderFetch(`/v1/services/${serviceId}/env-vars/${encodeURIComponent(entry.key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value: entry.value }),
    })
    console.log(`- ${entry.key}: synced`)
  }
}

async function renderFetch(path, options = {}) {
  const response = await fetch(`https://api.render.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error(JSON.stringify(payload, null, 2))
    throw new Error(`Render API request failed: ${response.status} ${response.statusText}`)
  }
  return payload
}
