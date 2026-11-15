import { describe, expect, it } from 'vitest'
// The real saved engine outputs for the three demonstration farms.
import amesJson from '../../../../../backend/data/saved/ames_iowa_response.json'
import chakwalJson from '../../../../../backend/data/saved/chakwal_response.json'
import sheikhupuraJson from '../../../../../backend/data/saved/sheikhupura_response.json'
import { currentRotation, rankedRotations, rotationLabel } from '../../../lib/analysis'
import { fmtMm } from '../../../lib/format'
import type { AnalysisResult, MonthlyClimate, Rotation } from '../../../lib/types'
import { METRIC_BY_ID } from '../../lib/insights'
import { annualSentence, deltaNote, measureSentence, monthBalance, monthlySentence, monthRuns, waterTradeoff, waterValuesSentence } from './waterText'

const chakwal = chakwalJson as unknown as AnalysisResult
const sheikhupura = sheikhupuraJson as unknown as AnalysisResult
const ames = amesJson as unknown as AnalysisResult

const parts = (res: AnalysisResult) => {
  const cur = currentRotation(res) as Rotation
  return { cur, alts: rankedRotations(res).filter((r) => r !== cur) }
}

const months = (pairs: [number, number][]): MonthlyClimate[] =>
  pairs.map(([rain_mm, et0_mm], i) => ({ month: i + 1, rain_mm, et0_mm, heavy_rain_days: 0, hot_days: 0, frost_days: 0, mean_temp_c: 0 }))

describe('measureSentence', () => {
  it.each([
    ['chakwal', chakwal],
    ['sheikhupura', sheikhupura],
    ['ames', ames],
  ])('counts the alternatives the way the engine values fall for %s', (_, res) => {
    const { cur, alts } = parts(res)
    const similar = METRIC_BY_ID.water.similar
    const base = cur.hindcast.water_demand_mm_per_year
    const lower = alts.filter((r) => r.hindcast.water_demand_mm_per_year - base <= -similar)
    const higher = alts.filter((r) => r.hindcast.water_demand_mm_per_year - base >= similar)
    const text = measureSentence('water', cur, alts) as string
    expect(text).toContain(`your current rotation (${fmtMm(base)} a year)`)
    expect(text).toContain('modelled crop water demand')
    if (lower.length === alts.length) expect(text).toContain(`all ${alts.length} alternatives have a lower`)
    else if (lower.length > 0) expect(text).toContain(`${lower.length} of the ${alts.length} alternatives ${lower.length === 1 ? 'has' : 'have'} a lower`)
    if (lower.length > 0) {
      const lowest = [...lower].sort((a, b) => a.hindcast.water_demand_mm_per_year - b.hindcast.water_demand_mm_per_year)[0]
      expect(text).toContain(`The lowest is ${rotationLabel(lowest)} at ${fmtMm(lowest.hindcast.water_demand_mm_per_year)} a year.`)
    }
    if (higher.length > 0 && lower.length > 0) expect(text).toContain(`${higher.length} ${higher.length === 1 ? 'has' : 'have'} a higher one`)
  })

  it('describes the irrigation requirement of an irrigated analysis without calling it water use', () => {
    const { cur, alts } = parts(sheikhupura)
    const text = measureSentence('irrigation', cur, alts) as string
    expect(text).toContain('irrigation requirement')
    expect(text).toContain(fmtMm(cur.hindcast.irrigation_mm_per_year))
    expect(text).not.toMatch(/consum|water use/i)
  })

  it('returns nothing when there is no alternative', () => {
    const { cur } = parts(chakwal)
    expect(measureSentence('water', cur, [])).toBeNull()
  })

  it('says so when the current rotation has the lowest value', () => {
    const { cur, alts } = parts(sheikhupura)
    const least = [cur, ...alts].sort((a, b) => a.hindcast.water_demand_mm_per_year - b.hindcast.water_demand_mm_per_year)[0]
    const others = [cur, ...alts].filter((r) => r !== least && r.hindcast.water_demand_mm_per_year - least.hindcast.water_demand_mm_per_year >= METRIC_BY_ID.water.similar)
    const text = measureSentence('water', least, others) as string
    expect(text).toContain('a higher modelled crop water demand')
    expect(text).toContain('Your current rotation has the lowest of the rotations shown.')
  })
})

