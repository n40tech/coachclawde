import { useState } from 'react'
import { ChevronDown, ChevronUp, CircleQuestionMark, Info } from 'lucide-react'
import type { LoggedExercise, PlannedExercise } from '../../types'
import { SetRow } from './SetRow'
import { MovementGuide } from './MovementGuide'
import { formatRestTime } from '../../lib/dateUtils'
import { useUnits } from '../../store/useSettingsStore'
import { localize } from '../../lib/units'

interface ExerciseTileProps {
  planned: PlannedExercise
  logged: LoggedExercise
  onUpdateSet: (setIndex: number, updates: Partial<LoggedExercise['sets'][0]>) => void
  onSetComplete: (setIndex: number, payload?: Partial<LoggedExercise['sets'][0]>) => void
  onSetUncomplete: (setIndex: number) => void
  /** Confirms an auto-finished (orange-ticked) set. */
  onSetConfirm: (setIndex: number) => void
  isActive: boolean
  onActivate: () => void
  /** Bumped to open this tile from outside (a rest alert opening the workout here). */
  revealNonce?: number
  /** The set under way in this exercise since the last rest, if any (see SetClock). */
  timedSet?: { setIndex: number; startedAt: number }
}

export function ExerciseTile({ planned, logged, onUpdateSet, onSetComplete, onSetUncomplete, onSetConfirm, isActive, onActivate, timedSet, revealNonce }: ExerciseTileProps) {
  const [expanded, setExpanded] = useState(isActive)
  const [prevReveal, setPrevReveal] = useState(revealNonce)
  if (revealNonce !== prevReveal) {
    setPrevReveal(revealNonce)
    if (revealNonce) setExpanded(true)
  }
  // The timed set's tile opens so the orange tick is in view. The tap that
  // started the timer may be on this header: its click mustn't close it again.
  const [prevTimed, setPrevTimed] = useState(timedSet)
  const [autoOpenedAt, setAutoOpenedAt] = useState(0)
  if (timedSet !== prevTimed) {
    setPrevTimed(timedSet)
    if (timedSet && !expanded) {
      setExpanded(true)
      setAutoOpenedAt(timedSet.startedAt)
    }
  }
  const [showGuide, setShowGuide] = useState(false)
  const units = useUnits()

  const completedSets = logged.sets.filter((s) => s.completed).length
  const totalSets = planned.sets.length
  const allDone = completedSets === totalSets

  return (
    <div
      data-exercise={planned.id}
      // Scrolled to from a rest alert: clear of the sticky page header.
      className={`scroll-mt-[calc(max(0.5rem,var(--safe-top))+4.5rem)] rounded-[2rem] border overflow-hidden transition-all duration-200 ${
        isActive
          ? 'border-[#d97756]/40 bg-gradient-to-br from-[#d97756]/5 to-[#161616]'
          : allDone
          ? 'border-emerald-500/20 bg-[#161616]'
          : 'border-[#2a2a2a] bg-[#161616]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center pr-2">
        <button
          type="button"
          aria-expanded={expanded}
          className="flex-1 min-w-0 flex items-center gap-3 pl-4 pr-2 py-4 text-left"
          onClick={() => {
            if (Date.now() - autoOpenedAt > 600) setExpanded((e) => !e)
            onActivate()
          }}
        >
          {/* Set progress indicator */}
          <div aria-hidden className="flex gap-1 shrink-0">
            {planned.sets.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  logged.sets[i]?.unconfirmed ? 'bg-[#d97756]' : logged.sets[i]?.completed ? 'bg-emerald-400' : isActive ? 'bg-[#d97756]/40' : 'bg-[#2a2a2a]'
                }`}
              />
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm leading-tight ${allDone ? 'text-[#949494] line-through' : 'text-[#f5f5f0]'}`}>
              {planned.name}
            </p>
            <p className="text-xs text-[#858585] mt-0.5">
              {completedSets}/{totalSets} sets · rest {formatRestTime(planned.sets[0]?.restSeconds ?? 90)}
            </p>
          </div>

          {expanded ? <ChevronUp size={16} aria-hidden className="text-[#858585] shrink-0" /> : <ChevronDown size={16} aria-hidden className="text-[#858585] shrink-0" />}
        </button>

        <button
          type="button"
          onClick={() => setShowGuide(true)}
          aria-label={`How to do ${planned.name}`}
          className="relative hit-target w-9 h-9 rounded-xl flex items-center justify-center text-[#949494] hover:text-[#d97756] hover:bg-[#d97756]/10 transition-colors shrink-0"
        >
          <CircleQuestionMark size={18} aria-hidden />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-2 [--nest-radius:2rem] [--nest-inset:1rem]">
          {/* Coach notes */}
          {planned.coachNotes && (
            <div className="flex items-start gap-2 bg-[#d97756]/8 rounded-nested px-3 py-2.5 mb-1">
              <Info size={13} className="text-[#d97756] mt-0.5 shrink-0" aria-hidden />
              <p className="text-xs text-[#d97756]/90">{localize(planned.coachNotes, units)}</p>
            </div>
          )}

          {/* Set rows */}
          {/* Size container: set rows reflow to two lines when text is large. */}
          <div className="@container flex flex-col gap-1.5">
            {planned.sets.map((plannedSet, i) => (
              <SetRow
                key={i}
                setIndex={i}
                plannedSet={plannedSet}
                loggedSet={logged.sets[i]}
                onUpdate={(updates) => onUpdateSet(i, updates)}
                onComplete={(payload) => onSetComplete(i, payload)}
                onUncomplete={() => onSetUncomplete(i)}
                onConfirm={() => onSetConfirm(i)}
                inProgressSince={timedSet?.setIndex === i ? timedSet.startedAt : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {showGuide && (
        <MovementGuide name={planned.name} notes={planned.coachNotes} onClose={() => setShowGuide(false)} />
      )}
    </div>
  )
}
