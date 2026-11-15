import type { ReactNode } from 'react'
import { InfoTip } from '../../../components/ui/InfoTip'
import { rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import type { Rotation } from '../../../lib/types'
import { MascotNote } from '../../components/controls'
import { METRIC_BY_ID, fmtMetric, tradeoffs } from '../../lib/insights'
import { LegendKey } from '../resilience/shared'
import { PROXY_BY_ID, proxyDiff, proxyPos, type ProxyDiff, type ProxyId, type SoilProxy } from './proxies'

interface Wording {
  /** Card heading: the thing that could be looked into. */
  heading: (cur: Rotation) => string
  /** k of the n alternatives move this proxy in the soil-care direction. `cur` is the current rotation's formatted value. */
  some: (k: number, n: number, cur: string, curRot: Rotation) => string
  none: (cur: string, curRot: Rotation) => string
  /** How an alternative on the other side is described, completing "N …". */
  less: (count: number) => string
  /** A neutral prompt for the farmer. Never an instruction. */
  review: string
}

const of = (k: number, n: number) => (n === 1 ? 'The alternative' : k === n ? `All ${n} alternatives` : `${k} of the ${n} alternatives`)
const verb = (k: number, n: number, one: string, many: string) => (n === 1 || k === 1 ? one : many)

const WORDING: Record<ProxyId, Wording> = {
  cover: {
    heading: () => 'Keeping the soil covered for longer',
    some: (k, n, cur) => `${of(k, n)} ${verb(k, n, 'keeps', 'keep')} a crop in the ground for more days of the cycle than your current rotation (${cur}).`,
    none: (cur) => `No alternative in this analysis keeps a crop in the ground for more days of the cycle than your current rotation (${cur}).`,
    less: (c) => `${c} with less cover`,
    review: 'Worth reviewing: whether a calendar with more days under crop fits your water, labour and sowing dates.',
  },
  legume: {
    heading: (cur) => (cur.indicators.legume_share === 0 ? 'Adding a legume' : 'A larger legume share'),
    some: (k, n, cur, r) =>
      r.indicators.legume_share === 0
        ? `${of(k, n)} ${verb(k, n, 'includes', 'include')} a legume. Your current rotation has none.`
        : `${of(k, n)} ${verb(k, n, 'has', 'have')} a larger legume share than your current rotation (${cur}).`,
    none: (cur, r) =>
      r.indicators.legume_share === 0
        ? 'No alternative in this analysis includes a legume, and your current rotation has none.'
        : `No alternative in this analysis has a larger legume share than your current rotation (${cur}).`,
    less: (c) => `${c} with a smaller legume share`,
    review:
      'Worth reviewing: seed, a market for the crop and how it fits your season. The share is an indicator of potential nitrogen contribution. HindSight does not work out a nitrogen balance.',
  },
  residue: {
    heading: () => 'Crops that leave more residue',
    some: (k, n, cur) => `${of(k, n)} ${verb(k, n, 'has', 'have')} a higher mean crop-residue class than your current rotation (${cur}).`,
    none: (cur) => `No alternative in this analysis has a higher mean crop-residue class than your current rotation (${cur}).`,
    less: (c) => `${c} with a lower class`,
    review: 'Worth reviewing: what happens to residue on your farm. The class describes the crops, not whether residue is left on the field, grazed or removed.',
  },
  erosion: {
    heading: () => 'Less heavy rain on bare soil',
    some: (k, n, cur) => `${of(k, n)} ${verb(k, n, 'has', 'have')} a smaller share of heavy-rain days falling on bare soil than your current rotation (${cur}).`,
    none: (cur) => `No alternative in this analysis has a smaller share of heavy-rain days falling on bare soil than your current rotation (${cur}).`,
    less: (c) => `${c} with more exposure`,
    review: 'Worth reviewing alongside the months when heavy rain falls here. This is an exposure indicator: slope, soil type and runoff are not modelled.',
  },
  family: {
    heading: () => 'Fewer same-family sequences',
    some: (k, n, cur) => `${of(k, n)} ${verb(k, n, 'has', 'have')} fewer places where a crop follows one of the same botanical family than your current rotation (${cur}).`,
    none: (cur) => `No alternative in this analysis has fewer same-family sequences than your current rotation (${cur}).`,
    less: (c) => `${c} with more`,
    review: 'Worth asking locally about pests and diseases that carry over between related crops. The engine reports this count but does not rank on it.',
  },
}

/** Ring for the current rotation, dot for the alternative, on the proxy's own axis. */
function Track({ p, d }: { p: SoilProxy; d: ProxyDiff }) {
  const a = proxyPos(p, d.base)
  const b = proxyPos(p, d.value)
  if (a === null && b === null) return null
  return (
    <span aria-hidden="true" className="relative mx-2 mt-1.5 block h-4">
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-sand" />
      {a !== null && b !== null && Math.abs(a - b) > 0.5 && (
        <span className="absolute top-1/2 h-1 -translate-y-1/2 bg-sage" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />
      )}
      {a !== null && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-peri-chart bg-white" style={{ left: `${a}%` }} />}
      {b !== null && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest-950 ring-2 ring-white" style={{ left: `${b}%` }} />}
    </span>
  )
}

interface Summary {
  id: ProxyId
  p: SoilProxy
  w: Wording
  /** Alternatives that move the proxy in the soil-care direction, in rank order. */
  more: { r: Rotation; d: ProxyDiff }[]
  /** The other alternatives, counted in words. */
  rest: string[]
  curText: string
  n: number
}

function summarise(id: ProxyId, alts: Rotation[], cur: Rotation): Summary {
  const p = PROXY_BY_ID[id]
  const w = WORDING[id]
  const diffs = alts.map((r) => ({ r, d: proxyDiff(p, r, cur) }))
  const count = (shift: ProxyDiff['shift']) => diffs.filter((x) => x.d.shift === shift).length
  const same = count('same')
  const less = count('less')
  const unknown = count('unknown')
  return {
    id,
    p,
    w,
    more: diffs.filter((x) => x.d.shift === 'more'),
    rest: [same ? `${same} about the same` : null, less ? w.less(less) : null, unknown ? `${unknown} not available` : null].filter((x): x is string => !!x),
    curText: p.fmt(p.get(cur), cur),
    n: alts.length,
  }
}

function ProxyName({ p }: { p: SoilProxy }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {p.subtitle ?? p.title}
      {p.subtitle ? ` (${p.title.toLowerCase()})` : ''} <InfoTip label={p.title}>{p.tip}</InfoTip>
    </span>
  )
}

/** A proxy on which at least one alternative moves in the soil-care direction. */
function OpportunityCard({ s, cur }: { s: Summary; cur: Rotation }) {
  const { p, w, more } = s
  // For soil cover the engine output can also say what came with it: the modelled water demand of the same alternatives.
  const water = METRIC_BY_ID.water
  const thirstier = s.id === 'cover' ? more.filter((x) => tradeoffs(x.r, cur).some((t) => t.metric.id === 'water' && t.verdict === 'unfavourable')).length : 0
  let extra: ReactNode = null
  if (thirstier > 0) {
    extra = (
      <>
        {' '}
        {thirstier === more.length ? (more.length === 1 ? 'It also has' : `All ${more.length} also have`) : `${thirstier} of those ${more.length} also ${thirstier === 1 ? 'has' : 'have'}`} a
        higher modelled crop water demand than your current rotation ({fmtMetric(water, water.get(cur))} a year).
      </>
    )
  }

  return (
    <article className="flex flex-col rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-950 text-lime" aria-hidden="true">
          <p.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h4 className="text-[1.0625rem] leading-snug">{w.heading(cur)}</h4>
          <p className="mt-0.5 text-[0.75rem] leading-snug font-bold text-ink">
            <ProxyName p={p} />
          </p>
        </div>
      </div>

      <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-ink">
        {w.some(more.length, s.n, s.curText, cur)}
        {extra}
      </p>

      <ul className="mt-3 space-y-2.5 border-t border-border pt-3">
        {more.map(({ r, d }) => (
          <li key={r.id}>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[0.8125rem] leading-snug font-bold text-forest-950">
                <span className="mr-1.5 font-display font-semibold tabular-nums">#{r.scores?.rank}</span>
                {rotationLabel(r)}
              </span>
              <span className="shrink-0 text-right whitespace-nowrap tabular-nums">
                <span className="font-display text-[0.9375rem] font-semibold text-forest-950">{p.fmt(d.value, r)}</span>{' '}
                <span className="text-[0.75rem] font-bold text-ink">({p.fmtDelta(d.delta)})</span>
              </span>
            </span>
            <Track p={p} d={d} />
          </li>
        ))}
      </ul>
      {p.axisLabels && (
        <p className="mx-2 mt-0.5 flex justify-between text-[0.6875rem] font-bold text-muted tabular-nums" aria-hidden="true">
          <span>{p.axisLabels[0]}</span>
          <span>{p.axisLabels[1]}</span>
        </p>
      )}

      {s.rest.length > 0 && <p className="mt-3 text-[0.8125rem] leading-snug font-semibold text-ink">The rest: {s.rest.join(', ')}.</p>}
      <p className="mt-auto pt-3.5 text-[0.8125rem] leading-snug text-muted">{w.review}</p>
    </article>
  )
}

/** The proxies on which no alternative moves in the soil-care direction, said plainly in one place. */
function NoChange({ items, cur, className }: { items: Summary[]; cur: Rotation; className?: string }) {
  return (
    <article className={cx('rounded-[1.5rem] bg-sand/60 p-5 ring-1 ring-border', className)}>
      <h4 className="text-[1.0625rem] leading-snug">Where no alternative goes further than your current rotation</h4>
      <ul className="mt-3.5 space-y-4">
        {items.map((s) => (
          <li key={s.id} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-forest-950 ring-1 ring-border-strong" aria-hidden="true">
              <s.p.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.75rem] leading-snug font-bold text-ink">
                <ProxyName p={s.p} />
              </p>
              <p className="mt-0.5 text-[0.9375rem] leading-snug text-ink">{s.w.none(s.curText, cur)}</p>
              {s.rest.length > 0 && (
                <p className="mt-1 text-[0.8125rem] leading-snug font-semibold text-ink">
                  {s.n === 1 ? 'The alternative: ' : `Of the ${s.n} alternatives: `}
                  {s.rest.join(', ')}.
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}

const DIRECTIONS = 'more days under crop, a larger legume share, a higher residue class, less heavy rain on bare soil, or fewer same-family sequences'

/** How the alternatives differ from the current rotation on each proxy, stated only where the numbers show it. */
export function Opportunities({ all, cur }: { all: Rotation[]; cur: Rotation }) {
  const alts = all.filter((r) => !r.is_current)
  const ids: ProxyId[] = ['cover', 'legume', 'erosion', 'residue', 'family']
  const summaries = ids.map((id) => summarise(id, alts, cur))
  const moved = summaries.filter((s) => s.more.length > 0)
  const unmoved = summaries.filter((s) => s.more.length === 0)
  const cells = moved.length + (unmoved.length ? 1 : 0)
  return (
    <section aria-labelledby="soil-opportunities-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h3 id="soil-opportunities-title" className="text-[1.25rem] leading-tight">
            Which alternatives move a soil-care proxy, and which do not?
          </h3>
          <p className="mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
            {alts.length === 0
              ? 'The engine returned only your current rotation, so there is no alternative to compare it with.'
              : moved.length === 0
                ? `On none of the ${ids.length} proxies does an alternative go further than your current rotation in the soil-care direction: ${DIRECTIONS}.`
                : `On ${moved.length} of the ${ids.length} proxies, at least one alternative goes further than your current rotation in the soil-care direction: ${DIRECTIONS}. Each card names the alternatives, with their values.`}
          </p>
          {moved.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] font-semibold text-ink">
              <LegendKey swatch={<span className="h-4 w-4 rounded-full border-[3px] border-peri-chart bg-white" />}>Your current rotation</LegendKey>
              <LegendKey swatch={<span className="h-3 w-3 rounded-full bg-forest-950" />}>The alternative named above the line</LegendKey>
            </ul>
          )}
        </div>
        {alts.length > 0 && (
          <MascotNote mascot="mint" className="max-w-sm">
            “Worth reviewing” means worth a closer look with someone who knows your land. It is not an instruction.
          </MascotNote>
        )}
      </div>
      {alts.length > 0 && (
        <div className={cx('grid items-stretch gap-4', cells > 1 && 'md:grid-cols-2', cells > 1 && cells !== 2 && cells !== 4 && 'xl:grid-cols-3')}>
          {moved.map((s) => (
            <OpportunityCard key={s.id} s={s} cur={cur} />
          ))}
          {unmoved.length > 0 && <NoChange items={unmoved} cur={cur} className={cx(cells === 5 && 'xl:col-span-2', cells > 1 && cells % 2 === 1 && 'md:max-xl:col-span-2')} />}
        </div>
      )}
    </section>
  )
}
