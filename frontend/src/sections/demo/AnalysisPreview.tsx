import {
  AlertTriangle,
  BadgeCheck,
  CloudRain,
  Database,
  Download,
  ListChecks,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Sun,
  Thermometer,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useState, type ReactNode, type Ref } from 'react'
import { IndexLines } from '../../components/charts/IndexLines'
import { Button } from '../../components/ui/Button'
import { InfoTip } from '../../components/ui/InfoTip'
import { Mascot } from '../../components/ui/Mascot'
import {
  currentRotation,
  failureThreshold,
  indexVaries,
  isIrrigated,
  isRobust,
  rankedRotations,
  rotationLabel,
  seasonsFailed,
  topAlternative,
} from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord, fmtElapsed, fmtIndex, fmtMm, fmtNum, fmtP, fmtPct, fmtTime } from '../../lib/format'
import type { AnalysisEnvelope, AnalysisResult, NdviCheck, Preset, Rotation } from '../../lib/types'
import type { AnalysisState } from './types'

/* ---------------------------------------------------------------- glossary */

const TIP = {
  index:
    'A 0–1 score of how well a season’s water and temperature needs were met (FAO-33 water–production function with EcoCrop temperature ranges). A legume before the crop can lift it slightly above 1. It is not a yield in tonnes per hectare.',
  badYear:
    'The season index in a typical bad year: the 10th percentile of the 40 yearly values, so 4 years in 40 were worse. Higher is more stable.',
  failure: (t: number | null) =>
    `A crop season counts as failed when its index falls below ${t ?? 'the failure threshold'} (the engine default, adjustable).`,
  water: 'Water the crops would use over the year (crop evapotranspiration on crop days), modeled from daily weather. In rainfed fields this is demand, not irrigation applied.',
  irrigation: 'Modeled irrigation needed to refill the root zone whenever the crop starts to stress.',
  worst: 'The average season index in the five years that were worst for your current rotation. It shows how each option would have held up when it mattered most.',
  rank: 'Rankings compare only the rotations evaluated here, weighted by the priorities. They are not probabilities of success.',
  robust:
    'The rank does not move when the uncertain legume effect is set to 0%, 7%, 20% or 32%, or when NASA rainfall is 30% lower or higher.',
}

/* ---------------------------------------------------------------- helpers */

function downloadJson(env: AnalysisEnvelope, id: string) {
  const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hindsight-${id}-${env.source}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function Metric({ label, tip, value, sub }: { label: string; tip?: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[0.75rem] font-bold text-ink">
        {label}
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </dt>
      <dd className="mt-1 font-display text-[1.375rem] leading-none font-semibold text-forest-950 tabular-nums">
        {value}
        {sub && <span className="font-sans text-[0.75rem] font-bold text-ink"> {sub}</span>}
      </dd>
    </div>
  )
}

function rangeText(range: [number, number] | null | undefined) {
  if (!range) return null
  return range[0] === range[1] ? `#${range[0]}` : `#${range[0]}–#${range[1]}`
}

function RobustBadge({ r }: { r: Rotation }) {
  if (isRobust(r)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2.5 py-1 text-[0.75rem] font-extrabold text-forest-800 ring-1 ring-forest-950/10">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Robust
        <InfoTip label="Robust ranking">{TIP.robust}</InfoTip>
      </span>
    )
  }
  const legume = rangeText(r.scores.rank_range)
  const rain = rangeText(r.scores.rank_range_rain)
  if (!legume && !rain) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] font-bold text-ink">
      {legume && <span>Legume effect 0–32%: {legume}</span>}
      {rain && <span>Rain ±30%: {rain}</span>}
    </span>
  )
}

/* ---------------------------------------------------------------- blocks */

function SourceBanner({ env, onRetry }: { env: AnalysisEnvelope; onRetry: () => void }) {
  if (env.source === 'live') {
    const at = fmtTime(env.computed_at)
    const took = fmtElapsed(env.elapsed_ms)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-lime-100 px-4 py-3 text-[0.8125rem] font-bold text-forest-950 ring-1 ring-forest-950/10">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-forest-800" aria-hidden="true" /> Live analysis
        </span>
        <span className="font-semibold text-ink">
          Computed by engine v{env.engine_version}
          {at ? ` at ${at}` : ''}
          {took ? ` in ${took}` : ''} from cached NASA POWER daily weather
          {env.inputs?.climate?.start && env.inputs.climate.end ? ` (${env.inputs.climate.start} to ${env.inputs.climate.end})` : ''}.
        </span>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-peri-50 px-4 py-3 text-[0.8125rem] text-forest-950 ring-1 ring-peri">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 font-semibold">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-peri-ink" aria-hidden="true" />
          <span>
            <strong className="font-extrabold">Saved demonstration result.</strong> {env.notice}
          </span>
        </p>
        <Button variant="secondary" size="md" icon={<RefreshCw />} onClick={onRetry}>
          Try a live run again
        </Button>
      </div>
      {env.fallback_reason && (
        <p className="mt-2 pl-6 text-[0.8125rem] font-semibold text-signal-ink">The live engine could not run: {env.fallback_reason}</p>
      )}
    </div>
  )
}

