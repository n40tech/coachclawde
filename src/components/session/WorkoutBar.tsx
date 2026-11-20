import { useEffect, useState } from 'react'
import { ChevronLeft, Home } from 'lucide-react'
import { FixedLayer } from '../layout/FixedLayer'
import { useHorizontalDrag } from '../../hooks/useHorizontalDrag'
import { rubberBand } from '../../lib/swipe'
import { formatElapsed } from '../../lib/workoutSummary'

interface WorkoutBarProps {
  /** ISO time Start Session was tapped. */
  startedAt: string
  /** Epoch ms the set under way started (the last rest ended), if any. */
  setStartedAt?: number
  /** e.g. "5 of 12 sets". */
  progress: string
  /** Flick left or tap Home: leave the workout (it shrinks into the Home dock). */
  onLeave: () => void
}

/**
 * The workout's clock between rests, docked where the rest bar sits: time
 * since Start Session and the set under way. Flick it left (or tap Home) to
 * go to the Home screen, where it becomes the dock circle.
 */
export function WorkoutBar({ startedAt, setStartedAt, progress, onLeave }: WorkoutBarProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const drag = useHorizontalDrag(-1, onLeave)
  const pull = rubberBand(drag.dx, 140)
  const elapsed = formatElapsed((now - Date.parse(startedAt)) / 1000)
  const set = setStartedAt != null ? formatElapsed((now - setStartedAt) / 1000) : null

  return (
    <FixedLayer>
      <div
        {...drag.handlers}
        role="group"
        aria-label={`Workout clock, ${elapsed}. Flick left to go home`}
        style={{ transform: pull ? `translateX(${pull}px)` : undefined, opacity: 1 - Math.min(0.35, -pull / 400) }}
        className={`vt-workout-timer absolute tabbar-dock z-40 flex items-center gap-1 rounded-(--tabbar-radius) p-(--tabbar-pad) bg-[#161616]/95 backdrop-blur-xl ring-1 ring-inset ring-[#2a2a2a] shadow-lg shadow-black/50 slide-up touch-pan-y select-none ${
          drag.dragging ? '' : 'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
        }`}
      >
        <div className="flex-1 min-w-0 h-full flex items-center gap-3 pl-2 pr-3">
          <span aria-hidden className="w-9 h-9 shrink-0 rounded-full border-[4px] border-[#d97756] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d97756] timer-pulse" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold text-[#f5f5f0] tabular-nums leading-tight">{elapsed}</span>
            <span className="block text-xs text-[#6a6a6a] truncate">
              {set ? <><span className="text-[#f59e0b] tabular-nums">Set {set}</span> · {progress}</> : progress}
            </span>
          </span>
          <ChevronLeft aria-hidden size={16} className="text-[#4a4a4a] shrink-0" />
        </div>
        <button
          onClick={onLeave}
          aria-label="Go home (the workout keeps running)"
          title="Home"
          className="h-full aspect-square shrink-0 rounded-(--tabbar-item-radius) flex items-center justify-center text-[#a8a29e] hover:text-[#d97756] hover:bg-[#d97756]/10 transition-colors"
        >
          <Home size={18} />
        </button>
      </div>
    </FixedLayer>
  )
}
