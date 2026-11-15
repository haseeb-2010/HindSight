import { ArrowDownRight, ArrowUpRight, Equal } from 'lucide-react'
import { currentRotation, rankedRotations, rotationLabel } from '../../lib/analysis'
import type { Rotation } from '../../lib/types'
import { Callout } from '../components/controls'
import { joinList, stabilitySentence, tradeoffs } from '../lib/insights'
import { Panel } from '../results/shared'
import { ProfileCards } from './resilience/ProfileCards'
import { RankRobustness } from './resilience/RankRobustness'
import { SectionHeader, TextLink } from './resilience/shared'
import { ToughYears } from './resilience/ToughYears'
import { Tradeoffs } from './resilience/Tradeoffs'
import type { InsightProps } from './types'

/** C. The stability sentences the shared rules allow, and a plain note about the ones they do not. */
function StabilityNotes({ all, cur }: { all: Rotation[]; cur: Rotation }) {
  const alts = all.filter((r) => !r.is_current)
  const notes = alts.map((r) => ({ r, text: stabilitySentence(r, cur), p10: tradeoffs(r, cur).find((t) => t.metric.id === 'p10')?.verdict }))
  const said = notes.filter((n): n is typeof n & { text: string } => !!n.text)
  const unsaid = notes.filter((n) => !n.text)
  return (
    <Panel title="What do the stability numbers say?">
      <p className="-mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
        Stability is read from two engine values together: the lower-decile (P10) seasonal index and the failure frequency. A sentence appears only where the two agree.
      </p>
      {alts.length === 0 ? (
        <Callout tone="plain" className="mt-4">
          The engine returned only your current rotation, so there is no alternative to compare its stability with.
        </Callout>
      ) : (
        <>
          {said.length > 0 && (
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {said.map(({ r, text, p10 }) => {
                const Icon = p10 === 'favourable' ? ArrowUpRight : p10 === 'unfavourable' ? ArrowDownRight : Equal
                return (
                  <li key={r.id} className="flex gap-3 rounded-2xl bg-sand/50 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-forest-950 ring-1 ring-border-strong" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 text-[0.9375rem] leading-relaxed text-ink">
                      <span className="mr-1.5 font-display text-[0.8125rem] font-semibold text-forest-950 tabular-nums">#{r.scores?.rank}</span>
                      {text}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
          {unsaid.length > 0 && (
            <p className="mt-4 max-w-4xl text-[0.875rem] leading-relaxed text-ink">
              <strong className="font-extrabold text-forest-950">{said.length === 0 ? 'No stability statement is made in this analysis.' : 'No statement is made for '}</strong>
              {said.length === 0 ? ' For ' : ''}
              {joinList(unsaid.map((n) => rotationLabel(n.r)))}
              {said.length === 0 ? ', the' : ': the'} P10 index and the failure frequency do not point the same way against your current rotation, or a value is missing.
            </p>
          )}
          <p className="mt-3 max-w-4xl text-[0.8125rem] leading-snug text-muted">
            These sentences describe the simulation of past years. They are not a forecast, and a higher index is not a higher yield.
          </p>
        </>
      )}
    </Panel>
  )
}

/** Field Intelligence, "Rotation resilience": hard years, stability, trade-offs and how firm each rank is. */
export default function RotationResilience({ env }: InsightProps) {
  const res = env.result
  const all = rankedRotations(res)
  const cur = currentRotation(res)
  const rec = res.meta.record

  if (!cur || all.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Which rotation holds up better under difficult historical conditions?">This section compares the rotations the engine returned.</SectionHeader>
        <Callout tone="warn" title="Not available for this analysis">
          The engine returned no rotations for this analysis, so there is nothing to compare.
        </Callout>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Which rotation holds up better under difficult historical conditions?"
        action={<TextLink to="/app/analysis?step=results&tab=compare">Open the full comparison table</TextLink>}
      >
        Each rotation was replayed through the {rec.start_year}–{rec.end_year} weather record. This section looks at the hard years, at stability, at what each alternative
        gains and gives up against your current rotation, and at how firmly each rank holds. Every value is a historical simulated index or indicator, not a yield and not a
        forecast.
      </SectionHeader>

      <ProfileCards env={env} all={all} cur={cur} />
      <div className="space-y-5">
        <ToughYears env={env} cur={cur} />
        <StabilityNotes all={all} cur={cur} />
      </div>
      <Tradeoffs all={all} cur={cur} />
      <RankRobustness env={env} all={all} />
    </div>
  )
}
