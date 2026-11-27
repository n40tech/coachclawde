import { quinnCells, QUINN_COLS } from './penguinArt'
import { formatElapsed, type WorkoutSummary } from './workoutSummary'
import { toWeight, type WeightUnit } from './units'
import { formatSessionDate } from './dateUtils'

/**
 * Square (1080 × 1080) workout images to share, in three designs, in the
 * app's colours: deep Antarctic water lit from above, a fine frost grid,
 * Quinn large in his headband, stats as a list, and the wordmark at the foot.
 */
export type ShareStyle = 'summary' | 'headline' | 'log'

export const SHARE_STYLES: { id: ShareStyle; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'headline', label: 'Headline' },
  { id: 'log', label: 'Logbook' },
]

const SIZE = 1080
const PAD = 84
const BG_TOP = '#0b3350'
const BG_BOTTOM = '#030d16'
const LINE = 'rgba(170,225,255,0.16)'
const INK = '#f2faff'
const INK_2 = '#a9c9dd'
const INK_3 = '#6f93ab'
const ACCENT = '#f7c948'
// The app's one family (Saira) at two widths: condensed labels and
// ultra-condensed display numbers and titles.
const FAMILY = '"Saira", "Arial Narrow", system-ui, sans-serif'

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

/** The app's font must be loaded before a canvas can draw with them. */
export async function loadShareFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all([
    document.fonts.load(`700 condensed 30px ${FAMILY}`),
    document.fonts.load(`400 condensed 30px ${FAMILY}`),
    document.fonts.load(`600 ultra-condensed 60px ${FAMILY}`),
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

function quinn(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  for (const c of quinnCells()) {
    ctx.fillStyle = c.fill
    ctx.fillRect(x + c.x * cell, y + c.y * cell, cell + 0.6, cell + 0.6)
  }
}

function backdrop(ctx: CanvasRenderingContext2D, glowX: number, glowY: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE)
  bg.addColorStop(0, BG_TOP)
  bg.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE, SIZE)
  // Cold light from the surface, behind Quinn.
  const glow = ctx.createRadialGradient(glowX, glowY, 10, glowX, glowY, 480)
  glow.addColorStop(0, 'rgba(111,208,255,0.30)')
  glow.addColorStop(1, 'rgba(111,208,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, SIZE, SIZE)
  // A fine frost grid.
  ctx.fillStyle = 'rgba(190,235,255,0.05)'
  for (let y = 12; y < SIZE; y += 24) for (let x = 12; x < SIZE; x += 24) ctx.fillRect(x, y, 2, 2)
}

/** Small Quinn + COACH QUINN wordmark, bottom-left; the date bottom-right. */
function footer(ctx: CanvasRenderingContext2D, date: string) {
  const y = SIZE - PAD
  quinn(ctx, PAD, y - 40, 2)
  ctx.fillStyle = INK
  ctx.font = `700 condensed 26px ${FAMILY}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('COACH QUINN', PAD + 58, y - 6)
  ctx.fillStyle = INK_3
  ctx.font = `400 condensed 24px ${FAMILY}`
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
  ctx.font = `700 condensed 24px ${FAMILY}`
  ctx.fillText(text.toUpperCase(), x, y)
}

function stats(s: WorkoutSummary, unit: WeightUnit): [string, string][] {
  return [
    [formatElapsed(s.durationSeconds), 'Elapsed'],
    [formatVolume(s.totalVolumeKg, unit), 'Lifted'],
    [String(s.sets), s.sets === 1 ? 'Set' : 'Sets'],
    [String(s.reps), s.reps === 1 ? 'Rep' : 'Reps'],
  ]
}

/** Design 1: title, a big Quinn and four stats. */
function drawSummary(ctx: CanvasRenderingContext2D, s: WorkoutSummary, unit: WeightUnit) {
  backdrop(ctx, SIZE - 260, 250)
  quinn(ctx, SIZE - PAD - QUINN_COLS * 18, 92, 18)
  ctx.textBaseline = 'alphabetic'
  label(ctx, 'Workout complete', PAD, 150)
  ctx.fillStyle = INK
  const titleMax = SIZE - PAD * 2 - QUINN_COLS * 18 - 24
  ctx.font = `600 ultra-condensed 64px ${FAMILY}`
  const words = s.title.split(' ')
  // Up to two lines of title beside Quinn.
  let line = ''
  const out: string[] = []
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > titleMax && line) { out.push(line); line = w } else line = next
  }
  out.push(line)
  out.slice(0, 2).forEach((l, i) => ctx.fillText(fit(ctx, l, titleMax), PAD, 232 + i * 72))
  if (s.pbs.length) label(ctx, `★ ${s.pbs.length} new PB${s.pbs.length > 1 ? 's' : ''}`, PAD, 232 + Math.min(out.length, 2) * 72 + 20, ACCENT)

  // Stats as a list: label left, value right, rules between.
  const top = 560
  const row = 88
  const list = stats(s, unit)
  list.forEach(([value, name], i) => {
    const y = top + i * row
    label(ctx, name, PAD, y + 54, INK_3)
    ctx.fillStyle = INK
    ctx.font = `600 ultra-condensed 48px ${FAMILY}`
    const vw = ctx.measureText(value).width
    ctx.fillText(value, SIZE - PAD - vw, y + 60)
    if (i === list.length - 1) return // the footer's rule closes the list
    ctx.strokeStyle = LINE
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD, y + row)
    ctx.lineTo(SIZE - PAD, y + row)
    ctx.stroke()
  })
  footer(ctx, s.date)
}

/** Design 2: Quinn huge, one giant number (the top PB, else total lifted). */
function drawHeadline(ctx: CanvasRenderingContext2D, s: WorkoutSummary, unit: WeightUnit) {
  backdrop(ctx, SIZE / 2, 300)
  const cell = 22
  quinn(ctx, (SIZE - QUINN_COLS * cell) / 2, 90, cell)
  const pb = s.pbs[0]
  const big = pb ? `${toWeight(pb.weightKg, unit)} ${unit} × ${pb.reps}` : formatVolume(s.totalVolumeKg, unit)
  const kicker = pb ? `New PB · ${pb.name}` : 'Total lifted'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = pb ? ACCENT : INK_2
  ctx.font = `700 condensed 26px ${FAMILY}`
  ctx.fillText(fit(ctx, kicker.toUpperCase(), SIZE - PAD * 2), SIZE / 2, 618)
  const px = fitSize(ctx, big, (n) => `600 ultra-condensed ${n}px ${FAMILY}`, 150, SIZE - PAD * 2)
  ctx.font = `600 ultra-condensed ${px}px ${FAMILY}`
  ctx.fillStyle = INK
  ctx.fillText(big, SIZE / 2, 618 + 26 + px * 0.86)
  ctx.fillStyle = INK_3
  ctx.font = `400 condensed 26px ${FAMILY}`
  const sub = [s.title, formatElapsed(s.durationSeconds), `${s.sets} sets`].join('  ·  ').toUpperCase()
  ctx.fillText(fit(ctx, sub, SIZE - PAD * 2), SIZE / 2, 618 + 26 + px * 0.86 + 64)
  ctx.textAlign = 'left'
  footer(ctx, s.date)
}

/** Design 3: a logbook of every exercise, best set on the right. */
function drawLog(ctx: CanvasRenderingContext2D, s: WorkoutSummary, unit: WeightUnit) {
  backdrop(ctx, SIZE - 220, 200)
  quinn(ctx, SIZE - PAD - QUINN_COLS * 13, 86, 13)
  ctx.textBaseline = 'alphabetic'
  label(ctx, 'Logbook', PAD, 130)
  ctx.fillStyle = INK
  ctx.font = `600 ultra-condensed 58px ${FAMILY}`
  ctx.fillText(fit(ctx, s.title, SIZE - PAD * 2 - QUINN_COLS * 13 - 30), PAD, 204)
  ctx.fillStyle = INK_2
  ctx.font = `400 condensed 26px ${FAMILY}`
  ctx.fillText(`${formatElapsed(s.durationSeconds).toUpperCase()} · ${formatVolume(s.totalVolumeKg, unit).toUpperCase()}`, PAD, 252)

  const shown = s.lines.slice(0, 7)
  // Below Quinn (his feet end at y ≈ 346).
  const top = 430
  const row = Math.min(80, (SIZE - PAD - 110 - top) / Math.max(1, shown.length))
  const pbNames = new Set(s.pbs.map((p) => p.name.toLowerCase()))
  shown.forEach((l, i) => {
    const y = top + i * row
    const best = l.seconds != null && !l.bestReps
      ? `${l.sets} × ${l.seconds}s`
      : `${l.sets} × ${l.bestKg ? `${toWeight(l.bestKg, unit)}${unit} × ` : ''}${l.bestReps}`
    ctx.font = `700 condensed 30px ${FAMILY}`
    const bw = ctx.measureText(best).width
    ctx.fillStyle = INK
    ctx.fillText(best, SIZE - PAD - bw, y)
    ctx.font = `500 semi-condensed 32px ${FAMILY}`
    ctx.fillStyle = pbNames.has(l.name.toLowerCase()) ? ACCENT : '#d4e8f5'
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
    ctx.font = `400 condensed 24px ${FAMILY}`
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
