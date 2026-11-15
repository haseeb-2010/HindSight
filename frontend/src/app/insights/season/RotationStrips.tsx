import { rotationLabel } from '../../../lib/analysis'
import { cx } from '../../../lib/cx'
import { fmtPct } from '../../../lib/format'
import type { Rotation } from '../../../lib/types'
import { BARE_LABELS, bareLevel, barePeriods, calendarByYear, fmtMetric, METRIC_BY_ID, monthName, monthSpanText } from '../../lib/insights'
import { LEVEL_CLASS } from './BareHeatmap'
import { SHORT_MONTHS } from './calendar'

/** Where the calendar shows mostly bare soil, in words, so the strip is never read by shading alone. */
function bareWords(r: Rotation): string {
  const periods = barePeriods(r, 'higher')
  if (periods.length === 0) return 'No mostly bare month'
  if (periods.length === 1 && periods[0].months.length >= 12 * Math.max(1, r.cycle_years)) return 'Mostly bare in every month'
  const spans = periods.map((p) => monthSpanText(p.months))
  if (r.cycle_years > 1 && periods.length === r.cycle_years && spans.every((s) => s === spans[0])) return `Mostly bare ${spans[0]}, in every year of the cycle`
  return `Mostly bare ${periods.map((p, i) => `${spans[i]}${r.cycle_years > 1 ? ` (from year ${p.year_offset + 1})` : ''}`).join(', then ')}`
}

/**
 * Small multiples: the bare-month pattern of every rotation the engine returned, in ranked order, on the
 * same twelve-month strip and the same three levels as the chart above. Choosing one opens it in the explorer.
 */
export function RotationStrips({ rotations, selected, onSelect }: { rotations: Rotation[]; selected: string; onSelect: (id: string) => void }) {
  const erosion = METRIC_BY_ID.erosion
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rotations.map((r) => {
        const on = r.id === selected
        const rows = calendarByYear(r)
        const hasCalendar = (r.calendar?.length ?? 0) > 0
        return (
          <li key={r.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(r.id)}
              className={cx(
                'flex h-full w-full flex-col rounded-2xl p-4 text-left transition-[box-shadow,background-color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950',
                on ? 'bg-lime-100 ring-2 ring-forest-950' : 'bg-white ring-1 ring-border-strong hover:bg-sand/40 hover:shadow-soft',
              )}
            >
              <span className="flex items-start gap-2.5">
                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-forest-950 px-1.5 font-display text-[0.8125rem] font-semibold text-lime tabular-nums">
                  #{r.scores?.rank}
                </span>
                <span className="min-w-0 pt-0.5 text-[0.9375rem] leading-snug font-extrabold text-forest-950">
                  {rotationLabel(r)}
                  {r.is_current && <span className="ml-1.5 rounded-full bg-peri px-2 py-0.5 text-[0.6875rem] font-extrabold whitespace-nowrap text-forest-950">Current</span>}
                </span>
              </span>

              {hasCalendar ? (
                <span className="mt-3 block" role="img" aria-label={`${bareWords(r)}.`}>
                  {rows.map((row, y) => (
                    <span key={y} className={cx('flex items-center gap-2', y > 0 && 'mt-1')}>
                      {r.cycle_years > 1 && <span className="w-5 shrink-0 text-[0.6875rem] font-extrabold text-muted">Y{y + 1}</span>}
                      <span className="grid flex-1 grid-cols-12 gap-[3px]">
                        {row.map((c, m) => (
                          <span
                            key={m}
                            title={c ? `${monthName(m + 1)}${r.cycle_years > 1 ? `, year ${y + 1}` : ''}: ${fmtPct(c.bare_frac)} of days bare (${BARE_LABELS[bareLevel(c.bare_frac)].toLowerCase()})` : undefined}
                            className={cx('h-5 rounded-[4px]', c ? LEVEL_CLASS[bareLevel(c.bare_frac)] : 'border border-dashed border-sand-400', c && 'ring-1 ring-forest-950/10 ring-inset')}
                          />
                        ))}
                      </span>
                    </span>
                  ))}
                  <span className={cx('mt-1 flex gap-2', r.cycle_years > 1 && 'pl-7')} aria-hidden="true">
                    <span className="grid flex-1 grid-cols-12 gap-[3px]">
                      {SHORT_MONTHS.map((m) => (
                        <span key={m} className="text-center text-[0.625rem] font-extrabold text-muted">
                          {m.charAt(0)}
                        </span>
                      ))}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="mt-3 block text-[0.8125rem] font-semibold text-ink">Calendar not available for this rotation.</span>
              )}

              {hasCalendar && <span className="mt-2.5 block text-[0.8125rem] leading-snug font-semibold text-ink">{bareWords(r)}</span>}
              <span className="mt-auto flex items-baseline justify-between gap-3 pt-3 text-[0.8125rem]">
                <span className="font-bold text-ink">{erosion.short}</span>
                <span className="font-display text-[1rem] font-semibold text-forest-950 tabular-nums">{fmtMetric(erosion, erosion.get(r))}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
