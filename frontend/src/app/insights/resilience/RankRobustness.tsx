import type { ReactNode } from 'react'
import { InfoTip } from '../../../components/ui/InfoTip'
import { rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import type { AnalysisEnvelope, Rotation } from '../../../lib/types'
import { Callout } from '../../components/controls'
import { joinList, rankSpread } from '../../lib/insights'
import { Chip, Panel, TIP, rangeText } from '../../results/shared'
import { LegendKey, useRowFocus } from './shared'

type Range = [number, number] | null | undefined

interface RangeRow {
  rotation: Rotation
  range: Range
}

/** Horizontal position of rank `p` on an axis from #1 to #n, as a percentage of the track. */
const rankX = (p: number, n: number) => (n > 1 ? ((Math.min(n, Math.max(1, p)) - 1) / (n - 1)) * 100 : 50)

/** What the returned ranges support saying about one test. */
function rangeSentence(rows: RangeRow[]): string | null {
  const known = rows.filter((r): r is RangeRow & { range: [number, number] } => !!r.range)
  if (known.length === 0) return null
  const width = (r: { range: [number, number] }) => Math.abs(r.range[1] - r.range[0])
  const kept = known.filter((r) => width(r) === 0).length
  const widest = Math.max(...known.map(width))
  const out = [
    kept === known.length
      ? `All ${known.length} rotations kept the same rank in every run of this test.`
      : kept === 0
        ? `None of the ${known.length} rotations kept the same rank in every run of this test.`
        : `${kept} of the ${known.length} rotations kept the same rank in every run of this test.`,
  ]
  if (widest > 0) {
    const moved = known.filter((r) => width(r) === widest)
    out.push(
      moved.length <= 2
        ? `The widest range, ${widest} place${widest === 1 ? '' : 's'}, was for ${joinList(moved.map((r) => `${rotationLabel(r.rotation)} (${rangeText(r.range)})`))}.`
        : `The widest range was ${widest} place${widest === 1 ? '' : 's'}, shared by ${moved.length} rotations.`,
    )
  }
  const top = known.find((r) => r.rotation.scores?.rank === 1)
  if (top) {
    out.push(
      width(top) === 0
        ? `The highest-ranked rotation, ${rotationLabel(top.rotation)}, stayed #1 throughout.`
        : `The highest-ranked rotation, ${rotationLabel(top.rotation)}, ranged from #${top.range[0]} to #${top.range[1]}.`,
    )
  }
  return out.join(' ')
}

function RankRangeChart({ rows, n, test }: { rows: RangeRow[]; n: number; test: string }) {
  const { active, rowProps } = useRowFocus(rows.length)
  const ranks = Array.from({ length: n }, (_, i) => i + 1)
  const row = active !== null ? rows[active] : null
  const detail = (() => {
    if (!row) return null
    const name = rotationLabel(row.rotation)
    const rank = row.rotation.scores?.rank
    const spread = rankSpread(row.range)
    if (!row.range || !spread) return `${name}: rank #${rank} in this analysis. The engine did not return a range for this test.`
    return row.range[0] === row.range[1]
      ? `${name}: rank #${rank} in this analysis, and the same in every run of this test. ${spread.explain}`
      : `${name}: rank #${rank} in this analysis; between #${row.range[0]} and #${row.range[1]} across this test. ${spread.explain}`
  })()
  const sentence = rangeSentence(rows)
  const grid = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)_8rem]'

  return (
    <figure className="m-0">
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] font-semibold text-ink">
        <LegendKey swatch={<span className="h-3 w-3 rounded-full bg-forest-950" />}>Rank in this analysis</LegendKey>
        <LegendKey swatch={<span className="h-3.5 w-7 rounded-full bg-sage/60" />}>Range of ranks across the test</LegendKey>
      </ul>

      {/* Rank axis */}
      <div className={cx(grid, 'mt-3 px-2')} aria-hidden="true">
        <span className="hidden text-[0.6875rem] font-extrabold tracking-[0.04em] text-ink uppercase sm:block">Rotation</span>
        <span className="relative col-span-2 h-4 sm:col-span-1">
          <span className="absolute inset-x-3 inset-y-0">
            {ranks.map((p) => (
              <span key={p} className="absolute top-0 -translate-x-1/2 text-[0.6875rem] font-extrabold text-ink tabular-nums" style={{ left: `${rankX(p, n)}%` }}>
                #{p}
              </span>
            ))}
          </span>
        </span>
        <span className="hidden text-right text-[0.6875rem] font-extrabold tracking-[0.04em] text-ink uppercase sm:block">Range</span>
      </div>

      <ul aria-label={`${test}: rank in this analysis and range of ranks for each of the ${rows.length} rotations. Use the arrow keys to move between rotations.`} className="mt-1">
        {rows.map((r, i) => {
          const rank = r.rotation.scores?.rank
          const spread = rankSpread(r.range)
          const on = active === i
          return (
            <li
              key={r.rotation.id}
              {...rowProps(i)}
              className={cx(
                grid,
                'px-2 py-2 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-950',
                r.rotation.is_current ? 'rounded-xl bg-peri-50' : cx('border-t border-border first:border-t-0', on && 'bg-sand/50'),
              )}
            >
              <span className="order-1 min-w-0 text-[0.8125rem] leading-snug font-bold text-forest-950">
                {rotationLabel(r.rotation)}
                {r.rotation.is_current && (
                  <Chip tone="peri" className="ml-1.5 align-middle">
                    Current
                  </Chip>
                )}
              </span>
              <span className="order-3 col-span-2 sm:order-2 sm:col-span-1" aria-hidden="true">
                <span className="relative block h-7">
                  <span className="absolute inset-x-3 inset-y-0">
                    {ranks.map((p) => (
                      <span key={p} className="absolute inset-y-1 w-px -translate-x-1/2 bg-sand-300" style={{ left: `${rankX(p, n)}%` }} />
                    ))}
                    {r.range && r.range[0] !== r.range[1] && (
                      <span
                        className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-sage/60"
                        style={{
                          left: `calc(${rankX(Math.min(...r.range), n)}% - 0.4375rem)`,
                          width: `calc(${rankX(Math.max(...r.range), n) - rankX(Math.min(...r.range), n)}% + 0.875rem)`,
                        }}
                      />
                    )}
                    {rank !== undefined && (
                      <span
                        className={cx('absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white', r.rotation.is_current ? 'bg-peri-chart' : 'bg-forest-950')}
                        style={{ left: `${rankX(rank, n)}%` }}
                      />
                    )}
                  </span>
                </span>
              </span>
              <span className="order-2 text-right sm:order-3">
                <span className="block font-display text-[0.9375rem] leading-tight font-semibold text-forest-950 tabular-nums">
                  <span className="sr-only">Rank #{rank}. Range </span>
                  {r.range ? rangeText(r.range) : 'Not available'}
                </span>
                <span className="block text-[0.75rem] leading-tight font-semibold text-ink">{spread ? spread.label : 'No range returned'}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-1 px-2 text-[0.75rem] font-bold text-muted" aria-hidden="true">
        Axis: rank among the {n} rotations in this analysis, #1 being the highest weighted score.
      </p>
      <p className="mt-3 min-h-[2.75rem] rounded-xl bg-sand/60 px-3.5 py-2.5 text-[0.8125rem] leading-snug font-semibold text-ink" aria-hidden={detail ? undefined : true}>
        {detail ?? 'Point at a rotation for a reading of its range. With a keyboard, tab to the chart and use the arrow keys.'}
      </p>
      {sentence && <figcaption className="mt-3 text-[0.9375rem] leading-relaxed text-ink">{sentence}</figcaption>}
    </figure>
  )
}

/** A panel whose title is an h4, because these three sit under the section's h3. */
function SubPanel({ title, tip, children }: { title: string; tip?: string; children: ReactNode }) {
  return (
    <Panel>
      <h4 className="mb-3 flex items-center gap-1.5 text-[1.1875rem] leading-tight">
        {title}
        {tip && <InfoTip label={title}>{tip}</InfoTip>}
      </h4>
      {children}
    </Panel>
  )
}

function Test({ title, tip, intro, children }: { title: string; tip: string; intro: ReactNode; children: ReactNode }) {
  return (
    <SubPanel title={title} tip={tip}>
      <p className="mb-4 text-[0.875rem] leading-relaxed text-ink">{intro}</p>
      {children}
    </SubPanel>
  )
}

function PeriodRanks({ env, all }: { env: AnalysisEnvelope; all: Rotation[] }) {
  const has = all.some((r) => r.scores?.rank_early !== undefined || r.scores?.rank_late !== undefined)
  const w = env.result.meta.windows
  const rec = env.result.meta.record
  const early = w?.early ? `${w.early[0]}–${w.early[1]}` : 'the earlier period'
  const late = w?.late ? `${w.late[0]}–${w.late[1]}` : 'the later period'
  const both = all.filter((r) => r.scores?.rank_early !== undefined && r.scores?.rank_late !== undefined)
  const same = both.filter((r) => r.scores.rank_early === r.scores.rank && r.scores.rank_late === r.scores.rank).length
  const columns: { label: string; get: (r: Rotation) => number | undefined }[] = [
    { label: 'Whole record', get: (r) => r.scores?.rank },
    { label: w?.early ? early : 'Earlier period', get: (r) => r.scores?.rank_early },
    { label: w?.late ? late : 'Later period', get: (r) => r.scores?.rank_late },
  ]
  const cols = 'sm:grid-cols-[minmax(0,1fr)_16.5rem]'
  return (
    <SubPanel title="Rank when only one period’s weak years count">
      {!has ? (
        <Callout tone="plain" title="Not available for this analysis">
          The engine did not return period-by-period ranks for this run.
        </Callout>
      ) : (
        <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="text-[0.875rem] leading-relaxed text-ink">
            <p>
              The stability part of the score normally uses the lower-decile (P10) index of the whole record, {rec.start_year}–{rec.end_year}. Here the engine works the rank out
              again twice: once with the P10 of {early} only, and once with the P10 of {late} only. Every other indicator stays as it is.
            </p>
            {both.length > 0 && (
              <p className="mt-2.5 font-semibold text-forest-950">
                {same === both.length
                  ? `All ${both.length} rotations hold the same rank whichever period’s weak years are used.`
                  : same === 0
                    ? `None of the ${both.length} rotations holds the same rank in both periods as over the whole record.`
                    : `${same} of the ${both.length} rotations hold the same rank whichever period’s weak years are used; the other ${both.length - same} change place.`}
              </p>
            )}
            <p className="mt-2.5 text-[0.8125rem] leading-snug text-muted">A rank that differs between the two periods depends on which years are counted. It says nothing about years to come.</p>
          </div>
          <div className="min-w-0">
            <div aria-hidden="true" className={cx('hidden items-end gap-x-2 px-2 pb-2 text-[0.6875rem] font-extrabold tracking-[0.04em] text-ink uppercase sm:grid', cols)}>
              <span>Rotation</span>
              <span className="grid grid-cols-3 gap-2 text-right tabular-nums">
                {columns.map((c) => (
                  <span key={c.label}>{c.label}</span>
                ))}
              </span>
            </div>
            <ul>
              {all.map((r) => (
                <li key={r.id} className={cx('grid items-center gap-x-2 gap-y-2 px-2 py-2.5', cols, r.is_current ? 'rounded-xl bg-peri-50' : 'border-t border-border')}>
                  <p className="min-w-0 text-[0.875rem] leading-snug font-bold text-forest-950">
                    {rotationLabel(r)}
                    {r.is_current && <span className="block text-[0.75rem] font-extrabold text-peri-ink">Your current rotation</span>}
                  </p>
                  <dl className="grid grid-cols-3 gap-2">
                    {columns.map((c, i) => {
                      const v = c.get(r)
                      const differs = i > 0 && v !== undefined && v !== r.scores?.rank
                      return (
                        <div key={c.label} className={cx('rounded-lg px-2 py-1.5 sm:bg-transparent sm:p-0 sm:text-right', r.is_current ? 'bg-white/70' : 'bg-sand/50')}>
                          <dt className="text-[0.6875rem] leading-tight font-bold text-ink tabular-nums sm:sr-only">{c.label}</dt>
                          <dd className="mt-0.5 sm:mt-0">
                            {v === undefined ? (
                              <span className="text-[0.8125rem] font-semibold text-muted">Not available</span>
                            ) : (
                              <span className={cx('inline-block rounded-lg py-0.5 font-display text-[1rem] tabular-nums', differs ? 'bg-lime-100 px-2 font-semibold text-forest-950 ring-1 ring-forest-950/25' : 'font-medium text-ink sm:px-2')}>
                                #{v}
                                {differs && <span className="sr-only"> (differs from the whole-record rank)</span>}
                              </span>
                            )}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </li>
              ))}
            </ul>
            <p className="mt-2 px-2 text-[0.75rem] font-semibold text-muted">A highlighted rank differs from the whole-record rank.</p>
          </div>
        </div>
      )}
    </SubPanel>
  )
}

/** E. How far each rank moves in the engine's own sensitivity checks. */
export function RankRobustness({ env, all }: { env: AnalysisEnvelope; all: Rotation[] }) {
  const n = all.length
  const legumeOff = env.request?.options?.apply_legume_effect === false
  const legume: RangeRow[] = all.map((rotation) => ({ rotation, range: rotation.scores?.rank_range }))
  const rain: RangeRow[] = all.map((rotation) => ({ rotation, range: rotation.scores?.rank_range_rain }))
  const none = (rows: RangeRow[]) => rows.every((r) => !r.range)
  const rainScenario = (env.request?.scenario?.precip_factor ?? 1) !== 1

  if (n < 2) {
    return (
      <section aria-labelledby="robustness-title" className="space-y-4">
        <h3 id="robustness-title" className="text-[1.25rem] leading-tight">
          How firmly does each rotation hold its rank?
        </h3>
        <Callout tone="plain" title="Not available for this analysis" className="max-w-4xl">
          The engine returned only your current rotation, so there is no ranking for its sensitivity checks to test.
        </Callout>
      </section>
    )
  }

  return (
    <section aria-labelledby="robustness-title" className="space-y-4">
      <div>
        <h3 id="robustness-title" className="text-[1.25rem] leading-tight">
          How firmly does each rotation hold its rank?
        </h3>
        <p className="mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          The engine repeats the ranking with two uncertain inputs changed. These are sensitivity checks, not probabilities of success: a rank only compares the {n} rotations in
          this analysis. A wide range means the position is more sensitive to the tested assumption; a single rank means it did not move.
        </p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Test
          title="Robustness to legume-effect assumptions"
          tip={TIP.robustLegume}
          intro={
            <>
              How much a legume lifts the next crop is the least certain number in the model: field studies range from +7% to +32%.{' '}
              {legumeOff ? 'When the legume effect is switched on, the engine ranks' : 'The engine ranks'} the rotations again with the effect at 0%, 7%, 20% and 32%.
            </>
          }
        >
          {legumeOff ? (
            <Callout tone="plain" title="Not available for this analysis">
              The legume effect was switched off in this analysis’s settings, so the engine did not rank the rotations again with different effect sizes. Any range it reports
              here is only the rank itself, so it is not shown.
            </Callout>
          ) : none(legume) ? (
            <Callout tone="plain" title="Not available for this analysis">
              The engine did not return legume-effect rank ranges for this run.
            </Callout>
          ) : (
            <RankRangeChart rows={legume} n={n} test="Legume-effect test" />
          )}
        </Test>

        <Test
          title="Robustness to rainfall variation"
          tip={TIP.robustRain}
          intro={
            <>
              NASA POWER rainfall is a gridded estimate and can differ from what falls on a field. The engine simulates every rotation again with rainfall 30% lower and 30%
              higher, and ranks them each time.
              {rainScenario && ' In this analysis the 30% is applied on top of the what-if rainfall setting.'}
            </>
          }
        >
          {none(rain) ? (
            <Callout tone="plain" title="Not available for this analysis">
              The engine did not return rainfall rank ranges for this run.
            </Callout>
          ) : (
            <RankRangeChart rows={rain} n={n} test="Rainfall test" />
          )}
        </Test>
      </div>

      <PeriodRanks env={env} all={all} />
    </section>
  )
}
