import { CloudRain, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { InfoTip } from '../../../components/ui/InfoTip'
import { fmtNum, isNum } from '../../../lib/format'
import type { AnalysisEnvelope } from '../../../lib/types'
import { Callout } from '../../components/controls'
import { isScenarioActive, scenarioText } from '../../lib/config'
import { Chip, Panel } from '../../results/shared'
import { MonthlyBalanceChart } from './MonthlyBalanceChart'
import { annualSentence, monthBalance, monthlySentence } from './waterText'

const ET0_TIP =
  'Reference evapotranspiration (ET0): the water a well-watered reference grass surface would lose to the air, calculated for each day of the weather record with the FAO-56 Penman–Monteith method. ' +
  'It describes the atmosphere’s demand for water, not what your crops used.'

function AnnualFigure({ icon, label, tip, value, tag }: { icon: ReactNode; label: string; tip?: string; value: number | undefined; tag?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand text-forest-950 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <div className="min-w-0">
        <dt className="flex flex-wrap items-center gap-1 text-[0.8125rem] leading-tight font-bold text-ink">
          {label}
          {tip && <InfoTip label={label}>{tip}</InfoTip>}
        </dt>
        <dd className="mt-1">
          {isNum(value) ? (
            <span className="font-display text-[1.625rem] leading-none font-semibold text-forest-950">
              {fmtNum(value)} <span className="font-sans text-[0.8125rem] font-bold text-ink">mm a year</span>
            </span>
          ) : (
            <span className="text-[0.9375rem] font-bold text-ink">Not available in this analysis</span>
          )}
          {tag && isNum(value) && (
            <span className="mt-1.5 block">
              <Chip tone="white">{tag}</Chip>
            </span>
          )}
        </dd>
      </div>
    </div>
  )
}

/** The field's rainfall and atmospheric water demand, read from the same weather record the engine replayed. */
export function ClimateContext({ env, className }: { env: AnalysisEnvelope; className?: string }) {
  const res = env.result
  const summary = res.site.climate_summary
  const period = `${res.meta.record.start_year}–${res.meta.record.end_year}`
  const ctx = env.context?.climate
  const rows = monthBalance(ctx?.monthly)
  const scenarioOn = isScenarioActive(env.request?.scenario) || !!ctx?.scenario_applied
  const annual = annualSentence(summary?.annual_rain_mm, summary?.annual_et0_mm)
  const grid = env.inputs?.climate?.grid_note

  return (
    <Panel title="Climate context for this field" className={className}>
      <div className="grid gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,18.5rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <dl className="space-y-5">
            <AnnualFigure icon={<CloudRain aria-hidden="true" />} label="Average rainfall" value={summary?.annual_rain_mm} tag="Gridded estimate" />
            <AnnualFigure icon={<Sun aria-hidden="true" />} label="Reference evapotranspiration (ET0)" tip={ET0_TIP} value={summary?.annual_et0_mm} />
          </dl>
          {annual && <p className="mt-5 text-[0.9375rem] leading-relaxed text-ink">{annual}</p>}
          <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
            Averages over {period} from NASA POWER{grid ? ` (${grid})` : ''}. Rainfall describes the grid cell around your field, not a rain gauge on it. ET0 is for a reference grass surface: a
            crop’s own demand also depends on its growth stage.
          </p>
          {scenarioOn && (
            <Callout tone="warn" className="mt-4">
              A what-if scenario{scenarioText(env.request?.scenario) ? ` (${scenarioText(env.request?.scenario)})` : ''} was applied to this record, so these are adjusted values, not what was
              recorded.
            </Callout>
          )}
        </div>

        <div className="min-w-0">
          {rows ? (
            <MonthlyBalanceChart rows={rows} period={period} summary={monthlySentence(rows)} />
          ) : (
            <Callout tone="plain" title="Monthly chart not available">
              This analysis does not carry month-by-month values of the weather record, so rainfall cannot be set against reference evapotranspiration by month here. Analyses saved before this
              feature was added do not include them. Run the analysis again from Farm Analysis to see the chart.
            </Callout>
          )}
        </div>
      </div>
    </Panel>
  )
}
