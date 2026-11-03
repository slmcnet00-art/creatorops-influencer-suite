import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverYouTubeCreators, focusedYouTubeQueries, coalesceYouTubeSearch, youtubeSearchScope } from '../server/youtubeDiscovery.js'
import { createYouTubeUsage, youtubeQuotaPeriod, quotaLevel, classifyYouTubeRequest } from '../server/youtubeUsage.js'
import { memorySupabase } from './helpers/memorySupabase.mjs'
import express from 'express'

const params = { queries: ['클렌징 밤', '클렌징 밤 리뷰'], country: 'KR', maxResults: 2,
  normalize: c => ({ id: c.id, name: c.snippet.title }), select: rows => rows.filter(r => r.name.includes('클렌징')) }
test('정확한 검색으로 충분하면 추가 확장 없이 종료하고 중복 채널 상세는 한 번만 읽는다', async () => {
  const calls = []
  const result = await discoverYouTubeCreators({ ...params, request: async (resource, p) => {
    calls.push([resource, p])
    if (resource === 'channels') return { items: [{ id: 'a', snippet: { title: '클렌징 A', country: 'KR' } }, { id: 'b', snippet: { title: '클렌징 B', country: 'KR' } }] }
    return { items: p.type === 'channel' ? [{ id: { channelId: 'a' } }] : [{ id: { videoId: 'v1' }, snippet: { channelId: 'a', title: '밤 리뷰' } }, { id: { videoId: 'v2' }, snippet: { channelId: 'b' } }] }
  } })
  assert.equal(calls.length, 3); assert.equal(calls.filter(c => c[0] === 'channels').length, 1)
  assert.deepEqual(calls.find(c => c[0] === 'channels')[1].id, 'a,b')
  assert.equal(result.items.length, 2); assert.equal(result.diagnostics.partial, false)
  assert.ok(result.items[0].matchedContentUrl.includes('v1'))
})
test('일치하지 않는 후보·공식 국가 불일치는 채우기용으로 반환하지 않으며 검색 예산을 지킨다', async () => {
  let calls = 0
  const result = await discoverYouTubeCreators({ ...params, maxPages: 2, request: async resource => {
    calls++
    return resource === 'channels' ? { items: [{ id: 'a', snippet: { title: '클렌징 foreign', country: 'US' } }, { id: 'b', snippet: { title: '테크' } }] } : { nextPageToken: 'more', items: [{ id: { channelId: 'a' }, snippet: { channelId: 'a' } }, { id: { channelId: 'b' }, snippet: { channelId: 'b' } }] }
  } })
  assert.equal(result.items.length, 0); assert.equal(result.diagnostics.partial, true); assert.equal(result.diagnostics.searchCalls, 2); assert.equal(calls, 3)
})
test('추가 검색은 실제 일치 후보만 반환하고 같은 채널의 상세를 다시 조회하지 않는다', async () => {
  let details = 0
  const result = await discoverYouTubeCreators({ ...params, maxResults: 1, select: rows => rows.filter(x => x.sourceTitle?.includes('제품 일치')), request: async (resource, p) => {
    if (resource === 'channels') { details++; return { items: [{ id: 'a', snippet: { title: '크리에이터', country: 'KR' } }] } }
    return { items: [{ id: { channelId: 'a', videoId: 'v' }, snippet: { channelId: 'a', title: p.q.endsWith('리뷰') ? '제품 일치' : '무관' } }] }
  } })
  assert.equal(result.items.length, 1); assert.equal(details, 1); assert.equal(result.diagnostics.searchCalls, 4)
})
test('검색어 확장은 원래 제품을 유지하고 국가와 관계없이 한국 뷰티 후보로 확장하지 않는다', () => {
  const queries = focusedYouTubeQueries('洗顔', '洗顔', 'JP')
  assert.deepEqual(queries, ['洗顔', '洗顔 レビュー', '洗顔 クリエイター'])
})
test('전체·동남아·유럽은 한국으로 강제하거나 유효하지 않은 regionCode로 보내지 않는다', () => {
  assert.deepEqual(youtubeSearchScope('ALL'), { regionCode: '', allowedCountries: [] })
  assert.equal(youtubeSearchScope('SEA').regionCode, ''); assert.ok(youtubeSearchScope('SEA').allowedCountries.includes('TH'))
  assert.equal(youtubeSearchScope('EU').regionCode, ''); assert.ok(youtubeSearchScope('EU').allowedCountries.includes('FR'))
  assert.deepEqual(youtubeSearchScope('US').allowedCountries, ['US'])
})
test('지역 그룹은 해당 공식 국가만 허용하고 전체 검색은 다른 국가를 제거하지 않는다', async () => {
  const request = async resource => resource === 'channels' ? { items: [{ id: 'th', snippet: { title: '클렌징', country: 'TH' } }, { id: 'kr', snippet: { title: '클렌징', country: 'KR' } }] } : { items: [{ id: { channelId: 'th' }, snippet: { channelId: 'th' } }, { id: { channelId: 'kr' }, snippet: { channelId: 'kr' } }] }
  const sea = await discoverYouTubeCreators({ ...params, ...youtubeSearchScope('SEA'), request })
  assert.deepEqual(sea.items.map(c => c.id), ['th'])
  const all = await discoverYouTubeCreators({ ...params, ...youtubeSearchScope('ALL'), request })
  assert.equal(all.items.length, 2)
})
test('유효하지 않은 결과 수와 일일 한도 설정은 잘못된 API 호출 전에 거부한다', async () => {
  await assert.rejects(discoverYouTubeCreators({ ...params, maxResults: NaN }), e => e.status === 400)
  assert.throws(() => createYouTubeUsage({ getClient: () => null, workspaceId: 'a', env: { YOUTUBE_SEARCH_DAILY_LIMIT: '-1' } }))
})
test('동시 동일 검색은 한 번만 실행하고 실패 후에는 다시 요청할 수 있다', async () => {
  let calls = 0, resolve
  const load = () => { calls++; return new Promise(r => { resolve = r }) }
  const a = coalesceYouTubeSearch('same', load), b = coalesceYouTubeSearch('same', load)
  await Promise.resolve(); resolve('ok'); assert.deepEqual(await Promise.all([a, b]), ['ok', 'ok']); assert.equal(calls, 1)
  await assert.rejects(coalesceYouTubeSearch('same', () => { throw Error('failure') }))
  assert.equal(await coalesceYouTubeSearch('same', async () => 'retry'), 'retry')
})
test('YouTube 할당량 날짜는 한국 자정이 아닌 태평양 자정·서머타임을 따른다', () => {
  assert.equal(youtubeQuotaPeriod(new Date('2026-11-03T07:59:59Z')).day, '2026-11-02')
  assert.equal(youtubeQuotaPeriod(new Date('2026-11-03T08:00:00Z')).day, '2026-11-03')
  assert.equal(youtubeQuotaPeriod(new Date('2026-07-01T06:59:59Z')).month, '2026-06')
  assert.equal(youtubeQuotaPeriod(new Date('2026-07-01T07:00:00Z')).day, '2026-07-01')
})
test('검색과 일반 조회를 분리하고 80·95·100% 경고 기준을 판정한다', () => {
  assert.equal(classifyYouTubeRequest('https://www.googleapis.com/youtube/v3/search?key=SECRET').bucket, 'search')
  assert.equal(classifyYouTubeRequest('https://www.googleapis.com/youtube/v3/videos?id=a').bucket, 'default')
  assert.equal(classifyYouTubeRequest('https://example.com/youtube/v3/search'), null)
  assert.deepEqual([79, 80, 95, 100].map(n => quotaLevel(n, 100)), ['normal', 'warning', 'critical', 'exhausted'])
})
test('실제 요청 시도와 실패도 DB에 남고 키·검색어·응답은 저장하지 않으며 재시작 후 합산한다', async () => {
  const client = memorySupabase(), now = () => new Date('2026-11-03T12:00:00Z'), opts = { getClient: () => client, workspaceId: 'test', now }
  const usage = createYouTubeUsage(opts)
  await usage.track('https://www.googleapis.com/youtube/v3/search?key=SECRET&q=PRIVATE', async () => 'ok')
  await assert.rejects(usage.track('https://www.googleapis.com/youtube/v3/videos?key=SECRET', async () => { throw Object.assign(Error('quota exceeded'), { status: 403 }) }))
  assert.equal(JSON.stringify(client.tables).includes('SECRET'), false); assert.equal(JSON.stringify(client.tables).includes('PRIVATE'), false)
  const data = await createYouTubeUsage(opts).summary()
  assert.equal(data.buckets[0].used, 1); assert.equal(data.buckets[1].used, 1); assert.equal(data.buckets[1].level, 'upstream-quota-error')
  assert.equal(data.buckets[0].monthUsed, 1)
})
test('사용량 저장 실패는 외부 호출 전에 중단하며 다른 워크스페이스 사용량은 섞지 않는다', async () => {
  const client = memorySupabase(); client.failInsert = 'job_runs'; let called = false
  const usage = createYouTubeUsage({ getClient: () => client, workspaceId: 'a' })
  await assert.rejects(usage.track('https://www.googleapis.com/youtube/v3/search', async () => { called = true }), e => e.status === 503)
  assert.equal(called, false); client.failInsert = ''
  await usage.track('https://www.googleapis.com/youtube/v3/search', async () => true)
  const data = await createYouTubeUsage({ getClient: () => client, workspaceId: 'b' }).summary()
  assert.equal(data.buckets[0].used, 0)
})
test('사용량 관리자 API는 실행 서비스 키와 일반 회원을 거부하고 관리자에게만 집계를 반환한다', async t => {
  const client = memorySupabase(), usage = createYouTubeUsage({ getClient: () => client, workspaceId: 'test' }), app = express()
  usage.register(app, (req, res, next) => req.headers.authorization === 'Bearer admin' ? next() : res.status(403).json({ message: 'admin required' }))
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); t.after(() => server.close())
  const url = `http://127.0.0.1:${server.address().port}/admin/youtube-usage`
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer os-service' } })).status, 403)
  const response = await fetch(url, { headers: { Authorization: 'Bearer admin' } })
  assert.equal(response.status, 200); assert.equal((await response.json()).data.buckets[0].used, 0)
})
test('진단용 HTTP 응답 실패를 그대로 반환하면서 사용량 실패로 기록한다', async () => {
  const client = memorySupabase(), usage = createYouTubeUsage({ getClient: () => client, workspaceId: 'test' })
  const response = await usage.track('https://www.googleapis.com/youtube/v3/videos', async () => new Response(JSON.stringify({ error: { message: 'daily quota exceeded' } }), { status: 403 }))
  assert.equal(response.status, 403); assert.equal(client.tables.job_runs[0].metadata.failedCount, 1)
  assert.equal(client.tables.job_runs[0].metadata.quotaErrors, 1)
  assert.ok(await response.json())
})
test('날짜가 바뀌면 일일 카운트는 분리하고 월 누적은 유지한다', async () => {
  const client = memorySupabase(); let time = new Date('2026-11-03T07:59:59Z')
  const usage = createYouTubeUsage({ getClient: () => client, workspaceId: 'test', now: () => time })
  await usage.track('https://www.googleapis.com/youtube/v3/search', async () => true)
  time = new Date('2026-11-03T08:00:00Z')
  let summary = await usage.summary(); assert.equal(summary.buckets[0].used, 0); assert.equal(summary.buckets[0].monthUsed, 1)
  await usage.track('https://www.googleapis.com/youtube/v3/search', async () => true)
  summary = await usage.summary(); assert.equal(summary.buckets[0].used, 1); assert.equal(summary.buckets[0].monthUsed, 2)
})
test('서로 다른 서버의 동시 호출도 누락 없이 일별 카운터 한 행에 누적한다', async () => {
  const client = memorySupabase(), opts = { getClient: () => client, workspaceId: 'test' }, a = createYouTubeUsage(opts), b = createYouTubeUsage(opts)
  let calls = 0
  await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).track('https://www.googleapis.com/youtube/v3/search', async () => { calls++ })))
  assert.equal(calls, 40); assert.equal(client.tables.job_runs.length, 1)
  assert.equal((await createYouTubeUsage(opts).summary()).buckets[0].used, 40)
})
test('선행 계측 기록을 잃지 않으며 이후 호출은 일별 카운터로 집약한다', async () => {
  const time = new Date('2026-11-03T12:00:00Z'), client = memorySupabase({ job_runs: [{ id: 1, workspace_id: 'test', job_name: 'youtube-api-usage', started_at: time.toISOString(), metadata: { bucket: 'search', day: '2026-11-03', month: '2026-11' } }] })
  const usage = createYouTubeUsage({ getClient: () => client, workspaceId: 'test', now: () => time })
  await usage.track('https://www.googleapis.com/youtube/v3/search', async () => true)
  const summary = await usage.summary(); assert.equal(summary.buckets[0].used, 2); assert.equal(summary.buckets[0].monthUsed, 2)
  assert.equal(client.tables.job_runs.length, 2)
})
test('카운터 키가 잘못된 범위에 연결되면 기존 데이터를 덮어쓰지 않는다', async () => {
  const client = memorySupabase(), usage = createYouTubeUsage({ getClient: () => client, workspaceId: 'test' })
  await usage.track('https://www.googleapis.com/youtube/v3/search', async () => true)
  client.tables.job_runs[0].metadata.day = 'invalid'
  let called = false
  await assert.rejects(usage.track('https://www.googleapis.com/youtube/v3/search', async () => { called = true }), e => e.status === 503)
  assert.equal(called, false); assert.equal(client.tables.job_runs[0].metadata.calls, 1)
})

