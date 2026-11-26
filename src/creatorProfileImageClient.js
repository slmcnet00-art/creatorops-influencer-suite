import { getAuthenticatedApiHeaders, getBackendConfig } from './backendSync.js'
const cache = new Map(), queue = [], listeners = new Set(), observations = new Map()
let active = 0, flushTimer
export function subscribeCreatorProfileEvidence(listener) { listeners.add(listener); return () => listeners.delete(listener) }
function flush() {
  clearTimeout(flushTimer)
  if (active || queue.length) { flushTimer = setTimeout(flush, 2000); return }
  const batch = [...observations.values()]
  observations.clear()
  if (batch.length) listeners.forEach(listener => listener(batch))
}
function pump() {
  while (active < 2 && queue.length) {
    active++
    const job = queue.shift()
    job.run().catch(() => ({ status: 'unavailable', imageUrl: '' })).then(data => {
      cache.set(job.url, { promise: Promise.resolve(data), expires: Date.now() + (data.status === 'verified' ? 6 * 3600000 : 120000) })
      if (['verified', 'account_not_found'].includes(data.status)) observations.set(job.url, data)
      job.resolve(data)
    }).finally(() => { active--; pump(); clearTimeout(flushTimer); flushTimer = setTimeout(flush, 1000) })
  }
}
export function loadCreatorProfileImage(url) {
  const previous = cache.get(url)
  if (previous?.expires > Date.now()) return previous.promise
  const promise = new Promise(resolve => queue.push({ url, resolve, run: async () => {
    const baseUrl = getBackendConfig().apiBaseUrl.replace(/\/$/, '')
    if (!baseUrl) return { status: 'unavailable', imageUrl: '' }
    const response = await fetch(`${baseUrl}/creators/profile-image`, { method: 'POST', headers: await getAuthenticatedApiHeaders(), body: JSON.stringify({ url }), signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw Error('profile unavailable')
    return (await response.json()).data
  } }))
  cache.set(url, { promise, expires: Infinity })
  pump()
  return promise
}
