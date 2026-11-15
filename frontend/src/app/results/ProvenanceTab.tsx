import { ChevronDown, Satellite } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { fmtNum, fmtP } from '../../lib/format'
import type { AnalysisEnvelope } from '../../lib/types'
import { PROVENANCE_KINDS } from '../lib/labels'
import { Panel } from './shared'

export function Accordion({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-2xl bg-white ring-1 ring-border open:shadow-hairline" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3.5 font-display text-[1rem] leading-snug font-semibold text-forest-950 [&::-webkit-details-marker]:hidden">
        {title}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand transition-transform duration-300 group-open:rotate-180">
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </summary>
      <div className="px-4 pb-4 text-[0.9375rem] leading-relaxed text-ink">{children}</div>
    </details>
  )
}

// Citations as given in docs/DATA_SOURCES.md and docs/METHODOLOGY.md.
export const CITATIONS: { name: string; text: string; href?: string }[] = [
  {
    name: 'NASA POWER',
    text: 'Daily weather from the NASA Langley Research Center (LaRC) POWER Project, funded through the NASA Earth Science/Applied Science Program. Meteorology from MERRA-2 (0.5° × 0.625°), solar radiation from CERES (1° × 1°).',
    href: 'https://power.larc.nasa.gov/',
  },
  {
    name: 'MODIS',
    text: 'Didan, K. (2021). MODIS/Terra Vegetation Indices 16-Day L3 Global 250 m SIN Grid V061 (MOD13Q1). NASA Land Processes DAAC, accessed through the ORNL DAAC subsetting service.',
    href: 'https://doi.org/10.5067/MODIS/MOD13Q1.061',
  },
  {
    name: 'SoilGrids',
    text: 'Poggio, L. et al. (2021). SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. SOIL 7, 217–240. ISRIC — World Soil Information. CC BY 4.0.',
    href: 'https://doi.org/10.5194/soil-7-217-2021',
  },
  {
    name: 'Crop and water methods',
    text: 'FAO Irrigation and Drainage Paper 56 (reference evapotranspiration, crop coefficients, soil-water balance); FAO-33 and FAO-66 (yield-response factors, Ky); FAO EcoCrop (crop temperature ranges); Saxton & Rawls (2006) soil-water limits; Zhao et al. (2022) legume pre-crop effect.',
  },
]

export const LIMITS: { title: string; body: string }[] = [
  {
    title: 'Historical analysis, not forecasting',
    body: 'The model replays daily weather from 1984–2024. 1984 only warms up the soil water; results cover 1985–2024. It does not predict future weather or future crop performance.',
  },
  {
    title: 'No yield in tonnes',
    body: 'The engine reports a season index, not yield in tonnes per hectare, and HindSight does not convert one into the other.',
  },
  {
    title: 'Weather is a grid-cell estimate',
    body: 'NASA POWER meteorology is estimated on a grid of roughly 0.5° × 0.625°, about 50 km. A single field can have substantially different rainfall and local conditions.',
  },
  {
    title: 'Soil information is optional and approximate',
    body: 'SoilGrids can fail or return no data, and it describes the top 30 cm of a 250 m grid square. Soil-water limits are estimated from texture and organic matter, not measured.',
  },
  {
    title: 'Assumptions built into the model',
    body: 'Soil water is one evenly wet profile carried between crops. Bare fallow evaporates with a crop coefficient of 0.2. A legume raises the next non-legume crop’s index by a flat 20%. A season fails below an adjustable threshold (default 0.5). Full irrigation refills the root zone whenever the crop starts to stress; limited irrigation stops at the seasonal cap. Temperature suitability uses the season’s mean temperature and generic crop ranges.',
  },
  {
    title: 'What the model leaves out',
    body: 'Pests, disease, nutrient balances, salinity, differences between varieties, farm management, runoff by slope, and flooded-rice percolation are not modelled.',
  },
  {
    title: 'Indicators are proxies',
    body: 'Legume share indicates potential nitrogen contribution, not a measured nitrogen balance. Residue class is a proxy for organic-matter contribution potential, not a measured gain in soil carbon. Heavy rain on bare soil is an exposure indicator, not a soil-loss rate. Rankings compare the rotations evaluated; they are not probabilities of success.',
  },
]

