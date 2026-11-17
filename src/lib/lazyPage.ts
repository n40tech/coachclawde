import { lazy, type ComponentType } from 'react'

/**
 * A page loaded in its own chunk on first visit (`React.lazy`), so the entry
 * chunk only carries what the app needs to start and to run a workout.
 *
 * Every chunk is precached by the service worker, so this is instant offline.
 * One case needs care: once a new version has taken over, the old version's
 * chunks are gone from the cache and the server, but the page on screen can
 * still be running the old code (lib/appUpdate waits for a safe moment to
 * reload). Opening a not-yet-loaded page then fails, so reload into the new
 * version instead. Only once in a short while, so a broken deploy or being
 * offline can't loop: then the error goes to the page's error boundary.
 */
export function lazyPage<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] }), reloadIntoNewVersion))
}

/** sessionStorage: when the last chunk-failure reload happened. */
const RELOADED_AT = 'coach-clawde-chunk-reload'
const RETRY_GAP_MS = 10_000

function reloadIntoNewVersion(error: unknown): Promise<never> {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOADED_AT)) || 0
  } catch {
    // Storage blocked: fall through and allow one reload per page load.
  }
  if (navigator.onLine && Date.now() - last > RETRY_GAP_MS) {
    try {
      sessionStorage.setItem(RELOADED_AT, String(Date.now()))
    } catch {
      // As above.
    }
    window.location.reload()
    // Stay suspended (the current screen stays up) until the reload happens.
    return new Promise<never>(() => {})
  }
  return Promise.reject(error)
}
