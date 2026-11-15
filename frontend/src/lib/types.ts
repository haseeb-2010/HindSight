// Shapes of the HindSight API (backend/api.py) and engine v0.3.0 output.
// Optional and nullable fields are typed as such so the UI never assumes they exist.

export interface RotationSlot {
  year_offset: number
  plant_doy: number
  crop_id: string
}

export interface Preset {
  id: string
  name: string
  lat: number
  lon: number
  soil: { texture_class?: string | null; organic_matter_level?: string | null; depth_cm?: number | null }
  water: { mode: string; seasonal_cap_mm?: number | null }
  current_rotation: { cycle_years: number; slots: RotationSlot[] }
  ndvi_point?: { lat: number; lon: number; why?: string } | null
  rotation_note?: string | null
  display: { place: string; region: string | null; country: string | null }
  water_label: string
  rotation_name: string | null
  rotation_crops: { crop_id: string; crop_name: string; year_offset: number; plant_doy: number; plant_date: string }[]
  data_status?: {
    nasa_power_cached: boolean
    modis_ndvi_cached: boolean
    soilgrids: 'profile' | 'no_data' | 'not_cached'
    saved_response: boolean
  }
}

export interface PresetsResponse {
  presets: Preset[]
  default_priorities: Record<string, number>
  priority_labels: Record<string, string>
  crop_names: Record<string, string>
  hindcast: { start_year: number; end_year: number; spin_up_year: number }
  engine_version: string
}

export interface SlotStats {
  crop_id: string
  median: number | null
  p10: number | null
  failure_freq: number | null
  main_limit: string
  heat_days_mean: number | null
  frost_days_mean: number | null
  n_seasons: number
  n_failed: number
}

export interface WindowStats {
  median: number | null
  p10: number | null
  failure_freq: number | null
}

export interface Hindcast {
  median: number | null
  p10: number | null
  failure_freq: number | null
  years: number[]
  annual_index: (number | null)[]
  by_window?: Record<string, WindowStats>
  by_slot?: SlotStats[]
  water_demand_mm_per_year: number
  irrigation_mm_per_year: number
  worst_years?: { years: number[]; mean_index: number | null } | null
}

export interface Indicators {
  stability: number | null
  water_use_mm: number
  forage_share: number
  legume_share: number
  erosive_rain_on_bare_frac: number
  cover_frac: number
  residue_class_mean: number
  market_mean: number
  family_repeats: number
}

export interface Scores {
  normalised?: Record<string, number>
  total: number
  rank: number
  pareto?: boolean
  rank_early?: number
  rank_late?: number
  rank_range?: [number, number] | null
  rank_range_rain?: [number, number] | null
}

export interface Explanation {
  summary: string
  reasons?: string[]
  evidence?: string[]
  benefits?: string[]
  gaps?: string[]
  local_review?: string[]
}

export interface CalendarCell {
  year_offset: number
  month: number
  crop_id: string
  bare_frac: number
}

export interface Rotation {
  id: string
  name: string
  is_current: boolean
  cycle_years: number
  slots: RotationSlot[]
  calendar?: CalendarCell[]
  hindcast: Hindcast
  indicators: Indicators
  scores: Scores
  explanation?: Explanation
}

export interface ClimateShift {
  id: string
  label: string
  unit: string
  early: number | null
  late: number | null
  change: number | null
  slope_per_decade: number | null
  p_value: number | null
}

export interface NdviCheck {
  r: number
  n_years: number
  p_value?: number | null
  note?: string
}

export interface AnalysisResult {
  meta: {
    engine_version: string
    record: { start_year: number; end_year: number }
    windows?: Record<string, [number, number]>
    warnings?: string[]
  }
  site: {
    name: string
    lat: number
    lon: number
    soil_used?: { source?: string; texture_class?: string; available_water_mm_per_m?: number }
    climate_summary?: { annual_rain_mm?: number; annual_et0_mm?: number; mean_temp_c?: number }
  }
  climate_shift?: ClimateShift[]
  rotations: Rotation[]
  validation?: { ndvi_check?: NdviCheck | null }
  provenance?: { item: string; kind: string; source: string }[]
}

export interface AnalysisEnvelope {
  source: 'live' | 'saved'
  preset_id: string
  engine_version?: string | null
  computed_at?: string
  elapsed_ms?: number
  notice?: string
  fallback_reason?: string | null
  saved_file?: string
  inputs?: {
    climate?: { source?: string; start?: string; end?: string; grid_note?: string }
    soil?: { used?: string; soilgrids?: string }
    ndvi?: { used?: boolean; point?: { lat: number; lon: number } }
  }
  request?: { options?: { failure_threshold?: number; top_n?: number }; water?: { mode?: string } }
  result: AnalysisResult
}
