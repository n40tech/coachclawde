import type { LoggedSession } from '../types'

export interface WeightPR {
  name: string
  weightKg: number
  reps: number
  date: string
}

export interface CardioPR {
  label: string
  time: string
  seconds: number
  date: string
}

/** Parse a "m:ss", "mm:ss" or "h:mm:ss" duration string into seconds. */
export function parseTimeToSeconds(t: string): number | null {
  const parts = t.trim().split(':').map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n))) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

// --- the set rules -----------------------------------------------------------
// One definition of "a set's reps", "the same lift" and "a better set", used by
// Progress, Best efforts, Workout complete and the plan prompt's history.

/** Reps for a completed set: what was typed, else the target when it's a number. */
export function setReps(set: { actualReps?: number; targetReps: string }): number {
  if (set.actualReps != null) return set.actualReps
  const n = Number(set.targetReps)
  return Number.isNaN(n) ? 0 : n
}

/** A timed hold (a plank): it has a time and no reps, so no volume. */
export function isTimedSet<T extends { actualSeconds?: number; actualReps?: number }>(set: T): set is T & { actualSeconds: number } {
  return set.actualSeconds != null && set.actualReps == null
}

/** Lifts are the same lift whatever their case or stray spaces. */
export function liftKey(name: string): string {
  return name.trim().toLowerCase()
}

/** A better set: heavier, or as heavy with more reps. */
export function isBetterSet(a: { weightKg: number; reps: number }, b: { weightKg: number; reps: number } | null | undefined): boolean {
  return !b || a.weightKg > b.weightKg || (a.weightKg === b.weightKg && a.reps > b.reps)
}

/** Weight × reps over every completed, loaded rep set, in kg. */
export function totalVolumeKg(sessions: LoggedSession[]): number {
  let total = 0
  for (const s of sessions) {
    for (const ex of s.loggedExercises ?? []) {
      for (const set of ex.sets) {
        if (!set.completed || !set.weightKg || isTimedSet(set)) continue
        total += set.weightKg * setReps(set)
      }
    }
  }
  return total
}

/** Heaviest set logged per weights exercise, best first. */
export function computeWeightPRs(sessions: LoggedSession[]): WeightPR[] {
  const best = new Map<string, WeightPR>()
  for (const s of sessions) {
    for (const ex of s.loggedExercises ?? []) {
      for (const set of ex.sets) {
        if (!set.completed || !set.weightKg) continue
        const candidate = { name: ex.name.trim(), weightKg: set.weightKg, reps: setReps(set), date: s.date }
        if (isBetterSet(candidate, best.get(liftKey(ex.name)))) best.set(liftKey(ex.name), candidate)
      }
    }
  }
  return [...best.values()].sort((a, b) => b.weightKg - a.weightKg)
}

/** Fastest recorded time per cardio interval label. */
export function computeCardioPRs(sessions: LoggedSession[]): CardioPR[] {
  const best = new Map<string, CardioPR>()
  for (const s of sessions) {
    for (const iv of s.loggedIntervals ?? []) {
      if (!iv.completed || !iv.actualTime) continue
      const seconds = parseTimeToSeconds(iv.actualTime)
      if (seconds == null) continue
      const current = best.get(iv.label)
      if (!current || seconds < current.seconds) {
        best.set(iv.label, { label: iv.label, time: iv.actualTime, seconds, date: s.date })
      }
    }
  }
  return [...best.values()].sort((a, b) => a.seconds - b.seconds)
}
