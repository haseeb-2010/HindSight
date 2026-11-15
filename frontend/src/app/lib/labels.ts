// Farmer-facing words for engine identifiers. Descriptions follow docs/METHODOLOGY.md.

export const TEXTURES: Record<string, { label: string; hint: string }> = {
  sand: { label: 'Sand', hint: 'Loose and gritty; drains very fast' },
  loamy_sand: { label: 'Loamy sand', hint: 'Mostly sand with a little fine material' },
  sandy_loam: { label: 'Sandy loam', hint: 'Gritty but holds together when moist' },
  loam: { label: 'Loam', hint: 'Balanced mix; crumbly, easy to work' },
  silt_loam: { label: 'Silt loam', hint: 'Smooth and floury; holds water well' },
  silt: { label: 'Silt', hint: 'Very smooth, like flour' },
  sandy_clay_loam: { label: 'Sandy clay loam', hint: 'Gritty and sticky together' },
  clay_loam: { label: 'Clay loam', hint: 'Firm; forms a ribbon when squeezed' },
  silty_clay_loam: { label: 'Silty clay loam', hint: 'Smooth and sticky' },
  sandy_clay: { label: 'Sandy clay', hint: 'Sticky clay with a gritty feel' },
  silty_clay: { label: 'Silty clay', hint: 'Smooth, heavy and sticky' },
  clay: { label: 'Clay', hint: 'Heavy and sticky; cracks when dry' },
}

export const textureLabel = (id: string | null | undefined) =>
  (id && TEXTURES[id]?.label) || (id ? id.replace(/_/g, ' ') : 'Unknown')

export const OM_LEVELS: Record<string, { label: string; hint: string }> = {
  low: { label: 'Low', hint: 'Pale soil, little residue returned' },
  medium: { label: 'Medium', hint: 'Some residue or manure most years' },
  high: { label: 'High', hint: 'Dark soil, regular manure or cover' },
}

export const WATER_MODES: Record<string, { label: string; short: string; description: string }> = {
  rainfed: { label: 'Rainfed', short: 'Rainfed', description: 'Your crops depend primarily on rainfall stored in the soil.' },
  full: {
    label: 'Full irrigation',
    short: 'Irrigated',
    description: 'The model supplies the root-zone depletion whenever the irrigation threshold is exceeded.',
  },
  limited: { label: 'Limited irrigation', short: 'Limited irrigation', description: 'You have a limited irrigation allowance for each crop season.' },
}

export function waterLabel(mode: string | undefined | null, cap?: number | null): string {
  if (mode === 'limited') return cap ? `Limited irrigation (${cap} mm per season)` : 'Limited irrigation'
  return (mode && WATER_MODES[mode]?.label) || 'Unknown'
}

export const PRIORITY_ORDER = ['stability', 'water_use', 'forage', 'nitrogen', 'erosion', 'organic_matter', 'market'] as const

export const PRIORITIES: Record<string, { label: string; short: string; explain: string }> = {
  stability: {
    label: 'Stability',
    short: 'Stability',
    explain: 'Favours rotations that hold up in weaker years. Based on the lower-decile season index: the level that only 1 year in 10 fell below.',
  },
  water_use: {
    label: 'Water conservation',
    short: 'Water',
    explain: 'Favours rotations with lower modelled crop water demand over the year.',
  },
  forage: {
    label: 'Forage potential',
    short: 'Forage',
    explain: 'Favours rotations with a larger share of forage or dual-purpose crops.',
  },
  nitrogen: {
    label: 'Nitrogen contribution',
    short: 'Nitrogen',
    explain: 'Uses the share of legumes in the rotation as an indicator of potential nitrogen contribution. It is not a measured nitrogen balance.',
  },
  erosion: {
    label: 'Erosion exposure reduction',
    short: 'Erosion',
    explain: 'Favours rotations that leave less bare soil on heavy-rain days. An exposure indicator, not a soil-loss estimate.',
  },
  organic_matter: {
    label: 'Organic matter contribution potential',
    short: 'Organic matter',
    explain: 'Uses ground cover and crop-residue class as proxies. It is not an observed change in soil organic carbon.',
  },
  market: {
    label: 'Market suitability',
    short: 'Market',
    explain: 'Uses the market ratings you give each crop. Crops you do not rate use the engine’s default rating.',
  },
}

export const CROP_GROUPS: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  cereal: { label: 'Cereal', bg: 'bg-sand', text: 'text-forest-950', dot: '#33594a' },
  legume: { label: 'Legume', bg: 'bg-lime-100', text: 'text-forest-950', dot: '#8a9a1f' },
  forage: { label: 'Forage / dual-purpose', bg: 'bg-peri-50', text: 'text-forest-950', dot: '#5b6bb5' },
  other: { label: 'Other crop', bg: 'bg-white', text: 'text-forest-950', dot: '#d9530e' },
}

export function cropGroup(c: { group?: string | null; is_legume?: boolean; is_forage?: boolean } | undefined): keyof typeof CROP_GROUPS {
  if (!c) return 'other'
  if (c.is_legume) return 'legume'
  if (c.is_forage) return 'forage'
  if (c.group === 'cereal') return 'cereal'
  return 'other'
}

export const LIMIT_WORDS: Record<string, string> = {
  water: 'Water (dry spells)',
  temperature: 'Temperature outside the crop’s range',
  frost: 'Frost',
  none: 'No single limiting factor',
}

export const PROVENANCE_KINDS: Record<string, { label: string; tone: string }> = {
  reanalysis_estimate: { label: 'NASA / reanalysis estimate', tone: 'bg-peri-50 text-forest-950 ring-peri' },
  satellite_estimate: { label: 'Satellite-derived estimate', tone: 'bg-peri-50 text-forest-950 ring-peri' },
  farmer_input: { label: 'Farmer input', tone: 'bg-lime-100 text-forest-950 ring-forest-950/10' },
  model_output: { label: 'Model output', tone: 'bg-sand text-forest-950 ring-sand-400' },
  literature_parameter: { label: 'Literature parameter', tone: 'bg-white text-forest-950 ring-sand-400' },
  scenario: { label: 'What-if scenario', tone: 'bg-signal-50 text-signal-ink ring-signal/30' },
}

export const SOIL_SOURCES: Record<string, string> = {
  farmer: 'Entered by the farmer',
  soilgrids: 'SoilGrids — 250 m soil data',
  default: 'Engine default (no soil information given)',
}
