import 'dotenv/config'
import { config as loadDotenv } from 'dotenv'

const envFile = process.env.RENDER_ENV_FILE || '.render-env.local'
loadDotenv({ path: envFile, override: false })

const apiBaseUrl = (
  process.env.CREATOROPS_API_BASE_URL
  || process.env.VITE_CREATOROPS_API_BASE_URL
  || 'https://creatorops-suite-api.onrender.com'
).replace(/\/$/, '')

const statusUrl = `${apiBaseUrl}/data-room/status`

try {
  const response = await fetch(statusUrl)
  const payload = await response.json()
  const logging = payload.dataRoomLogging || {}
  const checks = payload.checks || {}

  console.log(`Data room API status: ${payload.ok ? 'READY' : 'NOT_READY'}`)
  console.log(`Endpoint: ${statusUrl}`)
  console.log(`Workspace: ${logging.workspaceId || '-'}`)
  console.log(`SUPABASE_URL: ${logging.hasSupabaseUrl ? 'OK' : 'MISSING'}`)
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${logging.hasServiceRoleKey ? 'OK' : 'MISSING'}`)

  if (Array.isArray(logging.missingEnv) && logging.missingEnv.length) {
    console.log(`Missing env: ${logging.missingEnv.join(', ')}`)
  }

  if (Object.keys(checks).length) {
    console.log('Table checks:')
    for (const [table, check] of Object.entries(checks)) {
      console.log(`- ${table}: ${check.ok ? `OK (${check.count ?? 0})` : `ERROR (${check.message})`}`)
    }
  }

  if (Array.isArray(logging.nextActions) && logging.nextActions.length) {
    console.log('Next actions:')
    logging.nextActions.forEach((action, index) => console.log(`${index + 1}. ${action}`))
  }

  if (!logging.hasServiceRoleKey) {
    console.log('')
    console.log('Local setup hint:')
    console.log(`- Add SUPABASE_SERVICE_ROLE_KEY to ${envFile}.`)
    console.log('- Then run: npm run render:sync-env')
    console.log('- Then run: npm run data-room:status')
  }

  if (!payload.ok) process.exitCode = 1
} catch (error) {
  console.error(`Failed to check data room API status: ${error.message}`)
  process.exitCode = 1
}
