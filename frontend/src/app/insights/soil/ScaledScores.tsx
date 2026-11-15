import { InfoTip } from '../../../components/ui/InfoTip'
import { rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import { isNum } from '../../../lib/format'
import type { AnalysisEnvelope, Rotation } from '../../../lib/types'
import { Callout } from '../../components/controls'
import { joinList } from '../../lib/insights'
import { PRIORITIES } from '../../lib/labels'
import { Chip, Panel } from '../../results/shared'
import { RankBlock } from '../resilience/shared'

/** The three soil-care priorities of the ranking and the proxies each is scaled from (backend/engine/ranking.py). */
const KEYS: { id: 'nitrogen' | 'erosion' | 'organic_matter'; from: string; tip: string }[] = [
  {
    id: 'nitrogen',
    from: 'Scaled legume share',
    tip: 'The legume share, rescaled between the lowest and the highest rotation in this analysis. A potential nitrogen contribution indicator, not a nitrogen balance.',
  },
  {
    id: 'erosion',
    from: 'Scaled heavy-rain exposure, flipped',
    tip: 'The heavy-rain exposure indicator, rescaled and turned round so that the rotation with the least heavy rain on bare soil scores 1. Not a soil-loss estimate.',
  },
  {
    id: 'organic_matter',
    from: 'Average of scaled soil cover and scaled residue class',
    tip: 'Soil cover and the crop-residue class are each rescaled, then averaged. A soil-care contribution proxy, not a measured change in soil organic carbon.',
  },
]

const score = (r: Rotation, id: string) => r.scores?.normalised?.[id]
const name = (id: string) => PRIORITIES[id]?.label ?? id

function ScoreBar({ v, current }: { v: number | null | undefined; current: boolean }) {
  if (!isNum(v)) return <span className="text-[0.8125rem] font-semibold text-muted">Not available</span>
  return (
    <span className="flex items-center gap-2.5">
      <span className="w-9 shrink-0 font-display text-[0.9375rem] font-semibold text-forest-950 tabular-nums">{v.toFixed(2)}</span>
      <span aria-hidden="true" className={cx('relative h-2 min-w-0 flex-1 rounded-full', current ? 'bg-white' : 'bg-sand')}>
        {v > 0 && (
          <span className={cx('absolute inset-y-0 left-0 rounded-full', current ? 'bg-peri-chart' : 'bg-forest-800')} style={{ width: `${Math.max(3, Math.min(100, v * 100))}%` }} />
        )}
      </span>
    </span>
  )
}

/** The current rotation's scaled values in one sentence, naming an end of the scale where it sits on one. */
function currentSentence(all: Rotation[], cur: Rotation): string | null {
  const label = (id: string) => (PRIORITIES[id]?.short ?? id).toLowerCase()
  const spread = (id: string) => {
    const v = all.map((r) => score(r, id)).filter(isNum)
    return v.length > 1 && Math.max(...v) - Math.min(...v) > 0
  }
  const known = KEYS.filter((k) => isNum(score(cur, k.id)))
  if (known.length === 0) return null
  const varied = known.filter((k) => spread(k.id))
  const flat = known.filter((k) => !spread(k.id)).map((k) => label(k.id))
  const item = (id: string) => {
    const v = score(cur, id) as number
    return `${v.toFixed(2)} on ${label(id)}${v === 0 ? ' (the bottom of the scale)' : v === 1 ? ' (the top of the scale)' : ''}`
  }
  const out = varied.length ? `Among the ${all.length} rotations in this analysis, your current rotation scores ${joinList(varied.map((k) => item(k.id)))}.` : ''
  const same = flat.length ? `All rotations share the same value on ${joinList(flat)}, so ${flat.length === 1 ? 'it does' : 'they do'} not separate them.` : ''
  return [out, same].filter(Boolean).join(' ') || null
}

/** scores.normalised for nitrogen, erosion and organic matter: the 0 to 1 values the ranking multiplies by the farmer's weights. */
export function ScaledScores({ env, all, cur }: { env: AnalysisEnvelope; all: Rotation[]; cur: Rotation }) {
  const weights = env.request?.priorities
  const has = all.some((r) => KEYS.some((k) => isNum(score(r, k.id))))
  const weight = (id: string) => {
    const w = weights?.[id]
    return !isNum(w) ? 'weight not recorded' : w === 0 ? 'your weight 0: not counted' : `your weight ${w} of 5`
  }
  const sentence = currentSentence(all, cur)
  const n = all.length

  if (n < 2) {
    return (
      <Panel title="What the ranking actually uses">
        <Callout tone="plain" title="Not available for this analysis" className="max-w-4xl">
          The ranking rescales each proxy between the lowest and the highest rotation in an analysis. The engine returned only your current rotation, so there is nothing to
          scale it against.
        </Callout>
      </Panel>
    )
  }

  return (
    <Panel title="What the ranking actually uses">
      <p className="-mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
        The ranking does not use the proxies as they are. It rescales each one between the lowest and the highest of the {n} rotations in this analysis, so 0 is the lowest
        of these rotations and 1 the highest, then multiplies by your weights. A value of 1 means “highest of these {n}”, not “good soil care”.
      </p>
      {!has ? (
        <Callout tone="plain" title="Not available for this analysis" className="mt-4">
          The engine did not return scaled values for this run.
        </Callout>
      ) : (
        <>
          {/* Table from md up */}
          <div className="mt-4 hidden md:block">
            <table className="w-full border-separate border-spacing-0 text-[0.875rem]" aria-label={`Scaled soil-care values, from 0 to 1, of the ${n} rotations in this analysis`}>
              <thead>
                <tr>
                  <th scope="col" className="pb-2.5 pl-2 text-left align-bottom text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
                    Rotation
                  </th>
                  {KEYS.map((k) => (
                    <th key={k.id} scope="col" className="w-[22%] pb-2.5 pl-5 text-left align-bottom">
                      <span className="flex items-center gap-1 text-[0.875rem] leading-snug font-extrabold text-forest-950">
                        {name(k.id)} <InfoTip label={name(k.id)}>{k.tip}</InfoTip>
                      </span>
                      <span className="block text-[0.75rem] leading-snug font-semibold text-ink">{k.from}</span>
                      <span className="block text-[0.75rem] leading-snug font-bold text-ink tabular-nums">Scale 0 to 1 · {weight(k.id)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className={cx('py-2 pr-3 pl-2 text-left', r.is_current ? 'rounded-l-2xl bg-peri-50' : 'border-t border-border')}>
                      <span className="flex items-center gap-2.5">
                        <RankBlock rank={r.scores?.rank} of={n} current={r.is_current} className="h-8 min-w-8 rounded-lg text-[0.8125rem]" />
                        <span className="min-w-0">
                          <span className="block leading-snug font-bold text-forest-950">{rotationLabel(r)}</span>
                          {r.is_current && <span className="block text-[0.75rem] font-extrabold text-peri-ink">Your current rotation</span>}
                        </span>
                      </span>
                    </th>
                    {KEYS.map((k, i) => (
                      <td key={k.id} className={cx('py-2 pl-5', i === KEYS.length - 1 && 'pr-3', r.is_current ? cx('bg-peri-50', i === KEYS.length - 1 && 'rounded-r-2xl') : 'border-t border-border')}>
                        <ScoreBar v={score(r, k.id)} current={r.is_current} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stacked on small screens */}
          <ul className="mt-4 space-y-3 md:hidden">
            {all.map((r) => (
              <li key={r.id} className={cx('rounded-2xl p-4 ring-1', r.is_current ? 'bg-peri-50/70 ring-peri' : 'bg-white ring-border')}>
                <div className="flex items-start gap-2.5">
                  <RankBlock rank={r.scores?.rank} of={n} current={r.is_current} className="h-8 min-w-8 rounded-lg text-[0.8125rem]" />
                  <div className="min-w-0">
                    <p className="leading-snug font-bold text-forest-950">{rotationLabel(r)}</p>
                    {r.is_current && (
                      <Chip tone="peri" className="mt-1">
                        Current
                      </Chip>
                    )}
                  </div>
                </div>
                <dl className="mt-3 space-y-2">
                  {KEYS.map((k) => (
                    <div key={k.id}>
                      <dt className="text-[0.8125rem] font-bold text-ink">{name(k.id)}</dt>
                      <dd className="mt-0.5">
                        <ScoreBar v={score(r, k.id)} current={r.is_current} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1 text-[0.8125rem] leading-snug text-ink md:hidden">
            {KEYS.map((k) => (
              <li key={k.id}>
                <strong className="font-extrabold text-forest-950">{name(k.id)}:</strong> {k.from.charAt(0).toLowerCase()}
                {k.from.slice(1)}; {weight(k.id)}.
              </li>
            ))}
          </ul>

          {sentence && <p className="mt-4 max-w-4xl border-t border-border pt-4 text-[0.9375rem] leading-relaxed text-ink">{sentence}</p>}
          <p className="mt-2 max-w-4xl text-[0.8125rem] leading-snug text-muted">
            Because the scale is set by the rotations being compared, the same rotation can score differently in another analysis. When every rotation has the same value on a
            proxy, the engine gives each of them 0.50.
          </p>
        </>
      )}
    </Panel>
  )
}
