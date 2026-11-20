# Web platform audit (2026-11-17, third pass 2026-11-20)

Scope: an audit of the front end against the `modern-web-guidance` guides
(skill version `2026_10_12-dacb5911`), done on 2026-11-17 against v1.0.6. The
rest-alert and rest-timer work from that release was checked first
(`RestTimer`, `useRestTimer`, `lib/restAlerts`, `lib/restAlarmController`,
`public/push-sw.js`, the Settings → Notifications section and the Session
scroll spacer), then the rest of `src/pages`, `src/components`,
`src/index.css`, `index.html`, the PWA/manifest config in `vite.config.ts`,
`vercel.json`, `lib/appUpdate`, `lib/audioCues` and `hooks/useWakeLock`.
Guides consulted: `accessibility`, `dialog`, `platform-controls-dismiss-dialog`,
`light-dismiss-a-dialog`, `prevent-page-scroll-under-modal-dialog`,
`animate-to-from-top-layer`, `switch`, `forms`, `html`,
`autofill-sign-in-form`, `validate-input-after-interaction`,
`accessible-error-announcement`, `persistent-toast-notifications`, `motion`,
`animate-element-entry-exit`, `performance`, `optimize-script-priority`,
`install-web-app`, `full-session-analytics`, `batch-analytics-events`,
`detect-initial-visibility-state`, `efficient-background-processing`,
`calculate-total-foreground-time`, `form-factor-adaptation`,
`responsive-design`, `respect-os-text-scale`, `css-layout`, `css`,
`browser-ui-theming`, `customize-scrollbar-color-and-thickness`,
`visual-effects`, `natural-interactions`, `progress-ring`, `progress`,
`spinner`, `icons`, `dark-mode`, `typography`, `js`, `security`, `privacy`.
Only clearly broken, low-risk things were fixed; everything else is below.
Browser targets: iPhone Home Screen app (iOS 16.4+ for push, iOS 18 / Safari
26 seen in traffic) and Android Chrome.

## Fixed in the first pass (v1.0.6)

1. **Rest timer dialog focus.** `src/components/session/RestTimer.tsx:19-57`,
   `:75`, `:107-112`, `:147-161`. The full-screen timer had `role="dialog"`
   but left focus on the page behind it, so keyboard and screen-reader users
   stayed on obscured content and could Tab behind the backdrop. Now focus
   moves to the card (`tabIndex={-1}`, `aria-modal="true"`), the app root and
   the other fixed-layer UI (the Session action bar) are `inert` while it is
   open, and on close focus returns to whatever had it (usually the set's
   tick) or, when that element is gone because the timer was opened from the
   minimised bar, to the bar. Focus is never handed back to a text field
   (that would pop the phone keyboard up when the rest ends), and the restore
   doesn't scroll. Pointer and touch behaviour is unchanged.
   Guides: `accessibility` (custom overlays: move focus, `inert`), `html`
   (maintain focus when the focused element is removed).
2. **Unlabelled profile fields in Settings.** `src/pages/Settings.tsx:149-186`,
   `:467-476`. `Field` rendered its label as a `<p>`, so Name, Weight and
   Height were named only by their placeholders ("Your name", "81", "184") and
   Date of birth had no name at all. `Field` now takes `htmlFor` and renders a
   real `<label>`; the four inputs have ids. Guides: `accessibility`
   (label every control, not placeholders), `forms` (`<label for>`).
3. **Set rows named by placeholder.** `src/components/session/SetRow.tsx:56`,
   `:77`, `:247-251`. The reps and weight inputs were announced as "8-10" and
   "kg" on every row, and every tick was "Complete set". They are now "Set N
   reps", "Set N weight in kg|lb", "Complete set N" / "Edit set N". Guide:
   `accessibility` (label every control; don't reuse a name across controls
   with different effects).
