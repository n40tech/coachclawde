import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { WorkoutSheet } from '../components/session/WorkoutSheet'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { Badge } from '../components/shared/Badge'
import { Button } from '../components/shared/Button'
import { ExerciseTile } from '../components/session/ExerciseTile'
import { ReorderList } from '../components/session/ReorderList'
import { RestTimerOverlay } from '../components/session/RestTimer'
import { afterPopstate, scrollBehavior, withViewTransition } from '../lib/viewTransition'
import { WorkoutComplete, type SessionCompleteData } from '../components/session/WorkoutComplete'
import { QuickLogSheet } from '../components/session/QuickLogSheet'
import { useWakeLock } from '../hooks/useWakeLock'
import { buildQuickLog, type QuickLogInput } from '../lib/quickLog'
import { describeSubstitute } from '../lib/historySummary'
import { formatSessionDate } from '../lib/dateUtils'
import { RoutineCard } from '../components/session/RoutineCard'
import { useRestTimer } from '../hooks/useRestTimer'
import { useAutoSync } from '../hooks/useAutoSync'
import { formatDuration, formatRestTime } from '../lib/dateUtils'
import { warmExerciseDb } from '../lib/exerciseGuide'
import { nextOpenSet, reorderByIds } from '../lib/exerciseOrder'
import { autoFinishTarget, graceOver } from '../lib/autoFinish'
import { summarizeWorkout, type WorkoutSummary } from '../lib/workoutSummary'
import type { Intensity, LoggedExercise, LoggedSession, LoggedSet, PlannedExercise, PlannedSession } from '../types'
import { Dumbbell, Waves, Clock, CheckCircle2, AlertTriangle, Shuffle, ArrowUpDown, Check, Eye, EyeOff, RotateCcw, Info, CircleQuestionMark } from 'lucide-react'
import { nanoid } from '../lib/nanoid'
import { useSettingsStore, useUnits } from '../store/useSettingsStore'
import { localize, toWeight, type Units } from '../lib/units'
import { MovementGuide } from '../components/session/MovementGuide'
import { logForSession } from '../lib/weekStatus'
import { plannedExerciseOf, workoutStep, type WorkoutEvent, type WorkoutResult } from '../lib/activeWorkout'

/** The current time, for event handlers (kept out of the component body). */
const currentTime = () => Date.now()

function usePlannedSession(sessionId: string | undefined): PlannedSession | undefined {
  const { weekPlans } = useAppStore()
  return useMemo(
    () => weekPlans.flatMap((p) => p.sessions).find((s) => s.id === sessionId),
    [weekPlans, sessionId]
  )
}

