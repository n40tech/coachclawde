import { useEffect, type RefObject } from 'react'
import { EDGE, backAction, backSwipeCommits } from '../../lib/backGesture'
import { DRAG_SLOP } from '../../lib/swipe'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Swipe right from the left edge to go back (lib/backGesture). The page
 * follows the finger; let go past a third of the way, or flick, and it slides
 * off, Back runs, and the page underneath eases in from the left. Otherwise
 * it springs back.
 *
 * Touch events, not pointer events: only a `preventDefault` on touchstart
 * stops iOS Safari starting its own history swipe. Presses that start on a
 * control (the Back button sits near the edge) are left to be taps.
 */
export function EdgeSwipeBack({ target }: { target: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null
    let locked = false
    let busy = false

    const style = (transform: string, transition = 'none', extra: Partial<CSSStyleDeclaration> = {}) => {
      const el = target.current
      if (!el) return
      el.style.transition = transition
      el.style.transform = transform
      Object.assign(el.style, extra)
    }
    const clear = () => {
      const el = target.current
      if (!el) return
      for (const p of ['transition', 'transform', 'boxShadow', 'opacity', 'willChange'] as const) el.style[p] = ''
    }

    function onStart(e: TouchEvent) {
      if (busy || e.touches.length !== 1 || !backAction()) return
      const t = e.touches[0]
      if (t.clientX > EDGE) return
      // A sheet or dialog is open: its own controls rule.
      if (document.querySelector('[aria-modal="true"]')) return
      const el = e.target as Element | null
      if (el?.closest('button, a, input, textarea, select, label, [role="slider"]')) return
      e.preventDefault()
      start = { x: t.clientX, y: t.clientY, t: performance.now() }
      locked = false
    }

    function onMove(e: TouchEvent) {
      if (!start) return
      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (!locked) {
        if (Math.hypot(dx, dy) < DRAG_SLOP) return
        // Mostly vertical: it's a scroll after all.
        if (Math.abs(dy) > Math.abs(dx) || dx < 0) {
          start = null
          return
        }
        locked = true
      }
      e.preventDefault()
      style(`translateX(${Math.max(0, dx)}px)`, 'none', { boxShadow: '-16px 0 32px rgba(0,0,0,0.6)', willChange: 'transform' })
    }

    function onEnd(e: TouchEvent) {
      const s = start
      start = null
      if (!s || !locked) return
      const dx = (e.changedTouches[0]?.clientX ?? s.x) - s.x
      const width = window.innerWidth
      const action = backAction()
      if (e.type === 'touchend' && action && backSwipeCommits(dx, performance.now() - s.t, width)) {
        busy = true
        style(`translateX(${width}px)`, `transform 200ms ${EASE}`)
        window.setTimeout(() => goBack(action), 200)
      } else {
        style('translateX(0)', `transform 250ms ${EASE}`)
        window.setTimeout(clear, 260)
      }
    }

    function goBack(action: () => void) {
      // The page has already left: Back mustn't run its own view transition.
      const root = document.documentElement
      root.setAttribute('data-swipe-back', '')
      action()
      window.setTimeout(() => root.removeAttribute('data-swipe-back'), 500)
      if (reduceMotion()) {
        clear()
        busy = false
        return
      }
      // The screen we've gone back to comes in from a little to the left,
      // as on iOS. History back renders on popstate, a frame or two later.
      style('translateX(-25%)', 'none', { opacity: '0.4', boxShadow: '' })
      window.setTimeout(() => {
        requestAnimationFrame(() => {
          style('translateX(0)', `transform 300ms ${EASE}, opacity 300ms ease-out`, { opacity: '1' })
          window.setTimeout(() => {
            clear()
            busy = false
          }, 320)
        })
      }, 40)
    }

    const opts = { passive: false } as const
    document.addEventListener('touchstart', onStart, opts)
    document.addEventListener('touchmove', onMove, opts)
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
      clear()
    }
  }, [target])
  return null
}
