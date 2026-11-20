import { useState } from 'react'
import { BottomSheet, SheetCloseButton } from '../shared/BottomSheet'
import { Button } from '../shared/Button'
import { Stepper } from '../shared/Stepper'
import { ChoiceChip, ChoiceGroup } from '../shared/Choice'
import { DISTANCE_ACTIVITIES, QUICK_ACTIVITIES, type QuickLogInput } from '../../lib/quickLog'
import { toLocalISODate } from '../../lib/weekUtils'
import { useUnits } from '../../store/useSettingsStore'
import { fromDistance } from '../../lib/units'

const RPE_HINTS: Record<number, string> = {
  1: 'Very easy', 2: 'Easy', 3: 'Comfortable', 4: 'Steady', 5: 'Working',
  6: 'Hard-ish', 7: 'Hard', 8: 'Very hard', 9: 'Nearly max', 10: 'All out',
}

/** One-tap 1–10 effort (session RPE) picker. */
export function RpePicker({
  value, onChange, legend = 'Effort, 1 to 10', legendClassName = 'sr-only',
}: { value: number | undefined; onChange: (v: number) => void; legend?: string; legendClassName?: string }) {
  return (
    <div>
      <ChoiceGroup legend={legend} legendClassName={legendClassName} className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <ChoiceChip
            key={n}
            name="effort"
            value={String(n)}
            checked={value === n}
            onChange={() => onChange(n)}
            className={`py-2.5 rounded-xl text-sm font-bold text-center transition-all ${
              value === n ? 'bg-[#d97756] text-white shadow-lg shadow-[#d97756]/20' : 'bg-[#1a1a1a] text-[#949494] hover:bg-[#2a2a2a]'
            }`}
          >
            {n}<span className="sr-only">, {RPE_HINTS[n]}</span>
          </ChoiceChip>
        ))}
      </ChoiceGroup>
      <p aria-hidden className="text-xs text-[#949494] text-center mt-2 h-4">{value ? RPE_HINTS[value] : 'How hard was it overall?'}</p>
    </div>
  )
}

/**
 * "Did something else?" / "Log a session". A swap is logged against the
 * planned session; a standalone log also asks which day.
 */
export function QuickLogSheet({
  plannedTitle, defaultMinutes = 45, onSave, onClose,
}: {
  /** Set when logging a swap for a planned session. */
  plannedTitle?: string
  defaultMinutes?: number
  onSave: (input: QuickLogInput) => void
  onClose: () => void
}) {
  const [activity, setActivity] = useState('')
  const [custom, setCustom] = useState('')
  const [minutes, setMinutes] = useState(defaultMinutes)
  const [distance, setDistance] = useState('')
  const distanceUnit = useUnits().distance
  const [rpe, setRpe] = useState<number | undefined>()
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(toLocalISODate(new Date()))

  const isOther = activity === '__other'
  const name = isOther ? custom.trim() : activity
  const showDistance = DISTANCE_ACTIVITIES.has(activity) || isOther

  function save() {
    if (!name) return
    const km = fromDistance(Number(distance), distanceUnit)
    onSave({
      activity: name,
      minutes,
      distanceKm: showDistance && km > 0 ? km : undefined,
      rpe,
      notes,
      date,
    })
  }

  const field = 'w-full bg-[#1a1a1a] border border-[#666666] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#858585] focus:outline-none focus:border-[#d97756] focus:ring-1 focus:ring-[#d97756]'

  return (
    <BottomSheet label={plannedTitle ? 'Did something else' : 'Log a session'} onClose={onClose} dismissOnBackdrop={false}>
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <div>
          <h2 className="text-lg font-bold text-[#f5f5f0]">{plannedTitle ? 'Did something else?' : 'Log a session'}</h2>
          <p className="text-sm text-[#949494] mt-0.5">
            {plannedTitle ? `Instead of ${plannedTitle}. It counts, and Clawde will see it.` : 'Anything you did outside the plan.'}
          </p>
        </div>
        <SheetCloseButton onClose={onClose} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3 flex flex-col gap-5">
        <div>
          <ChoiceGroup legend="What did you do?" legendClassName="block text-sm font-medium text-[#a8a29e] mb-2" className="flex flex-wrap gap-2">
            {[...QUICK_ACTIVITIES, { value: '__other', label: 'Other' }].map((a) => (
              <ChoiceChip
                key={a.value}
                name="quicklog-activity"
                value={a.value}
                checked={activity === a.value}
                onChange={() => setActivity(a.value)}
                className={`px-3.5 py-2 rounded-2xl text-sm font-medium transition-all ${
                  activity === a.value ? 'bg-[#d97756] text-white' : 'bg-[#1a1a1a] text-[#a8a29e] border border-[#2a2a2a]'
                }`}
              >
                {a.label}
              </ChoiceChip>
            ))}
          </ChoiceGroup>
          {isOther && (
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Spin class" aria-label="Other activity" className={`${field} mt-2`} autoFocus />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p aria-hidden className="text-sm font-medium text-[#a8a29e]">How long?</p>
          <Stepper label="How long, in minutes" value={minutes} step={5} min={5} max={600} onChange={setMinutes} format={(v) => `${v} min`} />
        </div>

        {showDistance && (
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="quicklog-distance" className="text-sm font-medium text-[#a8a29e]">Distance <span className="text-[#858585]">(optional)</span></label>
            <div className="flex items-center gap-1.5 w-32">
              <input
                id="quicklog-distance"
                value={distance}
                onChange={(e) => setDistance(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                placeholder="0"
                className="w-full bg-[#1a1a1a] border border-[#666666] rounded-xl px-3 py-2 text-base text-center text-[#f5f5f0] placeholder-[#858585] focus:outline-none focus:border-[#d97756] focus:ring-1 focus:ring-[#d97756]"
              />
              <span className="text-xs text-[#949494]">{distanceUnit}</span>
            </div>
          </div>
        )}

        <RpePicker value={rpe} onChange={setRpe} legend="Effort" legendClassName="block text-sm font-medium text-[#a8a29e] mb-2" />

        {!plannedTitle && (
          <div>
            <label htmlFor="quicklog-date" className="block text-sm font-medium text-[#a8a29e] mb-2">When?</label>
            <input
              id="quicklog-date"
              type="date"
              value={date}
              max={toLocalISODate(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className={field}
              style={{ colorScheme: 'dark' }}
            />
          </div>
        )}

        <div>
          <label htmlFor="quicklog-note" className="block text-sm font-medium text-[#a8a29e] mb-2">Note <span className="text-[#858585]">(optional)</span></label>
          <textarea id="quicklog-note" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Gym was packed, went for a ride instead" className={`${field} resize-y field-sizing-content min-h-24 max-h-[50svh]`} />
        </div>
      </div>
      <div className="px-5 pb-edge pt-3">
        <Button fullWidth size="lg" onClick={save} disabled={!name || !date}>
          Save
        </Button>
      </div>
    </BottomSheet>
  )
}
