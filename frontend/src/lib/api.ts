import type { AnalysisEnvelope, PresetsResponse } from './types'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number | null
  code: string | null

  constructor(message: string, status: number | null = null, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 45_000): Promise<T> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  const outer = init.signal
  const onOuterAbort = () => ctrl.abort()
  outer?.addEventListener('abort', onOuterAbort)
  try {
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { Accept: 'application/json', ...init.headers },
      })
    } catch (err) {
      if (outer?.aborted) throw err
      if (ctrl.signal.aborted) throw new ApiError('The server took too long to answer. Please try again.')
      throw new ApiError('Could not reach the HindSight server. Check that the API is running, then try again.')
    }
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    if (!res.ok) {
      const b = (body ?? {}) as { detail?: unknown; error?: unknown }
      const detail = typeof b.detail === 'string' ? b.detail : `The server answered with HTTP ${res.status}.`
      throw new ApiError(detail, res.status, typeof b.error === 'string' ? b.error : null)
    }
    if (body === null) throw new ApiError('The server sent a response that was not valid JSON.', res.status)
    return body as T
  } finally {
    window.clearTimeout(timer)
    outer?.removeEventListener('abort', onOuterAbort)
  }
}

export const api = {
  presets: (signal?: AbortSignal) => request<PresetsResponse>('/api/presets', { signal }),
  demo: (presetId: string, signal?: AbortSignal) =>
    request<AnalysisEnvelope>(`/api/demo/${encodeURIComponent(presetId)}`, { signal }),
  analyzePreset: (presetId: string, signal?: AbortSignal) =>
    request<AnalysisEnvelope>(`/api/analyze/preset/${encodeURIComponent(presetId)}`, { method: 'POST', signal }, 90_000),
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.name !== 'AbortError') return err.message
  return 'Something went wrong. Please try again.'
}
