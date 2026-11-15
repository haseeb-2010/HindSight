import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { InfoTip } from '../../../components/ui/InfoTip'
import { failureThreshold, isIrrigated, isRobust, rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import type { AnalysisEnvelope, Rotation } from '../../../lib/types'
import { METRICS, METRIC_BY_ID, fmtMetric, tradeoffs, type MetricDef } from '../../lib/insights'
import { RotationBadges, TIP } from '../../results/shared'
import { LegendKey, RankBlock, axisMax, axisPos } from './shared'

/** The nine engine indicators of a profile, grouped for reading. Any indicator not named here is listed last. */
const GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Simulated seasonal index', ids: ['median', 'p10', 'failure'] },
  { title: 'Water', ids: ['water', 'irrigation'] },
  { title: 'Soil care and crop mix', ids: ['cover', 'legume', 'forage', 'erosion'] },
]

function groupedMetrics(): { title: string; metrics: MetricDef[] }[] {
  const named = new Set(GROUPS.flatMap((g) => g.ids))
  const rest = METRICS.filter((m) => !named.has(m.id))
  const groups = GROUPS.map((g) => ({ title: g.title, metrics: g.ids.map((id) => METRIC_BY_ID[id]).filter((m): m is MetricDef => !!m) }))
  return rest.length ? [...groups, { title: 'Other indicators', metrics: rest }] : groups
}

function ProfileRow({ m, r, cur, max, irrigated, thr }: { m: MetricDef; r: Rotation; cur: Rotation | undefined; max: number; irrigated: boolean; thr: number | null }) {
  const v = m.get(r)
  const base = cur ? m.get(cur) : null
  const pos = axisPos(v, max)
  const basePos = axisPos(base, max)
  const rainfed = m.id === 'irrigation' && !irrigated
  const showBase = !r.is_current && !!cur && !rainfed
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.25rem] items-center gap-x-3 py-[0.3125rem] sm:grid-cols-[minmax(0,1fr)_6rem_4.5rem]">
      <dt className="min-w-0 text-[0.8125rem] leading-snug font-bold text-ink">
        <InfoTip label={m.label} term={m.short}>
          {m.context}
          {m.id === 'failure' && thr !== null ? ` The failure line in this analysis is ${thr.toFixed(2)}.` : ''}
          {rainfed ? ' This analysis is rainfed, so no irrigation was applied.' : ''}
          {showBase ? ` Here: ${fmtMetric(m, v)}, against ${fmtMetric(m, base)} for your current rotation.` : ''}
        </InfoTip>
      </dt>
      <dd className="contents">
        <span aria-hidden="true" className={cx('relative h-2 rounded-full', r.is_current ? 'bg-white' : 'bg-sand')}>
          {pos !== null && pos > 0 && (
            <span className={cx('bar-grow-x absolute inset-y-0 left-0 rounded-full', r.is_current ? 'bg-peri-chart' : 'bg-forest-800')} style={{ width: `${Math.max(pos, 1.5)}%` }} />
          )}
          {showBase && basePos !== null && (
            <span className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-peri-chart ring-2 ring-white" style={{ left: `${basePos}%` }} />
          )}
        </span>
        <span className="text-right font-display text-[0.9375rem] font-semibold whitespace-nowrap text-forest-950 tabular-nums">
          {rainfed ? 'None' : fmtMetric(m, v)}
          {showBase && <span className="sr-only">; current rotation {fmtMetric(m, base)}</span>}
        </span>
      </dd>
    </div>
  )
}

