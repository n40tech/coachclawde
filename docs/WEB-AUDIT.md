# Web platform audit (2026-11-17)

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

## Fixed in this pass

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

## Backlog

### High

- **Other overlays have the same focus problem as the rest timer had.**
  `components/shared/BottomSheet.tsx`, `components/shared/ConfirmDialog.tsx`,
  and `components/session/RunMode.tsx` (`Shell`, `RunTour`) declare
  `aria-modal` but never move focus in, never make the page inert, ignore
  Escape and don't return focus. Because they portal to `#fixed-layer` (after
  `#root`), a keyboard user has to Tab through the whole page to reach them.
  Recommended: extract the RestTimer logic into a shared hook (focus the panel
  unless an `autoFocus` child already has focus, `inert` everything outside,
  Escape calls `onClose`, restore focus) and use it in all three. Longer term,
  consider native `<dialog>` + `showModal()` (see Medium). Guides:
  `accessibility`, `dialog`, `html`. Effort: M.
- **Placeholder-only labels across the rest of the app.** `pages/Login.tsx`
  (email, password), `components/session/QuickLogSheet.tsx` (custom activity,
  notes), `components/session/CompleteFlow.tsx`, `components/session/RunMode.tsx`
  (notes), `pages/WeekPlanner.tsx` (paste box, notes),
  `components/onboarding/ChatFlow.tsx:334-340`, `pages/Onboarding.tsx:221`.
  Most have a visible `<p>` heading next to them; turn it into a `<label for>`
  (or add `aria-label` where there is none). Guides: `accessibility`, `forms`.
  Effort: S–M.
- **Status and error messages aren't announced.** Settings → Notifications
  (`RestAlertsSetting` message, `pages/Settings.tsx:455`), the rest-timer
  "Turn on" error and success line (`RestTimer.tsx` `RestAlertOffer`), and
  "Saved" on Save profile. Screen-reader users hear nothing when turning
  alerts on fails or the test alert is sent. Render an always-present
  `role="status"` container (errors: `role="alert"`) and put the text in it.
  Guides: `accessibility` (Live regions), `accessible-error-announcement`.
  Effort: S.
- **Code-split the 800 kB main chunk.** `src/App.tsx` imports every page
  eagerly; the build warns and the precache is ~1 MB. Lazy-load routes off the
  workout path (`Onboarding`, `CheckIn`, `WeekPlanner`, `Progress`,
  `Program`, `ProgramEdit`, `BestEfforts`, `History`, `Settings`, `Login`) and
  heavy components (`RunMode`, `MovementGuide`) with `React.lazy` + `import()`.
  Keep `Home` and `Session` in the entry chunk so the offline workout path never
  waits on a chunk. Guide: `performance` (JavaScript code-splitting). Effort: M.
- **Sign-in form isn't a form.** `pages/Login.tsx:124-150`: no `<form>`, no
  labels, Enter handled by `onKeyDown`, email lacks `spellcheck="false"`. Wrap
  in `<form onSubmit>` with a submit button, add labels. Password managers and
  iOS autofill work better with a real form. Guides: `autofill-sign-in-form`,
  `forms`. Effort: S.

### Medium

- **Buttons that go `disabled` while busy drop keyboard focus.**
  `components/shared/Button.tsx` (`loading` sets `disabled`), the rest-alert
  switch (`pages/Settings.tsx:423-427`, `disabled={busy}`). After activation
  focus falls to `<body>`. Use `aria-disabled` and ignore clicks while busy.
  Guides: `accessibility` (`disabled` vs `aria-disabled`), `install-web-app`
  (the same pattern in its example). Effort: S.
- **Input focus indicator is too faint.** Every text input uses
  `focus:outline-none focus:border-[#d97756]/50`; the half-alpha border is
  roughly 2.5:1 against the surrounding card (estimate), under the 3:1 the
  guide requires for a replacement indicator. Use a solid `#d97756` border or
  a `focus-visible:` outline. Guides: `accessibility` (Focus indicators),
  `forms`. Effort: S.
- **Touch targets under 44 px.** Set tick (`SetRow` `CompleteButton`, 32×32),
  timed Start/Stop (32 px high), the two Settings switches (48×28), rest-timer
  chevron (40×40). Grow the hit area (padding or a pseudo-element) without
  changing the look. Guide: `form-factor-adaptation`. Effort: S.
