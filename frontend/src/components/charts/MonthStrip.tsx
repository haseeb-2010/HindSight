import type { CalendarCell } from '../../lib/types'
import { cx } from '../../lib/cx'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const CROP_COLORS = ['#33594a', '#5b6bb5', '#8aa396', '#d9530e']

interface MonthStripProps {
  calendar: CalendarCell[]
  cropOrder: string[]
  cropNames: Record<string, string>
  label: string
  showMonths?: boolean
  compact?: boolean
}

/** The rotation's 12-month calendar from the engine: filled when a crop is in the ground,
 *  partly filled for partial months, hatched when the soil is bare. */
export function MonthStrip({ calendar, cropOrder, cropNames, label, showMonths = true, compact }: MonthStripProps) {
  const years = [...new Set(calendar.map((c) => c.year_offset))].sort((a, b) => a - b)
  const ordered = [...calendar].sort((a, b) => a.year_offset * 12 + a.month - (b.year_offset * 12 + b.month))
  const at = (c: CalendarCell, d: number) => ordered[(ordered.indexOf(c) + d + ordered.length) % ordered.length]
  // A partly-bare month at the start of a crop's run is a sowing month, so its fill sits on the right.
  const sowing = (c: CalendarCell) => at(c, -1)?.crop_id !== c.crop_id && at(c, 1)?.crop_id === c.crop_id
  const describe = years
    .map((y) => {
      const cells = calendar.filter((c) => c.year_offset === y && c.crop_id !== 'fallow_bare' && c.bare_frac < 0.5)
      const byCrop = new Map<string, string[]>()
      cells.forEach((c) => byCrop.set(c.crop_id, [...(byCrop.get(c.crop_id) ?? []), MONTH_NAMES[c.month - 1]]))
      const parts = [...byCrop].map(([id, m]) => `${cropNames[id] ?? id} in ${m.join(', ')}`)
      return `${years.length > 1 ? `Year ${y + 1}: ` : ''}${parts.join('; ') || 'bare all year'}`
    })
    .join('. ')

  return (
    <div role="img" aria-label={`${label}. ${describe}.`}>
      {years.map((y) => (
        <div key={y} className={cx('flex items-center gap-2', y > 0 && 'mt-1.5')}>
          {years.length > 1 && <span className="w-6 shrink-0 text-[0.6875rem] font-extrabold text-muted">Y{y + 1}</span>}
          <div className="grid flex-1 grid-cols-12 gap-[3px]">
            {calendar
              .filter((c) => c.year_offset === y)
              .sort((a, b) => a.month - b.month)
              .map((c) => {
                const crop = c.crop_id !== 'fallow_bare'
                const color = CROP_COLORS[Math.max(0, cropOrder.indexOf(c.crop_id)) % CROP_COLORS.length]
                const fill = crop ? Math.max(0, Math.min(1, 1 - c.bare_frac)) : 0
                return (
                  <span
                    key={c.month}
                    className={cx(
                      'relative block overflow-hidden rounded-[4px] border border-sand-400/70',
                      compact ? 'h-4' : 'h-6',
                      'bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(207_203_194/0.55)_3px_4px)]',
                    )}
                  >
                    {fill > 0 && (
                      <span
                        className={cx('absolute inset-y-0 block', sowing(c) ? 'right-0' : 'left-0')}
                        style={{ width: `${fill * 100}%`, background: color }}
                      />
                    )}
                  </span>
                )
              })}
          </div>
        </div>
      ))}
      {showMonths && (
        <div className={cx('mt-1.5 flex gap-2', years.length > 1 && 'pl-8')} aria-hidden="true">
          <div className="grid flex-1 grid-cols-12 gap-[3px]">
            {MONTHS.map((m, i) => (
              <span key={i} className="text-center text-[0.625rem] font-extrabold text-muted">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
