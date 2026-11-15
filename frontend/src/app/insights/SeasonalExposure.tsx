import { useRef, useState } from 'react'
import { Mascot } from '../../components/ui/Mascot'
import { currentRotation, rankedRotations, rotationLabel } from '../../lib/analysis'
import { fmtNum, isNum } from '../../lib/format'
import { Callout, Segmented } from '../components/controls'
import { isScenarioActive, scenarioText } from '../lib/config'
import { calendarByYear, exposureSentence, METRIC_BY_ID, monthlyShare, tradeoffs } from '../lib/insights'
import { HBars, Panel, RotationPicker, TIP } from '../results/shared'
import { BareHeatmap } from './season/BareHeatmap'
import { cropOrder, monthRuns, mostlyBareMonths, runsText, sharePct } from './season/calendar'
import { CropTimeline } from './season/CropTimeline'
import { RainContext } from './season/RainContext'
import { RotationStrips } from './season/RotationStrips'
import type { InsightProps } from './types'

/** The exact name of the engine's exposure indicator on this page. */
const EXPOSURE_LABEL = 'Heavy rainfall exposure during relatively bare periods'

/** Field Intelligence, section 2: when the rotation calendar leaves the soil bare, against the record's rainy months. */
export default function SeasonalExposure({ env, names }: InsightProps) {
  const res = env.result
  const ranked = rankedRotations(res)
  const cur = currentRotation(res)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [yearPick, setYearPick] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const top = useRef<HTMLDivElement>(null)

  const rotation = ranked.find((r) => r.id === pickedId) ?? cur ?? ranked[0]
  if (!rotation) return <Callout tone="warn">The engine returned no rotations for this analysis.</Callout>

  const multi = rotation.cycle_years > 1
  const year = Math.min(yearPick, Math.max(1, rotation.cycle_years) - 1)
  const rows = calendarByYear(rotation)
  const row = rows[year] ?? []
  const hasCalendar = (rotation.calendar?.length ?? 0) > 0
  const order = cropOrder(rotation)
  const climate = env.context?.climate ?? null
  const monthly = climate && Array.isArray(climate.monthly) && climate.monthly.length === 12 ? climate.monthly : null
  const scenarioOn = !!climate?.scenario_applied || isScenarioActive(env.request?.scenario)
  const scenario = scenarioText(env.request?.scenario)
  const rec = res.meta.record
  const heavyMm = climate?.thresholds?.heavy_rain_mm

  const select = (id: string, scroll = false) => {
    setPickedId(id)
    setYearPick(0)
    setActive(null)
    if (scroll) top.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  // The second plain-language sentence: only when the calendar has mostly bare months AND the monthly record is stored.
  const bareMonths = mostlyBareMonths(row)
  const bareText = bareMonths.length ? runsText(monthRuns(bareMonths, !multi)) : null
  const inBare = (key: 'rain_mm' | 'heavy_rain_days') => (monthly ?? []).filter((m) => bareMonths.includes(m.month)).reduce((a, m) => a + m[key], 0)
  const allYear = (key: 'rain_mm' | 'heavy_rain_days') => (monthly ?? []).reduce((a, m) => a + m[key], 0)
  const rainShare = monthlyShare(monthly ?? undefined, 'rain_mm', bareMonths)
  const heavyShare = monthlyShare(monthly ?? undefined, 'heavy_rain_days', bareMonths)
  const measured =
    bareText && monthly && rainShare !== null
      ? `${multi ? `In year ${year + 1} of the rotation, the` : 'The'} mostly bare months (${bareText}) bring on average ${fmtNum(inBare('rain_mm'))} mm of the record’s ${fmtNum(
          allYear('rain_mm'),
        )} mm of rain a year (${sharePct(rainShare)})` +
        (heavyShare !== null
          ? ` and ${fmtNum(inBare('heavy_rain_days'), 1)} of its ${fmtNum(allYear('heavy_rain_days'), 1)} heavy-rain days a year (${sharePct(heavyShare)}).`
          : '. No day in the record reached the heavy-rain threshold.')
      : null

  const erosion = METRIC_BY_ID.erosion
  const mine = erosion.get(rotation)
  const versus = cur && !rotation.is_current ? tradeoffs(rotation, cur).find((t) => t.metric.id === 'erosion') : undefined
  const indicatorSentence = !isNum(mine)
    ? 'Not available: the engine did not return this indicator for the rotation.'
    : `Counted day by day over ${rec.start_year}–${rec.end_year}, ${sharePct(mine)} of the record’s heavy-rain days fell while this rotation’s calendar had no crop in the ground` +
      (versus && isNum(versus.base) && isNum(versus.delta)
        ? `, ${versus.verdict === 'similar' ? 'about the same as' : versus.delta < 0 ? 'lower than' : 'higher than'} your current rotation (${sharePct(versus.base)}).`
        : '.')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">When is your field most exposed?</h2>
        <p className="mt-1.5 max-w-3xl text-[0.9375rem] leading-relaxed text-muted">
          Soil with no crop on it is more exposed when heavy rain arrives. This section sets each rotation’s calendar from the simulation beside the months in which the weather
          record brings rain and heavy-rain days. The calendar is modelled from sowing dates and season lengths. It is not a satellite observation of your field.
        </p>
      </div>

      <div ref={top} className="scroll-mt-36">
        <Panel>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <p className="mb-2 text-[0.8125rem] font-extrabold text-forest-950">Rotation shown ({ranked.length} in this analysis, by rank)</p>
              <RotationPicker rotations={ranked} selected={rotation.id} onSelect={(id) => select(id)} label="Rotation shown in the seasonal exposure charts" />
            </div>
            {multi && (
              <div>
                <p className="mb-2 text-[0.8125rem] font-extrabold text-forest-950">Year of the {rotation.cycle_years}-year cycle</p>
                <Segmented
                  label="Rotation year shown"
                  value={year}
                  onChange={(v) => {
                    setYearPick(v)
                    setActive(null)
                  }}
                  options={Array.from({ length: rotation.cycle_years }, (_, i) => ({ value: i, label: `Year ${i + 1}` }))}
                />
              </div>
            )}
          </div>

          <div className="mt-5 flex items-start gap-4 rounded-2xl bg-lime-100 p-4 ring-1 ring-forest-950/10 sm:p-5">
            <Mascot name="mint" decorative className="hidden w-16 shrink-0 sm:block" sizes="64px" />
            <div className="min-w-0">
              <h3 className="text-[1.0625rem] leading-snug">In plain words</h3>
              <p className="mt-1.5 text-[1rem] leading-relaxed font-semibold text-forest-950">
                {hasCalendar ? exposureSentence(rotation) : 'Not available: the engine did not return a calendar for this rotation, so its bare periods cannot be described.'}
              </p>
              {hasCalendar && measured && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink">{measured}</p>}
              {hasCalendar && bareText && !monthly && (
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink">
                  Monthly rainfall is not stored with this analysis, so the rain that falls in those months cannot be shown. Run the analysis again to see it.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Twelve-month crop calendar">
        <p className="-mt-2 mb-4 max-w-3xl text-[0.875rem] leading-relaxed text-muted">
          {rotationLabel(rotation)}
          {multi ? `, year ${year + 1} of ${rotation.cycle_years}` : ''}: when each crop is in the ground and when the soil is bare, month by month, from the engine’s calendar.
        </p>
        <CropTimeline rotation={rotation} rows={rows} year={year} names={names} order={order} active={active} setActive={setActive} />
      </Panel>

      {hasCalendar && (
        <Panel title="Modelled bare-soil fraction, month by month">
          <p className="-mt-2 mb-4 max-w-3xl text-[0.875rem] leading-relaxed text-muted">
            The modelled bare-soil fraction is the share of a month’s days with no crop in the ground in the engine’s calendar for this rotation. It is not a satellite
            observation and says nothing about residue or weeds on the field.
          </p>
          <BareHeatmap rotation={rotation} rows={rows} year={year} names={names} active={active} setActive={setActive} />
        </Panel>
      )}

      <Panel title="Rainfall and heavy-rain days beside the bare months">
        <p className="-mt-2 mb-4 max-w-3xl text-[0.875rem] leading-relaxed text-muted">
          What the {scenarioOn ? 'adjusted ' : ''}NASA POWER record for this location brings in each calendar month, on the same twelve months as the calendar above. These are
          gridded estimates for the area, not measurements on the field.
        </p>
        {scenarioOn && (
          <Callout tone="warn" className="mb-4" title="These values describe an adjusted record, not what was observed">
            This analysis ran with a what-if scenario{scenario ? ` (${scenario})` : ''} applied to the historical record, so the monthly rainfall and the exposure indicator below
            describe that adjusted record. It is a hypothetical historical-weather stress test, not a forecast.
          </Callout>
        )}
        {monthly && climate ? (
          <RainContext rotation={rotation} row={row} year={year} hasCalendar={hasCalendar} climate={climate} active={active} setActive={setActive} />
        ) : (
          <Callout tone="plain" title="Monthly rainfall is not stored with this analysis">
            This analysis was saved without the month-by-month weather values, so no rainfall chart is drawn. The calendar above and the engine’s indicator below are still
            available. Run the analysis again to see rainfall and heavy-rain days by month.
          </Callout>
        )}

        <div className="mt-6 grid gap-x-10 gap-y-5 border-t border-border pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <HBars
            title={EXPOSURE_LABEL}
            tip={TIP.erosion}
            caption="Share of the record’s heavy-rain days that fell on days with no crop in the ground."
            max={1}
            format={sharePct}
            rows={[
              { key: rotation.id, label: rotationLabel(rotation), value: mine, current: rotation.is_current },
              ...(cur && !rotation.is_current ? [{ key: cur.id, label: rotationLabel(cur), value: erosion.get(cur), current: true }] : []),
            ]}
          />
          <div className="min-w-0 text-[0.9375rem] leading-relaxed text-ink">
            <p>{indicatorSentence}</p>
            <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
              This is the engine’s own indicator: the share of heavy-rain days{isNum(heavyMm) ? ` (${heavyMm} mm or more)` : ''} that fell on days when the rotation had no crop
              in the ground. It is an exposure indicator from the simulation calendar and the gridded weather record. It does not measure or estimate what happened to the soil.
            </p>
          </div>
        </div>
      </Panel>

      {ranked.length > 1 && (
        <Panel title="Bare months of every rotation in this analysis">
          <p className="-mt-2 mb-4 max-w-3xl text-[0.875rem] leading-relaxed text-muted">
            The same twelve months and the same three levels for all {ranked.length} rotations, in ranked order. Darker months are barer in the engine’s calendar. Choose one to
            open it in the charts above.
          </p>
          <RotationStrips rotations={ranked} selected={rotation.id} onSelect={(id) => select(id, true)} />
        </Panel>
      )}
    </div>
  )
}
