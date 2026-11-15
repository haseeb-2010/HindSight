import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { InfoTip } from '../../../components/ui/InfoTip'
import { failureThreshold, indexVaries, isIrrigated, rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import { fmtIndex, isNum, yearList } from '../../../lib/format'
import type { AnalysisEnvelope, Rotation } from '../../../lib/types'
import { Callout } from '../../components/controls'
import { METRIC_BY_ID, fmtMetricDelta, worstYearTable, type WorstYearRow } from '../../lib/insights'
import { Chip, Panel, TIP } from '../../results/shared'
import { LegendKey, RankBlock, axisPos } from './shared'

const TITLE = 'How do alternative rotations compare in your toughest historical years?'
const INDEX = METRIC_BY_ID.median

type Direction = 'higher' | 'lower' | 'similar'

/** Uses the index "about the same" margin from the shared interpretation rules (METRICS). */
function direction(delta: number | null): Direction | null {
  if (!isNum(delta)) return null
  if (Math.abs(delta) < INDEX.similar) return 'similar'
  return delta > 0 ? 'higher' : 'lower'
}

const DIRECTION_WORDS: Record<Direction, string> = { higher: 'higher', lower: 'lower', similar: 'about the same' }

/** Shading from the lowest to the highest index in the table: one hue, light to dark. Values are always printed as well. */
function shade(v: number | null, lo: number, hi: number): CSSProperties {
  if (!isNum(v)) return { background: 'var(--color-sand)' }
  const t = hi - lo > 1e-9 ? (v - lo) / (hi - lo) : 0.5
  return { background: `color-mix(in srgb, var(--color-forest-800) ${(6 + t * 36).toFixed(1)}%, white)` }
}

function Delta({ row }: { row: WorstYearRow }) {
  if (row.rotation.is_current) return <span className="text-[0.8125rem] font-bold text-peri-ink">The reference</span>
  const d = direction(row.deltaVsCurrent)
  if (!d) return <span className="text-[0.8125rem] font-semibold text-muted">Not available</span>
  const Icon = d === 'higher' ? ArrowUpRight : d === 'lower' ? ArrowDownRight : Minus
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0 text-forest-800" aria-hidden="true" />
      <span className="font-display text-[1rem] font-semibold text-forest-950 tabular-nums">{fmtMetricDelta(INDEX, row.deltaVsCurrent)}</span>
      <span className="text-[0.8125rem] font-semibold text-ink">{DIRECTION_WORDS[d]}</span>
    </span>
  )
}

function MeanBar({ row, max, thr }: { row: WorstYearRow; max: number; thr: number | null }) {
  const pos = axisPos(row.mean, max)
  const line = axisPos(thr, max)
  return (
    <span aria-hidden="true" className={cx('relative block h-2.5 rounded-full', row.rotation.is_current ? 'bg-white' : 'bg-sand')}>
      {pos !== null && pos > 0 && (
        <span className={cx('absolute inset-y-0 left-0 rounded-full', row.rotation.is_current ? 'bg-peri-chart' : 'bg-forest-800')} style={{ width: `${Math.max(pos, 2)}%` }} />
      )}
      {line !== null && <span className="absolute -top-1.5 -bottom-1.5 w-0 -translate-x-1/2 border-l-2 border-dashed border-forest-950" style={{ left: `${line}%` }} />}
    </span>
  )
}

function YearCell({ v, lo, hi, thr, className }: { v: number | null; lo: number; hi: number; thr: number | null; className?: string }) {
  const below = isNum(v) && thr !== null && v < thr
  return (
    <span className={cx('relative flex h-11 items-center justify-center rounded-lg font-display text-[0.9375rem] font-semibold text-forest-950 tabular-nums', className)} style={shade(v, lo, hi)}>
      {fmtIndex(v)}
      {below && (
        <>
          <span aria-hidden="true" className="absolute inset-x-2.5 bottom-1.5 h-[3px] rounded-full bg-signal-600" />
          <span className="sr-only"> (below the failure line)</span>
        </>
      )}
    </span>
  )
}

