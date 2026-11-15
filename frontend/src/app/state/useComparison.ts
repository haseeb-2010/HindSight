import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../../lib/api'
import type { AnalyzeBody, CompareVariant, Comparison, JobState } from '../../lib/types'
import { pollJob } from '../lib/poll'

export interface ComparisonState {
  status: 'idle' | 'running' | 'done' | 'error'
  /** Latest job state while running: `job.stages` carries "Run 2 of 4: …" in the simulate stage. */
  job: JobState | null
  /** The variants of the run in progress or just finished, in request order. */
  variants: CompareVariant[]
  result: Comparison | null
  error: string | null
  startedAt: number | null
}

const IDLE: ComparisonState = { status: 'idle', job: null, variants: [], result: null, error: null, startedAt: null }

/**
 * Runs one field under several scenarios or priority sets (POST /api/scenarios/compare).
 * The server reads weather and soil once and re-runs the engine per variant; nothing is computed here.
 */
export function useComparison() {
  const [state, setState] = useState<ComparisonState>(IDLE)
  const inflight = useRef<AbortController | null>(null)

  useEffect(() => () => inflight.current?.abort(), [])

  const run = useCallback(async (base: AnalyzeBody, variants: CompareVariant[]): Promise<Comparison | null> => {
    inflight.current?.abort()
    const ctrl = new AbortController()
    inflight.current = ctrl
    const startedAt = Date.now()
    setState({ status: 'running', job: null, variants, result: null, error: null, startedAt })
    try {
      const started = await api.startComparison(base, variants, ctrl.signal)
      const job = await pollJob(started.analysis_id, ctrl.signal, (j) => setState((s) => ({ ...s, job: j })))
      if (job.status === 'done' && job.comparison) {
        setState({ status: 'done', job, variants, result: job.comparison, error: null, startedAt })
        return job.comparison
      }
      setState({ status: 'error', job, variants, result: null, error: job.error?.detail ?? 'The comparison could not be completed.', startedAt })
      return null
    } catch (err) {
      if (ctrl.signal.aborted) return null
      setState({ status: 'error', job: null, variants, result: null, error: errorMessage(err), startedAt })
      return null
    }
  }, [])

  const cancel = useCallback(() => {
    inflight.current?.abort()
    setState(IDLE)
  }, [])

  return { ...state, run, cancel, reset: cancel }
}
