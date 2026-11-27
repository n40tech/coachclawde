import { quinnCells, QUINN_COLS, QUINN_ROWS } from '../../lib/penguinArt'

interface QuinnMarkProps {
  size?: number
  className?: string
  /** A couple of gentle breaths as Quinn appears */
  idle?: boolean
  /** Playful waddle-hop: fire this on scroll-up */
  cheer?: boolean
  /** Show a drop of meltwater falling off the headband */
  sweat?: boolean
  /**
   * Text alternative, when the mark means something on its own. Left out,
   * it's decoration (next to the app's name, as a chat avatar, beside a
   * heading) and hidden from screen readers.
   */
  label?: string
}

// Each pixel cell is CELL units wide: a 96×120 coordinate space, which the
// shared bob/cheer/sweat keyframes (tuned for a ~100-unit canvas) suit.
const CELL = 6
const BLEED = 0.35 // tiny overlap so adjacent cells never show a seam when scaled
const W = QUINN_COLS * CELL
const H = QUINN_ROWS * CELL
const CELLS = quinnCells()

/**
 * Quinn, the emperor penguin in a striped headband. Rendered as crisp pixel
 * rects so it stays sharp at any size and matches the app icon generated
 * from the same art.
 */
export function QuinnMark({ size = 40, className = '', idle = true, cheer = false, sweat = false, label }: QuinnMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-(H - W) / 2 - 4} -4 ${H + 8} ${H + 8}`}
      fill="none"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={`overflow-visible ${className}`}
    >
      <g
        className={`${idle ? 'quinn-bob' : ''} ${cheer ? 'quinn-cheer' : ''}`}
        style={{ transformOrigin: `${W / 2}px ${H}px` }}
      >
        {CELLS.map((c, i) => (
          <rect
            key={i}
            x={c.x * CELL - BLEED / 2}
            y={c.y * CELL - BLEED / 2}
            width={CELL + BLEED}
            height={CELL + BLEED}
            fill={c.fill}
          />
        ))}
      </g>

      {/* A drop of meltwater off the headband's tail */}
      {sweat && (
        <g className="quinn-sweat" style={{ transformOrigin: `${W - 3}px 36px` }}>
          <rect x={W - 6} y="34" width="6" height="7" fill="#6fd0ff" />
          <rect x={W - 5} y="35.2" width="2" height="2" fill="#dff6ff" />
        </g>
      )}
    </svg>
  )
}
