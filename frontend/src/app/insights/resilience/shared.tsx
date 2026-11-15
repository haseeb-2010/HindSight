// Small pieces shared by the rotation-resilience and soil-care sections.
import { ArrowRight } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../../lib/cx'
import { isNum } from '../../../lib/format'
import type { Rotation } from '../../../lib/types'
import type { MetricDef } from '../../lib/insights'

/**
 * Upper end of the axis an indicator is drawn on. Shares run to 100%; the index and millimetre
 * indicators run to the largest value among the rotations in this analysis (at least 1 for the index).
 * A drawing scale only: no value is changed.
 */
export function axisMax(m: MetricDef, rotations: Rotation[]): number {
  if (m.unit === 'percent') return 1
  const top = Math.max(0, ...rotations.map((r) => m.get(r)).filter(isNum))
  return m.unit === 'index' ? Math.max(1, top) : top
}

/** Position of a value on an axis from 0 to `max`, as a percentage clamped to the track. */
export function axisPos(v: number | null | undefined, max: number): number | null {
  if (!isNum(v) || max <= 0) return null
  return Math.min(100, Math.max(0, (v / max) * 100))
}

export function RankBlock({ rank, of, current, className }: { rank: number | undefined; of: number; current?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        'flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-1.5 font-display text-[0.9375rem] font-semibold tabular-nums',
        current ? 'bg-peri-chart text-white' : 'bg-forest-950 text-lime',
        className,
      )}
    >
      <span className="sr-only">Rank </span>#{rank ?? '—'}
      <span className="sr-only"> of {of}</span>
    </span>
  )
}

export function TextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx('group rounded-sm text-[0.875rem] leading-relaxed font-extrabold text-forest-950', className)}>
      <span className="underline decoration-sage decoration-2 underline-offset-4 group-hover:decoration-forest-950">{children}</span>
      <ArrowRight className="ml-1.5 inline h-4 w-4 align-[-0.2em]" aria-hidden="true" />
    </Link>
  )
}

/** Section heading block: the h2 question, a short introduction and an optional link. */
export function SectionHeader({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">{title}</h2>
        <p className="mt-1.5 max-w-3xl text-[0.9375rem] leading-relaxed text-muted">{children}</p>
      </div>
      {action}
    </div>
  )
}

/**
 * One tab stop for a list of chart rows: arrow keys, Home and End move between rows, and the row
 * that has focus or is under the pointer is reported as `active` so a detail line can describe it.
 */
export function useRowFocus(count: number) {
  const [focused, setFocused] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [entry, setEntry] = useState(0)
  const refs = useRef<(HTMLElement | null)[]>([])
  const go = (i: number) => {
    const next = Math.min(count - 1, Math.max(0, i))
    setEntry(next)
    refs.current[next]?.focus()
  }
  const rowProps = (i: number) => ({
    ref: (el: HTMLElement | null) => {
      refs.current[i] = el
    },
    tabIndex: i === Math.min(entry, count - 1) ? 0 : -1,
    onFocus: () => {
      setFocused(i)
      setEntry(i)
    },
    onBlur: () => setFocused((f) => (f === i ? null : f)),
    onMouseEnter: () => setHovered(i),
    onMouseLeave: () => setHovered((h) => (h === i ? null : h)),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const to = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : null
      if (to === null) return
      e.preventDefault()
      go(to)
    },
  })
  return { active: hovered ?? focused, rowProps }
}

/** Legend entry: a drawn key beside its words, so identity never rests on colour alone. */
export function LegendKey({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="flex h-4 w-7 shrink-0 items-center justify-center">
        {swatch}
      </span>
      <span>{children}</span>
    </li>
  )
}
