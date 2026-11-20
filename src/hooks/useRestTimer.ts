import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { combine, scheduleEarcon, unlockAudio, type CueHandle } from '../lib/audioCues'
import { restAlarm, watchVisibilityForRestAlarm } from '../lib/restAlerts'

// The pending end-of-rest alarm. Module-level because several components use
// this hook, but only one rest timer runs at a time.
let alarm: CueHandle | null = null

/**
 * Queues three countdown pips and the "rest over" tone on the audio clock, so
 * they sound on time even if the page's timers are throttled. Android also
 * vibrates. Called from the tap that started the rest, which unlocks audio.
 */
function scheduleAlarm(seconds: number) {
  alarm?.cancel()
  unlockAudio()
  const handles: CueHandle[] = []
  for (const k of [3, 2, 1]) {
    if (seconds > k + 1) handles.push(scheduleEarcon('pip', seconds - k, { vibrate: false }))
  }
  handles.push(scheduleEarcon('restOver', seconds))
  alarm = combine(handles)
}

/**
 * The audio clock stops while iOS has the app in the background, so tones
 * queued before then would play late on return (a "rest over" a minute into
 * the next set). Re-time them, or drop them if the rest is already over: the
 * rest alert notification covered that.
 */
let retimingAudio = false
function retimeAudioOnReturn() {
  if (retimingAudio || typeof document === 'undefined') return
  retimingAudio = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !alarm) return
    const { timer } = useAppStore.getState()
    const left = timer.isActive && timer.endTime ? (timer.endTime - Date.now()) / 1000 : 0
    if (left > 0.5) {
      scheduleAlarm(left)
    } else {
      alarm.cancel()
      alarm = null
    }
  })
}

export function useRestTimer() {
  const { timer, setTimer, clearTimer } = useAppStore()
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    // When there's no active timer we leave `remaining` as-is — the overlay is
    // hidden anyway, and the next timer re-syncs `remaining` immediately below.
    if (!timer.isActive || !timer.endTime) return

    const update = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.ceil((timer.endTime! - now) / 1000))
      setRemaining(diff)
      if (diff === 0) {
        const { sessionId, endTime } = useAppStore.getState().timer
        clearTimer()
        restAlarm.stop()
        // Rest's over: the next set is under way (see lib/autoFinish).
        if (sessionId) useAppStore.getState().startSetClock(sessionId, endTime ?? undefined)
      }
    }

    update()
    const id = setInterval(update, 250)
    return () => clearInterval(id)
  }, [timer.isActive, timer.endTime, clearTimer])

  function startTimer(seconds: number, label: string, sessionId?: string) {
    scheduleAlarm(seconds)
    retimeAudioOnReturn()
    watchVisibilityForRestAlarm()
    const endTime = Date.now() + seconds * 1000
    restAlarm.start(endTime, label, window.location.pathname)
    setTimer({
      isActive: true,
      endTime,
      durationSeconds: seconds,
      label,
      sessionId,
    })
  }

  function skipTimer() {
    const { sessionId } = useAppStore.getState().timer
    alarm?.cancel()
    alarm = null
    restAlarm.stop()
    clearTimer()
    if (sessionId) useAppStore.getState().startSetClock(sessionId)
  }

  const progress = timer.durationSeconds > 0
    ? 1 - remaining / timer.durationSeconds
    : 0

  return { remaining, progress, isActive: timer.isActive, label: timer.label, sessionId: timer.sessionId, startTimer, skipTimer }
}
