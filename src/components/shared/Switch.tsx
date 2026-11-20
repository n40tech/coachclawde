import type { ChangeEvent } from 'react'

/**
 * An on/off switch: a native checkbox with the `switch` attribute (Safari
 * draws its own switch from it) and `role="switch"` (so every browser and
 * screen reader announces "switch, on/off"). It's styled by `.switch` in
 * index.css, so it looks the same everywhere without a polyfill. Space
 * toggles it, like any checkbox.
 *
 * Named by `labelledBy` (the row's title) and described by `describedBy`
 * (the row's explanation). The wrapping label grows the touch target to
 * 44px high without changing the look.
 *
 * `busy` keeps it focusable but ignores changes (unlike `disabled`, which
 * would drop keyboard focus mid-action).
 */
export function Switch({
  checked, onChange, labelledBy, describedBy, busy,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  labelledBy: string
  describedBy?: string
  busy?: boolean
}) {
  const extra = { switch: '' } as Record<string, string>
  return (
    <label className="shrink-0 flex items-center p-2 -m-2 cursor-pointer">
      <input
        type="checkbox"
        role="switch"
        {...extra}
        checked={checked}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-disabled={busy || undefined}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (!busy) onChange(e.target.checked)
        }}
        className={`switch ${busy ? 'opacity-50' : ''}`}
      />
    </label>
  )
}
