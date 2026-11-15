// The "verify locally" checklist of the Decision Brief.
//
// Nothing here is advice the engine did not give. A check is listed only when it follows from
//   - an item of the engine's own local-review list (explanation.local_review),
//   - an information gap the engine reported (explanation.gaps),
//   - a documented model limitation (LIMITS, shown in full in section 5 of the brief), or
//   - a value returned for this run (sowing dates, soil source, irrigation, rank ranges).
// and every check names which of these it rests on. Engine sentences are quoted unchanged.
// Engine sentences are sorted into topics by the words they contain; a sentence no topic
// recognises is still listed, as its own check, so nothing the engine returned is dropped.
import { currentRotation, isIrrigated, rotationLabel } from '../../lib/analysis'
import { fmtMm, fmtNum, isNum } from '../../lib/format'
import type { AnalysisEnvelope, Rotation } from '../../lib/types'
import { doyLabel } from '../lib/doy'
import { joinList, rankSpread } from '../lib/insights'
import { LIMIT_WORDS, SOIL_SOURCES, textureLabel } from '../lib/labels'

export type BasisKind = 'engine_review' | 'engine_gap' | 'model_limit' | 'analysis'

export const BASIS_LABELS: Record<BasisKind, string> = {
  engine_review: 'Engine local-review item',
  engine_gap: 'Engine information gap',
  model_limit: 'Documented model limitation',
  analysis: 'From this analysis',
}

export interface Basis {
  kind: BasisKind
  text: string
}

export interface CheckItem {
  id: string
  /** The practical check, as an instruction. */
  check: string
  /** What the check rests on. Never empty. */
  basis: Basis[]
}

/** Titles of the documented limitations (results/ProvenanceTab.tsx LIMITS) a check can cite. */
export const LIMIT_TITLES = {
  weather: 'Weather is a grid-cell estimate',
  soil: 'Soil information is optional and approximate',
  assumptions: 'Assumptions built into the model',
  leftOut: 'What the model leaves out',
}

const rangeWords = (r: [number, number]) => (r[0] === r[1] ? `stayed at #${r[0]}` : `ranged from #${r[0]} to #${r[1]}`)

/** Unique sentences in first-seen order, each with the rotations it was returned for. */
function collect(rotations: Rotation[], pick: (r: Rotation) => string[] | undefined): { text: string; from: Rotation[] }[] {
  const out = new Map<string, Rotation[]>()
  for (const r of rotations) {
    for (const raw of pick(r) ?? []) {
      const text = raw.trim()
      if (!text) continue
      out.set(text, [...(out.get(text) ?? []), r])
    }
  }
  return [...out].map(([text, from]) => ({ text, from }))
}

/**
 * Builds the checklist for the rotations the brief leads with (`leads`: the highest-ranked
 * alternatives or, when there are none, the current rotation).
 * `limitTitles` are the titles of the documented limitations that exist, so a renamed one is not cited.
 */
