// Content of the guided tour. Each step pairs a short narration (left) with the real application
// component for that part of the product (right). Nothing here is a mock-up: the numbers are read
// from the saved Chakwal engine output, and step 7 asks the engine for a fresh run.
import { BookOpenText, CloudRain, Droplets, FlaskConical, Layers, MapPin, Play, RotateCcw, Sprout, ThermometerSun, Zap } from 'lucide-react'
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ButtonRouterLink } from '../../components/ui/Button'
import { Mascot } from '../../components/ui/Mascot'
import { currentRotation, failureThreshold, rankedRotations, rotationLabel, seasonsFailed, topAlternative } from '../../lib/analysis'
import { fmtCoord, fmtIndex, fmtMm, fmtPct, yearList } from '../../lib/format'
import type { AnalysisEnvelope, Preset } from '../../lib/types'
import { Callout, Segmented } from '../components/controls'
import { ScenarioDisclaimer } from '../components/ScenarioDisclaimer'
import { requestFromEnvelope } from '../lib/config'
import { readShift, shiftSentence, stabilitySentence, tradeoffSentence, type RunInput } from '../lib/insights'
import { textureLabel } from '../lib/labels'
import { BASELINE, SCENARIO_PRESETS, scenarioSummary, toVariant, type ScenarioDef } from '../lib/scenarios'
import { CompareTab } from '../results/CompareTab'
import { DetailsTab } from '../results/DetailsTab'
import { RunProgress } from '../results/RunProgress'
import { Chip, Panel, rangeText } from '../results/shared'
import { useComparison } from '../state/useComparison'
import { useWorkspace } from '../state/workspace'

const ClimateInsights = lazy(() => import('../insights/ClimateInsights'))
const SeasonalExposure = lazy(() => import('../insights/SeasonalExposure'))
const RotationResilience = lazy(() => import('../insights/RotationResilience'))
const WaterResilience = lazy(() => import('../insights/WaterResilience'))
const RunComparison = lazy(() => import('../components/RunComparison'))
const DecisionBrief = lazy(() => import('../brief/DecisionBrief').then((m) => ({ default: m.DecisionBrief })))

export const TOUR_PRESET = 'chakwal'

export type TourStepId = 'challenge' | 'farm' | 'climate' | 'current' | 'alternatives' | 'tradeoffs' | 'scenario' | 'brief' | 'takeaway'

export const TOUR_STEPS: { id: TourStepId; title: string; short: string }[] = [
  { id: 'challenge', title: 'The challenge', short: 'The challenge' },
  { id: 'farm', title: 'Choose a real demonstration farm', short: 'A real farm' },
  { id: 'climate', title: 'Explore historical conditions', short: 'Historical conditions' },
  { id: 'current', title: 'Inspect the current rotation', short: 'Current rotation' },
  { id: 'alternatives', title: 'Compare alternatives', short: 'Alternatives' },
  { id: 'tradeoffs', title: 'Explore trade-offs', short: 'Trade-offs' },
  { id: 'scenario', title: 'Run a hypothetical scenario', short: 'A what-if scenario' },
  { id: 'brief', title: 'Review the decision brief', short: 'Decision brief' },
  { id: 'takeaway', title: 'The final takeaway', short: 'Takeaway' },
]

interface StepProps {
  step: TourStepId
  env: AnalysisEnvelope | null
  preset: Preset | undefined
  names: Record<string, string>
}

const Fallback = () => (
  <div role="status" aria-label="Loading" className="space-y-4">
    <div className="skeleton h-8 w-2/3 rounded-xl" />
    <div className="skeleton h-64 rounded-[1.5rem]" />
  </div>
)

const Loading = () => <p className="text-muted">Loading the demonstration analysis…</p>

