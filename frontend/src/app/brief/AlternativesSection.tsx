// Section 4 of the Decision Brief: the highest-ranked alternatives, what each would trade, and how firm its rank is.
import { CircleAlert, CircleCheck, Equal } from 'lucide-react'
import type { ReactNode } from 'react'
import { InfoTip } from '../../components/ui/InfoTip'
import { indexVaries, rotationLabel, seasonsFailed } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtIndex, isNum } from '../../lib/format'
import type { Rotation } from '../../lib/types'
import { Callout } from '../components/controls'
import { fmtMetric, fmtMetricDelta, METRIC_BY_ID, METRICS, rankSpread, stabilitySentence, tradeoffs, tradeoffSentence, type Tradeoff } from '../lib/insights'
import { rangeText, RotationBadges, TIP } from '../results/shared'
import { IndexRange } from './charts'
import { Bullets, CropSequence, lowerFirst, Section, Sub, type BriefData } from './parts'

/* ------------------------------------------------------------------ 4. leading alternatives */

function TradeoffGroups({ alt, cur, irrigated }: { alt: Rotation; cur: Rotation; irrigated: boolean }) {
  const all = tradeoffs(alt, cur).filter((t) => irrigated || t.metric.id !== 'irrigation')
  const line = (t: Tradeoff) => (
    <>
      <span className="font-bold text-forest-950">{t.metric.label}:</span>{' '}
      <span className="tabular-nums">
        {fmtMetric(t.metric, t.value)} against {fmtMetric(t.metric, t.base)} ({fmtMetricDelta(t.metric, t.delta)})
      </span>
    </>
  )
  const withIt = all.filter((t) => t.verdict === 'favourable')
  const against = all.filter((t) => t.verdict === 'unfavourable')
  const same = all.filter((t) => t.verdict === 'similar')
  const unknown = all.filter((t) => t.verdict === 'unknown')
  const groups = [
    { key: 'with', title: 'In the direction the ranking rewards', icon: CircleCheck, tone: 'bg-lime-100/70 ring-forest-950/10', items: withIt, empty: 'No indicator differs from the current rotation in this direction.' },
    { key: 'against', title: 'Against the direction the ranking rewards', icon: CircleAlert, tone: 'bg-signal-50 ring-signal/30', items: against, empty: 'No indicator differs from the current rotation in this direction.' },
  ]
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className={cx('break-inside-avoid rounded-2xl p-4 ring-1', g.tone)}>
            <p className="flex items-center gap-1.5 text-[0.8125rem] font-extrabold text-forest-950">
              <g.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {g.title}
            </p>
            {g.items.length ? (
              <ul className="mt-2 space-y-1.5 text-[0.8125rem] leading-snug text-ink">
                {g.items.map((t) => (
                  <li key={t.metric.id}>{line(t)}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.8125rem] leading-snug text-ink">{g.empty}</p>
            )}
          </div>
        ))}
      </div>
      {(same.length > 0 || unknown.length > 0) && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[0.8125rem] leading-snug text-ink">
          <Equal className="mt-0.5 h-4 w-4 shrink-0 text-forest-800" aria-hidden="true" />
          <span>
            {same.length > 0 && (
              <>
                <span className="font-bold text-forest-950">About the same as the current rotation:</span> {same.map((t) => lowerFirst(t.metric.short)).join(', ')}.
              </>
            )}
            {unknown.length > 0 && (
              <>
                {' '}
                <span className="font-bold text-forest-950">Not available:</span> {unknown.map((t) => lowerFirst(t.metric.short)).join(', ')}.
              </>
            )}
          </span>
        </p>
      )}
    </div>
  )
}

