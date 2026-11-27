import { describe, expect, it } from 'vitest'
import { workoutStep, type WorkoutContext, type WorkoutEvent } from './activeWorkout'
import { IDLE_TIMER } from './restTimer'
import type { PlannedSession } from '../types'

const planned = {
  id: 's1', date: '2026-11-23', dayOfWeek: 'Mon', type: 'weights', title: 'Upper', focus: 'Upper',
  estimatedMinutes: 45, intensity: 'moderate', warmup: '',
  exercises: [
    { id: 'bench', name: 'Bench Press', sets: [{ reps: '5', restSeconds: 120 }, { reps: '5', restSeconds: 120 }] },
    { id: 'row', name: 'Barbell Row', sets: [{ reps: '8', restSeconds: 90 }] },
  ],
} as PlannedSession

const base: WorkoutContext = { planned, log: null, setClock: null, timer: IDLE_TIMER, now: 1_000_000 }

/** Replays taps from a fresh workout, carrying the log (and the clock it says to start) forward. */
function replay(events: WorkoutEvent[], ctx: Partial<WorkoutContext> = {}) {
  let c: WorkoutContext = { ...base, ...ctx }
  const results = []
  for (const e of events) {
    const r = workoutStep(c, e)
    results.push(r)
    c = { ...c, log: r.log, setClock: r.clock === 'start' ? { sessionId: 's1', startedAt: c.now } : r.clock === 'stop' ? null : c.setClock }
  }
  return results
}

describe('workoutStep', () => {
  it('starts a log with every planned set open', () => {
    const [r] = replay([{ kind: 'start', id: 'log1', weekPlanId: 'p1' }])
    expect(r.log).toMatchObject({ id: 'log1', plannedSessionId: 's1', weekPlanId: 'p1', status: 'in-progress' })
    expect(r.log!.loggedExercises!.map((e) => e.sets.length)).toEqual([2, 1])
  })

  it('labels the rest "Up next: <next exercise>" after the last set of an exercise', () => {
    const r = replay([
      { kind: 'start', id: 'log1', weekPlanId: 'p1' },
      { kind: 'tick', exerciseIdx: 0, setIndex: 0 },
      { kind: 'tick', exerciseIdx: 0, setIndex: 1 },
    ])
    expect(r[1].rest).toEqual({ seconds: 120, label: 'Up next: Bench Press · set 2', nextExerciseId: 'bench' })
    expect(r[2].rest).toEqual({ seconds: 120, label: 'Up next: Barbell Row', nextExerciseId: 'row' })
    expect(r[2].push).toBe(true)
  })

  it('starts no rest when a set is ticked again in a finished workout', () => {
    const [, , , r] = replay([
      { kind: 'start', id: 'log1', weekPlanId: 'p1' },
      { kind: 'tick', exerciseIdx: 0, setIndex: 0 },
      { kind: 'finish', updates: { status: 'complete' }, finishedAt: '2026-11-23T11:00:00.000Z' },
      { kind: 'untick', exerciseIdx: 0, setIndex: 0 },
    ])
    const again = workoutStep({ ...base, log: r.log }, { kind: 'tick', exerciseIdx: 0, setIndex: 0 })
    expect(again.rest).toBeUndefined()
    expect(again.clock).toBeUndefined()
    expect(again.log!.loggedExercises![0].sets[0].completed).toBe(true)
  })

  it('deleting a workout stops only its own rest timer and set clock', () => {
    const [started] = replay([{ kind: 'start', id: 'log1', weekPlanId: 'p1' }])
    const other = workoutStep(
      { ...base, log: started.log, timer: { ...IDLE_TIMER, isActive: true, sessionId: 'other' }, setClock: { sessionId: 'other', startedAt: 1 } },
      { kind: 'delete' },
    )
    expect(other).toMatchObject({ log: null })
    expect(other.rest).toBeUndefined()
    expect(other.clock).toBeUndefined()
    const own = workoutStep(
      { ...base, log: started.log, timer: { ...IDLE_TIMER, isActive: true, sessionId: 's1' }, setClock: { sessionId: 's1', startedAt: 1 } },
      { kind: 'delete' },
    )
    expect(own).toMatchObject({ log: null, rest: 'skip', clock: 'stop' })
  })

  it('times a set from the end of the rest before it', () => {
    const [started] = replay([{ kind: 'start', id: 'log1', weekPlanId: 'p1' }])
    const r = workoutStep({ ...base, log: started.log, setClock: { sessionId: 's1', startedAt: base.now - 40_000 } }, { kind: 'tick', exerciseIdx: 1, setIndex: 0 })
    expect(r.log!.loggedExercises![0]).toMatchObject({ plannedExerciseId: 'row' })
    expect(r.log!.loggedExercises![0].sets[0]).toMatchObject({ completed: true, workSeconds: 40 })
    expect(r.rest).toEqual({ seconds: 90, label: 'Up next: Bench Press', nextExerciseId: 'bench' })
  })

  it('finishing confirms auto-finished sets and stops its set clock', () => {
    const [, ticked] = replay([
      { kind: 'start', id: 'log1', weekPlanId: 'p1' },
      { kind: 'tick', exerciseIdx: 0, setIndex: 0, payload: { unconfirmed: true } },
    ])
    const r = workoutStep({ ...base, log: ticked.log, setClock: { sessionId: 's1', startedAt: 1 } },
      { kind: 'finish', updates: { status: 'complete', feelings: 4 }, finishedAt: '2026-11-23T11:00:00.000Z' })
    expect(r.log).toMatchObject({ status: 'complete', completedAt: '2026-11-23T11:00:00.000Z', feelings: 4 })
    expect(r.log!.loggedExercises![0].sets[0].unconfirmed).toBeUndefined()
    expect(r.clock).toBe('stop')
  })
})
