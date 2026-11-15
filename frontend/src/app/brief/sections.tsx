// The seven numbered sections of the Decision Brief. Each reads one analysis envelope and nothing else.
import { CircleAlert, CircleCheck, Equal } from 'lucide-react'
import type { ReactNode } from 'react'
import { InfoTip } from '../../components/ui/InfoTip'
import { failureThreshold, indexVaries, isIrrigated, rankedRotations, rotationLabel, seasonsFailed } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord, fmtIndex, fmtMm, fmtNum, fmtP, fmtPct, isNum, yearList } from '../../lib/format'
import type { AnalysisEnvelope, AnalysisResult, Rotation } from '../../lib/types'
import { Callout } from '../components/controls'
import { isScenarioActive, scenarioText } from '../lib/config'
import { doyLabel } from '../lib/doy'
import { exposureSentence, fmtMetric, fmtMetricDelta, METRIC_BY_ID, METRICS, rankSpread, stabilitySentence, tradeoffs, tradeoffSentence, type Tradeoff } from '../lib/insights'
import { LIMIT_WORDS, OM_LEVELS, PROVENANCE_KINDS, SOIL_SOURCES, textureLabel, WATER_MODES, waterLabel } from '../lib/labels'
import { matchingTemplate } from '../lib/priorityTemplates'
import { CITATIONS, LIMITS } from '../results/ProvenanceTab'
import { rangeText, RotationBadges, Stat, TIP } from '../results/shared'
import { BareCalendar, IndexRange, PriorityWeights, ShiftChart, YearBars } from './charts'
import { BASIS_LABELS, buildChecklist, mergedSentences } from './checklist'

export const RAINFALL_CAUTION =
  'Rainfall estimates should be interpreted alongside local station records because gridded historical rainfall may differ from conditions measured at individual farms.'

export const BRIEF_DISCLAIMER =
  'HindSight provides historical decision-support simulations. Rankings are relative to the alternatives and assumptions evaluated. They are not guaranteed recommendations, yield forecasts, or substitutes for local agricultural expertise.'

/** How many alternatives the brief leads with. */
export const MAX_LEADS = 3

/** Everything the sections share, selected once from the envelope. */
export interface BriefData {
  env: AnalysisEnvelope
  res: AnalysisResult
  names: Record<string, string>
  ranked: Rotation[]
  total: number
  /** The rotation the engine marked as current, if any. */
  cur: Rotation | undefined
  /** Up to three rotations other than the current one, by rank. */
  alts: Rotation[]
  curIsTop: boolean
  irrigated: boolean
  thr: number | null
  early: string
  late: string
  scenarioOn: boolean
}

export function briefData(env: AnalysisEnvelope, names: Record<string, string>): BriefData {
  const res = env.result
  const ranked = rankedRotations(res)
  const cur = ranked.find((r) => r.is_current)
  const w = res.meta.windows
  return {
    env,
    res,
    names,
    ranked,
    total: ranked.length,
    cur,
    alts: ranked.filter((r) => !r.is_current).slice(0, MAX_LEADS),
    curIsTop: !!cur && ranked[0] === cur,
    irrigated: isIrrigated(env),
    thr: failureThreshold(env),
    early: w?.early ? `${w.early[0]}–${w.early[1]}` : 'the earlier period',
    late: w?.late ? `${w.late[0]}–${w.late[1]}` : 'the later period',
    scenarioOn: isScenarioActive(env.request?.scenario),
  }
}

/* ------------------------------------------------------------------ small parts */

export function Section({ n, title, lead, children }: { n: number; title: string; lead?: ReactNode; children: ReactNode }) {
  const id = `brief-section-${n}`
  return (
    <section
      aria-labelledby={id}
      className="rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-7 print:rounded-none print:border-t print:border-sand-400 print:px-0 print:pt-5 print:pb-1 print:shadow-none print:ring-0"
    >
      <header className="flex items-start gap-3.5 break-after-avoid">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-950 font-display text-[1rem] font-semibold text-lime tabular-nums">
          {n}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-[1.4375rem] leading-tight tracking-[-0.02em]">
            <span className="sr-only">{n}. </span>
            {title}
          </h2>
          {lead && <p className="mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-muted print:max-w-none">{lead}</p>}
        </div>
      </header>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  )
}

