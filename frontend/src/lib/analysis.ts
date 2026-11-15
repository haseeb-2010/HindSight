// Read-only selectors over engine output. They pick and count; they never recompute science.
import type { AnalysisEnvelope, AnalysisResult, Rotation } from './types'

export function currentRotation(res: AnalysisResult): Rotation | undefined {
  return res.rotations.find((r) => r.is_current) ?? res.rotations[0]
}

export function rankedRotations(res: AnalysisResult): Rotation[] {
  return [...res.rotations].sort((a, b) => (a.scores?.rank ?? 99) - (b.scores?.rank ?? 99))
}

export function topAlternative(res: AnalysisResult): Rotation | undefined {
  return rankedRotations(res).find((r) => !r.is_current)
}

/** Engine appends " (current)" to the current rotation's name; the UI shows a badge instead. */
export function rotationLabel(r: Rotation): string {
  return r.name.replace(/\s*\(current\)\s*$/i, '')
}

/** Crop seasons below the failure line, summed over the rotation's slots (as explain.py does). */
export function seasonsFailed(r: Rotation): { failed: number; total: number } | null {
  const slots = r.hindcast?.by_slot
  if (!slots?.length) return null
  const total = slots.reduce((s, b) => s + (b.n_seasons ?? 0), 0)
  const failed = slots.reduce((s, b) => s + (b.n_failed ?? 0), 0)
  return total > 0 ? { failed, total } : null
}

const flat = (range: [number, number] | null | undefined) => !!range && range[0] === range[1]

/** "Robust" badge rule from docs/FOR_PERSON_3.md: rank unchanged under both legume and rainfall variants. */
export function isRobust(r: Rotation): boolean {
  return flat(r.scores?.rank_range) && flat(r.scores?.rank_range_rain)
}

/** False when the yearly index is flat (e.g. full irrigation), so "worst years" are only ties. */
export function indexVaries(r: Rotation): boolean {
  const v = (r.hindcast?.annual_index ?? []).filter((x): x is number => typeof x === 'number')
  return v.length > 1 && Math.max(...v) - Math.min(...v) > 0.005
}

export function failureThreshold(env: AnalysisEnvelope | null | undefined): number | null {
  const t = env?.request?.options?.failure_threshold
  return typeof t === 'number' ? t : null
}

export function isIrrigated(env: AnalysisEnvelope | null | undefined): boolean {
  const mode = env?.request?.water?.mode
  return !!mode && mode !== 'rainfed'
}

export function rankText(rank: number | undefined, of: number): string {
  return rank ? `#${rank} of ${of}` : '—'
}
