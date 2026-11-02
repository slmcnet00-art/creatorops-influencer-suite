const dialogs = new WeakMap()
const selector = 'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"],iframe'
const controls = dialog => [...dialog.querySelectorAll(selector)].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length)

export function bindDialogKeyboard(dialog, onClose) {
  const doc = dialog.ownerDocument, previous = doc.activeElement
  let state = dialogs.get(doc)
  if (!state) {
    state = { stack: [], handler(event) {
      if (event.defaultPrevented || event.isComposing) return
      const top = state.stack.at(-1)
      if (!top) return
      if (event.key === 'Escape') { event.preventDefault(); top.onClose(); return }
      if (event.key !== 'Tab') return
      const items = controls(top.dialog), first = items[0], last = items.at(-1), active = doc.activeElement
      if (!first) { event.preventDefault(); top.dialog.focus(); return }
      if (!top.dialog.contains(active) || active === top.dialog || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus()
      }
    } }
    dialogs.set(doc, state); doc.addEventListener('keydown', state.handler)
  }
  const entry = { dialog, onClose }; state.stack.push(entry)
  ;(controls(dialog)[0] || dialog).focus()
  return () => {
    const index = state.stack.indexOf(entry)
    if (index < 0) return
    const wasTop = index === state.stack.length - 1
    state.stack.splice(index, 1)
    if (!state.stack.length) { doc.removeEventListener('keydown', state.handler); dialogs.delete(doc) }
    if (wasTop && previous?.isConnected) previous.focus()
  }
}