/** Sentences that the table supports, built only from its values. */
function sentences(rows: WorstYearRow[], years: number[], thr: number | null): string[] {
  const cur = rows.find((r) => r.rotation.is_current)
  const alts = rows.filter((r) => !r.rotation.is_current && isNum(r.mean) && isNum(r.deltaVsCurrent))
  if (!cur || !isNum(cur.mean) || alts.length === 0) return []
  const n = alts.length
  const higher = alts.filter((r) => direction(r.deltaVsCurrent) === 'higher')
  const lower = alts.filter((r) => direction(r.deltaVsCurrent) === 'lower')
  const best = [...alts].sort((a, b) => (b.mean as number) - (a.mean as number))[0]
  const out: string[] = []
  const these = `these ${years.length} years`
  if (higher.length > 0) {
    out.push(
      `${higher.length} of the ${n} alternative${n === 1 ? '' : 's'} averaged a higher simulated index than your current rotation (${fmtIndex(cur.mean)}) across ${these}. ` +
        `The highest mean was ${rotationLabel(best.rotation)}, at ${fmtIndex(best.mean)} (${fmtMetricDelta(INDEX, best.deltaVsCurrent)}).`,
    )
  } else if (lower.length === n) {
    out.push(`${n === 1 ? 'The alternative' : `All ${n} alternatives`} averaged a lower simulated index than your current rotation (${fmtIndex(cur.mean)}) across ${these}.`)
  } else {
    out.push(
      `No alternative averaged a higher simulated index than your current rotation (${fmtIndex(cur.mean)}) across ${these}: ` +
        `${n - lower.length} ${n - lower.length === 1 ? 'was' : 'were'} about the same${lower.length ? ` and ${lower.length} lower` : ''}.`,
    )
  }
  if (thr !== null) {
    const under = (r: WorstYearRow) => r.values.filter((v) => isNum(v) && v < thr).length
    const known = (r: WorstYearRow) => r.values.filter(isNum).length
    const share = (r: WorstYearRow) => (under(r) === 0 ? 'none' : under(r) === known(r) ? `all ${known(r)}` : `${under(r)} of ${known(r)}`)
    out.push(
      `Your current rotation’s yearly index was below the failure line of ${thr.toFixed(2)} in ${share(cur)} of these years` +
        (higher.length > 0 ? `; that of ${rotationLabel(best.rotation)} in ${share(best)}.` : '.'),
    )
  }
  return out
}

function NotMeaningful({ env, cur, reported }: { env: AnalysisEnvelope; cur: Rotation | undefined; reported: boolean }) {
  const v = (cur?.hindcast.annual_index ?? []).filter(isNum)
  return (
    <Panel title={TITLE}>
      <Callout tone="plain" title="Not meaningful for this analysis" className="max-w-4xl">
        {!cur || !reported ? (
          <>The engine did not report the lowest-index years of the current rotation for this analysis, so there are no difficult years to compare.</>
        ) : (
          <>
            Your current rotation’s simulated yearly index is flat
            {v.length > 0 &&
              (fmtIndex(Math.min(...v)) === fmtIndex(Math.max(...v)) ? (
                <>
                  : it was <strong className="font-extrabold tabular-nums">{fmtIndex(Math.max(...v))}</strong> in all {v.length} simulated years
                </>
              ) : (
                <>
                  : it stayed between <strong className="font-extrabold tabular-nums">{fmtIndex(Math.min(...v))}</strong> and{' '}
                  <strong className="font-extrabold tabular-nums">{fmtIndex(Math.max(...v))}</strong> in all {v.length} simulated years
                </>
              ))}
            . With no year lower than the others, the “five worst years” the engine lists are only ties, and a comparison inside them would say nothing about
            difficult conditions.
            {isIrrigated(env) && ' This is expected here: with irrigation the model keeps the crop supplied with water, so dry years do not pull the index down.'}
          </>
        )}
      </Callout>
      <p className="mt-3 max-w-3xl text-[0.8125rem] leading-snug text-muted">
        The profiles above, the trade-offs and the ranking checks below do not depend on these years, so they still apply.
      </p>
    </Panel>
  )
}

