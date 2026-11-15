import { CheckCircle2, CloudRain, Droplets, Info, LoaderCircle, MapPin, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { InfoTip } from '../../components/ui/InfoTip'
import { Mascot } from '../../components/ui/Mascot'
import { api, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { fmtCoord } from '../../lib/format'
import type { GeocodeResponse, Preset } from '../../lib/types'
import { Callout, Card, Field, TextInput } from '../components/controls'
import { LocationMap } from '../components/LocationMap'
import { validLat, validLon } from '../lib/config'
import { useWorkspace } from '../state/workspace'
import { StepFrame } from './StepFrame'

function PresetCard({ preset, selected, onSelect }: { preset: Preset; selected: boolean; onSelect: () => void }) {
  const irrigated = preset.water.mode !== 'rainfed'
  return (
    <article
      className={cx(
        'flex flex-col rounded-[1.5rem] bg-white p-4 ring-1 transition-[box-shadow,transform] duration-300',
        selected ? 'shadow-soft ring-2 ring-forest-950' : 'ring-border hover:-translate-y-0.5 hover:shadow-soft',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[1.25rem] leading-tight">{preset.display.place}</h3>
          <p className="mt-0.5 text-[0.8125rem] font-bold text-muted">{[preset.display.region, preset.display.country].filter(Boolean).join(' · ')}</p>
        </div>
        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', selected ? 'bg-forest-950 text-lime' : 'bg-sand text-forest-950')}>
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 text-[0.8125rem] text-ink">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Farming system</dt>
          {irrigated ? <Droplets className="h-3.5 w-3.5 shrink-0 text-peri-ink" aria-hidden="true" /> : <CloudRain className="h-3.5 w-3.5 shrink-0 text-forest-800" aria-hidden="true" />}
          <dd className="font-bold">{preset.water_label}</dd>
          <dd className="ml-auto font-semibold text-muted tabular-nums">{fmtCoord(preset.lat, preset.lon)}</dd>
        </div>
        <div>
          <dt className="sr-only">Current rotation</dt>
          <dd className="font-semibold">{preset.rotation_name ?? preset.rotation_crops.map((c) => c.crop_name).join(' then ')}</dd>
        </div>
      </dl>
      <div className="mt-auto pt-4">
        <Button
          variant={selected ? 'secondary' : 'primary'}
          icon={selected ? <CheckCircle2 className="text-forest-800" /> : undefined}
          onClick={onSelect}
          aria-pressed={selected}
          className="w-full"
        >
          {selected ? 'Selected' : `Select ${preset.display.place}`}
        </Button>
      </div>
    </article>
  )
}

const parse = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s))

export function FieldStep({ onNext, issue }: { onNext: () => void; issue?: string }) {
  const { presets, reloadData, config, selectPreset, setLocation, update } = useWorkspace()
  const { lat, lon, preset_id, name } = config.location
  const [latText, setLatText] = useState(lat === null ? '' : String(lat))
  const [lonText, setLonText] = useState(lon === null ? '' : String(lon))
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{ status: 'idle' | 'loading' | 'error' | 'done'; data: GeocodeResponse | null; error: string | null }>({
    status: 'idle',
    data: null,
    error: null,
  })

  // keep the text boxes in step with the map and preset buttons
  useEffect(() => {
    setLatText(lat === null ? '' : String(lat))
    setLonText(lon === null ? '' : String(lon))
  }, [lat, lon])

  const latValue = parse(latText)
  const lonValue = parse(lonText)
  const latError = latText.trim() !== '' && !validLat(latValue) ? 'Latitude must be a number between −90 and 90.' : null
  const lonError = lonText.trim() !== '' && !validLon(lonValue) ? 'Longitude must be a number between −180 and 180.' : null

  const commit = (nextLat: string, nextLon: string) => {
    const a = parse(nextLat)
    const b = parse(nextLon)
    if (validLat(a) && validLon(b)) setLocation(Math.round(a * 100) / 100, Math.round(b * 100) / 100)
  }

  const runSearch = async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return
    setSearch({ status: 'loading', data: null, error: null })
    try {
      setSearch({ status: 'done', data: await api.geocode(q), error: null })
    } catch (err) {
      setSearch({ status: 'error', data: null, error: errorMessage(err) })
    }
  }

  const custom = lat !== null && lon !== null && preset_id === null

  return (
    <StepFrame
      step="field"
      title="Let’s start with your field."
      intro="Choose a demonstration farm or locate your own field to understand its historical growing conditions."
      aside={<Mascot name="blue" decorative className="animate-float hidden w-24 shrink-0 md:block" sizes="96px" />}
      onNext={onNext}
      nextLabel="Continue to Farm Profile"
      issue={issue}
    >
      <Card as="section">
        <h2 className="text-[1.25rem]">Demonstration farms</h2>
        <p className="mt-1 text-[0.9375rem] text-muted">Three real locations with weather already on hand. Selecting one fills in its soil, water and current rotation.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {presets.status === 'loading' && [0, 1, 2].map((i) => <div key={i} className="skeleton h-48 rounded-[1.5rem]" aria-hidden="true" />)}
          {presets.status === 'error' && (
            <div role="alert" className="col-span-full flex flex-col items-start gap-3 rounded-2xl bg-signal-50 p-4 ring-1 ring-signal/30">
              <p className="text-[0.9375rem] font-semibold text-ink">The demonstration farms could not be loaded. {presets.error}</p>
              <Button variant="secondary" icon={<RefreshCw />} onClick={reloadData}>
                Try again
              </Button>
            </div>
          )}
          {presets.data?.presets.map((p) => <PresetCard key={p.id} preset={p} selected={preset_id === p.id} onSelect={() => selectPreset(p)} />)}
        </div>
      </Card>

      <Card as="section">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[1.25rem]">Or locate your own field</h2>
          {custom && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-100 px-3 py-1 text-[0.8125rem] font-extrabold text-forest-950 ring-1 ring-forest-950/10">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Custom field selected
            </span>
          )}
        </div>
        <p className="mt-1 text-[0.9375rem] text-muted">Search for a place, type coordinates, or click the map. Drag the marker to refine the position.</p>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            <form onSubmit={runSearch} role="search">
              <Field label="Search by place or town" hint="Press Enter or Search. Results come from OpenStreetMap.">
                {({ id, describedBy }) => (
                  <div className="flex gap-2">
                    <TextInput id={id} aria-describedby={describedBy} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Faisalabad" autoComplete="off" />
                    <Button type="submit" variant="secondary" icon={search.status === 'loading' ? undefined : <Search />} loading={search.status === 'loading'} disabled={query.trim().length < 2 || search.status === 'loading'}>
                      Search
                    </Button>
                  </div>
                )}
              </Field>
            </form>
            <div aria-live="polite">
              {search.status === 'loading' && (
                <p className="flex items-center gap-2 text-[0.8125rem] font-bold text-muted">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Searching…
                </p>
              )}
              {search.status === 'error' && <Callout tone="warn">{search.error}</Callout>}
              {search.status === 'done' && search.data?.results.length === 0 && (
                <Callout tone="plain">No place found for “{search.data.query}”. Try a nearby town, or click the map.</Callout>
              )}
              {search.status === 'done' && !!search.data?.results.length && (
                <ul className="space-y-1.5">
                  {search.data.results.map((r) => (
                    <li key={`${r.lat},${r.lon},${r.name}`}>
                      <button
                        type="button"
                        onClick={() => setLocation(r.lat, r.lon, r.name.split(',').slice(0, 2).join(',').trim())}
                        className="flex w-full items-start gap-2 rounded-xl bg-sand/60 px-3 py-2 text-left text-[0.8125rem] leading-snug font-semibold text-forest-950 transition-colors hover:bg-sand"
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-800" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="line-clamp-2">{r.name}</span>
                          <span className="font-bold text-muted tabular-nums">{fmtCoord(r.lat, r.lon)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" error={latError} hint="−90 to 90">
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    inputMode="decimal"
                    value={latText}
                    placeholder="32.93"
                    onChange={(e) => {
                      setLatText(e.target.value)
                      commit(e.target.value, lonText)
                    }}
                  />
                )}
              </Field>
              <Field label="Longitude" error={lonError} hint="−180 to 180">
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    inputMode="decimal"
                    value={lonText}
                    placeholder="72.86"
                    onChange={(e) => {
                      setLonText(e.target.value)
                      commit(latText, e.target.value)
                    }}
                  />
                )}
              </Field>
            </div>

            {lat !== null && lon !== null && (
              <Field label="Field name" hint="Optional. Shown on your results and exports.">
                {({ id, describedBy }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    value={name}
                    maxLength={120}
                    placeholder={`Field at ${lat.toFixed(2)}, ${lon.toFixed(2)}`}
                    onChange={(e) => update((c) => ({ ...c, location: { ...c.location, name: e.target.value } }))}
                  />
                )}
              </Field>
            )}

            {custom && (
              <Callout tone="info" title="A custom field needs a weather download">
                HindSight will fetch 41 years of daily weather for this point from NASA POWER when you run the analysis. That can take a minute or more.
                You will describe this field’s own soil, water and crops in the next steps.
              </Callout>
            )}
          </div>

          <div className="min-w-0">
            <LocationMap lat={lat} lon={lon} onPick={(a, b) => setLocation(a, b)} className="h-[20rem] sm:h-[26rem]" />
            <p className="mt-2.5 flex items-start gap-2 text-[0.8125rem] leading-snug text-ink">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-800" aria-hidden="true" />
              <span>
                HindSight analyses <strong className="font-extrabold">one point, not a field boundary</strong>. The dashed box shows the approximate size of
                the NASA POWER weather cell around it (about 50 km): weather is the same anywhere inside.{' '}
                <InfoTip label="Why so coarse?" term="Why so coarse?">
                  NASA POWER weather comes from a global reanalysis on a grid of about 0.5° by 0.625°. Your field can be wetter or drier than the cell
                  average, especially for rainfall, so read results as comparisons between rotations rather than exact local amounts.
                </InfoTip>
              </span>
            </p>
          </div>
        </div>
      </Card>
    </StepFrame>
  )
}
