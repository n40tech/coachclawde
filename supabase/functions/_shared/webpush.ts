/**
 * Web Push, with no dependencies: VAPID (RFC 8292) and aes128gcm payload
 * encryption (RFC 8291) on WebCrypto alone, so the same code runs in the Edge
 * Function (Deno) and in the tests (Node).
 *
 * Keys are base64url, the format browsers and the `web-push` tools use: the
 * VAPID public key is the raw 65-byte P-256 point, the private key its 32-byte
 * scalar `d`.
 */

export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface VapidKeys {
  publicKey: string
  privateKey: string
  /** `mailto:` or `https:` contact for the push services (RFC 8292 §2.1). */
  subject: string
}

export interface PushResult {
  status: number
  ok: boolean
  /** 404/410: the subscription has expired or been revoked. */
  gone: boolean
  /** On failure: the push service's reason (e.g. Apple's {"reason":"BadJwtToken"}). */
  detail?: string
}

const utf8 = new TextEncoder()

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
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

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

/** Whether `s` decodes to an uncompressed P-256 point. */
export function isP256PublicKey(s: string): boolean {
  try {
    const k = b64urlDecode(s)
    return k.length === 65 && k[0] === 4
  } catch {
    return false
  }
}

/**
 * Encrypts `payload` for one subscription as a single aes128gcm record
 * (RFC 8291 §3–4). `salt` and `senderKeys` are only passed by tests.
 */
export async function encryptPayload(
  sub: PushSubscriptionJSON,
  payload: Uint8Array,
  opts: { salt?: Uint8Array<ArrayBuffer>; senderKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64urlDecode(sub.keys.p256dh)
  const authSecret = b64urlDecode(sub.keys.auth)
  const sender =
    opts.senderKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, sender.privateKey, 256),
  )

  // RFC 8291 §3.4: mix the shared secret with the subscription's auth secret.
  const keyInfo = concat(utf8.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)

  // RFC 8188: content-encryption key and nonce for the record.
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, utf8.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8.encode('Content-Encoding: nonce\0'), 12)

  // One record, so it is also the last: delimiter 0x02, no padding.
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))),
  )

  // Header: salt (16) | record size (uint32) | key id length (1) | sender key.
  const header = new Uint8Array(21 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** The `Authorization: vapid …` header for one push service (RFC 8292 §3). */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000)) {
  const jwtHeader = b64urlEncode(utf8.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(
    utf8.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: vapid.subject })),
  )
  const pub = b64urlDecode(vapid.publicKey)
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: vapid.privateKey },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  // WebCrypto signs in the raw r||s form JWS ES256 wants.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8.encode(`${jwtHeader}.${claims}`)),
  )
  return `vapid t=${jwtHeader}.${claims}.${b64urlEncode(signature)}, k=${vapid.publicKey}`
}

/**
 * Why push services would refuse these VAPID secrets, or null when they look
 * right. Apple answers both with 403 `BadJwtToken`:
 * - the private key isn't the partner of the public key (signing only uses
 *   the private half, so a mismatched pair still "works" until it's checked);
 * - the subject isn't a `mailto:` or `https:` contact (localhost is refused).
 */
export async function vapidProblem(vapid: VapidKeys): Promise<string | null> {
  const subject = vapid.subject.trim()
  if (subject !== vapid.subject) return 'VAPID_SUBJECT has spaces around it'
  if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(subject) || /localhost|127\.0\.0\.1/.test(subject)) {
    return 'VAPID_SUBJECT must be a mailto: address or an https:// URL (not localhost)'
  }
  if (!isP256PublicKey(vapid.publicKey)) return 'VAPID_PUBLIC_KEY is not a P-256 public key'
  try {
    const pub = b64urlDecode(vapid.publicKey)
    const signer = await crypto.subtle.importKey(
      'jwk',
      { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: vapid.privateKey },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
    const verifier = await crypto.subtle.importKey('raw', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const msg = utf8.encode('vapid-self-check')
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer, msg)
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifier, sig, msg)
    return ok ? null : 'VAPID_PRIVATE_KEY does not match VAPID_PUBLIC_KEY (generate one pair and set both)'
  } catch {
    // Some runtimes (Node) refuse to import a private key that isn't the
    // partner of x/y, rather than signing with it: that's the same mismatch.
    let d: Uint8Array | null = null
    try { d = b64urlDecode(vapid.privateKey) } catch { /* reported below */ }
    return d?.length === 32
      ? 'VAPID_PRIVATE_KEY does not match VAPID_PUBLIC_KEY (generate one pair and set both)'
      : 'VAPID_PRIVATE_KEY is not a valid P-256 private key'
  }
}

/** Encrypts `payload` and posts it to the subscription's push service. */
export async function sendWebPush(
  sub: PushSubscriptionJSON,
  payload: string,
  vapid: VapidKeys,
  opts: { ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; fetchImpl?: typeof fetch } = {},
): Promise<PushResult> {
  const body = await encryptPayload(sub, utf8.encode(payload))
  const res = await (opts.fetchImpl ?? fetch)(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(opts.ttlSeconds ?? 60),
      Urgency: opts.urgency ?? 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
    },
    body,
  })
  const ok = res.status >= 200 && res.status < 300
  // Read the body either way (so the connection can be reused); on failure it
  // says why, e.g. Apple's {"reason":"BadJwtToken"}.
  const text = await res.text().catch(() => '')
  const result: PushResult = { status: res.status, ok, gone: res.status === 404 || res.status === 410 }
  if (!ok && text) result.detail = text.slice(0, 200)
  return result
}

/** A fresh VAPID key pair (scripts/gen-vapid-keys.mjs does the same in Node). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair
  const publicKey = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey, privateKey: jwk.d! }
}
