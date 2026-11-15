import { CloudRain, History, RotateCcw, Thermometer } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { cx } from '../../lib/cx'
import { Callout, Card, Segmented, Slider, Toggle } from '../components/controls'
import { isScenarioActive } from '../lib/config'
import { useWorkspace } from '../state/workspace'
import { StepFrame } from './StepFrame'

export function ScenarioStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { config, update, crops } = useWorkspace()
  const { scenario, options } = config
  const limits = crops.data?.limits
  const list = crops.data?.crops ?? []
  const active = isScenarioActive(scenario)
  const pct = Math.round(scenario.precip_factor * 100)
  const setScenario = (patch: Partial<typeof scenario>) => update((c) => ({ ...c, scenario: { ...c.scenario, ...patch } }))
  const setOptions = (patch: Partial<typeof options>) => update((c) => ({ ...c, options: { ...c.options, ...patch } }))
  const toggleExcluded = (id: string) =>
    update((c) => ({ ...c, excluded_crops: c.excluded_crops.includes(id) ? c.excluded_crops.filter((x) => x !== id) : [...c.excluded_crops, id] }))
  const inRotation = new Set(config.rotation.slots.map((s) => s.crop_id))
  const topN = limits?.top_n ?? [2, 8]
  const advancedChanged =
    config.excluded_crops.length > 0 || config.max_cycle_years !== 3 || options.failure_threshold !== 0.5 || !options.apply_legume_effect || options.top_n !== 5

  return (
    <StepFrame
      step="scenario"
      title="What if historical conditions had been different?"
      intro="Explore how your rotation comparison changes when the historical weather record is adjusted."
      onBack={onBack}
      onNext={onNext}
      nextLabel="Review settings"
    >
      <Card as="section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-forest-950 px-3.5 py-1.5 text-[0.8125rem] font-extrabold text-cream-50">
            <History className="h-4 w-4 text-lime" aria-hidden="true" /> Historical what-if scenario — not a climate forecast.
          </p>
          <Button variant="secondary" icon={<RotateCcw />} disabled={!active} onClick={() => setScenario({ temp_delta_c: 0, precip_factor: 1 })}>
            Reset to the real record
          </Button>
        </div>
        <p className="mt-3 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
          The engine replays the same 1985–2024 days, with every day’s temperature shifted by the same amount and every day’s rainfall multiplied by
          the same factor. It does not create new weather, move rain to other dates, or predict the future.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className={cx('rounded-2xl p-4 ring-1', scenario.temp_delta_c !== 0 ? 'bg-signal-50 ring-signal/30' : 'bg-sand/60 ring-transparent')}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[1.125rem]">
                <Thermometer className="h-5 w-5 text-forest-800" aria-hidden="true" /> Temperature adjustment
              </h2>
              <p className="font-display text-[1.5rem] leading-none font-semibold text-forest-950 tabular-nums">
                {scenario.temp_delta_c > 0 ? '+' : scenario.temp_delta_c < 0 ? '−' : ''}
                {Math.abs(scenario.temp_delta_c).toFixed(1)} °C
              </p>
            </div>
            <div className="mt-3">
              <Slider
                label="Temperature adjustment in degrees Celsius"
                value={scenario.temp_delta_c}
                min={-3}
                max={3}
                step={0.5}
                origin={0}
                onChange={(v) => setScenario({ temp_delta_c: v })}
                format={(v) => `${v > 0 ? 'plus ' : v < 0 ? 'minus ' : ''}${Math.abs(v)} degrees Celsius`}
                ticks={[
                  { value: -3, label: '−3 °C' },
                  { value: 0, label: 'As recorded' },
                  { value: 3, label: '+3 °C' },
                ]}
              />
            </div>
            <p className="mt-3 text-[0.8125rem] leading-snug text-ink">Added to every day’s maximum and minimum temperature.</p>
          </div>

          <div className={cx('rounded-2xl p-4 ring-1', pct !== 100 ? 'bg-signal-50 ring-signal/30' : 'bg-sand/60 ring-transparent')}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[1.125rem]">
                <CloudRain className="h-5 w-5 text-forest-800" aria-hidden="true" /> Rainfall adjustment
              </h2>
              <p className="font-display text-[1.5rem] leading-none font-semibold text-forest-950 tabular-nums">{pct}%</p>
            </div>
            <div className="mt-3">
              <Slider
                label="Rainfall as a percentage of the recorded amount"
                value={pct}
                min={70}
                max={130}
                step={5}
                origin={100}
                onChange={(v) => setScenario({ precip_factor: v / 100 })}
                format={(v) => `${v} percent of recorded rainfall`}
                ticks={[
                  { value: 70, label: '70%' },
                  { value: 100, label: 'As recorded' },
                  { value: 130, label: '130%' },
                ]}
              />
            </div>
            <p className="mt-3 text-[0.8125rem] leading-snug text-ink">Every day’s rainfall is multiplied by this factor. Rain days stay where they were.</p>
          </div>
        </div>

        <Callout tone="plain" className="mt-5" title="Separate from the built-in robustness tests">
          Whatever you choose here, every analysis also re-ranks the rotations with rainfall 30% lower and 30% higher, and with the legume effect at 0%,
          7%, 20% and 32%. Those tests check how firm each rank is. They are reported on their own and are not this scenario.
        </Callout>
      </Card>

      <details className="group rounded-[1.5rem] bg-white shadow-hairline ring-1 ring-border" open={advancedChanged || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.5rem] px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-display text-[1.25rem] font-semibold text-forest-950">Advanced settings</span>
            <span className="block text-[0.875rem] text-muted">
              {advancedChanged ? 'You have changed some of these.' : 'Optional. The defaults suit most farms.'}
            </span>
          </span>
          <span className="rounded-full bg-sand px-3 py-1 text-[0.8125rem] font-bold text-forest-950 group-open:hidden">Show</span>
          <span className="hidden rounded-full bg-sand px-3 py-1 text-[0.8125rem] font-bold text-forest-950 group-open:inline">Hide</span>
        </summary>
        <div className="space-y-6 border-t border-border px-5 py-5 sm:px-6">
          <div>
            <h3 className="text-[1.0625rem]">Crops to leave out of the alternatives</h3>
            <p className="mt-1 text-[0.875rem] text-muted">For example because of seed, machinery or market limits. Your current rotation is always kept as it is.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {list.map((c) => {
                const off = config.excluded_crops.includes(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={off}
                      onClick={() => toggleExcluded(c.id)}
                      className={cx(
                        'rounded-full px-3.5 py-2 text-[0.875rem] font-bold ring-1 transition-colors',
                        off ? 'bg-forest-950 text-cream-50 ring-forest-950 line-through decoration-lime' : 'bg-white text-forest-950 ring-border-strong hover:bg-sand/70',
                      )}
                    >
                      {c.name}
                      <span className="sr-only">{off ? ' (excluded)' : ' (allowed)'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {config.excluded_crops.some((id) => inRotation.has(id)) && (
              <p className="mt-2 text-[0.8125rem] font-semibold text-muted">A crop in your current rotation is excluded: it stays in your rotation, but is not offered in alternatives.</p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-[1.0625rem]">Longest rotation to consider</h3>
              <p className="mt-1 mb-2.5 text-[0.875rem] text-muted">Alternatives with a longer cycle than this are left out.</p>
              <Segmented
                label="Maximum rotation cycle"
                value={config.max_cycle_years}
                onChange={(v) => update((c) => ({ ...c, max_cycle_years: v }))}
                options={[1, 2, 3].map((n) => ({ value: n, label: `${n} year${n > 1 ? 's' : ''}` }))}
              />
            </div>
            <div>
              <h3 className="text-[1.0625rem]">Number of alternatives to show</h3>
              <p className="mt-1 mb-2.5 text-[0.875rem] text-muted">The best-scoring alternatives are shown beside your current rotation. Fewer may be returned if fewer are valid.</p>
              <Segmented
                label="Number of alternatives"
                value={options.top_n}
                onChange={(v) => setOptions({ top_n: v })}
                options={Array.from({ length: topN[1] - topN[0] + 1 }, (_, i) => ({ value: topN[0] + i, label: String(topN[0] + i) }))}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[1.0625rem]">Failure line</h3>
              <p className="font-display text-[1.25rem] leading-none font-semibold text-forest-950 tabular-nums">{options.failure_threshold.toFixed(2)}</p>
            </div>
            <p className="mt-1 max-w-3xl text-[0.875rem] text-muted">
              A crop season counts as failed when its season index falls below this line. The default is 0.50. Raising it makes the test stricter, so
              more seasons count as failed; it does not change the simulated seasons themselves.
            </p>
            <div className="mt-2 max-w-xl">
              <Slider
                label="Failure threshold"
                value={options.failure_threshold}
                min={0.3}
                max={0.7}
                step={0.05}
                origin={0.5}
                onChange={(v) => setOptions({ failure_threshold: Math.round(v * 100) / 100 })}
                format={(v) => v.toFixed(2)}
                ticks={[
                  { value: 0.3, label: '0.30' },
                  { value: 0.5, label: '0.50 default' },
                  { value: 0.7, label: '0.70' },
                ]}
              />
            </div>
          </div>

          <Toggle
            checked={options.apply_legume_effect}
            onChange={(v) => setOptions({ apply_legume_effect: v })}
            label="Apply the legume effect"
            description={
              <>
                An assumption, not a measurement for your farm: the engine raises the season index of the next non-legume crop after a legume by a flat
                20%. Field studies range from +7% to +32%, so each analysis also shows how ranks move across 0%, 7%, 20% and 32%.
              </>
            }
          />
        </div>
      </details>
    </StepFrame>
  )
}
