import type { AnalysisEnvelope } from '../../lib/types'

/** Every Field Intelligence section is driven by one analysis envelope, so it can show any run: the open one, a saved one or the guided tour's. */
export interface InsightProps {
  env: AnalysisEnvelope
  /** Crop id → display name. */
  names: Record<string, string>
}
