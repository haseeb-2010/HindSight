import { Droplets } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { InfoTip } from '../../../components/ui/InfoTip'
import { currentRotation, rankedRotations, rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import { fmtMm, isNum } from '../../../lib/format'
import type { AnalysisEnvelope, Rotation } from '../../../lib/types'
import { WATER_MODES, waterLabel } from '../../lib/labels'
import { Chip, Panel, TIP } from '../../results/shared'
import { deltaNote, measureSentence, waterTradeoff, type WaterMeasure } from './waterText'

const DEFINITION: Record<WaterMeasure, string> = {
  water: 'Modelled crop evapotranspiration requirement.',
  irrigation: 'Water applied by the simulation to satisfy the specified irrigation behaviour.',
}

const valueOf = (r: Rotation, id: WaterMeasure) => (id === 'water' ? r.hindcast.water_demand_mm_per_year : r.hindcast.irrigation_mm_per_year)

function MeasureHeading({ title, tip, id }: { title: string; tip: string; id: WaterMeasure }) {
  return (
    <>
      <h4 className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[1.0625rem] leading-tight">
        {title}
        <span className="font-sans text-[0.75rem] font-bold tracking-normal text-muted">(mm per year)</span>
        <InfoTip label={title}>{tip}</InfoTip>
      </h4>
      <p className="mt-1 text-[0.875rem] leading-snug text-ink">{DEFINITION[id]}</p>
    </>
  )
}

/** One of the two measures as ranked bars: the current rotation first, then the alternatives in rank order. */
function MeasureBars({ id, title, tip, order, cur, max, active, onActive, sentence }: {
  id: WaterMeasure
  title: string
  tip: string
  order: Rotation[]
  cur: Rotation
  max: number
  active: string | null
  onActive: (id: string | null) => void
  sentence: string | null
}) {
  return (
    <div className="min-w-0">
      <MeasureHeading title={title} tip={tip} id={id} />
      {/* Leaving is handled on the list, so moving from one row to the next does not flicker through "nothing selected". */}
      <ul className="mt-3 space-y-1" onPointerLeave={(e) => e.pointerType === 'mouse' && onActive(null)}>
        {order.map((r) => {
          const v = valueOf(r, id)
          const note = r === cur ? 'The rotation the others are compared with' : deltaNote(waterTradeoff(r, cur, id))
          const on = active === r.id
          return (
            <li
              key={r.id}
              onPointerEnter={(e) => e.pointerType === 'mouse' && onActive(r.id)}
              onPointerUp={(e) => e.pointerType !== 'mouse' && onActive(on ? null : r.id)}
              className={cx('-mx-2.5 cursor-default rounded-xl px-2.5 py-2 transition-colors', on ? 'bg-cream ring-1 ring-border-strong' : 'ring-1 ring-transparent')}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-[0.8125rem] leading-snug font-bold text-ink">
                  {r === cur ? (
                    <span className="mr-1.5 font-extrabold text-peri-ink">Current ·</span>
                  ) : (
                    <span className="mr-1.5 font-display font-semibold text-forest-950 tabular-nums">#{r.scores?.rank}</span>
                  )}
                  {rotationLabel(r)}
                </span>
                <span className="shrink-0 font-display text-[0.9375rem] leading-snug font-semibold text-forest-950 tabular-nums">{isNum(v) ? fmtMm(v) : '—'}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                <div
                  className={cx('bar-grow-x h-full rounded-full transition-opacity duration-200', r === cur ? 'bg-peri-chart' : 'bg-forest-800')}
                  style={{ width: `${isNum(v) && v > 0 && max > 0 ? Math.max(1.5, (v / max) * 100) : 0}%`, opacity: active === null || on ? 1 : 0.45 }}
                />
              </div>
              {note && <p className="mt-1 text-[0.75rem] leading-snug text-muted tabular-nums">{note}</p>}
            </li>
          )
        })}
      </ul>
      {sentence && <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">{sentence}</p>}
    </div>
  )
}

const LINK = 'rounded-sm font-extrabold text-forest-950 underline decoration-sage decoration-[1.5px] underline-offset-[3px] hover:decoration-forest-950'

/** Shown in place of the irrigation bars when the engine applied no irrigation to any rotation. */
function NoIrrigation({ mode }: { mode: string | undefined }) {
  return (
    <div className="min-w-0">
      <MeasureHeading title="Irrigation requirement" tip={TIP.irrigation} id="irrigation" />
      <div className="mt-3 rounded-2xl bg-sand/60 p-4">
        {mode === 'rainfed' ? (
          <>
            <p className="font-display text-[1.25rem] leading-tight font-semibold text-forest-950">Zero for every rotation, by definition</p>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">
              This analysis is rainfed, so the simulation applies no irrigation water to your current rotation or to any alternative. That follows from the rainfed setting. It is not a finding
              about the rotations, so there are no bars to compare here.
            </p>
            <p className="mt-2 text-[0.875rem] leading-snug text-ink">
              To explore irrigation, change the water setting in{' '}
              <Link to="/app/analysis?step=soil" className={LINK} onClick={() => window.scrollTo({ top: 0 })}>
                Farm Analysis
              </Link>{' '}
              and run the analysis again.
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[1.25rem] leading-tight font-semibold text-forest-950">Zero for every rotation</p>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">
              {mode
                ? 'The engine returned an irrigation requirement of 0 mm a year for your current rotation and for every alternative, so there are no bars to compare here.'
                : 'The engine returned an irrigation requirement of 0 mm a year for every rotation. The irrigation mode was not stored with this analysis, so HindSight cannot say here whether it ran as rainfed.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Section A. Crop water demand and irrigation requirement for the current rotation and the alternatives,
 * as two separate measures on one millimetre scale. They are never added together.
 */
export function WaterComparison({ env }: { env: AnalysisEnvelope }) {
  const [active, setActive] = useState<string | null>(null)
  const res = env.result
  const cur = currentRotation(res)
  const mode = env.request?.water?.mode
  const cap = env.request?.water?.seasonal_cap_mm

  if (!cur) {
    return (
      <Panel title="Water comparison">
        <p className="text-[0.9375rem] text-ink">The engine did not return any rotation for this analysis, so there is nothing to compare.</p>
      </Panel>
    )
  }

  const alts = rankedRotations(res).filter((r) => r !== cur)
  const order = [cur, ...alts]
  const irrigationValues = order.map((r) => r.hindcast.irrigation_mm_per_year)
  // No irrigation applied to any rotation (always the case for a rainfed analysis): say so instead of drawing empty bars.
  const noIrrigation = irrigationValues.every((v) => v === 0)
  const max = Math.max(...order.map((r) => r.hindcast.water_demand_mm_per_year), ...irrigationValues, 0)
  const at = order.find((r) => r.id === active) ?? null

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return setActive(null)
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const i = order.findIndex((r) => r.id === active)
    const n = order.length
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : i < 0 ? (e.key === 'ArrowUp' ? n - 1 : 0) : Math.max(0, Math.min(n - 1, i + (e.key === 'ArrowUp' ? -1 : 1)))
    setActive(order[next].id)
  }

  // The selected rotation's values. Where two charts stack, it follows the reader along the bottom edge of the screen,
  // so it must stay a direct child of the element that wraps both charts.
  const readout = (
    <div
      aria-live="polite"
      className={cx(
        'rounded-2xl bg-sand/60 px-4 py-3 text-[0.8125rem] leading-snug text-ink sm:flex sm:min-h-[4.75rem] sm:items-center',
        !noIrrigation && 'mt-5',
        !noIrrigation && at && 'max-lg:pointer-events-none max-lg:sticky max-lg:bottom-3 max-lg:z-10 max-lg:bg-sand max-lg:shadow-soft max-lg:ring-1 max-lg:ring-border-strong',
      )}
    >
      {at ? (
        <dl className={cx('grid w-full grid-cols-2 gap-x-8 gap-y-2', !noIrrigation && 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]')}>
          <div className={cx('col-span-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1', !noIrrigation && 'sm:col-span-1 sm:content-center')}>
            <dt className="font-extrabold text-forest-950">{rotationLabel(at)}</dt>
            <dd>{at === cur ? <Chip tone="peri">Current rotation</Chip> : <Chip tone="white">Rank #{at.scores?.rank} of {order.length}</Chip>}</dd>
          </div>
          {/* The differences are printed in each row as well, so the narrow sticky version leaves them out. */}
          <div className="min-w-0">
            <dt className="font-bold">Crop water demand</dt>
            <dd className="font-display text-[1rem] font-semibold text-forest-950 tabular-nums">{fmtMm(at.hindcast.water_demand_mm_per_year)} a year</dd>
            {at !== cur && <dd className={cx('text-[0.75rem] font-semibold tabular-nums', !noIrrigation && 'max-sm:hidden')}>{deltaNote(waterTradeoff(at, cur, 'water'))}</dd>}
          </div>
          <div className="min-w-0">
            <dt className="font-bold">
              Irrigation<span className="max-sm:hidden"> requirement</span>
            </dt>
            <dd className="font-display text-[1rem] font-semibold text-forest-950 tabular-nums">
              {noIrrigation ? (mode === 'rainfed' ? 'None (rainfed)' : 'None') : `${fmtMm(at.hindcast.irrigation_mm_per_year)} a year`}
            </dd>
            {at !== cur && !noIrrigation && <dd className="text-[0.75rem] font-semibold tabular-nums max-sm:hidden">{deltaNote(waterTradeoff(at, cur, 'irrigation'))}</dd>}
          </div>
        </dl>
      ) : (
        <p className="font-semibold">
          Hover or tap a rotation to read {noIrrigation ? 'its values' : 'both measures for it'} together. With a keyboard, focus the {noIrrigation ? 'chart' : 'charts'} and use the ↑ and ↓ keys.
        </p>
      )}
    </div>
  )

  const footnote = (
    <p className="max-w-4xl text-[0.8125rem] leading-snug text-muted">
      {noIrrigation ? '' : 'Both charts use the same millimetre scale. '}Crop water demand adds up the modelled requirement on the days a crop is in the ground, so a rotation with more crops or longer
      seasons usually shows a higher figure. The irrigation requirement is the water the simulation supplied under the chosen mode. Neither is measured water use on your farm.
    </p>
  )

  return (
    <Panel title="Water comparison">
      <div className="flex items-start gap-3.5 rounded-2xl bg-sand/60 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime">
          <Droplets className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.75rem] font-extrabold tracking-[0.06em] text-ink uppercase">Irrigation mode in this analysis</p>
          <p className="mt-0.5 font-display text-[1.1875rem] leading-tight font-semibold text-forest-950">{mode ? waterLabel(mode, cap) : 'Not recorded with this analysis'}</p>
          <p className="mt-1 max-w-3xl text-[0.875rem] leading-snug text-ink">
            {mode && WATER_MODES[mode] ? WATER_MODES[mode].description : 'The request this analysis ran with was not stored, so the irrigation mode cannot be shown.'}
            {mode === 'limited' && isNum(cap) && <> The seasonal cap is {fmtMm(cap)} for each crop season: once the simulation has applied that much to a crop, it stops irrigating it.</>}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-bold text-ink" aria-label="Chart legend">
          <li className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-5 rounded-full bg-peri-chart" /> Your current rotation
          </li>
          <li className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-5 rounded-full bg-forest-800" /> Alternatives, in rank order
          </li>
        </ul>
        <p className="text-[0.8125rem] font-semibold text-muted">Two separate measures. They are not added together.</p>
      </div>

      <div
        tabIndex={0}
        role="group"
        aria-label={`Water comparison ${noIrrigation ? 'chart' : 'charts'}. Use the up and down arrow keys to read the values for one rotation at a time.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="mt-4 rounded-2xl outline-offset-[14px]"
      >
        {noIrrigation ? (
          // One chart only: the statement, the readout and the note share the second column.
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <MeasureBars id="water" title="Crop water demand" tip={TIP.water} order={order} cur={cur} max={max} active={active} onActive={setActive} sentence={measureSentence('water', cur, alts)} />
            <div className="flex min-w-0 flex-col gap-4">
              <NoIrrigation mode={mode} />
              {readout}
              {footnote}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
              <MeasureBars id="water" title="Crop water demand" tip={TIP.water} order={order} cur={cur} max={max} active={active} onActive={setActive} sentence={measureSentence('water', cur, alts)} />
              <MeasureBars
                id="irrigation"
                title="Irrigation requirement"
                tip={TIP.irrigation}
                order={order}
                cur={cur}
                max={max}
                active={active}
                onActive={setActive}
                sentence={measureSentence('irrigation', cur, alts)}
              />
            </div>
            {readout}
          </>
        )}
      </div>

      {!noIrrigation && <div className="mt-4">{footnote}</div>}
    </Panel>
  )
}
