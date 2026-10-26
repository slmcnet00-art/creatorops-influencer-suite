import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { aggregateEngagement } from '../src/performanceMetrics.js'

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const flush = () => new Promise(resolve => setImmediate(resolve))

function hydrationHarness(load) {
  const marker = source.indexOf('async function hydrateCloudWorkspace()')
  const start = source.lastIndexOf('  useEffect(() => {', marker)
  const end = source.indexOf('\n\n  useEffect(', marker)
  const state = { loaded: null, workspace: null, status: null }
  let registered
  const context = {
    authSession: null,
    backendConfig: { hasSupabase: true, workspaceId: 'test' },
    cloudHydratedUserRef: { current: '' },
    cloudVersionRef: { current: '' },
    skipNextCloudSaveRef: { current: false },
    loadCloudWorkspace: load,
    normalizeWorkspace: value => value,
    setWorkspace: value => { state.workspace = value },
    setCloudWorkspaceLoaded: value => { state.loaded = value },
    setCloudSyncStatus: value => { state.status = value },
    useEffect: (effect, dependencies) => { registered = { effect, dependencies } },
  }
  return { state, context, render(session) {
    context.authSession = session
    vm.runInNewContext(source.slice(start, end), context)
    return registered
  } }
}

test('비로그인 후 로그인하면 해당 계정의 DB 버전을 먼저 불러온다', async () => {
  let calls = 0
  const h = hydrationHarness(async () => { calls++; return { workspace: { remote: true }, updatedAt: 'version-1' } })
  const anonymous = h.render(null)
  anonymous.effect()
  await flush()
  assert.equal(calls, 0)
  assert.equal(h.state.loaded, false)
  const loggedIn = h.render({ user: { id: 'admin' } })
  assert.notDeepEqual([...anonymous.dependencies], [...loggedIn.dependencies])
  loggedIn.effect()
  assert.equal(h.context.cloudHydratedUserRef.current, '')
  assert.equal(h.state.loaded, false)
  await flush()
  assert.equal(calls, 1)
  assert.equal(h.context.cloudHydratedUserRef.current, 'admin')
  assert.equal(h.context.cloudVersionRef.current, 'version-1')
  assert.equal(h.state.loaded, true)
  assert.deepEqual(h.state.workspace, { remote: true })
})

test('DB 로드 실패나 접근 거부 상태에서는 저장 준비 상태로 전환하지 않는다', async () => {
  for (const load of [async () => ({ status: 'forbidden' }), async () => { throw new Error('offline') }]) {
    const h = hydrationHarness(load)
    h.render({ user: { id: 'admin' } }).effect()
    await flush()
    assert.equal(h.state.loaded, false)
    assert.equal(h.context.cloudHydratedUserRef.current, '')
  }
})

test('취소된 이전 로그인 조회 결과는 최신 계정 데이터를 덮어쓰지 않는다', async () => {
  let resolve
  const h = hydrationHarness(() => new Promise(done => { resolve = done }))
  const cleanup = h.render({ user: { id: 'old' } }).effect()
  cleanup()
  resolve({ workspace: { old: true }, updatedAt: 'old-version' })
  await flush()
  assert.equal(h.state.workspace, null)
  assert.equal(h.context.cloudHydratedUserRef.current, '')
})

test('학습 참여율도 여러 콘텐츠의 조회수와 실제 반응 수로 가중 집계한다', () => {
  const start = source.indexOf('function buildCreatorPerformanceLearningMap(')
  const end = source.indexOf('\nfunction attachPerformanceLearning(', start)
  const build = vm.runInNewContext(`(${source.slice(start, end)})`, {
    getCreatorMatchKeys: () => [], getPerformanceRowMatchKeys: () => [], aggregateEngagement,
  })
  const rows = [
    { creatorId: 1, views: 1000, likes: 100, engagementRate: 99 },
    { creatorId: 1, views: 9000, likes: 450, engagementRate: 99 },
  ]
  const learning = build([{ id: 1 }], rows, []).get(1)
  assert.equal(learning.engagementRate, 5.5)
  assert.equal(learning.engagementRate, aggregateEngagement(rows))
})
