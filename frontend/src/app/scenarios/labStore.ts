// What the Scenario Lab keeps for this browser tab (sessionStorage): the last finished comparison,
// keyed to the analysis it started from, and the selection and slider values being worked on.
// Nothing here leaves the device, and every access is guarded because storage can be blocked or full.
import type { Comparison } from '../../lib/types'
import type { ScenarioDef } from '../lib/scenarios'

const RESULT_KEY = 'hindsight.scenariolab.result.v1'
const UI_KEY = 'hindsight.scenariolab.ui.v1'

export interface StoredLab {
  /** Id of the analysis the comparison was run from. */
  baseId: string
  /** The scenarios that were run, in run order (baseline first). */
  scenarios: ScenarioDef[]
  comparison: Comparison
}

export interface Draft {
  temp_delta_c: number
  precip_factor: number
  name: string
}

export interface LabUi {
  selected: string[]
  draft: Draft
}

const isScenario = (s: unknown): s is ScenarioDef => {
  const d = s as Partial<ScenarioDef> | null
  return !!d && typeof d.id === 'string' && typeof d.label === 'string' && Number.isFinite(d.temp_delta_c) && Number.isFinite(d.precip_factor)
}

/** The comparison kept for this tab, or null when there is none for this analysis or it cannot be read. */
export function loadLab(baseId: string): StoredLab | null {
  try {
    const raw = window.sessionStorage.getItem(RESULT_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<StoredLab> | null
    if (!p || p.baseId !== baseId || !Array.isArray(p.scenarios) || !p.scenarios.every(isScenario)) return null
    const variants = p.comparison?.variants
    if (!Array.isArray(variants) || variants.length === 0) return null
    const usable = variants.every((v) => !!v && typeof v.id === 'string' && typeof v.label === 'string' && Array.isArray(v.envelope?.result?.rotations) && v.envelope.result.rotations.length > 0)
    return usable ? (p as StoredLab) : null
  } catch {
    return null
  }
}

/** Which analysis the kept comparison belongs to, whatever analysis is open now. */
export function keptBaseId(): string | null {
  try {
    const raw = window.sessionStorage.getItem(RESULT_KEY)
    const p = raw ? (JSON.parse(raw) as Partial<StoredLab> | null) : null
    return p && typeof p.baseId === 'string' ? p.baseId : null
  } catch {
    return null
  }
}

/** Returns false when the browser refused to keep the comparison (private mode, storage full). */
export function storeLab(lab: StoredLab): boolean {
  try {
    window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(lab))
    return true
  } catch {
    return false
  }
}

export function clearLab(): void {
  try {
    window.sessionStorage.removeItem(RESULT_KEY)
  } catch {
    /* nothing to clear */
  }
}

export function loadUi(): LabUi | null {
  try {
    const raw = window.sessionStorage.getItem(UI_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<LabUi> | null
    const d = p?.draft
    if (!p || !Array.isArray(p.selected) || !p.selected.every((x) => typeof x === 'string')) return null
    if (!d || !Number.isFinite(d.temp_delta_c) || !Number.isFinite(d.precip_factor) || typeof d.name !== 'string') return null
    return { selected: p.selected, draft: { temp_delta_c: d.temp_delta_c, precip_factor: d.precip_factor, name: d.name } }
  } catch {
    return null
  }
}

export function storeUi(ui: LabUi): void {
  try {
    window.sessionStorage.setItem(UI_KEY, JSON.stringify(ui))
  } catch {
    /* the selection simply is not restored after leaving the page */
  }
}
