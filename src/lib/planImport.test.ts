import { describe, expect, it } from 'vitest'
import { importPlan } from './planImport'
import type { LoggedSession, PlannedSession, WeekPlan } from '../types'

const session = (id: string, date: string, title = 'Upper Body'): PlannedSession => ({
  id, date, dayOfWeek: 'Mon', type: 'weights', title, focus: 'Upper', estimatedMinutes: 45,
  intensity: 'moderate', warmup: 'Ramp-up sets', exercises: [],
} as unknown as PlannedSession)

const claude = (weekStartDate: string, sessions: PlannedSession[]) => JSON.stringify({
  id: `plan-${weekStartDate}`, weekStartDate, availableDays: ['Mon', 'Wed'], userNotes: 'Claude notes',
  createdAt: '2026-11-22T10:00:00.000Z', sessions,
})

const opts = (over: Partial<Parameters<typeof importPlan>[1]> = {}) => ({
  weekStart: '2026-11-23', days: ['Mon', 'Thu'] as const, notes: 'Short on time', plans: [], logs: [], ...over,
}) as Parameters<typeof importPlan>[1]

describe('importPlan', () => {
  it('lands on the week the athlete picked, whatever week Claude wrote', () => {
    const { plan, replaces } = importPlan(claude('2026-11-16', [session('upper', '2026-11-23')]), opts())
    expect(plan.weekStartDate).toBe('2026-11-23')
    expect(replaces).toBeUndefined()
  })

  it('moves a session dated outside the week onto the same weekday, with a warning', () => {
    const { plan, warnings } = importPlan(claude('2026-11-23', [session('upper', '2026-11-18', 'Upper Body')]), opts())
    expect(plan.sessions[0].date).toBe('2026-11-25')
    expect(plan.sessions[0].dayOfWeek).toBe('Wed')
    expect(warnings).toEqual([expect.stringMatching(/Upper Body.*2026-11-18.*Wed 25 Nov/)])
  })

  it('keeps the athlete’s days and notes when it replaces a week, as when it adds one', () => {
    const existing: WeekPlan = { id: 'plan-old', weekStartDate: '2026-11-23', availableDays: ['Tue'], userNotes: 'old', createdAt: '', sessions: [] }
    const { plan, replaces } = importPlan(claude('2026-11-23', [session('upper', '2026-11-23')]), opts({ plans: [existing] }))
    expect(replaces).toBe('plan-old')
    expect(plan).toMatchObject({ id: 'plan-old', availableDays: ['Mon', 'Thu'], userNotes: 'Short on time' })
    const added = importPlan(claude('2026-11-23', [session('upper', '2026-11-23')]), opts()).plan
    expect(added).toMatchObject({ availableDays: ['Mon', 'Thu'], userNotes: 'Short on time' })
  })

  it('keeps sessions with a finished or in-progress workout when it replaces a week', () => {
    const existing: WeekPlan = {
      id: 'plan-old', weekStartDate: '2026-11-23', availableDays: ['Mon', 'Tue', 'Wed'], userNotes: '', createdAt: '',
      sessions: [session('done--2026-11-23', '2026-11-23'), session('live--2026-11-23', '2026-11-24'), session('todo--2026-11-23', '2026-11-25')],
    }
    const log = (plannedSessionId: string, status: LoggedSession['status']) =>
      ({ id: `log-${plannedSessionId}`, plannedSessionId, weekPlanId: 'plan-old', date: '2026-11-23', status }) as LoggedSession
    const { plan } = importPlan(claude('2026-11-23', [session('new', '2026-11-26')]), opts({
      plans: [existing], logs: [log('done--2026-11-23', 'complete'), log('live--2026-11-23', 'in-progress')],
    }))
    expect(plan.sessions.map((s) => s.id)).toEqual(['done--2026-11-23', 'live--2026-11-23', 'new'])
  })

  it('rejects JSON that is not a plan', () => {
    expect(() => importPlan('{"sessions": []}', opts())).toThrow(/missing required fields/)
  })
})
