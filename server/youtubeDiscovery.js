import { isCookingYouTubeQuery } from './youtubeEvidence.js'
const inFlight = new Map()
export async function coalesceYouTubeSearch(key, load) {
  if (inFlight.has(key)) return inFlight.get(key)
  const promise = Promise.resolve().then(load)
  inFlight.set(key, promise)
  try { return await promise } finally { if (inFlight.get(key) === promise) inFlight.delete(key) }
}

export function focusedYouTubeQueries(clean, aliased, country) {
  const suffix = isCookingYouTubeQuery(`${clean} ${aliased}`)
    ? country === 'JP' ? ['レシピ', '作り方'] : country === 'KR' ? ['레시피', '만드는법'] : ['recipe', 'how to cook']
    : country === 'JP' ? ['レビュー', 'クリエイター'] : country === 'KR' ? ['리뷰', '크리에이터'] : ['review', 'creator']
  return [...new Set([clean, aliased, ...suffix.map(s => `${aliased} ${s}`)].map(q => q.trim()).filter(Boolean))]
}

export function youtubeSearchScope(value) {
  const country = String(value || '').trim().toUpperCase()
  if (['', 'ALL', 'GLOBAL', '전체'].includes(country)) return { regionCode: '', allowedCountries: [] }
  if (country === 'SEA') return { regionCode: '', allowedCountries: ['SG', 'MY', 'TH', 'VN', 'ID', 'PH', 'BN', 'KH', 'LA', 'MM', 'TL'] }
  if (country === 'EU') return { regionCode: '', allowedCountries: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'NO', 'CH', 'IS'] }
  if (!/^[A-Z]{2}$/.test(country)) throw Object.assign(Error('Unsupported discovery country.'), { status: 400 })
  return { regionCode: country, allowedCountries: [country] }
}

// Search result pages are bounded; detail requests are shared across both search
// paths. Relevance is evaluated against the original query, never the expansion.
export async function discoverYouTubeCreators({ queries, maxResults, country, allowedCountries = country ? [country] : [], request, normalize, select, evidenceSelector, reviewChannels, maxPages = 16 }) {
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 1000) throw Object.assign(Error('maxResults must be an integer between 1 and 1000.'), { status: 400 })
  const channels = new Map(), evidence = new Map(), ids = new Set()
  const limit = Math.min(50, Math.max(10, maxResults * 2)), cursors = new Map()
  let pages = 0, detailCalls = 0, result = [], exhausted = false
  for (let round = 0; pages < maxPages; round++) {
    let progressed = false
    for (const query of queries) {
      const tasks = ['channel', 'video'].filter(type => pages < maxPages && cursors.get(`${query}:${type}`) !== null).slice(0, maxPages - pages)
      if (!tasks.length) continue
      progressed = true
      const payloads = await Promise.all(tasks.map(async type => {
        const key = `${query}:${type}`, cursor = cursors.get(key)
        pages++
        const data = await request('search', { part: 'snippet', type, q: query, maxResults: String(limit), ...(cursor ? { pageToken: cursor } : {}) })
        cursors.set(key, data.nextPageToken || null)
        return { type, data }
      }))
      for (const { type, data } of payloads) for (const item of data.items || []) {
        const id = type === 'video' ? item.snippet?.channelId : item.id?.channelId
        if (!id) continue
        ids.add(id)
        if (type === 'video') {
          const old = evidence.get(id) || []
          const video = { title: item.snippet?.title || '', description: item.snippet?.description || '', videoId: item.id?.videoId || '' }
          if (!evidenceSelector || evidenceSelector(video)) {
            const previous = old.find(match => match.videoId === video.videoId)
            if (previous) Object.assign(previous, video)
            else if (old.length < 20) old.push(video)
          }
          evidence.set(id, old)
        }
      }
      const missing = [...ids].filter(id => !channels.has(id))
      for (let i = 0; i < missing.length; i += 50) {
        const chunk = missing.slice(i, i + 50)
        detailCalls++
        const data = await request('channels', { part: 'snippet,statistics,contentDetails', id: chunk.join(',') })
        chunk.forEach(id => channels.set(id, null))
        for (const channel of data.items || []) channels.set(channel.id, channel)
      }
      const normalized = [...channels.values()].filter(Boolean)
        .filter(c => !allowedCountries.length || !c.snippet?.country || allowedCountries.includes(c.snippet.country))
        .map(channel => {
          const matches = (evidence.get(channel.id) || []).filter(match => !evidenceSelector || evidenceSelector(match)), first = matches[0]
          if (evidenceSelector && !first) return null
          return { ...normalize(channel), ...(first ? {
            source: 'YouTube Data API search.list + channels.list', sourceTitle: matches.map(m => m.title).join(' | '),
            sourceSnippet: matches.map(m => m.description).join(' | '), matchedContentUrl: first.videoId ? `https://www.youtube.com/watch?v=${first.videoId}` : '', matchedVideoId: first.videoId,
          } : {}) }
        }).filter(Boolean)
      result = (reviewChannels ? select(await reviewChannels(select(normalized))) : select(normalized)).slice(0, maxResults)
      if (result.length >= maxResults || reviewChannels?.exhausted) return { items: result, diagnostics: { searchCalls: pages, detailCalls, requested: maxResults, returned: result.length, partial: result.length < maxResults, ...(reviewChannels ? { recentReview: reviewChannels.diagnostics } : {}), ...(result.length < maxResults ? { reason: 'recent-review-budget-reached' } : {}) } }
    }
    if (!progressed || [...cursors.values()].every(v => v === null)) { exhausted = true; break }
    // First complete all exact-query variants, then paginate only when needed.
    if (round >= maxPages) break
  }
  return { items: result, diagnostics: { searchCalls: pages, detailCalls, requested: maxResults, returned: result.length, partial: result.length < maxResults, reason: exhausted ? 'no-more-matching-results' : 'search-budget-reached', ...(reviewChannels ? { recentReview: reviewChannels.diagnostics } : {}) } }
}
