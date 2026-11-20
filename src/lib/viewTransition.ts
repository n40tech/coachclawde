import { flushSync } from 'react-dom'

/**
 * Runs a navigation inside a same-document view transition, so elements that
 * share a `view-transition-name` morph between the screens (the workout
 * timer bar shrinking into the Home dock circle and back).
 *
 * `update` may be async: `navigate(-1)` only changes the page once the
 * browser's popstate arrives, so it resolves after that render.
 * Falls back to a plain update where view transitions aren't supported or
 * reduced motion is on.
 */
export function withViewTransition(update: () => void | Promise<void>): void {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (typeof document === 'undefined' || !document.startViewTransition || reduce) {
    void update()
    return
  }
  const root = document.documentElement
  // Entrance animations would freeze in the snapshots (index.css).
  root.setAttribute('data-vt', '')
  const t = document.startViewTransition(async () => {
    let result: void | Promise<void> = undefined
    flushSync(() => { result = update() })
    await result
  })
  t.finished.finally(() => {
    root.removeAttribute('data-vt')
    focusNewScreen()
  })
}

/**
 * Navigates back and resolves once the new screen has rendered: popstate is
 * async, and React Router renders on it.
 */
export function afterPopstate(go: () => void): Promise<void> {
  return new Promise((resolve) => {
    const done = () => requestAnimationFrame(() => resolve())
    window.addEventListener('popstate', done, { once: true })
    // Never hang the transition if no popstate comes.
    setTimeout(resolve, 400)
    go()
  })
}

/**
 * The control that started the navigation is gone (the bar or the dock), so
 * focus would be lost: move it to the new screen's heading.
 */
function focusNewScreen() {
  const active = document.activeElement
  if (active && active !== document.body && active.isConnected) return
  const heading = document.querySelector<HTMLElement>('#root h1')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
}