describe('deltaNote and waterValuesSentence', () => {
  it('words a difference with its size and direction, or as about the same inside the similarity band', () => {
    const { cur, alts } = parts(sheikhupura)
    for (const r of alts) {
      const d = r.hindcast.water_demand_mm_per_year - cur.hindcast.water_demand_mm_per_year
      const note = deltaNote(waterTradeoff(r, cur, 'water'))
      if (Math.abs(d) < METRIC_BY_ID.water.similar) expect(note).toBe('About the same as current')
      else expect(note).toBe(`${Math.abs(d).toLocaleString('en-US')} mm ${d < 0 ? 'lower' : 'higher'} than current`)
    }
    expect(deltaNote(undefined)).toBe('')
  })

  it('states both water values, and leaves irrigation out when none was applied', () => {
    const irrigated = parts(sheikhupura)
    const a = waterValuesSentence(irrigated.alts[0], irrigated.cur, true) as string
    expect(a).toContain(`${fmtMm(irrigated.alts[0].hindcast.water_demand_mm_per_year)} a year against ${fmtMm(irrigated.cur.hindcast.water_demand_mm_per_year)}`)
    expect(a).toContain('irrigation requirement')
    const rainfed = parts(chakwal)
    const b = waterValuesSentence(rainfed.alts[0], rainfed.cur, false) as string
    expect(b).toContain('modelled crop water demand')
    expect(b).not.toContain('irrigation')
  })
})

describe('monthly rainfall against reference evapotranspiration', () => {
  it('needs twelve complete months', () => {
    expect(monthBalance(undefined)).toBeNull()
    expect(monthBalance(months([[10, 20]]))).toBeNull()
    expect(monthBalance(months(Array.from({ length: 12 }, () => [10, 20] as [number, number])))).toHaveLength(12)
  })

  it('compares the values as printed, so a tie in whole millimetres is not called an excess', () => {
    const rows = monthBalance(months(Array.from({ length: 12 }, (_, i) => (i === 3 ? [81.6, 82.4] : [50, 20]) as [number, number])))
    expect(rows?.[3].exceeds).toBe(false)
    expect(rows?.every((r) => !r.exceeds)).toBe(true)
  })

  it('joins December to January when grouping months', () => {
    expect(monthRuns([9, 10, 11, 12, 1, 2, 3, 4, 5, 6])).toEqual([[9, 10, 11, 12, 1, 2, 3, 4, 5, 6]])
    expect(monthRuns([1, 2, 6, 7, 12])).toEqual([[6, 7], [12, 1, 2]])
    expect(monthRuns([])).toEqual([])
    expect(monthRuns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toHaveLength(1)
  })

  it('writes the sentence the values support', () => {
    const wetSummer = months([[30, 60], [30, 60], [30, 60], [30, 60], [30, 200], [30, 60], [200, 150], [200, 150], [30, 60], [30, 60], [30, 60], [30, 60]])
    const some = monthlySentence(monthBalance(wetSummer) ?? [])
    expect(some).toContain('in 10 of 12 months (September to June)')
    expect(some).toContain('Rainfall matched or exceeded it in July and August.')
    expect(some).toContain('widest in May (200 mm against 30 mm of rain)')
    const always = monthlySentence(monthBalance(months(Array.from({ length: 12 }, () => [10, 90] as [number, number]))) ?? [])
    expect(always).toContain('in every month')
    const never = monthlySentence(monthBalance(months(Array.from({ length: 12 }, () => [90, 10] as [number, number]))) ?? [])
    expect(never).toContain('not above rainfall in any month')
    expect(never).not.toContain('widest')
  })

  it('compares the annual totals in the direction the numbers give', () => {
    expect(annualSentence(805, 1644)).toContain('demand for water was 839 mm higher')
    expect(annualSentence(1200, 900)).toContain('rainfall was 300 mm higher')
    expect(annualSentence(undefined, 900)).toBeNull()
  })
})
