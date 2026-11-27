import type { DayOfWeek, InjuryStatus, LoggedSession, ProgramExerciseType, ProgramFacility, SessionType, UserProfile, WeekPlan } from '../types'
import { format } from 'date-fns'
import { WEEK_DAYS_MON, addDays, toLocalISODate } from './weekUtils'
import { summarizeHistory } from './historySummary'
import { getProgramProgress } from './programProgress'
import { ageFromBirthDate } from './dateUtils'
import { daysPerWeekLabel } from './programOptions'
import { buildGoalSection } from './goalPrompt'

/**
 * Builds the prompt the user pastes into Claude.
 *
 * The prompt is fully SELF-CONTAINED: it embeds the athlete's profile, a
 * *summarised* training history (see `summarizeHistory`), the programming
 * rules and the `WeekPlan` JSON schema, so it works anywhere (claude.ai can't
 * read the repo).
 *
 * It's also TAILORED: every rule, schema field and example is chosen from
 * what the athlete set up (`promptScope`). The app is weights-first, so no
 * prompt asks for cardio sessions; home-workout athletes are held to their
 * equipment, and so on. CLAUDE.md is
 * the full, general reference; this is the per-athlete cut of it.
 *
 * Keep the rules/schema here in sync with `CLAUDE.md` and `src/types/index.ts`.
 *
 * `weekStart` is the Monday the plan targets — resolved by the caller from the
 * selected days (this week vs. next week), so the prompt, the on-screen label
 * and the imported plan all agree on which week is being planned.
 */

// --- scope ----------------------------------------------------------------------

export interface PromptScope {
  /** Cardio sessions: only ever in the convert-my-plan prompt (`ALL`). */
  cardio: boolean
  mobility: boolean
  /** Session types Claude may use, in schema order. */
  sessionTypes: SessionType[]
  facilities: ProgramFacility[]
  /** How strength work should be shaped, from the goal. */
  strengthFocus: 'physique' | 'lifts' | 'event' | 'sport' | 'general'
  diet: boolean
}

/**
 * What this athlete's prompt covers, from their onboarding (training types,
 * equipment, goal). A profile with no training types set (pre-onboarding
 * data) gets everything, so nothing is ever lost.
 */
export function promptScope(profile: UserProfile): PromptScope {
  const types = profile.program?.exerciseTypes ?? []
  const has = (t: ProgramExerciseType) => types.length === 0 || types.includes(t)
  // Weights-first: every plan is built around lifting, and cardio is never
  // scheduled (athletes log any cardio by hand). Mobility days only when asked.
  const mobility = has('mobility')
  const sessionTypes: SessionType[] = [
    'weights',
    ...(mobility ? ['active-recovery' as const] : []),
  ]
  const goal = profile.goal
  const strengthFocus: PromptScope['strengthFocus'] =
    goal?.pursuit === 'physique' ? 'physique'
      : goal?.pursuit === 'strength' && goal.strength?.kind === 'lifts' ? 'lifts'
        : goal?.pursuit === 'event' ? 'event'
          : goal?.pursuit === 'sport' ? 'sport'
            : profile.program?.goals.includes('look-great') ? 'physique' : 'general'
  return {
    cardio: false, mobility, sessionTypes,
    facilities: profile.program?.facilities ?? [],
    strengthFocus,
    diet: profile.dietaryNotes.length > 0,
  }
}

function coachRole(profile: UserProfile): string {
  const sport = profile.goal?.sport?.name
  return sport ? `an experienced strength & conditioning coach for ${sport}` : 'an experienced strength coach'
}

/** The equipment rule, or null when the athlete hasn't said (older profiles). */
function equipmentRule(f: ProgramFacility[]): string | null {
  if (!f.length) return null
  if (f.includes('full-gym')) {
    return '**Equipment:** I train in a full gym (free weights, racks, cables and machines).'
  }
  if (f.includes('weights-at-home')) {
    return '**Equipment — home only:** I train at home with my own weights. Assume dumbbells (and a mat) unless my notes say I have more: no machines, cables or barbell racks.'
  }
  return '**Equipment — bodyweight only:** I train with my bodyweight and a mat. No weights, machines or bars: build every exercise from bodyweight progressions (tempo, range, single-leg/arm, pauses).'
}

