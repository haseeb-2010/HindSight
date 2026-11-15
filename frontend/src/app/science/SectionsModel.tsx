// Sections D to F: the daily simulation, how rotations are compared, and how results are explained.
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { InfoTip } from '../../components/ui/InfoTip'
import type { CropsResponse } from '../../lib/types'
import { Callout } from '../components/controls'
import { BARE_LABELS, BARE_RULES, METRICS, fmtMetricDelta } from '../lib/insights'
import { PRIORITIES, PRIORITY_ORDER } from '../lib/labels'
import { Chip, Panel } from '../results/shared'
import { BucketDiagram, KcCurveDiagram, PhaseDiagram, TemperatureDiagram } from './diagrams'
import { ENGINE, EXAMPLE_CROP } from './engineFacts'
import { Bullets, Fact, FactList, Figure, FileRef, Formula, ScienceSection, Steps, Tile } from './parts'

type Limits = CropsResponse['limits'] | null

const strong = (text: string) => <strong className="font-extrabold text-forest-950">{text}</strong>

/* ------------------------------------------------------------------ D. Crop-water simulation */

export function SectionSimulation({ limits }: { limits: Limits }) {
  const ex = EXAMPLE_CROP
  return (
    <ScienceSection
      id="simulation"
      title="Crop-water simulation"
      intro="For every day of the record the engine asks one question: did the crop get the water it needed? The answers add up to a historical simulated seasonal index. It is not crop yield."
    >
      <Panel title="Step 1: how thirsty was the air?">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <p className="text-[0.9375rem] leading-relaxed text-ink">
              <InfoTip label="Reference evapotranspiration" term="Reference evapotranspiration (ET0)">
                The water a well-watered, short grass surface would lose to the air in one day, in millimetres. It depends on the weather only, not on the crop or the soil.
              </InfoTip>{' '}
              is calculated for every day with the FAO-56 Penman-Monteith method, the standard published by the UN Food and Agriculture Organization.
            </p>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">
              It uses the day’s maximum and minimum temperature, sunlight, humidity and wind, with the cell’s elevation and the latitude. Actual vapour pressure is taken from mean relative
              humidity.
            </p>
            <p className="mt-3 text-[0.8125rem] text-ink">
              Code: <FileRef>backend/engine/et0.py</FileRef>
            </p>
          </div>
          <details className="group self-start rounded-2xl bg-sand/60 p-4">
            <summary className="cursor-pointer list-none rounded-lg font-display text-[1rem] font-semibold text-forest-950 [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-sage decoration-2 underline-offset-4 group-open:no-underline">Show the equation as it is coded</span>
            </summary>
            <Formula className="mt-3 bg-white" source="FAO-56 equation 6">
              ET0 = (0.408 Δ Rn + γ (900 / (T + 273)) u2 (es − ea)) / (Δ + γ (1 + 0.34 u2))
            </Formula>
            <p className="mt-2.5 text-[0.8125rem] leading-snug text-ink">
              Δ: slope of the vapour-pressure curve. Rn: net radiation. γ: psychrometric constant. T: mean temperature. u2: wind speed at 2 m. es − ea: how far the air is from
              saturation.
            </p>
          </details>
        </div>
      </Panel>

      <Panel title="Step 2: how much does this crop need today?">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <Figure
            caption={
              <>
                Drawn to scale from the {ex.name.toLowerCase()} entry in the crop table: Kc {ex.kc.ini.toFixed(2)}, {ex.kc.mid.toFixed(2)} and {ex.kc.end.toFixed(2)} over stages of{' '}
                {ex.stageDays.join(', ')} days. Every crop has its own curve.
              </>
            }
          >
            <KcCurveDiagram />
          </Figure>
          <div>
            <p className="text-[0.9375rem] leading-relaxed text-ink">
              A young crop uses little water, a full canopy uses the most, and a ripening crop uses less again. FAO-56 describes this with a{' '}
              <InfoTip label="Crop coefficient" term="crop coefficient (Kc)">
                A multiplier that turns the reference evapotranspiration into the water need of a particular crop at a particular growth stage.
              </InfoTip>{' '}
              that follows four growth stages: flat, rising, flat, falling.
            </p>
            <Formula className="mt-4" source="Modelled crop water demand for the day (FAO-56 chapter 6)">
              ETc = Kc × ET0
            </Formula>
            <Bullets
              className="mt-4"
              items={[
                <>
                  {strong('Roots.')} Root depth grows in a straight line from {ENGINE.rootStartM} m at sowing to the crop’s maximum by the start of mid-season.
                </>,
                <>
                  {strong('Bare soil between crops.')} Evaporation continues with a coefficient of {ENGINE.fallowKc} and a depth of {ENGINE.fallowRootM} m. This is a labelled assumption.
                </>,
              ]}
            />
            <p className="mt-3 text-[0.8125rem] text-ink">
              Code: <FileRef>backend/engine/season.py</FileRef>
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Step 3: the soil-water bucket">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <Figure className="self-start" caption="The soil is treated as one bucket. The stress line sits lower for crops that tolerate drier soil.">
            <BucketDiagram />
          </Figure>
          <div>
            <p className="text-[0.9375rem] leading-relaxed text-ink">Each day, in this order:</p>
            <div className="mt-3">
              <Steps
                items={[
                  <>{strong('Rain is added.')} All of the day’s rainfall enters the soil.</>,
                  <>{strong('Excess drains.')} Anything above what the soil can hold is lost.</>,
                  <>{strong('Irrigation is added')} if the farmer chose it and the crop has passed the stress line.</>,
                  <>
                    {strong('The crop takes water.')} With enough water it takes its full need. Below the stress line it takes less and less, down to nothing when the bucket is empty.
                  </>,
                ]}
              />
            </div>
            <div className="mt-4 grid gap-2">
              <Formula>Root-zone TAW = AWC × min(root depth, soil depth)</Formula>
              <Formula>depletion = (1 − fill) × TAW</Formula>
              <Formula>RAW = p × TAW</Formula>
              <Formula source="FAO-56 chapter 8, as written in docs/METHODOLOGY.md">ETa = Ks × Kc × ET0</Formula>
            </div>
          </div>
        </div>

        <FactList className="mt-5 border-t border-border pt-4">
          <Fact term="Field capacity, wilting point">
            The most water the soil holds after draining, and the point where plants can take no more. Both are estimated from sand, clay and organic matter with the Saxton and Rawls
            (2006) equations. They are estimates, not measurements of this field.
          </Fact>
          <Fact term="AWC and TAW">
            Available water capacity is the gap between those two limits, in mm of water per metre of soil. TAW is the water within reach of the roots today.
          </Fact>
          <Fact term="RAW and p">
            The part of TAW a crop can take without stress. p is the crop’s own share, from FAO-56 ({ex.name.toLowerCase()} in the crop table: {ex.pDepletion}).
          </Fact>
          <Fact term="Ks">The stress coefficient. It is 1 while depletion is within RAW, then falls in a straight line to 0 as the root zone empties.</Fact>
          <Fact term="Starting point">The bucket starts {ENGINE.spinUpYear} half full. Water is carried from one crop to the next, through any bare period, as one evenly wet profile.</Fact>
        </FactList>
        <p className="mt-3 text-[0.8125rem] text-ink">
          Code: <FileRef>backend/engine/rotation.py</FileRef> (<FileRef>simulate</FileRef>) <FileRef>backend/engine/soil.py</FileRef>
        </p>
      </Panel>

      <Panel title="Irrigation mode">
        <div className="grid gap-3 md:grid-cols-3">
          <Tile title="Rainfed">Rain is the only water added. Dry spells show up directly as stress.</Tile>
          <Tile title="Full irrigation">
            On a crop day, whenever depletion passes the stress line, the engine adds exactly the depletion and refills the root zone. Water stress is removed almost entirely, so the index
            stays close to its ceiling.
          </Tile>
          <Tile title="Limited irrigation">
            The same rule, until the water applied in that crop season reaches the cap{limits ? ` (${limits.seasonal_cap_mm[0]}–${limits.seasonal_cap_mm[1]} mm)` : ''}. The count starts
            again with each new crop season.
          </Tile>
        </div>
        <p className="mt-4 text-[0.875rem] leading-relaxed text-ink">
          Irrigation totals are simulated amounts under these rules. They are not measured farm water use, and the model does not know about canal schedules, pumping limits or water
          quality.
        </p>
      </Panel>

      <Panel title="Step 4: the seasonal index">
        <Formula source="docs/METHODOLOGY.md, step 6. Sources: FAO-33 and FAO-66, FAO EcoCrop, Zhao et al. (2022)">S = max(0, 1 − Ky(1 − ΣETa/ΣETc)) × f_T × m_legume</Formula>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Tile tone="white" title="Water term: 1 − Ky(1 − ΣETa/ΣETc)">
            <p>
              ΣETa/ΣETc is the share of the season’s water need that was met.{' '}
              <InfoTip label="Ky" term="Ky">
                The yield-response factor from FAO Irrigation and Drainage Paper 33. It says how strongly a crop responds to a water shortfall. Above 1, the crop is sensitive.
              </InfoTip>{' '}
              scales the shortfall: a sensitive crop loses more for the same shortage. The term cannot go below 0.
            </p>
          </Tile>
          <Tile tone="white" title="Legume effect: m_legume">
            <p>
              A non-legume crop that directly follows a legume in the cycle has its index multiplied by {(1 + ENGINE.legumeEffectPct / 100).toFixed(2)}. Field studies range from +
              {ENGINE.legumeVariantsPct[1]}% to +{ENGINE.legumeVariantsPct[3]}%, so this is the least certain value in the model. It can be switched off, and it is why an index can sit
              a little above 1.
            </p>
          </Tile>
          <Tile tone="white" title="Temperature factor: f_T" className="lg:col-span-2">
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
              <div>
                <p>
                  Each crop has a temperature range from the FAO EcoCrop database. The factor compares the mean temperature of the whole crop season with that range: 1 inside the best
                  range, falling in a straight line to 0 at the crop’s limits.
                </p>
                <p className="mt-2.5">It uses one mean for the season, so it does not see a short heat wave or a single cold night.</p>
              </div>
              <Figure
                className="bg-white"
                caption={
                  <>
                    Drawn to scale from the {ex.name.toLowerCase()} entry in the crop table: limits {ex.tempC.min} and {ex.tempC.max} °C, best range {ex.tempC.optMin}–{ex.tempC.optMax}{' '}
                    °C.
                  </>
                }
              >
                <TemperatureDiagram />
              </Figure>
            </div>
          </Tile>
        </div>

        <FactList className="mt-5 border-t border-border pt-4">
          <Fact term="Failure line">
            A season counts as failed when S is below {ENGINE.failureLine}
            {limits ? ` (adjustable from ${limits.failure_threshold[0]} to ${limits.failure_threshold[1]})` : ' (adjustable)'}. The line is a labelled assumption, not an agronomic
            constant.
          </Fact>
          <Fact term="Main limit">
            Each season is tagged with what held it back most: water if the water term lost more, temperature if the temperature factor lost more, none if both lost less than 0.1.
          </Fact>
          <Fact term="Killing cold">
            The method sets S to 0 if any day is colder than the crop’s kill temperature. No crop in the current table has a kill temperature set, because the published values are
            defined for monthly means and would wrongly kill hardy winter crops when applied to single nights. So this rule is not active today.
          </Fact>
          <Fact term="Heat and frost days">
            Days above a crop’s heat threshold and days below 0 °C are counted for each season and reported. The heat thresholds are assumptions; they are never multiplied into S.
          </Fact>
          <Fact term="Crop characteristics">
            For every crop: four stage lengths, three Kc values, maximum root depth, p, Ky, a temperature range, its plant family, whether it is a legume or a forage, a residue class and
            a cool or warm season type.
          </Fact>
        </FactList>
        <p className="mt-3 text-[0.8125rem] text-ink">
          Code: <FileRef>backend/engine/season.py</FileRef> <FileRef>backend/engine/rotation.py</FileRef> <FileRef>backend/data/crops.json</FileRef>
        </p>
      </Panel>
    </ScienceSection>
  )
}

