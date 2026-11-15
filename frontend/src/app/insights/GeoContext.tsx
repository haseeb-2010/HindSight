import { CloudRain, Droplets, MapPin } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { usePrefersReducedMotion } from '../../hooks/useMotion'
import { currentRotation, rotationLabel } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import type { AnalysisEnvelope, Preset } from '../../lib/types'
import { Callout, Segmented } from '../components/controls'
import { CELL_LEGEND, LocationMap, type MapFocus, type MapMarker } from '../components/LocationMap'
import { SourceBadge } from '../components/SourceBadge'
import { waterLabel } from '../lib/labels'
import { RunProgress } from '../results/RunProgress'
import { Panel } from '../results/shared'
import { useWorkspace } from '../state/workspace'
import { Coverage } from './geo/Coverage'
import { AnalyseButton, DataStatus, DemoComparison, presetRotation, presetTitle } from './geo/DemoLocations'
import { FootprintSchematic } from './geo/FootprintSchematic'
import { SOURCES, aboutKm, distanceKm, fmtLat, fmtLon, samePoint } from './geo/geo'
import type { InsightProps } from './types'

/** 'site' is the analysed farm point; anything else is the id of a demonstration farm. */
type Selection = 'site' | string

const EYEBROW = 'text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 py-2">
      <dt className="text-[0.8125rem] font-bold text-ink">{label}</dt>
      <dd className="min-w-0 text-[0.875rem] font-bold text-forest-950 tabular-nums">{children}</dd>
    </div>
  )
}

function WaterValue({ irrigated, label }: { irrigated: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {irrigated ? <Droplets className="h-3.5 w-3.5 shrink-0 text-peri-ink" aria-hidden="true" /> : <CloudRain className="h-3.5 w-3.5 shrink-0 text-forest-800" aria-hidden="true" />}
      {label}
    </span>
  )
}

/** The analysed farm point: everything here is read from the envelope; place names only when it is a demonstration farm. */
function SiteDetails({ env, preset }: { env: AnalysisEnvelope; preset: Preset | null }) {
  const site = env.result.site
  const cur = currentRotation(env.result)
  const mode = env.request?.water?.mode
  return (
    <>
      <p className={EYEBROW}>Analysed farm point</p>
      <h4 className="mt-1 text-[1.25rem] leading-tight">{site.name}</h4>
      <div className="mt-2">
        <SourceBadge env={env} detail={false} />
      </div>
      <dl className="mt-3 divide-y divide-sand-300 border-t border-sand-300">
        {preset ? (
          <>
            <Fact label="Place">{preset.display.place}</Fact>
            {preset.display.region && <Fact label="Region">{preset.display.region}</Fact>}
            {preset.display.country && <Fact label="Country">{preset.display.country}</Fact>}
          </>
        ) : (
          <Fact label="Place">
            <span className="font-semibold text-ink">Custom point. Only its coordinates are known, so no region or country is shown.</span>
          </Fact>
        )}
        <Fact label="Latitude">{fmtLat(site.lat)}</Fact>
        <Fact label="Longitude">{fmtLon(site.lon)}</Fact>
        <Fact label="Water">{mode ? <WaterValue irrigated={mode !== 'rainfed'} label={waterLabel(mode, env.request?.water?.seasonal_cap_mm)} /> : <span className="font-semibold text-ink">Not recorded with this analysis</span>}</Fact>
        <Fact label="Current rotation">{cur ? rotationLabel(cur) : '—'}</Fact>
      </dl>
      <p className="mt-3 text-[0.8125rem] leading-snug text-ink">
        The pin marks one point. HindSight does not know the field’s outline, so nothing on the map shows the field itself.
      </p>
    </>
  )
}

