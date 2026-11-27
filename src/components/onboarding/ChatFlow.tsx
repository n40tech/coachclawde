import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, Send } from 'lucide-react'
import { QuinnMark } from '../shared/QuinnMark'
import { Button } from '../shared/Button'
import { ChoiceChip, ChoiceGroup } from '../shared/Choice'
import { TimeInput } from '../shared/TimeInput'
import {
  answerLabel, fieldsOf, optionsOf, splitInline, walk,
  type ChatOption, type CompoundField, type Flow, type FlowAnswers, type FlowContext, type FlowNode, type FlowValue,
} from '../../lib/flow'
import { WEEK_DAYS_MON, toLocalISODate } from '../../lib/weekUtils'
import { scrollBehavior } from '../../lib/viewTransition'

interface ChatFlowProps {
  flow: Flow
  answers: FlowAnswers
  ctx: FlowContext
  onAnswer: (id: string, answer: FlowValue) => void
  /** Clear the answer to `id` (and everything after it) so it can be re-answered. */
  onRewind: (id: string) => void
  /** Bubbles Quinn says once the flow is finished. */
  endLines: string[]
  /** Shown under the closing bubbles (e.g. the confirmation card). */
  endContent?: ReactNode
  /** The composer area once finished (e.g. a Continue button). */
  endAction: ReactNode
  /** Earlier answers to start composers from (re-entering the tree at a node). */
  initialDrafts?: FlowAnswers
}

const DONE_ID = '__done'

/** How long Quinn "types" before a bubble appears, scaled to its length. */
function typingDelay(line: string, isFirst: boolean): number {
  if (isFirst) return 450
  return Math.min(1300, 350 + line.length * 9)
}

/**
 * A chat with Quinn, driven by a flow-as-data graph (lib/flow): onboarding's
 * goal tree, a check-in, or the migration check-in. Quinn asks one node at a
 * time; the athlete answers with chips or a short reply. Tapping an earlier
 * answer rewinds the chat to that question.
 */
export function ChatFlow({ flow, answers, ctx, onAnswer, onRewind, endLines, endContent, endAction, initialDrafts }: ChatFlowProps) {
  const { path, next } = walk(flow, answers)
  const current: FlowNode | undefined = flow.nodes[next]
  const currentId = current?.id ?? DONE_ID
  const currentLines = current ? current.coach(answers, ctx) : endLines
  // The last bubble of the current turn is the question: it names the reply box.
  const questionId = useId()

  // How many of each node's coach bubbles have been revealed. Once shown, a
  // node stays shown, so rewinding to it doesn't replay the typing.
  const [revealed, setRevealed] = useState<Record<string, number>>({})
  // Answers cleared by a rewind, so the composer starts from them.
  const [drafts, setDrafts] = useState<FlowAnswers>(initialDrafts ?? {})
  const shownCount = revealed[currentId] ?? 0
  const typing = shownCount < currentLines.length
  const nextLine = currentLines[shownCount] ?? ''

  useEffect(() => {
    if (!typing) return
    const t = setTimeout(
      () => setRevealed((r) => ({ ...r, [currentId]: shownCount + 1 })),
      typingDelay(nextLine, shownCount === 0),
    )
    return () => clearTimeout(t)
  }, [typing, currentId, shownCount, nextLine])

  // Keep the latest message in view: scroll to a sentinel after the sticky
  // composer (the true end of the page), so a closing card isn't hidden
  // behind the composer.
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'end' })
  }, [currentId, shownCount, typing])

  function rewind(id: string) {
    // Keep every answer being cleared as a draft, so re-answering the later
    // questions is just a quick tap through.
    setDrafts((d) => ({ ...d, ...answers }))
    onRewind(id)
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* A chat log: each new bubble Quinn adds is read out (role="log" is a
          polite live region for content appended at the end). */}
      <div role="log" aria-label="Chat with Quinn" className="flex-1 flex flex-col gap-2 px-4 pt-4 pb-4">
        {path.map((id) => {
          const node = flow.nodes[id]
          return (
            <div key={id} className="flex flex-col gap-2">
              {node.coach(answers, ctx).map((line, i, lines) => (
                <CoachBubble key={i} text={line} showAvatar={i === lines.length - 1} />
              ))}
              <UserBubble text={answerLabel(node, answers[id]!, answers)} onClick={() => rewind(id)} />
            </div>
          )
        })}

        <div key={currentId} className="flex flex-col gap-2">
          {currentLines.slice(0, shownCount).map((line, i) => (
            <CoachBubble
              key={i}
              id={i === currentLines.length - 1 ? questionId : undefined}
              text={line}
              showAvatar={!typing && i === shownCount - 1}
              animate
            />
          ))}
          {typing && <TypingBubble />}
          {!current && !typing && endContent && <div className="fade-in">{endContent}</div>}
        </div>

        {path.length > 0 && !typing && current && (
          <p className="text-2xs text-haze text-center mt-1">Tap any of your answers to change it</p>
        )}
      </div>

      {/* Composer: rides on top of the keyboard (`--kb`) so the reply box stays in view. */}
      <div className="kb-dock sticky bottom-(--kb) bg-abyss/95 backdrop-blur-xl border-t border-slush px-4 pt-3 pb-safe">
        {typing ? (
          <div className="h-12" aria-hidden />
        ) : current ? (
          <Composer key={current.id} node={current} answers={answers} draft={drafts[current.id]} questionId={questionId} onSubmit={(a) => onAnswer(current.id, a)} />
        ) : (
          <div className="pb-2 fade-in">{endAction}</div>
        )}
      </div>
      <div ref={bottomRef} aria-hidden />
    </div>
  )
}

