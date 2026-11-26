import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('NUM-6: Korean spreadsheet headers reach saved tracking metrics', async () => {
  let workspace = { campaigns: [{ id: 1, name: 'campaign' }], creators: [], trackedPosts: [] }
  const payload = { '콘텐츠 URL': 'https://www.youtube.com/watch?v=test', '조회수': 12345, '좋아요': 678, '댓글': 90, '공유': 12, '저장': 34 }
  let serial = 100
  const context = vm.createContext({ readSpreadsheet: async () => [], buildExternalRowsFromSheet: () => [{ payload, rowIndex: 1 }], BULK_TRACKING_RAW_SOURCE_ID: 'raw', activeBrand: { category: 'beauty' }, selectedCampaign: { id: 1 }, createId: () => ++serial, deriveHandleFromUrl: () => '@test', inferPlatformFromUrl: () => 'YouTube', nowLabel: () => 'now', dedupeExternalReportRows: rows => rows, attachContentUrlToUtmLogs: rows => rows, appendActivity: current => current, updateWorkspace: updater => { workspace = updater(workspace) }, setDataRoomImportStatus() {}, showToast() {} })
  vm.runInContext(source.slice(source.indexOf('function normalizeRawKey('), source.indexOf('const REPORT_URL_ALIASES')), context)
  vm.runInContext(source.slice(source.indexOf('  const handleTrackingBulkUpload ='), source.indexOf('  const downloadCreatorGroupBulkTemplate =')) + '; this.upload = handleTrackingBulkUpload', context)
  await context.upload({ target: { files: [{ name: '한글.xlsx' }], value: '' } })
  assert.equal(workspace.trackedPosts.length, 1)
  for (const [key, expected] of Object.entries({ views: 12345, likes: 678, comments: 90, shares: 12, saves: 34 })) assert.equal(workspace.trackedPosts[0][key], expected)
})

test('NUM-6: confirmed response and recruitment statuses appear in timeline', () => {
  const context = vm.createContext({})
  vm.runInContext(source.slice(source.indexOf('function buildOutreachTimeline('), source.indexOf('function normalizeCreator(')), context)
  assert.ok(context.buildOutreachTimeline({ status: '응답' }).some(row => row.label === '응답 확인'))
  assert.ok(context.buildOutreachTimeline({ status: '섭외 완료' }).some(row => row.label === '섭외 완료'))
})
