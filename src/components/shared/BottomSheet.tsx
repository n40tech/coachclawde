import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { FixedLayer } from '../layout/FixedLayer'
import { useModal } from '../../hooks/useModal'

/**
 * Slide-up bottom sheet over a dimmed backdrop. Tapping the backdrop closes it
 * unless `dismissOnBackdrop` is false (use that when the sheet holds typed
 * input that a stray tap shouldn't throw away). It's modal (see `useModal`):
 * focus moves in, the page behind is inert, Escape closes it (a deliberate
 * key, like the ✕) and focus goes back to the opener afterwards.
 *
 * Rendered into the fixed layer (see FixedLayer) so it can be opened from
 * inside tiles, rows and other overflow-hidden containers, and so it anchors
 * to the real screen bottom in the installed iPhone app. Lay the content out as a flex column: give the
 * scrolling middle `flex-1 overflow-y-auto`, and end with a footer that uses
 * `pb-edge` so it clears the home indicator.
 *
 * Device fit: the sheet stays phone-width (a little wider on tablets), lifts
 * itself above the on-screen keyboard via `--kb` (see `useKeyboardInset`) and
 * caps its height to the space left under the status bar.
 */
export function BottomSheet({
  label, onClose, children, dismissOnBackdrop = true,
}: {
  /** Accessible name for the dialog. */
  label: string
  onClose: () => void
  children: ReactNode
  dismissOnBackdrop?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  useModal(panel, { onEscape: onClose })
  return (
    <FixedLayer>
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col pb-(--kb)"
        onClick={dismissOnBackdrop ? onClose : undefined}
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className="sheet-panel outline-none mt-auto w-full max-w-md md:max-w-lg mx-auto bg-[#0a2438]/95 ice rounded-t-3xl border-t border-rime flex flex-col slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </FixedLayer>
  )
}

/** The sheet's ✕ — a full 44 × 44 touch target. */
export function SheetCloseButton({ onClose, label = 'Close' }: { onClose: () => void; label?: string }) {
  return (
    <button
      onClick={onClose}
      aria-label={label}
      className="w-11 h-11 -mr-2 -mt-1.5 shrink-0 flex items-center justify-center rounded-full text-mist hover:text-snow hover:bg-slush transition-colors"
    >
      <X size="1.25em" aria-hidden />
    </button>
  )
}
