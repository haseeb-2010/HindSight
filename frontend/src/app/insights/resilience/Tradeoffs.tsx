import { CircleEqual, CircleHelp, CircleMinus, CirclePlus, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { InfoTip } from '../../../components/ui/InfoTip'
import { rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import type { Rotation } from '../../../lib/types'
import { Callout } from '../../components/controls'
import { fmtMetric, fmtMetricDelta, tradeoffSentence, tradeoffs, type Tradeoff, type Verdict } from '../../lib/insights'
import { Panel, RotationPicker } from '../../results/shared'
import { LegendKey, TextLink, axisMax, axisPos } from './shared'

const REWARD_TIP =
  'The ranking gives a rotation more credit for a higher value of some indicators and a lower value of others. This only says which way a difference points in that scoring. ' +
  'It is not a verdict on the rotation: the same difference can matter a lot on one farm and not at all on another.'

/** Wording for each verdict from the shared rules. A direction in the scoring, never "better" or "worse". */
const GROUPS: Record<Verdict, { title: string; short: string; icon: LucideIcon; box: string; empty: string }> = {
  favourable: {
    title: 'In the direction the ranking rewards',
    short: 'in the direction the ranking rewards',
    icon: CirclePlus,
    box: 'bg-lime-100/60 ring-forest-950/10',
    empty: 'No indicator differs in the direction the ranking rewards.',
  },
  unfavourable: {
    title: 'Against the direction the ranking rewards',
    short: 'against it',
    icon: CircleMinus,
    box: 'bg-signal-50 ring-signal/30',
    empty: 'No indicator differs against the direction the ranking rewards.',
  },
  similar: {
    title: 'About the same',
    short: 'about the same',
    icon: CircleEqual,
    box: 'bg-sand/60 ring-transparent',
    empty: 'Every indicator differs by more than the “about the same” margin.',
  },
  unknown: {
    title: 'Not available',
    short: 'not available',
    icon: CircleHelp,
    box: 'bg-sand/60 ring-transparent',
    empty: '',
  },
}

/** Both rotations on the indicator's own axis: a ring for the current rotation, a dot for the selected one. */
function Dumbbell({ t, max }: { t: Tradeoff; max: number }) {
  const a = axisPos(t.base, max)
  const b = axisPos(t.value, max)
  // When the two values sit on the same spot the ring is drawn over the dot, so both stay visible.
  const together = a !== null && b !== null && Math.abs(a - b) < 1.5
  return (
    <div aria-hidden="true" className="mt-3">
      <div className="relative mx-2 h-4">
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-sand" />
        {a !== null && b !== null && Math.abs(a - b) > 0.5 && (
          <span className="absolute top-1/2 h-1 -translate-y-1/2 bg-sage" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />
        )}
        {a !== null && !together && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-peri-chart bg-white" style={{ left: `${a}%` }} />}
        {b !== null && (
          <span className={cx('absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest-950', together ? 'h-2 w-2' : 'h-3 w-3 ring-2 ring-white')} style={{ left: `${b}%` }} />
        )}
        {a !== null && together && <span className="absolute top-1/2 h-[1.125rem] w-[1.125rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-peri-chart" style={{ left: `${a}%` }} />}
      </div>
      <div className="mt-0.5 flex justify-between text-[0.6875rem] font-bold text-muted tabular-nums">
        <span>0</span>
        <span>{fmtMetric(t.metric, max)}</span>
      </div>
    </div>
  )
}

function Item({ t, max }: { t: Tradeoff; max: number }) {
  return (
    <li className="rounded-2xl bg-white p-4 shadow-hairline ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[0.9375rem] leading-snug font-extrabold text-forest-950">{t.metric.label}</p>
        <p className="shrink-0 font-display text-[1.125rem] leading-none font-semibold whitespace-nowrap text-forest-950 tabular-nums">
          <span className="sr-only">Difference: </span>
          {fmtMetricDelta(t.metric, t.delta)}
        </p>
      </div>
      <p className="mt-1 text-[0.8125rem] leading-snug font-semibold text-ink tabular-nums">
        {t.verdict === 'unknown' ? (
          <>The engine did not return this value for both rotations.</>
        ) : (
          <>
            {fmtMetric(t.metric, t.value)} for this alternative, {fmtMetric(t.metric, t.base)} for your current rotation
          </>
        )}
      </p>
      {t.verdict !== 'unknown' && max > 0 && <Dumbbell t={t} max={max} />}
      <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
        {t.metric.context}
        {t.verdict === 'similar' && ` Differences under ${fmtMetricDelta(t.metric, t.metric.similar).slice(1)} count as about the same.`}
      </p>
    </li>
  )
}

function Group({ verdict, items, maxOf, wide }: { verdict: Verdict; items: Tradeoff[]; maxOf: (t: Tradeoff) => number; wide?: boolean }) {
  const g = GROUPS[verdict]
  return (
    <section className={cx('rounded-[1.25rem] p-4 ring-1 sm:p-5', g.box)}>
      <h4 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[1rem] leading-snug">
        <g.icon className="h-5 w-5 shrink-0 text-forest-950" aria-hidden="true" />
        <span>{g.title} </span>
        <span className="rounded-full bg-white px-2 py-0.5 font-sans text-[0.75rem] font-extrabold text-forest-950 ring-1 ring-border-strong tabular-nums">
          <span className="sr-only">: </span>
          {items.length}
          <span className="sr-only"> indicator{items.length === 1 ? '' : 's'}</span>
        </span>
        {(verdict === 'favourable' || verdict === 'unfavourable') && <InfoTip label={g.title}>{REWARD_TIP}</InfoTip>}
        {verdict === 'similar' && (
          <InfoTip label="About the same">
            The difference is smaller than the margin HindSight treats as too small to call for that indicator. Each card below prints its margin.
          </InfoTip>
        )}
      </h4>
      {items.length === 0 ? (
        <p className="mt-3 text-[0.875rem] font-semibold text-ink">{g.empty}</p>
      ) : (
        <ul className={cx('mt-3 grid gap-3', wide && 'md:grid-cols-2 xl:grid-cols-3')}>
          {items.map((t) => (
            <Item key={t.metric.id} t={t} max={maxOf(t)} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** What the nine verdicts add up to when the shared rules give no gain-and-cost sentence. */
function fallbackSentence(name: string, gains: number, costs: number, total: number): string {
  if (gains === 0 && costs === 0) return `On these ${total} indicators, ${name} is about the same as your current rotation.`
  if (costs === 0) return `On these ${total} indicators, ${name} shows no difference against the direction the ranking rewards. Things the engine does not model can still differ.`
  return `On these ${total} indicators, ${name} shows no difference in the direction the ranking rewards.`
}

/** D. One alternative against the current rotation, sorted by which way each indicator differs. */
export function Tradeoffs({ all, cur }: { all: Rotation[]; cur: Rotation }) {
  const alts = all.filter((r) => !r.is_current)
  const [picked, setPicked] = useState<string | null>(null)
  const rot = alts.find((r) => r.id === picked) ?? alts[0]

  if (!rot) {
    return (
      <Panel title="What would you gain, and what would it cost?">
        <Callout tone="plain">The engine returned only your current rotation for this analysis, so there is no alternative to weigh it against.</Callout>
      </Panel>
    )
  }

  const list = tradeoffs(rot, cur)
  const by = (v: Verdict) => list.filter((t) => t.verdict === v)
  const gains = by('favourable')
  const costs = by('unfavourable')
  const same = by('similar')
  const unknown = by('unknown')
  const name = rotationLabel(rot)
  const maxOf = (t: Tradeoff) => axisMax(t.metric, all)
  const main = tradeoffSentence(rot, cur)
  const stabilityWater = tradeoffSentence(rot, cur, ['p10', 'water'])
  const lines = main ? [main, ...(stabilityWater && stabilityWater !== main ? [stabilityWater] : [])] : [fallbackSentence(name, gains.length, costs.length, list.length)]

  return (
    <Panel title="What would you gain, and what would it cost?">
      <p className="-mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
        A rotation can move one indicator the way the ranking rewards and another the opposite way. Choose an alternative to see every indicator sorted by which way it
        differs from your current rotation, <strong className="font-extrabold text-forest-950">{rotationLabel(cur)}</strong>.
      </p>
      <div className="mt-3">
        <RotationPicker rotations={alts} selected={rot.id} onSelect={setPicked} label="Alternative to weigh against your current rotation" />
      </div>

      <div key={rot.id} className="animate-fade">
        <div className="mt-4 rounded-2xl bg-forest-950 p-4 text-cream-50 sm:p-5">
          <p className="text-[0.75rem] font-extrabold tracking-[0.08em] text-lime uppercase">
            Rank #{rot.scores?.rank} of {all.length} against your current #{cur.scores?.rank}
          </p>
          {lines.map((s) => (
            <p key={s} className="mt-1.5 max-w-4xl text-[1rem] leading-relaxed font-semibold">
              {s}
            </p>
          ))}
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] font-bold text-mist tabular-nums">
            <span>
              {gains.length} {GROUPS.favourable.short}
            </span>
            <span>
              {costs.length} {GROUPS.unfavourable.short}
            </span>
            <span>
              {same.length} {GROUPS.similar.short}
            </span>
            {unknown.length > 0 && (
              <span>
                {unknown.length} {GROUPS.unknown.short}
              </span>
            )}
          </p>
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] font-semibold text-ink">
          <LegendKey swatch={<span className="h-3 w-3 rounded-full bg-forest-950" />}>{name}</LegendKey>
          <LegendKey swatch={<span className="h-4 w-4 rounded-full border-[3px] border-peri-chart bg-white" />}>Your current rotation</LegendKey>
          <li className="text-muted">Each indicator is drawn on its own axis, from 0 to the value printed at its right end.</li>
        </ul>

        <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
          <Group verdict="favourable" items={gains} maxOf={maxOf} />
          <Group verdict="unfavourable" items={costs} maxOf={maxOf} />
        </div>
        <div className="mt-4 space-y-4">
          <Group verdict="similar" items={same} maxOf={maxOf} wide />
          {unknown.length > 0 && <Group verdict="unknown" items={unknown} maxOf={maxOf} wide />}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-border pt-4">
        <p className="max-w-3xl text-[0.8125rem] leading-snug text-muted">
          “Rewards” describes how this analysis scores rotations. It is not a judgement of what is right for your farm. The ranking scores the P10 index, crop water demand,
          soil cover, legume share, forage share and heavy-rain exposure directly. The median index, failure frequency and irrigation requirement are reported alongside and
          read in the same sense. Market suitability and the timing of field work are not among these indicators.
        </p>
        <TextLink to="/app/analysis?step=results&tab=details">See each rotation’s calendar and sowing dates</TextLink>
      </div>
    </Panel>
  )
}
