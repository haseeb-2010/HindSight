import { Database, History, Zap } from 'lucide-react'
import { fmtElapsed, fmtTime } from '../../lib/format'
import type { AnalysisEnvelope } from '../../lib/types'
import { isScenarioActive, scenarioText } from '../lib/config'
import { Chip } from '../results/shared'

/**
 * Says whether a result was calculated just now by the engine or is a stored demonstration output.
 * A saved result is never presented as a fresh calculation.
 */
export function SourceBadge({ env, detail = true }: { env: AnalysisEnvelope; detail?: boolean }) {
  if (env.source === 'live') {
    return (
      <Chip tone="lime">
        <Zap className="h-3 w-3" aria-hidden="true" /> Live analysis
        {detail && fmtTime(env.computed_at) ? ` · ${fmtTime(env.computed_at)}` : ''}
        {detail && fmtElapsed(env.elapsed_ms) ? ` · ${fmtElapsed(env.elapsed_ms)}` : ''}
      </Chip>
    )
  }
  return (
    <Chip tone="peri">
      <Database className="h-3 w-3" aria-hidden="true" /> Saved demonstration result
    </Chip>
  )
}

/** Shown wherever a result was produced with a what-if scenario applied. */
export function ScenarioChip({ env }: { env: AnalysisEnvelope }) {
  if (!isScenarioActive(env.request?.scenario)) return null
  return (
    <Chip tone="signal">
      <History className="h-3 w-3" aria-hidden="true" /> What-if: {scenarioText(env.request?.scenario)}
    </Chip>
  )
}