4. **Unnamed date inputs.** `src/components/session/QuickLogSheet.tsx:121-145`
   (Distance and When? are now `<label for>`), and
   `src/components/onboarding/ChatFlow.tsx:271-274` (the inline date/text
   answer is named after its option). Guide: `accessibility`.

Verified with Playwright (Chromium, 390×844) on a production build: focus
lands in the dialog, Tab cycles only through its controls, `#root` and the
action bar are inert while open and released after, Escape / chevron /
backdrop / Skip all close cleanly, focus returns to "Edit set 1" or to the bar,
and a pointer close doesn't leave a focus ring on the bar.

## Fixed in the second pass (v1.0.7)

The five High items from the backlog below.

5. **Every overlay is modal, through one hook.** `src/hooks/useModal.ts` is
   the rest timer's logic made shared: focus moves to the panel (unless an
   `autoFocus` child already took it; the opener is captured during the first
   render, before that can happen), everything outside is `inert`, Escape
   calls `onEscape`, and on close focus returns to the opener (never to a
   text field, and `onOpenerGone` when the opener was removed). The inert
   walk covers the siblings of the panel and of each ancestor up to `<body>`,
   so it also works for a modal nested inside another (the Run Mode tour,
   the end-run confirm), skips `aria-hidden` backdrops so tap-outside still
   works, and reference-counts what it makes inert, so overlapping modals can
   close in any order. Only the topmost modal answers Escape. Used by
   `BottomSheet` (Escape = the ✕, also for sheets with
   `dismissOnBackdrop={false}`: a key press is deliberate, a backdrop tap may
   not be), `ConfirmDialog` (Escape cancels; now named and described by its
   title and body via `aria-labelledby`/`aria-describedby`), `RestTimer`
   (the full-screen card is now its own `RestCard` component so the hook is
   mount-based), and Run Mode: `Shell` (Escape closes from the sound check,
   asks before ending a run, does nothing on the review), `RunTour` (no
   Escape, because leaving the tour starts the run; the lifted LAP/Lock
   controls are inert while it's up, so they're shown, not pressed) and the
   end-run confirm, which is now a named `alertdialog` (`EndConfirm`).
   Guides: `accessibility` (custom overlays), `dialog`, `html`.
6. **Placeholder-only labels.** `Login` (below), `QuickLogSheet` (Other
   activity, Note), `CompleteFlow` (pain, notes), `RunMode` review (pain,
   notes: `aria-label`, there's no visible heading), `WeekPlanner` (the
   notes/paste box and the import box, now `<label for>`), `Onboarding` "About
   you" (`FieldLabel` renders a `<label>` when given `htmlFor`; name and date
   of birth also get `autocomplete`, as do Settings' name and date of birth),
   and `ChatFlow`'s free-text reply, named by Clawde's question bubble
   (`aria-labelledby`). Guides: `accessibility`, `forms`.
7. **Status and error messages are announced.** Always-present
   `role="status"` / `role="alert"` containers that the text is put into:
   Settings → Notifications (`RestAlertsSetting`; restructured so the
   containers exist before a message does), the rest timer's `RestAlertOffer`
   ("Turn on" error and the "Rest alerts are on" line), a visually hidden
   "Profile saved" for Save profile, the plan-import error in `WeekPlanner`
   (also `aria-invalid` + `aria-describedby` on the box) and the sign-in
   error. Guides: `accessibility` (Live regions),
   `accessible-error-announcement`.
