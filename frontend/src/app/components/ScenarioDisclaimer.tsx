import { Callout } from './controls'

/** The required wording for every view that shows a what-if scenario. Do not shorten it, on any screen size or in print. */
export const SCENARIO_DISCLAIMER =
  'These are hypothetical adjustments to the historical weather record. They are not future climate projections. ' +
  'The model applies a uniform temperature offset and precipitation multiplier; it does not simulate future weather timing or changing rainfall patterns.'

export function ScenarioDisclaimer({ className }: { className?: string }) {
  return (
    <Callout tone="warn" title="Hypothetical stress tests, not forecasts" className={className}>
      <span data-scenario-disclaimer>{SCENARIO_DISCLAIMER}</span>
    </Callout>
  )
}
