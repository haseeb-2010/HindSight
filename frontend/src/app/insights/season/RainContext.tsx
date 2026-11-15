import type { CSSProperties } from 'react'
import { cx } from '../../../lib/cx'
import { fmtNum, fmtPct, isNum } from '../../../lib/format'
import type { ClimateContext, MonthlyClimate, Rotation } from '../../../lib/types'
import { BARE_RULES, bareLevel, monthName, monthlyShare } from '../../lib/insights'
import { fractionWords, HATCH, monthRuns, mostlyBareMonths, runsText, sharePct, type Row } from './calendar'
import { Swatch } from './CropTimeline'
import { ActiveColumn, FigureHead, FOCUS_RING, MonthAxis, Readout, TrackRow, useMonthReader } from './track'

function MonthBars({
  monthly,
  pick,
  digits,
  color,
  bare,
  active,
  height,
}: {
  monthly: MonthlyClimate[]
  pick: (m: MonthlyClimate) => number
  digits: number
  color: string
  bare: Set<number>
  active: number | null
  height: string
}) {
  const max = Math.max(...monthly.map(pick), 0)
  return (
    <div className={cx('relative grid grid-cols-12 border-b border-sand-400', height)} aria-hidden="true">
      {monthly.map((m, i) => {
        const v = pick(m)
        const frac = max > 0 ? v / max : 0
        return (
          <span key={m.month} className="relative flex h-full flex-col items-center justify-end px-px">
            {bare.has(m.month) && <span className="absolute inset-x-px inset-y-0 rounded-t-md bg-cream-50 opacity-80" style={{ backgroundImage: HATCH }} />}
            <span className="relative mb-0.5 text-[0.625rem] leading-none font-extrabold text-forest-950 tabular-nums sm:text-[0.75rem]">{fmtNum(v, digits)}</span>
            <span
              className="bar-grow relative w-[62%] max-w-11 rounded-t-[4px]"
              style={{ height: `calc((100% - 1.125rem) * ${frac.toFixed(4)})`, minHeight: v > 0 ? 2 : 0, background: color, '--delay': `${i * 25}ms` } as CSSProperties}
            />
          </span>
        )
      })}
      <ActiveColumn month={active} />
    </div>
  )
}

/**
 * The record's average rainfall and heavy-rain days for each calendar month, on the same twelve months as the
 * calendar above, with the mostly bare months of the chosen rotation year marked behind the bars.
 * Two separate charts share the month scale; no soil loss, erosion rate or runoff is computed.
 */
