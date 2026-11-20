import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { DockState } from '../../hooks/useWorkoutDock'
import { useHorizontalDrag } from '../../hooks/useHorizontalDrag'
import { rubberBand } from '../../lib/swipe'
import { withViewTransition } from '../../lib/viewTransition'
import { SessionIcon } from '../shared/SessionIcon'

// All in the app's orange family: the rest and workout clocks in the accent,
// a set being timed in the brighter amber of its tick.
const MODE_COLOUR = { rest: '#d97756', set: '#f59e0b', workout: '#d97756' } as const

/** How far the circle stretches as it's dragged right, before resisting. */
const STRETCH = 120

/**
 * The little timer circle that sits left of the tab bar during a workout.
 * It shows the rest countdown, or the workout's icon between rests.
 * Tap it, or drag it right (it stretches as it goes), to open the workout:
 * it grows back into the workout's timer bar (a view transition).
 */
export function WorkoutDockButton({ dock }: { dock: DockState }) {
  const navigate = useNavigate()
  const open = () => withViewTransition(() => navigate(`/session/${dock.sessionId}`))
  const { dx, dragging, handlers } = useHorizontalDrag(1, open)
  const stretch = rubberBand(dx, STRETCH)
  const r = 44
  const c = 2 * Math.PI * r
  const colour = MODE_COLOUR[dock.mode]
  return (
    <button
      {...handlers}
      onClick={open}
      aria-label={`${dock.label}. Open your workout`}
      title="Open your workout (or drag right)"
      style={{ width: `calc(var(--tabbar-h) + ${stretch}px)` }}
      className={`vt-workout-timer relative h-full shrink-0 rounded-full bg-[#161616]/90 backdrop-blur-xl ring-1 ring-inset ring-[#2a2a2a] shadow-lg shadow-black/50 flex items-center justify-start overflow-hidden touch-pan-y select-none ${
        dragging ? '' : 'transition-[width,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95'
      }`}
    >
      {/* The ring keeps its place on the left as the pill stretches. */}
      <span className="relative h-full aspect-square shrink-0 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="#242424" strokeWidth="6" />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke={colour} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - dock.fill)}
            className="transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
        {/* A rest counts down; otherwise the kind of workout under way. */}
        {dock.mode === 'rest' ? (
          <span className={`relative text-xs font-bold tabular-nums text-[#f5f5f0] ${dock.fill < 0.1 ? 'timer-pulse' : ''}`}>
            {dock.time}
          </span>
        ) : (
          <SessionIcon type={dock.type} size={20} className="relative text-[#f5f5f0]" />
        )}
      </span>
      {/* Revealed by the stretch: where the drag is heading. */}
      <span
        aria-hidden
        style={{ opacity: Math.min(1, stretch / 70) }}
        className="flex items-center gap-1 pr-4 text-sm font-semibold text-[#f5f5f0] whitespace-nowrap"
      >
        Workout <ChevronRight size={16} className="text-[#d97756]" />
      </span>
    </button>
  )
}
