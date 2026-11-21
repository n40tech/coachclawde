import { useContext, useEffect, useRef, useState } from 'react'
import { useRestTimer } from '../../hooks/useRestTimer'
import { useModal } from '../../hooks/useModal'
import { secondsToDisplay } from '../../lib/dateUtils'
import { Bell, CheckCircle, ChevronDown, ChevronUp, SkipForward } from 'lucide-react'
import { FixedLayer } from '../layout/FixedLayer'
import { Button } from '../shared/Button'
import { useSettingsStore } from '../../store/useSettingsStore'
import { enableRestAlerts, prepareRestAlerts, restAlertSupport } from '../../lib/restAlerts'
import { useFlick } from '../../hooks/useFlick'
import { rubberBand } from '../../lib/swipe'
import { SheetContext } from './sheetMotion'

/**
 * The rest timer: a full-screen countdown, or (minimised) a pill docked where
 * the tab bar sits on other screens, so the athlete can keep logging, read a
 * movement guide or scroll while resting. The choice sticks for the next rest.
 * Flick the bar up to open the timer full screen, and the timer down to
 * tuck it away again.
 *
 * Inside the workout sheet, dragging the bar left squeezes it towards the
 * dock circle on its left while the sheet slides down in step; let go far
 * enough (or flick) and the workout closes. Pulling the sheet down squeezes
 * the bar the same way.
 */
export function RestTimerOverlay() {
  const { remaining, progress, isActive, label, skipTimer } = useRestTimer()
  const minimised = useSettingsStore((s) => s.restTimerMinimised)
  const setMinimised = useSettingsStore((s) => s.setRestTimerMinimised)
  const sheet = useContext(SheetContext)
  const barRef = useRef<HTMLButtonElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const focusBar = useRef(false)
  const drag = useFlick({ up: () => setMinimised(false), left: sheet?.dismiss })
  const lift = rubberBand(drag.y, 40)
  // How far the bar's right end can travel before the bar is a circle.
  const [span, setSpan] = useState(0)
  const squeezing = drag.dragging && drag.x < 0 && span > 0
  const squeeze = squeezing ? Math.min(1, -drag.x / span) : null
  const follow = sheet?.follow
  useEffect(() => {
    follow?.(squeeze)
  }, [follow, squeeze])
  useEffect(() => () => follow?.(null), [follow])

  // Full screen it's modal (RestCard): on close, focus goes back to what had
  // it (usually the set's tick), or to the minimised bar when that's gone
  // (the timer was opened from the bar). This runs after the card's cleanup
  // in the same commit, once the bar is mounted.
  useEffect(() => {
    if (!focusBar.current) return
    focusBar.current = false
    if (isActive && minimised) barRef.current?.focus()
  }, [isActive, minimised])

  if (!isActive) return null

  // Draining ring: full at the start of the rest, empty when it runs out.
  const elapsed = Math.min(1, Math.max(0, progress))
  const time = secondsToDisplay(remaining)
  const pulse = remaining <= 5 ? 'timer-pulse' : ''

  if (minimised) {
    // 0 = the full bar, 1 = squeezed into a circle at its left end.
    const p = sheet?.progress ?? 0
    const still = drag.dragging || sheet?.dragging
    const ease = still ? '' : 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
    const squeezeBy = `calc((100% - var(--tabbar-h)) * ${p})`
    return (
      <FixedLayer>
        {/* Same dock, height and pill as the tab bar (index.css tabbar-dock),
            so it sits concentric with the screen's rounded corners. The ring
            and Skip are inset so their curves follow the pill's ends. Only
            the full bar takes part in the morph into the Home dock: once
            squeezed it already sits where the dock circle will be. */}
        <div
          ref={dockRef}
          {...drag.handlers}
          onPointerDown={(e) => {
            const el = dockRef.current
            if (el) setSpan(el.offsetWidth - el.offsetHeight)
            drag.handlers.onPointerDown(e)
          }}
          style={{ transform: lift ? `translateY(${lift}px)` : undefined }}
          className={`${p ? '' : 'vt-workout-timer'} absolute tabbar-dock z-40 slide-up touch-none select-none ${
            still ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
          }`}
        >
          <div
            aria-hidden
            style={{ width: `calc(100% - ${squeezeBy})` }}
            className={`absolute inset-y-0 left-0 rounded-(--tabbar-radius) bg-[#161616] ring-1 ring-inset ring-[#2a2a2a] shadow-lg shadow-black/50 ${
              ease && `transition-[width] ${ease}`
            }`}
          />
          <div
            style={{ clipPath: `inset(0 ${squeezeBy} 0 0 round var(--tabbar-radius))` }}
            className={`relative h-full flex items-center gap-1 p-(--tabbar-pad) ${ease && `transition-[clip-path] ${ease}`}`}
          >
            <button
              ref={barRef}
              onClick={() => setMinimised(false)}
              aria-label={`Rest, ${time} left. Show the timer`}
              className="flex-1 min-w-0 h-full flex items-center gap-3 rounded-(--tabbar-item-radius) pl-2 pr-3 text-left hover:bg-[#1f1f1f] transition-colors"
            >
              <Ring elapsed={elapsed} className="w-9 h-9 shrink-0" strokeWidth={12} />
              <span className="flex-1 min-w-0">
                <span className={`block text-lg font-bold text-[#f5f5f0] tabular-nums leading-tight ${pulse}`}>{time}</span>
                <span className="block text-xs text-[#949494] truncate">{label}</span>
              </span>
              <ChevronUp size={18} className="text-[#949494] shrink-0" aria-hidden />
            </button>
            <button
              type="button"
              onClick={skipTimer}
              aria-label="Skip rest"
              title="Skip rest"
              className="h-full aspect-square shrink-0 rounded-(--tabbar-item-radius) flex items-center justify-center text-[#a8a29e] hover:text-[#d97756] hover:bg-[#d97756]/10 transition-colors"
            >
              <SkipForward size={18} aria-hidden />
            </button>
          </div>
        </div>
      </FixedLayer>
    )
  }

  return (
    <RestCard
      label={label}
      time={time}
      elapsed={elapsed}
      pulse={pulse}
      onMinimise={() => setMinimised(true)}
      onSkip={skipTimer}
      onOpenerGone={() => { focusBar.current = true }}
    />
  )
}

