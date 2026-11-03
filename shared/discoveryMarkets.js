export const DISCOVERY_MARKETS = {
  KR: { label: '한국', language: 'ko', languageName: 'Korean', review: '리뷰' },
  US: { label: '미국', language: 'en', languageName: 'English', review: 'review' },
  JP: { label: '일본', language: 'ja', languageName: 'Japanese', review: 'レビュー' },
  CN: { label: '중국', language: 'zh', languageName: 'Simplified Chinese', review: '测评' },
  GB: { label: '영국', language: 'en', languageName: 'English', review: 'review' },
  VN: { label: '베트남', language: 'vi', languageName: 'Vietnamese', review: 'đánh giá' },
  TH: { label: '태국', language: 'th', languageName: 'Thai', review: 'รีวิว' },
  ID: { label: '인도네시아', language: 'id', languageName: 'Indonesian', review: 'ulasan' },
  PH: { label: '필리핀', language: 'en', languageName: 'English', review: 'review' },
  SG: { label: '싱가포르', language: 'en', languageName: 'English', review: 'review' },
  MY: { label: '말레이시아', language: 'ms', languageName: 'Malay', review: 'ulasan' },
  TW: { label: '대만', language: 'zh-TW', languageName: 'Traditional Chinese', review: '評測' },
  FR: { label: '프랑스', language: 'fr', languageName: 'French', review: 'avis' },
  DE: { label: '독일', language: 'de', languageName: 'German', review: 'Bewertung' },
  ES: { label: '스페인', language: 'es', languageName: 'Spanish', review: 'reseña' },
}
export function normalizeDiscoveryMarkets(values) {
  if (!Array.isArray(values) || !values.length || values.some(v => typeof v !== 'string')) throw Object.assign(Error('검색할 국가를 선택하세요.'), { status: 400 })
  const markets = [...new Set(values.map(v => v.trim().toUpperCase()))]
  if (markets.length > 6 || markets.some(v => !DISCOVERY_MARKETS[v])) throw Object.assign(Error('지원 국가를 최대 6개 선택하세요. 권역 검색은 국가별로 나누어 선택하세요.'), { status: 400 })
  return markets
}
export function toggleDiscoveryMarket(current, country) {
  if (current.includes(country)) return current.length > 1 ? current.filter(c => c !== country) : current
  return current.length < 6 ? [...current, country] : current
}
export function allocateDiscoveryResults(total, countries) {
  if (!Number.isInteger(total) || total < countries.length || total > 1000) throw Object.assign(Error(`검색 수는 선택 국가 수 이상, 1000 이하의 정수로 입력하세요.`), { status: 400 })
  return countries.map((country, index) => ({ country, limit: Math.floor(total / countries.length) + (index < total % countries.length ? 1 : 0) }))
}
