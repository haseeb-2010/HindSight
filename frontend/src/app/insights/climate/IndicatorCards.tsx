import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChartColumn,
  CircleDashed,
  CircleDot,
  CloudRain,
  CloudRainWind,
  CloudSunRain,
  Gauge,
  Minus,
  Snowflake,
  ThermometerSun,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { useId } from 'react'
import { cx } from '../../../lib/cx'
import { fmtNum, fmtP, fmtPct, isNum } from '../../../lib/format'
import type { ClimateShift } from '../../../lib/types'
import { readShift, type ShiftReading } from '../../lib/insights'
import { meanDigits, signed } from './axis'

const ICONS: Record<string, LucideIcon> = {
  cool_season_rain_mm: CloudRain,
  warm_season_rain_mm: CloudSunRain,
  annual_et0_mm: Wind,
  hot_days: ThermometerSun,
  frost_days: Snowflake,
  heavy_rain_days: CloudRainWind,
}

export interface YearSeries {
  years: number[]
  values: number[]
}

export type Windows = Record<string, [number, number]> | undefined

export const inWindow = (year: number, w: [number, number] | undefined) => !!w && year >= w[0] && year <= w[1]

/** Direction of the difference between the two period means, worded by readShift(). Icon and words, never colour alone. */
function DirectionChip({ reading, className }: { reading: ShiftReading; className?: string }) {
  const Icon = reading.direction === 'higher' ? ArrowUpRight : reading.direction === 'lower' ? ArrowDownRight : ArrowRight
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] leading-none font-extrabold whitespace-nowrap ring-1',
        reading.direction === 'little' ? 'bg-sand text-forest-950 ring-transparent' : 'bg-white text-forest-950 ring-border-strong',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
      {reading.label}
    </span>
  )
}

/** Whether the trend test supports a steady year-to-year change, worded by readShift(). */
function EvidenceChip({ reading, className }: { reading: ShiftReading; className?: string }) {
  const consistent = reading.evidence === 'consistent'
  const Icon = consistent ? CircleDot : CircleDashed
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] leading-none font-extrabold whitespace-nowrap ring-1',
        consistent ? 'bg-forest-950 text-cream-50 ring-forest-950' : 'bg-sand text-forest-950 ring-transparent',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
      {reading.evidenceLabel}
    </span>
  )
}

/**
 * The two labels of an indicator. When the engine did not return both period values there is no
 * direction to report, so the chip says that instead of calling a missing difference "little change".
 */
export function ShiftChips({ s, className }: { s: ClimateShift; className?: string }) {
  const reading = readShift(s)
  const complete = isNum(s.early) && isNum(s.late)
  return (
    <span className={cx('flex flex-wrap gap-1.5', className)}>
      {complete ? (
        <DirectionChip reading={reading} />
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-[0.75rem] leading-none font-extrabold whitespace-nowrap text-forest-950">
          <Minus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
          Period values not available
        </span>
      )}
      <EvidenceChip reading={reading} />
    </span>
  )
}

/** A thumbnail of the yearly values: the same bars and tones as the chart below, without axes. */
function Sparkline({ series, windows }: { series: YearSeries; windows: Windows }) {
  const max = Math.max(...series.values, 0)
  if (!(max > 0)) return <span className="block h-7 border-b border-sand-400" aria-hidden="true" />
  const n = series.values.length
  return (
    <svg viewBox={`0 0 ${n} 1`} preserveAspectRatio="none" className="block h-7 w-full" aria-hidden="true">
      {series.values.map((v, i) => {
        const h = v / max
        const yr = series.years[i]
        const fill = inWindow(yr, windows?.early) ? 'var(--color-sage)' : inWindow(yr, windows?.late) ? 'var(--color-forest-800)' : 'var(--color-sand-400)'
        return <rect key={yr} x={i + 0.16} y={1 - h} width={0.68} height={h} fill={fill} />
      })}
    </svg>
  )
}

