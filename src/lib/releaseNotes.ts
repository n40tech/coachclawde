/**
 * Release notes shown to beta testers the first time they open the app after
 * an update ("What's new"). Newest release first.
 *
 * Shipping a beta update:
 *   1. Bump `version` in package.json.
 *   2. Add an entry for that version at the TOP of `RELEASES`.
 * `npm run build` fails if the newest entry here doesn't match package.json,
 * so an update can't ship without its notes (see vite.config.ts).
 *
 * Put everything that came from tester feedback under `fromFeedback` — that's
 * the "you asked, we built it" list testers see first. Write each line from
 * the athlete's point of view, in plain language.
 *
 * Keep this module dependency-free: vite.config.ts imports it at build time.
 */

export interface Release {
  /** Semver, matching package.json, e.g. "1.0.2". */
  version: string
  /** ISO date the update shipped. */
  date: string
  /** One-line theme for the release. */
  headline: string
  /** Changes made in response to tester feedback. */
  fromFeedback: string[]
  /** Anything else worth mentioning. */
  alsoNew?: string[]
  /**
   * Optional call to action shown as a button in "What's new" (newest
   * release only), e.g. to try a reworked feature.
   */
  action?: {
    label: string
    /** In-app route the button opens. */
    to: string
    /** One line above the button saying why. */
    note?: string
  }
}

