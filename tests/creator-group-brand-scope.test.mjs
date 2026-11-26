import test from 'node:test'
import assert from 'node:assert/strict'
import { creatorGroupBrandId, creatorGroupsForBrand } from '../shared/creatorGroups.js'

const campaigns = [{ id: 10, brandId: 1 }, { id: 20, brandId: 2 }]
const groups = [{ id: 'monclos', brandId: 1 }, { id: 'kebbing', campaignId: 20 }, { id: 'legacy' }]

test('현재 브랜드는 다른 브랜드와 미지정 그룹을 숨기고 원본을 보존한다', () => {
  const before = JSON.stringify(groups)
  assert.deepEqual(creatorGroupsForBrand(groups, campaigns, '1').map(group => group.id), ['monclos'])
  assert.deepEqual(creatorGroupsForBrand(groups, campaigns, 2).map(group => group.id), ['kebbing'])
  assert.equal(JSON.stringify(groups), before)
})

test('브랜드 직접 지정이 캠페인보다 우선하며 구형 필드와 숫자/문자 ID도 인식한다', () => {
  assert.equal(creatorGroupBrandId({ brandId: 1, campaignId: 20 }, campaigns), '1')
  assert.equal(creatorGroupBrandId({ campaign_id: '20' }, campaigns), '2')
  assert.equal(creatorGroupBrandId({ brand_id: 1 }, campaigns), '1')
  assert.equal(creatorGroupBrandId({ campaignId: 'missing' }, campaigns), '')
})

test('전체 브랜드 선택은 전달받은 접근 가능한 그룹과 미지정 그룹을 그대로 표시한다', () => {
  assert.deepEqual(creatorGroupsForBrand(groups, campaigns, 1, 'all'), groups)
  assert.deepEqual(creatorGroupsForBrand([], campaigns, 1), [])
})
