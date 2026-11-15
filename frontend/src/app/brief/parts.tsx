// Shared pieces of the Decision Brief: the selection of what the sections read from one envelope,
// and the small layout parts every section is built from.
import type { ReactNode } from 'react'
import { InfoTip } from '../../components/ui/InfoTip'
import { failureThreshold, isIrrigated, rankedRotations } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { isNum } from '../../lib/format'
import type { AnalysisEnvelope, AnalysisResult, Rotation } from '../../lib/types'
import { isScenarioActive } from '../lib/config'
import { doyLabel } from '../lib/doy'

export const RAINFALL_CAUTION =
  'Rainfall estimates should be interpreted alongside local station records because gridded historical rainfall may differ from conditions measured at individual farms.'

export const BRIEF_DISCLAIMER =
  'HindSight provides historical decision-support simulations. Rankings are relative to the alternatives and assumptions evaluated. They are not guaranteed recommendations, yield forecasts, or substitutes for local agricultural expertise.'

/** How many alternatives the brief leads with. */
export const MAX_LEADS = 3

/** Everything the sections share, selected once from the envelope. */
export interface BriefData {
  env: AnalysisEnvelope
  res: AnalysisResult
  names: Record<string, string>
  ranked: Rotation[]
  total: number
  /** The rotation the engine marked as current, if any. */
  cur: Rotation | undefined
  /** Up to three rotations other than the current one, by rank. */
  alts: Rotation[]
  curIsTop: boolean
  /** True when irrigation figures belong in the brief: an irrigated run, or any rotation that reports irrigation. */
  irrigated: boolean
  /** False when the run's water mode was not recorded (older saved analyses). */
  waterKnown: boolean
  thr: number | null
  early: string
  late: string
  scenarioOn: boolean
}

export function briefData(env: AnalysisEnvelope, names: Record<string, string>): BriefData {
  const res = env.result
  const ranked = rankedRotations(res)
  const cur = ranked.find((r) => r.is_current)
  const w = res.meta.windows
  return {
    env,
    res,
    names,
    ranked,
    total: ranked.length,
    cur,
    alts: ranked.filter((r) => !r.is_current).slice(0, MAX_LEADS),
    curIsTop: !!cur && ranked[0] === cur,
    irrigated: isIrrigated(env) || ranked.some((r) => isNum(r.hindcast.irrigation_mm_per_year) && r.hindcast.irrigation_mm_per_year > 0),
    waterKnown: !!env.request?.water?.mode,
    thr: failureThreshold(env),
    early: w?.early ? `${w.early[0]}–${w.early[1]}` : 'the earlier period',
    late: w?.late ? `${w.late[0]}–${w.late[1]}` : 'the later period',
    scenarioOn: isScenarioActive(env.request?.scenario),
  }
}

/* ------------------------------------------------------------------ small parts */

export function Section({ n, title, lead, children }: { n: number; title: string; lead?: ReactNode; children: ReactNode }) {
  const id = `brief-section-${n}`
  return (
    <section
      aria-labelledby={id}
      className="rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-7 print:rounded-none print:border-t print:border-sand-400 print:px-0 print:pt-5 print:pb-1 print:shadow-none print:ring-0"
    >
      <header className="flex items-start gap-3.5 break-after-avoid">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-950 font-display text-[1rem] font-semibold text-lime tabular-nums">
          {n}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-[1.4375rem] leading-tight tracking-[-0.02em]">
            <span className="sr-only">{n}. </span>
            {title}
          </h2>
          {lead && <p className="mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-muted print:max-w-none">{lead}</p>}
        </div>
      </header>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  )
}

export function Sub({ title, tip, children, className }: { title: string; tip?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <h3 className="flex items-center gap-1.5 text-[1.0625rem] leading-snug break-after-avoid">
        {title}
        {tip && <InfoTip label={title}>{tip}</InfoTip>}
      </h3>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

export function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0 break-inside-avoid', className)}>
      <dt className="text-[0.75rem] leading-tight font-bold text-muted">{label}</dt>
      <dd className="mt-0.5 text-[0.9375rem] leading-snug font-semibold text-forest-950">{children}</dd>
    </div>
  )
}

export function Bullets({ items, empty }: { items: ReactNode[]; empty?: string }) {
  if (items.length === 0) return empty ? <p className="text-[0.9375rem] text-ink">{empty}</p> : null
  return (
    <ul className="space-y-1.5 text-[0.9375rem] leading-snug text-ink">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 break-inside-avoid">
          <span aria-hidden="true" className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />
          <span className="min-w-0">{t}</span>
        </li>
      ))}
    </ul>
  )
}

export const NA = <span className="font-semibold text-muted">Not available</span>

/** "Median index" → "median index"; an abbreviation such as "P10 index" keeps its capital. */
export const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)

/** The crops of a rotation in order, each with the sowing date the simulation used. */
export function CropSequence({ r, names }: { r: Rotation; names: Record<string, string> }) {
  const slots = [...r.slots].sort((a, b) => a.year_offset - b.year_offset || a.plant_doy - b.plant_doy)
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Crop sequence and sowing dates">
      {slots.map((s, i) => (
        <li key={i} className="rounded-full bg-sand px-2.5 py-1 text-[0.75rem] leading-tight font-bold text-ink">
          {r.cycle_years > 1 && <span className="font-extrabold text-forest-950">Year {s.year_offset + 1} · </span>}
          {names[s.crop_id] ?? s.crop_id} · sown {doyLabel(s.plant_doy)}
        </li>
      ))}
    </ol>
  )
}

/** A sentence the engine wrote, shown unchanged and attributed. */
export function EngineQuote({ text, by }: { text: string; by: string }) {
  return (
    // The wrapper takes the spacing of the surrounding layout; a figure needs its own margins reset.
    <div className="break-inside-avoid">
      <figure className="m-0 rounded-2xl bg-sand/60 px-4 py-3.5">
        <blockquote className="m-0 text-[0.9375rem] leading-snug font-semibold text-forest-950">“{text}”</blockquote>
        <figcaption className="mt-1.5 text-[0.75rem] font-bold text-ink">{by}</figcaption>
      </figure>
    </div>
  )
}
