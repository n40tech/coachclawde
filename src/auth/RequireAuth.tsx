import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { useAutoSync } from '../hooks/useAutoSync'
import { useAppStore } from '../store/useAppStore'
import { QuinnMark } from '../components/shared/QuinnMark'

/**
 * Gates the app behind authentication and keeps the local store scoped to the
 * signed-in user:
 *   • On sign-in (the user changes) it pulls that user's data from Supabase.
 *   • On sign-out it resets the store so one account's data can't leak into the
 *     next on a shared device.
 *
 * When Supabase isn't configured (no env vars) it transparently passes through,
 * preserving the offline single-user experience for local dev.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth()
  const { pull } = useAutoSync()
  const reset = useAppStore((s) => s.reset)
  // This device already holds the athlete's data (the persisted store is
  // cleared on sign-out, so it belongs to whoever is signed in).
  const hasLocalData = useAppStore((s) => !!s.profile.onboarded)
  const identity = user?.id ?? null
  const lastIdentity = useRef<string | null>(null)
  // Block render until the signed-in identity's data has been pulled, so the
  // onboarding gate (which keys off the profile) never flashes for a returning
  // user before their real profile has loaded. Skipped when the device already
  // has an onboarded profile (see below).
  const [pulled, setPulled] = useState(false)

  useEffect(() => {
    if (!configured) return
    if (identity) {
      if (lastIdentity.current !== identity) {
        lastIdentity.current = identity
        setPulled(false)
        void pull().finally(() => setPulled(true))
      }
    } else if (lastIdentity.current !== null) {
      // Signed out after being signed in — clear local data.
      lastIdentity.current = null
      setPulled(false)
      reset()
    }
  }, [configured, identity, pull, reset])

  if (!configured) return <>{children}</>

  // Reopening the app shouldn't sit on a loading screen while the database
  // answers: with the athlete's data already on the device, show the app at
  // once and let the pull refresh it in the background.
  if (loading || (identity && !pulled && !hasLocalData)) {
    return (
      <main className="flex items-center justify-center min-h-svh polar-page">
        <QuinnMark size={56} idle />
        <p role="status" className="sr-only">Loading your training…</p>
      </main>
    )
  }

  if (!identity) return <Navigate to="/login" replace />

  return <>{children}</>
}
