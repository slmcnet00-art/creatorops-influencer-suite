export function instagramPostKey(value) {
  try {
    const url = new URL(value)
    const [kind, code, ...extra] = url.pathname.split('/').filter(Boolean)
    if (['http:', 'https:'].includes(url.protocol) &&
        ['instagram.com', 'www.instagram.com'].includes(url.hostname) &&
        ['p', 'reel'].includes(kind) && /^[A-Za-z0-9_-]{5,}$/.test(code || '') && !extra.length) {
      return code
    }
  } catch {
    return ''
  }
  return ''
}

export function findSavedInstagramReferences(references, { query, country, platform, mediaType }) {
  if (!['Instagram', '전체'].includes(platform)) return []
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const seen = new Set()
  return references.filter((item) => {
    const key = instagramPostKey(item.url)
    if (!key || seen.has(key) || item.searchOnly || item.platform !== 'Instagram') return false
    if (country !== '전체' && item.country !== country) return false
    if (mediaType !== '전체' && item.mediaType !== mediaType) return false
    const text = [item.title, item.hook, item.caption, item.creatorName, item.analysis, item.applyIdea]
      .filter(Boolean).join(' ').toLowerCase()
    if (!terms.every((term) => text.includes(term))) return false
    seen.add(key)
    return true
  })
}
