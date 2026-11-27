import type { DayOfWeek, LoggedExercise, LoggedSession, PlannedExercise, PlannedSession, UserProfile, WeekPlan } from '../types'
import { profileFromBasics } from './basicOnboarding'
import { DEFAULT_PROFILE } from './profileData'
import { addDays, getMonday, toLocalISODate } from './weekUtils'

/**
 * Demo data for preview builds (every PR's Vercel preview), which run in local
 * mode with no database. Opening one shows a lifter six weeks into a
 * three-day program: a plan for this week, every earlier session logged, and
 * steadily rising weights, so Home, the workout, History and Progress all
 * have something real to show. Production builds never load it (see
 * `demoAction` and VITE_DEMO_DATA in vite.config.ts).
 */

export interface DemoData {
  profile: UserProfile
  weekPlans: WeekPlan[]
  loggedSessions: LoggedSession[]
}

/** Weeks of history before the current one. */
const PAST_WEEKS = 6

interface Lift {
  name: string
  reps: number
  /** Week-0 working weight and the weekly increase, in kg. */
  start: number
  step: number
  restSeconds: number
  /** A timed hold: `start`/`step` are seconds, and there's no weight. */
  timed?: boolean
}

interface Template {
  key: string
  day: DayOfWeek
  offset: number
  title: string
  focus: string
  lifts: Lift[]
}

const TEMPLATES: Template[] = [
  {
    key: 'upper', day: 'Mon', offset: 0, title: 'Upper Body', focus: 'Chest, back, shoulders, arms',
    lifts: [
      { name: 'Barbell Bench Press', reps: 6, start: 50, step: 2.5, restSeconds: 150 },
      { name: 'Barbell Row', reps: 8, start: 45, step: 2.5, restSeconds: 120 },
      { name: 'Overhead Press', reps: 8, start: 30, step: 1.25, restSeconds: 120 },
      { name: 'Lat Pulldown', reps: 10, start: 45, step: 2.5, restSeconds: 90 },
    ],
  },
  {
    key: 'lower', day: 'Wed', offset: 2, title: 'Lower Body', focus: 'Quads, hamstrings, glutes, core',
    lifts: [
      { name: 'Barbell Squat', reps: 5, start: 60, step: 2.5, restSeconds: 180 },
      { name: 'Romanian Deadlift', reps: 8, start: 55, step: 2.5, restSeconds: 120 },
      { name: 'Leg Press', reps: 10, start: 100, step: 5, restSeconds: 90 },
      { name: 'Plank', reps: 0, start: 40, step: 5, restSeconds: 60, timed: true },
    ],
  },
  {
    key: 'full', day: 'Fri', offset: 4, title: 'Full Body', focus: 'Posterior chain, push, pull',
    lifts: [
      { name: 'Deadlift', reps: 5, start: 80, step: 5, restSeconds: 180 },
      { name: 'Dumbbell Bench Press', reps: 10, start: 20, step: 1, restSeconds: 90 },
      { name: 'Seated Cable Row', reps: 10, start: 45, step: 2.5, restSeconds: 90 },
      { name: 'Dumbbell Lateral Raise', reps: 12, start: 6, step: 0.5, restSeconds: 60 },
    ],
  },
]

const SETS = 3
const roundTo = (kg: number, step: number) => Math.round(kg / step) * step

