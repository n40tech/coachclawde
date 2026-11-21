/**
 * Drag and flick gestures on the workout timer: drag the Home dock circle
 * right (or flick it up) to open the workout, flick the workout's timer bar
 * left to go Home, flick the timer up to maximise it and down to minimise it.
 */

export type FlickDir = 'left' | 'right' | 'up' | 'down'
export type Axis = 'x' | 'y'

export const axisOf = (dir: FlickDir): Axis => (dir === 'left' || dir === 'right' ? 'x' : 'y')
const sign = (dir: FlickDir): 1 | -1 => (dir === 'right' || dir === 'down' ? 1 : -1)

/** The axis a drag that has passed the slop is locked to: whichever moved more. */
export function dragAxis(dx: number, dy: number): Axis {
  return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
}

/** The way a drag along `axis` is heading: `d` is its movement on that axis. */
export function dirAlong(axis: Axis, d: number): FlickDir {
  return axis === 'x' ? (d >= 0 ? 'right' : 'left') : (d >= 0 ? 'down' : 'up')
}

/**
 * Which of the `allowed` directions a released drag acts on, if any. `d` is
 * its movement along the locked `axis`, over `ms` milliseconds.
 */
export function flickCommits(axis: Axis, d: number, ms: number, allowed: readonly FlickDir[]): FlickDir | null {
  const dir = dirAlong(axis, d)
  return allowed.includes(dir) && swipeCommits(d, ms, sign(dir)) ? dir : null
}

/** Movement (px) before a press counts as a drag rather than a tap. */
export const DRAG_SLOP = 8

/**
 * Whether a released drag should act. `dir` is +1 for rightward, -1 for
 * leftward. A long enough drag acts; so does a short, fast flick.
 */
export function swipeCommits(dx: number, ms: number, dir: 1 | -1): boolean {
  const along = dx * dir
  if (along >= 64) return true
  const speed = along / Math.max(ms, 1) // px per ms
  return along >= 16 && speed >= 0.3
}

/** Drag distance with resistance past `limit`, so it never runs off. */
export function rubberBand(dx: number, limit: number): number {
  const a = Math.abs(dx)
  if (a <= limit) return dx
  return Math.sign(dx) * (limit + (a - limit) * 0.25)
}
