import { describe, expect, it } from 'vitest'
import { basicsFromProfile, needsBasicsForm, profileFromBasics, type BasicAnswers } from './basicOnboarding'
import { ageFromBirthDate } from './dateUtils'
import { DEFAULT_PROFILE } from './profileData'
import { buildWeekPlanPrompt } from './promptBuilder'
import { goalFromLegacyProfile } from './goalProfile'
import { useAppStore } from '../store/useAppStore'
import type { LoggedSession, UserProfile, WeekPlan } from '../types'

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

describe('athletes from older builds', () => {
  // Onboarded before goals existed: no `goal` on the profile, a block under way.
  const older: UserProfile = {
    ...DEFAULT_PROFILE, onboarded: true, name: 'Alex', injuries: ['Right shoulder: no overhead pressing'],
    programWeek: 7, program: { ...DEFAULT_PROFILE.program!, facilities: ['full-gym'], lengthWeeks: 12, startDate: '2026-10-05', daysPerWeek: 3 },
  }

  it('sends an onboarded athlete with no goal to the basics form', () => {
    expect(needsBasicsForm(older)).toBe(true)
  })

  it('sends an athlete whose legacy goal was never upgraded to the basics form', () => {
    expect(needsBasicsForm({ ...older, goal: goalFromLegacyProfile(older, now) })).toBe(true)
  })

  it('lets an athlete whose basics form was saved straight through', () => {
    const saved = { ...older, ...profileFromBasics(basicsFromProfile(older, now), now, older) } as UserProfile
    expect(needsBasicsForm(saved)).toBe(false)
    const fresh = { ...DEFAULT_PROFILE, ...profileFromBasics(basics, now) } as UserProfile
    expect(needsBasicsForm(fresh)).toBe(false)
  })

  it('still sends a brand-new account to onboarding', () => {
    expect(needsBasicsForm(DEFAULT_PROFILE)).toBe(true)
  })

  it('keeps their name, injuries, block, plans and logs when they save the prefilled form', () => {
    const plan = { id: 'plan-2026-11-16', weekStartDate: '2026-11-16', availableDays: ['Mon'], userNotes: '', createdAt: '', sessions: [] } as WeekPlan
    const log = { id: 'log-1', plannedSessionId: 's', weekPlanId: plan.id, date: '2026-11-16', type: 'weights', title: 'Upper', focus: '', startedAt: '', status: 'complete' } as LoggedSession
    useAppStore.setState({ profile: older, weekPlans: [plan], loggedSessions: [log] })

    // What the Onboarding page does on Save, starting from the prefilled form.
    const { profile, setProfile } = useAppStore.getState()
    setProfile(profileFromBasics(basicsFromProfile(profile, now), now, profile))

    const after = useAppStore.getState()
    expect(after.profile).toMatchObject({ name: 'Alex', injuries: ['Right shoulder: no overhead pressing'], programWeek: 7 })
    expect(after.profile.program).toMatchObject({ lengthWeeks: 12, startDate: '2026-10-05' })
    expect(after.weekPlans).toEqual([plan])
    expect(after.loggedSessions).toEqual([log])
    expect(needsBasicsForm(after.profile)).toBe(false)
  })
})

describe('gender Other', () => {
  it('reads back a returning athlete who picked Other before it was saved, and saves them as other', () => {
    // How an athlete who tapped Other was saved until now: no answer, so the default male.
    const before = { ...DEFAULT_PROFILE, ...profileFromBasics({ ...basics, sex: undefined }, now, DEFAULT_PROFILE) } as UserProfile
    expect(before.sex).toBe('male')
    const again = basicsFromProfile(before, now)
    expect(again.sex).toBe('other')
    expect(profileFromBasics(again, now, before).sex).toBe('other')
  })
})
