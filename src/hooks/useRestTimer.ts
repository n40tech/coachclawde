import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { audioContext, combine, scheduleEarcon, unlockAudio, type CueHandle } from '../lib/audioCues'
import { restAlarm, watchVisibilityForRestAlarm } from '../lib/restAlerts'
import { restAlertUrl } from '../lib/alertLink'
import { createRestTimer } from '../lib/restTimer'

/**
 * Queues three countdown pips and the "rest over" tone on the audio clock, so
 * they sound on time even if the page's timers are throttled. Android also
 * vibrates. Starting a rest is a tap, which unlocks audio.
 */
function scheduleTone(seconds: number): CueHandle {
  unlockAudio()
  const handles: CueHandle[] = []
  for (const k of [3, 2, 1]) {
    if (seconds > k + 1) handles.push(scheduleEarcon('pip', seconds - k, { vibrate: false }))
  }
  handles.push(scheduleEarcon('restOver', seconds))
  return combine(handles)
}

/** The app's one rest timer (rules in lib/restTimer). */
const restTimer = createRestTimer({
  now: () => Date.now(),
  scheduleTone,
  alert: restAlarm,
  alertUrl: (t) => restAlertUrl(t.sessionId, t.nextExerciseId, window.location.pathname),
  getState: () => useAppStore.getState(),
  setState: (patch) => useAppStore.setState(patch),
})

let wired = false

/**
 * Once per app launch: follow page visibility, and pick up a rest that was
 * running when the app was closed. Audio only starts after a tap (iOS,
 * Chrome), so a restored tone is re-timed on the first touch.
 */
function wireUp() {
  if (wired || typeof document === 'undefined') return
  wired = true
  watchVisibilityForRestAlarm()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') restTimer.retime()
  })
  restTimer.restore()
  if (audioContext()?.state !== 'running') {
    document.addEventListener('pointerdown', () => {
      unlockAudio()
      restTimer.retime()
    }, { once: true, capture: true })
  }
}

export function useRestTimer() {
  const timer = useAppStore((s) => s.timer)
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(wireUp, [])

  useEffect(() => {
    // When there's no active timer we leave `remaining` as-is — the overlay is
    // hidden anyway, and the next timer re-syncs `remaining` immediately below.
    if (!timer.isActive || !timer.endTime) return
    const endTime = timer.endTime

    const update = () => {
      setRemaining(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)))
      restTimer.tick()
    }

    update()
    const id = setInterval(update, 250)
    return () => clearInterval(id)
  }, [timer.isActive, timer.endTime])

  const progress = timer.durationSeconds > 0
    ? 1 - remaining / timer.durationSeconds
    : 0

  return {
    remaining,
    progress,
    isActive: timer.isActive,
    label: timer.label,
    sessionId: timer.sessionId,
    startTimer: restTimer.start,
    skipTimer: restTimer.skip,
  }
}
