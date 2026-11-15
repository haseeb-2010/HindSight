import { describe, expect, it } from 'vitest'
// The real saved engine outputs for the demonstration farms.
import chakwalJson from '../../../../backend/data/saved/chakwal_response.json'
import sheikhupuraJson from '../../../../backend/data/saved/sheikhupura_response.json'
import { rankedRotations } from '../../lib/analysis'
import type { AnalysisEnvelope, AnalysisResult, EngineRequest, Rotation } from '../../lib/types'
import { buildChecklist, LIMIT_TITLES, mergedSentences } from './checklist'

const chakwal = chakwalJson as unknown as AnalysisResult
const sheikhupura = sheikhupuraJson as unknown as AnalysisResult
const env = (result: AnalysisResult, request?: EngineRequest): AnalysisEnvelope => ({ source: 'saved', preset_id: null, result, request })
const leadsOf = (result: AnalysisResult) => rankedRotations(result).filter((r) => !r.is_current).slice(0, 3)
const names = { wheat: 'Wheat', peas: 'Field pea (dry)', groundnut: 'Groundnut', sorghum: 'Sorghum (grain/fodder)', cotton: 'Cotton', soybean: 'Soybean' }
const titles = Object.values(LIMIT_TITLES)
const engineSentences = (rotations: Rotation[]) => rotations.flatMap((r) => [...(r.explanation?.local_review ?? []), ...(r.explanation?.gaps ?? [])])

describe('buildChecklist', () => {
  it('lists a check for every topic the engine and the documented limits support, each with its basis', () => {
    const items = buildChecklist(env(chakwal, { water: { mode: 'rainfed' }, constraints: { market_rating: {} } }), leadsOf(chakwal), names, titles)
    expect(items.map((i) => i.id)).toEqual(['sowing', 'seed', 'market', 'pests', 'soil', 'rainfall', 'suitability', 'legume'])
    for (const item of items) expect(item.basis.length).toBeGreaterThan(0)
  })

  it('quotes engine sentences unchanged', () => {
    const leads = leadsOf(chakwal)
    const returned = new Set(engineSentences(leads))
    const quoted = buildChecklist(env(chakwal), leads, names, titles)
      .flatMap((i) => i.basis)
      .filter((b) => (b.kind === 'engine_review' || b.kind === 'engine_gap') && b.text.startsWith('“'))
    expect(quoted.length).toBeGreaterThan(0)
    for (const b of quoted) expect(returned.has(b.text.slice(1, -1))).toBe(true)
  })

  it('uses values of the run: sowing dates, new crops, market ratings, rank ranges', () => {
    const leads = leadsOf(chakwal)
    const items = Object.fromEntries(buildChecklist(env(chakwal, { constraints: { market_rating: { wheat: 4 } } }), leads, names, titles).map((i) => [i.id, i]))
    const facts = (id: string) => items[id].basis.filter((b) => b.kind === 'analysis').map((b) => b.text).join(' ')
    expect(facts('sowing')).toContain('Field pea (dry) sown 1 Nov')
    expect(facts('seed')).toContain('Field pea (dry)')
    expect(facts('seed')).not.toContain('Wheat,') // wheat is already in the current rotation
    expect(facts('market')).toContain('Wheat 4')
    const rain = leads[0].scores.rank_range_rain as [number, number]
    expect(facts('rainfall')).toContain(rain[0] === rain[1] ? `stayed at #${rain[0]}` : `ranged from #${rain[0]} to #${rain[1]}`)
  })

  it('adds the irrigation check only for an irrigated run', () => {
    const rainfed = buildChecklist(env(chakwal, { water: { mode: 'rainfed' } }), leadsOf(chakwal), names, titles)
    const irrigated = buildChecklist(env(sheikhupura, { water: { mode: 'full' } }), leadsOf(sheikhupura), names, titles)
    expect(rainfed.some((i) => i.id === 'irrigation')).toBe(false)
    const item = irrigated.find((i) => i.id === 'irrigation')
    expect(item).toBeDefined()
    expect(item?.basis.some((b) => b.kind === 'analysis' && /mm/.test(b.text))).toBe(true)
  })

  it('keeps a sentence it does not recognise as its own check', () => {
    const lead = structuredClone(leadsOf(chakwal)[0])
    lead.explanation = { summary: '', local_review: ['Talk to your neighbours about storage.'], gaps: ['Storage losses are not in the model.'] }
    const items = buildChecklist(env(chakwal), [lead], names, titles)
    expect(items.some((i) => i.check === 'Talk to your neighbours about storage.')).toBe(true)
    expect(items.some((i) => i.check.endsWith('Storage losses are not in the model.'))).toBe(true)
  })

  it('does not cite a documented limit that is not in the list it is given', () => {
    const items = buildChecklist(env(chakwal), leadsOf(chakwal), names, [])
    expect(items.flatMap((i) => i.basis).some((b) => b.kind === 'model_limit')).toBe(false)
  })

  it('gives no engine-based check when the engine returned no explanation', () => {
    const lead = structuredClone(leadsOf(chakwal)[0])
    delete lead.explanation
    const ids = buildChecklist(env(chakwal), [lead], names, titles).map((i) => i.id)
    expect(ids).not.toContain('sowing')
    expect(ids).not.toContain('seed')
    expect(ids).not.toContain('market')
    expect(ids).not.toContain('legume')
  })
})

describe('mergedSentences', () => {
  it('removes repeats and names the rotations a sentence applies to when not all', () => {
    const all = rankedRotations(chakwal)
    const gaps = mergedSentences(all, (r) => r.explanation?.gaps)
    expect(new Set(gaps.map((g) => g.text)).size).toBe(gaps.length)
    expect(gaps.find((g) => /Pests/.test(g.text))?.scope).toBeNull()
    const legume = gaps.find((g) => /legume effect/.test(g.text))
    if (legume && all.some((r) => !(r.explanation?.gaps ?? []).includes(legume.text))) expect(legume.scope).not.toBeNull()
  })

  it('shows a sentence that differs only in its figures once', () => {
    const all = rankedRotations(chakwal)
    const every = mergedSentences(all, (r) => r.explanation?.evidence)
    const once = mergedSentences(all, (r) => r.explanation?.evidence, true)
    expect(every.filter((s) => /Heavy-rain days/.test(s.text)).length).toBeGreaterThan(1)
    expect(once.filter((s) => /Heavy-rain days/.test(s.text)).length).toBe(1)
  })
})