/* ------------------------------------------------------------------ E. Rotation assessment */

const INDICATOR_ROWS: Record<string, { measure: ReactNode; favoured: 'Higher' | 'Lower' }> = {
  stability: {
    measure: <>The lower-decile (P10) value of the yearly index: about 1 simulated year in 10 was worse.</>,
    favoured: 'Higher',
  },
  water_use: { measure: <>Modelled crop water demand: ETc added up over crop days, as an average per year.</>, favoured: 'Lower' },
  forage: { measure: <>The share of crops in the cycle that are forage or dual-purpose.</>, favoured: 'Higher' },
  nitrogen: { measure: <>The share of crops in the cycle that are legumes. A potential nitrogen contribution indicator.</>, favoured: 'Higher' },
  erosion: {
    measure: <>The share of heavy-rain days ({ENGINE.heavyRainMm} mm or more) that fell on days with no crop in the ground. A heavy-rain exposure indicator.</>,
    favoured: 'Lower',
  },
  organic_matter: {
    measure: <>The average of two scaled values: the share of days with a crop in the ground, and the mean residue class of the crops. A soil-care contribution proxy.</>,
    favoured: 'Higher',
  },
  market: { measure: <>The mean of the farmer’s market ratings for the crops in the cycle.</>, favoured: 'Higher' },
}

