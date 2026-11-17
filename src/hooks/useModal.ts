import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Makes a custom overlay behave as a modal for keyboard and screen-reader
 * users, the way `<dialog>.showModal()` would (that isn't used because the
 * top layer escapes `#fixed-layer`; see docs/WEB-AUDIT.md):
 *
 * - focus moves into the panel (give it `tabIndex={-1}`), unless a child
 *   already took it with `autoFocus`;
 * - everything outside the panel is `inert`, so Tab and the screen reader
 *   can't wander behind the backdrop;
 * - Escape calls `onEscape` (only the topmost modal answers it);
 * - on close, focus goes back to whatever had it when the modal opened.
 *
 * Pointer and touch behaviour is unchanged. Focus is never handed back to a
 * text field: on a phone that pops the keyboard up. When the opener is gone
 * (the row was deleted, the bar was replaced), `onOpenerGone` is called so
 * the caller can pick somewhere sensible.
 *
 * Mount the component that calls this only while the modal is open.
 */
export function useModal(
  panel: RefObject<HTMLElement | null>,
  { onEscape, onOpenerGone }: { onEscape?: () => void; onOpenerGone?: () => void } = {},
) {
  // Captured during the first render, before an `autoFocus` child can move focus.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null,
  )
  const handlers = useRef({ onEscape, onOpenerGone })
  useEffect(() => {
    handlers.current = { onEscape, onOpenerGone }
  })

  useEffect(() => {
    const el = panel.current
    if (!el) return
    const entry = { onEscape: () => handlers.current.onEscape?.() }
    openModals.push(entry)
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true })
    const release = inertOutside(el)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || openModals.at(-1) !== entry) return
      e.preventDefault()
      entry.onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openModals.splice(openModals.indexOf(entry), 1)
      release()
      if (!opener?.isConnected) {
        handlers.current.onOpenerGone?.()
        return
      }
      if (!isTextField(opener)) opener.focus({ preventScroll: true })
    }
  }, [panel, opener])
}

const openModals: { onEscape: () => void }[] = []

function isTextField(el: Element) {
  return el.matches('input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=submit]), textarea, select, [contenteditable]')
}

// How many open modals want each element inert. An element is only touched if
// it wasn't already inert for some other reason, and is only released when the
// last modal holding it closes, so overlapping modals can close in any order.
const holds = new WeakMap<HTMLElement, number>()

/**
 * Makes everything outside `keep` inert: the siblings of `keep` and of each of
 * its ancestors up to `<body>` (so `#root`, the other portalled layers, and
 * for a modal nested in another one, the rest of the outer modal). Backdrops
 * (`aria-hidden` siblings) stay live so tapping outside still closes. Returns
 * the undo.
 */
function inertOutside(keep: HTMLElement): () => void {
  const held: HTMLElement[] = []
  for (let node: HTMLElement | null = keep; node && node !== document.body; node = node.parentElement) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue
      if (sibling.getAttribute('aria-hidden') === 'true' || sibling.tagName === 'SCRIPT') continue
      const n = holds.get(sibling)
      if (n === undefined) {
        if (sibling.inert) continue
        sibling.inert = true
      }
      holds.set(sibling, (n ?? 0) + 1)
      held.push(sibling)
    }
  }
  return () => {
    for (const el of held) {
      const n = holds.get(el) ?? 1
      if (n > 1) {
        holds.set(el, n - 1)
      } else {
        holds.delete(el)
        el.inert = false
      }
    }
  }
}
