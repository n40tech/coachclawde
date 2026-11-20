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

// Trimmed: a pasted secret easily picks up a trailing newline, and a VAPID
// subject with whitespace in it makes Apple refuse every alert (403
// BadJwtToken), which is how rest alerts broke in 1.0.7.
const env = (name: string) => Deno.env.get(name)?.trim() || undefined
const publicKey = env('VAPID_PUBLIC_KEY')
const privateKey = env('VAPID_PRIVATE_KEY')
const subject = env('VAPID_SUBJECT')

const config: Config = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: serviceKey(),
  vapid: publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null,
  // Not trimmed: it must equal the Vault copy the ticker sends, exactly.
  tickSecret: Deno.env.get('REST_ALARM_TICK_SECRET') ?? '',
}

Deno.serve((req) => handle(req, config))
