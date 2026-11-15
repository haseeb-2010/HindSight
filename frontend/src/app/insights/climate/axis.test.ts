import { describe, expect, it } from 'vitest'
import { meanDigits, niceAxis, signed, withUnit } from './axis'

describe('niceAxis', () => {
  it('starts at zero and ends on a round value at or above the data', () => {
    for (const max of [0.6, 1, 4, 22.6, 42, 168, 196, 372, 957.7, 1934.1, 2015.9]) {
      const a = niceAxis(max)
      expect(a.ticks[0]).toBe(0)
      expect(a.max).toBeGreaterThanOrEqual(max)
      expect(a.ticks[a.ticks.length - 1]).toBe(a.max)
      expect(a.ticks.length).toBeGreaterThanOrEqual(2)
      expect(a.ticks.length).toBeLessThanOrEqual(7)
    }
  })

  it('keeps whole steps for day counts', () => {
    expect(niceAxis(4, true).ticks).toEqual([0, 1, 2, 3, 4])
    expect(niceAxis(1, true).ticks).toEqual([0, 1])
    expect(niceAxis(9, true).ticks.every(Number.isInteger)).toBe(true)
  })

  it('gives a usable axis when every value is zero', () => {
    expect(niceAxis(0, true)).toEqual({ max: 1, ticks: [0, 1], digits: 0 })
  })
})

describe('value formatting', () => {
  it('prints the unit, singular for one day', () => {
    expect(withUnit(1934.1, 'mm')).toBe('1,934 mm')
    expect(withUnit(1, 'days')).toBe('1 day')
    expect(withUnit(0.6, 'days', 1)).toBe('0.6 days')
    expect(withUnit(null, 'days')).toBe('—')
  })

  it('signs a change with a real minus and no sign for zero', () => {
    expect(signed(9.2, 'days', 1)).toBe('+9.2 days')
    expect(signed(-192.3, 'mm')).toBe('−192 mm')
    expect(signed(-0, 'days', 1)).toBe('0.0 days')
    expect(signed(-0.04, 'days', 1)).toBe('0.0 days')
    expect(signed(null, 'mm')).toBe('—')
  })

  it('matches the decimals used in the sentences', () => {
    expect(meanDigits('mm')).toBe(0)
    expect(meanDigits('days')).toBe(1)
  })
})
