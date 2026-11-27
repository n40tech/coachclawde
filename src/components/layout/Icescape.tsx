/**
 * Home's backdrop: snowy Antarctic peaks under a dark polar sky, fading and
 * blurring away into the page below so the greeting and cards sit on plain
 * near-black.
 *
 * Pure decoration: hidden from screen readers and from pointer events.
 */
export function Icescape() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[calc(max(0.5rem,var(--safe-top))+212px)] overflow-hidden"
    >
      <div
        className="absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_45%,rgb(0_0_0/0.35)_78%,transparent_100%)]"
      >
        {/* Sky: black overhead, a cold dusk glow behind the range. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#07090b_0%,#0c1822_45%,#1c3a52_80%,#29506d_100%)]" />

        {/* The range. Anchored to the bottom and cropped at the sides on
            narrow screens, so the peaks keep their shape. */}
        <svg
          className="absolute inset-x-0 bottom-0 w-full h-[190px]"
          viewBox="0 0 400 190"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <linearGradient id="isc-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#8fb4cc" />
              <stop offset="1" stop-color="#3d6584" />
            </linearGradient>
            <linearGradient id="isc-lit" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0" stop-color="#eef6fb" />
              <stop offset="1" stop-color="#a9c8dc" />
            </linearGradient>
            <linearGradient id="isc-shade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#7fa6c2" />
              <stop offset="1" stop-color="#2f5675" />
            </linearGradient>
          </defs>

          {/* Far peaks, softened by distance */}
          <path
            d="M0 118 L30 96 L52 104 L84 78 L112 98 L140 88 L176 106 L214 92 L246 100 L290 80 L322 96 L356 84 L400 102 L400 190 L0 190 Z"
            fill="url(#isc-far)"
            opacity="0.45"
          />

          {/* Left massif */}
          <path d="M-10 190 L20 130 L44 92 L70 70 L92 82 L120 66 L150 98 L190 190 Z" fill="url(#isc-lit)" />
          <path d="M70 70 L92 82 L120 66 L106 96 L124 118 L96 108 L82 190 L190 190 L150 98 Z" fill="url(#isc-shade)" />
          <path d="M120 66 L150 98 L190 190 L168 190 L138 104 Z" fill="#24445e" opacity="0.6" />

          {/* The great peak, lit from the left */}
          <path d="M140 190 L214 70 L236 52 L252 28 L262 34 L276 22 L300 58 L332 88 L390 190 Z" fill="url(#isc-lit)" />
          <path
            d="M276 22 L300 58 L332 88 L390 190 L292 190 L298 140 L280 106 L288 74 L270 58 L278 42 Z"
            fill="url(#isc-shade)"
          />
          {/* Rock showing through the snow */}
          <path d="M252 28 L262 34 L256 52 L246 44 Z" fill="#22405a" opacity="0.75" />
          <path d="M270 58 L288 74 L280 96 L272 78 Z" fill="#1d3a52" opacity="0.7" />
          <path d="M226 74 L238 66 L232 92 L220 100 Z" fill="#3b6585" opacity="0.45" />
          <path d="M300 100 L318 118 L304 136 L296 118 Z" fill="#1d3a52" opacity="0.55" />

          {/* Right shoulder running out of frame */}
          <path d="M330 190 L370 98 L392 86 L420 100 L420 190 Z" fill="url(#isc-lit)" opacity="0.9" />
          <path d="M392 86 L420 100 L420 190 L380 190 L398 120 Z" fill="url(#isc-shade)" />
        </svg>
      </div>

      {/* The lower part blurs as it fades, so the range melts into the page. */}
      <div className="absolute inset-x-0 bottom-0 h-[60%] backdrop-blur-md [mask-image:linear-gradient(to_bottom,transparent,#000_45%,#000_65%,transparent)]" />
    </div>
  )
}
