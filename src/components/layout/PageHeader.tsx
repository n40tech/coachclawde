import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, type ReactNode } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { setBackAction } from '../../lib/backGesture'

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
  // The edge swipe (layout/EdgeSwipeBack) does what this Back button does.
  const back = () => (onBack ? onBack() : navigate(backTo!))
  const backRef = useRef(back)
  useEffect(() => { backRef.current = back })
  useEffect(() => (showBack ? setBackAction(() => backRef.current()) : undefined), [showBack])

  return (
    <div className="flex items-center gap-3 px-4 pt-safe pb-2 sticky top-0 bg-abyss/95 backdrop-blur-xl z-40 border-b border-slush">
      {showBack && (
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="relative hit-target w-9 h-9 flex items-center justify-center rounded-2xl bg-slush text-frost hover:text-snow transition-colors shrink-0"
        >
          <ArrowLeft size="1.125em" aria-hidden />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-snow leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-mist mt-0.5">{subtitle}</p>}
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
      className="relative hit-target w-9 h-9 flex items-center justify-center rounded-2xl bg-slush text-mist hover:text-snow transition-colors"
    >
      {children}
    </Link>
  )
}
