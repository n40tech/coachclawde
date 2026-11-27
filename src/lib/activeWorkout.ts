import type { LoggedExercise, LoggedSession, LoggedSet, PlannedExercise, PlannedSession, SetClock, TimerState } from '../types'
import { promoteStarted } from './exerciseOrder'

/**
 * The active workout's rules, as a pure step: the workout screen sends an
 * event (start, edit a set, tick, untick, confirm, finish, delete) and gets
 * back the next log plus what to do with the rest timer and the set clock.
 * The screen only renders the result and applies those instructions.
 */

export interface WorkoutContext {
  planned: PlannedSession
  /** This session's log, or null before Start Session. */
  log: LoggedSession | null
  setClock: SetClock | null
  timer: TimerState
  /** Epoch ms. */
  now: number
}

export type WorkoutEvent =
  | { kind: 'start'; id: string; weekPlanId: string }
  | { kind: 'edit'; exerciseIdx: number; setIndex: number; updates: Partial<LoggedSet> }
  | { kind: 'tick'; exerciseIdx: number; setIndex: number; payload?: Partial<LoggedSet> }
  | { kind: 'untick'; exerciseIdx: number; setIndex: number }
  /** The orange tick of an auto-finished set, tapped: it's confirmed as logged. */
  | { kind: 'confirm'; exerciseIdx: number; setIndex: number }
  | { kind: 'finish'; updates: Partial<LoggedSession>; finishedAt: string }
  | { kind: 'delete' }

export interface WorkoutResult {
  /** The next log (null: there's none, e.g. after delete). */
  log: LoggedSession | null
  /** Start a rest, or skip this session's rest. Absent: leave the timer alone. */
  rest?: { seconds: number; label: string; nextExerciseId?: string } | 'skip'
  /** Start this session's set clock now, or stop it. Absent: leave it alone. */
  clock?: 'start' | 'stop'
  /** The exercise to make active. */
  activeExerciseId?: string
  /** Push the log to the account now (a ticked set, a finish). */
  push?: boolean
}

/** The planned exercise behind a logged one (by id; older logs by name, then position). */
export function plannedExerciseOf(planned: PlannedSession, le: LoggedExercise, i: number): PlannedExercise | undefined {
  return planned.exercises?.find((e) => e.id === le.plannedExerciseId)
    ?? planned.exercises?.find((e) => e.name === le.name)
    ?? planned.exercises?.[i]
}

function withSet(list: LoggedExercise[], exerciseId: string, setIndex: number, updates: Partial<LoggedSet>): LoggedExercise[] {
  return list.map((ex) =>
    ex.plannedExerciseId !== exerciseId ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, ...updates } : s)) }
  )
}

const ownClock = (ctx: WorkoutContext) => ctx.setClock?.sessionId === ctx.planned.id

function startLog(planned: PlannedSession, id: string, weekPlanId: string, now: number): LoggedSession {
  return {
    id,
    plannedSessionId: planned.id,
    weekPlanId,
    date: planned.date,
    type: planned.type,
    title: planned.title,
    focus: planned.focus,
    startedAt: new Date(now).toISOString(),
    status: 'in-progress',
    loggedExercises: planned.exercises?.map((ex) => ({
      plannedExerciseId: ex.id,
      name: ex.name,
      sets: ex.sets.map((set, i) => ({ setIndex: i, targetReps: set.reps, completed: false, skipped: false })),
    })),
  }
}

