import type { SetClock, TimerState } from '../types'

/**
 * The rest timer's rules, in one place: starting a rest, skipping it, the rest
 * running out, and picking it back up when the app is reopened mid-rest. Pure:
 * the clock, the end-of-rest tone, the lock-screen alert and the store come in
 * as deps (wired up in hooks/useRestTimer), so the rules are unit-tested.
 *
 * When a rest ends, the next set is under way: the set clock starts from the
 * rest's end time (see lib/autoFinish).
 */

export const IDLE_TIMER: TimerState = { isActive: false, endTime: null, durationSeconds: 0, label: '' }

/**
 * The one "is the rest over?" rule. A running rest whose end time has passed
 * becomes idle, and its session's set clock starts when it ended. Used when
 * the store is reloaded and on every tick.
 */
export function settleRest(timer: TimerState, setClock: SetClock | null, now: number): { timer: TimerState; setClock: SetClock | null; ended: boolean } {
  if (!timer.isActive || !timer.endTime || timer.endTime > now) return { timer, setClock, ended: false }
  return {
    timer: IDLE_TIMER,
    setClock: timer.sessionId ? { sessionId: timer.sessionId, startedAt: timer.endTime } : setClock,
    ended: true,
  }
}

export interface ToneHandle {
  cancel: () => void
}

export interface RestTimerDeps {
  now: () => number
  /** Queues the countdown pips and the "rest over" tone `seconds` from now. */
  scheduleTone: (seconds: number) => ToneHandle
  /** The lock-screen rest alert (lib/restAlarmController). */
  alert: { start: (endTime: number, body: string, url: string) => void; stop: () => void }
  /** Where a tapped alert opens the workout. */
  alertUrl: (timer: TimerState) => string
  getState: () => { timer: TimerState; setClock: SetClock | null }
  setState: (patch: { timer?: TimerState; setClock?: SetClock | null }) => void
}

/** Tones due in less than this are dropped rather than re-timed. */
const MIN_TONE_SECONDS = 0.5

export function createRestTimer(deps: RestTimerDeps) {
  // The pending end-of-rest tone. Only one rest runs at a time.
  let tone: ToneHandle | null = null

  function cancelTone() {
    tone?.cancel()
    tone = null
  }

  /** (Re)queues the tone for the rest ending at `endTime`, or drops it if that's now. */
  function scheduleFor(endTime: number) {
    cancelTone()
    const left = (endTime - deps.now()) / 1000
    if (left > MIN_TONE_SECONDS) tone = deps.scheduleTone(left)
  }

  function tick() {
    const { timer, setClock } = deps.getState()
    const settled = settleRest(timer, setClock, deps.now())
    if (!settled.ended) return
    // The tone is sounding now: let it finish.
    tone = null
    deps.alert.stop()
    deps.setState({ timer: settled.timer, setClock: settled.setClock })
  }

  return {
    /** `nextExerciseId`: the exercise up next, so tapping the rest alert opens the workout there. */
    start(seconds: number, label: string, sessionId?: string, nextExerciseId?: string) {
      const endTime = deps.now() + seconds * 1000
      const timer: TimerState = { isActive: true, endTime, durationSeconds: seconds, label, sessionId, nextExerciseId }
      cancelTone()
      tone = deps.scheduleTone(seconds)
      deps.alert.start(endTime, label, deps.alertUrl(timer))
      deps.setState({ timer })
    },

    /** Ends the rest now: the next set starts straight away. */
    skip() {
      const { sessionId } = deps.getState().timer
      cancelTone()
      deps.alert.stop()
      deps.setState({ timer: IDLE_TIMER, ...(sessionId ? { setClock: { sessionId, startedAt: deps.now() } } : {}) })
    },

    /**
     * Called by every screen showing the timer, several times a second. The
     * first call after the end time ends the rest; the rest see it idle.
     */
    tick,

    /**
     * The app was reopened. A rest that ran out meanwhile ends (from its end
     * time); one still running gets its tone and alert back, which only lived
     * in memory.
     */
    restore() {
      tick()
      const { timer } = deps.getState()
      if (!timer.isActive || !timer.endTime) return
      scheduleFor(timer.endTime)
      deps.alert.start(timer.endTime, timer.label, deps.alertUrl(timer))
    },

    /**
     * Re-times the tone against the rest's end, e.g. on return from the
     * background (iOS stops the audio clock there, so tones would play late)
     * or once audio is unlocked. Drops it if the rest is already over.
     */
    retime() {
      if (!tone) return
      const { timer } = deps.getState()
      if (timer.isActive && timer.endTime) scheduleFor(timer.endTime)
      else cancelTone()
    },
  }
}

export type RestTimer = ReturnType<typeof createRestTimer>
