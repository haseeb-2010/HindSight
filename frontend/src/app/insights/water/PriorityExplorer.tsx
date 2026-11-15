import { ArrowDown, ArrowRightLeft, ArrowUp, ArrowUpDown, Check, Equal, EyeOff, Minus, Plus, RefreshCw, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { InfoTip } from '../../../components/ui/InfoTip'
import { cx } from '../../../lib/cx'
import { fmtMm, fmtNum, isNum } from '../../../lib/format'
import type { Comparison, Rotation } from '../../../lib/types'
import { Callout, Slider } from '../../components/controls'
import { SourceBadge } from '../../components/SourceBadge'
import { isScenarioActive, requestFromEnvelope, scenarioText } from '../../lib/config'
import { rotationKey, runChanges, summariseRuns, type RankRow, type RunChange, type RunInput } from '../../lib/insights'
import { PRIORITIES, PRIORITY_ORDER, waterLabel } from '../../lib/labels'
import { RunProgress } from '../../results/RunProgress'
import { Chip, Panel, TIP } from '../../results/shared'
import { useComparison } from '../../state/useComparison'
import { useWorkspace } from '../../state/workspace'
import type { InsightProps } from '../types'

const TITLE = 'Water priority explorer'
const weight = (v: number | undefined | null) => (isNum(v) ? fmtNum(v, Number.isInteger(v) ? 0 : 1) : '—')

/** The statement that stays on screen in every state of the explorer. */
function WhatAWeightDoes({ className }: { className?: string }) {
  return (
    <Callout tone="info" title="A preference changes the ranking, not the water" className={className}>
      Changing a preference changes how the alternatives are ranked. It does not change the simulated seasons or the physical water supply.
    </Callout>
  )
}

/** True when two copies of a rotation carry the same simulated values (yearly index, summary statistics, both water measures). */
function sameSimulation(a: Rotation, b: Rotation): boolean {
  const x = a.hindcast
  const y = b.hindcast
  const eq = (p: number | null | undefined, q: number | null | undefined) => (p ?? null) === (q ?? null)
  return (
    eq(x.median, y.median) &&
    eq(x.p10, y.p10) &&
    eq(x.failure_freq, y.failure_freq) &&
    eq(x.water_demand_mm_per_year, y.water_demand_mm_per_year) &&
    eq(x.irrigation_mm_per_year, y.irrigation_mm_per_year) &&
    x.annual_index.length === y.annual_index.length &&
    x.annual_index.every((v, i) => eq(v, y.annual_index[i]))
  )
}

function Movement({ before, after }: { before: number | null; after: number | null }) {
  if (after === null) return null
  if (before === null) {
    return (
      <Chip tone="forest">
        <Plus className="h-3 w-3" aria-hidden="true" /> Entered
      </Chip>
    )
  }
  const d = before - after
  if (d === 0) {
    return (
      <Chip tone="white">
        <Minus className="h-3 w-3" aria-hidden="true" /> Same rank
      </Chip>
    )
  }
  const places = `${Math.abs(d)} place${Math.abs(d) === 1 ? '' : 's'}`
  return d > 0 ? (
    <Chip tone="lime">
      <ArrowUp className="h-3 w-3" aria-hidden="true" /> Up {places}
    </Chip>
  ) : (
    <Chip tone="sand">
      <ArrowDown className="h-3 w-3" aria-hidden="true" /> Down {places}
    </Chip>
  )
}

/** One run's ranking. In the updated run each row says how it moved; in the baseline, rows that drop out are marked. */
function RankList({ title, sub, rows, index, other, updated }: { title: string; sub: string; rows: RankRow[]; index: number; other: number; updated: boolean }) {
  const list = rows.filter((r) => r.ranks[index] !== null).sort((a, b) => (a.ranks[index] ?? 0) - (b.ranks[index] ?? 0))
  return (
    <div className="min-w-0 md:row-span-full md:grid md:grid-rows-subgrid">
      <div className="md:pb-1">
        <h5 className="font-display text-[1rem] leading-tight font-semibold tracking-[-0.01em] text-forest-950">{title}</h5>
        <p className="mt-0.5 text-[0.8125rem] font-semibold text-muted tabular-nums">{sub}</p>
      </div>
      {/* From md up both lists share one set of rows, so rank n sits beside rank n. */}
      <ol className="max-md:mt-3 max-md:space-y-2 md:row-start-2 md:row-end-[-1] md:grid md:grid-rows-subgrid">
        {list.map((row) => {
          const rot = row.rotations[index]
          return (
            <li key={row.key} className={cx('flex items-start gap-3 rounded-2xl p-3 ring-1', row.isCurrent ? 'bg-peri-50/70 ring-peri' : 'bg-white ring-border')}>
              <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl bg-forest-950 px-1.5 font-display text-[0.9375rem] font-semibold text-lime tabular-nums">
                <span className="sr-only">Rank </span>#{row.ranks[index]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.875rem] leading-snug font-bold text-forest-950">{row.name}</p>
                {rot && (
                  <p className="mt-0.5 text-[0.75rem] leading-snug text-muted tabular-nums">
                    Crop water demand {fmtMm(rot.hindcast.water_demand_mm_per_year)}
                    {isNum(rot.scores?.total) && <> · weighted score {rot.scores.total.toFixed(2)}</>}
                  </p>
                )}
                <p className="mt-1.5 flex flex-wrap gap-1.5 empty:hidden">
                  {row.isCurrent && <Chip tone="peri">Current</Chip>}
                  {updated ? (
                    <Movement before={row.ranks[other]} after={row.ranks[index]} />
                  ) : (
                    row.ranks[other] === null && (
                      <Chip tone="sand">
                        <EyeOff className="h-3 w-3" aria-hidden="true" /> No longer shown
                      </Chip>
                    )
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const CHANGE_ICON: Record<RunChange['kind'], LucideIcon> = {
  top: ArrowRightLeft,
  current_rank: ArrowUpDown,
  moved: ArrowUpDown,
  entered: Plus,
  left: EyeOff,
  metric: ArrowRightLeft,
  none: Equal,
}

function ExplorerResult({ result, onApply }: { result: Comparison; onApply: (w: number) => void }) {
  const a = result.variants.find((v) => v.id === 'yours')
  const b = result.variants.find((v) => v.id === 'water')
  if (!a || !b) {
    return <Callout tone="warn">The engine did not return both runs, so there is nothing to compare. Try the re-ranking again.</Callout>
  }

  const inputs: RunInput[] = [a, b].map((v) => ({ id: v.id, label: v.label, envelope: v.envelope }))
  const { runs, rows } = summariseRuns(inputs)
  const changes = runChanges(runs[0], runs[1], rows, 0, 1)
  const w0 = a.envelope.request?.priorities ?? {}
  const w1 = b.envelope.request?.priorities ?? {}
  const from = w0.water_use
  const to = w1.water_use
  const direction = isNum(from) && isNum(to) && from !== to ? (to > from ? 'raised' : 'lowered') : 'changed'
  const scenario = a.envelope.request?.scenario

  const keyOf = (r: Rotation | undefined) => (r ? (r.is_current ? 'current' : rotationKey(r)) : null)
  const topChanged = keyOf(runs[0].top) !== keyOf(runs[1].top)
  const topText = changes.find((c) => c.kind === 'top')?.text
  const rest = changes.filter((c) => c.kind !== 'top')
  const listChanged = rows.some((r) => (r.ranks[0] === null) !== (r.ranks[1] === null))

  // The check behind "the simulated seasons do not change": compare the two engine responses.
  const shared = rows.filter((r) => r.rotations[0] && r.rotations[1])
  const differing = shared.filter((r) => !sameSimulation(r.rotations[0] as Rotation, r.rotations[1] as Rotation))
  const ca = a.envelope.result.site.climate_summary
  const cb = b.envelope.result.site.climate_summary
  const sameWeather = isNum(ca?.annual_rain_mm) && isNum(ca?.annual_et0_mm) && ca.annual_rain_mm === cb?.annual_rain_mm && ca.annual_et0_mm === cb?.annual_et0_mm
  const wa = a.envelope.request?.water
  const wb = b.envelope.request?.water
  const sameWater = !!wa?.mode && wa.mode === wb?.mode && (wa.seasonal_cap_mm ?? null) === (wb?.seasonal_cap_mm ?? null)

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h4 className="text-[1.25rem] leading-tight">
            Water conservation {direction} from {weight(from)} to {weight(to)}: what changed
          </h4>
          <p className="mt-1 max-w-3xl text-[0.875rem] leading-snug text-muted">
            The engine ran this field twice, once with each set of weights. Ranks are relative to the rotations in each run. They are not probabilities of success.
          </p>
        </div>
        <SourceBadge env={b.envelope} />
      </div>

      <div className={cx('mt-4 flex items-start gap-3.5 rounded-2xl p-4 ring-1', topChanged ? 'bg-lime-100 ring-forest-950/10' : 'bg-sand/60 ring-transparent')}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime">
          {topChanged ? <ArrowRightLeft className="h-5 w-5" aria-hidden="true" /> : <Equal className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="text-[0.75rem] font-extrabold tracking-[0.06em] text-ink uppercase">Highest-ranked rotation</p>
          <p className="mt-0.5 font-display text-[1.1875rem] leading-tight font-semibold text-forest-950">{topChanged ? 'Changed' : 'Unchanged'}</p>
          {topText && <p className="mt-1 text-[0.9375rem] leading-snug text-ink">{topText}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h5 className="font-display text-[1rem] leading-tight font-semibold tracking-[-0.01em] text-forest-950">Weights used (0 to 5)</h5>
          <table className="mt-3 w-full border-separate border-spacing-0 text-[0.875rem]">
            <caption className="sr-only">The seven priority weights in each run. The row that differs is marked as changed.</caption>
            <thead className="text-[0.6875rem] font-extrabold tracking-[0.04em] text-ink uppercase">
              <tr>
                <th scope="col" className="pb-2 text-left align-bottom">
                  Priority
                </th>
                <th scope="col" className="w-16 pb-2 pl-2 text-right align-bottom">
                  Your weights
                </th>
                <th scope="col" className="w-16 pb-2 pr-2.5 pl-2 text-right align-bottom">
                  New weights
                </th>
              </tr>
            </thead>
            <tbody>
              {PRIORITY_ORDER.map((k) => {
                const changed = w0[k] !== w1[k]
                const up = isNum(w0[k]) && isNum(w1[k]) && w1[k] > w0[k]
                return (
                  <tr key={k}>
                    <th scope="row" className={cx('border-t border-border py-2 pr-1 pl-2.5 text-left leading-snug font-bold', changed ? 'rounded-l-xl bg-lime-100 text-forest-950' : 'text-ink')}>
                      {PRIORITIES[k].label}
                      {changed && <span className="mt-0.5 block text-[0.6875rem] font-extrabold tracking-wide text-forest-800 uppercase">Changed</span>}
                    </th>
                    <td className={cx('border-t border-border py-2 pl-2 text-right font-display text-[1rem] font-semibold text-forest-950 tabular-nums', changed && 'bg-lime-100')}>{weight(w0[k])}</td>
                    <td className={cx('border-t border-border py-2 pr-2.5 pl-2 text-right font-display text-[1rem] font-semibold text-forest-950 tabular-nums', changed && 'rounded-r-xl bg-lime-100')}>
                      <span className="inline-flex items-center justify-end gap-1">
                        {changed && (up ? <ArrowUp className="h-3.5 w-3.5 text-forest-800" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5 text-forest-800" aria-hidden="true" />)}
                        {changed && <span className="sr-only">{up ? 'raised to' : 'lowered to'} </span>}
                        {weight(w1[k])}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
            {PRIORITIES.water_use.explain} The irrigation requirement is not part of the ranking.
          </p>
        </div>

        <div className="min-w-0">
          <div className="max-md:space-y-7 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-2" style={{ gridTemplateRows: `auto repeat(${Math.max(runs[0].count, runs[1].count)}, auto)` }}>
            <RankList title="Ranking with your weights" sub={`Water conservation ${weight(from)} · the baseline`} rows={rows} index={0} other={1} updated={false} />
            <RankList title="Ranking with the new weight" sub={`Water conservation ${weight(to)}`} rows={rows} index={1} other={0} updated />
          </div>
          <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
            {listChanged && 'The engine chooses which alternatives to show using the weights, so a change of weight can bring a different rotation into the list. '}
            The weighted score runs from 0 to 1 and only compares the rotations inside one run. <InfoTip label="How rotations are ranked">{TIP.rank}</InfoTip>
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-x-10 gap-y-6 border-t border-border pt-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h5 className="font-display text-[1rem] leading-tight font-semibold tracking-[-0.01em] text-forest-950">What changed</h5>
          <ul className="mt-3 space-y-2.5">
            {rest.map((c, i) => {
              const Icon = CHANGE_ICON[c.kind]
              return (
                <li key={i} className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand text-forest-950">
                    <Icon className="h-3 w-3" aria-hidden="true" />
                  </span>
                  {c.text}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="min-w-0">
          <h5 className="font-display text-[1rem] leading-tight font-semibold tracking-[-0.01em] text-forest-950">What did not change</h5>
          {differing.length > 0 ? (
            <Callout tone="warn" className="mt-3">
              Unexpected: {differing.length} of the {shared.length} rotations that appear in both runs have different simulated values ({differing.map((r) => r.name).join('; ')}). Treat this
              comparison with care.
            </Callout>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {shared.length > 0 && (
                <li className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-950 text-lime">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span>
                    <strong className="font-extrabold text-forest-950">The simulated seasons.</strong> Checked in these two runs:{' '}
                    {shared.length === 1 ? 'the one rotation that appears in both has' : `all ${shared.length} rotations that appear in both have`} the same season index in every year, the same
                    crop water demand and the same irrigation requirement.
                  </span>
                </li>
              )}
              {sameWeather && sameWater && (
                <li className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-950 text-lime">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span>
                    <strong className="font-extrabold text-forest-950">The water supply.</strong>{' '}
                    {isScenarioActive(scenario)
                      ? `Both runs read the same weather record with the same what-if adjustment (${scenarioText(scenario)}): rainfall ${fmtMm(ca?.annual_rain_mm)} and reference evapotranspiration ${fmtMm(ca?.annual_et0_mm)} a year on average after the adjustment. The water setting is the same too: ${waterLabel(wa?.mode, wa?.seasonal_cap_mm).toLowerCase()}.`
                      : `Both runs read the same weather record (rainfall ${fmtMm(ca?.annual_rain_mm)} and reference evapotranspiration ${fmtMm(ca?.annual_et0_mm)} a year on average) with the same water setting: ${waterLabel(wa?.mode, wa?.seasonal_cap_mm).toLowerCase()}.`}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {isNum(to) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-sand/60 p-4">
          <Button arrow onClick={() => onApply(to)} className="max-w-full max-sm:h-auto! max-sm:py-2.5 max-sm:text-left max-sm:leading-snug max-sm:whitespace-normal!">
            Apply this weight in Farm Analysis
          </Button>
          <p className="min-w-0 flex-1 basis-64 text-[0.875rem] leading-snug text-ink">
            Sets water conservation to {weight(to)} in your farm settings and opens the priorities step. Nothing is re-analysed yet: run the analysis again from there to get results with the
            new weight.
          </p>
        </div>
      )}
    </>
  )
}

/**
 * Section B. Re-runs the ranking on the server with a different water conservation weight
 * (POST /api/scenarios/compare through useComparison) and shows the two rankings side by side.
 */
export function PriorityExplorer({ env }: Pick<InsightProps, 'env'>) {
  const { defaultPriorities, update } = useWorkspace()
  const navigate = useNavigate()
  const cmp = useComparison()
  const hint = useId()
  const base = useMemo(() => requestFromEnvelope(env, defaultPriorities), [env, defaultPriorities])
  const yours = base?.priorities.water_use
  const [picked, setPicked] = useState<number | null>(null)
  const atMax = isNum(yours) && yours >= 5
  const target = picked ?? (atMax ? 0 : 5)
  const runWrap = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const seen = useRef(cmp.status)

  // Keep keyboard and screen-reader users in place when the panel swaps between form, progress and result.
  useEffect(() => {
    const before = seen.current
    seen.current = cmp.status
    if (before === cmp.status) return
    if (cmp.status === 'done') resultRef.current?.focus({ preventScroll: true })
    else if (cmp.status === 'idle') runWrap.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [cmp.status])

  if (!base || !isNum(yours)) {
    return (
      <Panel title={TITLE}>
        <div className="space-y-3">
          <Callout tone="plain" title="Not available for this analysis">
            The settings this analysis ran with were not stored with it, so the engine cannot repeat it with a different water conservation weight. Run the analysis again from Farm Analysis to
            use the explorer.
          </Callout>
          <WhatAWeightDoes />
        </div>
      </Panel>
    )
  }

  const same = target === yours
  const start = () => {
    if (same) return
    void cmp.run(base, [
      { id: 'yours', label: 'Your weights' },
      { id: 'water', label: target > yours ? 'Water conservation raised' : 'Water conservation lowered', priorities: { water_use: target } },
    ])
  }

  if (cmp.status === 'running' || cmp.status === 'error') {
    const to = cmp.variants.find((v) => v.id === 'water')?.priorities?.water_use
    return (
      <section aria-label={TITLE} className="space-y-3">
        <RunProgress
          run={cmp}
          onRetry={() => void cmp.run(base, cmp.variants)}
          onCancel={cmp.cancel}
          onEdit={cmp.reset}
          title="Re-ranking your rotations…"
          failedTitle="The re-ranking could not be completed"
          intro={`Running the engine twice for this field: once with your weights and once with water conservation at ${weight(to)}. Nothing else is changed.`}
        />
        <WhatAWeightDoes />
      </section>
    )
  }

  const apply = (w: number) => {
    update((c) => ({ ...c, priorities: { ...c.priorities, water_use: w } }))
    navigate('/app/analysis?step=priorities')
    // Arrive at the top of the step with its heading focused, as the step navigation itself does.
    window.scrollTo({ top: 0 })
    window.setTimeout(() => document.querySelector<HTMLElement>('#step-title')?.focus({ preventScroll: true }), 80)
  }

  return (
    <Panel title={TITLE}>
      <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
        {atMax
          ? 'Your water conservation weight is already 5, the highest. Lower it here to see how much the ranking depends on it.'
          : `See how the ranking would change if saving water mattered ${target < yours ? 'less' : 'more'} to you.`}{' '}
        HindSight sends this field back to the engine with one thing changed: the water conservation weight. Everything else stays as it was in this analysis.
      </p>
      <WhatAWeightDoes className="mt-4" />

      <div className="mt-4 rounded-2xl bg-sand/60 p-4 sm:p-5">
        <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-extrabold text-forest-950">Water conservation weight to try</p>
                <p id={hint} className="mt-0.5 text-[0.8125rem] leading-snug text-ink">
                  This analysis used {weight(yours)} of 5. {PRIORITIES.water_use.explain}
                </p>
              </div>
              <p className="shrink-0 font-display text-[1.75rem] leading-none font-semibold text-forest-950 tabular-nums" aria-hidden="true">
                {target}
                <span className="text-[0.875rem] text-ink">/5</span>
              </p>
            </div>
            <div className="mt-2">
              <Slider
                label="Water conservation weight to try"
                describedBy={hint}
                value={target}
                min={0}
                max={5}
                step={1}
                onChange={setPicked}
                format={(v) => `${v} of 5${v === yours ? ', the weight this analysis used' : ''}`}
                ticks={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: v === yours ? `${v} · now` : String(v) }))}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[0.6875rem] font-bold text-ink" aria-hidden="true">
              <span>0 · not counted</span>
              <span>5 · matters most</span>
            </div>
          </div>
          <div ref={runWrap} className="min-w-0">
            <Button icon={<RefreshCw />} onClick={start} disabled={same}>
              Re-rank with weight {target}
            </Button>
            <p className="mt-2 text-[0.8125rem] leading-snug text-ink">
              {same
                ? `This analysis already used ${weight(yours)}. Choose a different weight to compare.`
                : 'Nothing runs until you press the button. The engine then replays the record twice: once with your weights and once with this one.'}
            </p>
          </div>
        </div>
      </div>

      {cmp.status === 'done' && cmp.result && (
        <div ref={resultRef} tabIndex={-1} className="animate-fade mt-7 border-t border-border pt-6 outline-none">
          <ExplorerResult result={cmp.result} onApply={apply} />
        </div>
      )}
    </Panel>
  )
}