test('국가별 번역 검색은 한 영상에서 조건을 충족한 근거만 연결하고 교차 영상 단어 합산을 거부한다', async () => {
  const {assessDiscoveryEvidence}=await import('../server/multiMarketDiscovery.js')
  const result=await discoverYouTubeCreators({queries:['sensitive serum'],country:'US',maxResults:2,maxPages:2,
    evidenceSelector:v=>assessDiscoveryEvidence({sourceTitle:v.title},'sensitive serum').matches,
    normalize:c=>({id:c.id}),select:rows=>rows,
    request:async(resource,p)=>resource==='channels'?{items:[{id:'a',snippet:{country:'US'}},{id:'b',snippet:{country:'US'}}]}:{items:p.type==='video'?[
      {id:{videoId:'bad-1'},snippet:{channelId:'a',title:'sensitive skin'}},
      {id:{videoId:'bad-2'},snippet:{channelId:'a',title:'oily skin serum'}},
      {id:{videoId:'good'},snippet:{channelId:'b',title:'sensitive skin serum review'}},
    ]:[]},
  })
  assert.deepEqual(result.items.map(c=>c.id),['b']);assert.equal(result.items[0].matchedVideoId,'good');assert.equal(result.items[0].matchedContentUrl,'https://www.youtube.com/watch?v=good')
})
