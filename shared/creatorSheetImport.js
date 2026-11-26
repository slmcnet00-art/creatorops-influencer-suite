const key = value => String(value ?? '').toLowerCase().replace(/[\s\n_()/.,%:-]/g, '')
const aliases = {
  handle: ['계정명', '인플루언서 계정명', '인플루언서 계정', 'Username', 'User Name', 'Nickname', 'Creator', '크리에이터', '인플루언서', '핸들'],
  name: ['크리에이터 명칭', '크리에이터 명칭/이름', '크리에이터 명', '이름', 'Name'],
  url: ['계정 링크', 'Profile URL', 'TikTok URL', 'TikTok Profile URL', 'TikTok Account Link', 'URL', '채널 URL'],
  followers: ['팔로워', '구독자', '팔로워 or 구독자', 'Followers', 'Number of followers'],
  averageViews: ['평균 조회수', '최근 3개월 평균 조회수', '평균 릴스 조회수', 'Avg. Views', 'Avg views', 'Average video views'],
  engagement: ['참여율', 'Average ER, %'],
  platform: ['채널', 'Platform', 'SNS', '플랫폼'],
  country: ['Country', '국가'],
  state: ['State', 'Province/state'],
  email: ['이메일', 'Email', 'Email Address'],
  category: ['카테고리/산업', '카테고리', 'Comment (Niche)'],
  tier: ['그룹', '등급'],
  date: ['기준일', 'Date added'],
  rate: ['기존 단가', 'PRICE', 'Payment (USD)', 'Payment', '릴스 단가 (만)', '협업 비용'],
  status: ['컨택 조건', 'Status', 'Accepted', 'Paid?', '협업 내용'],
}
const indices = headers => Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex(header => names.some(name => key(header) === key(name)))]))
const text = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()

export function sheetNumber(value) {
  if (value == null || text(value) === '') return null
  const match = text(value).replaceAll(',', '').match(/^[$₩]?\s*(\d+(?:\.\d+)?)\s*(k|m|만|억|천)?\s*(?:원|명|회|%)?$/i)
  if (!match) return null
  return Number(match[1]) * ({ k: 1000, m: 1000000, 만: 10000, 억: 100000000, 천: 1000 }[match[2]?.toLowerCase()] || 1)
}

function sourceCountry(country, state, sheet) {
  const names = { unitedstates: 'US', unitedstatesofamerica: 'US', usa: 'US', us: 'US', southkorea: 'KR', korea: 'KR', kr: 'KR', 한국: 'KR', 대한민국: 'KR', japan: 'JP', jp: 'JP', 일본: 'JP', canada: 'CA', australia: 'AU', unitedkingdom: 'GB', vietnam: 'VN', thailand: 'TH', china: 'CN' }
  const primary = names[key(country)]
  // Some supplied shipping tabs have their Country and State cells swapped.
  if (/unitedstates/i.test(key(state)) && /^[A-Z]{2}$/.test(text(country))) return 'US'
  return primary || (/JP|日本|일본/i.test(sheet) ? 'JP' : /KR|한국/i.test(sheet) ? 'KR' : '미확인')
}

function platformFor(value, url, sheet) {
  const candidate = `${value} ${url}`
  if (/youtu|유튜브/i.test(candidate)) return 'YouTube'
  if (/tiktok|틱톡/i.test(candidate)) return 'TikTok'
  if (/instagram|인스타|\bIG\b/i.test(candidate)) return 'Instagram'
  if (/youtu|유튜브/i.test(sheet)) return 'YouTube'
  if (/tiktok|틱톡/i.test(sheet)) return 'TikTok'
  if (/twitter|트위터|크리에이터.*X|X.*크리에이터/i.test(sheet)) return 'X'
  return 'Instagram'
}

function accountUrl(value) {
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol)) return ''
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'instagram.com' && url.pathname.split('/').filter(Boolean).length && !/^\/(?:p|reel|reels|stories|accounts|explore)(?:\/|$)/i.test(url.pathname)) return `https://www.instagram.com/${url.pathname.split('/').filter(Boolean)[0]}/`
    if (host === 'tiktok.com' && /^\/@[^/]+\/?$/.test(url.pathname)) return `https://www.tiktok.com/${url.pathname.split('/').filter(Boolean)[0]}/`
    if (['youtube.com', 'm.youtube.com'].includes(host) && /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/.test(url.pathname)) return `https://www.youtube.com${url.pathname.replace(/\/$/, '')}`
    if (['x.com', 'twitter.com'].includes(host) && /^\/[^/]+\/?$/.test(url.pathname)) return `https://x.com/${url.pathname.split('/').filter(Boolean)[0]}`
  } catch { /* Non-URL handles are handled separately. */ }
  return ''
}