export function Session() {
  // `/session/:id/next/:exerciseId` (a rest alert): open at the exercise up next.
  const { id, exerciseId: revealId } = useParams<{ id: string; exerciseId?: string }>()
  const navigate = useNavigate()
  const planned = usePlannedSession(id)

  // The sheet slides down to whatever it was opened over (History, Home,
  // Program history, …): that's the screen underneath. Opened first thing
  // (a deep link, a rest alert) there's nothing in the app to go back to, so
  // it's Home. React Router numbers its history entries in `idx`.
  // Runs once the sheet has slid away (WorkoutSheet); the view transition
  // fades the tab bar and the dock circle in.
  const goBack = () => withViewTransition(() =>
    ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0
      ? afterPopstate(() => navigate(-1))
      : navigate('/', { replace: true }))
  const {
    weekPlans, loggedSessions, addLoggedSession, updateLoggedSession, setActiveSession,
    setClock, startSetClock,
  } = useAppStore()
  const { startTimer, skipTimer, isActive: resting, label: restLabel } = useRestTimer()
  const restEndsAt = useAppStore((s) => s.timer.endTime)
  const restBarShowing = useSettingsStore((s) => s.restTimerMinimised) && resting
  const units = useUnits()
  const { syncSession, removeSession } = useAutoSync()
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [summary, setSummary] = useState<WorkoutSummary | null>(null)
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const weekPlan = weekPlans.find((p) => p.sessions.some((s) => s.id === id))
  // A session's own log (lib/weekStatus); a log with no plan (a quick log) by id.
  const existingLog = weekPlan && id
    ? logForSession(weekPlan, id, loggedSessions)
    : loggedSessions.find((ls) => ls.plannedSessionId === id)
  const [loggedSession, setLoggedSession] = useState<LoggedSession | null>(existingLog ?? null)

  // When a rest runs out on screen, only a tone plays: say it too, for screen
  // reader users with the sound off. Not when it was skipped (that's a tap).
  const [restOver, setRestOver] = useState('')
  const lastRest = useRef<{ endsAt: number; label: string } | null>(null)
  useEffect(() => {
    if (resting && restEndsAt) {
      lastRest.current = { endsAt: restEndsAt, label: restLabel }
      return
    }
    const ended = lastRest.current
    lastRest.current = null
    if (ended && Date.now() >= ended.endsAt - 1000) setRestOver(`Rest over. ${ended.label}`)
  }, [resting, restEndsAt, restLabel])

  // Keep the screen on while a workout is being logged.
  useWakeLock(!!loggedSession && loggedSession.status !== 'complete')

  useEffect(() => {
    if (id) setActiveSession(id)
    return () => setActiveSession(null)
  }, [id, setActiveSession])

  // Fetch the movement-guide library now, while there's likely signal, so the
  // help buttons work (from the service-worker cache) mid-workout.
  useEffect(() => {
    if (planned?.type !== 'cardio') warmExerciseDb()
  }, [planned?.type])

  // Opened from a rest alert: make the exercise up next the active one,
  // expand it and scroll to it, then drop it from the URL.
  const [reveal, setReveal] = useState<{ target: string; n: number }>({ target: '', n: 0 })
  const [seenReveal, setSeenReveal] = useState<string | undefined>(undefined)
  if (revealId !== seenReveal) {
    setSeenReveal(revealId)
    if (revealId) {
      setActiveExerciseId(revealId)
      setReveal((r) => ({ target: revealId, n: r.n + 1 }))
    }
  }
  useEffect(() => {
    if (!reveal.n) return
    const frame = requestAnimationFrame(() => {
      document.querySelector(`[data-exercise="${CSS.escape(reveal.target)}"]`)
        ?.scrollIntoView({ block: 'start', behavior: scrollBehavior() })
    })
    return () => cancelAnimationFrame(frame)
  }, [reveal])
  useEffect(() => {
    if (revealId && id) navigate(`/session/${id}`, { replace: true })
  }, [revealId, id, navigate])

  if (!planned && existingLog?.substitute) {
    return <LoggedActivityView log={existingLog} onBack={goBack} />
  }

  if (!planned) {
    return (
      <WorkoutSheet title="Session not found" onClose={goBack}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 pb-edge">
          <AlertTriangle size={40} className="text-[#858585]" aria-hidden />
          <p className="text-[#949494] text-center">It may belong to a different week's plan.</p>
          <Button variant="secondary" onClick={() => navigate('/', { replace: true })}>Back to home</Button>
        </div>
      </WorkoutSheet>
    )
  }

  /** The planned exercise behind a logged one (lib/activeWorkout). */
  function plannedOf(le: LoggedExercise, i: number) {
    return plannedExerciseOf(planned!, le, i)
  }

  /**
   * Sends a tap to the workout's rules (lib/activeWorkout) and applies what
   * comes back: the rest timer, the set clock and the exercise to open. The
   * caller saves the log.
   */
  function run(event: WorkoutEvent): WorkoutResult {
    const st = useAppStore.getState()
    const r = workoutStep({ planned: planned!, log: loggedSession, setClock: st.setClock, timer: st.timer, now: currentTime() }, event)
    if (r.clock === 'stop') startSetClock(null)
    if (r.rest === 'skip') skipTimer()
    else if (r.rest) startTimer(r.rest.seconds, r.rest.label, planned!.id, r.rest.nextExerciseId)
    if (r.clock === 'start') startSetClock(planned!.id)
    if (r.activeExerciseId) setActiveExerciseId(r.activeExerciseId)
    return r
  }

  /** Runs a set event and saves the new log locally and to the store (pushed when it says so). */
  function runOnLog(event: WorkoutEvent) {
    if (!loggedSession) return
    const r = run(event)
    if (!r.log) return
    setLoggedSession(r.log)
    updateLoggedSession(r.log.id, { loggedExercises: r.log.loggedExercises })
    // Pushed on each completed set so a closed/evicted browser doesn't lose
    // the workout. Fire-and-forget.
    if (r.push) syncSession(r.log.id)
  }

  function startSession(): LoggedSession | null {
    const { log } = run({ kind: 'start', id: nanoid(), weekPlanId: weekPlan?.id ?? '' })
    if (!log) return null
    addLoggedSession(log)
    setLoggedSession(log)
    return log
  }

  function updateExerciseSet(exerciseIdx: number, setIndex: number, updates: Partial<LoggedSet>) {
    runOnLog({ kind: 'edit', exerciseIdx, setIndex, updates })
  }
  function completeSet(exerciseIdx: number, setIndex: number, payload?: Partial<LoggedSet>) {
    runOnLog({ kind: 'tick', exerciseIdx, setIndex, payload })
  }
  function confirmSet(exerciseIdx: number, setIndex: number) {
    runOnLog({ kind: 'confirm', exerciseIdx, setIndex })
  }
  function uncompleteSet(exerciseIdx: number, setIndex: number) {
    runOnLog({ kind: 'untick', exerciseIdx, setIndex })
  }

  /** A new exercise order (reordering): saved locally and to the store. */
  function commitExercises(exercises: LoggedExercise[]) {
    if (!loggedSession) return
    setLoggedSession({ ...loggedSession, loggedExercises: exercises })
    updateLoggedSession(loggedSession.id, { loggedExercises: exercises })
  }

  /**
   * Auto-finish (lib/autoFinish): once the grace period after a rest is over,
   * the athlete's next tap finishes the set in progress (orange tick) and
   * starts the next rest. A tap on a tick is left to the tick itself.
   */
  function maybeAutoFinish(e: ReactPointerEvent) {
    const st = useAppStore.getState()
    const list = loggedSession?.loggedExercises
    // Beta feature, on by default; Settings → Beta features turns it off.
    if (!useSettingsStore.getState().autoSetTimer) return
    const clock = st.setClock
    if (clock?.sessionId !== planned!.id || st.timer.isActive || !list || isAlreadyComplete || reordering) return
    if (!graceOver(clock.startedAt, currentTime())) return
    const el = e.target as HTMLElement
    if (el.closest('[data-tick]')) return
    const exEl = el.closest<HTMLElement>('[data-exercise]')
    const setEl = el.closest<HTMLElement>('[data-set]')
    const touched = exEl ? list.findIndex((l) => l.plannedExerciseId === exEl.dataset.exercise) : -1
    const pick = autoFinishTarget(
      list,
      touched >= 0 ? { exerciseIdx: touched, setIndex: setEl ? Number(setEl.dataset.set) : undefined } : {},
      Math.max(0, list.findIndex((l) => l.plannedExerciseId === activeExerciseId)),
    )
    if (!pick) return
    // Timed holds have their own stopwatch.
    if (plannedOf(list[pick.exerciseIdx], pick.exerciseIdx)?.sets[pick.setIndex]?.durationSeconds != null) return
    completeSet(pick.exerciseIdx, pick.setIndex, { unconfirmed: true })
  }

  function openComplete() {
    const log = useAppStore.getState().loggedSessions.find((ls) => ls.id === loggedSession?.id) ?? loggedSession
    if (!log) return
    // Elapsed time runs from Start Session to this tap.
    setSummary(summarizeWorkout(log, useAppStore.getState().loggedSessions, new Date()))
  }

  function handleSessionSave(data: SessionCompleteData) {
    if (!loggedSession) return
    const { log } = run({
      kind: 'finish',
      // When Complete Session was tapped, so the log matches the elapsed time shown.
      finishedAt: summary?.finishedAt ?? new Date().toISOString(),
      updates: {
        status: 'complete',
        feelings: data.feelings,
        painNotes: data.painNotes || undefined,
        generalNotes: data.generalNotes || undefined,
        outcome: data.outcome,
      },
    })
    if (!log) return
    updateLoggedSession(log.id, log)
    // Push just the finished session in the background so navigation is instant.
    syncSession(log.id)
  }

  /** "Delete workout": every logged set goes, and the session is back to not started. */
  function deleteWorkout() {
    if (!loggedSession) return
    run({ kind: 'delete' })
    void removeSession(loggedSession.id)
    setLoggedSession(null)
    setSummary(null)
    setReordering(false)
  }

  /** Stops this session's set clock (never another session's). */
  function stopSetTimer() {
    if (useAppStore.getState().setClock?.sessionId === planned!.id) startSetClock(null)
  }

  function finishAndLeave() {
    setSummary(null)
    navigate('/')
  }

  /** "Did something else?" — replaces this session's log with the swap. */
  function handleQuickLog(input: QuickLogInput) {
    if (!planned) return
    const current = useAppStore.getState().loggedSessions.find((ls) => ls.plannedSessionId === planned.id)
    const log = buildQuickLog(input, { planned, weekPlanId: weekPlan?.id, existing: current })
    if (current) updateLoggedSession(current.id, log)
    else addLoggedSession(log)
    setShowQuickLog(false)
    stopSetTimer()
    syncSession(log.id)
    navigate('/')
  }

  const isAlreadyComplete = existingLog?.status === 'complete'
  // Cardio sessions only come from older plans now: they're logged by hand.
  const legacyCardio = planned.type === 'cardio'
  const logged = loggedSession?.loggedExercises ?? []
  const totalExercises = logged.length || planned.exercises?.length || 0
  const completedExercises = logged.filter((ex) => ex.sets.every((s) => s.completed || s.skipped)).length
  const progressPercent = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0
  // The set under way since the last rest: the next open one, in the exercise in progress.
  const clockHere = setClock?.sessionId === planned.id && !resting ? setClock : null
  const activeIdx = Math.max(0, logged.findIndex((l) => l.plannedExerciseId === activeExerciseId))
  const inProgress = clockHere ? nextOpenSet(logged, activeIdx) : null
  const activeId = activeExerciseId ?? logged.find((e) => e.sets.some((s) => !s.completed && !s.skipped))?.plannedExerciseId

  return (
    <WorkoutSheet
      title={localize(planned.title, units)}
      subtitle={localize(planned.focus, units)}
      onClose={goBack}
      right={<Badge label={planned.intensity} variant={planned.intensity as Intensity} />}
      below={loggedSession && !legacyCardio && (
        <div className="h-1 shrink-0">
          <progress className="meter" value={progressPercent} max={100} aria-label="Workout progress" />
        </div>
      )}
    >
      <div
        className="flex-1 overflow-y-auto overscroll-contain pb-edge"
        style={{ scrollPaddingTop: '0.75rem', scrollPaddingBottom: 'calc(var(--tabbar-clearance) + var(--kb))' }}
        onPointerDownCapture={maybeAutoFinish}
      >
        {/* Session meta */}
        <div className="px-4 py-4 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-[#949494]">
            <Clock size={13} aria-hidden />
            {formatDuration(planned.estimatedMinutes)}
          </div>
          {!!planned.exercises?.length && (
            <div className="flex items-center gap-1.5 text-xs text-[#949494]">
              <Dumbbell size={13} aria-hidden />
              {planned.exercises.length} exercises
            </div>
          )}
          {loggedSession && !legacyCardio && (
            <span className="ml-auto text-xs font-medium text-[#d97756]">
              {progressPercent}% done
            </span>
          )}
        </div>

        {/* Warmup */}
        {!legacyCardio && (!!planned.warmup || !!planned.warmupExercises?.length) && (
          <div className="mx-4 mb-4">
            <RoutineCard title="Warmup" summary={planned.warmup} items={planned.warmupExercises} />
          </div>
        )}

        {legacyCardio && !isAlreadyComplete && (
          <div className="px-4 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-blue-500/15 flex items-center justify-center">
              <Waves size={28} className="text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#f5f5f0]">Cardio session</p>
              <p className="text-sm text-[#949494] mt-1 max-w-xs">
                Coach Clawde is weights-first now, so cardio is logged by hand. Log what you did and it still counts towards your week.
              </p>
            </div>
            <Button onClick={() => setShowQuickLog(true)} size="lg">
              Log what you did
            </Button>
          </div>
        )}

        {!legacyCardio && !loggedSession && !isAlreadyComplete && (
          <div className="px-4 py-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-[#d97756]/15 flex items-center justify-center">
              <Dumbbell size={28} className="text-[#d97756]" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#f5f5f0]">Ready to train?</p>
              <p className="text-sm text-[#949494] mt-1">This will start logging your session.</p>
            </div>
            <Button onClick={startSession} size="lg">
              Start Session
            </Button>
            {!!planned.exercises?.length && (
              <Button variant="secondary" onClick={() => setPeeking((p) => !p)} aria-expanded={peeking} aria-controls="session-peek">
                {peeking ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                {peeking ? 'Hide exercises' : 'Peek'}
              </Button>
            )}
            <DidSomethingElse onClick={() => setShowQuickLog(true)} />
          </div>
        )}

        {/* Peek: the plan's exercises, read only, without starting the session. */}
        {!legacyCardio && !loggedSession && !isAlreadyComplete && peeking && (
          <PeekList id="session-peek" planned={planned} units={units} />
        )}

        {isAlreadyComplete && (
          <div className="mx-4 mb-4 flex items-center gap-3 bg-emerald-500/10 rounded-2xl px-4 py-3 border border-emerald-500/20">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-emerald-400">Session complete</p>
              {existingLog?.feelings && <p className="text-xs text-[#949494] mt-0.5">Felt {['', 'terrible', 'poor', 'ok', 'good', 'great'][existingLog.feelings]}</p>}
              {existingLog?.substitute && <p className="text-xs text-[#a8a29e] mt-0.5">Did something else: {describeSubstitute(existingLog.substitute)}</p>}
            </div>
          </div>
        )}

        {/* Exercises, in the athlete's order */}
        {!legacyCardio && logged.length > 0 && (
          <div className="px-4 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium">Exercises</h2>
              {logged.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReordering((r) => !r)}
                  className={`relative hit-target flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-colors ${
                    reordering ? 'bg-accent-fill text-white' : 'bg-[#1a1a1a] text-[#a8a29e] hover:text-[#f5f5f0]'
                  }`}
                >
                  {reordering ? <Check size={14} aria-hidden /> : <ArrowUpDown size={14} aria-hidden />}
                  {reordering ? 'Done' : 'Reorder'}
                </button>
              )}
            </div>

            {reordering ? (
              <ReorderList
                items={logged.map((le) => ({
                  id: le.plannedExerciseId,
                  label: le.name,
                  sub: `${le.sets.filter((s) => s.completed).length}/${le.sets.length} sets`,
                }))}
                onChange={(ids) => commitExercises(reorderByIds(logged, ids))}
              />
            ) : (
              logged.map((le, i) => {
                const ex = plannedOf(le, i)
                if (!ex) return null
                return (
                  <ExerciseTile
                    key={le.plannedExerciseId}
                    planned={ex}
                    logged={le}
                    onUpdateSet={(setIdx, updates) => updateExerciseSet(i, setIdx, updates)}
                    onSetComplete={(setIdx, payload) => completeSet(i, setIdx, payload)}
                    onSetUncomplete={(setIdx) => uncompleteSet(i, setIdx)}
                    isActive={le.plannedExerciseId === activeId}
                    revealNonce={reveal.target === le.plannedExerciseId ? reveal.n : undefined}
                    onActivate={() => setActiveExerciseId(le.plannedExerciseId)}
                    onSetConfirm={(setIdx) => confirmSet(i, setIdx)}
                    timedSet={inProgress?.exerciseIdx === i && clockHere ? { setIndex: inProgress.setIndex, startedAt: clockHere.startedAt } : undefined}
                  />
                )
              })
            )}
          </div>
        )}

        {/* Cooldown */}
        {!legacyCardio && (!!planned.cooldown || !!planned.cooldownExercises?.length) && (loggedSession || peeking) && (
          <div className="mx-4 mt-4">
            <RoutineCard title="Cooldown" summary={planned.cooldown} items={planned.cooldownExercises} />
          </div>
        )}

        {/* Finishing lives at the end of the workout, not pinned over it:
            the screen's bottom stays free for the minimised rest timer. */}
        {!legacyCardio && loggedSession && !isAlreadyComplete && (
          <div className="px-4 mt-6 flex flex-col items-center gap-3">
            <Button onClick={openComplete} fullWidth size="lg">
              <CheckCircle2 size={18} aria-hidden />
              Complete Session
            </Button>
            <DidSomethingElse onClick={() => setShowQuickLog(true)} />
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="-mt-2 flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 py-2 px-3 rounded-xl"
            >
              <RotateCcw size={14} aria-hidden />
              Reset session
            </button>
          </div>
        )}

        {/* Room to scroll the end of the session clear of the minimised rest
            timer, which docks where the tab bar sits on other screens. */}
        {restBarShowing && <div aria-hidden className="h-[calc(var(--tabbar-h)+var(--tabbar-gap))]" />}
        {/* The keyboard covers the sheet's end: room to scroll a field above it. */}
        <div aria-hidden className="h-(--kb)" />
      </div>

      {/* Rest timer overlay: squeeze the bar left to close the sheet. */}
      <RestTimerOverlay />
      <p role="status" className="sr-only">{restOver}</p>

      {/* Workout complete: full screen, the breakdown, sharing and how it felt */}
      {summary && (
        <WorkoutComplete
          summary={summary}
          onSave={handleSessionSave}
          onFinish={finishAndLeave}
          onCancel={() => setSummary(null)}
          onDelete={deleteWorkout}
        />
      )}

      {showQuickLog && (
        <QuickLogSheet
          plannedTitle={planned.title}
          defaultMinutes={planned.estimatedMinutes || 45}
          onSave={handleQuickLog}
          onClose={() => setShowQuickLog(false)}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          icon={<RotateCcw size={18} aria-hidden />}
          title="Reset this session?"
          confirmLabel="Reset"
          danger
          onConfirm={() => { setConfirmReset(false); deleteWorkout() }}
          onCancel={() => setConfirmReset(false)}
        >
          Every set you’ve logged in {localize(planned.title, units)} is cleared, and the session goes back to not started.
        </ConfirmDialog>
      )}
    </WorkoutSheet>
  )
}

