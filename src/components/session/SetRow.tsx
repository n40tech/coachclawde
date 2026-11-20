import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Play, Square, TriangleAlert } from 'lucide-react'
import type { LoggedSet, PlannedSet } from '../../types'
import { secondsToDisplay } from '../../lib/dateUtils'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useUnits } from '../../store/useSettingsStore'
import { fromWeight, toWeight } from '../../lib/units'

interface SetRowProps {
  setIndex: number
  plannedSet: PlannedSet
  loggedSet: LoggedSet | undefined
  onUpdate: (updates: Partial<LoggedSet>) => void
  onComplete: (payload?: Partial<LoggedSet>) => void
  /** Reopen a completed set so its reps/weight/time can be corrected. */
  onUncomplete: () => void
  /** Confirm an auto-finished set (its orange tick). */
  onConfirm: () => void
  /** Epoch ms the last rest ended, while this is the set under way: its time shows. */
  inProgressSince?: number
}

export function SetRow(props: SetRowProps) {
  const timed = props.plannedSet.durationSeconds != null
  return timed ? <TimedSetRow {...props} /> : <RepSetRow {...props} />
}

/** Standard reps × weight set. */
function RepSetRow({ setIndex, plannedSet, loggedSet, onUpdate, onComplete, onUncomplete, onConfirm, inProgressSince }: SetRowProps) {
  const completed = loggedSet?.completed ?? false
  // Auto-finished: done, but reps and weight stay open until the tick is tapped.
  const unconfirmed = completed && !!loggedSet?.unconfirmed
  const locked = completed && !unconfirmed
  const skipped = loggedSet?.skipped ?? false
  const [confirm, setConfirm] = useState<'empty' | 'edit' | null>(null)
  const unit = useUnits().weight

  // Keep the raw typed text locally so partial decimals (e.g. "60.") survive —
  // parsing straight to Number on every keystroke would drop the trailing dot.
  const [repsText, setRepsText] = useState(loggedSet?.actualReps?.toString() ?? '')
  const [weightText, setWeightText] = useState(loggedSet?.weightKg != null ? String(toWeight(loggedSet.weightKg, unit)) : '')
  const weightRef = useRef<HTMLInputElement>(null)

  const timing = !completed && inProgressSince != null

  return (
    <div className={rowClass(locked, skipped, timing, unconfirmed)} data-set={setIndex}>
      {timing ? (
        <SetClock since={inProgressSince} />
      ) : (
        <span className="text-xs text-[#858585] w-6 shrink-0 font-medium">#{setIndex + 1}</span>
      )}

      {/* Target */}
      <div className="text-xs text-[#949494] shrink-0 w-16">
        {plannedSet.reps} reps
        {plannedSet.suggestedWeightKg && (
          <span className="block text-[#858585]">~{toWeight(plannedSet.suggestedWeightKg, unit)}{unit}</span>
        )}
      </div>
      <RowBreak />

      {/* Actual reps */}
      <input
        type="text"
        inputMode="numeric"
        enterKeyHint="next"
        onKeyDown={(e) => {
          // Not while an input method is still composing (Enter confirms it).
          if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
          weightRef.current?.focus()
        }}
        aria-label={`Set ${setIndex + 1} reps`}
        placeholder={plannedSet.reps}
        value={repsText}
        onChange={(e) => {
          const raw = e.target.value
          setRepsText(raw)
          const n = Number(raw)
          onUpdate({ actualReps: raw === '' || Number.isNaN(n) ? undefined : n })
        }}
        disabled={locked}
        className="w-14 @max-[17rem]:w-11 @max-[17rem]:px-1 bg-[#111] border border-[#666666] rounded-nested px-2 py-1.5 text-base text-center text-[#f5f5f0] placeholder-[#858585] focus:outline-none focus:border-[#d97756] focus:ring-1 focus:ring-[#d97756] disabled:opacity-40"
      />

      {/* Actual weight */}
      <div className="flex items-center flex-1 min-w-0 @max-[17rem]:basis-0 gap-1">
        <input
          type="text"
          ref={weightRef}
          inputMode="decimal"
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
            e.currentTarget.blur()
          }}
          aria-label={`Set ${setIndex + 1} weight in ${unit}`}
          placeholder={unit}
          value={weightText}
          onChange={(e) => {
            // Allow digits and a single decimal point only.
            const raw = e.target.value.replace(/[^0-9.]/g, '')
            setWeightText(raw)
            const n = Number(raw)
            onUpdate({ weightKg: raw === '' || Number.isNaN(n) ? undefined : fromWeight(n, unit) })
          }}
          disabled={locked}
          className="w-full bg-[#111] border border-[#666666] rounded-nested px-2 py-1.5 text-base text-center text-[#f5f5f0] placeholder-[#858585] focus:outline-none focus:border-[#d97756] focus:ring-1 focus:ring-[#d97756] disabled:opacity-40"
        />
        <span className="text-xs text-[#858585] shrink-0">{unit}</span>
      </div>

      <CompleteButton
        setIndex={setIndex}
        completed={locked}
        unconfirmed={unconfirmed}
        onClick={() => {
          // An orange tick confirms the auto-finished set. An empty-reps tick
          // is usually a mis-tap; ticking a done set means the athlete wants
          // to fix it. Both of those ask first.
          if (unconfirmed) onConfirm()
          else if (completed) setConfirm('edit')
          else if (repsText.trim() === '') setConfirm('empty')
          else onComplete()
        }}
      />

      {confirm === 'empty' && (
        <ConfirmDialog
          icon={<TriangleAlert size={20} />}
          title="No reps entered"
          confirmLabel="Mark done"
          onConfirm={() => { setConfirm(null); onComplete() }}
          onCancel={() => setConfirm(null)}
        >
          You haven't entered any reps for set {setIndex + 1}. Mark it done anyway?
        </ConfirmDialog>
      )}
      {confirm === 'edit' && (
        <EditSetDialog
          setIndex={setIndex}
          onConfirm={() => { setConfirm(null); onUncomplete() }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

/** Timed hold (e.g. plank): a stopwatch you stop when you're done. */
function TimedSetRow({ setIndex, plannedSet, loggedSet, onComplete, onUncomplete }: SetRowProps) {
  const completed = loggedSet?.completed ?? false
  const skipped = loggedSet?.skipped ?? false
  const target = plannedSet.durationSeconds ?? 0
  const [confirmEdit, setConfirmEdit] = useState(false)

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      if (startRef.current != null) setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [running])

  function start() {
    startRef.current = Date.now()
    setElapsed(0)
    setRunning(true)
  }

  function stop() {
    const seconds = startRef.current != null ? Math.round((Date.now() - startRef.current) / 1000) : elapsed
    setRunning(false)
    startRef.current = null
    // Record the time and complete in one go so the rest timer kicks in.
    onComplete({ actualSeconds: seconds, completed: true })
  }

  return (
    <div className={rowClass(completed, skipped)} data-set={setIndex}>
      <span className="text-xs text-[#858585] w-6 shrink-0 font-medium">#{setIndex + 1}</span>

      {/* Target hold — no reps, no weight */}
      <div className="text-xs text-[#949494] shrink-0 w-16">
        {secondsToDisplay(target)} hold
      </div>
      <RowBreak />

      {/* Live stopwatch / recorded time */}
      <div className="flex-1 min-w-0 @max-[17rem]:basis-0 text-center">
        {completed ? (
          <span className="text-sm font-semibold text-emerald-400 tabular-nums">
            {secondsToDisplay(loggedSet?.actualSeconds ?? target)}
          </span>
        ) : running ? (
          <span className="text-base font-bold text-[#d97756] tabular-nums">{secondsToDisplay(elapsed)}</span>
        ) : (
          <span className="text-xs text-[#858585]">Tap start to begin</span>
        )}
      </div>

      {/* Start / Stop */}
      {completed ? (
        <CompleteButton setIndex={setIndex} completed onClick={() => setConfirmEdit(true)} />
      ) : running ? (
        <button
          type="button"
          onClick={stop}
          aria-label={`Stop set ${setIndex + 1}`}
          className="relative hit-target flex items-center gap-1.5 h-8 px-3 rounded-nested bg-accent-fill text-white text-xs font-semibold transition-all active:scale-95 shrink-0"
        >
          <Square size={13} strokeWidth={2.5} fill="currentColor" aria-hidden />
          Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          aria-label={`Start set ${setIndex + 1}`}
          className="relative hit-target flex items-center gap-1.5 h-8 px-3 rounded-nested bg-[#2a2a2a] text-[#d97756] text-xs font-semibold transition-all hover:bg-[#d97756]/20 active:scale-95 shrink-0"
        >
          <Play size={13} strokeWidth={2.5} fill="currentColor" aria-hidden />
          Start
        </button>
      )}

      {confirmEdit && (
        <EditSetDialog
          setIndex={setIndex}
          timed
          onConfirm={() => { setConfirmEdit(false); setElapsed(0); onUncomplete() }}
          onCancel={() => setConfirmEdit(false)}
        />
      )}
    </div>
  )
}

function EditSetDialog({
  setIndex, timed, onConfirm, onCancel,
}: { setIndex: number; timed?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <ConfirmDialog
      icon={<Pencil size={20} />}
      title={`Edit set ${setIndex + 1}?`}
      confirmLabel="Reopen set"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {timed
        ? 'This reopens the set so you can redo the hold.'
        : 'This reopens the set so you can fix the reps or weight, then tick it again.'}
    </ConfirmDialog>
  )
}

/** The set timer, in place of the set number while the set is being timed. */
function SetClock({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((now - since) / 1000))
  return (
    <span className="text-2xs text-[#f59e0b] w-6 shrink-0 font-bold tabular-nums">
      <span className="sr-only">Set time </span>
      {secondsToDisplay(s)}
    </span>
  )
}

function rowClass(completed: boolean, skipped: boolean, timing = false, unconfirmed = false): string {
  // Rows sit 1rem inside a 2rem-radius tile, so their corners are 1rem
  // (concentric). They then declare their own radius/inset so the inputs and
  // tick ~0.625rem inside pick up the remainder via rounded-nested.
  return `flex items-center @max-[17rem]:flex-wrap gap-2 rounded-2xl [--nest-radius:1rem] [--nest-inset:0.625rem] px-3 py-2.5 transition-all ${
    completed
      ? 'bg-emerald-500/8 border border-emerald-500/15'
      : skipped
      ? 'bg-[#1a1a1a] opacity-50'
      : unconfirmed
      ? 'bg-[#d97756]/8 border border-[#d97756]/35'
      : timing
      ? 'bg-[#f59e0b]/8 border border-[#f59e0b]/30'
      : 'bg-[#1a1a1a] border border-[#2a2a2a]'
  }`
}

function CompleteButton({ setIndex, completed, unconfirmed, onClick }: { setIndex: number; completed: boolean; unconfirmed?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tick
      aria-label={completed ? `Edit set ${setIndex + 1}` : unconfirmed ? `Confirm set ${setIndex + 1}` : `Complete set ${setIndex + 1}`}
      className={`relative hit-target w-8 h-8 rounded-nested flex items-center justify-center transition-all shrink-0 ${
        completed
          ? 'bg-emerald-600 text-white active:scale-90'
          : unconfirmed
          ? 'bg-accent-fill text-white shadow-md shadow-[#d97756]/30 active:scale-90'
          : 'bg-[#2a2a2a] text-[#858585] hover:bg-[#d97756]/20 hover:text-[#d97756] active:scale-90'
      }`}
    >
      <Check size="0.875em" strokeWidth={2.5} aria-hidden />
    </button>
  )
}

/**
 * Line break used when large text leaves the row too narrow for one line
 * (the set list is a size container; 17rem tracks the text size, so this only
 * kicks in when the athlete's text setting is large). The set number and
 * target sit on the first line, the inputs and tick on the second.
 */
function RowBreak() {
  return <span aria-hidden className="hidden @max-[17rem]:block basis-full h-0" />
}