export function ProvenanceTab({ env }: { env: AnalysisEnvelope }) {
  const res = env.result
  const check = res.validation?.ndvi_check
  const ndvi = env.inputs?.ndvi
  const prov = res.provenance ?? []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">Data, validation and limits</h2>
        <p className="mt-1 max-w-3xl text-[0.9375rem] text-muted">Where every part of this analysis came from, what was checked against independent data, and what the model cannot tell you.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title={
            <>
              <Satellite className="h-5 w-5 text-peri-ink" aria-hidden="true" /> Independent vegetation-greenness check
            </>
          }
        >
          {check ? (
            <>
              <p className="font-display text-[2rem] leading-none font-semibold text-forest-950 tabular-nums">
                r = {fmtNum(check.r, 2)}
                <span className="ml-2 font-sans text-[0.9375rem] font-bold text-ink">
                  over {check.n_years} years · {fmtP(check.p_value)}
                </span>
              </p>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">
                A correlation between peak MODIS greenness in the crop months and your current rotation’s yearly index. +1 would mean they rise and fall together every year; 0
                means no relationship.
              </p>
              {check.note && <p className="mt-2 text-[0.875rem] leading-snug text-muted">{check.note}</p>}
              {ndvi?.point && (
                <p className="mt-2 text-[0.8125rem] text-muted tabular-nums">
                  NDVI pixel at {ndvi.point.lat.toFixed(2)}, {ndvi.point.lon.toFixed(2)}.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="font-display text-[1.25rem] leading-tight font-semibold text-forest-950">Not available for this analysis</p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink">
                {ndvi?.reason ??
                  (ndvi?.used === false
                    ? 'No MODIS NDVI series is stored for this location, so the optional check was skipped.'
                    : 'The engine reports this check only when the season index varies from year to year and at least 8 years overlap with the satellite record.')}
              </p>
            </>
          )}
          <p className="mt-3 border-t border-border pt-3 text-[0.8125rem] leading-snug text-muted">
            MODIS NDVI measures how green the vegetation is. It is not crop yield, one 250 m pixel can mix several fields, and the check never feeds back into the model.
          </p>
        </Panel>

        <Panel title="Robustness tests run with every analysis">
          <ul className="space-y-3 text-[0.9375rem] leading-relaxed text-ink">
            <li>
              <strong className="font-extrabold text-forest-950">Rainfall ±30%.</strong> Every rotation is simulated again with rainfall 30% lower and 30% higher, then re-ranked. This
              is because NASA POWER rainfall can differ a lot from local records.
            </li>
            <li>
              <strong className="font-extrabold text-forest-950">Legume effect 0%, 7%, 20%, 32%.</strong> The legume boost is the least certain assumption, so ranks are recomputed across
              the range found in field studies{env.request?.options?.apply_legume_effect === false ? ' (skipped here: the legume effect was switched off)' : ''}.
            </li>
          </ul>
          <p className="mt-3 text-[0.875rem] leading-snug text-muted">
            The resulting rank ranges are on the Compare tab. They are separate from any what-if scenario chosen for this analysis.
          </p>
        </Panel>
      </div>

      <Panel title="Where each part of the analysis came from">
        {prov.length ? (
          <ul className="divide-y divide-border">
            {prov.map((p) => {
              const kind = PROVENANCE_KINDS[p.kind]
              return (
                <li key={p.item} className="grid gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1.4fr)] md:items-center">
                  <span className="font-bold text-forest-950">{p.item}</span>
                  <span className={cx('w-fit rounded-full px-2.5 py-1 text-[0.75rem] font-extrabold ring-1', kind?.tone ?? 'bg-sand text-forest-950 ring-sand-400')}>{kind?.label ?? p.kind.replace(/_/g, ' ')}</span>
                  <span className="text-[0.875rem] text-ink">{p.source}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[0.9375rem] text-muted">The engine did not return provenance for this analysis.</p>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 text-[1.1875rem]">Sources and citations</h3>
          <div className="space-y-2">
            {CITATIONS.map((c, i) => (
              <Accordion key={c.name} title={c.name} open={i === 0}>
                <p>{c.text}</p>
                {c.href && (
                  <p className="mt-2">
                    <a href={c.href} target="_blank" rel="noreferrer noopener" className="font-bold text-forest-950 underline decoration-sage underline-offset-2 hover:decoration-forest-950">
                      {c.href.replace(/^https?:\/\//, '')}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                )}
              </Accordion>
            ))}
          </div>
          <p className="mt-3 text-[0.8125rem] text-muted">HindSight uses these public datasets. It is not affiliated with or endorsed by NASA, ISRIC or FAO.</p>
        </section>
        <section>
          <h3 className="mb-3 text-[1.1875rem]">What this analysis can and cannot tell you</h3>
          <div className="space-y-2">
            {LIMITS.map((l, i) => (
              <Accordion key={l.title} title={l.title} open={i === 0}>
                <p>{l.body}</p>
              </Accordion>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
