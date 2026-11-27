import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { toLocalISODate } from '../lib/weekUtils'
import { Card, CardSection } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { ClawdeMark } from '../components/shared/ClawdeMark'
import { BetaFeedbackTile } from '../components/shared/BetaFeedbackTile'
import { BETA_FEEDBACK_URL } from '../lib/betaFeedback'
import { useScrollDirection } from '../hooks/useScrollDirection'
import { getProgramProgress, nextBlockProgram } from '../lib/programProgress'
import { weekStatus } from '../lib/weekStatus'
import { Calendar, ChevronRight, CheckCircle, CalendarPlus, Trophy, Sparkles, Plus } from 'lucide-react'
import { QuickLogSheet } from '../components/session/QuickLogSheet'
import { buildQuickLog, type QuickLogInput } from '../lib/quickLog'
import { useAutoSync } from '../hooks/useAutoSync'
import { getWeekday, formatDuration } from '../lib/dateUtils'
import { format } from 'date-fns'
import type { Intensity, LoggedSession, PlannedSession } from '../types'
import { SessionIcon } from '../components/shared/SessionIcon'
import { useCurrentWorkout, useNow } from '../hooks/useWorkoutDock'
import { useUnits } from '../store/useSettingsStore'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { localize } from '../lib/units'

