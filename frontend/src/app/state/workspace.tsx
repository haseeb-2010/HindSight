import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useResource, type Resource } from '../../hooks/useResource'
import { api, errorMessage } from '../../lib/api'
import type { AnalysisEnvelope, AnalyzeBody, CropsResponse, JobState, Preset, PresetsResponse } from '../../lib/types'
import { EMPTY_CONFIG, configFromPreset, configFromRequest, signatureOf, toRequest, type FarmConfig } from '../lib/config'
import { loadLibrary, MAX_LIBRARY, normaliseAnalysis, saveLibrary, type Analysis } from '../lib/library'
import { pollJob } from '../lib/poll'

export type { Analysis } from '../lib/library'

const SESSION_KEY = 'hindsight.workspace.v1'

/** What belongs to this browser tab: the form being edited and which analysis is open. */
interface Session {
  config: FarmConfig
  currentId: string | null
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
  /** Runs the engine for the current settings, or for `override` (which then becomes the current settings). */
  analyse: (override?: FarmConfig) => Promise<boolean>
  /** Selects a demonstration farm with its own settings and analyses it. */
  analysePreset: (p: Preset) => Promise<boolean>
  cancelRun: () => void
  current: Analysis | null
  stale: boolean
  /** Analyses saved on this device, newest first. */
  history: Analysis[]
  /** Set when the browser refused to store analyses; they then live in memory only. */
  storageError: string | null
  openAnalysis: (id: string) => void
  removeAnalysis: (id: string) => void
  renameAnalysis: (id: string, name: string) => void
  /** Adds an engine result obtained elsewhere (e.g. one run of a scenario comparison) to the saved analyses. */
  saveEnvelope: (envelope: AnalysisEnvelope, opts?: { name?: string; open?: boolean }) => string
}

const Ctx = createContext<Workspace | null>(null)
const IDLE: RunState = { status: 'idle', job: null, error: null, startedAt: null }

function loadSession(): { session: Session; legacy: unknown[] } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Session> & { history?: unknown[] }
      if (p.config?.location && p.config.rotation) {
        // Before Phase 03 the analyses themselves lived in the session; they move to the device library.
        return { session: { config: { ...EMPTY_CONFIG, ...p.config }, currentId: p.currentId ?? null }, legacy: Array.isArray(p.history) ? p.history : [] }
      }
    }
  } catch {
    /* unreadable or blocked storage: start clean */
  }
  return { session: { config: EMPTY_CONFIG, currentId: null }, legacy: [] }
}

