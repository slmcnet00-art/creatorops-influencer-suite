import { useEffect, useRef } from 'react'
import { bindDialogKeyboard } from './dialogKeyboard.js'

export default function useDialogKeyboard(onClose) {
  const ref = useRef(null), close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => bindDialogKeyboard(ref.current, () => close.current()), [])
  return ref
}
