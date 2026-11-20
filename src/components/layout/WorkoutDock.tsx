import { useNavigate } from 'react-router-dom'
import type { DockState } from '../../hooks/useWorkoutDock'

// All in the app's orange family: the rest and workout clocks in the accent,
// a set being timed in the brighter amber of its tick.
const MODE_COLOUR = { rest: '#d97756', set: '#f59e0b', workout: '#d97756' } as const

/**
 * The little timer circle that sits left of the tab bar during a workout.
 * Tapping it goes back to the workout.
 */
export function WorkoutDockButton({ dock }: { dock: DockState }) {
  const navigate = useNavigate()
  const r = 44
  const c = 2 * Math.PI * r
  const colour = MODE_COLOUR[dock.mode]
  return (
    <button
      onClick={() => navigate(`/session/${dock.sessionId}`)}
      aria-label={`${dock.label}. Back to your workout`}
      title="Back to your workout"
      className="relative h-full aspect-square shrink-0 rounded-full bg-[#161616]/90 backdrop-blur-xl ring-1 ring-inset ring-[#2a2a2a] shadow-lg shadow-black/50 flex items-center justify-center active:scale-95 transition-transform slide-up"
    >
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#242424" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={colour} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - dock.fill)}
          className="transition-[stroke-dashoffset] duration-500 ease-linear"
        />
      </svg>
      <span className={`relative text-xs font-bold tabular-nums text-[#f5f5f0] ${dock.mode === 'rest' && dock.fill < 0.1 ? 'timer-pulse' : ''}`}>
        {dock.time}
      </span>
    </button>
  )
}