export function creatorAccountIdentity(creator) {
  const url = accountUrl(creator.profileUrl || creator.sourceUrl || '')
  const handle = text(creator.handle).replace(/^@/, '').toLowerCase()
  if (url) {
    const path = new URL(url).pathname.replace(/\/$/, '')
    if (/\/channel\//.test(path)) return `YouTube:${path}`
    return `${creator.platform || platformFor('', url, '')}:${path.replace(/^\/@?/, '').toLowerCase()}`
  }
  return handle ? `${creator.platform}:${handle}` : ''
}

export function parseCreatorSheets(tabs, { importedAt = new Date().toISOString(), brandId = 'creator-pool-library' } = {}) {
  const creatorMap = new Map(), groups = [], skipped = []
  for (const tab of tabs) {
    if (/^DB_LIST$|이벤트.*당첨자|배송거점|물류비|메일 문구|컨택문구|체크 셀/.test(tab.name)) { skipped.push({ sheet: tab.name, reason: '크리에이터 목록이 아닌 자료' }); continue }
    const rows = tab.rows || []
    let headerIndex = -1, columns, best = 0
    rows.slice(0, 30).forEach((row, index) => {
      const found = indices(row)
      const score = Number(found.handle >= 0) * 4 + Number(found.url >= 0) * 4 + Number(found.followers >= 0) * 2 + Number(found.name >= 0)
      if (score > best && score >= 4) { headerIndex = index; columns = found; best = score }
    })
    const headerless = tab.name === 'Sheet8' && headerIndex < 0
    if (headerless) { headerIndex = 1; columns = { handle: 1 } }
    if (headerIndex < 0) { skipped.push({ sheet: tab.name, reason: '계정 헤더 없음' }); continue }
    const groupId = `sheet-group:${tab.sourceId}:${encodeURIComponent(tab.name)}`
    const members = new Set()
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index], value = field => columns[field] >= 0 ? row[columns[field]] : ''
      const rawUrl = text(value('url'))
      const urlColumns = rows[headerIndex].map((header, column) => aliases.url.some(alias => key(alias) === key(header)) ? column : -1).filter(column => column >= 0)
      const profileUrl = [...urlColumns.map(column => row[column]), value('handle')].map(cell => accountUrl(text(cell))).find(Boolean) || ''
      let handle = text(value('handle') || rawUrl).replace(/^@/, '')
      if (accountUrl(handle)) handle = ''
      if (!handle && profileUrl) handle = new URL(profileUrl).pathname.split('/').filter(Boolean).at(-1).replace(/^@/, '')
      if (columns.followers >= 0 && key(value('followers')) === key(rows[headerIndex][columns.followers])) continue
      if (columns.url >= 0 && key(value('url')) === key(rows[headerIndex][columns.url])) continue
      if (/^(?:계정명|Username|User Name|Nickname|인플루언서 계정명)$/i.test(handle)) continue
      if (!profileUrl && (!/^[\p{L}\p{N}._-]{2,100}$/u.test(handle) || /^\d+(?:\.\d+)?$/.test(handle))) continue
      if (!profileUrl && /^(?:미사용|없음|완료|진행중|구분|계정|불가|가능|그룹|나노|마이크로|매크로|메가)$/i.test(handle)) continue
      const platform = platformFor(value('platform'), profileUrl, headerless ? 'TikTok' : tab.name)
      const identity = creatorAccountIdentity({ platform, profileUrl, handle })
      if (!identity) continue
      const id = `sheet-creator:${encodeURIComponent(identity)}`
      const email = text(value('email'))
      const followers = sheetNumber(text(value('followers')).replace(/^(?:팔로워|구독자)\s*/, '')), averageViews = sheetNumber(value('averageViews'))
      const source = { sourceId: tab.sourceId, sheet: tab.name, row: index + 1, asOf: text(value('date')) }
      const creator = { id, name: text(value('name')) || handle, handle: `@${handle}`, platform, profileUrl, isDemo: false,
        country: sourceCountry(value('country'), value('state'), tab.name), countryConfidence: 'unverified',
        category: text(value('category')) || '뷰티', sourceTier: text(value('tier')), followers, averageViews,
        engagement: sheetNumber(value('engagement')), contactEmail: /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? email : '',
        preferredContactChannel: email ? 'email' : platform === 'TikTok' ? 'tiktok_dm' : platform === 'Instagram' ? 'instagram_dm' : 'email',
        source: '팀 제공 크리에이터 풀', sourceType: 'manual', sourceImportedAt: importedAt, sourceAsOf: source.asOf, needsVerification: true,
        metricsPending: followers === null && averageViews === null, status: '섭외 이력 자료', importSources: [source] }
      const rate = sheetNumber(value('rate'))
      const rateHeader = rows[headerIndex][columns.rate] || ''
      const currency = /USD|\$/.test(`${rateHeader} ${value('rate')}`) ? 'USD' : /원|₩|만/.test(`${rateHeader} ${value('rate')}`) ? 'KRW' : ''
      if (rate !== null) creator.importRate = { amount: rate * (/만/.test(rateHeader) && !/만|억/.test(text(value('rate'))) ? 10000 : 1), currency, sourceHeader: rateHeader }
      if (creator.importRate?.currency === 'KRW') creator.actualPrice = creator.importRate.amount
      creator.importStatus = text(value('status'))
      const prior = creatorMap.get(identity)
      if (!prior) creatorMap.set(identity, creator)
      else {
        for (const field of ['profileUrl', 'contactEmail', 'sourceTier', 'followers', 'averageViews', 'engagement', 'country']) if ((prior[field] == null || prior[field] === '' || prior[field] === '미확인') && creator[field] != null && creator[field] !== '') prior[field] = creator[field]
        prior.importSources.push(source)
      }
      members.add(id)
    }
    if (!members.size) { skipped.push({ sheet: tab.name, reason: '유효한 크리에이터 계정 없음' }); continue }
    groups.push({ id: groupId, name: tab.name === '시트1' ? `${tab.sourceTitle} · ${tab.name}` : tab.name, brandId, creatorIds: [...members], type: '섭외 이력', platform: 'All', owner: '미핑기획',
      description: `${tab.sourceTitle} / ${tab.name} 시트에서 가져온 크리에이터 그룹`, sourceImportKey: groupId, sourceUrl: tab.sourceUrl || '', sourceName: tab.sourceTitle, sourceSheet: tab.name, createdAt: importedAt })
  }
  return { format: 'creatorops-creator-groups-v1', importedAt, brandId, sources: [...new Map(tabs.map(tab => [tab.sourceId, { id: tab.sourceId, title: tab.sourceTitle, url: tab.sourceUrl || '' }])).values()], creators: [...creatorMap.values()], creatorGroups: groups, skipped }
}

