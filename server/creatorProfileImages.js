const error = message => Object.assign(new Error(message), { status: 400 })
const decode = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, number) => String.fromCodePoint(parseInt(hex || number, hex ? 16 : 10)))
const meta = (html, name) => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), decode(m[2])]))
    if (attrs.property === name || attrs.name === name) return attrs.content || ''
  }
  return ''
}
function profileIdentity(value) {
  let url
  try { url = new URL(value) } catch { throw error('올바른 채널 프로필 주소가 필요합니다.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw error('HTTPS 공개 프로필만 지원합니다.')
  const host = url.hostname.replace(/^www\./, '')
  let parts
  try { parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent) } catch { throw error('잘못된 프로필 주소입니다.') }
  if (host === 'instagram.com' && parts.length === 1 && /^[\w.]{1,30}$/.test(parts[0]) && !['accounts', 'explore', 'about', 'p', 'reel', 'stories', 'direct'].includes(parts[0])) return { platform: 'Instagram', handle: parts[0], url: `https://www.instagram.com/${parts[0]}/` }
  if (host === 'tiktok.com' && parts.length === 1 && /^@[\w.]+$/.test(parts[0])) return { platform: 'TikTok', handle: parts[0].slice(1), url: `https://www.tiktok.com/${parts[0]}` }
  if (host === 'youtube.com' && ((parts.length === 1 && parts[0].startsWith('@')) || (parts.length === 2 && ['channel', 'user', 'c'].includes(parts[0])))) return { platform: 'YouTube', handle: parts.at(-1), lookup: parts[0] === 'channel' ? 'id' : parts[0] === 'user' ? 'forUsername' : 'forHandle', url: `https://www.youtube.com/${parts.join('/')}` }
  throw error('영상 주소가 아닌 Instagram·TikTok·YouTube 프로필 주소를 입력해주세요.')
}
function safeImage(value, platform) {
  try {
    const url = new URL(value)
    const domains = platform === 'Instagram' ? ['cdninstagram.com', 'fbcdn.net'] : platform === 'YouTube' ? ['googleusercontent.com', 'ggpht.com'] : ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'ibytedtos.com', 'byteoversea.com', 'muscdn.com']
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)) && !/logo|rsrc\.php|static\.cdninstagram/i.test(value) ? url.href : ''
  } catch { return '' }
}
function publicCount(value) {
  const match = String(value || '').replaceAll(',', '').trim().match(/^(\d+(?:\.\d+)?)\s*([KMB만억])?$/i)
  if (!match) return null
  const amount = Number(match[1]) * ({ K: 1000, M: 1000000, B: 1000000000, 만: 10000, 억: 100000000 }[match[2]?.toUpperCase()] || 1)
  return Number.isSafeInteger(Math.round(amount)) ? Math.round(amount) : null
}
export function createCreatorProfileImages({ fetchImpl = fetch, fetchJson = async (url, options) => { const r = await fetchImpl(url, options); if (!r.ok) throw Error('upstream unavailable'); return r.json() }, env = process.env, now = Date.now } = {}) {
  const cache = new Map(), inFlight = new Map()
  async function collect(identity) {
    let imageUrl, followers, source
    let followerPrecision = 'public_reported'
    const options = { signal: AbortSignal.timeout(8000), redirect: 'error' }
    if (identity.platform === 'Instagram') {
      const response = await fetchImpl(identity.url, { ...options, headers: { Accept: 'text/html', 'User-Agent': 'CreatorOpsPublicSnapshot/1.0' } })
      if (!response.ok) throw Error('profile unavailable')
      const html = await response.text(), title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1])
      if (/login|log in|sign up|로그인/i.test(title) || ![...title.matchAll(/@([\p{L}\p{N}._-]+)/gu)].some(match => match[1].toLowerCase() === identity.handle.toLowerCase())) throw Error('profile identity not confirmed')
      imageUrl = safeImage(meta(html, 'og:image'), identity.platform)
      const description = meta(html, 'og:description') || meta(html, 'description')
      const followerText = description.match(/([\d.,]+\s*[KMB만억]?)\s*(?:Followers|팔로워)/i)?.[1] || description.match(/팔로워\s*([\d.,]+\s*[만억]?)/)?.[1]
      followers = publicCount(followerText)
      followerPrecision = /[KMB만억]/i.test(followerText || '') ? 'public_display_rounded' : 'public_reported'
      source = 'Instagram 공개 프로필 메타데이터'
    } else if (identity.platform === 'YouTube') {
      if (!env.YOUTUBE_DATA_API_KEY) throw Error('YouTube API not configured')
      const params = new URLSearchParams({ part: 'snippet,statistics', [identity.lookup]: identity.handle, key: env.YOUTUBE_DATA_API_KEY })
      const payload = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${params}`, options)
      const channel = payload.items?.[0]
      imageUrl = safeImage(channel?.snippet?.thumbnails?.high?.url || channel?.snippet?.thumbnails?.default?.url, identity.platform)
      followers = channel?.statistics?.hiddenSubscriberCount ? null : publicCount(channel?.statistics?.subscriberCount)
      source = 'YouTube Data API channels.list'
    } else {
      const payload = await fetchJson(`https://www.tikwm.com/api/user/info?${new URLSearchParams({ unique_id: identity.handle })}`, options)
      const user = payload.data?.user
      if (payload.code !== 0 || user?.uniqueId?.toLowerCase() !== identity.handle.toLowerCase()) throw Error('profile identity not confirmed')
      imageUrl = safeImage(user.avatarLarger || user.avatarMedium || user.avatarThumb, identity.platform)
      followers = publicCount(payload.data?.stats?.followerCount)
      source = 'TikTok 공개 프로필 미러'
    }
    return { profileUrl: identity.url, platform: identity.platform, imageUrl, followers, followerPrecision, source, collectedAt: new Date(now()).toISOString(), status: imageUrl || followers !== null ? 'verified' : 'unavailable' }
  }
  async function resolve(value) {
    const identity = profileIdentity(value), key = identity.lookup === 'id' ? identity.url : identity.url.toLowerCase()
    const cached = cache.get(key)
    if (cached?.expires > now()) return cached.data
    if (inFlight.has(key)) return inFlight.get(key)
    if (inFlight.size >= 12) return { profileUrl: identity.url, imageUrl: '', followers: null, status: 'busy' }
    const task = collect(identity).catch(() => ({ profileUrl: identity.url, platform: identity.platform, imageUrl: '', followers: null, status: 'unavailable', collectedAt: new Date(now()).toISOString() })).then(data => {
      if (cache.size >= 1000) cache.delete(cache.keys().next().value)
      cache.set(key, { data, expires: now() + (data.status === 'verified' ? 6 * 3600000 : 120000) })
      return data
    }).finally(() => inFlight.delete(key))
    inFlight.set(key, task)
    return task
  }
  return { resolve }
}
