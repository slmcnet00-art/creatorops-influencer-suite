import { DISCOVERY_MARKETS } from '../shared/discoveryMarkets.js'
import { assessDiscoveryEvidence } from './multiMarketDiscovery.js'

const countryTerms = {
  KR: ['🇰🇷', '한국', 'korea', 'seoul', '서울', 'busan', '부산'], JP: ['🇯🇵', '日本', 'japan', 'tokyo', '東京', 'osaka', '大阪'],
  CA: ['🇨🇦','canada','toronto','vancouver','montréal','montreal','québec','quebec','캐나다','カナダ'],
  US: ['🇺🇸', 'united states', 'usa', 'new york', 'los angeles', 'california'], GB: ['🇬🇧', 'united kingdom', 'london', 'england'],
  CN: ['🇨🇳', '中国', 'china', 'beijing', 'shanghai'], TW: ['🇹🇼', '台灣', '台湾', 'taiwan', 'taipei', '台北'],
  VN: ['🇻🇳', 'việt nam', 'vietnam', 'hanoi', 'hà nội', 'ho chi minh'], TH: ['🇹🇭', 'ประเทศไทย', 'thailand', 'bangkok', 'กรุงเทพ'],
  ID: ['🇮🇩', 'indonesia', 'jakarta'], PH: ['🇵🇭', 'philippines', 'manila'], SG: ['🇸🇬', 'singapore'], MY: ['🇲🇾', 'malaysia', 'kuala lumpur'],
  FR: ['🇫🇷', 'france', 'paris'], DE: ['🇩🇪', 'germany', 'deutschland', 'berlin'], ES: ['🇪🇸', 'spain', 'españa', 'madrid'],
}
const localCountry = { KR:'한국', JP:'日本', CA:'Canada', US:'USA', GB:'UK', CN:'中国', TW:'台灣', VN:'Việt Nam', TH:'ประเทศไทย', ID:'Indonesia', PH:'Philippines', SG:'Singapore', MY:'Malaysia', FR:'France', DE:'Deutschland', ES:'España' }
export function inferPublicProfileCountry(item) {
  // Search location, profile handles and the input query never establish account location.
  const text = [item.sourceTitle, item.sourceSnippet, item.snippet].filter(Boolean).join(' ').normalize('NFKC').toLowerCase()
  const found = Object.entries(countryTerms).map(([country, terms]) => ({ country, terms: terms.filter(term => /^[a-z ]+$/.test(term) ? new RegExp(`(?:^|[^a-z])${term}(?:$|[^a-z])`).test(text) : text.includes(term)) })).filter(row => row.terms.length)
  return found.length === 1 ? { country: found[0].country, countryConfidence: 'detected', countryEvidence: found[0].terms, countryEvidenceStatus: 'public-text-inference' }
    : { country: '', countryConfidence: 'unverified', countryEvidence: [], countryEvidenceStatus: found.length ? 'ambiguous-public-text' : 'not-stated' }
}
export function isAllowedSocialResult(url, platform) {
  try {
    const parsed = new URL(url), host = platform === 'Instagram' ? 'instagram.com' : 'tiktok.com'
    if (parsed.protocol !== 'https:' || !(parsed.hostname === host || parsed.hostname.endsWith('.' + host))) return false
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (platform === 'TikTok') return /^@[\w.]{2,32}$/.test(parts[0] || '') && (parts.length === 1 || parts[1] === 'video')
    return parts.length === 1 && /^[\w.]{2,30}$/.test(parts[0]) && !['explore','p','reel','reels','stories','tv','accounts','about','directory','developer','direct','share'].includes(parts[0].toLowerCase())
  } catch { return false }
}
export function profileMarketQueries(query, platform, country) {
  const site = platform === 'Instagram' ? 'site:instagram.com' : 'site:tiktok.com'
  const excludes = platform === 'Instagram' ? ' -inurl:/p/ -inurl:/reel/ -inurl:/explore/' : ''
  const creator = { KR:'인플루언서', JP:'インフルエンサー', CN:'博主', TW:'創作者', TH:'ครีเอเตอร์', VN:'nhà sáng tạo', ID:'kreator', MY:'pencipta', FR:'créateur', DE:'creator', ES:'creador' }[country] || 'creator'
  return [`${site} ${query} ${creator} ${localCountry[country]}${excludes}`, `${site} ${query} ${creator}${excludes}`]
}
export function isLikelyCreatorProfile(profile) {
  const identity = [profile.name, profile.handle].filter(Boolean).join(' ').toLowerCase()
  const text = [identity, profile.sourceSnippet, profile.snippet].filter(Boolean).join(' ').toLowerCase()
  if (/^@?(?:user[0-9]{6,}|creators|influencers?)$/.test(String(profile.handle || '').toLowerCase())) return false
  const creator = /creator|influencer|reviewer|blogger|makeup artist|クリエイター|インフルエンサー|美容家|博主|創作者|인플루언서|크리에이터|리뷰어|블로거|뷰스타|ครีเอเตอร์|kreator/.test(text)
  const business = /official|store|shop|supply|clinic|cosmetics|magazine|신문|공식|의원|살롱|公式|株式会社|美容室|beauty japan/.test(identity)
  return creator || !business
}
export function braveMarketOptions(country) {
  const market = DISCOVERY_MARKETS[country]
  return { country: ['TH','VN','SG'].includes(country) ? 'ALL' : country,
    language: country === 'ID' ? '' : ({ ja:'jp', zh:'zh-hans', 'zh-TW':'zh-hant' }[market.language] || market.language) }
}
// A server-wide pacing queue for public-search requests. Expired requests never reach the provider.
export function createProfileSearchPacer({ intervalMs = 1100, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let tail = Promise.resolve(), lastStart = -Infinity
  return (load, deadline = Infinity) => {
    const result = tail.then(async () => {
      const delay = Math.max(0, lastStart + intervalMs - now())
      if (now() + delay >= deadline) throw Object.assign(Error('검색 대기 시간이 초과되었습니다.'), { status:504 })
      if (delay > 0) await wait(delay)
      if (now() >= deadline) throw Object.assign(Error('국가별 검색 시간이 초과되었습니다.'), { status:504 })
      lastStart = now()
      return load()
    })
    tail = result.then(() => undefined, () => undefined)
    return result
  }
}
export async function discoverPublicProfiles({ query, sourceQuery, platform, country, maxResults, strictCountry = false, request, normalize }) {
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 1000) throw Object.assign(Error('후보 수를 확인하세요.'),{status:400})
  const platforms = platform === 'all' ? ['Instagram','TikTok'] : [platform]
  if (platforms.some(p => !['Instagram','TikTok'].includes(p))) throw Object.assign(Error('Instagram 또는 TikTok을 선택하세요.'), { status: 400 })
  const avatarPlaceholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#eef2f6"/><circle cx="32" cy="24" r="10" fill="#64748b"/><path d="M13 57a19 19 0 0 1 38 0" fill="#64748b"/></svg>')
  const unique = new Map(), statuses = []
  for (const [index, itemPlatform] of platforms.entries()) {
    const target = Math.floor(maxResults / platforms.length) + (index < maxResults % platforms.length ? 1 : 0)
    if (!target) continue
    let calls = 0, error = null
    const matches = new Map()
    try {
      for (const q of profileMarketQueries(query, itemPlatform, country)) {
        calls++
        const page = await request({ query:q, country, language:DISCOVERY_MARKETS[country].language, platform:itemPlatform })
        for (const item of page) {
          const url = item.url || item.link
          if (!isAllowedSocialResult(url, itemPlatform)) continue
          const profile = normalize(item, itemPlatform, country)
          if (!profile || !isLikelyCreatorProfile(profile)) continue
          const inferred = inferPublicProfileCountry(profile), evidence = assessDiscoveryEvidence(profile, query, sourceQuery)
          if (!evidence.matches || (inferred.country && inferred.country !== country) || (strictCountry && !inferred.country)) continue
          const canonical = profile.profileUrl.replace(/\/+$/, '').toLowerCase()
          if (!matches.has(canonical)) matches.set(canonical, { ...profile, ...inferred, id:`${itemPlatform}:${canonical}`, searchCountry:country, verifiedMetrics:false, avatar:avatarPlaceholder, avatarStatus:'unverified',
            matchedContentUrl: itemPlatform === 'TikTok' && new URL(url).pathname.includes('/video/') ? url : '', evidenceUrl:url })
        }
        if (matches.size >= target) break
      }
    } catch (e) { error = e }
    const items = [...matches.values()].slice(0, target)
    items.forEach(item => unique.set(item.platform + ':' + item.profileUrl.toLowerCase(), item))
    statuses.push({ platform:itemPlatform, requested:target, returned:items.length, searchCalls:calls, status:error ? 'failed' : 'success', ...(error ? { error:'공개 검색 요청이 실패했습니다. 다시 검색하세요.', errorStatus:Number(error.status) || 502 } : {}) })
  }
  if (!unique.size && statuses.every(s => s.status === 'failed')) throw Object.assign(Error('공개 프로필 검색을 완료하지 못했습니다.'), { status: 502 })
  const items = [...unique.values()]
  items.searchMeta = { provider:'public-search', cacheHit:false, searchCalls:statuses.reduce((n,s)=>n+s.searchCalls,0), platforms:statuses, partial:statuses.some(s=>s.status==='failed'||s.returned<s.requested) }
  return items
}
