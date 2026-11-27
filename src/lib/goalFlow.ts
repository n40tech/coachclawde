import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { EventKind, GoalProfile } from '../types'
import { BEGINNER_BLOCK_WEEKS, DEFAULT_BLOCK_WEEKS, MAX_BLOCK_WEEKS } from './coachingConfig'
import { getMonday } from './weekUtils'

/**
 * What's left of the pre-1.1 onboarding goal tree: the event labels and block
 * arithmetic that goals saved by older builds still need. The tree itself is
 * on the `cardio-archive` branch; onboarding is now `basicOnboarding`.
 */

export const EVENT_LABEL: Record<EventKind, string> = {
  '5k': '5K', '10k': '10K', half: 'half marathon', marathon: 'marathon', trail: 'trail race',
  tri: 'triathlon', sportive: 'sportive', hyrox: 'Hyrox', other: 'event',
}

/** Weeks from this week's Monday to `date`, counting the week it falls in. */
export function weeksUntil(date: string, now: Date): number {
  const days = differenceInCalendarDays(parseISO(date), getMonday(now))
  return Math.max(1, Math.floor(days / 7) + 1)
}

/** Block length: weeks to the date when there is one, else 12 (8 for sedentary beginners). */
export function blockLengthWeeks(goal: GoalProfile, now: Date): number {
  const date = goal.event?.date ?? goal.physique?.byDate
  if (date) return Math.min(MAX_BLOCK_WEEKS, weeksUntil(date, now))
  const sedentary = goal.starting.activity === 'sitting' || goal.starting.activity === 'light'
  return sedentary ? BEGINNER_BLOCK_WEEKS : DEFAULT_BLOCK_WEEKS
}
