import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SyncStatus } from '../lib/supabaseSync'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { METRIC, type Units } from '../lib/units'
import type { PlanMethod } from '../lib/planMethods'

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
  /** How the athlete last made a week's plan; the planner offers it first. */
  lastPlanMethod: PlanMethod | null
  /** Beta: after a rest, the next tap starts timing the next set. */
  autoSetTimer: boolean

  setSyncStatus: (status: SyncStatus, error?: string) => void
  markSynced: () => void
  setUnits: (patch: Partial<Units>) => void
  setRestAlerts: (on: boolean) => void
  dismissRestAlertsOffer: () => void
  setRestTimerMinimised: (minimised: boolean) => void
  setLastPlanMethod: (method: PlanMethod) => void
  setAutoSetTimer: (on: boolean) => void
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
      lastPlanMethod: null,
      autoSetTimer: true,

      setSyncStatus: (status, error) =>
        set({ syncStatus: status, syncError: error ?? null }),

      markSynced: () =>
        set({ lastSyncAt: new Date().toISOString(), syncStatus: 'success', syncError: null }),

      setUnits: (patch) => set((s) => ({ units: { ...s.units, ...patch } })),
      setRestAlerts: (on) => set({ restAlerts: on }),
      dismissRestAlertsOffer: () => set({ restAlertsOfferDismissed: true }),
      setRestTimerMinimised: (minimised) => set({ restTimerMinimised: minimised }),
      setLastPlanMethod: (method) => set({ lastPlanMethod: method }),
      setAutoSetTimer: (on) => set({ autoSetTimer: on }),
    }),
    {
      name: STORAGE_KEYS.settings,
      partialize: (s) => ({
        lastSyncAt: s.lastSyncAt,
        units: s.units,
        restAlerts: s.restAlerts,
        restAlertsOfferDismissed: s.restAlertsOfferDismissed,
        restTimerMinimised: s.restTimerMinimised,
        lastPlanMethod: s.lastPlanMethod,
        autoSetTimer: s.autoSetTimer,
      }),
    }
  )
)

/** The athlete's display units. */
export const useUnits = () => useSettingsStore((s) => s.units)
