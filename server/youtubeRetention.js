export const YOUTUBE_API_DATA_MAX_AGE_DAYS = 30
export const YOUTUBE_API_DATA_MAX_AGE_MS = YOUTUBE_API_DATA_MAX_AGE_DAYS * 24 * 60 * 60 * 1000

export function getYouTubeRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - YOUTUBE_API_DATA_MAX_AGE_MS).toISOString()
}

function isYouTube(value) {
  return String(value || '').toLowerCase() === 'youtube'
}

function parseTimestamp(value) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getRecordTimestamp(record = {}, fallbackTimestamp = '') {
  return parseTimestamp(
    record.sourceCollectedAtIso ||
    record.collectedAt ||
    record.measuredAt ||
    record.updatedAt ||
    record.lastChecked ||
    fallbackTimestamp,
  )
}

function isStaleYouTubeRecord(record, now, fallbackTimestamp) {
  if (!isYouTube(record?.platform)) return false
  const timestamp = getRecordTimestamp(record, fallbackTimestamp)
  return timestamp > 0 && now.getTime() - timestamp >= YOUTUBE_API_DATA_MAX_AGE_MS
}

function redactStaleCreator(record) {
  return {
    ...record,
    avatar: '',
    followers: 0,
    averageViews: 0,
    totalViews: 0,
    videoCount: 0,
    engagement: 0,
    metricSources: [],
    metricsPending: true,
    needsVerification: true,
    verifiedMetrics: false,
    dataRetentionStatus: 'refresh_required',
    status: 'YouTube API 재수집 필요',
    sourceNote: '30일 이내 갱신되지 않은 YouTube API 데이터는 삭제되었습니다. 공개 URL을 다시 조회하면 최신 값이 표시됩니다.',
  }
}

function redactStaleReference(record) {
  return {
    id: record.id,
    mediaType: record.mediaType || '영상',
    platform: 'YouTube',
    country: record.country || '',
    searchCountry: record.searchCountry || '',
    url: record.url || '',
    title: 'YouTube reference · refresh required',
    thumbnailUrl: '',
    views: null,
    accountFollowers: null,
    likes: null,
    comments: null,
    shares: null,
    publishedAt: '',
    source: 'User-saved public URL',
    dataRetentionStatus: 'refresh_required',
  }
}

function redactStaleTrackedPost(record) {
  return {
    ...record,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    metricsPending: true,
    dataRetentionStatus: 'refresh_required',
    status: 'YouTube API 재수집 필요',
  }
}

function sanitizeRecords(records, sanitizer, now, fallbackTimestamp) {
  if (!Array.isArray(records)) return { records, changed: false, redacted: 0 }
  let redacted = 0
  const nextRecords = records.map((record) => {
    if (!isStaleYouTubeRecord(record, now, fallbackTimestamp)) return record
    redacted += 1
    return sanitizer(record)
  })
  return { records: nextRecords, changed: redacted > 0, redacted }
}

export function sanitizeStaleYouTubeApiData(payload = {}, { now = new Date(), fallbackTimestamp = '' } = {}) {
  const creators = sanitizeRecords(payload.creators, redactStaleCreator, now, fallbackTimestamp)
  const contentReferences = sanitizeRecords(payload.contentReferences, redactStaleReference, now, fallbackTimestamp)
  const trackedPosts = sanitizeRecords(payload.trackedPosts, redactStaleTrackedPost, now, fallbackTimestamp)
  const redacted = creators.redacted + contentReferences.redacted + trackedPosts.redacted

  if (!redacted) return { payload, changed: false, redacted: 0 }
  return {
    payload: {
      ...payload,
      ...(creators.changed ? { creators: creators.records } : {}),
      ...(contentReferences.changed ? { contentReferences: contentReferences.records } : {}),
      ...(trackedPosts.changed ? { trackedPosts: trackedPosts.records } : {}),
    },
    changed: true,
    redacted,
  }
}
