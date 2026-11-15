import { Check, CloudRain, Layers, Plus, RotateCcw, Save, Thermometer } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { Button } from '../../components/ui/Button'
import { cx } from '../../lib/cx'
import { Callout, Field, Slider, TextInput } from '../components/controls'
import { isBaseline, scenarioSummary, type ScenarioDef } from '../lib/scenarios'
import { Chip } from '../results/shared'
import type { Draft } from './labStore'
import { adjustmentKind, describeAdjustment, fmtRain, fmtTemp, sameAdjustment, sentenceCase } from './words'

export interface BuilderLimits {
  /** Lowest and highest temperature offset the engine accepts, in °C. */
  temp: [number, number]
  /** Lowest and highest rainfall multiplier the engine accepts. */
  rain: [number, number]
}

export const NAME_MAX = 60

function PresetButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'rounded-full px-3 py-1.5 text-left text-[0.8125rem] leading-snug font-bold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950',
        on ? 'bg-forest-950 text-cream-50 ring-forest-950' : 'bg-white text-forest-950 ring-border-strong hover:bg-sand/70',
      )}
    >
      {children}
    </button>
  )
}

function SliderCard({ icon, title, value, active, children }: { icon: ReactNode; title: string; value: string; active: boolean; children: ReactNode }) {
  return (
    <div className={cx('rounded-2xl p-4 ring-1 transition-colors duration-300', active ? 'bg-signal-50 ring-signal/30' : 'bg-sand/60 ring-transparent')}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[1.125rem] leading-tight">
          {icon} {title}
        </h3>
        <p className="font-display text-[1.625rem] leading-none font-semibold text-forest-950 tabular-nums">{value}</p>
      </div>
      {children}
    </div>
  )
}

/**
 * The two sliders a scenario is made of, with the built-in values as quick settings, and the form that
 * names and saves the result. It only edits the draft; running is done from the checklist.
 */
