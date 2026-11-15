// Sections G and H: what the results cannot tell you, what has been checked, and where everything comes from.
import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Resource } from '../../hooks/useResource'
import type { CropsResponse, PresetsResponse } from '../../lib/types'
import { Callout } from '../components/controls'
import { CITATIONS, LIMITS } from '../results/ProvenanceTab'
import { Chip, Panel } from '../results/shared'
import { ENGINE } from './engineFacts'
import { Bullets, Eyebrow, FileRef, ScienceSection, Tile } from './parts'

const strong = (text: string) => <strong className="font-extrabold text-forest-950">{text}</strong>

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded-sm font-bold break-words text-forest-950 underline decoration-sage underline-offset-2 hover:decoration-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
    >
      {children}
      <ExternalLink className="ml-1 inline-block h-3 w-3 align-[-0.05em]" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** A table on wide screens, stacked cards on narrow ones. The first column is the row heading. */
function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] border-collapse text-left text-[0.875rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border-strong text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
              {head.map((h) => (
                <th key={h} scope="col" className="py-2 pr-4 last:pr-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="py-2.5 pr-4 align-top font-extrabold text-forest-950">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="py-2.5 pr-4 align-top leading-snug text-ink tabular-nums last:pr-0">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2.5 md:hidden" aria-label={caption}>
        {rows.map((r, i) => (
          <li key={i} className="rounded-2xl bg-sand/60 p-3.5 text-[0.875rem] leading-snug text-ink">
            <p className="font-extrabold text-forest-950">{r[0]}</p>
            {r.slice(1).map((cell, j) => (
              <p key={j} className="mt-1 tabular-nums">
                <span className="font-bold">{head[j + 1]}:</span> {cell}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </>
  )
}

/* ------------------------------------------------------------------ G. Limitations */

// docs/DATA_SOURCES.md, "Comparison with published climate normals".
const RAIN_ROWS: ReactNode[][] = [
  ['Chakwal, Pakistan', '804 mm', '544 mm: WorldClim 2.1 grid, 1970–2000 (no official station normal was found)', 'about +48%'],
  ['Sheikhupura, Pakistan', '483 mm', '758.8 mm: Lahore station, about 35 km away, 1991–2020 normals', 'about −36%'],
  ['Ames, Iowa, USA', '857 mm', 'about 940 mm: NOAA 1991–2020 normals at Ankeny, about 34 km away', 'about −9%'],
]

// docs/METHODOLOGY.md, "Labelled assumptions".
const ASSUMPTIONS: ReactNode[] = [
  <>Soil water carries between crops as one evenly wet profile.</>,
  <>
    Bare fallow evaporates with a crop coefficient of {ENGINE.fallowKc} and a root depth of {ENGINE.fallowRootM} m.
  </>,
  <>
    The legume effect is a flat ×{(1 + ENGINE.legumeEffectPct / 100).toFixed(2)} on the next non-legume crop (field range +{ENGINE.legumeVariantsPct[1]}% to +
    {ENGINE.legumeVariantsPct[3]}%). It can be switched off.
  </>,
  <>A season fails when its index is below {ENGINE.failureLine}. The farmer can move this line.</>,
  <>The temperature factor uses the mean temperature of the whole season.</>,
  <>Full irrigation applies exactly the root-zone depletion whenever it passes the stress line. Limited irrigation stops at the seasonal cap.</>,
  <>Heat-day thresholds for each crop are assumptions. They are reported only and never multiplied into the index.</>,
]

function CropCoverage({ crops }: { crops: Resource<CropsResponse> }) {
  if (crops.status === 'loading') return <p className="text-[0.875rem] text-ink">Loading the crop list from the engine…</p>
  if (crops.status === 'error')
    return (
      <Callout tone="warn" title="Crop list not available">
        The list of verified crops could not be loaded from the API, so it is not shown here.
      </Callout>
    )
  const { crops: ok, unavailable } = crops.data
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <Eyebrow>Verified and available now ({ok.length})</Eyebrow>
        {ok.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ok.map((c) => (
              <li key={c.id}>
                <Chip tone="lime" className="whitespace-normal">
                  {c.name}
                </Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.875rem] text-ink">The engine reports no verified crops.</p>
        )}
        <p className="mt-3 text-[0.8125rem] leading-snug text-ink">A crop is offered only when its entry in the crop table is marked as checked against the cited tables.</p>
      </div>
      <div>
        <Eyebrow>Not available ({unavailable.length})</Eyebrow>
        {unavailable.length ? (
          <ul className="mt-2 space-y-1.5 text-[0.875rem] leading-snug text-ink">
            {unavailable.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-extrabold text-forest-950">{c.name}</span>
                <span>{c.reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.875rem] text-ink">The engine reports no unavailable crops.</p>
        )}
        <p className="mt-3 text-[0.8125rem] leading-snug text-ink">
          Without a sourced yield-response value the seasonal index cannot be calculated, so these crops cannot be simulated or suggested.
        </p>
      </div>
    </div>
  )
}

export function SectionLimitations({ crops }: { crops: Resource<CropsResponse> }) {
  return (
    <ScienceSection
      id="limitations"
      tone="caution"
      title="Transparent limitations"
      intro="These limits are part of every result. Read them before trusting a ranking. HindSight supports a farmer’s judgement; it does not replace it, or the advice of local agricultural experts."
    >
      <div className="rounded-[1.5rem] bg-signal-50 p-5 ring-1 ring-signal/30 sm:p-6">
        <h3 className="text-[1.1875rem] leading-tight">The limits in brief</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {LIMITS.map((l) => (
            <li key={l.title} className="rounded-2xl bg-white p-4 ring-1 ring-signal/20">
              <h4 className="font-display text-[1rem] leading-snug font-semibold text-forest-950">{l.title}</h4>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink">{l.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <Panel title="A replay of the past, not a prediction of the future">
        <div className="grid gap-3 md:grid-cols-2">
          <Tile tone="lime" title="What a hindcast can say">
            How each rotation would have fared, under this model, in the weather that the record shows for {ENGINE.recordStart}–{ENGINE.recordEnd}: in typical years, in weak years and in
            the worst years.
          </Tile>
          <Tile tone="signal" title="What it cannot say">
            What next season or the next decade will bring. Future weather may fall outside anything in the record, and a rotation that held up in the past is not guaranteed to hold up
            again.
          </Tile>
        </div>
      </Panel>

      <Panel title="A coarse climate grid, and documented rainfall differences">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          One weather cell is about 50 km wide and cannot resolve the rainfall differences between neighbouring landscapes. When the team compared NASA POWER’s mean yearly rainfall for{' '}
          {ENGINE.spinUpYear}–{ENGINE.recordEnd} with published climate normals, the Iowa site agreed well and both Pakistan sites differed strongly, in opposite directions.
        </p>
        <div className="mt-4">
          <DataTable
            caption="NASA POWER mean yearly rainfall compared with published climate normals at the three demonstration sites"
            head={['Site', 'NASA POWER', 'Published reference', 'Difference']}
            rows={RAIN_ROWS}
          />
        </div>
        <Bullets
          className="mt-4"
          items={[
            <>Mean temperature agreed within about 2 °C where it was checked.</>,
            <>
              The comparison is rough. The reference periods differ from the NASA POWER period, the Chakwal reference is itself a gridded estimate, the other two are stations tens of
              kilometres away, and the reference values were read from public summaries of those normals.
            </>,
            <>
              {strong('The data were not adjusted.')} Instead, every analysis re-ranks the rotations with rainfall {ENGINE.rainVariantPct}% lower and {ENGINE.rainVariantPct}% higher
              (section E). The differences at the Pakistan sites are of that size or larger, so the check reduces this concern but does not remove it.
            </>,
            <>Results are best read as comparisons between rotations, not as exact local water amounts.</>,
          ]}
        />
        <p className="mt-3 text-[0.8125rem] text-ink">
          Source: <FileRef>docs/DATA_SOURCES.md</FileRef>
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="SoilGrids coverage is optional and patchy">
          <Bullets
            items={[
              <>At the demonstration points it returned no data for Chakwal or Sheikhupura, and a soil profile for Ames.</>,
              <>The service is in beta. In the team’s tests about 2 in 5 requests timed out.</>,
              <>It describes the top 30 cm of a 250 m square and gives no soil depth.</>,
              <>
                When it has nothing, the texture the farmer describes is used, turned into typical sand and clay values for that class. Without any soil information the engine falls back to
                a loam, {ENGINE.defaultDepthCm} cm deep, with low organic matter.
              </>,
            ]}
          />
        </Panel>
        <Panel title="NDVI is available for few places, and checks little">
          <Bullets
            items={[
              <>A greenness series is stored only for the demonstration farms. A custom field gets no satellite check.</>,
              <>No check is possible when the simulated index does not vary, as under full irrigation.</>,
              <>One 250 m pixel can mix several fields, roads or buildings. At Chakwal the pixel at the weather point is mostly town, so a cropland pixel 9 km east is used instead.</>,
              <>Greenness is not grain, and the check covers only the current rotation. It says nothing about the alternatives.</>,
            ]}
          />
        </Panel>
      </div>

      <Panel title="Crop values are generic published figures">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          Stage lengths, crop coefficients, root depths and stress thresholds come from the general tables of FAO-56, yield-response factors from FAO-33 as reprinted in FAO-66, and
          temperature ranges from FAO EcoCrop. They are not local varieties.
        </p>
        <Bullets
          className="mt-3"
          items={[
            <>
              Each crop has one fixed season length, taken from the nearest matching row of the FAO table. Wheat, for example, uses a 160-day row from another arid region as the closest
              match to a Pakistani winter season.
            </>,
            <>The values were transcribed from the published tables with the help of an AI coding assistant and spot-checked by a team member.</>,
            <>The sowing dates of the demonstration farms are typical values. Their regional sources have not yet been cited in the project documentation.</>,
          ]}
        />
        <div className="mt-5 border-t border-border pt-4">
          <CropCoverage crops={crops} />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="What is not modelled at all">
          <p className="text-[0.9375rem] leading-relaxed text-ink">The index reflects water and temperature only. The engine has no model of:</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {['Nutrients', 'Pests', 'Diseases', 'Salinity', 'Crop varieties', 'Farm management', 'Runoff by slope', 'Flooded-rice percolation'].map((x) => (
              <li key={x}>
                <Chip tone="white">{x}</Chip>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.875rem] leading-relaxed text-ink">
            A rotation is often chosen to break a pest or disease cycle or to manage nutrients. HindSight cannot score those benefits. It only reports how many neighbouring crops in the
            cycle share a plant family.
          </p>
        </Panel>
        <Panel title="Limits of the soil-care proxy indicators">
          <Bullets
            items={[
              <>
                {strong('Potential nitrogen contribution')} counts legume crops. It does not know how well a legume grew or how much nitrogen it fixed. It is not a nitrogen balance.
              </>,
              <>
                {strong('Organic matter contribution potential')} combines days with a crop in the ground and a residue class from 1 to 3 for each crop. It is not a measured change in soil
                carbon.
              </>,
              <>
                {strong('Heavy-rain exposure')} counts heavy-rain days on days without a crop. It ignores slope, soil type, residue left on the surface and how heavy the rain was above
                the threshold. It is not a soil-loss estimate.
              </>,
              <>{strong('Soil cover')} counts a newly sown crop the same as a full canopy.</>,
            ]}
          />
        </Panel>
      </div>

      <Panel title="Labelled assumptions in the method">
        <ol className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
          {ASSUMPTIONS.map((a, i) => (
            <li key={i} className="flex gap-3 text-[0.875rem] leading-relaxed text-ink">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand font-display text-[0.75rem] font-semibold text-forest-950 tabular-nums" aria-hidden="true">
                {i + 1}
              </span>
              <span className="min-w-0">{a}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[0.8125rem] text-ink">
          Source: <FileRef>docs/METHODOLOGY.md</FileRef>
        </p>
      </Panel>
    </ScienceSection>
  )
}

/* ------------------------------------------------------------------ H. Technical details and references */

/** The engine version docs/VALIDATION.md was written for. */
const VALIDATED_VERSION = '0.3.0'

// docs/VALIDATION.md, section 6.
const NUMERIC_CHECKS: ReactNode[][] = [
  ['Water mass balance over 41 years', 'Closes within 0.1 mm (synthetic weather: rainfed, full and limited irrigation; real Chakwal record: full irrigation)'],
  ['FAO-56 worked Example 18 (reference evapotranspiration)', '3.9 mm/day reproduced within 5%'],
  ['Full irrigation', 'ΣETa/ΣETc above 0.999 on crop days'],
  ['No rain at all', 'Index is 0'],
  ['Determinism', 'Identical output when the same analysis is repeated'],
  ['Output format', 'Strict JSON with no invalid numbers, including the irrigated case'],
]

// docs/VALIDATION.md, section 2.
const NDVI_ROWS: ReactNode[][] = [
  ['Chakwal', 'Cropland pixel 9 km east of the weather point', '0.59', '24', '0.003', 'Clear agreement'],
  ['Ames', 'Pixel at the weather point', '0.39', '24', '0.06', 'Weak, borderline'],
  ['Sheikhupura', 'Pixel at the weather point', 'Not available', '—', '—', 'Full irrigation keeps the index flat, so a correlation is undefined'],
]

const CODE_MAP: [string, string][] = [
  ['backend/engine/climate.py', 'Cleans the weather record, applies a what-if scenario, calls the ET0 routine'],
  ['backend/engine/et0.py', 'FAO-56 Penman-Monteith reference evapotranspiration'],
  ['backend/engine/soil.py', 'Soil-water limits from texture and organic matter (Saxton and Rawls)'],
  ['backend/engine/season.py', 'Crop coefficient curve, root growth, temperature factor, water term'],
  ['backend/engine/rotation.py', 'Rotation calendar, daily water balance, seasons, the 40-year hindcast'],
  ['backend/engine/candidates.py', 'Generates the alternative rotations'],
  ['backend/engine/ranking.py', 'Min-max scaling, farmer weights, ranks, Pareto mark'],
  ['backend/engine/trends.py', 'The six climate indicators, Theil-Sen slope, Kendall test'],
  ['backend/engine/explain.py', 'Sentence templates for the explanations'],
  ['backend/engine/__init__.py', 'Runs one analysis end to end, the sensitivity checks and the NDVI check'],
  ['backend/context.py', 'Yearly and monthly values of the weather record for the charts'],
  ['backend/data/crops.json', 'The crop table with the source of every value'],
  ['backend/data_sources/', 'NASA POWER, SoilGrids and MODIS access and caching'],
  ['backend/tests/', 'The automated checks listed above'],
  ['frontend/src/app/lib/insights.ts', 'The labelling rules used by the interpretation layer'],
  ['docs/', 'METHODOLOGY.md, DATA_SOURCES.md, VALIDATION.md, AI_USE.md'],
]

export function SectionReferences({ presets }: { presets: Resource<PresetsResponse> }) {
  const version = presets.status === 'ready' ? presets.data.engine_version : null
  return (
    <ScienceSection
      id="references"
      title="Technical details and references"
      intro="What has actually been checked, the sources behind every method and dataset, and where to find the code."
    >
      <Panel title="Validation performed so far">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          The checks below are the ones recorded in the project’s validation notes for engine version {VALIDATED_VERSION}. They were run by the project team on the three demonstration
          farms with the stored NASA POWER and MODIS data.
        </p>
        {version && version !== VALIDATED_VERSION && (
          <Callout tone="warn" className="mt-4" title="The running engine is a different version">
            The API reports engine version {version}. The checks below were recorded for version {VALIDATED_VERSION} and may not have been repeated.
          </Callout>
        )}

        <div className="mt-5 space-y-6">
          <div>
            <h4 className="font-display text-[1.0625rem] font-semibold text-forest-950">1. The worst simulated years line up with documented droughts</h4>
            <p className="mt-1.5 max-w-3xl text-[0.875rem] leading-relaxed text-ink">
              No yield or drought records go into the engine: only weather, soil and crop values. Its lowest yearly indices for the current rotations still fall in years with a documented
              drought.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Tile title="Ames, Iowa: maize and soybean">
                <p>Lowest simulated years: 2012, 2013 and 1988.</p>
                <p className="mt-1.5">
                  2012 was a severe United States drought that sharply cut the national maize crop (
                  <Ext href="https://ers.usda.gov/data-products/charts-of-note/76002">USDA ERS, August 2012</Ext>).
                </p>
              </Tile>
              <Tile title="Chakwal, rainfed: wheat then bare fallow">
                <p>Lowest simulated years: 2001, 1998, 2000 and 2002.</p>
                <p className="mt-1.5">
                  1998–2002 was a severe multi-year drought in Pakistan (
                  <Ext href="https://www.pmd.gov.pk/journal/historyworstdrought2001report.htm">Pakistan Meteorological Department</Ext>;{' '}
                  <Ext href="http://www.iwmi.cgiar.org/Publications/Working_Papers/working/WOR85.pdf">Ahmad et al. 2004, IWMI Working Paper 85</Ext>).
                </p>
              </Tile>
            </div>
            <p className="mt-3 text-[0.875rem] leading-relaxed font-bold text-forest-950">These are qualitative matches of timing. They are not a yield validation.</p>
          </div>

          <div>
            <h4 className="font-display text-[1.0625rem] font-semibold text-forest-950">2. Independent satellite check (MODIS NDVI, 2001–2024)</h4>
            <p className="mt-1.5 max-w-3xl text-[0.875rem] leading-relaxed text-ink">
              Pearson correlation between the current rotation’s yearly index and peak greenness in its crop months, good-quality pixels only.
            </p>
            <div className="mt-3">
              <DataTable caption="Correlation between the simulated yearly index and peak MODIS NDVI at the three demonstration farms" head={['Site', 'NDVI pixel', 'r', 'Years', 'p-value', 'Reading']} rows={NDVI_ROWS} />
            </div>
            <p className="mt-3 max-w-3xl text-[0.8125rem] leading-snug text-ink">
              At Chakwal’s weather point itself, where the pixel is mostly town, the correlation was 0.27 over 20 years; both numbers are reported. One pixel may mix fields, greenness is
              not grain, and the check covers only the current rotation. It is an independent check, not a calibration.
            </p>
          </div>

          <div>
            <h4 className="font-display text-[1.0625rem] font-semibold text-forest-950">3. Do the rankings survive the weakest inputs?</h4>
            <Bullets
              className="mt-2 max-w-3xl"
              items={[
                <>
                  {strong('Rainfall 30% lower and higher.')} At Chakwal and Ames the first-ranked rotation stayed first in both cases. At irrigated Sheikhupura it stayed first or second.
                </>,
                <>
                  {strong('Legume effect 0% to 32%.')} Every Chakwal rank was unchanged. At Ames and Sheikhupura ranks moved by at most two places.
                </>,
                <>
                  {strong('Worst years.')} In the five years that were worst for Chakwal’s current rotation, every alternative shown had a higher mean index than the current rotation.
                </>,
              ]}
            />
            <p className="mt-2 max-w-3xl text-[0.8125rem] leading-snug text-ink">
              These statements describe the demonstration analyses with their default settings. A different field, rotation or set of priorities can behave differently, which is why the
              same checks run with every analysis.
            </p>
          </div>

          <div>
            <h4 className="font-display text-[1.0625rem] font-semibold text-forest-950">4. Numerical checks in the automated tests</h4>
            <div className="mt-3">
              <DataTable caption="Numerical checks of the engine and their recorded results" head={['Check', 'Recorded result']} rows={NUMERIC_CHECKS} />
            </div>
            <p className="mt-3 text-[0.8125rem] leading-snug text-ink">The validation notes record 49 automated tests passing for this version, 35 of them on the data-access code.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Tile tone="signal" title="Cautions listed with the validation">
            <Bullets
              items={[
                <>The climate shifts in the Chakwal record are very large and may partly be artefacts of the reanalysis.</>,
                <>At irrigated Sheikhupura every rotation scores close to the ceiling, because water stress is removed. The useful comparison there is irrigation demand.</>,
                <>Rice has no sourced yield-response value, so it is not scored. The Sheikhupura demonstration uses cotton then wheat instead.</>,
                <>One day in the Chakwal record shows 329.6 mm of rain. It is kept as delivered.</>,
              ]}
            />
          </Tile>
          <Tile tone="signal" title="What has not been done">
            <Bullets
              items={[
                <>No comparison of the index with measured yields or farm records.</>,
                <>No calibration to any site, and no field trials.</>,
                <>No independent or peer review of the model or of these checks.</>,
                <>No validation outside the three demonstration farms.</>,
              ]}
            />
          </Tile>
        </div>
        <p className="mt-4 text-[0.8125rem] text-ink">
          Source: <FileRef>docs/VALIDATION.md</FileRef> <FileRef>backend/tests/</FileRef>
        </p>
      </Panel>

      <Panel title="Methods and source datasets">
        <ul className="grid gap-3 md:grid-cols-2">
          {CITATIONS.map((c) => (
            <li key={c.name} className="rounded-2xl bg-sand/60 p-4">
              <h4 className="font-display text-[1rem] font-semibold text-forest-950">{c.name}</h4>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink">{c.text}</p>
              {c.href && (
                <p className="mt-2 text-[0.8125rem]">
                  <Ext href={c.href}>{c.href.replace(/^https?:\/\//, '')}</Ext>
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Eyebrow>Also used</Eyebrow>
          <Bullets
            className="mt-2"
            items={[
              <>Wischmeier and Smith (1978): the {ENGINE.heavyRainMm} mm threshold for an erosive rain day.</>,
              <>The SciPy library: Theil-Sen slope, Kendall’s tau and Pearson correlation.</>,
              <>
                ORNL DAAC (2018), Terrestrial Ecology Subsetting and Visualization Services (TESViS): the web service the MODIS series was read through.{' '}
                <Ext href="https://doi.org/10.3334/ORNLDAAC/1600">doi.org/10.3334/ORNLDAAC/1600</Ext>
              </>,
            ]}
          />
        </div>
        <p className="mt-4 rounded-2xl bg-cream-50 p-4 text-[0.8125rem] leading-relaxed text-ink ring-1 ring-border">
          NASA POWER credit: “This data was obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.” HindSight
          uses these public datasets. It is not affiliated with or endorsed by NASA, ISRIC or FAO.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <Panel title="The engine">
            <p className="text-[0.75rem] font-extrabold tracking-[0.08em] text-muted uppercase">Engine version reported by the API</p>
            <p className="mt-1 font-display text-[2rem] leading-none font-semibold text-forest-950 tabular-nums" data-engine-version>
              {presets.status === 'ready' ? (version ?? 'Not reported') : presets.status === 'loading' ? '…' : 'Not available'}
            </p>
            {presets.status === 'error' && <p className="mt-2 text-[0.8125rem] leading-snug text-signal-ink">The API did not answer, so the version cannot be shown.</p>}
            <Bullets
              className="mt-4"
              items={[
                <>Written in Python with NumPy and SciPy.</>,
                <>Deterministic: the same inputs always give the same output.</>,
                <>Pure calculation: the engine itself makes no network calls and writes no files.</>,
                <>Every analysis records the engine version it was run with.</>,
              ]}
            />
          </Panel>
          <Panel title="How AI tools were used to build it">
            <p className="text-[0.875rem] leading-relaxed text-ink">
              The project’s AI-use log records that the engine code, its tests, the data-access code and the methodology and validation notes were drafted with an AI coding assistant. It
              also records a team member reviewing the engine, running its tests and checking the claims in the notes.
            </p>
            <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink">That is how the software was written. No language model runs when a farm is analysed.</p>
            <p className="mt-3 text-[0.8125rem] text-ink">
              Source: <FileRef>docs/AI_USE.md</FileRef>
            </p>
          </Panel>
        </div>

        <Panel title="Where the code lives">
          <p className="text-[0.875rem] leading-relaxed text-ink">Paths are relative to the project repository.</p>
          <dl className="mt-3 divide-y divide-border">
            {CODE_MAP.map(([path, what]) => (
              <div key={path} className="grid gap-x-4 gap-y-1 py-2 sm:grid-cols-[minmax(0,15.5rem)_minmax(0,1fr)]">
                <dt className="min-w-0">
                  <FileRef>{path}</FileRef>
                </dt>
                <dd className="text-[0.875rem] leading-snug text-ink">{what}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </ScienceSection>
  )
}
