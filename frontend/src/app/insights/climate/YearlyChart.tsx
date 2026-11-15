import { ChevronDown, Table2 } from 'lucide-react'
import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useElementWidth } from '../../../hooks/useElementWidth'
import { fmtNum, isNum, yearList } from '../../../lib/format'
import type { ClimateShift } from '../../../lib/types'
import { shiftSentence, windowMean } from '../../lib/insights'
import { meanDigits, niceAxis, withUnit } from './axis'
import { inWindow, type Windows, type YearSeries } from './IndicatorCards'

const PAD = { l: 46, r: 8, t: 36, b: 26 }
const EARLY = 'var(--color-sage)'
const LATE = 'var(--color-forest-800)'
const OTHER = 'var(--color-sand-400)'

/** A bar that is square on the baseline and rounded at the data end. */
function barPath(x: number, top: number, w: number, bottom: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, bottom - top))
  return `M${x},${bottom}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + w - rr}Q${x + w},${top} ${x + w},${top + rr}V${bottom}Z`
}

/** The years in which a series reaches `target`, as words. */
function whenText(years: number[], values: number[], target: number): string {
  const ys = years.filter((_, i) => values[i] === target)
  if (ys.length === 1) return `in ${ys[0]}`
  return ys.length <= 4 ? `in ${ys.length} years (${yearList(ys)})` : `in ${ys.length} of ${years.length} years`
}

/**
 * One indicator in every year of the record. The two comparison periods are separate labelled bands with
 * their own bar tone, and each period's mean is drawn as a line labelled with the value the engine reported.
 * `earlySpan` and `lateSpan` are the periods' years ("1985–2004"), or null when the engine did not report them.
 */
