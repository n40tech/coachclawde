import { describe, expect, it } from 'vitest'
import { buildDemoData, demoAction } from './demoData'
import { scopePlansAndLogs } from './planIds'
import { addDays, getMonday, toLocalISODate } from './weekUtils'

// A Thursday, so the current week has sessions both done and still to do.
const NOW = new Date(2026, 10, 26, 9, 0)
const thisMonday = toLocalISODate(getMonday(NOW))
const today = toLocalISODate(NOW)

describe('buildDemoData', () => {
  const demo = buildDemoData(NOW)

  it('is an onboarded lifter six weeks into their program', () => {
    expect(demo.profile.onboarded).toBe(true)
    expect(demo.profile.program?.startDate).toBe(toLocalISODate(addDays(getMonday(NOW), -42)))
  })

  it('has a plan for the current week, so Home shows this week’s training', () => {
    expect(demo.weekPlans.some((p) => p.weekStartDate === thisMonday)).toBe(true)
  })

  it('logs every past session and leaves today’s and later ones to do', () => {
    const sessions = demo.weekPlans.flatMap((p) => p.sessions)
    const logged = new Set(demo.loggedSessions.map((l) => l.plannedSessionId))
    for (const s of sessions) expect(logged.has(s.id)).toBe(s.date < today)
    expect(sessions.some((s) => s.date >= today)).toBe(true)
  })

  it('keeps every log linked to its planned session once the store scopes the ids', () => {
    const { plans, logs } = scopePlansAndLogs(demo.weekPlans, demo.loggedSessions)
    const ids = new Set(plans.flatMap((p) => p.sessions.map((s) => s.id)))
    expect(logs.length).toBeGreaterThan(0)
    for (const log of logs) expect(ids.has(log.plannedSessionId)).toBe(true)
  })

  it('logs completed sets with real reps and weights for every exercise', () => {
    expect(demo.loggedSessions.length).toBeGreaterThan(0)
    for (const log of demo.loggedSessions) {
      expect(log.status).toBe('complete')
      expect(log.loggedExercises?.length).toBeGreaterThan(0)
      for (const ex of log.loggedExercises ?? []) {
        for (const set of ex.sets) {
          expect(set.completed).toBe(true)
          expect(set.actualReps ?? set.actualSeconds).toBeGreaterThan(0)
        }
      }
    }
  })

  it('progresses the main lift week on week, so Progress has a trend and a PB', () => {
    const top = (name: string) =>
      demo.loggedSessions
        .sort((a, b) => a.date.localeCompare(b.date))
        .flatMap((l) => l.loggedExercises ?? [])
        .filter((e) => e.name === name)
        .map((e) => Math.max(...e.sets.map((s) => s.weightKg ?? 0)))
    const squat = top('Barbell Squat')
    expect(squat.length).toBeGreaterThan(4)
    for (let i = 1; i < squat.length; i++) expect(squat[i]).toBeGreaterThan(squat[i - 1])
  })
})

describe('demoAction', () => {
  it('seeds a demo build that has no athlete yet', () => {
    expect(demoAction({ demoBuild: true, onboarded: false, search: '' })).toBe('seed')
  })

  it('leaves an athlete already on the demo build alone', () => {
    expect(demoAction({ demoBuild: true, onboarded: true, search: '' })).toBeNull()
  })

  it('re-seeds on ?demo=reset', () => {
    expect(demoAction({ demoBuild: true, onboarded: true, search: '?demo=reset' })).toBe('reset')
  })

  it('never touches a production build, even with ?demo=reset', () => {
    expect(demoAction({ demoBuild: false, onboarded: false, search: '?demo=reset' })).toBeNull()
  })
})
