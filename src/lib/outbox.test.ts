import { describe, expect, it } from 'vitest'
import { PROFILE_ID, flushOutbox, mergeRemote, recordChange, seedOutbox, type OutboxEntry, type Pusher, type SyncedData } from './outbox'
import { DEFAULT_PROFILE } from './profileData'
import type { LoggedSession, UserProfile, WeekPlan } from '../types'

const log = (id: string, over: Partial<LoggedSession> = {}): LoggedSession => ({
  id, plannedSessionId: `s-${id}`, weekPlanId: 'p1', date: '2026-11-23', type: 'weights', title: 'Upper',
  startedAt: '2026-11-23T10:00:00.000Z', status: 'complete', ...over,
}) as LoggedSession
const plan = (id: string): WeekPlan => ({ id, weekStartDate: '2026-11-23', availableDays: ['Mon'], userNotes: '', createdAt: '', sessions: [] })
const profile = (name: string): UserProfile => ({ ...DEFAULT_PROFILE, name, updatedAt: '2026-11-23T10:00:00.000Z' })
const data = (over: Partial<SyncedData> = {}): SyncedData => ({ profile: profile('Local'), weekPlans: [], loggedSessions: [], ...over })

/** An in-memory database standing in for Supabase. */
function fakeDb(failing: string[] = []) {
  const calls: string[] = []
  const go = async (what: string) => {
    if (failing.includes(what)) throw new Error('offline')
    calls.push(what)
  }
  const push: Pusher = {
    profile: (p) => go(`profile:${p.name}`),
    plan: (p) => go(`plan:${p.id}`),
    session: (s) => go(`session:${s.id}:${s.status}`),
    deleteSession: (id) => go(`delete:${id}`),
  }
  return { calls, push }
}

const record = (...changes: [OutboxEntry['collection'], string, OutboxEntry['op']][]) =>
  changes.reduce<OutboxEntry[]>((o, [c, id, op]) => recordChange(o, c, id, op), [])

describe('mergeRemote', () => {
  it('keeps a workout finished offline complete after the next pull', () => {
    const local = data({ loggedSessions: [log('w1', { status: 'complete', feelings: 4 })] })
    const remote = { profile: profile('Remote'), weekPlans: [], loggedSessions: [log('w1', { status: 'in-progress' })] }
    const next = mergeRemote(local, record(['sessions', 'w1', 'upsert']), remote)
    expect(next.loggedSessions).toEqual([expect.objectContaining({ id: 'w1', status: 'complete', feelings: 4 })])
  })

  it('keeps a plan imported offline after the next pull', () => {
    const local = data({ weekPlans: [plan('p-new')] })
    const next = mergeRemote(local, record(['plans', 'p-new', 'upsert']), { profile: null, weekPlans: [plan('p-old')], loggedSessions: [] })
    expect(next.weekPlans.map((p) => p.id).sort()).toEqual(['p-new', 'p-old'])
  })

  it('keeps a profile edit that has not been pushed over the database’s older copy', () => {
    const next = mergeRemote(data(), record(['profile', PROFILE_ID, 'upsert']), { profile: profile('Remote'), weekPlans: [], loggedSessions: [] })
    expect(next.profile.name).toBe('Local')
    expect(mergeRemote(data(), [], { profile: profile('Remote'), weekPlans: [], loggedSessions: [] }).profile.name).toBe('Remote')
  })

  it('keeps a log deleted offline deleted after the next pull', () => {
    const next = mergeRemote(data(), record(['sessions', 'gone', 'delete']), { profile: null, weekPlans: [], loggedSessions: [log('gone')] })
    expect(next.loggedSessions).toEqual([])
  })

  it('removes a session deleted on another device', () => {
    const next = mergeRemote(data({ loggedSessions: [log('elsewhere')] }), [], { profile: null, weekPlans: [], loggedSessions: [] })
    expect(next.loggedSessions).toEqual([])
  })
})

describe('seedOutbox', () => {
  it('on the first launch after the update, queues the local records the database doesn’t have', () => {
    const local = data({ weekPlans: [plan('p-local'), plan('p-both')], loggedSessions: [log('l-local'), log('l-both')] })
    const remote = { profile: profile('Remote'), weekPlans: [plan('p-both')], loggedSessions: [log('l-both')] }
    const outbox = seedOutbox(local, remote)
    expect(outbox.map((e) => `${e.collection}:${e.id}:${e.op}`).sort()).toEqual(['plans:p-local:upsert', 'sessions:l-local:upsert'])
    const next = mergeRemote(local, outbox, remote)
    expect(next.weekPlans.map((p) => p.id).sort()).toEqual(['p-both', 'p-local'])
    expect(next.loggedSessions.map((s) => s.id).sort()).toEqual(['l-both', 'l-local'])
  })
})

describe('flushOutbox', () => {
  it('pushes each pending change and the delete made offline', async () => {
    const db = fakeDb()
    const left = await flushOutbox(record(['sessions', 'w1', 'upsert'], ['sessions', 'gone', 'delete'], ['profile', PROFILE_ID, 'upsert']),
      data({ loggedSessions: [log('w1')] }), db.push)
    expect(db.calls.sort()).toEqual(['delete:gone', 'profile:Local', 'session:w1:complete'])
    expect(left).toEqual([])
  })

  it('keeps an entry in the outbox until its push succeeds', async () => {
    const outbox = record(['sessions', 'w1', 'upsert'], ['plans', 'p1', 'upsert'])
    const left = await flushOutbox(outbox, data({ loggedSessions: [log('w1')], weekPlans: [plan('p1')] }), fakeDb(['session:w1:complete']).push)
    expect(left.map((e) => e.id)).toEqual(['w1'])
  })

  it('records only the latest change to a record', () => {
    const outbox = record(['sessions', 'w1', 'upsert'], ['sessions', 'w1', 'delete'])
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({ op: 'delete' })
  })
})
