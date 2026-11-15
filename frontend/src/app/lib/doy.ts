// Day-of-year helpers on the engine's 365-day calendar (29 February does not exist in the engine).
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const CUM = DAYS.reduce<number[]>((acc, d, i) => [...acc, (acc[i] ?? 0) + d], [0])

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3))

export function daysInMonth(month: number): number {
  return DAYS[Math.min(12, Math.max(1, month)) - 1]
}

/** month 1–12 and day 1–31 to plant_doy 1–365; the day is clamped to the month's length. */
export function toDoy(month: number, day: number): number {
  const m = Math.min(12, Math.max(1, Math.round(month)))
  const d = Math.min(daysInMonth(m), Math.max(1, Math.round(day)))
  return CUM[m - 1] + d
}

export function fromDoy(doy: number): { month: number; day: number } {
  const n = Math.min(365, Math.max(1, Math.round(doy)))
  const m = CUM.findIndex((c, i) => n > c && n <= CUM[i + 1])
  return { month: m + 1, day: n - CUM[m] }
}

export function doyLabel(doy: number): string {
  const { month, day } = fromDoy(doy)
  return `${day} ${MONTH_SHORT[month - 1]}`
}
