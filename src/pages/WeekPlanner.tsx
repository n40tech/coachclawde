import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/shared/Button'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { BottomSheet, SheetCloseButton } from '../components/shared/BottomSheet'
import { Card, CardSection } from '../components/shared/Card'
import { buildConvertPlanPrompt, buildWeekPlanPrompt } from '../lib/promptBuilder'
import { applyCheckIn, plannerPrefill } from '../lib/checkIn'
import { plannerInvitation } from '../lib/checkInTriggers'
import type { CheckIn, RunsWith, UserProfile, WeekPlan } from '../types'
import { importPlanFromJson } from '../lib/export'
import { dropPastSessions, placePlan, previousPlan, repeatPlan } from '../lib/planImport'
import { PLAN_TEMPLATES, planFromTemplate, type PlanTemplate } from '../lib/planTemplates'
import { useAutoSync } from '../hooks/useAutoSync'
import {
  WEEK_DAYS_MON,
  addDays,
  getMonday,
  getNextMonday,
  isDayPastThisWeek,
  parseLocalISODate,
  resolveWeekStart,
  toLocalISODate,
} from '../lib/weekUtils'
import type { DayOfWeek } from '../types'
import { Badge } from '../components/shared/Badge'
import { Copy, Check, Download, AlertCircle, CalendarClock, Dumbbell, ExternalLink, MessageCircle, Repeat, Sparkles } from 'lucide-react'
import { OpenClaudeButton } from '../components/shared/OpenClaudeButton'
import { openClaudeApp } from '../lib/openClaude'
import { format } from 'date-fns'

const SESSION_LENGTH_OPTIONS = [30, 45, 60, 75, 90] as const

