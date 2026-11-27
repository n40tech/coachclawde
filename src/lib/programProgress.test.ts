import { describe, expect, it } from 'vitest'
import { getProgramProgress, nextBlockProgram } from './programProgress'
import { DEFAULT_PROFILE } from './profileData'
import { goalFromLegacyProfile } from './goalProfile'
import type { UserProfile } from '../types'

const now = new Date('2026-11-25T12:00:00') // a Wednesday

function finishedAthlete(): UserProfile {
  const base = { ...DEFAULT_PROFILE, goal: goalFromLegacyProfile(DEFAULT_PROFILE) }
  return {
    ...base,
    program: {
      goals: ['get-strong'], exerciseTypes: ['weights'], facilities: ['full-gym'], sports: [],
      daysPerWeek: 4, coachingStyle: 'balanced', lengthWeeks: 12, startDate: '2026-08-17',
    },
  }
}

describe('nextBlockProgram', () => {
  it('starts the next block this week, so a finished program is back at week 1', () => {
    const athlete = finishedAthlete()
    expect(getProgramProgress(athlete, now).isComplete).toBe(true)
    const program = nextBlockProgram(athlete, now)!
    expect(program.startDate).toBe('2026-11-23')
    expect(getProgramProgress({ ...athlete, program }, now)).toMatchObject({ week: 1, isComplete: false })
  })

  it('keeps the athlete’s goals, equipment and coaching style', () => {
    const athlete = finishedAthlete()
    const program = nextBlockProgram(athlete, now)!
    expect(program).toMatchObject({ goals: ['get-strong'], facilities: ['full-gym'], daysPerWeek: 4, coachingStyle: 'balanced' })
  })
})