export function RainContext({
  rotation,
  row,
  year,
  hasCalendar,
  climate,
  active,
  setActive,
}: {
  rotation: Rotation
  row: Row
  year: number
  /** False when the engine returned no calendar for the rotation: then no month is marked and nothing is said about bare months. */
  hasCalendar: boolean
  climate: ClimateContext
  active: number | null
  setActive: (m: number | null) => void
}) {
  const { track, bind, focused } = useMonthReader(active, setActive)
  const monthly = [...climate.monthly].sort((a, b) => a.month - b.month)
  const heavyMm = climate.thresholds?.heavy_rain_mm
  const heavyWord = isNum(heavyMm) ? `${heavyMm} mm or more` : 'heavy rain'
  const record = climate.record ? `${climate.record.start_year}–${climate.record.end_year}` : 'the record'
  const multi = rotation.cycle_years > 1
  const bareMonths = mostlyBareMonths(row)
  const bare = new Set(bareMonths)
  const bareText = bareMonths.length ? runsText(monthRuns(bareMonths, !multi)) : null
  const yearNote = multi ? ` (year ${year + 1})` : ''

  const top = (pick: (m: MonthlyClimate) => number) => monthly.reduce((a, b) => (pick(b) > pick(a) ? b : a), monthly[0])
  const wettest = top((m) => m.rain_mm)
  const heaviest = top((m) => m.heavy_rain_days)
  const rainShare = monthlyShare(monthly, 'rain_mm', bareMonths)
  const heavyShare = monthlyShare(monthly, 'heavy_rain_days', bareMonths)

  const weather =
    wettest.rain_mm > 0
      ? `In this record, ${monthName(wettest.month)} is the wettest month on average (${fmtNum(wettest.rain_mm)} mm)` +
        (heaviest.heavy_rain_days > 0
          ? heaviest.month === wettest.month
            ? ` and has the most heavy-rain days (${fmtNum(heaviest.heavy_rain_days, 1)} in an average year).`
            : `; heavy-rain days are most frequent in ${monthName(heaviest.month)} (${fmtNum(heaviest.heavy_rain_days, 1)} in an average year).`
          : '; no day in the record reached the heavy-rain threshold.')
      : 'The record shows no rainfall in any month.'
  const overlap = !hasCalendar
    ? ' The engine did not return a calendar for this rotation, so no bare months can be marked.'
    : !bareText
      ? ` No month is mostly bare in this rotation${yearNote}, so no bare months are marked.`
      : rainShare !== null && heavyShare !== null
        ? ` The mostly bare months of this rotation${yearNote}, ${bareText}, hold ${sharePct(rainShare)} of the record’s yearly rainfall and ${sharePct(heavyShare)} of its heavy-rain days.`
        : rainShare !== null
          ? ` The mostly bare months of this rotation${yearNote}, ${bareText}, hold ${sharePct(rainShare)} of the record’s yearly rainfall.`
          : ''

  const m = active !== null ? monthly[active] : null
  const activeCell = active !== null ? row[active] : null

  return (
    <figure className="m-0 min-w-0">
      <FigureHead>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] font-bold text-ink" aria-label="Legend">
          <li className="inline-flex items-center gap-2">
            <Swatch color="var(--color-peri-chart)" /> Rainfall, record average {record}
          </li>
          <li className="inline-flex items-center gap-2">
            <Swatch color="var(--color-forest-800)" /> Heavy-rain days, record average
          </li>
          {hasCalendar && bare.size > 0 && (
            <li className="inline-flex items-center gap-2">
              <Swatch bare /> Mostly bare month in this rotation{yearNote}: modelled bare-soil fraction of {fractionWords(BARE_RULES.higherFrom)} or more
            </li>
          )}
        </ul>
        <Readout month={active} live={focused}>
          {m ? (
            <>
              {fmtNum(m.rain_mm, 1)} mm rain · {fmtNum(m.heavy_rain_days, 2)} heavy-rain days
              {activeCell ? ` · ${fmtPct(activeCell.bare_frac)} of days bare (${bareLevel(activeCell.bare_frac)} level)` : ''}
            </>
          ) : (
            'not available'
          )}
        </Readout>
      </FigureHead>

      <div
        {...bind}
        aria-label={`Average rainfall and heavy-rain days for each calendar month in ${record}${hasCalendar ? ', with the mostly bare months of the chosen rotation marked' : ''}. ${weather}${overlap} Use the left and right arrow keys to read each month; a table of all values follows.`}
        className={cx('space-y-4', FOCUS_RING)}
      >
        <TrackRow label="Rainfall" sub="mm in the month, record average">
          <div ref={track}>
            <MonthBars monthly={monthly} pick={(x) => x.rain_mm} digits={0} color="var(--color-peri-chart)" bare={bare} active={active} height="h-36 sm:h-40" />
          </div>
        </TrackRow>
        <TrackRow label="Heavy-rain days" sub={`days with ${heavyWord} in the month, record average`}>
          <MonthBars monthly={monthly} pick={(x) => x.heavy_rain_days} digits={1} color="var(--color-forest-800)" bare={bare} active={active} height="h-28 sm:h-32" />
        </TrackRow>
        <TrackRow>
          <MonthAxis active={active} marked={bare} />
        </TrackRow>
      </div>

      <figcaption className="mt-5 rounded-2xl bg-sand/60 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">
        {weather}
        {overlap}
        {bareText && (rainShare !== null || heavyShare !== null) && ' This describes the seasonality of the weather record, not what happened to the soil.'}
      </figcaption>

      <div className="sr-only">
        <table>
          <caption>
            Record-average rainfall and heavy-rain days by calendar month, {record}, with the modelled bare-soil fraction of the chosen rotation{yearNote}
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Rainfall (mm)</th>
              <th scope="col">Days with {heavyWord}</th>
              <th scope="col">Bare days in the rotation calendar</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((x, i) => (
              <tr key={x.month}>
                <th scope="row">{monthName(x.month)}</th>
                <td>{fmtNum(x.rain_mm, 1)}</td>
                <td>{fmtNum(x.heavy_rain_days, 2)}</td>
                <td>{row[i] ? fmtPct(row[i]?.bare_frac) : 'not available'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
