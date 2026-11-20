import type { LoggedSession } from '../types'

/** A lift that beat everything logged for that exercise before this session. */
export interface NewPB {
  name: string
  weightKg: number
  reps: number
  /** The previous best weight, for "up from …". */
  previousKg: number
}

export interface WorkoutSummary {
  title: string
  date: string
  /** Start to finish, in seconds (0 when unknown). */
  durationSeconds: number
  /** Sum of weight × reps over completed sets, in kg. */
  totalVolumeKg: number
  /** Exercises with at least one completed set. */
  exercises: number
  /** Completed sets. */
  sets: number
  /** Total reps over completed rep sets. */
  reps: number
  pbs: NewPB[]
  /** Each exercise with a completed set, in the order done: sets and best set. */
  lines: { name: string; sets: number; bestKg?: number; bestReps: number; seconds?: number }[]
}

const key = (name: string) => name.trim().toLowerCase()

/** Reps for a completed set: what was typed, else the target when it's a number. */
function repsOf(set: { actualReps?: number; targetReps: string }): number {
  if (set.actualReps != null) return set.actualReps
  const n = Number(set.targetReps)
  return Number.isNaN(n) ? 0 : n
}

/**
 * The "workout complete" breakdown. A PB is the heaviest completed set of an
 * exercise beating the heaviest of every earlier completed session (matched
 * by name, case-insensitive), so a first-ever exercise isn't counted.
 */
export function summarizeWorkout(session: LoggedSession, history: LoggedSession[], finishedAt: Date = new Date()): WorkoutSummary {
  let totalVolumeKg = 0
  let sets = 0
  let reps = 0
  let exercises = 0
  const bestHere = new Map<string, { name: string; weightKg: number; reps: number }>()
  const lines: WorkoutSummary['lines'] = []

  for (const ex of session.loggedExercises ?? []) {
    const done = ex.sets.filter((s) => s.completed)
    if (done.length) {
      exercises++
      // Best set: heaviest, then most reps; a hold's longest time.
      const line: WorkoutSummary['lines'][number] = { name: ex.name, sets: done.length, bestReps: 0 }
      for (const set of done) {
        if (set.actualSeconds != null && set.actualReps == null) {
          line.seconds = Math.max(line.seconds ?? 0, set.actualSeconds)
          continue
        }
        const r = repsOf(set)
        const kg = set.weightKg ?? 0
        if (kg > (line.bestKg ?? 0) || (kg === (line.bestKg ?? 0) && r > line.bestReps)) {
          line.bestKg = kg || undefined
          line.bestReps = r
        }
      }
      lines.push(line)
    }
    for (const set of done) {
      sets++
      if (set.actualSeconds != null && set.actualReps == null) continue // timed hold
      const r = repsOf(set)
      reps += r
      if (set.weightKg) {
        totalVolumeKg += set.weightKg * r
        const cur = bestHere.get(key(ex.name))
        if (!cur || set.weightKg > cur.weightKg || (set.weightKg === cur.weightKg && r > cur.reps)) {
          bestHere.set(key(ex.name), { name: ex.name, weightKg: set.weightKg, reps: r })
        }
      }
    }
  }

  const bestBefore = new Map<string, number>()
  for (const s of history) {
    if (s.id === session.id || s.status !== 'complete') continue
    for (const ex of s.loggedExercises ?? []) {
      for (const set of ex.sets) {
        if (!set.completed || !set.weightKg) continue
        const k = key(ex.name)
        bestBefore.set(k, Math.max(bestBefore.get(k) ?? 0, set.weightKg))
      }
    }
  }

  const pbs: NewPB[] = []
  for (const [k, best] of bestHere) {
    const prev = bestBefore.get(k)
    if (prev != null && best.weightKg > prev) pbs.push({ ...best, previousKg: prev })
  }
  pbs.sort((a, b) => b.weightKg - a.weightKg)

  const start = Date.parse(session.startedAt)
  const end = session.completedAt ? Date.parse(session.completedAt) : finishedAt.getTime()
  const durationSeconds = Number.isNaN(start) || end < start ? 0 : Math.round((end - start) / 1000)

  return {
    title: session.title,
    date: session.date,
    durationSeconds,
    totalVolumeKg: Math.round(totalVolumeKg),
    exercises,
    sets,
    reps,
    pbs,
    lines,
  }
}

/** "1 h 05 m" or "42 m". */
export function formatWorkoutTime(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 1) return '<1 m'
  if (m < 60) return `${m} m`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`
}
