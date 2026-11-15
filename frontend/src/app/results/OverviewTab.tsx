import { ArrowRight, CheckCircle2, ListChecks, Sparkles } from 'lucide-react'
import { InfoTip } from '../../components/ui/InfoTip'
import { Mascot } from '../../components/ui/Mascot'
import { currentRotation, failureThreshold, indexVaries, isIrrigated, rotationLabel, seasonsFailed, topAlternative } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord, fmtIndex, fmtMm, fmtNum, fmtPct, isNum, yearList } from '../../lib/format'
import type { AnalysisEnvelope, Rotation } from '../../lib/types'
import { Callout } from '../components/controls'
import { SOIL_SOURCES, textureLabel, waterLabel } from '../lib/labels'
import { Panel, RotationBadges, TIP } from './shared'

function Row({ label, tip, a, b, better }: { label: string; tip: string; a: string; b: string | null; better?: 'a' | 'b' | null }) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-2.5 pr-3 text-left text-[0.875rem] font-bold text-ink">
        <span className="inline-flex items-center gap-1">
          {label} <InfoTip label={label}>{tip}</InfoTip>
        </span>
      </th>
      <td className={cx('px-3 py-2.5 text-right font-display text-[1.0625rem] font-semibold tabular-nums', better === 'a' ? 'text-forest-950' : 'text-ink')}>{a}</td>
      {b !== null && (
        <td className={cx('rounded-r-lg bg-lime-100/60 px-3 py-2.5 text-right font-display text-[1.0625rem] font-semibold tabular-nums', better === 'b' ? 'text-forest-950' : 'text-ink')}>
          {b}
        </td>
      )}
    </tr>
  )
}

