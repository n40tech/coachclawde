import type { LoggedSession, UserProfile, WeekPlan } from '../types'

/**
 * The offline outbox: changes made on this device that haven't reached the
 * database yet. The rule (#27): a change made here and not yet pushed beats
 * the database; everything else follows the database, deletions included.
 *
 * Kept on the device only (persisted with the store, cleared on sign-out).
 * The store records its own changes (`recordChange`); sync pushes them
 * (`flushOutbox`) and merges every pull through them (`mergeRemote`).
 */

export type OutboxCollection = 'profile' | 'plans' | 'sessions'

export interface OutboxEntry {
  collection: OutboxCollection
  id: string
  op: 'upsert' | 'delete'
  /** Bumped on every change, so a push only clears the change it pushed. */
  seq: number
}

export interface SyncedData {
  profile: UserProfile
  weekPlans: WeekPlan[]
  loggedSessions: LoggedSession[]
}

export interface RemoteData {
  profile: UserProfile | null
  weekPlans: WeekPlan[]
  loggedSessions: LoggedSession[]
}

/** How changes reach the database (supabaseSync, or an in-memory stand-in in tests). */
export interface Pusher {
  profile: (p: UserProfile) => Promise<void>
  plan: (p: WeekPlan) => Promise<void>
  session: (s: LoggedSession) => Promise<void>
  deleteSession: (id: string) => Promise<void>
}

/** The profile is one record. */
export const PROFILE_ID = 'profile'

let counter = 0
const nextSeq = () => Date.now() * 1000 + (counter++ % 1000)

/** Adds a change, replacing any earlier one to the same record (only the latest matters). */
export function recordChange(outbox: OutboxEntry[], collection: OutboxCollection, id: string, op: OutboxEntry['op']): OutboxEntry[] {
  return [...outbox.filter((e) => !(e.collection === collection && e.id === id)), { collection, id, op, seq: nextSeq() }]
}

/**
 * First launch after the outbox shipped: there's no outbox yet, so queue every
 * local record the database doesn't have (today's "local-only records are
 * kept"). The profile is queued only when the database has none.
 */
export function seedOutbox(local: SyncedData, remote: RemoteData): OutboxEntry[] {
  let out: OutboxEntry[] = []
  const remotePlans = new Set(remote.weekPlans.map((p) => p.id))
  const remoteLogs = new Set(remote.loggedSessions.map((s) => s.id))
  for (const p of local.weekPlans) if (!remotePlans.has(p.id)) out = recordChange(out, 'plans', p.id, 'upsert')
  for (const s of local.loggedSessions) if (!remoteLogs.has(s.id)) out = recordChange(out, 'sessions', s.id, 'upsert')
  if (!remote.profile) out = recordChange(out, 'profile', PROFILE_ID, 'upsert')
  return out
}

function mergeRecords<T extends { id: string }>(local: T[], remote: T[], pending: Map<string, OutboxEntry['op']>): T[] {
  const localById = new Map(local.map((r) => [r.id, r]))
  const merged: T[] = []
  for (const r of remote) {
    const op = pending.get(r.id)
    if (op === 'delete') continue
    merged.push(op === 'upsert' ? localById.get(r.id) ?? r : r)
  }
  const remoteIds = new Set(remote.map((r) => r.id))
  for (const r of local) if (pending.get(r.id) === 'upsert' && !remoteIds.has(r.id)) merged.push(r)
  return merged
}

/** The next local state after a pull: pending local changes win, the database decides the rest. */
export function mergeRemote(local: SyncedData, outbox: OutboxEntry[], remote: RemoteData): SyncedData {
  const pending = (c: OutboxCollection) => new Map(outbox.filter((e) => e.collection === c).map((e) => [e.id, e.op]))
  const profilePending = outbox.some((e) => e.collection === 'profile')
  return {
    profile: profilePending || !remote.profile ? local.profile : remote.profile,
    weekPlans: mergeRecords(local.weekPlans, remote.weekPlans, pending('plans')),
    loggedSessions: mergeRecords(local.loggedSessions, remote.loggedSessions, pending('sessions')),
  }
}

/**
 * Pushes every pending change, reading each record as it is now. Returns the
 * entries that are still pending: those whose push failed. A change recorded
 * meanwhile has a new `seq` and is cleared by the caller only if it matches.
 */
export async function flushOutbox(outbox: OutboxEntry[], data: SyncedData, push: Pusher): Promise<OutboxEntry[]> {
  const left: OutboxEntry[] = []
  for (const e of outbox) {
    try {
      if (e.collection === 'profile') await push.profile(data.profile)
      else if (e.collection === 'plans') {
        const p = data.weekPlans.find((x) => x.id === e.id)
        if (p) await push.plan(p)
      } else if (e.op === 'delete') await push.deleteSession(e.id)
      else {
        const s = data.loggedSessions.find((x) => x.id === e.id)
        if (s) await push.session(s)
      }
    } catch {
      left.push(e)
    }
  }
  return left
}
