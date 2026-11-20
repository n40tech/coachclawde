/**
 * Rest-timer alerts: a Web Push notification when a rest ends while the app is
 * in the background (phone locked, another app open).
 *
 * The app arms an alarm when it goes into the background mid-rest and cancels
 * it when it comes back. Alarms are rows in `public.rest_alarms` (one per
 * athlete, service-role only, see supabase/migrations/0007_rest_alarms.sql).
 * While any exist, a once-a-second pg_cron job calls this function with
 * `{ action: 'tick' }`, and it sends the alarms that are due. Nothing waits in
 * here, so the free plan's 150 s worker limit doesn't matter.
 *
 * Requests:
 *   GET                         → { publicKey } (the VAPID key to subscribe with),
 *                                 plus `problem` when the VAPID secrets are wrong
 *   POST { action: 'arm', … }   → store/replace the athlete's alarm
 *   POST { action: 'cancel' }   → drop it
 *   POST { action: 'tick' }     → send due alarms (pg_cron, with the tick secret)
 *
 * The app sends `arm` with navigator.sendBeacon as the page is hidden, so the
 * body is text/plain JSON and carries the athlete's access token itself
 * (beacons can't set headers). `verify_jwt` is off for this function; every
 * athlete action checks the token against Supabase Auth here instead.
 *
 * Plain web APIs only (no Deno globals), so the tests run it in Node.
 */
import { isP256PublicKey, b64urlDecode, sendWebPush, vapidProblem, type PushResult, type PushSubscriptionJSON, type VapidKeys } from '../_shared/webpush.ts'

export interface Config {
  supabaseUrl: string
  /** Service-role key: the table has no client policies. */
  serviceKey: string
  /** Null until the VAPID secrets are set. */
  vapid: VapidKeys | null
  /** Shared with the pg_cron ticker through Vault. */
  tickSecret: string
  now?: () => number
  fetchImpl?: typeof fetch
}

/** The longest rest an alarm can be armed for. */
export const MAX_DELAY_MS = 15 * 60 * 1000
/**
 * Claim alarms due within this lead, so the tick interval and push delivery
 * land the notification on time rather than a second or two late.
 */
export const LEAD_MS = 1000
/** A rest alert is worthless once the next set has started. */
const PUSH_TTL_SECONDS = 60

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

