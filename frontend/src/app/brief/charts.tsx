// Charts of the Decision Brief. They are laid out with HTML and CSS only (no measured widths), so the
// same markup fits a phone, a desktop panel and an A4 page without being clipped or re-measured.
// Every chart prints its values, has a hidden data table, and can be read by pointer or by keyboard.
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { InfoTip } from '../../components/ui/InfoTip'
import { rotationLabel, seasonsFailed } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtIndex, fmtNum, fmtP, fmtPct, isNum } from '../../lib/format'
import type { CalendarCell, ClimateShift, Rotation } from '../../lib/types'
import { BARE_LABELS, bareLevel, calendarByYear, monthName, readShift, shiftSentence } from '../lib/insights'
import { PRIORITIES, PRIORITY_ORDER } from '../lib/labels'
import { Chip } from '../results/shared'

// Chart series colours of the workspace (theme.css): forest-800, peri-chart, sage, signal-600.
const FOREST = 'var(--color-forest-800)'
const PERI = 'var(--color-peri-chart)'
const SAGE = 'var(--color-sage)'
const SIGNAL = 'var(--color-signal-600)'
const HATCH = 'bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(207_203_194/0.7)_3px_4px)]'

/** One tab stop per chart; the arrow keys move through its marks, as the pointer does on hover. */
function useRoving(count: number) {
  const [active, setActive] = useState<number | null>(null)
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      setActive(null)
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || count === 0) return
    e.preventDefault()
    setActive((a) => {
      if (e.key === 'Home') return 0
      if (e.key === 'End') return count - 1
      const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp'
      if (a === null) return back ? count - 1 : 0
      return Math.max(0, Math.min(count - 1, a + (back ? -1 : 1)))
    })
  }
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    if (count > 0 && e.currentTarget.matches(':focus-visible')) setActive((a) => a ?? 0)
  }
  return { active, setActive, group: { tabIndex: 0, onKeyDown, onFocus, onBlur: () => setActive(null), onPointerLeave: () => setActive(null) } }
}

/** The detail line of a chart. It keeps its height, so nothing moves when a value appears. Screen only. */
function Readout({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <div className="flex min-h-[3.25rem] items-start sm:min-h-8 print:hidden">
      <p aria-live="polite" className="w-fit max-w-full rounded-lg bg-sand px-2.5 py-1.5 text-[0.75rem] leading-snug font-bold text-ink tabular-nums">
        {children || hint}
      </p>
    </div>
  )
}

export function LegendKey({ children, swatch }: { children: ReactNode; swatch: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-flex shrink-0 items-center">
        {swatch}
      </span>
      {children}
    </span>
  )
}

const Square = ({ color, className }: { color?: string; className?: string }) => <span className={cx('block h-2.5 w-2.5 rounded-[3px]', className)} style={color ? { background: color } : undefined} />

/** Title, units, legend, the plot and one sentence read from the data. */
export function ChartFrame({ title, unit, legend, children, note, className }: { title: string; unit?: string; legend?: ReactNode; children: ReactNode; note?: ReactNode; className?: string }) {
  return (
    // The wrapper takes the spacing of the surrounding layout; a figure needs its own margins reset.
    <div className={cx('min-w-0', className)}>
      <figure className="m-0 min-w-0">
        <figcaption className="font-display text-[1rem] leading-tight font-semibold text-forest-950">
          {title}
          {unit && <span className="ml-1.5 font-sans text-[0.75rem] font-bold text-muted">({unit})</span>}
        </figcaption>
        {legend && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] font-bold text-ink">{legend}</div>}
        <div className="mt-3">{children}</div>
        {note && <p className="mt-3 text-[0.8125rem] leading-snug text-ink">{note}</p>}
      </figure>
    </div>
  )
}

/* ------------------------------------------------------------------ farmer priorities */

