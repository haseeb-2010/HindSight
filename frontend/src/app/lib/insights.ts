// Interpretation rules for Field Intelligence, the Scenario Lab and the Decision Brief.
//
// Everything here selects, compares and labels values the engine already returned. Nothing is
// re-simulated and no engine value is changed. Each labelling rule is written down next to its
// thresholds (CLIMATE_RULES, BARE_RULES, SIMILAR) and shown to the user on the Science page.
import { currentRotation, rankedRotations, rotationLabel } from '../../lib/analysis'
import { fmtNum, fmtP, isNum } from '../../lib/format'
import type { AnalysisEnvelope, AnalysisResult, CalendarCell, ClimateShift, MonthlyClimate, Rotation } from '../../lib/types'

/* ------------------------------------------------------------------ climate patterns */

export type ShiftDirection = 'higher' | 'lower' | 'little'
export type ShiftEvidence = 'consistent' | 'limited'

/**
 * How a period-to-period difference is worded.
 * - Direction compares the two period means the engine reports. A difference smaller than 5% of the
 *   earlier value, or smaller than 5 mm / 1 day, is called "little change".
 * - Evidence uses the engine's trend-test p-value (Kendall's tau over all 40 years). Below 0.05 the
 *   year-to-year change is called consistent; otherwise "statistical evidence is limited".
 *   A p-value is never described as the probability that a trend is real.
 */
export const CLIMATE_RULES = {
  littleChangeFraction: 0.05,
  minChange: { mm: 5, days: 1 } as Record<string, number>,
  alpha: 0.05,
}

export interface ShiftReading {
  direction: ShiftDirection
  evidence: ShiftEvidence
  /** "Higher in later period" | "Lower in later period" | "Little change" */
  label: string
  /** "Consistent trend in this record" | "Statistical evidence is limited" */
  evidenceLabel: string
  /** Change as a fraction of the earlier value, or null when that value is zero or missing. */
  relChange: number | null
}

export function readShift(s: ClimateShift): ShiftReading {
  const change = isNum(s.change) ? s.change : isNum(s.early) && isNum(s.late) ? s.late - s.early : null
  const floor = Math.max(CLIMATE_RULES.minChange[s.unit] ?? 0, isNum(s.early) ? Math.abs(s.early) * CLIMATE_RULES.littleChangeFraction : 0)
  const direction: ShiftDirection = change === null || Math.abs(change) < floor ? 'little' : change > 0 ? 'higher' : 'lower'
  const evidence: ShiftEvidence = isNum(s.p_value) && s.p_value < CLIMATE_RULES.alpha ? 'consistent' : 'limited'
  return {
    direction,
    evidence,
    label: direction === 'little' ? 'Little change' : direction === 'higher' ? 'Higher in later period' : 'Lower in later period',
    evidenceLabel: evidence === 'consistent' ? 'Consistent trend in this record' : 'Statistical evidence is limited',
    relChange: change !== null && isNum(s.early) && s.early !== 0 ? change / Math.abs(s.early) : null,
  }
}

const digitsFor = (unit: string) => (unit === 'mm' ? 0 : 1)

/** What each indicator is called inside a sentence. */
const SHIFT_SUBJECT: Record<string, { subject: string; perYear: string; meaning?: Partial<Record<ShiftDirection, string>> }> = {
  cool_season_rain_mm: { subject: 'Rainfall in the cool half-year', perYear: 'mm a year' },
  warm_season_rain_mm: { subject: 'Rainfall in the warm half-year', perYear: 'mm a year' },
  annual_et0_mm: {
    subject: 'Reference evapotranspiration',
    perYear: 'mm a year',
    meaning: {
      higher: 'That indicates a greater atmospheric demand for water.',
      lower: 'That indicates a lower atmospheric demand for water.',
    },
  },
  hot_days: { subject: 'Days above 35 °C', perYear: 'days a year' },
  frost_days: { subject: 'Days below 0 °C', perYear: 'days a year' },
  heavy_rain_days: { subject: 'Days with 12.7 mm of rain or more', perYear: 'days a year' },
}

