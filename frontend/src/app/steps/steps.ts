import { BarChart3, ClipboardCheck, Droplets, MapPin, SlidersHorizontal, Sprout, Wand2, type LucideIcon } from 'lucide-react'
import type { CropsResponse } from '../../lib/types'
import { hasLocation, validLat, validLon, type FarmConfig } from '../lib/config'

export type StepId = 'field' | 'soil' | 'rotation' | 'priorities' | 'scenario' | 'review' | 'results'

export const STEPS: { id: StepId; label: string; icon: LucideIcon }[] = [
  { id: 'field', label: 'Field & Location', icon: MapPin },
  { id: 'soil', label: 'Soil & Water', icon: Droplets },
  { id: 'rotation', label: 'Crop Rotation', icon: Sprout },
  { id: 'priorities', label: 'Farming Priorities', icon: SlidersHorizontal },
  { id: 'scenario', label: 'Scenario Settings', icon: Wand2 },
  { id: 'review', label: 'Review & Run', icon: ClipboardCheck },
  { id: 'results', label: 'Results', icon: BarChart3 },
]

export const STEP_IDS = STEPS.map((s) => s.id)
export const isStepId = (v: string | null): v is StepId => !!v && (STEP_IDS as string[]).includes(v)

const DEFAULT_LIMITS = { depth_cm: [20, 300], seasonal_cap_mm: [10, 2000] } as const

/** What still stops each input step from being complete (form-level checks; the server re-validates). */
export function stepIssues(c: FarmConfig, limits?: CropsResponse['limits']): Partial<Record<StepId, string>> {
  const out: Partial<Record<StepId, string>> = {}
  const depth = limits?.depth_cm ?? DEFAULT_LIMITS.depth_cm
  const cap = limits?.seasonal_cap_mm ?? DEFAULT_LIMITS.seasonal_cap_mm
  if (!hasLocation(c)) out.field = 'Choose a demonstration farm or locate your field.'
  else if (!validLat(c.location.lat) || !validLon(c.location.lon)) out.field = 'The coordinates are outside the valid range.'
  if (!(c.soil.depth_cm >= depth[0] && c.soil.depth_cm <= depth[1])) out.soil = `Soil depth must be between ${depth[0]} and ${depth[1]} cm.`
  else if (c.water.mode === 'limited' && !(c.water.seasonal_cap_mm >= cap[0] && c.water.seasonal_cap_mm <= cap[1]))
    out.soil = `The seasonal irrigation allowance must be between ${cap[0]} and ${cap[1]} mm.`
  if (c.rotation.slots.length === 0) out.rotation = 'Add at least one crop to your current rotation.'
  return out
}