export function YearlyChart({
  shift,
  series,
  windows,
  earlySpan,
  lateSpan,
}: {
  shift: ClimateShift
  series: YearSeries
  windows: Windows
  earlySpan: string | null
  lateSpan: string | null
}) {
  const [wrap, width] = useElementWidth<HTMLDivElement>(720)
  const [active, setActive] = useState<number | null>(null)
  const { years, values } = series
  const n = years.length
  const narrow = width < 520
  const height = narrow ? 268 : 328
  const unit = shift.unit
  const d = meanDigits(unit)
  const yearDigits = 0
  // The table prints the stored yearly values exactly: millimetres to one decimal, day counts whole.
  const tableDigits = unit === 'mm' ? 1 : 0
  const earlyIn = earlySpan ?? 'the earlier period'
  const lateIn = lateSpan ?? 'the later period'

  const innerW = Math.max(width - PAD.l - PAD.r, 80)
  const innerH = height - PAD.t - PAD.b
  const bottom = PAD.t + innerH
  const step = innerW / Math.max(n, 1)
  const barW = Math.max(2, Math.min(step - 2, step * 0.7, 26))
  const x = (i: number) => PAD.l + i * step

  const bandOf = (w: [number, number] | undefined) => {
    const idx = years.map((yr, i) => (inWindow(yr, w) ? i : -1)).filter((i) => i >= 0)
    return idx.length ? { x0: x(idx[0]) + 1.5, x1: x(idx[idx.length - 1]) + step - 1.5 } : null
  }
  // A mean line is drawn only for a period the engine reported a mean for. Its height comes from the bars
  // drawn (windowMean); the printed label is the engine's own value.
  const meanOf = (w: [number, number] | undefined, value: number | null) => (isNum(value) ? (windowMean(years, values, w) ?? value) : null)
  const periods = [
    { key: 'early', word: 'Earlier period', span: earlySpan, band: bandOf(windows?.early), pos: meanOf(windows?.early, shift.early), value: shift.early, fill: EARLY, window: windows?.early },
    { key: 'late', word: 'Later period', span: lateSpan, band: bandOf(windows?.late), pos: meanOf(windows?.late, shift.late), value: shift.late, fill: LATE, window: windows?.late },
  ]
  const banded = periods.filter((p) => p.band)
  const means = banded.filter((p) => isNum(p.pos))
  const periodOf = (yr: number) => periods.find((p) => inWindow(yr, p.window))

  const axis = niceAxis(Math.max(...values, ...means.map((p) => p.pos as number), 0), unit === 'days')
  const y = (v: number) => bottom - (v / axis.max) * innerH
  const yearTicks = years.map((yr, i) => ({ yr, i })).filter(({ yr }) => yr % (narrow ? 10 : 5) === 0)

  const indexAt = (e: PointerEvent<SVGSVGElement>) => {
    const rel = e.clientX - e.currentTarget.getBoundingClientRect().left - PAD.l
    return Math.max(0, Math.min(n - 1, Math.floor(rel / step)))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    setActive((a) => {
      if (e.key === 'Home') return 0
      if (e.key === 'End') return n - 1
      if (a === null) return e.key === 'ArrowLeft' ? n - 1 : 0
      return Math.max(0, Math.min(n - 1, a + (e.key === 'ArrowLeft' ? -1 : 1)))
    })
  }

  const hi = Math.max(...values)
  const lo = Math.min(...values)
  const axisTitle = unit === 'days' ? 'Days in each year' : unit === 'mm' ? 'Millimetres in each year' : `${unit} in each year`
  const summary =
    `${shift.label} in each year from ${years[0]} to ${years[n - 1]}, in ${unit}.` +
    (isNum(shift.early) && isNum(shift.late) ? ` The mean is ${withUnit(shift.early, unit, d)} in ${earlyIn} and ${withUnit(shift.late, unit, d)} in ${lateIn}.` : '')

  const activePeriod = active !== null ? periodOf(years[active]) : undefined
  const rowsOf = (keep: (yr: number) => boolean) => years.map((yr, i) => ({ yr, v: values[i] })).filter((r) => keep(r.yr))
  const tables = [
    ...periods.map((p) => ({ key: p.key, title: p.span ? `${p.word}, ${p.span}` : p.word, mean: p.value, rows: rowsOf((yr) => inWindow(yr, p.window)) })),
    { key: 'other', title: banded.length ? 'Years outside both periods' : 'Every year of the record', mean: null, rows: rowsOf((yr) => !periodOf(yr)) },
  ].filter((g) => g.rows.length > 0)

  return (
    <figure className="m-0 min-w-0">
      <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-bold text-ink" aria-label="Legend">
          {banded.map((p) => (
            <li key={p.key} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: p.fill }} />
              <span>
                {p.word} <span className="tabular-nums">{p.span}</span>
              </span>
            </li>
          ))}
          {banded.length === 0 && (
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: OTHER }} />
              One bar for each year
            </li>
          )}
          {means.length > 0 && (
            <li className="inline-flex items-center gap-2">
              <svg width="22" height="8" aria-hidden="true">
                <line x1="1" x2="21" y1="4" y2="4" stroke="var(--color-forest-950)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Mean of each period
            </li>
          )}
        </ul>
        <div aria-live="polite" className="min-w-[18rem] rounded-lg bg-sand px-2.5 py-1 text-center text-[0.75rem] font-bold text-ink tabular-nums">
          {active === null ? (
            <span>Hover, tap or use ← → keys to read a year</span>
          ) : (
            <span>
              <span className="font-display text-forest-950">{years[active]}</span> · {withUnit(values[active], unit, yearDigits)}
              {activePeriod ? ` · ${activePeriod.word.toLowerCase()}` : ''}
            </span>
          )}
        </div>
      </div>

      <p className="mb-1 text-[0.75rem] font-extrabold text-muted" aria-hidden="true">
        {axisTitle}
      </p>
      <div
        ref={wrap}
        tabIndex={0}
        role="group"
        aria-label={`${summary} Use the left and right arrow keys to read each year. A table of every value follows the chart.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="relative rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-forest-950"
      >
        <svg
          width={width}
          height={height}
          className="block touch-pan-y select-none"
          aria-hidden="true"
          onPointerMove={(e) => setActive(indexAt(e))}
          onPointerDown={(e) => setActive(indexAt(e))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        >
          {banded.map((p) => {
            const b = p.band as { x0: number; x1: number }
            return (
              <g key={p.key}>
                <rect x={b.x0} y={PAD.t - 26} width={b.x1 - b.x0} height={innerH + 26} rx={10} fill="var(--color-sand)" opacity={0.55} />
                <text x={(b.x0 + b.x1) / 2} y={PAD.t - 9} textAnchor="middle" className="fill-forest-950 text-[11px] font-extrabold">
                  {b.x1 - b.x0 > 210 ? `${p.word} · ${p.span}` : p.span}
                </text>
              </g>
            )
          })}
          {axis.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--color-sand-400)' : 'var(--color-sand-300)'} />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px] font-bold">
                {fmtNum(t, axis.digits)}
              </text>
            </g>
          ))}
          {active !== null && <rect x={x(active)} y={PAD.t} width={step} height={innerH} fill="var(--color-forest-950)" opacity={0.08} />}
          <g>
            {values.map((v, i) => {
              if (!(v > 0)) return null
              const top = Math.min(y(v), bottom - 1.5)
              return (
                <path
                  key={years[i]}
                  d={barPath(x(i) + (step - barW) / 2, top, barW, bottom, 3)}
                  fill={periodOf(years[i])?.fill ?? OTHER}
                  opacity={active === null || active === i ? 1 : 0.62}
                  className="bar-grow transition-opacity duration-200"
                  style={{ '--delay': `${i * 9}ms`, transformBox: 'fill-box' } as CSSProperties}
                />
              )
            })}
          </g>
          {yearTicks.map(({ yr, i }) => (
            <text key={yr} x={x(i) + step / 2} y={height - 7} textAnchor="middle" className="fill-muted text-[11px] font-bold">
              {yr}
            </text>
          ))}
          {means.map((p) => {
            const b = p.band as { x0: number; x1: number }
            const ly = y(p.pos as number)
            const text = `Mean ${withUnit(p.value, unit, d)}`
            const w = text.length * 6.3 + 18
            const lx = Math.max(PAD.l, Math.min(width - PAD.r - w, p.key === 'early' ? b.x0 + 6 : b.x1 - 6 - w))
            const top = ly - 30 >= PAD.t ? ly - 29 : ly + 8
            return (
              <g key={p.key}>
                <line x1={b.x0 + 3} x2={b.x1 - 3} y1={ly} y2={ly} stroke="#fff" strokeWidth={5.5} strokeLinecap="round" />
                <line x1={b.x0 + 3} x2={b.x1 - 3} y1={ly} y2={ly} stroke="var(--color-forest-950)" strokeWidth={2.25} strokeLinecap="round" />
                <rect x={lx} y={top} width={w} height={21} rx={10.5} fill="#fff" stroke="var(--color-forest-950)" strokeWidth={1.25} />
                <text x={lx + w / 2} y={top + 14.5} textAnchor="middle" className="fill-forest-950 text-[11px] font-extrabold">
                  {text}
                </text>
              </g>
            )
          })}
          {active !== null &&
            (() => {
              const v = values[active]
              const text = `${years[active]}: ${withUnit(v, unit, yearDigits)}`
              const w = text.length * 6.3 + 18
              const mid = x(active) + step / 2
              const lx = Math.max(PAD.l, Math.min(width - PAD.r - w, mid - w / 2))
              const top = Math.max(PAD.t - 24, y(Math.max(v, 0)) - 30)
              return (
                <g>
                  <rect x={lx} y={top} width={w} height={22} rx={11} fill="var(--color-forest-950)" />
                  <text x={lx + w / 2} y={top + 15} textAnchor="middle" className="fill-cream-50 text-[11px] font-extrabold">
                    {text}
                  </text>
                </g>
              )
            })()}
        </svg>
      </div>

      <figcaption className="mt-4 rounded-2xl bg-sand/60 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">{shiftSentence(shift, earlyIn, lateIn)}</figcaption>

      <dl className="mt-4 grid gap-x-8 gap-y-3 text-[0.875rem] sm:grid-cols-2">
        <div>
          <dt className="font-bold text-muted">Highest year in the record</dt>
          <dd className="mt-0.5 font-semibold text-forest-950 tabular-nums">
            {withUnit(hi, unit, yearDigits)} {whenText(years, values, hi)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-muted">Lowest year in the record</dt>
          <dd className="mt-0.5 font-semibold text-forest-950 tabular-nums">
            {withUnit(lo, unit, yearDigits)} {whenText(years, values, lo)}
          </dd>
        </div>
      </dl>

      <details className="group mt-4 rounded-2xl bg-sand/50">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 text-[0.875rem] font-extrabold text-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950 [&::-webkit-details-marker]:hidden">
          <Table2 className="h-4 w-4" aria-hidden="true" />
          Yearly values as a table
          <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-x-10 gap-y-5 px-4 pt-1 pb-4 sm:grid-cols-2">
          {tables.map((g) => (
            <table key={g.key} className="w-full self-start text-[0.8125rem] tabular-nums">
              <caption className="pb-1.5 text-left font-extrabold text-forest-950">
                {g.title}
                {isNum(g.mean) && <span className="font-bold text-ink"> · mean {withUnit(g.mean, unit, d)}</span>}
              </caption>
              <thead>
                <tr className="text-left text-[0.75rem] text-ink">
                  <th scope="col" className="border-b border-sand-400 py-1 font-extrabold">
                    Year
                  </th>
                  <th scope="col" className="border-b border-sand-400 py-1 text-right font-extrabold">
                    {shift.label} ({unit})
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.yr}>
                    <th scope="row" className="border-b border-sand-300 py-1 text-left font-bold text-ink">
                      {r.yr}
                    </th>
                    <td className="border-b border-sand-300 py-1 text-right font-semibold text-forest-950">{fmtNum(r.v, tableDigits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </details>
    </figure>
  )
}
