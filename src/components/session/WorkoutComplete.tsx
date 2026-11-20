import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Share2, Trash2 } from 'lucide-react'
import { FixedLayer } from '../layout/FixedLayer'
import { ClawdeMark } from '../shared/ClawdeMark'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useModal } from '../../hooks/useModal'
import { useUnits } from '../../store/useSettingsStore'
import { toWeight } from '../../lib/units'
import { formatSessionDate } from '../../lib/dateUtils'
import { formatWorkoutTime, type WorkoutSummary } from '../../lib/workoutSummary'
import { SHARE_STYLES, buildShareFile, formatVolumeCompact, shareFile, type ShareStyle } from '../../lib/shareCard'
import type { Rating, SessionOutcome } from '../../types'

export interface SessionCompleteData {
  feelings: Rating
  painNotes: string
  generalNotes: string
  outcome: SessionOutcome
}

interface WorkoutCompleteProps {
  summary: WorkoutSummary
  isLastSessionOfWeek: boolean
  /** Saves the session. The page then shows the week invitation if there is one. */
  onSave: (data: SessionCompleteData) => void
  /** Week-done invitation accepted: open a check-in. */
  onCheckIn: () => void
  /** Week-done invitation declined ("Not now"). */
  onNotNow: () => void
  /** Leave after saving (navigates away). */
  onFinish: () => void
  /** Back to the workout, nothing saved. */
  onCancel: () => void
  /** Throw the whole workout away. */
  onDelete: () => void
}

const FEEL = ['', 'Terrible', 'Poor', 'OK', 'Good', 'Great']

/**
 * "Workout complete", full screen, in the website's style: pixel lettering,
 * mono labels and dot-grid panels. Stats beside a big Clawde, any new PBs,
 * three shareable cards, how it felt and notes; then save, go back, or
 * delete the workout.
 */
