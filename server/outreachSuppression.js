export function normalizeOutreachEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidOutreachEmail(value) {
  const email = normalizeOutreachEmail(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function normalizeOutreachSuppressionScope(value) {
  return String(value || '').trim().toLowerCase() === 'campaign' ? 'campaign' : 'workspace'
}

export function buildOutreachSuppressionId(workspaceId, email, scope = 'workspace', campaignId = '') {
  const workspace = encodeURIComponent(String(workspaceId || '').trim())
  const recipient = encodeURIComponent(normalizeOutreachEmail(email))
  if (normalizeOutreachSuppressionScope(scope) === 'campaign') {
    const campaign = encodeURIComponent(String(campaignId || '').trim())
    return `campaign-suppression:${workspace}:${campaign}:${recipient}`
  }
  return `suppression:${workspace}:${recipient}`
}

export function isOutreachSuppressedStatus(value) {
  return ['suppressed', 'campaign_suppressed'].includes(String(value || '').trim().toLowerCase())
}

export function getOutreachBlockReason(records = [], item = {}) {
  const email = normalizeOutreachEmail(item.to)
  const campaignId = String(item.campaignId || '').trim()
  if (records.some((record) => (
    normalizeOutreachEmail(record.recipient) === email && record.status === 'suppressed'
  ))) return 'suppressed'
  if (records.some((record) => (
    normalizeOutreachEmail(record.recipient) === email
    && record.status === 'campaign_suppressed'
    && String(record.campaign_id || '').trim() === campaignId
  ))) return 'campaign_suppressed'
  return ''
}