export function mergeCreatorSheetImport(workspace, bundle) {
  if (bundle.format !== 'creatorops-creator-groups-v1' || !Array.isArray(bundle.creators) || !Array.isArray(bundle.creatorGroups)) throw new Error('지원하지 않는 크리에이터 그룹 자료입니다.')
  const creators = [...(workspace.creators || [])], identities = new Map(creators.map(c => [creatorAccountIdentity(c), c]).filter(([identity]) => identity)), ids = new Map()
  for (const incoming of bundle.creators) {
    const identity = creatorAccountIdentity(incoming)
    if (!identity) continue
    const existing = identities.get(identity)
    if (existing) { ids.set(String(incoming.id), existing.id); continue }
    creators.push(incoming); identities.set(identity, incoming); ids.set(String(incoming.id), incoming.id)
  }
  const creatorGroups = [...(workspace.creatorGroups || [])]
  for (const group of bundle.creatorGroups) {
    const incoming = { ...group, creatorIds: [...new Set(group.creatorIds.map(id => ids.get(String(id))).filter(id => id != null))] }
    const index = creatorGroups.findIndex(g => g.sourceImportKey === group.sourceImportKey || g.id === group.id)
    if (index < 0) creatorGroups.push(incoming)
    else creatorGroups[index] = { ...creatorGroups[index], ...incoming, creatorIds: [...new Set([...creatorGroups[index].creatorIds, ...incoming.creatorIds])] }
  }
  const brandId = bundle.brandId || 'creator-pool-library'
  const brands = [...(workspace.brands || [])]
  if (!brands.some(brand => String(brand.id) === String(brandId))) brands.push({ id: brandId, name: '미핑기획 크리에이터 풀', brief: { brandName: '미핑기획 크리에이터 풀', product: '', category: '뷰티', country: 'KR' } })
  return { ...workspace, brands, creators, creatorGroups }
}
