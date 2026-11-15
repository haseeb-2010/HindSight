import { describe, expect, it } from 'vitest'
import { EMPTY_CONFIG, signatureOf, toRequest } from './config'
import { daysInMonth, doyLabel, fromDoy, toDoy } from './doy'

describe('sowing date <-> plant_doy (365-day engine calendar)', () => {
  it('matches the demonstration farms', () => {
    expect(toDoy(11, 1)).toBe(305) // Chakwal wheat
    expect(toDoy(5, 1)).toBe(121) // Sheikhupura cotton
    expect(toDoy(11, 20)).toBe(324) // Sheikhupura wheat
    expect(toDoy(5, 5)).toBe(125) // Ames maize
    expect(doyLabel(305)).toBe('1 Nov')
  })
  it('round-trips every day of the year and has no 29 February', () => {
    for (let d = 1; d <= 365; d++) {
      const { month, day } = fromDoy(d)
      expect(toDoy(month, day)).toBe(d)
    }
    expect(daysInMonth(2)).toBe(28)
    expect(toDoy(2, 31)).toBe(59)
    expect(toDoy(12, 31)).toBe(365)
  })
})

describe('request builder', () => {
  const located = { ...EMPTY_CONFIG, location: { lat: 31.42, lon: 73.08, name: ' My field ', preset_id: null } }
  it('returns null without a valid location', () => {
    expect(toRequest(EMPTY_CONFIG, {})).toBeNull()
    expect(toRequest({ ...located, location: { ...located.location, lat: 95 } }, {})).toBeNull()
  })
  it('sends the irrigation cap only for limited irrigation and merges default priorities', () => {
    const defaults = { stability: 4, water_use: 3 }
    const rainfed = toRequest({ ...located, priorities: { water_use: 5 } }, defaults)!
    expect(rainfed.water).toEqual({ mode: 'rainfed', seasonal_cap_mm: null })
    expect(rainfed.priorities).toEqual({ stability: 4, water_use: 5 })
    expect(rainfed.location.name).toBe('My field')
    const limited = toRequest({ ...located, water: { mode: 'limited', seasonal_cap_mm: 150 } }, defaults)!
    expect(limited.water).toEqual({ mode: 'limited', seasonal_cap_mm: 150 })
  })
  it('gives the same signature for the same settings and a different one after a change', () => {
    const a = signatureOf(toRequest(located, {}))
    expect(signatureOf(toRequest({ ...located }, {}))).toBe(a)
    expect(signatureOf(toRequest({ ...located, scenario: { temp_delta_c: 1, precip_factor: 1 } }, {}))).not.toBe(a)
  })
})
