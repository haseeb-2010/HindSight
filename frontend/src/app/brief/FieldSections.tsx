// Sections 1 to 3 of the Decision Brief: the farm, its weather record and the current rotation.
import { indexVaries, rotationLabel, seasonsFailed } from '../../lib/analysis'
import { fmtCoord, fmtIndex, fmtMm, fmtNum, fmtPct, isNum, yearList } from '../../lib/format'
import { Callout } from '../components/controls'
import { scenarioText } from '../lib/config'
import { exposureSentence } from '../lib/insights'
import { LIMIT_WORDS, OM_LEVELS, SOIL_SOURCES, textureLabel, WATER_MODES, waterLabel } from '../lib/labels'
import { matchingTemplate } from '../lib/priorityTemplates'
import { Stat, TIP } from '../results/shared'
import { BareCalendar, PriorityWeights, ShiftChart, YearBars } from './charts'
import { CropSequence, EngineQuote, Fact, NA, RAINFALL_CAUTION, Section, Sub, type BriefData } from './parts'

/* ------------------------------------------------------------------ 1. farm snapshot */

export function FarmSnapshot({ d, farmName, defaults }: { d: BriefData; farmName: string; defaults?: Record<string, number> }) {
  const { env, res, cur, names } = d
  const req = env.request
  const soil = res.site.soil_used
  const elevation = env.inputs?.climate?.elevation_m
  const weights = req?.priorities
  const matched = weights ? matchingTemplate(weights, defaults ?? {}) : null
  // The "Balanced" template is the application's default weights, which only the API knows.
  const template = matched && (matched.weights !== null || defaults) ? matched : null
  const mode = req?.water?.mode
  return (
    <Section n={1} title="Farm snapshot" lead="The field, soil, water management and rotation this analysis ran with, and the priorities used to rank the rotations.">
      <div className="grid gap-x-10 gap-y-7 lg:grid-cols-2 print:grid-cols-2">
        <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-4">
          <Fact label="Farm">{farmName}</Fact>
          <Fact label="Location">
            {res.site.name !== farmName && res.site.name ? (
              <>
                {res.site.name}
                <span className="block text-[0.8125rem] font-semibold text-ink">{env.preset_id ? 'Demonstration farm' : 'Custom field'}</span>
              </>
            ) : env.preset_id ? (
              'Demonstration farm'
            ) : (
              'Custom field'
            )}
          </Fact>
          <Fact label="Coordinates">
            <span className="tabular-nums">{isNum(res.site.lat) && isNum(res.site.lon) ? fmtCoord(res.site.lat, res.site.lon) : NA}</span>
          </Fact>
          <Fact label="Elevation of the weather grid cell">{isNum(elevation) ? <span className="tabular-nums">{fmtNum(elevation)} m</span> : NA}</Fact>
          <Fact label="Soil texture">{soil?.texture_class ? textureLabel(soil.texture_class) : NA}</Fact>
          <Fact label="Soil information source">{soil?.source ? (SOIL_SOURCES[soil.source] ?? soil.source) : NA}</Fact>
          <Fact label="Soil depth">{isNum(req?.soil?.depth_cm) ? <span className="tabular-nums">{req.soil.depth_cm} cm</span> : NA}</Fact>
          <Fact label="Available water (model estimate)">
            {isNum(soil?.available_water_mm_per_m) ? <span className="tabular-nums">{fmtNum(soil.available_water_mm_per_m)} mm per metre of soil</span> : NA}
          </Fact>
          <Fact label="Organic matter level">{req?.soil?.organic_matter_level ? (OM_LEVELS[req.soil.organic_matter_level]?.label ?? req.soil.organic_matter_level) : NA}</Fact>
          <Fact label="Water management" className="col-span-2">
            {mode ? waterLabel(mode, req?.water?.seasonal_cap_mm) : NA}
            {mode && WATER_MODES[mode] && <span className="block text-[0.8125rem] font-semibold text-ink">{WATER_MODES[mode].description}</span>}
          </Fact>
        </dl>

        <div className="min-w-0 space-y-6">
          <Sub title="Current rotation">
            {cur ? (
              <>
                <p className="text-[0.9375rem] font-semibold text-forest-950">
                  {rotationLabel(cur)}
                  <span className="font-semibold text-ink">
                    {' '}
                    · {cur.cycle_years}-year cycle · {cur.slots.length} crop season{cur.slots.length === 1 ? '' : 's'} per cycle
                  </span>
                </p>
                <div className="mt-2">
                  <CropSequence r={cur} names={names} />
                </div>
              </>
            ) : (
              <p className="text-[0.9375rem] text-ink">The engine did not mark a current rotation in this analysis.</p>
            )}
          </Sub>
          <Sub title="Farmer priorities" tip="Each priority has a weight from 0 (ignore) to 5 (most important). The engine scales every indicator between the rotations in this analysis, multiplies it by its weight and adds the results up to rank the rotations.">
            <p className="mb-3 text-[0.875rem] leading-snug text-ink">
              {template ? (
                <>
                  These weights match the <strong className="font-extrabold text-forest-950">{template.label}</strong> template. {template.summary}
                </>
              ) : weights ? (
                'The seven weights the engine ranked with, from 0 (ignored) to 5 (most important).'
              ) : null}
            </p>
            <PriorityWeights weights={weights} />
          </Sub>
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ 2. historical environmental context */

export function ClimateContextSection({ d }: { d: BriefData }) {
  const { env, res, early, late, scenarioOn } = d
  const shifts = res.climate_shift ?? []
  const sum = res.site.climate_summary
  const rec = res.meta.record
  const grid = env.inputs?.climate?.grid_note
  const averages = [
    { label: 'Rainfall', value: sum?.annual_rain_mm, text: (v: number) => fmtMm(v), unit: 'a year' },
    { label: 'Reference evapotranspiration', value: sum?.annual_et0_mm, text: (v: number) => fmtMm(v), unit: 'a year' },
    { label: 'Mean temperature', value: sum?.mean_temp_c, text: (v: number) => `${fmtNum(v, 1)} °C`, unit: undefined },
  ]
  return (
    <Section
      n={2}
      title="Historical environmental context"
      lead={`How the weather record for this location differs between ${early} and ${late}. The values are gridded environmental estimates, not measurements taken on the field.`}
    >
      {scenarioOn && (
        <Callout tone="warn" title="A what-if adjustment is applied to these values">
          This analysis ran with {scenarioText(env.request?.scenario)} applied to every day of the record, so the values below describe the adjusted record, not the weather that was
          observed.
        </Callout>
      )}

      <Sub title={`Averages over ${rec.start_year}–${rec.end_year}`}>
        {averages.some((a) => isNum(a.value)) ? (
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3 print:grid-cols-3">
            {averages.map((a) => (
              <Stat key={a.label} label={a.label} value={isNum(a.value) ? a.text(a.value) : '—'} unit={isNum(a.value) ? a.unit : undefined} />
            ))}
          </dl>
        ) : (
          <p className="text-[0.9375rem] text-ink">The engine did not return record averages for this analysis.</p>
        )}
        {averages.some((a) => isNum(a.value)) && (
          <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
            Yearly averages of the NASA POWER record for the grid cell that contains this field{grid ? ` (${grid})` : ''}.
          </p>
        )}
      </Sub>

      {shifts.length > 0 ? (
        <ShiftChart shifts={shifts} early={early} late={late} />
      ) : (
        <p className="text-[0.9375rem] text-ink">The engine did not return climate indicators for this analysis, so no comparison of the two periods is available.</p>
      )}

      <Callout tone="info" title="Read rainfall with care" className="break-inside-avoid">
        {RAINFALL_CAUTION}
      </Callout>
      <p className="text-[0.8125rem] leading-snug text-muted">
        These comparisons describe the past record only. The trend test asks how unusual year-to-year changes this consistent would be if there were no underlying trend. It is
        not the probability that a trend is real, it does not say how large or important a change is, and nothing here is a projection of future climate.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------ 3. existing rotation assessment */

export function CurrentAssessment({ d }: { d: BriefData }) {
  const { env, res, cur, names, thr, irrigated, waterKnown, total, early, late } = d
  if (!cur) {
    return (
      <Section n={3} title="Existing rotation assessment">
        <p className="text-[0.9375rem] text-ink">The engine did not mark a current rotation in this analysis, so it cannot be assessed here.</p>
      </Section>
    )
  }
  const h = cur.hindcast
  const f = seasonsFailed(cur)
  const varies = indexVaries(cur)
  const pairs = h.years.map((year, i) => ({ year, v: h.annual_index[i] })).filter((p): p is { year: number; v: number } => isNum(p.v))
  const lo = pairs.reduce<{ year: number; v: number } | null>((m, p) => (!m || p.v < m.v ? p : m), null)
  const hi = pairs.reduce<{ year: number; v: number } | null>((m, p) => (!m || p.v > m.v ? p : m), null)
  const belowN = thr !== null ? pairs.filter((p) => p.v < thr).length : null
  const worst = h.worst_years?.years ?? []
  const heavy = env.context?.climate?.thresholds?.heavy_rain_mm
  const win = h.by_window
  const slots = h.by_slot ?? []
  const mode = env.request?.water?.mode

  const yearNote = (
    <>
      {belowN !== null && `${belowN} of ${pairs.length} simulated years had a yearly index below the failure line of ${fmtIndex(thr)}. `}
      {lo && hi && `The lowest year was ${lo.year} (${fmtIndex(lo.v)}) and the highest ${hi.year} (${fmtIndex(hi.v)}). `}
      {worst.length > 0 && `The engine’s five lowest years for this rotation were ${yearList(worst)}. `}
      {cur.slots.length > 1 && 'A yearly value is the mean of the crop seasons that ended in that year.'}
    </>
  )

  return (
    <Section
      n={3}
      title="Existing rotation assessment"
      lead={`How ${rotationLabel(cur)} performed when it was replayed through ${res.meta.record.start_year}–${res.meta.record.end_year}. The seasonal index describes how well a crop season’s water and temperature needs were met in the simulation. It is not crop yield.`}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4 print:grid-cols-4">
        <Stat label="Rank in this analysis" tip={TIP.rank} value={cur.scores?.rank ? `#${cur.scores.rank}` : '—'} unit={cur.scores?.rank ? `of ${total}` : undefined} />
        <Stat label="Median seasonal index" tip={`${TIP.median} ${TIP.index}`} value={fmtIndex(h.median)} />
        <Stat label="Lower-decile (P10) index" tip={TIP.p10} value={fmtIndex(h.p10)} />
        <Stat label="Failure frequency" tip={TIP.failure(thr)} value={fmtPct(h.failure_freq)} unit={f ? `${f.failed} of ${f.total} seasons` : undefined} />
        <Stat label="Modelled crop water demand" tip={TIP.water} value={fmtMm(h.water_demand_mm_per_year)} unit="a year" />
        <Stat
          label="Irrigation requirement"
          tip={TIP.irrigation}
          value={irrigated || !waterKnown ? fmtMm(h.irrigation_mm_per_year) : 'None'}
          unit={irrigated || !waterKnown ? 'a year' : 'rainfed'}
        />
        <Stat label="Soil cover" tip={TIP.cover} value={fmtPct(cur.indicators.cover_frac)} unit="of days" />
        <Stat label="Heavy rain on bare soil" tip={TIP.erosion} value={fmtPct(cur.indicators.erosive_rain_on_bare_frac)} unit="of heavy-rain days" />
      </dl>

      <p className="text-[0.8125rem] leading-snug text-muted">
        How to read these figures. Median: half of the simulated years were higher and half lower. Lower-decile (P10): about 1 simulated year in 10 was lower. Failure frequency: the
        share of simulated crop seasons whose index fell below the failure line{thr !== null ? ` of ${fmtIndex(thr)}` : ''}. Crop water demand and irrigation are modelled amounts,
        not measured water use.
      </p>

      {cur.explanation?.summary && <EngineQuote text={cur.explanation.summary} by={`Summary written by the HindSight engine (v${res.meta.engine_version}) for the current rotation`} />}

      <div className="break-inside-avoid">
        {varies ? (
          <YearBars years={h.years} values={h.annual_index} threshold={thr} subject={rotationLabel(cur)} note={yearNote} />
        ) : (
          <Callout tone="plain" title="The yearly index did not vary in this simulation">
            The simulated index of this rotation was {fmtIndex(h.median)} in every year of the record, so a year-by-year chart would show no difference between years
            {mode === 'full' ? '. Under full irrigation the model refills the root zone whenever the crop starts to stress, which removes water stress from the index' : ''}.
          </Callout>
        )}
      </div>

      {varies && win?.early && win.late && isNum(win.early.failure_freq) && isNum(win.late.failure_freq) && (
        <p className="text-[0.9375rem] leading-relaxed text-ink">
          By period: the failure frequency was {fmtPct(win.early.failure_freq)} in {early} and {fmtPct(win.late.failure_freq)} in {late}
          {isNum(win.early.median) && isNum(win.late.median) ? `; the median index was ${fmtIndex(win.early.median)} and ${fmtIndex(win.late.median)}` : ''}. This describes the two
          halves of the record. It is not a forecast.
        </p>
      )}

      {slots.length === 1 && slots[0].main_limit && (
        <p className="text-[0.9375rem] leading-relaxed text-ink">
          Main limiting factor the simulation found for {(names[slots[0].crop_id] ?? slots[0].crop_id).toLowerCase()}:{' '}
          <strong className="font-extrabold text-forest-950">{(LIMIT_WORDS[slots[0].main_limit] ?? slots[0].main_limit).toLowerCase()}</strong>.
        </p>
      )}

      {slots.length > 1 && (
        <Sub title="By crop">
          <>
          <p className="mb-2 text-[0.75rem] font-bold text-ink md:hidden print:hidden">Scroll the table sideways to see every column.</p>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[30rem] border-collapse text-left text-[0.8125rem] print:min-w-0">
              <caption className="sr-only">Simulated results for each crop of the current rotation</caption>
              <thead>
                <tr className="text-[0.75rem] text-muted">
                  {['Crop', 'Median index', 'P10 index', 'Seasons below the failure line', 'Main limiting factor'].map((c) => (
                    <th key={c} scope="col" className="border-b border-border-strong py-2 pr-3 align-bottom font-bold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((s, i) => (
                  <tr key={i} className="break-inside-avoid border-b border-border">
                    <th scope="row" className="py-2.5 pr-3 font-bold text-forest-950">
                      {names[s.crop_id] ?? s.crop_id}
                    </th>
                    <td className="py-2.5 pr-3 font-semibold text-forest-950 tabular-nums">{fmtIndex(s.median)}</td>
                    <td className="py-2.5 pr-3 font-semibold text-forest-950 tabular-nums">{fmtIndex(s.p10)}</td>
                    <td className="py-2.5 pr-3 font-semibold text-forest-950 tabular-nums">
                      {s.n_failed} of {s.n_seasons}
                    </td>
                    <td className="py-2.5 font-semibold text-ink">{LIMIT_WORDS[s.main_limit] ?? s.main_limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        </Sub>
      )}

      <div className="break-inside-avoid">
        <BareCalendar
          rotation={cur}
          names={names}
          note={
            <>
              {exposureSentence(cur)} Over the whole cycle, a crop is in the ground on {fmtPct(cur.indicators.cover_frac)} of days, and{' '}
              {fmtPct(cur.indicators.erosive_rain_on_bare_frac)} of heavy-rain days{isNum(heavy) ? ` (${heavy} mm of rain or more)` : ''} fell while the soil was bare. That last
              figure is a heavy-rain exposure indicator, not a soil-loss estimate.
            </>
          }
        />
      </div>
    </Section>
  )
}
