// Scenario definitions shared by the Scenario Lab and the guided tour. A scenario is only the two
// numbers the engine accepts: a uniform temperature offset and a rainfall multiplier applied to
// every day of the historical record (backend/engine/climate.py: prepare()).
import type { CompareVariant } from '../../lib/types'
import { scenarioText } from './config'

export interface ScenarioDef {
  id: string
  label: string
  temp_delta_c: number
  precip_factor: number
  /** True for the scenarios HindSight offers; false for ones the user saved. */
  builtin?: boolean
}

export const BASELINE: ScenarioDef = { id: 'baseline', label: 'Historical baseline', temp_delta_c: 0, precip_factor: 1, builtin: true }

export const SCENARIO_PRESETS: ScenarioDef[] = [
  BASELINE,
  { id: 'warm1', label: 'Mild warming test', temp_delta_c: 1, precip_factor: 1, builtin: true },
  { id: 'warm2', label: 'Higher warming test', temp_delta_c: 2, precip_factor: 1, builtin: true },
  { id: 'rain90', label: 'Moderately lower rainfall', temp_delta_c: 0, precip_factor: 0.9, builtin: true },
  { id: 'rain80', label: 'Lower rainfall', temp_delta_c: 0, precip_factor: 0.8, builtin: true },
  { id: 'warm2rain80', label: 'Warmer and drier', temp_delta_c: 2, precip_factor: 0.8, builtin: true },
]

export const isBaseline = (s: { temp_delta_c: number; precip_factor: number }) => s.temp_delta_c === 0 && s.precip_factor === 1

/** "temperature +2.0 °C, rainfall 80%" or "no adjustment" for the baseline. */
export const scenarioSummary = (s: { temp_delta_c: number; precip_factor: number }) => scenarioText(s) || 'no adjustment (0 °C, 100% rainfall)'

export function toVariant(s: ScenarioDef): CompareVariant {
  return { id: s.id, label: s.label, scenario: { temp_delta_c: s.temp_delta_c, precip_factor: s.precip_factor } }
}

/* ------------------------------------------------------------------ saved scenarios (this device only) */

export const SCENARIOS_KEY = 'hindsight.scenarios.v1'
export const MAX_SAVED_SCENARIOS = 12

export function loadSavedScenarios(): ScenarioDef[] {
  try {
    const raw = window.localStorage.getItem(SCENARIOS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s): s is ScenarioDef => !!s && typeof s.id === 'string' && typeof s.label === 'string' && Number.isFinite(s.temp_delta_c) && Number.isFinite(s.precip_factor))
      .map((s) => ({ id: s.id, label: s.label, temp_delta_c: s.temp_delta_c, precip_factor: s.precip_factor }))
      .slice(0, MAX_SAVED_SCENARIOS)
  } catch {
    return []
  }
}

/** Returns false when the browser refused to store the list (private mode, storage full). */
export function storeSavedScenarios(list: ScenarioDef[]): boolean {
  try {
    window.localStorage.setItem(SCENARIOS_KEY, JSON.stringify(list.slice(0, MAX_SAVED_SCENARIOS)))
    return true
  } catch {
    return false
  }
}

/** An id that is valid for the comparison API (letters, digits, "_" and "-"). */
export const newScenarioId = () => `user-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
