export function documentKind(document = {}) {
  if (!document) return 'quote'
  if (['quote', 'contact'].includes(document.kind)) return document.kind
  return /컨택|contact|이메일|\bdm\b/i.test(document.name || '') ? 'contact' : 'quote'
}

export function prepareCampaignDocument(input, kind) {
  if (!['quote', 'contact'].includes(kind)) throw new Error('자료 구분을 확인해 주세요.')
  const name = String(input.name || '').trim()
  if (!name || name.length > 80) throw new Error('자료명을 80자 이내로 입력해 주세요.')
  let url
  try { url = new URL(String(input.url || '').trim()) } catch { throw new Error('올바른 자료 링크를 입력해 주세요.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 2048) throw new Error('https 자료 링크를 입력해 주세요.')
  return { name, url: url.href, kind, note: String(input.note || '').trim().slice(0, 200), status: input.status || '참고 양식' }
}

export function saveCampaignDocument(campaign, input, kind) {
  const next = prepareCampaignDocument(input, kind)
  const documents = Array.isArray(campaign.documents) ? campaign.documents : []
  const same = document => document && documentKind(document) === kind && document.url === next.url
  return { ...campaign, documents: documents.some(same) ? documents.map(document => same(document) ? { ...document, ...next } : document) : [...documents, next] }
}
