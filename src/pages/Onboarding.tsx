import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAutoSync } from '../hooks/useAutoSync'
import { Button } from '../components/shared/Button'
import { ClawdeMark } from '../components/shared/ClawdeMark'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ChoiceChip, ChoiceGroup } from '../components/shared/Choice'
import { chipLook } from '../components/shared/chipLook'
import { FixedLayer } from '../components/layout/FixedLayer'
import {
  ACTIVITY_LABEL, WHERE_LABEL, basicsFromProfile, profileFromBasics,
  type ActivityLevel, type BasicAnswers, type TrainWhere,
} from '../lib/basicOnboarding'
import {
  ArrowRight, ChevronDown, ChevronLeft, ChevronUp, Check, Share, Smartphone, MoreVertical, Sparkles,
} from 'lucide-react'

const EMPTY: BasicAnswers = {
  name: '', activity: '1-2x', where: [], injuries: '', medical: false, cleared: false, notes: '',
}

/**
 * First-run onboarding: one short form with the basics (name, gender, age,
 * how active you are, where you train, injuries, anything else), then a
 * finish screen with install-to-home-screen tips. Everything else is asked
 * when it matters (the planner, check-ins).
 *
 * An onboarded athlete reaching this page (Settings, or a check-in saying the
 * goal changed) gets the same form pre-filled, and saving goes straight home.
 */
