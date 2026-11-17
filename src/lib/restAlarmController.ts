/**
 * When to arm and cancel the server-side rest alarm (see lib/restAlerts and
 * supabase/functions/rest-alarm). Pure: the browser bits come in as deps, so
 * the rules are unit-tested.
 *
 * The rule: the alarm is armed only while the app is hidden mid-rest. While
 * the app is on screen the in-app tone does the job, so a notification would
 * just be a second alert. Going into the background arms it, coming back
 * cancels it. Arming is a beacon (it must survive the page being frozen),
 * so everything it needs (token, push subscription) is prepared at rest start.
 */

export interface AlarmRequest {
  alarmId: string
  /** From now until the rest ends; the server times it with its own clock. */
  delayMs: number
  title: string
  body: string
  /** In-app path the notification opens. */
  url: string
}

export interface RestAlarmDeps<P> {
  now: () => number
  isHidden: () => boolean
  newId: () => string
  /** Token and subscription for this rest, or null when alerts are off. */
  prepare: (endTime: number) => Promise<P | null>
  /** Fire-and-forget; must work while the page is being hidden. */
  arm: (prepared: P, request: AlarmRequest) => void
  cancel: (prepared: P, alarmId: string) => void
}

/** Rests ending sooner than this aren't worth a notification. */
export const MIN_ARM_MS = 2000

interface Rest<P> {
  alarmId: string
  endTime: number
  title: string
  body: string
  url: string
  prepared: P | null
  armed: boolean
}

export function createRestAlarmController<P>(deps: RestAlarmDeps<P>) {
  let rest: Rest<P> | null = null

  function maybeArm() {
    if (!rest || rest.armed || !rest.prepared) return
    const delayMs = rest.endTime - deps.now()
    if (delayMs < MIN_ARM_MS) return
    deps.arm(rest.prepared, { alarmId: rest.alarmId, delayMs, title: rest.title, body: rest.body, url: rest.url })
    rest.armed = true
  }

  function disarm() {
    if (!rest?.armed || !rest.prepared) return
    rest.armed = false
    // Once the rest is over the server has already sent (and deleted) it.
    if (deps.now() < rest.endTime) deps.cancel(rest.prepared, rest.alarmId)
  }

  return {
    /** A rest began (or was restarted) and ends at `endTime`. */
    start(endTime: number, body: string, url: string) {
      disarm()
      const current: Rest<P> = {
        alarmId: deps.newId(),
        endTime,
        title: 'Rest over',
        body,
        url,
        prepared: null,
        armed: false,
      }
      rest = current
      void deps
        .prepare(endTime)
        .catch(() => null)
        .then((prepared) => {
          if (rest !== current) return
          current.prepared = prepared
          // Hidden before we were ready (a very quick lock): arm now.
          if (deps.isHidden()) maybeArm()
        })
    },

    /** The rest was skipped or ran out on screen. */
    stop() {
      disarm()
      rest = null
    },

    /** The app went into the background (or is being closed). */
    hidden() {
      maybeArm()
    },

    /** The app is back on screen. */
    shown() {
      disarm()
      if (rest && deps.now() >= rest.endTime) rest = null
    },

    /** For tests. */
    state() {
      return rest ? { alarmId: rest.alarmId, armed: rest.armed, prepared: rest.prepared !== null } : null
    },
  }
}