function tick(ctx: WorkoutContext, log: LoggedSession, exerciseIdx: number, setIndex: number, payload?: Partial<LoggedSet>): WorkoutResult {
  const list = log.loggedExercises ?? []
  const done = list[exerciseIdx]
  if (!done) return { log }
  const exerciseId = done.plannedExerciseId

  // The set clock stops on the tick: how long since the last rest ended.
  let workSeconds: number | undefined
  let clock: WorkoutResult['clock']
  if (ownClock(ctx)) {
    const s = Math.round((ctx.now - ctx.setClock!.startedAt) / 1000)
    if (s >= 2) workSeconds = s
    clock = 'stop'
  }

  // Starting an exercise ahead of others moves it up the list, so the order
  // follows what's actually being done.
  const next = withSet(promoteStarted(list, exerciseIdx), exerciseId, setIndex, {
    completed: true, ...(workSeconds ? { workSeconds } : {}), ...payload,
  })
  const result: WorkoutResult = { log: { ...log, loggedExercises: next }, activeExerciseId: exerciseId, push: true, clock }

  // Re-ticking a corrected set on an already-finished workout starts no rest.
  if (log.status === 'complete') return result
  const restSeconds = plannedExerciseOf(ctx.planned, done, exerciseIdx)?.sets[setIndex]?.restSeconds ?? 90
  if (restSeconds <= 0) return { ...result, clock: 'start' }

  // On the final set of an exercise, point the rest at what's coming up next
  // (in the athlete's order) instead of the set just finished.
  const isLastSet = setIndex === done.sets.length - 1
  const at = next.findIndex((e) => e.plannedExerciseId === exerciseId)
  const upNext = next.slice(at + 1).find((e) => e.sets.some((s) => !s.completed && !s.skipped))
  const label = isLastSet
    ? upNext ? `Up next: ${upNext.name}` : 'Last set — finish up'
    : `Up next: ${done.name} · set ${setIndex + 2}`
  // The rest alert opens the workout at what's next: this exercise, or the one after its last set.
  return { ...result, rest: { seconds: restSeconds, label, nextExerciseId: isLastSet ? upNext?.plannedExerciseId : exerciseId } }
}

export function workoutStep(ctx: WorkoutContext, event: WorkoutEvent): WorkoutResult {
  const { log } = ctx
  if (event.kind === 'start') return { log: startLog(ctx.planned, event.id, event.weekPlanId, ctx.now) }
  if (!log) return { log: null }
  const list = log.loggedExercises ?? []
  const setAt = (exerciseIdx: number, setIndex: number, updates: Partial<LoggedSet>): LoggedSession =>
    list[exerciseIdx] ? { ...log, loggedExercises: withSet(list, list[exerciseIdx].plannedExerciseId, setIndex, updates) } : log

  switch (event.kind) {
    case 'edit':
      return { log: setAt(event.exerciseIdx, event.setIndex, event.updates) }
    case 'tick':
      return tick(ctx, log, event.exerciseIdx, event.setIndex, event.payload)
    case 'untick':
      // Reopens a completed set so a mistyped rep count or weight can be fixed.
      return { log: setAt(event.exerciseIdx, event.setIndex, { completed: false, actualSeconds: undefined }), push: true }
    case 'confirm':
      return { log: setAt(event.exerciseIdx, event.setIndex, { unconfirmed: undefined }), push: true }
    case 'finish': {
      // Saving confirms any auto-finished sets as logged.
      const confirmed = log.loggedExercises?.map((ex) => ({
        ...ex,
        sets: ex.sets.map((set) => (set.unconfirmed ? { ...set, unconfirmed: undefined } : set)),
      }))
      return {
        log: { ...log, ...event.updates, completedAt: event.finishedAt, ...(confirmed ? { loggedExercises: confirmed } : {}) },
        clock: ownClock(ctx) ? 'stop' : undefined,
        push: true,
      }
    }
    case 'delete':
      // Only this workout's own rest and set clock stop.
      return {
        log: null,
        rest: ctx.timer.sessionId === ctx.planned.id ? 'skip' : undefined,
        clock: ownClock(ctx) ? 'stop' : undefined,
      }
  }
}

/** Where the workout's log lives (the app store; an in-memory stand-in in tests). */
export interface WorkoutLogStore {
  /** This session's log as it is now, or null. */
  current: () => LoggedSession | null
  add: (log: LoggedSession) => void
  save: (log: LoggedSession) => void
}

/**
 * Runs an event against the store's current copy of the log and saves the
 * result there. The workout screen keeps no copy of its own, so a change made
 * elsewhere mid-workout (a background pull, a quick log) is never overwritten
 * by the next tap. Deleting is the caller's (it also reaches the account).
 */
export function dispatchWorkout(store: WorkoutLogStore, ctx: Omit<WorkoutContext, 'log'>, event: WorkoutEvent): WorkoutResult {
  const r = workoutStep({ ...ctx, log: store.current() }, event)
  if (r.log && event.kind === 'start') store.add(r.log)
  else if (r.log && event.kind !== 'delete') store.save(r.log)
  return r
}