export function OverviewTab({ env, onOpenTab, onInspect }: { env: AnalysisEnvelope; onOpenTab: (tab: string) => void; onInspect: (id: string) => void }) {
  const res = env.result
  const cur = currentRotation(res)
  const alt = topAlternative(res)
  const thr = failureThreshold(env)
  const irrigated = isIrrigated(env)
  const req = env.request
  const soil = res.site.soil_used
  const climate = res.site.climate_summary
  if (!cur) return <Callout tone="warn">The engine returned no rotations for this analysis.</Callout>

  const fail = (r: Rotation) => {
    const f = seasonsFailed(r)
    return `${fmtPct(r.hindcast.failure_freq, 1)}${f ? ` (${f.failed} of ${f.total})` : ''}`
  }
  const altBetterRank = !!alt && (alt.scores?.rank ?? 99) < (cur.scores?.rank ?? 99)
  const ex = (altBetterRank ? alt : cur)?.explanation
  const focus = altBetterRank && alt ? alt : cur
  const worst = cur.hindcast.worst_years
  const showWorst = indexVaries(cur) && !!worst?.years?.length && isNum(worst.mean_index) && isNum(alt?.hindcast.worst_years?.mean_index)

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Panel title="Farm context">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5 text-[0.9375rem]">
            <div className="col-span-2">
              <dt className="text-[0.75rem] font-bold text-muted">Location</dt>
              <dd className="font-extrabold text-forest-950">{res.site.name}</dd>
              <dd className="text-[0.875rem] text-ink tabular-nums">{fmtCoord(res.site.lat, res.site.lon)}</dd>
            </div>
            <div>
              <dt className="text-[0.75rem] font-bold text-muted">Soil texture</dt>
              <dd className="font-extrabold text-forest-950">{textureLabel(soil?.texture_class)}</dd>
            </div>
            <div>
              <dt className="text-[0.75rem] font-bold text-muted">Soil source</dt>
              <dd className="font-bold text-ink">{SOIL_SOURCES[soil?.source ?? ''] ?? soil?.source ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-[0.75rem] font-bold text-muted">Water mode</dt>
              <dd className="font-extrabold text-forest-950">{waterLabel(req?.water?.mode, req?.water?.seasonal_cap_mm)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[0.75rem] font-bold text-muted">
                Available water capacity
                <InfoTip label="Available water capacity">
                  An estimate of how much water the soil can hold between field capacity and wilting point. A model estimate, not a laboratory measurement.
                </InfoTip>
              </dt>
              <dd className="font-bold text-ink tabular-nums">{isNum(soil?.available_water_mm_per_m) ? `${fmtNum(soil?.available_water_mm_per_m, 0)} mm per metre` : '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[0.75rem] font-bold text-muted">Historical weather</dt>
              <dd className="font-bold text-ink">
                NASA POWER daily record, {env.inputs?.climate?.start?.slice(0, 4) ?? res.meta.record.start_year - 1}–{env.inputs?.climate?.end?.slice(0, 4) ?? res.meta.record.end_year}. Results cover{' '}
                {res.meta.record.start_year}–{res.meta.record.end_year}; the first year only warms up the soil water.
              </dd>
            </div>
            {climate && (
              <div className="col-span-2 flex flex-wrap gap-1.5 pt-0.5">
                {[
                  ['Rain', `${fmtMm(climate.annual_rain_mm)} / yr`],
                  ['Reference ET₀', `${fmtMm(climate.annual_et0_mm)} / yr`],
                  ['Mean temperature', `${fmtNum(climate.mean_temp_c, 1)} °C`],
                ].map(([k, v]) => (
                  <span key={k} className="rounded-full bg-sand px-3 py-1.5 text-[0.8125rem] font-bold text-ink">
                    {k} <span className="font-extrabold text-forest-950 tabular-nums">{v}</span>
                  </span>
                ))}
              </div>
            )}
          </dl>
        </Panel>

        <Panel title="Main indicators">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] border-separate border-spacing-0">
              <thead>
                <tr className="text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
                  <th scope="col" className="pb-2 text-left">
                    <span className="sr-only">Indicator</span>
                  </th>
                  <th scope="col" className="max-w-[11rem] px-3 pb-2 text-right align-bottom">
                    Your current rotation
                    <span className="mt-0.5 block text-[0.8125rem] leading-tight font-bold tracking-normal text-forest-950 normal-case">{rotationLabel(cur)}</span>
                  </th>
                  {alt && (
                    <th scope="col" className="max-w-[11rem] rounded-t-lg bg-lime-100/60 px-3 pt-2 pb-2 text-right align-bottom">
                      Highest-ranked alternative
                      <span className="mt-0.5 block text-[0.8125rem] leading-tight font-bold tracking-normal text-forest-950 normal-case">{rotationLabel(alt)}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                <Row label="Median season index" tip={`${TIP.median} ${TIP.index}`} a={fmtIndex(cur.hindcast.median)} b={alt ? fmtIndex(alt.hindcast.median) : null} />
                <Row label="Lower-decile season index" tip={TIP.p10} a={fmtIndex(cur.hindcast.p10)} b={alt ? fmtIndex(alt.hindcast.p10) : null} />
                <Row label="Failure frequency" tip={TIP.failure(thr)} a={fail(cur)} b={alt ? fail(alt) : null} />
                <Row label="Crop water demand" tip={TIP.water} a={`${fmtMm(cur.hindcast.water_demand_mm_per_year)} / yr`} b={alt ? `${fmtMm(alt.hindcast.water_demand_mm_per_year)} / yr` : null} />
                <Row
                  label="Irrigation requirement"
                  tip={TIP.irrigation}
                  a={irrigated ? `${fmtMm(cur.hindcast.irrigation_mm_per_year)} / yr` : 'None (rainfed)'}
                  b={alt ? (irrigated ? `${fmtMm(alt.hindcast.irrigation_mm_per_year)} / yr` : 'None (rainfed)') : null}
                />
                <Row label="Soil cover" tip={TIP.cover} a={fmtPct(cur.indicators.cover_frac, 1)} b={alt ? fmtPct(alt.indicators.cover_frac, 1) : null} />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
            The season index is not crop yield. Rank #{cur.scores?.rank} of {res.rotations.length} for your current rotation
            {alt ? `, rank #${alt.scores?.rank} for the alternative` : ''}, by your priorities.
          </p>
        </Panel>
      </div>

      <Panel>
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-start gap-3 lg:w-56 lg:flex-col">
            <Mascot name="blue" decorative className="w-20 shrink-0 lg:w-28" sizes="112px" />
            <div>
              <p className="flex items-center gap-1.5 text-[0.8125rem] font-extrabold text-forest-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Analysis complete
              </p>
              <p className="mt-1 text-[0.8125rem] leading-snug text-muted">
                {res.rotations.length} rotations compared over {res.meta.record.end_year - res.meta.record.start_year + 1} simulated years.
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[0.75rem] font-extrabold tracking-[0.08em] text-muted uppercase">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> What the analysis found
            </p>
            <h3 className="mt-1.5 text-[1.5rem] leading-tight tracking-[-0.02em]">
              {altBetterRank && alt
                ? `“${rotationLabel(alt)}” ranks highest for your priorities.`
                : alt
                  ? 'Your current rotation ranks highest of those compared.'
                  : 'Only your current rotation could be evaluated.'}
            </h3>
            <div className="mt-2">
              <RotationBadges r={focus} />
            </div>
            {ex?.summary && <p className="mt-3 text-[1rem] leading-relaxed font-semibold text-forest-950">{ex.summary}</p>}

            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="font-sans text-[0.8125rem] font-extrabold text-forest-950">Why it ranks where it does</h4>
                <ul className="mt-2 space-y-1.5 text-[0.875rem] leading-snug text-ink">
                  {(ex?.reasons ?? []).filter((t) => !/failure line in/.test(t)).slice(0, 4).map((t) => (
                    <li key={t} className="flex gap-2">
                      <span aria-hidden="true" className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />
                      {t}
                    </li>
                  ))}
                </ul>
                {showWorst && alt && worst && (
                  <p className="mt-3 rounded-xl bg-sand/70 p-3 text-[0.875rem] leading-snug text-ink">
                    <strong className="font-extrabold text-forest-950">In your weakest years</strong> ({yearList(worst.years)}), your current rotation
                    averaged an index of <strong className="font-extrabold tabular-nums">{fmtIndex(worst.mean_index)}</strong>; the alternative would have
                    averaged <strong className="font-extrabold tabular-nums">{fmtIndex(alt.hindcast.worst_years?.mean_index)}</strong>.
                  </p>
                )}
              </div>
              <div>
                {(ex?.benefits ?? []).length > 0 && (
                  <>
                    <h4 className="font-sans text-[0.8125rem] font-extrabold text-forest-950">What it offers</h4>
                    <ul className="mt-2 space-y-1.5 text-[0.875rem] leading-snug text-ink">
                      {ex!.benefits!.map((t) => (
                        <li key={t} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-800" aria-hidden="true" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {(ex?.local_review ?? []).length > 0 && (
                  <>
                    <h4 className="mt-4 flex items-center gap-1.5 font-sans text-[0.8125rem] font-extrabold text-forest-950">
                      <ListChecks className="h-4 w-4" aria-hidden="true" /> Check locally before acting
                    </h4>
                    <ul className="mt-2 space-y-1.5 text-[0.875rem] leading-snug text-ink">
                      {ex!.local_review!.map((t) => (
                        <li key={t} className="flex gap-2">
                          <span aria-hidden="true" className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => onOpenTab('compare')} className="inline-flex items-center gap-1.5 rounded-full bg-forest-950 px-4 py-2 text-[0.875rem] font-bold text-cream-50 transition-colors hover:bg-forest-900">
                Compare all rotations <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onInspect(focus.id)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.875rem] font-bold text-forest-950 ring-1 ring-border-strong transition-colors hover:bg-sand/70">
                Inspect this rotation
              </button>
              <button type="button" onClick={() => onOpenTab('evidence')} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.875rem] font-bold text-forest-950 ring-1 ring-border-strong transition-colors hover:bg-sand/70">
                See the full reasoning
              </button>
            </div>
            <p className="mt-3 text-[0.75rem] text-muted">Text above is produced by the engine from its own numbers with fixed templates.</p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
