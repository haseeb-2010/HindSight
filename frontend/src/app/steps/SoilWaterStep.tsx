import { CloudRain, Droplets, Gauge, Layers, LoaderCircle, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { InfoTip } from '../../components/ui/InfoTip'
import { api } from '../../lib/api'
import { fmtNum } from '../../lib/format'
import type { SoilLookup, SoilResolved } from '../../lib/types'
import { Callout, Card, ChoiceCard, Field, MascotNote, Segmented, SelectInput, TextInput } from '../components/controls'
import { OM_LEVELS, TEXTURES, WATER_MODES, textureLabel } from '../lib/labels'
import { useWorkspace } from '../state/workspace'
import { StepFrame } from './StepFrame'

// Answers worth remembering for the session; "unavailable" is left out so it can be retried.
const lookups = new Map<string, SoilLookup>()

type LookupState = { status: 'idle' | 'loading' | 'ready'; data: SoilLookup | null }

function Derived({ label, tip, value, unit }: { label: string; tip: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 ring-1 ring-forest-950/[0.06]">
      <dt className="flex items-center gap-1 text-[0.75rem] font-bold text-ink">
        {label} <InfoTip label={label}>{tip}</InfoTip>
      </dt>
      <dd className="mt-1 font-display text-[1.375rem] leading-none font-semibold text-forest-950 tabular-nums">
        {value} <span className="font-sans text-[0.75rem] font-bold text-ink">{unit}</span>
      </dd>
    </div>
  )
}

export function SoilWaterStep({ onBack, onNext, issue }: { onBack: () => void; onNext: () => void; issue?: string }) {
  const { config, update, crops } = useWorkspace()
  const { lat, lon } = config.location
  const { soil, water } = config
  const limits = crops.data?.limits
  const key = `${lat},${lon}`
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle', data: null })
  const [resolved, setResolved] = useState<SoilResolved | null>(null)

  const runLookup = useCallback(
    (signal?: AbortSignal) => {
      if (lat === null || lon === null) return
      setLookup({ status: 'loading', data: null })
      api
        .soilLookup(lat, lon, signal)
        .then((data) => {
          if (data.status !== 'unavailable') lookups.set(key, data)
          if (!signal?.aborted) setLookup({ status: 'ready', data })
        })
        .catch(() => {
          // the lookup is optional: a failed request is the same to the farmer as "no answer"
          if (!signal?.aborted)
            setLookup({
              status: 'ready',
              data: {
                status: 'unavailable', profile: null, lat, lon, source_label: 'SoilGrids — 250 m soil data',
                message: 'SoilGrids could not be reached just now. You can enter the soil yourself and carry on.',
                depth_note: '',
              },
            })
        })
    },
    [lat, lon, key],
  )

  useEffect(() => {
    const cached = lookups.get(key)
    if (cached) {
      setLookup({ status: 'ready', data: cached })
      return
    }
    const ctrl = new AbortController()
    runLookup(ctrl.signal)
    return () => ctrl.abort()
  }, [key, runLookup])

  // The soil-water values the engine itself derives for the current inputs.
  useEffect(() => {
    if (lat === null || lon === null) return
    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      api
        .soilResolve({ lat, lon, soil_source: soil.source, soil: { texture_class: soil.texture_class, organic_matter_level: soil.organic_matter_level, depth_cm: soil.depth_cm } }, ctrl.signal)
        .then((r) => !ctrl.signal.aborted && setResolved(r))
        .catch(() => !ctrl.signal.aborted && setResolved(null))
    }, 200)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [lat, lon, soil.source, soil.texture_class, soil.organic_matter_level, soil.depth_cm])

  const profile = lookup.data?.status === 'profile' ? lookup.data.profile : null
  const usingGrids = soil.source === 'soilgrids' && !!profile
  const setSoil = (patch: Partial<typeof soil>) => update((c) => ({ ...c, soil: { ...c.soil, ...patch } }))
  const setWater = (patch: Partial<typeof water>) => update((c) => ({ ...c, water: { ...c.water, ...patch } }))
  const depthRange = limits?.depth_cm ?? [20, 300]
  const capRange = limits?.seasonal_cap_mm ?? [10, 2000]
  const depthBad = !(soil.depth_cm >= depthRange[0] && soil.depth_cm <= depthRange[1])
  const capBad = water.mode === 'limited' && !(water.seasonal_cap_mm >= capRange[0] && water.seasonal_cap_mm <= capRange[1])

  return (
    <StepFrame
      step="soil"
      title="Tell us a little about your soil."
      intro="Your soil helps determine how much water can be stored and made available to crops."
      onBack={onBack}
      onNext={onNext}
      nextLabel="Continue to Crop Rotation"
      issue={issue}
    >
      <Card as="section">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* SoilGrids suggestion */}
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-forest-800" aria-hidden="true" />
              <h2 className="text-[1.25rem]">SoilGrids suggestion</h2>
            </div>
            <p className="mt-1 text-[0.8125rem] font-bold text-muted">SoilGrids — 250 m soil data · optional</p>

            <div aria-live="polite" className="mt-4">
              {lookup.status === 'loading' && (
                <p className="flex items-center gap-2 rounded-2xl bg-sand/60 p-4 text-[0.875rem] font-semibold text-ink">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Asking SoilGrids about this location… You can fill in the soil
                  yourself meanwhile.
                </p>
              )}
              {lookup.status === 'ready' && profile && (
                <div className="rounded-2xl bg-peri-50 p-4 ring-1 ring-peri">
                  <p className="text-[0.875rem] font-semibold text-ink">{lookup.data?.message}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[0.875rem]">
                    <div>
                      <dt className="text-[0.75rem] font-bold text-ink">Suggested texture</dt>
                      <dd className="font-extrabold text-forest-950">{textureLabel(profile.texture_class)}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.75rem] font-bold text-ink">Organic matter</dt>
                      <dd className="font-extrabold text-forest-950 tabular-nums">{profile.organic_matter_pct === null ? 'Not reported' : `${fmtNum(profile.organic_matter_pct, 1)}%`}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.75rem] font-bold text-ink">Sand</dt>
                      <dd className="font-extrabold text-forest-950 tabular-nums">{fmtNum(profile.sand_pct, 1)}%</dd>
                    </div>
                    <div>
                      <dt className="text-[0.75rem] font-bold text-ink">Clay</dt>
                      <dd className="font-extrabold text-forest-950 tabular-nums">{fmtNum(profile.clay_pct, 1)}%</dd>
                    </div>
                    {profile.ph !== null && (
                      <div className="col-span-2">
                        <dt className="text-[0.75rem] font-bold text-ink">pH (for information; not used by the model)</dt>
                        <dd className="font-extrabold text-forest-950 tabular-nums">{fmtNum(profile.ph, 1)}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="mt-3 text-[0.8125rem] leading-snug text-ink">{lookup.data?.depth_note} Estimates for a 250 m grid square, not a test of your soil.</p>
                </div>
              )}
              {lookup.status === 'ready' && !profile && (
                <div className="space-y-3">
                  <MascotNote mascot="mint">{lookup.data?.message}</MascotNote>
                  {lookup.data?.status === 'unavailable' && (
                    <Button variant="secondary" icon={<RefreshCw />} onClick={() => runLookup()}>
                      Ask SoilGrids again
                    </Button>
                  )}
                </div>
              )}
            </div>

            {profile && (
              <div className="mt-4">
                <Segmented
                  label="Soil information to use"
                  value={usingGrids ? 'soilgrids' : 'farmer'}
                  onChange={(v) => setSoil({ source: v })}
                  options={[
                    { value: 'soilgrids', label: 'Use SoilGrids information' },
                    { value: 'farmer', label: 'Enter or override manually' },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Farmer inputs */}
          <div className="space-y-4">
            <h2 className="text-[1.25rem]">{usingGrids ? 'Soil used for the analysis' : 'Your soil'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Soil texture" hint={usingGrids ? 'From SoilGrids, with its own sand and clay percentages.' : TEXTURES[soil.texture_class]?.hint}>
                {({ id, describedBy }) => (
                  <SelectInput
                    id={id}
                    aria-describedby={describedBy}
                    disabled={usingGrids}
                    value={usingGrids && profile ? profile.texture_class : soil.texture_class}
                    onChange={(e) => setSoil({ texture_class: e.target.value })}
                  >
                    {(crops.data?.soil_textures ?? Object.keys(TEXTURES)).map((t) => (
                      <option key={t} value={t}>
                        {textureLabel(t)}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              <Field
                label="Effective soil depth (cm)"
                error={depthBad ? `Enter a depth between ${depthRange[0]} and ${depthRange[1]} cm.` : null}
                hint="How deep roots can go before rock, gravel or a hard layer. 100 cm is a working assumption: please check it for your field."
              >
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="number"
                    inputMode="numeric"
                    min={depthRange[0]}
                    max={depthRange[1]}
                    step={5}
                    value={Number.isFinite(soil.depth_cm) ? soil.depth_cm : ''}
                    onChange={(e) => setSoil({ depth_cm: e.target.value === '' ? NaN : Number(e.target.value) })}
                  />
                )}
              </Field>
            </div>
            {usingGrids ? (
              <Callout tone="plain">
                Organic matter also comes from SoilGrids ({profile?.organic_matter_pct === null ? 'not reported, so the engine’s low default applies' : `${fmtNum(profile?.organic_matter_pct, 1)}%`}).
                SoilGrids does not report soil depth, so the depth above is yours to set.
              </Callout>
            ) : (
              <div>
                <p className="mb-1.5 text-[0.8125rem] font-extrabold text-forest-950">Organic matter level</p>
                <Segmented
                  label="Organic matter level"
                  value={soil.organic_matter_level}
                  onChange={(v) => setSoil({ organic_matter_level: v })}
                  options={(crops.data?.organic_matter_levels ?? Object.keys(OM_LEVELS)).map((k) => ({ value: k, label: OM_LEVELS[k]?.label ?? k, hint: OM_LEVELS[k]?.hint }))}
                />
                <p className="mt-1.5 text-[0.8125rem] text-muted">{OM_LEVELS[soil.organic_matter_level]?.hint}</p>
              </div>
            )}

            <div className="rounded-2xl bg-sand/70 p-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-forest-800" aria-hidden="true" />
                <h3 className="text-[1rem]">What the model works out from this</h3>
              </div>
              {resolved ? (
                <dl className="mt-3 grid gap-2.5 sm:grid-cols-3">
                  <Derived label="Field capacity" tip="The share of the soil’s volume that is water after it has drained freely for a day or two." value={fmtNum(resolved.field_capacity_frac * 100, 1)} unit="% of volume" />
                  <Derived label="Wilting point" tip="The water content below which crops can no longer draw water from the soil." value={fmtNum(resolved.wilting_point_frac * 100, 1)} unit="% of volume" />
                  <Derived
                    label="Available water capacity"
                    tip="An estimate of how much water the soil can hold between field capacity and wilting point, for each metre of soil depth."
                    value={fmtNum(resolved.available_water_mm_per_m, 0)}
                    unit="mm per metre"
                  />
                </dl>
              ) : (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3" aria-hidden="true">
                  {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[4.5rem] rounded-2xl" />)}
                </div>
              )}
              <p className="mt-2.5 text-[0.8125rem] leading-snug text-ink">
                Estimated by the engine from texture and organic matter (Saxton &amp; Rawls, 2006). These are model estimates, not laboratory measurements.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card as="section">
        <h2 className="text-[1.5rem] leading-tight tracking-[-0.02em]">How does your farm receive water?</h2>
        <div role="radiogroup" aria-label="Water availability" className="mt-4 grid gap-3 md:grid-cols-3">
          <ChoiceCard name="water-mode" checked={water.mode === 'rainfed'} onChange={() => setWater({ mode: 'rainfed' })} icon={<CloudRain className="h-5 w-5" aria-hidden="true" />} title={WATER_MODES.rainfed.label}>
            {WATER_MODES.rainfed.description}
          </ChoiceCard>
          <ChoiceCard name="water-mode" checked={water.mode === 'full'} onChange={() => setWater({ mode: 'full' })} icon={<Droplets className="h-5 w-5" aria-hidden="true" />} title={WATER_MODES.full.label}>
            {WATER_MODES.full.description}
          </ChoiceCard>
          <ChoiceCard name="water-mode" checked={water.mode === 'limited'} onChange={() => setWater({ mode: 'limited' })} icon={<Gauge className="h-5 w-5" aria-hidden="true" />} title={WATER_MODES.limited.label}>
            {WATER_MODES.limited.description}
          </ChoiceCard>
        </div>

        {water.mode === 'limited' && (
          <div className="animate-fade mt-4 max-w-sm">
            <Field
              label="Irrigation allowance per crop season (mm)"
              error={capBad ? `Enter an allowance between ${capRange[0]} and ${capRange[1]} mm.` : null}
              hint="150 mm is only an example, not a recommendation. Enter what you can actually apply."
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  type="number"
                  inputMode="numeric"
                  min={capRange[0]}
                  max={capRange[1]}
                  step={10}
                  value={Number.isFinite(water.seasonal_cap_mm) ? water.seasonal_cap_mm : ''}
                  onChange={(e) => setWater({ seasonal_cap_mm: e.target.value === '' ? NaN : Number(e.target.value) })}
                />
              )}
            </Field>
          </div>
        )}

        <details className="group mt-5 rounded-2xl bg-sand/60 open:bg-sand/80">
          <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-[0.9375rem] font-extrabold text-forest-950 [&::-webkit-details-marker]:hidden">
            Three water terms you will see in the results <span className="font-semibold text-muted group-open:hidden">· show</span>
          </summary>
          <dl className="space-y-2.5 px-4 pb-4 text-[0.875rem] leading-snug text-ink">
            <div>
              <dt className="font-extrabold text-forest-950">Crop water demand</dt>
              <dd>The water the crops would use over a year if nothing held them back, modelled from daily weather. It is a need, not what was applied.</dd>
            </div>
            <div>
              <dt className="font-extrabold text-forest-950">Modelled irrigation requirement</dt>
              <dd>The water the model adds to refill the root zone under your irrigation choice. It is a simulated amount, not measured farm water use.</dd>
            </div>
            <div>
              <dt className="font-extrabold text-forest-950">Seasonal irrigation cap</dt>
              <dd>With limited irrigation, the model stops adding water in a crop season once this allowance is used up.</dd>
            </div>
          </dl>
        </details>
      </Card>
    </StepFrame>
  )
}
