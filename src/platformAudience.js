// Display terminology only. Keep persisted `followers` fields compatible.
export function audienceLabel(platform) {
  return String(platform || '').trim().toLowerCase() === 'youtube' ? 'Subscribers' : '팔로워'
}

export function audienceGroupLabel(creators = []) {
  const labels = new Set(creators.map((creator) => audienceLabel(creator.platform)))
  return labels.size > 1 ? 'Subscribers / 팔로워' : labels.values().next().value || 'Subscribers / 팔로워'
}

export const YOUTUBE_INPUT_NOTICE_EN = 'Search terms and public video or channel URLs are used only to retrieve read-only public metadata through YouTube Data API. CreatorOps does not upload, publish, edit, or delete YouTube content. YouTube API search results are excluded from Excel, client-file, and Google Sheets bulk exports.'
