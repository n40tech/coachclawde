import { describe, expect, it } from 'vitest'
import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  generateVapidKeys,
  sendWebPush,
  vapidAuthorization,
  type PushSubscriptionJSON,
} from './webpush.ts'

const utf8 = new TextEncoder()

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** The browser's side of RFC 8291: decrypts one aes128gcm record. */
async function decrypt(message: Uint8Array<ArrayBuffer>, ua: CryptoKeyPair, authSecret: Uint8Array<ArrayBuffer>) {
  const salt = message.slice(0, 16)
  const rs = new DataView(message.buffer, message.byteOffset).getUint32(16)
  const idlen = message[20]
  const asPublic = message.slice(21, 21 + idlen)
  const ciphertext = message.slice(21 + idlen)
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey))
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256))
  const ikm = await hkdf(authSecret, ecdh, concat(utf8.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, utf8.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext))
  // Strip the delimiter (0x02 = last record) and any zero padding after it.
  let end = padded.length - 1
  while (end >= 0 && padded[end] === 0) end--
  expect(padded[end]).toBe(2)
  return { rs, idlen, plaintext: new TextDecoder().decode(padded.slice(0, end)) }
}

async function browserSubscription(): Promise<{ sub: PushSubscriptionJSON; ua: CryptoKeyPair; auth: Uint8Array<ArrayBuffer> }> {
  const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const p256dh = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey)))
  return { sub: { endpoint: 'https://web.push.apple.com/QGuS3uN', keys: { p256dh, auth: b64urlEncode(auth) } }, ua, auth }
}

describe('base64url', () => {
  it('round-trips bytes without padding', () => {
    const bytes = new Uint8Array([0, 250, 251, 252, 253, 254, 255, 1])
    const s = b64urlEncode(bytes)
    expect(s).not.toMatch(/[+/=]/)
    expect([...b64urlDecode(s)]).toEqual([...bytes])
  })
})

describe('encryptPayload', () => {
  it('reproduces the worked example in RFC 8291 §5', async () => {
    const asPublic = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
    const asPrivate = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'
    const pub = b64urlDecode(asPublic)
    const jwk = { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33)), d: asPrivate }
    const senderKeys: CryptoKeyPair = {
      privateKey: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
      publicKey: await crypto.subtle.importKey('raw', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    }
    const sub: PushSubscriptionJSON = {
      endpoint: 'https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV',
      keys: {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
    }
    const message = await encryptPayload(sub, utf8.encode('When I grow up, I want to be a watermelon'), {
      salt: b64urlDecode('DGv6ra1nlYgDCS1FRnbzlw'),
      senderKeys,
    })
    expect(b64urlEncode(message)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    )
  })

  it('round-trips through the browser side of the protocol', async () => {
    const { sub, ua, auth } = await browserSubscription()
    const payload = JSON.stringify({ title: 'Rest over', body: 'Up next: Bench Press · set 3', url: '/session/abc' })
    const message = await encryptPayload(sub, utf8.encode(payload))
    const { rs, idlen, plaintext } = await decrypt(message, ua, auth)
    expect(rs).toBe(4096)
    expect(idlen).toBe(65)
    expect(plaintext).toBe(payload)
  })

  it('uses a fresh salt and sender key every time', async () => {
    const { sub } = await browserSubscription()
    const a = await encryptPayload(sub, utf8.encode('x'))
    const b = await encryptPayload(sub, utf8.encode('x'))
    expect(b64urlEncode(a.slice(0, 86))).not.toBe(b64urlEncode(b.slice(0, 86)))
  })
})

describe('vapidAuthorization', () => {
  it('signs an ES256 JWT for the push service origin', async () => {
    const keys = await generateVapidKeys()
    const vapid = { ...keys, subject: 'https://coachclawde.vercel.app' }
    const header = await vapidAuthorization('https://web.push.apple.com/QGuS3uN', vapid, 1_800_000_000)
    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header)
    expect(match).not.toBeNull()
    const [, h, c, sig, k] = match!
    expect(k).toBe(keys.publicKey)
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h)))).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c)))).toEqual({
      aud: 'https://web.push.apple.com',
      exp: 1_800_000_000 + 12 * 3600,
      sub: 'https://coachclawde.vercel.app',
    })
    const pub = await crypto.subtle.importKey('raw', b64urlDecode(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(sig), utf8.encode(`${h}.${c}`))
    expect(valid).toBe(true)
  })
})

describe('sendWebPush', () => {
  it('posts an encrypted, VAPID-signed message and reports expired subscriptions', async () => {
    const { sub, ua, auth } = await browserSubscription()
    const vapid = { ...(await generateVapidKeys()), subject: 'https://coachclawde.vercel.app' }
    const seen: { url: string; init: RequestInit }[] = []
    const fake = (status: number) =>
      (async (url: string | URL | Request, init?: RequestInit) => {
        seen.push({ url: String(url), init: init! })
        return new Response(null, { status })
      }) as typeof fetch

    const ok = await sendWebPush(sub, '{"title":"Rest over"}', vapid, { ttlSeconds: 60, fetchImpl: fake(201) })
    expect(ok).toEqual({ status: 201, ok: true, gone: false })
    const { url, init } = seen[0]
    expect(url).toBe(sub.endpoint)
    const headers = init.headers as Record<string, string>
    expect(headers.TTL).toBe('60')
    expect(headers['Content-Encoding']).toBe('aes128gcm')
    expect(headers.Authorization).toMatch(/^vapid t=/)
    const { plaintext } = await decrypt(init.body as Uint8Array<ArrayBuffer>, ua, auth)
    expect(plaintext).toBe('{"title":"Rest over"}')

    expect(await sendWebPush(sub, '{}', vapid, { fetchImpl: fake(410) })).toEqual({ status: 410, ok: false, gone: true })
  })
})
