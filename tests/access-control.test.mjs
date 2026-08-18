import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPermissionTestAccounts,
  canAccessSection,
  canManageTeamPermissions,
  getAccessibleBrands,
  getAccountBrandIds,
  mergePermissionTestAccounts,
} from '../src/accessControl.js'

const brands = [
  { id: 201, name: '브랜드 A' },
  { id: 202, name: '브랜드 B' },
  { id: 203, name: '브랜드 C' },
]

test('Owner와 Admin은 전체 브랜드와 권한 관리에 접근한다', () => {
  for (const role of ['Owner', 'Admin']) {
    const account = { role, brandIds: [] }
    assert.deepEqual(getAccountBrandIds(account, brands), [201, 202, 203])
    assert.equal(canManageTeamPermissions(account), true)
    assert.equal(canAccessSection(account, 'dataRoom'), true)
  }
})

test('Manager와 Marketer는 배정된 브랜드만 본다', () => {
  const manager = { role: 'Manager', brandIds: [201] }
  const marketer = { role: 'Marketer', brandIds: [202] }
  assert.deepEqual(getAccessibleBrands(manager, brands).map((brand) => brand.id), [201])
  assert.deepEqual(getAccessibleBrands(marketer, brands).map((brand) => brand.id), [202])
  assert.equal(canManageTeamPermissions(manager), false)
  assert.equal(canAccessSection(marketer, 'messages'), true)
  assert.equal(canAccessSection(marketer, 'dataRoom'), false)
})

test('Analyst는 리포트와 데이터룸만, Client는 승인 화면만 접근한다', () => {
  const analyst = { role: 'Analyst', brandIds: [201, 202] }
  const client = { role: 'Client', brandIds: [201] }
  assert.equal(canAccessSection(analyst, 'report'), true)
  assert.equal(canAccessSection(analyst, 'dataRoom'), true)
  assert.equal(canAccessSection(analyst, 'messages'), false)
  assert.equal(canAccessSection(client, 'campaigns'), true)
  assert.equal(canAccessSection(client, 'groups'), true)
  assert.equal(canAccessSection(client, 'discovery'), false)
  assert.equal(canAccessSection(client, 'dataRoom'), false)
})

test('존재하지 않는 브랜드 ID는 계정 권한에 포함되지 않는다', () => {
  const account = { role: 'Manager', brandIds: [201, 999] }
  assert.deepEqual(getAccountBrandIds(account, brands), [201])
})

test('권한 테스트 계정은 실제 브랜드 ID로 생성되고 중복 없이 갱신된다', () => {
  const fixtures = buildPermissionTestAccounts(brands)
  assert.equal(fixtures.length, 4)
  assert.deepEqual(fixtures.find((account) => account.role === 'Admin').brandIds, [201, 202, 203])
  assert.deepEqual(fixtures.find((account) => account.role === 'Marketer').brandIds, [202])
  assert.deepEqual(fixtures.find((account) => account.role === 'Client').brandIds, [201])

  const existing = [{ id: 'acct-owner', role: 'Owner' }, { ...fixtures[0], name: '이전 테스트 관리자' }]
  const merged = mergePermissionTestAccounts(existing, brands)
  assert.equal(merged.filter((account) => account.id === 'acct-admin-test').length, 1)
  assert.equal(merged.find((account) => account.id === 'acct-admin-test').name, '권한 테스트 관리자')
})