export const RELEASES: Release[
  {
    version: '1.1.3',
    date: '2026-11-20',
    headline: 'A steadier Home and a clearer way back to your workout',
    fromFeedback: [
      'Home and Progress no longer fade their cards in as you open them, so nothing looks like it’s still loading.',
      'The little workout button by the tab bar no longer slides in. Between rests it shows a dumbbell (or your session’s icon) instead of a clock, so it’s obvious what it’s for.',
      'With a workout under way, Home shows it at the top as “In progress”, with how long you’ve been going. Tap it to pick up where you left off.',
    ],
  },] = [
  {
    version: '1.1.2',
    date: '2026-11-20',
    headline: 'Easier to read, and easier to use with a keyboard, screen reader or larger text.',
    fromFeedback: [],
    alsoNew: [
      'Grey labels, hints and text boxes are a little brighter so they’re easier to read, and a text box you’re typing in has a clear orange outline.',
      'Orange buttons and picked options are a shade deeper, so their white text is easier to read.',
      'Small buttons (the set tick, Start and Stop, the steppers) have bigger tap areas, without looking any different.',
      'Session tiles, the tab bar and the program card are proper links, so they work with a keyboard and screen readers. Choices like days, units, gender and effort are proper radio buttons and checkboxes.',
      'Screen readers now hear Clawde’s chat messages, each screen’s name, “Rest over” when a rest ends, and when you move an exercise.',
      'If your phone is set to reduce motion, Clawde and the sheets stay still, and Clawde no longer bobs around forever on any screen.',
      'On Android, the app follows your phone’s text size.',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-11-20',
    headline: 'Sets that finish themselves, your real workout time, and a timer that follows you.',
    fromFeedback: [
      'Auto-finish: after a rest (and a 15-second grace period), your next tap means you’ve done the set. Its tick turns orange and the next rest starts on its own. Fix reps or weight any time, then tap the orange tick to confirm. Turn it off in Settings → Beta features.',
      'Workout complete shows the elapsed time, from Start Session to Complete Session, like a stopwatch (e.g. 52:13). The share cards show it too.',
      'Tapping a rest notification opens your workout at the exercise that’s up next, expanded and scrolled into view, even if the app was already open on another screen.',
      'The workout timer now flows between screens: leave mid-rest and the rest bar shrinks into the little circle on Home; tap the circle (or drag it right) and it grows back into your workout. A quick flick left on the rest bar takes you Home.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-20',
    headline: 'Weights-first: a set timer, a workout summary to share, and faster planning.',
    fromFeedback: [
      'After a rest, your next tap starts timing the set: its tick turns orange with a count-up, and you can still type reps and weight before you tick it. Don’t want it? Settings → Beta features.',
      'Leave the workout mid-rest and the timer comes with you: a little circle bottom-left (the tab bar shifts over). Tap it to jump back.',
      'Finishing a workout opens a full “Workout complete” page: reps, sets, time and total lifted beside Clawde, any new PBs, how it felt and notes. Share it as one of three square cards (Summary, Headline or Logbook), or delete the workout if it was a mistake.',
      'Reorder your exercises by dragging them. Start one early and the list reshuffles itself to match.',
      'Four ways to plan a week: repeat last week, change last week by describing it, paste your own plan, or a fresh plan from Clawde. The one you used last comes first.',
      'Onboarding is down to the basics: name, gender, age, how active you are, where you train, injuries and anything else.',
      'Movement guides now have Google Images next to YouTube.',
      'History has an Edit button: select sessions and delete them together (no more bin on every tile).',
      'The bottom of the Progress page no longer hides behind the tab bar.',
      'Reopening the app no longer flashes white, and it opens straight away instead of waiting for the server.',
      'Rest alert notifications work again.',
    ],
    alsoNew: [
      'Coach Clawde is now weights-first: plans no longer schedule cardio, and Run Mode is gone. Did a run or a class? Log it with "Did something else?" or "Log a session" and it still counts.',
    ],
  },
  {
    version: '1.0.7',
    date: '2026-11-17',
    headline: 'Easier with a keyboard, a screen reader or a password manager.',
    fromFeedback: [],
    alsoNew: [
      'Sheets, pop-ups, Run Mode and the rest timer now take keyboard and screen-reader focus when they open, keep it until they close (Esc closes them) and hand it back afterwards.',
      'Every text box has a name your screen reader reads out, and sign-in, plan import and rest-alert messages are announced.',
      'Sign-in is a proper form, so your password manager or iPhone Passwords can fill it in.',
      'The app starts faster: screens you don’t need mid-workout load the first time you open them, and updates download less.',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-11-17',
    headline: 'Know when rest is over, even with your phone locked.',
    fromFeedback: [
      'Rest alerts: get a notification when rest is over, even if your phone is locked or you’re in another app. Turn them on from the rest timer or in Settings → Notifications. On iPhone, open Coach Clawde from your Home Screen to use them.',
      'Minimise the rest timer (tap the arrow, or anywhere outside the timer) and it tucks into the bottom of the screen, so you can keep logging, reading movement guides or scrolling while you rest. It stays minimised for your next rests until you open it again.',
      '“Complete Session” now waits at the end of your workout instead of sitting on screen the whole time.',
    ],
    alsoNew: [
      'Coming back to the app mid-rest no longer plays a late “rest over” beep partway through your next set.',
    ],
    action: {
      label: 'Set up rest alerts',
      to: '/settings',
      note: 'Rest alerts are off until you turn them on.',
    },
  },
  {
    version: '1.0.5',
    date: '2026-10-20',
    headline: 'Pounds and miles, if that’s how you train.',
    fromFeedback: [
      'Pick kg or lb, and km or miles, separately in Settings → Units. Your plan, the weights you log, paces, splits and personal bests all switch over.',
    ],
    alsoNew: [
      'Clawde still plans in metric behind the scenes, so you can switch back and forth at any time and nothing is lost.',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-10-20',
    headline: 'Opening Claude on iPhone works properly again.',
    fromFeedback: [
      'On iPhone, “Open Claude” no longer fills the prompt with + signs between the words.',
    ],
    alsoNew: [
      'The last onboarding step no longer suggests example notes; just add anything you want Clawde to know.',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-10-19',
    headline: 'Plans that look like real gym sessions, with shorter warm-ups and calmer handling of niggles.',
    fromFeedback: [
      'Sessions look like a real programme: a focused handful of well-known exercises, the big lift first, and the same exercises week to week so your weights keep climbing.',
      'Shorter warm-ups on the kit you’re already using: a few lighter sets of your first lift (or an easier version of it at home), plus a few minutes on the bike or rower in longer sessions. No more marching on the spot.',
      'Cool-downs are optional, so more of your time goes on the workout itself.',
      'Supersets only when time is tight, and only two exercises at one station, so you’re not hopping between machines.',
      'Niggles are handled calmly: Clawde changes the exercises that bother them and leaves the rest of your training alone, without extra rehab moves or warnings in every session.',
    ],
    alsoNew: [
      'The weekly check-in only asks about a niggle when it matters: when it’s new, after you’ve noted pain, when it’s getting worse, or now and then so you can tell us it’s gone.',
      'If a niggle gets worse, the check-in tells you when it’s worth seeing a GP or physio.',
      'Runners: drills and strides only come before faster sessions, and never before a row, ride or swim.',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-10-01',
    headline: 'Run Mode, real goals and weekly check-ins, shaped by your feedback.',
    fromFeedback: [
      'Run Mode times your intervals for you. Press Start and it plays a tone at every change: rising for go, falling for recover, and pips just before. No more second stopwatch. Keep the app open while you run (cues stop if you lock the phone), and on iPhone turn Silent mode off to hear them.',
      'For distance reps, press the big LAP button when you reach the distance and it records your time.',
      'After a run, your log is already filled in from the timer. Check it, add one effort score, save.',
      'Logging by hand is easier: the number the plan already knows is filled in, and times use + and − buttons instead of typing "mm:ss".',
      'Did something else? Log a bike ride, a class or a swim instead of the planned session, and it counts. "Log a session" on Home works with no plan at all.',
      'Your session notes, pain notes and swaps now reach Clawde when it plans your next week.',
      'The rest timer beeps when rest is over (and buzzes on Android), and your screen stays on during a workout.',
      'Updates now arrive by themselves. The app checks when you open it and switches over at a quiet moment, never mid-workout.',
      'Fixed: a session could vanish from Home (while the count still included it) if an earlier week had a session with the same name. Every week’s sessions now stay separate, and your history is untouched.',
    ],
    alsoNew: [
      'Onboarding starts with why you’re here (a race, a habit, a holiday, your sport, or your own plan), asks only what changes your plan, and ends with a card you can correct.',
      'Training for an event? Give a recent race time and the app works out your paces, and Clawde plans the weeks up to race day.',
      'A one-minute check-in at the end of the week, only when you want it. Every answer changes next week’s plan.',
      'Got a plan from a coach or a book? Paste it and Clawde converts it for the app, or just log as you go.',
      'The plan Clawde writes is built around how you train: gym-only means no cardio, runners don’t get lifting rules, and home workouts stick to the kit you have.',
      'Plans only ask for what you can measure: with just a phone, reps are set by time.',
      'Already set up? A three-question check-in upgrades your goal. Nothing you’ve logged changes.',
      'Turn off check-in suggestions, or delete your health-screen answers, in Settings.',
    ],
    action: {
      label: 'Redo onboarding',
      to: '/onboarding',
      note: 'Training for something? Redo onboarding so your plans are built around it. It takes about a minute, and your history stays.',
    },
  },
  {
    version: '1.0.1',
    date: '2026-09-30',
    headline: 'Faster setup and a better workout screen, shaped by your feedback.',
    fromFeedback: [
      'Onboarding is now a quick chat with Clawde, right in the app. No more copying prompts back and forth.',
      'Fewer setup steps. Your name and stats come last, and we now ask your date of birth (optional, editable in Settings).',
      'Warm-ups expand into the full list of moves, just like the main workout.',
      'Every exercise has a ? button with a how-to guide and photos, plus a YouTube search as backup.',
      "Tick a set without entering reps and we'll check it wasn't an accident.",
      'Logged a set wrong? Tap its tick again to reopen it and fix the reps or weight.',
      'Generate & Open Claude opens the Claude app with your prompt already filled in.',
    ],
    alsoNew: [
      'When you come back from Claude, the import sheet is open and ready to paste.',
      'Set how many days a week you want to train in Program setup.',
      "The app now fits your screen properly: a floating tab bar that lines up with your iPhone's corners, a sidebar on iPad, sheets that stay above the keyboard, and support for larger text sizes.",
    ],
  },
]

/** Compares dotted numeric versions: negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Releases newer than `lastSeen` (all of them when `lastSeen` is null), newest first. */
export function releasesSince(lastSeen: string | null): Release[] {
  return lastSeen ? RELEASES.filter((r) => compareVersions(r.version, lastSeen) > 0) : RELEASES
}