/**
 * One plain sentence about an indicator, built only from the values in `s`.
 * `early` and `late` are the period labels, e.g. "1985–2004".
 */
export function shiftSentence(s: ClimateShift, early: string, late: string): string {
  const meta = SHIFT_SUBJECT[s.id] ?? { subject: s.label, perYear: `${s.unit} a year` }
  const r = readShift(s)
  if (!isNum(s.early) || !isNum(s.late)) return `${meta.subject}: the engine did not return values for both periods.`
  const d = digitsFor(s.unit)
  const values = `${fmtNum(s.early, d)} ${meta.perYear} in ${early} and ${fmtNum(s.late, d)} in ${late}`
  const frequency = s.unit === 'days'
  const head =
    r.direction === 'little'
      ? `${meta.subject} changed little between the two periods (${values}).`
      : `${meta.subject} ${frequency ? 'were' : 'was'} ${
          r.direction === 'higher' ? (frequency ? 'more frequent' : 'higher') : frequency ? 'less frequent' : 'lower'
        } in the later period (${values}).`
  const meaning = r.direction !== 'little' ? meta.meaning?.[r.direction] : undefined
  const tail =
    r.direction === 'little'
      ? ''
      : r.evidence === 'consistent'
        ? ` The year-to-year trend test supports a consistent change (${fmtP(s.p_value)}).`
        : ` Statistical evidence for a steady trend is limited (${fmtP(s.p_value)}), so the difference may reflect year-to-year variation.`
  return `${head}${meaning ? ` ${meaning}` : ''}${tail}`
}

