# Deploying Coach Clawde

How to run your own copy of Coach Clawde: a Vite single-page app on Vercel,
with Supabase for the database, sign-in and per-user access control.

> **Architecture in one line:** the SPA deploys to Vercel as static files;
> **Supabase** provides Postgres, authentication and Row-Level Security, so each
> athlete only ever sees their own rows. There is no custom server: the browser
> talks to Supabase directly with the public anon key, and RLS does the access
> control. The one exception is optional: a small Supabase Edge Function for
> rest-timer push notifications (§7).

The steps:

1. Create the Supabase project (via the Vercel Marketplace)
2. Create the database schema
3. Configure authentication
4. Set environment variables and redeploy
5. Create beta accounts
6. Smoke-test
7. Rest-timer alerts (optional)

`node --env-file=.env.local scripts/check-setup.mjs` reports where a project
stands at any point: which variables are set, whether the schema is in place,
and every account with its onboarding state. It is read-only.

---

## 1. Add Supabase via the Vercel Marketplace

1. In the [Vercel dashboard](https://vercel.com), import the repo as a new
   project (framework preset: Vite; `vercel.json` already sets the build).
2. Open the project's **Integrations** / **Marketplace** tab → search
   **Supabase** → **Add Integration**.
3. Choose to **create a new Supabase project** and connect it to this Vercel
   project. Pick a region near your athletes.
4. The integration adds `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` and friends to the Vercel project.

> ℹ️ The build (`vite.config.ts`) picks up the integration's `SUPABASE_URL` /
> `SUPABASE_ANON_KEY` (and Next-style `NEXT_PUBLIC_*`) names, so you don't need
> to add `VITE_` aliases. Building somewhere else? Set `VITE_SUPABASE_URL` /
> `VITE_SUPABASE_ANON_KEY` explicitly; they take priority.

You now have a Supabase dashboard at https://supabase.com/dashboard, where most
of the remaining steps happen.

---

## 2. Create the database schema

1. Supabase → **SQL Editor** → **New query**.
2. Run **every file in [`supabase/migrations/`](../supabase/migrations/) in
   numerical order** (`0001` … `0007`): paste each one's contents, **Run**.
3. Check under **Table Editor** that `profiles`, `week_plans`,
   `logged_sessions` and `check_ins` exist, and under **Authentication →
   Policies** that each has an owner-only RLS policy.

Why each one matters:

| Migration | What it does |
| --- | --- |
| `0001_init` | The tables, owner-only RLS, and a trigger that creates a `profiles` row for every new user. |
| `0002_onboarding` | The `onboarded` flag (plus `experience_level`) that sends new athletes through the onboarding chat. |
| `0003_fix_new_user_onboarding` | **Not optional.** Without it, new accounts skip onboarding and land in the app with an empty profile (no injuries, no goals), which plan generation depends on. |
| `0004_profile_birth_date` | The `birth_date` column. Every profile save writes it, so saves fail without it. |
| `0005_goal_profile` | The `goal_profile` column (goal, event, constraints, health flags). Same failure mode as `0004`. |
| `0006_check_ins` | The weekly check-ins table. Without it check-ins stay on the device and the sync indicator shows an error. |
| `0007_rest_alarms` | Rest-timer alerts: the alarm table and its pg_cron ticker (enables `pg_cron` and `pg_net`). Harmless on its own; the alerts also need [§7](#7-rest-timer-alerts-optional). |

*(Prefer the CLI? `npm i -g supabase`, `supabase link --project-ref <ref>`,
then `supabase db push`.)*

---

## 3. Configure authentication

### Site URL and redirect URLs

Supabase → **Authentication → URL Configuration**:

- **Site URL:** your production URL, e.g. `https://coachclawde.vercel.app`.
- **Redirect URLs:** the app asks Supabase to send people back to the origin
  they signed in from (`redirectTo = window.location.origin`). Supabase only
  honours that if the origin matches an entry here; otherwise it silently falls
  back to the Site URL. Add (wildcards are supported):

  ```
  http://localhost:5173/**
  https://coachclawde.vercel.app/**
  https://coachclawde-git-*-<your-vercel-scope>.vercel.app/**
  https://coachclawde-*-<your-vercel-scope>.vercel.app/**
  ```

  The third line covers the stable per-branch preview alias (the easiest URL
  to test against); the fourth covers per-deployment URLs. Replace
  `<your-vercel-scope>` with your Vercel username or team slug.

### Sign-in methods

The login screen uses Supabase's **Email** provider (enabled by default):

- **Email + password**: the primary path, and what the beta runs on. You
  create each account yourself ([§5](#5-create-beta-accounts)) and hand out the
  credentials, so no email is ever sent: nothing to rate-limit, nothing to land
  in spam, no SMTP bill.
- **Magic link**: implemented but **hidden** unless `VITE_ENABLE_MAGIC_LINK`
  is exactly `true`. Supabase's built-in mailer allows only a couple of emails
  an hour, so turn it on only after configuring custom SMTP under **Project
  Settings → Auth → SMTP Settings** (Brevo, Resend, Postmark…). Custom SMTP
  needs a sending domain you own.

### Branded email templates

For magic links or sign-up confirmation emails, paste the templates in
[`docs/email/`](email/) into Supabase → **Authentication → Email Templates**:

| Supabase template | File |
| --- | --- |
| **Magic Link** | `docs/email/magic-link.html` |
| **Confirm signup** | `docs/email/confirm-signup.html` |

Keep the `{{ .ConfirmationURL }}` placeholder intact. The `.txt` versions are
for providers that take a plain-text part as well.

### Social logins (optional)

`AuthProvider` already exposes `signInWithGoogle()`. To offer it: create an
OAuth client in the [Google Cloud Console](https://console.cloud.google.com)
with `https://<your-project-ref>.supabase.co/auth/v1/callback` as an authorised
redirect URI, paste the client ID and secret into Supabase → **Authentication →
Providers → Google**, and add a button to `src/pages/Login.tsx`. Apple and
Facebook work the same way through `signInWithOAuth`.

---

## 4. Environment variables

| Variable | Where | What it does |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Vercel, `.env.local` | The browser's Supabase client. Safe to expose: RLS gates the anon key. Without them the app runs in offline single-user "local mode". |
| `VITE_ENABLE_MAGIC_LINK` | Vercel, `.env.local` | `true` shows the magic-link option. Anything else hides it. |
| `VITE_DEMO_DATA` | `.env.local` | `true` runs `npm run dev` like a Vercel preview: local mode, seeded with demo data. Vercel previews set it themselves. |
| `VITE_BETA_FEEDBACK_URL` | Vercel, `.env.local` | Your testers' WhatsApp (or any) group link, shown as a tile on Home. Unset hides the tile. Kept out of the repo because anyone with an invite link can join. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` only | For the operator scripts. The service-role key **bypasses RLS**: never commit it and never give it a `VITE_` prefix. |

All `VITE_` values are read at **build time**:

1. In Vercel → **Settings → Environment Variables**, tick **Production** and
   **Preview** for each one you set. Preview builds ignore the Supabase pair
   and run in local mode with demo data (see `vite.config.ts`), so a PR's
   preview never reaches the production database.
2. **Redeploy** after any change (Deployments → ⋯ → **Redeploy**); an existing
   build won't pick it up. The build log prints
   `[coach-clawde] Supabase credentials detected — auth enabled` when the
   Supabase pair is present.

For local development, copy `.env.example` to `.env.local` and fill it in from
Supabase → **Project Settings → API**.

---

## 5. Create beta accounts

Testers get an email and password you generate for them. Accounts are created
already-confirmed, so nothing is emailed.

```bash
node --env-file=.env.local scripts/create-beta-user.mjs alice@example.com bob@example.com
```

The script prints each account with its generated password:

```
Beta accounts

  alice@example.com   k7Qm2vXpR4wL   created
  bob@example.com     9fTbN3sZyH8c   created
```

**Passwords are shown once and stored nowhere**, so copy them before closing
the terminal.

| Flag | Effect |
| --- | --- |
| `--password <pw>` | Use one password you choose for every account listed. |
| `--reset` | The account already exists → set its password instead of skipping it (a tester lost theirs). |

Each new account starts in the onboarding chat, which collects the goal,
injuries and preferences that plan generation depends on. To remove a tester,
delete the user in Supabase → **Authentication → Users**; their profile, plans,
sessions and check-ins cascade away with them.

---

## 6. Smoke-test

- [ ] Visit the production URL → you're redirected to the login screen.
- [ ] The login screen shows only the password fields (unless you enabled
      magic links).
- [ ] Sign in → a new account starts in the onboarding chat; finishing it lands
      you on Home.
- [ ] Plan → **Generate & Open Claude** → the prompt contains your profile and
      a summarised training history.
- [ ] Import a plan, complete a session → Settings shows "Synced just now" and a
      new row appears in `logged_sessions`.
- [ ] Sign in on a second device → the same data loads.
- [ ] Sign out → back to login, local data cleared.
- [ ] A second test account sees an empty app (RLS isolation works). Delete it
      afterwards.
- [ ] With rest alerts set up (§7): Settings → Notifications → **Send a test
      alert** arrives on a locked phone.

---

## 7. Rest-timer alerts (optional)

A push notification when a rest ends while the app is in the background
(phone locked, another app open), where the in-app tone can't play. Athletes
turn it on in **Settings → Notifications** or from the rest timer. On iPhone it
needs iOS 16.4+ and the app opened from the Home Screen.

**How it works.** The app arms an alarm only when it's hidden mid-rest (a
beacon to the `rest-alarm` Edge Function) and cancels it on return. Alarms are
rows in `rest_alarms`. While any exist, a pg_cron job runs every second and,
once one is due, calls the function, which sends it as Web Push (VAPID,
encrypted per RFC 8291, no dependencies) and deletes it. The job removes
itself when the table is empty, so nothing runs between workouts. Code:
`supabase/functions/rest-alarm`, `src/lib/restAlerts.ts`, `public/push-sw.js`.

1. **Keys.** `node scripts/gen-vapid-keys.mjs` prints a VAPID key pair and a
   ticker secret. Generate them once: new keys break every device's
   subscription until the athlete turns alerts off and on.
2. **Schema.** Run `0007_rest_alarms.sql` if you haven't (§2).
3. **Function.** Deploy it with JWT checks off (it verifies the athlete's
   token itself, because beacons can't send headers), then set its secrets:

   ```bash
   supabase functions deploy rest-alarm --no-verify-jwt
   supabase secrets set \
     VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… REST_ALARM_TICK_SECRET=… \
     VAPID_SUBJECT=https://coachclawde.vercel.app
   ```

   `VAPID_SUBJECT` is a contact for the push services: your app's URL or a
   `mailto:` address.
4. **Vault.** In the SQL Editor, tell the ticker where to call and with what:

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/rest-alarm', 'rest_alarm_function_url');
   select vault.create_secret('<REST_ALARM_TICK_SECRET>', 'rest_alarm_tick_secret');
   ```

5. **Test.** On a phone with the app on its Home Screen: Settings → Rest
   alerts on → **Send a test alert**, then lock the phone. It arrives in about
   5 seconds.

**Troubleshooting.** Open the function's URL (a GET): it returns the public
key and, if the secrets are wrong, a `problem` (a padded or invalid
`VAPID_SUBJECT`, or a private key from a different pair). Apple reports both
as `403 BadJwtToken`. The function trims the VAPID secrets, since a pasted
value easily picks up a trailing newline (that broke alerts in 1.0.7).
`select * from cron.job` shows `rest-alarm-tick` only
while an alarm is pending. `select status_code, content from
net._http_response order by created desc limit 5` shows the ticker's calls to
the function. The function's logs (Supabase → Edge Functions → rest-alarm)
report `sent`, `gone` (the device unsubscribed) and `failed` per tick. Alarms
nobody could deliver are dropped two minutes late.

---

## 8. Releases

Testers get the `production` branch; `main` and every PR deploy as previews
with demo data. The Release workflow moves `production` (see
`docs/DEVELOPING.md` → Releasing). One-time setup:

1. Vercel → Settings → Git → **Production Branch**: `production`.
2. The first release is tagged by hand: a "Release v0.2.4" commit on top of
   the `main` commit production runs, tagged `v0.2.4`, pushed as
   `production`. The workflow counts from the newest tag.

## How plan generation works

There is no AI call on the server. The app builds a **self-contained prompt**
(`src/lib/promptBuilder.ts`): the athlete's profile and goal, a *summarised*
recent history (`src/lib/historySummary.ts`: recent sessions, working weights,
PRs, the latest check-in, capped so the prompt stays focused), the programming
rules and the `WeekPlan` JSON schema. It opens in the Claude app (or claude.ai)
pre-filled, the athlete sends it, and pastes the JSON reply back into the app.
`CLAUDE.md` holds the full, general version of the rules and schema.
