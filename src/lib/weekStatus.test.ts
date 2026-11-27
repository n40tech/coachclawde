import { describe, expect, it } from 'vitest'
import { logWeekStart, weekStatus } from './weekStatus'
import type { LoggedSession, PlannedSession, WeekPlan } from '../types'

function planned(id: string, date: string): PlannedSession {
  return { id, date, dayOfWeek: 'Mon', type: 'weights', title: 'Upper', focus: 'Upper', estimatedMinutes: 45, intensity: 'moderate', warmup: '' } as PlannedSession
}
function plan(id: string, weekStartDate: string, sessions: PlannedSession[]): WeekPlan {
  return { id, weekStartDate, availableDays: ['Mon'], userNotes: '', createdAt: '', sessions }
}
function log(over: Partial<LoggedSession>): LoggedSession {
  return {
    id: 'log', plannedSessionId: 'upper', weekPlanId: 'p2', date: '2026-11-23', type: 'weights', title: 'Upper',
    startedAt: '2026-11-23T10:00:00.000Z', status: 'complete', ...over,
  } as LoggedSession
}

const thisWeek = plan('p2', '2026-11-23', [planned('upper', '2026-11-23'), planned('lower', '2026-11-25')])
const statuses = (logs: LoggedSession[]) => weekStatus(thisWeek, logs).sessions.map((s) => s.status)

describe('weekStatus', () => {
  it('ignores an old week’s log of a session with the same id', () => {
    const old = log({ weekPlanId: 'p1', date: '2026-11-16', completedAt: '2026-11-16T11:00:00.000Z' })
    expect(statuses([old])).toEqual(['to-do', 'to-do'])
    expect(weekStatus(thisWeek, [old]).done).toBe(0)
  })

  it('ignores a log dated outside the week, unless it was logged against this plan', () => {
    expect(statuses([log({ weekPlanId: 'other', date: '2026-12-01' })])).toEqual(['to-do', 'to-do'])
    expect(statuses([log({ weekPlanId: 'p2', date: '2026-12-01' })])).toEqual(['done', 'to-do'])
  })

  it('counts a swapped session as done, and shows it as swapped', () => {
    const swapped = log({ plannedSessionId: 'lower', date: '2026-11-25', outcome: 'substituted' })
    expect(statuses([swapped])).toEqual(['to-do', 'swapped'])
    expect(weekStatus(thisWeek, [swapped])).toMatchObject({ done: 1, total: 2 })
  })

  it('shows a workout under way as in progress, not done', () => {
    const live = log({ status: 'in-progress' })
    expect(statuses([live])).toEqual(['in-progress', 'to-do'])
    expect(weekStatus(thisWeek, [live]).done).toBe(0)
  })
})

describe('logWeekStart', () => {
  it('puts a log in the week it was done, not the week it was planned for', () => {
    expect(logWeekStart(log({ date: '2026-11-22', completedAt: '2026-11-24T09:00:00' }))).toBe('2026-11-23')
    expect(logWeekStart(log({ date: '2026-11-25', completedAt: undefined }))).toBe('2026-11-23')
  })
})
