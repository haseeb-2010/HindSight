import { rankedRotations, rotationLabel, seasonsFailed } from '../../lib/analysis'
import type { AnalysisEnvelope, Rotation } from '../../lib/types'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function fileStem(env: AnalysisEnvelope): string {
  const name = (env.result.site.name || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `hindsight-${name || 'field'}`
}

/** The complete API envelope, exactly as received. */
export function downloadJson(env: AnalysisEnvelope) {
  download(`${fileStem(env)}.json`, JSON.stringify(env, null, 2), 'application/json')
}

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const range = (r: [number, number] | null | undefined) => (r ? `${r[0]}-${r[1]}` : '')

/** One row per rotation with every compared metric, straight from the engine response. */
export function comparisonCsv(env: AnalysisEnvelope): string {
  const head = [
    'rank', 'rotation', 'is_current', 'cycle_years', 'crops', 'median_season_index', 'p10_season_index',
    'failure_frequency', 'seasons_failed', 'seasons_simulated', 'crop_water_demand_mm_per_year',
    'irrigation_mm_per_year', 'soil_cover_fraction', 'legume_share', 'forage_share',
    'heavy_rain_on_bare_soil_fraction', 'worst_years', 'worst_years_mean_index', 'rank_range_legume_effect',
    'rank_range_rainfall_pm30pct', 'pareto_efficient', 'weighted_score',
  ]
  const row = (r: Rotation) => {
    const f = seasonsFailed(r)
    return [
      r.scores?.rank, rotationLabel(r), r.is_current, r.cycle_years, r.slots.map((s) => s.crop_id).join(' > '),
      r.hindcast.median, r.hindcast.p10, r.hindcast.failure_freq, f?.failed, f?.total,
      r.hindcast.water_demand_mm_per_year, r.hindcast.irrigation_mm_per_year, r.indicators.cover_frac,
      r.indicators.legume_share, r.indicators.forage_share, r.indicators.erosive_rain_on_bare_frac,
      r.hindcast.worst_years?.years?.join(' '), r.hindcast.worst_years?.mean_index, range(r.scores?.rank_range),
      range(r.scores?.rank_range_rain), r.scores?.pareto, r.scores?.total,
    ]
  }
  const rec = env.result.meta.record
  const notes = [
    `# HindSight rotation comparison for ${env.result.site.name}`,
    `# Historical simulation ${rec.start_year}-${rec.end_year}; engine v${env.result.meta.engine_version}; ${env.source === 'live' ? 'live run' : 'saved demonstration result'}`,
    '# Season index is not crop yield. Rankings are relative to the rotations listed here.',
  ]
  return [...notes, head.join(','), ...rankedRotations(env.result).map((r) => row(r).map(cell).join(','))].join('\r\n') + '\r\n'
}

export function downloadCsv(env: AnalysisEnvelope) {
  download(`${fileStem(env)}-rotations.csv`, comparisonCsv(env), 'text/csv;charset=utf-8')
}
