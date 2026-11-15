import { History, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { ButtonRouterLink } from '../../components/ui/Button'
import { isNum } from '../../lib/format'
import { Callout } from '../components/controls'
import { isScenarioActive, scenarioText } from '../lib/config'
import { shiftSentence } from '../lib/insights'
import { Panel } from '../results/shared'
import { indicatorInfo } from './climate/definitions'
import { HowToRead } from './climate/HowToRead'
import { IndicatorCards, ShiftChips, type YearSeries } from './climate/IndicatorCards'
import { YearlyChart } from './climate/YearlyChart'
import type { InsightProps } from './types'

const HOW_TO_READ_ID = 'climate-how-to-read'

const span = (w: [number, number] | undefined) => (w && isNum(w[0]) && isNum(w[1]) ? `${w[0]}–${w[1]}` : null)

/** Field Intelligence, section 1: how the weather record for this location differs between its two halves. */
export default function ClimateInsights({ env }: InsightProps) {
  const res = env.result
  const shifts = res.climate_shift ?? []
  const windows = res.meta.windows
  // The years of the two periods as the engine reports them. Null when it did not: nothing is assumed.
  const earlySpan = span(windows?.early)
  const lateSpan = span(windows?.late)
  const earlyIn = earlySpan ?? 'the earlier period'
  const lateIn = lateSpan ?? 'the later period'
  const rec = res.meta.record
  const recordYears = isNum(rec?.start_year) && isNum(rec?.end_year) ? rec.end_year - rec.start_year + 1 : null
  const ctx = env.context?.climate ?? null
  const scenarioOn = !!ctx?.scenario_applied || isScenarioActive(env.request?.scenario)
  const scenario = scenarioText(env.request?.scenario)

  const [picked, setPicked] = useState<string | null>(null)
  const selected = shifts.find((s) => s.id === picked) ?? shifts[0]

  /** The yearly values behind an indicator, only when the analysis stores a complete series for it. */
  const seriesFor = (id: string): YearSeries | null => {
    const values = ctx?.annual?.[id]
    const years = ctx?.years
    if (!Array.isArray(values) || !Array.isArray(years) || values.length === 0 || values.length !== years.length || !values.every(isNum)) return null
    return { years, values }
  }
  const series = selected ? seriesFor(selected.id) : null
  const info = selected ? indicatorInfo(selected.id, ctx) : null
  const anySeries = shifts.some((s) => seriesFor(s.id) !== null)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">Understand how your local growing conditions have changed.</h2>
        <p className="mt-1.5 max-w-3xl text-[0.9375rem] leading-relaxed text-muted">
          {shifts.length > 0 ? (
            <>
              The engine compared {shifts.length} {shifts.length === 1 ? 'indicator' : 'indicators'} from the NASA POWER weather record for this location between{' '}
              {earlySpan && lateSpan ? `${earlySpan} and ${lateSpan}` : 'an earlier and a later period'}. They are gridded estimates for the area around the field, not
              measurements taken on it. {anySeries ? 'Choose a card to see every year.' : 'Choose a card to read its finding.'}{' '}
            </>
          ) : (
            <>Indicators from the NASA POWER weather record for this location, compared between two historical periods. </>
          )}
          <a
            href={`#${HOW_TO_READ_ID}`}
            className="rounded-sm font-bold whitespace-nowrap text-forest-950 underline decoration-sage decoration-[1.5px] underline-offset-[3px] hover:decoration-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
          >
            How to read these numbers
          </a>
        </p>
      </div>

      {scenarioOn && (
        <Callout tone="warn" title="These values describe an adjusted record, not what was observed">
          This analysis ran with a what-if scenario{scenario ? ` (${scenario})` : ''} applied to every day of the historical record. Every number and chart in this section
          describes that adjusted record, not the weather that was observed. It is a hypothetical historical-weather stress test, not a forecast.
        </Callout>
      )}

      {shifts.length === 0 || !selected ? (
        <Panel>
          <p className="text-[0.9375rem] font-semibold text-ink">Not available: the engine did not return climate indicators for this analysis.</p>
        </Panel>
      ) : (
        <>
          <IndicatorCards
            shifts={shifts}
            selected={selected.id}
            onSelect={setPicked}
            earlyLabel={earlySpan ?? 'Earlier period'}
            lateLabel={lateSpan ?? 'Later period'}
            seriesFor={seriesFor}
            windows={windows}
            hintFor={(id) => indicatorInfo(id, ctx)?.hint}
          />

          <Panel title={series ? `${selected.label}: every year of the record` : selected.label} action={<ShiftChips s={selected} />}>
            {series ? (
              <>
                <p className="-mt-2 mb-4 max-w-3xl text-[0.875rem] leading-relaxed text-muted">
                  {info && <span className="font-semibold text-ink">{info.definition} </span>}
                  Each bar is one year of the {scenarioOn ? 'adjusted ' : ''}NASA POWER record for this location, {series.years[0]}–{series.years[series.years.length - 1]}.
                  {earlySpan && lateSpan ? ' The two shaded bands are the periods being compared, and each line is that period’s mean as reported by the engine.' : ''}
                </p>
                <YearlyChart key={selected.id} shift={selected} series={series} windows={windows} earlySpan={earlySpan} lateSpan={lateSpan} />
              </>
            ) : (
              <div className="space-y-4">
                {info && <p className="-mt-2 max-w-3xl text-[0.875rem] leading-relaxed font-semibold text-ink">{info.definition}</p>}
                <Callout tone="plain" title="Yearly values are not stored with this analysis">
                  {ctx
                    ? 'The year-by-year values for this indicator were not saved with the analysis, so no chart is drawn.'
                    : 'This analysis was saved without the year-by-year weather values, so no chart is drawn.'}{' '}
                  The two period averages on the cards are still the engine’s own figures. Run the analysis again to see every year.
                  <span className="mt-3 block print:hidden">
                    <ButtonRouterLink to="/app/analysis" variant="secondary" icon={<RefreshCw />}>
                      Open Farm Analysis
                    </ButtonRouterLink>
                  </span>
                </Callout>
                <p className="rounded-2xl bg-sand/60 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">{shiftSentence(selected, earlyIn, lateIn)}</p>
              </div>
            )}
          </Panel>
        </>
      )}

      <Callout tone="info" title="Read rainfall alongside local records">
        <p>
          Rainfall estimates should be interpreted alongside local station records because gridded historical rainfall may differ from conditions measured at individual farms.
        </p>
        <p className="mt-2">
          NASA POWER describes a grid cell about 50 km wide, not a rain gauge on your field. At the two Pakistan demonstration sites its rainfall differs from published climate
          normals by roughly +48% and −36%. HindSight shows the data as delivered and does not adjust it.
        </p>
      </Callout>

      <div id={HOW_TO_READ_ID} className="scroll-mt-32">
        <HowToRead earlySpan={earlySpan} lateSpan={lateSpan} recordYears={recordYears} />
      </div>

      <p className="flex items-start gap-2 text-[0.875rem] leading-snug font-semibold text-ink">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-forest-800" aria-hidden="true" />
        These comparisons describe the past record only. They are not projections.
      </p>
    </div>
  )
}
