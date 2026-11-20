import type { WeekPlan } from '../types'
import { addDays, getMonday, toLocalISODate, WEEK_DAYS_MON } from './weekUtils'

/**
 * The ways to make a week's plan:
 * - `generate`: Claude writes a fresh week from the profile and history;
 * - `repeat`: copy the latest week onto the next one, no Claude needed;
 * - `modify`: Claude edits the latest week as the athlete describes;
 * - `convert`: Claude formats a plan the athlete pastes as free text.
 */
export type PlanMethod = 'generate' | 'repeat' | 'modify' | 'convert'

export const PLAN_METHODS: PlanMethod[] = ['generate', 'repeat', 'modify', 'convert']

/** The methods with the last one used first (the rest in their usual order). */
export function orderMethods(last: PlanMethod | null | undefined): PlanMethod[] {
  if (!last || !PLAN_METHODS.includes(last)) return PLAN_METHODS
  return [last, ...PLAN_METHODS.filter((m) => m !== last)]
}

/** The newest plan by week, the one "last week" means. */
export function latestPlan(plans: WeekPlan[]): WeekPlan | undefined {
  return [...plans].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))[0]
}

const parseISO = (d: string) => new Date(`${d}T00:00:00`)

/**
 * The Monday a repeat lands on: the week after the source, but never a week
 * that's already over. When that's this week and one of its training days has
 * already passed, it moves to next week so no session lands in the past.
 */
export function repeatTargetMonday(source: WeekPlan, now: Date): Date {
  const thisMonday = getMonday(now)
  const after = addDays(parseISO(source.weekStartDate), 7)
  if (after.getTime() > thisMonday.getTime()) return after
  const today = toLocalISODate(now)
  const offsets = source.sessions.map((s) => Math.round((parseISO(s.date).getTime() - parseISO(source.weekStartDate).getTime()) / 86_400_000))
  const anyPast = offsets.some((o) => toLocalISODate(addDays(thisMonday, o)) < today)
  return anyPast ? addDays(thisMonday, 7) : thisMonday
}

/** Drops the week suffix the store adds (lib/planIds), so the copy is re-scoped to its own week. */
const unscope = (id: string, week: string) => id.replace(new RegExp(`--${week}(-\\d+)?$`), '')

/** The source plan moved to another week: same sessions, exercises and weights, new dates and ids. */
export function repeatPlan(source: WeekPlan, targetMonday: Date, now: Date = new Date()): WeekPlan {
  const target = toLocalISODate(targetMonday)
  const shift = Math.round((targetMonday.getTime() - parseISO(source.weekStartDate).getTime()) / 86_400_000)
  return {
    id: `plan-${target}`,
    weekStartDate: target,
    availableDays: source.availableDays,
    userNotes: source.userNotes,
    createdAt: now.toISOString(),
    sessions: source.sessions.map((s) => {
      const date = toLocalISODate(addDays(parseISO(s.date), shift))
      return {
        ...s,
        id: unscope(s.id, source.weekStartDate),
        date,
        dayOfWeek: WEEK_DAYS_MON[(parseISO(date).getDay() + 6) % 7],
      }
    }),
  }
}
