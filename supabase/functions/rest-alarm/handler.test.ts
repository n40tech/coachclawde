import { beforeEach, describe, expect, it } from 'vitest'
import { generateVapidKeys, b64urlEncode, type VapidKeys } from '../_shared/webpush.ts'
import { handle, isPushEndpoint, LEAD_MS, MAX_DELAY_MS, parsePayload, type Config } from './handler.ts'

const SUPABASE = 'https://ref.supabase.co'
const NOW = Date.parse('2026-11-17T21:00:00.000Z')
const USER = '05f4a04a-0000-4000-8000-000000000001'

interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

/** A fake Supabase (Auth + PostgREST) and push service. */
function fakeBackend(opts: { rows?: unknown[]; pushStatus?: number } = {}) {
  const calls: Call[] = []
  const impl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    const headers = (init.headers ?? {}) as Record<string, string>
    calls.push({ method: init.method ?? 'GET', url, headers, body: typeof init.body === 'string' ? init.body : undefined })
    if (url === `${SUPABASE}/auth/v1/user`) {
      return headers.Authorization === 'Bearer good-token'
        ? Response.json({ id: USER })
        : Response.json({ msg: 'bad jwt' }, { status: 401 })
    }
    if (url.startsWith(`${SUPABASE}/rest/v1/rest_alarms`)) {
      if (init.method === 'DELETE' && headers.Prefer === 'return=representation') return Response.json(opts.rows ?? [])
      return new Response(null, { status: init.method === 'POST' ? 201 : 204 })
    }
    return new Response(null, { status: opts.pushStatus ?? 201 })
  }) as typeof fetch
  return { calls, impl }
}

let vapid: VapidKeys
let subscription: { endpoint: string; keys: { p256dh: string; auth: string } }

beforeEach(async () => {
  vapid = { ...(await generateVapidKeys()), subject: 'https://coachclawde.vercel.app' }
  const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  subscription = {
    endpoint: 'https://web.push.apple.com/QGuS3uN',
    keys: {
      p256dh: b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey))),
      auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))),
    },
  }
})

function config(fetchImpl: typeof fetch, overrides: Partial<Config> = {}): Config {
  return { supabaseUrl: SUPABASE, serviceKey: 'a.b.c', vapid, tickSecret: 'tick-secret', now: () => NOW, fetchImpl, ...overrides }
}

function post(body: unknown, headers: Record<string, string> = {}) {
  // text/plain, like navigator.sendBeacon sends it.
  return new Request('https://ref.supabase.co/functions/v1/rest-alarm', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8', ...headers },
    body: JSON.stringify(body),
  })
}

