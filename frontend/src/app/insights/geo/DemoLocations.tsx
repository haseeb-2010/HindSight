import { CircleCheck, CircleMinus, CloudRain, Droplets, Play, RefreshCw } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { cx } from '../../../lib/cx'
import type { Preset, PresetsResponse } from '../../../lib/types'
import type { Resource } from '../../../hooks/useResource'
import { Chip } from '../../results/shared'
import { fmtLat, fmtLon } from './geo'

export const presetRotation = (p: Preset) => p.rotation_name ?? p.rotation_crops.map((c) => c.crop_name).join(' then ')
export const presetTitle = (p: Preset) => `${p.display.place}${p.display.country ? `, ${p.display.country}` : ''}`

interface StatusLine {
  key: string
  source: string
  ok: boolean
  text: string
}

/** What the server already holds for a demonstration farm, in words (preset.data_status from /api/presets). */
export function statusLines(p: Preset): StatusLine[] | null {
  const d = p.data_status
  if (!d) return null
  const soil: Record<string, string> = {
    profile: 'Profile stored',
    no_data: 'Looked up: no data at this point',
    not_cached: 'Not looked up yet',
  }
  return [
    { key: 'power', source: 'NASA POWER weather', ok: d.nasa_power_cached, text: d.nasa_power_cached ? 'Daily record stored' : 'Not stored: downloaded when analysed' },
    { key: 'modis', source: 'MODIS NDVI', ok: d.modis_ndvi_cached, text: d.modis_ndvi_cached ? 'Observations stored' : 'No observations stored' },
    { key: 'soil', source: 'SoilGrids', ok: d.soilgrids === 'profile', text: soil[d.soilgrids] ?? String(d.soilgrids) },
    { key: 'saved', source: 'Saved result', ok: d.saved_response, text: d.saved_response ? 'Stored as a fallback' : 'None stored' },
  ]
}

