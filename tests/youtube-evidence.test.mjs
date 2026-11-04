import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyYouTubeVideo, summarizeYouTubeVideos, assessRecentYouTubeRelevance, createYouTubeEvidenceReviewer } from '../server/youtubeEvidence.js'
import { discoverYouTubeCreators, focusedYouTubeQueries } from '../server/youtubeDiscovery.js'

const video = (id, title, views = 100, extra = {}) => ({ id, snippet: { title, publishedAt: '2026-10-01T00:00:00Z', channelId: 'c' }, contentDetails: { duration: 'PT5M' }, statistics: { viewCount: String(views) }, ...extra })
test('3분 이하나 세로 썸네일만으로 Shorts라고 확정하지 않는다', () => {
  const short = video('s', '레시피', 10, { contentDetails: { duration: 'PT2M' } })
  assert.equal(classifyYouTubeVideo(short).confidence, 'unknown')
  assert.equal(classifyYouTubeVideo({ ...short, snippet: { ...short.snippet, title: '레시피 #shorts', thumbnails: { high: { width: 100, height: 200 } } } }).confidence, 'inferred')
  assert.equal(classifyYouTubeVideo({ ...short, fileDetails: { videoStreams: [{ aspectRatio: 9 / 16 }] } }).confidence, 'confirmed')
  assert.equal(classifyYouTubeVideo(video('l', '조리법')).format, '롱폼')
  assert.equal(classifyYouTubeVideo({ ...short, fileDetails: { videoStreams: [{ aspectRatio: 16 / 9 }] } }).format, '롱폼')
  assert.equal(classifyYouTubeVideo({ ...short, snippet: { ...short.snippet, liveBroadcastContent: 'upcoming' } }).format, '라이브')
})
test('최근 표본의 상하 20%를 제외해 바이럴 이상치 영향을 낮추고 형식별 지표와 추정을 분리한다', () => {
  const videos = [100, 100, 100, 100, 100000].map((n, i) => video(String(i), '집밥 요리 레시피', n))
  videos.push(video('short', '#shorts 요리', 999, { contentDetails: { duration: 'PT1M' } }))
  const result = summarizeYouTubeVideos(videos)
  assert.equal(result.averageViewsByFormat.롱폼, 100)
  assert.equal(result.averageViewsByFormat.숏폼, undefined)
  assert.equal(result.inferredAverageViewsByFormat.숏폼, 999)
  assert.equal(result.formatMetrics.롱폼.sampleCount, 5)
  assert.equal(result.formatMetrics.롱폼.usedCount, 3)
  assert.equal(summarizeYouTubeVideos([video('zero', '요리', 0)]).sampleCount, 1)
  assert.equal(summarizeYouTubeVideos([{ ...video('missing', '요리'), statistics: {} }]).sampleCount, 0)
})
test('최근 레시피가 반복되는 채널만 통과시키고 검색 제목의 단어만 맞는 먹방·쇼핑 채널은 제외한다', () => {
  const matchesVideo = v => /요리|레시피|料理|レシピ/.test(v.snippet.title)
  const bad = ['맛집 먹방 레시피 후기', '요리 레시피 신제품 쇼핑 하울', '여행 브이로그'].map((title, i) => video(String(i), title))
  assert.equal(assessRecentYouTubeRelevance(bad, '요리 레시피', matchesVideo).matches, false)
  const good = ['집밥 요리 레시피', '계란 레시피 만드는 법', '요리 재료: 계란'].map((title, i) => video(String(i), title))
  assert.equal(assessRecentYouTubeRelevance(good, '요리 레시피', matchesVideo).matches, true)
  const jp = ['家庭料理 簡単レシピ', '卵の作り方 レシピ', '家ごはん 料理'].map((title, i) => video(String(i), title))
  assert.equal(assessRecentYouTubeRelevance(jp, '料理 レシピ', matchesVideo).matches, true)
  assert.equal(assessRecentYouTubeRelevance(good.slice(0, 1), '요리 레시피', matchesVideo).matches, false)
})
test('최근 영상 검증은 업로드 목록을 사용하고 영상 상세를 50개씩 일괄 조회하며 중복 요청을 캐시한다', async () => {
  const calls = []
  const review = createYouTubeEvidenceReviewer({ query: '요리 레시피', matchesVideo: () => true, request: async (resource, params) => {
    calls.push([resource, params])
    if (resource === 'playlistItems') return { items: [0, 1, 2].map(i => ({ contentDetails: { videoId: `${params.playlistId}-${i}` } })) }
    return { items: params.id.split(',').map(id => video(id, '요리 레시피 만드는 법')) }
  } })
  const rows = [1, 2].map(id => ({ id, channelId: id, uploadsPlaylistId: `p${id}` }))
  assert.equal((await review(rows)).length, 2)
  assert.equal((await review(rows)).length, 2)
  assert.equal(calls.filter(([r]) => r === 'playlistItems').length, 2)
  assert.equal(calls.filter(([r]) => r === 'videos').length, 1)
  assert.equal(calls.find(([r]) => r === 'videos')[1].part, 'snippet,statistics,contentDetails,liveStreamingDetails')
})
test('검증 예산을 넘는 채널과 조회 실패를 일치 후보로 채우지 않는다', async () => {
  const review = createYouTubeEvidenceReviewer({ query: '요리', maxChannels: 1, matchesVideo: () => true, request: async () => { throw Error('provider failed') } })
  await assert.rejects(review([{ id: 1, uploadsPlaylistId: 'p' }, { id: 2, uploadsPlaylistId: 'q' }]), /provider failed/)
  assert.equal(review.diagnostics.playlistCalls, 1)
})

