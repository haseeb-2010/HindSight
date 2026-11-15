import type { AnalyzeBody, Preset } from '../../lib/types'

export interface SlotDraft {
  key: string
  year_offset: number
  plant_doy: number
  crop_id: string
}

/** Everything the farmer sets in the workspace. `priorities` holds only the weights they changed. */
export interface FarmConfig {
  location: { lat: number | null; lon: number | null; name: string; preset_id: string | null }
  soil: { source: 'farmer' | 'soilgrids'; texture_class: string; organic_matter_level: string; depth_cm: number }
  water: { mode: 'rainfed' | 'full' | 'limited'; seasonal_cap_mm: number }
  rotation: { cycle_years: number; slots: SlotDraft[] }
  priorities: Record<string, number>
  market_rating: Record<string, number>
  excluded_crops: string[]
  max_cycle_years: number
  options: { apply_legume_effect: boolean; failure_threshold: number; top_n: number }
  scenario: { temp_delta_c: number; precip_factor: number }
}

let seq = 0
export const newKey = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`

// Engine defaults: resolve_soil() falls back to loam / low organic matter / 100 cm, the failure
// line is 0.5, the legume effect is on, and scripts/run_site.py asks for five alternatives.
export const EMPTY_CONFIG: FarmConfig = {
  location: { lat: null, lon: null, name: '', preset_id: null },
  soil: { source: 'farmer', texture_class: 'loam', organic_matter_level: 'low', depth_cm: 100 },
  water: { mode: 'rainfed', seasonal_cap_mm: 150 },
  rotation: { cycle_years: 1, slots: [] },
  priorities: {},
  market_rating: {},
  excluded_crops: [],
  max_cycle_years: 3,
  options: { apply_legume_effect: true, failure_threshold: 0.5, top_n: 5 },
  scenario: { temp_delta_c: 0, precip_factor: 1 },
}

const WATER_MODES = ['rainfed', 'full', 'limited'] as const

/** A demonstration farm's own settings, with every other choice back at its default. */
export function configFromPreset(p: Preset): FarmConfig {
  const mode = WATER_MODES.find((m) => m === p.water.mode) ?? 'rainfed'
  return {
    ...EMPTY_CONFIG,
    location: { lat: p.lat, lon: p.lon, name: p.name, preset_id: p.id },
    soil: {
      source: 'farmer',
      texture_class: p.soil.texture_class ?? EMPTY_CONFIG.soil.texture_class,
      organic_matter_level: p.soil.organic_matter_level ?? EMPTY_CONFIG.soil.organic_matter_level,
      depth_cm: p.soil.depth_cm ?? EMPTY_CONFIG.soil.depth_cm,
    },
    water: { mode, seasonal_cap_mm: p.water.seasonal_cap_mm ?? EMPTY_CONFIG.water.seasonal_cap_mm },
    rotation: {
      cycle_years: p.current_rotation.cycle_years,
      slots: p.current_rotation.slots.map((s) => ({ ...s, key: newKey() })),
    },
  }
}

export const hasLocation = (c: FarmConfig) => c.location.lat !== null && c.location.lon !== null

export function validLat(v: number | null): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90
}

export function validLon(v: number | null): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180
}

export function rotationBody(c: FarmConfig): AnalyzeBody['current_rotation'] {
  return {
    cycle_years: c.rotation.cycle_years,
    slots: c.rotation.slots.map(({ year_offset, plant_doy, crop_id }) => ({ year_offset, plant_doy, crop_id })),
  }
}

/** The request for POST /api/analyze, or null while the location is missing. */
export function toRequest(c: FarmConfig, defaultPriorities: Record<string, number>): AnalyzeBody | null {
  if (!validLat(c.location.lat) || !validLon(c.location.lon)) return null
  return {
    location: { lat: c.location.lat, lon: c.location.lon, name: c.location.name.trim() || null, preset_id: c.location.preset_id },
    soil: { texture_class: c.soil.texture_class, organic_matter_level: c.soil.organic_matter_level, depth_cm: c.soil.depth_cm },
    soil_source: c.soil.source,
    water: { mode: c.water.mode, seasonal_cap_mm: c.water.mode === 'limited' ? c.water.seasonal_cap_mm : null },
    current_rotation: rotationBody(c),
    priorities: { ...defaultPriorities, ...c.priorities },
    constraints: { excluded_crops: [...c.excluded_crops].sort(), market_rating: c.market_rating, max_cycle_years: c.max_cycle_years },
    scenario: { ...c.scenario },
    options: { ...c.options },
  }
}

/** Stable text form of a request, used to tell whether shown results match the current settings. */
export function signatureOf(body: AnalyzeBody | null): string {
  if (!body) return ''
  const sortKeys = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sortKeys)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]))
        : v
  return JSON.stringify(sortKeys(body))
}

export function isScenarioActive(s: { temp_delta_c?: number; precip_factor?: number } | undefined | null): boolean {
  return !!s && ((s.temp_delta_c ?? 0) !== 0 || (s.precip_factor ?? 1) !== 1)
}

export function scenarioText(s: { temp_delta_c?: number; precip_factor?: number } | undefined | null): string {
  const t = s?.temp_delta_c ?? 0
  const p = Math.round((s?.precip_factor ?? 1) * 100)
  const parts = []
  if (t !== 0) parts.push(`temperature ${t > 0 ? '+' : '−'}${Math.abs(t).toFixed(1)} °C`)
  if (p !== 100) parts.push(`rainfall ${p}%`)
  return parts.join(', ')
}
