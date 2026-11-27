import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAutoSync } from '../hooks/useAutoSync'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardSection } from '../components/shared/Card'
import { SyncIndicator } from '../components/shared/SyncIndicator'
import { ChoiceChip, ChoiceGroup } from '../components/shared/Choice'
import { chipLook } from '../components/shared/chipLook'
import { DEFAULT_PROFILE } from '../lib/profileData'
import {
  GOAL_OPTIONS, EXERCISE_OPTIONS, FACILITY_OPTIONS, COACHING_OPTIONS,
  LENGTH_OPTIONS, DAYS_PER_WEEK_OPTIONS, daysPerWeekLabel,
} from '../lib/programOptions'
import type { ProgramConfig } from '../types'
import { withTrainingSetup } from '../lib/trainingSetup'

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
    // Facilities and days a week also live in the goal: lib/trainingSetup keeps both copies in step.
    const { facilities, daysPerWeek, ...rest } = patch
    setProfile(withTrainingSetup({ ...profile, program: { ...program, ...rest } }, {
      ...(facilities ? { facilities } : {}),
      ...(daysPerWeek ? { daysPerWeek } : {}),
    }))
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
              type="radio"
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

const LOOK = 'px-2 py-2.5 rounded-2xl text-sm font-medium text-center'

function DaysPerWeekGroup({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <ChoiceGroup legend="Days per week" legendClassName="block text-xs font-medium text-[#a8a29e] mb-2.5" className="grid grid-cols-5 gap-2">
      {DAYS_PER_WEEK_OPTIONS.map((days) => (
        <ChoiceChip key={days} name="days-per-week" value={String(days)} checked={value === days} onChange={() => onChange(days)} className={chipLook(value === days, LOOK)}>
          {daysPerWeekLabel(days)}
        </ChoiceChip>
      ))}
    </ChoiceGroup>
  )
}

function LengthGroup({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <ChoiceGroup legend="Program length" legendClassName="block text-xs font-medium text-[#a8a29e] mb-2.5" className="grid grid-cols-4 gap-2">
      {LENGTH_OPTIONS.map((weeks) => (
        <ChoiceChip key={weeks} name="program-length" value={String(weeks)} checked={value === weeks} onChange={() => onChange(weeks)} className={chipLook(value === weeks, LOOK)}>
          {weeks}<span aria-hidden>w</span><span className="sr-only"> weeks</span>
        </ChoiceChip>
      ))}
    </ChoiceGroup>
  )
}

/** Checkboxes (any number), or radios (`type="radio"`, exactly one). */
function ChipGroup<T extends string>({
  label, options, selected, onToggle, type = 'checkbox',
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
  type?: 'checkbox' | 'radio'
}) {
  const name = label.toLowerCase().replace(/\W+/g, '-')
  return (
    <ChoiceGroup legend={label} legendClassName="block text-xs font-medium text-[#a8a29e] mb-2.5" className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value)
        return (
          <ChoiceChip key={opt.value} type={type} name={name} value={opt.value} checked={active} onChange={() => onToggle(opt.value)} className={chipLook(active, LOOK)}>
            {opt.label}
          </ChoiceChip>
        )
      })}
    </ChoiceGroup>
  )
}
