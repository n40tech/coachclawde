import { useSettingsStore } from '../../store/useSettingsStore'
import { useAuth } from '../../auth/AuthProvider'
import { Cloud, CloudOff, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'

export function SyncIndicator() {
  const { user, configured } = useAuth()
  const { syncStatus, syncError, lastSyncAt } = useSettingsStore()

  // Signed out (or running in local-only mode) — nothing is syncing.
  if (!configured || !user) {
    return (
      <div className="flex items-center gap-1.5 text-haze">
        <CloudOff size={13} aria-hidden />
        <span className="text-2xs">{configured ? 'Signed out' : 'Local only'}</span>
      </div>
    )
  }

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-mist">
        <Loader size={13} className="motion-safe:animate-spin" aria-hidden />
        <span className="text-2xs">Syncing…</span>
      </div>
    )
  }

  if (syncStatus === 'error') {
    // The reason is shown on hover and read out with the label (a `title`
    // alone is mouse-only).
    return (
      <div className="flex items-center gap-1.5 text-red-400" title={syncError ?? ''}>
        <AlertCircle size={13} aria-hidden />
        <span className="text-2xs">Sync failed{syncError && <span className="sr-only">: {syncError}</span>}</span>
      </div>
    )
  }

  if (syncStatus === 'success' && lastSyncAt) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-500">
        <CheckCircle size={13} aria-hidden />
        <span className="text-2xs">{formatDistanceToNow(parseISO(lastSyncAt), { addSuffix: true })}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-haze">
      <Cloud size={13} aria-hidden />
      <span className="text-2xs">Auto-sync on</span>
    </div>
  )
}