function Sub({ title, tip, children, className }: { title: string; tip?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <h3 className="flex items-center gap-1.5 text-[1.0625rem] leading-snug break-after-avoid">
        {title}
        {tip && <InfoTip label={title}>{tip}</InfoTip>}
      </h3>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0 break-inside-avoid', className)}>
      <dt className="text-[0.75rem] leading-tight font-bold text-muted">{label}</dt>
      <dd className="mt-0.5 text-[0.9375rem] leading-snug font-semibold text-forest-950">{children}</dd>
    </div>
  )
}

function Bullets({ items, empty }: { items: ReactNode[]; empty?: string }) {
  if (items.length === 0) return empty ? <p className="text-[0.9375rem] text-ink">{empty}</p> : null
  return (
    <ul className="space-y-1.5 text-[0.9375rem] leading-snug text-ink">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 break-inside-avoid">
          <span aria-hidden="true" className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />
          <span className="min-w-0">{t}</span>
        </li>
      ))}
    </ul>
  )
}

const NA = <span className="font-semibold text-muted">Not available</span>

/** "Median index" → "median index"; an abbreviation such as "P10 index" keeps its capital. */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)

/** The crops of a rotation in order, each with the sowing date the simulation used. */
export function CropSequence({ r, names }: { r: Rotation; names: Record<string, string> }) {
  const slots = [...r.slots].sort((a, b) => a.year_offset - b.year_offset || a.plant_doy - b.plant_doy)
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Crop sequence and sowing dates">
      {slots.map((s, i) => (
        <li key={i} className="rounded-full bg-sand px-2.5 py-1 text-[0.75rem] leading-tight font-bold text-ink">
          {r.cycle_years > 1 && <span className="font-extrabold text-forest-950">Year {s.year_offset + 1} · </span>}
          {names[s.crop_id] ?? s.crop_id} · sown {doyLabel(s.plant_doy)}
        </li>
      ))}
    </ol>
  )
}

/** A sentence the engine wrote, shown unchanged and attributed. */
function EngineQuote({ text, by }: { text: string; by: string }) {
  return (
    // The wrapper takes the spacing of the surrounding layout; a figure needs its own margins reset.
    <div className="break-inside-avoid">
      <figure className="m-0 rounded-2xl bg-sand/60 px-4 py-3.5">
        <blockquote className="m-0 text-[0.9375rem] leading-snug font-semibold text-forest-950">“{text}”</blockquote>
        <figcaption className="mt-1.5 text-[0.75rem] font-bold text-ink">{by}</figcaption>
      </figure>
    </div>
  )
}

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
        <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
          Yearly averages of the NASA POWER record for the grid cell that contains this field{grid ? ` (${grid})` : ''}.
        </p>
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
        These comparisons describe the past record only. A trend test asks whether the year-to-year change is more consistent than chance alone would usually give; it does not
        say how large or important a change is, and nothing here is a projection of future climate.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------ 3. existing rotation assessment */

export function CurrentAssessment({ d }: { d: BriefData }) {
  const { env, res, cur, names, thr, irrigated, total, early, late } = d
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
        <Stat label="Irrigation requirement" tip={TIP.irrigation} value={irrigated ? fmtMm(h.irrigation_mm_per_year) : 'None'} unit={irrigated ? 'a year' : 'rainfed'} />
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
        </Sub>
      )}

      <div className="break-inside-avoid">
        <BareCalendar
          rotation={cur}
          names={names}
          note={
            <>
              {exposureSentence(cur)} Over the whole cycle, a crop is in the ground on {fmtPct(cur.indicators.cover_frac)} of days, and{' '}
              {fmtPct(cur.indicators.erosive_rain_on_bare_frac)} of heavy-rain days (12.7 mm or more) fell while the soil was bare. That last figure is a heavy-rain exposure
              indicator, not a soil-loss estimate.
            </>
          }
        />
      </div>
    </Section>
  )
}

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
          </p>
        </>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ 5. evidence and limitations */