/** B. Every rotation in the current rotation's five lowest-index years. */
export function ToughYears({ env, cur }: { env: AnalysisEnvelope; cur: Rotation | undefined }) {
  const table = worstYearTable(env.result)
  const thr = failureThreshold(env)
  const [entry, setEntry] = useState<[number, number]>([0, 0])
  const [focused, setFocused] = useState<[number, number] | null>(null)
  const [hovered, setHovered] = useState<[number, number] | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  if (!table || !cur || !indexVaries(cur)) return <NotMeaningful env={env} cur={cur} reported={!!table} />

  const { years } = table
  // The current rotation is the reference, so it is listed first; the alternatives follow in rank order.
  const rows = [...table.rows.filter((r) => r.rotation.is_current), ...table.rows.filter((r) => !r.rotation.is_current)]
  const n = rows.length
  const all = rows.flatMap((r) => r.values).filter(isNum)
  const lo = all.length ? Math.min(...all) : 0
  const hi = all.length ? Math.max(...all) : 1
  const max = Math.max(1, hi, ...rows.map((r) => (isNum(r.mean) ? r.mean : 0)), thr ?? 0)
  const curRow = rows.find((r) => r.rotation.is_current)
  const text = sentences(rows, years, thr)

  const move = (r: number, c: number) => {
    const to: [number, number] = [Math.min(rows.length - 1, Math.max(0, r)), Math.min(years.length - 1, Math.max(0, c))]
    setEntry(to)
    tableRef.current?.querySelector<HTMLElement>(`[data-cell="${to[0]}-${to[1]}"]`)?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLElement>, r: number, c: number) => {
    const to: [number, number] | null =
      e.key === 'ArrowRight' ? [r, c + 1] : e.key === 'ArrowLeft' ? [r, c - 1] : e.key === 'ArrowDown' ? [r + 1, c] : e.key === 'ArrowUp' ? [r - 1, c] : e.key === 'Home' ? [r, 0] : e.key === 'End' ? [r, years.length - 1] : null
    if (!to) return
    e.preventDefault()
    move(to[0], to[1])
  }
  const active = hovered ?? focused
  const detail = (() => {
    if (!active) return null
    const row = rows[active[0]]
    const v = row?.values[active[1]]
    if (!row || !isNum(v)) return null
    const base = curRow?.values[active[1]]
    const year = years[active[1]]
    const line = thr === null ? '' : v < thr ? ` That is below the failure line of ${thr.toFixed(2)}.` : ` That is at or above the failure line of ${thr.toFixed(2)}.`
    if (row.rotation.is_current) return `${year}: your current rotation, ${rotationLabel(row.rotation)}, had a simulated index of ${fmtIndex(v)}.${line}`
    const versus = isNum(base) ? `, ${fmtMetricDelta(INDEX, v - base)} against your current rotation’s ${fmtIndex(base)}` : ''
    return `${year}: ${rotationLabel(row.rotation)} had a simulated index of ${fmtIndex(v)}${versus}.${line}`
  })()

  return (
    <Panel title={TITLE}>
      <p className="-mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
        The {years.length} years with the lowest simulated index for your current rotation were{' '}
        <strong className="font-extrabold text-forest-950 tabular-nums">{yearList(years)}</strong>. The same years are used for every rotation, so each row answers one
        question: how did this rotation do when your current one did worst?
      </p>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] font-semibold text-ink">
        <li className="inline-flex items-center gap-1">
          Values: simulated annual seasonal index, no unit <InfoTip label="Seasonal index">{TIP.index}</InfoTip>
        </li>
        <LegendKey swatch={<span className="h-3.5 w-7 rounded" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--color-forest-800) 6%, white), color-mix(in srgb, var(--color-forest-800) 42%, white))' }} />}>
          Shading: lower to higher index ({fmtIndex(lo)} to {fmtIndex(hi)} in this table)
        </LegendKey>
        {thr !== null && (
          <>
            <LegendKey swatch={<span className="h-[3px] w-5 rounded-full bg-signal-600" />}>
              Underlined: below the failure line of {thr.toFixed(2)}
              {all.some((v) => v < thr) ? '' : ' (no value in this table)'}
            </LegendKey>
            <LegendKey swatch={<span className="h-4 w-0 border-l-2 border-dashed border-forest-950" />}>Failure line on the mean bars</LegendKey>
          </>
        )}
      </ul>

      {/* Table on wide screens */}
      <div className="mt-4 hidden lg:block">
        <table
          ref={tableRef}
          className="w-full border-separate border-spacing-0 text-[0.875rem]"
          aria-label={`Simulated annual seasonal index of ${n} rotations in ${yearList(years)}, the lowest-index years of the current rotation, with the mean of those years and the difference from the current rotation.`}
        >
          <thead>
            <tr className="text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
              <th scope="col" className="pb-2 text-left align-bottom">
                Rotation
              </th>
              {years.map((y) => (
                <th key={y} scope="col" className="w-[4.75rem] px-1 pb-2 text-center align-bottom tabular-nums">
                  {y}
                </th>
              ))}
              <th scope="col" className="w-56 pb-2 pl-5 text-left align-bottom">
                <span className="inline-flex items-center gap-1">
                  Mean of these years <InfoTip label="Mean of these years">{TIP.worst} Reported by the engine for every rotation.</InfoTip>
                </span>
              </th>
              <th scope="col" className="w-48 pb-2 pl-5 text-left align-bottom">
                Against your current rotation
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const on = active?.[0] === r
              const tint = row.rotation.is_current ? 'bg-peri-50' : cx('border-t border-border', on && 'bg-sand/50')
              return (
                <tr key={row.rotation.id}>
                  <th scope="row" className={cx('py-2 pr-3 pl-2 text-left transition-colors', row.rotation.is_current && 'rounded-l-2xl', tint)}>
                    <span className="flex items-center gap-2.5">
                      <RankBlock rank={row.rotation.scores?.rank} of={n} current={row.rotation.is_current} className="h-8 min-w-8 rounded-lg text-[0.8125rem]" />
                      <span className="min-w-0">
                        <span className="block leading-snug font-bold text-forest-950">{rotationLabel(row.rotation)}</span>
                        {row.rotation.is_current && <span className="block text-[0.75rem] font-extrabold text-peri-ink">Your current rotation</span>}
                      </span>
                    </span>
                  </th>
                  {row.values.map((v, c) => (
                    <td
                      key={years[c]}
                      data-cell={`${r}-${c}`}
                      tabIndex={entry[0] === r && entry[1] === c ? 0 : -1}
                      onFocus={() => {
                        setFocused([r, c])
                        setEntry([r, c])
                      }}
                      onBlur={() => setFocused(null)}
                      onMouseEnter={() => setHovered([r, c])}
                      onMouseLeave={() => setHovered(null)}
                      onKeyDown={(e) => onKey(e, r, c)}
                      className={cx('group p-1 outline-none transition-colors', tint)}
                    >
                      <YearCell
                        v={v}
                        lo={lo}
                        hi={hi}
                        thr={thr}
                        className={cx(
                          'group-focus-visible:outline-2 group-focus-visible:outline-offset-1 group-focus-visible:outline-forest-950',
                          active?.[0] === r && active?.[1] === c && 'ring-2 ring-forest-950',
                        )}
                      />
                    </td>
                  ))}
                  <td className={cx('py-2 pl-5 transition-colors', tint)}>
                    <span className="flex items-center gap-3">
                      <span className="w-11 shrink-0 font-display text-[1.0625rem] font-semibold text-forest-950 tabular-nums">{fmtIndex(row.mean)}</span>
                      <span className="min-w-0 flex-1">
                        <MeanBar row={row} max={max} thr={thr} />
                      </span>
                    </span>
                  </td>
                  <td className={cx('py-2 pr-2 pl-5 transition-colors', row.rotation.is_current && 'rounded-r-2xl', tint)}>
                    <Delta row={row} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-3 min-h-[2.75rem] rounded-xl bg-sand/60 px-3.5 py-2.5 text-[0.8125rem] leading-snug font-semibold text-ink" aria-hidden={detail ? undefined : true}>
          {detail ?? 'Point at a year’s value to read it in full. With a keyboard, tab into the table and use the arrow keys.'}
        </p>
      </div>

      {/* Stacked cards on small screens */}
      <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:hidden">
        {rows.map((row) => (
          <li key={row.rotation.id} className={cx('rounded-2xl p-4 ring-1', row.rotation.is_current ? 'bg-peri-50/70 ring-peri' : 'bg-white ring-border')}>
            <div className="flex items-start gap-2.5">
              <RankBlock rank={row.rotation.scores?.rank} of={n} current={row.rotation.is_current} className="h-8 min-w-8 rounded-lg text-[0.8125rem]" />
              <div className="min-w-0">
                <p className="leading-snug font-bold text-forest-950">{rotationLabel(row.rotation)}</p>
                {row.rotation.is_current && (
                  <Chip tone="peri" className="mt-1">
                    Current
                  </Chip>
                )}
              </div>
            </div>
            <dl className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}>
              {row.values.map((v, c) => (
                <div key={years[c]} className="min-w-0">
                  <dt className="mb-1 text-center text-[0.6875rem] font-extrabold text-ink tabular-nums">{years[c]}</dt>
                  <dd>
                    <YearCell v={v} lo={lo} hi={hi} thr={thr} className="h-10 text-[0.875rem]" />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] font-bold text-ink">Mean of these years</span>
              <span className="font-display text-[1.125rem] font-semibold text-forest-950 tabular-nums">{fmtIndex(row.mean)}</span>
            </div>
            <div className="mt-1.5">
              <MeanBar row={row} max={max} thr={thr} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-[0.8125rem] font-bold text-ink">Against your current</span>
              <Delta row={row} />
            </div>
          </li>
        ))}
      </ul>

      {text.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-[0.9375rem] leading-relaxed text-ink">
          {text.map((s) => (
            <p key={s} className="max-w-4xl">
              {s}
            </p>
          ))}
        </div>
      )}
      <p className="mt-3 max-w-4xl text-[0.8125rem] leading-snug text-muted">
        This looks back at simulated past years. A higher index then does not mean a rotation will hold up in a future difficult year, and the index is not crop
        yield. The failure line applies to single crop seasons; a yearly value averages the seasons that ended in that year.
      </p>
    </Panel>
  )
}