function ClimateStrip({ res }: { res: AnalysisResult }) {
  const c = res.site.climate_summary
  if (!c) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[
        { icon: CloudRain, label: 'Rain', value: `${fmtMm(c.annual_rain_mm)} / yr` },
        { icon: Sun, label: 'Reference ET₀', value: `${fmtMm(c.annual_et0_mm)} / yr` },
        { icon: Thermometer, label: 'Mean temperature', value: `${fmtNum(c.mean_temp_c, 1)} °C` },
      ].map((m) => (
        <span key={m.label} className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-[0.8125rem] font-bold text-ink">
          <m.icon className="h-3.5 w-3.5 text-forest-800" aria-hidden="true" />
          {m.label} <span className="font-extrabold text-forest-950 tabular-nums">{m.value}</span>
        </span>
      ))}
      <span className="text-[0.75rem] font-semibold text-muted">
        NASA POWER grid-cell averages (about 50 km), {res.meta.record.start_year}–{res.meta.record.end_year}
      </span>
    </div>
  )
}

function RotationSummary({
  r,
  tag,
  n,
  irrigated,
  threshold,
  tone,
}: {
  r: Rotation
  tag: string
  n: number
  irrigated: boolean
  threshold: number | null
  tone: 'current' | 'best'
}) {
  const f = seasonsFailed(r)
  return (
    <div className={cx('rounded-[1.25rem] p-4 sm:p-5', tone === 'best' ? 'bg-lime-100 ring-1 ring-forest-950/10' : 'bg-sand')}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-ink uppercase">{tag}</span>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[0.75rem] font-extrabold whitespace-nowrap text-forest-950 tabular-nums">
          Rank #{r.scores.rank} of {n}
        </span>
      </div>
      <h4 className="mt-2 text-[1.1875rem] leading-snug">{rotationLabel(r)}</h4>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <Metric label="Bad-year index" tip={TIP.badYear} value={fmtIndex(r.indicators.stability)} />
        <Metric
          label="Seasons below line"
          tip={TIP.failure(threshold)}
          value={f ? `${f.failed} of ${f.total}` : fmtPct(r.hindcast.failure_freq)}
          sub={f ? `(${fmtPct(f.failed / f.total)})` : undefined}
        />
        <Metric label="Crop water demand" tip={TIP.water} value={fmtMm(r.hindcast.water_demand_mm_per_year)} sub="/ yr" />
        {irrigated ? (
          <Metric label="Irrigation" tip={TIP.irrigation} value={fmtMm(r.hindcast.irrigation_mm_per_year)} sub="/ yr" />
        ) : (
          <Metric label="Worst-years index" tip={TIP.worst} value={fmtIndex(r.hindcast.worst_years?.mean_index)} />
        )}
      </dl>
      <div className="mt-4">
        <RobustBadge r={r} />
      </div>
    </div>
  )
}

