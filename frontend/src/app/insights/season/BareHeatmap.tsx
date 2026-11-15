import { cx } from '../../../lib/cx'
import { fmtPct } from '../../../lib/format'
import type { Rotation } from '../../../lib/types'
import { BARE_LABELS, bareLevel, monthName, type BareLevel } from '../../lib/insights'
import { bareRuleText, FALLOW, type Row } from './calendar'
import { FigureHead, FOCUS_RING, MonthAxis, Readout, TrackRow, useMonthReader } from './track'

/** One hue from light to dark: the darker the cell, the larger the bare share of the month. */
export const LEVEL_CLASS: Record<BareLevel, string> = {
  lower: 'bg-sand text-ink',
  moderate: 'bg-sand-400 text-forest-950',
  higher: 'bg-ink text-cream-50',
}

export const LEVELS: BareLevel[] = ['lower', 'moderate', 'higher']

export function LevelLegend({ className }: { className?: string }) {
  const rule = bareRuleText()
  return (
    <ul className={cx('flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] text-ink', className)} aria-label="Legend">
      {LEVELS.map((l) => (
        <li key={l} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={cx('h-4 w-4 shrink-0 rounded-[5px] ring-1 ring-forest-950/10 ring-inset', LEVEL_CLASS[l])} />
          <span>
            <span className="font-extrabold text-forest-950">{BARE_LABELS[l]}</span>: {rule[l]}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Twelve months by rotation year, shaded by the level of the engine's modelled bare-soil fraction.
 * Every cell prints its percentage, so the shading is never the only cue.
 */
export function BareHeatmap({
  rotation,
  rows,
  year,
  names,
  active,
  setActive,
}: {
  rotation: Rotation
  rows: Row[]
  year: number
  names: Record<string, string>
  active: number | null
  setActive: (m: number | null) => void
}) {
  const { track, bind } = useMonthReader(active, setActive)
  const multi = rotation.cycle_years > 1
  const cells = rows.flat().filter((c) => c !== null)
  const count = (l: BareLevel) => cells.filter((c) => bareLevel(c.bare_frac) === l).length
  const total = cells.length
  const cell = active !== null ? rows[year]?.[active] : null
  const sentence =
    total === 0
      ? 'The engine did not return a calendar for this rotation.'
      : `Of the ${total} months in ${multi ? `the ${rotation.cycle_years}-year cycle` : 'the year'}, ${count('higher')} ${count('higher') === 1 ? 'is' : 'are'} at the higher level, ${count(
          'moderate',
        )} at the moderate level and ${count('lower')} at the lower level.`

  return (
    <figure className="m-0 min-w-0">
      <FigureHead>
        <LevelLegend />
        <Readout month={active}>
          {cell ? `${fmtPct(cell.bare_frac)} of days bare${multi ? ` in year ${year + 1}` : ''} · ${BARE_LABELS[bareLevel(cell.bare_frac)].toLowerCase()}` : 'not in the engine calendar'}
        </Readout>
      </FigureHead>

      <div
        {...bind}
        aria-label={`Modelled bare-soil fraction for each month${multi ? ` of the ${rotation.cycle_years}-year cycle` : ''}, as a percentage of the month’s days. ${sentence} Use the left and right arrow keys to read each month; a table of all values follows.`}
        className={cx('space-y-1.5', FOCUS_RING)}
      >
        {rows.map((row, y) => (
          <TrackRow key={y} label={multi ? `Year ${y + 1}` : 'Every year'} sub={multi && y === year ? 'shown in the calendar above' : undefined}>
            <div ref={y === 0 ? track : undefined} className="grid grid-cols-12" aria-hidden="true">
              {row.map((c, m) => {
                const level = c ? bareLevel(c.bare_frac) : null
                const on = active === m && y === year
                return (
                  <span key={m} className="px-px">
                    <span
                      className={cx(
                        'flex h-11 items-center justify-center rounded-lg text-[0.6875rem] font-extrabold tabular-nums transition-shadow sm:text-[0.8125rem]',
                        level ? LEVEL_CLASS[level] : 'border border-dashed border-sand-400 text-muted',
                        on && 'ring-2 ring-forest-950 ring-offset-2 ring-offset-white',
                        active === m && !on && 'ring-1 ring-forest-950/40',
                      )}
                    >
                      {c ? (
                        <>
                          {Math.round(c.bare_frac * 100)}
                          <span className="hidden sm:inline">%</span>
                        </>
                      ) : (
                        '–'
                      )}
                    </span>
                  </span>
                )
              })}
            </div>
          </TrackRow>
        ))}
        <TrackRow sub="Bare days, % of the month">
          <MonthAxis active={active} />
        </TrackRow>
      </div>
      <p className="mt-1.5 text-[0.75rem] font-semibold text-muted sm:hidden">Each number is the bare days as a percentage of the month.</p>

      <figcaption className="mt-5 rounded-2xl bg-sand/60 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">{sentence}</figcaption>

      <div className="sr-only">
        <table>
          <caption>Modelled bare-soil fraction by month, as a percentage of the month’s days, with the crop the engine calendar lists</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {rows.map((_, y) => (
                <th key={y} scope="col">
                  {multi ? `Year ${y + 1}` : 'Every year'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, m) => (
              <tr key={m}>
                <th scope="row">{monthName(m + 1)}</th>
                {rows.map((row, y) => {
                  const c = row[m]
                  return (
                    <td key={y}>
                      {c
                        ? `${fmtPct(c.bare_frac)}, ${BARE_LABELS[bareLevel(c.bare_frac)].toLowerCase()}, ${c.crop_id === FALLOW ? 'no crop' : (names[c.crop_id] ?? c.crop_id)}`
                        : 'not available'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