- **Fixed bars can hide the focused field.** The Session action bar and
  minimised rest bar cover the bottom of the page; nothing sets
  `scroll-padding-bottom`, so a focused set input can scroll under them. Add
  `scroll-padding-bottom` on the Session page equal to the action bar (plus
  the minimised bar when showing). Guide: `form-factor-adaptation`. Effort: S.
- **Entrance animations ignore reduced motion.** `src/index.css`: `.slide-up`
  (translateY 100%, used by every sheet, dialog and the rest bar), `.fade-in`
  and `.timer-pulse` aren't in the `prefers-reduced-motion` block; Tailwind's
  `animate-spin` in `Button` neither. Make `.slide-up` opacity-only under
  reduce, and gate `timer-pulse` behind `no-preference`. Guide: `motion`.
  Effort: S.
- **One page title for every route.** `index.html` sets "Coach Clawde" and no
  route changes it. Set `document.title` per route ("Session: Upper · Coach
  Clawde"). Guide: `accessibility` (Titles). Effort: S.
- **Native `<dialog>` for the overlays.** The guides' default for modals is
  `<dialog>` + `showModal()` (inert page, focus return, Escape and back-gesture
  close). Not done now because the top layer escapes `#fixed-layer`, which
  carries the installed-iPhone `--app-h` sizing and the `app` container
  queries; it needs device testing. Light dismiss needs the documented
  `closedby` fallback on Safari. Guides: `dialog`, `light-dismiss-a-dialog`,
  `platform-controls-dismiss-dialog`, `prevent-page-scroll-under-modal-dialog`.
  Effort: L.
- **Toggle groups as pressed buttons.** Gender and Units (`pages/Settings.tsx`
  `UnitToggle`), QuickLog activity chips: exclusive choices are `aria-pressed`
  buttons with no group name. Use a radio group (`fieldset` + `legend`, or
  `role="radiogroup"` with a label). Guide: `forms` (Selection Control
  Decision Matrix). Effort: S–M.

### Low

- **`overflow-x: clip` on `html, body`.** `src/index.css:32`. The guide says to
  fix the wide element instead, since anything past the edge becomes
  unreachable. It was added deliberately to protect the centred shell; only
  revisit with device testing. Guide: `form-factor-adaptation`. Effort: M.
- **`no-store` on the HTML.** `vercel.json` sends `no-cache, no-store,
  must-revalidate` for `/` and `/index.html`; `no-store` blocks the
  back/forward cache. `no-cache` alone keeps "every deploy is seen". (Same
  header on `sw.js` and the manifest is harmless.) Guide: `performance`.
  Effort: S.
- **Manifest has no `id`.** `vite.config.ts` manifest: add `id: '/'` (equal to
  today's computed id, so installs keep their identity). Guide:
  `install-web-app`. Effort: S.
- **Scrollbar styling.** `src/index.css:219-229` uses only `::-webkit-scrollbar`
  (4 px, `#2a2a2a` thumb on a transparent track, under 3:1 on `#0a0a0a`). Add
  `scrollbar-color` with a lighter thumb and keep the webkit rules as fallback;
  avoid `thin`. Guide: `customize-scrollbar-color-and-thickness`. Effort: S.
- **Textareas use `resize-none`.** `CompleteFlow`, `RunMode`, `WeekPlanner`,
  `QuickLogSheet`, `ChatFlow`, `ConfirmCard`. Use `resize-y` (or
  `field-sizing: content` where supported). Guide: `browser-ui-theming`.
  Effort: S.
- **Android text size.** Add `<meta name="text-scale" content="scale">` (Chrome
  146+; ignored elsewhere). Keep `lib/dynamicType` iOS-only so it never
  double-scales. Guide: `respect-os-text-scale`. Effort: S.
- **Native switch.** The two `role="switch"` buttons in Settings are correct
  ARIA. `<input type="checkbox" switch>` is Safari-only today; only adopt it
  with the guide's conditional polyfill. Guide: `switch`. Effort: S.
- **Rest timer ring semantics.** The SVG ring is `aria-hidden` and the time is
  plain text, which works; a `<progress>`-based ring would expose progress
  natively. Low value. Guide: `progress-ring`. Effort: M.
- **No `<main>` on the full-screen routes.** `PhoneColumn` in `src/App.tsx`
  (Login, Onboarding, Check-in) renders a plain `<div>`; make it `<main>`.
  Guide: `accessibility` (Landmarks). Effort: S.
- **Announce the end of a rest.** When a rest ends on screen, only a
  tone plays; a polite status ("Rest over") would help screen-reader users who
  have the sound off. Guide: `accessibility` (Live regions). Effort: S.

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
