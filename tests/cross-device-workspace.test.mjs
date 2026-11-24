import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCreatorGroups } from '../shared/creatorGroups.js'
import { mergeBrandWorkspaceSnapshots } from '../shared/brandWorkspaceSnapshots.js'

const creators = [{ id: 10 }, { id: 11 }]
const linkedGroup = { id: 'favorite', brandId: 'brand-a', campaignId: 'campaign-a', sourceImportKey: 'source-v1', rawRowIds: ['row-2'], creatorIds: ['10', 11, 10, 'missing'] }

test('즐겨찾기 공유·새 기기 로드·재저장에서도 브랜드·캠페인·출처와 숫자/문자 ID 참조가 보존된다', () => {
  const first = normalizeCreatorGroups([linkedGroup], creators)
  const second = normalizeCreatorGroups(JSON.parse(JSON.stringify(first)), creators)
  assert.equal(second[0].brandId, 'brand-a')
  assert.equal(second[0].campaignId, 'campaign-a')
  assert.equal(second[0].sourceImportKey, 'source-v1')
  assert.deepEqual(second[0].rawRowIds, ['row-2'])
  assert.deepEqual(second[0].creatorIds, [10, 11])
  assert.deepEqual(first, second)
  assert.deepEqual(linkedGroup.creatorIds, ['10', 11, 10, 'missing'])
})

test('동일 ID의 오래된 전체 그룹보다 브랜드 공유 그룹을 우선하고 다른 브랜드는 보존한다', () => {
  const other = { id: 'other-group', brandId: 'brand-b', creatorIds: [20] }
  const base = { brands: [{ id: 'brand-b' }], campaigns: [{ id: 'other', brandId: 'brand-b' }], creators: [{ id: 20 }], creatorGroups: [{ id: 'favorite', creatorIds: [] }, other] }
  const snapshot = { brand_id: 'brand-a', payload: { brand: { id: 'brand-a', name: '몽클로스' }, creators, campaigns: [{ id: 'campaign-a', brandId: 'brand-a' }], creatorGroups: [linkedGroup] } }
  const merged = mergeBrandWorkspaceSnapshots(base, [snapshot])
  assert.equal(merged.brands.length, 2)
  assert.equal(merged.campaigns.length, 2)
  assert.equal(merged.creatorGroups.length, 2)
  assert.equal(merged.creatorGroups.find(group => group.id === 'favorite').brandId, 'brand-a')
  assert.deepEqual(merged.creatorGroups.find(group => group.id === 'other-group'), other)
  assert.deepEqual(base.creatorGroups[0].creatorIds, [])
})

test('두 기기의 첫 읽기와 전체 스냅샷 갱신에 같은 브랜드 공유 기준을 적용한다', () => {
  const scope = { brand_id: 'a', payload: { brand: { id: 'a' }, campaigns: [{ id: 1, brandId: 'a' }], creators, creatorGroups: [{ ...linkedGroup, brandId: 'a', campaignId: 1 }] } }
  const load = full => {
    const merged = mergeBrandWorkspaceSnapshots(JSON.parse(JSON.stringify(full)), [scope])
    return { ...merged, creatorGroups: normalizeCreatorGroups(merged.creatorGroups, merged.creators) }
  }
  const deviceA = load({ creatorGroups: [], campaigns: [] })
  const deviceB = load({ ...deviceA, campaigns: [], creatorGroups: [] })
  assert.deepEqual(deviceB, deviceA)
  assert.equal(deviceB.campaigns.length, 1)
  assert.deepEqual(deviceB.creatorGroups[0].creatorIds, [10, 11])
})

test('명시적 빈 목록은 존중하고 부분 스냅샷에 없는 목록과 다른 브랜드 자료를 지우지 않는다', () => {
  const base = { campaigns: [{ id: 1, brandId: 'a' }], creatorGroups: [{ id: 'a-group', brandId: 'a' }], trackedPosts: [{ id: 2, brandId: 'a' }] }
  const partial = mergeBrandWorkspaceSnapshots(base, [{ brand_id: 'a', payload: { brand: { id: 'a' } } }])
  assert.deepEqual(partial.campaigns, base.campaigns)
  assert.deepEqual(partial.creatorGroups, base.creatorGroups)
  assert.deepEqual(partial.trackedPosts, base.trackedPosts)
  const cleared = mergeBrandWorkspaceSnapshots(base, [{ brand_id: 'a', payload: { creatorGroups: [] } }])
  assert.deepEqual(cleared.creatorGroups, [])
  assert.deepEqual(normalizeCreatorGroups([], creators), [])
})