function strengthRule(s: PromptScope, profile: UserProfile): string {
  switch (s.strengthFocus) {
    case 'physique':
      return `**Balanced physique:** Across the week hit every major muscle group with
   roughly even volume — push (chest/triceps), pull (back/biceps), legs
   (quads/hamstrings/glutes/calves), shoulders and core. Don't let one area
   dominate. Each session's \`focus\` should be honest and cover a coherent group
   of muscles.`
    case 'lifts':
      return `**Build the main lifts:** Organise sessions around the squat, bench press,
   deadlift and overhead press, progressing from my current working weights,
   with accessories that fix weak points and keep push, pull and legs in
   balance.`
    case 'event':
      return `**Strength supports my event:** Keep strength sessions short and focused on
   legs, posterior chain, core and durability. Keep them away from my
   key sessions: no heavy legs the day before a hard session or long effort.`
    case 'sport': {
      const wants = profile.goal?.sport?.wants ?? []
      return `**Strength for my sport:** Emphasise ${wants.length ? wants.join(' and ') : 'power, strength and resilience'}, and
   never put heavy lower-body work within 48 hours before a match.`
    }
    default:
      return `**Balanced, full-body development:** Across the week hit every major muscle
   group with roughly even volume — push (chest/triceps), pull (back/biceps),
   legs (quads/hamstrings/glutes/calves), shoulders and core. Don't let one area
   dominate. Each session's \`focus\` should be honest and cover a coherent group
   of muscles.`
  }
}

// --- output contract --------------------------------------------------------------

/**
 * The WeekPlan schema and JSON rules, cut to the session types this athlete
 * can get (the convert-my-plan prompt passes `ALL`).
 */
