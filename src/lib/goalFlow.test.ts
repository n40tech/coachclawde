import { describe, expect, it } from 'vitest'
import { blockLengthWeeks, weeksUntil } from './goalFlow'
import type { GoalProfile } from '../types'

const now = new Date('2026-10-01T12:00:00') // a Thursday; its Monday is 2026-09-28

const goal = (extra: Partial<GoalProfile>): GoalProfile => ({
  version: 1, origin: 'onboarding', pursuit: 'strength', statement: '', starting: { level: 'beginner' },
  constraints: { daysPerWeek: 3, sessionMinutes: 45, facilities: [] }, health: { flags: [] }, deferred: [],
  createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z', ...extra,
})

describe('weeksUntil', () => {
  it('counts weeks from this week’s Monday, including the week of the date', () => {
    expect(weeksUntil('2027-03-14', now)).toBe(24)
    expect(weeksUntil('2026-10-04', now)).toBe(1)
  })

  it('never returns less than one week, even for a date already past', () => {
    expect(weeksUntil('2026-09-01', now)).toBe(1)
  })
})

describe('blockLengthWeeks', () => {
  it('runs the block up to the event date', () => {
    expect(blockLengthWeeks(goal({ pursuit: 'event', event: { kind: 'half', date: '2027-03-14', aim: 'get-round' } }), now)).toBe(24)
  })

  it('caps a far-off date at 30 weeks', () => {
    expect(blockLengthWeeks(goal({ pursuit: 'event', event: { kind: 'marathon', date: '2028-01-01', aim: 'get-round' } }), now)).toBe(30)
  })

  it('gives sedentary beginners 8 weeks and everyone else 12', () => {
    expect(blockLengthWeeks(goal({ starting: { level: 'beginner', activity: 'sitting' } }), now)).toBe(8)
    expect(blockLengthWeeks(goal({ starting: { level: 'beginner', activity: '3x+' } }), now)).toBe(12)
  })
})
