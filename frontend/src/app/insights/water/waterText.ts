// Sentences and small selections for the water resilience explorer.
//
// Everything here reads values the engine already returned and words them. Comparisons between
// rotations use the rules in ../../lib/insights (tradeoffs and METRICS.similar); nothing is re-thresholded.
import { rotationLabel } from '../../../lib/analysis'
import { fmtMm, fmtNum, isNum } from '../../../lib/format'
import type { MonthlyClimate, Rotation } from '../../../lib/types'
import { METRIC_BY_ID, joinList, monthName, monthSpanText, tradeoffs, type Tradeoff } from '../../lib/insights'

export type WaterMeasure = 'water' | 'irrigation'

const NOUN: Record<WaterMeasure, string> = {
  water: 'modelled crop water demand',
  irrigation: 'irrigation requirement',
}

/** How `rot` differs from `cur` on one of the two water measures (rule: insights.tradeoffs). */
export function waterTradeoff(rot: Rotation, cur: Rotation, id: WaterMeasure): Tradeoff | undefined {
  return tradeoffs(rot, cur).find((t) => t.metric.id === id)
}

/** "438 mm lower than current", "about the same as current". Empty when a value is missing. */
export function deltaNote(t: Tradeoff | undefined): string {
  if (!t || t.verdict === 'unknown' || !isNum(t.delta)) return ''
  if (t.verdict === 'similar') return 'About the same as current'
  return `${fmtNum(Math.abs(t.delta))} mm ${t.delta < 0 ? 'lower' : 'higher'} than current`
}

/**
 * One sentence on how the alternatives compare with the current rotation on a water measure.
 * Null when the current value is missing or there is no alternative.
 */
export function measureSentence(id: WaterMeasure, cur: Rotation, alts: Rotation[]): string | null {
  const m = METRIC_BY_ID[id]
  const base = m.get(cur)
  const read = alts.map((r) => ({ r, t: waterTradeoff(r, cur, id) })).filter((x): x is { r: Rotation; t: Tradeoff } => !!x.t && x.t.verdict !== 'unknown')
  if (!isNum(base) || read.length === 0) return null
  const n = read.length
  const groups = [
    { list: read.filter((x) => x.t.verdict === 'favourable'), first: `a lower ${NOUN[id]}`, later: 'a lower one' },
    { list: read.filter((x) => x.t.verdict === 'unfavourable'), first: `a higher ${NOUN[id]}`, later: 'a higher one' },
    { list: read.filter((x) => x.t.verdict === 'similar'), first: `about the same ${NOUN[id]}`, later: 'about the same' },
  ].filter((g) => g.list.length > 0)
  const phrases = groups.map((g, i) => {
    const k = g.list.length
    const verb = k === 1 ? 'has' : 'have'
    if (i > 0) return `${k} ${verb} ${g.later}`
    const who = k === n ? (n === 1 ? 'the one alternative has' : `all ${n} alternatives have`) : `${k} of the ${n} alternatives ${verb}`
    return `${who} ${g.first}`
  })
  let out = `Compared with your current rotation (${fmtMm(base)} a year), ${joinList(phrases)}.`
  const lower = groups.find((g) => g.first.startsWith('a lower'))
  if (lower) {
    const best = [...lower.list].sort((a, b) => (a.t.value ?? 0) - (b.t.value ?? 0))[0]
    out += ` The lowest is ${rotationLabel(best.r)} at ${fmtMm(best.t.value)} a year.`
  } else if (groups.length === 1 && groups[0].first.startsWith('a higher')) {
    out += ' Your current rotation has the lowest of the rotations shown.'
  }
  if (groups.some((g) => g.later === 'about the same')) out += ` Differences under ${fmtNum(m.similar)} mm are reported as about the same.`
  return out
}

/**
 * A neutral statement of the two water values for an alternative against the current rotation.
 * Null when the engine did not return the crop water demand for both.
 */
