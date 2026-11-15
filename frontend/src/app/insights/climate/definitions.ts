// Plain-language definitions of the six climate indicators (backend/engine/trends.py, docs/METHODOLOGY.md).
// Thresholds and the months of each half-year are read from the analysis when it stores them.
import type { ClimateContext } from '../../../lib/types'
import { monthSpanText } from '../../lib/insights'
import { monthRuns } from '../season/calendar'

export interface IndicatorInfo {
  /** One short line under the card title. */
  hint: string
  /** One or two sentences shown with the chart. */
  definition: string
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** "April to September" for a set of months, read as one run around the year. Null when the months are not one run. */
function halfYearText(months: number[] | undefined): string | null {
  if (!months?.length) return null
  const runs = monthRuns(months, true)
  return runs.length === 1 ? monthSpanText(runs[0]) : null
}

export function indicatorInfo(id: string, ctx: ClimateContext | null): IndicatorInfo | null {
  const warmMonths = ctx?.warm_half_year_months
  const warm = halfYearText(warmMonths)
  const cool = warmMonths?.length ? halfYearText(ALL_MONTHS.filter((m) => !warmMonths.includes(m))) : null
  const t = ctx?.thresholds
  switch (id) {
    case 'cool_season_rain_mm':
      return {
        hint: cool ? `Rainfall, ${cool}` : 'Rainfall in the cooler six months',
        definition: `The rain that fell in the cool half of each year${cool ? ` (${cool})` : ''}, added up.`,
      }
    case 'warm_season_rain_mm':
      return {
        hint: warm ? `Rainfall, ${warm}` : 'Rainfall in the warmer six months',
        definition: `The rain that fell in the warm half of each year${warm ? ` (${warm})` : ''}, added up.`,
      }
    case 'annual_et0_mm':
      return {
        hint: 'The air’s demand for water over a year',
        definition:
          'Reference evapotranspiration (ET₀) is the water a well-watered grass surface would use in a year, worked out from the weather with the FAO Penman–Monteith method. It describes the air’s demand for water, not what a crop used.',
      }
    case 'hot_days':
      return {
        hint: 'Counted from the daily maximum temperature',
        definition: `The number of days in each year when the daily maximum temperature was above ${t ? `${t.hot_day_c} °C` : 'the threshold in the title'}.`,
      }
    case 'frost_days':
      return {
        hint: 'Counted from the daily minimum temperature',
        definition: `The number of days in each year when the daily minimum temperature was below ${t ? `${t.frost_day_c} °C` : 'the threshold in the title'}.`,
      }
    case 'heavy_rain_days':
      return {
        hint: 'The engine’s threshold for heavy rain',
        definition: `The number of days in each year with ${t ? `${t.heavy_rain_mm} mm of rain or more` : 'at least the amount of rain in the title'}, the engine’s threshold for a heavy-rain day.`,
      }
    default:
      return null
  }
}