8. **Code-split the main chunk.** `src/App.tsx` loads every page except
   `Home` and `Session` with `lib/lazyPage` (`React.lazy` + `import()`), under
   `components/layout/PageSuspense` (a `Suspense` with no fallback, since
   in-app navigation keeps the previous screen up, and an error boundary that
   offers Reload). `vite.config.ts` also puts React (+ router) and Supabase in
   chunks of their own, so a deploy that only changes app code no longer
   re-downloads them. Entry chunk 799 kB → 179 kB (237 → 57 kB gzip), plus
   `react` 232 kB and `supabase` 201 kB; no build warning. Two departures from
   the recommendation: `RunMode` and `MovementGuide` stay in the entry chunk,
   because they're the workout path, and an update that lands mid-workout
   deletes the old version's chunks while the page can't reload (that would
   lose the session in progress). For the same reason `lazyPage` reloads
   into the new version when a chunk is missing, once per 10 s so a broken
   deploy or being offline can't loop. Guide: `performance` (code-splitting,
   bundler chunking).
9. **Sign-in is a real form.** `pages/Login.tsx`: `<form onSubmit>` with
   `type="submit"` buttons (Enter works natively, the `onKeyDown` is gone),
   visible `<label>`s, `name`/`id`, `required`, `autocomplete="username"` and
   `spellcheck="false"` on the email, `enterkeyhint`, and the error in an
   always-present `role="alert"`. The magic-link "Check your inbox" card takes
   focus when it replaces the form. Guides: `autofill-sign-in-form`, `forms`.

Verified with Playwright (Chromium, 390×844) on production builds (local
mode, and a build with a dummy Supabase URL for sign-in): every lazy route
renders directly and from the tab bar; the What's new sheet, import sheet,
"No reps entered" confirm, rest timer, Run Mode (sound check, tour, end-run
confirm, review) and the discard confirm stacked over Run Mode each take
focus, keep Tab inside (bar the browser-chrome stop, as with `<dialog>`),
make the rest inert, close on Escape as described and return focus (to the
opener, "Edit set 1", the bar, or "Don't save" with Run Mode live again),
leaving nothing inert; the import error and sign-in error land in their
alert regions; Enter submits sign-in; a missing Settings chunk reloads into a
working page, and a second failure shows the error boundary; the injury
question names the chat's reply box.

## Third pass (v1.1.2, 2026-11-20)

A full re-audit of the v1.1 code (the workout dock and view transitions,
auto-finish, reorder, Workout complete and share cards, History edit mode,
planning methods, slim onboarding) plus the open backlog, against the same
skill version. Extra guides consulted: `card`, `checkbox`, `switch`, `navbar`,
`color`, `same-document-transitions`, `faster-spa-view-transitions`, `drag`,
`dynamic-sort`, `drag-and-drop`, `copy-button`, `ime-safe-enter-submit`,
`form-fields-automatically-fit-contents`, `visually-stable-font-fallbacks`,
`break-up-long-tasks`, `identify-inp-causes`, `optimize-image-priority`,
`progress-ring`. Everything below is fixed unless marked otherwise.

### New findings, fixed

10. **Tappable cards keyboards couldn't reach.** `Card` was a `<div onClick>`:
    Home's next/upcoming/missed sessions, every History tile and the Progress
    program tile could not be focused or opened without a pointer, and had no
    role. `Card` now takes `to` and renders one native link (the `card`
    guide's single-destination card). History's edit mode renders each tile as
    a `<label>` around a real (visually hidden) checkbox instead of a
    `span role="checkbox"` inside a clickable div. Guides: `card`,
    `accessibility` (prefer native HTML), `checkbox`.
11. **Unnamed buttons.** `PageHeader`'s back button (every sub-page) and
    Progress's Settings button had only an icon. Back is now "Back"; header
    icon actions that navigate (Settings, Edit program, Plan your week) are
    `HeaderIconLink`s with a label. Guide: `accessibility` (names).
12. **Navigation as buttons.** The tab bar and sidebar were
    `<button onClick={navigate}>`. They're `NavLink`s in a `<ul>` (current page
    gets `aria-current="page"`), as are "View all", Program's session rows and
    Settings → Redo onboarding. The workout dock stays a button: it's a timer
    with a drag gesture, and a link would start a native link-drag. Guide:
    `navbar`.
