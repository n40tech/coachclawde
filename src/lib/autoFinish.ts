import type { LoggedExercise } from '../types'
import { nextOpenSet } from './exerciseOrder'

/**
 * Auto-finish (Settings → Beta features). When a rest ends the next set is
 * under way. Taps in the first few seconds are the athlete settling in
 * (checking the weight, reading the next exercise), so they're ignored. After
 * that, the next tap is most likely them coming back with the set done: it
 * finishes the set (an orange, unconfirmed tick) and starts the next rest.
 * They can still fix reps and weight and tap the tick to confirm.
 */
export const AUTO_FINISH_GRACE_MS = 15_000

export function graceOver(startedAt: number, now: number): boolean {
  return now - startedAt >= AUTO_FINISH_GRACE_MS
}

export interface Touch {
  /** Index of the exercise tile touched, if any. */
  exerciseIdx?: number
  /** Index of the set row touched, if any. */
  setIndex?: number
}

/**
 * The set a tap finishes: the open set it touched, else the next open one
 * (preferring the exercise in progress). Null when nothing is left.
 */
export function autoFinishTarget(
  exercises: LoggedExercise[],
  touch: Touch,
  preferIdx: number,
): { exerciseIdx: number; setIndex: number } | null {
  const { exerciseIdx: e, setIndex: i } = touch
  if (e != null && i != null) {
    const set = exercises[e]?.sets[i]
    if (set && !set.completed && !set.skipped) return { exerciseIdx: e, setIndex: i }
  }
  return nextOpenSet(exercises, e ?? preferIdx)
}