test('검색→업로드 목록→영상 상세→최근 근거 검증에서 먹방 후보를 제거하고 실제 레시피 후보를 반환한다', async () => {
  const calls = []
  const request = async (resource, params) => {
    calls.push([resource, params])
    if (resource === 'search') return { items: ['cook', 'eat'].map(id => ({ id: { channelId: id, videoId: id }, snippet: { channelId: id, title: '요리 레시피' } })) }
    if (resource === 'channels') return { items: ['cook', 'eat'].map(id => ({ id, snippet: { title: '요리 레시피', country: 'KR' }, contentDetails: { relatedPlaylists: { uploads: id } } })) }
    if (resource === 'playlistItems') return { items: [0, 1, 2, 3, 4].map(i => ({ contentDetails: { videoId: `${params.playlistId}-${i}` } })) }
    return { items: params.id.split(',').map(id => video(id, id.startsWith('cook') ? '집밥 요리 레시피 만드는 법' : '맛집 먹방 레시피 후기', id.endsWith('4') ? 9999999 : 100)) }
  }
  const reviewer = createYouTubeEvidenceReviewer({ request, query: '요리 레시피', matchesVideo: () => true })
  const result = await discoverYouTubeCreators({ queries: ['요리 레시피'], maxResults: 1, country: 'KR', request, reviewChannels: reviewer, normalize: row => ({ id: row.id, country: 'KR', uploadsPlaylistId: row.contentDetails.relatedPlaylists.uploads }), select: rows => rows })
  assert.deepEqual(result.items.map(row => row.id), ['cook'])
  assert.equal(result.items[0].averageViewsByFormat.롱폼, 100)
  assert.equal(result.diagnostics.recentReview.excludedChannels, 1)
  assert.equal(calls.filter(([r]) => r === 'channels').length, 1)
  assert.equal(calls.filter(([r]) => r === 'videos').length, 1)
  assert.ok(focusedYouTubeQueries('요리 레시피', '요리 레시피', 'KR').every(q => !q.includes('리뷰')))
})

test('소유자 권한으로도 오래된 3분 영상은 Shorts 확정으로 소급하지 않고 라이브를 평균에 섞지 않는다', () => {
  const old = video('old', '요리', 1000, { snippet: { publishedAt: '2023-01-01' }, contentDetails: { duration: 'PT2M' }, fileDetails: { videoStreams: [{ aspectRatio: 9 / 16 }] } })
  assert.equal(classifyYouTubeVideo(old).confidence, 'unknown')
  const live = { ...video('live', '요리', 9999999), liveStreamingDetails: { actualStartTime: '2026-10-01' } }
  assert.equal(summarizeYouTubeVideos([video('c', '요리', 100), live]).averageViews, 100)
})
