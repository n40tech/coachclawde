import type { LoggedExercise } from '../types'

/** True once any set of the exercise is ticked. */
export const isStarted = (ex: LoggedExercise) => ex.sets.some((s) => s.completed)

/** The exercises in the order of `ids` (unknown ids ignored, missing ones kept at the end). */
export function reorderByIds(exercises: LoggedExercise[], ids: string[]): LoggedExercise[] {
  const byId = new Map(exercises.map((e) => [e.plannedExerciseId, e]))
  const out = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  return [...out, ...exercises.filter((e) => !ids.includes(e.plannedExerciseId))]
}

/**
 * The athlete started the exercise at `idx` before ones listed ahead of it:
 * move it up to sit just after the exercises already started, so the list
 * follows the order they're actually being done in. A no-op once it's started
 * or when nothing unstarted is ahead of it.
 */
export function promoteStarted(exercises: LoggedExercise[], idx: number): LoggedExercise[] {
  const ex = exercises[idx]
  if (!ex || isStarted(ex)) return exercises
  const target = exercises.findIndex((e, i) => i < idx && !isStarted(e))
  if (target === -1) return exercises
  const next = [...exercises]
  next.splice(idx, 1)
  next.splice(target, 0, ex)
  return next
}

/**
 * The set to time next: the first open set of the preferred exercise (the
 * one being worked on), else the first open set in list order.
 */
export function nextOpenSet(exercises: LoggedExercise[], preferIdx: number): { exerciseIdx: number; setIndex: number } | null {
  const open = (ex: LoggedExercise | undefined) => ex?.sets.findIndex((s) => !s.completed && !s.skipped) ?? -1
  const preferred = open(exercises[preferIdx])
  if (preferred >= 0) return { exerciseIdx: preferIdx, setIndex: preferred }
  for (let i = 0; i < exercises.length; i++) {
    const s = open(exercises[i])
    if (s >= 0) return { exerciseIdx: i, setIndex: s }
  }
  return null
}
