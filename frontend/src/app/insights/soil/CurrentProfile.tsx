import { InfoTip } from '../../../components/ui/InfoTip'
import { rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import { isNum } from '../../../lib/format'
import type { Rotation } from '../../../lib/types'
import { exposureSentence } from '../../lib/insights'
import { PRIORITIES } from '../../lib/labels'
import { Panel } from '../../results/shared'
import { TextLink } from '../resilience/shared'
import { SOIL_PROXIES, cropSteps, proxyPos, type SoilProxy } from './proxies'

function Gauge({ p, r }: { p: SoilProxy; r: Rotation }) {
  const v = p.get(r)
  if (p.id === 'family') {
    const n = cropSteps(r)
    return (
      <span aria-hidden="true" className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={cx('h-3.5 w-3.5 rounded-full', isNum(v) && i < v ? 'bg-peri-chart' : 'border-2 border-sand-400 bg-white')} />
        ))}
      </span>
    )
  }
  const pos = proxyPos(p, v)
  return (
    <span aria-hidden="true" className="mt-3 block">
      <span className="relative block h-2 rounded-full bg-white ring-1 ring-border">
        {pos !== null && pos > 0 && <span className="bar-grow-x absolute inset-y-0 left-0 rounded-full bg-peri-chart" style={{ width: `${Math.max(pos, 3)}%` }} />}
      </span>
      {p.axisLabels && (
        <span className="mt-1 flex justify-between text-[0.6875rem] font-bold text-ink tabular-nums">
          <span>{p.axisLabels[0]}</span>
          <span>{p.axisLabels[1]}</span>
        </span>
      )}
    </span>
  )
}

function Tile({ p, r }: { p: SoilProxy; r: Rotation }) {
  return (
    <div className="flex flex-col rounded-2xl bg-sand/50 p-4">
      <dt className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime" aria-hidden="true">
            <p.icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.9375rem] leading-snug font-extrabold text-forest-950">{p.title}</span>
            {p.subtitle && <span className="block text-[0.75rem] leading-snug font-bold text-ink">{p.subtitle}</span>}
          </span>
        </span>
        <InfoTip label={p.title}>{p.tip}</InfoTip>
      </dt>
      <dd className="mt-3 flex flex-1 flex-col">
        <span className="font-display text-[1.75rem] leading-none font-semibold text-forest-950">{p.fmt(p.get(r), r)}</span>
        <Gauge p={p} r={r} />
        <span className="mt-2.5 block text-[0.8125rem] leading-snug text-ink">{p.caption}</span>
        <span className="mt-auto block pt-3 text-[0.75rem] leading-snug font-bold text-ink">
          {p.priority ? `Scored in the ranking under “${PRIORITIES[p.priority]?.short ?? p.priority}”` : 'Reported by the engine, not ranked'}
        </span>
      </dd>
    </div>
  )
}

/** The current rotation on the five soil-care proxies, as the engine reports them. */
export function CurrentProfile({ cur }: { cur: Rotation }) {
  return (
    <Panel title="Your current rotation’s soil-care profile">
      <p className="-mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
        Five values the engine reports for <strong className="font-extrabold text-forest-950">{rotationLabel(cur)}</strong>. Each one is a proxy read from the crop calendar
        and the crop list. None of them is a measurement of your soil.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {SOIL_PROXIES.map((p) => (
          <Tile key={p.id} p={p} r={cur} />
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-t border-border pt-4">
        <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">{exposureSentence(cur)}</p>
        <TextLink to="/app/insights?tab=season">See when the soil is bare, month by month</TextLink>
      </div>
    </Panel>
  )
}
