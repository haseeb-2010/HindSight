import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useElementWidth } from '../../../hooks/useElementWidth'
import { fmtNum } from '../../../lib/format'
import { monthName } from '../../lib/insights'
import type { MonthBalance } from './waterText'

const RAIN = 'var(--color-peri-chart)'
const ET0 = 'var(--color-forest-800)'

/** A round axis step that gives at most five intervals. */
function niceStep(top: number): number {
  return [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => top / s <= 5) ?? 2000
}

/** A column with a rounded data end and a square baseline. */
function columnPath(x: number, yTop: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${yTop + h}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + h}Z`
}

function gapText(r: MonthBalance): string {
  const d = r.et0Shown - r.rainShown
  if (d > 0) return `ET0 above rainfall by ${fmtNum(d)} mm`
  if (d < 0) return `rainfall above ET0 by ${fmtNum(-d)} mm`
  return 'rainfall and ET0 equal'
}

/**
 * Record-average rainfall (columns) against reference evapotranspiration (line) for the twelve calendar months,
 * on one millimetre axis. A strip under the month names marks the months in which ET0 is above rainfall.
 */
export function MonthlyBalanceChart({ rows, period, summary }: { rows: MonthBalance[]; period: string; summary: string }) {
  const [wrap, width] = useElementWidth<HTMLDivElement>(640)
  const [active, setActive] = useState<number | null>(null)
  const narrow = width < 460
  const height = narrow ? 236 : 276
  const pad = { l: 38, r: 6, t: 12, b: 42 }
  const innerW = Math.max(width - pad.l - pad.r, 60)
  const innerH = height - pad.t - pad.b
  const top = Math.max(...rows.map((r) => Math.max(r.rain, r.et0)), 1)
  const step = niceStep(top)
  const yMax = Math.ceil(top / step) * step
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step)
  const band = innerW / 12
  const mid = (i: number) => pad.l + (i + 0.5) * band
  const y = (v: number) => pad.t + innerH - (v / yMax) * innerH
  const barW = Math.min(24, band * 0.52)
  const base = pad.t + innerH
  const line = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${mid(i).toFixed(1)},${y(r.et0).toFixed(1)}`).join('')

  // consecutive months with ET0 above rainfall, as stretches along the January-to-December axis
  const stretches: [number, number][] = []
  rows.forEach((r, i) => {
    if (!r.exceeds) return
    const last = stretches[stretches.length - 1]
    if (last && last[1] === i - 1) last[1] = i
    else stretches.push([i, i])
  })

  const indexAt = (clientX: number, left: number) => Math.max(0, Math.min(11, Math.floor((clientX - left - pad.l) / band)))
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return setActive(null)
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    setActive((a) => {
      if (e.key === 'Home') return 0
      if (e.key === 'End') return 11
      if (a === null) return e.key === 'ArrowLeft' ? 11 : 0
      return Math.max(0, Math.min(11, a + (e.key === 'ArrowLeft' ? -1 : 1)))
    })
  }
  const at = active === null ? null : rows[active]

  return (
    <figure className="m-0 min-w-0">
      <figcaption>
        <span className="block font-display text-[1.0625rem] leading-tight font-semibold text-forest-950">Rainfall against reference evapotranspiration, month by month</span>
        <span className="mt-1 block text-[0.8125rem] leading-snug text-muted">Average for each calendar month over {period}, in millimetres per month.</span>
      </figcaption>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-bold text-ink" aria-label="Chart legend">
          <li className="inline-flex items-center gap-2">
            <svg width="12" height="12" aria-hidden="true">
              <path d={columnPath(1, 1, 10, 11)} fill={RAIN} />
            </svg>
            Rainfall (gridded estimate)
          </li>
          <li className="inline-flex items-center gap-2">
            <svg width="24" height="12" aria-hidden="true">
              <line x1="1" x2="23" y1="6" y2="6" stroke={ET0} strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="6" r="4" fill={ET0} stroke="#fff" strokeWidth="2" />
            </svg>
            Reference evapotranspiration (ET0)
          </li>
          <li className="inline-flex items-center gap-2">
            <svg width="22" height="12" aria-hidden="true">
              <rect x="0" y="3.5" width="22" height="5" rx="2.5" fill={ET0} />
            </svg>
            Months with ET0 above rainfall
          </li>
        </ul>
        <p aria-live="polite" className="rounded-lg bg-sand px-2.5 py-1 text-[0.75rem] font-bold text-ink tabular-nums">
          {at ? (
            <>
              <span className="font-display text-forest-950">{monthName(at.month)}</span>
              <span className="sr-only">: </span>
              <span className="ml-2.5">Rainfall {fmtNum(at.rainShown)} mm</span>
              <span className="sr-only">, </span>
              <span className="ml-2.5">ET0 {fmtNum(at.et0Shown)} mm</span>{' '}
              <span className="ml-1.5 font-semibold">({gapText(at)})</span>
            </>
          ) : (
            <span>Hover, tap or use ← → keys</span>
          )}
        </p>
      </div>

      <p className="mt-3 mb-1 text-[0.75rem] font-extrabold text-muted" aria-hidden="true">
        mm per month
      </p>
      <div
        ref={wrap}
        tabIndex={0}
        role="group"
        aria-label={`Chart: ${summary} Use the left and right arrow keys to read each month. The same values are in the table below.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="relative rounded-xl outline-offset-4"
      >
        <svg
          width={width}
          height={height}
          className="block touch-pan-y"
          aria-hidden="true"
          onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect().left))}
          onPointerDown={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect().left))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        >
          {active !== null && <rect x={pad.l + active * band} y={pad.t - 4} width={band} height={innerH + 4} rx={6} fill="var(--color-sand)" opacity={0.75} />}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--color-sand-400)' : 'var(--color-sand-300)'} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px] font-bold tabular-nums">
                {fmtNum(t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const h = Math.max(base - y(r.rain), r.rain > 0 ? 1.5 : 0)
            return h > 0 ? (
              <path
                key={r.month}
                d={columnPath(mid(i) - barW / 2, base - h, barW, h)}
                fill={RAIN}
                className="bar-grow"
                style={{ '--delay': `${i * 25}ms`, transformBox: 'fill-box' } as CSSProperties}
              />
            ) : null
          })}
          <path d={line} fill="none" stroke={ET0} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {rows.map((r, i) => (
            <circle key={r.month} cx={mid(i)} cy={y(r.et0)} r={active === i ? 5 : 4} fill={ET0} stroke="#fff" strokeWidth={2} />
          ))}
          {rows.map((r, i) => (
            <text
              key={r.month}
              x={mid(i)}
              y={base + 17}
              textAnchor="middle"
              className={active === i ? 'fill-forest-950 text-[11px] font-extrabold' : 'fill-muted text-[11px] font-bold'}
            >
              {narrow ? monthName(r.month).charAt(0) : monthName(r.month, true)}
            </text>
          ))}
          {stretches.map(([a, b]) => (
            <rect key={a} x={pad.l + a * band + 3} y={base + 27} width={(b - a + 1) * band - 6} height={5} rx={2.5} fill={ET0} />
          ))}
        </svg>
      </div>

      <p className="mt-2 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">{summary}</p>

      <details className="group mt-3">
        <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-[0.8125rem] font-extrabold text-forest-950 underline decoration-sage decoration-[1.5px] underline-offset-[3px] hover:decoration-forest-950">
          <span className="group-open:hidden">Show the monthly values as a table</span>
          <span className="hidden group-open:inline">Hide the table</span>
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[19rem] border-separate border-spacing-0 text-[0.8125rem]">
            <caption className="sr-only">Average rainfall and reference evapotranspiration for each calendar month over {period}, in millimetres</caption>
            <thead className="text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
              <tr>
                <th scope="col" className="pb-2 text-left">
                  Month
                </th>
                <th scope="col" className="pb-2 pl-3 text-right">
                  Rainfall (mm)
                </th>
                <th scope="col" className="pb-2 pl-3 text-right">
                  ET0 (mm)
                </th>
                <th scope="col" className="pb-2 pl-3 text-left">
                  Comparison
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <th scope="row" className="border-t border-border py-1.5 text-left font-bold text-forest-950">
                    {monthName(r.month)}
                  </th>
                  <td className="border-t border-border py-1.5 pl-3 text-right font-semibold text-ink tabular-nums">{fmtNum(r.rainShown)}</td>
                  <td className="border-t border-border py-1.5 pl-3 text-right font-semibold text-ink tabular-nums">{fmtNum(r.et0Shown)}</td>
                  <td className="border-t border-border py-1.5 pl-3 text-left font-semibold text-ink tabular-nums">{gapText(r).replace(/^./, (c) => c.toUpperCase())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