function Robustness({ r }: { r: Rotation }) {
  const tests = [
    { label: 'Legume-effect test', tip: TIP.robustLegume, range: r.scores?.rank_range },
    { label: 'Rainfall test, 30% lower and higher', tip: TIP.robustRain, range: r.scores?.rank_range_rain },
  ]
  const pareto = r.scores?.pareto
  return (
    <dl className="grid gap-x-6 gap-y-3 text-[0.8125rem] sm:grid-cols-3 print:grid-cols-3">
      {tests.map((t) => {
        const spread = rankSpread(t.range)
        return (
          <div key={t.label} className="min-w-0 break-inside-avoid">
            <dt className="flex items-center gap-1 font-bold text-muted">
              {t.label}
              <InfoTip label={t.label}>{t.tip}</InfoTip>
            </dt>
            <dd className="mt-0.5 leading-snug text-ink">
              {t.range && spread ? (
                <>
                  <span className="font-display text-[1rem] font-semibold text-forest-950 tabular-nums">{rangeText(t.range)}</span>{' '}
                  <span className="font-bold text-forest-950">· {spread.label}.</span> {spread.explain}
                </>
              ) : (
                <span className="font-semibold">Not available for this rotation.</span>
              )}
            </dd>
          </div>
        )
      })}
      <div className="min-w-0 break-inside-avoid">
        <dt className="flex items-center gap-1 font-bold text-muted">
          Pareto mark
          <InfoTip label="Pareto efficient">{TIP.pareto}</InfoTip>
        </dt>
        <dd className="mt-0.5 leading-snug text-ink">
          {pareto === true ? (
            <>
              <span className="font-bold text-forest-950">Pareto efficient.</span> No other rotation shown is at least as good on every scaled indicator and better on one.
            </>
          ) : pareto === false ? (
            <>
              <span className="font-bold text-forest-950">Not Pareto efficient.</span> Another rotation shown is at least as good on every scaled indicator and better on one.
            </>
          ) : (
            <span className="font-semibold">Not reported by the engine.</span>
          )}
        </dd>
      </div>
    </dl>
  )
}

function LeadCard({ r, d }: { r: Rotation; d: BriefData }) {
  const { cur, names, total, irrigated } = d
  const ex = r.explanation
  const stability = cur ? stabilitySentence(r, cur) : null
  // When the stability sentence has already compared the P10 index and the failures, the second sentence names another gain.
  const others = METRICS.map((m) => m.id).filter((id) => (irrigated || id !== 'irrigation') && (!stability || (id !== 'p10' && id !== 'failure')))
  const sentences = cur ? [stability, tradeoffSentence(r, cur, others)].filter((s): s is string => !!s) : []
  const label = 'text-[0.75rem] font-extrabold tracking-[0.06em] text-muted uppercase break-after-avoid'
  return (
    <article className="rounded-[1.25rem] p-4 ring-1 ring-border sm:p-5 print:rounded-none print:border-t print:border-sand-400 print:px-0 print:pt-4 print:pb-0 print:ring-0">
      {/* The rank, name and crop sequence stay together and with the first lines below them on paper. */}
      <div className="break-inside-avoid break-after-avoid">
        <header className="flex flex-wrap items-start gap-x-3.5 gap-y-2">
          <span className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-950 px-2 font-display text-[1.125rem] font-semibold text-lime tabular-nums">
            #{r.scores?.rank ?? '—'}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[1.1875rem] leading-snug">{rotationLabel(r)}</h3>
            <p className="mt-0.5 text-[0.8125rem] font-bold text-ink tabular-nums">
              Rank #{r.scores?.rank ?? '—'} of {total} in this analysis · {r.cycle_years}-year cycle
            </p>
          </div>
          <RotationBadges r={r} compact />
        </header>
        <div className="mt-3">
          <CropSequence r={r} names={names} />
        </div>
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2 print:grid-cols-2">
        <div className="min-w-0">
          <p className={label}>Main reasons for this rank · from the engine</p>
          <div className="mt-2">
            <Bullets items={ex?.reasons ?? []} empty="The engine returned no reasons for this rotation." />
          </div>
        </div>
        <div className="min-w-0">
          <p className={label}>Potential benefits · from the engine</p>
          <div className="mt-2">
            <Bullets items={ex?.benefits ?? []} empty="The engine listed no specific benefit for this rotation." />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className={label}>Trade-offs against your current rotation</p>
        {cur ? (
          <div className="mt-2">
            {sentences.length > 0 && <p className="mb-3 text-[0.9375rem] leading-relaxed text-ink">{sentences.join(' ')}</p>}
            <TradeoffGroups alt={r} cur={cur} irrigated={irrigated} />
          </div>
        ) : (
          <p className="mt-2 text-[0.9375rem] text-ink">No current rotation is marked in this analysis, so there is nothing to compare against.</p>
        )}
      </div>

      <div className="mt-5">
        <p className={label}>How firm is this rank?</p>
        <div className="mt-2">
          <Robustness r={r} />
        </div>
      </div>
    </article>
  )
}

// On a narrow screen the indicator names stay in view while the rotations scroll sideways.
const STICKY = 'max-md:sticky max-md:left-0 max-md:z-[1] max-md:shadow-[inset_-1px_-1px_0_var(--color-border)] print:static print:shadow-none'

