import type { DayOfWeek, LoggedSession, WeekPlan } from '../types'
import { baseSessionId } from './planIds'
import { WEEK_DAYS, WEEK_DAYS_MON, addDays, parseLocalISODate, toLocalISODate } from './weekUtils'

/**
 * Where a new plan (imported from Claude, repeated or from a prewritten plan)
 * goes in the athlete's list of plans.
 */
export interface Placement {
  /** The plan to store. */
  plan: WeekPlan
  /** The stored plan it replaces: the one for the same week, if any. */
  replaces?: WeekPlan
}

/**
 * Places `incoming` in the week it was written for: its own `weekStartDate`,
 * never the week the planner happens to be showing. (Importing a plan for next
 * week used to overwrite this week's plan.)
 *
 * A plan for the same week is replaced, keeping its id and any of its sessions
 * that already have a completed log, so finished work stays on the week. A new
 * week gets its own plan, with a fresh id if `incoming.id` is already taken.
 */
export function placePlan(plans: WeekPlan[], logs: LoggedSession[], incoming: WeekPlan): Placement {
  const existing = plans.find((p) => p.weekStartDate === incoming.weekStartDate)
  if (existing) {
    const done = new Set(logs.filter((l) => l.status === 'complete').map((l) => l.plannedSessionId))
    const preserved = existing.sessions.filter((s) => done.has(s.id))
    return {
      replaces: existing,
      plan: { ...incoming, id: existing.id, sessions: [...preserved, ...incoming.sessions] },
    }
  }
  return { plan: { ...incoming, id: uniquePlanId(plans, incoming) } }
}

function uniquePlanId(plans: WeekPlan[], incoming: WeekPlan): string {
  const taken = new Set(plans.map((p) => p.id))
  if (!taken.has(incoming.id)) return incoming.id
  const base = `plan-${incoming.weekStartDate}`
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/** The most recent plan with sessions from before `weekStart` (the one to repeat). */
export function previousPlan(plans: WeekPlan[], weekStart: string): WeekPlan | undefined {
  return plans
    .filter((p) => p.weekStartDate < weekStart && p.sessions.length > 0)
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))[0]
}

/**
 * Copies `source` into the week starting `weekStart`: every session moves by
 * whole weeks to the same weekday, with its ids re-dated so the copy's logs
 * never match the original's. Exercises, sets and weights are copied as they are.
 */
export function repeatPlan(source: WeekPlan, weekStart: string, now: Date = new Date()): WeekPlan {
  const offset = daysBetween(source.weekStartDate, weekStart)
  const sessions = source.sessions.map((s) => {
    const day = addDays(parseLocalISODate(s.date), offset)
    const date = toLocalISODate(day)
    const redate = (id: string) => id.split(s.date).join(date)
    return {
      ...s,
      id: redate(baseSessionId(s.id)),
      date,
      dayOfWeek: WEEK_DAYS[day.getDay()],
      ...(s.exercises && { exercises: s.exercises.map((e) => ({ ...e, id: redate(e.id) })) }),
    }
  })
  return {
    id: `plan-${weekStart}`,
    weekStartDate: weekStart,
    availableDays: daysOf(sessions),
    userNotes: '',
    createdAt: now.toISOString(),
    sessions,
  }
}

/**
 * Drops the sessions dated before `today` (they can't be trained any more),
 * returning the trimmed plan and the weekdays left out.
 */
export function dropPastSessions(plan: WeekPlan, today: string): { plan: WeekPlan; skipped: DayOfWeek[] } {
  const keep = plan.sessions.filter((s) => s.date >= today)
  if (keep.length === plan.sessions.length) return { plan, skipped: [] }
  const skipped = daysOf(plan.sessions.filter((s) => s.date < today))
  return { plan: { ...plan, sessions: keep, availableDays: daysOf(keep) }, skipped }
}

/** The distinct weekdays of `sessions`, Monday first. */
function daysOf(sessions: { dayOfWeek: DayOfWeek }[]): DayOfWeek[] {
  return WEEK_DAYS_MON.filter((d) => sessions.some((s) => s.dayOfWeek === d))
}

/** Whole days from one local ISO date to another (DST-safe). */
function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalISODate(to).getTime() - parseLocalISODate(from).getTime()) / 86_400_000)
}
