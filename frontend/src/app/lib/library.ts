// "My Analyses": finished analyses kept in this browser's local storage.
// HindSight has no accounts or server-side storage, so nothing here leaves the device.
import type { AnalysisEnvelope } from '../../lib/types'
import { configFromRequest, type FarmConfig } from './config'

export const LIBRARY_KEY = 'hindsight.library.v1'
export const MAX_LIBRARY = 20

/** One finished analysis with the settings that produced it. */
export interface Analysis {
  id: string
  /** ISO time the analysis was saved on this device. */
  at: string
  name: string
  config: FarmConfig
  signature: string
  envelope: AnalysisEnvelope
}

export const STORAGE_MESSAGES = {
  unavailable:
    'This browser is not letting HindSight store data on this device (private browsing or blocked storage). Analyses stay available until you close the tab; download the JSON to keep one.',
  full: 'This device’s browser storage is full, so the latest analysis could not be saved. Remove older analyses or download them as JSON, then try again.',
  unreadable: 'The analyses stored on this device could not be read, so the list starts empty. Analyses you run now will be saved normally.',
}

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Repairs what can be repaired in a stored entry; returns null when there is no usable result in it. */
export function normaliseAnalysis(raw: unknown): Analysis | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Partial<Analysis>
  const env = a.envelope
  if (!env || typeof env !== 'object' || !env.result || !Array.isArray(env.result.rotations) || env.result.rotations.length === 0) return null
  const id = typeof a.id === 'string' && a.id ? a.id : (env.analysis_id ?? `local-${Math.random().toString(36).slice(2, 10)}`)
  const at = typeof a.at === 'string' && !Number.isNaN(Date.parse(a.at)) ? a.at : (env.computed_at && !Number.isNaN(Date.parse(env.computed_at)) ? env.computed_at : new Date().toISOString())
  const name = typeof a.name === 'string' && a.name.trim() ? a.name : env.result.site?.name || 'Unnamed analysis'
  const config = a.config?.location && a.config.rotation ? a.config : configFromRequest(env.request, env.preset_id)
  return { id, at, name, config, signature: typeof a.signature === 'string' ? a.signature : '', envelope: env }
}

export function loadLibrary(): { items: Analysis[]; error: string | null } {
  const store = storage()
  if (!store) return { items: [], error: STORAGE_MESSAGES.unavailable }
  try {
    const raw = store.getItem(LIBRARY_KEY)
    if (!raw) return { items: [], error: null }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { items: [], error: STORAGE_MESSAGES.unreadable }
    return { items: parsed.map(normaliseAnalysis).filter((a): a is Analysis => a !== null).slice(0, MAX_LIBRARY), error: null }
  } catch {
    return { items: [], error: STORAGE_MESSAGES.unreadable }
  }
}

/** Writes the library. Returns a message for the user when the browser refused, otherwise null. */
export function saveLibrary(items: Analysis[]): string | null {
  const store = storage()
  if (!store) return STORAGE_MESSAGES.unavailable
  try {
    store.setItem(LIBRARY_KEY, JSON.stringify(items))
    return null
  } catch (err) {
    const quota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return quota ? STORAGE_MESSAGES.full : STORAGE_MESSAGES.unavailable
  }
}
