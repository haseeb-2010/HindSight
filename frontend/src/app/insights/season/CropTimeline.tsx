import { ArrowRight } from 'lucide-react'
import { CROP_COLORS } from '../../../components/charts/MonthStrip'
import { cx } from '../../../lib/cx'
import { fmtPct } from '../../../lib/format'
import type { Rotation } from '../../../lib/types'
import { BARE_LABELS, joinList, monthSpanText } from '../../lib/insights'
import { FALLOW, HATCH, monthRuns, mostlyBareMonths, runsText, SHORT_MONTHS, yearLanes, yearSequence, type Row } from './calendar'
import { ActiveColumn, FigureHead, FOCUS_RING, MonthAxis, Readout, TrackRow, useMonthReader } from './track'

export function Swatch({ color, bare }: { color?: string; bare?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block h-3 w-3 shrink-0 rounded-[3px]', bare && 'bg-cream-50 ring-1 ring-sand-400 ring-inset')}
      style={bare ? { backgroundImage: HATCH } : { background: color }}
    />
  )
}

/**
 * The chosen rotation year as a crop calendar: one lane per crop and one for bare soil, from the engine
 * calendar only. Months at the higher bare-soil level are marked on the month scale.
 */
export function CropTimeline({
  rotation,
  rows,
  year,
  names,
  order,
  active,
  setActive,
}: {
  rotation: Rotation
  rows: Row[]
  year: number
  names: Record<string, string>
  order: string[]
  active: number | null
  setActive: (m: number | null) => void
}) {
  const { track, bind } = useMonthReader(active, setActive)
  const row = rows[year] ?? []
  const lanes = yearLanes(rows, year)
  const cyclic = rotation.cycle_years === 1
  const bareMonths = mostlyBareMonths(row)
  const marked = new Set(bareMonths)
  const name = (id: string) => (id === FALLOW ? 'Bare soil' : (names[id] ?? id))
  const color = (id: string) => CROP_COLORS[Math.max(0, order.indexOf(id)) % CROP_COLORS.length]
  const sequence = yearSequence(row)
  const yearWord = rotation.cycle_years > 1 ? `year ${year + 1} of ${rotation.cycle_years}` : 'every year'
  const cropLanes = lanes.filter((l) => l.id !== FALLOW)
  const bareText = bareMonths.length ? runsText(monthRuns(bareMonths, cyclic)) : null

  const cell = active !== null ? row[active] : null
  const sentence =
    (cropLanes.length
      ? `In ${rotation.cycle_years > 1 ? `year ${year + 1} of this rotation` : 'this rotation'}, the engine calendar lists ${joinList(
          cropLanes.map((l) => `${name(l.id)} in ${runsText(monthRuns(l.months, cyclic))}`),
        )}. `
      : 'The engine calendar lists no crop in this rotation year. ') + (bareText ? `The soil is mostly bare in ${bareText}.` : 'No month is mostly bare.')

  if (!row.some(Boolean)) {
    return <p className="text-[0.9375rem] font-semibold text-ink">Not available: the engine did not return a calendar for this rotation.</p>
  }

  return (
    <figure className="m-0 min-w-0">
      <FigureHead>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] font-bold text-ink" aria-label="Legend">
          <li className="inline-flex items-center gap-2">
            <Swatch color={cropLanes.length ? color(cropLanes[0].id) : 'var(--color-forest-800)'} /> Solid bar: crop in the ground
          </li>
          <li className="inline-flex items-center gap-2">
            <Swatch bare /> Hatched bar: bare soil
          </li>
          <li className="inline-flex items-center gap-2">
            {bareMonths.length > 0 ? (
              <>
                <span aria-hidden="true" className="rounded-full bg-ink px-2 py-0.5 text-[0.6875rem] leading-none font-extrabold text-cream-50">
                  {SHORT_MONTHS[bareMonths[0] - 1]}
                </span>
                Dark month label: {BARE_LABELS.higher.toLowerCase()}
              </>
            ) : (
              <>No month is at the level “{BARE_LABELS.higher.toLowerCase()}”, so none is marked</>
            )}
          </li>
        </ul>
        <Readout month={active}>
          {!cell
            ? 'not in the engine calendar'
            : cell.crop_id === FALLOW || cell.bare_frac >= 1
              ? 'bare soil, no crop in the ground'
              : `${name(cell.crop_id)}${cell.bare_frac > 0 ? `, bare on ${fmtPct(cell.bare_frac)} of days` : ', in the ground all month'}`}
        </Readout>
      </FigureHead>

      <div
        {...bind}
        aria-label={`Crop calendar for ${yearWord}: ${sequence.map((s) => `${name(s.crop_id)}, ${monthSpanText(s.months)}`).join('; ')}. Use the left and right arrow keys to read each month.`}
        className={cx('space-y-2.5', FOCUS_RING)}
      >
        <TrackRow>
          <div ref={track}>
            <MonthAxis active={active} marked={marked} />
          </div>
        </TrackRow>
        {lanes.map((l) => {
          const bare = l.id === FALLOW
          return (
            <TrackRow
              key={l.id}
              label={name(l.id)}
              swatch={<Swatch color={color(l.id)} bare={bare} />}
              sub={bare ? (bareText ? `Mostly bare ${bareText}` : 'No mostly bare month') : runsText(monthRuns(l.months, cyclic))}
            >
              <div className="relative h-9 overflow-hidden rounded-xl bg-sand/55">
                <span className="absolute inset-0 grid grid-cols-12" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i} className="border-l-2 border-white first:border-l-0" />
                  ))}
                </span>
                {l.bars.map((b, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={cx(
                      'bar-grow-x absolute inset-y-1.5 min-w-[3px]',
                      !b.openStart && 'rounded-l-full',
                      !b.openEnd && 'rounded-r-full',
                      bare && 'bg-cream-50 ring-1 ring-sand-400 ring-inset',
                    )}
                    style={{
                      left: `${(b.from / 12) * 100}%`,
                      width: `${((b.to - b.from) / 12) * 100}%`,
                      ...(bare ? { backgroundImage: HATCH } : { background: color(l.id) }),
                    }}
                  />
                ))}
                <ActiveColumn month={active} />
              </div>
            </TrackRow>
          )
        })}
      </div>

      <figcaption className="mt-5 rounded-2xl bg-sand/60 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">{sentence}</figcaption>

      <div className="mt-4">
        <p className="text-[0.8125rem] font-extrabold text-forest-950">Sequence through the year</p>
        <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {sequence.map((s, i) => (
            <li key={`${s.crop_id}-${s.months[0]}`} className="flex items-center gap-1.5">
              {i > 0 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="then" />}
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[0.8125rem] font-bold text-ink ring-1 ring-border-strong">
                <Swatch color={color(s.crop_id)} bare={s.crop_id === FALLOW} />
                <span>
                  <span className="font-extrabold text-forest-950">{name(s.crop_id)}</span> · {monthSpanText(s.months)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-4 max-w-3xl text-[0.8125rem] leading-snug text-muted">
        The engine calendar has one entry per month: the crop in the ground for most of that month, and the share of days with no crop. A bar that stops part-way through a month
        marks a sowing or harvest month; where the bare days fall inside that month is illustrative.
      </p>
    </figure>
  )
}
