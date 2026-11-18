import type { DayOfWeek, PlannedExercise, PlannedSession, PlannedSet, WeekPlan } from '../types'
import { WEEK_DAYS_MON, addDays, parseLocalISODate, toLocalISODate } from './weekUtils'

/**
 * Prewritten plans: ready-made weeks the athlete can drop into the planner in
 * one tap (Plan → Prewritten plans), no Claude round trip.
 *
 * They're shared by every athlete, so they carry no working weights: the
 * athlete fills those in as they log, and "Repeat last week" carries them
 * forward. Ramp-up sets are written as a share of the work weight for the
 * same reason. Exercise names follow CLAUDE.md rule 10 (standard gym names).
 */

/** A session without its date: placed on `dayOfWeek` of the chosen week. */
export interface TemplateSession extends Omit<PlannedSession, 'id' | 'date' | 'exercises'> {
  /** Id stem, e.g. "upper-a" → "session-2026-11-23-upper-a". */
  slug: string
  /** Exercise ids are stems too, dated when the plan is built. */
  exercises: PlannedExercise[]
}

export interface PlanTemplate {
  id: string
  name: string
  /** One or two lines for the card. */
  summary: string
  /** What the athlete needs, shown as a badge. */
  equipment: string
  sessions: TemplateSession[]
}

/** `n` identical sets. */
function sets(n: number, set: PlannedSet): PlannedSet[] {
  return Array.from({ length: n }, () => ({ ...set }))
}

const RAMP_UP_NOTE = 'Ramp-up to your work sets: light, crisp reps, not logged'

