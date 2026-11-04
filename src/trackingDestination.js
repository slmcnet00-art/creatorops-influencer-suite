export function hasTrackingDestination(asset = {}) {
  try {
    const url = new URL(asset.destination || asset.destination_url || asset.landing_url || asset.originalUrl || '')
    return ['http:', 'https:'].includes(url.protocol) && !/(^|\.)example$/.test(url.hostname)
  } catch { return false }
}

export function trackingLogTimestamp(log = {}) {
  return Date.parse(log.updatedAt || log.createdAt || '') || 0
}

export function invalidatePlaceholderTrackingLogs(logs = [], campaignId, updatedAt) {
  return logs.map((log) => String(log.campaignId || log.campaign_id) === String(campaignId)
    && /https?:\/\/[^/]*\.example(?:\/|$)/.test(log.destination || log.destination_url || log.landing_url || '')
    ? { ...log, status: 'inactive', invalidatedReason: 'placeholder_destination', updatedAt }
    : log)
}
