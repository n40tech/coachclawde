import { describe, expect, it } from 'vitest'
import { IDLE_TIMER, createRestTimer } from './restTimer'
import type { SetClock, TimerState } from '../types'

/** A rest timer on a fake clock, tone and alert, with the store as a plain object. */
function setup(state: { timer: TimerState; setClock: SetClock | null } = { timer: IDLE_TIMER, setClock: null }) {
  let now = 1_000_000
  const tones: { seconds: number; cancelled: boolean }[] = []
  const alerts: { start: { endTime: number; body: string; url: string }[]; stops: number } = { start: [], stops: 0 }
  const clockStarts: SetClock[] = []
  const store = { ...state }
  const rest = createRestTimer({
    now: () => now,
    scheduleTone: (seconds) => {
      const t = { seconds, cancelled: false }
      tones.push(t)
      return { cancel: () => { t.cancelled = true } }
    },
    alert: {
      start: (endTime, body, url) => alerts.start.push({ endTime, body, url }),
      stop: () => { alerts.stops++ },
    },
    alertUrl: (t) => `/session/${t.sessionId}/next/${t.nextExerciseId}`,
    getState: () => store,
    setState: (patch) => {
      if (patch.setClock) clockStarts.push(patch.setClock)
      Object.assign(store, patch)
    },
  })
  return { rest, store, tones, alerts, clockStarts, advance: (ms: number) => (now += ms), get now() { return now } }
}

const running = (endTime: number): TimerState => ({
  isActive: true, endTime, durationSeconds: 60, label: 'Up next: Squat · set 2', sessionId: 's1', nextExerciseId: 'squat',
})

describe('rest timer', () => {
  it('restoring a rest that’s still running schedules the end tone for the time left and arms the rest alert', () => {
    const t = setup({ timer: running(1_000_000 + 40_000), setClock: null })
    t.rest.restore()
    expect(t.tones.map((x) => x.seconds)).toEqual([40])
    expect(t.alerts.start).toEqual([{ endTime: 1_040_000, body: 'Up next: Squat · set 2', url: '/session/s1/next/squat' }])
    expect(t.store.timer.isActive).toBe(true)
  })

  it('a rest that ended while the app was closed starts the set clock once, from the rest’s end time', () => {
    const t = setup({ timer: running(1_000_000 - 30_000), setClock: null })
    t.rest.restore()
    t.rest.tick()
    t.rest.tick()
    expect(t.clockStarts).toEqual([{ sessionId: 's1', startedAt: 970_000 }])
    expect(t.store.timer.isActive).toBe(false)
    expect(t.tones).toEqual([])
  })

  it('when a rest ends, the set clock starts exactly once, however many screens show the timer', () => {
    const t = setup()
    t.rest.start(60, 'Up next: Squat · set 2', 's1', 'squat')
    t.advance(60_000)
    for (let screen = 0; screen < 4; screen++) t.rest.tick()
    expect(t.clockStarts).toEqual([{ sessionId: 's1', startedAt: 1_060_000 }])
    expect(t.alerts.stops).toBe(1)
  })

  it('skipping a rest cancels the tone and the alert', () => {
    const t = setup()
    t.rest.start(60, 'Up next: Squat · set 2', 's1', 'squat')
    t.advance(10_000)
    t.rest.skip()
    expect(t.tones).toHaveLength(1)
    expect(t.tones[0].cancelled).toBe(true)
    expect(t.alerts.stops).toBe(1)
    expect(t.store.timer.isActive).toBe(false)
    expect(t.clockStarts).toEqual([{ sessionId: 's1', startedAt: 1_010_000 }])
  })
})