const BOND_SPLIT: PlanTemplate = {
  id: 'bond-split',
  name: 'Bond Split',
  summary: 'Upper / lower / upper on Mon, Wed and Fri: heavy compound lifts first, then supersets for shoulders and arms.',
  equipment: 'Full gym',
  sessions: [
    {
      slug: 'upper-a',
      dayOfWeek: 'Mon',
      type: 'weights',
      title: 'Upper A',
      focus: 'Chest, back, shoulders, arms',
      estimatedMinutes: 60,
      intensity: 'hard',
      warmup: '5 min easy row, upper-back and shoulder mobility, band work, press ramp-up',
      warmupExercises: [
        { name: 'Rowing Machine', prescription: '5 min easy', notes: 'Conversational pace, just get warm' },
        { name: 'Cat Stretch', prescription: '8 slow reps' },
        { name: 'Open Book', prescription: '6 each side', notes: 'Thoracic rotation' },
        { name: 'Band Pull-Apart', prescription: '2 × 15', notes: 'Shoulder prehab before pressing' },
        { name: 'Band Dislocate', prescription: '10', notes: 'Wide grip, slow' },
        { name: 'Dumbbell Bench Press', prescription: '10 × ~45%, 6 × ~70%, 3 × ~90% of your work weight', notes: RAMP_UP_NOTE },
      ],
      exercises: [
        { id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', coachNotes: 'Flat bench, weight is per dumbbell. Shoulder blades pinned back, 2s lowering', sets: sets(3, { reps: '6-8', rpe: 8, restSeconds: 120 }) },
        { id: 'lat-pulldown', name: 'Lat Pulldown', coachNotes: 'Pull to the upper chest, full stretch at the top', sets: sets(4, { reps: '8-10', rpe: 8, restSeconds: 90 }) },
        { id: 'cable-fly', name: 'Cable Fly', coachNotes: 'Weight is per side. Soft elbows, deep stretch, squeeze at the middle', sets: sets(3, { reps: '12', rpe: 8, restSeconds: 60 }) },
        { id: 'seated-lateral-raise', name: 'Seated Lateral Raise', coachNotes: 'Superset: go straight into the heavy standing lateral raises, no rest', sets: sets(3, { reps: '15', rpe: 8, restSeconds: 0 }) },
        { id: 'standing-lateral-raise', name: 'Standing Lateral Raise', coachNotes: 'Heavy half of the superset. A little body English is fine, control the lowering', sets: sets(3, { reps: '15', rpe: 9, restSeconds: 60 }) },
        { id: 'cable-bicep-curl', name: 'Cable Bicep Curl', coachNotes: 'Superset with tricep pushdowns, no rest between', sets: sets(3, { reps: '15', rpe: 8, restSeconds: 0 }) },
        { id: 'tricep-pushdown', name: 'Tricep Pushdown', coachNotes: 'Elbows pinned to your sides', sets: sets(3, { reps: '15', rpe: 8, restSeconds: 60 }) },
      ],
      cooldown: 'Easy walk, then chest, lat and shoulder stretches',
      cooldownExercises: [
        { name: 'Walking', prescription: '2 min easy' },
        { name: 'Chest Stretch', prescription: '45s each side', notes: 'Use a doorway' },
        { name: 'Lat Stretch', prescription: '45s each side' },
        { name: 'Cross-Body Shoulder Stretch', prescription: '30s each side' },
      ],
    },
    {
      slug: 'lower',
      dayOfWeek: 'Wed',
      type: 'weights',
      title: 'Lower',
      focus: 'Quads, hamstrings, glutes, calves',
      estimatedMinutes: 60,
      intensity: 'hard',
      warmup: '5 min easy bike, hip and ankle mobility, glute activation, squat ramp-up',
      warmupExercises: [
        { name: 'Stationary Bike', prescription: '5 min easy' },
        { name: "World's Greatest Stretch", prescription: '5 each side' },
        { name: '90/90 Hip Switch', prescription: '8 each side' },
        { name: 'Ankle Dorsiflexion Rock', prescription: '10 each side' },
        { name: 'Glute Bridge', prescription: '2 × 10' },
        { name: 'Barbell Squat', prescription: '8 × empty bar, 5 × ~55%, 3 × ~75%, 1 × ~90% of your work weight', notes: RAMP_UP_NOTE },
      ],
      exercises: [
        { id: 'barbell-squat', name: 'Barbell Squat', coachNotes: 'Heavy and low reps, with a rep or two left in the tank. Brace hard, controlled descent', sets: sets(3, { reps: '2-4', rpe: 7, restSeconds: 180 }) },
        { id: 'romanian-deadlift', name: 'Romanian Deadlift', coachNotes: 'Barbell. Hips back, bar close, stop when the hamstrings are stretched', sets: sets(3, { reps: '2-4', rpe: 7, restSeconds: 180 }) },
        { id: 'kettlebell-split-squat', name: 'Kettlebell Split Squat', coachNotes: 'Goblet hold. Back knee to just above the floor', sets: sets(3, { reps: '4-6 each leg', rpe: 8, restSeconds: 120 }) },
        { id: 'kettlebell-single-leg-rdl', name: 'Kettlebell Single-Leg Romanian Deadlift', coachNotes: 'Kettlebell in the opposite hand, hips square', sets: sets(3, { reps: '4-6 each leg', rpe: 8, restSeconds: 90 }) },
        { id: 'single-leg-glute-bridge-hold', name: 'Single-Leg Glute Bridge Hold', coachNotes: 'Each set is 20s on each side. Hips level, squeeze hard', sets: sets(2, { reps: '', restSeconds: 45, durationSeconds: 20 }) },
        { id: 'calf-raise-isohold', name: 'Calf Raise Isohold', coachNotes: 'Hold at the top of a calf raise, heels as high as they go', sets: sets(3, { reps: '', restSeconds: 45, durationSeconds: 20 }) },
      ],
      cooldown: 'Easy walk, then hip-flexor, hamstring, glute and calf stretches',
      cooldownExercises: [
        { name: 'Walking', prescription: '2 min easy' },
        { name: 'Couch Stretch', prescription: '60s each side' },
        { name: 'Seated Hamstring Stretch', prescription: '60s each side' },
        { name: 'Pigeon Pose', prescription: '60s each side' },
        { name: 'Calf Stretch', prescription: '45s each side' },
      ],
    },
    {
      slug: 'upper-b',
      dayOfWeek: 'Fri',
      type: 'weights',
      title: 'Upper B',
      focus: 'Chest, back, shoulders, rear delts, arms',
      estimatedMinutes: 70,
      intensity: 'hard',
      warmup: '5 min easy row, upper-back and shoulder mobility, band work, bench ramp-up',
      warmupExercises: [
        { name: 'Rowing Machine', prescription: '5 min easy' },
        { name: 'Cat Stretch', prescription: '8 slow reps' },
        { name: 'Open Book', prescription: '6 each side' },
        { name: 'Band Pull-Apart', prescription: '2 × 15' },
        { name: 'Scapular Pull-Up', prescription: '8', notes: 'Primes the lats for pull-ups' },
        { name: 'Barbell Bench Press', prescription: '10 × empty bar, 6 × ~65%, 3 × ~80%, 1 × ~90% of your work weight', notes: RAMP_UP_NOTE },
      ],
      exercises: [
        { id: 'barbell-bench-press', name: 'Barbell Bench Press', coachNotes: 'Feet planted, slight arch, bar to the lower chest', sets: sets(3, { reps: '4-6', rpe: 8, restSeconds: 180 }) },
        { id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', coachNotes: 'Weight is per dumbbell, 30-45° bench', sets: sets(3, { reps: '6-8', rpe: 8, restSeconds: 120 }) },
        { id: 'pull-up', name: 'Pull-Up', coachNotes: 'Bodyweight. Stop each set 1-2 reps short of failure', sets: sets(3, { reps: 'AMRAP', rpe: 8, restSeconds: 120 }) },
        { id: 'cable-fly', name: 'Cable Fly', coachNotes: 'Weight is per side. Soft elbows, deep stretch', sets: sets(3, { reps: '12', rpe: 8, restSeconds: 60 }) },
        { id: 'seated-lateral-raise', name: 'Seated Lateral Raise', coachNotes: 'Superset: go straight into the heavy standing lateral raises, no rest', sets: sets(3, { reps: '15', rpe: 8, restSeconds: 0 }) },
        { id: 'standing-lateral-raise', name: 'Standing Lateral Raise', coachNotes: 'Heavy half of the superset', sets: sets(3, { reps: '15', rpe: 9, restSeconds: 60 }) },
        { id: 'rear-delt-fly', name: 'Rear Delt Fly', coachNotes: 'Weight is per dumbbell. Lead with the elbows, no swinging', sets: sets(2, { reps: '15', rpe: 8, restSeconds: 60 }) },
        { id: 'cable-bicep-curl', name: 'Cable Bicep Curl', coachNotes: 'Superset with tricep pushdowns, no rest between', sets: sets(3, { reps: '15', rpe: 8, restSeconds: 0 }) },
        { id: 'tricep-pushdown', name: 'Tricep Pushdown', coachNotes: 'Elbows pinned to your sides', sets: sets(3, { reps: '15', rpe: 8, restSeconds: 60 }) },
      ],
      cooldown: 'Easy walk, then chest, lat and rear-shoulder stretches',
      cooldownExercises: [
        { name: 'Walking', prescription: '2 min easy' },
        { name: 'Chest Stretch', prescription: '45s each side' },
        { name: 'Lat Stretch', prescription: '45s each side' },
        { name: 'Cross-Body Shoulder Stretch', prescription: '30s each side' },
      ],
    },
  ],
}

export const PLAN_TEMPLATES: PlanTemplate[] = [BOND_SPLIT]

/** The template's training days, Monday first. */
export function templateDays(t: PlanTemplate): DayOfWeek[] {
  return WEEK_DAYS_MON.filter((d) => t.sessions.some((s) => s.dayOfWeek === d))
}

/** Builds a `WeekPlan` for the week starting `weekStart` (a local ISO Monday). */
export function planFromTemplate(t: PlanTemplate, weekStart: string, now: Date = new Date()): WeekPlan {
  const monday = parseLocalISODate(weekStart)
  const sessions: PlannedSession[] = t.sessions.map(({ slug, exercises, ...s }) => {
    const date = toLocalISODate(addDays(monday, WEEK_DAYS_MON.indexOf(s.dayOfWeek)))
    return {
      ...s,
      id: `session-${date}-${slug}`,
      date,
      warmupExercises: s.warmupExercises?.map((r) => ({ ...r })),
      cooldownExercises: s.cooldownExercises?.map((r) => ({ ...r })),
      exercises: exercises.map((e) => ({ ...e, id: `ex-${date}-${e.id}`, sets: e.sets.map((set) => ({ ...set })) })),
    }
  })
  return {
    id: `plan-${weekStart}`,
    weekStartDate: weekStart,
    availableDays: templateDays(t),
    userNotes: '',
    createdAt: now.toISOString(),
    sessions,
  }
}
