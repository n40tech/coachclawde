import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SyncStatus } from '../lib/supabaseSync'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { METRIC, type Units } from '../lib/units'

interface SettingsStore {
  lastSyncAt: string | null
  syncStatus: SyncStatus
  syncError: string | null
  /** Display units, per device. Data is always stored in metric. */
  units: Units
  /** Rest alerts (push notifications) are on for this device. */
  restAlerts: boolean
  /** The athlete said "not now" to the rest-alert offer on the rest timer. */
  restAlertsOfferDismissed: boolean
  /** The rest timer opens as a small bar instead of full screen. */
  restTimerMinimised: boolean

  setSyncStatus: (status: SyncStatus, error?: string) => void
  markSynced: () => void
  setUnits: (patch: Partial<Units>) => void
  setRestAlerts: (on: boolean) => void
  dismissRestAlertsOffer: () => void
  setRestTimerMinimised: (minimised: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      lastSyncAt: null,
      syncStatus: 'idle',
      syncError: null,
      units: METRIC,
      restAlerts: false,
      restAlertsOfferDismissed: false,
      restTimerMinimised: false,

      setSyncStatus: (status, error) =>
        set({ syncStatus: status, syncError: error ?? null }),

      markSynced: () =>
        set({ lastSyncAt: new Date().toISOString(), syncStatus: 'success', syncError: null }),

      setUnits: (patch) => set((s) => ({ units: { ...s.units, ...patch } })),
      setRestAlerts: (on) => set({ restAlerts: on }),
      dismissRestAlertsOffer: () => set({ restAlertsOfferDismissed: true }),
      setRestTimerMinimised: (minimised) => set({ restTimerMinimised: minimised }),
    }),
    {
      name: STORAGE_KEYS.settings,
      partialize: (s) => ({
        lastSyncAt: s.lastSyncAt,
        units: s.units,
        restAlerts: s.restAlerts,
        restAlertsOfferDismissed: s.restAlertsOfferDismissed,
        restTimerMinimised: s.restTimerMinimised,
      }),
    }
  )
)

/** The athlete's display units. */
export const useUnits = () => useSettingsStore((s) => s.units)