export function SectionRotations({ limits, defaultMarket }: { limits: Limits; defaultMarket: number | null }) {
  const v = ENGINE.legumeVariantsPct
  return (
    <ScienceSection
      id="rotations"
      title="Rotation assessment"
      intro="The farmer’s current rotation and a set of alternatives are replayed through the same 40 years of weather, described with the same indicators, and ranked by the farmer’s own priorities."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel title="The baseline: the current rotation">
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            The rotation the farmer enters is always simulated first, with the crops and sowing dates given. It is always shown, whatever its rank, and every alternative is described
            against it.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">A cycle can last one, two or three years, and two crops may not occupy the field on the same day.</p>
        </Panel>

        <Panel title="The historical hindcast">
          <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
            <div className="text-[0.9375rem] leading-relaxed text-ink">
              <p>
                A rotation longer than one year is run once for each starting phase. Every crop in the cycle therefore meets every year’s weather, and no crop is lucky enough to miss a
                drought year.
              </p>
              <p className="mt-3">
                Each crop season is assigned to the year it ends in. A year’s index is the mean of the seasons ending that year, across the runs. Only complete seasons ending in{' '}
                <span className="tabular-nums">
                  {ENGINE.recordStart}–{ENGINE.recordEnd}
                </span>{' '}
                count.
              </p>
            </div>
            <Figure caption="A two-year rotation is simulated twice, one year out of step.">
              <PhaseDiagram />
            </Figure>
          </div>
        </Panel>
      </div>

      <Panel title="How alternative rotations are generated">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          Alternatives are built from the current rotation by three fixed rules. Nothing is searched, learned or optimised: the engine lists the candidates, then simulates every one.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Tile title="1. Regional library">
            A short list of rotations prepared by the team for the three demonstration regions. They are offered only when the analysis is for that demonstration farm. A custom field gets
            none.
          </Tile>
          <Tile title="2. Fallow fills">
            For every bare gap of {ENGINE.fillMinGapDays} days or more in the current rotation, each legume or forage crop is tried in the gap if its season fits with{' '}
            {ENGINE.fillSpareDays} days to spare. It is sown {ENGINE.fillStartOffsetDays} days after the gap begins.
          </Tile>
          <Tile title="3. Same-season substitutions">
            Each crop of the current rotation is swapped, one at a time, for another crop of the same season type (cool or warm), keeping the sowing date.
          </Tile>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="font-display text-[1rem] font-semibold text-forest-950">Filters every candidate must pass</h4>
            <Bullets
              className="mt-2"
              items={[
                <>Only crops with verified, sourced values, and none the farmer excluded.</>,
                <>
                  A fill or substitute crop must suit the climate: its temperature factor, at the record’s average temperatures for those calendar days, must be at least{' '}
                  {ENGINE.minTemperatureFit}.
                </>,
                <>Crops must not overlap in the field.</>,
                <>A rotation with the same crops in the same order is counted once.</>,
                <>At most {ENGINE.maxCandidates} candidates, including the current rotation.</>,
              ]}
            />
          </div>
          <div>
            <h4 className="font-display text-[1rem] font-semibold text-forest-950">Which ones are shown</h4>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink">
              Every candidate is simulated. The alternatives with the highest priority score are kept ({ENGINE.topN} unless changed
              {limits ? `, from ${limits.top_n[0]} to ${limits.top_n[1]}` : ''}) and shown with the current rotation. Scaling and ranking are then done again among the rotations shown, so
              ranks always refer to the set on screen.
            </p>
            <p className="mt-3 text-[0.8125rem] text-ink">
              Code: <FileRef>backend/engine/candidates.py</FileRef>
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="The rotation indicators behind the seven priorities">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          Each priority is tied to one indicator. Three come from the weather simulation. Four describe the structure of the rotation and do not depend on weather at all.
        </p>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[42rem] border-collapse text-left text-[0.875rem]">
            <caption className="sr-only">The indicator behind each of the seven priorities and the direction the ranking rewards</caption>
            <thead>
              <tr className="border-b border-border-strong text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
                <th scope="col" className="py-2 pr-4">Priority</th>
                <th scope="col" className="py-2 pr-4">What the engine measures</th>
                <th scope="col" className="py-2 whitespace-nowrap">Ranking rewards</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PRIORITY_ORDER.map((k) => (
                <tr key={k}>
                  <th scope="row" className="w-[13rem] py-2.5 pr-4 align-top font-extrabold text-forest-950">{PRIORITIES[k].label}</th>
                  <td className="py-2.5 pr-4 align-top leading-snug text-ink">
                    {INDICATOR_ROWS[k].measure}
                    {k === 'market' && defaultMarket !== null && <> A crop the farmer has not rated uses the default rating of {defaultMarket}.</>}
                  </td>
                  <td className="py-2.5 align-top font-bold whitespace-nowrap text-forest-950">{INDICATOR_ROWS[k].favoured} values</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 space-y-2.5 md:hidden">
          {PRIORITY_ORDER.map((k) => (
            <li key={k} className="rounded-2xl bg-sand/60 p-3.5 text-[0.875rem] leading-snug text-ink">
              <p className="font-extrabold text-forest-950">{PRIORITIES[k].label}</p>
              <p className="mt-1">
                {INDICATOR_ROWS[k].measure}
                {k === 'market' && defaultMarket !== null && <> A crop the farmer has not rated uses the default rating of {defaultMarket}.</>}
              </p>
              <p className="mt-1.5 font-bold text-forest-950">Ranking rewards: {INDICATOR_ROWS[k].favoured.toLowerCase()} values</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.875rem] leading-relaxed text-ink">
          The median index, the failure frequency, the irrigation total and the number of repeated plant families are also reported for every rotation, but they carry no weight in the
          ranking.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Farmer-weighted ranking">
          <Steps
            items={[
              <>
                {strong('Scale.')} Each indicator is stretched between the lowest and highest value among the rotations shown (min-max scaling), and flipped where lower is rewarded. The
                best rotation on an indicator gets 1, the weakest 0. If all are equal, each gets 0.5.
              </>,
              <>
                {strong('Weight.')} Each scaled value is multiplied by the farmer’s weight for that priority, from 0 to 5. If every weight is 0, all seven count equally.
              </>,
              <>{strong('Add up and rank.')} The weighted values are added and divided by the sum of the weights. The highest score is ranked first.</>,
            ]}
          />
          <div className="mt-4 grid gap-2">
            <Formula>scaled = (value − lowest) / (highest − lowest)</Formula>
            <Formula source="backend/engine/ranking.py">score = Σ(weight × scaled) / Σ(weights)</Formula>
          </div>
          <Callout tone="plain" className="mt-4">
            Because of the scaling, a score only compares the rotations in one analysis under one set of weights. A rank is not a probability of success, and the first-ranked rotation is
            the highest-ranked alternative in this analysis, nothing more.
          </Callout>
        </Panel>

        <Panel title="The Pareto mark">
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            The ranking depends on the weights. The Pareto mark does not. A rotation is marked{' '}
            <InfoTip label="Pareto efficient" term="Pareto efficient">
              No other rotation shown is at least as good on every scaled indicator and strictly better on at least one.
            </InfoTip>{' '}
            when no other rotation shown matches or beats it on all seven scaled indicators while beating it on at least one.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">
            A marked rotation is a defensible trade-off whatever the weights. Several rotations can carry the mark at once, and it does not make any of them the right choice for a given
            farm.
          </p>
          <p className="mt-3 text-[0.8125rem] text-ink">
            Code: <FileRef>backend/engine/ranking.py</FileRef> (<FileRef>pareto</FileRef>)
          </p>
        </Panel>
      </div>

      <Panel title="Sensitivity checks run with every analysis">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          A ranking is only useful if it survives the model’s weakest points. Four checks are run every time and reported beside each rotation.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Tile title={`Legume effect: ${v.join('%, ')}%`}>
            The legume effect is the least certain value. The rotations are ranked again with it switched off and at the low, middle and high values from field studies. Each rotation’s
            lowest and highest rank is reported. Skipped when the farmer switches the effect off.
          </Tile>
          <Tile title={`Rainfall ${ENGINE.rainVariantPct}% lower and ${ENGINE.rainVariantPct}% higher`}>
            NASA POWER rainfall can differ a lot from local records (section G). Every rotation shown is simulated again with all rainfall {ENGINE.rainVariantPct}% lower, then{' '}
            {ENGINE.rainVariantPct}% higher, and ranked again. The data itself is never adjusted.
          </Tile>
          <Tile title="Earlier-period and later-period ranks">
            The ranking is repeated using only the stability value of {ENGINE.windows.early[0]}–{ENGINE.windows.early[1]}, then only {ENGINE.windows.late[0]}–{ENGINE.windows.late[1]}.
            It shows whether a rotation’s position depends on which half of the record is used.
          </Tile>
          <Tile title="Worst-years test">
            The {ENGINE.worstYears} years with the lowest index for the current rotation are found in the record. Each alternative’s mean index in those same years is reported: how it
            would have fared when the current rotation fared worst.
          </Tile>
        </div>
        <p className="mt-4 text-[0.875rem] leading-relaxed text-ink">
          A rotation whose rank does not move in the legume and rainfall checks is labelled robust. These checks are separate from any what-if scenario the farmer sets.
        </p>
        <p className="mt-3 text-[0.8125rem] text-ink">
          Code: <FileRef>backend/engine/__init__.py</FileRef> (<FileRef>run_analysis</FileRef>)
        </p>
      </Panel>
    </ScienceSection>
  )
}

/* ------------------------------------------------------------------ F. Explanation and decision support */

const EXPLANATION_PARTS: { part: string; built: ReactNode }[] = [
  {
    part: 'Reasons',
    built: (
      <>
        For each crop, how many seasons fell below the failure line and what limited it most. For an alternative: its bad-year index and water demand against the current rotation, its
        mean index in the worst years, and its rank range in the legume and rainfall checks.
      </>
    ),
  },
  {
    part: 'Evidence',
    built: <>The methods used, and the share of heavy-rain days that fell on bare soil for this rotation.</>,
  },
  {
    part: 'Potential benefits',
    built: (
      <>
        A line appears only when its condition is true in the numbers: most stable, lowest water demand or least heavy rain on bare soil of the rotations compared; includes a legume;
        includes a forage; keeps the soil covered for clearly more of the year than the current rotation.
      </>
    ),
  },
  {
    part: 'Information gaps',
    built: (
      <>
        Always: the weather is a grid-cell estimate, crop values are generic, and pests, disease, nutrients and management are not modelled. Added when they apply: the irrigation
        assumption and the uncertainty of the legume effect.
      </>
    ),
  },
  {
    part: 'Local-review considerations',
    built: <>Three fixed prompts: confirm sowing dates and varieties locally, check markets and seed supply, and ask about pests and diseases that carry over between these crops.</>,
  },
]

const Slot = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-block rounded-md bg-lime px-1.5 py-px font-mono text-[0.75rem] font-bold text-forest-950">{children}</span>
)

const LAYER: { to: string; name: string; body: string }[] = [
  {
    to: '/app/insights',
    name: 'Field Intelligence',
    body: 'Charts and sentences drawn from one analysis. The yearly climate values behind the charts are read from the same weather record with the engine’s own thresholds.',
  },
  {
    to: '/app/scenarios',
    name: 'Scenario Lab',
    body: 'Runs the same engine again for the same field with changed settings, then lays the results side by side. It adds no model of its own.',
  },
  {
    to: '/app/brief',
    name: 'Decision Brief',
    body: 'Gathers the values of one analysis into a printable summary with its limits attached.',
  },
]

export function SectionExplanation({ limits }: { limits: Limits }) {
  const pctOf = (f: number) => `${Math.round(f * 100)}%`
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`
  return (
    <ScienceSection
      id="explanation"
      title="Explanation and decision support"
      intro="Every sentence the app shows about a result is assembled from the computed numbers by fixed rules. This section shows the rules."
    >
      <Panel title="How each rotation gets its explanation">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[0.9375rem] leading-relaxed text-ink">
              The engine writes its explanations from fixed sentence templates. Each template has slots, and the slots are filled with numbers from the simulation. For example, the
              summary line:
            </p>
            <p className="mt-3 rounded-2xl bg-forest-950 p-4 text-[0.9375rem] leading-[1.9] font-semibold text-cream-50">
              Would have fallen below the failure line in <Slot>failed</Slot> of <Slot>seasons</Slot> crop seasons (<Slot>share</Slot>%), mostly from <Slot>main limit</Slot>. Worst
              year: <Slot>year</Slot>.
            </p>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-ink">
              The words between the slots never change. A comparison is worded as better or worse only when the two bad-year indices differ by more than 0.02; otherwise it says “about the
              same”.
            </p>
            <Callout tone="info" className="mt-4" title="No language model is involved in producing results">
              The numbers come from the simulation and the sentences from templates. The same inputs always give the same numbers and the same words.
            </Callout>
          </div>
          <dl className="divide-y divide-border self-start rounded-2xl bg-sand/60 px-4">
            {EXPLANATION_PARTS.map((p) => (
              <div key={p.part} className="py-3">
                <dt className="font-display text-[1rem] font-semibold text-forest-950">{p.part}</dt>
                <dd className="mt-1 text-[0.875rem] leading-snug text-ink">{p.built}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-4 text-[0.8125rem] text-ink">
          Code: <FileRef>backend/engine/explain.py</FileRef>
        </p>
      </Panel>

      <Panel title="The interpretation layer: select, compare, label">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          Three parts of the workspace help read an analysis. They only select, compare and label values the engine returned. They do not re-simulate anything in the browser and they
          change no engine value.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {LAYER.map((l) => (
            <li key={l.to} className="flex flex-col rounded-2xl bg-sand/60 p-4">
              <h4 className="font-display text-[1rem] font-semibold text-forest-950">{l.name}</h4>
              <p className="mt-1.5 flex-1 text-[0.875rem] leading-relaxed text-ink">{l.body}</p>
              <Link
                to={l.to}
                className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md text-[0.875rem] font-extrabold text-forest-950 underline decoration-sage decoration-2 underline-offset-4 hover:decoration-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
              >
                Open {l.name} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="font-display text-[1rem] font-semibold text-forest-950">Bare-soil level of a month</h4>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink">
              The engine reports, for each month of the cycle, the share of days with no crop in the ground. The app labels that share with one rule:
            </p>
            <ul className="mt-3 space-y-2 text-[0.875rem] text-ink">
              <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Chip tone="lime">{BARE_LABELS.lower}</Chip>
                <span className="tabular-nums">under {pctOf(BARE_RULES.moderateFrom)} of the month’s days (one third)</span>
              </li>
              <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Chip tone="sand">{BARE_LABELS.moderate}</Chip>
                <span className="tabular-nums">
                  from {pctOf(BARE_RULES.moderateFrom)} to under {pctOf(BARE_RULES.higherFrom)}
                </span>
              </li>
              <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Chip tone="signal">{BARE_LABELS.higher}</Chip>
                <span className="tabular-nums">{pctOf(BARE_RULES.higherFrom)} or more (two thirds)</span>
              </li>
            </ul>
            <p className="mt-3 text-[0.8125rem] leading-snug text-ink">
              These are levels of modelled exposure in the crop calendar. They are not observations of the field and not soil-loss estimates.
            </p>
          </div>
          <div>
            <h4 className="font-display text-[1rem] font-semibold text-forest-950">When two rotations are called “about the same”</h4>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink">
              A difference smaller than these amounts is not described as a gain or a loss. Points are percentage points.
            </p>
            <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[0.875rem] text-ink">
              {METRICS.map((m) => (
                <div key={m.id} className="col-span-2 grid grid-cols-subgrid border-b border-border pb-1.5 last:border-0">
                  <dt>{m.short}</dt>
                  <dd className="text-right font-bold text-forest-950 tabular-nums">{fmtMetricDelta(m, m.similar).slice(1)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <p className="mt-4 text-[0.8125rem] text-ink">
          Rules: <FileRef>frontend/src/app/lib/insights.ts</FileRef> (<FileRef>BARE_RULES</FileRef>, <FileRef>CLIMATE_RULES</FileRef>, <FileRef>METRICS</FileRef>)
        </p>
      </Panel>

      <Panel title="What a what-if scenario really is">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <p className="text-[0.9375rem] leading-relaxed text-ink">
              A scenario is a hypothetical historical-weather stress test. It takes the same {ENGINE.spinUpYear}–{ENGINE.recordEnd} record and changes it in two uniform ways before the
              simulation runs:
            </p>
            <Bullets
              className="mt-3"
              items={[
                <>
                  {strong('Temperature offset.')} The same number of degrees is added to every day’s maximum and minimum temperature
                  {limits ? ` (${signed(limits.temp_delta_c[0])} to ${signed(limits.temp_delta_c[1])} °C)` : ''}.
                </>,
                <>
                  {strong('Rainfall multiplier.')} Every day’s rainfall is multiplied by the same factor
                  {limits ? ` (${limits.precip_factor[0]} to ${limits.precip_factor[1]})` : ''}.
                </>,
                <>Reference evapotranspiration is then recalculated from the shifted temperatures. Humidity, wind and sunlight stay as recorded.</>,
              ]}
            />
            <p className="mt-3 text-[0.8125rem] text-ink">
              Code: <FileRef>backend/engine/climate.py</FileRef> (<FileRef>prepare</FileRef>)
            </p>
          </div>
          <Tile tone="signal" title="What it cannot show">
            <Bullets
              items={[
                <>It is not a forecast and not a climate projection.</>,
                <>The order of wet and dry days, the timing of seasons and the length of dry spells stay exactly as they were.</>,
                <>Every scenario result is labelled as a scenario wherever it appears.</>,
              ]}
            />
          </Tile>
        </div>
      </Panel>
    </ScienceSection>
  )
}
