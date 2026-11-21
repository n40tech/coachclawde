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
  // After an edge swipe back the page has already slid away (EdgeSwipeBack).
  const swiped = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-swipe-back')
  if (typeof document === 'undefined' || !document.startViewTransition || reduce || swiped) {
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
  t.finished
    .catch(() => {})
    .finally(() => {
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
 * After a navigation, if the control that started it is gone (a card on the
 * old screen, the bar or the dock), focus would be lost to the page: move it
 * to the new screen's heading, which also tells a screen reader where it
 * landed. Returns false when there's no heading yet (a page still loading).
 * Focus that's still on a live control (a tab in the tab bar) stays put.
 */
export function focusNewScreen(): boolean {
  const active = document.activeElement
  if (active && active !== document.body && active.isConnected) return true
  // A modal that opened with the screen (What's new) owns focus.
  if (document.querySelector('[aria-modal="true"]')) return true
  const heading = document.querySelector<HTMLElement>('#root h1')
  if (!heading) return false
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
  return true
}

/** Smooth scrolling, unless the athlete asked for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}
