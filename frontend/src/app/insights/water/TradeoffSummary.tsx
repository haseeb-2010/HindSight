import { TableProperties } from 'lucide-react'
import { useState } from 'react'
import { ButtonRouterLink } from '../../../components/ui/Button'
import { InfoTip } from '../../../components/ui/InfoTip'
import { currentRotation, rankedRotations, rotationLabel } from '../../../lib/analysis'
import { fmtMm, fmtNum } from '../../../lib/format'
import type { AnalysisEnvelope } from '../../../lib/types'
import { METRIC_BY_ID, fmtMetricDelta, tradeoffSentence, type Tradeoff } from '../../lib/insights'
import { Panel, RotationPicker, TIP } from '../../results/shared'
import { waterTradeoff, waterValuesSentence } from './waterText'

/** The indicators the trade-off sentence may name. The sentence itself comes from insights.tradeoffSentence. */
const FOCUS = ['water', 'irrigation', 'forage', 'legume', 'p10', 'median', 'cover']
const TITLE = 'Water trade-off summary'

function ValuePair({ label, tip, t, name }: { label: string; tip: string; t: Tradeoff | undefined; name: string }) {
  const known = !!t && t.verdict !== 'unknown'
  return (
    <div className="min-w-0 rounded-2xl bg-sand/50 p-4">
      <dt className="flex items-center gap-1 text-[0.8125rem] leading-tight font-bold text-ink">
        {label}
        <InfoTip label={label}>{tip}</InfoTip>
      </dt>
      <dd className="mt-2">
        {known ? (
          <>
            <span className="grid grid-cols-2 gap-3">
              <span className="min-w-0">
                <span className="block font-display text-[1.375rem] leading-none font-semibold text-forest-950">{fmtMm(t.value)}</span>
                <span className="mt-1 block text-[0.75rem] leading-snug font-semibold text-ink">{name}</span>
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[1.375rem] leading-none font-semibold text-forest-950">{fmtMm(t.base)}</span>
                <span className="mt-1 block text-[0.75rem] leading-snug font-semibold text-peri-ink">Your current rotation</span>
              </span>
            </span>
            <span className="mt-3 block border-t border-border-strong/60 pt-2 text-[0.8125rem] font-bold text-ink tabular-nums">
              Difference: {fmtMetricDelta(t.metric, t.delta)} a year{t.verdict === 'similar' ? ` (about the same: under ${fmtNum(t.metric.similar)} mm)` : ''}
            </span>
          </>
        ) : (
          <span className="text-[0.9375rem] font-bold text-ink">Not available in this analysis</span>
        )}
      </dd>
    </div>
  )
}

/** Section C. One alternative against the current rotation, worded only from differences present in the engine output. */
export function TradeoffSummary({ env }: { env: AnalysisEnvelope }) {
  const res = env.result
  const cur = currentRotation(res)
  const alts = rankedRotations(res).filter((r) => r !== cur && !r.is_current)
  const [picked, setPicked] = useState<string | null>(null)
  const rot = alts.find((r) => r.id === picked) ?? alts[0]
  const mode = env.request?.water?.mode

  if (!cur || !rot) {
    return (
      <Panel title={TITLE}>
        <p className="text-[0.9375rem] text-ink">The engine returned no alternative rotation for this analysis, so there is no trade-off to describe.</p>
      </Panel>
    )
  }

  const demand = waterTradeoff(rot, cur, 'water')
  const irrigation = waterTradeoff(rot, cur, 'irrigation')
  // No irrigation applied to either rotation (always so in a rainfed analysis): stated in words, not as two zeros.
  const noIrrigation = rot.hindcast.irrigation_mm_per_year === 0 && cur.hindcast.irrigation_mm_per_year === 0
  const sentence = tradeoffSentence(rot, cur, FOCUS)
  const values = waterValuesSentence(rot, cur, !noIrrigation)
  const name = rotationLabel(rot)

  return (
    <Panel
      title={TITLE}
      action={
        <ButtonRouterLink to="/app/analysis?step=results&tab=compare" variant="secondary" icon={<TableProperties />} onClick={() => window.scrollTo({ top: 0 })}>
          Full comparison table
        </ButtonRouterLink>
      }
    >
      <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">Choose an alternative to set against your current rotation, {rotationLabel(cur)}.</p>
      <div className="mt-3">
        <RotationPicker rotations={alts} selected={rot.id} onSelect={setPicked} label="Alternative to compare with your current rotation" />
      </div>

      <div className="mt-5 grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0" aria-live="polite">
          <h4 className="text-[1.0625rem] leading-tight">{sentence ? 'A gain and a cost in this analysis' : 'The water values side by side'}</h4>
          <p className="mt-2 font-display text-[1.25rem] leading-snug font-medium tracking-[-0.01em] text-forest-950">{sentence ?? values ?? 'The engine did not return water values for both rotations.'}</p>
          {sentence && values && <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">{values}</p>}
          {!sentence && (
            <p className="mt-3 text-[0.875rem] leading-snug text-muted">
              No gain-and-cost sentence is written for this pair: on the indicators checked here (crop water demand, irrigation requirement, forage share, legume share, lower-decile and median
              season index, soil cover) the engine output does not show both a favourable and an unfavourable difference against your current rotation.
            </p>
          )}
          <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
            A comparison of engine values for these two rotations in this analysis. It is not a verdict on which rotation suits your farm.
          </p>
        </div>

        <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <ValuePair label="Crop water demand" tip={`${TIP.water} ${METRIC_BY_ID.water.context}`} t={demand} name={name} />
          {noIrrigation ? (
            <div className="min-w-0 rounded-2xl bg-sand/50 p-4">
              <dt className="flex items-center gap-1 text-[0.8125rem] leading-tight font-bold text-ink">
                Irrigation requirement
                <InfoTip label="Irrigation requirement">{TIP.irrigation}</InfoTip>
              </dt>
              <dd className="mt-2">
                <span className="block font-display text-[1.375rem] leading-none font-semibold text-forest-950">None in either</span>
                <span className="mt-2 block text-[0.8125rem] leading-snug text-ink">
                  {mode === 'rainfed' ? 'This analysis is rainfed, so the simulation applies no irrigation to any rotation.' : 'The engine returned an irrigation requirement of 0 mm a year for both rotations.'}
                </span>
              </dd>
            </div>
          ) : (
            <ValuePair label="Irrigation requirement" tip={TIP.irrigation} t={irrigation} name={name} />
          )}
        </dl>
      </div>
    </Panel>
  )
}
