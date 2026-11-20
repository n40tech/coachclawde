import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { wantsCheckIns } from '../lib/checkInTriggers'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/shared/Badge'
import { Button } from '../components/shared/Button'
import { ExerciseTile } from '../components/session/ExerciseTile'
import { ReorderList } from '../components/session/ReorderList'
import { RestTimerOverlay } from '../components/session/RestTimer'
import { afterPopstate, withViewTransition } from '../lib/viewTransition'
import { WorkoutComplete, type SessionCompleteData } from '../components/session/WorkoutComplete'
import { QuickLogSheet } from '../components/session/QuickLogSheet'
import { useWakeLock } from '../hooks/useWakeLock'
import { buildQuickLog, type QuickLogInput } from '../lib/quickLog'
import { describeSubstitute } from '../lib/historySummary'
import { formatSessionDate } from '../lib/dateUtils'
import { RoutineCard } from '../components/session/RoutineCard'
import { useRestTimer } from '../hooks/useRestTimer'
import { useAutoSync } from '../hooks/useAutoSync'
import { formatDuration } from '../lib/dateUtils'
import { warmExerciseDb } from '../lib/exerciseGuide'
import { nextOpenSet, promoteStarted, reorderByIds } from '../lib/exerciseOrder'
import { autoFinishTarget, graceOver } from '../lib/autoFinish'
import { summarizeWorkout, type WorkoutSummary } from '../lib/workoutSummary'
import type { Intensity, LoggedExercise, LoggedSession, PlannedExercise, PlannedSession } from '../types'
import { Dumbbell, Waves, Clock, CheckCircle2, AlertTriangle, Shuffle, ArrowUpDown, Check } from 'lucide-react'
import { nanoid } from '../lib/nanoid'
import { useSettingsStore, useUnits } from '../store/useSettingsStore'
import { localize } from '../lib/units'

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
  const location = useLocation()
  const planned = usePlannedSession(id)

  // Return to wherever we came from (History, Home, Program history, …) instead
  // of a fixed route. `location.key === 'default'` means this is the first entry
  // in the history stack (e.g. a deep link), so fall back to Home.
  // Both morph the workout's timer bar into the Home dock (lib/viewTransition).
  const goBack = () => withViewTransition(() =>
    location.key !== 'default' ? afterPopstate(() => navigate(-1)) : navigate('/'))
  const leaveToHome = () => withViewTransition(() => navigate('/'))
  const {
    weekPlans, loggedSessions, addLoggedSession, updateLoggedSession, setActiveSession, profile, dismissCheckIn,
    setClock, startSetClock,
  } = useAppStore()
  const { startTimer, skipTimer, isActive: resting } = useRestTimer()
  const restBarShowing = useSettingsStore((s) => s.restTimerMinimised) && resting
  const units = useUnits()
  const { syncSession, removeSession } = useAutoSync()
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [summary, setSummary] = useState<WorkoutSummary | null>(null)
  const [showQuickLog, setShowQuickLog] = useState(false)

  const existingLog = loggedSessions.find((ls) => ls.plannedSessionId === id)
  const [loggedSession, setLoggedSession] = useState<LoggedSession | null>(existingLog ?? null)

  const weekPlan = weekPlans.find((p) => p.sessions.some((s) => s.id === id))

  // Determine if this is the last session of the week
  const isLastSession = useMemo(() => {
    if (!weekPlan || !id) return false
    const completedIds = loggedSessions.filter((ls) => ls.status === 'complete').map((ls) => ls.plannedSessionId)
    const remaining = weekPlan.sessions.filter((s) => s.id !== id && !completedIds.includes(s.id))
    // No invitation for athletes who turned check-ins off (or just track).
    return remaining.length === 0 && wantsCheckIns(profile)
  }, [weekPlan, id, loggedSessions, profile])

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
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
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
      <div className="flex flex-col items-center justify-center min-h-svh gap-4 px-4">
        <AlertTriangle size={40} className="text-[#4a4a4a]" />
        <p className="text-[#6a6a6a] text-center">Session not found. It may belong to a different week's plan.</p>
        <Button variant="secondary" onClick={() => navigate('/')}>Back to home</Button>
      </div>
    )
  }

  const plannedById = new Map((planned.exercises ?? []).map((e) => [e.id, e]))
  /** The planned exercise behind a logged one (by id; older logs by name, then position). */
  function plannedOf(le: LoggedExercise, i: number): PlannedExercise | undefined {
    return plannedById.get(le.plannedExerciseId)
      ?? planned!.exercises?.find((e) => e.name === le.name)
      ?? planned!.exercises?.[i]
  }

  // Initialize log if not started yet
  function startSession(): LoggedSession | null {
    if (!planned) return null
    const initial: LoggedSession = {
      id: nanoid(),
      plannedSessionId: planned.id,
      weekPlanId: weekPlan?.id ?? '',
      date: planned.date,
      type: planned.type,
      title: planned.title,
      focus: planned.focus,
      startedAt: new Date().toISOString(),
      status: 'in-progress',
      loggedExercises: planned.exercises?.map((ex) => ({
        plannedExerciseId: ex.id,
        name: ex.name,
        sets: ex.sets.map((_, i) => ({
          setIndex: i,
          targetReps: ex.sets[i].reps,
          completed: false,
          skipped: false,
        })),
      })),
    }
    addLoggedSession(initial)
    setLoggedSession(initial)
    return initial
  }

  /** Saves a new exercise list locally and to the store. */
  function commitExercises(exercises: LoggedExercise[]) {
    if (!loggedSession) return
    setLoggedSession({ ...loggedSession, loggedExercises: exercises })
    updateLoggedSession(loggedSession.id, { loggedExercises: exercises })
  }

  function withSet(list: LoggedExercise[], exerciseId: string, setIndex: number, updates: Partial<LoggedExercise['sets'][0]>): LoggedExercise[] {
    return list.map((ex) =>
      ex.plannedExerciseId !== exerciseId ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, ...updates } : s)) }
    )
  }

  function updateExerciseSet(exerciseIdx: number, setIndex: number, updates: Partial<LoggedExercise['sets'][0]>) {
    const list = loggedSession?.loggedExercises
    if (!list?.[exerciseIdx]) return
    commitExercises(withSet(list, list[exerciseIdx].plannedExerciseId, setIndex, updates))
  }

  function completeSet(exerciseIdx: number, setIndex: number, payload?: Partial<LoggedExercise['sets'][0]>) {
    const list = loggedSession?.loggedExercises
    const done = list?.[exerciseIdx]
    if (!loggedSession || !list || !done) return
    const exerciseId = done.plannedExerciseId

    // The set clock stops on the tick: how long since the last rest ended.
    const clock = useAppStore.getState().setClock
    let workSeconds: number | undefined
    if (clock?.sessionId === planned!.id) {
      const s = Math.round((Date.now() - clock.startedAt) / 1000)
      if (s >= 2) workSeconds = s
      startSetClock(null)
    }

    // Starting an exercise ahead of others moves it up the list, so the order
    // follows what's actually being done.
    const reordered = promoteStarted(list, exerciseIdx)
    const next = withSet(reordered, exerciseId, setIndex, { completed: true, ...(workSeconds ? { workSeconds } : {}), ...payload })
    commitExercises(next)
    setActiveExerciseId(exerciseId)
    // Persist progress to the backend on each completed set so a closed/evicted
    // browser doesn't lose the workout. We push only this one session (not the
    // whole table) and only on completion (not per keystroke) to keep writes
    // tiny — see useAutoSync. Fire-and-forget.
    syncSession(loggedSession.id)
    // Re-ticking a corrected set on an already-finished session shouldn't
    // kick off a rest timer.
    if (existingLog?.status === 'complete') return
    const exercise = plannedOf(done, exerciseIdx)
    const restSeconds = exercise?.sets[setIndex]?.restSeconds ?? 90
    if (restSeconds > 0) {
      // On the final set of an exercise, point the rest timer at what's coming
      // up next (in the athlete's order) instead of the set just finished.
      const isLastSet = setIndex === done.sets.length - 1
      const at = next.findIndex((e) => e.plannedExerciseId === exerciseId)
      const upNext = next.slice(at + 1).find((e) => e.sets.some((s) => !s.completed && !s.skipped))
      const label = isLastSet
        ? upNext
          ? `Up next: ${upNext.name}`
          : 'Last set — finish up'
        : `Up next: ${done.name} · set ${setIndex + 2}`
      // The alert opens the workout at what's next: this exercise, or the next one after its last set.
      const nextId = isLastSet ? upNext?.plannedExerciseId : exerciseId
      startTimer(restSeconds, label, planned!.id, nextId)
    } else {
      startSetClock(planned!.id)
    }
  }

  /** Taps the orange tick of an auto-finished set: it's confirmed as logged. */
  function confirmSet(exerciseIdx: number, setIndex: number) {
    if (!loggedSession) return
    updateExerciseSet(exerciseIdx, setIndex, { unconfirmed: undefined })
    syncSession(loggedSession.id)
  }

  /** Reopens a completed set so a mistyped rep count or weight can be fixed. */
  function uncompleteSet(exerciseIdx: number, setIndex: number) {
    if (!loggedSession) return
    updateExerciseSet(exerciseIdx, setIndex, { completed: false, actualSeconds: undefined })
    syncSession(loggedSession.id)
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
    if (!graceOver(clock.startedAt, Date.now())) return
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
    // Saving confirms any auto-finished sets as logged.
    const confirmed = loggedSession.loggedExercises?.map((ex) => ({
      ...ex,
      sets: ex.sets.map((set) => (set.unconfirmed ? { ...set, unconfirmed: undefined } : set)),
    }))
    const updates: Partial<LoggedSession> = {
      status: 'complete',
      // When Complete Session was tapped, so the log matches the elapsed time shown.
      completedAt: summary?.finishedAt ?? new Date().toISOString(),
      ...(confirmed ? { loggedExercises: confirmed } : {}),
      feelings: data.feelings,
      painNotes: data.painNotes || undefined,
      generalNotes: data.generalNotes || undefined,
      outcome: data.outcome,
    }
    updateLoggedSession(loggedSession.id, updates)
    stopSetTimer()
    // Push just the finished session in the background — don't await so
    // navigation is instant.
    syncSession(loggedSession.id)
  }

  /** "Delete workout": every logged set goes, and the session is back to not started. */
  function deleteWorkout() {
    if (!loggedSession) return
    stopSetTimer()
    if (useAppStore.getState().timer.sessionId === planned!.id) skipTimer()
    startSetClock(null)
    void removeSession(loggedSession.id)
    setLoggedSession(null)
    setSummary(null)
    setReordering(false)
  }

  function stopSetTimer() {
    if (useAppStore.getState().setClock?.sessionId === planned!.id) startSetClock(null)
  }

  // The week-done invitation opens a check-in, or snoozes until the next trigger.
  const reviewWeek = weekPlan?.weekStartDate ?? ''
  function openCheckIn() {
    setSummary(null)
    navigate(`/check-in?trigger=week-complete&week=${reviewWeek}`, { replace: true })
  }
  function declineCheckIn() {
    dismissCheckIn(`week:${reviewWeek}`)
    finishAndLeave()
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
    <div className="flex flex-col min-h-svh bg-[#0a0a0a]">
      <PageHeader
        title={localize(planned.title, units)}
        subtitle={localize(planned.focus, units)}
        onBack={goBack}
        right={<Badge label={planned.intensity} variant={planned.intensity as Intensity} />}
      />

      {/* Progress bar */}
      {loggedSession && !legacyCardio && (
        <div className="h-1 bg-[#1a1a1a]">
          <div
            className="h-full bg-[#d97756] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-edge" onPointerDownCapture={maybeAutoFinish}>
        {/* Session meta */}
        <div className="px-4 py-4 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-[#6a6a6a]">
            <Clock size={13} />
            {formatDuration(planned.estimatedMinutes)}
          </div>
          {!!planned.exercises?.length && (
            <div className="flex items-center gap-1.5 text-xs text-[#6a6a6a]">
              <Dumbbell size={13} />
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
              <p className="text-sm text-[#6a6a6a] mt-1 max-w-xs">
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
              <p className="text-sm text-[#6a6a6a] mt-1">This will start logging your session.</p>
            </div>
            <Button onClick={startSession} size="lg">
              Start Session
            </Button>
            <DidSomethingElse onClick={() => setShowQuickLog(true)} />
          </div>
        )}

        {isAlreadyComplete && (
          <div className="mx-4 mb-4 flex items-center gap-3 bg-emerald-500/10 rounded-2xl px-4 py-3 border border-emerald-500/20">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-400">Session complete</p>
              {existingLog?.feelings && <p className="text-xs text-[#6a6a6a] mt-0.5">Felt {['', 'terrible', 'poor', 'ok', 'good', 'great'][existingLog.feelings]}</p>}
              {existingLog?.substitute && <p className="text-xs text-[#a8a29e] mt-0.5">Did something else: {describeSubstitute(existingLog.substitute)}</p>}
            </div>
          </div>
        )}

        {/* Exercises, in the athlete's order */}
        {!legacyCardio && logged.length > 0 && (
          <div className="px-4 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-[#4a4a4a] uppercase tracking-widest font-medium">Exercises</p>
              {logged.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReordering((r) => !r)}
                  aria-pressed={reordering}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-colors ${
                    reordering ? 'bg-[#d97756] text-white' : 'bg-[#1a1a1a] text-[#a8a29e] hover:text-[#f5f5f0]'
                  }`}
                >
                  {reordering ? <Check size={14} /> : <ArrowUpDown size={14} />}
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
        {!legacyCardio && (!!planned.cooldown || !!planned.cooldownExercises?.length) && loggedSession && (
          <div className="mx-4 mt-4">
            <RoutineCard title="Cooldown" summary={planned.cooldown} items={planned.cooldownExercises} />
          </div>
        )}

        {/* Finishing lives at the end of the workout, not pinned over it:
            the screen's bottom stays free for the minimised rest timer. */}
        {!legacyCardio && loggedSession && !isAlreadyComplete && (
          <div className="px-4 mt-6 flex flex-col items-center gap-3">
            <Button onClick={openComplete} fullWidth size="lg">
              <CheckCircle2 size={18} />
              Complete Session
            </Button>
            <DidSomethingElse onClick={() => setShowQuickLog(true)} />
          </div>
        )}

        {/* Room to scroll the end of the session clear of the minimised rest
            timer, which docks where the tab bar sits on other screens. */}
        {restBarShowing && <div aria-hidden className="h-[calc(var(--tabbar-h)+var(--tabbar-gap))]" />}
      </div>

      {/* Rest timer overlay */}
      <RestTimerOverlay onFlickAway={leaveToHome} />

      {/* Workout complete: full screen, the breakdown, sharing and how it felt */}
      {summary && (
        <WorkoutComplete
          summary={summary}
          isLastSessionOfWeek={isLastSession}
          onSave={handleSessionSave}
          onCheckIn={openCheckIn}
          onNotNow={declineCheckIn}
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
    </div>
  )
}

function DidSomethingElse({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-[#6a6a6a] hover:text-[#a8a29e] py-2 px-3 rounded-xl"
    >
      <Shuffle size={14} />
      Did something else?
    </button>
  )
}

/** A session logged with no plan behind it ("Log a session"). */
function LoggedActivityView({ log, onBack }: { log: LoggedSession; onBack: () => void }) {
  return (
    <div className="flex flex-col min-h-svh bg-[#0a0a0a]">
      <PageHeader title={log.title} subtitle={formatSessionDate(log.date)} onBack={onBack} />
      <div className="px-4 py-4 flex flex-col gap-3">
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
    </div>
  )
}
