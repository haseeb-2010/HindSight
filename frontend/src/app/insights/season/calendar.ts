// Layout helpers for the seasonal exposure explorer. They only regroup the engine's rotation calendar
// (one entry per month: the crop in the ground for most of the month, and the share of days with no crop).
import { fmtPct } from '../../../lib/format'
import type { CalendarCell, Rotation } from '../../../lib/types'
import { BARE_RULES, bareLevel, monthName, monthSpanText } from '../../lib/insights'

export const FALLOW = 'fallow_bare'

/** Bare soil is drawn hatched everywhere in this section. */
export const HATCH = 'repeating-linear-gradient(135deg, var(--color-sand-400) 0 2px, transparent 2px 6px)'

export type Row = (CalendarCell | null)[]

/** Crop ids in the order they are sown in the rotation, so a crop keeps its colour across rotation years. */
export function cropOrder(r: Rotation): string[] {
  const slots = [...r.slots].sort((a, b) => a.year_offset - b.year_offset || a.plant_doy - b.plant_doy)
  const ids = [...slots.map((s) => s.crop_id), ...(r.calendar ?? []).map((c) => c.crop_id)]
  return [...new Set(ids)].filter((id) => id !== FALLOW)
}

/**
 * Consecutive calendar months grouped into runs. With `cyclic`, a run that reaches December joins one that
 * starts in January (a one-year rotation repeats, so November to April is one period).
 */
export function monthRuns(months: number[], cyclic: boolean): number[][] {
  const sorted = [...new Set(months)].sort((a, b) => a - b)
  const runs: number[][] = []
  for (const m of sorted) {
    const last = runs[runs.length - 1]
    if (last && last[last.length - 1] === m - 1) last.push(m)
    else runs.push([m])
  }
  if (cyclic && runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].at(-1) === 12) {
    const tail = runs.pop() as number[]
    runs[0] = [...tail, ...runs[0]]
    runs.push(runs.shift() as number[])
  }
  return runs
}

/** "May to October" or "February and March, then September and October". */
export function runsText(runs: number[][]): string {
  return runs.map(monthSpanText).join(', then ')
}

/** Calendar months of one rotation year at the "higher" bare-soil level (BARE_RULES). */
export function mostlyBareMonths(row: Row): number[] {
  return row.filter((c): c is CalendarCell => !!c && bareLevel(c.bare_frac) === 'higher').map((c) => c.month)
}

export interface Bar {
  /** Start and end in months from the start of January (0 to 12). */
  from: number
  to: number
  /** The bar carries on from the previous rotation year, or into the next one. */
  openStart: boolean
  openEnd: boolean
}

export interface Lane {
  /** Crop id, or FALLOW for the bare-soil lane. */
  id: string
  bars: Bar[]
  /** Months (1 to 12) in which the engine calendar lists this crop. Empty for the bare-soil lane. */
  months: number[]
}

/**
 * One lane per crop in the chosen rotation year, plus a bare-soil lane, from the engine calendar.
 * A partly bare month is a sowing or harvest month: the crop's bar is shortened by the bare share, on the side
 * away from the crop's neighbouring month. Where exactly the bare days fall inside a month is not in the calendar.
 */