export function buildChecklist(env: AnalysisEnvelope, leads: Rotation[], names: Record<string, string>, limitTitles: string[]): CheckItem[] {
  const res = env.result
  const req = env.request
  const cur = currentRotation(res)
  const top = leads[0]
  const crop = (id: string) => names[id] ?? id
  const reviews = collect(leads, (r) => r.explanation?.local_review)
  const gaps = collect(leads, (r) => r.explanation?.gaps)
  const used = new Set<string>()

  const quote = (kind: BasisKind, pool: { text: string }[], pattern: RegExp): Basis[] =>
    pool
      .filter((s) => pattern.test(s.text))
      .map((s) => {
        used.add(s.text)
        return { kind, text: `“${s.text}”` }
      })
  const limit = (title: string): Basis[] => (limitTitles.includes(title) ? [{ kind: 'model_limit', text: `“${title}” (set out in section 5).` }] : [])
  const fact = (text: string | null | false | undefined): Basis[] => (text ? [{ kind: 'analysis', text }] : [])

  const items: CheckItem[] = []
  const add = (id: string, check: string, basis: Basis[]) => {
    if (basis.length) items.push({ id, check, basis })
  }

  // Sowing dates and varieties
  const sowing = leads
    .filter((r) => r.slots.length > 0)
    .map((r) => `${rotationLabel(r)}: ${r.slots.map((s) => `${crop(s.crop_id)} sown ${doyLabel(s.plant_doy)}${r.cycle_years > 1 ? ` (year ${s.year_offset + 1})` : ''}`).join(', ')}`)
  const sowingEngine = [...quote('engine_review', reviews, /sow|plant|variet/i), ...quote('engine_gap', gaps, /variet|sowing/i)]
  add('sowing', 'Verify the sowing dates and the varieties with your local extension office or agronomist.', [
    ...sowingEngine,
    ...(sowingEngine.length ? fact(sowing.length ? `Sowing dates the simulation used. ${sowing.join('. ')}.` : null) : []),
  ])

  // Seed
  const curCrops = new Set((cur?.slots ?? []).map((s) => s.crop_id))
  const newCrops = [...new Set(leads.filter((r) => !r.is_current).flatMap((r) => r.slots.map((s) => s.crop_id)))].filter((id) => !curCrops.has(id))
  const seedEngine = quote('engine_review', reviews, /seed/i)
  add('seed', 'Confirm that seed for each crop is available locally and in time for sowing.', [
    ...seedEngine,
    ...(seedEngine.length && newCrops.length ? fact(`Crops in the leading alternatives that are not in the current rotation: ${joinList(newCrops.map(crop))}.`) : []),
  ])

  // Market
  const marketEngine = quote('engine_review', reviews, /sell|market|buyer|price/i)
  const ratings = Object.entries(req?.constraints?.market_rating ?? {})
  add('market', 'Confirm local market demand for each crop before changing the rotation.', [
    ...marketEngine,
    ...(marketEngine.length && req?.constraints
      ? fact(
          ratings.length
            ? `Market ratings entered for this run: ${ratings.map(([id, v]) => `${crop(id)} ${v}`).join(', ')}. Crops without a rating used the engine’s default.`
            : 'No market rating was entered for any crop in this run, so the market priority used the engine’s default rating for every crop.',
        )
      : []),
  ])

  // Pests and disease
  add('pests', 'Check pest and disease rotation requirements: which of these crops should not follow each other on your land.', [
    ...quote('engine_review', reviews, /pest|disease/i),
    ...quote('engine_gap', gaps, /pest|disease/i),
    ...limit(LIMIT_TITLES.leftOut),
  ])

  // Soil
  const soil = res.site.soil_used
  add('soil', 'Verify soil texture, depth and water-holding capacity with a local soil test.', [
    ...quote('engine_gap', gaps, /soil/i),
    ...fact(
      soil
        ? `This run used a ${textureLabel(soil.texture_class).toLowerCase()} soil${isNum(req?.soil?.depth_cm) ? `, ${req.soil.depth_cm} cm deep` : ''}. Source: ${
            SOIL_SOURCES[soil.source ?? ''] ?? 'not recorded'
          }.${isNum(soil.available_water_mm_per_m) ? ` Available water was estimated at ${fmtNum(soil.available_water_mm_per_m)} mm per metre, not measured.` : ''}`
        : null,
    ),
    ...limit(LIMIT_TITLES.soil),
  ])

  // Rainfall and weather
  const rain = top?.scores?.rank_range_rain
  add('rainfall', 'Compare the rainfall and temperature figures in this brief with records from a nearby weather station.', [
    ...quote('engine_gap', gaps, /\brain|weather|grid/i),
    ...fact(rain && top ? `In the engine’s rainfall test (30% lower and 30% higher), the rank of ${rotationLabel(top)} ${rangeWords(rain)}. ${rankSpread(rain)?.explain ?? ''}`.trim() : null),
    ...limit(LIMIT_TITLES.weather),
  ])

  // Irrigation
  if (isIrrigated(env)) {
    const amounts = [cur, ...leads.filter((r) => !r.is_current)]
      .filter((r): r is Rotation => !!r && isNum(r.hindcast.irrigation_mm_per_year))
      .slice(0, 4)
      .map((r) => `${rotationLabel(r)}${r.is_current ? ' (current)' : ''} ${fmtMm(r.hindcast.irrigation_mm_per_year)}`)
    add('irrigation', 'Consult a local agronomist or irrigation adviser about whether this much water is available when the crops need it.', [
      ...quote('engine_gap', gaps, /irrigat/i),
      ...fact(amounts.length ? `Irrigation the simulation applied per year: ${amounts.join('; ')}. These are modelled amounts, not measured farm water use.` : null),
      ...limit(LIMIT_TITLES.assumptions),
    ])
  }

  // Crop suitability
  const limited = [
    ...new Map(
      leads
        .flatMap((r) => r.hindcast.by_slot ?? [])
        .filter((s) => s.main_limit && s.main_limit !== 'none')
        .map((s) => [`${s.crop_id}|${s.main_limit}`, s] as const),
    ).values(),
  ]
  const suitEngine = quote('engine_gap', gaps, /generic|variet|FAO/i)
  add('suitability', 'Consult a local agronomist about whether these crops and varieties suit your field.', [
    ...suitEngine,
    ...fact(
      limited.length
        ? `Main limiting factor the simulation found: ${limited.map((s) => `${crop(s.crop_id)}: ${(LIMIT_WORDS[s.main_limit] ?? s.main_limit).toLowerCase()}`).join('; ')}.`
        : null,
    ),
    ...(suitEngine.length || limited.length ? limit(LIMIT_TITLES.assumptions) : []),
  ])

  // Legume effect
  const legumeEngine = quote('engine_gap', gaps, /legume/i)
  const legumeLead = leads.find((r) => r.indicators.legume_share > 0 && r.scores?.rank_range)
  add('legume', 'Ask about local results for a legume grown before the next crop: the size of that benefit is uncertain.', [
    ...legumeEngine,
    ...(legumeEngine.length && legumeLead?.scores?.rank_range
      ? fact(`Across the engine’s legume-effect test (0%, 7%, 20% and 32%), the rank of ${rotationLabel(legumeLead)} ${rangeWords(legumeLead.scores.rank_range)}.`)
      : []),
  ])

  // Anything the engine returned that no topic above recognised
  const who = (from: Rotation[]) => (from.length === leads.length ? 'every rotation this brief leads with' : joinList(from.map(rotationLabel)))
  reviews
    .filter((s) => !used.has(s.text))
    .forEach((s, i) => add(`review-${i}`, s.text, [{ kind: 'engine_review', text: `Returned by the engine for ${who(s.from)}.` }]))
  gaps
    .filter((s) => !used.has(s.text))
    .forEach((s, i) => add(`gap-${i}`, `Review with someone who knows your land: ${s.text}`, [{ kind: 'engine_gap', text: `Returned by the engine for ${who(s.from)}.` }]))

  return items
}

/**
 * Engine sentences from several rotations without repeats, each marked with the rotations it applies to when not all.
 * With `oneFigureEach`, sentences that differ only in their numbers are shown once, for the first rotation that has them.
 */
export function mergedSentences(rotations: Rotation[], pick: (r: Rotation) => string[] | undefined, oneFigureEach = false): { text: string; scope: string | null }[] {
  const seen = new Set<string>()
  return collect(rotations, pick)
    .filter((s) => {
      if (!oneFigureEach) return true
      const shape = s.text.replace(/\d+(?:[.,]\d+)*/g, '#')
      if (seen.has(shape)) return false
      seen.add(shape)
      return true
    })
    .map((s) => ({ text: s.text, scope: s.from.length === rotations.length ? null : joinList(s.from.map((r) => (r.is_current ? 'the current rotation' : rotationLabel(r)))) }))
}