function outputSection(weekStartISO: string, selectedDays: DayOfWeek[], s: PromptScope): string {
  const focusHint = ['muscle groups', s.cardio && 'cardio type'].filter(Boolean).join(' or ')
  const typeLine = s.sessionTypes.map((t) => `"${t}"`).join(' | ')
  const sessionFields = [
    `  exercises${s.cardio ? '?' : ''}: PlannedExercise[],  // ${s.cardio ? 'for weights sessions' : 'the session’s exercises'}`,
    s.cardio && `  workout?: WorkoutItem[],        // for cardio sessions (see below)`,
    s.cardio && `  cardioOptions?: CardioType[]    // modalities to choose between at the start.
                                  // First entry is the default. Drives split
                                  // units (run → /km, row → /500m, swim →
                                  // /100m, bike → km/h). Omit when the modality
                                  // is fixed.`,
  ].filter(Boolean).join('\n')

  const exerciseSchema = `
PlannedExercise {
  id: string,
  name: string,
  coachNotes?: string,
  sets: PlannedSet[]
}

PlannedSet {
  reps: string,                   // e.g. "8-10" or "12" or "AMRAP"
  rpe?: number,                   // 1-10
  restSeconds: number,
  suggestedWeightKg?: number,     // may be a decimal, e.g. 22.5
  durationSeconds?: number        // for TIMED holds (e.g. plank). When set, the
                                  // app shows a stopwatch instead of a
                                  // reps/weight row; set reps to "" and give no
                                  // weight.
}
`

  const workoutSchema = s.cardio ? `
// CardioType = "run" | "row" | "bike" | "swim" | "other"

WorkoutItem = WorkoutStep | RepeatBlock

WorkoutStep {
  kind: "step",
  role: "warmup" | "work" | "recover" | "steady" | "cooldown",
  end: { by: "time", seconds: number }      // ends by itself
     | { by: "distance", meters: number }   // I press LAP at the distance
     | { by: "lap" },                       // ends when I press LAP
  effort: "recovery" | "easy" | "steady" | "marathon" | "threshold"
        | "interval" | "repetition" | "sprint",
  target?: string,                // only to override the app's pace, e.g.
                                  // "rate 20", "200 W", "12 km/h"
  recovery?: "stand" | "walk" | "jog",   // for recover steps
  cue?: string                    // short coaching cue
}

RepeatBlock {
  kind: "repeat",
  times: number,
  steps: WorkoutItem[],           // nest at most 2 deep: 2 × (4 × 400 m)
  everySeconds?: number,          // send-off cycle, e.g. swim "on 1:45"
  skipLastRecovery?: boolean      // no recovery after the final rep
}
` : ''

  const metric = ['weights in kg', s.cardio && 'distances in m or km, paces per km, speeds in km/h'].filter(Boolean).join('; ')
  const numericFields = ['`suggestedWeightKg`', s.cardio && '`meters`', s.cardio && '`seconds`'].filter(Boolean).join(', ')
  const unitsRule = `
- **Metric units only** (${metric}), even where my notes or plan use lb or
  miles: convert them. In text, put the number right before its unit (e.g.
  "8 × 12kg"${s.cardio ? ', "400 m", "5 km", "4:45/km"' : ''}); ${numericFields} are plain numbers. The app
  converts everything to my display units.`

  const cardioSection = s.cardio ? `

## Cardio workouts

The app plays the workout in **Run Mode**: it times every step and plays a
tone at each change, so I never need a separate stopwatch. Build it like this:

- The easy running (or rowing, cycling…) warm-up and cool-down are workout
  steps (\`role: "warmup"\` / \`"cooldown"\`) so Run Mode times them. Drills and
  strides stay in \`warmupExercises\`, done before I press Start.
- A continuous run is just steps back to back, e.g. 30′ easy then 10′ steady.
- Pick effort words, not paces: the app converts them to my pace zones for
  the modality I choose, or to RPE when it has no zones.
- Respect what I can measure: with only a phone, end reps by **time**.

Example ("15 min easy, 6 × 3 min at interval effort with 90 s jog, 10 min easy"):

\`\`\`json
"workout": [
  { "kind": "step", "role": "warmup", "end": { "by": "time", "seconds": 900 }, "effort": "easy" },
  { "kind": "repeat", "times": 6, "skipLastRecovery": true, "steps": [
    { "kind": "step", "role": "work", "end": { "by": "time", "seconds": 180 }, "effort": "interval", "cue": "Quick feet, relaxed shoulders" },
    { "kind": "step", "role": "recover", "end": { "by": "time", "seconds": 90 }, "effort": "recovery", "recovery": "jog" }
  ]},
  { "kind": "step", "role": "cooldown", "end": { "by": "time", "seconds": 600 }, "effort": "easy" }
]
\`\`\`` : ''

  return `## Output: \`WeekPlan\` JSON schema

Output a single \`\`\`json code block first, then a short plain-English summary of
the week. I paste the JSON straight into the app, so it must parse:

- **Strict JSON only** — double-quoted keys and strings, no comments, no trailing
  commas, no \`undefined\`. Leave optional fields out rather than setting them to null.
- Only use the fields in the schema below; use the exact string values shown
  for \`type\`, \`intensity\`, \`dayOfWeek\`${s.cardio ? ' and `cardioOptions`' : ''}.${unitsRule}
- Every \`id\` must be unique across the whole plan. Put the date in each
  session id, e.g. \`"session-${weekStartISO}-upper"\`, so it never repeats an
  earlier week's.
- \`sessions\` has exactly one entry per training day listed above, with that
  day's date.

The schema below is TypeScript notation for reference — the \`//\` comments
explain fields and must NOT appear in your JSON.

\`\`\`typescript
{
  id: string,                     // e.g. "plan-${weekStartISO}"
  weekStartDate: string,          // ISO date of Monday, e.g. "${weekStartISO}"
  availableDays: DayOfWeek[],     // ${JSON.stringify([...selectedDays].sort((a, b) => WEEK_DAYS_MON.indexOf(a) - WEEK_DAYS_MON.indexOf(b)))}
  userNotes: string,
  createdAt: string,              // ISO timestamp
  sessions: PlannedSession[]
}

PlannedSession {
  id: string,                     // unique, with the date (see above)
  date: string,                   // ISO date
  dayOfWeek: DayOfWeek,
  type: ${typeLine},
  title: string,
  focus: string,                  // ${focusHint}
  estimatedMinutes: number,
  intensity: "easy" | "moderate" | "hard",
  warmup: string,                 // REQUIRED: one-line summary of the warm-up
  warmupExercises: RoutineItem[], // REQUIRED: the warm-up, in order, 2–4 moves
                                  // (see "Warm-up format")
  cooldown?: string,              // optional one-line cool-down summary
  cooldownExercises?: RoutineItem[], // optional: at most 2 stretches
${sessionFields}
}

RoutineItem {
  name: string,                   // standard exercise name, e.g. "Cat Stretch"
  prescription: string,           // REQUIRED: e.g. "10 each side", "60s",
                                  // "2 × 10", "8 × 12kg, 5 × 18kg"
  notes?: string                  // cue or purpose
}
${exerciseSchema}${workoutSchema}\`\`\`${cardioSection}`
}

