import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Clock, Dumbbell, Layers, Share2, Star, Trophy, Weight } from 'lucide-react'
import { Button } from '../shared/Button'
import { BottomSheet, SheetCloseButton } from '../shared/BottomSheet'
import { ClawdeMark } from '../shared/ClawdeMark'
import { useUnits } from '../../store/useSettingsStore'
import { toWeight } from '../../lib/units'
import { formatWorkoutTime, type WorkoutSummary } from '../../lib/workoutSummary'
import { buildShareFile, formatVolume, shareFile } from '../../lib/shareCard'
import type { Rating, SessionOutcome } from '../../types'

export interface SessionCompleteData {
  feelings: Rating
  painNotes: string
  generalNotes: string
  outcome: SessionOutcome
}

interface CompleteFlowProps {
  sessionTitle: string
  /** The breakdown shown at the top (absent for the invite-only sheet). */
  summary?: WorkoutSummary
  isLastSessionOfWeek: boolean
  /** Saves the session. The sheet stays open if there's a week invitation to show. */
  onSave: (data: SessionCompleteData) => void
  /** The athlete accepted the week-done invitation: open a check-in. */
  onCheckIn: () => void
  /** The athlete declined it ("Not now"): snooze until the next trigger. */
  onNotNow: () => void
  /** Close the sheet after saving (navigates away). */
  onFinish: () => void
  onDismiss: () => void
  /** Start on the invitation (the session was saved elsewhere). */
  initialStep?: 'session' | 'invite'
}

/**
 * "Workout complete": Clawde, the session's stats and any new PBs, a Share
 * button that makes a square summary image, then how it felt. On the last
 * session of the week the sheet then *invites* a one-minute check-in:
 * optional, never a forced extra step.
 */
