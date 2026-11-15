import { CalendarDays, LoaderCircle, Plus, Sprout, Trash2 } from 'lucide-react'
import { CROP_COLORS, MonthStrip } from '../../components/charts/MonthStrip'
import { cx } from '../../lib/cx'
import { fmtPct } from '../../lib/format'
import type { Crop } from '../../lib/types'
import { Callout, Card, MascotNote, Segmented, SelectInput } from '../components/controls'
import { newKey, rotationBody, type SlotDraft } from '../lib/config'
import { MONTH_NAMES, daysInMonth, fromDoy, toDoy } from '../lib/doy'
import { CROP_GROUPS, cropGroup } from '../lib/labels'
import { useRotationPreview } from '../state/useRotationPreview'
import { useWorkspace } from '../state/workspace'
import { StepFrame } from './StepFrame'

/** A sowing day for a new crop that does not land on an existing one (a convenience default only;
 *  the engine's schedule check decides what is valid). */
function freeSowingDay(crop: Crop, year: number, cycle: number, slots: SlotDraft[], crops: Crop[]): number {
  const n = 365 * cycle
  const busy = new Uint8Array(n)
  for (const s of slots) {
    const len = crops.find((c) => c.id === s.crop_id)?.season_days ?? 120
    for (let d = 0; d < len; d++) busy[(s.year_offset * 365 + s.plant_doy - 1 + d) % n] = 1
  }
  const first = crop.season_type === 'cool' ? 305 : 135
  const tries = [first, ...Array.from({ length: 24 }, (_, i) => ((first - 1 + (i + 1) * 15) % 365) + 1)]
  for (const doy of tries) {
    let ok = true
    for (let d = 0; d < crop.season_days && ok; d++) ok = !busy[(year * 365 + doy - 1 + d) % n]
    if (ok) return doy
  }
  return first
}

