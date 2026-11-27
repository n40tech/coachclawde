import { quinnCells, quinnHeadCells, QUINN_COLS, QUINN_ROWS, QUINN_HEAD_COLS } from '../../lib/penguinArt'

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

// Each pixel cell is CELL units wide: a 108×216 coordinate space, which the
// shared bob/cheer/sweat keyframes (tuned for a ~100-unit canvas) suit.
const CELL = 3
const BLEED = 0.2 // tiny overlap so adjacent cells never show a seam when scaled
const W = QUINN_COLS * CELL
const H = QUINN_ROWS * CELL
const CELLS = quinnCells()
const HEAD_CELLS = quinnHeadCells()
/** At or below this size the full-length Quinn is too thin to read: show his face. */
const PORTRAIT_MAX = 48

/**
 * Quinn, the emperor penguin in a striped headband. Rendered as crisp pixel
 * rects so it stays sharp at any size and matches the app icon generated
 * from the same art.
 */
export function QuinnMark({ size = 40, className = '', idle = true, cheer = false, sweat = false, label }: QuinnMarkProps) {
  if (size <= PORTRAIT_MAX) return <QuinnPortrait size={size} className={className} idle={idle} cheer={cheer} label={label} />
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

      {/* A drop of sweat off the end of the headband */}
      {sweat && (
        <g className="quinn-sweat" style={{ transformOrigin: '73px 18px' }}>
          <rect x="71" y="16" width="4" height="5" fill="#7cc8f0" />
          <rect x="71.8" y="16.8" width="1.4" height="1.4" fill="#dff6ff" />
        </g>
      )}
    </svg>
  )
}

/** Quinn's face in a round avatar, for small sizes (chat, sidebar). */
function QuinnPortrait({ size, className, idle, cheer, label }: { size: number; className: string; idle: boolean; cheer: boolean; label?: string }) {
  const n = QUINN_HEAD_COLS
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={className}
    >
      <defs>
        <clipPath id="quinn-portrait">
          <circle cx={n / 2} cy={n / 2} r={n / 2} />
        </clipPath>
      </defs>
      <g clipPath="url(#quinn-portrait)">
        <rect width={n} height={n} fill="#3d7fae" />
        <g className={`${idle ? 'quinn-bob' : ''} ${cheer ? 'quinn-cheer' : ''}`} style={{ transformOrigin: `${n / 2}px ${n}px` }}>
          {HEAD_CELLS.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width={1.05} height={1.05} fill={c.fill} />
          ))}
        </g>
      </g>
    </svg>
  )
}
