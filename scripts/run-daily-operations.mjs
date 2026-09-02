import { config as loadEnv } from 'dotenv'

loadEnv()
loadEnv({ path: '.render-env.local', override: false })

const apiBaseUrl = String(process.env.CREATOROPS_API_BASE_URL || process.env.VITE_CREATOROPS_API_BASE_URL || '').replace(/\/$/, '')
const cronSecret = String(process.env.CRON_SECRET || '')
if (!apiBaseUrl) throw new Error('CREATOROPS_API_BASE_URL is required.')
if (!cronSecret) throw new Error('CRON_SECRET is required.')

const response = await fetch(`${apiBaseUrl}/jobs/daily-operations`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${cronSecret}`,
    'Content-Type': 'application/json',
  },
})
const payload = await response.json().catch(() => ({}))
if (!response.ok) throw new Error(payload.message || `Daily operations failed (${response.status}).`)
console.log(JSON.stringify({ ok: true, run: payload.data?.run || null }))