export function buildDemoData(now: Date): DemoData {
  const today = toLocalISODate(now)
  const thisMonday = getMonday(now)
  const firstMonday = addDays(thisMonday, -7 * PAST_WEEKS)

  const weekPlans: WeekPlan[] = []
  const loggedSessions: LoggedSession[] = []
  for (let week = 0; week <= PAST_WEEKS; week++) {
    const monday = addDays(firstMonday, 7 * week)
    const weekStartDate = toLocalISODate(monday)
    const planId = `plan-${weekStartDate}`
    const sessions = TEMPLATES.map((t) => plannedSession(t, toLocalISODate(addDays(monday, t.offset)), week))
    weekPlans.push({
      id: planId,
      weekStartDate,
      availableDays: TEMPLATES.map((t) => t.day),
      userNotes: '',
      sessions,
      createdAt: addDays(monday, -1).toISOString(),
    })
    for (const s of sessions) if (s.date < today) loggedSessions.push(loggedSession(s, planId))
  }

  const basics = profileFromBasics(
    {
      name: 'Demo Lifter',
      sex: 'female',
      age: 34,
      activity: '3x+',
      where: ['gym'],
      injuries: 'Left knee: sore at the bottom of deep squats',
      medical: false,
      cleared: false,
      notes: 'Wants a stronger squat and deadlift.',
    },
    firstMonday,
  )
  const program = basics.program ?? DEFAULT_PROFILE.program
  const profile: UserProfile = {
    ...DEFAULT_PROFILE,
    ...basics,
    program: program && { ...program, startDate: toLocalISODate(firstMonday) },
    programWeek: PAST_WEEKS + 1,
    onboarded: true,
    updatedAt: now.toISOString(),
  }

  return { profile, weekPlans, loggedSessions }
}

function plannedSession(t: Template, date: string, week: number): PlannedSession {
  const exercises: PlannedExercise[] = t.lifts.map((lift, i) => {
    const amount = lift.start + lift.step * week
    return {
      id: `ex-${date}-${t.key}-${i + 1}`,
      name: lift.name,
      sets: Array.from({ length: SETS }, () =>
        lift.timed
          ? { reps: '', restSeconds: lift.restSeconds, durationSeconds: amount }
          : { reps: String(lift.reps), rpe: 8, restSeconds: lift.restSeconds, suggestedWeightKg: amount },
      ),
    }
  })
  const main = t.lifts[0]
  const work = main.start + main.step * week
  return {
    id: `session-${date}-${t.key}`,
    date,
    dayOfWeek: t.day,
    type: 'weights',
    title: t.title,
    focus: t.focus,
    estimatedMinutes: 55,
    intensity: 'moderate',
    warmup: `3 min easy row, then ramp up to ${work}kg on the ${main.name.toLowerCase()}`,
    warmupExercises: [
      { name: 'Rowing Machine', prescription: '3 min easy' },
      {
        name: main.name,
        prescription: `10 × ${roundTo(work * 0.45, 2.5)}kg, 6 × ${roundTo(work * 0.7, 2.5)}kg, 3 × ${roundTo(work * 0.85, 2.5)}kg`,
      },
    ],
    exercises,
  }
}

function loggedSession(s: PlannedSession, weekPlanId: string): LoggedSession {
  const [y, m, d] = s.date.split('-').map(Number)
  const startedAt = new Date(y, m - 1, d, 18, 0)
  const loggedExercises: LoggedExercise[] = (s.exercises ?? []).map((ex) => ({
    plannedExerciseId: ex.id,
    name: ex.name,
    sets: ex.sets.map((set, setIndex) => ({
      setIndex,
      targetReps: set.reps,
      ...(set.durationSeconds
        ? { actualSeconds: set.durationSeconds }
        : { actualReps: Number(set.reps), weightKg: set.suggestedWeightKg }),
      completed: true,
      skipped: false,
      workSeconds: 40,
    })),
  }))
  return {
    id: `demo-log-${s.date}`,
    plannedSessionId: s.id,
    weekPlanId,
    date: s.date,
    type: s.type,
    title: s.title,
    focus: s.focus,
    startedAt: startedAt.toISOString(),
    completedAt: new Date(startedAt.getTime() + 55 * 60_000).toISOString(),
    status: 'complete',
    outcome: 'as-planned',
    rpe: 7,
    loggedExercises,
  }
}

/**
 * What to do with demo data when the app starts: seed an empty demo build,
 * re-seed on `?demo=reset`, and never touch a build without demo data.
 */
export function demoAction(input: { demoBuild: boolean; onboarded: boolean; search: string }): 'seed' | 'reset' | null {
  if (!input.demoBuild) return null
  if (new URLSearchParams(input.search).get('demo') === 'reset') return 'reset'
  return input.onboarded ? null : 'seed'
}
