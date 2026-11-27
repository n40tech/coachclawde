import { describe, expect, it } from 'vitest'
import { formatElapsed, formatVolumeCompact, formatWorkoutTime, summarizeWorkout } from './workoutSummary'
import type { LoggedSession } from '../types'

function log(id: string, sets: { name: string; kg?: number; reps?: number; done?: boolean; secs?: number }[], extra: Partial<LoggedSession> = {}): LoggedSession {
  const exercises: NonNullable<LoggedSession['loggedExercises']> = []
  for (const s of sets) {
    let ex = exercises.find((e) => e.name === s.name)
    if (!ex) {
      ex = { plannedExerciseId: s.name, name: s.name, sets: [] }
      exercises.push(ex)
    }
    ex.sets.push({ setIndex: ex.sets.length, targetReps: '8', actualReps: s.reps, weightKg: s.kg, actualSeconds: s.secs, completed: s.done ?? true, skipped: false })
  }
  return {
    id, plannedSessionId: id, weekPlanId: 'w', date: '2026-11-16', type: 'weights', title: 'Upper', focus: '',
    startedAt: '2026-11-16T10:00:00.000Z', completedAt: '2026-11-16T11:05:00.000Z', status: 'complete',
    loggedExercises: exercises, ...extra,
  }
}

describe('summarizeWorkout', () => {
  it('totals volume, sets, reps and exercises from completed sets only', () => {
    const s = log('a', [
      { name: 'Bench Press', kg: 60, reps: 8 },
      { name: 'Bench Press', kg: 60, reps: 6 },
      { name: 'Bench Press', kg: 60, reps: 6, done: false },
      { name: 'Plank', secs: 45 },
      { name: 'Row', done: false },
    ])
    const r = summarizeWorkout(s, [])
    expect(r.totalVolumeKg).toBe(840)
    expect(r.sets).toBe(3)
    expect(r.reps).toBe(14)
    expect(r.exercises).toBe(2)
    expect(r.durationSeconds).toBe(65 * 60)
    expect(r.finishedAt).toBe('2026-11-16T11:05:00.000Z')
    expect(r.lines).toEqual([
      { name: 'Bench Press', sets: 2, bestKg: 60, bestReps: 8 },
      { name: 'Plank', sets: 1, bestReps: 0, seconds: 45 },
    ])
  })

  it('counts a PB only when it beats an earlier session, matched case-insensitively', () => {
    const before = log('old', [{ name: 'bench press', kg: 60, reps: 5 }, { name: 'Squat', kg: 100, reps: 5 }])
    const now = log('new', [
      { name: 'Bench Press', kg: 62.5, reps: 5 },
      { name: 'Squat', kg: 100, reps: 8 },
      { name: 'Curl', kg: 15, reps: 10 },
    ])
    const r = summarizeWorkout(now, [before, now])
    expect(r.pbs).toEqual([{ name: 'Bench Press', weightKg: 62.5, reps: 5, previousKg: 60 }])
  })

  it('ignores unfinished earlier sessions', () => {
    const before = log('old', [{ name: 'Squat', kg: 120, reps: 5 }], { status: 'in-progress' })
    const now = log('new', [{ name: 'Squat', kg: 110, reps: 5 }])
    expect(summarizeWorkout(now, [before]).pbs).toEqual([])
  })
})

describe('formatWorkoutTime', () => {
  it('formats minutes and hours', () => {
    expect(formatWorkoutTime(20)).toBe('<1 m')
    expect(formatWorkoutTime(42 * 60)).toBe('42 m')
    expect(formatWorkoutTime(65 * 60)).toBe('1 h 05 m')
  })
})

describe('formatVolumeCompact', () => {
  it('stays short enough for the stats column', () => {
    expect(formatVolumeCompact(850, 'kg')).toBe('850kg')
    expect(formatVolumeCompact(1500, 'kg')).toBe('1.5t')
    expect(formatVolumeCompact(12000, 'kg')).toBe('12t')
    expect(formatVolumeCompact(1500, 'lb')).toBe('3.3klb')
  })
})

describe('formatElapsed', () => {
  it('reads like a stopwatch', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(247)).toBe('4:07')
    expect(formatElapsed(52 * 60 + 13)).toBe('52:13')
    expect(formatElapsed(3909)).toBe('1:05:09')
  })

  it('runs from Start Session to the moment Complete was tapped', () => {
    const s = { id: 'x', plannedSessionId: 'x', weekPlanId: 'w', date: '2026-11-16', type: 'weights' as const, title: 'T', focus: '',
      startedAt: '2026-11-16T10:00:00.000Z', status: 'in-progress' as const, loggedExercises: [] }
    expect(summarizeWorkout(s, [], new Date('2026-11-16T10:48:30.000Z')).durationSeconds).toBe(48 * 60 + 30)
  })
})
