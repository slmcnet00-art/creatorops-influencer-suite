const cooking = /요리|레시피|집밥|자취.*식|recipe|cooking|料理|レシピ|自炊|食譜|菜谱/i
const unrelatedFood = /먹방|맛집|mukbang|大食い|食べ歩き|食レポ|쇼핑|하울|언박싱|shopping|unboxing|\bhaul\b|購入品/i
const instruction = /만드는\s*법|조리법|作り方|how to (?:cook|make)|ingredients|材料|재료\s*[:：]/i
export const isCookingYouTubeQuery = query => cooking.test(query)
export function isRelevantYouTubeTopicVideo(video, query, matchesVideo = () => true) {
  if (!matchesVideo(video)) return false
  const title = video.snippet?.title || '', text = `${title} ${video.snippet?.description || ''}`
  return !cooking.test(query) || (cooking.test(text) && (!unrelatedFood.test(title) || instruction.test(text)))
}
const number = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
export function youtubeDurationSeconds(value = '') {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value)
  return m ? Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0) : 0
}
export function classifyYouTubeVideo(video = {}) {
  const seconds = youtubeDurationSeconds(video.contentDetails?.duration)
  const snippet = video.snippet || {}
  if (['live', 'upcoming'].includes(snippet.liveBroadcastContent) || video.liveStreamingDetails?.actualStartTime) return { format: '라이브', confidence: 'confirmed', seconds }
  if (!seconds) return { format: '미확인', confidence: 'unknown', seconds }
  if (seconds > 180) return { format: '롱폼', confidence: 'confirmed', seconds }
  // Public thumbnails/player dimensions are not the uploaded video's aspect ratio.
  const ratio = number(video.fileDetails?.videoStreams?.[0]?.aspectRatio)
  if (ratio > 1) return { format: '롱폼', confidence: 'confirmed', seconds }
  if (ratio > 0 && ratio <= 1 && String(snippet.publishedAt || '') >= '2024-10-15') return { format: '숏폼', confidence: 'confirmed', seconds }
  return /#shorts\b/i.test(`${snippet.title || ''} ${snippet.description || ''}`)
    ? { format: '숏폼', confidence: 'inferred', seconds }
    : { format: '미확인', confidence: 'unknown', seconds }
}
function average(rows) {
  const values = rows.map(v => Number(v.statistics.viewCount)).sort((a, b) => a - b)
  const trim = values.length >= 5 ? Math.floor(values.length * 0.2) : 0
  const used = trim ? values.slice(trim, -trim) : values
  return { averageViews: used.length ? Math.round(used.reduce((a, b) => a + b, 0) / used.length) : 0, sampleCount: values.length, usedCount: used.length, method: trim ? '상하 20% 제외 평균' : '단순 평균 · 표본 부족' }
}
export function summarizeYouTubeVideos(videos = []) {
  const unique = new Map(videos.filter(v => v.id && number(v.statistics?.viewCount) !== null && classifyYouTubeVideo(v).format !== '라이브').map(v => [v.id, v]))
  const rows = [...unique.values()]
  const formatMetrics = {}, averageViewsByFormat = {}, inferredAverageViewsByFormat = {}
  for (const format of ['숏폼', '롱폼']) {
    const confirmed = rows.filter(v => { const c = classifyYouTubeVideo(v); return c.format === format && c.confidence === 'confirmed' })
    const inferred = rows.filter(v => { const c = classifyYouTubeVideo(v); return c.format === format && c.confidence === 'inferred' })
    formatMetrics[format] = average(confirmed)
    if (confirmed.length) averageViewsByFormat[format] = formatMetrics[format].averageViews
    if (inferred.length) inferredAverageViewsByFormat[format] = average(inferred).averageViews
  }
  return { ...average(rows), averageViewsByFormat, inferredAverageViewsByFormat, formatMetrics,
    unknownFormatCount: rows.filter(v => classifyYouTubeVideo(v).confidence === 'unknown').length,
    inferredShortCount: rows.filter(v => classifyYouTubeVideo(v).confidence === 'inferred').length }
}
export function assessRecentYouTubeRelevance(videos, query, matchesVideo = () => true) {
  const rows = [...new Map(videos.filter(v => v.id && classifyYouTubeVideo(v).format !== '라이브').map(v => [v.id, v])).values()]
  const isCooking = cooking.test(query)
  const matched = rows.filter(v => isRelevantYouTubeTopicVideo(v, query, matchesVideo))
  const matches = rows.length >= 3 && (isCooking ? matched.length >= 2 && matched.length / rows.length >= 0.25 : matched.length >= 1)
  return { matches, sampleCount: rows.length, matchingCount: matched.length, reason: matches ? '최근 업로드의 관련 콘텐츠 확인' : '최근 업로드에서 캠페인 관련 근거 부족', videoIds: matched.map(v => v.id), evidence: matched.slice(0, 3).map(v => ({ videoId: v.id, title: v.snippet?.title || '', description: String(v.snippet?.description || '').slice(0, 1000), url: `https://www.youtube.com/watch?v=${v.id}` })) }
}

