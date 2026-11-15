import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../lib/api'

export type Resource<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: string }

/** Fetch once on mount (and on reload()); aborts on unmount. */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<Resource<T>>({ status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading', data: null, error: null })
    load(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setState({ status: 'ready', data, error: null })
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setState({ status: 'error', data: null, error: errorMessage(err) })
      })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const reload = useCallback(() => setAttempt((a) => a + 1), [])
  return [state, reload] as const
}