export function Home() {
  const navigate = useNavigate()
  const { getCurrentWeekPlan, loggedSessions, profile, addLoggedSession, setProfile } = useAppStore()
  const tracker = profile.goal?.tracker
  const plan = getCurrentWeekPlan()
  const { bump } = useScrollDirection()
  const { sync, syncSession } = useAutoSync()
  // Minutes are all Home shows, so a slow tick is enough.
  const now = useNow(true, 15_000)
  const current = useCurrentWorkout(now)
  const [showLog, setShowLog] = useState(false)
  useDocumentTitle('Home')

  function startNextBlock() {
    const program = nextBlockProgram(profile)
    if (!program) return
    setProfile({ program })
    void sync('profile')
  }

  function handleQuickLog(input: QuickLogInput) {
    const log = buildQuickLog(input)
    addLoggedSession(log)
    setShowLog(false)
    void syncSession(log.id)
  }

  const today = toLocalISODate(new Date())

  // Greet by first name, but degrade gracefully if no name is set so the
  // header never shows a dangling "Afternoon, ".
  const firstName = (profile.name ?? '').trim().split(' ')[0]

  // Completed sessions live in History only. Home shows what's still to do:
  // the next workout, the rest of the week ahead, and anything missed.
  // The workout under way gets its own card at the top, not a second one below.
  const week = plan ? weekStatus(plan, loggedSessions) : null
  const pending = (week?.sessions ?? [])
    .filter((x) => (x.status === 'to-do' || x.status === 'in-progress') && x.session.id !== current?.plannedSessionId)
    .map((x) => x.session)
  const upcoming = pending
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const missed = pending
    .filter((s) => s.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))

  const nextSession = upcoming[0]
  const futureSessions = upcoming.slice(1)

  const weekDone = plan != null && pending.length === 0 && !current
  const program = getProgramProgress(profile)

  return (
    <div className="flex flex-col pb-tabbar min-h-svh bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 pt-safe">
        {/* Top bar with plan action */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setShowLog(true)}
            className="relative hit-target h-9 px-3 flex items-center gap-1.5 rounded-2xl bg-[#1a1a1a] text-[#949494] hover:text-[#f5f5f0] transition-colors text-xs font-medium"
          >
            <Plus size={16} aria-hidden />
            Log a session
          </button>
          <Link
            to="/plan"
            aria-label="Plan your week"
            className="relative hit-target w-9 h-9 flex items-center justify-center rounded-2xl bg-[#1a1a1a] text-[#949494] hover:text-[#f5f5f0] transition-colors"
          >
            <CalendarPlus size={18} aria-hidden />
          </Link>
        </div>

        {/* Centered greeting hero — Clawde, seamless on the background */}
        <div className="flex flex-col items-center text-center pt-8 short:pt-5 pb-6">
          <div className="relative mb-3">
            <div
              className="absolute inset-0 -m-3 rounded-full bg-[#d97756]/15 blur-2xl"
              aria-hidden
            />
            <ClawdeMark size={68} cheer={bump} sweat={bump} className="relative" />
          </div>
          <p className="text-xs text-[#858585] uppercase tracking-widest font-medium">
            {format(new Date(), 'EEEE, dd MMM')}
          </p>
          <h1 className="text-2xl font-bold text-[#f5f5f0] mt-1">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4">
        {current && <CurrentWorkoutCard session={current} now={now} />}

        {program.isComplete && (
          <ProgramCompleteBanner length={program.length} onRestart={startNextBlock} />
        )}

        {!plan ? (
          tracker?.intake === 'log'
            ? <TrackerLogCTA onLog={() => setShowLog(true)} onConvert={() => navigate('/plan')} />
            : <NoPlanCTA tracker={!!tracker} onPlan={() => navigate('/plan')} />
        ) : weekDone ? (
          <WeekCompleteBanner onPlan={() => navigate('/plan')} />
        ) : (
          <>
            {nextSession && (
              <NextSessionCard session={nextSession} />
            )}

            {futureSessions.length > 0 && (
              <div>
                <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium mb-3 px-1">
                  This week
                </h2>
                <div className="grid grid-cols-1 gap-2 @3xl/app:grid-cols-2">
                  {futureSessions.map((s) => (
                    <UpcomingTile key={s.id} session={s} />
                  ))}
                </div>
              </div>
            )}

            {missed.length > 0 && (
              <div>
                <h2 className="text-xs text-amber-500/80 uppercase tracking-widest font-medium mb-3 px-1">
                  Missed
                </h2>
                <div className="grid grid-cols-1 gap-2 @3xl/app:grid-cols-2">
                  {missed.map((s) => (
                    <UpcomingTile key={s.id} session={s} missed />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Week stats pill */}
        {week && (
          <div className="flex items-center justify-between bg-[#161616] rounded-2xl px-4 py-3 border border-[#2a2a2a]">
            <span className="text-sm text-[#949494]">Week {program.week} of {program.length}</span>
            <span className="text-sm font-medium text-[#f5f5f0]">
              {week.done}/{week.total} sessions
            </span>
          </div>
        )}

        {BETA_FEEDBACK_URL && (
          <BetaFeedbackTile />
        )}
      </div>

      {showLog && <QuickLogSheet onSave={handleQuickLog} onClose={() => setShowLog(false)} />}
    </div>
  )
}

/** Tracker athletes who log as they go: logging is the main action. */
function TrackerLogCTA({ onLog, onConvert }: { onLog: () => void; onConvert: () => void }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#d97756]/10 to-[#1a1a1a] border border-[#d97756]/20 p-6 flex flex-col items-center text-center gap-4">
      <div>
        <h2 className="text-xl font-bold text-[#f5f5f0]">Your plan, your way</h2>
        <p className="text-sm text-[#949494] mt-1 leading-relaxed">Log each session as you do it. I'll keep score and send a short weekly summary.</p>
      </div>
      <Button onClick={onLog} size="lg" fullWidth><Plus size={18} /> Log a session</Button>
      <button onClick={onConvert} className="text-xs text-[#949494] hover:text-[#a8a29e]">or paste your plan and convert it</button>
    </div>
  )
}

function NoPlanCTA({ onPlan, tracker }: { onPlan: () => void; tracker?: boolean }) {
  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-[#d97756]/10 to-[#1a1a1a] border border-[#d97756]/20 p-6 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-[#d97756]/15 flex items-center justify-center">
          <Calendar size={28} className="text-[#d97756]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#f5f5f0]">{tracker ? 'Bring in your plan' : 'Plan Your Week'}</h2>
          <p className="text-sm text-[#949494] mt-1 leading-relaxed">
            {tracker
              ? 'Paste this week of your plan and Clawde converts it for the app, so you can log it here.'
              : 'Select your available training days, add any notes, and let Clawde create your personalised workout plan.'}
          </p>
        </div>
        <Button onClick={onPlan} size="lg" fullWidth>
          <Calendar size={18} />
          {tracker ? 'Convert my plan' : 'Plan This Week'}
        </Button>
      </div>
    </div>
  )
}

function WeekCompleteBanner({ onPlan }: { onPlan: () => void }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-[#1a1a1a] border border-emerald-500/20 p-6 flex flex-col items-center text-center gap-4">
      <div className="w-14 h-14 rounded-3xl bg-emerald-500/15 flex items-center justify-center">
        <CheckCircle size={28} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#f5f5f0]">Week complete!</h2>
        <p className="text-sm text-[#949494] mt-1">All sessions done. Plan your next week to keep the momentum.</p>
      </div>
      <Button onClick={onPlan} size="lg" fullWidth>
        <Calendar size={18} />
        Plan Next Week
      </Button>
    </div>
  )
}

function ProgramCompleteBanner({ length, onRestart }: { length: number; onRestart: () => void }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#d97756]/15 to-[#1a1a1a] border border-[#d97756]/30 p-6 flex flex-col items-center text-center gap-4">
      <div className="w-14 h-14 rounded-3xl bg-[#d97756]/15 flex items-center justify-center">
        <Trophy size={28} className="text-[#d97756]" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#f5f5f0]">Program complete! 🎉</h2>
        <p className="text-sm text-[#949494] mt-1 leading-relaxed">
          You've finished your {length}-week block. Start the next one with the same goal
          and setup: no need to set everything up again.
        </p>
      </div>
      <Button onClick={onRestart} size="lg" fullWidth>
        <Sparkles size={18} />
        Start the next block
      </Button>
    </div>
  )
}

/** The workout the athlete left mid-way: one tap back into it. */
function CurrentWorkoutCard({ session, now }: { session: LoggedSession; now: number }) {
  const units = useUnits()
  const minutes = Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 60000))
  return (
    <Card accent glow to={`/session/${session.plannedSessionId}`}>
      <div className="bg-gradient-to-br from-[#d97756]/8 to-transparent">
        <CardSection className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent-fill flex items-center justify-center shrink-0">
            <SessionIcon type={session.type} size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#d97756] uppercase tracking-widest">
              In progress · {minutes < 1 ? 'just started' : `${formatDuration(minutes)} in`}
            </p>
            <h2 className="text-lg font-bold text-[#f5f5f0] leading-tight mt-0.5 truncate">{localize(session.title, units)}</h2>
            <p className="text-sm text-[#949494] mt-0.5">Pick up where you left off</p>
          </div>
          <ChevronRight size={18} className="text-[#d97756] shrink-0" aria-hidden />
        </CardSection>
      </div>
    </Card>
  )
}

function NextSessionCard({ session }: { session: PlannedSession }) {
  const units = useUnits()
  return (
    <Card accent glow to={`/session/${session.id}`}>
      <div className="bg-gradient-to-br from-[#d97756]/8 to-transparent">
        <CardSection>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#d97756]/15 flex items-center justify-center">
                <SessionIcon type={session.type} size={16} className="text-[#d97756]" />
              </div>
              <span className="text-sm font-medium text-[#d97756]">
                {getWeekday(session.date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge label={session.intensity} variant={session.intensity as Intensity} />
              <ChevronRight size={16} className="text-[#858585]" aria-hidden />
            </div>
          </div>

          <h2 className="text-xl font-bold text-[#f5f5f0] leading-tight">{localize(session.title, units)}</h2>
          <p className="text-sm text-[#949494] mt-1">{localize(session.focus, units)}</p>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#2a2a2a]">
            <StatPill label={formatDuration(session.estimatedMinutes)} icon="⏱" />
            {session.exercises && <StatPill label={`${session.exercises.length} exercises`} icon="💪" />}
          </div>
        </CardSection>
      </div>
    </Card>
  )
}

function UpcomingTile({ session, missed = false }: { session: PlannedSession; missed?: boolean }) {
  const units = useUnits()
  return (
    <Card to={`/session/${session.id}`}>
      <CardSection className="flex items-center gap-3 py-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
          missed ? 'bg-amber-500/15' : 'bg-[#2a2a2a]'
        }`}>
          <SessionIcon type={session.type} size={18} className={missed ? 'text-amber-500' : 'text-[#949494]'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#f5f5f0] truncate">{localize(session.title, units)}</p>
          <p className="text-xs text-[#949494] mt-0.5">
            {missed && <span className="text-amber-500/80">Missed · </span>}
            {getWeekday(session.date)} · {formatDuration(session.estimatedMinutes)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge label={session.intensity} variant={session.intensity as Intensity} />
          <ChevronRight size={14} className="text-[#858585]" aria-hidden />
        </div>
      </CardSection>
    </Card>
  )
}

function StatPill({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm" aria-hidden>{icon}</span>
      <span className="text-xs text-[#949494]">{label}</span>
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}