/**
 * The full-screen timer. Modal for keyboard and screen readers (see
 * `useModal`); Escape, the chevron, a tap outside and a flick down all
 * minimise it.
 */
function RestCard({
  label, time, elapsed, pulse, onMinimise, onSkip, onOpenerGone,
}: {
  label: string
  time: string
  elapsed: number
  pulse: string
  onMinimise: () => void
  onSkip: () => void
  onOpenerGone: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModal(dialogRef, { onEscape: onMinimise, onOpenerGone })
  const drag = useFlick({ down: onMinimise })
  const drop = Math.max(0, drag.y)
  return (
    <FixedLayer>
      <div className="absolute inset-0 z-50 flex items-end short:items-center justify-center pb-edge short:pt-safe">
        {/* Tapping outside the card tucks the timer away. */}
        <div aria-hidden className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onMinimise} />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Rest timer"
          tabIndex={-1}
          {...drag.handlers}
          style={{ transform: drop ? `translateY(${drop}px)` : undefined }}
          className={`vt-workout-timer relative bg-[#111] rounded-3xl border border-[#2a2a2a] p-8 short:p-5 w-72 flex flex-col items-center gap-5 short:gap-3 slide-up outline-none touch-none select-none ${
            drag.dragging ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
          }`}
        >
          <button
            type="button"
            onClick={onMinimise}
            aria-label="Minimise rest timer"
            title="Minimise"
            className="absolute hit-target top-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center text-[#949494] hover:text-[#f5f5f0] hover:bg-[#1a1a1a] transition-colors"
          >
            <ChevronDown size={20} aria-hidden />
          </button>
          <p className="text-xs text-[#949494] uppercase tracking-widest font-medium">Rest</p>
          <p className="text-sm text-[#a8a29e] text-center">{label}</p>

          <div className="relative w-32 h-32 short:w-24 short:h-24">
            <Ring elapsed={elapsed} className="w-full h-full" strokeWidth={8} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span role="timer" aria-label="Rest left" className={`text-4xl short:text-3xl font-bold text-[#f5f5f0] tabular-nums ${pulse}`}>{time}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-2 text-sm text-[#949494] hover:text-[#d97756] transition-colors py-2 px-4 rounded-xl hover:bg-[#d97756]/10"
          >
            <SkipForward size={16} aria-hidden />
            Skip rest
          </button>

          <RestAlertOffer />
        </div>
      </div>
    </FixedLayer>
  )
}

function Ring({ elapsed, className, strokeWidth }: { elapsed: number; className: string; strokeWidth: number }) {
  const r = 50 - strokeWidth / 2
  const circumference = 2 * Math.PI * r
  return (
    <svg className={`${className} -rotate-90`} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1f1f1f" strokeWidth={strokeWidth} />
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke="#d97756"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * elapsed}
        className="transition-[stroke-dashoffset] duration-200 ease-linear"
      />
    </svg>
  )
}

/**
 * Offers rest alerts once, where they're most obviously useful. Only when the
 * device can do them and the athlete hasn't answered the permission prompt:
 * afterwards it's a Settings switch.
 */
function RestAlertOffer() {
  const restAlerts = useSettingsStore((s) => s.restAlerts)
  const dismissed = useSettingsStore((s) => s.restAlertsOfferDismissed)
  const dismiss = useSettingsStore((s) => s.dismissRestAlertsOffer)
  const [busy, setBusy] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Captured once: answering the prompt changes the permission mid-render.
  const [offer] = useState(
    () => !restAlerts && !dismissed && restAlertSupport() === 'available' && Notification.permission === 'default',
  )

  useEffect(() => {
    if (offer) void prepareRestAlerts()?.catch(() => {})
  }, [offer])

  if (!offer || (dismissed && !justEnabled)) return null

  async function turnOn() {
    setBusy(true)
    setError(null)
    const result = await enableRestAlerts()
    setBusy(false)
    if (result.ok) setJustEnabled(true)
    else setError(result.message)
  }

  // The status and alert containers stay in the page while the offer shows,
  // so the outcome of "Turn on" is announced.
  return (
    <div className="w-full border-t border-[#2a2a2a] pt-4 short:pt-3">
      <div role="status">
        {justEnabled && (
          <div className="flex items-start gap-2 text-xs text-[#a8a29e] leading-relaxed">
            <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden />
            <p>Rest alerts are on. Lock your phone and you’ll still get a notification when rest is over.</p>
          </div>
        )}
      </div>
      {!justEnabled && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div>
            <p className="text-xs text-[#949494] leading-relaxed">
              Get a notification when rest is over, even with your phone locked.
            </p>
            <div role="alert">
              {error && <p className="text-xs text-red-400 leading-relaxed mt-3">{error}</p>}
            </div>
          </div>
          <div className="flex gap-2 whitespace-nowrap">
            <Button size="sm" variant="secondary" onClick={turnOn} loading={busy}>
              {!busy && <Bell size={14} aria-hidden />}
              Turn on
            </Button>
            {!busy && (
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