function soilStatus(env: AnalysisEnvelope): string[] {
  const used = env.result.site.soil_used?.source ?? env.inputs?.soil?.used
  const sg = env.inputs?.soil?.soilgrids
  const profile = env.inputs?.soil?.profile
  const out = [
    used === 'soilgrids'
      ? 'The soil values came from a SoilGrids profile for this location: an estimate for the top 30 cm of a 250 m grid square.'
      : used === 'farmer'
        ? 'The soil texture, organic matter level and depth were entered by the farmer.'
        : used === 'default'
          ? 'No soil information was given, so the engine used its default soil.'
          : 'The soil source was not recorded with this analysis.',
  ]
  if (sg === 'profile' && used !== 'soilgrids') out.push(`A SoilGrids profile is stored for this location${profile?.texture_class ? ` (${textureLabel(profile.texture_class).toLowerCase()})` : ''}, but this run used the values entered in the form.`)
  else if (sg === 'no_data') out.push('SoilGrids holds no data for this location.')
  else if (sg === 'unavailable') out.push('A SoilGrids profile was requested but could not be retrieved when the analysis ran.')
  else if (sg === 'not_cached') out.push('No SoilGrids profile is stored for this location.')
  else if (sg === 'not_requested') out.push('A SoilGrids profile was not requested for this run.')
  else if (!sg) out.push('The SoilGrids status was not recorded with this analysis.')
  return out
}

