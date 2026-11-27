import { describe, expect, it } from 'vitest'
import { buildWeekPlanPrompt } from './promptBuilder'
import { DEFAULT_PROFILE } from './profileData'
import type { UserProfile } from '../types'
import { goalFromLegacyProfile } from './goalProfile'
import { LEGACY_GOAL_PATCHES } from './legacyGoalProfiles.testdata'

const monday = new Date('2026-10-05T00:00:00')

function prompt(profile: UserProfile) {
  return buildWeekPlanPrompt(['Mon', 'Thu'], '', 45, undefined, monday, profile, [])
}

describe('buildWeekPlanPrompt', () => {
  it('never asks for cardio workouts, intervals or pace zones', () => {
    const base = goalFromLegacyProfile(DEFAULT_PROFILE)
    const goal = { ...base, starting: { ...base.starting, recentResult: { meters: 5000, seconds: 1470 } } }
    const p = prompt({ ...DEFAULT_PROFILE, goal })
    expect(p).not.toMatch(/workout\?: WorkoutItem\[\]/)
    expect(p).not.toMatch(/intervals\?: PlannedInterval/)
    expect(p).not.toMatch(/Runs with:/)
    expect(p).not.toMatch(/Pace zones/)
    expect(p).toMatch(/exercises: PlannedExercise\[\]/)
    expect(p).not.toMatch(/Training types:.*cardio/)
  })

  it('has no check-in section and no rule about applying a check-in', () => {
    const p = prompt(DEFAULT_PROFILE)
    expect(p).not.toMatch(/check-in/i)
  })
})

describe('Goal section', () => {
  it('embeds the goal, the phase skeleton and the deload flag', () => {
    const profile = { ...DEFAULT_PROFILE, ...LEGACY_GOAL_PATCHES.halfMarathoner } as UserProfile
    // Week 8 of the block: 2026-11-16.
    const p = buildWeekPlanPrompt(['Mon'], '', 60, undefined, new Date('2026-11-16T00:00:00'), profile, [])
    expect(p).toMatch(/## Goal\n- Half marathon on 2027-03-14 \(17 weeks from this week\)\. Aim: 1:45:00 \(current fitness predicts ~1:52:\d\d\)\./)
    expect(p).toMatch(/Week 8 of 24 · Phase: Base \(weeks 1–8\) → Build \(weeks 9–18\) → Peak \(weeks 19–22\) → Taper \(weeks 23–24\)\. This week: Base, deload week/)
  })
})
