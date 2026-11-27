import { addDays, parseISO } from 'date-fns'
import type { LoggedSession, PlannedSession, WeekPlan } from '../types'
import { getMonday, toLocalISODate } from './weekUtils'

/**
 * The one owner of "is this planned session done?" and "which week does a log
 * belong to?". Home, Session, Progress, History and Program ask here instead
 * of matching logs themselves.
 */

/** Where a planned session stands this week. */
export type PlannedStatus = 'to-do' | 'in-progress' | 'done' | 'swapped'

export interface WeekStatus {
  sessions: { session: PlannedSession; status: PlannedStatus; log?: LoggedSession }[]
  /** Sessions done or swapped for something else. */
  done: number
  total: number
}

const RANK: Record<LoggedSession['status'], number> = { complete: 0, 'in-progress': 1, skipped: 2 }

/**
 * The log of a planned session: the same session id, logged against this
 * plan or dated in its week (so an old week's log of a session with the same
 * id never counts). A finished log wins over one in progress.
 */
export function logForSession(plan: WeekPlan, sessionId: string, logs: LoggedSession[]): LoggedSession | undefined {
  const end = toLocalISODate(addDays(parseISO(plan.weekStartDate), 6))
  const inWeek = (date: string) => date >= plan.weekStartDate && date <= end
  return logs
    .filter((l) => l.plannedSessionId === sessionId && (l.weekPlanId === plan.id || inWeek(l.date)))
    .sort((a, b) => RANK[a.status] - RANK[b.status])[0]
}

/** A planned session's status from its log (none, or skipped, is still to do). */
export function statusOf(log: LoggedSession | undefined): PlannedStatus {
  if (!log || log.status === 'skipped') return 'to-do'
  if (log.status === 'in-progress') return 'in-progress'
  return log.outcome === 'substituted' ? 'swapped' : 'done'
}

/** Every planned session of a week with its status, and how many are done. */
export function weekStatus(plan: WeekPlan, logs: LoggedSession[]): WeekStatus {
  const sessions = plan.sessions.map((session) => {
    const log = logForSession(plan, session.id, logs)
    return { session, status: statusOf(log), log }
  })
  const done = sessions.filter((s) => s.status === 'done' || s.status === 'swapped').length
  return { sessions, done, total: sessions.length }
}

/** The Monday (ISO date) of the week a log was done in: its finish time, else its date. */
export function logWeekStart(log: LoggedSession): string {
  return toLocalISODate(getMonday(parseISO(log.completedAt ?? log.date)))
}
