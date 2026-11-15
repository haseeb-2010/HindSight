import { CheckCircle2, CloudRain, Droplets, Info, MapPin, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '../../components/ui/Button'
import { Reveal } from '../../components/ui/Reveal'
import { cx } from '../../lib/cx'
import { fmtCoord, fmtTexture } from '../../lib/format'
import type { Preset } from '../../lib/types'
import type { AnalysisState } from './types'

const TONES = [
  { base: '#f7f9c4', base2: '#eef384', line: '#1c3a2a', pin: 'bg-forest-950 text-lime' },
  { base: '#eef1fd', base2: '#cdd7f8', line: '#25483a', pin: 'bg-forest-950 text-peri' },
  { base: '#f0ebe1', base2: '#dfe7df', line: '#1c3a2a', pin: 'bg-forest-950 text-cream-50' },
]

/** Stylised contour map, deterministic from the preset's coordinates (decorative, not real terrain). */
function TerrainTile({ preset, index }: { preset: Preset; index: number }) {
  const tone = TONES[index % TONES.length]
  const paths = useMemo(() => {
    const seed = Math.abs(preset.lat * 12.9898 + preset.lon * 78.233)
    const cx = 200 + Math.sin(seed) * 40
    const cy = 112 + Math.cos(seed * 1.7) * 14
    return Array.from({ length: 9 }, (_, k) => {
      const r = 16 + k * 19
      const pts = Array.from({ length: 49 }, (_, i) => {
        const t = (i / 48) * Math.PI * 2
        const wob = 1 + 0.12 * Math.sin(3 * t + seed + k * 0.35) + 0.07 * Math.sin(5 * t + seed * 2.1 - k * 0.2)
        return `${(cx + Math.cos(t) * r * 1.55 * wob).toFixed(1)},${(cy + Math.sin(t) * r * 0.82 * wob).toFixed(1)}`
      })
      return `M${pts.join('L')}Z`
    })
  }, [preset.lat, preset.lon])
  const irrigated = preset.water.mode !== 'rainfed'

  return (
    <div className="relative h-44 overflow-hidden rounded-[1.25rem]" style={{ background: `linear-gradient(140deg, ${tone.base}, ${tone.base2})` }}>
      <svg aria-hidden="true" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {irrigated &&
          [0, 1, 2, 3, 4, 5, 6].map((i) => (
            <line key={i} x1={-20 + i * 70} y1={240} x2={60 + i * 70} y2={-20} stroke={tone.line} strokeOpacity={0.07} strokeWidth={10} />
          ))}
        {paths.map((d, k) => (
          <path key={k} d={d} fill="none" stroke={tone.line} strokeOpacity={0.09 + k * 0.012} strokeWidth={1.3} />
        ))}
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%]">
        <span className="absolute inset-0 animate-ping rounded-full bg-forest-950/15 [animation-duration:2.6s]" aria-hidden="true" />
        <span className={cx('relative flex h-11 w-11 items-center justify-center rounded-full shadow-lift', tone.pin)}>
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-[0.75rem] font-extrabold text-forest-950 backdrop-blur">
        {irrigated ? <Droplets className="h-3.5 w-3.5 text-peri-ink" aria-hidden="true" /> : <CloudRain className="h-3.5 w-3.5 text-forest-800" aria-hidden="true" />}
        {preset.water_label}
      </span>
      <span className="absolute bottom-3 left-3 rounded-full bg-forest-950/85 px-2.5 py-1 text-[0.7rem] font-bold text-cream-50 tabular-nums backdrop-blur">
        {fmtCoord(preset.lat, preset.lon)}
      </span>
    </div>
  )
}

interface FarmCardProps {
  preset: Preset
  index: number
  selected: boolean
  state: AnalysisState | undefined
  onExplore: () => void
}

export function FarmCard({ preset, index, selected, state, onExplore }: FarmCardProps) {
  const loading = state?.status === 'loading'
  const failed = state?.status === 'error'
  const showing = selected && state?.status === 'ready'
  const multiYear = preset.current_rotation.cycle_years > 1
  const soil = preset.soil
  const where = [preset.display.region, preset.display.country].filter(Boolean).join(' · ')

  return (
    <Reveal
      as="article"
      delay={index * 110}
      className={cx(
        'group relative flex flex-col rounded-[1.75rem] bg-white p-2.5 ring-1 transition-[box-shadow,transform] duration-500 ease-(--ease-soft)',
        selected ? 'shadow-lift ring-2 ring-forest-950' : 'shadow-hairline ring-border hover:-translate-y-1 hover:shadow-lift',
      )}
    >
      <TerrainTile preset={preset} index={index} />
      <div className="flex flex-1 flex-col px-3 pt-5 pb-3">
        <h3 className="text-[1.625rem] leading-none tracking-[-0.025em]">{preset.display.place}</h3>
        {where && <p className="mt-1.5 text-[0.875rem] font-bold text-muted">{where}</p>}

        <dl className="mt-5 space-y-3.5 text-[0.875rem]">
          <div>
            <dt className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-muted uppercase">Current rotation</dt>
            <dd className="mt-1 font-bold text-forest-950">{preset.rotation_name ?? preset.rotation_crops.map((c) => c.crop_name).join(' then ')}</dd>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {preset.rotation_crops.map((c) => (
                <span key={`${c.crop_id}-${c.year_offset}`} className="rounded-full bg-sand px-2.5 py-1 text-[0.75rem] font-bold text-ink">
                  {c.crop_name}
                  {multiYear ? ` (year ${c.year_offset + 1})` : ''}, sown {c.plant_date}
                </span>
              ))}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-muted uppercase">Soil</dt>
              <dd className="mt-1 font-bold text-ink">
                {fmtTexture(soil.texture_class)}
                {soil.organic_matter_level ? `, ${soil.organic_matter_level} organic matter` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-muted uppercase">Water</dt>
              <dd className="mt-1 font-bold text-ink">{preset.water_label}</dd>
            </div>
          </div>
        </dl>

        {preset.rotation_note && (
          <p className="mt-4 flex gap-2 rounded-xl bg-peri-50 p-3 text-[0.8125rem] leading-snug text-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-peri-ink" aria-hidden="true" />
            <span>{preset.rotation_note}</span>
          </p>
        )}

        <div className="mt-auto pt-6">
          <Button
            id={`explore-btn-${preset.id}`}
            onClick={onExplore}
            loading={loading}
            disabled={loading}
            variant={showing ? 'secondary' : 'primary'}
            arrow={!loading && !showing && !failed}
            icon={showing ? <CheckCircle2 className="text-forest-800" /> : failed ? <RotateCcw /> : undefined}
            className="w-full justify-between"
            aria-controls="analysis-preview"
            aria-expanded={selected}
            aria-label={`${showing ? 'Showing analysis for' : failed ? 'Retry analysis for' : 'Explore'} ${preset.display.place}`}
          >
            {loading ? 'Running the engine…' : showing ? 'Showing analysis below' : failed ? 'Retry analysis' : 'Explore This Farm'}
          </Button>
        </div>
      </div>
    </Reveal>
  )
}
