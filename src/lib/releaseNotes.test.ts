import { describe, expect, it } from 'vitest'
import { RELEASES, compareVersions, fromLegacyVersion, releasesSince } from './releaseNotes'

describe('fromLegacyVersion', () => {
  it('maps the old 1.0.x releases to 0.1.x and 1.1.x to 0.2.x', () => {
    expect(fromLegacyVersion('1.0.7')).toBe('0.1.7')
    expect(fromLegacyVersion('1.1.4')).toBe('0.2.4')
  })

  it('leaves versions already numbered 0.x alone', () => {
    expect(fromLegacyVersion('0.2.4')).toBe('0.2.4')
    expect(fromLegacyVersion('0.3.0')).toBe('0.3.0')
  })
})

describe('renumbered release notes', () => {
  it('shows nothing new to a tester who last saw 1.1.4', () => {
    expect(releasesSince(fromLegacyVersion('1.1.4'))).toEqual([])
  })

  it('shows a tester who last saw 1.1.4 the next release, 0.3.0', () => {
    expect(compareVersions('0.3.0', fromLegacyVersion('1.1.4'))).toBeGreaterThan(0)
  })

  it('still shows a tester who last saw 1.1.2 the two releases they missed', () => {
    expect(releasesSince(fromLegacyVersion('1.1.2')).map((r) => r.version)).toEqual(['0.2.4', '0.2.3'])
  })

  it('numbers every release 0.x, newest first', () => {
    for (const r of RELEASES) expect(r.version).toMatch(/^0\.\d+\.\d+$/)
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0)
    }
  })
})
