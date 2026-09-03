const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function positiveInteger(value, fallback, minimum = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(minimum, Math.floor(parsed))
}

export function buildOutreachPolicy(env = {}) {
  return {
    batchLimit: positiveInteger(env.OUTREACH_BATCH_LIMIT, 20),
    sendIntervalMs: positiveInteger(env.OUTREACH_SEND_INTERVAL_MS, 10_000, 1_000),
    dailyLimitPerCampaign: positiveInteger(env.OUTREACH_DAILY_LIMIT_PER_CAMPAIGN, 50),
    maxAttempts: positiveInteger(env.OUTREACH_MAX_ATTEMPTS, 3),
  }
}

export function getKstDayWindow(now = new Date()) {
  const instant = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(instant.getTime())) throw new TypeError('A valid date is required.')
  const kstDate = new Date(instant.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
  const start = new Date(`${kstDate}T00:00:00+09:00`)
  return {
    dateKey: kstDate,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + DAY_MS).toISOString(),
  }
}

export function getOutreachDailyRemaining(used, limit) {
  return Math.max(0, positiveInteger(limit, 50) - Math.max(0, Number(used || 0)))
}