function DemoDetails({ preset, env, busy, onAnalyse }: { preset: Preset; env: AnalysisEnvelope; busy: boolean; onAnalyse: (p: Preset) => void }) {
  const site = env.result.site
  return (
    <>
      <p className={EYEBROW}>Demonstration location</p>
      <h4 className="mt-1 text-[1.25rem] leading-tight">{preset.display.place}</h4>
      <dl className="mt-3 divide-y divide-sand-300 border-t border-sand-300">
        {preset.display.region && <Fact label="Region">{preset.display.region}</Fact>}
        {preset.display.country && <Fact label="Country">{preset.display.country}</Fact>}
        <Fact label="Latitude">{fmtLat(preset.lat)}</Fact>
        <Fact label="Longitude">{fmtLon(preset.lon)}</Fact>
        <Fact label="Water">
          <WaterValue irrigated={preset.water.mode !== 'rainfed'} label={preset.water_label} />
        </Fact>
        <Fact label="Current rotation">{presetRotation(preset)}</Fact>
        <Fact label="From the analysed point">{aboutKm(distanceKm(site, preset))}</Fact>
      </dl>
      <p className="mt-3 text-[0.75rem] font-extrabold tracking-[0.06em] text-ink uppercase">Data available on the server</p>
      <DataStatus preset={preset} className="mt-1.5" />
      <AnalyseButton preset={preset} busy={busy} onAnalyse={onAnalyse} className="mt-4 w-full" />
      <p className="mt-2 text-[0.8125rem] leading-snug text-ink">Runs the engine for this farm with its own settings and makes the result the open analysis. The analysis open now stays in My Analyses.</p>
    </>
  )
}

