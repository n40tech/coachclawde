import { crabCells } from './crabArt'
import { formatWorkoutTime, type WorkoutSummary } from './workoutSummary'
import { toWeight, type WeightUnit } from './units'
import { formatSessionDate } from './dateUtils'

/**
 * Square (1080 × 1080) workout images to share, in three designs. All are a
 * premium monotone grey: charcoal with the website's dot grid, Clawde large in
 * greys, the website's pixel lettering for numbers and the wordmark at the
 * foot.
 */
export type ShareStyle = 'summary' | 'headline' | 'log'

export const SHARE_STYLES: { id: ShareStyle; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'headline', label: 'Headline' },
  { id: 'log', label: 'Logbook' },
]

const SIZE = 1080
const PAD = 84
const BG_TOP = '#1b1a19'
const BG_BOTTOM = '#080808'
const PANEL = 'rgba(255,255,255,0.045)'
const LINE = 'rgba(255,255,255,0.09)'
const INK = '#f2f1ee'
const INK_2 = '#9b9792'
const INK_3 = '#64605c'
const PIXEL = '"Tiny5", "Space Mono", monospace'
const MONO = '"Space Mono", ui-monospace, monospace'
const SANS = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif"

/** Clawde in greys: same pixels, monotone. */
const GREY: Record<string, string> = {
  '#d97756': '#8d8984', // body
  '#bd5f38': '#5c5955', // legs
  '#2a1712': '#141312', // eyes
  '#fbf7f0': '#e9e7e3', // sweatband
}

/** "12.4 t", "8,450 kg" or the lb equivalent. */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = toWeight(kg, unit)
  if (unit === 'kg' && v >= 10000) return `${(v / 1000).toFixed(1)} t`
  return `${Math.round(v).toLocaleString('en-GB')} ${unit}`
}

/** Short form for tight spaces: "850kg", "1.5t", "3.3k lb". */
export function formatVolumeCompact(kg: number, unit: WeightUnit): string {
  const v = Math.round(toWeight(kg, unit))
  if (v < 1000) return `${v}${unit}`
  return unit === 'kg' ? `${+(v / 1000).toFixed(1)}t` : `${+(v / 1000).toFixed(1)}k${unit}`
}

/** The site's fonts must be loaded before a canvas can draw with them. */
export async function loadShareFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all([
    document.fonts.load(`80px ${PIXEL}`),
    document.fonts.load(`700 30px ${MONO}`),
    document.fonts.load(`400 30px ${MONO}`),
  ]).catch(() => undefined)
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