/** Everything, for prompts that must accept any session (convert-my-plan). */
const ALL: PromptScope = {
  cardio: true, mobility: true, sessionTypes: ['weights', 'cardio', 'active-recovery'],
  facilities: [], strengthFocus: 'general', diet: false,
}

// --- warm-up -------------------------------------------------------------------------

/** The warm-up spec for the weekly prompt (weights, plus mobility days when asked). */
function warmupSection(s: PromptScope): string {
  const f = s.facilities
  const gym = f.includes('full-gym') || !f.length
  const moves = [
    gym
      ? `**Weights sessions:** ramp-up sets for the first main lift (and any later
    lift much heavier than what came before): 2–3 lighter sets with falling reps
    at roughly 40–50%, 70% and 85–90% of the working weight you set, with the
    actual kg in the \`prescription\`, rounded to loadable jumps. In sessions of
    45 min or more, start with up to 5 min easy on a bike or rower and add 1–2
    mobility moves for the joints the session loads.`
      : `**Weights sessions:** an easier version of the first exercise (e.g. incline
    push-ups before push-ups, bodyweight squats before goblet squats), then
    ramp-up sets with the actual kg if the first exercise is loaded. In sessions
    of 45 min or more, add 1–2 mobility moves for the joints the session loads.`,
    s.mobility && `**Active recovery:** a gentle move or two into the session's first positions.`,
  ].filter(Boolean)

  const example = gym
    ? `"warmup": "5 min easy row, hip and upper-back mobility, ramp-up sets",
"warmupExercises": [
  { "name": "Rowing Machine", "prescription": "5 min easy", "notes": "Conversational pace, just get warm" },
  { "name": "World's Greatest Stretch", "prescription": "5 each side", "notes": "Opens hips and upper back" },
  { "name": "Dumbbell Bench Press", "prescription": "10 × 10kg, 6 × 16kg, 3 × 20kg", "notes": "Ramp-up to the 22.5kg work sets: light, crisp reps, not logged" }
]`
    : `"warmup": "Easy squats and incline push-ups before the first exercise",
"warmupExercises": [
  { "name": "Bodyweight Squat", "prescription": "2 × 10", "notes": "Easy range first, then full depth" },
  { "name": "Incline Push-Up", "prescription": "2 × 8", "notes": "An easier version of the first exercise" }
]`

  return `## Warm-up format

The app shows each session's warm-up as a one-line summary that expands into
a short checklist, with a movement guide for every move. Keep it short and use
the session's own equipment:

- \`warmup\`: one line summarising the warm-up.
- \`warmupExercises\`: 2–4 moves, in the order I do them (count them in
  \`estimatedMinutes\`):
${moves.map((m) => `  - ${m}`).join('\n')}
- **Every move needs a \`prescription\`**: reps, sets × reps, time or distance,
  e.g. "2 × 10", "60s", "5 min easy", "10 each side", "8 × 12kg, 5 × 18kg". Use
  \`notes\` for the cue or why the move is there.
- The cool-down is optional: leave \`cooldown\` and \`cooldownExercises\` out
  unless the session has time to spare, and then give at most two stretches
  (30–60s holds) for the muscles worked.
- Warm-up moves aren't logged, so don't repeat them in \`exercises\`.

Example of the shape (base the real moves and loads on each session and my
working weights; don't copy these):

\`\`\`json
${example}
\`\`\``
}

// --- the prompt ----------------------------------------------------------------------

/** How a niggle's saved status reads in the prompt. */
const STATUS_WORDS: Record<InjuryStatus, string> = { active: 'unchanged', improving: 'improving', worse: 'worse this week' }

