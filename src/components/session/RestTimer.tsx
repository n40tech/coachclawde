import { useEffect, useRef, useState } from 'react'
import { useRestTimer } from '../../hooks/useRestTimer'
import { useModal } from '../../hooks/useModal'
import { secondsToDisplay } from '../../lib/dateUtils'
import { Bell, CheckCircle, ChevronDown, ChevronUp, SkipForward } from 'lucide-react'
import { FixedLayer } from '../layout/FixedLayer'
import { Button } from '../shared/Button'
import { useSettingsStore } from '../../store/useSettingsStore'
import { enableRestAlerts, prepareRestAlerts, restAlertSupport } from '../../lib/restAlerts'

/**
 * The rest timer: a full-screen countdown, or (minimised) a slim bar above
 * the Session action bar so the athlete can keep logging, read a movement
 * guide or scroll while resting. The choice sticks for the next rest.
 */
export function RestTimerOverlay() {
  const { remaining, progress, isActive, label, skipTimer } = useRestTimer()
  const minimised = useSettingsStore((s) => s.restTimerMinimised)
  const setMinimised = useSettingsStore((s) => s.setRestTimerMinimised)
  const barRef = useRef<HTMLButtonElement>(null)
  const focusBar = useRef(false)

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
    return (
      <FixedLayer>
        <div
          className="absolute inset-x-0 z-40 px-safe pointer-events-none"
          style={{ bottom: 'calc(var(--action-bar-h) + max(1rem, var(--safe-bottom)) + 0.5rem)' }}
        >
          <div className="max-w-md @3xl/app:max-w-xl @5xl/app:max-w-2xl mx-auto pointer-events-auto flex items-center gap-1 bg-[#161616]/95 backdrop-blur-xl border border-[#2a2a2a] rounded-2xl p-1.5 shadow-lg shadow-black/40 slide-up">
            <button
              ref={barRef}
              onClick={() => setMinimised(false)}
              aria-label={`Rest, ${time} left. Show the timer`}
              className="flex-1 min-w-0 flex items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-[#1f1f1f] transition-colors"
            >
              <Ring elapsed={elapsed} className="w-9 h-9 shrink-0" strokeWidth={12} />
              <span className="flex-1 min-w-0">
                <span className={`block text-lg font-bold text-[#f5f5f0] tabular-nums leading-tight ${pulse}`}>{time}</span>
                <span className="block text-xs text-[#6a6a6a] truncate">{label}</span>
              </span>
              <ChevronUp size={18} className="text-[#6a6a6a] shrink-0" />
            </button>
            <button
              onClick={skipTimer}
              aria-label="Skip rest"
              title="Skip rest"
              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-[#a8a29e] hover:text-[#d97756] hover:bg-[#d97756]/10 transition-colors"
            >
              <SkipForward size={18} />
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
 * `useModal`); Escape, the chevron and a tap outside all minimise it.
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
          className="relative bg-[#111] rounded-3xl border border-[#2a2a2a] p-8 short:p-5 w-72 flex flex-col items-center gap-5 short:gap-3 slide-up outline-none"
        >
          <button
            onClick={onMinimise}
            aria-label="Minimise rest timer"
            title="Minimise"
            className="absolute top-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center text-[#6a6a6a] hover:text-[#f5f5f0] hover:bg-[#1a1a1a] transition-colors"
          >
            <ChevronDown size={20} />
          </button>
          <p className="text-xs text-[#6a6a6a] uppercase tracking-widest font-medium">Rest</p>
          <p className="text-sm text-[#a8a29e] text-center">{label}</p>

          <div className="relative w-32 h-32 short:w-24 short:h-24">
            <Ring elapsed={elapsed} className="w-full h-full" strokeWidth={8} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl short:text-3xl font-bold text-[#f5f5f0] tabular-nums ${pulse}`}>{time}</span>
            </div>
          </div>

          <button
            onClick={onSkip}
            className="flex items-center gap-2 text-sm text-[#6a6a6a] hover:text-[#d97756] transition-colors py-2 px-4 rounded-xl hover:bg-[#d97756]/10"
          >
            <SkipForward size={16} />
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
            <p className="text-xs text-[#6a6a6a] leading-relaxed">
              Get a notification when rest is over, even with your phone locked.
            </p>
            <div role="alert">
              {error && <p className="text-xs text-red-400 leading-relaxed mt-3">{error}</p>}
            </div>
          </div>
          <div className="flex gap-2 whitespace-nowrap">
            <Button size="sm" variant="secondary" onClick={turnOn} loading={busy}>
              {!busy && <Bell size={14} />}
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
