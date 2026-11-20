import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
  /** Custom back handler. Takes precedence over `backTo` (e.g. to go back in history). */
  onBack?: () => void
  right?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, onBack, right }: PageHeaderProps) {
  const navigate = useNavigate()
  const showBack = onBack || backTo
  useDocumentTitle(title)

  return (
    <div className="flex items-center gap-3 px-4 pt-safe pb-2 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-xl z-40 border-b border-[#1a1a1a]">
      {showBack && (
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate(backTo!))}
          aria-label="Back"
          className="relative hit-target w-9 h-9 flex items-center justify-center rounded-2xl bg-[#1a1a1a] text-[#a8a29e] hover:text-[#f5f5f0] transition-colors shrink-0"
        >
          <ArrowLeft size="1.125em" aria-hidden />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-[#f5f5f0] leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-[#949494] mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

/**
 * A round icon link for the page header (Settings, Edit program, Plan your
 * week): a native link, so it's announced and behaves as navigation.
 */
export function HeaderIconLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative hit-target w-9 h-9 flex items-center justify-center rounded-2xl bg-[#1a1a1a] text-[#949494] hover:text-[#f5f5f0] transition-colors"
    >
      {children}
    </Link>
  )
}
