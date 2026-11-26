import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
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

test('SEC-1: authenticated delivery writes are removed and sensitive policies enforce role/brand scope', () => {
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  const migration = readFileSync(new URL('../supabase/migrations/202611260001_sec1_brand_role_rls.sql', import.meta.url), 'utf8')
  const policies = [...sql.matchAll(/create policy "([^"]+)"\s+on public\.(\w+) for (\w+) to authenticated\s+([\s\S]*?);/g)]
  const outreach = policies.filter(([, , table]) => table === 'outreach_messages')
  assert.equal(outreach.length, 1)
  assert.equal(outreach[0][3], 'select')
  assert.match(outreach[0][4], /array\['Owner', 'Admin', 'Manager', 'Marketer'\]/)
  assert.match(migration, /drop policy if exists "Members can write outreach messages"/)
  for (const table of ['creator_contact_points', 'creator_rates']) {
    const write = policies.find(([, , t, action]) => t === table && action === 'all')
    assert.match(write[4], /array\['Owner', 'Admin'\]/)
    assert.ok(policies.some(([, , t, action, body]) => t === table && action === 'select' && body.includes('has_brand_access(workspace_id, brand_id)')))
  }
  for (const table of ['creator_profile_snapshots', 'content_metric_snapshots', 'audience_demographic_snapshots', 'brand_mention_evidence', 'ad_disclosure_evidence', 'creator_quality_signals', 'related_content_edges', 'utm_tracking_rows']) {
    for (const policy of policies.filter(([, , t]) => t === table)) {
      assert.match(policy[4], /has_brand_access\(workspace_id, brand_id/)
      if (policy[3] !== 'select') assert.doesNotMatch(policy[4], /'Client'/)
      assert.ok(migration.includes(policy[0]))
    }
  }
  const frontend = readFileSync(new URL('../src/backendSync.js', import.meta.url), 'utf8')
  assert.doesNotMatch(frontend, /from\(['"]outreach_messages['"]\)/)
})

test('Owner와 Admin은 전체 브랜드와 권한 관리에 접근한다', () => {
  for (const role of ['Owner', 'Admin']) {
    const account = { role, brandIds: [] }
    assert.deepEqual(getAccountBrandIds(account, brands), [201, 202, 203])
    assert.equal(canManageTeamPermissions(account), true)
    assert.equal(canAccessSection(account, 'dataRoom'), false)
  }
})

test('Manager와 Marketer는 배정된 브랜드만 본다', () => {
  const manager = { role: 'Manager', brandIds: [201] }
  const marketer = { role: 'Marketer', brandIds: [202] }
  assert.deepEqual(getAccessibleBrands(manager, brands).map((brand) => brand.id), [201])
  assert.deepEqual(getAccessibleBrands(marketer, brands).map((brand) => brand.id), [202])
  assert.equal(canManageTeamPermissions(manager), false)
  assert.equal(canAccessSection(manager, 'dataRoom'), false)
  assert.equal(canAccessSection(marketer, 'messages'), true)
  assert.equal(canAccessSection(marketer, 'dataRoom'), false)
})

test('Analyst는 리포트만, Client는 승인 화면만 접근한다', () => {
  const analyst = { role: 'Analyst', brandIds: [201, 202] }
  const client = { role: 'Client', brandIds: [201] }
  assert.equal(canAccessSection(analyst, 'report'), true)
  assert.equal(canAccessSection(analyst, 'dataRoom'), false)
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
