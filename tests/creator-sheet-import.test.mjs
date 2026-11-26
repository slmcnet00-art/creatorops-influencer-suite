import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCreatorSheets, mergeCreatorSheetImport, sheetNumber } from '../shared/creatorSheetImport.js'

test('each source tab becomes a stable group, while shared accounts deduplicate and empty tabs do not', () => {
  const tabs = ['KR beauty', 'JP beauty'].map(name => ({ name, sourceId: 'source', sourceTitle: 'workbook', rows: [['계정명', 'URL', '팔로워', '평균 조회수'], ['creator', 'https://www.instagram.com/creator/', '12,000', '1.2만']] }))
  const bundle = parseCreatorSheets([...tabs, { name: 'empty', rows: [] }])
  assert.equal(bundle.creators.length, 1)
  assert.equal(bundle.creatorGroups.length, 2)
  assert.equal(bundle.creatorGroups[0].creatorIds[0], bundle.creatorGroups[1].creatorIds[0])
  assert.equal(bundle.creators[0].followers, 12000)
  assert.equal(bundle.creators[0].averageViews, 12000)
  const initial = { brands: [], creators: [{ id: 42, platform: 'Instagram', handle: '@creator', name: 'existing', followers: 99999 }], creatorGroups: [] }
  const first = mergeCreatorSheetImport(initial, bundle)
  const second = mergeCreatorSheetImport(first, bundle)
  assert.equal(second.creators.length, 1)
  assert.equal(second.creators[0].followers, 99999)
  assert.equal(second.creatorGroups.length, 2)
  assert.deepEqual(second.creatorGroups[0].creatorIds, [42])
})

test('Korean shipping accounts import without addresses, phones or event winners', () => {
  const rows = [['인플루언서 계정', '주소', '수령자 연락처', '성함/명칭'], ['https://www.instagram.com/safe/', 'PRIVATE_ADDRESS', 'PRIVATE_PHONE', 'PRIVATE_RECIPIENT']]
  const bundle = parseCreatorSheets([{ name: '제품 시딩', sourceId: 'x', sourceTitle: 'archive', rows }, { name: '이벤트 당첨자', sourceId: 'x', rows }])
  assert.equal(bundle.creators.length, 1)
  assert.equal(bundle.creators[0].handle, '@safe')
  assert.doesNotMatch(JSON.stringify(bundle), /PRIVATE_ADDRESS|PRIVATE_PHONE|PRIVATE_RECIPIENT/)
  assert.equal(bundle.creatorGroups.length, 1)
})

test('plain handles in account-link columns work and a later URL column identifies the actual platform', () => {
  const bundle = parseCreatorSheets([{ name: '시트1', sourceId: 's', sourceTitle: 'archive', rows: [['이름', '계정 링크', '팔로워', 'URL'], ['Name', 'handle', '4,000', 'https://www.youtube.com/@handle']] }])
  assert.equal(bundle.creators[0].platform, 'YouTube')
  assert.equal(bundle.creators[0].handle, '@handle')
  assert.equal(sheetNumber('5 comments'), null)
})

test('USD source rate never becomes a KRW creator price; blank metrics remain unverified', () => {
  const bundle = parseCreatorSheets([{ name: 'TikTok', sourceId: 's', sourceTitle: 'archive', rows: [['Nickname', 'Payment (USD)'], ['creator', '$200']] }])
  assert.equal(bundle.creators[0].importRate.currency, 'USD')
  assert.equal(bundle.creators[0].actualPrice, undefined)
  assert.equal(bundle.creators[0].followers, null)
  assert.equal(bundle.creators[0].needsVerification, true)
})

test('definition tabs and unrelated secondary-channel URLs never become the primary creator account', () => {
  const bundle = parseCreatorSheets([
    { name: 'DB_LIST', sourceId: 's', rows: [['크리에이터'], ['설명용분류']] },
    { name: '실제 목록', sourceId: 's', sourceTitle: 'archive', rows: [['계정명', '다른 채널', 'URL', '채널'], ['main', 'https://www.youtube.com/@other', 'https://www.instagram.com/main/', 'Instagram']] },
  ])
  assert.equal(bundle.creatorGroups.length, 1)
  assert.equal(bundle.creators.length, 1)
  assert.equal(bundle.creators[0].platform, 'Instagram')
  assert.equal(bundle.creators[0].profileUrl, 'https://www.instagram.com/main/')
})

test('source countries and swapped shipping columns remain explicit; missing country never defaults to Korea', () => {
  const bundle = parseCreatorSheets([{ name: 'archive', sourceId: 's', sourceTitle: 'archive', rows: [
    ['Nickname', 'Country', 'State'], ['uscreator', 'United States', 'CA'], ['swapped', 'FL', 'United States'], ['unknown', '', ''],
  ] }])
  assert.deepEqual(bundle.creators.map(creator => creator.country), ['US', 'US', '미확인'])
  assert.ok(bundle.creators.every(creator => creator.countryConfidence === 'unverified'))
})

test('imported and legacy bundle creators satisfy the UI topics array contract', () => {
  const bundle = parseCreatorSheets([{ name: 'KR', sourceId: 's', sourceTitle: 'archive', rows: [['계정명'], ['creator']] }])
  assert.deepEqual(bundle.creators[0].topics, [])
  const legacy = { ...bundle, creators: bundle.creators.map(({ topics, ...creator }) => creator) }
  const merged = mergeCreatorSheetImport({}, legacy)
  assert.deepEqual(merged.creators[0].topics, [])
  assert.doesNotThrow(() => [...merged.creators[0].topics])
})
