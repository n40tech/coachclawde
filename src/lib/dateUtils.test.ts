import { afterEach, describe, expect, it, vi } from 'vitest'
import { sessionDayKey } from './dateUtils'

afterEach(() => {
  vi.unstubAllEnvs()
})

/** A UTC timestamp for a local wall-clock time in the current timezone. */
const localTime = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString()

describe('sessionDayKey', () => {
  it.each(['America/Los_Angeles', 'America/New_York'])(
    'counts a session finished at 19:00 local time on that local day (%s)',
    (tz) => {
      vi.stubEnv('TZ', tz)
      const completedAt = localTime(2026, 11, 25, 19)
      expect(sessionDayKey({ date: '2026-11-25', completedAt })).toBe('2026-11-25')
    },
  )

  it('counts a session finished just after midnight in a UK summer on the new day', () => {
    vi.stubEnv('TZ', 'Europe/London')
    const completedAt = localTime(2026, 7, 15, 0, 20) // 23:20 UTC on the 14th
    expect(sessionDayKey({ date: '2026-07-14', completedAt })).toBe('2026-07-15')
  })
})