// Per-search bounded review. Public video details are batched and shared; no scraping.
export function createYouTubeEvidenceReviewer({ request, query = '', matchesVideo, maxChannels = 40, filterResults = true, now = () => Date.now() }) {
  const cache = new Map()
  const diagnostics = { reviewedChannels: 0, playlistCalls: 0, videoCalls: 0, failures: 0, excludedChannels: 0 }
  const review = async rows => {
    const fresh = rows.filter(r => !cache.has(String(r.channelId || r.id))).slice(0, Math.max(0, maxChannels - diagnostics.reviewedChannels))
    const pending = [], errors = []; let cursor = 0
    await Promise.all(Array.from({ length: Math.min(4, fresh.length) }, async () => {
      while (cursor < fresh.length) {
        const row = fresh[cursor++], id = String(row.channelId || row.id)
        diagnostics.reviewedChannels++; cache.set(id, null)
        if (!row.uploadsPlaylistId) continue
        try {
          diagnostics.playlistCalls++
          const result = await request('playlistItems', { part: 'contentDetails', playlistId: row.uploadsPlaylistId, maxResults: '12' })
          pending.push({ row, ids: [...new Set((result.items || []).map(v => v.contentDetails?.videoId).filter(Boolean))] })
        } catch (error) { diagnostics.failures++; errors.push(error) }
      }
    }))
    if (fresh.length && errors.length === fresh.length) throw errors[0]
    const ids = [...new Set(pending.flatMap(p => p.ids))], byId = new Map()
    for (let i = 0; i < ids.length; i += 50) {
      diagnostics.videoCalls++
      const result = await request('videos', { part: 'snippet,statistics,contentDetails,liveStreamingDetails', id: ids.slice(i, i + 50).join(',') })
      for (const video of result.items || []) byId.set(video.id, video)
    }
    for (const { row, ids: videoIds } of pending) {
      const videos = videoIds.map(id => byId.get(id)).filter(v => v && number(v.statistics?.viewCount) !== null && Date.parse(v.snippet?.publishedAt || '') >= now() - 180 * 86400000 && Date.parse(v.snippet?.publishedAt || '') <= now())
      const summary = summarizeYouTubeVideos(videos)
      const relevance = query ? assessRecentYouTubeRelevance(videos, query, matchesVideo) : { matches: null, sampleCount: videos.length, matchingCount: 0, evidence: [], reason: '검색 적합성 미검증 · 채널 지표 조회' }
      cache.set(String(row.channelId || row.id), { ...summary, youtubeRecentMetrics: { ...summary, collectedAt: new Date(now()).toISOString(), windowDays: 180 }, recentRelevance: relevance,
        averageViewsSource: `최근 공개 영상 ${summary.sampleCount}개 · ${summary.method}` })
      if (!relevance.matches) diagnostics.excludedChannels++
    }
    review.exhausted = diagnostics.reviewedChannels >= maxChannels
    return rows.flatMap(row => {
      const data = cache.get(String(row.channelId || row.id))
      if (filterResults && !data?.recentRelevance.matches) return []
      const proof = data?.recentRelevance?.evidence || []
      return [{ ...row, ...(data || { averageViews: 0, averageViewsByFormat: {}, averageViewsSource: '최근 공개 영상 조회 미확인' }), ...(proof.length ? {
        matchedVideoId: proof[0].videoId, matchedContentUrl: proof[0].url,
        sourceTitle: proof[0].title, sourceSnippet: proof[0].description,
      } : {}) }]
    })
  }
  review.diagnostics = diagnostics
  return review
}
