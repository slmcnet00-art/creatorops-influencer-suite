import test from 'node:test'
import assert from 'node:assert/strict'
import { createCreatorProfileImages } from '../server/creatorProfileImages.js'
import { creatorProfileImage } from '../shared/creatorProfilePresentation.js'

const instagramImage = 'https://scontent.cdninstagram.com/profile.jpg'
const html = `<meta property="og:image" content="${instagramImage}?a=1&amp;b=2"><title>Creator (&#064;creator) • Instagram photos and videos</title>`
test('profile photos exclude video thumbnails and prefer explicit profile images', () => {
  assert.equal(creatorProfileImage({ thumbnailUrl: 'https://i.ytimg.com/video.jpg' }), '')
  assert.equal(creatorProfileImage({ profileImageUrl: instagramImage, avatar: 'https://images.unsplash.com/stock' }), instagramImage)
})
test('public Instagram profile metadata is identity checked, decoded, and cached', async () => {
  let calls = 0
  const photos = createCreatorProfileImages({ fetchImpl: async () => { calls++; return new Response(html) } })
  const [first, second] = await Promise.all([photos.resolve('https://www.instagram.com/creator/?igsh=a'), photos.resolve('https://instagram.com/creator/')])
  assert.equal(first.imageUrl, instagramImage + '?a=1&b=2')
  assert.equal(second.imageUrl, first.imageUrl)
  assert.equal(calls, 1)
})
test('login pages, wrong identities and platform logos never become creator photos', async () => {
  for (const body of [html.replace('&#064;creator', '&#064;someoneelse'), '<title>Login • Instagram</title>' + html, html.replace(instagramImage, 'https://static.cdninstagram.com/rsrc/logo.png')]) {
    const photos = createCreatorProfileImages({ fetchImpl: async () => new Response(body) })
    assert.equal((await photos.resolve('https://instagram.com/creator/')).status, 'unavailable')
  }
})
test('only canonical supported profile URLs are fetched, never arbitrary servers or content pages', async () => {
  let calls = 0
  const photos = createCreatorProfileImages({ fetchImpl: async () => { calls++; return new Response(html) } })
  for (const url of ['http://localhost/a', 'https://instagram.com.evil.test/a', 'https://instagram.com/p/abc/', 'https://www.youtube.com/watch?v=abc', 'https://name:secret@instagram.com/a/', 'https://instagram.com:444/a/']) await assert.rejects(photos.resolve(url), { status: 400 })
  assert.equal(calls, 0)
})
test('YouTube uses channels.list snippet images and TikTok uses the matching account avatar', async () => {
  const urls = []
  const photos = createCreatorProfileImages({ env: { YOUTUBE_DATA_API_KEY: 'test-only' }, fetchJson: async url => {
    urls.push(new URL(url))
    return url.includes('googleapis') ? { items: [{ snippet: { thumbnails: { high: { url: 'https://yt3.googleusercontent.com/photo' } } } }] } : { code: 0, data: { user: { uniqueId: 'creator', avatarLarger: 'https://p16.tiktokcdn.com/photo' } } }
  } })
  assert.equal((await photos.resolve('https://youtube.com/@creator')).imageUrl, 'https://yt3.googleusercontent.com/photo')
  assert.equal(urls[0].searchParams.get('part'), 'snippet,statistics')
  assert.equal((await photos.resolve('https://tiktok.com/@creator')).imageUrl, 'https://p16.tiktokcdn.com/photo')
})

test('only two explicit missing-profile responses confirm absence; blocked or private pages do not', async () => {
  let calls = 0
  const missingHtml = "<title>Page not found</title>Sorry, this page isn't available."
  const missing = createCreatorProfileImages({ fetchImpl: async () => { calls++; return new Response(missingHtml, { status: 404 }) } })
  const result = await missing.resolve('https://instagram.com/gone/')
  assert.equal(result.status, 'account_not_found')
  assert.equal(result.confirmedAbsent, true)
  assert.equal(calls, 2)
  for (const [body, status] of [[missingHtml, 429], [missingHtml, 503], ['<title>Login • Instagram</title>' + missingHtml, 404], ['Private account', 200], ['Not found', 404]]) {
    const service = createCreatorProfileImages({ fetchImpl: async () => new Response(body, { status }) })
    assert.equal((await service.resolve('https://instagram.com/safe/')).status, 'unavailable')
  }
  let attempt = 0
  const transient = createCreatorProfileImages({ fetchImpl: async () => ++attempt === 1 ? new Response(missingHtml, { status: 404 }) : new Response(html) })
  assert.equal((await transient.resolve('https://instagram.com/creator/')).status, 'unavailable')
})

test('stable YouTube channel ID absence is rechecked; an absent handle could be renamed and is retained', async () => {
  let calls = 0
  const service = createCreatorProfileImages({ env: { YOUTUBE_DATA_API_KEY: 'test-only' }, fetchJson: async () => { calls++; return { items: [] } } })
  assert.equal((await service.resolve('https://youtube.com/channel/UCknown')).status, 'account_not_found')
  assert.equal(calls, 2)
  assert.equal((await service.resolve('https://youtube.com/@renamed')).status, 'unavailable')
})
