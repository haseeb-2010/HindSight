import { useState, type KeyboardEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { rankedRotations, rotationLabel } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { Segmented } from '../components/controls'
import { joinList, type RankRow, type RunSummary } from '../lib/insights'

/** Chart series colours from the theme: the current rotation (peri-chart) and every alternative (forest-800). */
const SERIES = { current: '#5b6bb5', other: '#33594a' }

const TICK_W = 30
const HEAD_H = 60
const ROW_H = 44
const DOT_R = 12

const isRank = (v: number | null): v is number => v !== null

const NOT_SHOWN = 'not among the alternatives shown'

/**
 * One generated sentence block about the chart, built only from the ranks in `rows`.
 * Nothing is said about a rotation that the data does not show.
 */
function rankStory(runs: RunSummary[], rows: RankRow[]): string {
  const n = runs.length
  const parts: string[] = []
  const spans = rows
    .map((row) => {
      const v = row.ranks.filter(isRank)
      return { row, count: v.length, min: Math.min(...v), max: Math.max(...v) }
    })
    .filter((s) => s.count >= 2)
  const movers = spans.filter((s) => s.min !== s.max)
  const widest = movers.length ? movers.reduce((a, b) => (b.max - b.min > a.max - a.min ? b : a)) : null
  if (!widest) {
    parts.push(`No rotation changes rank across these ${n} runs.`)
  } else {
    parts.push(`${movers.length} of ${rows.length} rotations change${movers.length === 1 ? 's' : ''} rank across these ${n} runs.`)
    parts.push(`The widest move is ${widest.row.isCurrent ? 'your current rotation' : widest.row.name}, between #${widest.min} and #${widest.max}.`)
  }
  const cur = spans.find((s) => s.row.isCurrent)
  if (cur && cur.count === n && cur !== widest) {
    parts.push(cur.min === cur.max ? `Your current rotation is ranked #${cur.min} in every run.` : `Your current rotation ranges from #${cur.min} to #${cur.max}.`)
  }
  const partial = rows.filter((r) => r.ranks.some((x) => x === null)).length
  if (partial > 0) {
    parts.push(
      `${partial} rotation${partial === 1 ? ' is' : 's are'} not among the alternatives shown in every run, so ${partial === 1 ? 'its line stops' : 'their lines stop'} where ${
        partial === 1 ? 'it is' : 'they are'
      } missing.`,
    )
  }
  return parts.join(' ')
}

function bumpPath(row: RankRow, x: (i: number) => number, y: (rank: number) => number): string {
  let d = ''
  for (let i = 0; i + 1 < row.ranks.length; i++) {
    const a = row.ranks[i]
    const b = row.ranks[i + 1]
    if (a === null || b === null) continue
    const x0 = x(i)
    const x1 = x(i + 1)
    const mid = (x0 + x1) / 2
    d += `M${x0.toFixed(1)},${y(a).toFixed(1)}C${mid.toFixed(1)},${y(a).toFixed(1)} ${mid.toFixed(1)},${y(b).toFixed(1)} ${x1.toFixed(1)},${y(b).toFixed(1)}`
  }
  return d
}

function CurrentTag() {
  return <span className="shrink-0 rounded-md bg-peri px-1.5 py-0.5 text-[0.625rem] leading-none font-extrabold tracking-wide text-forest-950 uppercase">Current</span>
}

function RankPill({ rank, current, of }: { rank: number | null; current?: boolean; of?: number }) {
  if (rank === null) return <span className="text-[0.75rem] font-bold text-muted">Not shown</span>
  return (
    <span className={cx('inline-flex items-baseline gap-1 font-display text-[0.9375rem] font-semibold tabular-nums', current ? 'text-peri-ink' : 'text-forest-950')}>
      #{rank}
      {of !== undefined && <span className="font-sans text-[0.75rem] font-bold text-muted">of {of}</span>}
    </span>
  )
}

/** The ranks as a real table: read by screen readers under the chart, and shown on request. */
function RankTable({ runs, rows, baseIndex, visible }: { runs: RunSummary[]; rows: RankRow[]; baseIndex: number; visible: boolean }) {
  const table = (
    <table className={cx(visible && 'w-full min-w-[32rem] border-separate border-spacing-0 text-[0.875rem]')}>
      <caption className="sr-only">Rank of each rotation in each run. Rank 1 is the highest-ranked rotation of that run.</caption>
      <thead>
        <tr>
          <th scope="col" className={cx(visible && 'pb-2.5 pl-2.5 text-left align-bottom text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase')}>
            Rotation
          </th>
          {runs.map((run, i) => (
            <th key={run.id} scope="col" className={cx(visible && 'px-3 pb-2.5 text-left align-bottom leading-snug font-bold text-forest-950')}>
              {run.label}
              {i === baseIndex && runs.length > 1 && <span className={cx(visible ? 'block text-[0.6875rem] font-extrabold tracking-[0.06em] text-muted uppercase' : '')}> Baseline</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className={cx(visible && 'border-t border-border py-2.5 pr-3 pl-2.5 text-left font-bold text-ink', visible && row.isCurrent && 'bg-peri-50')}>
              <span className={cx(visible && 'inline-flex flex-wrap items-center gap-1.5')}>
                {row.name}
                {row.isCurrent && (visible ? <CurrentTag /> : ' (your current rotation)')}
              </span>
            </th>
            {row.ranks.map((rank, i) => (
              <td key={runs[i].id} className={cx(visible && 'border-t border-border px-3 py-2.5', visible && row.isCurrent && 'bg-peri-50')}>
                {visible ? <RankPill rank={rank} current={row.isCurrent} of={rank === null ? undefined : runs[i].count} /> : rank === null ? NOT_SHOWN : `rank ${rank} of ${runs[i].count}`}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
  // A table ignores sr-only's 1px width, so the wrapper carries it.
  return visible ? <div className="-mx-1 overflow-x-auto px-1">{table}</div> : <div className="sr-only">{table}</div>
}

/** Small-screen form of the chart: every rotation with its rank in each run, printed in full. */
function RankList({ runs, rows, baseIndex }: { runs: RunSummary[]; rows: RankRow[]; baseIndex: number }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const base = row.ranks[baseIndex]
        return (
          <li key={row.key} className={cx('rounded-2xl p-3.5 ring-1', row.isCurrent ? 'bg-peri-50/70 ring-peri' : 'bg-white ring-border')}>
            <p className="flex flex-wrap items-center gap-1.5 text-[0.875rem] leading-snug font-extrabold text-forest-950">
              {row.name}
              {row.isCurrent && <CurrentTag />}
            </p>
            <dl className="mt-2 space-y-1">
              {runs.map((run, i) => {
                const rank = row.ranks[i]
                const moved = i !== baseIndex && rank !== null && base !== null ? base - rank : null
                return (
                  <div key={run.id} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <dt className="min-w-0 truncate font-semibold text-ink">{run.label}</dt>
                    <dd className="flex shrink-0 items-baseline gap-2">
                      {moved !== null && moved !== 0 && (
                        <span className="text-[0.75rem] font-bold text-muted">
                          {moved > 0 ? '▲' : '▼'} {Math.abs(moved)} {Math.abs(moved) === 1 ? 'place' : 'places'}
                        </span>
                      )}
                      <RankPill rank={rank} current={row.isCurrent} />
                    </dd>
                  </div>
                )
              })}
            </dl>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Bump chart: runs along the x axis, rank down the y axis (#1 at the top), one line per rotation.
 * A rotation that is not among the alternatives shown in a run has no point there and its line breaks.
 * Driven only by the output of summariseRuns().
 */
export function RankBump({ runs, rows, baseIndex }: { runs: RunSummary[]; rows: RankRow[]; baseIndex: number }) {
  const [wrap, width] = useElementWidth<HTMLDivElement>(960)
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const n = runs.length
  const maxRank = Math.max(1, ...runs.map((r) => r.count), ...rows.flatMap((r) => r.ranks.filter(isRank)))
  const labelW = Math.round(Math.max(120, Math.min(290, width * 0.22)))
  const left = TICK_W + labelW + 12 + DOT_R
  const right = labelW + 12 + DOT_R
  const plotW = Math.max(width - left - right, 40)
  const colW = n > 1 ? plotW / (n - 1) : plotW
  const compact = width < 560 || colW < 84
  const x = (i: number) => left + (n > 1 ? i * colW : plotW / 2)
  const y = (rank: number) => HEAD_H + ROW_H / 2 + (rank - 1) * ROW_H
  const height = HEAD_H + maxRank * ROW_H + 6
  const headW = Math.min(colW - 8, 164)

  const activeKey = hover ?? pinned
  const active = rows.find((r) => r.key === activeKey) ?? null
  const hasGaps = rows.some((r) => r.ranks.some((v) => v === null))
  const story = rankStory(runs, rows)
  // drawn back to front: alternatives, the current rotation, then whichever is highlighted
  const order = [...rows].sort((a, b) => Number(a.key === activeKey) - Number(b.key === activeKey) || Number(a.isCurrent) - Number(b.isCurrent))

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setPinned(null)
      setHover(null)
      return
    }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || rows.length === 0) return
    e.preventDefault()
    const at = rows.findIndex((r) => r.key === pinned)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : at < 0 ? 0 : (at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length
    setPinned(rows[next].key)
    // the keyboard takes over from a pointer that is resting on the chart
    setHover(null)
  }

  // A stretch of points that reaches neither edge has no label in the margins, so it is named beside its first point.
  const floats = rows.flatMap((row) => {
    const out: { row: RankRow; at: number; rank: number }[] = []
    row.ranks.forEach((rank, i) => {
      if (rank === null || i === 0 || row.ranks[i - 1] !== null) return
      let end = i
      while (end + 1 < n && row.ranks[end + 1] !== null) end++
      if (end < n - 1) out.push({ row, at: i, rank })
    })
    return out
  })

  const gaps = rows
    .filter((r) => r.ranks.some((v) => v === null))
    .map((r) => `${r.isCurrent ? 'Your current rotation' : r.name} in ${joinList(runs.filter((_, i) => r.ranks[i] === null).map((run) => `“${run.label}”`))}`)

  const hoverProps = (key: string) => ({
    onPointerEnter: () => setHover(key),
    onClick: () => setPinned((p) => (p === key ? null : key)),
  })

  return (
    <figure className="m-0 min-w-0">
      <div ref={wrap}>
        {compact ? (
          <RankList runs={runs} rows={rows} baseIndex={baseIndex} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
              <ul className={cx('flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-bold text-ink', view === 'table' && 'invisible')} aria-label="Legend" aria-hidden={view === 'table' || undefined}>
                <li className="inline-flex items-center gap-2">
                  <svg width="30" height="12" aria-hidden="true">
                    <line x1="1" x2="29" y1="6" y2="6" stroke={SERIES.current} strokeWidth="3.5" strokeLinecap="round" />
                    <circle cx="15" cy="6" r="5" fill={SERIES.current} stroke="#fff" strokeWidth="1.5" />
                  </svg>
                  Your current rotation
                </li>
                <li className="inline-flex items-center gap-2">
                  <svg width="30" height="12" aria-hidden="true">
                    <line x1="1" x2="29" y1="6" y2="6" stroke={SERIES.other} strokeWidth="2" strokeLinecap="round" />
                    <circle cx="15" cy="6" r="5" fill={SERIES.other} stroke="#fff" strokeWidth="1.5" />
                  </svg>
                  Alternative rotations
                </li>
                {hasGaps && <li className="text-muted">A line stops where a rotation was {NOT_SHOWN} in that run</li>}
              </ul>
              <Segmented
                label="Show the ranks as a chart or a table"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: 'chart', label: 'Chart' },
                  { value: 'table', label: 'Table' },
                ]}
              />
            </div>

            {view === 'table' ? (
              <div className="mt-4">
                <RankTable runs={runs} rows={rows} baseIndex={baseIndex} visible />
              </div>
            ) : (
              <>
                <p aria-live="polite" className="mt-3 flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-sand/70 px-3.5 py-2 text-[0.8125rem] leading-snug text-ink">
                  {active ? (
                    <>
                      <span className="font-display text-[0.9375rem] font-semibold text-forest-950">
                        {active.name}
                        {active.isCurrent && <span className="font-sans text-[0.8125rem] font-bold text-peri-ink"> (your current rotation)</span>}
                      </span>
                      {runs.map((run, i) => (
                        <span key={run.id} className="whitespace-nowrap">
                          <span className="font-semibold">{run.label}:</span>{' '}
                          <span className="font-extrabold text-forest-950 tabular-nums">{active.ranks[i] === null ? 'not shown' : `#${active.ranks[i]} of ${run.count}`}</span>
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="font-semibold text-muted">Hover or tap a line to follow one rotation across the runs. With the keyboard, focus the chart and use the ↑ ↓ keys.</span>
                  )}
                </p>

                <div
                  tabIndex={0}
                  role="group"
                  aria-label={`Rank of ${rows.length} rotations in ${n} runs; rank 1 is at the top. ${story} Use the up and down arrow keys to follow one rotation; the table after the chart lists every rank.`}
                  onKeyDown={onKey}
                  onBlur={() => setPinned(null)}
                  onPointerLeave={() => setHover(null)}
                  className="relative mt-2 rounded-xl outline-offset-4 select-none"
                  style={{ height }}
                >
                  <p className="absolute top-0 left-0 text-[0.6875rem] leading-tight font-extrabold tracking-[0.04em] text-muted uppercase" style={{ width: TICK_W + labelW }} aria-hidden="true">
                    Rank
                    <span className="block font-bold tracking-normal normal-case">#1 is the highest-ranked in that run</span>
                  </p>

                  {runs.map((run, i) => (
                    <p
                      key={run.id}
                      aria-hidden="true"
                      title={run.sublabel ? `${run.label}: ${run.sublabel}` : run.label}
                      className="absolute top-0 flex flex-col items-center justify-end text-center"
                      style={{ left: x(i) - headW / 2, width: headW, height: HEAD_H - DOT_R - 6 }}
                    >
                      {i === baseIndex && <span className="text-[0.625rem] leading-tight font-extrabold tracking-[0.06em] text-muted uppercase">Baseline</span>}
                      <span className="line-clamp-2 text-[0.75rem] leading-[1.2] font-extrabold text-forest-950">{run.label}</span>
                    </p>
                  ))}

                  <svg width={width} height={height} className="absolute inset-0 block" aria-hidden="true">
                    {runs.map((run, i) => (
                      <line key={run.id} x1={x(i)} x2={x(i)} y1={y(1) - DOT_R - 4} y2={y(maxRank) + DOT_R + 4} stroke="var(--color-sand-300)" />
                    ))}
                    {Array.from({ length: maxRank }, (_, k) => (
                      <text key={k} x={TICK_W - 8} y={y(k + 1) + 4} textAnchor="end" className="fill-muted text-[11px] font-bold tabular-nums">
                        #{k + 1}
                      </text>
                    ))}
                    {order.map((row) => {
                      const on = row.key === activeKey
                      const dim = activeKey !== null && !on
                      const colour = row.isCurrent ? SERIES.current : SERIES.other
                      const d = bumpPath(row, x, y)
                      return (
                        <g key={row.key} className="cursor-pointer" {...hoverProps(row.key)}>
                          {d && (
                            <>
                              <path
                                d={d}
                                pathLength={1}
                                className="draw-path transition-[opacity,stroke-width] duration-200"
                                fill="none"
                                stroke={colour}
                                strokeWidth={on ? 4 : row.isCurrent ? 3.5 : 2}
                                strokeLinecap="round"
                                opacity={dim ? 0.14 : on || row.isCurrent ? 1 : 0.5}
                              />
                              <path d={d} fill="none" stroke="transparent" strokeWidth={20} />
                            </>
                          )}
                          {row.ranks.map((rank, i) =>
                            rank === null ? null : (
                              <g key={runs[i].id} className="transition-opacity duration-200" opacity={dim ? 0.28 : 1}>
                                <circle cx={x(i)} cy={y(rank)} r={on ? DOT_R + 1.5 : DOT_R} fill={colour} stroke="#fff" strokeWidth={2} />
                                <text x={x(i)} y={y(rank) + 4} textAnchor="middle" className="fill-white text-[11px] font-extrabold tabular-nums">
                                  {rank}
                                </text>
                              </g>
                            ),
                          )}
                        </g>
                      )
                    })}
                    {floats.map((f) => (
                      <text
                        key={`${f.row.key}-${f.at}`}
                        x={x(f.at)}
                        y={y(f.rank) - DOT_R - 6}
                        textAnchor="middle"
                        className="cursor-pointer fill-ink text-[11px] font-bold"
                        stroke="#fff"
                        strokeWidth={4}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                        opacity={activeKey !== null && f.row.key !== activeKey ? 0.4 : 1}
                        {...hoverProps(f.row.key)}
                      >
                        {f.row.name.length > 32 ? `${f.row.name.slice(0, 31)}…` : f.row.name}
                      </text>
                    ))}
                  </svg>

                  {rows.flatMap((row) => {
                    const on = row.key === activeKey
                    const dim = activeKey !== null && !on
                    const ends: { side: 'l' | 'r'; rank: number }[] = []
                    if (row.ranks[0] !== null) ends.push({ side: 'l', rank: row.ranks[0] })
                    if (row.ranks[n - 1] !== null) ends.push({ side: 'r', rank: row.ranks[n - 1] as number })
                    return ends.map(({ side, rank }) => (
                      <p
                        key={`${row.key}-${side}`}
                        aria-hidden="true"
                        title={row.name}
                        {...hoverProps(row.key)}
                        className={cx(
                          'absolute flex cursor-pointer items-center gap-1.5 text-[0.78rem] leading-[1.2] transition-opacity duration-200',
                          side === 'l' ? 'justify-end text-right' : 'justify-start text-left',
                          on || row.isCurrent ? 'font-extrabold text-forest-950' : 'font-bold text-ink',
                          dim && 'opacity-40',
                        )}
                        style={{ top: y(rank) - ROW_H / 2 + 2, height: ROW_H - 4, left: side === 'l' ? TICK_W : x(n - 1) + DOT_R + 10, width: labelW }}
                      >
                        {row.isCurrent && <CurrentTag />}
                        <span className={cx('line-clamp-2 min-w-0', on && 'underline decoration-2 underline-offset-[3px]')}>{row.name}</span>
                      </p>
                    ))
                  })}
                </div>
                <RankTable runs={runs} rows={rows} baseIndex={baseIndex} visible={false} />
              </>
            )}
          </>
        )}
      </div>

      <figcaption className="mt-4 border-t border-border pt-3.5 text-[0.875rem] leading-relaxed text-ink">
        <span className="font-bold text-forest-950">Reading it: </span>
        {story}
        {gaps.length > 0 && <span className="mt-1 block text-[0.8125rem] text-muted">Not among the alternatives shown: {gaps.join('; ')}.</span>}
        <span className="mt-1 block text-[0.8125rem] text-muted">
          A rank is a position among the rotations of the same run. It is relative to those rotations and their assumptions, not a probability of success.
        </span>
      </figcaption>
    </figure>
  )
}

/** The ranking of one run on its own, with no lines: used for a single run and for analyses that cannot be lined up. */
export function RankingList({ run, heading }: { run: RunSummary; heading?: string }) {
  const ranked = rankedRotations(run.envelope.result)
  return (
    <div className="min-w-0">
      {heading && <h4 className="font-sans text-[0.8125rem] font-extrabold text-forest-950">{heading}</h4>}
      <ol className={cx('space-y-1.5', heading && 'mt-2')}>
        {ranked.map((r) => (
          <li key={r.id} className={cx('flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[0.875rem]', r.is_current ? 'bg-peri-50 ring-1 ring-peri' : 'bg-sand/60')}>
            <span
              className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1 font-display text-[0.8125rem] font-semibold text-white tabular-nums"
              style={{ background: r.is_current ? SERIES.current : SERIES.other }}
            >
              <span className="sr-only">Rank </span>
              {r.scores?.rank ?? '—'}
            </span>
            <span className="min-w-0 leading-snug font-bold text-forest-950">{rotationLabel(r)}</span>
            {r.is_current && <CurrentTag />}
          </li>
        ))}
      </ol>
    </div>
  )
}
