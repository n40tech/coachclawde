import { describe, expect, it } from 'vitest'
import { dropPastSessions, placePlan, previousPlan, repeatPlan } from './planImport'
import { baseSessionId, scopeSessionIds } from './planIds'
import type { DayOfWeek, LoggedSession, PlannedSession, WeekPlan } from '../types'

const session = (id: string, date: string, dayOfWeek: DayOfWeek, extra: Partial<PlannedSession> = {}): PlannedSession => ({
  id, date, dayOfWeek, type: 'weights', title: id, focus: '', estimatedMinutes: 60, intensity: 'moderate', ...extra,
})
const plan = (id: string, week: string, sessions: PlannedSession[]): WeekPlan => ({
  id, weekStartDate: week, availableDays: [], userNotes: '', createdAt: '', sessions,
})
const log = (plannedSessionId: string, weekPlanId: string, status: LoggedSession['status'] = 'complete'): LoggedSession => ({
  id: `log-${plannedSessionId}`, plannedSessionId, weekPlanId, date: '', type: 'weights', title: '', focus: '', startedAt: '', status,
})

const thisWeek = plan('plan-2026-11-16', '2026-11-16', [
  session('session-2026-11-17-strength--2026-11-16', '2026-11-17', 'Tue'),
  session('session-2026-11-19-mobility--2026-11-16', '2026-11-19', 'Thu'),
])
const logs = [
  log('session-2026-11-17-strength--2026-11-16', 'plan-2026-11-16'),
  log('session-2026-11-19-mobility--2026-11-16', 'plan-2026-11-16', 'in-progress'),
]

describe('placePlan', () => {
  // The reported bug: with the planner on this week, importing a plan written
  // for next week replaced this week's plan (and moved it to next week).
  it("puts a plan for next week in next week and leaves this week's alone", () => {
    const nextWeek = plan('plan-2026-11-16', '2026-11-23', [session('session-2026-11-23-upper', '2026-11-23', 'Mon')])
    const { plan: placed, replaces } = placePlan([thisWeek], logs, nextWeek)
    expect(replaces).toBeUndefined()
    expect(placed.weekStartDate).toBe('2026-11-23')
    // Its id clashed with this week's plan, so it gets one of its own.
    expect(placed.id).toBe('plan-2026-11-23')
    expect(placed.sessions.map((s) => s.id)).toEqual(['session-2026-11-23-upper'])
  })

  it('replaces a plan for the same week, keeping its id and the sessions already completed', () => {
    const replan = plan('plan-x', '2026-11-16', [session('session-2026-11-20-run', '2026-11-20', 'Fri')])
    const { plan: placed, replaces } = placePlan([thisWeek], logs, replan)
    expect(replaces).toBe(thisWeek)
    expect(placed.id).toBe('plan-2026-11-16')
    // Tue was completed so it stays; Thu was only started, so it goes.
    expect(placed.sessions.map((s) => s.id)).toEqual([
      'session-2026-11-17-strength--2026-11-16',
      'session-2026-11-20-run',
    ])
  })

  it('numbers the id when the week id is taken too', () => {
    const taken = [thisWeek, plan('plan-2026-11-23', '2026-11-30', [])]
    const incoming = plan('plan-2026-11-16', '2026-11-23', [])
    expect(placePlan(taken, [], incoming).plan.id).toBe('plan-2026-11-23-2')
  })

  it('keeps an unused id as it is', () => {
    expect(placePlan([thisWeek], [], plan('plan-2026-11-23', '2026-11-23', [])).plan.id).toBe('plan-2026-11-23')
  })
})

describe('previousPlan', () => {
  const older = plan('plan-2026-10-26', '2026-10-26', [session('a', '2026-10-26', 'Mon')])
  const empty = plan('plan-2026-11-09', '2026-11-09', [])
  const next = plan('plan-2026-11-23', '2026-11-23', [session('b', '2026-11-23', 'Mon')])

  it('picks the latest plan before the week, skipping empty ones', () => {
    expect(previousPlan([older, empty, thisWeek, next], '2026-11-23')).toBe(thisWeek)
    expect(previousPlan([older, empty, thisWeek, next], '2026-11-16')).toBe(older)
  })

  it('finds nothing when there is no earlier plan', () => {
    expect(previousPlan([thisWeek, next], '2026-11-16')).toBeUndefined()
  })
})

describe('repeatPlan', () => {
  const source = plan('plan-2026-11-16', '2026-11-16', [
    session('session-2026-11-17-strength--2026-11-16', '2026-11-17', 'Tue', {
      exercises: [{ id: 'ex-2026-11-17-squat', name: 'Barbell Squat', sets: [{ reps: '5', restSeconds: 180, suggestedWeightKg: 70 }] }],
    }),
    session('session-thu-mobility--2026-11-16', '2026-11-19', 'Thu'),
  ])
  const now = new Date('2026-11-18T09:00:00Z')

  it('moves every session to the same weekday of the new week', () => {
    const copy = repeatPlan(source, '2026-11-23', now)
    expect(copy.id).toBe('plan-2026-11-23')
    expect(copy.weekStartDate).toBe('2026-11-23')
    expect(copy.sessions.map((s) => [s.date, s.dayOfWeek])).toEqual([['2026-11-24', 'Tue'], ['2026-11-26', 'Thu']])
    expect(copy.availableDays).toEqual(['Tue', 'Thu'])
    expect(copy.createdAt).toBe(now.toISOString())
  })

  it('re-dates the ids so the copy never matches last week’s logs', () => {
    const copy = scopeSessionIds(repeatPlan(source, '2026-11-23', now))
    expect(copy.sessions.map((s) => s.id)).toEqual([
      'session-2026-11-24-strength--2026-11-23',
      'session-thu-mobility--2026-11-23',
    ])
    expect(copy.sessions[0].exercises?.[0].id).toBe('ex-2026-11-24-squat')
  })

  it('copies exercises, sets and weights as they are', () => {
    const copy = repeatPlan(source, '2026-11-23', now)
    expect(copy.sessions[0].exercises?.[0].sets).toEqual([{ reps: '5', restSeconds: 180, suggestedWeightKg: 70 }])
  })

  it('jumps more than one week', () => {
    expect(repeatPlan(source, '2026-12-07', now).sessions[0].date).toBe('2026-12-08')
  })
})

describe('baseSessionId', () => {
  it('strips one or more week suffixes and counters', () => {
    expect(baseSessionId('session-mon-upper--2026-10-05')).toBe('session-mon-upper')
    expect(baseSessionId('session-mon-upper--2026-10-05-2')).toBe('session-mon-upper')
    expect(baseSessionId('session-2026-11-17-strength--2026-11-16--2026-11-23')).toBe('session-2026-11-17-strength')
    expect(baseSessionId('session-mon-upper')).toBe('session-mon-upper')
  })
})

describe('dropPastSessions', () => {
  it('leaves out days already gone and says which', () => {
    const { plan: trimmed, skipped } = dropPastSessions(thisWeek, '2026-11-18')
    expect(trimmed.sessions.map((s) => s.dayOfWeek)).toEqual(['Thu'])
    expect(trimmed.availableDays).toEqual(['Thu'])
    expect(skipped).toEqual(['Tue'])
  })

  it('keeps today and returns the same plan when nothing has passed', () => {
    const r = dropPastSessions(thisWeek, '2026-11-17')
    expect(r.plan).toBe(thisWeek)
    expect(r.skipped).toEqual([])
  })
})
