const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function fmtIndex(v: number | null | undefined): string {
  return isNum(v) ? v.toFixed(2) : '—'
}

export function fmtMm(v: number | null | undefined): string {
  return isNum(v) ? `${nf0.format(v)} mm` : '—'
}

export function fmtNum(v: number | null | undefined, digits = 0): string {
  return isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—'
}

export function fmtPct(fraction: number | null | undefined, digits = 0): string {
  return isNum(fraction) ? `${(fraction * 100).toFixed(digits)}%` : '—'
}

export function fmtP(p: number | null | undefined): string {
  if (!isNum(p)) return 'p n/a'
  if (p < 0.001) return 'p < 0.001'
  return `p = ${p < 0.01 ? p.toFixed(3) : p.toFixed(2)}`
}

export function fmtCoord(lat: number, lon: number): string {
  const la = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`
  return `${la}, ${lo}`
}

export function fmtTexture(t: string | null | undefined): string {
  if (!t) return 'Unknown texture'
  const s = t.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtElapsed(ms: number | null | undefined): string | null {
  if (!isNum(ms)) return null
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