export function buildWeekPlanPrompt(
  selectedDays: DayOfWeek[],
  userNotes: string,
  sessionMinutes: number,
  existingPlan: WeekPlan | undefined,
  weekStart: Date,
  profile: UserProfile,
  loggedSessions: LoggedSession[],
): string {
  const s = promptScope(profile)
  const weekEnd = addDays(weekStart, 6)
  const weekLabel = `${format(weekStart, 'dd MMM')} – ${format(weekEnd, 'dd MMM yyyy')}`
  const weekStartISO = toLocalISODate(weekStart)

  // Spell out each training day's exact date so Claude doesn't have to do date
  // math (a wrong date lands the session on the wrong day in the app).
  const dayLines = WEEK_DAYS_MON
    .map((day, i) => ({ day, i }))
    .filter(({ day }) => selectedDays.includes(day))
    .map(({ day, i }) => `  - ${day} → \`${toLocalISODate(addDays(weekStart, i))}\``)
    .join('\n')

  // Where this week sits in the athlete's program block, measured at the
  // planned week (which may be next week) rather than today.
  const progress = getProgramProgress(profile, weekStart)
  const blockLine = progress.isComplete
    ? `Week ${progress.rawWeek} — past the end of my ${progress.length}-week block. Treat it as a continuation week and keep progressing sensibly.`
    : `Week ${progress.week} of ${progress.length}`

  const replaceNote = existingPlan
    ? '\n_Note: a plan already exists for this week — generate a fresh one to replace it._'
    : ''

  const age = ageFromBirthDate(profile.birthDate)
  const goalSection = buildGoalSection(profile, weekStart)

  const program = profile.program
  const programBlock = program
    ? [
        `- **Goals:** ${program.goals.join(', ') || '—'}`,
        `- **Session types:** ${s.sessionTypes.join(', ')} (only plan these)`,
        `- **Facilities:** ${program.facilities.join(', ') || '—'}`,
        `- **Preferred frequency:** ${program.daysPerWeek ? `about ${daysPerWeekLabel(program.daysPerWeek)} days a week` : '—'}`,
        `- **Coaching style:** ${program.coachingStyle}`,
      ].filter(Boolean).join('\n')
    : '- (no standing program preferences set)'

  // Each niggle is stated once, with its saved status; nothing at all when there are none.
  const status = profile.goal?.health.injuryStatus ?? {}
  const niggles = profile.injuries.map((i) => (status[i] ? `${i} (${STATUS_WORDS[status[i]]})` : i))
  const everyMuscleTwice = s.strengthFocus === 'physique' || s.strengthFocus === 'lifts' || s.strengthFocus === 'general'

  // The rules that apply to this athlete, numbered as they come.
  const rules: string[] = [
    niggles.length ? `**Train around my niggles:** For each niggle in my profile, change only the
   exercises that provoke it (a different variation, range of motion or
   load) and train everything else normally. Say what you changed once, in a
   short note on that exercise. For one marked "worse this week", go
   lighter on the movements that load it this week. Don't add rehab or
   "protective" moves unless I ask, and leave medical advice to the app.` : '',
    s.diet ? `**Respect my dietary needs** (${profile.dietaryNotes.join('; ')}) in any nutrition
   suggestions; they don't otherwise change the programming.` : '',
    equipmentRule(s.facilities) ?? '',
    `**Progressive overload:** Keep last week's exercises, with the same names,
   unless I swapped one or a new block starts, and slightly increase volume or
   intensity from my recent logged data and current working weights.`,
    strengthRule(s, profile),
    `**Session shape:** 3–6 exercises a session (up to 7 once I'm past beginner),
   main compound exercise first. Most sets stop 1–3 reps short of failure
   (RPE 7–9). Rest 2–3 min on compound exercises and 60–90 s on isolation
   work.${everyMuscleTwice ? ` Where my days allow, train each major muscle group at least twice a
   week.` : ''}`,
    `**Supersets are optional:** Use straight sets by default. Only superset when
   the session wouldn't fit the time otherwise, and then only opposing muscles at
   one station (e.g. Dumbbell Bench Press + One-Arm Dumbbell Row on one bench,
   or Cable Curl + Cable Pushdown on one stack), never the main heavy lift. Put
   the pair next to each other in \`exercises\` and note it in \`coachNotes\`
   (e.g. "Superset with the next exercise — alternate sets").`,
    `**Timed exercises:** For holds (planks, side planks, dead hangs, wall sits),
   set \`durationSeconds\` on each set and give them no weight. The app shows a
   stopwatch.`,
    s.mobility ? `**Mobility sessions** (\`type: "active-recovery"\`): put the flow in \`exercises\`,
   one move per exercise, holds as timed sets. Keep them genuinely restorative.` : '',
    `**Periodise across the block:** If there's a Goal section above, follow its
   phase skeleton and this week's deload flag exactly; the app computed them
   from my dates. Otherwise use my program block position above. Plan a
   deload week (roughly 40% less volume, lighter loads, RPE ≤ 7) about every
   4th–6th week, or sooner if my recent history shows fatigue (low "felt"
   scores, missed reps, stalled weights). Build through the middle of the block
   and push a little harder in the final week or two. Say in your summary if
   this is a deload week and why.`,
    `**Warm-up:** Give every session the short warm-up described in "Warm-up
   format" below, listed move by move: I follow it as a checklist in the app.`,
    `**Standard exercise names:** Name every exercise and warm-up move with its
   common, standard name (e.g. "Dumbbell Bench Press", "Romanian Deadlift",
   "Cat Stretch"). The app looks each name up in an exercise library to
   show me a movement guide. Put variations and cues in \`coachNotes\` / \`notes\`,
   not in the name. Stick to well-known exercises that fit my equipment: no hybrids
   or novelty moves.`,
  ].filter(Boolean)

  const onlyTypes = s.sessionTypes.length === 1
    ? `Every session is \`type: "${s.sessionTypes[0]}"\`.`
    : `Use only these session types: ${s.sessionTypes.map((t) => `\`${t}\``).join(', ')}.`

  return `# New Week Plan — Week of ${weekLabel}

