/**
 * Rest alerts: a push notification when a rest ends while the app is in the
 * background (phone locked, another app open). The in-app tone only plays
 * while the app is on screen, because iOS suspends web apps in the background.
 *
 * Pieces:
 * - this module: whether the device can do it, turning it on (notification
 *   permission + a push subscription) and the wired-up arm/cancel controller;
 * - lib/restAlarmController: when to arm and cancel (pure, tested);
 * - public/push-sw.js: shows the notification (imported by the service worker);
 * - supabase/functions/rest-alarm + migration 0007: stores alarms and sends
 *   them on time.
 *
 * Push needs a service worker, so it only works in the built app (not
 * `npm run dev`), and on iPhone only once the app is on the Home Screen.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { getDeviceShape } from './deviceShape'
import { nanoid } from './nanoid'
import { createRestAlarmController } from './restAlarmController'
import { useSettingsStore } from '../store/useSettingsStore'

const FUNCTION_URL = isSupabaseConfigured ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rest-alarm` : ''

export type RestAlertSupport =
  /** Can be turned on (or already is). */
  | 'available'
  /** The athlete said no to notifications; only the OS settings can undo it. */
  | 'blocked'
  /** iPhone/iPad in Safari: works once added to the Home Screen. */
  | 'install'
  /** No push here (old browser, or no backend). */
  | 'unsupported'

function isAppleMobile(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function restAlertSupport(): RestAlertSupport {
  if (!isSupabaseConfigured || typeof window === 'undefined') return 'unsupported'
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!hasPush) return isAppleMobile() && !getDeviceShape().standalone ? 'install' : 'unsupported'
  return Notification.permission === 'denied' ? 'blocked' : 'available'
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function bytesToB64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

/** The service worker's registration; rejects in dev, where none is registered. */
function registration(): Promise<ServiceWorkerRegistration> {
  return withTimeout(navigator.serviceWorker.ready, 5000)
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (restAlertSupport() !== 'available') return null
  try {
    return await (await registration()).pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * An access token that will still be valid when the rest ends: the server
 * checks it when the alarm is armed, which can be any time before then.
 */
async function freshToken(validForMs: number): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  let session = data.session
  if (!session) return null
  if ((session.expires_at ?? 0) * 1000 - Date.now() < validForMs + 60_000) {
    session = (await supabase.auth.refreshSession()).data.session ?? session
  }
  return session.access_token
}

/** Posts as text/plain, which needs no CORS preflight (and works as a beacon). */
function post(body: object, opts: { beacon?: boolean } = {}): Promise<Response> | null {
  const text = JSON.stringify(body)
  if (opts.beacon && typeof navigator.sendBeacon === 'function') {
    if (navigator.sendBeacon(FUNCTION_URL, new Blob([text], { type: 'text/plain' }))) return null
  }
  return fetch(FUNCTION_URL, { method: 'POST', body: text, keepalive: true, headers: { 'Content-Type': 'text/plain' } })
}

export type EnableResult = { ok: true } | { ok: false; message: string }

const BLOCKED =
  'Notifications are turned off for Coach Quinn. Turn them on in your phone’s Settings → Notifications, then try again.'

interface Ready {
  reg: ServiceWorkerRegistration
  publicKey: string
}

let ready: Ready | null = null
let preparing: Promise<Ready> | null = null

/**
 * Fetches what subscribing needs (the service worker and the server's VAPID
 * key) ahead of the tap, so the tap can call subscribe() straight away:
 * Safari only allows it, and its permission prompt, inside a user gesture.
 * Call when a screen offering alerts opens.
 */
export function prepareRestAlerts(): Promise<Ready> | null {
  if (ready) return Promise.resolve(ready)
  if (preparing || restAlertSupport() !== 'available') return preparing
  preparing = (async () => {
    const reg = await registration()
    const res = await fetch(FUNCTION_URL)
    if (!res.ok) throw new Error(`public key: ${res.status}`)
    const { publicKey } = (await res.json()) as { publicKey: string }
    // Subscribed with another server key (keys rotated): pushes to it would
    // be rejected, so drop it and let the athlete subscribe again.
    const sub = await reg.pushManager.getSubscription()
    const key = sub?.options?.applicationServerKey
    if (sub && key && bytesToB64url(key) !== publicKey) {
      await sub.unsubscribe()
      useSettingsStore.getState().setRestAlerts(false)
    }
    ready = { reg, publicKey }
    return ready
  })()
  preparing.catch(() => {
    preparing = null
  })
  return preparing
}

function subscribe({ reg, publicKey }: Ready): Promise<PushSubscription> {
  // Resolves with the existing subscription when there already is one.
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(publicKey) })
}

