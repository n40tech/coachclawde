import { describe, expect, it } from 'vitest'
import { trainingSetup, withTrainingSetup } from './trainingSetup'
import { buildWeekPlanPrompt } from './promptBuilder'
import { basicsFromProfile, profileFromBasics } from './basicOnboarding'
import { DEFAULT_PROFILE } from './profileData'
import type { UserProfile } from '../types'

const now = new Date('2026-11-25T12:00:00')
const prompt = (p: UserProfile) => buildWeekPlanPrompt(['Mon', 'Thu'], '', 45, undefined, new Date('2026-11-23T00:00:00'), p, [])
const gymAthlete = (): UserProfile => {
  const patch = profileFromBasics({ ...basicsFromProfile(DEFAULT_PROFILE, now), where: ['gym'], activity: '1-2x' }, now, DEFAULT_PROFILE)
  return { ...DEFAULT_PROFILE, ...patch } as UserProfile
}

describe('trainingSetup', () => {
  it('changing facilities and days in Program setup changes the plan prompt and its goal section', () => {
    const athlete = gymAthlete()
    const changed = { ...athlete, ...withTrainingSetup(athlete, { facilities: ['weights-at-home'], daysPerWeek: 5 }) } as UserProfile
    const p = prompt(changed)
    expect(p).toMatch(/\*\*Equipment — home only:\*\*/)
    expect(p).not.toMatch(/full gym/)
    expect(p).toMatch(/Wants about 5 sessions a week/)
    expect(changed.goal?.constraints).toMatchObject({ facilities: ['weights-at-home'], daysPerWeek: 5 })
  })

  it('reads an older profile whose facilities are only in its goal', () => {
    const athlete = gymAthlete()
    const older = { ...athlete, program: undefined } as UserProfile
    expect(trainingSetup(older)).toMatchObject({ facilities: ['full-gym'], sessionMinutes: 60 })
    expect(prompt(older)).toMatch(/\*\*Equipment:\*\* I train in a full gym/)
  })
})
