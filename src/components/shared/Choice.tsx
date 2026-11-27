import type { ReactNode } from 'react'

/**
 * A named group of choices: a `<fieldset>` whose `<legend>` names it, so a
 * screen reader hears "Gender, radio group" before the options. Lay the
 * options out with `className`.
 */
export function ChoiceGroup({
  legend, legendClassName = 'block text-xs font-medium text-frost mb-2', className, children,
}: {
  legend: ReactNode
  legendClassName?: string
  className?: string
  children: ReactNode
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={legendClassName}>{legend}</legend>
      <div className={className}>{children}</div>
    </fieldset>
  )
}

/**
 * One option drawn as a chip or card, built on a native radio (one of a
 * group, `name` shared) or checkbox (any number). The input is visually
 * hidden but stays focusable, so the browser provides the keyboard model
 * (Tab into the group, arrow keys between radios, Space to tick) and the
 * semantics; the chip shows a focus ring when the input has keyboard focus.
 *
 * `className` styles the chip; pass the checked/unchecked look from
 * `checked` as before.
 */
export function ChoiceChip({
  type = 'radio', name, value, checked, onChange, disabled, className = '', children,
}: {
  type?: 'radio' | 'checkbox'
  name: string
  value: string
  checked: boolean
  /** A radio calls this when picked; a checkbox on every tick and untick. */
  onChange: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={`relative cursor-pointer select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ice has-[:disabled]:cursor-not-allowed ${className}`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      {children}
    </label>
  )
}
