import { Link } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useUnits } from '../store/useSettingsStore'
import { toWeight, type WeightUnit } from '../lib/units'
import { HeaderIconLink, PageHeader } from '../components/layout/PageHeader'
import { Card, CardSection } from '../components/shared/Card'
import { SyncIndicator } from '../components/shared/SyncIndicator'
import { WeightPRCard } from '../components/progress/PRCards'
import { computeWeightPRs } from '../lib/prComputations'
import { getProgramProgress } from '../lib/programProgress'
import { Dumbbell, Layers, TrendingUp, Trophy, Zap, Settings, ChevronRight } from 'lucide-react'
import { parseISO, isSameWeek } from 'date-fns'
import { getMonday, addDays, toLocalISODate, WEEK_DAYS_MON } from '../lib/weekUtils'
import type { LoggedSession } from '../types'

export function Progress() {
  const { loggedSessions, profile } = useAppStore()
  const weightUnit = useUnits().weight

  const completed = loggedSessions.filter((s) => s.status === 'complete')
  const weightSessions = completed.filter((s) => s.type === 'weights')

  // This week — bucket by when the session was actually completed (falling back
  // to the planned date for older logs), so a session done this week counts even
  // if it was planned for a different week.
  const thisWeekSessions = completed.filter((s) =>
    isSameWeek(parseISO(s.completedAt ?? s.date), new Date(), { weekStartsOn: 1 })
  )

  // All time totals
  const totalVolume = weightSessions.reduce((total, s) => {
    return total + (s.loggedExercises?.reduce((exTotal, ex) => {
      return exTotal + ex.sets.filter((set) => set.completed).reduce((setTotal, set) => {
        return setTotal + ((set.weightKg ?? 0) * (set.actualReps ?? 0))
      }, 0)
    }, 0) ?? 0)
  }, 0)

  const avgFeeling = completed.length > 0
    ? (completed.reduce((sum, s) => sum + (s.feelings ?? 3), 0) / completed.length).toFixed(1)
    : '—'

  const weightPRs = computeWeightPRs(weightSessions)
  const hasPRs = weightPRs.length > 0
  const setsIn = (list: LoggedSession[]) =>
    list.reduce((n, s) => n + (s.loggedExercises?.reduce((m, ex) => m + ex.sets.filter((x) => x.completed).length, 0) ?? 0), 0)

  const program = getProgramProgress(profile)

  return (
    <div className="flex flex-col min-h-svh polar-page">
      <PageHeader
        title="Progress"
        subtitle={program.isComplete ? 'Program complete' : `Week ${program.week} of ${program.length}`}
        right={
          <div className="flex items-center gap-2">
            <SyncIndicator />
            <HeaderIconLink to="/settings" label="Settings">
              <Settings size={16} aria-hidden />
            </HeaderIconLink>
          </div>
        }
      />

      <div className="flex flex-col gap-6 w-full px-4 pt-4 pb-tabbar">
        {/* Program progress — tap to configure & see week-by-week history */}
        <Card accent to="/program">
          <CardSection>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-snow">{program.length}-Week Program</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ice">
                  {program.isComplete ? 'Complete' : `Week ${program.week}`}
                </span>
                <ChevronRight size={15} className="text-haze" aria-hidden />
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden">
              <progress
                className="meter [--meter-fill:linear-gradient(to_right,#6fd0ff,#a8e6ff)]"
                value={program.percent}
                max={100}
                aria-hidden
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-haze">Start</span>
              <span className="text-xs text-haze">{program.percent}% complete</span>
              <span className="text-xs text-haze">Week {program.length}</span>
            </div>
          </CardSection>
        </Card>

        {/* This week */}
        <Section title="This week">
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Zap size={18} className="text-ice" />} value={thisWeekSessions.length} label="Sessions" />
            <StatCard icon={<Dumbbell size={18} className="text-blue-400" />} value={thisWeekSessions.filter((s) => s.type === 'weights').length} label="Weights" />
            <StatCard icon={<Layers size={18} className="text-emerald-400" />} value={setsIn(thisWeekSessions)} label="Sets" />
          </div>
        </Section>

        {/* Activity calendar — last four weeks, GitHub-style */}
        <Section title="Last 4 weeks">
          <ActivityCalendar sessions={completed} />
        </Section>

        {/* All time */}
        <Section title="All time">
          <div className="grid grid-cols-2 @3xl/app:grid-cols-4 gap-3">
            <StatCard icon={<Zap size={18} className="text-ice" />} value={completed.length} label="Total sessions" />
            <StatCard icon={<TrendingUp size={18} className="text-emerald-400" />} value={`${avgFeeling}/5`} label="Avg feeling" />
            <StatCard icon={<Dumbbell size={18} className="text-blue-400" />} value={weightSessions.length} label="Weights sessions" />
            <StatCard icon={<Layers size={18} className="text-purple-400" />} value={setsIn(weightSessions)} label="Sets completed" />
          </div>
          {totalVolume > 0 && (
            <Card className="mt-3">
              <CardSection className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ice/15 flex items-center justify-center shrink-0">
                  <TrendingUp size={18} className="text-ice" />
                </div>
                <div>
                  <p className="text-lg font-bold text-snow">{formatVolume(totalVolume, weightUnit)}</p>
                  <p className="text-xs text-mist">Total volume lifted</p>
                </div>
              </CardSection>
            </Card>
          )}
        </Section>

        {/* Best efforts — preview a few key bests, full list one tap away */}
        <Section title="Best efforts">
          {!hasPRs ? (
            <Card>
              <CardSection className="flex items-center gap-3 py-5">
                <div className="w-10 h-10 rounded-2xl bg-ice/15 flex items-center justify-center shrink-0">
                  <Trophy size={18} className="text-yolk" />
                </div>
                <p className="text-sm text-mist">
                  Log some sessions and your personal bests for each lift will show up here.
                </p>
              </CardSection>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {weightPRs.length > 0 && <WeightPRCard prs={weightPRs} limit={3} />}
              <Link
                to="/progress/best-efforts"
                className="flex items-center justify-center gap-1 py-2 text-sm font-medium text-ice hover:underline"
              >
                View all<span className="sr-only"> best efforts</span>
                <ChevronRight size={15} aria-hidden />
              </Link>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

/** GitHub-activity-style heatmap of the last four weeks, coloured by session count. */
function ActivityCalendar({ sessions }: { sessions: LoggedSession[] }) {
  const counts = new Map<string, number>()
  for (const s of sessions) {
    const key = (s.completedAt ?? s.date).slice(0, 10)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // Four Mon–Sun rows ending with the current week.
  const start = addDays(getMonday(new Date()), -21)
  const todayKey = toLocalISODate(new Date())
  const weeks = Array.from({ length: 4 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d))
  )

  // The grid is a picture; this is its text alternative.
  const inWindow = [...counts.entries()].filter(([k]) => k >= toLocalISODate(start) && k <= todayKey)
  const activeDays = inWindow.length
  const total = inWindow.reduce((n, [, c]) => n + c, 0)
  const summary = total
    ? `Last 4 weeks: ${total} session${total !== 1 ? 's' : ''} on ${activeDays} day${activeDays !== 1 ? 's' : ''}.`
    : 'Last 4 weeks: no sessions yet.'

  return (
    <Card>
      <CardSection className="flex flex-col gap-2" >
        <div role="img" aria-label={summary} className="flex flex-col gap-2">
        <div className="grid grid-cols-7 gap-1.5 mb-0.5">
          {WEEK_DAYS_MON.map((d, i) => (
            <span key={i} className="text-2xs text-haze text-center">{d[0]}</span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((day) => {
              const key = toLocalISODate(day)
              const count = counts.get(key) ?? 0
              const future = key > todayKey
              return (
                <div
                  key={key}
                  title={`${key}: ${count} session${count !== 1 ? 's' : ''}`}
                  className={`aspect-square rounded-md ${heatClass(count, future)} ${
                    key === todayKey ? 'ring-1 ring-ice ring-offset-1 ring-offset-floe' : ''
                  }`}
                />
              )
            })}
          </div>
        ))}
        </div>
        <div aria-hidden className="flex items-center justify-end gap-1.5 mt-1">
          <span className="text-2xs text-haze">Less</span>
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className={`w-2.5 h-2.5 rounded-sm ${heatClass(n, false)}`} />
          ))}
          <span className="text-2xs text-haze">More</span>
        </div>
      </CardSection>
    </Card>
  )
}

function heatClass(count: number, future: boolean): string {
  if (future) return 'bg-abyss border border-slush'
  if (count <= 0) return 'bg-floe ice border border-slush-2'
  if (count === 1) return 'bg-ice/30'
  if (count === 2) return 'bg-ice/60'
  return 'bg-ice'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <h2 className="text-xs text-haze uppercase tracking-widest font-medium px-1 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <Card>
      <CardSection className="aspect-square flex flex-col justify-between py-4">
        <div className="w-9 h-9 rounded-xl bg-slush flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-xl font-bold text-snow leading-tight">{value}</p>
          <p className="text-xs text-mist mt-0.5">{label}</p>
        </div>
      </CardSection>
    </Card>
  )
}

function formatVolume(kg: number, unit: WeightUnit): string {
  if (unit === 'lb') {
    const lb = toWeight(kg, 'lb')
    return lb >= 1000 ? `${(lb / 1000).toFixed(1)}k lb` : `${Math.round(lb)} lb`
  }
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${Math.round(kg)}kg`
}
