import { BadgeCheck, Gem } from 'lucide-react'
import type { ReactNode } from 'react'
import { InfoTip } from '../../components/ui/InfoTip'
import { isRobust, rotationLabel } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { isNum } from '../../lib/format'
import type { Rotation } from '../../lib/types'

/** Plain-language definitions, written from docs/METHODOLOGY.md and the engine code. */
export const TIP = {
  index:
    'Season index (S): how well a simulated crop season’s water and temperature needs were met, from 0 upward. A legume before the crop can lift it a little above 1. It is not crop yield.',
  median: 'The middle value of the 40 yearly season indices: half the years were better, half were worse.',
  p10: 'The 10th percentile of the yearly index: only about 1 year in 10 was worse. It describes weaker historical years. It is not a probability.',
  failure: (t: number | null) =>
    `The share of simulated crop seasons whose index fell below the failure line${t === null ? '' : ` of ${t.toFixed(2)}`}.`,
  water: 'Modelled crop evapotranspiration requirement over a year: the water the crops would use if nothing held them back.',
  irrigation: 'Water the engine applies under the chosen irrigation mode and cap. A simulated amount, not measured farm water use.',
  cover: 'The share of days in the cycle with a crop in the ground.',
  legume: 'The share of crops in the rotation that are legumes. An indicator of potential nitrogen contribution, not a measured nitrogen balance.',
  forage: 'The share of crops in the rotation that are forage or dual-purpose.',
  erosion: 'The share of heavy-rain days (12.7 mm or more) that fell while the soil was bare. An exposure indicator, not a soil-loss estimate.',
  worst: 'The mean season index in the five years that were worst for your current rotation.',
  rank: 'Indicators are scaled between the rotations in this analysis, weighted by your priorities and added up. The rank is relative to these rotations only. It is not a probability of success.',
  pareto:
    'Pareto efficient: no other rotation shown is at least as good on every scaled indicator and strictly better on one. It is not automatically the best choice for every farm.',
  robustLegume: 'The range of ranks when the uncertain legume effect is set to 0%, 7%, 20% and 32%. A single number means the rank did not move.',
  robustRain: 'The range of ranks when the rotations are re-simulated with rainfall 30% lower and 30% higher. A built-in test, separate from any what-if scenario you set.',
  robust: 'The rank does not move across the legume-effect and rainfall tests.',
}

export function rangeText(range: [number, number] | null | undefined): string {
  if (!range) return '—'
  return range[0] === range[1] ? `#${range[0]}` : `#${range[0]}–#${range[1]}`
}

export function Chip({ children, tone = 'sand', className }: { children: ReactNode; tone?: 'sand' | 'lime' | 'peri' | 'forest' | 'white' | 'signal'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] leading-none font-extrabold whitespace-nowrap',
        tone === 'sand' && 'bg-sand text-forest-950',
        tone === 'lime' && 'bg-lime-100 text-forest-950 ring-1 ring-forest-950/10',
        tone === 'peri' && 'bg-peri text-forest-950',
        tone === 'forest' && 'bg-forest-950 text-cream-50',
        tone === 'white' && 'bg-white text-forest-950 ring-1 ring-border-strong',
        tone === 'signal' && 'bg-signal-50 text-signal-ink ring-1 ring-signal/30',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function RotationBadges({ r, compact }: { r: Rotation; compact?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {r.is_current && <Chip tone="peri">Current</Chip>}
      {r.scores?.pareto && (
        <Chip tone="white">
          <Gem className="h-3 w-3" aria-hidden="true" /> Pareto efficient {!compact && <InfoTip label="Pareto efficient">{TIP.pareto}</InfoTip>}
        </Chip>
      )}
      {isRobust(r) && (
        <Chip tone="lime">
          <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Robust rank {!compact && <InfoTip label="Robust rank">{TIP.robust}</InfoTip>}
        </Chip>
      )}
    </span>
  )
}

export function Stat({ label, tip, value, unit, className }: { label: string; tip?: string; value: ReactNode; unit?: string; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="flex items-center gap-1 text-[0.75rem] leading-tight font-bold text-ink">
        {label}
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </dt>
      <dd className="mt-1 font-display text-[1.25rem] leading-none font-semibold text-forest-950 tabular-nums">
        {value}
        {unit && <span className="font-sans text-[0.75rem] font-bold text-ink"> {unit}</span>}
      </dd>
    </div>
  )
}

export interface BarRow {
  key: string
  label: string
  value: number | null | undefined
  current?: boolean
  note?: string
}

/** Horizontal bar comparison. Values are printed, so nothing depends on colour or hover alone. */
export function HBars({ title, tip, unit, rows, format, max, caption }: { title: string; tip?: string; unit?: string; rows: BarRow[]; format: (v: number) => string; max?: number; caption?: string }) {
  const top = max ?? Math.max(...rows.map((r) => (isNum(r.value) ? r.value : 0)), 0)
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="flex items-center gap-1 font-display text-[1rem] leading-tight font-semibold text-forest-950">
        {title}
        {unit && <span className="font-sans text-[0.75rem] font-bold text-muted">({unit})</span>}
        {tip && <InfoTip label={title}>{tip}</InfoTip>}
      </figcaption>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className={cx('min-w-0 truncate font-bold', r.current ? 'text-peri-ink' : 'text-ink')} title={r.label}>
                {r.label}
                {r.current && <span className="font-extrabold"> · current</span>}
              </span>
              <span className="shrink-0 font-display text-[0.9375rem] font-semibold text-forest-950 tabular-nums">{isNum(r.value) ? format(r.value) : '—'}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
              <div
                className={cx('bar-grow-x h-full rounded-full', r.current ? 'bg-peri-chart' : 'bg-forest-800')}
                style={{ width: `${isNum(r.value) && top > 0 ? Math.max(1.5, (r.value / top) * 100) : 0}%` }}
              />
            </div>
            {r.note && <p className="mt-0.5 text-[0.75rem] text-muted">{r.note}</p>}
          </li>
        ))}
      </ul>
      {caption && <p className="mt-3 text-[0.8125rem] leading-snug text-muted">{caption}</p>}
    </figure>
  )
}

/** Choose one rotation (details, evidence) from the ones the engine returned. */
export function RotationPicker({ rotations, selected, onSelect, label }: { rotations: Rotation[]; selected: string; onSelect: (id: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {rotations.map((r) => {
        const on = r.id === selected
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(r.id)}
            className={cx(
              'flex max-w-full items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-left text-[0.8125rem] font-bold ring-1 transition-colors',
              on ? 'bg-forest-950 text-cream-50 ring-forest-950' : 'bg-white text-forest-950 ring-border-strong hover:bg-sand/70',
            )}
          >
            <span className={cx('flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 font-display text-[0.75rem] font-semibold tabular-nums', on ? 'bg-lime text-forest-950' : 'bg-sand')}>
              #{r.scores?.rank}
            </span>
            <span className="truncate">{rotationLabel(r)}</span>
            {r.is_current && <span className={cx('shrink-0 text-[0.6875rem] font-extrabold uppercase', on ? 'text-lime' : 'text-peri-ink')}>Current</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Panel({ title, tip, children, className, action }: { title?: ReactNode; tip?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cx('rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6', className)}>
      {title && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-[1.1875rem] leading-tight">
            {title}
            {tip && typeof title === 'string' && <InfoTip label={title}>{tip}</InfoTip>}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
