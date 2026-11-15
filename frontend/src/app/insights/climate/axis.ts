import { fmtNum } from '../../../lib/format'

/** A round maximum and evenly spaced ticks for an axis that starts at zero. `whole` keeps the steps whole (day counts). */
export function niceAxis(dataMax: number, whole = false, target = 4): { max: number; ticks: number[]; digits: number } {
  if (!(dataMax > 0)) return { max: 1, ticks: [0, 1], digits: 0 }
  const raw = dataMax / target
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 && !(whole && pow === 1) ? 2.5 : n <= 5 ? 5 : 10) * pow
  if (whole && step < 1) step = 1
  const count = Math.max(1, Math.ceil(dataMax / step - 1e-9))
  const ticks = Array.from({ length: count + 1 }, (_, i) => Number((i * step).toPrecision(12)))
  return { max: count * step, ticks, digits: step >= 1 && Number.isInteger(step) ? 0 : step >= 0.1 ? 1 : 2 }
}

/** "134 days", "1 day", "1,934 mm": a value with the engine's unit. */
export function withUnit(v: number | null | undefined, unit: string, digits = 0): string {
  const text = fmtNum(v, digits)
  if (text === '—') return text
  return `${text} ${unit === 'days' && text === '1' ? 'day' : unit}`
}

/** A signed value: "+9.2 days", "−192 mm", "0.0 days". The minus is a real minus sign. */
export function signed(v: number | null | undefined, unit: string, digits = 0): string {
  const text = fmtNum(typeof v === 'number' ? Math.abs(v) : v, digits)
  if (text === '—' || typeof v !== 'number') return '—'
  const zero = Number(text.replace(/,/g, '')) === 0
  return `${zero ? '' : v > 0 ? '+' : '−'}${text} ${unit}`
}

/** Decimal places used for period means, matching the sentences in app/lib/insights.ts. */
export const meanDigits = (unit: string) => (unit === 'mm' ? 0 : 1)
