import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../lib/api'
import type { AnalyzeBody, RotationPreview } from '../../lib/types'

export type PreviewState =
  | { status: 'empty' | 'loading'; data: RotationPreview | null; error: null }
  | { status: 'ready'; data: RotationPreview; error: null }
  | { status: 'invalid'; data: null; error: string }

/** The engine's own schedule check and calendar for a rotation, refreshed shortly after each edit. */
export function useRotationPreview(rotation: AnalyzeBody['current_rotation']): PreviewState {
  const key = JSON.stringify(rotation)
  const [state, setState] = useState<PreviewState>({ status: rotation.slots.length ? 'loading' : 'empty', data: null, error: null })

  useEffect(() => {
    const rot = JSON.parse(key) as AnalyzeBody['current_rotation']
    if (rot.slots.length === 0) {
      setState({ status: 'empty', data: null, error: null })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ status: 'loading', data: s.data, error: null }))
    const t = window.setTimeout(() => {
      api
        .rotationPreview(rot, ctrl.signal)
        .then((data) => {
          if (ctrl.signal.aborted) return
          setState(data.valid ? { status: 'ready', data, error: null } : { status: 'invalid', data: null, error: data.detail })
        })
        .catch((err: unknown) => !ctrl.signal.aborted && setState({ status: 'invalid', data: null, error: errorMessage(err) }))
    }, 220)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [key])

  return state
}