13. **Choice groups.** ARIA `role="radio"` buttons without arrow-key
    behaviour (How did it feel, share card design, plan method) and
    `aria-pressed` chips in unnamed groups (gender, units, activity, where you
    train, days, session length, effort, quick-log activity, program setup,
    chat chips) are now native radios/checkboxes in a `<fieldset>`/`<legend>`
    (`shared/Choice`: `ChoiceGroup`, `ChoiceChip`; the input is visually
    hidden, the chip shows a focus ring). The planner's day buttons were named
    "M", "T", "W", "T", "F", "S", "S"; they now read "Monday" … and say when a
    day has passed. Guides: `forms` (selection controls), `checkbox`, `card`
    (choice cards).
14. **Switches.** The three `role="switch"` buttons are `shared/Switch`: a
    native `<input type="checkbox" switch role="switch">`, styled by `.switch`
    in index.css (same look everywhere, so no polyfill), named and described
    by its row, with a 44px hit area; busy uses `aria-disabled` so focus
    stays. Guide: `switch`.
15. **The chat was silent.** Clawde's messages weren't in a live region. The
    message list is `role="log"`; the typing dots are hidden; chip answers are
    grouped and named by the question; the multi-select chips are checkboxes.
    Guide: `accessibility` (live regions).
16. **Enter in the chat sent half-composed text.** The free-text reply used an
    `onKeyDown` Enter handler, which fires while a Japanese/Chinese/Korean IME
    is still composing. It's a `<form>` now (native implicit submission waits
    for the IME); the set row's Enter-to-next-field checks `isComposing` and
    `keyCode 229`. Guide: `ime-safe-enter-submit`.
17. **Text contrast.** Secondary text `#6a6a6a` (about 3.3:1 on the cards),
    faint text `#4a4a4a`/`#3a3a3a` (about 2:1) and placeholders failed 4.5:1;
    text-field borders `#2a2a2a` failed 3:1. Now `#949494`, `#858585`,
    placeholders `#858585`, field borders `#666666` (warm equivalents on
    Workout complete). Guide: `color`.
18. **State not exposed.** Exercise tile headers and Program's week rows now
    have `aria-expanded`; the workout progress bar is a native `<progress>`
    (`.meter`); the Progress calendar and Program chart are `role="img"` with a
    written summary (they were divs with `title` only); the rest countdown is
    `role="timer"`. Guides: `accessibility`, `progress`.
19. **Status messages.** Workout complete's share message used `empty:hidden`
    (`display: none` until filled, so not announced): now always rendered.
    "Copied" in the prompt sheet and the Settings sync error are in
    always-present `role="status"`/`role="alert"` containers. Reordering
    announces "Bench Press, moved to position 2 of 5"; the up/down buttons are
    `aria-disabled` at the ends so focus isn't dropped. Guides:
    `accessible-error-announcement`, `copy-button`, `dynamic-sort`.
20. **Headings and landmarks.** Section labels (Home, History, Progress,
    Settings, Program, warm-up, Exercises) were styled `<p>`s: now `<h2>`.
    Check-in had no `<h1>`; sheets and dialogs use `<h2>`. The full-screen
    routes and the loading screen are `<main>`; the loading screen has a
    status message. `ClawdeMark` is decorative by default (it was announced as
    "Clawde the crab, ready to train" beside every chat bubble). Emoji,
    arrows and icons beside text are `aria-hidden`. Guide: `accessibility`.
21. **Persistent animation.** Clawde's bob and sweat looped forever (WCAG
    2.2.2 needs a way to stop motion over 5 s). They now play twice / once
    and settle. All decoration (`clawde-*`, typing dots, rest pulse, scroll
    reveal, spinners via `motion-safe:animate-spin`) is opted in under
    `prefers-reduced-motion: no-preference`; sheets and fade-ins fall back to
    opacity only. Programmatic smooth scrolling uses `scrollBehavior()`.
    Guide: `motion`.
