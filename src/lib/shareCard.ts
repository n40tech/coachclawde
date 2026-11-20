import { crabCells } from './crabArt'
import { formatWorkoutTime, type WorkoutSummary } from './workoutSummary'
import { toWeight, type WeightUnit } from './units'
import { formatSessionDate } from './dateUtils'

const SIZE = 1080
const BG = '#0a0a0a'
const CARD = '#161616'
const LINE = '#2a2a2a'
const TEXT = '#f5f5f0'
const MUTED = '#a8a29e'
const DIM = '#6a6a6a'
const ACCENT = '#d97756'
const FONT = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif"

/** "12.4 t", "8,450 kg" or the lb equivalent. */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = toWeight(kg, unit)
  if (unit === 'kg' && v >= 10000) return `${(v / 1000).toFixed(1)} t`
  return `${Math.round(v).toLocaleString('en-GB')} ${unit}`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

/**
 * Draws the square (1080 × 1080) workout summary people share: Clawde, the
 * session, four headline stats and any new PBs.
 */
export function drawShareCard(summary: WorkoutSummary, unit: WeightUnit): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const pad = 72

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, SIZE, SIZE)
  // A warm glow behind Clawde.
  const glow = ctx.createRadialGradient(SIZE - 190, 200, 10, SIZE - 190, 200, 360)
  glow.addColorStop(0, 'rgba(217,119,86,0.28)')
  glow.addColorStop(1, 'rgba(217,119,86,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Clawde, from the same pixel grid as the app icon.
  const cell = 17
  const crabX = SIZE - pad - 13 * cell
  const crabY = 110
  for (const c of crabCells()) {
    ctx.fillStyle = c.fill
    ctx.fillRect(crabX + c.x * cell, crabY + c.y * cell, cell + 0.5, cell + 0.5)
  }

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = ACCENT
  ctx.font = `700 30px ${FONT}`
  ctx.fillText('WORKOUT COMPLETE', pad, 130)
  ctx.fillStyle = TEXT
  ctx.font = `800 68px ${FONT}`
  ctx.fillText(fitText(ctx, summary.title, SIZE - pad * 2 - 13 * cell - 24), pad, 214)
  ctx.fillStyle = DIM
  ctx.font = `500 32px ${FONT}`
  ctx.fillText(formatSessionDate(summary.date), pad, 268)

  // Stats, 2 × 2.
  const stats: [string, string][] = [
    [formatWorkoutTime(summary.durationSeconds), 'Workout time'],
    [formatVolume(summary.totalVolumeKg, unit), 'Total lifted'],
    [String(summary.exercises), summary.exercises === 1 ? 'Exercise' : 'Exercises'],
    [String(summary.sets), summary.sets === 1 ? 'Set' : 'Sets'],
  ]
  const gap = 24
  const top = 340
  const w = (SIZE - pad * 2 - gap) / 2
  const h = 170
  stats.forEach(([value, label], i) => {
    const x = pad + (i % 2) * (w + gap)
    const y = top + Math.floor(i / 2) * (h + gap)
    ctx.fillStyle = CARD
    roundRect(ctx, x, y, w, h, 36)
    ctx.fill()
    ctx.strokeStyle = LINE
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = TEXT
    ctx.font = `800 64px ${FONT}`
    ctx.fillText(fitText(ctx, value, w - 64), x + 32, y + 92)
    ctx.fillStyle = DIM
    ctx.font = `500 28px ${FONT}`
    ctx.fillText(label, x + 32, y + 136)
  })

  // New PBs (up to three), else a sign-off.
  let y = top + 2 * h + gap + 80
  if (summary.pbs.length) {
    ctx.fillStyle = ACCENT
    ctx.font = `700 30px ${FONT}`
    ctx.fillText(`🏆  ${summary.pbs.length} NEW PB${summary.pbs.length > 1 ? 'S' : ''}`, pad, y)
    y += 54
    for (const pb of summary.pbs.slice(0, 3)) {
      ctx.fillStyle = TEXT
      ctx.font = `600 34px ${FONT}`
      const right = `${toWeight(pb.weightKg, unit)} ${unit} × ${pb.reps}`
      const rw = ctx.measureText(right).width
      ctx.fillText(fitText(ctx, pb.name, SIZE - pad * 2 - rw - 32), pad, y)
      ctx.fillStyle = MUTED
      ctx.fillText(right, SIZE - pad - rw, y)
      y += 50
    }
  } else {
    ctx.fillStyle = MUTED
    ctx.font = `500 34px ${FONT}`
    ctx.fillText(`${summary.reps} reps in the bank. Clawde approves.`, pad, y)
  }

  ctx.fillStyle = DIM
  ctx.font = `600 26px ${FONT}`
  ctx.fillText('Coach Clawde', pad, SIZE - 60)

  return canvas
}

/** The card as a PNG file. Built ahead of the tap: iOS only opens the share sheet straight from one. */
export async function buildShareFile(summary: WorkoutSummary, unit: WeightUnit): Promise<File> {
  const canvas = drawShareCard(summary, unit)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not create the image')
  return new File([blob], `workout-${summary.date}.png`, { type: 'image/png' })
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
