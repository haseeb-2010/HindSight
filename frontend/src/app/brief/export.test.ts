import { describe, expect, it } from 'vitest'
import chakwalJson from '../../../../backend/data/saved/chakwal_response.json'
import type { AnalysisEnvelope, AnalysisResult } from '../../lib/types'
import { analysisDateOf, analysisIdOf, comparisonCsv, comparisonNotes, fileStem } from '../lib/export'

const result = chakwalJson as unknown as AnalysisResult
const full: AnalysisEnvelope = {
  source: 'live',
  preset_id: 'chakwal',
  analysis_id: 'ab12cd34ef56',
  computed_at: '2026-11-15T13:49:13Z',
  request: {
    location: { lat: 32.93, lon: 72.86 },
    water: { mode: 'limited', seasonal_cap_mm: 150 },
    priorities: { stability: 4, water_use: 3, forage: 1, nitrogen: 3, erosion: 2, organic_matter: 2, market: 3 },
    scenario: { temp_delta_c: 0, precip_factor: 1 },
  },
  result,
}
const note = (env: AnalysisEnvelope, start: string, meta?: { id?: string; at?: string }) => comparisonNotes(env, meta).find((n) => n.startsWith(start)) ?? ''

describe('comparison CSV', () => {
  it('says exactly which run the file came from', () => {
    expect(note(full, '# Analysis identifier')).toBe('# Analysis identifier: ab12cd34ef56')
    expect(note(full, '# Analysis date')).toContain('2026-11-15T13:49:13Z')
    expect(note(full, '# Coordinates')).toBe(`# Coordinates: ${Math.abs(result.site.lat).toFixed(4)} N, ${Math.abs(result.site.lon).toFixed(4)} E`)
    expect(note(full, '# Water mode')).toBe('# Water mode: Limited irrigation (150 mm per season)')
    expect(note(full, '# Priority weights')).toBe(
      '# Priority weights (0-5): Stability 4; Water conservation 3; Forage potential 1; Nitrogen contribution 3; Erosion exposure reduction 2; Organic matter contribution potential 2; Market suitability 3',
    )
    expect(note(full, '# Scenario')).toBe('# Scenario: historical baseline (no adjustment)')
  })

  it('names a what-if scenario as hypothetical, never as a forecast of its own', () => {
    const env = { ...full, request: { ...full.request, scenario: { temp_delta_c: 2, precip_factor: 0.8 } } }
    expect(note(env, '# Scenario')).toBe('# Scenario: hypothetical what-if adjustment to the historical record (temperature +2.0 °C, rainfall 80%); not a forecast')
  })

  it('says "not recorded" instead of inventing what an older saved analysis lacks', () => {
    const bare: AnalysisEnvelope = { source: 'saved', preset_id: 'chakwal', result }
    expect(note(bare, '# Analysis identifier')).toBe('# Analysis identifier: not recorded')
    expect(note(bare, '# Analysis date')).toBe('# Analysis date: not recorded')
    expect(note(bare, '# Water mode')).toBe('# Water mode: not recorded')
    expect(note(bare, '# Priority weights')).toBe('# Priority weights (0-5): not recorded')
    expect(note(bare, '# Scenario')).toBe('# Scenario: not recorded')
    expect(comparisonNotes(bare).some((n) => n.includes('saved demonstration result'))).toBe(true)
  })

  it('falls back to the identity the analysis has in My Analyses', () => {
    const bare: AnalysisEnvelope = { source: 'saved', preset_id: 'chakwal', result }
    const meta = { id: 'local-xyz', at: '2026-11-15T10:00:00.000Z' }
    expect(analysisIdOf(bare, meta)).toBe('local-xyz')
    expect(analysisDateOf(bare, meta)).toEqual({ iso: meta.at, kind: 'saved' })
    expect(note(bare, '# Analysis date', meta)).toContain('saved on this device')
    expect(analysisIdOf(full, meta)).toBe('ab12cd34ef56') // the engine's own identifier wins
  })

  it('keeps one row per rotation under the header and quotes notes that contain a comma', () => {
    const lines = comparisonCsv(full).split('\r\n').filter(Boolean)
    const notes = comparisonNotes(full).length
    expect(lines.length).toBe(notes + 1 + result.rotations.length)
    expect(lines[notes].startsWith('rank,rotation,is_current')).toBe(true)
    expect(lines.slice(0, notes).every((l) => l.startsWith('#') || l.startsWith('"#'))).toBe(true)
    expect(lines.find((l) => l.includes('Coordinates'))?.startsWith('"# Coordinates')).toBe(true)
    const ranks = lines.slice(notes + 1).map((l) => Number(l.split(',')[0]))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('writes rank ranges in a form a spreadsheet will not turn into a date', () => {
    const csv = comparisonCsv(full)
    expect(csv).toMatch(/,\d+ to \d+,/)
    expect(csv).not.toMatch(/,\d+-\d+,/)
  })
})

describe('fileStem', () => {
  it('carries the field name and the start of the run identifier', () => {
    expect(fileStem(full)).toBe('hindsight-chakwal-rainfed-pothwar-ab12cd34')
    expect(fileStem({ source: 'saved', preset_id: null, result })).toBe('hindsight-chakwal-rainfed-pothwar')
  })
})
