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
    soil_used?: {
      source?: string
      texture_class?: string
      field_capacity_frac?: number
      wilting_point_frac?: number
      available_water_mm_per_m?: number
    }
    climate_summary?: { annual_rain_mm?: number; annual_et0_mm?: number; mean_temp_c?: number }
  }
  climate_shift?: ClimateShift[]
  rotations: Rotation[]
  validation?: { ndvi_check?: NdviCheck | null }
  provenance?: { item: string; kind: string; source: string }[]
}

/** The request the engine actually ran with, echoed back by the API. */
export interface EngineRequest {
  location?: { lat?: number; lon?: number; name?: string | null; preset_id?: string | null }
  soil?: { texture_class?: string | null; organic_matter_level?: string | null; depth_cm?: number | null }
  water?: { mode?: string; seasonal_cap_mm?: number | null }
  current_rotation?: { cycle_years?: number; slots?: RotationSlot[] }
  priorities?: Record<string, number>
  constraints?: { excluded_crops?: string[]; market_rating?: Record<string, number>; max_cycle_years?: number }
  scenario?: { temp_delta_c?: number; precip_factor?: number }
  options?: { apply_legume_effect?: boolean; failure_threshold?: number; top_n?: number }
}

export interface AnalysisEnvelope {
  source: 'live' | 'saved'
  preset_id: string | null
  analysis_id?: string
  engine_version?: string | null
  computed_at?: string
  elapsed_ms?: number
  notice?: string
  notes?: string[]
  fallback_reason?: string | null
  saved_file?: string
  inputs?: {
    climate?: {
      source?: string
      start?: string
      end?: string
      grid_note?: string
      from_cache?: boolean
      elevation_m?: number | null
      /** Daily records in the retrieved NASA POWER series. */
      days?: number
    }
    soil?: { used?: string; requested?: string; soilgrids?: string; profile?: SoilProfile | null }
    ndvi?: {
      used?: boolean
      point?: { lat: number; lon: number }
      reason?: string | null
      source?: string | null
      first_date?: string
      last_date?: string
      observations?: number
      good_quality_observations?: number
    }
  }
  request?: EngineRequest
  /** Yearly and monthly values of the weather record behind `result` (backend/context.py). Absent on analyses saved before Phase 03. */
  context?: { climate?: ClimateContext | null } | null
  result: AnalysisResult
}

export interface MonthlyClimate {
  month: number
  rain_mm: number
  et0_mm: number
  heavy_rain_days: number
  hot_days: number
  frost_days: number
  mean_temp_c: number
}

/** Descriptive values read from the same NASA POWER record (and scenario) the engine used. */
export interface ClimateContext {
  record: { start_year: number; end_year: number }
  scenario_applied: boolean
  years: number[]
  /** One value per year, keyed by the id of the matching `climate_shift` indicator. */
  annual: Record<string, number[]>
  /** Twelve entries, January to December: averages over the record. */
  monthly: MonthlyClimate[]
  thresholds: { hot_day_c: number; frost_day_c: number; heavy_rain_mm: number }
  warm_half_year_months: number[]
  note?: string
}

/* ---------------------------------------------------------------- workspace (Phase 02) */

export interface Crop {
  id: string
  name: string
  group: string | null
  family: string | null
  is_legume: boolean
  is_forage: boolean
  season_type: string | null
  season_days: number
}

export interface CropsResponse {
  crops: Crop[]
  unavailable: { id: string; name: string; reason: string }[]
  default_market_rating: number
  limits: {
    depth_cm: [number, number]
    seasonal_cap_mm: [number, number]
    temp_delta_c: [number, number]
    precip_factor: [number, number]
    failure_threshold: [number, number]
    top_n: [number, number]
    max_slots: number
    max_compare_runs?: number
  }
  soil_textures: string[]
  organic_matter_levels: string[]
}

export interface SoilProfile {
  source: string
  texture_class: string
  sand_pct: number
  clay_pct: number
  organic_matter_pct: number | null
  ph: number | null
  depth_cm: number | null
}

export interface SoilLookup {
  status: 'profile' | 'no_data' | 'unavailable'
  profile: SoilProfile | null
  lat: number
  lon: number
  source_label: string
  message: string
  depth_note: string
}

export interface SoilResolved {
  source: string
  texture_class: string
  field_capacity_frac: number
  wilting_point_frac: number
  available_water_mm_per_m: number
  depth_cm: number
  from_profile: boolean
  method: string
}

export interface SeasonPreview {
  crop_id: string
  crop_name: string
  year_offset: number
  plant_doy: number
  plant_date: string
  season_days: number
  harvest_year_offset: number
  harvest_date: string
}

/** Returned when the engine's schedule check rejects a rotation (e.g. overlapping seasons). */
export interface RotationRejected {
  valid: false
  error: string
  detail: string
}

export interface RotationPreview {
  valid: true
  name: string
  cycle_years: number
  calendar: CalendarCell[]
  seasons: SeasonPreview[]
  cover_frac: number
  legume_share: number
  forage_share: number
}

export interface GeocodeResponse {
  query: string
  results: { name: string; lat: number; lon: number }[]
  attribution: string
}

export interface JobStage {
  id: string
  label: string
  state: 'done' | 'active' | 'pending' | 'error'
  detail: string | null
}

export interface JobState {
  analysis_id: string
  status: 'queued' | 'running' | 'done' | 'error'
  stage: string | null
  stages: JobStage[]
  elapsed_ms: number
  envelope: AnalysisEnvelope | null
  /** Set instead of `envelope` when the job compared several runs (POST /api/scenarios/compare). */
  comparison?: Comparison | null
  error: { code: string; detail: string } | null
}

/** One run in a comparison: the base request with a different scenario and/or priorities. */
export interface CompareVariant {
  id: string
  label: string
  scenario?: { temp_delta_c: number; precip_factor: number }
  priorities?: Record<string, number>
}

export interface Comparison {
  kind: 'comparison'
  analysis_id: string
  computed_at: string
  elapsed_ms: number
  weather_from_cache: boolean
  variants: { id: string; label: string; envelope: AnalysisEnvelope }[]
}

/** What the workspace sends to POST /api/analyze. */
export interface AnalyzeBody {
  location: { lat: number; lon: number; name: string | null; preset_id: string | null }
  soil: { texture_class: string; organic_matter_level: string; depth_cm: number }
  soil_source: 'farmer' | 'soilgrids'
  water: { mode: string; seasonal_cap_mm: number | null }
  current_rotation: { cycle_years: number; slots: RotationSlot[] }
  priorities: Record<string, number>
  constraints: { excluded_crops: string[]; market_rating: Record<string, number>; max_cycle_years: number }
  scenario: { temp_delta_c: number; precip_factor: number }
  options: { apply_legume_effect: boolean; failure_threshold: number; top_n: number }
}