/** The largest font size (≤ start) at which `text` fits `max` wide. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, max: number): number {
  let px = start
  ctx.font = font(px)
  while (px > 12 && ctx.measureText(text).width > max) {
    px -= 4
    ctx.font = font(px)
  }
  return px
}

function crab(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  for (const c of crabCells()) {
    ctx.fillStyle = GREY[c.fill] ?? '#8d8984'
    ctx.fillRect(x + c.x * cell, y + c.y * cell, cell + 0.6, cell + 0.6)
  }
}

function backdrop(ctx: CanvasRenderingContext2D, glowX: number, glowY: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE)
  bg.addColorStop(0, BG_TOP)
  bg.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE, SIZE)
  // A soft grey light behind Clawde.
  const glow = ctx.createRadialGradient(glowX, glowY, 10, glowX, glowY, 460)
  glow.addColorStop(0, 'rgba(255,255,255,0.10)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, SIZE, SIZE)
  // The website's dot grid.
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let y = 12; y < SIZE; y += 24) for (let x = 12; x < SIZE; x += 24) ctx.fillRect(x, y, 2, 2)
}

/** Small crab mark + COACH CLAWDE wordmark, bottom-left; the date bottom-right. */
function footer(ctx: CanvasRenderingContext2D, date: string) {
  const y = SIZE - PAD
  crab(ctx, PAD, y - 34, 3.2)
  ctx.fillStyle = INK
  ctx.font = `700 26px ${MONO}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('COACH CLAWDE', PAD + 58, y - 6)
  ctx.fillStyle = INK_3
  ctx.font = `400 24px ${MONO}`
  const d = formatSessionDate(date).toUpperCase()
  ctx.fillText(d, SIZE - PAD - ctx.measureText(d).width, y - 6)
  ctx.strokeStyle = LINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, y - 66)
  ctx.lineTo(SIZE - PAD, y - 66)
  ctx.stroke()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour = INK_2) {
  ctx.fillStyle = colour
  ctx.font = `700 24px ${MONO}`
  ctx.fillText(text.toUpperCase(), x, y)
}

function stats(s: WorkoutSummary, unit: WeightUnit): [string, string][] {
  return [
    [formatWorkoutTime(s.durationSeconds).replace(' ', ''), 'Time'],
    [formatVolume(s.totalVolumeKg, unit).replace(' ', ''), 'Lifted'],
    [String(s.sets), s.sets === 1 ? 'Set' : 'Sets'],
    [String(s.reps), s.reps === 1 ? 'Rep' : 'Reps'],
  ]
}

/** Design 1: title, a big Clawde and four stats. */
function drawSummary(ctx: CanvasRenderingContext2D, s: WorkoutSummary, unit: WeightUnit) {
  backdrop(ctx, SIZE - 260, 250)
  crab(ctx, SIZE - PAD - 13 * 30, 92, 30)
  ctx.textBaseline = 'alphabetic'
  label(ctx, 'Workout complete', PAD, 150)
  ctx.fillStyle = INK
  const titleMax = SIZE - PAD * 2 - 13 * 30 - 24
  ctx.font = `800 64px ${SANS}`
  const words = s.title.split(' ')
  // Up to two lines of title beside Clawde.
  let line = ''
  const out: string[] = []
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > titleMax && line) { out.push(line); line = w } else line = next
  }
  out.push(line)
  out.slice(0, 2).forEach((l, i) => ctx.fillText(fit(ctx, l, titleMax), PAD, 232 + i * 72))
  if (s.pbs.length) label(ctx, `★ ${s.pbs.length} new PB${s.pbs.length > 1 ? 's' : ''}`, PAD, 232 + Math.min(out.length, 2) * 72 + 20, INK)

  const gap = 20
  const w = (SIZE - PAD * 2 - gap) / 2
  const h = 196
  const top = 520
  stats(s, unit).forEach(([value, name], i) => {
    const x = PAD + (i % 2) * (w + gap)
    const y = top + Math.floor(i / 2) * (h + gap)
    ctx.fillStyle = PANEL
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 28)
    ctx.fill()
    ctx.strokeStyle = LINE
    ctx.lineWidth = 2
    ctx.stroke()
    const px = fitSize(ctx, value, (n) => `${n}px ${PIXEL}`, 96, w - 64)
    ctx.font = `${px}px ${PIXEL}`
    ctx.fillStyle = INK
    ctx.fillText(value, x + 32, y + 118)
    label(ctx, name, x + 32, y + 162, INK_3)
  })
  footer(ctx, s.date)
}

/** Design 2: Clawde huge, one giant number (the top PB, else total lifted). */
function drawHeadline(ctx: CanvasRenderingContext2D, s: WorkoutSummary, unit: WeightUnit) {
  backdrop(ctx, SIZE / 2, 300)
  const cell = 34
  crab(ctx, (SIZE - 13 * cell) / 2, 96, cell)
  const pb = s.pbs[0]
  const big = pb ? `${toWeight(pb.weightKg, unit)}${unit} × ${pb.reps}` : formatVolume(s.totalVolumeKg, unit).replace(' ', '')
  const kicker = pb ? `New PB · ${pb.name}` : 'Total lifted'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK_2
  ctx.font = `700 26px ${MONO}`
  ctx.fillText(fit(ctx, kicker.toUpperCase(), SIZE - PAD * 2), SIZE / 2, 618)
  const px = fitSize(ctx, big.toUpperCase(), (n) => `${n}px ${PIXEL}`, 168, SIZE - PAD * 2)
  ctx.font = `${px}px ${PIXEL}`
  ctx.fillStyle = INK
  ctx.fillText(big.toUpperCase(), SIZE / 2, 618 + 26 + px * 0.86)
  ctx.fillStyle = INK_3
  ctx.font = `400 26px ${MONO}`
  const sub = [s.title, formatWorkoutTime(s.durationSeconds), `${s.sets} sets`].join('  ·  ').toUpperCase()
  ctx.fillText(fit(ctx, sub, SIZE - PAD * 2), SIZE / 2, 618 + 26 + px * 0.86 + 64)
  ctx.textAlign = 'left'
  footer(ctx, s.date)
}

/** Design 3: a logbook of every exercise, best set on the right. */
function drawLog(ctx: CanvasRenderingContext2D, s: WorkoutSummary, unit: WeightUnit) {
  backdrop(ctx, SIZE - 220, 200)
  crab(ctx, SIZE - PAD - 13 * 22, 86, 22)
  ctx.textBaseline = 'alphabetic'
  label(ctx, 'Logbook', PAD, 130)
  ctx.fillStyle = INK
  ctx.font = `800 58px ${SANS}`
  ctx.fillText(fit(ctx, s.title, SIZE - PAD * 2 - 13 * 22 - 30), PAD, 204)
  ctx.fillStyle = INK_2
  ctx.font = `400 26px ${MONO}`
  ctx.fillText(`${formatWorkoutTime(s.durationSeconds).toUpperCase()} · ${formatVolume(s.totalVolumeKg, unit).toUpperCase()}`, PAD, 252)

  const shown = s.lines.slice(0, 7)
  // Below Clawde (his feet end at y ≈ 350).
  const top = 430
  const row = Math.min(80, (SIZE - PAD - 110 - top) / Math.max(1, shown.length))
  const pbNames = new Set(s.pbs.map((p) => p.name.toLowerCase()))
  shown.forEach((l, i) => {
    const y = top + i * row
    const best = l.seconds != null && !l.bestReps
      ? `${l.sets} × ${l.seconds}s`
      : `${l.sets} × ${l.bestKg ? `${toWeight(l.bestKg, unit)}${unit} × ` : ''}${l.bestReps}`
    ctx.font = `700 30px ${MONO}`
    const bw = ctx.measureText(best).width
    ctx.fillStyle = INK
    ctx.fillText(best, SIZE - PAD - bw, y)
    ctx.font = `500 32px ${SANS}`
    ctx.fillStyle = pbNames.has(l.name.toLowerCase()) ? INK : '#cfccc8'
    const name = `${pbNames.has(l.name.toLowerCase()) ? '★ ' : ''}${l.name}`
    ctx.fillText(fit(ctx, name, SIZE - PAD * 2 - bw - 40), PAD, y)
    ctx.strokeStyle = LINE
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD, y + row / 2 - 8)
    ctx.lineTo(SIZE - PAD, y + row / 2 - 8)
    ctx.stroke()
  })
  if (s.lines.length > shown.length) {
    ctx.fillStyle = INK_3
    ctx.font = `400 24px ${MONO}`
    ctx.fillText(`+ ${s.lines.length - shown.length} MORE`, PAD, top + shown.length * row)
  }
  footer(ctx, s.date)
}

/** Draws one design onto a new 1080 × 1080 canvas. Load the fonts first (loadShareFonts). */
export function drawShareCard(summary: WorkoutSummary, unit: WeightUnit, style: ShareStyle = 'summary'): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  if (style === 'headline') drawHeadline(ctx, summary, unit)
  else if (style === 'log') drawLog(ctx, summary, unit)
  else drawSummary(ctx, summary, unit)
  return canvas
}

/** One design as a PNG file. Built ahead of the tap: iOS only opens the share sheet straight from one. */
export async function buildShareFile(summary: WorkoutSummary, unit: WeightUnit, style: ShareStyle = 'summary'): Promise<File> {
  await loadShareFonts()
  const canvas = drawShareCard(summary, unit, style)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not create the image')
  return new File([blob], `workout-${summary.date}-${style}.png`, { type: 'image/png' })
}

/**
 * Shares the image (the share sheet on phones), or downloads it where files
 * can't be shared. Call it directly from the tap.
 */
export async function shareFile(file: File, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Fall through to a download.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
