import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import { monthName } from '../../lib/insights'
import { SHORT_MONTHS } from './calendar'

/**
 * Every chart in the seasonal explorer uses this row: a label column and a twelve-month track.
 * The label sits beside the track on wide screens and above it on phones, so the months of all
 * charts line up under each other at every width.
 */
export function TrackRow({ label, sub, swatch, children, className }: { label?: ReactNode; sub?: ReactNode; swatch?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('sm:grid sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:items-center sm:gap-4', className)}>
      <div className={cx('min-w-0', label ? 'mb-1.5 flex flex-wrap items-baseline gap-x-2 sm:mb-0 sm:block' : 'hidden sm:block')}>
        {label && (
          <p className="flex max-w-full min-w-0 shrink-0 items-center gap-2 text-[0.8125rem] leading-tight font-extrabold text-forest-950 sm:shrink">
            {swatch}
            <span className="min-w-0">{label}</span>
          </p>
        )}
        {sub && <p className="min-w-0 text-[0.75rem] leading-snug font-semibold text-muted sm:mt-0.5">{sub}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Highlights the month being read (pointer or keyboard) inside a relative twelve-month track. */
export function ActiveColumn({ month }: { month: number | null }) {
  if (month === null) return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-10 rounded-md bg-forest-950/[0.07] ring-1 ring-forest-950/35"
      style={{ left: `${(month / 12) * 100}%`, width: `${100 / 12}%` }}
    />
  )
}

/** Month names along the bottom of a chart. One letter on phones, three on wider screens. */
export function MonthAxis({ active, marked }: { active: number | null; marked?: Set<number> }) {
  return (
    <div className="grid grid-cols-12" aria-hidden="true">
      {SHORT_MONTHS.map((m, i) => (
        <span key={m} className="px-px text-center">
          <span
            className={cx(
              'inline-block min-w-[1.375rem] rounded-full px-1 py-0.5 text-[0.6875rem] leading-none font-extrabold sm:px-2 sm:text-[0.75rem]',
              marked?.has(i + 1) ? 'bg-ink text-cream-50' : active === i ? 'bg-sand text-forest-950' : 'text-muted',
            )}
          >
            <span className="sm:hidden">{m.charAt(0)}</span>
            <span className="hidden sm:inline">{m}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

/**
 * Pointer and keyboard reading of a twelve-month track. `track` goes on an element that spans exactly
 * the twelve months; `bind` goes on the focusable chart container.
 */
export function useMonthReader(active: number | null, setActive: (m: number | null) => void) {
  const track = useRef<HTMLDivElement>(null)
  const at = (e: PointerEvent<HTMLElement>): number | null => {
    const r = track.current?.getBoundingClientRect()
    if (!r || r.width <= 0) return null
    const m = Math.floor(((e.clientX - r.left) / r.width) * 12)
    return m >= 0 && m <= 11 ? m : null
  }
  const bind = {
    tabIndex: 0,
    role: 'group' as const,
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const m = at(e)
      if (m !== active && (m !== null || e.pointerType === 'mouse')) setActive(m)
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      const m = at(e)
      if (m !== null) setActive(m)
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') setActive(null)
    },
    onBlur: () => setActive(null),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      if (e.key === 'Home') setActive(0)
      else if (e.key === 'End') setActive(11)
      else if (active === null) setActive(e.key === 'ArrowLeft' ? 11 : 0)
      else setActive((active + (e.key === 'ArrowLeft' ? 11 : 1)) % 12)
    },
  }
  return { track, bind }
}

/**
 * The box that prints the month being read. Announced politely to screen readers.
 * It keeps room for two lines on phones and one on wider screens, so the chart under it never moves while reading.
 */
export function Readout({ month, children, idle = 'Hover, tap or use ← → keys to read a month' }: { month: number | null; children: ReactNode; idle?: string }) {
  return (
    <div className="flex min-h-[2.75rem] items-center sm:min-h-[1.625rem]">
      <div aria-live="polite" className="rounded-lg bg-sand px-2.5 py-1 text-[0.75rem] leading-snug font-bold text-ink tabular-nums">
        {month === null ? (
          <span>{idle}</span>
        ) : (
          <span>
            <span className="font-display text-forest-950">{monthName(month + 1)}</span> · {children}
          </span>
        )}
      </div>
    </div>
  )
}

/** Legend above, readout under it: the layout every chart in the seasonal explorer starts with. */
export function FigureHead({ children }: { children: ReactNode }) {
  return <div className="mb-3 space-y-2">{children}</div>
}

export const FOCUS_RING = 'rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-forest-950'