export function EvidenceSection({ d }: { d: BriefData }) {
  const { env, res, cur, alts, names } = d
  const req = env.request
  const rec = res.meta.record
  const climate = env.inputs?.climate
  const ndvi = env.inputs?.ndvi
  const check = res.validation?.ndvi_check
  const prov = res.provenance ?? []
  const about = [...(cur ? [cur] : []), ...alts]
  // The engine repeats one method sentence per rotation with that rotation's own figure; one instance is enough here.
  const evidence = mergedSentences(about, (r) => r.explanation?.evidence, true)
  const gaps = mergedSentences(about, (r) => r.explanation?.gaps)
  const notes = [...(env.notes ?? []), ...(res.meta.warnings ?? [])]
  const opts = req?.options
  const excluded = req?.constraints?.excluded_crops ?? []
  const scoped = (s: { text: string; scope: string | null }) => (
    <>
      {s.text}
      {s.scope && <span className="text-muted"> (for {s.scope})</span>}
    </>
  )
  return (
    <Section n={5} title="Evidence and limitations" lead="Where the numbers in this brief came from, what was checked against independent data, and what the model cannot tell you.">
      <Sub title="Data used in this run">
        {prov.length ? (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[34rem] border-collapse text-left text-[0.8125rem] print:min-w-0">
              <caption className="sr-only">Where each part of the analysis came from, as reported by the engine</caption>
              <thead>
                <tr className="text-[0.75rem] text-muted">
                  {['Part of the analysis', 'Kind', 'Source'].map((c) => (
                    <th key={c} scope="col" className="border-b border-border-strong py-2 pr-3 font-bold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prov.map((p) => (
                  <tr key={p.item} className="break-inside-avoid border-b border-border">
                    <th scope="row" className="py-2.5 pr-3 align-top font-bold text-forest-950">
                      {p.item}
                    </th>
                    <td className="py-2.5 pr-3 align-top font-semibold text-ink">{PROVENANCE_KINDS[p.kind]?.label ?? p.kind.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 align-top text-ink">{p.source === 'farmer' ? 'Entered by the farmer' : p.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[0.9375rem] text-ink">The engine did not return a list of data sources for this analysis.</p>
        )}
      </Sub>

      <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2 print:grid-cols-2">
        <Fact label="Weather record">
          {climate ? (
            <>
              {climate.source ?? 'NASA POWER'}
              <span className="mt-0.5 block text-[0.8125rem] font-semibold text-ink tabular-nums">
                {climate.start && climate.end ? `Daily data from ${climate.start} to ${climate.end}` : 'Dates not recorded'}
                {isNum(climate.days) ? ` · ${fmtNum(climate.days)} daily records` : ''}
                {climate.grid_note ? ` · ${climate.grid_note}` : ''}
              </span>
            </>
          ) : (
            <span className="font-semibold text-ink">The weather inputs were not recorded with this analysis.</span>
          )}
        </Fact>
        <Fact label="Historical period analysed">
          <span className="tabular-nums">
            {rec.start_year}–{rec.end_year} ({rec.end_year - rec.start_year + 1} years)
          </span>
          {climate?.start && Number(climate.start.slice(0, 4)) < rec.start_year && (
            <span className="mt-0.5 block text-[0.8125rem] font-semibold text-ink">Earlier days in the weather record only warm up the soil-water balance.</span>
          )}
        </Fact>
        <Fact label="Soil-source status">
          <span className="block text-[0.875rem] font-semibold text-ink">{soilStatus(env).join(' ')}</span>
        </Fact>
        <Fact label="Scenario">
          {d.scenarioOn ? (
            <>
              Hypothetical what-if adjustment: {scenarioText(req?.scenario)}
              <span className="mt-0.5 block text-[0.8125rem] font-semibold text-ink">Applied uniformly to every day of the historical record. Not a forecast.</span>
            </>
          ) : req?.scenario ? (
            'Historical baseline (no adjustment)'
          ) : (
            NA
          )}
        </Fact>
        <Fact label="Settings of this run" className="md:col-span-2 print:col-span-2">
          <span className="block text-[0.875rem] font-semibold text-ink tabular-nums">
            {opts
              ? [
                  isNum(opts.failure_threshold) ? `Failure line ${opts.failure_threshold.toFixed(2)}` : null,
                  opts.apply_legume_effect === false ? 'legume effect switched off' : opts.apply_legume_effect === true ? 'legume effect on (flat +20% on the next non-legume crop)' : null,
                  isNum(opts.top_n) ? `up to ${opts.top_n} alternatives requested` : null,
                  isNum(req?.constraints?.max_cycle_years) ? `cycles of up to ${req.constraints.max_cycle_years} years` : null,
                  excluded.length ? `crops excluded: ${excluded.map((c) => names[c] ?? c).join(', ')}` : 'no crop excluded',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'The settings were not recorded with this analysis.'}
          </span>
        </Fact>
      </dl>

      <Sub title="Independent vegetation-greenness check (optional)">
        {check ? (
          <div className="text-[0.9375rem] leading-relaxed text-ink">
            <p>
              <strong className="font-extrabold text-forest-950 tabular-nums">
                Performed: r = {fmtNum(check.r, 2)} over {check.n_years} years ({fmtP(check.p_value)}).
              </strong>{' '}
              This is the correlation between peak MODIS greenness in the crop months and the current rotation’s yearly index. A value of +1 would mean they rise and fall together
              every year; 0 means no relationship.
            </p>
            {check.note && <p className="mt-1.5 text-[0.875rem] text-ink">Engine note: {check.note}</p>}
            {ndvi?.point && (
              <p className="mt-1.5 text-[0.8125rem] text-muted tabular-nums">
                NDVI pixel at {ndvi.point.lat.toFixed(2)}, {ndvi.point.lon.toFixed(2)}
                {ndvi.source ? ` · ${ndvi.source}` : ''}
                {isNum(ndvi.good_quality_observations) && isNum(ndvi.observations) ? ` · ${ndvi.good_quality_observations} good-quality observations of ${ndvi.observations}` : ''}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            <strong className="font-extrabold text-forest-950">Not available for this analysis.</strong>{' '}
            {ndvi?.reason ??
              (ndvi?.used === false
                ? 'No MODIS NDVI series is stored for this location, so the optional check was skipped.'
                : 'The engine reports this check only when the season index varies from year to year and at least 8 years overlap with the satellite record.')}
          </p>
        )}
        <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
          MODIS NDVI measures how green the vegetation is. It is not crop yield, one 250 m pixel can mix several fields, and the check never feeds back into the model.
        </p>
      </Sub>

      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2 print:grid-cols-2">
        <Sub title="Methods, as reported by the engine">
          <Bullets items={evidence.map(scoped)} empty="The engine returned no method notes for these rotations." />
          <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
            Each analysis also re-ranks the rotations with rainfall 30% lower and 30% higher, and with the legume effect at 0%, 7%, 20% and 32%. The rank ranges in section 4 come
            from those tests.
          </p>
        </Sub>
        <Sub title="Information gaps, as reported by the engine">
          <Bullets items={gaps.map(scoped)} empty="The engine returned no information gaps for these rotations." />
        </Sub>
      </div>

      {notes.length > 0 && (
        <Sub title="Notes returned with this run">
          <Bullets items={notes} />
        </Sub>
      )}

      <Sub title="What this analysis can and cannot tell you">
        <dl className="grid gap-x-10 gap-y-4 md:grid-cols-2 print:grid-cols-2">
          {LIMITS.map((l) => (
            <div key={l.title} className="min-w-0 break-inside-avoid">
              <dt className="text-[0.875rem] font-extrabold text-forest-950">{l.title}</dt>
              <dd className="mt-0.5 text-[0.8125rem] leading-snug text-ink">{l.body}</dd>
            </div>
          ))}
        </dl>
      </Sub>

      <Sub title="Source credits">
        <ul className="space-y-2.5 text-[0.8125rem] leading-snug text-ink">
          {CITATIONS.map((c) => (
            <li key={c.name} className="break-inside-avoid">
              <strong className="font-extrabold text-forest-950">{c.name}.</strong> {c.text}{' '}
              {c.href && (
                <a href={c.href} target="_blank" rel="noreferrer noopener" className="font-bold break-all text-forest-950 underline decoration-sage underline-offset-2 hover:decoration-forest-950">
                  {c.href.replace(/^https?:\/\//, '')}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.8125rem] leading-snug text-muted">HindSight uses these public datasets. It is not affiliated with or endorsed by NASA, ISRIC or FAO.</p>
      </Sub>
    </Section>
  )
}

/* ------------------------------------------------------------------ 6. local verification checklist */

export function VerificationChecklist({ d }: { d: BriefData }) {
  const { env, cur, alts, curIsTop, names } = d
  const leads = curIsTop && cur ? [cur, ...alts] : alts.length ? alts : cur ? [cur] : []
  const items = buildChecklist(env, leads, names, LIMITS.map((l) => l.title))
  return (
    <Section
      n={6}
      title="Local verification checklist"
      lead="Checks to make with people who know your land before changing a rotation. Each one names what it rests on: a sentence the engine returned, a documented limit of the model, or a value from this analysis."
    >
      {items.length === 0 ? (
        <p className="text-[0.9375rem] text-ink">The engine returned no local-review items for this analysis.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="break-inside-avoid rounded-2xl bg-sand/45 p-4 print:rounded-none print:border-b print:border-sand-300 print:bg-transparent print:px-0 print:py-3">
              <label className="flex cursor-pointer items-start gap-3 print:cursor-auto">
                <input type="checkbox" className="peer sr-only" />
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-forest-950 bg-white text-transparent transition-colors peer-checked:bg-forest-950 peer-checked:text-lime peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest-950"
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.4l2.3 2.3 4.7-5.2" />
                  </svg>
                </span>
                <span className="min-w-0 font-display text-[1rem] leading-snug font-semibold text-forest-950">{item.check}</span>
              </label>
              <ul className="mt-2 space-y-1 pl-8 text-[0.8125rem] leading-snug text-ink">
                {item.basis.map((b, i) => (
                  <li key={i}>
                    <span className="font-extrabold text-forest-950">{BASIS_LABELS[b.kind]}:</span> {b.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[0.8125rem] leading-snug text-muted">
        The tick boxes are for your own use on screen or on paper. HindSight does not store them.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------ 7. disclaimer */

export function DisclaimerSection() {
  return (
    <Section n={7} title="Disclaimer">
      <p data-brief-disclaimer className="break-inside-avoid rounded-2xl bg-sand/60 p-4 text-[1rem] leading-relaxed font-semibold text-forest-950 print:rounded-none print:border print:border-forest-950 print:bg-transparent">
        {BRIEF_DISCLAIMER}
      </p>
    </Section>
  )
}