export function CompleteFlow({ sessionTitle, summary, isLastSessionOfWeek, onSave, onCheckIn, onNotNow, onFinish, onDismiss, initialStep = 'session' }: CompleteFlowProps) {
  const [feelings, setFeelings] = useState<Rating>(4)
  const [painNotes, setPainNotes] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const [outcome, setOutcome] = useState<SessionOutcome>('as-planned')
  const [showNotes, setShowNotes] = useState(false)
  const [step, setStep] = useState<'session' | 'invite'>(initialStep)

  function handleSave() {
    onSave({ feelings, painNotes, generalNotes, outcome })
    if (isLastSessionOfWeek) setStep('invite')
    else onFinish()
  }

  const feelingLabels = ['', '💀 Terrible', '😓 Poor', '😐 OK', '💪 Good', '🔥 Great']

  return (
    // Typed notes shouldn't vanish on a stray tap, so only the ✕ dismisses it.
    <BottomSheet label={step === 'session' ? 'Workout complete' : 'Week done'} onClose={step === 'session' ? onDismiss : onNotNow} dismissOnBackdrop={false}>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {step === 'session' ? (
          <>
            <div className="flex items-start justify-between px-5 pt-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 -m-2 rounded-full bg-[#d97756]/20 blur-xl" aria-hidden />
                  <ClawdeMark size={56} cheer sweat className="relative" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xs font-semibold text-[#d97756] uppercase tracking-widest">Workout complete</p>
                  <h3 className="text-lg font-bold text-[#f5f5f0] leading-tight truncate">{sessionTitle}</h3>
                </div>
              </div>
              <SheetCloseButton onClose={onDismiss} />
            </div>

            <div className="px-5 pt-4 pb-edge flex flex-col gap-5">
              {summary && <Breakdown summary={summary} />}

              {/* Feelings rating */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={15} className="text-[#d97756]" />
                  <p className="text-sm font-medium text-[#a8a29e]">How did it feel?</p>
                </div>
                <div className="flex gap-2">
                  {([1, 2, 3, 4, 5] as Rating[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setFeelings(r)}
                      aria-pressed={feelings === r}
                      className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                        feelings === r
                          ? 'bg-[#d97756] text-white shadow-lg shadow-[#d97756]/20'
                          : 'bg-[#1a1a1a] text-[#4a4a4a] hover:bg-[#2a2a2a]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#6a6a6a] text-center mt-2">{feelingLabels[feelings]}</p>
              </div>

              <button
                onClick={() => setShowNotes((n) => !n)}
                aria-expanded={showNotes}
                className="flex items-center gap-2 text-sm text-[#a8a29e] self-start py-1"
              >
                Add notes for Clawde {showNotes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showNotes && (
                <div className="flex flex-col gap-5 fade-in">
                  <div>
                    <label htmlFor="complete-pain" className="block text-sm font-medium text-[#a8a29e] mb-2">Any pain or discomfort?</label>
                    <textarea
                      id="complete-pain"
                      value={painNotes}
                      onChange={(e) => setPainNotes(e.target.value)}
                      placeholder="e.g. Left shoulder clicking on overhead movements"
                      rows={2}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#3a3a3a] resize-none focus:outline-none focus:border-[#d97756]/50"
                    />
                  </div>
                  <div>
                    <label htmlFor="complete-notes" className="block text-sm font-medium text-[#a8a29e] mb-2">Anything else to note?</label>
                    <textarea
                      id="complete-notes"
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                      placeholder="e.g. Felt strong on bench, could go heavier next time"
                      rows={2}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#3a3a3a] resize-none focus:outline-none focus:border-[#d97756]/50"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#a8a29e] mb-2">Did it go to plan?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([['as-planned', 'As planned'], ['modified', 'Changed it']] as const).map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => setOutcome(v)}
                          aria-pressed={outcome === v}
                          className={`py-2.5 rounded-2xl text-sm font-medium transition-all ${
                            outcome === v ? 'bg-[#d97756] text-white' : 'bg-[#1a1a1a] text-[#6a6a6a] border border-[#2a2a2a]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {outcome === 'modified' && (
                      <p className="text-xs text-[#6a6a6a] mt-2">Say what changed in the note above. Clawde reads it when planning next week.</p>
                    )}
                  </div>
                </div>
              )}

              <Button onClick={handleSave} fullWidth size="lg">
                Save Session
              </Button>
            </div>
          </>
        ) : (
          <div className="px-5 pt-6 pb-edge flex flex-col items-center text-center gap-4">
            <p className="text-4xl" aria-hidden>🎉</p>
            <div>
              <h3 className="text-lg font-bold text-[#f5f5f0]">That's your week done</h3>
              <p className="text-sm text-[#6a6a6a] mt-1 leading-relaxed">
                Session saved. 1-minute check-in? Your answers shape next week's plan. Totally optional.
              </p>
            </div>
            <Button onClick={onCheckIn} fullWidth size="lg">
              Check in
            </Button>
            <Button variant="ghost" onClick={onNotNow} fullWidth>
              Not now
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/** The stats grid, new PBs and the Share button. */
function Breakdown({ summary }: { summary: WorkoutSummary }) {
  const unit = useUnits().weight
  const [file, setFile] = useState<File | null>(null)
  const [shareMsg, setShareMsg] = useState('')

  // Render the image now so Share can open the share sheet straight from the tap.
  useEffect(() => {
    let cancelled = false
    buildShareFile(summary, unit).then((f) => { if (!cancelled) setFile(f) }, () => {})
    return () => { cancelled = true }
  }, [summary, unit])

  async function share() {
    if (!file) return
    const result = await shareFile(file, summary.title)
    setShareMsg(result === 'downloaded' ? 'Image saved to your downloads.' : '')
  }

  const stats = [
    { icon: <Clock size={16} className="text-[#d97756]" />, value: formatWorkoutTime(summary.durationSeconds), label: 'Workout time' },
    { icon: <Weight size={16} className="text-blue-400" />, value: formatVolume(summary.totalVolumeKg, unit), label: 'Total lifted' },
    { icon: <Dumbbell size={16} className="text-emerald-400" />, value: String(summary.exercises), label: summary.exercises === 1 ? 'Exercise' : 'Exercises' },
    { icon: <Layers size={16} className="text-purple-400" />, value: String(summary.sets), label: summary.sets === 1 ? 'Set' : 'Sets' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-[#6a6a6a]">{s.icon}{s.label}</div>
            <p className="text-xl font-bold text-[#f5f5f0] mt-1 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {summary.pbs.length > 0 && (
        <div className="rounded-2xl bg-[#d97756]/10 border border-[#d97756]/25 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#d97756] uppercase tracking-widest">
            <Trophy size={14} /> {summary.pbs.length} new PB{summary.pbs.length > 1 ? 's' : ''}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {summary.pbs.map((pb) => (
              <li key={pb.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-[#f5f5f0] font-medium truncate">{pb.name}</span>
                <span className="text-[#a8a29e] tabular-nums shrink-0">
                  {toWeight(pb.weightKg, unit)} {unit} × {pb.reps}
                  <span className="text-[#6a6a6a]"> · was {toWeight(pb.previousKg, unit)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button variant="secondary" onClick={share} disabled={!file} fullWidth>
        <Share2 size={16} />
        Share workout
      </Button>
      <p role="status" className="text-xs text-[#6a6a6a] text-center empty:hidden">{shareMsg}</p>
    </div>
  )
}
