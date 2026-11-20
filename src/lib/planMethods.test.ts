import { describe, expect, it } from 'vitest'
import { latestPlan, orderMethods, repeatPlan, repeatTargetMonday } from './planMethods'
import { scopeSessionIds } from './planIds'
import { toLocalISODate } from './weekUtils'
import type { WeekPlan } from '../types'

const plan = (week: string, sessions: { date: string; day: 'Mon' | 'Wed' | 'Fri' }[]): WeekPlan => scopeSessionIds({
  id: `plan-${week}`,
  weekStartDate: week,
  availableDays: sessions.map((s) => s.day),
  userNotes: '',
  createdAt: '2026-11-01T00:00:00.000Z',
  sessions: sessions.map((s, i) => ({
    id: `session-${i}`, date: s.date, dayOfWeek: s.day, type: 'weights', title: `S${i}`, focus: '', estimatedMinutes: 60, intensity: 'moderate',
    exercises: [{ id: `ex-${i}`, name: 'Squat', sets: [{ reps: '5', restSeconds: 120, suggestedWeightKg: 100 }] }],
  })),
})

describe('orderMethods', () => {
  it('puts the last method used first', () => {
    expect(orderMethods('convert')).toEqual(['convert', 'generate', 'repeat', 'modify'])
    expect(orderMethods(null)).toEqual(['generate', 'repeat', 'modify', 'convert'])
  })
})

describe('repeat last week', () => {
  const last = plan('2026-11-09', [{ date: '2026-11-09', day: 'Mon' }, { date: '2026-11-13', day: 'Fri' }])

  it('finds the newest plan', () => {
    expect(latestPlan([plan('2026-11-02', []), last])?.weekStartDate).toBe('2026-11-09')
  })

  it('lands on the following week, or next week when a day this week has passed', () => {
    expect(toLocalISODate(repeatTargetMonday(last, new Date('2026-11-12T09:00:00')))).toBe('2026-11-16')
    // Last week was 9 Nov; it's Tuesday 17 Nov, so Monday's slot has gone.
    expect(toLocalISODate(repeatTargetMonday(last, new Date('2026-11-17T09:00:00')))).toBe('2026-11-23')
    // Still Monday morning: this week works.
    expect(toLocalISODate(repeatTargetMonday(last, new Date('2026-11-16T07:00:00')))).toBe('2026-11-16')
  })

  it('copies sessions and weights onto the new dates with unscoped ids', () => {
    const copy = repeatPlan(last, new Date('2026-11-16T00:00:00'), new Date('2026-11-15T12:00:00'))
    expect(copy.weekStartDate).toBe('2026-11-16')
    expect(copy.sessions.map((s) => [s.id, s.date, s.dayOfWeek])).toEqual([
      ['session-0', '2026-11-16', 'Mon'],
      ['session-1', '2026-11-20', 'Fri'],
    ])
    expect(copy.sessions[0].exercises?.[0].sets[0].suggestedWeightKg).toBe(100)
    expect(scopeSessionIds(copy).sessions[0].id).toBe('session-0--2026-11-16')
  })
})
