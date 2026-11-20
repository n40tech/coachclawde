import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { DRAG_SLOP, swipeCommits } from '../lib/swipe'

/**
 * A horizontal drag in one direction (+1 right, -1 left), with pointer events
 * so touch and mouse both work. `dx` follows the finger (only in `dir`, 0 the
 * other way) while dragging. A release that `swipeCommits` calls `onCommit`;
 * anything else springs back. Once a press has moved past the slop, the click
 * that follows is swallowed, so a drag never also counts as a tap.
 *
 * Give the element `touch-action: pan-y` so vertical scrolling still works.
 */
export function useHorizontalDrag(dir: 1 | -1, onCommit: () => void) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; t: number; id: number } | null>(null)
  const moved = useRef(false)

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.button !== 0) return
    start.current = { x: e.clientX, t: performance.now(), id: e.pointerId }
    moved.current = false
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const raw = e.clientX - s.x
    if (!moved.current) {
      if (Math.abs(raw) < DRAG_SLOP) return
      moved.current = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDx(raw * dir > 0 ? raw : 0)
  }

  function end(e: PointerEvent<HTMLElement>, cancelled: boolean) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    const raw = e.clientX - s.x
    setDragging(false)
    if (moved.current && !cancelled && swipeCommits(raw, performance.now() - s.t, dir)) {
      onCommit()
      return
    }
    setDx(0)
  }

  return {
    dx,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLElement>) => end(e, false),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, true),
      // Capture phase: stops the tap handlers of buttons inside, after a drag.
      onClickCapture: (e: MouseEvent<HTMLElement>) => {
        if (!moved.current) return
        moved.current = false
        e.stopPropagation()
        e.preventDefault()
      },
    },
  }
}