function Facts({ items }: { items: (string | null | undefined | false)[] }) {
  const list = items.filter((x): x is string => !!x)
  if (!list.length) return null
  return (
    <ul className="space-y-2">
      {list.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ narration (left column) */

export function Narration({ step, env, preset }: StepProps) {
  const res = env?.result
  const cur = res ? currentRotation(res) : undefined
  const top = res ? topAlternative(res) : undefined
  const w = res?.meta.windows
  const early = w?.early ? `${w.early[0]}–${w.early[1]}` : 'the earlier period'
  const late = w?.late ? `${w.late[0]}–${w.late[1]}` : 'the later period'

  switch (step) {
    case 'challenge':
      return (
        <>
          <p>Farmers face changing rainfall, temperature, water availability and soil conditions. Choosing which crops to grow, and in what order, means balancing all of those pressures at once.</p>
          <p>
            A rotation that looks good in an average year can fail in a dry one. HindSight asks a simple question: <strong className="font-extrabold text-forest-950">how would this rotation, and the alternatives, have fared through the weather this land actually had?</strong>
          </p>
          <p className="text-muted">This tour takes about three to five minutes and uses the real application throughout.</p>
        </>
      )
    case 'farm':
      return (
        <>
          <p>We start with Chakwal, on the rainfed Pothwar Plateau in Punjab, Pakistan. Everything about this farm comes from the project’s preset and its stored NASA data.</p>
          <Facts
            items={[
              preset && `The field is at ${fmtCoord(preset.lat, preset.lon)} and is ${preset.water_label.toLowerCase()}.`,
              preset?.rotation_name && `Its current rotation is ${preset.rotation_name.toLowerCase()}.`,
              'The result you will see is saved engine output for this farm, and is labelled as such on every screen.',
            ]}
          />
        </>
      )
    case 'climate': {
      if (!res) return <Loading />
      const shifts = res.climate_shift ?? []
      const consistent = shifts.filter((s) => readShift(s).evidence === 'consistent' && readShift(s).direction !== 'little')
      const shown = (consistent.length ? consistent : shifts).slice(0, 2)
      return (
        <>
          <p>
            NASA POWER supplies daily weather since 1984 for the grid cell that contains this farm. HindSight compares {early} with {late} on six indicators and tests each for a
            consistent trend.
          </p>
          <Facts items={shown.map((s) => shiftSentence(s, early, late))} />
          <p className="text-muted">Rainfall from a 50 km grid cell can differ from a gauge on the farm, so the app keeps that caution next to the charts.</p>
        </>
      )
    }
    case 'current': {
      if (!res || !cur) return <Loading />
      const f = seasonsFailed(cur)
      const thr = failureThreshold(env)
      return (
        <>
          <p>
            The engine replays the current rotation, <strong className="font-extrabold text-forest-950">{rotationLabel(cur).toLowerCase()}</strong>, day by day through {res.meta.record.start_year}–
            {res.meta.record.end_year} with a soil-water balance, and scores each crop season with a seasonal index (not a yield).
          </p>
          <Facts
            items={[
              `Median seasonal index ${fmtIndex(cur.hindcast.median)}; in weaker years (lower decile) ${fmtIndex(cur.hindcast.p10)}.`,
              f && `${f.failed} of ${f.total} simulated crop seasons fell below the failure line${thr === null ? '' : ` of ${thr.toFixed(2)}`} (${fmtPct(cur.hindcast.failure_freq)}).`,
              cur.hindcast.worst_years?.years?.length ? `Its five weakest years in the record: ${yearList(cur.hindcast.worst_years.years)}.` : null,
            ]}
          />
          {cur.explanation?.summary && <p className="rounded-xl bg-sand/70 px-3 py-2 text-[0.875rem] text-ink">Engine summary: “{cur.explanation.summary}”</p>}
        </>
      )
    }
    case 'alternatives': {
      if (!res || !cur) return <Loading />
      const n = res.rotations.length
      return (
        <>
          <p>
            The engine simulates alternative rotations the same way and ranks all {n} by this farm’s priorities. The ranking is relative to these rotations and these weights: it is not a
            probability of success.
          </p>
          {top ? (
            <>
              <p>
                The highest-ranked alternative here is <strong className="font-extrabold text-forest-950">{rotationLabel(top)}</strong> (rank #{top.scores?.rank} of {n}); the current rotation ranks #
                {cur.scores?.rank}. The engine’s own reasons:
              </p>
              <Facts items={(top.explanation?.reasons ?? []).slice(0, 3)} />
            </>
          ) : (
            <p>The engine returned no alternative rotation for this analysis.</p>
          )}
        </>
      )
    }
    case 'tradeoffs': {
      if (!res || !cur) return <Loading />
      return (
        <>
          <p>No rotation wins on everything. HindSight shows where an alternative gains and what it costs, when the soil is bare, and how firmly each rank holds when uncertain assumptions are varied.</p>
          <Facts
            items={[
              top && tradeoffSentence(top, cur),
              top && stabilitySentence(top, cur),
              top && top.scores?.rank_range && top.scores?.rank_range_rain
                ? `${rotationLabel(top)} ranks ${rangeText(top.scores.rank_range)} across the legume-effect tests and ${rangeText(top.scores.rank_range_rain)} when rainfall is varied by 30% either way.`
                : null,
            ]}
          />
          <p className="text-muted">Use the three views on the right: robustness and trade-offs, seasonal cover, and water.</p>
        </>
      )
    }
    case 'scenario':
      return (
        <>
          <p>
            What if the same forty years had been drier, or warmer? The Scenario Lab applies a uniform adjustment to the historical record and asks the engine to run again. Pick a test and press
            the button: this step is a <strong className="font-extrabold text-forest-950">live analysis</strong>, calculated while you watch.
          </p>
          <p className="text-muted">It is a stress test of the ranking, not a climate projection. The required warning stays on screen with the result.</p>
        </>
      )
    case 'brief':
      return (
        <>
          <p>The Decision Brief gathers the analysis into one document: what was examined, how the current rotation performed, which alternatives ranked highest and why, the trade-offs, and what remains uncertain.</p>
          <p>It ends with a local verification checklist, because seed, markets, pests and local practice are outside the model. It can be printed or saved as a PDF, and exported as CSV or JSON.</p>
        </>
      )
    case 'takeaway':
      return (
        <>
          <p>You have seen the full path: a real location, four decades of observed weather, a transparent simulation, a ranked comparison with its trade-offs, a live stress test and a brief to take away.</p>
          <p className="text-muted">Now try it with your own field, or keep exploring Chakwal in the workspace.</p>
        </>
      )
  }
}

/* ------------------------------------------------------------------ stage (right column) */

const PRESSURES = [
  { icon: CloudRain, title: 'Rainfall', body: 'Rain arrives in different amounts and at different times from year to year, and heavy falls can land on bare soil.' },
  { icon: ThermometerSun, title: 'Temperature', body: 'Hot days and frost at the wrong stage of a crop’s season limit what it can do.' },
  { icon: Droplets, title: 'Water availability', body: 'Rainfed fields depend on water stored in the soil; irrigated fields depend on an allowance that may be limited.' },
  { icon: Layers, title: 'Soil condition', body: 'Cover, residues and legumes shape how the soil holds up over the years.' },
]

function ChallengeStage() {
  return (
    <div className="relative isolate overflow-hidden rounded-[1.75rem] bg-[linear-gradient(120deg,#e9edfb_0%,#f8f5ef_55%,#f6f6dc_100%)] p-6 ring-1 ring-white/70 ring-inset sm:p-9">
      <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_90%_at_80%_30%,black,transparent)]" />
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="max-w-2xl">
          <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Field Shift: adapting farms with NASA data</p>
          <h2 className="mt-2 text-[1.75rem] leading-[1.08] tracking-[-0.03em] sm:text-[2.25rem]">
            Choosing a crop rotation means balancing pressures that <span className="text-muted">keep changing.</span>
          </h2>
        </div>
        <Mascot name="blue" decorative className="animate-float mx-auto hidden w-32 md:block" sizes="128px" />
      </div>
      <ul className="mt-7 grid gap-3 sm:grid-cols-2">
        {PRESSURES.map((p) => (
          <li key={p.title} className="flex gap-3.5 rounded-[1.25rem] bg-white/85 p-4 ring-1 ring-border backdrop-blur">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime">
              <p.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[1.0625rem] leading-tight">{p.title}</h3>
              <p className="mt-1 text-[0.875rem] leading-snug text-ink">{p.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
        HindSight does not predict next season. It looks back: it replays rotations through the historical record for a location, so a farmer can compare options on evidence and weigh them
        with local knowledge.
      </p>
    </div>
  )
}

function FarmStage({ env, preset }: { env: AnalysisEnvelope; preset: Preset | undefined }) {
  const res = env.result
  const soil = res.site.soil_used
  const cs = res.site.climate_summary
  const status = preset?.data_status
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-950 text-lime">
              <MapPin className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[1.5rem] leading-tight tracking-[-0.02em]">{res.site.name}</h2>
              <p className="mt-0.5 text-[0.9375rem] font-semibold text-muted tabular-nums">
                {preset ? [preset.display.region, preset.display.country].filter(Boolean).join(', ') : 'Demonstration farm'} · {fmtCoord(res.site.lat, res.site.lon)}
              </p>
            </div>
          </div>
          <Chip tone="peri">One of three demonstration farms</Chip>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-border pt-5 text-[0.9375rem] sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1.5 font-bold text-muted">
              <Droplets className="h-4 w-4" aria-hidden="true" /> Water
            </dt>
            <dd className="mt-1 font-semibold text-forest-950">{preset?.water_label ?? '—'}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 font-bold text-muted">
              <Layers className="h-4 w-4" aria-hidden="true" /> Soil (farmer input)
            </dt>
            <dd className="mt-1 font-semibold text-forest-950">
              {textureLabel(soil?.texture_class)}
              {env.request?.soil?.depth_cm ? `, ${env.request.soil.depth_cm} cm deep` : ''}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-1.5 font-bold text-muted">
              <Sprout className="h-4 w-4" aria-hidden="true" /> Current rotation
            </dt>
            <dd className="mt-1 font-semibold text-forest-950">
              {preset?.rotation_name ?? '—'}
              {preset?.rotation_crops?.length ? (
                <span className="font-semibold text-ink"> ({preset.rotation_crops.map((c) => `${c.crop_name} sown ${c.plant_date}`).join('; ')})</span>
              ) : null}
            </dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="What the weather record says about this place">
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: 'Rain a year', value: fmtMm(cs?.annual_rain_mm), note: 'gridded estimate' },
              { label: 'Reference ET a year', value: fmtMm(cs?.annual_et0_mm), note: 'atmospheric demand' },
              { label: 'Mean temperature', value: cs?.mean_temp_c === undefined ? '—' : `${cs.mean_temp_c.toFixed(1)} °C`, note: `${res.meta.record.start_year}–${res.meta.record.end_year}` },
            ].map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-[0.75rem] leading-tight font-bold text-ink">{s.label}</dt>
                <dd className="mt-1 font-display text-[1.25rem] leading-none font-semibold text-forest-950 tabular-nums">{s.value}</dd>
                <dd className="mt-1 text-[0.75rem] text-muted">{s.note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[0.8125rem] leading-snug text-muted">Averages of the NASA POWER record for the grid cell that contains the farm, as reported by the engine.</p>
        </Panel>

        <Panel title="Data available for this farm">
          <ul className="space-y-2.5 text-[0.9375rem]">
            {[
              { ok: status?.nasa_power_cached, label: 'NASA POWER daily weather', detail: env.inputs?.climate?.start && env.inputs.climate.end ? `${env.inputs.climate.start} to ${env.inputs.climate.end}` : 'stored record' },
              { ok: status?.modis_ndvi_cached, label: 'MODIS NDVI (independent check only)', detail: res.validation?.ndvi_check ? 'check performed' : 'no check for this run' },
              { ok: status?.soilgrids === 'profile', label: 'SoilGrids profile (optional)', detail: status?.soilgrids === 'profile' ? 'available' : 'none here: the farmer’s soil description is used' },
              { ok: status?.saved_response, label: 'Saved engine output', detail: 'shown in this tour' },
            ].map((d) => (
              <li key={d.label} className="flex items-start gap-2.5">
                <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${d.ok ? 'bg-forest-800' : 'bg-sand-400'}`} />
                <span>
                  <span className="font-bold text-forest-950">{d.label}</span>
                  <span className="text-ink">
                    {' '}
                    · {d.ok === undefined ? 'status not loaded' : d.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function CurrentStage({ env, names }: { env: AnalysisEnvelope; names: Record<string, string> }) {
  const cur = currentRotation(env.result)
  const [selected, setSelected] = useState(cur?.id ?? '')
  return <DetailsTab env={env} names={names} selected={selected} onSelect={setSelected} />
}

function AlternativesStage({ env, names, onInspect }: { env: AnalysisEnvelope; names: Record<string, string>; onInspect: () => void }) {
  const ranked = useMemo(() => rankedRotations(env.result), [env.result])
  const [included, setIncluded] = useState<Set<string>>(() => new Set(ranked.map((r) => r.id)))
  const toggle = (id: string) =>
    setIncluded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return <CompareTab env={env} names={names} included={included} onToggle={toggle} onInspect={onInspect} />
}

const TRADEOFF_VIEWS = [
  { value: 'resilience', label: 'Robustness & trade-offs' },
  { value: 'season', label: 'Seasonal cover' },
  { value: 'water', label: 'Water' },
] as const

function TradeoffsStage({ env, names }: { env: AnalysisEnvelope; names: Record<string, string> }) {
  const [view, setView] = useState<(typeof TRADEOFF_VIEWS)[number]['value']>('resilience')
  return (
    <div className="space-y-4">
      <Segmented label="Trade-off view" value={view} onChange={setView} options={[...TRADEOFF_VIEWS]} />
      <Suspense fallback={<Fallback />}>
        {view === 'resilience' && <RotationResilience env={env} names={names} />}
        {view === 'season' && <SeasonalExposure env={env} names={names} />}
        {view === 'water' && <WaterResilience env={env} names={names} />}
      </Suspense>
    </div>
  )
}

const TOUR_SCENARIOS: ScenarioDef[] = SCENARIO_PRESETS.filter((s) => ['rain80', 'warm2', 'warm2rain80'].includes(s.id))

function ScenarioStage({ env, names }: { env: AnalysisEnvelope; names: Record<string, string> }) {
  const { defaultPriorities, presets } = useWorkspace()
  const cmp = useComparison()
  const [pick, setPick] = useState(TOUR_SCENARIOS[0].id)
  const chosen = TOUR_SCENARIOS.find((s) => s.id === pick) ?? TOUR_SCENARIOS[0]
  const ready = presets.status === 'ready'
  const start = () => {
    const base = requestFromEnvelope(env, defaultPriorities)
    if (base) void cmp.run(base, [toVariant(BASELINE), toVariant(chosen)])
  }
  const runs: RunInput[] =
    cmp.result?.variants.map((v) => {
      const def = [BASELINE, ...TOUR_SCENARIOS].find((s) => s.id === v.id)
      return { id: v.id, label: v.label, sublabel: def ? scenarioSummary(def) : undefined, envelope: v.envelope }
    }) ?? []

  return (
    <div className="space-y-4">
      <ScenarioDisclaimer />
      <Panel title="Choose a stress test and run the engine">
        <p className="max-w-3xl text-[0.9375rem] text-ink">
          The engine will run twice on the same Chakwal record, read once from storage: the historical baseline and the adjusted version you choose. Both runs are calculated now.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Segmented
            label="Hypothetical adjustment to the historical record"
            value={pick}
            onChange={(v) => {
              setPick(v)
              cmp.reset()
            }}
            options={TOUR_SCENARIOS.map((s) => ({ value: s.id, label: s.label, hint: scenarioSummary(s) }))}
          />
          <Button icon={cmp.status === 'done' ? <RotateCcw /> : <Play />} onClick={start} disabled={!ready || cmp.status === 'running'} loading={cmp.status === 'running'} data-tour-run>
            {cmp.status === 'done' ? 'Run again' : 'Run live analysis'}
          </Button>
        </div>
        <p className="mt-3 text-[0.8125rem] font-semibold text-muted tabular-nums">
          {chosen.label}: {scenarioSummary(chosen)}, applied uniformly to every day of 1985–2024.
        </p>
      </Panel>

      {(cmp.status === 'running' || cmp.status === 'error') && (
        <RunProgress
          run={cmp}
          onRetry={start}
          onCancel={cmp.cancel}
          title="Live analysis in progress…"
          failedTitle="The live analysis could not be completed"
          intro="The engine is replaying the baseline and the adjusted record for the current rotation and its alternatives."
        />
      )}

      {cmp.status === 'done' && runs.length > 0 && (
        <div className="space-y-3" data-tour-live-result>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="lime">
              <Zap className="h-3 w-3" aria-hidden="true" /> Live analysis
            </Chip>
            <span className="text-[0.8125rem] font-semibold text-muted tabular-nums">
              {runs.length} engine runs just now in {((cmp.result?.elapsed_ms ?? 0) / 1000).toFixed(1)} s
              {cmp.result?.weather_from_cache ? ', on the stored NASA POWER record' : ''}.
            </span>
          </div>
          <Suspense fallback={<Fallback />}>
            <RunComparison runs={runs} baselineId={BASELINE.id} kind="scenario" names={names} />
          </Suspense>
        </div>
      )}

      {cmp.status === 'idle' && (
        <Callout tone="plain">Nothing has been calculated on this step yet. Press “Run live analysis” to see the before-and-after comparison.</Callout>
      )}
    </div>
  )
}

function BriefStage({ env, names }: { env: AnalysisEnvelope; names: Record<string, string> }) {
  // The saved file carries no timestamp, so the brief is dated when it is opened.
  const at = useMemo(() => env.computed_at ?? new Date().toISOString(), [env.computed_at])
  return (
    <div className="rounded-[1.5rem] bg-white p-4 shadow-hairline ring-1 ring-border sm:p-6">
      <Suspense fallback={<Fallback />}>
        <DecisionBrief analysis={{ name: env.result.site.name, at, envelope: env }} names={names} embedded />
      </Suspense>
    </div>
  )
}

function TakeawayStage({ env, onRestart }: { env: AnalysisEnvelope | null; onRestart: () => void }) {
  const { saveEnvelope } = useWorkspace()
  const navigate = useNavigate()
  const openInWorkspace = () => {
    if (!env) return
    saveEnvelope(env, { name: env.result.site.name, open: true })
    navigate('/app/insights')
  }
  return (
    <div className="space-y-4">
      <div className="on-dark relative isolate overflow-hidden rounded-[1.75rem] bg-forest-950 p-7 sm:p-10">
        <div aria-hidden="true" className="bg-grid-dark absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_80%_90%_at_50%_0%,black,transparent)]" />
        <div aria-hidden="true" className="absolute -top-24 right-0 -z-10 h-64 w-[28rem] rounded-full bg-peri-600/20 blur-[100px]" />
        <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-sage uppercase">The core idea</p>
        <blockquote className="mt-3 max-w-4xl font-display text-[1.625rem] leading-[1.15] font-semibold tracking-[-0.025em] text-cream-50 sm:text-[2.25rem]">
          HindSight connects Earth observations, local farming information, and crop science to help farmers explore <span className="text-lime">more resilient rotation strategies.</span>
        </blockquote>
        <ul className="mt-7 grid gap-3 text-[0.9375rem] text-mist sm:grid-cols-3">
          <li className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <strong className="block font-display text-[1.0625rem] font-semibold text-cream-50">Every insight has evidence</strong>
            Numbers come from the engine’s replay of the historical record, with their sources shown.
          </li>
          <li className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <strong className="block font-display text-[1.0625rem] font-semibold text-cream-50">Every ranking has an explanation</strong>
            Reasons, benefits and trade-offs are built from the computed values, not written by a language model.
          </li>
          <li className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <strong className="block font-display text-[1.0625rem] font-semibold text-cream-50">Every uncertainty stays visible</strong>
            It is a hindcast, not a forecast, and it says what the farmer should still check locally.
          </li>
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ButtonRouterLink to="/app/analysis" size="lg" arrow className="justify-between">
          Analyse your own field
        </ButtonRouterLink>
        <Button size="lg" variant="secondary" icon={<FlaskConical />} onClick={openInWorkspace} disabled={!env}>
          Explore Chakwal further
        </Button>
        <ButtonRouterLink to="/app/science" size="lg" variant="secondary" icon={<BookOpenText />}>
          Read the science
        </ButtonRouterLink>
        <Button size="lg" variant="secondary" icon={<RotateCcw />} onClick={onRestart}>
          Start again
        </Button>
      </div>
      <p className="text-[0.8125rem] leading-snug text-muted">
        “Explore Chakwal further” copies the saved demonstration result into My Analyses on this device (still labelled as a saved result) and opens it in Field Intelligence.
      </p>
    </div>
  )
}

export function Stage({ step, env, preset, names, onGo, onRestart }: StepProps & { onGo: (id: TourStepId) => void; onRestart: () => void }): ReactNode {
  if (step === 'challenge') return <ChallengeStage />
  if (step === 'takeaway') return <TakeawayStage env={env} onRestart={onRestart} />
  if (!env) return null
  switch (step) {
    case 'farm':
      return <FarmStage env={env} preset={preset} />
    case 'climate':
      return (
        <Suspense fallback={<Fallback />}>
          <ClimateInsights env={env} names={names} />
        </Suspense>
      )
    case 'current':
      return <CurrentStage env={env} names={names} />
    case 'alternatives':
      return <AlternativesStage env={env} names={names} onInspect={() => onGo('current')} />
    case 'tradeoffs':
      return <TradeoffsStage env={env} names={names} />
    case 'scenario':
      return <ScenarioStage env={env} names={names} />
    case 'brief':
      return <BriefStage env={env} names={names} />
  }
}
