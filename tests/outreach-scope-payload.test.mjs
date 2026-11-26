import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

test('outreach authorization reads only campaign projections and still rejects inaccessible campaigns', async () => {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
  const selects = []
  const context = vm.createContext({
    WORKSPACE_ID: 'test',
    assertOutreachRole: user => { if (user.role === 'Client') throw Error('role denied') },
    assertCampaignScope: (_user, campaign) => { if (!campaign || campaign.brandId !== 'allowed') throw Error('scope denied') },
    getSupabaseAdminClient: () => ({ from(table) {
      const result = { data: table === 'brand_memberships' ? [] : table === 'brand_scoped_snapshots' ? [{ brand_id: 'allowed', campaigns: [{ id: 'ok' }] }] : { campaigns: [] } }
      const query = { select(fields) { selects.push([table, fields]); return this }, eq() { return this }, in() { return Promise.resolve(result) }, maybeSingle() { return Promise.resolve(result) }, then(resolve) { return Promise.resolve(result).then(resolve) } }
      return query
    } }),
  })
  vm.runInContext(source.slice(source.indexOf('async function assertOutreachCampaigns('), source.indexOf('async function writeAuditLog(')), context)
  await context.assertOutreachCampaigns({ workspaceUser: { id: 'u', role: 'Owner' } }, [])
  assert.equal(selects.length, 0)
  await assert.rejects(context.assertOutreachCampaigns({ workspaceUser: { role: 'Client' } }, []), /role denied/)
  await context.assertOutreachCampaigns({ workspaceUser: { id: 'u', role: 'Owner' } }, [{ campaignId: 'ok' }])
  assert.ok(selects.some(([table, fields]) => table === 'brand_scoped_snapshots' && fields === 'brand_id,campaigns:payload->campaigns'))
  assert.ok(selects.some(([table, fields]) => table === 'workspace_snapshots' && fields === 'campaigns:payload->campaigns'))
  await assert.rejects(context.assertOutreachCampaigns({ workspaceUser: { id: 'u', role: 'Owner' } }, [{ campaignId: 'missing' }]), /scope denied/)
})