export function WorkoutComplete({ summary, isLastSessionOfWeek, onSave, onCheckIn, onNotNow, onFinish, onCancel, onDelete }: WorkoutCompleteProps) {
  const panel = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'summary' | 'invite'>('summary')
  const [confirmDelete, setConfirmDelete] = useState(false)
  useModal(panel, { onEscape: () => (step === 'summary' ? onCancel() : onNotNow()) })

  const [feelings, setFeelings] = useState<Rating | null>(null)
  const [notes, setNotes] = useState('')
  const [painNotes, setPainNotes] = useState('')
  const [showPain, setShowPain] = useState(false)
  const unit = useUnits().weight

  function save() {
    onSave({
      feelings: feelings ?? 4,
      painNotes,
      generalNotes: notes,
      // Notes saying what changed are what Clawde reads; no separate toggle.
      outcome: 'as-planned' as SessionOutcome,
    })
    if (isLastSessionOfWeek) setStep('invite')
    else onFinish()
  }

  return (
    <FixedLayer>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Workout complete"
        tabIndex={-1}
        className="absolute inset-0 z-50 overflow-y-auto overscroll-contain outline-none bg-[#050505] fade-in"
        style={{ backgroundImage: 'radial-gradient(ellipse 120% 420px at 50% 0, rgba(217,119,86,0.28), transparent 70%)' }}
      >
        <div className="w-full max-w-md mx-auto px-5 pt-safe pb-edge flex flex-col gap-6">
          {step === 'summary' ? (
            <>
              {/* Title */}
              <div className="pt-8">
                <p className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[#a39e98]">
                  {summary.title} · {formatSessionDate(summary.date)}
                </p>
                <h2 className="font-pixel uppercase text-[3.25rem] leading-[0.92] tracking-[0.02em] text-[#f5f5f0] mt-3">
                  Workout<br />complete
                  <Check aria-hidden size="0.8em" strokeWidth={3} className="inline-block align-baseline ml-2 text-[#e07f5e]" />
                </h2>
              </div>

              {/* Stats beside Clawde */}
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <Stat value={String(summary.reps)} label="Reps" />
                  <Stat value={String(summary.sets)} label="Sets" />
                  <Stat value={formatWorkoutTime(summary.durationSeconds).replace(' ', '')} label="Time" />
                  <Stat value={formatVolumeCompact(summary.totalVolumeKg, unit)} label="Lifted" />
                </dl>
                <div className="relative">
                  <div aria-hidden className="absolute inset-0 -m-4 rounded-full bg-[#d97756]/20 blur-2xl" />
                  <ClawdeMark size={132} cheer sweat className="relative" />
                </div>
              </div>

              {/* New PBs */}
              {summary.pbs.length > 0 && (
                <section className="rounded-[1.75rem] bg-[#121211] dot-grid border border-[#272523] p-5">
                  <h3 className="font-pixel uppercase text-3xl leading-none text-[#e07f5e]">
                    New PB{summary.pbs.length > 1 ? 's' : ''}!
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {summary.pbs.map((pb) => (
                      <li key={pb.name} className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-[#f5f5f0] truncate">{pb.name}</span>
                        <span className="font-mono text-sm font-bold text-[#f5f5f0] tabular-nums shrink-0">
                          {toWeight(pb.weightKg, unit)}{unit} × {pb.reps}
                          <span className="font-normal text-[#6a6560]"> ↑{+(toWeight(pb.weightKg, unit) - toWeight(pb.previousKg, unit)).toFixed(1)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <ShareCards summary={summary} />

              {/* How did it feel */}
              <section>
                <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[#a39e98]">How did it feel?</h3>
                <div role="radiogroup" aria-label="How did it feel?" className="mt-3 grid grid-cols-5 gap-2">
                  {([1, 2, 3, 4, 5] as Rating[]).map((r) => (
                    <button
                      key={r}
                      role="radio"
                      aria-checked={feelings === r}
                      aria-label={`${r}, ${FEEL[r]}`}
                      onClick={() => setFeelings(r)}
                      className={`aspect-square rounded-2xl font-pixel text-2xl transition-all duration-150 ${
                        feelings === r
                          ? 'bg-[#e07f5e] text-white scale-105 shadow-lg shadow-[#d97756]/25'
                          : 'bg-[#121211] text-[#6a6560] border border-[#272523] hover:text-[#f5f5f0]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="font-mono text-2xs uppercase tracking-[0.12em] text-[#6a6560] text-center mt-2 h-4">{feelings ? FEEL[feelings] : ''}</p>
              </section>

              {/* Notes */}
              <section>
                <label htmlFor="wc-notes" className="block font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[#a39e98]">Notes</label>
                <textarea
                  id="wc-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How it went, what you changed. Clawde reads this when planning next week."
                  rows={4}
                  className="mt-3 w-full bg-[#121211] border border-[#272523] rounded-[1.25rem] px-4 py-3 text-base text-[#f5f5f0] placeholder-[#4a4643] resize-none focus:outline-none focus:border-[#e07f5e]/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPain((p) => !p)}
                  aria-expanded={showPain}
                  className="mt-2 flex items-center gap-1.5 text-sm text-[#a39e98] py-1"
                >
                  Something hurt? {showPain ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {showPain && (
                  <textarea
                    aria-label="Pain or discomfort"
                    value={painNotes}
                    onChange={(e) => setPainNotes(e.target.value)}
                    placeholder="e.g. Left shoulder clicking on overhead presses"
                    rows={2}
                    className="mt-2 w-full bg-[#121211] border border-[#272523] rounded-[1.25rem] px-4 py-3 text-base text-[#f5f5f0] placeholder-[#4a4643] resize-none focus:outline-none focus:border-[#e07f5e]/60 fade-in"
                  />
                )}
              </section>

              {/* Actions */}
              <div className="flex flex-col gap-2.5 pt-2">
                <Pill onClick={save}>Save workout</Pill>
                <Pill ghost onClick={onCancel}>Cancel</Pill>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="self-center flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#a35a4a] hover:text-red-400 py-3 px-4"
                >
                  <Trash2 size={14} /> Delete workout
                </button>
              </div>
            </>
          ) : (
            <div className="min-h-[80svh] flex flex-col items-center justify-center text-center gap-5">
              <ClawdeMark size={120} cheer sweat />
              <h2 className="font-pixel uppercase text-4xl leading-none text-[#f5f5f0]">Week done</h2>
              <p className="text-sm text-[#a39e98] leading-relaxed max-w-xs">
                Workout saved. A 1-minute check-in? Your answers shape next week’s plan. Totally optional.
              </p>
              <div className="w-full flex flex-col gap-2.5 mt-2">
                <Pill onClick={onCheckIn}>Check in</Pill>
                <Pill ghost onClick={onNotNow}>Not now</Pill>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          icon={<Trash2 size={20} />}
          title="Delete this workout?"
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDelete() }}
          onCancel={() => setConfirmDelete(false)}
        >
          Every set you logged in {summary.title} is thrown away, and the session goes back to not started. This can’t be undone.
        </ConfirmDialog>
      )}
    </FixedLayer>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 flex flex-col-reverse">
      <dt className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[#6a6560] mt-1.5">{label}</dt>
      <dd className="font-pixel text-[2.5rem] leading-none text-[#f5f5f0] tabular-nums truncate">{value}</dd>
    </div>
  )
}

function Pill({ ghost, onClick, children }: { ghost?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 px-6 rounded-full text-base font-medium border-[1.5px] transition-all duration-150 active:scale-[0.98] ${
        ghost
          ? 'bg-transparent text-[#f5f5f0] border-[#3a3735] hover:border-[#f5f5f0]'
          : 'bg-[#f5f5f0] text-[#050505] border-[#f5f5f0] hover:bg-[#e07f5e] hover:border-[#e07f5e] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/** Three card designs to pick from, previewed, and a Share button. */
function ShareCards({ summary }: { summary: WorkoutSummary }) {
  const unit = useUnits().weight
  const [style, setStyle] = useState<ShareStyle>('summary')
  const [files, setFiles] = useState<Partial<Record<ShareStyle, { file: File; url: string }>>>({})
  const [msg, setMsg] = useState('')

  // Render all three now: previews, and Share opens the sheet straight from the tap (iOS).
  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    Promise.all(SHARE_STYLES.map(async ({ id }) => {
      const file = await buildShareFile(summary, unit, id)
      const url = URL.createObjectURL(file)
      urls.push(url)
      return [id, { file, url }] as const
    })).then((entries) => { if (!cancelled) setFiles(Object.fromEntries(entries)) }, () => {})
    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [summary, unit])

  async function share() {
    const f = files[style]
    if (!f) return
    const result = await shareFile(f.file, summary.title)
    setMsg(result === 'downloaded' ? 'Image saved to your downloads.' : '')
  }

  return (
    <section>
      <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[#a39e98]">Share</h3>
      <div role="radiogroup" aria-label="Card design" className="mt-3 grid grid-cols-3 gap-2.5">
        {SHARE_STYLES.map(({ id, label }) => {
          const on = style === id
          return (
            <button
              key={id}
              role="radio"
              aria-checked={on}
              aria-label={`${label} card`}
              onClick={() => setStyle(id)}
              className="flex flex-col items-center gap-1.5"
            >
              <span className={`block w-full aspect-square rounded-2xl overflow-hidden bg-[#121211] border-2 transition-colors ${on ? 'border-[#e07f5e]' : 'border-[#272523]'}`}>
                {files[id] && <img src={files[id]!.url} alt="" className="w-full h-full object-cover" />}
              </span>
              <span className={`font-mono text-2xs font-bold uppercase tracking-[0.1em] ${on ? 'text-[#f5f5f0]' : 'text-[#6a6560]'}`}>{label}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={share}
        disabled={!files[style]}
        className="mt-3 w-full min-h-12 rounded-full flex items-center justify-center gap-2 bg-[#121211] border-[1.5px] border-[#3a3735] text-[#f5f5f0] font-medium hover:border-[#e07f5e] disabled:opacity-50 transition-colors"
      >
        <Share2 size={17} /> Share card
      </button>
      <p role="status" className="text-xs text-[#6a6560] text-center mt-2 empty:hidden">{msg}</p>
    </section>
  )
}
