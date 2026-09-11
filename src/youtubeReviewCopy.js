// Used only by the opt-in English review translator, never by the Korean UI.
export function reviewAudienceText(text, platform) {
  return String(platform || '').toLowerCase() === 'youtube'
    ? text.replace(/\bfollowers?\b|\bsubscribers\b/gi, 'Subscribers')
    : text
}

export const REVIEW_INPUT_NOTICE = 'Search terms and public video or channel URLs are used only to retrieve read-only public metadata through YouTube Data API. CreatorOps does not upload, publish, edit, or delete YouTube content. YouTube API search results are excluded from Excel, client-file, and Google Sheets bulk exports.'
