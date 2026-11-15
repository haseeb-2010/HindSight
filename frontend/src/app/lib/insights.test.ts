import { describe, expect, it } from 'vitest'
// The real saved engine outputs for the three demonstration farms.
import amesJson from '../../../../backend/data/saved/ames_iowa_response.json'
import chakwalJson from '../../../../backend/data/saved/chakwal_response.json'
import sheikhupuraJson from '../../../../backend/data/saved/sheikhupura_response.json'
import { currentRotation, rankedRotations } from '../../lib/analysis'
import type { AnalysisEnvelope, AnalysisResult, ClimateShift, Rotation } from '../../lib/types'
import {
  bareLevel,
  barePeriods,
  calendarByYear,
  exposureSentence,
  fmtMetricDelta,
  METRIC_BY_ID,
  monthlyShare,
  monthSpanText,
  rankSpread,
  readShift,
  rotationKey,
  runChanges,
  shiftSentence,
  stabilitySentence,
  summariseRuns,
  tradeoffs,
  tradeoffSentence,
  windowMean,
  worstYearTable,
} from './insights'

const chakwal = chakwalJson as unknown as AnalysisResult
const sheikhupura = sheikhupuraJson as unknown as AnalysisResult
const ames = amesJson as unknown as AnalysisResult
const env = (result: AnalysisResult): AnalysisEnvelope => ({ source: 'saved', preset_id: null, result })

const shift = (over: Partial<ClimateShift>): ClimateShift => ({
  id: 'hot_days', label: 'Days above 35 °C', unit: 'days', early: 60, late: 70, change: 10, slope_per_decade: 3, p_value: 0.01, ...over,
})

describe('readShift', () => {
  it('names the direction from the two period means', () => {
    expect(readShift(shift({})).label).toBe('Higher in later period')
    expect(readShift(shift({ late: 50, change: -10 })).label).toBe('Lower in later period')
  })

  it('calls a difference under 5% of the earlier value, or under one day, little change', () => {
    expect(readShift(shift({ late: 62, change: 2 })).direction).toBe('little') // 3.3%
    expect(readShift(shift({ early: 0.3, late: 0.1, change: -0.2 })).direction).toBe('little') // less than a day
    expect(readShift(shift({ unit: 'mm', early: 20, late: 24, change: 4 })).direction).toBe('little') // less than 5 mm
    expect(readShift(shift({ unit: 'mm', early: 20, late: 26, change: 6 })).direction).toBe('higher')
  })

  it('separates the size of a change from the statistical evidence for a trend', () => {
    expect(readShift(shift({ p_value: 0.049 })).evidence).toBe('consistent')
    expect(readShift(shift({ p_value: 0.05 })).evidence).toBe('limited')
    expect(readShift(shift({ p_value: null })).evidenceLabel).toBe('Statistical evidence is limited')
    // a large difference can still have limited evidence
    const r = readShift(shift({ late: 90, change: 30, p_value: 0.4 }))
    expect([r.direction, r.evidence]).toEqual(['higher', 'limited'])
  })

  it('classifies every indicator of the three saved analyses without inventing a trend', () => {
    for (const res of [chakwal, sheikhupura, ames]) {
      for (const s of res.climate_shift ?? []) {
        const r = readShift(s)
        if (r.evidence === 'consistent') expect(s.p_value).toBeLessThan(0.05)
        if (r.direction === 'higher') expect(s.late as number).toBeGreaterThan(s.early as number)
        if (r.direction === 'lower') expect(s.late as number).toBeLessThan(s.early as number)
      }
    }
  })
})

describe('shiftSentence', () => {
  it('states the values and words limited evidence carefully', () => {
    const rain = chakwal.climate_shift!.find((s) => s.id === 'cool_season_rain_mm')!
    const text = shiftSentence(rain, '1985–2004', '2005–2024')
    expect(text).toContain('158 mm a year in 1985–2004 and 265 in 2005–2024')
    expect(text).toContain('Statistical evidence for a steady trend is limited (p = 0.08)')
    expect(text).not.toMatch(/significant|probab|will|forecast/i)
  })

  it('explains evapotranspiration only when it actually differs', () => {
    const up = shiftSentence(shift({ id: 'annual_et0_mm', unit: 'mm', early: 1500, late: 1600, change: 100 }), 'A', 'B')
    expect(up).toContain('greater atmospheric demand for water')
    const flat = shiftSentence(shift({ id: 'annual_et0_mm', unit: 'mm', early: 1500, late: 1510, change: 10 }), 'A', 'B')
    expect(flat).toContain('changed little')
    expect(flat).not.toContain('atmospheric demand')
  })

  it('uses frequency wording for day counts', () => {
    expect(shiftSentence(shift({}), 'A', 'B')).toContain('Days above 35 °C were more frequent in the later period')
    expect(shiftSentence(shift({ early: null }), 'A', 'B')).toContain('did not return values')
  })
})

