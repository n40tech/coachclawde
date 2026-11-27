import type { ProgramFacility, UserProfile } from '../types'

/**
 * Facilities, days per week and session length: stored both in the goal
 * (`goal.constraints`) and in the program preferences (`program`). Read them
 * here and write them with `withTrainingSetup`, never by picking one copy.
 */
export interface TrainingSetup {
  facilities: ProgramFacility[]
  daysPerWeek: number
  sessionMinutes: number
}

/** The program's values (what Program setup edits), else the goal's (older profiles), else defaults. */
export function trainingSetup(profile: UserProfile): TrainingSetup {
  const c = profile.goal?.constraints
  return {
    facilities: profile.program?.facilities ?? c?.facilities ?? [],
    daysPerWeek: profile.program?.daysPerWeek ?? c?.daysPerWeek ?? 3,
    sessionMinutes: c?.sessionMinutes ?? 60,
  }
}

/** A profile patch that changes the setup in both copies, so they never disagree. */
export function withTrainingSetup(profile: UserProfile, patch: Partial<TrainingSetup>): Partial<UserProfile> {
  const next = { ...trainingSetup(profile), ...patch }
  const out: Partial<UserProfile> = {}
  if (profile.program) out.program = { ...profile.program, facilities: next.facilities, daysPerWeek: next.daysPerWeek }
  if (profile.goal) out.goal = { ...profile.goal, constraints: { ...profile.goal.constraints, ...next } }
  return out
}