// --- bubbles --------------------------------------------------------------------

function Avatar({ visible }: { visible: boolean }) {
  return (
    <div className="w-8 shrink-0 flex items-end">
      {visible && <QuinnMark size={30} idle={false} />}
    </div>
  )
}

function CoachBubble({ id, text, showAvatar, animate }: { id?: string; text: string; showAvatar: boolean; animate?: boolean }) {
  return (
    <div className={`flex items-end gap-2 pr-10 ${animate ? 'fade-in' : ''}`}>
      <Avatar visible={showAvatar} />
      <div className="bg-slush border border-rime rounded-2xl rounded-bl-md px-3.5 py-2.5">
        <p id={id} className="text-sm text-snow leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <Avatar visible />
      {/* Visual only: announcing "typing" before every line would be noise. */}
      <div aria-hidden className="bg-slush border border-rime rounded-2xl rounded-bl-md px-4 py-3.5 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-deep" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

function UserBubble({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <div className="flex justify-end pl-12 mb-2">
      <button
        onClick={onClick}
        className="bg-accent-fill text-white rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm text-left leading-relaxed whitespace-pre-wrap active:scale-[0.98] transition-transform"
        aria-label={`Change answer: ${text}`}
      >
        {text}
      </button>
    </div>
  )
}

// --- composers ------------------------------------------------------------------

function chipClass(active: boolean): string {
  return `px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95 ${
    active
      ? 'bg-accent-fill text-white shadow-lg shadow-ice/20'
      : 'bg-slush text-frost border border-rime hover:text-snow'
  }`
}

const inputClass =
  'flex-1 min-w-0 bg-slush border border-deep rounded-2xl px-4 py-3 text-base text-snow placeholder-haze focus:outline-none focus:border-ice focus:ring-1 focus:ring-ice transition-colors'

function SkipChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="self-center text-xs text-frost hover:text-snow py-2 px-3 rounded-xl border border-rime bg-floe ice">
      {label}
    </button>
  )
}

function Composer({
  node, answers, draft, questionId, onSubmit,
}: {
  node: FlowNode
  answers: FlowAnswers
  draft: FlowValue | undefined
  /** Id of the question bubble, which names a free-text reply. */
  questionId: string
  onSubmit: (answer: FlowValue) => void
}) {
  switch (node.kind) {
    case 'single':
      return <SingleChoice options={optionsOf(node, answers)} selected={typeof draft === 'string' ? draft : undefined} questionId={questionId} onSubmit={onSubmit} />
    case 'multi': {
      const initial = Array.isArray(draft) ? draft : node.preselect?.(answers) ?? []
      return <MultiChoice node={node} options={optionsOf(node, answers)} initial={initial} questionId={questionId} onSubmit={onSubmit} />
    }
    case 'date':
      return <DateReply node={node} initial={typeof draft === 'string' && draft !== node.skip?.value ? draft : ''} questionId={questionId} onSubmit={onSubmit} />
    case 'days':
      return <DaysReply initial={draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {}} questionId={questionId} onSubmit={onSubmit} />
    case 'compound':
      return <CompoundReply node={node} fields={fieldsOf(node, answers)} initial={draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : undefined} onSubmit={onSubmit} />
    default:
      return <TextReply node={node} initial={typeof draft === 'string' ? draft : ''} questionId={questionId} onSubmit={onSubmit} />
  }
}