22. **Focus after navigation.** Opening a session from a card removed the
    focused card, leaving focus on `<body>` (the view-transition path handled
    it, the plain path didn't). `RouteChange` in App.tsx now moves focus to
    the new screen's `<h1>` whenever the old focus is gone. Guide:
    `same-document-transitions` (focus routing).
23. **Share cards drawn in one go.** Three 1080² canvases rendered back to
    back as Workout complete opened; they're drawn one at a time with
    `scheduler.yield()` (`setTimeout` fallback) in between. Guide:
    `break-up-long-tasks`.
24. **Fonts.** `font-size-adjust: from-font` (cap height for Tiny5) keeps the
    fallback the same size while Space Mono/Tiny5 load. Guide:
    `visually-stable-font-fallbacks`.
25. **Smaller fixes.** External links say "(opens in a new tab)"; the set
    clock's `aria-label` on a `<span>` is visually hidden text; the date-of-
    birth hint is `aria-describedby`; the Reorder/Done button no longer
    combines `aria-pressed` with a changing label; MovementGuide tags use
    `text-2xs`; dead `ripple`/`clawde-pushup`/`clawde-run` CSS removed; the
    reorder grip is `touch-pan-x` instead of `touch-none`; the website's hero
    screenshot has `fetchpriority="high"`. Guides: `accessibility`,
    `optimize-image-priority`.

### Backlog from the second pass, done

- **Busy buttons kept focus.** `Button`'s `loading` uses `aria-disabled` and
  ignores presses instead of `disabled`; so do the busy switch and the
  stepper ends.
- **Input focus indicator.** Solid accent border plus a 1px ring (6:1).
- **Touch targets.** `hit-target` (index.css) grows the hit area to
  `--target-size` (24px, 44px on `pointer: coarse`) without changing the look:
  set tick, timed Start/Stop, back and header icons, help buttons, steppers,
  rest timer chevron, Reorder; switches get a 44px label.
- **Minimised rest timer over the focused field.** `scroll-padding-bottom` on
  `<html>` clears the dock (tab bar or rest bar), and `scroll-padding-top`
  clears the sticky header.
- **Reduced motion** for `.slide-up`, `.fade-in`, `.timer-pulse` and spinners
  (finding 21).
- **One title for every route.** `useDocumentTitle` (in `PageHeader`, Home,
  Login, Onboarding, Check-in): "Upper Body · Coach Clawde"; reset on each
  route change.
- **Toggle groups as radios** (finding 13).
- **`overflow-x: clip` on html/body** removed: nothing overflows at 320px on
  any route (checked with the clip disabled); the app column keeps its own
  clip.
- **`no-store`** dropped from `vercel.json` (`no-cache` alone, so bfcache
  works and every deploy is still seen).
- **Manifest `id: '/'`.**
- **Scrollbars:** `scrollbar-color` with a 3:1 thumb, legacy pseudo-elements
  only under `@supports not (scrollbar-color: auto)`.
- **Textareas** grow with their text (`field-sizing: content`, min/max
  height, `resize-y` where unsupported).
- **Android text size:** `<meta name="text-scale" content="scale">`
  (`lib/dynamicType` stays iOS-only, so nothing double-scales).
- **Native switch** (finding 14).
- **No `<main>` on full-screen routes** (finding 20).
- **Announce the end of a rest:** a polite "Rest over. Up next: …" when a rest
  runs out on screen (not when it's skipped).

### Brand colour, decided by the owner

26. **White on the accent orange.** `#d97756` with white text is 3.1:1 (needs
    4.5:1): primary buttons, picked chips, chat answer bubbles, the
    unconfirmed tick. The owner chose a deeper fill: `--color-accent-fill`
    `#b85a3a` (4.6:1), hover `--color-accent-fill-hover` `#a94f30` (5.5:1),
    used as `bg-accent-fill` wherever white sits on solid orange. Orange text,
    icons, borders and tints stay `#d97756`. The green done tick moved from
    emerald-500 (2.5:1 with its white check) to emerald-600 (3.8:1, above the
    3:1 for icons). Guide: `color`.

### Open

- **Native `<dialog>`: not adopted, by decision.** The `accessibility` guide's
  custom-overlay rules (role, `aria-modal`, focus in, `inert` outside, focus
  back) are what `useModal` does; `<dialog>`'s top layer would escape
  `#fixed-layer`, which carries the installed-iPhone `--app-h` sizing and the
  `app` container queries. Revisit if that layer is ever retired.
- **Rest ring as `<progress>`.** The SVG ring stays decorative; the countdown
  is `role="timer"` and the minimised bar is named with the time left, which
  covers what the ring shows.

Verified with Playwright (Chromium, 390×844, production build, local mode)
and axe-core 4.10: keyboard-only onboarding (arrow keys in radio groups,
focus ring on chips), Tab to a session card and Enter opens it with focus on
the new `<h1>` and the title updated, set tick hit area, rest timer (Escape,
`role="timer"`, "Rest over" announced), reorder announcement and focus at the
top, Workout complete radios, Settings switches (Space) and unit radios,
planner day names, History links and edit-mode checkboxes, reduced motion
(mascot still), no horizontal overflow at 320px on nine routes. axe reports no
violations on Home, Session (rest timer open), Workout complete, Progress,
Settings, the planner, History and onboarding (after finding 26).

## Checked and fine

- **Push flow** (`lib/restAlerts`): `subscribe()` / `requestPermission()` are
  the first thing awaited in the tap (Safari's user-gesture rule), the SW
  registration and VAPID key are prefetched, iPhone-in-Safari shows the
  "add to Home Screen" path, permission "denied" is detected, and stale
  subscriptions (rotated keys) are dropped.
- **Arming by beacon** (`lib/restAlarmController`, `lib/restAlerts`):
  `sendBeacon` with a `text/plain` Blob (no preflight) on `visibilitychange`
  → hidden plus `pagehide`, fetch `keepalive` fallback, no `unload` listener.
  `fetchLater()` (`full-session-analytics`) is for telemetry sent on unload,
  not a send-on-hide action, so it doesn't apply.
- **Service worker** (`public/push-sw.js`): every push shows a notification
  (iOS requirement), `tag` + `renotify`, URL restricted to same-origin paths,
  click focuses an existing window before opening one.
- **Updates** (`lib/appUpdate`): resume/online/interval checks, reload only at
  safe moments; workbox `CacheFirst` with expiry for fonts and the exercise
  library.
- **Web Audio** (`lib/audioCues`, `hooks/useRestTimer`): context resumed from
  the tap, cues scheduled on the audio clock, re-timed on return to the
  foreground; `navigator.audioSession` used only when present.
- **Wake lock** (`hooks/useWakeLock`): feature-detected, re-requested on
  visibility, released on cleanup.
- **Safe areas and viewport**: `viewport-fit=cover`, `env(safe-area-inset-*)`
  tokens with `max()` floors, `svh`/`dvh` units, `interactive-widget`, short
  viewport variant; layout uses container queries (`@container/app`).
- **Backdrop blur**: Tailwind emits `-webkit-backdrop-filter` too, so iOS 16.4+
  is covered.
- **Images**: the movement-guide photos have descriptive `alt`, `loading="lazy"`
  and an aspect-ratio box (no layout shift).
- **Basics**: `lang="en"`, `color-scheme: dark`, `theme-color`, one `<main>`
  in the signed-in shell, labelled `<nav>`s (only one shows at a time), icon-only buttons carry `aria-label`, decorative SVGs are
  `aria-hidden`, text inputs are 16 px (no iOS zoom), `prefers-reduced-motion`
  already covers the Clawde animations and scroll reveal.
