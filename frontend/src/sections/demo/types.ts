import type { AnalysisEnvelope } from '../../lib/types'

export type AnalysisState =
  | { status: 'loading'; startedAt: number }
  | { status: 'ready'; env: AnalysisEnvelope }
  | { status: 'error'; error: string }