/**
 * Tapping an option answers straight away, so these are buttons (actions),
 * grouped and named by Quinn's question.
 */
function SingleChoice({
  options, selected, questionId, onSubmit,
}: { options: ChatOption[]; selected: string | undefined; questionId: string; onSubmit: (a: FlowValue) => void }) {
  const [open, setOpen] = useState<ChatOption | null>(() => {
    const s = splitInline(selected)
    return options.find((o) => o.input && o.value === s.value) ?? null
  })
  const withHints = options.some((o) => o.hint)

  if (open) return <InlineInput option={open} initial={splitInline(selected).payload} onBack={() => setOpen(null)} onSubmit={onSubmit} />

  return (
    <div role="group" aria-labelledby={questionId} className={`fade-in pb-2 ${withHints ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'}`}>
      {options.map((o) => {
        const active = selected === o.value || (!!o.input && splitInline(selected).value === o.value)
        const click = () => (o.input ? setOpen(o) : onSubmit(o.value))
        return withHints ? (
          <button
            key={o.value}
            type="button"
            onClick={click}
            className={`flex items-center justify-between gap-3 text-left px-4 py-2.5 rounded-2xl border transition-all duration-150 active:scale-[0.98] ${
              active ? 'bg-ice/12 border-ice/50' : 'bg-floe ice border-rime hover:border-rime-2'
            }`}
          >
            <span className="text-sm font-semibold text-snow">{o.label}</span>
            {o.hint && <span className="text-xs text-mist text-right">{o.hint}</span>}
          </button>
        ) : (
          <button key={o.value} type="button" onClick={click} className={chipClass(active)}>
            {o.label}{o.input ? '…' : ''}
          </button>
        )
      })}
    </div>
  )
}

/** The input revealed by an option like "A time…" or "Yes, a date…". */
function InlineInput({
  option, initial, onBack, onSubmit,
}: { option: ChatOption; initial: string; onBack: () => void; onSubmit: (a: FlowValue) => void }) {
  const [text, setText] = useState(initial)
  const [seconds, setSeconds] = useState(Number(initial) || 0)
  const today = toLocalISODate(new Date())
  const ok = option.input === 'duration' ? seconds > 0 : option.input === 'date' ? text >= today : !!text.trim()
  const payload = option.input === 'duration' ? String(seconds) : text.trim()
  return (
    <div className="fade-in flex flex-col gap-3 pb-2">
      <p className="text-xs text-frost">{option.label}</p>
      {option.input === 'duration' && <TimeInput seconds={seconds} showHours={option.hours} onChange={setSeconds} label={option.label} />}
      {option.input === 'date' && (
        <input type="date" value={text} min={today} onChange={(e) => setText(e.target.value)} className={inputClass} style={{ colorScheme: 'dark' }} aria-label={option.label} autoFocus />
      )}
      {option.input === 'text' && (
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={option.placeholder} className={inputClass} aria-label={option.label} autoFocus />
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button fullWidth disabled={!ok} onClick={() => onSubmit(`${option.value}:${payload}`)}>Done</Button>
      </div>
    </div>
  )
}

function MultiChoice({
  node, options, initial, questionId, onSubmit,
}: { node: FlowNode; options: ChatOption[]; initial: string[]; questionId: string; onSubmit: (a: FlowValue) => void }) {
  const [selected, setSelected] = useState<string[]>(initial)
  const toggle = (v: string) =>
    setSelected((s) => {
      if (s.includes(v)) return s.filter((x) => x !== v)
      // "All good" clears the rest; picking anything else clears "All good".
      if (node.exclusive === v) return [v]
      const base = node.exclusive ? s.filter((x) => x !== node.exclusive) : s
      if (node.max && base.length >= node.max) return base
      return [...base, v]
    })
  // Keep answers in the option order, whatever order they were tapped in.
  const ordered = options.map((o) => o.value).filter((v) => selected.includes(v))

  return (
    <div className="fade-in flex flex-col gap-3 pb-2">
      {/* Checkboxes, named as a group by Quinn's question. */}
      <div role="group" aria-labelledby={questionId} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o.value)
          return (
            <ChoiceChip key={o.value} type="checkbox" name={`multi-${node.id}`} value={o.value} checked={active} onChange={() => toggle(o.value)} className={chipClass(active)}>
              <span className="inline-flex items-center gap-1.5">
                {active && <Check size={14} strokeWidth={2.5} aria-hidden />}
                {o.label}
              </span>
            </ChoiceChip>
          )
        })}
      </div>
      <Button fullWidth onClick={() => onSubmit(ordered)} disabled={ordered.length === 0}>
        Done
      </Button>
    </div>
  )
}

