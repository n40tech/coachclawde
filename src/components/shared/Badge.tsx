interface BadgeProps {
  label: string
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'easy' | 'moderate' | 'hard'
}

const variants = {
  default: 'bg-rime text-frost',
  accent: 'bg-ice/15 text-ice',
  success: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-400',
  easy: 'bg-emerald-500/15 text-emerald-400',
  moderate: 'bg-ice/15 text-ice',
  hard: 'bg-red-500/15 text-red-400',
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {label}
    </span>
  )
}