export function WeekPlanner() {
  const navigate = useNavigate()
  const { getCurrentWeekPlan, weekPlans, addWeekPlan, updateWeekPlan, profile, loggedSessions, checkIns, checkInDismissed, dismissCheckIn, setProfile } = useAppStore()

  const today = new Date()
  const seedPlan = getCurrentWeekPlan()
  const tracker = !!profile.goal?.tracker

  // A recent check-in pre-fills the planner for the week after the one it
  // reviewed: days (one fewer if asked), session length and notes.
  const [prefill] = useState(() => {
    const ci = latestWeeklyCheckIn(checkIns)
    const stale = ci && today.getTime() - Date.parse(ci.createdAt) > 10 * 24 * 60 * 60 * 1000
    if (!ci || stale || (seedPlan && seedPlan.weekStartDate > ci.weekStartDate)) return null
    const reviewed = weekPlans.find((p) => p.weekStartDate === ci.weekStartDate)
    const p = plannerPrefill(ci)
    const days = reviewed?.availableDays ?? []
    return {
      days: p.fewerDays && days.length > 1 ? days.slice(0, -1) : days,
      minutes: p.sessionMinutes,
      notes: p.notes.join(' '),
      nextWeek: ci.weekStartDate === toLocalISODate(getMonday(today)),
      hasChanges: !!(p.sessionMinutes || p.fewerDays || p.notes.length),
    }
  })

  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(prefill?.days.length ? prefill.days : seedPlan?.availableDays ?? [])
  const [notes, setNotes] = useState(prefill ? prefill.notes : seedPlan?.userNotes ?? '')
  // Target minutes per session: from the check-in, else the current plan's
  // average so a replan keeps the same length by default.
  const [sessionMinutes, setSessionMinutes] = useState<number>(() => {
    if (prefill?.minutes) return prefill.minutes
    const mins = seedPlan?.sessions.map((s) => s.estimatedMinutes).filter((m) => m > 0) ?? []
    if (!mins.length) return profile.goal?.constraints.sessionMinutes ?? 60
    const avg = mins.reduce((a, b) => a + b, 0) / mins.length
    return SESSION_LENGTH_OPTIONS.reduce<number>((best, o) => (Math.abs(o - avg) < Math.abs(best - avg) ? o : best), 60)
  })
  // Whether the athlete has explicitly opted to plan next week (e.g. they want
  // to train on a weekday that has already passed this week).
  const [planNextWeek, setPlanNextWeek] = useState(
    prefill ? prefill.nextWeek : seedPlan ? seedPlan.weekStartDate === toLocalISODate(getNextMonday(today)) : false
  )
  // Day pending a "this will move the plan to next week" confirmation.
  const [confirmDay, setConfirmDay] = useState<DayOfWeek | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptText, setPromptText] = useState('')
  const [copied, setCopied] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  // Generate hands off to the Claude app; these track that round trip.
  const [launching, setLaunching] = useState(false)
  const [appMissing, setAppMissing] = useState(false)
  const [awaitingImport, setAwaitingImport] = useState(false)
  // A plan waiting on "Replace your plan?" / "Plan the rest of this week?".
  const [pending, setPending] = useState<PendingPlan | null>(null)
  // "Every day has passed" for Repeat or a prewritten plan, shown by that control.
  const [quickError, setQuickError] = useState<{ source: string; week: string; text: string } | null>(null)
  const { sync } = useAutoSync()

  // Coming back from the Claude app with a plan to paste: open the import
  // sheet straight away so it's one tap to paste.
  useEffect(() => {
    if (!awaitingImport) return
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return
      setAwaitingImport(false)
      setShowPrompt(false)
      setShowImport(true)
    }
    document.addEventListener('visibilitychange', onReturn)
    return () => document.removeEventListener('visibilitychange', onReturn)
  }, [awaitingImport])

  // The Monday the plan targets. Days already past this week force next week;
  // otherwise the plan stays in the current week.
  const weekStart = resolveWeekStart(selectedDays, today, planNextWeek)
  const weekStartISO = toLocalISODate(weekStart)
  const weekLabel = weekRange(weekStartISO)
  const todayISO = toLocalISODate(today)
  // A plan already exists for the *target* week — importing replaces it.
  const existingPlan = weekPlans.find((p) => p.weekStartDate === weekStartISO)
  // The plan "Repeat" copies: the latest one before the target week.
  const lastPlan = previousPlan(weekPlans, weekStartISO)
  const lastPlanName = lastPlan
    ? lastPlan.weekStartDate === toLocalISODate(addDays(weekStart, -7))
      ? 'last week'
      : `the week of ${format(parseLocalISODate(lastPlan.weekStartDate), 'd MMM')}`
    : ''

  function toggleDay(day: DayOfWeek) {
    const alreadySelected = selectedDays.includes(day)
    // Picking a day that has already passed this week is only possible next
    // week — confirm the shift before selecting it.
    if (!planNextWeek && !alreadySelected && isDayPastThisWeek(day, today)) {
      setConfirmDay(day)
      return
    }
    setSelectedDays((prev) =>
      alreadySelected ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function confirmPlanNextWeek() {
    if (!confirmDay) return
    setPlanNextWeek(true)
    setSelectedDays((prev) => (prev.includes(confirmDay) ? prev : [...prev, confirmDay]))
    setConfirmDay(null)
  }

  function switchToThisWeek() {
    setPlanNextWeek(false)
    // Drop any selected days that have already passed this week.
    setSelectedDays((prev) => prev.filter((d) => !isDayPastThisWeek(d, today)))
  }

  // Step 0: suggest a check-in for the week before the one being planned.
  const checkInWeek = plannerInvitation({ profile, weekPlans, loggedSessions, checkIns, dismissed: checkInDismissed }, weekStartISO)

  function buildPrompt() {
    const prompt = tracker
      ? buildConvertPlanPrompt(notes, selectedDays, weekStart, profile)
      : buildWeekPlanPrompt(selectedDays, notes, sessionMinutes, existingPlan, weekStart, profile, loggedSessions, checkIns)
    setPromptText(prompt)
    return prompt
  }

  async function copyPrompt(prompt: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      return true
    } catch {
      // Clipboard may be unavailable (e.g. insecure context).
      setCopied(false)
      return false
    }
  }

  /**
   * One tap: build the prompt, copy it, and jump straight into the Claude app
   * so the athlete only has to paste. Falls back to the prompt sheet (with a
   * claude.ai link) when the clipboard or the app isn't available.
   */
  async function handleGeneratePrompt() {
    const prompt = buildPrompt()
    setAppMissing(false)
    const copiedOk = await copyPrompt(prompt)
    if (!copiedOk) {
      setShowPrompt(true)
      return
    }
    setLaunching(true)
    const opened = await openClaudeApp(prompt)
    setLaunching(false)
    // Always leave the prompt sheet up behind the hand-off: "opened" is only a
    // guess (on desktop, the browser's "Open Claude?" dialog counts), so the
    // athlete needs the prompt and the claude.ai link if they cancel.
    setAppMissing(!opened)
    setShowPrompt(true)
    if (opened) setAwaitingImport(true)
  }

  /** Show the prompt instead of launching Claude (e.g. to paste elsewhere). */
  async function handleShowPrompt() {
    const prompt = buildPrompt()
    setAppMissing(false)
    setShowPrompt(true)
    await copyPrompt(prompt)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(promptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function flashCopied() {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * Stores a plan in the week it was written for (see `placePlan`): a plan for
   * the same week is replaced, keeping its completed sessions; any other week
   * is left alone.
   */
  function commitPlan(plan: WeekPlan) {
    const { plan: placed, replaces } = placePlan(weekPlans, loggedSessions, plan)
    if (replaces) updateWeekPlan(replaces.id, placed)
    else addWeekPlan(placed)
    setPending(null)
    // Sync plans in background
    void sync('plans')
    navigate('/')
  }

  /**
   * Commits a plan, first asking when it would replace a week's plan or leave
   * out days that have passed. `askBeforeReplacing` is off for an import into
   * the week on screen, which the banner above the import button already
   * warns about.
   */
  function offerPlan(plan: WeekPlan, what: string, skipped: DayOfWeek[] = [], askBeforeReplacing = true) {
    const replacing = weekPlans.some((p) => p.weekStartDate === plan.weekStartDate)
    if ((replacing && askBeforeReplacing) || skipped.length) setPending({ plan, what, skipped, replacing })
    else commitPlan(plan)
  }

  function handleImport() {
    setImportError('')
    setImporting(true)
    try {
      const parsed = importPlanFromJson(importJson)
      // A plan goes into the week it was written for, not the week on screen.
      // Only a plan for the week on screen takes the planner's days and notes.
      const forThisScreen = parsed.weekStartDate === weekStartISO
      const plan = forThisScreen && selectedDays.length ? { ...parsed, availableDays: selectedDays, userNotes: notes } : parsed
      setShowImport(false)
      offerPlan(plan, 'The plan you pasted', [], !forThisScreen)
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON')
    } finally {
      setImporting(false)
    }
  }

  /** Builds this week's plan from another (Repeat, prewritten), minus days already gone. */
  function offerCopy(full: WeekPlan, source: string, what: string) {
    const { plan, skipped } = dropPastSessions(full, todayISO)
    if (!plan.sessions.length) {
      setQuickError({ source, week: weekStartISO, text: `Every one of those days has already passed this week.` })
      return
    }
    setQuickError(null)
    offerPlan(plan, what, skipped)
  }

  function handleRepeat() {
    if (!lastPlan) return
    offerCopy(repeatPlan(lastPlan, weekStartISO), 'repeat', `A copy of ${lastPlanName}`)
  }

  function handleTemplate(t: PlanTemplate) {
    offerCopy(planFromTemplate(t, weekStartISO), t.id, `The ${t.name}`)
  }

  function planNextWeekInstead() {
    setPlanNextWeek(true)
    setQuickError(null)
  }

  /** "Every day has passed" for one control, with a way out. Always in the page so it's announced. */
  function quickAlert(source: string) {
    const err = quickError?.source === source && quickError.week === weekStartISO ? quickError : null
    return (
      <div role="alert">
        {err && (
          <div className="mt-2 flex items-start gap-2 text-[#d97756] bg-[#d97756]/10 rounded-xl p-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs">
              {err.text}{' '}
              <button onClick={planNextWeekInstead} className="font-semibold underline">Plan next week</button>
            </p>
          </div>
        )}
      </div>
    )
  }

  const dayIndex = (day: DayOfWeek) => WEEK_DAYS_MON.indexOf(day)
  const orderedDays = [...selectedDays].sort((a, b) => dayIndex(a) - dayIndex(b))

  return (
    <div className="flex flex-col min-h-svh bg-[#0a0a0a] pb-edge">
      <PageHeader
        title="Plan Your Week"
        subtitle={weekLabel}
        backTo="/"
      />

      <div className="flex flex-col gap-5 px-4 pt-4">
        {checkInWeek && !tracker && (
          <div className="rounded-3xl bg-[#161616] border border-[#d97756]/30 p-4 flex items-start gap-3 fade-in">
            <MessageCircle size={18} className="text-[#d97756] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#f5f5f0]">Quick check-in first?</p>
              <p className="text-sm text-[#a8a29e] mt-0.5">About a minute on last week. It shapes this plan.</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => navigate(`/check-in?trigger=planner&week=${checkInWeek}&key=planner:${checkInWeek}`)}>Check in</Button>
                <Button size="sm" variant="ghost" onClick={() => dismissCheckIn(`planner:${checkInWeek}`)}>Skip to planning</Button>
              </div>
            </div>
          </div>
        )}

        {prefill?.hasChanges && (
          <div className="flex items-center gap-2 text-xs text-[#a8a29e] px-1">
            <Sparkles size={14} className="text-[#d97756]" />
            Pre-filled from your check-in. Change anything you like.
          </div>
        )}

        {!tracker && <RunsWithCard profile={profile} onSave={(p) => { setProfile(p); void sync('profile') }} />}

        {/* Day selector */}
        <Card>
          <CardSection>
            <p className="text-sm font-medium text-[#a8a29e] mb-4">Which days can you train?</p>
            <div className="flex justify-between gap-1.5">
              {WEEK_DAYS_MON.map((day) => {
                const selected = selectedDays.includes(day)
                // Days earlier than today can't be trained this week, so dim
                // them — tapping one prompts to move the plan to next week.
                const past = !planNextWeek && isDayPastThisWeek(day, today)
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    aria-pressed={selected}
                    title={past ? `${day} has already passed this week` : undefined}
                    className={`
                      aspect-square flex-1 flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-150
                      ${selected
                        ? 'bg-[#d97756] text-white shadow-lg shadow-[#d97756]/25 scale-105'
                        : past
                          ? 'bg-[#141414] text-[#3a3a3a] border border-[#222] hover:text-[#5a5a5a]'
                          : 'bg-[#1a1a1a] text-[#6a6a6a] border border-[#2a2a2a] hover:bg-[#222] hover:text-[#a8a29e]'
                      }
                    `}
                  >
                    {day[0]}
                  </button>
                )
              })}
            </div>
            {orderedDays.length > 0 && (
              <p className="text-xs text-[#6a6a6a] mt-3 text-center">
                {orderedDays.length} day{orderedDays.length !== 1 ? 's' : ''} selected: {orderedDays.join(', ')}
              </p>
            )}
            {planNextWeek && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#161616] border border-[#2a2a2a] px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs text-[#a8a29e]">
                  <CalendarClock size={14} className="text-[#d97756]" />
                  Planning for next week
                </span>
                <button
                  onClick={switchToThisWeek}
                  className="text-xs font-medium text-[#d97756] hover:underline"
                >
                  Plan this week
                </button>
              </div>
            )}
          </CardSection>
        </Card>

        {/* Session length */}
        {!tracker && <Card>
          <CardSection>
            <p className="text-sm font-medium text-[#a8a29e] mb-3">How long per session?</p>
            {/* Equal-width chips that wrap to a second row at large text sizes. */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-1.5">
              {SESSION_LENGTH_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  onClick={() => setSessionMinutes(mins)}
                  aria-pressed={sessionMinutes === mins}
                  className={`
                    rounded-xl py-2 text-sm font-semibold transition-all duration-150
                    ${sessionMinutes === mins
                      ? 'bg-[#d97756] text-white shadow-lg shadow-[#d97756]/25'
                      : 'bg-[#1a1a1a] text-[#6a6a6a] border border-[#2a2a2a] hover:bg-[#222] hover:text-[#a8a29e]'
                    }
                  `}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </CardSection>
        </Card>}

        {/* Notes (tracker mode: the pasted plan) */}
        <Card>
          <CardSection>
            <label htmlFor="plan-notes" className="block text-sm font-medium text-[#a8a29e] mb-3">{tracker ? 'Paste this week of your plan' : 'Any extra context for Clawde?'}</label>
            <textarea
              id="plan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tracker
                ? 'e.g. Mon: 5 × 1 km @ 10K pace, 2 min jog. Wed: 40 min easy. Sat: long run 14 km.'
                : 'e.g. Going out Wednesday night, make Thursday light. Left shoulder feeling tight this week.'}
              rows={tracker ? 8 : 3}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#3a3a3a] resize-none focus:outline-none focus:border-[#d97756]/50 transition-colors"
            />
          </CardSection>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Button
              onClick={handleGeneratePrompt}
              disabled={selectedDays.length === 0}
              loading={launching}
              fullWidth
              size="lg"
            >
              {!launching && <ExternalLink size={18} />}
              {launching ? 'Opening Claude…' : tracker ? 'Convert with Claude' : 'Generate & Open Claude'}
            </Button>
            <button
              onClick={handleShowPrompt}
              disabled={selectedDays.length === 0}
              className="self-center text-xs text-[#6a6a6a] hover:text-[#a8a29e] py-1.5 px-3 disabled:opacity-40"
            >
              or just copy the prompt
            </button>
          </div>

          {existingPlan && (
            <div className="bg-[#d97756]/10 rounded-2xl border border-[#d97756]/20 px-4 py-3 flex items-start gap-3">
              <AlertCircle size={16} className="text-[#d97756] mt-0.5 shrink-0" />
              <p className="text-xs text-[#d97756]">
                You already have a plan for {planNextWeek ? 'next' : 'this'} week. Importing a new one will replace it.
              </p>
            </div>
          )}

          <Button variant="secondary" onClick={() => setShowImport(true)} fullWidth>
            <Download size={18} />
            Import Plan from Claude
          </Button>

          {lastPlan && (
            <div>
              <Button variant="secondary" onClick={handleRepeat} fullWidth>
                <Repeat size={18} />
                Repeat {lastPlanName}
              </Button>
              {quickAlert('repeat')}
            </div>
          )}
        </div>

        {/* Prewritten plans: a ready-made week in one tap */}
        <section aria-labelledby="prewritten-plans" className="flex flex-col gap-3">
          <h2 id="prewritten-plans" className="text-xs font-semibold text-[#6a6a6a] uppercase tracking-widest px-1">
            Prewritten plans
          </h2>
          {PLAN_TEMPLATES.map((t) => (
            <Card key={t.id}>
              <CardSection>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-[#f5f5f0]">
                    <Dumbbell size={16} className="text-[#d97756] shrink-0" aria-hidden />
                    {t.name}
                  </h3>
                  <Badge label={t.equipment} />
                </div>
                <p className="text-sm text-[#a8a29e] mt-2">{t.summary}</p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {t.sessions.map((s) => (
                    <li key={s.slug} className="flex flex-wrap justify-between gap-x-3 text-xs text-[#6a6a6a]">
                      <span><span className="font-semibold text-[#a8a29e]">{s.dayOfWeek}</span> {s.title}</span>
                      <span>{s.exercises.length} exercises · {s.estimatedMinutes} min</span>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="secondary" onClick={() => handleTemplate(t)} fullWidth className="mt-4">
                  Use for {weekLabel}
                </Button>
                {quickAlert(t.id)}
              </CardSection>
            </Card>
          ))}
        </section>

        {/* How it works */}
        <div className="rounded-2xl bg-[#161616] border border-[#2a2a2a] p-4">
          <p className="text-xs font-semibold text-[#6a6a6a] uppercase tracking-widest mb-3">How it works</p>
          <div className="flex flex-col gap-2.5">
            {[
              ['1', 'Select your training days above'],
              ['2', 'Pick a session length and add any notes (injuries, events, energy)'],
              ['3', 'Tap Generate — the Claude app opens with your prompt (profile, recent history, rules) ready to send'],
              ['4', 'Send it (if the chat is empty, just paste — the prompt is on your clipboard too)'],
              ['5', 'Copy the JSON Claude replies with, come back, and paste it into the import sheet'],
            ].map(([n, text]) => (
              <div key={n} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#d97756]/15 text-[#d97756] text-2xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                <p className="text-sm text-[#6a6a6a]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt Modal */}
      {showPrompt && (
        <BottomSheet label="Claude prompt" onClose={() => setShowPrompt(false)}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#f5f5f0]">
                {appMissing ? "Claude app didn't open" : 'Claude Prompt Ready'}
              </h3>
              {copied && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                  <Check size={13} /> Copied
                </span>
              )}
            </div>
            <SheetCloseButton onClose={() => setShowPrompt(false)} />
          </div>
          <p className="text-xs text-[#6a6a6a] px-5 pb-3">
            {appMissing
              ? 'Your prompt is copied. Open Claude in your browser (or try the app again) — it should be filled in; if not, paste it.'
              : copied
                ? 'Copied to your clipboard — paste it into Claude.'
                : 'Copy this and paste it into Claude.'}
          </p>
          <div className="flex-1 overflow-y-auto mx-4 mb-4">
            <pre className="bg-[#0a0a0a] rounded-2xl border border-[#2a2a2a] p-4 text-xs text-[#a8a29e] whitespace-pre-wrap font-mono leading-relaxed">
              {promptText}
            </pre>
          </div>
          <div className="px-4 pb-edge pt-2 flex flex-col gap-2">
            <OpenClaudeButton
              text={promptText}
              onCopied={flashCopied}
              appMissing={appMissing}
              onOpened={() => setAwaitingImport(true)}
            />
            <Button variant="ghost" onClick={handleCopy} fullWidth>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy again'}
            </Button>
          </div>
        </BottomSheet>
      )}

      {/* Import Modal */}
      {showImport && (
        <BottomSheet label="Import plan" onClose={() => setShowImport(false)} dismissOnBackdrop={!importJson.trim()}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-base font-semibold text-[#f5f5f0]">Import Plan</h3>
            <SheetCloseButton onClose={() => setShowImport(false)} />
          </div>
          <label htmlFor="import-json" className="block text-xs text-[#6a6a6a] px-5 pb-3">
            Paste the JSON block from Claude's response below.
          </label>
          <div className="flex-1 px-4 overflow-y-auto">
            <textarea
              id="import-json"
              aria-invalid={importError ? true : undefined}
              aria-describedby={importError ? 'import-error' : undefined}
              value={importJson}
              onChange={(e) => { setImportJson(e.target.value); setImportError('') }}
              placeholder='Paste the JSON block here... (the content between ```json and ```)'
              rows={10}
              className="w-full min-h-24 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#2a2a2a] resize-none focus:outline-none focus:border-[#d97756]/50 font-mono"
            />
            {/* Always in the page so a failed import is announced. */}
            <div role="alert">
              {importError && (
                <div className="mt-2 flex items-start gap-2 text-red-400 bg-red-500/10 rounded-xl p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
                  <p id="import-error" className="text-xs">{importError}</p>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 pb-edge pt-3 flex gap-3">
            <Button variant="secondary" onClick={() => setShowImport(false)} fullWidth>Cancel</Button>
            <Button onClick={handleImport} disabled={!importJson.trim()} loading={importing} fullWidth>
              Import Week
            </Button>
          </div>
        </BottomSheet>
      )}

      {/* Move-to-next-week confirmation */}
      {confirmDay && (
        <ConfirmDialog
          icon={<CalendarClock size={20} />}
          title="Plan for next week?"
          confirmLabel="Plan next week"
          onConfirm={confirmPlanNextWeek}
          onCancel={() => setConfirmDay(null)}
        >
          {confirmDay} has already passed this week. Selecting it will plan your whole week for
          next week instead.
        </ConfirmDialog>
      )}

      {/* Replace a week's plan / leave out days that have passed */}
      {pending && (
        <ConfirmDialog
          icon={pending.replacing ? <AlertCircle size={20} /> : <CalendarClock size={20} />}
          title={pending.replacing ? `Replace your plan for ${weekRange(pending.plan.weekStartDate)}?` : 'Plan the rest of this week?'}
          confirmLabel={pending.replacing ? 'Replace plan' : 'Add to this week'}
          onConfirm={() => commitPlan(pending.plan)}
          onCancel={() => setPending(null)}
        >
          {pending.replacing && (
            <>{pending.what} takes its place. Sessions you’ve already completed that week stay.{' '}</>
          )}
          {pending.skipped.length > 0 && (
            <>
              {listDays(pending.skipped)} {pending.skipped.length > 1 ? 'have' : 'has'} already passed, so{' '}
              {pending.skipped.length > 1 ? 'they’re' : 'it’s'} left out. To get every day, plan next week instead.
            </>
          )}
        </ConfirmDialog>
      )}
    </div>
  )
}

/** A plan waiting for the athlete to confirm it. */
interface PendingPlan {
  plan: WeekPlan
  /** What's coming in, as a sentence subject: "The Bond Split", "A copy of last week". */
  what: string
  /** Days left out because they've passed. */
  skipped: DayOfWeek[]
  /** A plan for that week exists and will be replaced. */
  replacing: boolean
}

/** "23 Nov – 29 Nov" for the week starting `weekStart` (local ISO Monday). */
function weekRange(weekStart: string): string {
  const monday = parseLocalISODate(weekStart)
  return `${format(monday, 'dd MMM')} – ${format(addDays(monday, 6), 'dd MMM')}`
}

/** "Mon", "Mon and Tue", "Mon, Tue and Wed". */
function listDays(days: DayOfWeek[]): string {
  return days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}` : days[0]
}

/** The newest weekly check-in (not reactive or migration). */
function latestWeeklyCheckIn(checkIns: CheckIn[]): CheckIn | undefined {
  return [...checkIns]
    .filter((c) => c.trigger !== 'reactive' && c.trigger !== 'migration')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

const RUNS_WITH: { value: RunsWith; label: string }[] = [
  { value: 'phone', label: 'Just my phone' },
  { value: 'watch', label: 'GPS watch' },
  { value: 'track', label: 'A track' },
  { value: 'treadmill', label: 'Treadmill' },
]

/**
 * A deferred onboarding question asked where it matters: before Claude plans
 * intervals, what can the athlete measure with? (A phone can't end an 800 m rep.)
 */
function RunsWithCard({ profile, onSave }: { profile: UserProfile; onSave: (patch: Partial<UserProfile>) => void }) {
  const [picked, setPicked] = useState<RunsWith[]>([])
  const due = profile.goal?.deferred.includes('runs-with') && profile.program?.exerciseTypes.includes('cardio')
  if (!due) return null
  function save() {
    const now = new Date()
    const checkIn: CheckIn = {
      id: 'runs-with', weekStartDate: toLocalISODate(getMonday(now)), createdAt: now.toISOString(), trigger: 'planner',
      answers: {}, actions: [{ kind: 'deferred', id: 'runs-with', value: picked.length ? picked : ['phone'] }], summary: '',
    }
    onSave(applyCheckIn(profile, checkIn, now))
  }
  return (
    <Card>
      <CardSection>
        <p className="text-sm font-medium text-[#a8a29e]">Before Clawde plans your runs: what do you run with?</p>
        <p className="text-xs text-[#6a6a6a] mt-1 mb-3">With just a phone, reps are set by time, because a phone can’t tell you when you’ve run 800 m.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {RUNS_WITH.map((o) => {
            const on = picked.includes(o.value)
            return (
              <button
                key={o.value}
                aria-pressed={on}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== o.value) : [...p, o.value]))}
                className={`px-3.5 py-2 rounded-2xl text-sm font-medium ${on ? 'bg-[#d97756] text-white' : 'bg-[#1a1a1a] text-[#a8a29e] border border-[#2a2a2a]'}`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
        <Button size="sm" onClick={save} disabled={!picked.length}>Save</Button>
      </CardSection>
    </Card>
  )
}
