import { CloudRain, Droplets, History, Layers, MapPin, Pencil, SlidersHorizontal, Sprout, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { cx } from '../../lib/cx'
import { fmtCoord } from '../../lib/format'
import { Callout } from '../components/controls'
import { isScenarioActive, rotationBody, scenarioText } from '../lib/config'
import { doyLabel } from '../lib/doy'
import { PRIORITIES, PRIORITY_ORDER, SOIL_SOURCES, textureLabel, waterLabel } from '../lib/labels'
import { RunProgress } from '../results/RunProgress'
import { useRotationPreview } from '../state/useRotationPreview'
import { useWorkspace } from '../state/workspace'
import { StepFrame } from './StepFrame'
import type { StepId } from './steps'

function Section({ icon, title, onEdit, children, tone }: { icon: ReactNode; title: string; onEdit: () => void; children: ReactNode; tone?: 'scenario' }) {
  return (
    <section className={cx('flex flex-col rounded-2xl p-4 ring-1', tone === 'scenario' ? 'bg-signal-50 ring-signal/30' : 'bg-white ring-border')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[1.0625rem]">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-forest-950 text-lime">{icon}</span>
          {title}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-bold text-forest-950 ring-1 ring-border-strong transition-colors hover:bg-sand/70"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit<span className="sr-only"> {title}</span>
        </button>
      </div>
      <div className="mt-3 space-y-1 text-[0.9375rem] leading-snug text-ink">{children}</div>
    </section>
  )
}

export function ReviewStep({ onBack, onGo, onDone, issues }: { onBack: () => void; onGo: (s: StepId) => void; onDone: () => void; issues: Partial<Record<StepId, string>> }) {
  const { config, defaultPriorities, crops, run, analyse, cancelRun, body } = useWorkspace()
  const preview = useRotationPreview(rotationBody(config))
  const names = new Map((crops.data?.crops ?? []).map((c) => [c.id, c.name]))
  const { location, soil, water, options, scenario } = config
  const custom = location.preset_id === null
  const scenarioOn = isScenarioActive(scenario)
  const problems = [...Object.values(issues), preview.status === 'invalid' ? preview.error : null].filter(Boolean) as string[]
  const ready = problems.length === 0 && !!body && preview.status !== 'loading'
  const weights = PRIORITY_ORDER.map((k) => ({ k, v: config.priorities[k] ?? defaultPriorities[k] ?? 0 }))
  const rated = Object.entries(config.market_rating)

  const start = async () => {
    if (await analyse()) onDone()
  }

  if (run.status !== 'idle') {
    return (
      <section aria-labelledby="run-title" className="animate-rise">
        <h1 id="run-title" className="sr-only">
          Running the analysis
        </h1>
        <RunProgress run={run} onRetry={start} onCancel={cancelRun} onEdit={cancelRun} />
      </section>
    )
  }

  return (
    <StepFrame
      step="review"
      title="Everything ready?"
      intro="Check your settings. You can change any of them without losing the others."
      onBack={onBack}
      footer={
        <>
          <Button variant="secondary" onClick={() => onGo('field')}>
            Edit Settings
          </Button>
          <Button arrow size="lg" onClick={start} disabled={!ready} className="justify-between sm:justify-center">
            Analyse My Farm
          </Button>
        </>
      }
    >
      {problems.length > 0 && (
        <Callout tone="warn" title="A few things need attention before the analysis can run">
          <ul className="list-disc space-y-0.5 pl-4">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Section icon={<MapPin className="h-4 w-4" aria-hidden="true" />} title="Field location" onEdit={() => onGo('field')}>
          {location.lat !== null && location.lon !== null ? (
            <>
              <p className="font-extrabold text-forest-950">{location.name.trim() || `Field at ${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`}</p>
              <p className="tabular-nums">{fmtCoord(location.lat, location.lon)}</p>
              <p className="text-[0.8125rem] text-muted">
                {custom ? 'Custom field: weather will be downloaded from NASA POWER (about a minute).' : 'Demonstration farm: weather is already on hand.'}
              </p>
            </>
          ) : (
            <p className="font-bold text-signal-ink">No location chosen yet.</p>
          )}
        </Section>

        <Section icon={<Layers className="h-4 w-4" aria-hidden="true" />} title="Soil profile" onEdit={() => onGo('soil')}>
          {soil.source === 'soilgrids' ? (
            <p className="font-extrabold text-forest-950">SoilGrids estimate for this location</p>
          ) : (
            <p className="font-extrabold text-forest-950">
              {textureLabel(soil.texture_class)}, {soil.organic_matter_level} organic matter
            </p>
          )}
          <p>Effective depth {Number.isFinite(soil.depth_cm) ? `${soil.depth_cm} cm` : 'not set'}</p>
          <p className="text-[0.8125rem] text-muted">{SOIL_SOURCES[soil.source]}</p>
        </Section>

        <Section icon={water.mode === 'rainfed' ? <CloudRain className="h-4 w-4" aria-hidden="true" /> : <Droplets className="h-4 w-4" aria-hidden="true" />} title="Water access" onEdit={() => onGo('soil')}>
          <p className="font-extrabold text-forest-950">{waterLabel(water.mode, water.mode === 'limited' ? water.seasonal_cap_mm : null)}</p>
        </Section>

        <Section icon={<Sprout className="h-4 w-4" aria-hidden="true" />} title="Current crop rotation" onEdit={() => onGo('rotation')}>
          {config.rotation.slots.length === 0 ? (
            <p className="font-bold text-signal-ink">No crops added yet.</p>
          ) : (
            <>
              <p className="font-extrabold text-forest-950">{preview.data?.name ?? `${config.rotation.cycle_years}-year cycle`}</p>
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {[...config.rotation.slots]
                  .sort((a, b) => a.year_offset * 365 + a.plant_doy - (b.year_offset * 365 + b.plant_doy))
                  .map((s) => (
                    <li key={s.key} className="rounded-full bg-sand px-2.5 py-1 text-[0.8125rem] font-bold text-ink">
                      {names.get(s.crop_id) ?? s.crop_id}
                      {config.rotation.cycle_years > 1 ? ` (year ${s.year_offset + 1})` : ''}, sown {doyLabel(s.plant_doy)}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Section>

        <Section icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />} title="Priorities" onEdit={() => onGo('priorities')}>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {weights.map(({ k, v }) => (
              <li key={k} className="flex items-center justify-between gap-3 text-[0.875rem]">
                <span className="font-bold">{PRIORITIES[k].short}</span>
                <span className="flex items-center gap-1.5">
                  <span className="flex gap-0.5" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <span key={d} className={cx('h-1.5 w-1.5 rounded-full', d <= v ? 'bg-forest-950' : 'bg-sand-400')} />
                    ))}
                  </span>
                  <span className="w-3 text-right font-extrabold text-forest-950 tabular-nums">{v}</span>
                </span>
              </li>
            ))}
          </ul>
          {rated.length > 0 && (
            <p className="pt-1 text-[0.8125rem] text-muted">Market ratings: {rated.map(([id, v]) => `${names.get(id) ?? id} ${v}`).join(', ')}.</p>
          )}
        </Section>

        <Section icon={<Wrench className="h-4 w-4" aria-hidden="true" />} title="Advanced assumptions" onEdit={() => onGo('scenario')}>
          <p>
            Failure line <strong className="font-extrabold tabular-nums">{options.failure_threshold.toFixed(2)}</strong> · legume effect{' '}
            <strong className="font-extrabold">{options.apply_legume_effect ? 'on (+20%)' : 'off'}</strong>
          </p>
          <p>
            Up to <strong className="font-extrabold tabular-nums">{options.top_n}</strong> alternatives · cycles up to{' '}
            <strong className="font-extrabold tabular-nums">{config.max_cycle_years}</strong> year{config.max_cycle_years > 1 ? 's' : ''}
          </p>
          <p className="text-[0.8125rem] text-muted">
            {config.excluded_crops.length ? `Left out of alternatives: ${config.excluded_crops.map((id) => names.get(id) ?? id).join(', ')}.` : 'No crops excluded.'}
          </p>
        </Section>

        <Section icon={<History className="h-4 w-4" aria-hidden="true" />} title="Historical scenario" onEdit={() => onGo('scenario')} tone={scenarioOn ? 'scenario' : undefined}>
          {scenarioOn ? (
            <>
              <p className="font-extrabold text-forest-950">What-if applied: {scenarioText(scenario)}</p>
              <p className="text-[0.8125rem]">Historical what-if scenario — not a climate forecast.</p>
            </>
          ) : (
            <p className="font-extrabold text-forest-950">The historical record as it was (no adjustment)</p>
          )}
        </Section>

        <section className="flex items-center rounded-2xl bg-forest-950 p-4 text-cream-50">
          <p className="text-[0.9375rem] leading-snug">
            HindSight will replay <strong className="font-extrabold text-lime">1985–2024</strong> day by day for your rotation and each alternative,
            then rank them by your priorities. Results are historical simulations, not forecasts.
          </p>
        </section>
      </div>
    </StepFrame>
  )
}
