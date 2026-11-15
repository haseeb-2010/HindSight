import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useResource, type Resource } from '../../hooks/useResource'
import { api, errorMessage } from '../../lib/api'
import type { AnalysisEnvelope, AnalyzeBody, CropsResponse, JobState, Preset, PresetsResponse } from '../../lib/types'
import { EMPTY_CONFIG, configFromPreset, signatureOf, toRequest, type FarmConfig } from '../lib/config'

const STORAGE_KEY = 'hindsight.workspace.v1'
const MAX_HISTORY = 6

/** One finished analysis with the settings that produced it. Kept for this browser session only. */
export interface Analysis {
  id: string
  at: string
  name: string
  config: FarmConfig
  signature: string
  envelope: AnalysisEnvelope
}

interface Persisted {
  config: FarmConfig
  currentId: string | null
  history: Analysis[]
}

export interface RunState {
  status: 'idle' | 'running' | 'error'
  job: JobState | null
  error: string | null
  startedAt: number | null
}

interface Workspace {
  presets: Resource<PresetsResponse>
  crops: Resource<CropsResponse>
  reloadData: () => void
  config: FarmConfig
  update: (fn: (c: FarmConfig) => FarmConfig) => void
  selectPreset: (p: Preset) => void
  setLocation: (lat: number | null, lon: number | null, name?: string) => void
  resetConfig: () => void
  defaultPriorities: Record<string, number>
  body: AnalyzeBody | null
  run: RunState
  analyse: () => Promise<boolean>
  cancelRun: () => void
  current: Analysis | null
  stale: boolean
  history: Analysis[]
  openAnalysis: (id: string) => void
  removeAnalysis: (id: string) => void
}

const Ctx = createContext<Workspace | null>(null)
const IDLE: RunState = { status: 'idle', job: null, error: null, startedAt: null }

function load(): Persisted {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>
      if (p.config?.location && p.config.rotation && Array.isArray(p.history)) {
        return { config: { ...EMPTY_CONFIG, ...p.config }, currentId: p.currentId ?? null, history: p.history }
      }
    }
  } catch {
    /* unreadable or blocked storage: start clean */
  }
  return { config: EMPTY_CONFIG, currentId: null, history: [] }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      window.clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [presets, reloadPresets] = useResource<PresetsResponse>((s) => api.presets(s), 'presets')
  const [crops, reloadCrops] = useResource<CropsResponse>((s) => api.crops(s), 'crops')
  const [state, setState] = useState<Persisted>(load)
  const [run, setRun] = useState<RunState>(IDLE)
  const inflight = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage full or unavailable: the session simply is not restored after a reload */
    }
  }, [state])

  useEffect(() => () => inflight.current?.abort(), [])

  const defaultPriorities = useMemo(() => presets.data?.default_priorities ?? {}, [presets.data])
  const body = useMemo(() => toRequest(state.config, defaultPriorities), [state.config, defaultPriorities])
  const signature = useMemo(() => signatureOf(body), [body])
  const current = state.history.find((a) => a.id === state.currentId) ?? null

  const update = useCallback((fn: (c: FarmConfig) => FarmConfig) => setState((s) => ({ ...s, config: fn(s.config) })), [])
  const selectPreset = useCallback((p: Preset) => setState((s) => ({ ...s, config: configFromPreset(p) })), [])
  const resetConfig = useCallback(() => setState((s) => ({ ...s, config: EMPTY_CONFIG })), [])

  const setLocation = useCallback(
    (lat: number | null, lon: number | null, name?: string) =>
      update((c) => {
        const samePreset = c.location.preset_id !== null && c.location.lat === lat && c.location.lon === lon
        if (samePreset) return c
        const location = { lat, lon, name: name ?? (c.location.preset_id ? '' : c.location.name), preset_id: null }
        // Leaving a demonstration farm: its soil, water and rotation described that farm, not this point,
        // so the farm profile starts again. Priorities, assumptions and scenario are the farmer's own and stay.
        if (c.location.preset_id !== null) return { ...c, location, soil: EMPTY_CONFIG.soil, water: EMPTY_CONFIG.water, rotation: EMPTY_CONFIG.rotation }
        // Moving a custom point: keep the profile, but an accepted SoilGrids estimate belonged to the old point.
        return { ...c, location, soil: { ...c.soil, source: 'farmer' } }
      }),
    [update],
  )

  const cancelRun = useCallback(() => {
    inflight.current?.abort()
    setRun(IDLE)
  }, [])

  const analyse = useCallback(async () => {
    if (!body) return false
    inflight.current?.abort()
    const ctrl = new AbortController()
    inflight.current = ctrl
    const startedAt = Date.now()
    const config = state.config
    setRun({ status: 'running', job: null, error: null, startedAt })
    try {
      const started = await api.startAnalysis(body, ctrl.signal)
      let delay = 300
      for (;;) {
        const job = await api.analysis(started.analysis_id, ctrl.signal)
        if (job.status === 'done' && job.envelope) {
          const envelope = job.envelope
          const item: Analysis = {
            id: envelope.analysis_id ?? started.analysis_id,
            at: new Date().toISOString(),
            name: envelope.result.site.name,
            config,
            signature,
            envelope,
          }
          setState((s) => ({ ...s, currentId: item.id, history: [item, ...s.history.filter((a) => a.id !== item.id)].slice(0, MAX_HISTORY) }))
          setRun(IDLE)
          return true
        }
        if (job.status === 'error') {
          setRun({ status: 'error', job, error: job.error?.detail ?? 'The analysis could not be completed.', startedAt })
          return false
        }
        setRun({ status: 'running', job, error: null, startedAt })
        await sleep(delay, ctrl.signal)
        delay = Math.min(Math.round(delay * 1.35), 1500)
      }
    } catch (err) {
      if (ctrl.signal.aborted) return false
      setRun({ status: 'error', job: null, error: errorMessage(err), startedAt })
      return false
    }
  }, [body, signature, state.config])

  const openAnalysis = useCallback(
    (id: string) => setState((s) => {
      const a = s.history.find((x) => x.id === id)
      return a ? { ...s, currentId: id, config: a.config } : s
    }),
    [],
  )
  const removeAnalysis = useCallback(
    (id: string) => setState((s) => ({ ...s, history: s.history.filter((a) => a.id !== id), currentId: s.currentId === id ? null : s.currentId })),
    [],
  )
  const reloadData = useCallback(() => {
    reloadPresets()
    reloadCrops()
  }, [reloadPresets, reloadCrops])

  const value: Workspace = {
    presets,
    crops,
    reloadData,
    config: state.config,
    update,
    selectPreset,
    setLocation,
    resetConfig,
    defaultPriorities,
    body,
    run,
    analyse,
    cancelRun,
    current,
    // compared only once the default priorities are known, or every result would look out of date
    stale: presets.status === 'ready' && !!current && current.signature !== signature,
    history: state.history,
    openAnalysis,
    removeAnalysis,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): Workspace {
  const ws = useContext(Ctx)
  if (!ws) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ws
}
