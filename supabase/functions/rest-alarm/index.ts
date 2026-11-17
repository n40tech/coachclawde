// Supabase Edge Function entry point: reads the secrets and serves handler.ts.
// Deploy with JWT verification off (handler.ts checks tokens itself):
//   supabase functions deploy rest-alarm --no-verify-jwt
// See docs/DEPLOYMENT.md → "Rest-timer alerts" for the secrets it needs.
import { handle, type Config } from './handler.ts'

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? ''
  } catch {
    return ''
  }
}

const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
const subject = Deno.env.get('VAPID_SUBJECT')

const config: Config = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: serviceKey(),
  vapid: publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null,
  tickSecret: Deno.env.get('REST_ALARM_TICK_SECRET') ?? '',
}

Deno.serve((req) => handle(req, config))