function ProfileCard({ r, cur, all, env, startOpen }: { r: Rotation; cur: Rotation | undefined; all: Rotation[]; env: AnalysisEnvelope; startOpen: boolean }) {
  const irrigated = isIrrigated(env)
  const thr = failureThreshold(env)
  // On a phone the six or more cards make a very long page, so each list of indicators can be folded away. From md up it is always shown.
  const [open, setOpen] = useState(startOpen)
  const bodyId = useId()
  return (
    <article className={cx('flex flex-col rounded-[1.5rem] p-5 shadow-hairline ring-1', r.is_current ? 'bg-peri-50/70 ring-peri' : 'bg-white ring-border')}>
      <div className="flex items-start gap-3">
        <RankBlock rank={r.scores?.rank} of={all.length} current={r.is_current} />
        <div className="min-w-0">
          <p className={cx('text-[0.6875rem] font-extrabold tracking-[0.08em] uppercase', r.is_current ? 'text-peri-ink' : 'text-muted')}>
            {r.is_current ? '' : 'Alternative · '}
            {r.cycle_years}-year cycle
          </p>
          <h4 className="mt-0.5 text-[1.0625rem] leading-snug md:min-h-[2.75em]">{rotationLabel(r)}</h4>
        </div>
      </div>
      <div className={cx('mt-2.5 md:min-h-[1.625rem]', !(r.is_current || r.scores?.pareto || isRobust(r)) && 'max-md:hidden')}>
        <RotationBadges r={r} compact />
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-full bg-sand px-3.5 py-2 text-left text-[0.8125rem] font-extrabold text-forest-950 md:hidden"
      >
        {open ? 'Hide the indicators' : `Show the ${METRICS.length} indicators`}
        <ChevronDown className={cx('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div id={bodyId} className={cx('mt-3 space-y-3 md:block', !open && 'hidden')}>
        {groupedMetrics().map((g) => (
          <div key={g.title} className={cx('border-t pt-2.5', r.is_current ? 'border-peri' : 'border-border')}>
            <p className="mb-0.5 text-[0.6875rem] font-extrabold tracking-[0.06em] text-ink uppercase">{g.title}</p>
            <dl>
              {g.metrics.map((m) => (
                <ProfileRow key={m.id} m={m} r={r} cur={cur} max={axisMax(m, all)} irrigated={irrigated} thr={thr} />
              ))}
            </dl>
          </div>
        ))}
      </div>
    </article>
  )
}

/** What the engine output supports saying about the alternatives as a group. Null when there is nothing to compare. */
function profileSentence(all: Rotation[], cur: Rotation | undefined): string | null {
  if (!cur) return null
  const alts = all.filter((r) => !r.is_current)
  if (alts.length === 0) return null
  const favourable = (id: string) => alts.filter((r) => tradeoffs(r, cur).some((t) => t.metric.id === id && t.verdict === 'favourable')).length
  const p10 = METRIC_BY_ID.p10
  const water = METRIC_BY_ID.water
  const n = alts.length
  return (
    `${favourable('p10')} of the ${n} alternative${n === 1 ? '' : 's'} show${n === 1 ? 's' : ''} a higher lower-decile (P10) seasonal index than your current rotation ` +
    `(${fmtMetric(p10, p10.get(cur))}), and ${favourable('water')} of ${n} a lower modelled crop water demand (${fmtMetric(water, water.get(cur))} a year).`
  )
}

/** A. One compact profile per returned rotation, on shared axes so the cards can be compared at a glance. */
export function ProfileCards({ env, all, cur }: { env: AnalysisEnvelope; all: Rotation[]; cur: Rotation | undefined }) {
  const sentence = profileSentence(all, cur)
  const firstAlt = all.find((r) => !r.is_current)
  return (
    <section aria-labelledby="profiles-title" className="space-y-4">
      <div>
        <h3 id="profiles-title" className="text-[1.25rem] leading-tight">
          Rotation performance profiles
        </h3>
        <p className="mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          The same {METRICS.length} engine indicators for each of the {all.length} rotation{all.length === 1 ? '' : 's'} in this analysis, in rank order.
          {sentence ? ` ${sentence}` : ''}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] font-semibold text-ink">
          <LegendKey swatch={<span className="h-2 w-7 rounded-full bg-forest-800" />}>This rotation’s value</LegendKey>
          <LegendKey swatch={<span className="h-4 w-[3px] rounded-full bg-peri-chart" />}>Your current rotation’s value, for comparison</LegendKey>
          <li className="inline-flex items-center gap-1">
            Pareto efficient <InfoTip label="Pareto efficient">{TIP.pareto}</InfoTip>
          </li>
          <li className="inline-flex items-center gap-1">
            Robust rank <InfoTip label="Robust rank">{TIP.robust}</InfoTip>
          </li>
        </ul>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {all.map((r) => (
          <ProfileCard key={r.id} r={r} cur={cur} all={all} env={env} startOpen={r.is_current || r.id === firstAlt?.id} />
        ))}
      </div>
      <p className="max-w-3xl text-[0.8125rem] leading-snug text-muted">
        Share bars run from 0 to 100%. Index and millimetre bars run from 0 to the largest value among these rotations. Select an underlined name to read what
        that indicator does and does not mean.
      </p>
    </section>
  )
}
