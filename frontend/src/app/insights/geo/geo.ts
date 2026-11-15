// Geometry and wording shared by the "Location & data" section.
// Nothing here is an analysis result: these are sizes and distances worked out from coordinates and from
// the documented resolution of each data source (docs/DATA_SOURCES.md).
import { monthName } from '../../lib/insights'

/** Resolutions exactly as documented in docs/DATA_SOURCES.md. */
export const SOURCES = {
  power: {
    name: 'NASA POWER daily weather',
    grid: { latDeg: 0.5, lonDeg: 0.625 },
    resolution: 'Meteorology from MERRA-2 on a 0.5° × 0.625° grid, roughly 50 km. Solar radiation from CERES on a 1° × 1° grid.',
    short: '0.5° × 0.625° grid cell (MERRA-2), roughly 50 km',
  },
  soilgrids: {
    name: 'SoilGrids soil properties',
    resolution: '250 m grid. Values are read for the top 0–30 cm of soil.',
    short: '250 m grid, read for 0–30 cm',
  },
  modis: {
    name: 'MODIS NDVI vegetation greenness',
    resolution: 'MOD13Q1: 250 m pixels, one composite every 16 days.',
    short: '250 m pixel, 16-day composites (MOD13Q1)',
  },
} as const

/** Side of one SoilGrids or MODIS MOD13Q1 pixel. */
export const PIXEL_KM = 0.25

const KM_PER_DEGREE = 111.32
const rad = (deg: number) => (deg * Math.PI) / 180

/** Approximate ground size of one NASA POWER (MERRA-2) grid cell at a latitude: cells narrow towards the poles. */
export function cellSizeKm(lat: number): { ns: number; ew: number } {
  return { ns: SOURCES.power.grid.latDeg * KM_PER_DEGREE, ew: SOURCES.power.grid.lonDeg * KM_PER_DEGREE * Math.cos(rad(lat)) }
}

export interface Point {
  lat: number
  lon: number
}

/** Great-circle distance (haversine), in km. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

/** Which way `to` lies from `from`, as one of eight compass words. */
export function directionFrom(from: Point, to: Point): string {
  const y = Math.sin(rad(to.lon - from.lon)) * Math.cos(rad(to.lat))
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lon - from.lon))
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return COMPASS[Math.round(bearing / 45) % 8]
}

export const samePoint = (a: Point, b: Point) => Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6

/** "about 8 km", "about 170 km", "about 11,600 km": whole km below 100, tens below 1,000, hundreds above. */
export function aboutKm(km: number): string {
  if (km < 1) return 'less than 1 km'
  const step = km < 100 ? 1 : km < 1000 ? 10 : 100
  const v = Math.round(km / step) * step
  return `about ${v.toLocaleString('en-US')} km`
}

/** Two significant figures, for "roughly 52,000 times". */
export function roundSig2(v: number): number {
  if (!Number.isFinite(v) || v === 0) return 0
  const mag = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 1)
  return Math.round(v / mag) * mag
}

/** "2001-01-01" → "1 January 2001". Read as written, with no time-zone shift. Null when it is not an ISO date. */
export function fmtIsoDate(iso: string | null | undefined, short = true): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return null
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return `${Number(m[3])} ${monthName(month, short)} ${m[1]}`
}

export const isoYear = (iso: string | null | undefined): number | null => {
  const m = /^(\d{4})-/.exec(iso ?? '')
  return m ? Number(m[1]) : null
}

export const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`
export const fmtLon = (lon: number) => `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`