function ComparisonTable({ d }: { d: BriefData }) {
  const { cur, alts, total, irrigated, thr } = d
  const cols = [...(cur ? [cur] : []), ...alts]
  const byMetric = new Map(alts.map((r) => [r.id, cur ? new Map(tradeoffs(r, cur).map((t) => [t.metric.id, t])) : null]))
  const varies = !!cur && indexVaries(cur) && isNum(cur.hindcast.worst_years?.mean_index)
  const metricTip: Record<string, string> = { median: `${TIP.median} ${TIP.index}`, p10: TIP.p10, failure: TIP.failure(thr), water: TIP.water, irrigation: TIP.irrigation, cover: TIP.cover, legume: TIP.legume, forage: TIP.forage, erosion: TIP.erosion }
  const rows: { label: string; tip?: string; cell: (r: Rotation) => ReactNode; sub?: (r: Rotation) => string | null }[] = [
    { label: 'Rank in this analysis', tip: TIP.rank, cell: (r) => (r.scores?.rank ? `#${r.scores.rank} of ${total}` : '—') },
    ...METRICS.filter((m) => irrigated || m.id !== 'irrigation').map((m) => ({
      label: m.id === 'water' ? 'Modelled crop water demand, a year' : m.id === 'irrigation' ? 'Irrigation requirement, a year' : m.label,
      tip: metricTip[m.id] ?? m.context,
      cell: (r: Rotation) => fmtMetric(m, m.get(r)),
      sub: (r: Rotation) => {
        if (r.is_current) return m.id === 'failure' ? (seasonsFailed(r) ? `${seasonsFailed(r)!.failed} of ${seasonsFailed(r)!.total} seasons` : null) : null
        const t = byMetric.get(r.id)?.get(m.id)
        if (!t || t.verdict === 'unknown') return null
        return t.verdict === 'similar' ? 'about the same' : `${fmtMetricDelta(m, t.delta)} vs current`
      },
    })),
    ...(varies ? [{ label: 'Mean index in the current rotation’s five lowest years', tip: TIP.worst, cell: (r: Rotation) => fmtIndex(r.hindcast.worst_years?.mean_index) }] : []),
    { label: 'Rank range: legume-effect test', tip: TIP.robustLegume, cell: (r) => rangeText(r.scores?.rank_range) },
    { label: 'Rank range: rainfall test', tip: TIP.robustRain, cell: (r) => rangeText(r.scores?.rank_range_rain) },
    { label: 'Pareto efficient', tip: TIP.pareto, cell: (r) => (r.scores?.pareto === undefined ? '—' : r.scores.pareto ? 'Yes' : 'No') },
  ]
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[0.75rem] font-bold text-ink md:hidden print:hidden">Scroll the table sideways to see every rotation.</p>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-border print:overflow-visible print:rounded-none print:ring-0">
        <table className="w-full min-w-[42rem] table-fixed border-collapse text-left text-[0.8125rem] print:min-w-0">
          <caption className="sr-only">The current rotation and the leading alternatives, indicator by indicator</caption>
          <thead>
            <tr>
              <th scope="col" className={cx('w-[27%] border-b border-border-strong bg-cream px-3 py-3 align-bottom text-[0.75rem] font-bold text-ink', STICKY)}>
                Indicator
              </th>
              {cols.map((r) => (
                <th key={r.id} scope="col" className={cx('border-b border-border-strong px-3 py-3 align-bottom leading-snug font-bold text-forest-950', r.is_current ? 'bg-peri-50' : 'bg-cream')}>
                  <span className="block text-[0.75rem] font-extrabold text-ink tabular-nums">
                    #{r.scores?.rank ?? '—'}
                    {r.is_current ? ' · Current rotation' : ''}
                  </span>
                  {rotationLabel(r)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="break-inside-avoid border-b border-border last:border-b-0">
                <th scope="row" className={cx('bg-white px-3 py-2.5 align-top font-bold text-ink', STICKY)}>
                  <span className="inline-flex items-center gap-1">
                    {row.label}
                    {row.tip && <InfoTip label={row.label}>{row.tip}</InfoTip>}
                  </span>
                </th>
                {cols.map((r) => {
                  const sub = row.sub?.(r)
                  return (
                    <td key={r.id} className={cx('px-3 py-2.5 align-top', r.is_current && 'bg-peri-50/60')}>
                      <span className="font-display text-[0.9375rem] font-semibold text-forest-950 tabular-nums">{row.cell(r)}</span>
                      {sub && <span className="block text-[0.75rem] font-bold text-ink tabular-nums">{sub}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-[0.8125rem] leading-snug text-muted">
        Differences are against the current rotation: index values in index units, shares in percentage points, water in millimetres a year. Indicators are proxies: legume share
        indicates potential nitrogen contribution, and heavy rain on bare soil is an exposure indicator, not a measured loss.
      </p>
    </div>
  )
}

export function LeadingAlternatives({ d }: { d: BriefData }) {
  const { cur, alts, total, curIsTop, thr, ranked } = d
  const others = ranked.filter((r) => !r.is_current).length
  const mentionsNitrogen = alts.some((r) => [...(r.explanation?.benefits ?? []), ...(r.explanation?.reasons ?? [])].some((t) => /nitrogen/i.test(t)))
  const shown = [...(cur ? [cur] : []), ...alts]
  const p10 = METRIC_BY_ID.p10
  const withP10 = shown.filter((r) => isNum(r.hindcast.p10))
  const best = withP10.reduce<Rotation | null>((m, r) => (!m || (r.hindcast.p10 as number) > (m.hindcast.p10 as number) ? r : m), null)
  const spread = withP10.length ? Math.max(...withP10.map((r) => r.hindcast.p10 as number)) - Math.min(...withP10.map((r) => r.hindcast.p10 as number)) : 0
  const rangeNote =
    withP10.length < 2 || !best
      ? 'The ring marks the index in weaker years (about 1 year in 10 was lower) and the dot marks a typical year.'
      : spread < p10.similar
        ? `The lower-decile index is about the same across these rotations (within ${p10.similar.toFixed(2)} of each other).`
        : `Of the rotations shown, ${rotationLabel(best)}${best.is_current ? ' (the current rotation)' : ''} has the highest lower-decile index (${fmtIndex(best.hindcast.p10)})${
            cur && best !== cur && isNum(cur.hindcast.p10) ? `, against ${fmtIndex(cur.hindcast.p10)} for the current rotation` : ''
          }. The lower-decile index is the measure the stability priority uses.`

  return (
    <Section
      n={4}
      title="Leading alternatives"
      lead={
        alts.length
          ? `The ${alts.length === 1 ? 'alternative' : `${alts.length} alternatives`} that ranked highest among the ${others} the engine returned, under the priorities in section 1. A rank compares these ${total} rotations with each other. It is not a probability of success.`
          : undefined
      }
    >
      {alts.length === 0 ? (
        <Callout tone="plain" title="No alternative rotations were returned">
          The engine returned no alternative rotation for this field and these settings, so there is nothing to compare the current rotation with. HindSight does not invent
          strategies to fill the list. Widening the crop choice or the maximum cycle length in Farm Analysis may return alternatives.
        </Callout>
      ) : (
        <>
          {curIsTop && cur ? (
            <Callout tone="info" title="Your current rotation is the highest-ranked option in this analysis">
              {rotationLabel(cur)} ranks #1 of {total} under your priorities. The alternatives below ranked lower. They are shown so you can see what each would trade, not as
              suggestions to change.
            </Callout>
          ) : (
            cur && (
              <p className="text-[0.9375rem] leading-relaxed text-ink">
                <strong className="font-extrabold text-forest-950">
                  {rotationLabel(alts[0])} is the highest-ranked alternative in this analysis (rank #{alts[0].scores?.rank ?? '—'} of {total}).
                </strong>{' '}
                Your current rotation, {rotationLabel(cur)}, ranks #{cur.scores?.rank ?? '—'}. A higher rank means a better weighted score under your priorities among these
                rotations. It does not guarantee a better result on your field.
              </p>
            )
          )}

          {cur && !indexVaries(cur) && (
            <Callout tone="plain" className="break-inside-avoid">
              The yearly index of your current rotation did not vary in this simulation. The “worst years” the engine names in its reasons below are therefore tied years, not
              years that stood out as bad.
            </Callout>
          )}

          <div className="space-y-4 print:space-y-5">
            {alts.map((r) => (
              <LeadCard key={r.id} r={r} d={d} />
            ))}
          </div>

          <Sub title="Side by side">
            <div className="space-y-6">
              <div className="break-inside-avoid">
                <IndexRange rotations={shown} threshold={thr} total={total} note={rangeNote} />
              </div>
              <ComparisonTable d={d} />
            </div>
          </Sub>

          <p className="text-[0.8125rem] leading-snug text-muted">
            “In the direction the ranking rewards” describes how the ranking treats a difference under your priorities. It is not a verdict that a rotation is better: a rotation
            that grows more, for example, usually has a higher water demand. Pareto efficient means no other rotation shown is at least as good on every scaled indicator and
            strictly better on one. It is not automatically the best choice for every farm.
            {mentionsNitrogen &&
              ' The engine’s sentences are shown unchanged. Where one mentions nitrogen, read it as a potential nitrogen contribution: the model counts legumes in the rotation and does not measure a nitrogen balance.'}
          </p>
        </>
      )}
    </Section>
  )
}