export function Onboarding() {
  const navigate = useNavigate()
  const profile = useAppStore((s) => s.profile)
  const setProfile = useAppStore((s) => s.setProfile)
  const { sync } = useAutoSync()
  const returning = !!profile.onboarded

  const [now] = useState(() => new Date())
  const [a, setA] = useState<BasicAnswers>(() => (returning ? basicsFromProfile(profile, now) : EMPTY))
  const [activityChosen, setActivityChosen] = useState(returning)
  useDocumentTitle(returning ? 'Your basics' : 'Welcome')
  const [step, setStep] = useState<'form' | 'finish'>('form')
  const [finishing, setFinishing] = useState(false)
  const [tried, setTried] = useState(false)

  const set = (patch: Partial<BasicAnswers>) => setA((x) => ({ ...x, ...patch }))
  const valid = activityChosen && a.where.length > 0

  function save() {
    setProfile(profileFromBasics(a, now, profile))
    void sync('profile')
  }

  function handleNext() {
    setTried(true)
    if (!valid) return
    if (returning) {
      save()
      navigate('/', { replace: true })
    } else {
      setStep('finish')
    }
  }

  function handleFinish() {
    save()
    // Play the flight, then drop the athlete on the home screen.
    setFinishing(true)
    setTimeout(() => navigate('/', { replace: true }), 950)
  }

  if (finishing) return <FlightToHome name={a.name} />

  return (
    <div className="flex flex-col min-h-svh bg-[#0a0a0a]">
      {!returning && (
        <div className="sticky top-0 z-10 bg-[#0a0a0a] px-5 pt-safe pb-2">
          <div className="flex gap-1.5 pt-4">
            {['form', 'finish'].map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= (step === 'form' ? 0 : 1) ? 'bg-[#d97756]' : 'bg-[#222]'}`} />
            ))}
          </div>
        </div>
      )}

      <div key={step} className={`flex-1 flex flex-col px-5 pb-6 fade-in ${returning ? 'pt-safe' : 'pt-6'}`}>
        {step === 'form' ? (
          <BasicsForm a={a} set={set} activityChosen={activityChosen} onActivity={(v) => { set({ activity: v }); setActivityChosen(true) }} tried={tried} returning={returning} />
        ) : (
          <FinishStep name={a.name} />
        )}
      </div>

      {/* Footer nav */}
      <div className="px-5 pb-edge">
        <div className="flex items-center gap-3">
          {step === 'finish' ? (
            <Button variant="ghost" onClick={() => setStep('form')} aria-label="Back">
              <ChevronLeft size={18} />
              Back
            </Button>
          ) : returning ? (
            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          ) : null}
          <div className="flex-1" />
          {step === 'form' ? (
            <Button onClick={handleNext}>
              {returning ? 'Save' : 'Next'} <ArrowRight size={18} />
            </Button>
          ) : (
            <Button onClick={handleFinish}>
              <Sparkles size={18} />
              Enter Coach Clawde
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- steps ------------------------------------------------------------------

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#f5f5f0] leading-tight">{title}</h1>
      {subtitle && <p className="text-sm text-[#949494] mt-2 leading-relaxed">{subtitle}</p>}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-[#1a1a1a] border border-[#666666] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#858585] focus:outline-none focus:border-[#d97756] focus:ring-1 focus:ring-[#d97756] transition-colors"
    />
  )
}

/** A field's visible label: a real `<label>` when it names one input (`htmlFor`). */
function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  const className = 'block text-xs font-medium text-[#a8a29e] mb-2'
  return htmlFor ? <label htmlFor={htmlFor} className={className}>{children}</label> : <p className={className}>{children}</p>
}

/** One option: a native radio (`name` shared by the group) or checkbox. */
function Chip({ type = 'radio', name, value, on, onClick, children }: {
  type?: 'radio' | 'checkbox'
  name: string
  value: string
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <ChoiceChip type={type} name={name} value={value} checked={on} onChange={onClick} className={chipLook(on)}>
      {children}
    </ChoiceChip>
  )
}

const GROUP_LEGEND = 'block text-xs font-medium text-[#a8a29e] mb-2'

function BasicsForm({ a, set, activityChosen, onActivity, tried, returning }: {
  a: BasicAnswers
  set: (patch: Partial<BasicAnswers>) => void
  activityChosen: boolean
  onActivity: (v: ActivityLevel) => void
  /** Next was pressed: show what's missing. */
  tried: boolean
  returning: boolean
}) {
  const [more, setMore] = useState(!!a.notes)
  // "Other" is a choice of its own: an unanswered gender shows nothing picked.
  const [other, setOther] = useState(returning && !a.sex)
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClawdeMark size={44} sweat />
        <StepHeading
          title={returning ? 'Your basics' : 'Hi, I’m Clawde'}
          subtitle={returning ? 'Update anything that’s changed.' : 'A few basics and we’re lifting. Everything else I’ll ask when it matters.'}
        />
      </div>
      <div className="flex flex-col gap-6">
        <div>
          <FieldLabel htmlFor="ob-name">What should I call you?</FieldLabel>
          <TextInput id="ob-name" autoComplete="given-name" autoCapitalize="words" value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your name" />
        </div>

        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <ChoiceGroup legend="Gender" legendClassName={GROUP_LEGEND} className="grid grid-cols-3 gap-1.5">
            <Chip name="ob-gender" value="male" on={a.sex === 'male'} onClick={() => { set({ sex: 'male' }); setOther(false) }}>Male</Chip>
            <Chip name="ob-gender" value="female" on={a.sex === 'female'} onClick={() => { set({ sex: 'female' }); setOther(false) }}>Female</Chip>
            <Chip name="ob-gender" value="other" on={other} onClick={() => { set({ sex: undefined }); setOther(true) }}>Other</Chip>
          </ChoiceGroup>
          <div>
            <FieldLabel htmlFor="ob-age">Age</FieldLabel>
            <TextInput
              id="ob-age"
              inputMode="numeric"
              value={a.age ? String(a.age) : ''}
              onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '').slice(0, 3)); set({ age: n || undefined }) }}
              placeholder="30"
            />
          </div>
        </div>

        <div>
          <ChoiceGroup legend={<>How active are you right now? <span aria-hidden>*</span><span className="sr-only">(required)</span></>} legendClassName={GROUP_LEGEND} className="grid grid-cols-2 gap-2">
            {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((v) => (
              <Chip key={v} name="ob-activity" value={v} on={activityChosen && a.activity === v} onClick={() => onActivity(v)}>{ACTIVITY_LABEL[v]}</Chip>
            ))}
          </ChoiceGroup>
          {tried && !activityChosen && <p role="alert" className="text-xs text-red-400 mt-2">Pick the closest one.</p>}
        </div>

        <div>
          <ChoiceGroup legend={<>Where will you train? <span aria-hidden>*</span><span className="sr-only">(required, pick any)</span></>} legendClassName={GROUP_LEGEND} className="flex flex-wrap gap-2">
            {(Object.keys(WHERE_LABEL) as TrainWhere[]).map((v) => {
              const on = a.where.includes(v)
              return (
                <Chip key={v} type="checkbox" name="ob-where" value={v} on={on} onClick={() => set({ where: on ? a.where.filter((w) => w !== v) : [...a.where, v] })}>
                  {WHERE_LABEL[v]}
                </Chip>
              )
            })}
          </ChoiceGroup>
          {tried && !a.where.length && <p role="alert" className="text-xs text-red-400 mt-2">Pick at least one, so I only plan exercises you can do.</p>}
        </div>

        <div>
          <FieldLabel htmlFor="ob-injuries">Any injuries or niggles?</FieldLabel>
          <textarea
            id="ob-injuries"
            value={a.injuries}
            onChange={(e) => set({ injuries: e.target.value })}
            placeholder="One per line, e.g. Left knee sore on deep squats"
            rows={2}
            className="w-full bg-[#1a1a1a] border border-[#666666] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#858585] resize-y field-sizing-content min-h-24 max-h-[50svh] focus:outline-none focus:border-[#d97756] focus:ring-1 focus:ring-[#d97756]"
          />
          <label className="mt-3 flex items-start gap-3 text-sm text-[#a8a29e]">
            <input type="checkbox" checked={a.medical} onChange={(e) => set({ medical: e.target.checked, cleared: false })} className="mt-0.5 w-5 h-5 accent-[#d97756] shrink-0" />
            I have a medical or heart condition, or I’m pregnant
          </label>
          {a.medical && (
            <div className="mt-3 rounded-2xl bg-[#161616] border border-[#2a2a2a] p-3.5 fade-in">
              <p className="text-xs text-[#a8a29e] leading-relaxed">Thanks for telling me. Please check with your GP or physio before starting. I’ll keep things moderate until you’re cleared. No details needed.</p>
              <label className="mt-3 flex items-start gap-3 text-sm text-[#a8a29e]">
                <input type="checkbox" checked={a.cleared} onChange={(e) => set({ cleared: e.target.checked })} className="mt-0.5 w-5 h-5 accent-[#d97756] shrink-0" />
                A GP or physio has cleared me to train
              </label>
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            className="flex items-center gap-2 text-sm text-[#a8a29e] py-1"
          >
            Anything else Clawde should know? {more ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
          </button>
          {more && (
            <textarea
              aria-label="Anything else Clawde should know"
              value={a.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Goals, sports you play, lifts you love or hate…"
              rows={3}
              className="mt-2 w-full bg-[#1a1a1a] border border-[#666666] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#858585] resize-y field-sizing-content min-h-24 max-h-[50svh] focus:outline-none focus:border-[#d97756] focus:ring-1 focus:ring-[#d97756] fade-in"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function FinishStep({ name }: { name: string }) {
  const first = name.trim().split(' ')[0]
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-6">
        <div className="relative">
          <div className="absolute inset-0 -m-4 rounded-full bg-[#d97756]/15 blur-2xl" aria-hidden />
          <ClawdeMark size={104} cheer sweat className="relative" />
        </div>
        <h1 className="text-3xl font-bold text-[#f5f5f0]">
          You're all set{first ? `, ${first}` : ''}!
        </h1>
        <p className="text-sm text-[#949494] leading-relaxed max-w-xs">
          Your profile's ready. Head to the home screen and plan your first week.
          I'll have a personalised plan waiting.
        </p>
      </div>
      <InstallTips />
    </div>
  )
}

/** Collapsible "add to home screen" instructions for the athlete's platform. */
function InstallTips() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  // iPadOS Safari reports a Mac user agent; a touch-capable "Mac" is an iPad.
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (typeof navigator !== 'undefined' && /Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const isAndroid = /android/i.test(ua)
  const installed =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches
  const [open, setOpen] = useState(false)

  if (installed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
        <Check size={18} className="text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-200/90">You're already running the installed app. Nice.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[#161616] border border-[#2a2a2a]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0">
          <Smartphone size={16} className="text-[#d97756]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#f5f5f0]">Add Coach Clawde to your home screen</p>
          <p className="text-xs text-[#949494]">Full-screen and offline-ready. No app store needed.</p>
        </div>
        {open ? <ChevronUp size={16} className="text-[#858585]" /> : <ChevronDown size={16} className="text-[#858585]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 fade-in">
          {!isAndroid && (
            <InstallCard
              icon={<Share size={18} className="text-[#d97756]" />}
              platform="iPhone & iPad (Safari)"
              highlight={isIOS}
              steps={[
                'Tap the Share button in the toolbar',
                "Scroll down and tap 'Add to Home Screen'",
                "Tap 'Add' in the top corner",
              ]}
            />
          )}
          {!isIOS && (
            <InstallCard
              icon={<MoreVertical size={18} className="text-[#d97756]" />}
              platform="Android (Chrome)"
              highlight={isAndroid}
              steps={[
                'Tap the ⋮ menu, top-right',
                "Tap 'Add to Home screen' or 'Install app'",
                "Confirm with 'Add' / 'Install'",
              ]}
            />
          )}
          {!isIOS && !isAndroid && (
            <p className="text-xs text-[#949494] px-1">
              On desktop, look for the <Smartphone size={12} className="inline -mt-0.5" /> install
              icon in your browser's address bar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function InstallCard({
  icon, platform, steps, highlight,
}: { icon: React.ReactNode; platform: string; steps: string[]; highlight: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${
      highlight ? 'bg-[#d97756]/8 border-[#d97756]/30' : 'bg-[#111] border-[#2a2a2a]'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-[#1a1a1a] flex items-center justify-center">{icon}</div>
        <p className="text-sm font-semibold text-[#f5f5f0]">{platform}</p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#d97756]/15 text-[#d97756] text-2xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-sm text-[#a8a29e] leading-snug">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * The closing flourish — Clawde flies from the centre of the finish screen up to
 * the spot it lives in on the home header, then we navigate home.
 */
function FlightToHome({ name }: { name: string }) {
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLanded(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <FixedLayer>
      <div className="absolute inset-0 z-50 bg-[#0a0a0a] overflow-hidden">
        <p
          className="absolute left-0 right-0 text-center text-sm text-[#949494] transition-opacity duration-300"
          style={{ top: '58%', opacity: landed ? 0 : 1 }}
        >
          See you in there{name.trim() ? `, ${name.trim().split(' ')[0]}` : ''}…
        </p>
        <div
          className="clawde-flight absolute"
          style={{
            // Landing point tracks Home's mascot: below the status bar, and
            // centred in the content column (offset by the sidebar on iPad).
            left: 'var(--flight-x)',
            top: landed ? 'var(--flight-landing-y)' : '42vh',
            transform: `translate(-50%, 0) scale(${landed ? 0.72 : 1.2})`,
            opacity: landed ? 0 : 1,
          }}
        >
          <ClawdeMark size={96} sweat />
        </div>
      </div>
    </FixedLayer>
  )
}
