# Developing Coach Clawde (code changes)

This guide is for when you're asked to **change the app's code**. It is kept
out of `CLAUDE.md` on purpose: most requests to this repo are workout-plan
generation, which needs none of this. Read this file only when a task actually
touches the app code.

## Workflow

Every code change follows this cycle. The maintainer reads, phone-tests and
merges every PR by hand on GitHub; Claude opens PRs and never merges them.

1. **Issue.** A change starts as a GitHub issue whose acceptance criteria say
   what the athlete will see or what the app will do. `/backlog` turns a
   brain-dump of ideas into issues. Copy and typo fixes can skip the issue.
2. **One issue, one PR.** Branch from an up-to-date `main` and open the PR as a
   **draft**. Keep it reviewable: under ~300 lines of non-test code, or split
   the issue. When two issues touch the same code, finish one before starting
   the other. `/build-issue <number>` runs steps 2–5.
3. **Thin components.** Behaviour (calculations, what gets saved, prompt text,
   timer and set rules) lives in `src/lib` as plain functions; components call
   them and handle only layout and events. This is what keeps behaviour
   testable without a browser.
4. **Tests first.** Each behavioural acceptance criterion gets a test written
   before the code. It must go **red on an assertion** (not a missing import:
   stub the function first), then green once the code is written. Name tests
   as sentences about behaviour ("skips the rest timer after the last set").
   Look and feel has no automated test; the maintainer checks it on their
   phone.
5. **Labels and PR body.** Exactly one of `feature` (a tester would notice
   something new or a changed way of doing things), `fix` (something that
   should have worked now does) or `internal` (nothing visible changed). Add
   `manual-test` when the PR adds no tests because it only changes the UI.
   Fill in every section of `.github/pull_request_template.md`.

Issues use the conventions in `docs/agents/` (`issue-tracker.md`,
`triage-labels.md`); `domain.md` covers `GLOSSARY.md` and `docs/adr/` once
they exist.

## Stack

React 19 + TypeScript + Vite 8, Tailwind CSS v4 (config is CSS-first in
`src/index.css` — there is **no** `tailwind.config.js`), Zustand (with `persist`)
for state, React Router 7, `lucide-react` icons, `date-fns`. Ships as an
installable PWA via `vite-plugin-pwa` (`registerType: 'autoUpdate'`).

**Backend:** Supabase provides Postgres + auth (email + password and magic-link;
Google is wired in `AuthProvider` but not yet surfaced in the UI) + Row-Level
Security. The app talks to it directly with
`@supabase/supabase-js` from the browser. The only server code is one Edge
Function, `supabase/functions/rest-alarm` (rest-timer push notifications). Requires
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; when those are absent the app runs
in offline single-user "local mode" (no login), so `npm run dev` works without a
backend. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for setup and the DB schema in
`supabase/migrations/`.

**Accounts:** Supabase is the only backend. Testers sign in with an email and
password provisioned by an operator via `scripts/create-beta-user.mjs`.
Magic-link sign-in is fully wired (`signInWithEmail`, and the `magic-link` mode
in `Login.tsx`) but **hidden unless `VITE_ENABLE_MAGIC_LINK` is `'true'`** — it
needs working SMTP, which a free Supabase project doesn't have. The flag is
resolved in `vite.config.ts` alongside the Supabase credentials and typed in
`src/vite-env.d.ts`; with it unset the whole branch is dead code and drops out
of the bundle.

## Commands

- `npm run dev` — local dev server (HMR).
- `npm run lint` — ESLint. Must pass clean.
- `npm run build` — `tsc -b && vite build`. **This is the only typecheck gate**
  (there is no separate `typecheck` script).
- `npm test` — Vitest, for the pure logic in `src/lib` and the Edge Function in
  `supabase/functions` (`*.test.ts` next to the module). Tests run in Node;
  there are no component tests. Run one file with `npx vitest run <path>`.

**Before pushing any code change, run `npm run lint`, `npm run build` and
`npm test` and make sure all three are green.** CI (`.github/workflows/ci.yml`)
runs the same three on every PR. On Claude Code on the web,
`.claude/hooks/session-start.sh` installs dependencies at session start, so these
work out of the box.