function initialState() {
  const { session, legacy } = loadSession()
  const lib = loadLibrary()
  const known = new Set(lib.items.map((a) => a.id))
  const migrated = legacy.map(normaliseAnalysis).filter((a): a is Analysis => a !== null && !known.has(a.id))
  return { session, library: [...migrated, ...lib.items].slice(0, MAX_LIBRARY), loadError: lib.error }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [presets, reloadPresets] = useResource<PresetsResponse>((s) => api.presets(s), 'presets')
  const [crops, reloadCrops] = useResource<CropsResponse>((s) => api.crops(s), 'crops')
  const [initial] = useState(initialState)
  const [session, setSession] = useState<Session>(initial.session)
  const [library, setLibrary] = useState<Analysis[]>(initial.library)
  const [storageError, setStorageError] = useState<string | null>(initial.loadError)
  const [run, setRun] = useState<RunState>(IDLE)
  const inflight = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      /* storage full or unavailable: the form simply is not restored after a reload */
    }
  }, [session])

  useEffect(() => {
    setStorageError(saveLibrary(library))
  }, [library])

  useEffect(() => () => inflight.current?.abort(), [])

  const defaultPriorities = useMemo(() => presets.data?.default_priorities ?? {}, [presets.data])
  const body = useMemo(() => toRequest(session.config, defaultPriorities), [session.config, defaultPriorities])
  const signature = useMemo(() => signatureOf(body), [body])
  const current = library.find((a) => a.id === session.currentId) ?? null

  const update = useCallback((fn: (c: FarmConfig) => FarmConfig) => setSession((s) => ({ ...s, config: fn(s.config) })), [])
  const selectPreset = useCallback((p: Preset) => setSession((s) => ({ ...s, config: configFromPreset(p) })), [])
  const resetConfig = useCallback(() => setSession((s) => ({ ...s, config: EMPTY_CONFIG })), [])

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

  const store = useCallback((item: Analysis, open: boolean) => {
    setLibrary((lib) => [item, ...lib.filter((a) => a.id !== item.id)].slice(0, MAX_LIBRARY))
    if (open) setSession((s) => ({ ...s, currentId: item.id }))
  }, [])

  const analyse = useCallback(
    async (override?: FarmConfig) => {
      const config = override ?? session.config
      const request = override ? toRequest(override, defaultPriorities) : body
      if (!request) return false
      if (override) setSession((s) => ({ ...s, config: override }))
      inflight.current?.abort()
      const ctrl = new AbortController()
      inflight.current = ctrl
      const startedAt = Date.now()
      setRun({ status: 'running', job: null, error: null, startedAt })
      try {
        const started = await api.startAnalysis(request, ctrl.signal)
        const job = await pollJob(started.analysis_id, ctrl.signal, (j) => setRun({ status: 'running', job: j, error: null, startedAt }))
        if (job.status === 'done' && job.envelope) {
          const envelope = job.envelope
          store(
            {
              id: envelope.analysis_id ?? started.analysis_id,
              at: new Date().toISOString(),
              name: envelope.result.site.name,
              config,
              signature: signatureOf(request),
              envelope,
            },
            true,
          )
          setRun(IDLE)
          return true
        }
        setRun({ status: 'error', job, error: job.error?.detail ?? 'The analysis could not be completed.', startedAt })
        return false
      } catch (err) {
        if (ctrl.signal.aborted) return false
        setRun({ status: 'error', job: null, error: errorMessage(err), startedAt })
        return false
      }
    },
    [body, defaultPriorities, session.config, store],
  )

  const analysePreset = useCallback((p: Preset) => analyse(configFromPreset(p)), [analyse])

  const saveEnvelope = useCallback(
    (envelope: AnalysisEnvelope, opts?: { name?: string; open?: boolean }) => {
      const config = configFromRequest(envelope.request, envelope.preset_id)
      const id = envelope.analysis_id ?? `local-${Date.now().toString(36)}`
      store(
        {
          id,
          at: new Date().toISOString(),
          name: opts?.name?.trim() || envelope.result.site.name,
          config,
          signature: signatureOf(toRequest(config, defaultPriorities)),
          envelope,
        },
        !!opts?.open,
      )
      if (opts?.open) setSession((s) => ({ ...s, config }))
      return id
    },
    [defaultPriorities, store],
  )

  const openAnalysis = useCallback(
    (id: string) => {
      const a = library.find((x) => x.id === id)
      if (a) setSession({ currentId: id, config: a.config })
    },
    [library],
  )
  const removeAnalysis = useCallback((id: string) => {
    setLibrary((lib) => lib.filter((a) => a.id !== id))
    setSession((s) => (s.currentId === id ? { ...s, currentId: null } : s))
  }, [])
  const renameAnalysis = useCallback((id: string, name: string) => {
    const clean = name.trim().slice(0, 80)
    if (clean) setLibrary((lib) => lib.map((a) => (a.id === id ? { ...a, name: clean } : a)))
  }, [])
  const reloadData = useCallback(() => {
    reloadPresets()
    reloadCrops()
  }, [reloadPresets, reloadCrops])

  const value: Workspace = {
    presets,
    crops,
    reloadData,
    config: session.config,
    update,
    selectPreset,
    setLocation,
    resetConfig,
    defaultPriorities,
    body,
    run,
    analyse,
    analysePreset,
    cancelRun,
    current,
    // compared only once the default priorities are known, or every result would look out of date
    stale: presets.status === 'ready' && !!current && current.signature !== signature,
    history: library,
    storageError,
    openAnalysis,
    removeAnalysis,
    renameAnalysis,
    saveEnvelope,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): Workspace {
  const ws = useContext(Ctx)
  if (!ws) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ws
}