describe('windowMean', () => {
  it('averages only the years inside the window', () => {
    expect(windowMean([2000, 2001, 2002, 2003], [1, 3, 5, 7], [2001, 2002])).toBe(4)
    expect(windowMean([2000], [1], undefined)).toBeNull()
  })
})

describe('seasonal exposure', () => {
  const wheatFallow = currentRotation(chakwal)! // wheat sown in autumn, bare through the summer

  it('grades the modelled bare fraction in thirds', () => {
    expect([bareLevel(0), bareLevel(0.33), bareLevel(0.34), bareLevel(0.66), bareLevel(0.67), bareLevel(1)]).toEqual([
      'lower', 'lower', 'moderate', 'moderate', 'higher', 'higher',
    ])
  })

  it('lays the engine calendar out as twelve months per rotation year', () => {
    const rows = calendarByYear(wheatFallow)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(12)
    expect(rows[0][0]?.crop_id).toBe('wheat')
    const twoYear = chakwal.rotations.find((r) => r.cycle_years === 2)!
    expect(calendarByYear(twoYear)).toHaveLength(2)
  })

  it('finds the bare period of wheat–fallow from the calendar, in calendar order', () => {
    const periods = barePeriods(wheatFallow, 'higher')
    expect(periods).toHaveLength(1)
    const cells = calendarByYear(wheatFallow)[0]
    for (const m of periods[0].months) expect(cells[m - 1]!.bare_frac).toBeGreaterThanOrEqual(2 / 3)
    for (const c of cells) if (!periods[0].months.includes(c!.month)) expect(c!.bare_frac).toBeLessThan(2 / 3)
    expect(periods[0].meanBare).toBeGreaterThan(0.66)
    expect(exposureSentence(wheatFallow)).toContain(`mostly bare in ${monthSpanText(periods[0].months)}`)
  })

  it('joins a period that runs over the new year', () => {
    const rot = { ...wheatFallow, calendar: wheatFallow.calendar!.map((c) => ({ ...c, bare_frac: [11, 12, 1].includes(c.month) ? 1 : 0 })) }
    expect(barePeriods(rot)).toEqual([{ year_offset: 0, months: [11, 12, 1], meanBare: 1 }])
    expect(monthSpanText([11, 12, 1])).toBe('November to January')
  })

  it('does not invent a bare period when there is none', () => {
    const covered = { ...wheatFallow, calendar: wheatFallow.calendar!.map((c) => ({ ...c, bare_frac: 0 })) }
    expect(barePeriods(covered)).toEqual([])
    expect(exposureSentence(covered)).toContain('no mostly bare period')
    expect(barePeriods({ ...wheatFallow, calendar: undefined })).toEqual([])
  })

  it('describes the seasonality of the record as a share, or nothing without data', () => {
    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, rain_mm: i < 3 ? 100 : 0, et0_mm: 0, heavy_rain_days: 0, hot_days: 0, frost_days: 0, mean_temp_c: 0 }))
    expect(monthlyShare(monthly, 'rain_mm', [1, 2])).toBeCloseTo(2 / 3)
    expect(monthlyShare(monthly, 'heavy_rain_days', [1])).toBeNull()
    expect(monthlyShare(undefined, 'rain_mm', [1])).toBeNull()
  })
})

