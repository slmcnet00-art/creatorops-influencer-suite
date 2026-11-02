import test from 'node:test'
import assert from 'node:assert/strict'
import { bindDialogKeyboard } from '../src/dialogKeyboard.js'

function fixture() {
  const listeners = new Map(), doc = { activeElement: null, addEventListener: (n, fn) => listeners.set(n, fn), removeEventListener: n => listeners.delete(n) }
  const make = () => ({ isConnected: true, tabIndex: 0, getClientRects: () => [1], focus() { doc.activeElement = this } })
  const trigger = make(), first = make(), last = make(), dialog = make()
  dialog.ownerDocument = doc; dialog.querySelectorAll = () => [first, last]; dialog.contains = n => [dialog, first, last].includes(n)
  doc.activeElement = trigger
  let closed = 0
  const cleanup = bindDialogKeyboard(dialog, () => closed++)
  const key = (key, extra = {}) => { const e = { key, preventDefault() { this.defaultPrevented = true }, ...extra }; listeners.get('keydown')?.(e); return e }
  return { doc, trigger, first, last, dialog, cleanup, key, get closed() { return closed }, listeners }
}
test('팝업이 열리면 포커스를 내부로 옮기고 Escape로 닫으며 정리 후 원래 버튼으로 복귀한다', () => {
  const f = fixture(); assert.equal(f.doc.activeElement, f.first)
  assert.equal(f.key('Escape').defaultPrevented, true); assert.equal(f.closed, 1)
  f.cleanup(); assert.equal(f.doc.activeElement, f.trigger); assert.equal(f.listeners.size, 0)
})
test('Tab과 Shift+Tab은 열린 팝업의 처음과 끝에서 순환한다', () => {
  const f = fixture()
  f.key('Tab', { shiftKey: true }); assert.equal(f.doc.activeElement, f.last)
  f.key('Tab'); assert.equal(f.doc.activeElement, f.first)
  f.doc.activeElement = f.trigger; f.key('Tab'); assert.equal(f.doc.activeElement, f.first)
  f.cleanup()
})
test('한글 조합 중 Escape 또는 내부 컨트롤이 소비한 키로 팝업을 닫지 않는다', () => {
  const f = fixture(); f.key('Escape', { isComposing: true }); f.key('Escape', { defaultPrevented: true }); assert.equal(f.closed, 0); f.cleanup()
})
test('중첩 팝업에서는 맨 위만 처리하고 사라진 트리거로 포커스를 돌리지 않는다', () => {
  const f = fixture(), inner = { ...f.dialog, querySelectorAll: () => [f.last] }
  let innerClosed = 0; const cleanup = bindDialogKeyboard(inner, () => innerClosed++)
  f.key('Escape'); assert.equal(innerClosed, 1); assert.equal(f.closed, 0)
  cleanup(); f.key('Escape'); assert.equal(f.closed, 1)
  f.trigger.isConnected = false; f.cleanup(); assert.notEqual(f.doc.activeElement, f.trigger)
})
