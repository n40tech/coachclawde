import { useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { FixedLayer } from '../layout/FixedLayer'
import { useModal } from '../../hooks/useModal'

interface ConfirmDialogProps {
  icon: ReactNode
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** The confirm button is red: the action can't be undone. */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Centered confirmation modal. Tapping the backdrop or Escape cancels. Rendered
 * into the fixed layer (see FixedLayer) so it can be opened from inside rows,
 * tiles and other overflow-hidden or transformed containers. It's modal (see
 * `useModal`): focus moves in, the page behind is inert, and focus goes back
 * to the opener afterwards.
 */
export function ConfirmDialog({
  icon, title, children, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  useModal(panel, { onEscape: onCancel })
  return (
    <FixedLayer>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onCancel}>
        <div
          ref={panel}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-body`}
          tabIndex={-1}
          className="outline-none w-full max-w-sm bg-[#101419]/95 ice rounded-[2.5rem] border border-rime p-6 flex flex-col gap-4 fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-500/15 text-red-400' : 'bg-ice/15 text-ice'}`}>
              {icon}
            </div>
            <h2 id={`${id}-title`} className="text-base font-semibold text-snow">{title}</h2>
          </div>
          <div id={`${id}-body`} className="text-sm text-frost leading-relaxed">{children}</div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={onCancel} fullWidth>{cancelLabel}</Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} fullWidth>{confirmLabel}</Button>
          </div>
        </div>
      </div>
    </FixedLayer>
  )
}