export function ScenarioBuilder({
  draft,
  onChange,
  limits,
  limitsError,
  onRetryLimits,
  presets,
  onSave,
  nameError,
  status,
  savedCount,
  maxSaved,
  include,
  headingRef,
}: {
  draft: Draft
  onChange: (patch: Partial<Draft>) => void
  /** Null until the API has reported the limits it accepts. */
  limits: BuilderLimits | null
  limitsError: string | null
  onRetryLimits: () => void
  /** The built-in scenarios, baseline included: their values become the quick settings. */
  presets: ScenarioDef[]
  onSave: () => void
  nameError: string | null
  status: { tone: 'ok' | 'warn'; text: string } | null
  savedCount: number
  maxSaved: number
  /** Whether the slider values are ticked for the next comparison, and why they cannot be when they cannot. */
  include: { on: boolean; blocked: string | null; onToggle: () => void }
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const baseline = isBaseline(draft)
  const tempPresets = presets.filter((p) => adjustmentKind(p) === 'none' || adjustmentKind(p) === 'temperature')
  const rainPresets = presets.filter((p) => adjustmentKind(p) === 'none' || adjustmentKind(p) === 'rainfall')
  const combined = presets.filter((p) => adjustmentKind(p) === 'combined')
  const pct = Math.round(draft.precip_factor * 100)

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="text-[1.375rem] leading-tight tracking-[-0.02em] outline-none">
        Build your own stress test
      </h2>
      <p className="mt-1 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
        Move one slider or both. The engine replays the same days of the record with every day’s temperature shifted by the same amount and every day’s rainfall multiplied by the same
        factor.
      </p>

      {!limits ? (
        limitsError ? (
          <Callout tone="warn" className="mt-4" title="The allowed range could not be loaded">
            {limitsError} The built-in scenarios can still be run.{' '}
            <button type="button" onClick={onRetryLimits} className="font-extrabold text-forest-950 underline underline-offset-2">
              Try again
            </button>
          </Callout>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2" role="status" aria-label="Loading the allowed range">
            <div className="skeleton h-52 rounded-2xl" />
            <div className="skeleton h-52 rounded-2xl" />
          </div>
        )
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SliderCard icon={<Thermometer className="h-5 w-5 text-forest-800" aria-hidden="true" />} title="Temperature stress test" value={fmtTemp(draft.temp_delta_c)} active={draft.temp_delta_c !== 0}>
              <div className="mt-3">
                <Slider
                  label="Temperature adjustment in degrees Celsius"
                  value={draft.temp_delta_c}
                  min={limits.temp[0]}
                  max={limits.temp[1]}
                  step={0.5}
                  origin={0}
                  onChange={(v) => onChange({ temp_delta_c: v })}
                  format={(v) => `${v > 0 ? 'plus ' : v < 0 ? 'minus ' : ''}${Math.abs(v)} degrees Celsius`}
                  ticks={[
                    { value: limits.temp[0], label: fmtTemp(limits.temp[0]) },
                    { value: 0, label: 'As recorded' },
                    { value: limits.temp[1], label: fmtTemp(limits.temp[1]) },
                  ]}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Temperature quick settings">
                {tempPresets.map((p) => (
                  <PresetButton key={p.id} on={draft.temp_delta_c === p.temp_delta_c} onClick={() => onChange({ temp_delta_c: p.temp_delta_c })}>
                    {adjustmentKind(p) === 'none' ? 'Baseline' : p.label} <span className="tabular-nums opacity-80">{fmtTemp(p.temp_delta_c)}</span>
                  </PresetButton>
                ))}
              </div>
              <p className="mt-3 text-[0.8125rem] leading-snug text-ink">Added to every day’s maximum and minimum temperature. Use the slider for a value of your own, in steps of 0.5 °C.</p>
            </SliderCard>

            <SliderCard icon={<CloudRain className="h-5 w-5 text-forest-800" aria-hidden="true" />} title="Precipitation stress test" value={fmtRain(draft.precip_factor)} active={pct !== 100}>
              <div className="mt-3">
                <Slider
                  label="Rainfall as a percentage of the recorded amount"
                  value={pct}
                  min={Math.round(limits.rain[0] * 100)}
                  max={Math.round(limits.rain[1] * 100)}
                  step={5}
                  origin={100}
                  onChange={(v) => onChange({ precip_factor: v / 100 })}
                  format={(v) => `${v} percent of recorded rainfall`}
                  ticks={[
                    { value: Math.round(limits.rain[0] * 100), label: fmtRain(limits.rain[0]) },
                    { value: 100, label: 'As recorded' },
                    { value: Math.round(limits.rain[1] * 100), label: fmtRain(limits.rain[1]) },
                  ]}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Rainfall quick settings">
                {rainPresets.map((p) => (
                  <PresetButton key={p.id} on={pct === Math.round(p.precip_factor * 100)} onClick={() => onChange({ precip_factor: p.precip_factor })}>
                    {adjustmentKind(p) === 'none' ? 'Baseline' : p.label} <span className="tabular-nums opacity-80">{fmtRain(p.precip_factor)}</span>
                  </PresetButton>
                ))}
              </div>
              <p className="mt-3 text-[0.8125rem] leading-snug text-ink">Every day’s rainfall is multiplied by this factor; rain days stay where they were. Use the slider for a value of your own, in steps of 5%.</p>
            </SliderCard>
          </div>

          <div className="mt-4 rounded-2xl bg-cream-50 p-4 ring-1 ring-border">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-[1.125rem] leading-tight">
                  <Layers className="h-5 w-5 text-forest-800" aria-hidden="true" /> Your adjustment
                </h3>
                <p className="mt-1.5 text-[0.9375rem] leading-snug font-extrabold text-forest-950" aria-live="polite">
                  {sentenceCase(scenarioSummary(draft))}
                </p>
                <p className="mt-0.5 text-[0.8125rem] leading-snug font-semibold text-ink">{describeAdjustment(draft)}.</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {combined.map((p) => (
                  <PresetButton key={p.id} on={sameAdjustment(draft, p)} onClick={() => onChange({ temp_delta_c: p.temp_delta_c, precip_factor: p.precip_factor })}>
                    {p.label}{' '}
                    <span className="tabular-nums opacity-80">
                      {fmtTemp(p.temp_delta_c)}, {fmtRain(p.precip_factor)}
                    </span>
                  </PresetButton>
                ))}
                <button
                  type="button"
                  disabled={baseline}
                  onClick={() => onChange({ temp_delta_c: 0, precip_factor: 1 })}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-bold text-forest-950 ring-1 ring-border-strong transition-colors hover:bg-sand/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset to the record
                </button>
              </div>
            </div>

            <div className="mt-4 grid items-start gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Field
                label="Name this scenario to keep it"
                error={nameError}
                hint={
                  <>
                    Saved on this device only: no account, nothing is uploaded. {savedCount} of {maxSaved} saved.
                  </>
                }
              >
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={draft.name}
                    maxLength={NAME_MAX}
                    placeholder="For example: Hot, dry test"
                    onChange={(e) => onChange({ name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSave()
                    }}
                  />
                )}
              </Field>
              <div className="sm:pt-[1.6875rem]">
                <Button variant="secondary" icon={<Save />} onClick={onSave} disabled={baseline} className="w-full sm:w-auto">
                  Save on this device
                </Button>
              </div>
            </div>
            {baseline && <p className="mt-2 text-[0.8125rem] font-semibold text-muted">Move a slider first: the baseline is always included and does not need saving.</p>}
            {status && (
              <p role="status" className={cx('mt-3 flex flex-wrap items-center gap-2 text-[0.875rem] leading-snug font-bold', status.tone === 'ok' ? 'text-forest-950' : 'text-signal-ink')}>
                <Chip tone={status.tone === 'ok' ? 'lime' : 'signal'}>{status.tone === 'ok' ? 'Saved' : 'Not saved on this device'}</Chip>
                <span className="min-w-0">{status.text}</span>
              </p>
            )}
            {!baseline && (
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
                <button
                  type="button"
                  aria-pressed={include.on}
                  disabled={!include.on && !!include.blocked}
                  onClick={include.onToggle}
                  data-include-custom
                  className={cx(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.875rem] font-extrabold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950',
                    'disabled:cursor-not-allowed disabled:opacity-55',
                    include.on ? 'bg-lime-100 text-forest-950 ring-forest-950/35' : 'bg-forest-950 text-cream-50 ring-forest-950 hover:bg-forest-900',
                  )}
                >
                  {include.on ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                  {include.on ? 'Included in the next comparison' : 'Include in the next comparison'}
                </button>
                <p className="min-w-0 flex-1 basis-56 text-[0.8125rem] leading-snug text-muted">
                  {include.blocked && !include.on ? include.blocked : 'Runs with the ticked scenarios whether or not it is saved. It appears in the checklist under Your scenarios.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
