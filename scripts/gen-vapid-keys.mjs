#!/usr/bin/env node
// Prints a fresh VAPID key pair and a ticker secret for rest-timer alerts.
// See docs/DEPLOYMENT.md → "Rest-timer alerts" for where each value goes.
//
//   node scripts/gen-vapid-keys.mjs
//
// Generate keys once per deployment: changing them later silently breaks every
// device's subscription until the athlete turns alerts off and on again.
const { subtle, getRandomValues } = globalThis.crypto

const b64url = (bytes) => Buffer.from(bytes).toString('base64url')

const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
const publicKey = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)))
const { d: privateKey } = await subtle.exportKey('jwk', pair.privateKey)
const tickSecret = b64url(getRandomValues.call(globalThis.crypto, new Uint8Array(32)))

console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log(`REST_ALARM_TICK_SECRET=${tickSecret}`)