/**
 * Asks for notification permission and subscribes this device. Call straight
 * from a tap, with nothing awaited before it (see prepareRestAlerts).
 */
export async function enableRestAlerts(): Promise<EnableResult> {
  const support = restAlertSupport()
  if (support === 'blocked') return { ok: false, message: BLOCKED }
  if (support !== 'available') return { ok: false, message: 'Rest alerts aren’t available on this device.' }

  try {
    if (ready) {
      // subscribe() shows the permission prompt itself.
      await subscribe(ready)
    } else {
      // Not prepared yet: ask for permission inside the tap, then subscribe.
      const permission =
        Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
      if (permission !== 'granted') throw new Error(permission)
      await subscribe(await (prepareRestAlerts() ?? Promise.reject(new Error('unavailable'))))
    }
    useSettingsStore.getState().setRestAlerts(true)
    return { ok: true }
  } catch {
    if (Notification.permission === 'denied') return { ok: false, message: BLOCKED }
    if (Notification.permission === 'default') return { ok: false, message: 'Allow notifications to get rest alerts.' }
    return { ok: false, message: 'Couldn’t turn on rest alerts. Check your connection and try again.' }
  }
}

export async function disableRestAlerts(): Promise<void> {
  useSettingsStore.getState().setRestAlerts(false)
  restAlarm.stop()
  const sub = await currentSubscription()
  await sub?.unsubscribe().catch(() => false)
}

/**
 * Turns the setting off if the device has lost what it needs (permission
 * withdrawn in iOS Settings, or the subscription revoked). Returns whether
 * alerts are on.
 */
export async function checkRestAlerts(): Promise<boolean> {
  const { restAlerts, setRestAlerts } = useSettingsStore.getState()
  if (!restAlerts) return false
  const ok = restAlertSupport() === 'available' && Notification.permission === 'granted' && !!(await currentSubscription())
  if (!ok) setRestAlerts(false)
  return ok
}

/** Sends a test alert through the whole pipeline in `delayMs`. */
export async function sendTestAlert(delayMs = 5000): Promise<EnableResult> {
  try {
    const sub = await currentSubscription()
    const token = await freshToken(delayMs)
    if (!sub || !token) return { ok: false, message: 'Turn rest alerts off and on again, then retry.' }
    const res = await post({
      action: 'arm',
      token,
      alarmId: nanoid(),
      delayMs,
      subscription: sub.toJSON(),
      title: 'Rest alerts are on',
      body: 'This is how you’ll know a rest is over when your phone is locked.',
      url: '/settings',
    })
    if (!res?.ok) throw new Error(String(res?.status))
    return { ok: true }
  } catch {
    return { ok: false, message: 'Couldn’t send a test alert. Check your connection and try again.' }
  }
}

interface Prepared {
  token: string
  subscription: PushSubscriptionJSON
}

/** Arms the alarm while the app is hidden mid-rest; see restAlarmController. */
export const restAlarm = createRestAlarmController<Prepared>({
  now: () => Date.now(),
  isHidden: () => document.visibilityState === 'hidden',
  newId: nanoid,
  async prepare(endTime) {
    if (!useSettingsStore.getState().restAlerts) return null
    const sub = await currentSubscription()
    if (!sub) {
      void checkRestAlerts()
      return null
    }
    const token = await freshToken(endTime - Date.now())
    return token ? { token, subscription: sub.toJSON() } : null
  },
  arm(prepared, request) {
    void post({ action: 'arm', token: prepared.token, subscription: prepared.subscription, ...request }, { beacon: true })?.catch(() => {})
  },
  cancel(prepared, alarmId) {
    void post({ action: 'cancel', token: prepared.token, alarmId })?.catch(() => {})
  },
})

let listening = false

/** Starts following page visibility (once). */
export function watchVisibilityForRestAlarm(): void {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener('visibilitychange', () =>
    document.visibilityState === 'hidden' ? restAlarm.hidden() : restAlarm.shown(),
  )
  // iOS can skip visibilitychange when the app is swiped away.
  window.addEventListener('pagehide', () => restAlarm.hidden())
}