export function yearLanes(rows: Row[], year: number): Lane[] {
  const flat = rows.flat()
  const n = flat.length
  const base = year * 12
  const cell = (k: number) => flat[((k % n) + n) % n]
  const sameAsPrev = (k: number) => cell(k - 1)?.crop_id === cell(k)?.crop_id
  const sameAsNext = (k: number) => cell(k + 1)?.crop_id === cell(k)?.crop_id
  /** Which side of a month its bare days are drawn on. */
  const bareSide = (k: number): 'all' | 'left' | 'right' | null => {
    const c = cell(k)
    if (!c || c.bare_frac <= 0) return null
    if (c.crop_id === FALLOW || c.bare_frac >= 1) return 'all'
    return !sameAsPrev(k) && sameAsNext(k) ? 'left' : 'right'
  }

  const lanes = new Map<string, Lane>()
  const lane = (id: string) => {
    if (!lanes.has(id)) lanes.set(id, { id, bars: [], months: [] })
    return lanes.get(id) as Lane
  }

  // Crops: one bar per run of months that list the same crop.
  let i = 0
  while (i < 12) {
    const c = cell(base + i)
    if (!c || c.crop_id === FALLOW || c.bare_frac >= 1) {
      i++
      continue
    }
    let j = i
    while (j + 1 < 12 && cell(base + j + 1)?.crop_id === c.crop_id && (cell(base + j + 1)?.bare_frac ?? 1) < 1) j++
    const lead = bareSide(base + i) === 'left' ? c.bare_frac : 0
    const last = cell(base + j) as CalendarCell
    const trail = bareSide(base + j) === 'right' ? last.bare_frac : 0
    const l = lane(c.crop_id)
    l.bars.push({ from: i + lead, to: j + 1 - trail, openStart: i === 0 && lead === 0 && sameAsPrev(base), openEnd: j === 11 && trail === 0 && sameAsNext(base + 11) })
    for (let m = i; m <= j; m++) l.months.push(m + 1)
    i = j + 1
  }

  // Bare soil: the bare share of every month, joined where the pieces touch.
  const bare: Bar[] = []
  for (let m = 0; m < 12; m++) {
    const c = cell(base + m)
    const side = bareSide(base + m)
    if (!c || !side) continue
    const from = side === 'right' ? m + 1 - c.bare_frac : m
    const to = side === 'left' ? m + c.bare_frac : m + 1
    const prev = bare[bare.length - 1]
    if (prev && Math.abs(prev.to - from) < 1e-6) prev.to = to
    else bare.push({ from, to, openStart: false, openEnd: false })
  }
  for (const b of bare) {
    const before = bareSide(base - 1)
    const after = bareSide(base + 12)
    b.openStart = b.from === 0 && (before === 'all' || before === 'right')
    b.openEnd = b.to === 12 && (after === 'all' || after === 'left')
  }
  const out = [...lanes.values()]
  if (bare.length) out.push({ id: FALLOW, bars: bare, months: [] })
  return out
}

export interface Segment {
  crop_id: string
  months: number[]
}

/** The crop the engine calendar lists for each month of one rotation year, as a sequence of runs. */
export function yearSequence(row: Row): Segment[] {
  const out: Segment[] = []
  for (const c of row) {
    if (!c) continue
    const last = out[out.length - 1]
    if (last && last.crop_id === c.crop_id && last.months[last.months.length - 1] === c.month - 1) last.months.push(c.month)
    else out.push({ crop_id: c.crop_id, months: [c.month] })
  }
  return out
}

const NAMED_FRACTIONS: [number, string][] = [
  [1 / 4, 'one quarter'],
  [1 / 3, 'one third'],
  [1 / 2, 'half'],
  [2 / 3, 'two thirds'],
  [3 / 4, 'three quarters'],
]

/** A threshold from BARE_RULES in words ("two thirds"), or as a percentage when it is not a simple fraction. */
export function fractionWords(x: number): string {
  return NAMED_FRACTIONS.find(([v]) => Math.abs(v - x) < 1e-9)?.[1] ?? fmtPct(x, 1)
}

/** The written rule behind the three bare-soil levels, read from BARE_RULES. */
export function bareRuleText(): { lower: string; moderate: string; higher: string } {
  const a = fractionWords(BARE_RULES.moderateFrom)
  const b = fractionWords(BARE_RULES.higherFrom)
  return { lower: `under ${a} of the month’s days`, moderate: `${a} to under ${b}`, higher: `${b} or more` }
}

export const SHORT_MONTHS = Array.from({ length: 12 }, (_, i) => monthName(i + 1, true))
