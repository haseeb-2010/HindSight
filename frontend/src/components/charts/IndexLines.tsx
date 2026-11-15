import { useMemo, useState, type KeyboardEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { fmtIndex, isNum } from '../../lib/format'

export interface Series {
  label: string
  values: (number | null)[]
  color: string
  dashed?: boolean
}

interface IndexLinesProps {
  years: number[]
  series: Series[]
  threshold: number | null
  highlightYears?: number[]
  highlightLabel?: string
  caption: string
  height?: number
}

const PAD = { l: 34, r: 12, t: 14, b: 26 }

function pathFor(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (!isNum(v)) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return d
}

/** Season index per year for several rotations, with failure line, highlighted years,
 *  pointer + keyboard crosshair, and a screen-reader data table. */
export function IndexLines({ years, series, threshold, highlightYears = [], highlightLabel, caption, height = 248 }: IndexLinesProps) {
  const [wrap, width] = useElementWidth<HTMLDivElement>(640)
  const [active, setActive] = useState<number | null>(null)
  const n = years.length
  const all = series.flatMap((s) => s.values).filter(isNum)
  const yMax = Math.max(1.2, Math.ceil(Math.max(...all, 0) * 10) / 10)
  const innerW = Math.max(width - PAD.l - PAD.r, 50)
  const innerH = height - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => PAD.t + innerH - (v / yMax) * innerH
  const colW = innerW / Math.max(n - 1, 1)
  const ticks = useMemo(() => [0, 0.5, 1].filter((t) => t <= yMax), [yMax])
  const yearTicks = years.filter((yr) => yr % (width < 440 ? 10 : 5) === 0)
  const hl = new Set(highlightYears)

  const indexFromPointer = (clientX: number, rectLeft: number) => {
    const rel = clientX - rectLeft - PAD.l
    return Math.max(0, Math.min(n - 1, Math.round(rel / colW)))
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    setActive((a) => {
      const cur = a ?? n - 1
      if (e.key === 'Home') return 0
      if (e.key === 'End') return n - 1
      return Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowLeft' ? -1 : 1)))
    })
  }

  return (
    <figure className="m-0">
      <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-bold text-ink">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-2">
              <svg width="22" height="8" aria-hidden="true">
                <line x1="1" x2="21" y1="4" y2="4" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '4 3' : undefined} strokeLinecap="round" />
              </svg>
              {s.label}
            </span>
          ))}
          {isNum(threshold) && (
            <span className="inline-flex items-center gap-2 text-signal-ink">
              <svg width="22" height="8" aria-hidden="true">
                <line x1="1" x2="21" y1="4" y2="4" stroke="var(--color-signal-600)" strokeWidth="2" strokeDasharray="4 3" />
              </svg>
              Failure line {fmtIndex(threshold)}
            </span>
          )}
          {highlightYears.length > 0 && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-[3px] bg-lime ring-1 ring-forest-950/15" />
              {highlightLabel}
            </span>
          )}
        </div>
        <div aria-live="polite" className="rounded-lg bg-sand px-2.5 py-1 text-[0.75rem] font-bold text-ink tabular-nums">
          {active === null ? (
            <span className="text-muted">Hover or use ← → keys</span>
          ) : (
            <span>
              <span className="font-display text-forest-950">{years[active]}</span>
              {series.map((s) => (
                <span key={s.label} className="ml-2.5">
                  <span style={{ color: s.color }}>●</span> {fmtIndex(s.values[active])}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      <div
        ref={wrap}
        tabIndex={0}
        role="group"
        aria-label={`${caption} Use the left and right arrow keys to read each year.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="relative rounded-xl outline-offset-4"
      >
        <svg
          width={width}
          height={height}
          className="block touch-pan-y"
          aria-hidden="true"
          onPointerMove={(e) => setActive(indexFromPointer(e.clientX, e.currentTarget.getBoundingClientRect().left))}
          onPointerLeave={() => setActive(null)}
        >
          {years.map((yr, i) =>
            hl.has(yr) ? (
              <rect key={yr} x={x(i) - colW / 2} y={PAD.t} width={colW} height={innerH} fill="var(--color-lime)" opacity={0.55} rx={2} />
            ) : null,
          )}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-sand-300)" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px] font-bold">
                {t.toFixed(1)}
              </text>
            </g>
          ))}
          {isNum(threshold) && (
            <line x1={PAD.l} x2={width - PAD.r} y1={y(threshold)} y2={y(threshold)} stroke="var(--color-signal-600)" strokeWidth={1.5} strokeDasharray="5 4" />
          )}
          {yearTicks.map((yr) => {
            const i = years.indexOf(yr)
            return (
              <text key={yr} x={x(i)} y={height - 6} textAnchor="middle" className="fill-muted text-[11px] font-bold">
                {yr}
              </text>
            )
          })}
          {series.map((s) => (
            <path
              key={s.label}
              d={pathFor(s.values, x, y)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 2 : 2.6}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={PAD.t + innerH} stroke="var(--color-forest-950)" strokeOpacity={0.3} />
              {series.map((s) => {
                const v = s.values[active]
                return isNum(v) ? <circle key={s.label} cx={x(active)} cy={y(v)} r={4.5} fill="#fff" stroke={s.color} strokeWidth={2.5} /> : null
              })}
            </g>
          )}
        </svg>
      </div>
      {/* A table ignores sr-only's 1px width, so the wrapper carries it. */}
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            {series.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((yr, i) => (
            <tr key={yr}>
              <th scope="row">{yr}</th>
              {series.map((s) => (
                <td key={s.label}>{fmtIndex(s.values[i])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  )
}
