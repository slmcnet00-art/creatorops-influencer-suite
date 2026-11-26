import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
function exportRows(prices) {
  const creators = prices.map((price, id) => ({ id, price, platform: 'Instagram', name: 'creator', followers: 100, averageViews: 200 }))
  const context = vm.createContext({ creators, selectedCampaign: {}, brandBrief: {}, activeBrand: { name: 'brand' }, activeRecruitedPool: [], brandCampaigns: [], filteredCreators: creators, selectedCampaignRecommendations: creators.map(c => ({ creatorId: c.id })), getCreatorProfileUrl: () => '', getRecommendedContactChannelId: () => '', normalizeHandleSegment: () => '', hasPendingMetrics: () => false })
  vm.runInContext(source.slice(source.indexOf('  const buildAdvertiserListRows ='), source.indexOf('  const sendRowsToGoogleSheets =')) + '; this.rows = buildAdvertiserListRows()', context)
  return context.rows
}
test('NUM-1: unpriced rows show negotiation and do not inflate the sum', () => {
  const rows = exportRows([0, undefined, '0', 100000])
  for (const row of rows.slice(3, 6)) {
    assert.equal(row[7], '협의')
    assert.equal(row[9], '협의')
    assert.equal(row[10], '협의')
  }
  assert.equal(rows[6][7], 10)
  assert.equal(rows.at(-1)[7], 10)
})
