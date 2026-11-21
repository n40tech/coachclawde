import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { FixedLayer } from '../layout/FixedLayer'
import { useFlick } from '../../hooks/useFlick'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { SheetContext, type SheetMotion } from './sheetMotion'

/** How long the sheet takes to slide away once it's let go. */
const SHEET_CLOSE_MS = 300
const EASE = 'cubic-bezier(0.32,0.72,0,1)'

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The workout as a sheet: it slides up over the screen it was opened from,
 * with rounded top corners and a grab handle. Pull the header down (or flick
 * it), tap the chevron, press Escape or squeeze the rest timer bar to the
 * left, and it slides back down and `onClose` runs once it's gone.
 *
 * It's modal: the page underneath (`#root`) is inert while it's up. Overlays
 * opened from inside it (sheets, dialogs, the rest timer) sit above it in the
 * fixed layer and keep working.
 */
export function WorkoutSheet({ title, subtitle, right, onClose, below, children }: {
  title: string
  subtitle?: string
  /** Shown at the right of the header (the intensity badge). */
  right?: ReactNode
  /** Runs once the sheet has slid away: the navigation back. */
  onClose: () => void
  /** Pinned under the header, above the scrolling content (the progress bar). */
  below?: ReactNode
  children: ReactNode
}) {
  useDocumentTitle(title)
  const panel = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [height, setHeight] = useState(0)
  const [follow, setFollow] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  const drag = useFlick({ down: () => setClosing(true) })
  const pulled = height > 0 ? Math.min(1, Math.max(0, drag.y / height)) : 0
  const progress = closing ? 1 : follow ?? pulled
  const dragging = !closing && (follow !== null || drag.dragging)

  const motion = useMemo<SheetMotion>(
    () => ({ progress, dragging, follow: setFollow, dismiss: () => setClosing(true) }),
    [progress, dragging],
  )

  // Once it's off screen, go back.
  useEffect(() => {
    if (!closing) return
    const t = window.setTimeout(() => close.current(), reduceMotion() ? 0 : SHEET_CLOSE_MS)
    return () => clearTimeout(t)
  }, [closing])

  // The page underneath is out of reach while the sheet is up.
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root || root.inert) return
    root.inert = true
    return () => { root.inert = false }
  }, [])

  // Focus lands on the title, which tells a screen reader where it is.
  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) heading.current?.focus({ preventScroll: true })
  }, [])

  // Escape closes it, unless something opened over it (they answer first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const modals = document.querySelectorAll('[aria-modal="true"]')
      if (modals.length !== 1 || modals[0] !== panel.current) return
      e.preventDefault()
      setClosing(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ease = dragging || reduceMotion() ? 'none' : `${SHEET_CLOSE_MS}ms ${EASE}`
  return (
    <SheetContext.Provider value={motion}>
      <FixedLayer>
        <div className="absolute inset-0 z-30">
          {/* The screen underneath, dimmed: it brightens as the sheet comes down. */}
          <div
            aria-hidden
            style={{ opacity: 1 - progress, transition: ease === 'none' ? 'none' : `opacity ${ease}` }}
            className="absolute inset-0 bg-black/60 touch-none motion-safe:animate-[fade-only_0.3s_ease-out]"
          />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-sheet-title"
            style={{
              transform: progress ? `translateY(${progress * 100}%)` : undefined,
              transition: ease === 'none' ? 'none' : `transform ${ease}`,
            }}
            className={`${progress ? '' : 'vt-workout-sheet'} sheet-enter absolute inset-x-0 bottom-0 top-[calc(max(0.5rem,var(--safe-top))+0.5rem)] mx-auto w-full max-w-md @3xl/app:max-w-xl @5xl/app:max-w-2xl flex flex-col overflow-hidden rounded-t-[2rem] bg-[#0a0a0a] ring-1 ring-[#262626] shadow-[0_-12px_40px_rgba(0,0,0,0.6)]`}
          >
            {/* Header: the handle to pull it down by. */}
            <div
              {...drag.handlers}
              onPointerDown={(e) => {
                setHeight(panel.current?.offsetHeight ?? 0)
                drag.handlers.onPointerDown(e)
              }}
              className="shrink-0 px-4 pt-2 pb-3 border-b border-[#1a1a1a] touch-none select-none cursor-grab active:cursor-grabbing"
            >
              <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[#3a3a3a]" />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setClosing(true)}
                  aria-label="Close workout"
                  title="Close (or pull down)"
                  className="relative hit-target w-9 h-9 flex items-center justify-center rounded-2xl bg-[#1a1a1a] text-[#a8a29e] hover:text-[#f5f5f0] transition-colors shrink-0"
                >
                  <ChevronDown size="1.125em" aria-hidden />
                </button>
                <div className="flex-1 min-w-0">
                  <h1
                    ref={heading}
                    id="workout-sheet-title"
                    tabIndex={-1}
                    className="text-lg font-semibold text-[#f5f5f0] leading-tight truncate outline-none"
                  >
                    {title}
                  </h1>
                  {subtitle && <p className="text-xs text-[#949494] mt-0.5">{subtitle}</p>}
                </div>
                {right && <div className="shrink-0">{right}</div>}
              </div>
            </div>
            {below}
            {children}
          </div>
        </div>
      </FixedLayer>
    </SheetContext.Provider>
  )
}
