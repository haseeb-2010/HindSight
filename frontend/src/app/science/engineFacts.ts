// Method constants quoted on the Science page. Each value is copied from the engine source named
// beside it, so the page states what the code does. They describe the method; none is an analysis result.

export const ENGINE = {
  /** backend/engine/rotation.py: YEAR0, Y_START, Y_END */
  spinUpYear: 1984,
  recordStart: 1985,
  recordEnd: 2024,
  /** backend/engine/__init__.py: WINDOWS */
  windows: { early: [1985, 2004] as [number, number], late: [2005, 2024] as [number, number] },
  /** backend/engine/trends.py and rotation.py EROSIVE_MM */
  hotDayC: 35,
  frostDayC: 0,
  heavyRainMm: 12.7,
  /** backend/engine/rotation.py LEGUME_EFFECT and the variants re-ranked in __init__.py */
  legumeEffectPct: 20,
  legumeVariantsPct: [0, 7, 20, 32],
  /** backend/engine/__init__.py: rainfall multipliers 0.7 and 1.3 */
  rainVariantPct: 30,
  /** backend/engine/__init__.py: option defaults */
  failureLine: 0.5,
  topN: 5,
  worstYears: 5,
  ndviMinYears: 8,
  /** backend/engine/candidates.py */
  maxCandidates: 25,
  fillMinGapDays: 75,
  fillSpareDays: 15,
  fillStartOffsetDays: 7,
  minTemperatureFit: 0.5,
  /** backend/engine/season.py FALLOW */
  fallowKc: 0.2,
  fallowRootM: 0.3,
  /** backend/engine/season.py root_curve */
  rootStartM: 0.3,
  /** backend/engine/soil.py OM_LEVELS and defaults */
  organicMatterPct: { low: 0.7, medium: 1.5, high: 3.0 },
  defaultDepthCm: 100,
  /** backend/engine/climate.py: wind floor and humidity clip before ET0 */
  minWindMs: 0.5,
  /** backend/engine/__init__.py: market.get(crop, 2) */
  defaultMarketRating: 2,
}

/** The wheat entry of backend/data/crops.json, used to draw the two example curves to scale. */
export const EXAMPLE_CROP = {
  name: 'Wheat',
  stageDays: [20, 50, 60, 30] as [number, number, number, number],
  kc: { ini: 0.3, mid: 1.15, end: 0.25 },
  tempC: { min: 5, optMin: 15, optMax: 23, max: 27 },
  pDepletion: 0.55,
}

export const SECTIONS = [
  { id: 'data', letter: 'A', label: 'Data collection' },
  { id: 'processing', letter: 'B', label: 'Data processing' },
  { id: 'climate', letter: 'C', label: 'Climate analysis' },
  { id: 'simulation', letter: 'D', label: 'Crop-water simulation' },
  { id: 'rotations', letter: 'E', label: 'Rotation assessment' },
  { id: 'explanation', letter: 'F', label: 'Explanation and decision support' },
  { id: 'limitations', letter: 'G', label: 'Limitations' },
  { id: 'references', letter: 'H', label: 'Technical details and references' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']