/** The seven ranking weights exactly as the engine received them. */
export function PriorityWeights({ weights }: { weights: Record<string, number> | undefined }) {
  if (!weights) return <p className="text-[0.9375rem] text-ink">The priority weights were not recorded with this analysis.</p>
  return (
    <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2 print:grid-cols-2" aria-label="Farmer priority weights, from 0 to 5">
      {PRIORITY_ORDER.map((k) => {
        const w = weights[k]
        return (
          <li key={k} className="min-w-0 break-inside-avoid">
            <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="flex min-w-0 items-center gap-1 font-bold text-ink">
                {PRIORITIES[k].label}
                <InfoTip label={PRIORITIES[k].label}>{PRIORITIES[k].explain}</InfoTip>
              </span>
              <span className="shrink-0 font-display text-[0.9375rem] font-semibold text-forest-950 tabular-nums">
                {isNum(w) ? w : 'not recorded'}
                {isNum(w) && <span className="font-sans text-[0.75rem] font-bold text-ink"> of 5</span>}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand" aria-hidden="true">
              <div className="h-full rounded-full bg-forest-800" style={{ width: `${isNum(w) ? Math.max(0, Math.min(1, w / 5)) * 100 : 0}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ climate: early against later period */

const digits = (unit: string) => (unit === 'mm' ? 0 : 1)
const signed = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmtNum(Math.abs(v), d)}`

/** Each climate indicator of the engine: the two period means as bars, the reading from readShift(), and its sentence. */
export function ShiftChart({ shifts, early, late }: { shifts: ClimateShift[]; early: string; late: string }) {
  const { active, setActive, group } = useRoving(shifts.length)
  const a = active !== null ? shifts[active] : null
  const rel = a ? readShift(a).relChange : null
  const readings = shifts.map(readShift)
  const moved = readings.filter((r) => r.direction !== 'little')
  const consistent = moved.filter((r) => r.evidence === 'consistent').length
  const note =
    moved.length === 0
      ? `None of the ${shifts.length} indicators differs between the two periods by more than the “little change” margin.`
      : `${moved.length} of ${shifts.length} indicators differ between the two periods. For ${consistent} of those the trend test supports a consistent change across the record; for ${
          moved.length - consistent
        } the statistical evidence is limited.`
  return (
    <ChartFrame
      title="Yearly averages in the two halves of the record"
      unit="each indicator in its own unit"
      legend={
        <>
          <LegendKey swatch={<Square color={SAGE} />}>{early}</LegendKey>
          <LegendKey swatch={<Square color={FOREST} />}>{late}</LegendKey>
        </>
      }
      note={note}
    >
      <Readout hint="Tap or hover an indicator for its change and trend. Keyboard: focus the list, then ↑ ↓.">
        {a && (
          <span>
            <span className="font-display text-forest-950">{a.label}</span>
            {' · '}
            change {isNum(a.change) ? `${signed(a.change, digits(a.unit))} ${a.unit}` : 'not available'}
            {isNum(rel) ? ` (${signed(rel * 100, 0)}%)` : ''}
            {' · '}
            trend {isNum(a.slope_per_decade) ? `${signed(a.slope_per_decade, 1)} ${a.unit} per decade` : 'not available'}
            {' · '}
            {fmtP(a.p_value)}
          </span>
        )}
      </Readout>
      <div
        {...group}
        role="group"
        aria-label={`Climate indicators, ${early} against ${late}. Use the up and down arrow keys to read each indicator’s change and trend test.`}
        className="mt-1 rounded-xl outline-offset-4"
      >
        <ul>
          {shifts.map((s, i) => {
            const r = readings[i]
            const d = digits(s.unit)
            const max = Math.max(isNum(s.early) ? s.early : 0, isNum(s.late) ? s.late : 0)
            const Arrow = r.direction === 'little' ? ArrowRight : r.direction === 'higher' ? ArrowUpRight : ArrowDownRight
            return (
              <li key={s.id} onPointerEnter={() => setActive(i)} className="break-inside-avoid border-t border-border py-1.5 first:border-t-0">
                <div
                  className={cx(
                    '-mx-2 grid gap-x-8 gap-y-3 rounded-xl px-2 py-2.5 transition-colors md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] print:mx-0 print:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] print:px-0',
                    active === i && 'bg-sand/45',
                  )}
                >
                  <div className="min-w-0">
                    <h3 className="text-[1rem] leading-snug">{s.label}</h3>
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      <Chip tone="white">
                        <Arrow className="h-3 w-3" aria-hidden="true" /> {r.label}
                      </Chip>
                      {r.direction !== 'little' && <Chip tone={r.evidence === 'consistent' ? 'lime' : 'sand'}>{r.evidenceLabel}</Chip>}
                    </p>
                    <p className="mt-2 text-[0.875rem] leading-snug text-ink">{shiftSentence(s, early, late)}</p>
                  </div>
                  <div className="min-w-0 space-y-2 self-center">
                    {[
                      { period: early, v: s.early, color: SAGE },
                      { period: late, v: s.late, color: FOREST },
                    ].map((row) => (
                      <div key={row.period}>
                        <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                          <span className="font-bold text-ink tabular-nums">{row.period}</span>
                          <span className="font-display text-[0.9375rem] font-semibold text-forest-950 tabular-nums">
                            {fmtNum(row.v, d)}
                            {isNum(row.v) && <span className="font-sans text-[0.75rem] font-bold text-ink"> {s.unit} a year</span>}
                          </span>
                        </div>
                        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                          <div className="h-full rounded-full" style={{ width: `${isNum(row.v) && row.v > 0 && max > 0 ? Math.max(1.5, (row.v / max) * 100) : 0}%`, background: row.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ yearly seasonal index */

const PLOT_H = 'h-36 sm:h-40'

/** The current rotation's simulated seasonal index in each year of the record, against the failure line. */
export function YearBars({ years, values, threshold, subject, note }: { years: number[]; values: (number | null)[]; threshold: number | null; subject: string; note: ReactNode }) {
  const n = years.length
  const { active, setActive, group } = useRoving(n)
  const nums = values.filter(isNum)
  const yMax = Math.max(1.2, Math.ceil(Math.max(...nums, 0) * 10) / 10)
  const ticks = [0, 0.5, 1].filter((t) => t <= yMax)
  const at = (v: number) => `${(v / yMax) * 100}%`
  const below = (v: number | null) => isNum(threshold) && isNum(v) && v < threshold
  const av = active !== null ? values[active] : null
  const every = n > 24 ? 5 : n > 12 ? 2 : 1
  return (
    <ChartFrame
      title="Simulated seasonal index, year by year"
      unit="index, 0 upward; not crop yield"
      legend={
        isNum(threshold) ? (
          <>
            <LegendKey swatch={<Square color={FOREST} />}>At or above the failure line</LegendKey>
            <LegendKey swatch={<Square color={SIGNAL} />}>Below the failure line</LegendKey>
            <LegendKey swatch={<span className="block w-5 border-t-[1.5px] border-dashed border-forest-950" />}>Failure line {fmtIndex(threshold)}</LegendKey>
          </>
        ) : undefined
      }
      note={note}
    >
      <Readout hint="Tap or hover a bar to read a year. Keyboard: focus the chart, then ← →.">
        {active !== null && (
          <span>
            <span className="font-display text-forest-950">{years[active]}</span>
            {' · '}
            {isNum(av) ? `seasonal index ${fmtIndex(av)}` : 'no crop season ended in this year'}
            {isNum(av) && isNum(threshold) ? (below(av) ? ' · below the failure line' : ' · at or above the failure line') : ''}
          </span>
        )}
      </Readout>
      <p className="mt-2 mb-1.5 text-[0.6875rem] font-extrabold text-muted" aria-hidden="true">
        Seasonal index
      </p>
      <div className="flex gap-2">
        <div className={cx('relative w-6 shrink-0 text-[0.6875rem] font-bold text-muted tabular-nums', PLOT_H)} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: at(t) }}>
              {t.toFixed(1)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            {...group}
            role="group"
            aria-label={`Simulated seasonal index of ${subject} in each year from ${years[0]} to ${years[n - 1]}. Use the left and right arrow keys to read each year.`}
            className={cx('relative rounded-md outline-offset-4', PLOT_H)}
          >
            {ticks.map((t) => (
              <span key={t} aria-hidden="true" className={cx('absolute inset-x-0 border-t', t === 0 ? 'border-sand-400' : 'border-sand-300')} style={{ bottom: at(t) }} />
            ))}
            <div className="absolute inset-0 flex items-end" aria-hidden="true">
              {values.map((v, i) => (
                <div key={years[i]} className="flex h-full min-w-0 flex-1 items-end justify-center" onPointerEnter={() => setActive(i)}>
                  {isNum(v) && (
                    <span
                      className="block w-[64%] max-w-6 rounded-t-[3px] transition-opacity duration-200"
                      style={{ height: `max(2px, ${at(v)})`, background: below(v) ? SIGNAL : FOREST, opacity: active === null || active === i ? 1 : 0.4 }}
                    />
                  )}
                </div>
              ))}
            </div>
            {isNum(threshold) && threshold <= yMax && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-forest-950" style={{ bottom: at(threshold) }} />
            )}
          </div>
          <div className="mt-1.5 flex h-4 text-[0.6875rem] font-bold text-muted tabular-nums" aria-hidden="true">
            {years.map((yr) => (
              <span key={yr} className="relative min-w-0 flex-1">
                {yr % every === 0 && <span className="absolute left-1/2 -translate-x-1/2 leading-none">{yr}</span>}
              </span>
            ))}
          </div>
          <p className="mt-0.5 text-center text-[0.6875rem] font-extrabold text-muted" aria-hidden="true">
            Simulated year
          </p>
        </div>
      </div>
      {/* A table ignores sr-only's 1px width, so the wrapper carries it. */}
      <div className="sr-only">
        <table>
          <caption>Simulated seasonal index of {subject}, by year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Seasonal index</th>
              {isNum(threshold) && <th scope="col">Below the failure line of {fmtIndex(threshold)}</th>}
            </tr>
          </thead>
          <tbody>
            {years.map((yr, i) => (
              <tr key={yr}>
                <th scope="row">{yr}</th>
                <td>{fmtIndex(values[i])}</td>
                {isNum(threshold) && <td>{isNum(values[i]) ? (below(values[i]) ? 'yes' : 'no') : 'not available'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ crop calendar and bare months */

/** The engine's month-by-month calendar of a rotation: filled while a crop is in the ground, hatched while the soil is bare. */
export function BareCalendar({ rotation, names, note }: { rotation: Rotation; names: Record<string, string>; note: ReactNode }) {
  const rows = calendarByYear(rotation)
  const cells = rows.flat()
  const { active, setActive, group } = useRoving(cells.length)
  const multi = rows.length > 1
  const cropOf = (c: CalendarCell | null) => (c && c.crop_id !== 'fallow_bare' ? c.crop_id : null)
  // A partly covered month at the start of a crop's run is a sowing month, so its fill sits on the right.
  const sowing = (i: number) => {
    const here = cropOf(cells[i])
    return !!here && cropOf(cells[(i - 1 + cells.length) % cells.length]) !== here && cropOf(cells[(i + 1) % cells.length]) === here
  }
  const describe = (c: CalendarCell | null, i: number) => {
    const where = `${monthName((i % 12) + 1)}${multi ? `, year ${Math.floor(i / 12) + 1}` : ''}`
    if (!c) return `${where}: not in the engine calendar`
    const crop = cropOf(c)
    return `${where}: ${fmtPct(c.bare_frac)} of days with no crop in the ground · ${BARE_LABELS[bareLevel(c.bare_frac)]} · ${crop ? `${names[crop] ?? crop} in the ground` : 'no crop'}`
  }
  if (!rotation.calendar?.length) return <p className="text-[0.9375rem] text-ink">The engine did not return a month-by-month calendar for this rotation.</p>
  return (
    <ChartFrame
      title="Crop calendar of the current rotation"
      unit="share of each month’s days with a crop in the ground"
      legend={
        <>
          <LegendKey swatch={<Square color={FOREST} />}>Crop in the ground</LegendKey>
          <LegendKey swatch={<Square className={cx('border border-sand-400', HATCH)} />}>No crop: bare soil</LegendKey>
        </>
      }
      note={note}
    >
      <Readout hint="Tap or hover a month to read it. Keyboard: focus the calendar, then ← →.">{active !== null && <span>{describe(cells[active], active)}</span>}</Readout>
      <div
        {...group}
        role="group"
        aria-label={`Month-by-month calendar of ${rotationLabel(rotation)}. Use the left and right arrow keys to read each month.`}
        className="mt-2 rounded-md outline-offset-4"
      >
        {rows.map((row, y) => (
          <div key={y} className={cx('flex items-center gap-2', y > 0 && 'mt-1.5')} aria-hidden="true">
            {multi && <span className="w-12 shrink-0 text-[0.6875rem] font-extrabold text-muted">Year {y + 1}</span>}
            <div className="grid min-w-0 flex-1 grid-cols-12 gap-[3px]">
              {row.map((c, m) => {
                const i = y * 12 + m
                const fill = cropOf(c) ? Math.max(0, Math.min(1, 1 - (c as CalendarCell).bare_frac)) : 0
                return (
                  <span
                    key={m}
                    onPointerEnter={() => setActive(i)}
                    className={cx('relative block h-7 overflow-hidden rounded-[4px] border', HATCH, active === i ? 'border-forest-950' : 'border-sand-400/80')}
                  >
                    {fill > 0 && <span className={cx('absolute inset-y-0 block', sowing(i) ? 'right-0' : 'left-0')} style={{ width: `${fill * 100}%`, background: FOREST }} />}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
        <div className={cx('mt-1.5 flex gap-2', multi && 'pl-14')} aria-hidden="true">
          <div className="grid min-w-0 flex-1 grid-cols-12 gap-[3px]">
            {Array.from({ length: 12 }, (_, m) => (
              <span key={m} className="text-center text-[0.6875rem] font-extrabold text-muted">
                <span className="sm:hidden print:hidden">{monthName(m + 1, true).charAt(0)}</span>
                <span className="hidden sm:inline print:inline">{monthName(m + 1, true)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>Calendar of {rotationLabel(rotation)}: share of each month’s days with no crop in the ground</caption>
          <thead>
            <tr>
              {multi && <th scope="col">Rotation year</th>}
              <th scope="col">Month</th>
              <th scope="col">Crop</th>
              <th scope="col">Days with no crop</th>
              <th scope="col">Level</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((c, i) => (
              <tr key={i}>
                {multi && <td>{Math.floor(i / 12) + 1}</td>}
                <th scope="row">{monthName((i % 12) + 1)}</th>
                <td>{cropOf(c) ? (names[cropOf(c) as string] ?? cropOf(c)) : 'none'}</td>
                <td>{c ? fmtPct(c.bare_frac) : 'not available'}</td>
                <td>{c ? BARE_LABELS[bareLevel(c.bare_frac)] : 'not available'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------------ lower-decile to median index, per rotation */

/** For each rotation, the seasonal index in weaker years (P10, bar mark) and in a typical year (median, dot). */
export function IndexRange({ rotations, threshold, total, note }: { rotations: Rotation[]; threshold: number | null; total: number; note: ReactNode }) {
  const { active, setActive, group } = useRoving(rotations.length)
  const vals = rotations.flatMap((r) => [r.hindcast.p10, r.hindcast.median]).filter(isNum)
  const xMax = Math.max(1.2, Math.ceil(Math.max(...vals, 0) * 10) / 10)
  const at = (v: number) => `${Math.max(0, Math.min(1, v / xMax)) * 100}%`
  const ticks = [0, 0.5, 1].filter((t) => t <= xMax)
  const ar = active !== null ? rotations[active] : null
  const af = ar ? seasonsFailed(ar) : null
  const name = (r: Rotation) => `#${r.scores?.rank ?? '—'} ${rotationLabel(r)}`
  return (
    <ChartFrame
      title="Seasonal index in weaker years and in a typical year"
      unit="index, 0 upward; not crop yield"
      legend={
        <>
          <LegendKey swatch={<span className="block h-4 w-1 rounded-full bg-forest-800" />}>Lower-decile (P10) index</LegendKey>
          <LegendKey swatch={<span className="block h-3 w-3 rounded-full bg-forest-800" />}>Median index</LegendKey>
          {isNum(threshold) && <LegendKey swatch={<span className="block h-4 border-l-[1.5px] border-dashed border-forest-950" />}>Failure line {fmtIndex(threshold)}</LegendKey>}
          <LegendKey swatch={<Square color={PERI} />}>Current rotation</LegendKey>
          <LegendKey swatch={<Square color={FOREST} />}>Alternative</LegendKey>
        </>
      }
      note={note}
    >
      <Readout hint="Tap or hover a rotation to read its values. Keyboard: focus the chart, then ↑ ↓.">
        {ar && (
          <span>
            <span className="font-display text-forest-950">
              {name(ar)}
              {ar.is_current ? ' (current)' : ''}
            </span>
            {' · '}
            lower-decile index {fmtIndex(ar.hindcast.p10)} · median {fmtIndex(ar.hindcast.median)} · failure frequency {fmtPct(ar.hindcast.failure_freq)}
            {af ? ` (${af.failed} of ${af.total} seasons)` : ''}
          </span>
        )}
      </Readout>
      <div
        {...group}
        role="group"
        aria-label={`Lower-decile and median seasonal index of ${rotations.length} of the ${total} rotations in this analysis. Use the up and down arrow keys to read each rotation.`}
        className="mt-2 rounded-md outline-offset-4"
      >
        <ul className="space-y-2" aria-hidden="true">
          {rotations.map((r, i) => {
            const color = r.is_current ? PERI : FOREST
            const { p10, median } = r.hindcast
            const both = isNum(p10) && isNum(median)
            return (
              <li key={r.id} onPointerEnter={() => setActive(i)} className={cx('-mx-2 break-inside-avoid rounded-xl px-2 py-2 transition-colors print:mx-0 print:px-0', active === i && 'bg-sand/45')}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[0.8125rem]">
                  <span className="min-w-0 font-bold text-ink">
                    {name(r)}
                    {r.is_current && <span className="font-extrabold text-peri-ink"> · current</span>}
                  </span>
                  <span className="shrink-0 font-display text-[0.875rem] font-semibold text-forest-950 tabular-nums">
                    P10 {fmtIndex(p10)} · median {fmtIndex(median)}
                  </span>
                </div>
                <div className="relative mx-2.5 mt-1.5 h-6">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-sand-400" />
                  {isNum(threshold) && threshold <= xMax && <span className="absolute inset-y-0 border-l-[1.5px] border-dashed border-forest-950" style={{ left: at(threshold) }} />}
                  {both && (
                    <span
                      className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                      style={{ left: at(Math.min(p10, median)), width: `calc(${at(Math.max(p10, median))} - ${at(Math.min(p10, median))})`, background: color }}
                    />
                  )}
                  {isNum(p10) && <span className="absolute top-1/2 h-[1.375rem] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: at(p10), background: color }} />}
                  {isNum(median) && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: at(median), background: color }} />}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="relative mx-2.5 mt-1 h-4 text-[0.6875rem] font-bold text-muted tabular-nums" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 leading-none" style={{ left: at(t) }}>
              {t.toFixed(1)}
            </span>
          ))}
        </div>
        <p className="text-center text-[0.6875rem] font-extrabold text-muted" aria-hidden="true">
          Seasonal index
        </p>
      </div>
      <div className="sr-only">
        <table>
          <caption>Lower-decile and median seasonal index by rotation</caption>
          <thead>
            <tr>
              <th scope="col">Rotation</th>
              <th scope="col">Lower-decile (P10) index</th>
              <th scope="col">Median index</th>
              <th scope="col">Failure frequency</th>
            </tr>
          </thead>
          <tbody>
            {rotations.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  {name(r)}
                  {r.is_current ? ' (current)' : ''}
                </th>
                <td>{fmtIndex(r.hindcast.p10)}</td>
                <td>{fmtIndex(r.hindcast.median)}</td>
                <td>{fmtPct(r.hindcast.failure_freq)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  )
}