export function waterValuesSentence(rot: Rotation, cur: Rotation, irrigated: boolean): string | null {
  const w = waterTradeoff(rot, cur, 'water')
  if (!w || w.verdict === 'unknown' || !isNum(w.delta)) return null
  const versus = (t: Tradeoff) => `${fmtMm(t.value)} a year against ${fmtMm(t.base)}`
  const head =
    w.verdict === 'similar'
      ? `${rotationLabel(rot)} has about the same ${NOUN.water} as your current rotation (${versus(w)}).`
      : `${rotationLabel(rot)} has a ${w.delta < 0 ? 'lower' : 'higher'} ${NOUN.water} than your current rotation (${versus(w)}).`
  const i = waterTradeoff(rot, cur, 'irrigation')
  if (!irrigated || !i || i.verdict === 'unknown' || !isNum(i.delta)) return head
  const tail =
    i.verdict === 'similar'
      ? ` Its ${NOUN.irrigation} is about the same (${versus(i)}).`
      : ` Its ${NOUN.irrigation} is ${i.delta < 0 ? 'lower' : 'higher'} (${versus(i)}).`
  return head + tail
}

/* ------------------------------------------------------------------ monthly rain against ET0 */

export interface MonthBalance {
  month: number
  /** Record-average rainfall and reference evapotranspiration, as returned (one decimal). */
  rain: number
  et0: number
  /** Whole millimetres, as printed. */
  rainShown: number
  et0Shown: number
  /** True when the printed ET0 is above the printed rainfall, so the label always agrees with the numbers on screen. */
  exceeds: boolean
}

/** Twelve months in calendar order, or null when the analysis carries no complete monthly record. */
export function monthBalance(monthly: MonthlyClimate[] | undefined | null): MonthBalance[] | null {
  if (!monthly || monthly.length !== 12) return null
  const rows = [...monthly].sort((a, b) => a.month - b.month)
  if (rows.some((m, i) => m.month !== i + 1 || !isNum(m.rain_mm) || !isNum(m.et0_mm))) return null
  return rows.map((m) => {
    const rainShown = Math.round(m.rain_mm)
    const et0Shown = Math.round(m.et0_mm)
    return { month: m.month, rain: m.rain_mm, et0: m.et0_mm, rainShown, et0Shown, exceeds: et0Shown > rainShown }
  })
}

/** Runs of consecutive calendar months, joining December to January: [[9,10,11,12,1,2]]. */
export function monthRuns(months: number[]): number[][] {
  const on = Array.from({ length: 12 }, (_, i) => months.includes(i + 1))
  if (!on.some(Boolean)) return []
  if (on.every(Boolean)) return [on.map((_, i) => i + 1)]
  const start = on.findIndex((v, i) => v && !on[(i + 11) % 12])
  const out: number[][] = []
  let run: number[] = []
  for (let k = 0; k < 12; k++) {
    const i = (start + k) % 12
    if (on[i]) run.push(i + 1)
    else if (run.length) {
      out.push(run)
      run = []
    }
  }
  if (run.length) out.push(run)
  return out
}

const spans = (months: number[]) => joinList(monthRuns(months).map(monthSpanText))

/** What the monthly chart shows, in one or two sentences built from its own values. */
export function monthlySentence(rows: MonthBalance[]): string {
  const above = rows.filter((r) => r.exceeds)
  const rest = rows.filter((r) => !r.exceeds)
  if (above.length === 0) return 'On average, reference evapotranspiration was not above rainfall in any month of this record.'
  const widest = [...above].sort((a, b) => b.et0Shown - b.rainShown - (a.et0Shown - a.rainShown))[0]
  const gap = ` The gap was widest in ${monthName(widest.month)} (${fmtNum(widest.et0Shown)} mm against ${fmtNum(widest.rainShown)} mm of rain).`
  if (rest.length === 0) return `On average, reference evapotranspiration was above rainfall in every month of this record.${gap}`
  return (
    `On average, reference evapotranspiration was above rainfall in ${above.length} of 12 months (${spans(above.map((r) => r.month))}). ` +
    `Rainfall matched or exceeded it in ${spans(rest.map((r) => r.month))}.${gap}`
  )
}

/** The annual totals in one sentence. Null when either is missing. */
export function annualSentence(rain: number | undefined, et0: number | undefined): string | null {
  if (!isNum(rain) || !isNum(et0)) return null
  const values = `Rainfall averaged ${fmtMm(rain)} a year and reference evapotranspiration ${fmtMm(et0)}`
  if (et0 > rain) return `${values}, so over a year the atmosphere’s demand for water was ${fmtMm(et0 - rain)} higher than the rain that fell.`
  if (rain > et0) return `${values}, so over a year rainfall was ${fmtMm(rain - et0)} higher than the atmosphere’s demand for water.`
  return `${values}: the two were equal over a year.`
}
