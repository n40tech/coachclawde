import { ExternalLink, MessagesSquare } from 'lucide-react'
import { BETA_FEEDBACK_URL } from '../../lib/betaFeedback'

/**
 * Home tile asking beta testers to join the WhatsApp feedback group. The whole
 * tile is one link and opens in a new tab, so the app stays open behind it.
 * Callers render it only when a group link is configured (BETA_FEEDBACK_URL).
 */
export function BetaFeedbackTile({ href = BETA_FEEDBACK_URL }: { href?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-3xl bg-floe ice border border-blue-500/25 px-5 py-3 active:scale-[0.98] transition-transform duration-100"
    >
      <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center shrink-0">
        <MessagesSquare size={18} className="text-blue-400" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-snow">This is a beta test</p>
        <p className="text-xs text-mist mt-0.5 leading-snug">
          <span className="text-blue-400 font-medium">Join the WhatsApp group</span> to post feedback and ideas.
          <span className="sr-only"> (opens in a new tab)</span>
        </p>
      </div>
      <ExternalLink size={14} className="text-haze shrink-0" aria-hidden />
    </a>
  )
}
