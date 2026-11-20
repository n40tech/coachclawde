import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface CardProps {
  children: ReactNode
  className?: string
  /**
   * The whole card is one link to this route (a native link: focusable,
   * Enter opens it, long-press and new-tab work). Only for cards with no
   * other controls inside; the card's text becomes the link's name, so keep
   * it short.
   */
  to?: string
  accent?: boolean
  glow?: boolean
}

export function Card({ children, className = '', to, accent, glow }: CardProps) {
  const look = `
    bg-[#161616] rounded-3xl border border-[#2a2a2a] overflow-hidden
    ${accent ? 'border-[#d97756]/30' : ''}
    ${glow ? 'shadow-lg shadow-[#d97756]/10' : ''}
    ${className}
  `
  if (to) {
    return (
      <Link to={to} className={`block rounded-3xl active:scale-[0.98] transition-transform duration-100 ${look}`}>
        {children}
      </Link>
    )
  }
  return <div className={look}>{children}</div>
}

export function CardSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  )
}
