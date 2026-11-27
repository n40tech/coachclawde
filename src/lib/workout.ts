import type {
  CardioType, Effort, PlannedInterval, PlannedSession, RepeatBlock,
  StepEnd, StepRole, WeekPlan, WorkoutItem, WorkoutStep,
} from '../types'
import { parseDistanceToMeters, parseDurationToSeconds } from './cardioUtils'
import { estimateSeconds, type RunZones } from './zones'

/**
 * The structured cardio workout (§5.2 of docs/RUNNERS-AND-ATHLETES.md): steps
 * with a role, an effort and what ends them, grouped into repeat blocks.
 * Run Mode is gone (1.1, kept on the `cardio-archive` branch); this module
 * stays so older plans still load: it converts legacy `intervals[]`,
 * validates imported workouts, and flattens a workout to estimate its length.
 */

export const EFFORTS: Effort[] = ['recovery', 'easy', 'steady', 'marathon', 'threshold', 'interval', 'repetition', 'sprint']
const ROLES: StepRole[] = ['warmup', 'work', 'recover', 'steady', 'cooldown']
const MAX_DEPTH = 2
const MAX_TIMES = 50

// --- legacy conversion -------------------------------------------------------

/** Best-guess effort and role from a legacy interval's free-text label. */
function inferEffort(text: string): { effort: Effort; role: StepRole } {
  const t = text.toLowerCase()
  if (/warm[\s-]?up/.test(t)) return { effort: 'easy', role: 'warmup' }
  if (/cool[\s-]?down/.test(t)) return { effort: 'easy', role: 'cooldown' }
  if (/sprint|all[\s-]?out|max effort/.test(t)) return { effort: 'sprint', role: 'work' }
  if (/stride|repetition|\b(100|150|200|300|400)\s?m\b/.test(t)) return { effort: 'repetition', role: 'work' }
  if (/threshold|tempo|lactate|\blt\b|cruise/.test(t)) return { effort: 'threshold', role: 'work' }
  if (/interval|vo2|\b(600|800|1000|1k|1200)\s?m?\b|\breps?\b/.test(t)) return { effort: 'interval', role: 'work' }
  if (/marathon pace|\bmp\b|race pace/.test(t)) return { effort: 'marathon', role: 'work' }
  if (/recover/.test(t)) return { effort: 'recovery', role: 'recover' }
  if (/easy|jog|zone ?2|\bz2\b|conversational|long run|aerobic/.test(t)) return { effort: 'easy', role: 'steady' }
  if (/steady|moderate/.test(t)) return { effort: 'steady', role: 'steady' }
  return { effort: 'steady', role: 'work' }
}

/** What ends a legacy piece: distance if it parses, else time, else the athlete (LAP). */
function legacyEnd(iv: PlannedInterval): StepEnd {
  const meters = parseDistanceToMeters(iv.targetDistance)
  if (meters) return { by: 'distance', meters }
  const seconds = iv.targetDuration ? parseDurationToSeconds(iv.targetDuration) : null
  if (seconds && seconds > 0) return { by: 'time', seconds }
  return { by: 'lap' }
}

/**
 * Converts legacy `intervals[]` into a workout: each interval becomes
 * `repeat(times)` of a work step, followed by a recovery step when it has
 * rest. The old pace text is kept as the step's `target`, so nothing the plan
 * said is lost. Every old plan can therefore run in Run Mode.
 */
function intervalsToWorkout(intervals: PlannedInterval[]): WorkoutItem[] {
  return intervals.map((iv, i): WorkoutItem => {
    const { effort, role } = inferEffort(`${iv.label} ${iv.targetPace ?? ''}`)
    const work: WorkoutStep = {
      kind: 'step',
      role,
      end: legacyEnd(iv),
      effort,
      label: iv.label,
      ...(iv.targetPace ? { target: iv.targetPace } : {}),
      ...(iv.notes ? { cue: iv.notes } : {}),
    }
    const rest: WorkoutStep | null = iv.restSeconds > 0
      ? { kind: 'step', role: 'recover', end: { by: 'time', seconds: iv.restSeconds }, effort: 'recovery' }
      : null
    const times = Math.max(1, Math.round(iv.repeats || 1))
    const isLast = i === intervals.length - 1
    return {
      kind: 'repeat',
      times,
      steps: rest ? [work, rest] : [work],
      // A rest after the very last piece of the session isn't a real step.
      ...(rest && isLast ? { skipLastRecovery: true } : {}),
    }
  })
}

// --- import validation --------------------------------------------------------

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function normalizeEnd(raw: unknown): StepEnd {
  const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const seconds = num(e.seconds)
  const meters = num(e.meters)
  if (e.by === 'distance' && meters && meters > 0) return { by: 'distance', meters: Math.round(meters) }
  if (e.by === 'time' && seconds && seconds > 0) return { by: 'time', seconds: Math.round(seconds) }
  if (e.by === 'lap') return { by: 'lap' }
  if (meters && meters > 0) return { by: 'distance', meters: Math.round(meters) }
  if (seconds && seconds > 0) return { by: 'time', seconds: Math.round(seconds) }
  return { by: 'lap' }
}

