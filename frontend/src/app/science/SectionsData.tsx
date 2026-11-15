// Sections A to C: what is read, how it is prepared, and how the climate record is described.
import { CloudSun, Layers, Satellite, Tractor, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { InfoTip } from '../../components/ui/InfoTip'
import { cx } from '../../lib/cx'
import type { ClimateShift, CropsResponse } from '../../lib/types'
import { Callout } from '../components/controls'
import { CLIMATE_RULES, readShift } from '../lib/insights'
import { PRIORITY_ORDER } from '../lib/labels'
import { Chip, Panel } from '../results/shared'
import { FootprintDiagram, PeriodTimeline } from './diagrams'
import { ENGINE } from './engineFacts'
import { Bullets, Eyebrow, Fact, FactList, Figure, FileRef, Formula, ScienceSection, Steps, Tile } from './parts'

/* ------------------------------------------------------------------ A. Data collection */

function SourceCard({ icon: Icon, name, role, tone, children }: { icon: LucideIcon; name: string; role: string; tone: string; children: ReactNode }) {
  return (
    <article className="flex flex-col rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6">
      <div className="flex items-start gap-3.5">
        <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-forest-950', tone)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Eyebrow>{role}</Eyebrow>
          <h3 className="mt-0.5 text-[1.25rem] leading-tight">{name}</h3>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  )
}

export function SectionData({ limits }: { limits: CropsResponse['limits'] | null }) {
  return (
    <ScienceSection
      id="data"
      title="Data collection"
      intro="HindSight reads three public datasets and what the farmer tells it. Only one of the datasets drives the simulation. The other two are optional."
    >
      <div className="grid gap-5 xl:grid-cols-2">
        <SourceCard icon={CloudSun} name="NASA POWER" role="Daily weather: drives every simulated day" tone="bg-lime-100">
          <FactList>
            <Fact term="What it is">
              A daily weather record for any point on land, built from NASA’s{' '}
              <InfoTip label="Reanalysis" term="reanalysis">
                A weather model that is continuously corrected with satellite and ground observations, giving a consistent record for every grid cell on Earth. POWER uses MERRA-2 for
                weather and CERES for sunlight.
              </InfoTip>{' '}
              and satellite products. These are gridded environmental estimates, not measurements taken in the field.
            </Fact>
            <Fact term="Used by the engine">
              Daily maximum and minimum air temperature, rainfall, sunlight reaching the ground, relative humidity and wind speed, plus the grid cell’s elevation and the latitude.
            </Fact>
            <Fact term="Period">
              1 January {ENGINE.spinUpYear} to 31 December {ENGINE.recordEnd}, every day. {ENGINE.spinUpYear} is a spin-up year; results cover {ENGINE.recordStart}–{ENGINE.recordEnd}.
            </Fact>
            <Fact term="Grid">Weather on cells of 0.5° × 0.625°, about 50 km wide. Sunlight on cells of 1° × 1°.</Fact>
            <Fact term="How it arrives">The demonstration farms use a stored copy. A custom field triggers a download for its point.</Fact>
          </FactList>
          <p className="mt-3 border-t border-border pt-3 text-[0.8125rem] leading-snug text-ink">
            The download also contains a root-zone soil wetness estimate. The engine does not use it: soil water is simulated from rain and crop water use.
          </p>
        </SourceCard>

        <SourceCard icon={Satellite} name="MODIS NDVI" role="Vegetation greenness: optional independent check only" tone="bg-peri-50">
          <FactList>
            <Fact term="What it is">
              Satellite observations of{' '}
              <InfoTip label="NDVI" term="vegetation greenness (NDVI)">
                The Normalized Difference Vegetation Index compares red and near-infrared light reflected by the land. Dense, healthy vegetation scores high. It measures greenness, not
                grain or yield.
              </InfoTip>{' '}
              from the MOD13Q1 product.
            </Fact>
            <Fact term="Resolution">Pixels 250 m wide, one composite every 16 days, 2001–2024.</Fact>
            <Fact term="Used for">
              One thing only: after the simulation, greenness is compared with the simulated index of the current rotation as an outside check.
            </Fact>
            <Fact term="Availability">Only where a series is already stored, which today means the demonstration farms. HindSight does not start a satellite download for a custom field.</Fact>
          </FactList>
          <Callout tone="info" className="mt-4">
            NDVI is never a model input and is never used to tune or calibrate the model. Removing it would not change a single result.
          </Callout>
        </SourceCard>

        <SourceCard icon={Layers} name="ISRIC SoilGrids" role="Gridded soil properties: optional" tone="bg-sand">
          <FactList>
            <Fact term="What it is">SoilGrids 2.0, a global map of soil properties predicted on a 250 m grid.</Fact>
            <Fact term="Used by the engine">Sand, clay and organic carbon for the top 30 cm (three layers: 0–5, 5–15 and 15–30 cm). Soil pH is retrieved too, but the engine does not use it.</Fact>
            <Fact term="Used for">An optional starting point for the field’s soil when the farmer asks for it.</Fact>
            <Fact term="Availability">
              Optional. The service can time out or have no data for a point. It gives no soil depth. If it returns nothing, the soil the farmer describes is used.
            </Fact>
          </FactList>
          <p className="mt-3 border-t border-border pt-3 text-[0.8125rem] leading-snug text-ink">A soil texture entered by the farmer always takes priority over the gridded value.</p>
        </SourceCard>

        <SourceCard icon={Tractor} name="Local farmer inputs" role="Entered by the farmer: shapes the whole analysis" tone="bg-lime-100">
          <FactList>
            <Fact term="Soil texture">One of twelve standard texture classes, from sand to clay.</Fact>
            <Fact term="Soil depth">
              How deep roots can go{limits ? `, between ${limits.depth_cm[0]} and ${limits.depth_cm[1]} cm` : ''}. Without an entry the engine assumes {ENGINE.defaultDepthCm} cm.
            </Fact>
            <Fact term="Organic matter">Low, medium or high.</Fact>
            <Fact term="Water access">
              Rainfed, full irrigation, or limited irrigation with a cap for each crop season
              {limits ? ` (${limits.seasonal_cap_mm[0]}–${limits.seasonal_cap_mm[1]} mm)` : ''}.
            </Fact>
            <Fact term="Crop sequence">The current rotation: which crops, their sowing dates, and a cycle of one, two or three years.</Fact>
            <Fact term="Priorities">
              {PRIORITY_ORDER.length === 7 ? 'Seven' : PRIORITY_ORDER.length} farming priorities, each weighted from 0 to 5, plus optional market ratings and crops to leave out.
            </Fact>
          </FactList>
        </SourceCard>
      </div>
    </ScienceSection>
  )
}

/* ------------------------------------------------------------------ B. Data processing */

const LEDGER: { name: string; space: string; time: string; read: string }[] = [
  { name: 'NASA POWER weather', space: 'Cell about 50 km wide (sunlight: 1° cell)', time: 'Daily, 1984–2024', read: 'The grid cell that contains the point' },
  { name: 'MODIS NDVI', space: 'Pixel 250 m wide', time: 'Every 16 days, 2001–2024', read: 'The single pixel that contains the check point' },
  { name: 'ISRIC SoilGrids', space: 'Pixel 250 m wide, top 30 cm', time: 'One fixed value, no dates', read: 'The single pixel that contains the point' },
  { name: 'Farmer inputs', space: 'The field itself', time: 'As entered for this analysis', read: 'Used exactly as entered' },
]

export function SectionProcessing() {
  return (
    <ScienceSection
      id="processing"
      title="Data processing"
      intro="Each dataset is read for one point and prepared in a few plain steps. Nothing is blended, downscaled or corrected against local records."
    >
      <Panel title="The datasets keep their own scale">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="text-[0.9375rem] leading-relaxed text-ink">
              The three datasets describe very different areas and time steps. HindSight does <strong className="font-extrabold text-forest-950">not</strong> harmonise them onto one
              grid. Each is simply read for the grid cell or pixel that contains the point, and each keeps its own resolution.
            </p>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">
              So one weather cell stands in for every field inside it, while a soil or greenness pixel can still be larger than a small field. Both facts are limits on what the results can
              say about one field.
            </p>
          </div>
          <Figure caption="Not drawn to scale. Every field inside one weather cell receives the same weather record.">
            <FootprintDiagram />
          </Figure>
        </div>

        <div className="mt-5 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[40rem] border-collapse text-left text-[0.875rem]">
            <caption className="sr-only">Spatial and temporal resolution of each dataset and how it is read</caption>
            <thead>
              <tr className="border-b border-border-strong text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
                <th scope="col" className="py-2 pr-4">Dataset</th>
                <th scope="col" className="py-2 pr-4">Area one value covers</th>
                <th scope="col" className="py-2 pr-4">Time step</th>
                <th scope="col" className="py-2">How it is read</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {LEDGER.map((l) => (
                <tr key={l.name}>
                  <th scope="row" className="py-2.5 pr-4 font-extrabold text-forest-950">{l.name}</th>
                  <td className="py-2.5 pr-4 text-ink">{l.space}</td>
                  <td className="py-2.5 pr-4 text-ink">{l.time}</td>
                  <td className="py-2.5 text-ink">{l.read}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-5 space-y-2.5 md:hidden">
          {LEDGER.map((l) => (
            <li key={l.name} className="rounded-2xl bg-sand/60 p-3.5 text-[0.875rem] leading-snug text-ink">
              <p className="font-extrabold text-forest-950">{l.name}</p>
              <p className="mt-1">
                <span className="font-bold">Area:</span> {l.space}
              </p>
              <p>
                <span className="font-bold">Time step:</span> {l.time}
              </p>
              <p>
                <span className="font-bold">Read as:</span> {l.read}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Weather: cleaning and gap handling">
          <Steps
            items={[
              <>Every 29 February is dropped, so each simulated year has 365 days.</>,
              <>
                A missing temperature, rainfall, humidity or wind value is filled with the record’s own average for that day of the year. If that day has no value in any year, the
                average of the whole record is used.
              </>,
              <>
                A missing sunlight value is estimated from that day’s temperature range with the Hargreaves radiation formula (FAO-56 equation 50). It is used only to fill gaps.
              </>,
              <>
                Before evapotranspiration is calculated, humidity is kept between 1% and 100% and wind speed is not allowed below {ENGINE.minWindMs} m/s.
              </>,
              <>The number of filled values is counted. If any were filled, the analysis says so in a warning.</>,
            ]}
          />
          <p className="mt-4 text-[0.8125rem] leading-snug text-ink">
            The stored records for the three demonstration farms had no missing values, so nothing was filled there. Rainfall is used as delivered: it is not bias-corrected, and one very
            wet day in the Chakwal record is kept unchanged.
          </p>
          <p className="mt-3 text-[0.8125rem] text-ink">
            Code: <FileRef>backend/engine/climate.py</FileRef>
          </p>
        </Panel>

        <Panel title="Soil: from a description to water limits">
          <Steps
            items={[
              <>
                <strong className="font-extrabold text-forest-950">Farmer’s texture first.</strong> A texture class is turned into typical sand and clay percentages for the middle of
                that class. These are approximate.
              </>,
              <>
                <strong className="font-extrabold text-forest-950">SoilGrids only if asked for and available.</strong> Its three layers are averaged by thickness over 0–30 cm, and
                organic carbon is converted to organic matter.
              </>,
              <>
                <strong className="font-extrabold text-forest-950">Organic matter level.</strong> Low, medium and high stand for {ENGINE.organicMatterPct.low}%,{' '}
                {ENGINE.organicMatterPct.medium}% and {ENGINE.organicMatterPct.high.toFixed(1)}% organic matter.
              </>,
              <>
                <strong className="font-extrabold text-forest-950">Water limits.</strong> Sand, clay and organic matter give the field capacity and wilting point through the published
                Saxton and Rawls equations (section D).
              </>,
            ]}
          />
          <Formula className="mt-4" source="SoilGrids conversion, docs/DATA_SOURCES.md">
            organic carbon % × 1.724 = organic matter %
          </Formula>
          <p className="mt-3 text-[0.8125rem] text-ink">
            Code: <FileRef>backend/engine/soil.py</FileRef> <FileRef>backend/data_sources/soilgrids.py</FileRef>
          </p>
        </Panel>
      </div>

      <Panel title="Vegetation greenness: prepared only for the check">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Steps
            items={[
              <>Only composites flagged as good quality are kept. Cloudy or unreliable dates are ignored.</>,
              <>Only months in which the current rotation has a crop in the ground for more than half the month are used, so weeds on a bare field do not count as crop growth.</>,
              <>For each year, the highest greenness value in those months is taken.</>,
              <>
                Those yearly peaks are compared with the simulated yearly index of the current rotation using a{' '}
                <InfoTip label="Pearson correlation" term="Pearson correlation">
                  A number from −1 to +1 that says how closely two series rise and fall together. +1 means they move together every year, 0 means no straight-line relationship.
                </InfoTip>
                .
              </>,
            ]}
          />
          <Tile title="When the check is not reported">
            <Bullets
              items={[
                <>No stored NDVI series for the location.</>,
                <>Fewer than {ENGINE.ndviMinYears} years with both a greenness peak and a simulated index.</>,
                <>The simulated index does not vary from year to year, as under full irrigation. A correlation is then undefined.</>,
              ]}
            />
          </Tile>
        </div>
        <p className="mt-4 text-[0.8125rem] text-ink">
          Code: <FileRef>backend/engine/__init__.py</FileRef> (<FileRef>_ndvi_check</FileRef>)
        </p>
      </Panel>
    </ScienceSection>
  )
}

/* ------------------------------------------------------------------ C. Climate analysis */

const INDICATORS: { name: string; unit: string; rule: ReactNode }[] = [
  { name: 'Rain in the cool half-year', unit: 'mm a year', rule: <>Total rainfall in the six cooler months of each year.</> },
  { name: 'Rain in the warm half-year', unit: 'mm a year', rule: <>Total rainfall in the six warmer months of each year.</> },
  {
    name: 'Reference evapotranspiration',
    unit: 'mm a year',
    rule: <>The yearly total of daily reference evapotranspiration (section D): how much water the air could draw from a well-watered grass surface.</>,
  },
  { name: `Days above ${ENGINE.hotDayC} °C`, unit: 'days a year', rule: <>Days whose maximum temperature was above {ENGINE.hotDayC} °C.</> },
  { name: `Days below ${ENGINE.frostDayC} °C`, unit: 'days a year', rule: <>Days whose minimum temperature was below {ENGINE.frostDayC} °C.</> },
  {
    name: `Days with ${ENGINE.heavyRainMm} mm of rain or more`,
    unit: 'days a year',
    rule: <>Days with at least {ENGINE.heavyRainMm} mm of rain, the erosive-storm threshold of Wischmeier and Smith (1978).</>,
  },
]

// The four labels come from the rule itself (readShift), so this page cannot drift from the app.
const sample = (early: number, late: number, p: number): ClimateShift =>
  ({ id: 'sample', label: 'sample', unit: 'mm', early, late, change: late - early, slope_per_decade: 0, p_value: p }) as ClimateShift
const LABELS = {
  higher: readShift(sample(100, 200, 0.001)),
  lower: readShift(sample(200, 100, 0.001)),
  little: readShift(sample(100, 100, 0.9)),
  limited: readShift(sample(100, 200, 0.9)),
}

export function SectionClimate() {
  const { early, late } = ENGINE.windows
  const pct = `${Math.round(CLIMATE_RULES.littleChangeFraction * 100)}%`
  return (
    <ScienceSection
      id="climate"
      title="Climate analysis"
      intro="Before any crop is simulated, the weather record itself is summarised: six indicators, compared between an earlier and a later period of equal length."
    >
      <Panel title="Two comparison periods">
        <PeriodTimeline spinUp={ENGINE.spinUpYear} early={early} late={late} />
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink">
          For each indicator the engine adds up one value per year, then reports the average of the earlier period, the average of the later period, and the difference between them. This
          describes the past record of one grid cell. It is not a projection.
        </p>
      </Panel>

      <Panel title="The six indicators and their exact definitions">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {INDICATORS.map((ind) => (
            <li key={ind.name} className="rounded-2xl bg-sand/60 p-4">
              <p className="font-display text-[1rem] leading-snug font-semibold text-forest-950">{ind.name}</p>
              <p className="mt-0.5 text-[0.75rem] font-extrabold text-ink">{ind.unit}</p>
              <p className="mt-2 text-[0.875rem] leading-snug text-ink">{ind.rule}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.875rem] leading-relaxed text-ink">
          The warm half-year is April to September north of the equator and October to March south of it. The cool half-year is the other six months. The heat and frost counts here use
          fixed thresholds for every site; they are separate from the crop-specific heat days reported with each rotation.
        </p>
        <p className="mt-3 text-[0.8125rem] text-ink">
          Code: <FileRef>backend/engine/trends.py</FileRef>
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Two trend statistics">
          <FactList>
            <Fact
              term={
                <InfoTip label="Theil-Sen slope" term="Theil-Sen slope">
                  The slope is worked out between every pair of years, and the middle one is taken. One unusual year barely moves it.
                </InfoTip>
              }
            >
              How fast the indicator changed across all 40 years, reported per decade. It is the median of the slopes between every pair of years, so a single extreme year has little
              effect.
            </Fact>
            <Fact
              term={
                <InfoTip label="Kendall trend test" term="Kendall trend test">
                  A test that only looks at whether later years tend to be higher or lower than earlier years. It does not assume a straight line or a bell-shaped spread.
                </InfoTip>
              }
            >
              Asks whether the yearly values tend to rise or fall with time, using Kendall’s tau. It gives the p-value shown beside each indicator.
            </Fact>
          </FactList>
          <p className="mt-3 text-[0.8125rem] leading-snug text-ink">Both are calculated with the SciPy library on the 40 yearly values, not on the two period averages.</p>
        </Panel>

        <Panel title="What a p-value is, and is not">
          <div className="grid gap-3">
            <Tile tone="lime" title="It is">
              The chance of seeing a year-to-year pattern at least this strong if there were, in truth, no steady trend and the years were simply in random order.
            </Tile>
            <Tile tone="signal" title="It is not">
              <Bullets
                items={[
                  <>The probability that the trend is real.</>,
                  <>A measure of how large or how important the change is.</>,
                  <>A statement about future years.</>,
                ]}
              />
            </Tile>
          </div>
        </Panel>
      </div>

      <Panel title="How the app words a difference">
        <p className="text-[0.9375rem] leading-relaxed text-ink">
          The engine returns numbers only. The app turns them into one of a few fixed labels with the rule below. The same rule is used on every screen.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Tile tone="white" title="Step 1: direction, from the two period averages">
            <p>
              A difference is called <Chip>{LABELS.little.label}</Chip> when it is smaller than {pct} of the earlier period’s value, or smaller than{' '}
              <span className="tabular-nums">{CLIMATE_RULES.minChange.mm} mm</span> for rainfall and evapotranspiration, or{' '}
              <span className="tabular-nums">
                {CLIMATE_RULES.minChange.days} day{CLIMATE_RULES.minChange.days === 1 ? '' : 's'}
              </span>{' '}
              for day counts, whichever is larger.
            </p>
            <p className="mt-2.5">
              Otherwise it is <Chip tone="peri">{LABELS.higher.label}</Chip> or <Chip tone="peri">{LABELS.lower.label}</Chip>.
            </p>
          </Tile>
          <Tile tone="white" title="Step 2: evidence, from the trend test">
            <p>
              If the Kendall p-value is below <span className="tabular-nums">{CLIMATE_RULES.alpha}</span>, the change is described as “{LABELS.higher.evidenceLabel}”.
            </p>
            <p className="mt-2.5">
              If it is not, or the engine returned no p-value, the label is <Chip tone="signal">{LABELS.limited.evidenceLabel}</Chip> and the sentence adds that the difference may
              reflect year-to-year variation.
            </p>
          </Tile>
        </div>
        <Callout tone="plain" className="mt-4">
          A difference is never called significant or certain on this basis. The labels are a reading aid; the two averages, the slope and the p-value are always shown beside them.
        </Callout>
        <p className="mt-3 text-[0.8125rem] text-ink">
          Rule: <FileRef>frontend/src/app/lib/insights.ts</FileRef> (<FileRef>CLIMATE_RULES</FileRef>, <FileRef>readShift</FileRef>)
        </p>
      </Panel>

      <Callout tone="warn" title="Read large shifts with care">
        A reanalysis record can change character over time as the satellites and observations behind it change. The project’s own validation notes that the very large shifts in the
        Chakwal record may partly be artefacts of this kind. The app shows them with their p-values and does not make them the headline.
      </Callout>
    </ScienceSection>
  )
}
