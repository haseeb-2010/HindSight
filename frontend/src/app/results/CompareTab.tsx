import { ArrowRight, Check } from 'lucide-react'
import { InfoTip } from '../../components/ui/InfoTip'
import { failureThreshold, indexVaries, isIrrigated, rankedRotations, rotationLabel, seasonsFailed } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtIndex, fmtMm, fmtPct, isNum, yearList } from '../../lib/format'
import type { AnalysisEnvelope, Rotation } from '../../lib/types'
import { Callout } from '../components/controls'
import { PRIORITIES, PRIORITY_ORDER } from '../lib/labels'
import { HBars, Panel, RotationBadges, Stat, TIP, rangeText } from './shared'

interface RowDef {
  label: string
  tip: string
  value: (r: Rotation) => number | null | undefined
  text: (r: Rotation) => string
  best?: 'high' | 'low'
  priority?: string
}

function RotationCard({ r, n, names, irrigated, thr, included, onToggle, onInspect }: {
  r: Rotation
  n: number
  names: Record<string, string>
  irrigated: boolean
  thr: number | null
  included: boolean
  onToggle: () => void
  onInspect: () => void
}) {
  const f = seasonsFailed(r)
  return (
    <article className={cx('flex flex-col rounded-[1.5rem] p-4 ring-1 transition-shadow', r.is_current ? 'bg-peri-50/70 ring-peri' : 'bg-white ring-border', included ? 'shadow-hairline' : 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-950 px-2 font-display text-[1.125rem] font-semibold text-lime tabular-nums" title={`Rank ${r.scores?.rank} of ${n}`}>
          #{r.scores?.rank}
        </span>
        <label className="flex cursor-pointer items-center gap-2 rounded-full px-2.5 py-1.5 text-[0.75rem] font-extrabold text-forest-950 ring-1 ring-border-strong has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest-950">
          <input type="checkbox" className="sr-only" checked={included} disabled={r.is_current} onChange={onToggle} />
          <span aria-hidden="true" className={cx('flex h-4 w-4 items-center justify-center rounded', included ? 'bg-forest-950 text-lime' : 'bg-sand')}>
            {included && <Check className="h-3 w-3" strokeWidth={3.5} />}
          </span>
          {r.is_current ? 'Always compared' : 'Compare'}
          <span className="sr-only"> {rotationLabel(r)}</span>
        </label>
      </div>
      <h3 className="mt-3 text-[1.125rem] leading-snug">{rotationLabel(r)}</h3>
      <div className="mt-2">
        <RotationBadges r={r} compact />
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Crop sequence">
        {r.slots.map((s, i) => (
          <li key={i} className="rounded-full bg-sand px-2.5 py-1 text-[0.75rem] font-bold text-ink">
            {r.cycle_years > 1 ? `Y${s.year_offset + 1} ` : ''}
            {names[s.crop_id] ?? s.crop_id}
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-border pt-4">
        <Stat label="Median index" value={fmtIndex(r.hindcast.median)} />
        <Stat label="Lower-decile index" value={fmtIndex(r.hindcast.p10)} />
        <Stat label="Failure frequency" value={fmtPct(r.hindcast.failure_freq, 1)} unit={f ? `${f.failed} of ${f.total}` : undefined} />
        <Stat label="Crop water demand" value={fmtMm(r.hindcast.water_demand_mm_per_year)} unit="/ yr" />
        <Stat label="Irrigation requirement" value={irrigated ? fmtMm(r.hindcast.irrigation_mm_per_year) : 'None'} unit={irrigated ? '/ yr' : undefined} />
        <Stat label="Soil cover" value={fmtPct(r.indicators.cover_frac, 1)} />
        <Stat label="Legume share" value={fmtPct(r.indicators.legume_share)} />
        <Stat label="Forage share" value={fmtPct(r.indicators.forage_share)} />
        <Stat label="Heavy rain on bare soil" value={fmtPct(r.indicators.erosive_rain_on_bare_frac)} className="col-span-2" />
      </dl>
      <p className="sr-only">Failure line {thr ?? 'default'}.</p>
      <div className="mt-auto pt-4">
        <button type="button" onClick={onInspect} className="inline-flex w-full items-center justify-between gap-2 rounded-full bg-forest-950 px-4 py-2.5 text-[0.875rem] font-bold text-cream-50 transition-colors hover:bg-forest-900">
          View details <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}

export function CompareTab({ env, names, included, onToggle, onInspect }: {
  env: AnalysisEnvelope
  names: Record<string, string>
  included: Set<string>
  onToggle: (id: string) => void
  onInspect: (id: string) => void
}) {
  const res = env.result
  const all = rankedRotations(res)
  const cur = all.find((r) => r.is_current)
  const shown = [...(cur ? [cur] : []), ...all.filter((r) => !r.is_current && included.has(r.id))]
  const irrigated = isIrrigated(env)
  const thr = failureThreshold(env)
  const weights = env.request?.priorities ?? {}
  const varies = !!cur && indexVaries(cur)
  const worstYears = cur?.hindcast.worst_years?.years ?? []

  const rows: RowDef[] = [
    { label: 'Overall rank', tip: TIP.rank, value: (r) => r.scores?.rank, text: (r) => `#${r.scores?.rank}`, best: 'low' },
    { label: 'Median season index', tip: `${TIP.median} ${TIP.index}`, value: (r) => r.hindcast.median, text: (r) => fmtIndex(r.hindcast.median), best: 'high' },
    { label: 'Lower-decile season index', tip: TIP.p10, value: (r) => r.hindcast.p10, text: (r) => fmtIndex(r.hindcast.p10), best: 'high', priority: 'stability' },
    { label: 'Failure frequency', tip: TIP.failure(thr), value: (r) => r.hindcast.failure_freq, text: (r) => fmtPct(r.hindcast.failure_freq, 1), best: 'low' },
    { label: 'Crop water demand', tip: TIP.water, value: (r) => r.hindcast.water_demand_mm_per_year, text: (r) => fmtMm(r.hindcast.water_demand_mm_per_year), best: 'low', priority: 'water_use' },
    { label: 'Irrigation requirement', tip: TIP.irrigation, value: (r) => (irrigated ? r.hindcast.irrigation_mm_per_year : null), text: (r) => (irrigated ? fmtMm(r.hindcast.irrigation_mm_per_year) : 'None (rainfed)'), best: irrigated ? 'low' : undefined },
    { label: 'Soil cover', tip: TIP.cover, value: (r) => r.indicators.cover_frac, text: (r) => fmtPct(r.indicators.cover_frac, 1), best: 'high', priority: 'organic_matter' },
    { label: 'Legume share', tip: TIP.legume, value: (r) => r.indicators.legume_share, text: (r) => fmtPct(r.indicators.legume_share), best: 'high', priority: 'nitrogen' },
    { label: 'Forage share', tip: TIP.forage, value: (r) => r.indicators.forage_share, text: (r) => fmtPct(r.indicators.forage_share), best: 'high', priority: 'forage' },
    { label: 'Heavy rain on bare soil', tip: TIP.erosion, value: (r) => r.indicators.erosive_rain_on_bare_frac, text: (r) => fmtPct(r.indicators.erosive_rain_on_bare_frac), best: 'low', priority: 'erosion' },
    { label: 'Worst-years index', tip: `${TIP.worst}${worstYears.length ? ` Years: ${yearList(worstYears)}.` : ''}`, value: (r) => (varies ? r.hindcast.worst_years?.mean_index : null), text: (r) => (varies ? fmtIndex(r.hindcast.worst_years?.mean_index) : 'n/a'), best: varies ? 'high' : undefined },
    { label: 'Legume-effect rank range', tip: TIP.robustLegume, value: () => null, text: (r) => rangeText(r.scores?.rank_range) },
    { label: 'Rainfall robustness range', tip: TIP.robustRain, value: () => null, text: (r) => rangeText(r.scores?.rank_range_rain) },
  ]

  const bestOf = (row: RowDef) => {
    if (!row.best) return null
    const vals = shown.map(row.value).filter(isNum)
    if (vals.length < 2 || Math.max(...vals) === Math.min(...vals)) return null
    return row.best === 'high' ? Math.max(...vals) : Math.min(...vals)
  }
  const bar = (pick: (r: Rotation) => number | null | undefined) => shown.map((r) => ({ key: r.id, label: rotationLabel(r), value: pick(r), current: r.is_current }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">Compare Your Rotation Strategies</h2>
          <p className="mt-1 max-w-3xl text-[0.9375rem] text-muted">
            The engine returned {all.length} rotation{all.length === 1 ? '' : 's'}: your current one and {all.length - 1} alternative{all.length === 2 ? '' : 's'}. Untick a card to leave it out of the table and charts.
          </p>
        </div>
        <p className="flex items-center gap-1 text-[0.8125rem] font-bold text-muted">
          How ranking works <InfoTip label="How rotations are ranked">{TIP.rank}</InfoTip>
        </p>
      </div>

      {all.length < 3 && (
        <Callout tone="plain">
          Only {all.length} valid rotation{all.length === 1 ? ' was' : 's were'} available for this field and these settings, so there is less to compare. HindSight does not invent
          strategies to fill the list.
        </Callout>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {all.map((r) => (
          <RotationCard key={r.id} r={r} n={all.length} names={names} irrigated={irrigated} thr={thr} included={r.is_current || included.has(r.id)} onToggle={() => onToggle(r.id)} onInspect={() => onInspect(r.id)} />
        ))}
      </div>

      <Panel title="Side by side" className="hidden md:block" action={<p className="text-[0.8125rem] font-semibold text-muted">● marks the strongest value in a row among the rotations shown</p>}>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-separate border-spacing-0 text-[0.875rem]" style={{ minWidth: `${13 + shown.length * 8}rem` }}>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-52 bg-white pb-3 text-left align-bottom text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
                  Indicator
                </th>
                {shown.map((r, i) => (
                  <th key={r.id} scope="col" className={cx('min-w-32 px-2.5 pt-2.5 pb-3 text-left align-bottom', r.is_current && 'rounded-t-xl bg-peri-50')}>
                    <span className="block text-[0.6875rem] font-extrabold tracking-[0.06em] text-muted uppercase">{r.is_current ? 'Current rotation' : `Alternative ${i}`}</span>
                    <span className="mt-0.5 block leading-snug font-bold text-forest-950">{rotationLabel(r)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const best = bestOf(row)
                const high = row.priority && (weights[row.priority] ?? 0) >= 4
                return (
                  <tr key={row.label}>
                    <th scope="row" className="sticky left-0 z-10 border-t border-border bg-white py-2.5 pr-3 text-left font-bold text-ink">
                      <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                        {row.label} <InfoTip label={row.label}>{row.tip}</InfoTip>
                        {high && <span className="rounded-full bg-lime-100 px-1.5 py-0.5 text-[0.625rem] font-extrabold tracking-wide text-forest-800 uppercase ring-1 ring-forest-950/10">High priority</span>}
                      </span>
                    </th>
                    {shown.map((r) => {
                      const v = row.value(r)
                      const isBest = best !== null && v === best
                      return (
                        <td key={r.id} className={cx('border-t border-border px-3 py-2.5 tabular-nums', r.is_current && 'bg-peri-50', isBest ? 'font-extrabold text-forest-950' : 'font-semibold text-ink')}>
                          {row.text(r)}
                          {isBest && (
                            <span className="ml-1.5 text-forest-800" aria-label="strongest in this row">
                              ●
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="text-[0.8125rem] text-muted md:hidden">On a small screen each card above lists every compared value. The side-by-side table appears on wider screens and in the CSV export.</p>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <HBars
            title="Stability in weaker years"
            unit="lower-decile season index"
            tip={TIP.p10}
            rows={bar((r) => r.hindcast.p10)}
            format={(v) => v.toFixed(2)}
            caption="Higher means the rotation held up better in its weaker historical years. Not a yield, and not a probability."
          />
        </Panel>
        <Panel>
          <HBars title="Crop water demand" unit="mm per year" tip={TIP.water} rows={bar((r) => r.hindcast.water_demand_mm_per_year)} format={(v) => fmtMm(v)} />
          {irrigated ? (
            <div className="mt-6 border-t border-border pt-5">
              <HBars
                title="Irrigation requirement"
                unit="mm per year"
                tip={TIP.irrigation}
                rows={bar((r) => r.hindcast.irrigation_mm_per_year)}
                format={(v) => fmtMm(v)}
                caption="A different quantity from crop water demand: the part the model supplies by irrigation. The two are not added together."
              />
            </div>
          ) : (
            <p className="mt-4 text-[0.8125rem] leading-snug text-muted">This field is rainfed, so no irrigation is applied in the model and there is no irrigation requirement to compare.</p>
          )}
        </Panel>
      </div>

      <Panel title="Rotation soil-care indicators">
        <div className="grid gap-x-8 gap-y-7 md:grid-cols-2">
          <HBars title="Legume share" tip={TIP.legume} rows={bar((r) => r.indicators.legume_share)} format={(v) => fmtPct(v)} max={1} />
          <HBars title="Soil cover" tip={TIP.cover} rows={bar((r) => r.indicators.cover_frac)} format={(v) => fmtPct(v, 1)} max={1} />
          <HBars title="Forage share" tip={TIP.forage} rows={bar((r) => r.indicators.forage_share)} format={(v) => fmtPct(v)} max={1} />
          <HBars title="Heavy rain on bare soil" tip={TIP.erosion} rows={bar((r) => r.indicators.erosive_rain_on_bare_frac)} format={(v) => fmtPct(v)} max={1} caption="Lower is better here: less heavy rain falling on uncovered soil." />
        </div>
        <p className="mt-5 border-t border-border pt-4 text-[0.8125rem] leading-snug text-muted">
          These are structural indicators and proxies, not measurements: legume share is not a nitrogen balance, cover and residue are not a change in soil
          carbon, and exposure to heavy rain is not a soil-loss rate.
        </p>
      </Panel>

      <Panel title="How the ranking was built">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          The engine scales each indicator between the best and worst of the rotations in this analysis, multiplies by your weights, and adds the results
          into a weighted score. Ranks follow that score. It also marks rotations that are Pareto efficient, a test that does not depend on weights.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="font-sans text-[0.8125rem] font-extrabold text-forest-950">Weights used in this analysis</h4>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {PRIORITY_ORDER.map((k) => (
                <li key={k} className="rounded-full bg-sand px-3 py-1.5 text-[0.8125rem] font-bold text-ink">
                  {PRIORITIES[k].short} <span className="font-extrabold text-forest-950 tabular-nums">{weights[k] ?? '—'}</span>
                </li>
              ))}
            </ul>
          </div>
          <HBars title="Weighted score" unit="0 to 1, relative" tip={TIP.rank} rows={all.map((r) => ({ key: r.id, label: `#${r.scores?.rank} ${rotationLabel(r)}`, value: r.scores?.total, current: r.is_current }))} format={(v) => v.toFixed(2)} max={1} />
        </div>
      </Panel>
    </div>
  )
}