describe('rotation resilience', () => {
  it('compares every rotation in the current rotation’s worst years, using the engine’s means', () => {
    const table = worstYearTable(chakwal)!
    expect(table.years).toEqual([1994, 1998, 2000, 2001, 2002])
    expect(table.rows).toHaveLength(chakwal.rotations.length)
    for (const row of table.rows) {
      expect(row.mean).toBe(row.rotation.hindcast.worst_years!.mean_index)
      const direct = table.years.map((y) => row.rotation.hindcast.annual_index[row.rotation.hindcast.years.indexOf(y)])
      expect(row.values).toEqual(direct)
      // the engine's mean is the mean of exactly these values
      const m = row.values.reduce((a: number, b) => a + (b as number), 0) / row.values.length
      expect(m).toBeCloseTo(row.mean as number, 2)
    }
    const cur = table.rows.find((r) => r.rotation.is_current)!
    expect(cur.deltaVsCurrent).toBe(0)
  })

  it('returns nothing when worst years are missing', () => {
    const stripped: AnalysisResult = { ...chakwal, rotations: chakwal.rotations.map((r) => ({ ...r, hindcast: { ...r.hindcast, worst_years: null } })) }
    expect(worstYearTable(stripped)).toBeNull()
  })

  it('marks differences by the direction the ranking rewards and leaves small ones as similar', () => {
    const cur = currentRotation(chakwal)!
    const top = rankedRotations(chakwal)[0]
    const t = Object.fromEntries(tradeoffs(top, cur).map((x) => [x.metric.id, x]))
    expect(t.p10.delta).toBeCloseTo((top.hindcast.p10 as number) - (cur.hindcast.p10 as number))
    expect(t.water.verdict).toBe(top.hindcast.water_demand_mm_per_year < cur.hindcast.water_demand_mm_per_year - 15 ? 'favourable' : top.hindcast.water_demand_mm_per_year > cur.hindcast.water_demand_mm_per_year + 15 ? 'unfavourable' : 'similar')
    expect(tradeoffs(cur, cur).every((x) => x.verdict === 'similar')).toBe(true)
    expect(fmtMetricDelta(METRIC_BY_ID.cover, 0.08)).toBe('+8 points')
    expect(fmtMetricDelta(METRIC_BY_ID.water, -40.2)).toBe('−40 mm')
  })

  it('only writes a stability sentence the numbers support', () => {
    const cur = currentRotation(chakwal)!
    for (const r of chakwal.rotations) {
      const text = stabilitySentence(r, cur)
      if (r.is_current) expect(text).toBeNull()
      if (!text) continue
      const higher = (r.hindcast.p10 as number) > (cur.hindcast.p10 as number)
      if (text.includes('higher lower-decile')) expect(higher).toBe(true)
      if (text.includes('fewer simulated failures')) expect(r.hindcast.failure_freq as number).toBeLessThan(cur.hindcast.failure_freq as number)
      expect(text).not.toMatch(/guarantee|will |yield/i)
    }
  })

  it('writes a trade-off sentence only when there is a gain and a cost', () => {
    const cur = currentRotation(ames)!
    for (const r of ames.rotations.filter((x) => !x.is_current)) {
      const t = tradeoffs(r, cur)
      const both = t.some((x) => x.verdict === 'favourable') && t.some((x) => x.verdict === 'unfavourable')
      expect(tradeoffSentence(r, cur) !== null).toBe(both)
    }
    expect(tradeoffSentence(cur, cur)).toBeNull()
  })

  it('reads rank ranges as sensitivity, and reports missing ones as missing', () => {
    expect(rankSpread([2, 2])?.label).toBe('Rank did not move')
    expect(rankSpread([2, 3])?.width).toBe(1)
    expect(rankSpread([1, 4])?.explain).toContain('more sensitive')
    expect(rankSpread(null)).toBeNull()
    expect(rankSpread(undefined)).toBeNull()
  })
})

describe('comparing runs', () => {
  const rerank = (res: AnalysisResult, order: string[]): AnalysisResult => ({
    ...res,
    rotations: res.rotations.map((r) => ({ ...r, scores: { ...r.scores, rank: order.indexOf(r.id) + 1 } })),
  })

  it('identifies a rotation by its crops and sowing days, not by its positional id', () => {
    const a = chakwal.rotations[1]
    const renamed: Rotation = { ...a, id: 'swap_9' }
    expect(rotationKey(renamed)).toBe(rotationKey(a))
    expect(rotationKey(chakwal.rotations[2])).not.toBe(rotationKey(a))
  })

  it('lines rotations up across runs and reports what moved', () => {
    const ids = rankedRotations(chakwal).map((r) => r.id)
    const swapped = [ids[1], ids[0], ...ids.slice(2)]
    const other = rerank(chakwal, swapped)
    const { runs, rows } = summariseRuns([
      { id: 'base', label: 'Historical baseline', envelope: env(chakwal) },
      { id: 'dry', label: 'Lower rainfall', envelope: env(other) },
    ])
    expect(runs[0].top!.id).toBe(ids[0])
    expect(runs[1].top!.id).toBe(ids[1])
    expect(rows).toHaveLength(chakwal.rotations.length)
    expect(rows.find((r) => r.isCurrent)!.ranks).toEqual([6, 6])
    const changes = runChanges(runs[0], runs[1], rows, 0, 1)
    expect(changes.find((c) => c.kind === 'top')!.text).toContain('changes from')
    expect(changes.filter((c) => c.kind === 'moved')).toHaveLength(2)
    expect(changes.find((c) => c.kind === 'current_rank')!.text).toContain('keeps rank #6 of 6')
  })

  it('says so when nothing differs, and notes rotations that enter or leave', () => {
    const same = summariseRuns([
      { id: 'a', label: 'A', envelope: env(chakwal) },
      { id: 'b', label: 'B', envelope: env(chakwal) },
    ])
    const none = runChanges(same.runs[0], same.runs[1], same.rows, 0, 1)
    expect(none.some((c) => c.kind === 'none')).toBe(true)
    expect(none.some((c) => c.kind === 'moved')).toBe(false)

    const fewer: AnalysisResult = { ...chakwal, rotations: chakwal.rotations.slice(0, -1) }
    const diff = summariseRuns([
      { id: 'a', label: 'A', envelope: env(chakwal) },
      { id: 'b', label: 'B', envelope: env(fewer) },
    ])
    const changes = runChanges(diff.runs[0], diff.runs[1], diff.rows, 0, 1)
    expect(changes.some((c) => c.kind === 'left')).toBe(true)
    expect(diff.rows.some((r) => r.ranks[1] === null)).toBe(true)
  })
})
