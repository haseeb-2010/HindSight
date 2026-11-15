// Display wording for the two numbers of a scenario. No thresholds: only signs and equality are read.
import type { ScenarioDef } from '../lib/scenarios'

type Adjustment = Pick<ScenarioDef, 'temp_delta_c' | 'precip_factor'>

/** "+2 °C", "−1.5 °C", "0 °C" */
export function fmtTemp(t: number): string {
  const a = Math.abs(t)
  return `${t > 0 ? '+' : t < 0 ? '−' : ''}${Number.isInteger(a) ? a : a.toFixed(1)} °C`
}

/** Rainfall factor as a percentage of the recorded amount: 0.8 → "80%". */
export const fmtRain = (factor: number) => `${Math.round(factor * 100)}%`

export const sameAdjustment = (a: Adjustment, b: Adjustment) => Math.abs(a.temp_delta_c - b.temp_delta_c) < 1e-9 && Math.round(a.precip_factor * 100) === Math.round(b.precip_factor * 100)

export type AdjustmentKind = 'none' | 'temperature' | 'rainfall' | 'combined'

/** Which of the two numbers a scenario changes. */
export function adjustmentKind(s: Adjustment): AdjustmentKind {
  const t = s.temp_delta_c !== 0
  const p = Math.round(s.precip_factor * 100) !== 100
  return t && p ? 'combined' : t ? 'temperature' : p ? 'rainfall' : 'none'
}

/** A plain description of the direction of an adjustment, e.g. "Combined: warmer and drier than the record". */
export function describeAdjustment(s: Adjustment): string {
  const kind = adjustmentKind(s)
  const temp = s.temp_delta_c > 0 ? 'warmer' : 'cooler'
  const rain = s.precip_factor < 1 ? 'drier' : 'wetter'
  if (kind === 'combined') return `Combined: ${temp} and ${rain} than the record`
  if (kind === 'temperature') return `Temperature only: ${temp} than the record`
  if (kind === 'rainfall') return `Rainfall only: ${rain} than the record`
  return 'This is the historical baseline'
}

/** "Temperature +2.0 °C, rainfall 80%" with a capital, for a line of its own. */
export const sentenceCase = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text)
