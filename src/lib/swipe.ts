/**
 * Horizontal drag gestures on the workout timer: drag the Home dock circle
 * right to open the workout, flick the workout's timer bar left to go Home.
 */

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