export default function GeoContext({ env }: InsightProps) {
  const { presets, run, analyse, analysePreset, cancelRun, reloadData } = useWorkspace()
  const site = env.result.site
  const demos = presets.data?.presets ?? []
  const analysedPreset = (env.preset_id && demos.find((p) => p.id === env.preset_id)) || null
  const [selected, setSelected] = useState<Selection>('site')
  const [view, setView] = useState<'near' | 'all'>('near')
  const shownPreset = selected === 'site' ? null : (demos.find((p) => p.id === selected) ?? null)
  const busy = run.status === 'running'

  // A run started here replaces the open analysis; bring its progress into view.
  const reduced = usePrefersReducedMotion()
  const progress = useRef<HTMLDivElement>(null)
  const startedHere = useRef(false)
  useEffect(() => {
    if (run.status !== 'idle' && startedHere.current) progress.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    if (run.status === 'idle') startedHere.current = false
  }, [run.status, reduced])
  const start = (p: Preset) => {
    startedHere.current = true
    void analysePreset(p)
  }

  const pick = (id: Selection) => setSelected(analysedPreset && id === analysedPreset.id ? 'site' : id)
  const mapRef = useRef<HTMLDivElement>(null)
  const showOnMap = (p: Preset) => {
    pick(p.id)
    setView('near')
    mapRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }

  // The MODIS pixel is marked only when the engine read one somewhere other than the farm point.
  const ndvi = env.inputs?.ndvi
  const ndviPoint = ndvi?.used && ndvi.point && !samePoint(ndvi.point, site) ? ndvi.point : null

  const markers: MapMarker[] = demos.map((p) => ({
    id: p.id,
    lat: p.lat,
    lon: p.lon,
    label: `${presetTitle(p)}: demonstration location${p.id === analysedPreset?.id ? ', analysed here' : selected === p.id ? ', details shown' : '. Select to see its details.'}`,
    active: p.id === analysedPreset?.id ? selected === 'site' : selected === p.id,
  }))
  if (ndviPoint) markers.push({ id: 'modis-pixel', lat: ndviPoint.lat, lon: ndviPoint.lon, label: 'Position of the MODIS pixel read for the greenness check (250 m, far smaller than this mark)', kind: 'reference' })

  const focus: MapFocus = view === 'all' ? { type: 'all' } : shownPreset ? { type: 'marker', id: shownPreset.id } : { type: 'point' }
  const others = demos.filter((p) => p.id !== analysedPreset?.id)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">Explore the geographic context of your farm.</h2>
        <p className="mt-1 max-w-3xl text-[0.9375rem] text-muted">
          See where the analysed point lies, how large an area each data source describes, and what was actually read for this location. Weather, soil and satellite
          greenness come at very different resolutions.
        </p>
      </div>

      {run.status !== 'idle' && (
        <div ref={progress} className="space-y-3">
          <RunProgress run={run} onRetry={() => void analyse()} onCancel={cancelRun} title="Analysing the farm…" />
          {run.status === 'error' && (
            <Button variant="secondary" onClick={cancelRun}>
              Dismiss and keep the current analysis
            </Button>
          )}
        </div>
      )}

      <Callout tone="info" title="Every value describes a grid cell or a pixel, not your field">
        HindSight analyses one point, not a field. Each value in this analysis is a gridded environmental estimate for the grid cell or pixel that contains that point. The
        engine does not identify zones inside a farm, so the map below shows positions only: no measured data is drawn on it.
      </Callout>

      <Panel
        title="Where this analysis is located"
        action={
          <Segmented
            label="Map view"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'near', label: 'Selected location' },
              { value: 'all', label: 'All locations' },
            ]}
          />
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
          <div ref={mapRef} className="min-w-0">
            <LocationMap
              readOnly
              lat={site.lat}
              lon={site.lon}
              className="h-[20rem] sm:h-[27rem]"
              markers={markers}
              onMarkerSelect={pick}
              onPointSelect={() => setSelected('site')}
              pointLabel={`Analysed farm point: ${site.name}`}
              focus={focus}
              showScale
              legend={{ point: 'Analysed farm point', place: 'Demonstration location', reference: 'Position of the MODIS pixel read (not to size)' }}
              ariaLabel="Map of the analysed farm point, the approximate NASA POWER grid cell around it and the demonstration locations. Arrow keys move the map; plus and minus zoom."
            />
            <p className="mt-2.5 text-[0.8125rem] leading-snug text-ink">
              The dashed box around the analysed farm point is the {CELL_LEGEND.charAt(0).toLowerCase() + CELL_LEGEND.slice(1)}: it is worked out from the grid spacing (
              {SOURCES.power.grid.latDeg}° ×{' '}
              {SOURCES.power.grid.lonDeg}°), not delivered by NASA, and weather values are the same anywhere inside it. Base map © OpenStreetMap contributors.
            </p>
            {view === 'all' && demos.length > 1 && (
              <p className="mt-1.5 text-[0.8125rem] leading-snug font-bold text-ink">
                Markers that are close together overlap at this scale. Zoom in, or choose a location with the buttons{' '}
                <span className="lg:hidden">below</span>
                <span className="hidden lg:inline">beside the map</span>.
              </p>
            )}
          </div>

          <section aria-label="Location details" className="min-w-0 self-start rounded-2xl bg-sand/50 p-4 sm:p-5">
            <div role="group" aria-label="Show details for" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={selected === 'site'} onClick={() => setSelected('site')} className={choice(selected === 'site')}>
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Analysed farm
              </button>
              {others.map((p) => (
                <button key={p.id} type="button" aria-pressed={selected === p.id} onClick={() => setSelected(p.id)} className={choice(selected === p.id)}>
                  {p.display.place}
                </button>
              ))}
            </div>
            {presets.status === 'loading' && <p className="mt-2 text-[0.8125rem] font-semibold text-ink">Loading the demonstration locations…</p>}
            {presets.status === 'error' && <p className="mt-2 text-[0.8125rem] font-semibold text-signal-ink">The demonstration locations could not be loaded, so only the analysed point is shown.</p>}
            <div aria-live="polite">
              <div key={selected} className="animate-fade mt-4">
                {shownPreset ? <DemoDetails preset={shownPreset} env={env} busy={busy} onAnalyse={start} /> : <SiteDetails env={env} preset={analysedPreset} />}
              </div>
            </div>
          </section>
        </div>
      </Panel>

      <Panel title="How big is each data footprint?">
        <FootprintSchematic site={site} ndviPoint={ndviPoint} />
      </Panel>

      <section className="space-y-3">
        <div>
          <h3 className="text-[1.1875rem] leading-tight">What was read for this location</h3>
          <p className="mt-1 max-w-3xl text-[0.875rem] text-muted">Taken from the record this analysis keeps of its own inputs. Where something was not read or not recorded, it says so.</p>
        </div>
        <Coverage env={env} preset={analysedPreset} />
      </section>

      <Panel title="Demonstration locations compared">
        <p className="-mt-2 mb-4 max-w-3xl text-[0.875rem] text-muted">
          Real locations, each with its own water supply and current rotation. The data status shows what the HindSight server already holds for each one.
        </p>
        <DemoComparison presets={presets} analysedId={analysedPreset?.id ?? null} selectedId={shownPreset?.id ?? null} busy={busy} onAnalyse={start} onShow={showOnMap} onReload={reloadData} />
        <p className="mt-4 text-[0.8125rem] leading-snug text-ink">
          “Analyse this farm” runs the engine for that farm with its own settings and makes the result the open analysis. The analysis open now stays in My Analyses.
        </p>
      </Panel>
    </div>
  )
}

function choice(on: boolean): string {
  return cx(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-bold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950',
    on ? 'bg-forest-950 text-cream-50 ring-forest-950' : 'bg-white text-forest-950 ring-border-strong hover:bg-sand',
  )
}
