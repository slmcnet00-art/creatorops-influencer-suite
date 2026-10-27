import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

export const apiError = (status, message) => Object.assign(new Error(message), { status })
export function matchesSecret(supplied, expected) {
  if (typeof expected !== 'string' || expected.length < 32) return false
  const a = Buffer.from(String(supplied || '')), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
function vaultKey(env) {
  const key = Buffer.from(env.LLM_OPS_ENCRYPTION_KEY || '', 'base64')
  if (key.length !== 32) throw apiError(503, 'LLM Ops encryption is not configured.')
  return key
}
export function seal(value, env) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', vaultKey(env), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return { iv: iv.toString('base64'), data: encrypted.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
}
export function unseal(value, env) {
  const cipher = createDecipheriv('aes-256-gcm', vaultKey(env), Buffer.from(value.iv, 'base64'))
  cipher.setAuthTag(Buffer.from(value.tag, 'base64'))
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data, 'base64')), cipher.final()]).toString('utf8'))
}
export async function readSettings(client, workspaceId) {
  const { data, error } = await client.from('workspaces').select('settings,updated_at').eq('id', workspaceId).single()
  if (error) throw error
  return data
}
// Preserve unrelated settings and fail closed on concurrent writes.
export async function updateSettings(client, workspaceId, mutate) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await readSettings(client, workspaceId)
    const { data, error } = await client.from('workspaces').update({ settings: mutate(current.settings || {}), updated_at: new Date(Math.max(Date.now(), Date.parse(current.updated_at) + 1)).toISOString() })
      .eq('id', workspaceId).eq('updated_at', current.updated_at).select('settings,updated_at').maybeSingle()
    if (error) throw error
    if (data) return data.settings
  }
  throw apiError(409, 'Settings changed concurrently. Refresh and retry.')
}
