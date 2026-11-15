import { Logo } from '../../components/brand/Logo'
import { currentRotation, failureThreshold, indexVaries, isIrrigated, rankedRotations, rotationLabel, topAlternative } from '../../lib/analysis'
import { fmtCoord, fmtIndex, fmtMm, fmtNum, fmtP, fmtPct, yearList } from '../../lib/format'
import type { AnalysisEnvelope } from '../../lib/types'
import { isScenarioActive, scenarioText } from '../lib/config'
import { doyLabel } from '../lib/doy'
import { PRIORITIES, PRIORITY_ORDER, SOIL_SOURCES, textureLabel, waterLabel } from '../lib/labels'
import { CITATIONS, LIMITS } from './ProvenanceTab'
import { rangeText } from './shared'

const th = 'border-b border-black/40 px-1.5 py-1 text-left align-bottom text-[8.5pt] font-bold'
const td = 'border-b border-black/15 px-1.5 py-1 align-top text-[8.5pt]'

/** A plain, ink-friendly report of the whole analysis. Rendered only when printing. */
export function PrintReport({ env, names }: { env: AnalysisEnvelope; names: Record<string, string> }) {
  const res = env.result
  const all = rankedRotations(res)
  const cur = currentRotation(res)
  const alt = topAlternative(res)
  const req = env.request
  const irrigated = isIrrigated(env)
  const thr = failureThreshold(env)
  const rec = res.meta.record
  const soil = res.site.soil_used
  const varies = !!cur && indexVaries(cur)
  const focus = alt && cur && (alt.scores?.rank ?? 99) < (cur.scores?.rank ?? 99) ? alt : cur
  const printed = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <article className="hidden text-[10pt] leading-snug text-black print:block">
      <header className="flex items-end justify-between border-b-2 border-black pb-2">
        <Logo />
        <p className="text-right text-[8.5pt]">
          Farm analysis report · printed {printed}
          <br />
          Engine v{res.meta.engine_version} · {env.source === 'live' ? 'live calculation' : 'saved demonstration result'}
        </p>
      </header>

      <h1 className="mt-4 text-[18pt] leading-tight text-black">{res.site.name}</h1>
      <p className="text-[9.5pt]">
        {fmtCoord(res.site.lat, res.site.lon)} · {waterLabel(req?.water?.mode, req?.water?.seasonal_cap_mm)} · historical simulation {rec.start_year}–{rec.end_year}
      </p>
      {isScenarioActive(req?.scenario) && (
        <p className="mt-1 border border-black px-2 py-1 text-[9pt] font-bold">
          Historical what-if scenario applied ({scenarioText(req?.scenario)}) — not a climate forecast.
        </p>
      )}

      <h2 className="mt-4 text-[12pt] text-black">Inputs</h2>
      <table className="mt-1 w-full border-collapse">
        <tbody>
          <tr>
            <th className={th + ' w-[28%]'}>Soil</th>
            <td className={td}>
              {textureLabel(soil?.texture_class)} ({SOIL_SOURCES[soil?.source ?? ''] ?? soil?.source}); depth {req?.soil?.depth_cm ?? '—'} cm; available water{' '}
              {fmtNum(soil?.available_water_mm_per_m, 0)} mm per metre (model estimate)
            </td>
          </tr>
          <tr>
            <th className={th}>Current rotation</th>
            <td className={td}>
              {cur ? rotationLabel(cur) : '—'}
              {cur ? ` — ${cur.slots.map((s) => `${names[s.crop_id] ?? s.crop_id}${cur.cycle_years > 1 ? ` (year ${s.year_offset + 1})` : ''} sown ${doyLabel(s.plant_doy)}`).join('; ')}` : ''}
            </td>
          </tr>
          <tr>
            <th className={th}>Priorities (0–5)</th>
            <td className={td}>{PRIORITY_ORDER.map((k) => `${PRIORITIES[k].short} ${req?.priorities?.[k] ?? '—'}`).join(' · ')}</td>
          </tr>
          <tr>
            <th className={th}>Assumptions</th>
            <td className={td}>
              Failure line {thr ?? '—'}; legume effect {req?.options?.apply_legume_effect === false ? 'off' : 'on (+20%)'}; up to {req?.options?.top_n ?? '—'} alternatives; cycles up to{' '}
              {req?.constraints?.max_cycle_years ?? '—'} years
              {req?.constraints?.excluded_crops?.length ? `; excluded: ${req.constraints.excluded_crops.map((c) => names[c] ?? c).join(', ')}` : ''}
            </td>
          </tr>
          <tr>
            <th className={th}>Weather</th>
            <td className={td}>
              {env.inputs?.climate?.source ?? 'NASA POWER'}; yearly averages {rec.start_year}–{rec.end_year}: rain {fmtMm(res.site.climate_summary?.annual_rain_mm)}, reference ET₀{' '}
              {fmtMm(res.site.climate_summary?.annual_et0_mm)}, mean temperature {fmtNum(res.site.climate_summary?.mean_temp_c, 1)} °C
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-4 text-[12pt] text-black">Rotation comparison</h2>
      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr>
            {['Rank', 'Rotation', 'Median index', 'Lower-decile index', 'Failure freq.', 'Water demand', irrigated ? 'Irrigation' : null, 'Soil cover', 'Legume share', 'Forage share', 'Heavy rain on bare soil', varies ? 'Worst-years index' : null, 'Rank range: legume', 'Rank range: rain ±30%']
              .filter(Boolean)
              .map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {all.map((r) => (
            <tr key={r.id} className="break-inside-avoid">
              <td className={td}>#{r.scores?.rank}</td>
              <td className={td}>
                {rotationLabel(r)}
                {r.is_current ? ' (current)' : ''}
                {r.scores?.pareto ? ' · Pareto efficient' : ''}
              </td>
              <td className={td}>{fmtIndex(r.hindcast.median)}</td>
              <td className={td}>{fmtIndex(r.hindcast.p10)}</td>
              <td className={td}>{fmtPct(r.hindcast.failure_freq, 1)}</td>
              <td className={td}>{fmtMm(r.hindcast.water_demand_mm_per_year)}</td>
              {irrigated && <td className={td}>{fmtMm(r.hindcast.irrigation_mm_per_year)}</td>}
              <td className={td}>{fmtPct(r.indicators.cover_frac, 1)}</td>
              <td className={td}>{fmtPct(r.indicators.legume_share)}</td>
              <td className={td}>{fmtPct(r.indicators.forage_share)}</td>
              <td className={td}>{fmtPct(r.indicators.erosive_rain_on_bare_frac)}</td>
              {varies && <td className={td}>{fmtIndex(r.hindcast.worst_years?.mean_index)}</td>}
              <td className={td}>{rangeText(r.scores?.rank_range)}</td>
              <td className={td}>{rangeText(r.scores?.rank_range_rain)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[8.5pt]">
        Water in mm per year. The season index is not crop yield. Ranks are relative to the rotations listed and reflect the priorities above; they are not probabilities of success.
        {varies && cur?.hindcast.worst_years?.years?.length ? ` Worst years of the current rotation: ${yearList(cur.hindcast.worst_years.years)}.` : ''}
      </p>

      {focus?.explanation && (
        <section className="break-inside-avoid">
          <h2 className="mt-4 text-[12pt] text-black">
            Explanation: {rotationLabel(focus)} (rank #{focus.scores?.rank})
          </h2>
          <p className="mt-1">{focus.explanation.summary}</p>
          <ul className="mt-1 list-disc pl-5">
            {[...(focus.explanation.reasons ?? []), ...(focus.explanation.benefits ?? [])].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {(focus.explanation.local_review ?? []).length > 0 && (
            <>
              <p className="mt-2 font-bold">Check locally before acting</p>
              <ul className="list-disc pl-5">
                {[...(focus.explanation.gaps ?? []), ...(focus.explanation.local_review ?? [])].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {(res.climate_shift ?? []).length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mt-4 text-[12pt] text-black">Climate indicators</h2>
          <table className="mt-1 w-full border-collapse">
            <thead>
              <tr>
                {['Indicator (yearly average)', res.meta.windows?.early?.join('–') ?? 'Early', res.meta.windows?.late?.join('–') ?? 'Late', 'Change', 'Trend per decade', 'Trend test'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {res.climate_shift!.map((s) => (
                <tr key={s.id}>
                  <td className={td}>
                    {s.label} ({s.unit})
                  </td>
                  <td className={td}>{fmtNum(s.early, 1)}</td>
                  <td className={td}>{fmtNum(s.late, 1)}</td>
                  <td className={td}>{fmtNum(s.change, 1)}</td>
                  <td className={td}>{fmtNum(s.slope_per_decade, 2)}</td>
                  <td className={td}>{fmtP(s.p_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[8.5pt]">NASA POWER grid-cell estimates (about 50 km). Rainfall can differ substantially from local records; the data are shown as delivered.</p>
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="mt-4 text-[12pt] text-black">Validation</h2>
        <p className="mt-1">
          {res.validation?.ndvi_check
            ? `Independent vegetation-greenness check (MODIS NDVI): r = ${fmtNum(res.validation.ndvi_check.r, 2)} over ${res.validation.ndvi_check.n_years} years, ${fmtP(res.validation.ndvi_check.p_value)}. NDVI measures greenness, not yield.`
            : `Independent vegetation-greenness check not available. ${env.inputs?.ndvi?.reason ?? ''}`}
        </p>
      </section>

      <section>
        <h2 className="mt-4 text-[12pt] text-black">Data sources</h2>
        <ul className="mt-1 list-disc pl-5 text-[8.5pt]">
          {CITATIONS.map((c) => (
            <li key={c.name}>
              <strong>{c.name}.</strong> {c.text}
            </li>
          ))}
        </ul>
        <h2 className="mt-4 text-[12pt] text-black">Limitations</h2>
        <ul className="mt-1 list-disc pl-5 text-[8.5pt]">
          {LIMITS.map((l) => (
            <li key={l.title}>
              <strong>{l.title}.</strong> {l.body}
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-black pt-2 text-[8.5pt]">
          HindSight is an experimental decision-support tool. Its results are historical model simulations and should not be treated as yield forecasts, guarantees, or substitutes for
          local agricultural expertise.
        </p>
      </section>
    </article>
  )
}
