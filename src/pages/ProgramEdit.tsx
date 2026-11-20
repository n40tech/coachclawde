import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAutoSync } from '../hooks/useAutoSync'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardSection } from '../components/shared/Card'
import { SyncIndicator } from '../components/shared/SyncIndicator'
import { DEFAULT_PROFILE } from '../lib/profileData'
import {
  GOAL_OPTIONS, EXERCISE_OPTIONS, FACILITY_OPTIONS, COACHING_OPTIONS,
  LENGTH_OPTIONS, DAYS_PER_WEEK_OPTIONS, daysPerWeekLabel,
} from '../lib/programOptions'
import type { ProgramConfig } from '../types'

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function ProgramEdit() {
  const { profile, setProfile } = useAppStore()
  const { sync } = useAutoSync()

  const program = profile.program ?? DEFAULT_PROFILE.program!

  // Changes save to the store immediately; the cloud push is debounced so a
  // burst of taps results in a single write. A pending push is flushed when
  // leaving the page.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushProgram = useCallback(() => {
    void sync('profile')
  }, [sync])

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null
      pushProgram()
    }, 1200)
  }, [pushProgram])

  useEffect(() => () => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current)
      syncTimer.current = null
      pushProgram()
    }
  }, [pushProgram])

  function update(patch: Partial<ProgramConfig>) {
    // Days a week also lives in the goal profile; keep the two in step.
    const goal = profile.goal && patch.daysPerWeek
      ? { ...profile.goal, constraints: { ...profile.goal.constraints, daysPerWeek: patch.daysPerWeek } }
      : profile.goal
    setProfile({ program: { ...program, ...patch }, goal })
    scheduleSync()
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#0a0a0a]">
      <PageHeader
        title="Program setup"
        subtitle="Changes save automatically"
        backTo="/program"
        right={<SyncIndicator />}
      />

      <div className="flex flex-col gap-5 px-4 pt-4 pb-tabbar">
        <Card>
          <CardSection className="flex flex-col gap-5">
            <ChipGroup
              label="Goals"
              options={GOAL_OPTIONS}
              selected={program.goals}
              onToggle={(v) => update({ goals: toggle(program.goals, v) })}
            />
            <ChipGroup
              label="Training types"
              // Weights-first: cardio isn't scheduled any more (log it by hand).
              options={EXERCISE_OPTIONS.filter((o) => o.value !== 'cardio')}
              selected={program.exerciseTypes}
              onToggle={(v) => update({ exerciseTypes: toggle(program.exerciseTypes, v) })}
            />
            <ChipGroup
              label="Available facilities"
              options={FACILITY_OPTIONS}
              selected={program.facilities}
              onToggle={(v) => update({ facilities: toggle(program.facilities, v) })}
            />
            <ChipGroup
              label="Coaching style"
              options={COACHING_OPTIONS}
              selected={[program.coachingStyle]}
              onToggle={(v) => update({ coachingStyle: v })}
            />
            <DaysPerWeekGroup
              value={program.daysPerWeek}
              onChange={(daysPerWeek) => update({ daysPerWeek })}
            />
            <LengthGroup
              value={program.lengthWeeks ?? 12}
              onChange={(lengthWeeks) => update({ lengthWeeks })}
            />
          </CardSection>
        </Card>

      </div>
    </div>
  )
}

function DaysPerWeekGroup({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#a8a29e] mb-2.5">Days per week</p>
      <div className="grid grid-cols-5 gap-2">
        {DAYS_PER_WEEK_OPTIONS.map((days) => {
          const active = value === days
          return (
            <button
              key={days}
              onClick={() => onChange(days)}
              aria-pressed={active}
              className={`px-2 py-2.5 rounded-2xl text-sm font-medium text-center transition-all duration-150 ${
                active
                  ? 'bg-[#d97756] text-white shadow-lg shadow-[#d97756]/20'
                  : 'bg-[#1a1a1a] text-[#6a6a6a] border border-[#2a2a2a] hover:text-[#a8a29e]'
              }`}
            >
              {daysPerWeekLabel(days)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LengthGroup({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#a8a29e] mb-2.5">Program length</p>
      <div className="grid grid-cols-4 gap-2">
        {LENGTH_OPTIONS.map((weeks) => {
          const active = value === weeks
          return (
            <button
              key={weeks}
              onClick={() => onChange(weeks)}
              aria-pressed={active}
              className={`px-2 py-2.5 rounded-2xl text-sm font-medium text-center transition-all duration-150 ${
                active
                  ? 'bg-[#d97756] text-white shadow-lg shadow-[#d97756]/20'
                  : 'bg-[#1a1a1a] text-[#6a6a6a] border border-[#2a2a2a] hover:text-[#a8a29e]'
              }`}
            >
              {weeks}w
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ChipGroup<T extends string>({
  label, options, selected, onToggle,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[#a8a29e] mb-2.5">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              aria-pressed={active}
              className={`px-2 py-2.5 rounded-2xl text-sm font-medium text-center transition-all duration-150 ${
                active
                  ? 'bg-[#d97756] text-white shadow-lg shadow-[#d97756]/20'
                  : 'bg-[#1a1a1a] text-[#6a6a6a] border border-[#2a2a2a] hover:text-[#a8a29e]'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
