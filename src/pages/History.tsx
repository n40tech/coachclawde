import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardSection } from '../components/shared/Card'
import { Badge } from '../components/shared/Badge'
import { Check, ChevronRight, Dumbbell, Waves, Star, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { useAutoSync } from '../hooks/useAutoSync'
import { QuinnMark } from '../components/shared/QuinnMark'
import { formatSessionDate, formatDuration } from '../lib/dateUtils'
import type { Intensity } from '../types'
import { useUnits } from '../store/useSettingsStore'
import { localize } from '../lib/units'
import { format, parseISO, startOfWeek, isSameWeek } from 'date-fns'

export function History() {
  const { loggedSessions, weekPlans } = useAppStore()
  const { removeSession } = useAutoSync()
  // Edit mode: tap tiles to select them, then delete them all at once.
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const units = useUnits()

  const completed = [...loggedSessions]
    .filter((s) => s.status === 'complete')
    .sort((a, b) => new Date(b.completedAt || b.date).getTime() - new Date(a.completedAt || a.date).getTime())

  // Group by week
  const grouped = groupByWeek(completed)

  function getPlanned(session: (typeof completed)[0]) {
    return weekPlans.flatMap((p) => p.sessions).find((s) => s.id === session.plannedSessionId)
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function stopEditing() {
    setEditing(false)
    setSelected(new Set())
  }

  function deleteSelected() {
    for (const id of selected) void removeSession(id)
    setConfirmDelete(false)
    stopEditing()
  }

  const allSelected = completed.length > 0 && selected.size === completed.length

  if (completed.length === 0) {
    return (
      <div className="flex flex-col min-h-svh polar-page">
        <PageHeader title="History" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 pb-tabbar">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#13222e] to-floe ring-1 ring-ice/25 flex items-center justify-center">
            <QuinnMark size={48} sweat />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-snow">No sessions yet</h2>
            <p className="text-sm text-mist mt-1">Complete your first session — Quinn's chilled and ready.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-svh polar-page">
      <PageHeader
        title="History"
        subtitle={`${completed.length} session${completed.length !== 1 ? 's' : ''} completed`}
        right={
          <button
            type="button"
            onClick={editing ? stopEditing : () => setEditing(true)}
            className={`relative hit-target h-9 px-3.5 rounded-2xl text-sm font-medium transition-colors ${
              editing ? 'bg-accent-fill text-white' : 'bg-slush text-frost hover:text-snow'
            }`}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        }
      />

      {/* Selection bar, under the header while editing. */}
      {editing && (
        <div className="sticky top-[calc(max(0.5rem,var(--safe-top))+3rem)] z-30 mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-floe ice border border-rime pl-4 pr-1.5 py-1.5 fade-in">
          <p role="status" className="flex-1 text-sm text-frost">
            {selected.size ? `${selected.size} selected` : 'Tick sessions to delete'}
          </p>
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(completed.map((s) => s.id)))}
            className="h-9 px-3 rounded-xl text-sm font-medium text-frost hover:text-snow"
          >
            {allSelected ? 'Select none' : 'Select all'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={!selected.size}
            className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
          >
            <Trash2 size={15} aria-hidden />
            Delete
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6 px-4 pt-4 pb-tabbar">
        {grouped.map(({ weekLabel, sessions }) => (
          <div key={weekLabel}>
            <h2 className="text-xs text-haze uppercase tracking-widest font-medium px-1 mb-3">{weekLabel}</h2>
            <div className="grid grid-cols-1 gap-2 @3xl/app:grid-cols-2">
              {sessions.map((session) => {
                const planned = getPlanned(session)
                const isSelected = selected.has(session.id)
                const body = (
                  <CardSection className="flex items-center gap-3 py-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      session.type === 'weights' ? 'bg-ice/15' : 'bg-blue-500/15'
                    }`}>
                      {session.type === 'weights'
                        ? <Dumbbell size={18} className="text-ice" aria-hidden />
                        : <Waves size={18} className="text-blue-400" aria-hidden />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-snow truncate">{localize(session.title, units)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-mist">{formatSessionDate(session.date)}</span>
                        {planned && (
                          <Badge label={planned.intensity} variant={planned.intensity as Intensity} />
                        )}
                        {session.feelings && (
                          <div className="flex items-center gap-0.5">
                            <Star size={10} className="text-ice fill-ice" aria-hidden />
                            <span className="text-xs text-mist"><span className="sr-only">felt </span>{session.feelings}/5</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {planned && <span className="text-xs text-haze">{formatDuration(planned.estimatedMinutes)}</span>}
                      {editing ? (
                        <span
                          aria-hidden
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-accent-fill text-white' : 'border-2 border-rime-2'
                          }`}
                        >
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </span>
                      ) : (
                        <ChevronRight size={14} className="text-haze" aria-hidden />
                      )}
                    </div>
                  </CardSection>
                )
                // Editing: each tile is a checkbox (a choice card); otherwise a
                // link to the session.
                return editing ? (
                  <label
                    key={session.id}
                    className={`block cursor-pointer bg-floe ice rounded-3xl border overflow-hidden has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ice ${
                      isSelected ? 'border-ice/30' : 'border-rime'
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => toggle(session.id)} />
                    {body}
                  </label>
                ) : (
                  <Card key={session.id} to={`/session/${session.plannedSessionId}`}>
                    {body}
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          icon={<Trash2 size={20} />}
          title={`Delete ${selected.size} session${selected.size !== 1 ? 's' : ''}?`}
          confirmLabel="Delete"
          onConfirm={deleteSelected}
          onCancel={() => setConfirmDelete(false)}
        >
          {selected.size === 1 ? 'It' : 'They'} will be removed from your history and progress. This can't be undone.
        </ConfirmDialog>
      )}
    </div>
  )
}

function groupByWeek(sessions: ReturnType<typeof useAppStore.getState>['loggedSessions']) {
  const groups: { weekLabel: string; weekStart: Date; sessions: typeof sessions }[] = []

  for (const session of sessions) {
    const date = parseISO(session.date)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })

    let group = groups.find((g) => isSameWeek(g.weekStart, weekStart, { weekStartsOn: 1 }))
    if (!group) {
      const isThisWeek = isSameWeek(weekStart, new Date(), { weekStartsOn: 1 })
      group = {
        weekLabel: isThisWeek ? 'This week' : `Week of ${format(weekStart, 'dd MMM yyyy')}`,
        weekStart,
        sessions: [],
      }
      groups.push(group)
    }
    group.sessions.push(session)
  }

  return groups
}
