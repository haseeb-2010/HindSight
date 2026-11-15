// Downloads of one analysis. Every export is built from the envelope it is given and from nothing
// else, so a file always describes exactly the run that was on screen.
import { rankedRotations, rotationLabel, seasonsFailed } from '../../lib/analysis'
import { isNum } from '../../lib/format'
import type { AnalysisEnvelope, Rotation } from '../../lib/types'
import { isScenarioActive, scenarioText } from './config'
import { PRIORITIES, PRIORITY_ORDER, waterLabel } from './labels'

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

/** What identifies a run when the envelope itself does not carry it (older saved analyses). */
export interface ExportMeta {
  /** Identifier of the analysis in "My Analyses", used when the envelope has no `analysis_id`. */
  id?: string | null
  /** ISO time the analysis was saved on this device, used when the envelope has no `computed_at`. */
  at?: string | null
}

/** The identifier of the run an envelope came from, or null when none was recorded. */
export function analysisIdOf(env: AnalysisEnvelope, meta?: ExportMeta): string | null {
  return env.analysis_id || meta?.id || null
}

/** When the run was calculated (engine time) or, failing that, saved on this device. */
export function analysisDateOf(env: AnalysisEnvelope, meta?: ExportMeta): { iso: string; kind: 'calculated' | 'saved' } | null {
  if (env.computed_at && !Number.isNaN(Date.parse(env.computed_at))) return { iso: env.computed_at, kind: 'calculated' }
  if (meta?.at && !Number.isNaN(Date.parse(meta.at))) return { iso: meta.at, kind: 'saved' }
  return null
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** File name stem: the field's name plus the start of the run identifier, so two runs of one field do not overwrite each other. */
export function fileStem(env: AnalysisEnvelope, meta?: ExportMeta): string {
  const name = slug(env.result.site.name || 'field') || 'field'
  const id = slug(analysisIdOf(env, meta) ?? '').slice(0, 8)
  return `hindsight-${name}${id ? `-${id}` : ''}`
}

/** The complete API envelope, exactly as received. */
export function downloadJson(env: AnalysisEnvelope, meta?: ExportMeta) {
  download(`${fileStem(env, meta)}.json`, JSON.stringify(env, null, 2), 'application/json')
}

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const range = (r: [number, number] | null | undefined) => (r ? `${r[0]}-${r[1]}` : '')

/** Header lines that say exactly which run a comparison file came from. Each starts with "# ". */
export function comparisonNotes(env: AnalysisEnvelope, meta?: ExportMeta): string[] {
  const res = env.result
  const req = env.request
  const rec = res.meta.record
  const date = analysisDateOf(env, meta)
  const weights = req?.priorities
  const scenario = req?.scenario
  const coord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)} ${v >= 0 ? pos : neg}`
  return [
    `# HindSight rotation comparison for ${res.site.name}`,
    `# Analysis identifier: ${analysisIdOf(env, meta) ?? 'not recorded'}`,
    `# Analysis date: ${date ? `${date.iso} (${date.kind === 'calculated' ? 'calculated by the engine' : 'saved on this device'})` : 'not recorded'}`,
    `# Coordinates: ${isNum(res.site.lat) && isNum(res.site.lon) ? `${coord(res.site.lat, 'N', 'S')}, ${coord(res.site.lon, 'E', 'W')}` : 'not recorded'}`,
    `# Water mode: ${req?.water?.mode ? waterLabel(req.water.mode, req.water.seasonal_cap_mm) : 'not recorded'}`,
    `# Priority weights (0-5): ${
      weights ? PRIORITY_ORDER.map((k) => `${PRIORITIES[k].label} ${isNum(weights[k]) ? weights[k] : 'not recorded'}`).join('; ') : 'not recorded'
    }`,
    `# Scenario: ${
      !scenario
        ? 'not recorded'
        : isScenarioActive(scenario)
          ? `hypothetical what-if adjustment to the historical record (${scenarioText(scenario)}); not a forecast`
          : 'historical baseline (no adjustment)'
    }`,
    `# Historical simulation ${rec.start_year}-${rec.end_year}; engine v${res.meta.engine_version}; ${env.source === 'live' ? 'live run' : 'saved demonstration result'}`,
    '# Season index is not crop yield. Rankings are relative to the rotations listed here and to the assumptions of this run.',
  ]
}

/** One row per rotation with every compared metric, straight from the engine response. */
export function comparisonCsv(env: AnalysisEnvelope, meta?: ExportMeta): string {
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
  // A note that contains a comma is quoted, so a spreadsheet keeps each note in one cell.
  const notes = comparisonNotes(env, meta).map(cell)
  return [...notes, head.join(','), ...rankedRotations(env.result).map((r) => row(r).map(cell).join(','))].join('\r\n') + '\r\n'
}

export function downloadCsv(env: AnalysisEnvelope, meta?: ExportMeta) {
  // The byte-order mark makes spreadsheet programs read the file as UTF-8 (degree signs, crop names).
  download(`${fileStem(env, meta)}-rotations.csv`, `\uFEFF${comparisonCsv(env, meta)}`, 'text/csv;charset=utf-8')
}
