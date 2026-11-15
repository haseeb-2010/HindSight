import { Quote, X } from 'lucide-react'
import { currentRotation, rankedRotations, rotationLabel } from '../../lib/analysis'
import type { AnalysisEnvelope, Rotation } from '../../lib/types'
import { Callout } from '../components/controls'
import { Chip, Panel } from '../results/shared'
import { SectionHeader, TextLink } from './resilience/shared'
import { CurrentProfile } from './soil/CurrentProfile'
import { Opportunities } from './soil/Opportunities'
import { soilBenefits } from './soil/proxies'
import { ScaledScores } from './soil/ScaledScores'
import type { InsightProps } from './types'

const TITLE = 'Where could your rotation do more for the soil?'

/** The engine's own benefit sentences about soil, quoted as the engine wrote them. */
function EngineBenefits({ env, all }: { env: AnalysisEnvelope; all: Rotation[] }) {
  const rows = all.map((r) => ({ r, benefits: soilBenefits(r) })).filter((x) => x.benefits.length > 0)
  const explained = all.some((r) => r.explanation?.benefits !== undefined)
  return (
    <Panel title="What the engine itself says about soil">
      <p className="-mt-1 text-[0.875rem] leading-relaxed text-ink">
        The engine writes a short list of benefits for each rotation from fixed sentence templates filled with this run’s numbers. These are the ones that concern soil,
        quoted word for word from engine v{env.result.meta.engine_version}.
      </p>
      {!explained ? (
        <Callout tone="plain" title="Not available for this analysis" className="mt-4">
          The engine did not return its explanation for this run.
        </Callout>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-sand/60 p-4 text-[0.9375rem] leading-relaxed font-semibold text-ink">
          The engine lists no soil-related benefit for any of the {all.length} rotations in this analysis.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map(({ r, benefits }) => (
            <li key={r.id} className={r.is_current ? 'rounded-2xl bg-peri-50 p-4' : 'rounded-2xl bg-sand/50 p-4'}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem] leading-snug font-extrabold text-forest-950">
                <span className="font-display font-semibold tabular-nums">#{r.scores?.rank}</span>
                {rotationLabel(r)}
                {r.is_current && <Chip tone="peri">Current</Chip>}
              </p>
              <ul className="mt-2 space-y-1.5">
                {benefits.map((b) => (
                  <li key={b} className="flex gap-2 text-[0.9375rem] leading-snug text-ink">
                    <Quote className="mt-1 h-3.5 w-3.5 shrink-0 text-forest-800" aria-hidden="true" />
                    <q>{b}</q>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[0.8125rem] leading-snug text-muted">
        Where a sentence says a legume fixes nitrogen for the following crop, that is the engine’s general assumption about legumes. Nitrogen is not measured or balanced
        in this analysis. “Of the rotations compared” means the rotations in this run only.
      </p>
    </Panel>
  )
}

const NOT: { what: string; why: string }[] = [
  {
    what: 'Not measured soil organic carbon',
    why: 'Soil cover and the crop-residue class are soil-care contribution proxies. No soil sample or carbon model stands behind them.',
  },
  {
    what: 'Not a nitrogen balance',
    why: 'The legume share is a potential nitrogen contribution indicator. How much nitrogen a legume leaves, and how much the next crop takes up, is not calculated.',
  },
  {
    what: 'Not a soil-loss estimate',
    why: 'The heavy-rain exposure indicator counts heavy-rain days that fell on bare soil. Slope, soil type and runoff are not in it.',
  },
  {
    what: 'Nutrients, pests and disease are not modelled',
    why: 'The same-family count is a prompt for a local conversation about carry-over between related crops. It does not enter the ranking.',
  },
]

function NotThese() {
  return (
    <Panel title="What these proxies are not">
      <ul className="-mt-1 space-y-3.5">
        {NOT.map((n) => (
          <li key={n.what} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal-50 text-signal-ink ring-1 ring-signal/30" aria-hidden="true">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <p className="min-w-0 text-[0.9375rem] leading-snug text-ink">
              <strong className="block font-extrabold text-forest-950">{n.what}</strong>
              {n.why}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
        <TextLink to="/app/science">How each indicator is calculated</TextLink>
      </div>
    </Panel>
  )
}

/** Field Intelligence, "Soil-care opportunities": the engine's structural soil-care proxies, read for this farm. */
export default function SoilCare({ env }: InsightProps) {
  const res = env.result
  const all = rankedRotations(res)
  const cur = currentRotation(res)

  if (!cur || all.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader title={TITLE}>This section reads the soil-care proxies of the rotations the engine returned.</SectionHeader>
        <Callout tone="warn" title="Not available for this analysis">
          The engine returned no rotations for this analysis, so there are no soil-care proxies to show.
        </Callout>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SectionHeader title={TITLE} action={<TextLink to="/app/analysis?step=results&tab=compare">Open the full comparison table</TextLink>}>
        HindSight does not sample or model your soil. It reads soil-care proxies from each rotation’s calendar and crop list: how long the soil is covered, whether a legume is
        grown, what residue the crops leave, and how much heavy rain meets bare ground. This section shows where the alternatives differ from your current rotation on those
        proxies, as things worth reviewing rather than advice.
      </SectionHeader>

      <CurrentProfile cur={cur} />
      <Opportunities all={all} cur={cur} />
      <ScaledScores env={env} all={all} cur={cur} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <EngineBenefits env={env} all={all} />
        <NotThese />
      </div>
    </div>
  )
}
