import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Share2, Trash2 } from 'lucide-react'
import { FixedLayer } from '../layout/FixedLayer'
import { QuinnMark } from '../shared/QuinnMark'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { ChoiceChip, ChoiceGroup } from '../shared/Choice'
import { useModal } from '../../hooks/useModal'
import { useUnits } from '../../store/useSettingsStore'
import { toWeight } from '../../lib/units'
import { formatSessionDate } from '../../lib/dateUtils'
import { formatElapsed, type WorkoutSummary } from '../../lib/workoutSummary'
import { SHARE_STYLES, buildShareFile, formatVolume, shareFile, type ShareStyle } from '../../lib/shareCard'
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
 * mono labels and dot-grid panels. Stats beside a big Quinn, any new PBs,
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
      // Notes saying what changed are what Quinn reads; no separate toggle.
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
        className="absolute inset-0 z-50 overflow-y-auto overscroll-contain outline-none bg-abyss fade-in"
        style={{ backgroundImage: 'radial-gradient(ellipse 120% 420px at 50% 0, rgba(111,208,255,0.28), transparent 70%)' }}
      >
        <div className="w-full max-w-md mx-auto px-5 pt-safe pb-edge flex flex-col gap-6">
          {step === 'summary' ? (
            <>
              {/* Title */}
              <div className="pt-8">
                <p className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-frost">
                  {summary.title} · {formatSessionDate(summary.date)}
                </p>
                <h2 className="font-pixel uppercase text-3xl leading-none tracking-[0.02em] text-snow mt-3">
                  Workout complete
                </h2>
              </div>

              {/* Stats as a list beside Quinn */}
              <div className="grid grid-cols-[1fr_auto] items-center gap-5">
                <dl className="flex flex-col divide-y divide-slush-2 border-y border-slush-2">
                  <Stat label="Reps" value={String(summary.reps)} />
                  <Stat label="Sets" value={String(summary.sets)} />
                  <Stat label="Elapsed" value={formatElapsed(summary.durationSeconds)} />
                  <Stat label="Lifted" value={formatVolume(summary.totalVolumeKg, unit)} />
                </dl>
                <div className="relative">
                  <div aria-hidden className="absolute inset-0 -m-4 rounded-full bg-ice/20 blur-2xl" />
                  <QuinnMark size={120} cheer sweat className="relative" />
                </div>
              </div>

              {/* New PBs */}
              {summary.pbs.length > 0 && (
                <section className="rounded-[1.75rem] bg-floe dot-grid border border-slush-2 p-5">
                  <h3 className="text-2xl font-pixel uppercase leading-none text-yolk">
                    New PB{summary.pbs.length > 1 ? 's' : ''}!
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {summary.pbs.map((pb) => (
                      <li key={pb.name} className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-snow truncate">{pb.name}</span>
                        <span className="font-mono text-sm font-bold text-snow tabular-nums shrink-0">
                          {toWeight(pb.weightKg, unit)}{unit} × {pb.reps}
                          <span className="font-normal text-frost"> ↑{+(toWeight(pb.weightKg, unit) - toWeight(pb.previousKg, unit)).toFixed(1)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <ShareCards summary={summary} />

              {/* How did it feel */}
              <section>
                <ChoiceGroup
                  legend="How did it feel?"
                  legendClassName="block font-mono text-2xs font-bold uppercase tracking-[0.12em] text-frost mb-3"
                  className="grid grid-cols-5 gap-2"
                >
                  {([1, 2, 3, 4, 5] as Rating[]).map((r) => (
                    <ChoiceChip
                      key={r}
                      name="feeling"
                      value={String(r)}
                      checked={feelings === r}
                      onChange={() => setFeelings(r)}
                      className={`aspect-square flex items-center justify-center rounded-2xl text-lg font-semibold transition-all duration-150 ${
                        feelings === r
                          ? 'bg-accent-fill text-white scale-105 shadow-lg shadow-ice/25'
                          : 'bg-floe text-frost border border-slush-2 hover:text-snow'
                      }`}
                    >
                      {r}<span className="sr-only">, {FEEL[r]}</span>
                    </ChoiceChip>
                  ))}
                </ChoiceGroup>
                <p aria-hidden className="font-mono text-2xs uppercase tracking-[0.12em] text-frost text-center mt-2 h-4">{feelings ? FEEL[feelings] : ''}</p>
              </section>

              {/* Notes */}
              <section>
                <label htmlFor="wc-notes" className="block font-mono text-2xs font-bold uppercase tracking-[0.12em] text-frost">Notes</label>
                <textarea
                  id="wc-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How it went, what you changed. Quinn reads this when planning next week."
                  rows={4}
                  className="mt-3 w-full bg-floe border border-deep rounded-[1.25rem] px-4 py-3 text-base text-snow placeholder-mist resize-y field-sizing-content min-h-24 max-h-[50svh] focus:outline-none focus:border-ice-bright focus:ring-1 focus:ring-ice-bright"
                />
                <button
                  type="button"
                  onClick={() => setShowPain((p) => !p)}
                  aria-expanded={showPain}
                  className="mt-2 flex items-center gap-1.5 text-sm text-frost py-1"
                >
                  Something hurt? {showPain ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
                </button>
                {showPain && (
                  <textarea
                    aria-label="Pain or discomfort"
                    value={painNotes}
                    onChange={(e) => setPainNotes(e.target.value)}
                    placeholder="e.g. Left shoulder clicking on overhead presses"
                    rows={2}
                    className="mt-2 w-full bg-floe border border-deep rounded-[1.25rem] px-4 py-3 text-base text-snow placeholder-mist resize-y field-sizing-content min-h-24 max-h-[50svh] focus:outline-none focus:border-ice-bright focus:ring-1 focus:ring-ice-bright fade-in"
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
                  className="self-center flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-ice-dim hover:text-red-400 py-3 px-4"
                >
                  <Trash2 size={14} aria-hidden /> Delete workout
                </button>
              </div>
            </>
          ) : (
            <div className="min-h-[80svh] flex flex-col items-center justify-center text-center gap-5">
              <QuinnMark size={120} cheer sweat />
              <h2 className="text-2xl font-bold text-snow">That's your week done</h2>
              <p className="text-sm text-frost leading-relaxed max-w-xs">
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
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-frost">{label}</dt>
      <dd className="text-lg font-semibold text-snow tabular-nums truncate">{value}</dd>
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
          ? 'bg-transparent text-snow border-rime-2 hover:border-snow'
          : 'bg-snow text-abyss border-snow hover:bg-accent-fill hover:border-accent-fill hover:text-white'
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
    // One card at a time, yielding to the browser in between, so drawing
    // three 1080² canvases doesn't hold up taps on the page as it opens.
    void (async () => {
      const entries: [ShareStyle, { file: File; url: string }][] = []
      for (const { id } of SHARE_STYLES) {
        if (cancelled) return
        try {
          const file = await buildShareFile(summary, unit, id)
          const url = URL.createObjectURL(file)
          urls.push(url)
          entries.push([id, { file, url }])
        } catch {
          return
        }
        await yieldToMain()
      }
      if (!cancelled) setFiles(Object.fromEntries(entries))
    })()
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
      <h3 className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-frost">Share</h3>
      <ChoiceGroup legend="Card design" legendClassName="sr-only" className="mt-3 grid grid-cols-3 gap-2.5">
        {SHARE_STYLES.map(({ id, label }) => {
          const on = style === id
          return (
            <ChoiceChip
              key={id}
              name="share-card"
              value={id}
              checked={on}
              onChange={() => setStyle(id)}
              className="flex flex-col items-center gap-1.5 rounded-2xl"
            >
              <span className={`block w-full aspect-square rounded-2xl overflow-hidden bg-floe border-2 transition-colors ${on ? 'border-ice-bright' : 'border-slush-2'}`}>
                {files[id] && <img src={files[id]!.url} alt="" className="w-full h-full object-cover" />}
              </span>
              <span className={`font-mono text-2xs font-bold uppercase tracking-[0.1em] ${on ? 'text-snow' : 'text-frost'}`}>{label}<span className="sr-only"> card</span></span>
            </ChoiceChip>
          )
        })}
      </ChoiceGroup>
      <button
        type="button"
        onClick={share}
        disabled={!files[style]}
        className="mt-3 w-full min-h-12 rounded-full flex items-center justify-center gap-2 bg-floe border-[1.5px] border-rime-2 text-snow font-medium hover:border-ice-bright disabled:opacity-50 transition-colors"
      >
        <Share2 size={17} aria-hidden /> Share card
      </button>
      {/* Always rendered (not display:none when empty), so the message is announced. */}
      <p role="status" className="text-xs text-frost text-center mt-2 min-h-4">{msg}</p>
    </section>
  )
}

/** Lets pending input and rendering run before the next chunk of work. */
function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}