export function RotationStep({ onBack, onNext, issue }: { onBack: () => void; onNext: () => void; issue?: string }) {
  const { config, update, crops } = useWorkspace()
  const { cycle_years, slots } = config.rotation
  const list = crops.data?.crops ?? []
  const byId = new Map(list.map((c) => [c.id, c]))
  const preview = useRotationPreview(rotationBody(config))
  const maxSlots = crops.data?.limits.max_slots ?? 9
  const order = [...new Set([...slots].sort((a, b) => a.year_offset * 365 + a.plant_doy - (b.year_offset * 365 + b.plant_doy)).map((s) => s.crop_id))]
  const colorOf = (id: string) => CROP_COLORS[Math.max(0, order.indexOf(id)) % CROP_COLORS.length]
  const names = Object.fromEntries(list.map((c) => [c.id, c.name]))

  const setRotation = (fn: (r: typeof config.rotation) => typeof config.rotation) => update((c) => ({ ...c, rotation: fn(c.rotation) }))
  const patchSlot = (key: string, patch: Partial<SlotDraft>) => setRotation((r) => ({ ...r, slots: r.slots.map((s) => (s.key === key ? { ...s, ...patch } : s)) }))
  const removeSlot = (key: string) => setRotation((r) => ({ ...r, slots: r.slots.filter((s) => s.key !== key) }))
  const addSlot = (year: number) => {
    const crop = list.find((c) => !slots.some((s) => s.crop_id === c.id)) ?? list[0]
    if (!crop) return
    setRotation((r) => ({ ...r, slots: [...r.slots, { key: newKey(), year_offset: year, crop_id: crop.id, plant_doy: freeSowingDay(crop, year, r.cycle_years, r.slots, list) }] }))
  }
  const setCycle = (n: number) => setRotation((r) => ({ cycle_years: n, slots: r.slots.filter((s) => s.year_offset < n) }))


  return (
    <StepFrame
      step="rotation"
      title="What are you currently growing?"
      intro="Tell us your existing crop sequence. HindSight will compare it with alternative rotations."
      onBack={onBack}
      onNext={onNext}
      nextLabel="Continue to Priorities"
      nextDisabled={preview.status === 'invalid' || slots.length === 0}
      issue={issue ?? (preview.status === 'invalid' ? 'Fix the rotation to continue.' : null)}
    >
      <Card as="section">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[1.25rem]">Your rotation cycle</h2>
            <p className="mt-1 text-[0.875rem] text-muted">How many years before the sequence repeats? Shortening it removes crops in the years that no longer exist.</p>
          </div>
          <Segmented
            label="Cycle length"
            value={cycle_years}
            onChange={setCycle}
            options={[1, 2, 3].map((n) => ({ value: n, label: `${n}-year cycle` }))}
          />
        </div>

        {crops.status === 'error' && (
          <Callout tone="warn" className="mt-4">
            The crop list could not be loaded. {crops.error}
          </Callout>
        )}

        <div className="mt-5 space-y-5">
          {Array.from({ length: cycle_years }, (_, year) => {
            const inYear = slots.filter((s) => s.year_offset === year).sort((a, b) => a.plant_doy - b.plant_doy)
            return (
              <div key={year}>
                <div className="mb-2.5 flex items-center gap-3">
                  <h3 className="rounded-full bg-forest-950 px-3 py-1 font-sans text-[0.75rem] font-extrabold tracking-[0.06em] text-cream-50 uppercase">Year {year + 1}</h3>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {inYear.map((s) => {
                    const crop = byId.get(s.crop_id)
                    const group = CROP_GROUPS[cropGroup(crop)]
                    const { month, day } = fromDoy(s.plant_doy)
                    const season = preview.data?.seasons.find((x) => x.year_offset === s.year_offset && x.plant_doy === s.plant_doy && x.crop_id === s.crop_id)
                    return (
                      <li key={s.key} className={cx('rounded-2xl p-3.5 ring-1 ring-forest-950/[0.08]', group.bg)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 text-[0.6875rem] font-extrabold tracking-[0.06em] text-ink uppercase">
                            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(s.crop_id) }} />
                            {group.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSlot(s.key)}
                            aria-label={`Remove ${crop?.name ?? s.crop_id} from year ${year + 1}`}
                            className="-m-1 flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-white hover:text-signal-ink"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <label className="mt-2 block">
                          <span className="sr-only">Crop</span>
                          <SelectInput value={s.crop_id} onChange={(e) => patchSlot(s.key, { crop_id: e.target.value })} className="font-display text-[1.0625rem] font-semibold">
                            {!crop && <option value={s.crop_id}>{s.crop_id} (not available)</option>}
                            {list.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </SelectInput>
                        </label>
                        <fieldset className="mt-2.5">
                          <legend className="mb-1 text-[0.75rem] font-extrabold text-forest-950">Sowing date</legend>
                          <div className="flex gap-2">
                            <label className="w-[4.75rem] shrink-0">
                              <span className="sr-only">Day</span>
                              <SelectInput value={day} onChange={(e) => patchSlot(s.key, { plant_doy: toDoy(month, Number(e.target.value)) })}>
                                {Array.from({ length: daysInMonth(month) }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {i + 1}
                                  </option>
                                ))}
                              </SelectInput>
                            </label>
                            <label className="min-w-0 flex-1">
                              <span className="sr-only">Month</span>
                              <SelectInput value={month} onChange={(e) => patchSlot(s.key, { plant_doy: toDoy(Number(e.target.value), day) })}>
                                {MONTH_NAMES.map((m, i) => (
                                  <option key={m} value={i + 1}>
                                    {m}
                                  </option>
                                ))}
                              </SelectInput>
                            </label>
                            {cycle_years > 1 && (
                              <label className="w-[5.75rem] shrink-0">
                                <span className="sr-only">Rotation year</span>
                                <SelectInput value={s.year_offset} onChange={(e) => patchSlot(s.key, { year_offset: Number(e.target.value) })}>
                                  {Array.from({ length: cycle_years }, (_, i) => (
                                    <option key={i} value={i}>
                                      Year {i + 1}
                                    </option>
                                  ))}
                                </SelectInput>
                              </label>
                            )}
                          </div>
                        </fieldset>
                        <p className="mt-2.5 min-h-[1.25rem] text-[0.8125rem] leading-snug font-semibold text-ink">
                          {season
                            ? `${season.season_days}-day season; harvest around ${season.harvest_date}${season.harvest_year_offset !== s.year_offset ? ` (year ${season.harvest_year_offset + 1})` : ''}.`
                            : crop
                              ? `${crop.season_days}-day season.`
                              : ''}
                        </p>
                      </li>
                    )
                  })}
                  <li>
                    <button
                      type="button"
                      onClick={() => addSlot(year)}
                      disabled={slots.length >= maxSlots || list.length === 0}
                      className="flex h-full min-h-[7.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand-400 text-[0.9375rem] font-bold text-forest-950 transition-colors hover:border-forest-950/50 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-950 text-lime">
                        <Plus className="h-5 w-5" aria-hidden="true" />
                      </span>
                      Add a crop to year {year + 1}
                    </button>
                  </li>
                </ul>
              </div>
            )
          })}
        </div>

        {slots.length === 0 && (
          <MascotNote mascot="blue" className="mt-5">
            Add the crops you grow now, in the order you grow them. One crop a year is fine: HindSight treats the rest of the year as bare fallow.
          </MascotNote>
        )}
      </Card>

      <Card as="section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-forest-800" aria-hidden="true" />
            <h2 className="text-[1.25rem]">Your rotation through the year</h2>
          </div>
          {preview.status === 'loading' && (
            <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-muted">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking with the engine…
            </span>
          )}
        </div>

        <div aria-live="polite" className="mt-4">
          {preview.status === 'empty' && <p className="text-[0.9375rem] text-muted">The calendar appears here once you add a crop.</p>}
          {preview.status === 'invalid' && (
            <Callout tone="warn" title="This rotation cannot be simulated yet">
              {preview.error} Move a sowing date or remove a crop so that seasons do not run into each other.
            </Callout>
          )}
          {preview.data && (
            <div className={cx(preview.status === 'loading' && 'opacity-60')}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[1.125rem] font-semibold text-forest-950">
                <Sprout className="h-5 w-5 text-forest-800" aria-hidden="true" /> {preview.data.name}
              </p>
              <div className="mt-4 max-w-2xl">
                <MonthStrip calendar={preview.data.calendar} cropOrder={order} cropNames={names} label={`Calendar of ${preview.data.name}`} />
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-bold text-ink">
                {order.map((id) => (
                  <li key={id} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(id) }} />
                    {names[id] ?? id}
                  </li>
                ))}
                <li className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm border border-sand-400 bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(207_203_194)_2px_3px)]" />
                  Bare soil
                </li>
              </ul>
              <p className="mt-3 text-[0.875rem] text-ink">
                Soil is covered for <strong className="font-extrabold">{fmtPct(preview.data.cover_frac)}</strong> of the cycle. Legumes make up{' '}
                <strong className="font-extrabold">{fmtPct(preview.data.legume_share)}</strong> of the crops.
              </p>
            </div>
          )}
        </div>

        {!!crops.data?.unavailable.length && (
          <p className="mt-5 border-t border-border pt-4 text-[0.8125rem] leading-snug text-muted">
            Not available yet: {crops.data.unavailable.map((c) => c.name).join(', ')}. These crops have no sourced yield-response value, so the model
            cannot score them and HindSight does not offer them.
          </p>
        )}
      </Card>
    </StepFrame>
  )
}
