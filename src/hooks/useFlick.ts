import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { DRAG_SLOP, axisOf, dirAlong, dragAxis, flickCommits, type Axis, type FlickDir } from '../lib/swipe'

/**
 * Drag-and-flick on one element, in any of four directions, with pointer
 * events so touch and mouse both work. Once a press has moved past the slop
 * it locks to the axis it moved most on; a drag along an axis with no action
 * is left alone. While dragging, `x` / `y` follow the finger, but only in a
 * direction that has an action (0 otherwise). A release that `flickCommits`
 * runs that direction's action (the offset stays put, as the element is on
 * its way out); anything else springs back. A drag never also counts as a
 * tap: the click that follows it is swallowed.
 *
 * Give the element `touch-action: none` if it has an up or down action, or
 * `pan-y` if it only has left or right ones, so scrolling still works.
 */
export function useFlick(actions: Partial<Record<FlickDir, () => void>>) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const axis = useRef<Axis | null>(null)
  const moved = useRef(false)
  const allowed = (Object.keys(actions) as FlickDir[]).filter((d) => actions[d])

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
    axis.current = null
    moved.current = false
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!moved.current) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return
      const a = dragAxis(dx, dy)
      // Nothing to do this way: let the browser have it (a scroll).
      if (!allowed.some((d) => axisOf(d) === a)) {
        start.current = null
        return
      }
      axis.current = a
      moved.current = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const a = axis.current!
    const d = a === 'x' ? dx : dy
    const v = allowed.includes(dirAlong(a, d)) ? d : 0
    setOffset(a === 'x' ? { x: v, y: 0 } : { x: 0, y: v })
  }

  function end(e: PointerEvent<HTMLElement>, cancelled: boolean) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    setDragging(false)
    const a = axis.current
    if (moved.current && a && !cancelled) {
      const d = a === 'x' ? e.clientX - s.x : e.clientY - s.y
      const dir = flickCommits(a, d, performance.now() - s.t, allowed)
      if (dir) {
        actions[dir]?.()
        return
      }
    }
    setOffset({ x: 0, y: 0 })
  }

  return {
    x: offset.x,
    y: offset.y,
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