/** The four data-status lines. The icon repeats what the words say; it never carries the meaning alone. */
export function DataStatus({ preset, className }: { preset: Preset; className?: string }) {
  const lines = statusLines(preset)
  if (!lines) return <p className={cx('text-[0.8125rem] font-semibold text-muted', className)}>Data status was not reported for this farm.</p>
  return (
    <ul className={cx('space-y-1.5', className)}>
      {lines.map((l) => (
        <li key={l.key} className="flex items-start gap-2 text-[0.8125rem] leading-snug">
          {l.ok ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-800" aria-hidden="true" /> : <CircleMinus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />}
          <span className="min-w-0">
            <span className="font-extrabold text-forest-950">{l.source}:</span> <span className="font-semibold text-ink">{l.text}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function AnalyseButton({ preset, busy, onAnalyse, variant = 'primary', className }: { preset: Preset; busy: boolean; onAnalyse: (p: Preset) => void; variant?: 'primary' | 'secondary'; className?: string }) {
  return (
    <Button variant={variant} icon={<Play />} disabled={busy} onClick={() => onAnalyse(preset)} className={className}>
      Analyse this farm<span className="sr-only">: {presetTitle(preset)}</span>
    </Button>
  )
}

const ROW = 'border-t border-border pt-3'
const LABEL = 'text-[0.75rem] font-extrabold tracking-[0.06em] text-muted uppercase'

function FarmCard({ preset, analysed, selected, busy, onAnalyse, onShow }: { preset: Preset; analysed: boolean; selected: boolean; busy: boolean; onAnalyse: (p: Preset) => void; onShow: (p: Preset) => void }) {
  const irrigated = preset.water.mode !== 'rainfed'
  return (
    <article
      className={cx(
        'row-span-6 mb-4 grid grid-rows-subgrid gap-y-3 rounded-[1.5rem] p-4 ring-1 transition-shadow last:mb-0 sm:p-5 md:mb-0',
        analysed ? 'bg-lime-100/60 ring-forest-950/25' : 'bg-white ring-border',
        selected && 'shadow-soft ring-2 ring-forest-950',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="text-[1.25rem] leading-tight">{preset.display.place}</h4>
          {analysed ? <Chip tone="forest">Analysed here</Chip> : <Chip>Demonstration</Chip>}
        </div>
        <p className="mt-1 text-[0.8125rem] font-bold text-ink">{[preset.display.region, preset.display.country].filter(Boolean).join(' · ') || 'Region not recorded'}</p>
      </div>

      <dl className={cx(ROW, 'grid grid-cols-2 gap-x-3')}>
        <div>
          <dt className={LABEL}>Latitude</dt>
          <dd className="mt-0.5 font-display text-[1.0625rem] font-semibold text-forest-950 tabular-nums">{fmtLat(preset.lat)}</dd>
        </div>
        <div>
          <dt className={LABEL}>Longitude</dt>
          <dd className="mt-0.5 font-display text-[1.0625rem] font-semibold text-forest-950 tabular-nums">{fmtLon(preset.lon)}</dd>
        </div>
      </dl>

      <div className={ROW}>
        <p className={LABEL}>Water</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[0.9375rem] font-bold text-forest-950">
          {irrigated ? <Droplets className="h-4 w-4 shrink-0 text-peri-ink" aria-hidden="true" /> : <CloudRain className="h-4 w-4 shrink-0 text-forest-800" aria-hidden="true" />}
          {preset.water_label}
        </p>
      </div>

      <div className={ROW}>
        <p className={LABEL}>Current rotation</p>
        <p className="mt-0.5 text-[0.9375rem] font-bold text-forest-950">{presetRotation(preset)}</p>
      </div>

      <div className={ROW}>
        <p className={LABEL}>Data available on the server</p>
        <DataStatus preset={preset} className="mt-1.5" />
      </div>

      <div className="flex flex-wrap items-center gap-2 self-end pt-1">
        {analysed ? (
          <p className="text-[0.8125rem] leading-snug font-bold text-forest-950">This is the farm analysed on this page.</p>
        ) : (
          <AnalyseButton preset={preset} busy={busy} onAnalyse={onAnalyse} />
        )}
        <button
          type="button"
          onClick={() => onShow(preset)}
          className="rounded-full px-3 py-2 text-[0.875rem] font-bold text-forest-950 underline decoration-sage decoration-2 underline-offset-4 hover:decoration-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
        >
          Show on map<span className="sr-only">: {presetTitle(preset)}</span>
        </button>
      </div>
    </article>
  )
}

/** The three demonstration locations side by side, all from /api/presets. */
export function DemoComparison({
  presets,
  analysedId,
  selectedId,
  busy,
  onAnalyse,
  onShow,
  onReload,
}: {
  presets: Resource<PresetsResponse>
  analysedId: string | null
  selectedId: string | null
  busy: boolean
  onAnalyse: (p: Preset) => void
  onShow: (p: Preset) => void
  onReload: () => void
}) {
  if (presets.status === 'loading') {
    return (
      <div className="grid gap-4 md:grid-cols-3" role="status" aria-label="Loading the demonstration locations">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-80 rounded-[1.5rem]" />
        ))}
      </div>
    )
  }
  if (presets.status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl bg-signal-50 p-4 ring-1 ring-signal/30">
        <p className="text-[0.9375rem] font-semibold text-ink">The demonstration locations could not be loaded. {presets.error}</p>
        <Button variant="secondary" icon={<RefreshCw />} onClick={onReload}>
          Try again
        </Button>
      </div>
    )
  }
  return (
    <div className="grid gap-x-4 gap-y-0 md:grid-cols-3">
      {presets.data.presets.map((p) => (
        <FarmCard key={p.id} preset={p} analysed={p.id === analysedId} selected={p.id === selectedId} busy={busy} onAnalyse={onAnalyse} onShow={onShow} />
      ))}
    </div>
  )
}
