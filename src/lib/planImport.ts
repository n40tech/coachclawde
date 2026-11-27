import { addDays, format, parseISO } from 'date-fns'
import type { DayOfWeek, LoggedSession, PlannedSession, WeekPlan } from '../types'
import { importPlanFromJson } from './export'
import { WEEK_DAYS_MON, toLocalISODate } from './weekUtils'
import { logForSession, statusOf } from './weekStatus'

/**
 * Importing a plan (Claude's JSON, or a repeated week) onto the week the
 * athlete picked. The planner only shows the warnings and saves the result.
 */

export interface PlacedPlan {
  /** The plan to store, on the picked week. */
  plan: WeekPlan
  /** The id of the week's existing plan it replaces, if any. */
  replaces?: string
  /** Things the athlete should know before it's saved (dates moved, …). */
  warnings: string[]
}

export interface PlaceOptions {
  /** The Monday (ISO) the athlete picked. */
  weekStart: string
  days: DayOfWeek[]
  notes: string
  plans: WeekPlan[]
  logs: LoggedSession[]
}

const dayOf = (iso: string): DayOfWeek => WEEK_DAYS_MON[(parseISO(iso).getDay() + 6) % 7]

/**
 * Puts a plan on the picked week:
 * - the week is the one the athlete picked, whatever week the plan says;
 * - a session dated outside that week moves to the same weekday in it, with a warning;
 * - the athlete's days and notes are kept, whether it adds a week or replaces one;
 * - replacing a week keeps its sessions that have a finished or in-progress
 *   workout (and the plan's id, so those logs stay attached).
 */
export function placePlan(plan: WeekPlan, opts: PlaceOptions): PlacedPlan {
  const { weekStart } = opts
  const weekEnd = toLocalISODate(addDays(parseISO(weekStart), 6))
  const warnings: string[] = []

  const sessions: PlannedSession[] = plan.sessions.map((s) => {
    if (s.date >= weekStart && s.date <= weekEnd) return { ...s, dayOfWeek: dayOf(s.date) }
    const day = WEEK_DAYS_MON.indexOf(dayOf(s.date))
    const date = toLocalISODate(addDays(parseISO(weekStart), day))
    warnings.push(`“${s.title}” was dated ${s.date}, outside this week, so it’s moved to ${format(parseISO(date), 'EEE d MMM')}.`)
    return { ...s, date, dayOfWeek: dayOf(date) }
  })

  const existing = opts.plans.find((p) => p.weekStartDate === weekStart)
  const kept = existing
    ? existing.sessions.filter((s) => statusOf(logForSession(existing, s.id, opts.logs)) !== 'to-do')
    : []
  // A new plan keeps Claude's id unless another week already uses it.
  const id = existing?.id ?? (opts.plans.some((p) => p.id === plan.id) ? `plan-${weekStart}` : plan.id)

  return {
    plan: {
      ...plan,
      id,
      weekStartDate: weekStart,
      availableDays: opts.days,
      userNotes: opts.notes,
      sessions: [...kept, ...sessions],
    },
    replaces: existing?.id,
    warnings,
  }
}

/** Claude's pasted JSON, checked (throws with a readable message) and placed on the picked week. */
export function importPlan(json: string, opts: PlaceOptions): PlacedPlan {
  return placePlan(importPlanFromJson(json), opts)
}
