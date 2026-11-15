// The five soil-care proxies the engine reports for a rotation (backend/engine/rotation.py, structure()
// and hindcast()), and how one rotation is compared with another on them. Values are read unchanged.
//
// Soil cover, legume share and heavy-rain exposure use the shared rules in ../../lib/insights (METRICS):
// the same "about the same" margins and the same direction. The crop-residue class and the same-family
// count are not covered there, so they are compared exactly as reported, with no margin.
import { CloudRain, Layers, Repeat, Sprout, Wheat, type LucideIcon } from 'lucide-react'
import { isNum } from '../../../lib/format'
import type { Rotation } from '../../../lib/types'
import { METRIC_BY_ID, fmtMetric, fmtMetricDelta, tradeoffs } from '../../lib/insights'

export type ProxyId = 'cover' | 'legume' | 'residue' | 'erosion' | 'family'

/** "more" means the difference points the way the soil-care scoring rewards (or, for the same-family count, towards fewer repeats). */
export type Shift = 'more' | 'less' | 'same' | 'unknown'

export interface SoilProxy {
  id: ProxyId
  /** Name of the proxy, worded as a proxy or indicator. */
  title: string
  /** A second line under the title, where the policy name differs from the engine's field. */
  subtitle?: string
  icon: LucideIcon
  /** What the number counts, completing "<value> …". */
  caption: string
  tip: string
  /** Whether the ranking scores it, and under which priority. Null when it is reported only. */
  priority: 'organic_matter' | 'nitrogen' | 'erosion' | null
  get: (r: Rotation) => number | null | undefined
  fmt: (v: number | null | undefined, r?: Rotation) => string
  fmtDelta: (d: number | null | undefined) => string
  /** The axis the value is drawn on, with the labels of its two ends. Absent where a shared axis would mislead. */
  axis?: [number, number]
  axisLabels?: [string, string]
}

const cover = METRIC_BY_ID.cover
const legume = METRIC_BY_ID.legume
const erosion = METRIC_BY_ID.erosion

const trim = (v: number, digits = 2) => String(Number(v.toFixed(digits)))
const signed = (d: number | null | undefined, text: (a: number) => string) => (!isNum(d) ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${text(Math.abs(d))}`)
/** Crops in the cycle: the number of places where one crop hands over to the next as the cycle repeats. */
export const cropSteps = (r: Rotation) => r.slots.length

export const SOIL_PROXIES: SoilProxy[] = [
  {
    id: 'cover',
    title: 'Soil cover',
    icon: Layers,
    caption: 'of the days in the cycle have a crop in the ground',
    tip: `${cover.context} It counts days with a crop, not how dense the canopy or residue is.`,
    priority: 'organic_matter',
    get: cover.get,
    fmt: (v) => fmtMetric(cover, v),
    fmtDelta: (d) => fmtMetricDelta(cover, d),
    axis: [0, 1],
    axisLabels: ['0%', '100%'],
  },
  {
    id: 'legume',
    title: 'Legume share',
    subtitle: 'Potential nitrogen contribution indicator',
    icon: Sprout,
    caption: 'of the crops in the cycle are legumes',
    tip: `${legume.context} Nutrients are not modelled.`,
    priority: 'nitrogen',
    get: legume.get,
    fmt: (v) => fmtMetric(legume, v),
    fmtDelta: (d) => fmtMetricDelta(legume, d),
    axis: [0, 1],
    axisLabels: ['0%', '100%'],
  },
  {
    id: 'residue',
    title: 'Crop-residue class',
    icon: Wheat,
    caption: 'mean class of the crops in the cycle, on the engine’s scale from 1 (lower) to 3 (higher)',
    tip:
      'The engine’s crop table gives every crop a residue class from 1 (lower) to 3 (higher). This is the average over the crops in the rotation. ' +
      'It describes the crops, not what happens to the residue on your farm, and it is not a measured amount of organic matter.',
    priority: 'organic_matter',
    get: (r) => r.indicators.residue_class_mean,
    fmt: (v) => (isNum(v) ? trim(v) : '—'),
    fmtDelta: (d) => signed(d, (a) => trim(a)),
    axis: [1, 3],
    axisLabels: ['Class 1', 'Class 3'],
  },
  {
    id: 'erosion',
    title: 'Heavy-rain exposure indicator',
    icon: CloudRain,
    caption: 'of the heavy-rain days in the record fell while the soil was bare',
    tip: `${erosion.context} Slope, soil type and runoff are not part of it.`,
    priority: 'erosion',
    get: erosion.get,
    fmt: (v) => fmtMetric(erosion, v),
    fmtDelta: (d) => fmtMetricDelta(erosion, d),
    axis: [0, 1],
    axisLabels: ['0%', '100%'],
  },
  {
    id: 'family',
    title: 'Same-family sequences',
    icon: Repeat,
    caption: 'places in the cycle where a crop is followed by one of the same botanical family',
    tip:
      'The engine goes round the crops of the cycle in order, the last one being followed by the first, and counts each crop that is followed by one of the same botanical family. ' +
      'A rotation with a single crop counts as 1, because that crop follows itself. It is a consideration for pests and diseases that carry over between related crops. ' +
      'The engine reports the count but does not rank on it, and pests and disease are not modelled.',
    priority: null,
    get: (r) => r.indicators.family_repeats,
    fmt: (v, r) => (isNum(v) ? (r ? `${v} of ${cropSteps(r)}` : String(v)) : '—'),
    fmtDelta: (d) => signed(d, (a) => String(a)),
  },
]

export const PROXY_BY_ID = Object.fromEntries(SOIL_PROXIES.map((p) => [p.id, p])) as Record<ProxyId, SoilProxy>

export interface ProxyDiff {
  value: number | null
  base: number | null
  delta: number | null
  shift: Shift
}

/** How `rot` differs from the current rotation on one proxy. */
export function proxyDiff(p: SoilProxy, rot: Rotation, cur: Rotation): ProxyDiff {
  const value = p.get(rot)
  const base = p.get(cur)
  if (!isNum(value) || !isNum(base)) return { value: isNum(value) ? value : null, base: isNum(base) ? base : null, delta: null, shift: 'unknown' }
  const delta = value - base
  if (p.id === 'cover' || p.id === 'legume' || p.id === 'erosion') {
    // The shared rules decide direction and "about the same" for these three.
    const verdict = tradeoffs(rot, cur).find((t) => t.metric.id === p.id)?.verdict
    return { value, base, delta, shift: verdict === 'favourable' ? 'more' : verdict === 'unfavourable' ? 'less' : verdict === 'similar' ? 'same' : 'unknown' }
  }
  if (delta === 0) return { value, base, delta, shift: 'same' }
  // A higher residue class, or fewer same-family sequences.
  return { value, base, delta, shift: (p.id === 'residue' ? delta > 0 : delta < 0) ? 'more' : 'less' }
}

/** Position of a value on a proxy's axis, as a percentage of the track. */
export function proxyPos(p: SoilProxy, v: number | null | undefined): number | null {
  if (!isNum(v) || !p.axis) return null
  const [lo, hi] = p.axis
  return Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))
}

/** The engine's own benefit sentences that concern soil care (explanation.benefits), matched on their fixed wording. */
const SOIL_WORDS = /\b(soil|legume|nitrogen|covered|cover|residue)\b/i

export function soilBenefits(r: Rotation): string[] {
  return (r.explanation?.benefits ?? []).filter((b) => SOIL_WORDS.test(b))
}
