import { ClimateContext } from './water/ClimateContext'
import { LimitedSeasons } from './water/LimitedSeasons'
import { PriorityExplorer } from './water/PriorityExplorer'
import { TradeoffSummary } from './water/TradeoffSummary'
import { WaterComparison } from './water/WaterComparison'
import type { InsightProps } from './types'

/**
 * Field Intelligence, "Water resilience" tab.
 * A. two separate water measures per rotation, with the field's climate context;
 * B. a real engine re-ranking with a different water conservation weight;
 * C. one alternative against the current rotation in words.
 * Every number is read from the analysis envelope (or, in B, from the two engine runs it starts).
 */
export default function WaterResilience({ env, names }: InsightProps) {
  const rec = env.result.meta.record
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">Explore how your rotation interacts with water availability.</h2>
        <p className="mt-1 max-w-3xl text-[0.9375rem] text-muted">
          HindSight replays the daily weather of {rec.start_year}–{rec.end_year} through a soil-water balance. FAO-56 reference evapotranspiration and crop coefficients give each crop’s modelled
          water demand, and rain and any irrigation refill the soil each day. The figures below are model outputs for this analysis, not measurements from your field.
        </p>
      </div>

      <WaterComparison env={env} />

      <div className="grid gap-5 xl:grid-cols-3">
        <ClimateContext env={env} className="xl:col-span-2" />
        <LimitedSeasons env={env} names={names} />
      </div>

      <PriorityExplorer env={env} />

      <TradeoffSummary env={env} />
    </div>
  )
}
