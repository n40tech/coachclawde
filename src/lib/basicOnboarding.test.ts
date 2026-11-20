import { describe, expect, it } from 'vitest'
import { basicsFromProfile, profileFromBasics, type BasicAnswers } from './basicOnboarding'
import { ageFromBirthDate } from './dateUtils'
import { DEFAULT_PROFILE } from './profileData'
import { buildWeekPlanPrompt } from './promptBuilder'
import type { UserProfile } from '../types'

const now = new Date('2026-11-19T12:00:00')
const basics: BasicAnswers = {
  name: 'Sam', sex: 'female', age: 28, activity: '1-2x', where: ['gym'],
  injuries: 'Left knee: sore on deep squats\n\n', medical: false, cleared: false, notes: 'Want a bigger deadlift',
}

describe('profileFromBasics', () => {
  it('builds a weights-only profile from the basics', () => {
    const p = profileFromBasics(basics, now)
    expect(p.name).toBe('Sam')
    expect(ageFromBirthDate(p.birthDate, now)).toBe(28)
    expect(p.injuries).toEqual(['Left knee: sore on deep squats'])
    expect(p.program?.exerciseTypes).toEqual(['weights'])
    expect(p.program?.facilities).toEqual(['full-gym'])
    expect(p.program?.startDate).toBe('2026-11-16')
    expect(p.goal?.health.flags).toEqual(['injury'])
    expect(p.goal?.health.conservative).toBeUndefined()
    expect(p.fitnessBackground).toMatch(/In their words: Want a bigger deadlift\./)
    expect(p.onboarded).toBe(true)
  })

  it('keeps a medical flag conservative until cleared', () => {
    expect(profileFromBasics({ ...basics, medical: true }, now).goal?.health).toMatchObject({ flags: ['injury', 'condition'], conservative: true })
    expect(profileFromBasics({ ...basics, medical: true, cleared: true }, now).goal?.health).toMatchObject({ conservative: false, cleared: true })
  })

  it('carries a returning athlete\'s block over and files removed injuries as history', () => {
    const first = { ...DEFAULT_PROFILE, ...profileFromBasics(basics, now) } as UserProfile
    const again = profileFromBasics({ ...basics, injuries: '' }, new Date('2026-12-20T12:00:00'), { ...first, program: { ...first.program!, startDate: '2026-11-16', coachingStyle: 'intense' } })
    expect(again.program?.startDate).toBe('2026-11-16')
    expect(again.program?.coachingStyle).toBe('intense')
    expect(again.injuries).toEqual([])
    expect(again.goal?.health.pastInjuries).toEqual(['Left knee: sore on deep squats'])
  })

  it('reads the answers back for re-onboarding', () => {
    const p = { ...DEFAULT_PROFILE, ...profileFromBasics(basics, now) } as UserProfile
    expect(basicsFromProfile(p, now)).toMatchObject({ name: 'Sam', activity: '1-2x', where: ['gym'], injuries: 'Left knee: sore on deep squats' })
  })

  it('produces a prompt with no cardio and the athlete\'s equipment', () => {
    const p = { ...DEFAULT_PROFILE, ...profileFromBasics({ ...basics, where: ['bodyweight'] }, now) } as UserProfile
    const prompt = buildWeekPlanPrompt(['Mon', 'Thu'], '', 45, undefined, new Date('2026-11-23T00:00:00'), p, [])
    expect(prompt).toMatch(/Equipment — bodyweight only/)
    expect(prompt).not.toMatch(/cardio/i)
  })
})
