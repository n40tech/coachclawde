import { describe, expect, it } from 'vitest'
import { computeWeightPRs, totalVolumeKg } from './prComputations'
import type { LoggedSession, LoggedSet } from '../types'

function set(weightKg: number, targetReps: string, actualReps?: number): LoggedSet {
  return { setIndex: 0, targetReps, weightKg, actualReps, completed: true, skipped: false }
}

function session(id: string, exercises: { name: string; sets: LoggedSet[] }[]): LoggedSession {
  return {
    id, plannedSessionId: id, date: '2026-11-20', type: 'weights', title: 'Upper', status: 'complete',
    startedAt: '2026-11-20T10:00:00.000Z',
    loggedExercises: exercises.map((e, i) => ({ id: `${id}-${i}`, plannedExerciseId: `${id}-${i}`, name: e.name, sets: e.sets })),
  } as unknown as LoggedSession
}

describe('totalVolumeKg', () => {
  it('counts the target reps of a set ticked with reps left blank', () => {
    const s = session('a', [{ name: 'Bench Press', sets: [set(50, '8'), set(50, '8', 6)] }])
    expect(totalVolumeKg([s])).toBe(50 * 8 + 50 * 6)
  })
})

describe('computeWeightPRs', () => {
  it('treats "Bench Press" and "bench press " as the same lift', () => {
    const prs = computeWeightPRs([
      session('a', [{ name: 'Bench Press', sets: [set(60, '5', 5)] }]),
      session('b', [{ name: 'bench press ', sets: [set(65, '5', 3)] }]),
    ])
    expect(prs).toHaveLength(1)
    expect(prs[0]).toMatchObject({ weightKg: 65, reps: 3 })
  })
})