function RankedList({ res, irrigated }: { res: AnalysisResult; irrigated: boolean }) {
  const rows = rankedRotations(res)
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[1.25rem]">All {rows.length} rotations compared</h4>
        <p className="flex items-center gap-1 text-[0.8125rem] font-semibold text-muted">
          Relative ranking, not probability of success <InfoTip label="Ranking" align="end">{TIP.rank}</InfoTip>
        </p>
      </div>

      {/* Table on wider screens */}
      <div className="mt-4 hidden rounded-2xl ring-1 ring-border md:block">
        <table className="w-full border-separate border-spacing-0 text-left text-[0.875rem] [&_tbody_td]:border-t [&_tbody_td]:border-border [&_tbody_tr:last-child_td:first-child]:rounded-bl-2xl [&_tbody_tr:last-child_td:last-child]:rounded-br-2xl [&_thead_th:first-child]:rounded-tl-2xl [&_thead_th:last-child]:rounded-tr-2xl">
          <thead className="text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase [&_th]:bg-sand/70">
            <tr>
              <th scope="col" className="px-4 py-3">Rank</th>
              <th scope="col" className="px-4 py-3">Rotation</th>
              <th scope="col" className="px-4 py-3 text-right">Bad-year index</th>
              <th scope="col" className="px-4 py-3 text-right">Seasons below line</th>
              <th scope="col" className="px-4 py-3 text-right">Water demand</th>
              {irrigated && <th scope="col" className="px-4 py-3 text-right">Irrigation</th>}
              <th scope="col" className="px-4 py-3">Rank stability</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const f = seasonsFailed(r)
              return (
                <tr key={r.id} className={cx(r.is_current && '[&_td]:bg-peri-50/60')}>
                  <td className="px-4 py-3 font-display text-base font-semibold text-forest-950 tabular-nums">#{r.scores.rank}</td>
                  <td className="px-4 py-3 font-bold text-forest-950">
                    {rotationLabel(r)}
                    {r.is_current && (
                      <span className="ml-2 rounded-full bg-peri px-2 py-0.5 text-[0.6875rem] font-extrabold tracking-wide text-forest-950 uppercase">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-ink tabular-nums">{fmtIndex(r.indicators.stability)}</td>
                  <td className="px-4 py-3 text-right font-bold text-ink tabular-nums">{f ? `${f.failed} / ${f.total}` : fmtPct(r.hindcast.failure_freq)}</td>
                  <td className="px-4 py-3 text-right font-bold text-ink tabular-nums">{fmtMm(r.hindcast.water_demand_mm_per_year)}</td>
                  {irrigated && <td className="px-4 py-3 text-right font-bold text-ink tabular-nums">{fmtMm(r.hindcast.irrigation_mm_per_year)}</td>}
                  <td className="px-4 py-3">
                    <RobustBadge r={r} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Cards on narrow screens */}
      <ol className="mt-4 space-y-2.5 md:hidden">
        {rows.map((r) => {
          const f = seasonsFailed(r)
          return (
            <li key={r.id} className={cx('rounded-2xl p-4 ring-1 ring-border', r.is_current ? 'bg-peri-50/70' : 'bg-white')}>
              <div className="flex items-start gap-3">
                <span className="font-display text-xl leading-none font-semibold text-forest-950 tabular-nums">#{r.scores.rank}</span>
                <div className="min-w-0">
                  <p className="font-bold leading-snug text-forest-950">
                    {rotationLabel(r)}
                    {r.is_current && (
                      <span className="ml-2 rounded-full bg-peri px-2 py-0.5 text-[0.6875rem] font-extrabold tracking-wide uppercase">Current</span>
                    )}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.8125rem] text-ink">
                    <dt className="font-semibold">Bad-year index</dt>
                    <dd className="text-right font-extrabold tabular-nums">{fmtIndex(r.indicators.stability)}</dd>
                    <dt className="font-semibold">Seasons below line</dt>
                    <dd className="text-right font-extrabold tabular-nums">{f ? `${f.failed} / ${f.total}` : fmtPct(r.hindcast.failure_freq)}</dd>
                    <dt className="font-semibold">Water demand</dt>
                    <dd className="text-right font-extrabold tabular-nums">{fmtMm(r.hindcast.water_demand_mm_per_year)}</dd>
                    {irrigated && (
                      <>
                        <dt className="font-semibold">Irrigation</dt>
                        <dd className="text-right font-extrabold tabular-nums">{fmtMm(r.hindcast.irrigation_mm_per_year)}</dd>
                      </>
                    )}
                  </dl>
                  <div className="mt-2.5">
                    <RobustBadge r={r} />
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function NdviBlock({ check, used }: { check: NdviCheck | null | undefined; used: boolean | undefined }) {
  return (
    <div className="rounded-[1.25rem] bg-white p-5 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <Satellite className="h-5 w-5 text-peri-ink" aria-hidden="true" />
        <h4 className="text-[1.125rem]">Independent satellite check</h4>
        <InfoTip label="MODIS NDVI check">
          NDVI measures how green the vegetation is, seen from the MODIS satellite. The engine correlates peak greenness
          in crop months with the current rotation’s yearly index. It is a check, not a calibration, and not a yield measurement.
        </InfoTip>
      </div>
      {check ? (
        <>
          <p className="mt-3 font-display text-[1.75rem] leading-none font-semibold text-forest-950 tabular-nums">
            r = {fmtNum(check.r, 2)}
            <span className="ml-2 font-sans text-[0.875rem] font-bold text-ink">
              over {check.n_years} years · {fmtP(check.p_value)}
            </span>
          </p>
          <p className="mt-2 text-[0.8125rem] leading-snug text-ink">
            Pearson correlation: +1 would mean satellite greenness and the modeled index rise and fall together every
            year; 0 means no relationship.
          </p>
          {check.note && <p className="mt-2 text-[0.8125rem] leading-snug text-muted">{check.note}</p>}
        </>
      ) : (
        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink">
          No satellite check for this run.{' '}
          {used === false
            ? 'There is no cached MODIS series for this location, so the optional check was skipped.'
            : 'The engine reports it only when the season index varies from year to year and enough years overlap. Under full irrigation the index stays near 1.0, so a correlation is undefined.'}
        </p>
      )}
    </div>
  )
}

function BeforeActing({ r }: { r: Rotation | undefined }) {
  const gaps = r?.explanation?.gaps ?? []
  const local = r?.explanation?.local_review ?? []
  if (!gaps.length && !local.length) return null
  return (
    <div className="rounded-[1.25rem] bg-sand p-5">
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-forest-800" aria-hidden="true" />
        <h4 className="text-[1.125rem]">Before you act on this</h4>
      </div>
      <ul className="mt-3 space-y-2 text-[0.8125rem] leading-snug text-ink">
        {[...gaps, ...local].map((t) => (
          <li key={t} className="flex gap-2">
            <span aria-hidden="true" className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------------------------------------------------------- states */

function LoadingState({ preset, startedAt }: { preset: Preset; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(t)
  }, [])
  const secs = Math.max(0, (now - startedAt) / 1000)
  return (
    <div role="status" aria-live="polite" className="grid items-center gap-8 py-6 md:grid-cols-[auto_1fr]">
      <Mascot name="mint" decorative className="animate-float mx-auto w-28 md:w-36" />
      <div>
        <p className="font-display text-[1.375rem] leading-snug font-semibold text-forest-950">
          Replaying four decades of daily weather for {preset.display.place}…
        </p>
        <p className="mt-1.5 text-[0.9375rem] text-ink">
          The engine simulates the soil water day by day for the current rotation and every candidate, then ranks them.
        </p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
          <div className="h-full w-1/3 animate-[hs-indeterminate_1.3s_ease-in-out_infinite] rounded-full bg-forest-950" />
        </div>
        <p className="mt-2 text-[0.8125rem] font-bold text-muted tabular-nums">{secs.toFixed(1)} s elapsed</p>
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-[1.25rem] bg-signal-50 p-6 ring-1 ring-signal/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-signal-ink" aria-hidden="true" />
        <div>
          <p className="font-display text-lg font-semibold text-forest-950">The analysis could not be loaded</p>
          <p className="mt-1 text-[0.875rem] text-ink">{error}</p>
        </div>
      </div>
      <Button icon={<RefreshCw />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

/* ---------------------------------------------------------------- panel */

interface AnalysisPreviewProps {
  preset: Preset
  state: AnalysisState
  onRetry: () => void
  onClose: () => void
  headingRef: Ref<HTMLHeadingElement>
}

export function AnalysisPreview({ preset, state, onRetry, onClose, headingRef }: AnalysisPreviewProps) {
  const env = state.status === 'ready' ? state.env : null
  const res = env?.result
  const cur = res ? currentRotation(res) : undefined
  const alt = res ? topAlternative(res) : undefined
  const n = res?.rotations.length ?? 0
  const thr = failureThreshold(env)
  const irrigated = isIrrigated(env)
  // The engine always names five "worst" years; when the index never varies (full irrigation)
  // they are ties, so highlighting them would suggest a difference that is not there.
  const worstYears = cur && indexVaries(cur) ? (cur.hindcast.worst_years?.years ?? []) : []
  const warnings = res?.meta.warnings ?? []

  return (
    <div className="rounded-(--radius-panel) bg-white p-4 shadow-lift ring-1 ring-border sm:p-7 lg:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Analysis preview</p>
          <h3 ref={headingRef} tabIndex={-1} className="mt-1.5 text-[1.625rem] leading-tight tracking-[-0.025em] outline-none sm:text-[2rem]">
            {preset.display.place}
            {preset.display.country ? `, ${preset.display.country}` : ''}
          </h3>
          <p className="mt-1 text-[0.875rem] font-semibold text-muted">
            {fmtCoord(preset.lat, preset.lon)} · {preset.water_label} · {res ? `${n} rotations compared` : preset.rotation_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {env && (
            <Button variant="secondary" icon={<Download />} onClick={() => downloadJson(env, preset.id)}>
              <span className="hidden sm:inline">Download engine JSON</span>
              <span className="sm:hidden">JSON</span>
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close analysis preview"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border-strong/80 text-forest-950 transition-colors hover:bg-sand"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-6">
        {state.status === 'loading' && <LoadingState preset={preset} startedAt={state.startedAt} />}
        {state.status === 'error' && <ErrorState error={state.error} onRetry={onRetry} />}
        {env && res && cur && (
          <div className="animate-fade space-y-8">
            <div className="space-y-3">
              <SourceBanner env={env} onRetry={onRetry} />
              <ClimateStrip res={res} />
            </div>

            {irrigated && (
              <p className="flex gap-2 rounded-2xl bg-peri-50 p-4 text-[0.875rem] leading-snug text-ink ring-1 ring-peri">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-peri-ink" aria-hidden="true" />
                <span>
                  With full irrigation the model removes water stress, so every rotation’s season index stays close to 1.
                  The more useful comparison here is the irrigation each rotation would need.
                </span>
              </p>
            )}

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-5">
                <RotationSummary r={cur} tag="Your current rotation" n={n} irrigated={irrigated} threshold={thr} tone="current" />
                {alt && <RotationSummary r={alt} tag="Highest-ranked alternative" n={n} irrigated={irrigated} threshold={thr} tone="best" />}
              </div>
              <div className="min-w-0 space-y-5 lg:col-span-7">
                <div className="rounded-[1.25rem] p-1 sm:p-2">
                  <h4 className="flex items-center gap-1.5 text-[1.125rem]">
                    Season index, year by year
                    <InfoTip label="Season index">{TIP.index}</InfoTip>
                  </h4>
                  <div className="mt-3">
                    <IndexLines
                      years={cur.hindcast.years}
                      series={[
                        { label: `${rotationLabel(cur)} (current)`, values: cur.hindcast.annual_index, color: 'var(--color-peri-chart)', dashed: true },
                        ...(alt ? [{ label: rotationLabel(alt), values: alt.hindcast.annual_index, color: 'var(--color-forest-950)' }] : []),
                      ]}
                      threshold={thr}
                      highlightYears={worstYears}
                      highlightLabel="Your 5 worst years"
                      caption={`Season index per year, ${cur.hindcast.years[0]} to ${cur.hindcast.years[cur.hindcast.years.length - 1]}, for the current rotation${
                        alt ? ` and ${rotationLabel(alt)}` : ''
                      }.`}
                    />
                  </div>
                </div>
                {alt?.explanation && (
                  <div className="rounded-[1.25rem] bg-sand/60 p-5">
                    <p className="text-[0.75rem] font-extrabold tracking-[0.08em] text-muted uppercase">
                      Why “{rotationLabel(alt)}” ranks #{alt.scores.rank}
                    </p>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed font-semibold text-forest-950">{alt.explanation.summary}</p>
                    <ul className="mt-3 space-y-1.5 text-[0.875rem] leading-snug text-ink">
                      {(alt.explanation.reasons ?? []).filter((t) => !/failure line in/.test(t)).slice(0, 4).map((t) => (
                        <li key={t} className="flex gap-2">
                          <span aria-hidden="true" className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />
                          {t}
                        </li>
                      ))}
                    </ul>
                    {(alt.explanation.benefits ?? []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {alt.explanation.benefits!.map((b) => (
                          <span key={b} className="rounded-xl bg-white px-2.5 py-1 text-[0.75rem] leading-snug font-bold text-forest-950 ring-1 ring-forest-950/10 sm:rounded-full">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-[0.75rem] font-semibold text-muted">Plain-language text generated from the engine’s numbers with fixed templates.</p>
                  </div>
                )}
              </div>
            </div>

            <RankedList res={res} irrigated={irrigated} />

            <div className="grid gap-4 lg:grid-cols-2">
              <NdviBlock check={res.validation?.ndvi_check} used={env.inputs?.ndvi?.used} />
              <BeforeActing r={alt ?? cur} />
            </div>

            {warnings.length > 0 && (
              <ul className="space-y-2">
                {warnings.map((w) => (
                  <li key={w} className="flex gap-2 rounded-xl bg-signal-50 p-3 text-[0.8125rem] font-semibold text-signal-ink">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {w}
                  </li>
                ))}
              </ul>
            )}

            <p className="border-t border-border pt-5 text-[0.8125rem] leading-relaxed text-muted">
              These are historical simulations, {res.meta.record.start_year}–{res.meta.record.end_year}, not forecasts. The season index is not a
              yield in tonnes per hectare, and rankings compare only the rotations shown here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
