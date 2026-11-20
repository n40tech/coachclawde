import { Dumbbell, Waves, Zap } from 'lucide-react'
import type { SessionType } from '../../types'

/** The icon for a kind of session: weights, cardio or active recovery. */
export function SessionIcon({ type, size, className }: { type: SessionType; size: number; className?: string }) {
  switch (type) {
    case 'weights': return <Dumbbell size={size} className={className} aria-hidden />
    case 'cardio': return <Waves size={size} className={className} aria-hidden />
    default: return <Zap size={size} className={className} aria-hidden />
  }
}
