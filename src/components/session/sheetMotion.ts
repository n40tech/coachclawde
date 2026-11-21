import { createContext } from 'react'

/**
 * What the workout sheet shares with the rest timer bar, so the two move
 * together: squeezing the bar slides the sheet down, and pulling the sheet
 * down squeezes the bar into the dock circle.
 */
export interface SheetMotion {
  /** 0 = open, 1 = gone: how far the sheet has been pulled down. */
  progress: number
  /** A finger is on it (no easing). */
  dragging: boolean
  /** The timer bar's squeeze, 0–1, while it's being dragged; null on release. */
  follow: (progress: number | null) => void
  /** Slides the sheet away and closes the workout. */
  dismiss: () => void
}

export const SheetContext = createContext<SheetMotion | null>(null)