You are ${coachRole(profile)}. Generate my training plan for this
week. Everything you need is in this message — my profile, training history,
the programming rules and the output schema are all included below. Don't ask
me follow-up questions — go straight to the plan.

## This week
- **Week starts (Monday):** ${weekStartISO}
- **Training days — use exactly these dates, one session per day:**
${dayLines || '  - —'}
- **Target session length:** about ${sessionMinutes} minutes each, including the warm-up. Size the exercise count, sets and rest so it genuinely fits, and set \`estimatedMinutes\` honestly.
- **Session types:** ${onlyTypes}
- **Extra context / notes:** ${userNotes.trim() || 'None'}${replaceNote}
${goalSection ? `
## Goal
${goalSection}
` : ''}
## Athlete profile
- **Name:** ${profile.name.trim() || 'Athlete'}
- **Sex / age / height / weight:** ${profile.sex}, ${age !== undefined ? `${age}y` : 'age —'}, ${profile.heightCm}cm, ${profile.weightKg}kg
- **Program block:** ${blockLine}
- **Experience level:** ${profile.experienceLevel ?? '—'}
- **Goals:** ${profile.goals.length ? profile.goals.join('; ') : '—'}${niggles.length ? `
- **Niggles to train around:** ${niggles.join('; ')}` : ''}
- **Fitness background:** ${profile.fitnessBackground || '—'}${s.diet ? `
- **Dietary notes:** ${profile.dietaryNotes.join('; ')}` : ''}

### Program preferences
${programBlock}

## Training history (summary)
${summarizeHistory(loggedSessions)}

## Programming rules

Apply all of these.

${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Match the tone of my chosen coaching style in your written summary and how hard
you push intensity/RPE targets.

${warmupSection(s)}

${outputSection(weekStartISO, selectedDays, s)}

Apply progressive overload against the current working weights above.`
}

/**
 * Tracker mode (§4.6): the athlete brings their own plan. This prompt asks
 * Claude to convert pasted plan text into importable WeekPlan JSON *as
 * written*: no reprogramming, but anything that loads an injury marked worse
 * is flagged, never silently rewritten.
 */
