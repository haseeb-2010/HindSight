// Starting points for the seven ranking weights (0–5). They are preference templates for a farmer
// to adjust, not scientifically optimal settings. "Balanced" is the application's own default set,
// read from the API (scripts/run_site.py PRIORITIES), so it is not repeated here.
import { PRIORITY_ORDER } from './labels'

export interface PriorityTemplate {
  id: 'balanced' | 'water' | 'soil' | 'stable'
  label: string
  summary: string
  /** Full set of weights, or null for the application defaults. */
  weights: Record<string, number> | null
}

export const PRIORITY_TEMPLATES: PriorityTemplate[] = [
  {
    id: 'balanced',
    label: 'Balanced approach',
    summary: 'HindSight’s default weights: stability first, then water, nitrogen and market, with soil cover and forage lower.',
    weights: null,
  },
  {
    id: 'water',
    label: 'Water-conscious',
    summary: 'Puts water conservation and stability in weak years first. Suits fields where water is the binding limit.',
    weights: { stability: 5, water_use: 5, forage: 1, nitrogen: 2, erosion: 2, organic_matter: 2, market: 2 },
  },
  {
    id: 'soil',
    label: 'Soil-building focus',
    summary: 'Puts the soil-care proxies first: legume share, cover in heavy rain, and residue and cover.',
    weights: { stability: 3, water_use: 2, forage: 1, nitrogen: 5, erosion: 5, organic_matter: 5, market: 2 },
  },
  {
    id: 'stable',
    label: 'Stable production',
    summary: 'Puts the lower-decile season index far ahead of everything else, to favour rotations that held up in weak years.',
    weights: { stability: 5, water_use: 2, forage: 1, nitrogen: 2, erosion: 2, organic_matter: 2, market: 3 },
  },
]

/** The seven weights a template sets, given the application defaults. */
export function templateWeights(t: PriorityTemplate, defaults: Record<string, number>): Record<string, number> {
  return Object.fromEntries(PRIORITY_ORDER.map((k) => [k, (t.weights ?? defaults)[k] ?? defaults[k] ?? 0]))
}

/** The template whose weights equal the given full set, if any. */
export function matchingTemplate(weights: Record<string, number>, defaults: Record<string, number>): PriorityTemplate | null {
  return PRIORITY_TEMPLATES.find((t) => {
    const w = templateWeights(t, defaults)
    return PRIORITY_ORDER.every((k) => (weights[k] ?? defaults[k] ?? 0) === w[k])
  }) ?? null
}

/** "Stability 4 · Water 3 · …" for history cards and exported reports. */
export function priorityList(weights: Record<string, number> | undefined | null, labels: Record<string, { short: string }>): string {
  if (!weights) return ''
  return PRIORITY_ORDER.filter((k) => typeof weights[k] === 'number')
    .map((k) => `${labels[k]?.short ?? k} ${weights[k]}`)
    .join(' · ')
}
