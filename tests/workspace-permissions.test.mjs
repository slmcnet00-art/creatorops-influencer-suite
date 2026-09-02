import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canReadFullWorkspace,
  canWriteBrandWorkspace,
  canWriteFullWorkspace,
} from '../src/workspacePermissions.js'
import { normalizeBrandIds, prepareMemberAccessUpdate } from '../server/accessPolicy.js'

test('Owner와 Admin만 전체 워크스페이스 스냅샷을 읽고 쓴다', () => {
  for (const role of ['Owner', 'Admin']) {
    assert.equal(canReadFullWorkspace(role), true)
    assert.equal(canWriteFullWorkspace(role), true)
  }
  for (const role of ['Manager', 'Marketer', 'Analyst', 'Client']) {
    assert.equal(canReadFullWorkspace(role), false)
    assert.equal(canWriteFullWorkspace(role), false)
  }
})

test('브랜드 스냅샷은 운영 역할만 수정한다', () => {
  for (const role of ['Owner', 'Admin', 'Manager', 'Marketer']) {
    assert.equal(canWriteBrandWorkspace(role), true)
  }
  assert.equal(canWriteBrandWorkspace('Analyst'), false)
  assert.equal(canWriteBrandWorkspace('Client'), false)
})

test('브랜드 ID를 문자열로 정규화하고 중복을 제거한다', () => {
  assert.deepEqual(normalizeBrandIds([201, '201', ' 202 ', '', null]), ['201', '202'])
})

test('마지막 Owner는 강등하거나 비활성화할 수 없다', () => {
  const current = { role: 'Owner', status: 'active' }
  assert.throws(
    () => prepareMemberAccessUpdate(current, { role: 'Admin', status: 'active' }, 1),
    /last active workspace owner/i,
  )
  assert.throws(
    () => prepareMemberAccessUpdate(current, { role: 'Owner', status: 'disabled' }, 1),
    /last active workspace owner/i,
  )
})

test('범위형 활성 계정은 최소 한 개 브랜드를 유지한다', () => {
  const current = { role: 'Marketer', status: 'active' }
  assert.throws(
    () => prepareMemberAccessUpdate(current, { role: 'Analyst', brandIds: [] }, 2),
    /at least one brand/i,
  )
  assert.deepEqual(
    prepareMemberAccessUpdate(current, { role: 'Analyst', brandIds: [201, '202'] }, 2),
    { role: 'Analyst', status: 'active', brandIds: ['201', '202'] },
  )
})