## Shipping a beta update (versions & release notes)

The app version lives in `package.json` (currently **1.1.4**) and is injected
into the bundle as `__APP_VERSION__` (read it via `APP_VERSION` in
`src/lib/appVersion.ts`). The first time a tester opens a new version, a
"What's new" sheet lists the changes; it's also reachable from Settings →
What's new. For every beta release:

1. Bump `version` in `package.json` (patch for fixes/feedback rounds, e.g.
   `1.0.2`; minor for bigger features).
2. Add an entry for that version at the **top** of `RELEASES` in
   `src/lib/releaseNotes.ts`. List everything that came from tester feedback
   under `fromFeedback` (plain language, the tester's point of view), and
   anything else under `alsoNew`.

**How updates reach installed apps.** The service worker is registered in
code (`lib/appUpdate`, with `injectRegister: false`), not by the plugin's
injected script. It checks for a new version whenever the app returns to the
foreground (iPhone Home Screen apps are resumed, not relaunched, so `load`
rarely fires), every 30 minutes, and when back online. A new worker takes
over at once (`skipWaiting` + `clientsClaim`), and the page reloads at a safe
moment: immediately on most screens, but never on `/session/*`, `/onboarding`
or `/check-in`, or while a text field has focus. There it waits for the next
navigation or for the app going into the background. `vercel.json` sends
`no-cache` for `/`, `/index.html`, `/sw.js` and the manifest so a deploy is
always seen, and caches the hashed `/assets/*` forever.

`npm run build` fails if the newest `RELEASES` entry doesn't match
`package.json`, so an update can't ship without notes. Which version a device
has seen is kept in `localStorage` (`coach-clawde-seen-version`), outside the
Zustand store so signing out and back in doesn't replay it; brand-new athletes
are marked as seen when they finish onboarding.

## Where things live

- `src/types/index.ts` — **single source of truth** for all data shapes
  (`WeekPlan`, `PlannedSession`, `LoggedSession`, etc.). The schema documented in
  `CLAUDE.md` mirrors these types; if you change one, update the other so the two
  stay in sync.
- `src/store/useAppStore.ts` — main Zustand store (profile, week plans, logged
  sessions, active session, rest timer). Persisted to `localStorage` under
  `coach-clawde-store` via `partialize` (timer/active session are intentionally
  not persisted) — this is the offline working cache; Supabase is the source of
  truth. `src/store/useSettingsStore.ts` — per-device settings: sync status,
  display units, rest alerts and the minimised rest timer.
- `src/auth/` — `AuthProvider` (Supabase session + `useAuth()`), `RequireAuth`
  (route guard that pulls the signed-in user's data on sign-in and resets the
  store on sign-out). `src/pages/Login.tsx` is the sign-in screen.
- `src/pages/` — one component per tab (`Home`, `WeekPlanner`, `Session`,
  `Progress`, `History`, `Settings`), wired in `src/App.tsx` (every page but
  `Home` and `Session` loads on first visit via `lib/lazyPage`; keep anything
  a workout needs out of lazy chunks, see `WEB-AUDIT.md`) with `BottomNav` (floating tab bar, phones) and
  `SideNav` (sidebar, when the `app` container is 48rem+ — iPad / landscape).
  Edge offsets come from the layout tokens in `src/index.css` (`--safe-*`,
  `--tabbar-*`): use `pb-tabbar` / `pb-edge` / `pt-safe` /
  `px-safe` instead of hardcoding `pb-24`-style guesses. See `docs/DEVICE-FIT.md`.
- **Device-fit conventions** (see `docs/DEVICE-FIT.md`): new sheets use the
  shared `BottomSheet` (keyboard-aware, safe-area padded). Any other overlay
  calls `hooks/useModal` on its panel (`tabIndex={-1}`): focus in, the rest
  `inert`, Escape, focus back afterwards. Messages that appear after an
  action go in an always-present `role="status"` / `role="alert"` container. Text fields use
  `text-base` (16 px; smaller makes iOS zoom in on focus). Use `text-2xs`, not
  `text-[10px]`. Nested rounded boxes use `rounded-nested` with the parent's
  `--nest-radius` / `--nest-inset`. Row layouts that must survive large text
  sizes reflow with a `@container` + `@max-[17rem]:` variant.
  `Onboarding` is the first-run flow: one short form of basics
  (`lib/basicOnboarding` turns it into the GoalProfile and legacy fields),
  then a finish screen. An onboarded athlete opening it gets the same form
  pre-filled. `lib/goalFlow` (the old goal tree) is still used by check-ins
  and the migration flow; `components/onboarding/ChatFlow` renders check-ins.
- `components/shared/BetaFeedbackTile` — the Home tile linking beta testers
  to the WhatsApp feedback group. The invite link is build-time config
  (`VITE_BETA_FEEDBACK_URL`, read in `lib/betaFeedback`), never source, and
  the tile is hidden when it's unset.
- `lib/storageKeys` — every `localStorage` key. They were `coach-claude-*`
  before the rename; importing the module carries old values over once.
- `src/components/session/MovementGuide` + `src/lib/exerciseGuide` — per-exercise
  help sheets from free-exercise-db (fetched from jsDelivr, cached by the service
  worker), fuzzy-matched by name with a YouTube-search fallback. `RoutineCard`
  is the expandable warm-up/cool-down.
- `src/components/session/` — the live-workout UI (exercise tiles, set rows, rest
  timer, `ReorderList`, and `WorkoutComplete`: the full-screen finish page in
  the website's style, using its fonts from `public/fonts` (`font-mono` for
  labels, `dot-grid`; `font-pixel` only for the title, sparingly).
- **Weights-first (v1.1):** plans never schedule cardio (`promptScope` in
  `lib/promptBuilder`); Run Mode, interval rows and the run engine were removed
  (preserved on the `cardio-archive` branch). `lib/workout` and `lib/zones`
  stay so older plans and logs still load; a legacy cardio session is logged
  by hand via `QuickLogSheet`.
- **Workout clock & auto-finish (v1.1.1):** when a rest ends (or is skipped)
  the store's `setClock` records the session and the time: the next open set
  is under way (its row shows the count-up). With auto-finish on (Settings →
  Beta features, `autoSetTimer`), the first pointer-down in the Session page
  after `AUTO_FINISH_GRACE_MS` finishes that set (`lib/autoFinish`) as
  `unconfirmed` (orange tick, inputs still editable; tapping the tick
  confirms) and starts the next rest. Taps on a tick (`data-tick`) are left to
  the tick. Ticking records `workSeconds`; saving the workout confirms any
  orange sets. `setClock` is persisted.
- **Workout sheet (v1.1.4):** `/session/*` renders as a bottom sheet
  (`session/WorkoutSheet`) over the screen it was opened from: `MainApp`
  keeps rendering the last non-workout location underneath
  (`<Routes location={background}>`, Home for a deep link) and makes
  `#root` inert while the sheet is up. The sheet is portalled into the fixed
  layer, scrolls internally and has a grab handle: drag the header down,
  tap the chevron or press Escape and it slides away, then goes back
  (`history.state.idx`, else Home). Dragging the minimised rest bar left
  (`RestTimerOverlay`; `hooks/useFlick`, `lib/swipe`) squeezes it towards
  the dock circle while the sheet slides down in step; the two share one
  progress through `session/sheetMotion`. The iPad sidebar stays beside the
  sheet (`hidesSideNav`). Before starting, **Peek** lists the planned
  exercises read-only; while in progress, **Reset session** (under "Did
  something else?") clears the log after a confirm. Off the workout screen,
  `hooks/useWorkoutDock` drives `layout/WorkoutDock`: a timer circle left of
  the tab bar (or in the iPad sidebar): the rest countdown, or between rests
  the session type's icon (`shared/SessionIcon`); tap it or drag it right to
  open the workout, or flick it up to open it at the exercise in progress
  (`timer.nextExerciseId` during a rest) with the rest timer full screen.
  The rest bar flicks up to maximise; the full-screen timer flicks down to
  minimise. Home shows the same workout (`useCurrentWorkout`) as an
  "In progress" card at the top. Home and Progress have no entrance
  animations (the old `Reveal` was removed: it looked like loading jank). The rest bar and the circle share `view-transition-name:
  workout-timer` (`.vt-workout-timer` in index.css), and those navigations
  run through `lib/viewTransition`, so one morphs into the other. Only one
  of them may be on screen at a time. Exercise order is the
  order of `loggedExercises` (`lib/exerciseOrder`: reorder, and promote an
  exercise started early).
- **Edge swipe back:** `layout/EdgeSwipeBack` + `lib/backGesture`. A swipe
  from the left edge slides the page column away and runs the page's Back
  (registered by `PageHeader`, so only screens with a Back button have it;
  the workout sheet is pulled down instead);
  the screen underneath eases in from the left. It `preventDefault`s the
  touchstart so iOS Safari doesn't start its own history swipe, except on
  controls, so taps on the Back button still work. `data-swipe-back` tells
  `withViewTransition` to skip its transition, as the page already left.
- **Completion & sharing:** `lib/workoutSummary` (time, volume, sets, reps, PBs
  vs. earlier sessions, per-exercise best sets) and `lib/shareCard`: three
  1080² card designs in the app's colours (summary, headline, logbook), all built
  when the page opens so iOS opens the share sheet straight from the tap.
- **Beta features** (Settings): `autoSetTimer` in the settings store turns
  auto-finish off.
- **Planning methods:** `lib/planMethods` (generate / repeat / modify /
  convert; the last used is remembered in the settings store and offered
  first). Repeat copies the newest plan in the app; modify uses
  `buildModifyPlanPrompt`.
- `src/components/shared/` & `components/layout/` — reusable primitives
  (`Button`, `Card`, `Badge`, `PageHeader`, `ConfirmDialog`, `BottomSheet`, …). Reuse these instead of
  hand-rolling new ones. Since v1.1.2 (see `WEB-AUDIT.md`, third pass):
  - a card that opens something is `<Card to="/route">` (a native link),
    never a clickable `div`; header icon links are `HeaderIconLink`;
  - picking one or several options is `ChoiceGroup` + `ChoiceChip`
    (`shared/Choice`, native radios/checkboxes; `chipLook` for the usual
    style), not `aria-pressed` buttons; on/off is `shared/Switch`;
  - a screen sets its title with `useDocumentTitle` (`PageHeader` does it);
  - small icon buttons keep their size and add `relative hit-target`
    (index.css) for a 44px touch area;
  - text colours: `#a8a29e` secondary, `#949494` muted, `#858585` faint (the
    lowest that reads at 4.5:1 on the cards); don't go darker for text;
  - white text or icons on solid orange use `bg-accent-fill` (hover
    `bg-accent-fill-hover`), not `bg-[#d97756]`, which is too light for
    white; keep `#d97756` for orange text, icons, borders and tints;
  - decoration animates only under `prefers-reduced-motion: no-preference`
    (or `motion-safe:`), and nothing loops for more than 5 seconds.
- `src/lib/` — pure helpers: `promptBuilder` (builds the **self-contained** plan
  prompt — embeds profile + summarised history), `historySummary` (bounds that
  history so the prompt isn't overloaded), `supabase` (client) + `supabaseSync`
  (push/pull rows), `weekUtils`/`dateUtils`, `cardioUtils`, `units` (kg/lb and km/mi display conversion; data stays metric), `export`, `nanoid`, `programOptions`
  (shared labels for the program preference enums).
  `useAutoSync` (in `src/hooks/`) is the push/pull facade used by pages.
- **Runners & athletes (v1.0.2):**
  - `lib/flow` — the flow-as-data engine (`walk`, `rewindTo`, `enumeratePaths`)
    behind every chat. Deterministic, no AI. `components/onboarding/ChatFlow`
    renders any flow.
  - `lib/goalFlow` — the onboarding goal tree, reflections/feasibility,
    `toGoalProfile` and `profilePatchFromGoal` (legacy fields are derived from
    the `GoalProfile`). Tests enforce ≤ 10 questions on every path.
  - `lib/goalPrompt` — the prompt's Goal section and the phase skeleton.
    `lib/goalProfile` — zones / measurement helpers and the legacy mapping.
  - `lib/checkIn` (rules C1–C10, budget, actions), `lib/checkInTriggers`
    (when to suggest one), `lib/migrationFlow` (the three-question upgrade for
    pre-v1.0.2 athletes), `pages/CheckIn`.
  - `lib/workout` (structured workouts, legacy `intervals[]` conversion,
    notation), `lib/zones` (VDOT pace zones), `lib/runEngine` (Run Mode cue
    timing), `lib/audioCues` (Web Audio tones, `transient` audio session,
    Android vibration), `components/session/RunMode`.
  - `lib/coachingConfig` — **every coaching number** (min weeks, ambition
    thresholds, zones, tapers, deloads). Must be reviewed by a qualified coach.
  - `lib/quickLog` — "Did something else?" and "Log a session".
- **Rest alerts (v1.0.6)** — a push notification when a rest ends with the app
  in the background (setup: `docs/DEPLOYMENT.md` §7):
  - `lib/restAlerts` — device support, turning alerts on (permission + push
    subscription), the test alert, and the wired-up controller.
    `lib/restAlarmController` decides when to arm and cancel (pure, tested):
    only while the app is hidden mid-rest, armed by beacon, cancelled on return.
  - `public/push-sw.js` — the service worker's push and notification-click
    handlers, pulled into the generated worker by `workbox.importScripts`.
    A tapped alert opens the workout at the exercise up next: the alarm's URL
    is `/session/<id>/next/<exerciseId>` (`lib/alertLink`; a path, because
    the function only accepts word characters, `-`, `.` and `/`). With the
    app already open the worker focuses it and posts the path, which
    `ServiceWorkerLinks` in `App.tsx` navigates to in-app.
    Push only works in a build (`npm run build && npm run preview`), never
    `npm run dev`, which registers no service worker.
  - `supabase/functions/rest-alarm` — arms, cancels and (from the pg_cron
    ticker in migration `0007`) sends due alarms. `handler.ts` uses web APIs
    only so it's tested in Node; `_shared/webpush.ts` is dependency-free Web
    Push (VAPID + RFC 8291, checked against the RFC's worked example). It's
    type-checked by `tsconfig.functions.json` (part of `npm run build`);
    `deno.d.ts` stands in for the Deno globals.
  - `RestTimerOverlay` minimises to a pill in the tab bar's dock
    (`tabbar-dock`); the choice is remembered in the settings store. Session
    has no pinned bar: "Complete Session" sits at the end of the workout.
- `scripts/create-beta-user.mjs` — provisions beta accounts (email + password,
  pre-confirmed) with the service-role key. `scripts/check-setup.mjs` is a
  read-only status report (env vars, schema, accounts and their onboarding
  state).
- `site/` — the static marketing page published to GitHub Pages by
  `.github/workflows/pages.yml`. Plain HTML/CSS/JS, no build step, and not part
  of the app bundle.

## Conventions & gotchas

- Match the style of the file you're editing (functional components + hooks
  throughout; `import type` for type-only imports).
- [`WEB-AUDIT.md`](WEB-AUDIT.md) is the web-platform audit (accessibility,
  overlays, PWA, performance) with a prioritised backlog: check it before
  touching dialogs, sheets, forms or the bundle.
- Use `lucide-react` for icons and the existing `shared/` primitives for UI —
  don't introduce a new component library or CSS framework.
- IDs are generated with `src/lib/nanoid.ts`; dates are local-ISO via
  `weekUtils`/`dateUtils` (don't hand-roll date math — DST/Monday-start logic
  already lives there).
- Keep changes minimal and typed. Injury handling is deliberately
  proportionate (CLAUDE.md, rule 1): its wording can change, but never remove
  its safety triggers — an uncleared medical flag's limits, the "worse" status
  from check-ins (lighter loading, plus the app's own referral note), and
  changing only the exercises that provoke a niggle.
- `dist/` and `node_modules/` are git-ignored — never commit them.
- **No athlete data belongs in this repo.** It lives in each user's Supabase
  rows; nothing in the app writes to git any more.
