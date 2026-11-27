import { describe, expect, it } from 'vitest'
import { profileToRow, rowToProfile } from './supabaseSync'
import { DEFAULT_PROFILE } from './profileData'
import type { UserProfile } from '../types'

describe('profile rows', () => {
  it('keeps an athlete who picked Other as other through a save and a pull back', () => {
    const profile: UserProfile = { ...DEFAULT_PROFILE, sex: 'other', updatedAt: '2026-11-27T10:00:00.000Z' }
    expect(rowToProfile(profileToRow('u1', profile)).sex).toBe('other')
  })
})
