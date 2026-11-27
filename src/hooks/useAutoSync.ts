import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useAuth } from '../auth/AuthProvider'
import { pushWeekPlans, pushLoggedSession, pushProfile, pullAll, deleteLoggedSession } from '../lib/supabaseSync'
import { flushOutbox, mergeRemote, seedOutbox, type Pusher } from '../lib/outbox'

export type SyncTarget = 'sessions' | 'plans' | 'profile' | 'all'

/**
 * Pushes/pulls the signed-in user's data to/from Supabase. The local Zustand
 * store (persisted to localStorage) stays the working cache for offline use;
 * this layer keeps the database in sync. No-ops when signed out (e.g. local
 * single-user mode), so callers don't need to guard.
 *
 * Every push goes through the outbox (lib/outbox): the store records each
 * change it makes, and `sync()` / `syncSession()` push whatever is pending,
 * reading the records at call time. An entry leaves the outbox only once its
 * push succeeds, so a change made offline goes up on the next sync, and a pull
 * never undoes it: a change made here and not yet pushed beats the database.
 */
export function useAutoSync() {
  const { user } = useAuth()
  const { setSyncStatus, markSynced } = useSettingsStore()

  const fail = useCallback(
    (e: unknown, fallback: string) =>
      setSyncStatus('error', e instanceof Error ? e.message : fallback),
    [setSyncStatus]
  )

  /** Pushes every pending change; true when nothing is left pending. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (!user) return true
    const state = useAppStore.getState()
    const outbox = state.outbox
    if (!outbox.length) return true
    const push: Pusher = {
      profile: (p) => pushProfile(user.id, p),
      plan: (p) => pushWeekPlans(user.id, [p]),
      session: (s) => pushLoggedSession(user.id, s),
      deleteSession: (id) => deleteLoggedSession(user.id, id),
    }
    const left = await flushOutbox(outbox, state, push)
    state.clearPushed(outbox.filter((e) => !left.includes(e)))
    return left.length === 0
  }, [user])

  const pushPending = useCallback(async () => {
    if (!user) return
    setSyncStatus('syncing')
    try {
      if (await flush()) markSynced()
      else setSyncStatus('error', "Some changes haven't reached your account yet")
    } catch (e: unknown) {
      fail(e, 'Sync failed')
    }
  }, [user, flush, setSyncStatus, markSynced, fail])

  /** Pushes pending changes. The target is kept for callers; everything pending goes. */
  const sync = useCallback(
    async (target: SyncTarget = 'sessions') => {
      void target
      await pushPending()
    },
    [pushPending]
  )

  /** The in-workout autosave on each completed set: pushes pending changes. */
  const syncSession = useCallback(
    async (sessionId: string) => {
      void sessionId
      await pushPending()
    },
    [pushPending]
  )

  /**
   * Deletes a logged session locally (at once, signed in or not) and queues the
   * delete, which is pushed now or, offline, on a later sync.
   */
  const removeSession = useCallback(
    async (sessionId: string) => {
      useAppStore.getState().removeLoggedSession(sessionId)
      await pushPending()
    },
    [pushPending]
  )

  /**
   * Pulls the account's data and merges it through the outbox. The first pull
   * after the outbox shipped seeds it with every local record the database
   * doesn't have, so nothing unpushed at upgrade time is lost.
   */
  const pull = useCallback(async () => {
    if (!user) return
    setSyncStatus('syncing')
    try {
      const remote = await pullAll(user.id)
      const state = useAppStore.getState()
      if (!state.outboxSeeded) state.setOutbox([...seedOutbox(state, remote), ...state.outbox], true)
      const now = useAppStore.getState()
      now.restoreFromRemote(mergeRemote(now, now.outbox, remote))
      if (await flush()) markSynced()
      else setSyncStatus('error', "Some changes haven't reached your account yet")
    } catch (e: unknown) {
      fail(e, 'Restore failed')
    }
  }, [user, flush, setSyncStatus, markSynced, fail])

  return { sync, syncSession, removeSession, pull, isConfigured: !!user }
}