function IndicatorCard({
  s,
  on,
  name,
  onSelect,
  earlyLabel,
  lateLabel,
  series,
  windows,
  hint,
}: {
  s: ClimateShift
  on: boolean
  name: string
  onSelect: () => void
  earlyLabel: string
  lateLabel: string
  series: YearSeries | null
  windows: Windows
  /** One plain line saying what the indicator is. */
  hint?: string
}) {
  const descId = useId()
  const hintId = useId()
  const reading = readShift(s)
  const d = meanDigits(s.unit)
  const Icon = ICONS[s.id] ?? Gauge
  const change = isNum(s.change) ? s.change : isNum(s.early) && isNum(s.late) ? s.late - s.early : null
  const rel = reading.direction !== 'little' && isNum(reading.relChange) ? `${reading.relChange > 0 ? '+' : '−'}${fmtPct(Math.abs(reading.relChange))}` : null
  const period = (label: string, v: number | null) => (
    <span className="block min-w-0">
      <span className="block text-[0.75rem] font-bold text-ink tabular-nums">{label}</span>
      <span className="mt-1 block font-display text-[1.5rem] leading-none font-semibold text-forest-950 tabular-nums">
        {fmtNum(v, d)}
        <span className="font-sans text-[0.75rem] font-bold text-ink"> {s.unit} / yr</span>
      </span>
    </span>
  )
  const stats: [string, string, string | null][] = [
    ['Change', signed(change, s.unit, d), rel],
    ['Trend per decade', signed(s.slope_per_decade, s.unit, 1), null],
    ['Trend test', fmtP(s.p_value), null],
  ]

  return (
    <label
      className={cx(
        'relative flex w-[86%] shrink-0 cursor-pointer snap-center flex-col rounded-[1.5rem] p-5 transition-[box-shadow,background-color] duration-300 sm:w-auto',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest-950',
        on ? 'bg-lime-100 shadow-soft ring-2 ring-forest-950' : 'bg-white shadow-hairline ring-1 ring-border hover:shadow-soft hover:ring-border-strong',
      )}
    >
      <input type="radio" name={name} className="sr-only" checked={on} onChange={onSelect} aria-label={s.label} aria-describedby={hint ? `${hintId} ${descId}` : descId} />
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2.5">
          <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors', on ? 'bg-forest-950 text-lime' : 'bg-sand text-forest-950')}>
            <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[1.0625rem] leading-snug font-semibold text-forest-950">{s.label}</span>
            {hint && (
              <span id={hintId} className="mt-0.5 block text-[0.75rem] leading-snug font-semibold text-muted">
                {hint}
              </span>
            )}
          </span>
        </span>
        <span aria-hidden="true" className={cx('mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-forest-950' : 'border-sand-400')}>
          {on && <span className="h-2.5 w-2.5 rounded-full bg-forest-950" />}
        </span>
      </span>

      <span id={descId} className="flex grow flex-col">
        <ShiftChips s={s} className="mt-3.5" />

        <span className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
          {period(earlyLabel, s.early)}
          <ArrowRight className="mb-0.5 h-4 w-4 text-muted" aria-hidden="true" />
          {period(lateLabel, s.late)}
        </span>

        {series && (
          <span className="mt-3.5 block">
            <Sparkline series={series} windows={windows} />
          </span>
        )}

        {/* Column by column in the markup (label, value, note), row by row on screen, so the three values share a line. */}
        <span className={cx('mt-4 grid grid-flow-col grid-cols-3 grid-rows-[auto_auto_auto] gap-x-3 border-t pt-3.5', on ? 'border-forest-950/15' : 'border-border')}>
          {stats.flatMap(([label, value, note]) => [
            <span key={label} className="self-end text-[0.75rem] leading-tight font-bold text-ink">
              {label}
            </span>,
            <span key={`${label}-value`} className="mt-1 font-display text-[1rem] leading-tight font-semibold text-forest-950 tabular-nums">
              {value}
            </span>,
            <span key={`${label}-note`} className="text-[0.75rem] font-bold text-ink tabular-nums">
              {note}
            </span>,
          ])}
        </span>

        <span className={cx('mt-auto flex items-center gap-1.5 pt-3.5 text-[0.75rem] font-extrabold', on ? 'text-forest-950' : 'text-muted')}>
          {on ? <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" /> : <ChartColumn className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />}
          {series ? (on ? 'Shown year by year in the chart below' : 'Show every year in the chart') : on ? 'Finding shown below' : 'Show this finding'}
        </span>
      </span>
    </label>
  )
}

/** One selectable card per indicator the engine returned. The selected card drives the yearly chart. */
export function IndicatorCards({
  shifts,
  selected,
  onSelect,
  earlyLabel,
  lateLabel,
  seriesFor,
  windows,
  hintFor,
}: {
  shifts: ClimateShift[]
  selected: string
  onSelect: (id: string) => void
  earlyLabel: string
  lateLabel: string
  seriesFor: (id: string) => YearSeries | null
  windows: Windows
  hintFor?: (id: string) => string | undefined
}) {
  const name = useId()
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Climate indicator shown in the yearly chart"
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:p-0 xl:grid-cols-3 [&::-webkit-scrollbar]:hidden"
      >
        {shifts.map((s) => (
          <IndicatorCard
            key={s.id}
            s={s}
            on={s.id === selected}
            name={name}
            onSelect={() => onSelect(s.id)}
            earlyLabel={earlyLabel}
            lateLabel={lateLabel}
            series={seriesFor(s.id)}
            windows={windows}
            hint={hintFor?.(s.id)}
          />
        ))}
      </div>
      {shifts.length > 1 && (
        <p className="mt-1.5 text-[0.75rem] font-bold text-muted sm:hidden" aria-hidden="true">
          Swipe sideways to see all {shifts.length} indicators.
        </p>
      )}
    </div>
  )
}
