import { describe, expect, it } from 'vitest'
// The real saved engine outputs for the three demonstration farms.
import amesJson from '../../../../../backend/data/saved/ames_iowa_response.json'
import chakwalJson from '../../../../../backend/data/saved/chakwal_response.json'
import sheikhupuraJson from '../../../../../backend/data/saved/sheikhupura_response.json'
import { currentRotation } from '../../../lib/analysis'
import type { AnalysisResult, Rotation } from '../../../lib/types'
import { BARE_RULES, calendarByYear } from '../../lib/insights'
import { indicatorInfo } from '../climate/definitions'
import { bareRuleText, cropOrder, FALLOW, fractionWords, monthRuns, mostlyBareMonths, runsText, sharePct, yearLanes, yearSequence } from './calendar'

const chakwal = chakwalJson as unknown as AnalysisResult
const sheikhupura = sheikhupuraJson as unknown as AnalysisResult
const ames = amesJson as unknown as AnalysisResult
const all = [chakwal, sheikhupura, ames]
const cur = (res: AnalysisResult) => currentRotation(res) as Rotation

describe('monthRuns', () => {
  it('groups consecutive months', () => {
    expect(monthRuns([2, 3, 9, 10], false)).toEqual([[2, 3], [9, 10]])
    expect(monthRuns([], true)).toEqual([])
  })

  it('joins December to January only when the calendar repeats', () => {
    expect(monthRuns([1, 2, 3, 4, 11, 12], true)).toEqual([[11, 12, 1, 2, 3, 4]])
    expect(monthRuns([1, 2, 3, 4, 11, 12], false)).toEqual([[1, 2, 3, 4], [11, 12]])
    expect(monthRuns([1, 2, 6, 11, 12], true)).toEqual([[6], [11, 12, 1, 2]])
  })

  it('keeps a full year as one run', () => {
    expect(monthRuns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], true)).toHaveLength(1)
  })

  it('is worded in calendar order', () => {
    expect(runsText(monthRuns([5, 6, 7, 8, 9, 10], true))).toBe('May to October')
    expect(runsText(monthRuns([2, 3, 9, 10], false))).toBe('February and March, then September and October')
  })
})

describe('yearLanes', () => {
  it('draws Chakwal’s wheat and its bare period from the engine calendar', () => {
    const r = cur(chakwal)
    const lanes = yearLanes(calendarByYear(r), 0)
    const cell = (m: number) => r.calendar?.find((c) => c.month === m)
    const wheat = lanes.find((l) => l.id === 'wheat')
    const bare = lanes.find((l) => l.id === FALLOW)
    // Wheat runs over the new year: one bar from January into the harvest month, one from sowing to December.
    expect(wheat?.bars).toHaveLength(2)
    expect(wheat?.bars[0].from).toBe(0)
    expect(wheat?.bars[0].openStart).toBe(true)
    expect(wheat?.bars[1].to).toBe(12)
    expect(wheat?.bars[1].openEnd).toBe(true)
    // The bare bar starts where the wheat bar stops, inside the harvest month.
    const harvest = wheat?.months.filter((m) => m < 6).at(-1) as number
    expect(wheat?.bars[0].to).toBeCloseTo(harvest - (cell(harvest)?.bare_frac ?? 0), 6)
    expect(bare?.bars[0].from).toBeCloseTo(wheat?.bars[0].to as number, 6)
  })

  it('accounts for every day of every rotation year exactly once', () => {
    for (const res of all) {
      for (const r of res.rotations) {
        const rows = calendarByYear(r)
        rows.forEach((row, y) => {
          const lanes = yearLanes(rows, y)
          const length = (id: (l: string) => boolean) => lanes.filter((l) => id(l.id)).flatMap((l) => l.bars).reduce((a, b) => a + (b.to - b.from), 0)
          const bareInCalendar = row.reduce((a, c) => a + (c?.bare_frac ?? 0), 0)
          expect(length((l) => l === FALLOW)).toBeCloseTo(bareInCalendar, 6)
          expect(length(() => true)).toBeCloseTo(12, 6)
          for (const b of lanes.flatMap((l) => l.bars)) {
            expect(b.from).toBeGreaterThanOrEqual(0)
            expect(b.to).toBeLessThanOrEqual(12)
            expect(b.to).toBeGreaterThan(b.from)
          }
        })
      }
    }
  })

  it('only names crops the rotation grows', () => {
    for (const res of all) {
      for (const r of res.rotations) {
        const grown = new Set(r.slots.map((s) => s.crop_id))
        const rows = calendarByYear(r)
        rows.forEach((_, y) => {
          for (const l of yearLanes(rows, y)) if (l.id !== FALLOW) expect(grown.has(l.id)).toBe(true)
        })
        expect(cropOrder(r).every((id) => grown.has(id))).toBe(true)
      }
    }
  })
})

describe('yearSequence', () => {
  it('lists each month of the year once, in order', () => {
    for (const res of all) {
      for (const r of res.rotations) {
        for (const row of calendarByYear(r)) {
          expect(yearSequence(row).flatMap((s) => s.months)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
        }
      }
    }
  })
})

describe('bare-soil levels', () => {
  it('marks only months at or above the documented threshold', () => {
    for (const res of all) {
      for (const r of res.rotations) {
        for (const row of calendarByYear(r)) {
          const marked = new Set(mostlyBareMonths(row))
          for (const c of row) if (c) expect(marked.has(c.month)).toBe(c.bare_frac >= BARE_RULES.higherFrom)
        }
      }
    }
  })

  it('words the rule from BARE_RULES', () => {
    expect(fractionWords(BARE_RULES.moderateFrom)).toBe('one third')
    expect(fractionWords(BARE_RULES.higherFrom)).toBe('two thirds')
    expect(fractionWords(0.4)).toBe('40.0%')
    expect(bareRuleText().higher).toBe('two thirds or more')
  })

  it('never prints a small share as 0%', () => {
    expect(sharePct(0.756)).toBe('76%')
    expect(sharePct(0.003)).toBe('0.3%')
    expect(sharePct(0.0001)).toBe('under 0.1%')
    expect(sharePct(0)).toBe('0%')
    expect(sharePct(null)).toBe('—')
    // The engine's own value for Sheikhupura's current rotation is a fraction of one percent.
    expect(sharePct(cur(sheikhupura).indicators.erosive_rain_on_bare_frac)).not.toBe('0%')
  })
})

describe('indicatorInfo', () => {
  it('reads the half-year months from the analysis and assumes none when they are missing', () => {
    const ctx = {
      record: { start_year: 1985, end_year: 2024 },
      scenario_applied: false,
      years: [],
      annual: {},
      monthly: [],
      thresholds: { hot_day_c: 35, frost_day_c: 0, heavy_rain_mm: 12.7 },
      warm_half_year_months: [10, 11, 12, 1, 2, 3],
    }
    expect(indicatorInfo('warm_season_rain_mm', ctx)?.hint).toBe('Rainfall, October to March')
    expect(indicatorInfo('cool_season_rain_mm', ctx)?.hint).toBe('Rainfall, April to September')
    expect(indicatorInfo('heavy_rain_days', ctx)?.definition).toContain('12.7 mm')
    expect(indicatorInfo('cool_season_rain_mm', null)?.hint).toBe('Rainfall in the cooler six months')
    expect(indicatorInfo('hot_days', null)?.definition).not.toMatch(/\d/)
    expect(indicatorInfo('something_new', ctx)).toBeNull()
  })
})