function TextReply({
  node, initial, questionId, onSubmit,
}: { node: FlowNode; initial: string; questionId: string; onSubmit: (a: FlowValue) => void }) {
  const [value, setValue] = useState(initial)
  const trimmed = value.trim()

  function send() {
    if (trimmed) onSubmit(trimmed)
  }

  // A form, so Enter sends through the browser's own implicit submission,
  // which waits for an input method (Japanese, Chinese, Korean…) to finish
  // composing instead of sending half a word.
  return (
    <div className="fade-in flex flex-col gap-2 pb-2">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        {node.multiline ? (
          <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={node.placeholder} rows={3} autoFocus aria-labelledby={questionId} className={`${inputClass} resize-y field-sizing-content min-h-24 max-h-[50svh]`} />
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(node.kind === 'number' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
            enterKeyHint="send"
            placeholder={node.placeholder}
            inputMode={node.kind === 'number' ? 'numeric' : 'text'}
            autoFocus
            aria-labelledby={questionId}
            className={inputClass}
          />
        )}
        <button
          type="submit"
          disabled={!trimmed}
          aria-label="Send"
          className="w-12 h-12 shrink-0 rounded-2xl bg-accent-fill text-white flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
        >
          <Send size={18} aria-hidden />
        </button>
      </form>
      {node.optional && <SkipChip label="Skip" onClick={() => onSubmit('')} />}
      {node.skip && <SkipChip label={node.skip.label} onClick={() => onSubmit(node.skip!.value)} />}
    </div>
  )
}

function DateReply({ node, initial, questionId, onSubmit }: { node: FlowNode; initial: string; questionId: string; onSubmit: (a: FlowValue) => void }) {
  const [value, setValue] = useState(initial)
  const today = toLocalISODate(new Date())
  return (
    <div className="fade-in flex flex-col gap-2 pb-2">
      <div className="flex items-center gap-2">
        <input type="date" value={value} min={today} onChange={(e) => setValue(e.target.value)} className={inputClass} style={{ colorScheme: 'dark' }} aria-labelledby={questionId} />
        <Button onClick={() => onSubmit(value)} disabled={!value || value < today}>Done</Button>
      </div>
      {node.skip && <SkipChip label={node.skip.label} onClick={() => onSubmit(node.skip!.value)} />}
    </div>
  )
}

/** Tap a day once for training, twice for a match, three times to clear. */
function DaysReply({ initial, questionId, onSubmit }: { initial: Record<string, string>; questionId: string; onSubmit: (a: FlowValue) => void }) {
  const [days, setDays] = useState<Record<string, string>>(initial)
  const cycle = (d: string) =>
    setDays((cur) => {
      const nextKind = !cur[d] ? 'training' : cur[d] === 'training' ? 'match' : undefined
      const copy = { ...cur }
      if (nextKind) copy[d] = nextKind
      else delete copy[d]
      return copy
    })
  const any = Object.keys(days).length > 0
  return (
    <div className="fade-in flex flex-col gap-3 pb-2">
      <div role="group" aria-labelledby={questionId} className="flex justify-between gap-1.5">
        {WEEK_DAYS_MON.map((d) => {
          const kind = days[d]
          return (
            <button
              key={d}
              type="button"
              onClick={() => cycle(d)}
              aria-label={`${d}: ${kind ?? 'free'}`}
              className={`flex-1 aspect-square max-w-12 rounded-full text-xs font-semibold flex flex-col items-center justify-center ${
                kind === 'match' ? 'bg-accent-fill text-white' : kind === 'training' ? 'bg-ice/25 text-snow border border-ice/50' : 'bg-slush text-mist border border-rime'
              }`}
            >
              <span aria-hidden>{d[0]}</span>
              {kind && <span aria-hidden className="text-[0.55rem] leading-none mt-0.5">{kind === 'match' ? 'MATCH' : 'TRAIN'}</span>}
            </button>
          )
        })}
      </div>
      <Button fullWidth onClick={() => onSubmit(days)}>{any ? 'Done' : 'No fixed days'}</Button>
    </div>
  )
}

function CompoundReply({
  node, fields, initial, onSubmit,
}: { node: FlowNode; fields: CompoundField[]; initial: Record<string, string> | undefined; onSubmit: (a: FlowValue) => void }) {
  const [values, setValues] = useState<Record<string, string>>(
    () => initial ?? Object.fromEntries(fields.filter((f) => f.initial).map((f) => [f.key, f.initial!])),
  )
  const set = (k: string, v: string) => setValues((cur) => ({ ...cur, [k]: v }))
  const complete = fields.every((f) => f.optional || (values[f.key] && values[f.key] !== '0'))
  const anyLift = fields.some((f) => f.kind === 'lift' && /^\d+(\.\d+)?x\d+$/.test(values[f.key] ?? ''))
  const ok = complete && (!fields.some((f) => f.kind === 'lift') || anyLift)

  return (
    <div className="fade-in flex flex-col gap-3 pb-2">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          {f.kind === 'chips' ? (
            <ChoiceGroup legend={f.label} legendClassName="block text-2xs uppercase tracking-widest text-mist mb-1.5" className="flex flex-wrap gap-2">
              {(f.options ?? []).map((o) => (
                <ChoiceChip key={o.value} name={`${node.id}-${f.key}`} value={o.value} checked={values[f.key] === o.value} onChange={() => set(f.key, o.value)} className={chipClass(values[f.key] === o.value)}>
                  {o.label}
                </ChoiceChip>
              ))}
            </ChoiceGroup>
          ) : (
            <span aria-hidden className="text-2xs uppercase tracking-widest text-mist">{f.label}</span>
          )}
          {f.kind === 'duration' && (
            <TimeInput
              key={String(f.hours?.(values))}
              seconds={Number(values[f.key]) || 0}
              showHours={f.hours?.(values) ?? true}
              onChange={(s) => set(f.key, s ? String(s) : '')}
              label={f.label}
            />
          )}
          {f.kind === 'lift' && <LiftInput label={f.label} value={values[f.key] ?? ''} onChange={(v) => set(f.key, v)} />}
        </div>
      ))}
      <Button fullWidth disabled={!ok} onClick={() => onSubmit(values)}>Done</Button>
      {node.skip && <SkipChip label={node.skip.label} onClick={() => onSubmit(node.skip!.value)} />}
    </div>
  )
}

/** kg × reps, stored as "100x5". */
function LiftInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [kg, reps] = value.split('x')
  const box = 'w-20 bg-slush border border-deep rounded-xl px-2 py-2 text-base text-center text-snow placeholder-haze focus:outline-none focus:border-ice focus:ring-1 focus:ring-ice'
  const emit = (k: string, r: string) => onChange(k && r ? `${k}x${r}` : k || r ? `${k}x${r}` : '')
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <input className={box} inputMode="decimal" placeholder="kg" aria-label="Weight in kg" value={kg ?? ''} onChange={(e) => emit(e.target.value.replace(/[^0-9.]/g, ''), reps ?? '')} />
      <span aria-hidden className="text-haze">×</span>
      <input className={box} inputMode="numeric" placeholder="reps" aria-label="Reps" value={reps ?? ''} onChange={(e) => emit(kg ?? '', e.target.value.replace(/[^0-9]/g, ''))} />
    </div>
  )
}
