import { describe, expect, it } from 'vitest'
import { changedAreas, latestRelease, nextVersion } from './plan.mjs'

const pr = (...labels) => ({ number: 1, title: 'x', labels })

describe('nextVersion', () => {
  it('bumps the minor version when any merged PR is a feature', () => {
    expect(nextVersion('0.2.4', [pr('fix'), pr('feature', 'manual-test')], false)).toBe('0.3.0')
  })

  it('bumps the patch version when everything is a fix or internal', () => {
    expect(nextVersion('0.2.4', [pr('fix'), pr('internal')], false)).toBe('0.2.5')
  })

  it('bumps the minor version for a database migration, even with only fixes', () => {
    expect(nextVersion('0.2.4', [pr('fix')], true)).toBe('0.3.0')
  })

  it('counts a PR with no release label as a patch', () => {
    expect(nextVersion('0.2.4', [pr()], false)).toBe('0.2.5')
  })

  it('has nothing to release when nothing was merged', () => {
    expect(nextVersion('0.2.4', [], false)).toBeNull()
  })
})

describe('changedAreas', () => {
  it('spots migrations and Edge Function changes', () => {
    expect(changedAreas(['supabase/migrations/0008_x.sql', 'src/App.tsx'])).toEqual({ migrations: true, functions: false })
    expect(changedAreas(['supabase/functions/_shared/webpush.ts'])).toEqual({ migrations: false, functions: true })
  })

  it('ignores everything else', () => {
    expect(changedAreas(['src/lib/units.ts', 'docs/DEVELOPING.md'])).toEqual({ migrations: false, functions: false })
  })
})

describe('latestRelease', () => {
  it('picks the highest version tag by number, not alphabetically', () => {
    expect(latestRelease(['v0.2.4', 'v0.10.0', 'v0.3.1'])).toBe('0.10.0')
  })

  it('ignores tags that are not releases', () => {
    expect(latestRelease(['v0.2.4', 'nightly', 'v1-beta'])).toBe('0.2.4')
  })

  it('returns null before the first release', () => {
    expect(latestRelease([])).toBeNull()
  })
})