/** Push services a subscription may point at; anything else is refused. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /\.notify\.windows\.com$/,
]

export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(url.hostname))
  } catch {
    return false
  }
}

export function parseSubscription(value: unknown): PushSubscriptionJSON | null {
  if (!value || typeof value !== 'object') return null
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  if (!isPushEndpoint(endpoint)) return null
  const p256dh = keys?.p256dh
  const auth = keys?.auth
  if (typeof p256dh !== 'string' || !isP256PublicKey(p256dh)) return null
  if (typeof auth !== 'string' || auth.length > 64) return null
  try {
    if (b64urlDecode(auth).length !== 16) return null
  } catch {
    return null
  }
  return { endpoint, keys: { p256dh, auth } }
}

export interface AlertPayload {
  title: string
  body: string
  url: string
  tag: 'rest-timer'
}

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
}

export function parsePayload(body: Record<string, unknown>): AlertPayload {
  const url = typeof body.url === 'string' && /^\/[\w\-/.]{0,199}$/.test(body.url) ? body.url : '/'
  return {
    title: text(body.title, 60, 'Rest over'),
    body: text(body.body, 160, 'Time for your next set.'),
    url,
    tag: 'rest-timer',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function safeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function serviceHeaders(cfg: Config, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { apikey: cfg.serviceKey, ...extra }
  // Legacy service_role keys are JWTs and go in Authorization too; the newer
  // sb_secret_ keys only go in `apikey`.
  if (cfg.serviceKey.split('.').length === 3) headers.Authorization = `Bearer ${cfg.serviceKey}`
  return headers
}

async function userIdFor(cfg: Config, token: unknown): Promise<string | null> {
  if (typeof token !== 'string' || !token) return null
  const res = await (cfg.fetchImpl ?? fetch)(`${cfg.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const user = (await res.json().catch(() => null)) as { id?: unknown } | null
  return typeof user?.id === 'string' ? user.id : null
}

interface AlarmRow {
  user_id: string
  alarm_id: string
  fire_at: string
  subscription: PushSubscriptionJSON
  payload: AlertPayload
}

export async function handle(req: Request, cfg: Config): Promise<Response> {
  const f = cfg.fetchImpl ?? fetch
  const now = cfg.now ?? Date.now
  const table = `${cfg.supabaseUrl}/rest/v1/rest_alarms`

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (!cfg.vapid) return json({ error: 'Rest alerts are not set up on this server yet.' }, 503)
  if (req.method === 'GET') {
    // A bad key pair or subject only shows up as push services refusing every
    // alert (Apple: 403 BadJwtToken), so say so where it can be checked.
    const problem = await vapidProblem(cfg.vapid)
    return json({ publicKey: cfg.vapid.publicKey, ...(problem ? { problem } : {}) })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(await req.text())
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object')
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }

  try {
    if (body.action === 'tick') {
      if (!safeEqual(req.headers.get('x-rest-alarm-secret') ?? '', cfg.tickSecret)) {
        return json({ error: 'Forbidden' }, 403)
      }
      // Deleting with return=representation claims the due rows atomically, so
      // overlapping ticks never send the same alert twice.
      const cutoff = new Date(now() + LEAD_MS).toISOString()
      const res = await f(`${table}?fire_at=lte.${encodeURIComponent(cutoff)}`, {
        method: 'DELETE',
        headers: serviceHeaders(cfg, { Prefer: 'return=representation' }),
      })
      if (!res.ok) return json({ error: `Claiming alarms failed (${res.status})` }, 502)
      const rows = (await res.json()) as AlarmRow[]
      const vapid = cfg.vapid
      const results = await Promise.all(
        rows.map((row) =>
          sendWebPush(row.subscription, JSON.stringify(row.payload), vapid, {
            ttlSeconds: PUSH_TTL_SECONDS,
            urgency: 'high',
            fetchImpl: f,
          }).catch((err): PushResult => ({ status: 0, ok: false, gone: false, detail: String(err).slice(0, 200) })),
        ),
      )
      // Why sends failed, for the logs and net._http_response (status and the
      // push service's reason only, never the subscription).
      const errors = results.filter((r) => !r.ok && !r.gone).map((r) => ({ status: r.status, detail: r.detail ?? '' }))
      for (const e of errors) console.error('rest-alarm push failed', e.status, e.detail)
      const problem = errors.length ? await vapidProblem(vapid) : null
      if (problem) console.error('rest-alarm secrets:', problem)
      return json({
        sent: results.filter((r) => r.ok).length,
        gone: results.filter((r) => r.gone).length,
        failed: errors.length,
        ...(errors.length ? { errors } : {}),
        ...(problem ? { problem } : {}),
      })
    }

    if (body.action === 'arm' || body.action === 'cancel') {
      const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      const userId = await userIdFor(cfg, body.token ?? bearer)
      if (!userId) return json({ error: 'Sign in again to use rest alerts.' }, 401)

      const alarmId = body.alarmId
      if (alarmId !== undefined && (typeof alarmId !== 'string' || !/^[\w-]{1,64}$/.test(alarmId))) {
        return json({ error: 'Bad alarm id' }, 400)
      }

      if (body.action === 'cancel') {
        const only = alarmId ? `&alarm_id=eq.${encodeURIComponent(alarmId)}` : ''
        const res = await f(`${table}?user_id=eq.${userId}${only}`, {
          method: 'DELETE',
          headers: serviceHeaders(cfg, { Prefer: 'return=minimal' }),
        })
        return res.ok ? json({ cancelled: true }) : json({ error: `Cancel failed (${res.status})` }, 502)
      }

      const delayMs = body.delayMs
      if (!alarmId) return json({ error: 'Missing alarm id' }, 400)
      if (typeof delayMs !== 'number' || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > MAX_DELAY_MS) {
        return json({ error: 'Bad delay' }, 400)
      }
      const subscription = parseSubscription(body.subscription)
      if (!subscription) return json({ error: 'Bad push subscription' }, 400)

      // The server clock times the alarm: the app sends a delay, not a time,
      // so a phone whose clock is off still gets the alert on time.
      const fireAt = new Date(now() + delayMs).toISOString()
      const row: AlarmRow = { user_id: userId, alarm_id: alarmId, fire_at: fireAt, subscription, payload: parsePayload(body) }
      const res = await f(`${table}?on_conflict=user_id`, {
        method: 'POST',
        headers: serviceHeaders(cfg, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(row),
      })
      return res.ok ? json({ armed: true, fireAt }) : json({ error: `Arming failed (${res.status})` }, 502)
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    console.error('rest-alarm', err)
    return json({ error: 'Something went wrong' }, 500)
  }
}
