import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

export interface ReorderItem {
  id: string
  label: string
  sub?: string
}

interface ReorderListProps {
  items: ReorderItem[]
  onChange: (ids: string[]) => void
}

/**
 * A list you reorder by dragging the grip (touch or mouse), or with the
 * up/down buttons. Rows swap live as the dragged row passes a neighbour's
 * midpoint, so what you see is the order you'll get.
 */
export function ReorderList({ items, onChange }: ReorderListProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  // One announcement per move, in a status region that's always present.
  const [announcement, setAnnouncement] = useState('')
  const rows = useRef(new Map<string, HTMLLIElement>())
  const drag = useRef<{ id: string; startY: number; base: number } | null>(null)
  const ids = () => items.map((i) => i.id)

  function move(ids: string[], from: number, to: number): string[] {
    const next = [...ids]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    const item = items.find((i) => i.id === x)
    if (item) setAnnouncement(`${item.label}, moved to position ${to + 1} of ${ids.length}`)
    return next
  }

  function onPointerDown(e: ReactPointerEvent, id: string) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id, startY: e.clientY, base: 0 }
    setDragId(id)
    setOffset(0)
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current
    if (!d) return
    let dy = e.clientY - d.startY + d.base
    const order = ids()
    const at = order.indexOf(d.id)
    const me = rows.current.get(d.id)
    if (!me) return
    const gap = 8
    // Passed the neighbour below/above by half its height: swap, and keep the
    // row under the finger by moving the drag origin by the neighbour's size.
    const below = rows.current.get(order[at + 1])
    const above = rows.current.get(order[at - 1])
    if (below && dy > below.offsetHeight / 2 + gap / 2) {
      const step = below.offsetHeight + gap
      d.base -= step
      dy -= step
      onChange(move(order, at, at + 1))
    } else if (above && dy < -(above.offsetHeight / 2 + gap / 2)) {
      const step = above.offsetHeight + gap
      d.base += step
      dy += step
      onChange(move(order, at, at - 1))
    }
    setOffset(dy)
  }

  function onPointerUp() {
    drag.current = null
    setDragId(null)
    setOffset(0)
  }

  return (
    <>
    <p role="status" className="sr-only">{announcement}</p>
    <ul className="flex flex-col gap-2" aria-label="Exercise order">
      {items.map((item, i) => {
        const dragging = dragId === item.id
        return (
          <li
            key={item.id}
            ref={(el) => { if (el) rows.current.set(item.id, el); else rows.current.delete(item.id) }}
            style={dragging ? { transform: `translateY(${offset}px)` } : undefined}
            className={`flex items-center gap-2 rounded-2xl border pl-1 pr-2 py-1.5 bg-[#161616] ${
              dragging ? 'relative z-10 border-[#d97756]/60 shadow-lg shadow-black/60 scale-[1.02]' : 'border-[#2a2a2a] transition-transform'
            }`}
          >
            <button
              type="button"
              aria-label={`Drag to move ${item.label}`}
              onPointerDown={(e) => onPointerDown(e, item.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              // Vertical drags are the reorder, so only horizontal panning is
              // left to the browser.
              className="w-10 h-10 flex items-center justify-center text-[#949494] cursor-grab active:cursor-grabbing touch-pan-x"
            >
              <GripVertical size={18} aria-hidden />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#f5f5f0] truncate">{item.label}</p>
              {item.sub && <p className="text-xs text-[#949494]">{item.sub}</p>}
            </div>
            {/* aria-disabled, not disabled, at the ends: moving a row to the
                top keeps focus on its (now inactive) up button. */}
            <button
              type="button"
              aria-label={`Move ${item.label} up`}
              aria-disabled={i === 0 || undefined}
              onClick={() => { if (i > 0) onChange(move(ids(), i, i - 1)) }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-[#a8a29e] hover:bg-[#1f1f1f] ${i === 0 ? 'opacity-25' : ''}`}
            >
              <ChevronUp size={18} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move ${item.label} down`}
              aria-disabled={i === items.length - 1 || undefined}
              onClick={() => { if (i < items.length - 1) onChange(move(ids(), i, i + 1)) }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-[#a8a29e] hover:bg-[#1f1f1f] ${i === items.length - 1 ? 'opacity-25' : ''}`}
            >
              <ChevronDown size={18} aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
    </>
  )
}
