import { describe, expect, it } from 'vitest'
import { isAcceptedAlertUrl, restAlertUrl } from './alertLink'

describe('restAlertUrl', () => {
  it('links to the workout at the exercise up next', () => {
    const url = restAlertUrl('session-upper--2026-11-16', 'ex-bench', '/')
    expect(url).toBe('/session/session-upper--2026-11-16/next/ex-bench')
    expect(isAcceptedAlertUrl(url)).toBe(true)
  })

  it('falls back to the workout when the exercise id has other characters', () => {
    expect(restAlertUrl('s1', 'bench press?', '/')).toBe('/session/s1')
    expect(restAlertUrl('s1', undefined, '/')).toBe('/session/s1')
  })

  it('falls back to the given path without a usable session id', () => {
    expect(restAlertUrl(undefined, 'ex', '/x')).toBe('/x')
    expect(restAlertUrl('a b', 'ex', '/x')).toBe('/x')
  })
})