function normalizeItem(raw: unknown, depth: number): WorkoutItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.kind === 'repeat' || Array.isArray(r.steps)) {
    const steps = (Array.isArray(r.steps) ? r.steps : [])
      // Deeper nesting than 2 is flattened into its parent's steps.
      .flatMap((s) => {
        const item = normalizeItem(s, depth + 1)
        if (!item) return []
        return item.kind === 'repeat' && depth + 1 >= MAX_DEPTH ? item.steps : [item]
      })
    if (!steps.length) return null
    const times = Math.min(MAX_TIMES, Math.max(1, Math.round(num(r.times) ?? 1)))
    const every = num(r.everySeconds)
    return {
      kind: 'repeat',
      times,
      steps,
      ...(every && every > 0 ? { everySeconds: Math.round(every) } : {}),
      ...(r.skipLastRecovery === true ? { skipLastRecovery: true } : {}),
    }
  }
  const role = ROLES.includes(r.role as StepRole) ? (r.role as StepRole) : 'work'
  const effort = EFFORTS.includes(r.effort as Effort)
    ? (r.effort as Effort)
    : role === 'recover' ? 'recovery' : role === 'work' ? 'threshold' : 'easy'
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const recovery = ['stand', 'walk', 'jog'].includes(r.recovery as string) ? (r.recovery as WorkoutStep['recovery']) : undefined
  const step: WorkoutStep = { kind: 'step', role, end: normalizeEnd(r.end), effort }
  if (str(r.target)) step.target = str(r.target)
  if (recovery) step.recovery = recovery
  if (str(r.cue)) step.cue = str(r.cue)
  if (str(r.label)) step.label = str(r.label)
  return step
}

/**
 * Validates a workout pasted from Claude: coerces numbers, fills missing
 * enums with sensible defaults, caps repeats, and flattens nesting deeper
 * than two levels. Returns undefined when nothing usable is left.
 */
export function normalizeWorkout(raw: unknown): WorkoutItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const items = raw.map((r) => normalizeItem(r, 0)).filter((x): x is WorkoutItem => !!x)
  return items.length ? items : undefined
}

/** Adds a `workout` to a legacy cardio session (keeping its `intervals`). */
export function normalizeSession(s: PlannedSession): PlannedSession {
  if (s.workout?.length || !s.intervals?.length) return s
  return { ...s, workout: intervalsToWorkout(s.intervals) }
}

/** Read-time adapter for stored plans: every cardio session gets a workout. */
export function normalizePlan(plan: WeekPlan): WeekPlan {
  if (!plan.sessions.some((s) => !s.workout?.length && s.intervals?.length)) return plan
  return { ...plan, sessions: plan.sessions.map(normalizeSession) }
}

// --- flattening ---------------------------------------------------------------

export interface FlatStep {
  /** Position, e.g. "1.3.0": item 1, repetition 3 (0-based), step 0. */
  path: string
  step: WorkoutStep
  /** Repetition within the innermost repeat block (1-based), for work steps. */
  rep?: { index: number; of: number }
  /** Repetition of the outer block when nested, e.g. set 2 of 2. */
  set?: { index: number; of: number }
  /** Send-off cycle: this recover step lasts until `cycleSeconds` after the cycle began. */
  cycleSeconds?: number
  /** First step of a send-off cycle (the cycle clock starts here). */
  cycleStart?: boolean
}

/** Flattens a workout into the ordered steps Run Mode plays. */
export function flattenWorkout(items: WorkoutItem[]): FlatStep[] {
  const out: FlatStep[] = []

  function walkBlock(block: RepeatBlock, prefix: string, outer?: { index: number; of: number }) {
    for (let r = 0; r < block.times; r++) {
      const last = r === block.times - 1
      let steps = block.steps
      if (last && block.skipLastRecovery) {
        // Drop trailing recoveries of the final repetition.
        let end = steps.length
        while (end > 0 && steps[end - 1].kind === 'step' && (steps[end - 1] as WorkoutStep).role === 'recover') end--
        steps = steps.slice(0, end)
      }
      const startLen = out.length
      steps.forEach((s, j) => {
        const path = `${prefix}.${r}.${j}`
        if (s.kind === 'repeat') {
          walkBlock(s, path, { index: r + 1, of: block.times })
        } else {
          out.push({
            path,
            step: s,
            ...(block.times > 1 && s.role === 'work' ? { rep: { index: r + 1, of: block.times } } : {}),
            ...(outer ? { set: outer } : {}),
          })
        }
      })
      if (block.everySeconds && out.length > startLen) {
        out[startLen].cycleStart = true
        const lastStep = out[out.length - 1]
        if (lastStep.step.role === 'recover') {
          lastStep.cycleSeconds = block.everySeconds
        } else if (!(last && block.skipLastRecovery)) {
          out.push({
            path: `${prefix}.${r}.rest`,
            step: { kind: 'step', role: 'recover', end: { by: 'time', seconds: 0 }, effort: 'recovery', recovery: 'stand' },
            cycleSeconds: block.everySeconds,
          })
        }
      }
    }
  }

  items.forEach((item, i) => {
    if (item.kind === 'repeat') walkBlock(item, String(i))
    else out.push({ path: String(i), step: item })
  })
  return out
}

// --- durations ---------------------------------------------------------------

/** Expected duration of a flat step, for strips, clocks and estimates. */
function expectedSeconds(f: FlatStep, modality: CardioType, zones?: RunZones): number {
  const { end, effort } = f.step
  if (f.cycleSeconds) return end.by === 'time' && end.seconds > 0 ? end.seconds : Math.max(10, f.cycleSeconds * 0.25)
  if (end.by === 'time') return end.seconds
  if (end.by === 'distance') return estimateSeconds(end.meters, effort, modality, zones)
  return 120
}

export function totalSeconds(flat: FlatStep[], modality: CardioType, zones?: RunZones): number {
  return flat.reduce((t, f) => t + expectedSeconds(f, modality, zones), 0)
}
