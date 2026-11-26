import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

test('large creator pools keep the screen data and show a warning when browser storage is full', async () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const callbacks = [], changes = []
  let serial = 0
  const context = vm.createContext({ normalizeWorkspace: value => value, useState: initial => { const id = serial++; return [typeof initial === 'function' ? initial() : initial, value => changes.push({ id, value })] }, useEffect: callback => callbacks.push(callback), queueMicrotask,
    window: { localStorage: { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } } } })
  vm.runInContext(source.slice(source.indexOf('function usePersistentState('), source.indexOf('function nowLabel(')), context)
  const [workspace] = context.usePersistentState('workspace', { creators: [{ id: 1 }] })
  callbacks[0]()
  await new Promise(resolve => queueMicrotask(resolve))
  assert.equal(workspace.creators[0].id, 1)
  assert.ok(changes.some(change => change.id === 1 && change.value.includes('저장 공간')))
})
