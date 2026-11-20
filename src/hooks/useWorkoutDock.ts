import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useRestTimer } from './useRestTimer'
import { secondsToDisplay } from '../lib/dateUtils'
import type { LoggedSession } from '../types'

/** A workout left in progress longer than this is treated as abandoned. */
const STALE_MS = 8 * 60 * 60 * 1000

/** The workout in progress right now, if any (newest first). */
export function useLiveWorkout(now: number): LoggedSession | undefined {
  const sessions = useAppStore((s) => s.loggedSessions)
  return sessions
    .filter((s) => s.status === 'in-progress' && s.plannedSessionId && now - Date.parse(s.startedAt) < STALE_MS)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

/** The current time, refreshed every half second while `on`. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [on])
  return now
}

export interface DockState {
  sessionId: string
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
  const live = useLiveWorkout(now)
  const setClock = useAppStore((s) => s.setClock)
  const { remaining, progress, isActive: resting, sessionId: restSession } = useRestTimer()
  const sessionId = (resting && restSession) || live?.plannedSessionId
  const show = !!sessionId && offSession
  if (!show || !sessionId) return null

  if (resting && restSession) {
    return { sessionId, mode: 'rest', time: secondsToDisplay(remaining), fill: 1 - Math.min(1, Math.max(0, progress)), label: `Rest, ${secondsToDisplay(remaining)} left` }
  }
  if (setClock && setClock.sessionId === sessionId) {
    const s = Math.max(0, Math.floor((now - setClock.startedAt) / 1000))
    return { sessionId, mode: 'set', time: secondsToDisplay(s), fill: (s % 60) / 60, label: `Set in progress, ${secondsToDisplay(s)}` }
  }
  const s = live ? Math.max(0, Math.floor((now - Date.parse(live.startedAt)) / 1000)) : 0
  const time = s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : secondsToDisplay(s)
  return { sessionId, mode: 'workout', time, fill: 1, label: `Workout in progress, ${time}` }
}

