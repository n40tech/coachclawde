/**
 * Home's backdrop: snowy peaks under a cold polar sky, a band of still water
 * and, in front, the edge of an ice shelf that Quinn stands on. Below the
 * shelf is the open ocean (the page itself), where the cards float like
 * blocks of ice.
 *
 * Pure decoration: hidden from screen readers and from pointer events. Its
 * height is tied to Home's header so the shelf's top lines up with Quinn's
 * feet (`--scene-h` below; keep it in step with the hero's padding in Home).
 */
export function Icescape() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-(--scene-h) overflow-hidden [--scene-h:calc(max(0.5rem,var(--safe-top))+196px)]"
    >
      {/* Sky: night-blue overhead, a pale glow along the horizon. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#04131f_0%,#0a2f4c_45%,#2b7bb0_82%,#7cc4ea_100%)]" />

      {/* The range. Anchored to the bottom and cropped at the sides on narrow
          screens, so the peaks keep their shape. */}
      <svg
        className="absolute inset-x-0 bottom-[26px] w-full h-[160px]"
        viewBox="0 0 400 160"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="isc-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#a9d8f2" />
            <stop offset="1" stop-color="#5a9cc8" />
          </linearGradient>
          <linearGradient id="isc-lit" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stop-color="#f4fbff" />
            <stop offset="1" stop-color="#bfe3f7" />
          </linearGradient>
          <linearGradient id="isc-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8cc2e4" />
            <stop offset="1" stop-color="#3f80b0" />
          </linearGradient>
          <linearGradient id="isc-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2a76a8" />
            <stop offset="1" stop-color="#0b3a5c" />
          </linearGradient>
        </defs>

        {/* Far peaks, softened by distance */}
        <path
          d="M0 118 L30 96 L52 104 L84 78 L112 98 L140 88 L176 106 L214 92 L246 100 L290 80 L322 96 L356 84 L400 102 L400 140 L0 140 Z"
          fill="url(#isc-far)"
          opacity="0.55"
        />

        {/* Left massif */}
        <path d="M-10 140 L44 92 L70 70 L92 82 L120 66 L150 98 L180 140 Z" fill="url(#isc-lit)" />
        <path d="M70 70 L92 82 L120 66 L106 96 L124 118 L96 108 L82 140 L180 140 L150 98 Z" fill="url(#isc-shade)" />
        <path d="M120 66 L150 98 L180 140 L160 140 L138 104 Z" fill="#2f6c99" opacity="0.6" />

        {/* The great peak, lit from the left */}
        <path d="M150 140 L214 70 L236 52 L252 28 L262 34 L276 22 L300 58 L332 88 L372 140 Z" fill="url(#isc-lit)" />
        <path
          d="M276 22 L300 58 L332 88 L372 140 L290 140 L298 118 L280 96 L288 74 L270 58 L278 42 Z"
          fill="url(#isc-shade)"
        />
        {/* Rock showing through the snow */}
        <path d="M252 28 L262 34 L256 52 L246 44 Z" fill="#2a5272" opacity="0.75" />
        <path d="M270 58 L288 74 L280 96 L272 78 Z" fill="#23496a" opacity="0.7" />
        <path d="M226 74 L238 66 L232 92 L220 100 Z" fill="#3b6d93" opacity="0.45" />
        <path d="M300 96 L318 112 L304 128 L296 112 Z" fill="#23496a" opacity="0.55" />

        {/* Right shoulder running out of frame */}
        <path d="M330 140 L370 98 L392 86 L420 100 L420 140 Z" fill="url(#isc-lit)" opacity="0.92" />
        <path d="M392 86 L420 100 L420 140 L380 140 L398 112 Z" fill="url(#isc-shade)" />

        {/* Still water at the foot of the range, with a faint reflection */}
        <rect x="-20" y="138" width="440" height="22" fill="url(#isc-water)" />
        <path d="M150 140 L262 140 L250 150 L176 150 Z" fill="#d9f1ff" opacity="0.12" />
        <path d="M20 146 H120 M200 152 H330 M60 156 H150" stroke="#bfe6ff" strokeOpacity="0.22" strokeWidth="1" />
      </svg>

      {/* The ice shelf Quinn stands on: snow on top, a cliff of blue ice
          dropping into the ocean (the page). Stretched to the full width. */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full h-[34px]"
        viewBox="0 0 400 34"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="isc-cliff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#9fdcfb" />
            <stop offset="0.5" stop-color="#3d98cf" />
            <stop offset="1" stop-color="#04131f" />
          </linearGradient>
        </defs>
        <path d="M0 6 Q100 2 200 4 T400 5 L400 34 L0 34 Z" fill="url(#isc-cliff)" />
        <path d="M0 6 Q100 2 200 4 T400 5 L400 10 Q300 12 200 9 T0 11 Z" fill="#f4fbff" />
        <path d="M40 12 V30 M118 11 V26 M236 10 V32 M318 12 V24 M372 11 V29" stroke="#e6f7ff" strokeOpacity="0.3" strokeWidth="1.2" />
      </svg>
    </div>
  )
}