/** Peek: the planned exercises and their sets, to look over before starting. */
function PeekList({ id, planned, units }: { id: string; planned: PlannedSession; units: Units }) {
  const [guide, setGuide] = useState<PlannedExercise | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  // Bring the list's start into view: it opens below the fold.
  useEffect(() => {
    heading.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
  }, [])
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="px-4 flex flex-col gap-3 fade-in">
      <h2 ref={heading} id={`${id}-title`} className="px-1 text-xs text-[#858585] uppercase tracking-widest font-medium">Exercises</h2>
      {(planned.exercises ?? []).map((ex) => (
        <div key={ex.id} className="rounded-[2rem] border border-[#2a2a2a] bg-[#161616] px-4 py-3 [--nest-radius:2rem] [--nest-inset:1rem]">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 min-w-0 font-semibold text-sm text-[#f5f5f0] leading-tight">{ex.name}</h3>
            <button
              type="button"
              onClick={() => setGuide(ex)}
              aria-label={`How to do ${ex.name}`}
              className="relative hit-target -mr-2 w-9 h-9 rounded-xl flex items-center justify-center text-[#949494] hover:text-[#d97756] hover:bg-[#d97756]/10 transition-colors shrink-0"
            >
              <CircleQuestionMark size={18} aria-hidden />
            </button>
          </div>
          {ex.coachNotes && (
            <div className="flex items-start gap-2 bg-[#d97756]/8 rounded-nested px-3 py-2.5 mt-2">
              <Info size={13} className="text-[#d97756] mt-0.5 shrink-0" aria-hidden />
              <p className="text-xs text-[#d97756]/90">{localize(ex.coachNotes, units)}</p>
            </div>
          )}
          <ol className="mt-2 flex flex-col gap-1">
            {ex.sets.map((set, i) => (
              <li key={i} className="flex items-baseline gap-3 text-xs">
                <span className="w-10 shrink-0 text-[#858585]">Set {i + 1}</span>
                <span className="flex-1 min-w-0 text-[#a8a29e] tabular-nums">
                  {[
                    set.durationSeconds != null ? `${set.durationSeconds}s hold` : `${set.reps} reps`,
                    set.durationSeconds == null && set.suggestedWeightKg ? `${toWeight(set.suggestedWeightKg, units.weight)} ${units.weight}` : null,
                    set.rpe ? `RPE ${set.rpe}` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
                <span className="shrink-0 text-[#858585]">rest {formatRestTime(set.restSeconds)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {guide && <MovementGuide name={guide.name} notes={guide.coachNotes} onClose={() => setGuide(null)} />}
    </section>
  )
}

function DidSomethingElse({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-[#949494] hover:text-[#a8a29e] py-2 px-3 rounded-xl"
    >
      <Shuffle size={14} aria-hidden />
      Did something else?
    </button>
  )
}

/** A session logged with no plan behind it ("Log a session"). */
function LoggedActivityView({ log, onBack }: { log: LoggedSession; onBack: () => void }) {
  return (
    <WorkoutSheet title={log.title} subtitle={formatSessionDate(log.date)} onClose={onBack}>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-edge flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-emerald-500/10 rounded-2xl px-4 py-3 border border-emerald-500/20">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">Logged</p>
            <p className="text-xs text-[#a8a29e] mt-0.5">
              {describeSubstitute(log.substitute!)}{log.rpe ? ` · effort ${log.rpe}/10` : ''}
            </p>
          </div>
        </div>
        {log.generalNotes && <p className="text-sm text-[#a8a29e] px-1">{log.generalNotes}</p>}
      </div>
    </WorkoutSheet>
  )
}
