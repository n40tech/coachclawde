import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useRestTimer } from './useRestTimer'
import { secondsToDisplay } from '../lib/dateUtils'
import type { LoggedSession, SessionType } from '../types'

/** A workout left in progress longer than this is treated as abandoned. */
const STALE_MS = 8 * 60 * 60 * 1000

/** The workout in progress right now, if any (newest first). */
export function useLiveWorkout(now: number): LoggedSession | undefined {
  const sessions = useAppStore((s) => s.loggedSessions)
  return sessions
    .filter((s) => s.status === 'in-progress' && s.plannedSessionId && now - Date.parse(s.startedAt) < STALE_MS)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

/** The current time, refreshed every `everyMs` (half a second) while `on`. */
export function useNow(on: boolean, everyMs = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [on, everyMs])
  return now
}

/**
 * The workout under way, if any: the live log, or the session whose rest
 * timer is running. What the dock and Home's "In progress" card show.
 */
export function useCurrentWorkout(now: number): LoggedSession | undefined {
  const live = useLiveWorkout(now)
  const sessions = useAppStore((s) => s.loggedSessions)
  const { isActive: resting, sessionId: restSession } = useRestTimer()
  if (resting && restSession && live?.plannedSessionId !== restSession) {
    return sessions.find((s) => s.status === 'in-progress' && s.plannedSessionId === restSession) ?? live
  }
  return live
}

export interface DockState {
  sessionId: string
  /** The kind of workout, for the icon shown when no rest is running. */
  type: SessionType
  /** The exercise to open the workout at: up next after the rest, else the first with a set left. */
  exerciseId?: string
  /** What the clock is showing. */
  mode: 'rest' | 'set' | 'workout'
  time: string
  /** 0–1 ring fill. */
  fill: number
  label: string
}

/**
 * The workout's clock while the athlete is elsewhere in the app: the rest
 * countdown, else the set being timed, else time since the workout started.
 * Null on the workout's own screen and when nothing's running.
 */
export function useWorkoutDock(): DockState | null {
  const { pathname } = useLocation()
  const offSession = !pathname.startsWith('/session/')
  const now = useNow(offSession)
  const live = useCurrentWorkout(now)
  const setClock = useAppStore((s) => s.setClock)
  const { remaining, progress, isActive: resting, sessionId: restSession } = useRestTimer()
  const restNext = useAppStore((s) => s.timer.nextExerciseId)
  const sessionId = (resting && restSession) || live?.plannedSessionId
  const show = !!sessionId && offSession
  if (!show || !sessionId) return null
  const mine = live?.plannedSessionId === sessionId ? live : undefined
  const type: SessionType = mine?.type ?? 'weights'
  const exerciseId = (resting && restNext)
    || mine?.loggedExercises?.find((e) => e.sets.some((s) => !s.completed && !s.skipped))?.plannedExerciseId

  if (resting && restSession) {
    return { sessionId, type, exerciseId, mode: 'rest', time: secondsToDisplay(remaining), fill: 1 - Math.min(1, Math.max(0, progress)), label: `Rest, ${secondsToDisplay(remaining)} left` }
  }
  if (setClock && setClock.sessionId === sessionId) {
    const s = Math.max(0, Math.floor((now - setClock.startedAt) / 1000))
    return { sessionId, type, exerciseId, mode: 'set', time: secondsToDisplay(s), fill: (s % 60) / 60, label: `Set in progress, ${secondsToDisplay(s)}` }
  }
  const s = live ? Math.max(0, Math.floor((now - Date.parse(live.startedAt)) / 1000)) : 0
  const time = s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : secondsToDisplay(s)
  return { sessionId, type, exerciseId, mode: 'workout', time, fill: 1, label: `Workout in progress, ${time}` }
}

