export function normalizeOutreachEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidOutreachEmail(value) {
  const email = normalizeOutreachEmail(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function buildOutreachSuppressionId(workspaceId, email) {
  const workspace = encodeURIComponent(String(workspaceId || '').trim())
  const recipient = encodeURIComponent(normalizeOutreachEmail(email))
  return `suppression:${workspace}:${recipient}`
}

export function isOutreachSuppressedStatus(value) {
  return String(value || '').trim().toLowerCase() === 'suppressed'
}