export function buildConvertPlanPrompt(
  planText: string,
  selectedDays: DayOfWeek[],
  weekStart: Date,
  profile: UserProfile,
): string {
  const weekStartISO = toLocalISODate(weekStart)
  const dayLines = WEEK_DAYS_MON
    .map((day, i) => ({ day, i }))
    .filter(({ day }) => selectedDays.includes(day))
    .map(({ day, i }) => `  - ${day} → \`${toLocalISODate(addDays(weekStart, i))}\``)
    .join('\n')
  const worse = profile.injuries.filter((i) => profile.goal?.health.injuryStatus?.[i] === 'worse')
  const flareUp = worse.length ? `
## Flare-up check
- Worse this week: ${worse.join('; ')}.
- If anything in the plan loads it heavily, **don't rewrite it**. Keep it, put a
  short note starting with "⚠️" in that exercise's \`coachNotes\` (or the
  session's \`focus\`), and list it in your summary so I can ask my coach.
` : ''
  return `# Convert my training plan — week of ${format(weekStart, 'dd MMM yyyy')}

I follow a plan from my ${profile.goal?.tracker?.source === 'coach' ? 'coach or club' : profile.goal?.tracker?.source === 'self' ? 'own notes' : 'app or book'}. Convert this week of it into JSON for my training app,
**exactly as written**. Don't change exercises, sets, reps, loads or paces, and
don't add sessions. Where the plan is vague, pick the closest faithful reading.

## This week
- **Week starts (Monday):** ${weekStartISO}
- **Training days — use these dates, one session per day:**
${dayLines || '  - (use the days in the plan below, this week)'}

## My plan (pasted)
\`\`\`
${planText.trim() || '(paste your plan here)'}
\`\`\`
${flareUp}
## How to fill in what the plan doesn't say
- Warm-up: if the plan gives none, add a short one (\`warmup\` plus 2–4
  \`warmupExercises\`; it isn't logged, it's a checklist). Leave the cool-down
  out unless the plan has one.
- Cardio goes in \`workout\` steps. Use effort words that match the plan's
  descriptions; put any explicit pace or split from the plan in \`target\`.
- Keep distances and times exactly as the plan gives them: a distance rep
  becomes \`end: { by: "distance" }\` (I press LAP at the distance), a timed one
  \`end: { by: "time" }\`.

${outputSection(weekStartISO, selectedDays, ALL)}`
}

/**
 * "Modify last week": Claude edits the athlete's latest plan as they describe
 * and moves it onto the target week. Everything not mentioned stays as it was
 * (exercise names especially, since working weights are matched by name).
 */
export function buildModifyPlanPrompt(
  lastPlan: WeekPlan,
  changes: string,
  selectedDays: DayOfWeek[],
  weekStart: Date,
  profile: UserProfile,
): string {
  const weekStartISO = toLocalISODate(weekStart)
  const s = promptScope(profile)
  const dayLines = WEEK_DAYS_MON
    .map((day, i) => ({ day, i }))
    .filter(({ day }) => selectedDays.includes(day))
    .map(({ day, i }) => `  - ${day} → \`${toLocalISODate(addDays(weekStart, i))}\``)
    .join('\n')
  const niggles = profile.injuries.length ? `
## Niggles to train around
${profile.injuries.map((i) => `- ${i}${profile.goal?.health.injuryStatus?.[i] === 'worse' ? ' (worse this week: go lighter on what loads it)' : ''}`).join('\n')}
` : ''
  const { createdAt: _created, ...plan } = lastPlan
  void _created
  return `# Modify my training plan — week of ${format(weekStart, 'dd MMM yyyy')}

Below is the plan I followed most recently. Make **only the changes I ask for**
and move it onto this week. Keep everything else the same: sessions, exercise
names (my working weights are matched by name), sets, reps and weights.

## Change it like this
${changes.trim() || '(describe the changes here)'}

## This week
- **Week starts (Monday):** ${weekStartISO}
- **Training days — use these dates, one session per day:**
${dayLines || '  - (the same weekdays as the plan below, this week)'}
${niggles}
## The plan to modify (JSON)
\`\`\`json
${JSON.stringify(plan)}
\`\`\`

${outputSection(weekStartISO, selectedDays, s)}`
}