/** Mean of a yearly series inside a window of years (used to draw the period means on a chart). */
export function windowMean(years: number[], values: number[], window: [number, number] | number[] | undefined): number | null {
  if (!window) return null
  const v = values.filter((_, i) => years[i] >= window[0] && years[i] <= window[1])
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/* ------------------------------------------------------------------ seasonal exposure */

export type BareLevel = 'lower' | 'moderate' | 'higher'

/**
 * Levels for the engine's modelled bare-soil fraction of a month (share of that month's days
 * with no crop in the ground): under one third is lower, one to two thirds is moderate,
 * two thirds or more is higher exposure.
 */
export const BARE_RULES = { moderateFrom: 1 / 3, higherFrom: 2 / 3 }

export const BARE_LABELS: Record<BareLevel, string> = {
  lower: 'Lower bare-soil exposure',
  moderate: 'Moderate bare-soil exposure',
  higher: 'Higher bare-soil exposure',
}

export function bareLevel(frac: number): BareLevel {
  if (frac >= BARE_RULES.higherFrom) return 'higher'
  if (frac >= BARE_RULES.moderateFrom) return 'moderate'
  return 'lower'
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function monthName(month: number, short = false): string {
  const name = MONTHS[(((month - 1) % 12) + 12) % 12]
  return short ? name.slice(0, 3) : name
}

/** The engine calendar as one row of twelve months per rotation year. Missing cells are null. */
export function calendarByYear(r: Rotation): (CalendarCell | null)[][] {
  const rows: (CalendarCell | null)[][] = Array.from({ length: Math.max(1, r.cycle_years) }, () => Array<CalendarCell | null>(12).fill(null))
  for (const c of r.calendar ?? []) {
    if (c.year_offset >= 0 && c.year_offset < rows.length && c.month >= 1 && c.month <= 12) rows[c.year_offset][c.month - 1] = c
  }
  return rows
}

export interface BarePeriod {
  /** Rotation year (0-based) in which the period starts. */
  year_offset: number
  /** Calendar months in order, e.g. [11, 12, 1] for a period that runs over the new year. */
  months: number[]
  /** Mean modelled bare fraction over those months. */
  meanBare: number
}

/**
 * Runs of consecutive months at or above `level` in the rotation calendar. The calendar repeats,
 * so a run that reaches the end of the cycle continues into its first month.
 */
export function barePeriods(r: Rotation, level: BareLevel = 'higher'): BarePeriod[] {
  const cells = calendarByYear(r).flat()
  const n = cells.length
  const min = level === 'higher' ? BARE_RULES.higherFrom : level === 'moderate' ? BARE_RULES.moderateFrom : 0
  const on = cells.map((c) => !!c && c.bare_frac >= min && (level !== 'lower' || c.bare_frac > 0))
  if (!on.some(Boolean)) return []
  if (on.every(Boolean)) return [{ year_offset: 0, months: cells.map((_, i) => (i % 12) + 1), meanBare: mean(cells.map((c) => c?.bare_frac ?? 0)) }]
  const start = on.findIndex((v, i) => v && !on[(i - 1 + n) % n])
  const out: BarePeriod[] = []
  let i = 0
  while (i < n) {
    const at = (start + i) % n
    if (!on[at]) {
      i++
      continue
    }
    const idx: number[] = []
    while (i < n && on[(start + i) % n]) {
      idx.push((start + i) % n)
      i++
    }
    out.push({ year_offset: Math.floor(idx[0] / 12), months: idx.map((k) => (k % 12) + 1), meanBare: mean(idx.map((k) => cells[k]?.bare_frac ?? 0)) })
  }
  return out.sort((a, b) => a.year_offset - b.year_offset || a.months[0] - b.months[0])
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0)

/** "June", "June and July", "June to October" */
export function monthSpanText(months: number[]): string {
  if (months.length === 0) return ''
  if (months.length === 1) return monthName(months[0])
  if (months.length === 2) return `${monthName(months[0])} and ${monthName(months[1])}`
  return `${monthName(months[0])} to ${monthName(months[months.length - 1])}`
}

/**
 * Share of a record-average monthly total (rain, heavy-rain days…) that falls in the given months.
 * A description of the weather record's seasonality, not a soil-loss or runoff estimate.
 */
export function monthlyShare(monthly: MonthlyClimate[] | undefined, key: 'rain_mm' | 'heavy_rain_days' | 'et0_mm', months: number[]): number | null {
  if (!monthly?.length) return null
  const total = monthly.reduce((a, m) => a + m[key], 0)
  if (total <= 0) return null
  const set = new Set(months)
  return monthly.filter((m) => set.has(m.month)).reduce((a, m) => a + m[key], 0) / total
}

/**
 * The farmer-facing sentence about bare periods, from the engine calendar only. Returns a sentence
 * saying there is no long bare period when that is what the calendar shows.
 */
export function exposureSentence(r: Rotation): string {
  const periods = barePeriods(r, 'higher')
  const who = r.is_current ? 'Your current rotation' : 'This rotation'
  if (periods.length === 0) {
    const some = barePeriods(r, 'moderate')
    return some.length === 0
      ? `${who} keeps a crop in the ground for most of every month, so the calendar shows no mostly bare period.`
      : `${who} has no month that is mostly bare. Soil is partly uncovered in ${joinList(some.map((p) => monthSpanText(p.months)))}.`
  }
  const spans = periods.map((p) => (r.cycle_years > 1 ? `${monthSpanText(p.months)} (year ${p.year_offset + 1})` : monthSpanText(p.months)))
  return `${who} leaves the soil mostly bare in ${joinList(spans)}. This may be worth reviewing alongside the timing of heavy rainfall.`
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/* ------------------------------------------------------------------ rotation resilience */

/** Identity of a rotation across runs. Engine ids such as "swap_4" are positional, so the crops and sowing days are used. */
export function rotationKey(r: Rotation): string {
  const slots = [...r.slots].sort((a, b) => a.year_offset - b.year_offset || a.plant_doy - b.plant_doy)
  return `${r.cycle_years}|${slots.map((s) => `${s.year_offset}:${s.plant_doy}:${s.crop_id}`).join(',')}`
}

export interface WorstYearRow {
  rotation: Rotation
  /** The rotation's simulated index in each of the current rotation's worst years. */
  values: (number | null)[]
  /** Mean over those years, as reported by the engine (hindcast.worst_years.mean_index). */
  mean: number | null
  /** `mean` minus the current rotation's mean. */
  deltaVsCurrent: number | null
}

/** Every rotation in the current rotation's five lowest-index years. Null when the engine did not report them. */
export function worstYearTable(res: AnalysisResult): { years: number[]; rows: WorstYearRow[] } | null {
  const cur = currentRotation(res)
  const years = cur?.hindcast.worst_years?.years
  if (!cur || !years?.length) return null
  const curMean = cur.hindcast.worst_years?.mean_index ?? null
  const rows = rankedRotations(res).map((rotation) => {
    const byYear = new Map(rotation.hindcast.years.map((y, i) => [y, rotation.hindcast.annual_index[i]]))
    const m = rotation.hindcast.worst_years?.mean_index ?? null
    return {
      rotation,
      values: years.map((y) => (isNum(byYear.get(y)) ? (byYear.get(y) as number) : null)),
      mean: m,
      deltaVsCurrent: isNum(m) && isNum(curMean) ? m - curMean : null,
    }
  })
  return { years, rows }
}

export type Favoured = 'higher' | 'lower'

export interface MetricDef {
  id: string
  label: string
  short: string
  unit: 'index' | 'percent' | 'mm' | 'rating'
  get: (r: Rotation) => number | null | undefined
  /** The direction the engine's ranking rewards for this indicator. It is not a universal verdict. */
  favoured: Favoured
  /** Differences smaller than this are reported as "about the same". */
  similar: number
  /** What a difference does and does not mean. */
  context: string
}

/** The indicators shown in rotation profiles, in display order. Values are read from the engine response unchanged. */
export const METRICS: MetricDef[] = [
  {
    id: 'median', label: 'Median seasonal index', short: 'Median index', unit: 'index', favoured: 'higher', similar: 0.02,
    get: (r) => r.hindcast.median,
    context: 'How well water and temperature needs were met in a typical simulated year. It is not crop yield.',
  },
  {
    id: 'p10', label: 'Lower-decile (P10) seasonal index', short: 'P10 index', unit: 'index', favoured: 'higher', similar: 0.02,
    get: (r) => r.hindcast.p10,
    context: 'The index in weaker historical years: about 1 simulated year in 10 was worse. This is the stability measure the ranking uses.',
  },
  {
    id: 'failure', label: 'Failure frequency', short: 'Failure frequency', unit: 'percent', favoured: 'lower', similar: 0.02,
    get: (r) => r.hindcast.failure_freq,
    context: 'Share of simulated crop seasons below the failure line. Reported for information; the ranking weights the P10 index instead.',
  },
  {
    id: 'water', label: 'Crop water demand', short: 'Water demand', unit: 'mm', favoured: 'lower', similar: 15,
    get: (r) => r.hindcast.water_demand_mm_per_year,
    context: 'Modelled crop evapotranspiration requirement per year. Lower demand is rewarded by the water priority, but a rotation that grows more usually needs more water.',
  },
  {
    id: 'irrigation', label: 'Irrigation requirement', short: 'Irrigation', unit: 'mm', favoured: 'lower', similar: 15,
    get: (r) => r.hindcast.irrigation_mm_per_year,
    context: 'Water the simulation applied under the chosen irrigation mode. Zero for rainfed analyses. Not measured farm water use.',
  },
  {
    id: 'cover', label: 'Soil cover', short: 'Soil cover', unit: 'percent', favoured: 'higher', similar: 0.03,
    get: (r) => r.indicators.cover_frac,
    context: 'Share of days in the cycle with a crop in the ground. A soil-care proxy: more cover also means different sowing and harvest work.',
  },
  {
    id: 'legume', label: 'Legume share', short: 'Legume share', unit: 'percent', favoured: 'higher', similar: 0.03,
    get: (r) => r.indicators.legume_share,
    context: 'Share of crops that are legumes: an indicator of potential nitrogen contribution, not a measured nitrogen balance.',
  },
  {
    id: 'forage', label: 'Forage share', short: 'Forage share', unit: 'percent', favoured: 'higher', similar: 0.03,
    get: (r) => r.indicators.forage_share,
    context: 'Share of crops that are forage or dual-purpose. Useful only if the farm needs forage.',
  },
  {
    id: 'erosion', label: 'Heavy rainfall exposure during relatively bare periods', short: 'Heavy rain on bare soil', unit: 'percent', favoured: 'lower', similar: 0.03,
    get: (r) => r.indicators.erosive_rain_on_bare_frac,
    context: 'Share of heavy-rain days (12.7 mm or more) that fell while the soil was bare. An exposure indicator, not a soil-loss estimate.',
  },
]

export const METRIC_BY_ID: Record<string, MetricDef> = Object.fromEntries(METRICS.map((m) => [m.id, m]))

export function fmtMetric(m: MetricDef, v: number | null | undefined): string {
  if (!isNum(v)) return '—'
  if (m.unit === 'percent') return `${(v * 100).toFixed(0)}%`
  if (m.unit === 'mm') return `${fmtNum(v)} mm`
  return v.toFixed(2)
}

/** A signed difference in the metric's own unit: "+0.12", "−40 mm", "+8 points". */
export function fmtMetricDelta(m: MetricDef, delta: number | null | undefined): string {
  if (!isNum(delta)) return '—'
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  const a = Math.abs(delta)
  if (m.unit === 'percent') return `${sign}${(a * 100).toFixed(0)} points`
  if (m.unit === 'mm') return `${sign}${fmtNum(a)} mm`
  return `${sign}${a.toFixed(2)}`
}

export type Verdict = 'favourable' | 'unfavourable' | 'similar' | 'unknown'

export interface Tradeoff {
  metric: MetricDef
  value: number | null
  base: number | null
  delta: number | null
  /** Favourable means the difference is in the direction the ranking rewards. It is not "better" in every sense. */
  verdict: Verdict
}

/** How `rot` differs from `base` (normally the current rotation) on every indicator. */
export function tradeoffs(rot: Rotation, base: Rotation): Tradeoff[] {
  return METRICS.map((metric) => {
    const value = metric.get(rot)
    const b = metric.get(base)
    if (!isNum(value) || !isNum(b)) return { metric, value: isNum(value) ? value : null, base: isNum(b) ? b : null, delta: null, verdict: 'unknown' as Verdict }
    const delta = value - b
    const verdict: Verdict = Math.abs(delta) < metric.similar ? 'similar' : delta > 0 === (metric.favoured === 'higher') ? 'favourable' : 'unfavourable'
    return { metric, value, base: b, delta, verdict }
  })
}

/**
 * A sentence about stability, only when the P10 index and the failure frequency point the same way.
 * Returns null when the values do not support a clear statement.
 */
export function stabilitySentence(rot: Rotation, cur: Rotation): string | null {
  if (rot === cur || rot.is_current) return null
  const t = Object.fromEntries(tradeoffs(rot, cur).map((x) => [x.metric.id, x]))
  const p10 = t.p10
  const fail = t.failure
  if (!p10 || !fail || p10.verdict === 'unknown' || fail.verdict === 'unknown') return null
  const name = rotationLabel(rot)
  const p = `${fmtMetric(p10.metric, p10.value)} against ${fmtMetric(p10.metric, p10.base)}`
  const f = `${fmtMetric(fail.metric, fail.value)} against ${fmtMetric(fail.metric, fail.base)}`
  if (p10.verdict === 'favourable' && fail.verdict !== 'unfavourable') {
    return fail.verdict === 'favourable'
      ? `${name} showed a higher lower-decile seasonal index (${p}) and fewer simulated failures (${f}) than the current rotation in this simulation.`
      : `${name} showed a higher lower-decile seasonal index (${p}) than the current rotation, with a similar failure frequency (${f}).`
  }
  if (p10.verdict === 'unfavourable' && fail.verdict !== 'favourable') {
    return fail.verdict === 'unfavourable'
      ? `${name} showed a lower lower-decile seasonal index (${p}) and more simulated failures (${f}) than the current rotation in this simulation.`
      : `${name} showed a lower lower-decile seasonal index (${p}) than the current rotation, with a similar failure frequency (${f}).`
  }
  if (p10.verdict === 'similar' && fail.verdict === 'similar') {
    return `${name} and the current rotation showed similar stability in this simulation (lower-decile index ${p}; failure frequency ${f}).`
  }
  return null
}

/**
 * One sentence naming a gain and a cost of `rot` against the current rotation, in that order.
 * Only produced when the engine output contains at least one difference each way.
 */
export function tradeoffSentence(rot: Rotation, cur: Rotation, focus?: string[]): string | null {
  if (rot.is_current) return null
  const all = tradeoffs(rot, cur).filter((t) => !focus || focus.includes(t.metric.id))
  const gain = all.find((t) => t.verdict === 'favourable')
  const cost = all.find((t) => t.verdict === 'unfavourable')
  if (!gain || !cost) return null
  const phrase = (t: Tradeoff) => {
    const up = (t.delta ?? 0) > 0
    const word = t.metric.unit === 'percent' && t.metric.id !== 'failure' ? (up ? 'a larger' : 'a smaller') : up ? 'a higher' : 'a lower'
    return `${word} ${t.metric.label.charAt(0).toLowerCase()}${t.metric.label.slice(1)} (${fmtMetric(t.metric, t.value)} against ${fmtMetric(t.metric, t.base)})`
  }
  return `${rotationLabel(rot)} has ${phrase(gain)} than the current rotation, but ${phrase(cost)}.`
}

export interface RankSpread {
  /** Number of rank positions between the best and worst rank across the tested assumptions. */
  width: number
  label: string
  explain: string
}

/** Reading of a rank range from the engine's sensitivity checks. Null when the range is unavailable. */
export function rankSpread(range: [number, number] | null | undefined): RankSpread | null {
  if (!range) return null
  const width = Math.abs(range[1] - range[0])
  if (width === 0) return { width, label: 'Rank did not move', explain: 'The position stayed the same across the tested assumptions.' }
  if (width === 1) return { width, label: 'Moved by one place', explain: 'The position shifted by one place across the tested assumptions.' }
  return { width, label: `Moved across ${width} places`, explain: 'The position is more sensitive to the tested assumptions.' }
}

/* ------------------------------------------------------------------ comparing several runs */

export interface RunInput {
  id: string
  label: string
  /** Shown under the label, e.g. "temperature +2.0 °C, rainfall 80%". */
  sublabel?: string
  envelope: AnalysisEnvelope
}

export interface RunSummary extends RunInput {
  current: Rotation | undefined
  /** The highest-ranked rotation in this run (may be the current rotation). */
  top: Rotation | undefined
  /** The highest-ranked rotation other than the current one. */
  topAlternative: Rotation | undefined
  count: number
}

export interface RankRow {
  key: string
  name: string
  isCurrent: boolean
  /** Rank in each run, in the order of `runs`. Null when the rotation was not among those shown in that run. */
  ranks: (number | null)[]
  rotations: (Rotation | null)[]
}

/** Lines up the rotations of several runs by crops and sowing days, so their ranks can be compared. */
export function summariseRuns(inputs: RunInput[]): { runs: RunSummary[]; rows: RankRow[] } {
  const runs: RunSummary[] = inputs.map((r) => {
    const ranked = rankedRotations(r.envelope.result)
    return { ...r, current: currentRotation(r.envelope.result), top: ranked[0], topAlternative: ranked.find((x) => !x.is_current), count: ranked.length }
  })
  const rows = new Map<string, RankRow>()
  runs.forEach((run, i) => {
    for (const rot of rankedRotations(run.envelope.result)) {
      const key = rot.is_current ? 'current' : rotationKey(rot)
      let row = rows.get(key)
      if (!row) {
        row = { key, name: rotationLabel(rot), isCurrent: rot.is_current, ranks: runs.map(() => null), rotations: runs.map(() => null) }
        rows.set(key, row)
      }
      row.ranks[i] = rot.scores?.rank ?? null
      row.rotations[i] = rot
    }
  })
  const first = (row: RankRow) => row.ranks.find((x): x is number => x !== null) ?? 99
  const list = [...rows.values()].sort((a, b) => (a.ranks[0] ?? 50 + first(a)) - (b.ranks[0] ?? 50 + first(b)))
  return { runs, rows: list }
}

export interface RunChange {
  kind: 'top' | 'current_rank' | 'moved' | 'entered' | 'left' | 'metric' | 'none'
  text: string
}

/**
 * What differs between a baseline run and another run, as facts read from the two engine responses.
 * `what` names the kind of difference for the wording ("scenario" or "priorities").
 */
export function runChanges(base: RunSummary, other: RunSummary, rows: RankRow[], baseIndex: number, otherIndex: number): RunChange[] {
  const out: RunChange[] = []
  const under = `under “${other.label}”`
  if (base.top && other.top) {
    const same = (base.top.is_current && other.top.is_current) || (!base.top.is_current && !other.top.is_current && rotationKey(base.top) === rotationKey(other.top))
    out.push(
      same
        ? { kind: 'top', text: `${rotationLabel(other.top)} stays the highest-ranked rotation ${under}.` }
        : { kind: 'top', text: `The highest-ranked rotation changes from ${rotationLabel(base.top)} to ${rotationLabel(other.top)} ${under}.` },
    )
  }
  const b = base.current?.scores?.rank
  const o = other.current?.scores?.rank
  if (isNum(b) && isNum(o)) {
    out.push({
      kind: 'current_rank',
      text:
        b === o
          ? `Your current rotation keeps rank #${o} of ${other.count}.`
          : `Your current rotation moves from rank #${b} of ${base.count} to #${o} of ${other.count} (${o < b ? 'more' : 'less'} competitive against the alternatives shown).`,
    })
  }
  for (const row of rows) {
    if (row.isCurrent) continue
    const rb = row.ranks[baseIndex]
    const ro = row.ranks[otherIndex]
    if (rb !== null && ro !== null && rb !== ro) {
      out.push({ kind: 'moved', text: `${row.name} moves from rank #${rb} to #${ro}${ro < rb ? ' and becomes more competitive' : ''}.` })
    } else if (rb === null && ro !== null) {
      out.push({ kind: 'entered', text: `${row.name} enters the alternatives shown, at rank #${ro}.` })
    } else if (rb !== null && ro === null) {
      out.push({ kind: 'left', text: `${row.name} (rank #${rb} in the baseline) is no longer among the alternatives shown.` })
    }
  }
  if (base.current && other.current) {
    for (const id of ['median', 'p10', 'failure', 'water', 'irrigation']) {
      const m = METRIC_BY_ID[id]
      const vb = m.get(base.current)
      const vo = m.get(other.current)
      if (!isNum(vb) || !isNum(vo) || Math.abs(vo - vb) < m.similar) continue
      out.push({
        kind: 'metric',
        text: `Current rotation, ${m.label.charAt(0).toLowerCase()}${m.label.slice(1)}: ${fmtMetric(m, vb)} in the baseline, ${fmtMetric(m, vo)} ${under} (${fmtMetricDelta(m, vo - vb)}).`,
      })
    }
  }
  if (!out.some((c) => c.kind === 'moved' || c.kind === 'entered' || c.kind === 'left' || c.kind === 'metric') && out.every((c) => !/changes|moves/.test(c.text))) {
    out.push({ kind: 'none', text: `No ranking or headline indicator of the current rotation differs from the baseline ${under}.` })
  }
  return out
}
