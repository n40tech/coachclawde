/**
 * The edge swipe back (layout/EdgeSwipeBack): a drag from the screen's left
 * edge slides the page away and runs the page's own Back, like iOS, but
 * drawn by the app so it matches its other transitions.
 *
 * Pages opt in through their header's Back button (PageHeader registers its
 * action here), so the gesture does exactly what that button does, and tab
 * screens with no Back leave the edge alone.
 */

let current: (() => void) | null = null

/** Makes `action` what the edge swipe does. Returns the unregister function. */
export function setBackAction(action: () => void): () => void {
  current = action
  return () => {
    if (current === action) current = null
  }
}

/** What the edge swipe would do on this screen, if anything. */
export function backAction(): (() => void) | null {
  return current
}

/** How close to the screen's left edge (px) a swipe back must start. */
export const EDGE = 24

/**
 * Whether a released swipe goes back: past a third of the screen, or a quick
 * flick. `dx` is how far it moved right, over `ms`, on a screen `width` wide.
 */
export function backSwipeCommits(dx: number, ms: number, width: number): boolean {
  if (dx >= width / 3) return true
  return dx >= 40 && dx / Math.max(ms, 1) >= 0.4
}
