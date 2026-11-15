import { CloudSun, Layers, Satellite, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { InfoTip } from '../../../components/ui/InfoTip'
import { fmtCoord, fmtNum, fmtP, isNum } from '../../../lib/format'
import type { AnalysisEnvelope, Preset, SoilProfile } from '../../../lib/types'
import { Callout } from '../../components/controls'
import { textureLabel } from '../../lib/labels'
import { Chip } from '../../results/shared'
import { SOURCES, aboutKm, directionFrom, distanceKm, fmtIsoDate, isoYear, samePoint } from './geo'

const NOT_RECORDED = 'Not recorded with this analysis'

function Missing({ children = NOT_RECORDED }: { children?: ReactNode }) {
  return <span className="font-semibold text-muted">{children}</span>
}

function Row({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 py-2.5 @md:grid-cols-[10.5rem_minmax(0,1fr)]">
      <dt className="flex items-center gap-1 text-[0.8125rem] leading-snug font-bold text-muted">
        {label}
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </dt>
      <dd className="min-w-0 text-[0.875rem] leading-snug font-semibold text-forest-950 tabular-nums">{children}</dd>
    </div>
  )
}

function SourceCard({ icon: Icon, name, kind, status, lead, children }: { icon: LucideIcon; name: string; kind: string; status: ReactNode; lead: ReactNode; children: ReactNode }) {
  return (
    <article className="@container flex min-w-0 flex-col rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-950 text-lime">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h4 className="text-[1.125rem] leading-tight">{name}</h4>
          <p className="mt-0.5 text-[0.75rem] font-extrabold tracking-[0.06em] text-muted uppercase">{kind}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{status}</div>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">{lead}</p>
      <dl className="mt-3 divide-y divide-border border-t border-border">{children}</dl>
    </article>
  )
}

/* ------------------------------------------------------------------ NASA POWER */

function PowerCard({ env }: { env: AnalysisEnvelope }) {
  const c = env.inputs?.climate
  const start = fmtIsoDate(c?.start)
  const end = fmtIsoDate(c?.end)
  const rec = env.result.meta.record
  const startYear = isoYear(c?.start)
  const warmUp = startYear !== null && startYear < rec.start_year

  return (
    <SourceCard
      icon={CloudSun}
      name={SOURCES.power.name}
      kind="Gridded environmental estimate"
      status={
        !c ? (
          <Chip>Details not recorded</Chip>
        ) : (
          <>
            <Chip tone="lime">Daily record read</Chip>
            {c.from_cache === true && <Chip>From the stored copy</Chip>}
            {c.from_cache === false && <Chip tone="peri">Downloaded for this run</Chip>}
          </>
        )
      }
      lead={
        c && start && end ? (
          <>
            Daily weather from {start} to {end} was read for the grid cell that contains this point
            {isNum(c.days) ? `: ${fmtNum(c.days)} daily records` : ''}.
            {warmUp && ` The results cover ${rec.start_year}–${rec.end_year}; the weather before ${rec.start_year} only sets the starting soil water.`}
          </>
        ) : (
          <>The time range of the weather record was not recorded with this analysis. The results cover {rec.start_year}–{rec.end_year}.</>
        )
      }
    >
      <Row label="What it provides">Historical daily climate: rainfall, maximum and minimum temperature, solar radiation, humidity and wind speed</Row>
      <Row label="Spatial resolution" tip="One value per grid cell and day. A single field can be wetter or drier than the cell as a whole, especially for rainfall.">
        {SOURCES.power.resolution}
      </Row>
      <Row label="Time range retrieved">{start && end ? `${start} to ${end}` : <Missing />}</Row>
      <Row label="Daily records" tip="The engine uses 365-day years, so 29 February is left out.">
        {isNum(c?.days) ? fmtNum(c.days) : <Missing />}
      </Row>
      <Row label="Grid elevation" tip="The elevation NASA POWER reports for the grid cell. It is not a survey of the field.">
        {isNum(c?.elevation_m) ? `${fmtNum(c.elevation_m)} m` : <Missing>{c ? 'Not reported for this point' : NOT_RECORDED}</Missing>}
      </Row>
      <Row label="Read from">
        {c?.from_cache === true ? 'A copy of the NASA POWER reply stored on the HindSight server' : c?.from_cache === false ? 'NASA POWER, downloaded when this analysis ran' : <Missing />}
      </Row>
      <Row label="Source">{c?.source ?? <Missing />}</Row>
      {c?.grid_note && <Row label="Grid note">{c.grid_note}</Row>}
    </SourceCard>
  )
}

/* ------------------------------------------------------------------ SoilGrids */

const SOIL_USED: Record<string, string> = {
  farmer: 'the soil values entered for the farm',
  soilgrids: 'the SoilGrids estimate',
  default: 'its default soil, because no soil information was given',
}

const SOIL_USED_LABEL: Record<string, string> = {
  farmer: 'Soil values entered for the farm',
  soilgrids: 'SoilGrids estimate',
  default: 'Engine default (no soil information given)',
}

const SOIL_STATUS: Record<string, { chip: string; tone: 'lime' | 'sand' | 'signal'; text: string }> = {
  profile: { chip: 'Usable profile obtained', tone: 'lime', text: 'A usable SoilGrids profile was obtained for this point.' },
  no_data: { chip: 'No data at this point', tone: 'sand', text: 'SoilGrids returned no data at this point.' },
  unavailable: { chip: 'Service could not be reached', tone: 'signal', text: 'SoilGrids could not be reached when this analysis ran.' },
  not_requested: { chip: 'Not requested', tone: 'sand', text: 'SoilGrids was not requested for this analysis.' },
  not_cached: { chip: 'No stored lookup', tone: 'sand', text: 'No SoilGrids lookup is stored for this point.' },
}

function soilProperties(p: SoilProfile): { have: { label: string; value: string }[]; missing: string[] } {
  const all: { label: string; value: string | null }[] = [
    { label: 'Texture class', value: p.texture_class ? textureLabel(p.texture_class) : null },
    { label: 'Sand', value: isNum(p.sand_pct) ? `${fmtNum(p.sand_pct, 1)}%` : null },
    { label: 'Clay', value: isNum(p.clay_pct) ? `${fmtNum(p.clay_pct, 1)}%` : null },
    { label: 'Organic matter', value: isNum(p.organic_matter_pct) ? `${fmtNum(p.organic_matter_pct, 2)}%` : null },
    { label: 'pH', value: isNum(p.ph) ? fmtNum(p.ph, 1) : null },
    { label: 'Soil depth', value: isNum(p.depth_cm) ? `${fmtNum(p.depth_cm)} cm` : null },
  ]
  return {
    have: all.filter((x): x is { label: string; value: string } => x.value !== null),
    missing: all.filter((x) => x.value === null).map((x) => x.label.toLowerCase()),
  }
}

function SoilCard({ env }: { env: AnalysisEnvelope }) {
  const s = env.inputs?.soil
  const status = s?.soilgrids
  const profile = s?.profile ?? null
  const used = s?.used ?? env.result.site.soil_used?.source
  const usedText = used ? (SOIL_USED[used] ?? used) : null
  const props = profile ? soilProperties(profile) : null
  const texture = env.result.site.soil_used?.texture_class

  const st = status ? SOIL_STATUS[status] : undefined

  let lead: string
  if (!status) lead = `The SoilGrids status was not recorded with this analysis.${usedText ? ` The engine used ${usedText}.` : ''}`
  else if (!st) lead = `SoilGrids status: ${status}.${usedText ? ` The engine used ${usedText}.` : ''}`
  else if (status === 'profile' && used === 'soilgrids') lead = `${st.text} The engine used it.`
  else if (status === 'profile' && usedText) lead = `${st.text} This analysis did not use it: the engine used ${usedText}.`
  else lead = `${st.text}${usedText ? ` The engine used ${usedText}.` : ''}`

  return (
    <SourceCard
      icon={Layers}
      name={SOURCES.soilgrids.name}
      kind="Gridded soil estimate, optional"
      status={
        <>
          <Chip tone={st?.tone ?? 'sand'}>{st?.chip ?? (status ? status : 'Status not recorded')}</Chip>
          {used && <Chip tone={used === 'soilgrids' ? 'lime' : 'white'}>Engine used: {used === 'soilgrids' ? 'SoilGrids' : used === 'farmer' ? 'farm values' : used === 'default' ? 'engine default' : used}</Chip>}
        </>
      }
      lead={lead}
    >
      <Row label="Usable profile">{!status ? <Missing /> : status === 'profile' ? 'Yes' : `No: ${(st?.chip ?? status).toLowerCase()}`}</Row>
      <Row label="Soil the engine used">
        {used ? (
          <>
            {SOIL_USED_LABEL[used] ?? used}
            {texture && <span className="font-semibold text-ink"> · {textureLabel(texture)}</span>}
          </>
        ) : (
          <Missing />
        )}
      </Row>
      <Row label="Source resolution" tip="HindSight reads the 0–5, 5–15 and 15–30 cm layers and takes their thickness-weighted mean over 0–30 cm. Soil depth is not taken from SoilGrids.">
        {SOURCES.soilgrids.resolution}
      </Row>
      <Row label="Properties available">
        {props && props.have.length > 0 ? (
          <ul className="space-y-0.5">
            {props.have.map((x) => (
              <li key={x.label} className="flex justify-between gap-3">
                <span className="font-semibold text-ink">{x.label}</span>
                <span>{x.value}</span>
              </li>
            ))}
          </ul>
        ) : !s ? (
          <Missing />
        ) : (
          <Missing>None: no SoilGrids profile was read for this analysis</Missing>
        )}
      </Row>
      {props && props.missing.length > 0 && (
        <Row label="Not supplied">
          <span className="font-semibold text-ink">{props.missing.join(', ').replace(/^./, (ch) => ch.toUpperCase())}</span>
        </Row>
      )}
    </SourceCard>
  )
}

/* ------------------------------------------------------------------ MODIS NDVI */

function NdviCard({ env, preset }: { env: AnalysisEnvelope; preset: Preset | null }) {
  const n = env.inputs?.ndvi
  const check = env.result.validation?.ndvi_check
  const site = env.result.site
  const first = fmtIsoDate(n?.first_date)
  const last = fmtIsoDate(n?.last_date)
  const pt = n?.point
  const moved = !!pt && !samePoint(pt, site)
  // The reason a different pixel is used travels with the point (or with the demonstration farm's settings).
  const why = pt && 'why' in pt && typeof pt.why === 'string' ? pt.why : moved && preset?.ndvi_point && samePoint(preset.ndvi_point, pt) ? preset.ndvi_point.why : undefined

  const lead = !n
    ? 'Whether a MODIS series was read was not recorded with this analysis.'
    : n.used === true
      ? `A stored MODIS NDVI series was read for this location${first && last ? `, covering ${first} to ${last}` : ''}.`
      : n.used === false
        ? 'No stored MODIS NDVI series exists for this location, so no satellite observations were read.'
        : 'Whether a MODIS series was read was not recorded with this analysis.'

  return (
    <SourceCard
      icon={Satellite}
      name={SOURCES.modis.name}
      kind="Satellite-derived estimate, optional check"
      status={
        <>
          <Chip tone={n?.used === true ? 'lime' : 'sand'}>{n?.used === true ? 'Stored observations read' : n?.used === false ? 'No stored observations' : 'Details not recorded'}</Chip>
          <Chip tone={check ? 'lime' : 'white'}>{check ? 'Greenness check performed' : 'Greenness check not performed'}</Chip>
        </>
      }
      lead={lead}
    >
      <Row label="Stored observations">{n?.used === true ? 'Yes' : n?.used === false ? 'No' : <Missing />}</Row>
      <Row label="Date range">{first && last ? `${first} to ${last}` : <Missing>{n?.used === false ? 'Not available: no series stored' : NOT_RECORDED}</Missing>}</Row>
      <Row label="Observations" tip="Each observation is one 16-day composite. Cloudy dates are flagged as not good quality, and only good-quality ones enter the check.">
        {isNum(n?.observations) ? (
          <>
            {fmtNum(n.observations)}
            {isNum(n.good_quality_observations) && <span className="font-semibold text-ink"> · {fmtNum(n.good_quality_observations)} of good quality</span>}
          </>
        ) : (
          <Missing>{n?.used === false ? 'Not available: no series stored' : NOT_RECORDED}</Missing>
        )}
      </Row>
      <Row label="Pixel location used">
        {pt ? (
          <>
            {fmtCoord(pt.lat, pt.lon)}
            <span className="mt-0.5 block font-semibold text-ink">
              {moved
                ? `Not the farm point. ${why ?? `It lies ${aboutKm(distanceKm(site, pt))} ${directionFrom(site, pt)} of it, so the greenness describes that pixel.`}`
                : 'The pixel that contains the farm point.'}
            </span>
          </>
        ) : (
          <Missing />
        )}
      </Row>
      <Row label="Resolution" tip="One 250 m pixel covers 6.25 hectares and can mix several fields, roads or buildings.">
        {SOURCES.modis.resolution}
      </Row>
      <Row
        label="Greenness check"
        tip="A correlation between peak MODIS greenness in the crop months and the current rotation’s yearly season index. +1 would mean they rise and fall together every year; 0 means no relationship. NDVI measures greenness, not crop yield, and the check never feeds back into the model."
      >
        {check ? (
          <>
            Performed: r = {fmtNum(check.r, 2)} over {check.n_years} years · {fmtP(check.p_value)}
            {check.note && <span className="mt-0.5 block font-semibold text-ink">{check.note}</span>}
          </>
        ) : (
          <>
            Not performed
            <span className="mt-0.5 block font-semibold text-ink">
              {n?.reason ??
                (n?.used === false
                  ? 'No MODIS NDVI series is stored for this location, so the optional check was skipped.'
                  : 'The engine reports this check only when the season index varies from year to year and at least 8 years overlap with the satellite record.')}
            </span>
          </>
        )}
      </Row>
    </SourceCard>
  )
}

/** What the analysis actually read from each data source, taken only from the envelope. */
export function Coverage({ env, preset }: { env: AnalysisEnvelope; preset: Preset | null }) {
  return (
    <div className="space-y-4">
      {!env.inputs && (
        <Callout tone="plain" title="Input details were not recorded with this analysis">
          This analysis carries no record of the data that was read for it, so the time range, soil status and satellite coverage cannot be shown. Only the documented
          resolution of each source is listed below. Running the analysis again records these details.
        </Callout>
      )}
      {env.source === 'saved' && env.inputs && (
        <Callout tone="plain" title="This is a saved demonstration result">
          It was not calculated just now. The details below describe the stored data that the saved result was generated from.
        </Callout>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <PowerCard env={env} />
        <SoilCard env={env} />
        <NdviCard env={env} preset={preset} />
      </div>
    </div>
  )
}