describe('rest-alarm handler', () => {
  it('answers CORS preflights and hands out the VAPID public key', async () => {
    const { impl } = fakeBackend()
    const pre = await handle(new Request('https://x/', { method: 'OPTIONS' }), config(impl))
    expect(pre.status).toBe(204)
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const res = await handle(new Request('https://x/'), config(impl))
    expect(await res.json()).toEqual({ publicKey: vapid.publicKey })
  })

  it('reports 503 until the VAPID secrets are set', async () => {
    const { impl } = fakeBackend()
    const res = await handle(new Request('https://x/'), config(impl, { vapid: null }))
    expect(res.status).toBe(503)
  })

  it('arms an alarm from a beacon, timed by the server clock', async () => {
    const { calls, impl } = fakeBackend()
    const res = await handle(
      post({ action: 'arm', token: 'good-token', alarmId: 'a1', delayMs: 90_000, subscription, title: 'Rest over', body: 'Up next: Squat · set 2', url: '/session/s1' }),
      config(impl),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ armed: true, fireAt: new Date(NOW + 90_000).toISOString() })
    const upsert = calls.find((c) => c.method === 'POST')!
    expect(upsert.url).toBe(`${SUPABASE}/rest/v1/rest_alarms?on_conflict=user_id`)
    expect(upsert.headers.Prefer).toContain('resolution=merge-duplicates')
    expect(upsert.headers.Authorization).toBe('Bearer a.b.c')
    expect(JSON.parse(upsert.body!)).toEqual({
      user_id: USER,
      alarm_id: 'a1',
      fire_at: new Date(NOW + 90_000).toISOString(),
      subscription,
      payload: { title: 'Rest over', body: 'Up next: Squat · set 2', url: '/session/s1', tag: 'rest-timer' },
    })
  })

  it('also takes the token from the Authorization header', async () => {
    const { impl } = fakeBackend()
    const res = await handle(
      post({ action: 'arm', alarmId: 'a1', delayMs: 1000, subscription }, { Authorization: 'Bearer good-token' }),
      config(impl),
    )
    expect(res.status).toBe(200)
  })

  it('refuses unknown users, bad delays and non-push endpoints', async () => {
    const { calls, impl } = fakeBackend()
    const arm = (extra: Record<string, unknown>) =>
      handle(post({ action: 'arm', token: 'good-token', alarmId: 'a1', delayMs: 60_000, subscription, ...extra }), config(impl))
    expect((await arm({ token: 'stolen' })).status).toBe(401)
    expect((await arm({ token: undefined })).status).toBe(401)
    expect((await arm({ delayMs: MAX_DELAY_MS + 1 })).status).toBe(400)
    expect((await arm({ delayMs: -1 })).status).toBe(400)
    expect((await arm({ alarmId: 'a b' })).status).toBe(400)
    expect((await arm({ subscription: { ...subscription, endpoint: 'https://evil.example/hook' } })).status).toBe(400)
    expect((await arm({ subscription: { ...subscription, keys: { ...subscription.keys, auth: 'short' } } })).status).toBe(400)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('cancels only the signed-in athlete’s alarm', async () => {
    const { calls, impl } = fakeBackend()
    const res = await handle(post({ action: 'cancel', token: 'good-token', alarmId: 'a1' }), config(impl))
    expect(res.status).toBe(200)
    const del = calls.find((c) => c.method === 'DELETE')!
    expect(del.url).toBe(`${SUPABASE}/rest/v1/rest_alarms?user_id=eq.${USER}&alarm_id=eq.a1`)
  })

  it('only lets the ticker send', async () => {
    const { calls, impl } = fakeBackend()
    const res = await handle(post({ action: 'tick' }, { 'x-rest-alarm-secret': 'wrong' }), config(impl))
    expect(res.status).toBe(403)
    const empty = await handle(post({ action: 'tick' }), config(impl, { tickSecret: '' }))
    expect(empty.status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('claims due alarms atomically and pushes each one', async () => {
    const rows = [
      { user_id: USER, alarm_id: 'a1', fire_at: new Date(NOW).toISOString(), subscription, payload: parsePayload({}) },
      { user_id: 'u2', alarm_id: 'b1', fire_at: new Date(NOW).toISOString(), subscription, payload: parsePayload({}) },
    ]
    const { calls, impl } = fakeBackend({ rows })
    const res = await handle(post({ action: 'tick' }, { 'x-rest-alarm-secret': 'tick-secret' }), config(impl))
    expect(await res.json()).toEqual({ sent: 2, gone: 0, failed: 0 })
    const claim = calls[0]
    expect(claim.method).toBe('DELETE')
    expect(claim.url).toBe(
      `${SUPABASE}/rest/v1/rest_alarms?fire_at=lte.${encodeURIComponent(new Date(NOW + LEAD_MS).toISOString())}`,
    )
    const pushes = calls.filter((c) => c.url === subscription.endpoint)
    expect(pushes).toHaveLength(2)
    expect(pushes[0].headers.TTL).toBe('60')
  })

  it('counts expired subscriptions separately', async () => {
    const rows = [{ user_id: USER, alarm_id: 'a1', fire_at: new Date(NOW).toISOString(), subscription, payload: parsePayload({}) }]
    const { impl } = fakeBackend({ rows, pushStatus: 410 })
    const res = await handle(post({ action: 'tick' }, { 'x-rest-alarm-secret': 'tick-secret' }), config(impl))
    expect(await res.json()).toEqual({ sent: 0, gone: 1, failed: 0 })
  })
})

describe('isPushEndpoint', () => {
  it('accepts the real push services only', () => {
    expect(isPushEndpoint('https://web.push.apple.com/QGuS3uN')).toBe(true)
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true)
    expect(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true)
    expect(isPushEndpoint('http://web.push.apple.com/x')).toBe(false)
    expect(isPushEndpoint('https://push.apple.com.evil.example/x')).toBe(false)
    expect(isPushEndpoint('https://ref.supabase.co/rest/v1/profiles')).toBe(false)
  })
})

describe('parsePayload', () => {
  it('clamps text and only allows in-app paths', () => {
    const p = parsePayload({ title: 'x'.repeat(100), body: '  ', url: 'https://evil.example' })
    expect(p.title).toHaveLength(60)
    expect(p.body).toBe('Time for your next set.')
    expect(p.url).toBe('/')
    expect(parsePayload({ url: '/session/2026-11-17-upper' }).url).toBe('/session/2026-11-17-upper')
  })
})
