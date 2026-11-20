import type { ExperienceLevel, GoalProfile, HealthFlag, ProgramFacility, UserProfile } from '../types'
import { blockLengthWeeks } from './goalFlow'
import { getMonday, toLocalISODate } from './weekUtils'

/**
 * The slim onboarding: a handful of basics, turned into the same profile
 * (GoalProfile + the legacy fields) the plan prompt and check-ins already use.
 * The app is weights-first, so the goal is always all-round strength and a
 * balanced physique; anything more specific goes in the athlete's notes.
 */

export type ActivityLevel = 'sitting' | 'light' | '1-2x' | '3x+'
export type TrainWhere = 'gym' | 'home' | 'bodyweight'

export interface BasicAnswers {
  name: string
  sex?: 'male' | 'female'
  age?: number
  activity: ActivityLevel
  where: TrainWhere[]
  /** One injury or niggle per line, kept verbatim (safety-critical). */
  injuries: string
  /** A medical condition, heart condition or pregnancy: keep things conservative. */
  medical: boolean
  /** A GP or physio has cleared them to train. */
  cleared: boolean
  notes: string
}

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sitting: 'Mostly sitting',
  light: 'Walking, the odd session',
  '1-2x': 'Training 1–2× a week',
  '3x+': 'Training 3+ times a week',
}

export const WHERE_LABEL: Record<TrainWhere, string> = {
  gym: 'A gym',
  home: 'Home, with weights',
  bodyweight: 'Bodyweight only',
}

const LEVEL: Record<ActivityLevel, ExperienceLevel> = { sitting: 'beginner', light: 'beginner', '1-2x': 'returning', '3x+': 'intermediate' }
const DAYS: Record<ActivityLevel, number> = { sitting: 3, light: 3, '1-2x': 3, '3x+': 4 }
const FACILITY: Record<TrainWhere, ProgramFacility> = { gym: 'full-gym', home: 'weights-at-home', bodyweight: 'yoga-mat' }
const STATEMENT = 'Get stronger and build a balanced physique'

/** A date of birth that gives `age` today (1 January of the birth year). */
export function birthDateFromAge(age: number, now: Date): string {
  return `${now.getFullYear() - age}-01-01`
}

export const injuryLines = (text: string) => text.split(/\n+/).map((l) => l.trim()).filter(Boolean)

/** The answers a returning athlete starts from, read back from their profile. */
export function basicsFromProfile(p: UserProfile, now: Date): BasicAnswers {
  const stored = (p.goal?.answers as { basic?: BasicAnswers } | undefined)?.basic
  if (stored) return { ...stored, name: p.name, injuries: p.injuries.join('\n') }
  const born = p.birthDate ? Number(p.birthDate.slice(0, 4)) : undefined
  const f = p.program?.facilities ?? []
  return {
    name: p.name,
    sex: p.sex,
    age: born ? now.getFullYear() - born : undefined,
    activity: p.goal?.starting.activity ?? '1-2x',
    where: [
      ...(f.includes('full-gym') ? ['gym' as const] : []),
      ...(f.includes('weights-at-home') ? ['home' as const] : []),
      ...(f.includes('yoga-mat') ? ['bodyweight' as const] : []),
    ],
    injuries: p.injuries.join('\n'),
    medical: !!p.goal?.health.flags.some((x) => x !== 'injury'),
    cleared: !!p.goal?.health.cleared,
    notes: '',
  }
}

/**
 * Basics → a profile patch. `previous` is the athlete's profile when they
 * re-onboard: their block, coaching style and injury history carry over.
 */
export function profileFromBasics(a: BasicAnswers, now: Date, previous?: UserProfile): Partial<UserProfile> {
  const ts = now.toISOString()
  const injuries = injuryLines(a.injuries)
  const facilities = [...new Set(a.where.map((w) => FACILITY[w]))]
  const flags: HealthFlag[] = [...(injuries.length ? ['injury' as const] : []), ...(a.medical ? ['condition' as const] : [])]
  const prev = previous?.onboarded ? previous : undefined
  const removed = (prev?.injuries ?? []).filter((i) => !injuries.includes(i))
  const pastInjuries = [...new Set([...(prev?.goal?.health.pastInjuries ?? []), ...removed])]

  const goal: GoalProfile = {
    version: 1,
    origin: 'onboarding',
    pursuit: 'strength',
    statement: STATEMENT,
    strength: { kind: 'all-round' },
    starting: { level: LEVEL[a.activity], activity: a.activity },
    constraints: {
      daysPerWeek: prev?.program?.daysPerWeek ?? DAYS[a.activity],
      sessionMinutes: prev?.goal?.constraints.sessionMinutes ?? 60,
      facilities,
    },
    health: {
      flags,
      ...(a.medical ? { conservative: !a.cleared, ...(a.cleared ? { cleared: true } : {}) } : {}),
      ...(prev?.goal?.health.injuryStatus ? { injuryStatus: prev.goal.health.injuryStatus } : {}),
      ...(pastInjuries.length ? { pastInjuries } : {}),
    },
    deferred: prev?.goal?.deferred.filter((d) => d === 'coaching-tone' || d === 'nutrition') ?? ['coaching-tone'],
    ...(prev?.goal?.askedDeferred ? { askedDeferred: prev.goal.askedDeferred } : {}),
    ...(prev?.goal?.checkInsOff ? { checkInsOff: true } : {}),
    migrated: true,
    answers: { basic: a },
    createdAt: prev?.goal?.createdAt ?? ts,
    updatedAt: ts,
  }

  const background = [
    `Experience (derived): ${goal.starting.level}.`,
    `Activity now: ${ACTIVITY_LABEL[a.activity].toLowerCase()}.`,
    `Trains: ${a.where.map((w) => WHERE_LABEL[w].toLowerCase()).join(', ') || 'not said'}.`,
    a.notes.trim() ? `In their words: ${a.notes.trim().replace(/\s+/g, ' ')}${/[.!?]$/.test(a.notes.trim()) ? '' : '.'}` : '',
  ].filter(Boolean).join(' ')

  return {
    name: a.name.trim() || prev?.name || 'Athlete',
    ...(a.sex ? { sex: a.sex } : {}),
    birthDate: a.age && a.age > 0 && a.age < 120 ? birthDateFromAge(a.age, now) : prev?.birthDate,
    goal,
    goals: [STATEMENT],
    experienceLevel: goal.starting.level,
    fitnessBackground: background,
    injuries,
    gymAccess: facilities.includes('full-gym') || facilities.includes('weights-at-home'),
    programWeek: prev?.programWeek ?? 1,
    program: {
      goals: ['get-strong', 'look-great'],
      exerciseTypes: ['weights'],
      facilities,
      sports: [],
      coachingStyle: prev?.program?.coachingStyle ?? 'balanced',
      lengthWeeks: prev?.program?.lengthWeeks ?? blockLengthWeeks(goal, now),
      startDate: prev?.program?.startDate ?? toLocalISODate(getMonday(now)),
      daysPerWeek: goal.constraints.daysPerWeek,
    },
    ...(prev ? {} : { dietaryNotes: [] }),
    onboarded: true,
  }
}
