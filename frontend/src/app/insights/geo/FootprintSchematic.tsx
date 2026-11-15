import { Ban } from 'lucide-react'
import { useState } from 'react'
import { useElementWidth } from '../../../hooks/useElementWidth'
import { cx } from '../../../lib/cx'
import { fmtCoord, fmtNum } from '../../../lib/format'
import { weatherCell } from '../../components/LocationMap'
import { PIXEL_KM, SOURCES, cellSizeKm, directionFrom, roundSig2, type Point } from './geo'

const FOREST = '#1c3a2a'
const FOREST_800 = '#33594a'
const PERI = '#5b6bb5'
const LIME = '#eef384'
const INK = '#3b3935'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const km = (v: number) => fmtNum(Math.round(v))

// Geospatial integrity: the limits of the data, stated where the footprints are shown.
const NOT_DRAWN: { what: string; why: string }[] = [
  { what: 'Field boundaries', why: 'HindSight analyses one point and does not know the outline of any field.' },
  {
    what: 'Maps of soil moisture, greenness, stress or heavy-rain exposure',
    why: 'Each value is a single estimate for a whole grid cell or pixel, so there is no pattern inside a farm to map.',
  },
  { what: 'Zones inside a farm', why: 'The engine does not identify any. Two fields in the same weather cell get the same weather.' },
]

interface Item {
  id: 'cell' | 'pixel' | 'modis'
  name: string
  detail: string
}

/**
 * The size of each data source's footprint, drawn to one scale: the approximate NASA POWER grid cell
 * with a 250 m pixel inside it. A schematic of sizes and positions only. No measured value is drawn.
 *
 * `ndviPoint` is the MODIS pixel location when it is not the farm point; null otherwise.
 */
export function FootprintSchematic({ site, ndviPoint }: { site: Point; ndviPoint: Point | null }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(420)
  const [active, setActive] = useState<Item['id'] | null>(null)

  const size = cellSizeKm(site.lat)
  const areaKm2 = size.ns * size.ew
  const pixelHa = PIXEL_KM * PIXEL_KM * 100
  const ratio = areaKm2 / (PIXEL_KM * PIXEL_KM)
  const [[south, west], [north, east]] = weatherCell(site.lat, site.lon)
  const inCell = (p: Point) => p.lat >= south && p.lat <= north && p.lon >= west && p.lon <= east
  const modis = ndviPoint && inCell(ndviPoint) ? ndviPoint : null
  const modisOutside = !!ndviPoint && !modis

  // one scale for everything: pixels per km
  const pad = { left: 30, right: 6, top: 26, bottom: 44 }
  const plotW = Math.max(120, width - pad.left - pad.right)
  const scale = Math.min(plotW / size.ew, 280 / size.ns)
  const cellW = size.ew * scale
  const cellH = size.ns * scale
  const x0 = pad.left + (plotW - cellW) / 2
  const y0 = pad.top
  const height = pad.top + cellH + pad.bottom
  const px = PIXEL_KM * scale
  const at = (p: Point) => ({ x: x0 + clamp01((p.lon - west) / (east - west)) * cellW, y: y0 + clamp01((north - p.lat) / (north - south)) * cellH })
  const farm = at(site)
  const sat = modis ? at(modis) : null
  const barKm = size.ew >= 30 ? 10 : 5

  const cellItem: Item = {
    id: 'cell',
    name: 'Approximate NASA POWER grid cell',
    detail: `0.5° × 0.625°: about ${km(size.ns)} km north to south and ${km(size.ew)} km east to west at this latitude. Each daily weather value is one estimate for the whole cell.`,
  }
  const pixelItem: Item = {
    id: 'pixel',
    name: 'One 250 m pixel at the farm point',
    detail: `250 m × 250 m, or ${fmtNum(pixelHa, 2)} hectares: the footprint of one SoilGrids value${ndviPoint ? '' : ' and of one MODIS NDVI value'}. The dot inside the ring is drawn to scale.`,
  }
  const modisItem: Item | null = modis
    ? {
        id: 'modis',
        name: 'MODIS pixel used for the greenness check',
        detail: `250 m × 250 m at ${fmtCoord(modis.lat, modis.lon)}, ${directionFrom(site, modis)} of the farm point but inside the same weather cell. The dot inside the ring is drawn to scale.`,
      }
    : null
  const items = [cellItem, pixelItem, ...(modisItem ? [modisItem] : [])]
  const shown = items.find((i) => i.id === active)
  const on = (id: Item['id']) => ({
    tabIndex: 0,
    role: 'img' as const,
    onMouseEnter: () => setActive(id),
    onMouseLeave: () => setActive((a) => (a === id ? null : a)),
    onFocus: () => setActive(id),
    onBlur: () => setActive((a) => (a === id ? null : a)),
    // the shape itself shows hover and keyboard focus (heavier outline, halo), so the browser's box outline is not needed
    className: 'cursor-help outline-none',
  })

  // labels sit below the farm ring and above the satellite ring so they cannot collide
  const label = (p: { x: number; y: number }, below: boolean) => ({
    x: p.x < x0 + cellW / 2 ? Math.max(x0 + 4, p.x - 10) : Math.min(x0 + cellW - 4, p.x + 10),
    y: below ? p.y + 26 : p.y - 16,
    anchor: (p.x < x0 + cellW / 2 ? 'start' : 'end') as 'start' | 'end',
  })
  const farmBelow = farm.y + 34 < y0 + cellH
  const farmLabel = label(farm, farmBelow)
  const satLabel = sat ? label(sat, sat.y - 26 < y0 || (!farmBelow && Math.abs(sat.x - farm.x) < 90)) : null

  const rows = [
    { key: 'power', name: SOURCES.power.name, res: SOURCES.power.short, here: `About ${km(size.ns)} km × ${km(size.ew)} km at this latitude` },
    { key: 'soilgrids', name: SOURCES.soilgrids.name, res: SOURCES.soilgrids.short, here: `250 m × 250 m (${fmtNum(pixelHa, 2)} ha)` },
    { key: 'modis', name: SOURCES.modis.name, res: SOURCES.modis.short, here: `250 m × 250 m (${fmtNum(pixelHa, 2)} ha)` },
  ]

  return (
    <figure className="m-0 grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0">
        <figcaption className="font-display text-[1rem] leading-tight font-semibold text-forest-950">
          Footprints at one scale <span className="font-sans text-[0.75rem] font-bold text-muted">(km, north is up)</span>
        </figcaption>
        <p className="mt-1 text-[0.75rem] leading-snug font-bold text-ink">Schematic drawn to relative scale. It shows sizes and positions only, not measured data.</p>

        <div ref={ref} className="mt-3">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label={`Schematic drawn to relative scale. The approximate NASA POWER grid cell is about ${km(size.ns)} km north to south by ${km(size.ew)} km east to west. One 250 m pixel at the farm point is about one ${fmtNum(roundSig2(size.ew / PIXEL_KM))}th of the cell’s width.`}
            className="block max-w-full"
          >
            {/* cell width and height */}
            <text x={x0 + cellW / 2} y={pad.top - 9} textAnchor="middle" fontSize="12" fontWeight="700" fill={INK}>
              about {km(size.ew)} km east to west
            </text>
            <text transform={`translate(${x0 - 10} ${y0 + cellH / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fontWeight="700" fill={INK}>
              about {km(size.ns)} km north to south
            </text>

            <g {...on('cell')} aria-label={`${cellItem.name}. ${cellItem.detail}`}>
              <rect
                x={x0}
                y={y0}
                width={cellW}
                height={cellH}
                fill={LIME}
                fillOpacity={active === 'cell' ? 0.34 : 0.18}
                stroke={FOREST}
                strokeWidth={active === 'cell' ? 3 : 1.5}
                strokeDasharray="6 6"
              />
            </g>

            {sat && satLabel && modisItem && (
              <g {...on('modis')} aria-label={`${modisItem.name}. ${modisItem.detail}`}>
                <circle cx={sat.x} cy={sat.y} r={14} fill={active === 'modis' ? LIME : 'transparent'} stroke={active === 'modis' ? FOREST : 'none'} strokeWidth="2" />
                <circle cx={sat.x} cy={sat.y} r={9} fill="#fff" fillOpacity={0.55} stroke={FOREST_800} strokeWidth="1.75" strokeDasharray="3 3" />
                <rect x={sat.x - px / 2} y={sat.y - px / 2} width={px} height={px} fill={FOREST} />
                <text x={satLabel.x} y={satLabel.y} textAnchor={satLabel.anchor} fontSize="12" fontWeight="800" fill={FOREST}>
                  MODIS pixel
                </text>
              </g>
            )}

            <g {...on('pixel')} aria-label={`${pixelItem.name}. ${pixelItem.detail}`}>
              <circle cx={farm.x} cy={farm.y} r={14} fill={active === 'pixel' ? LIME : 'transparent'} stroke={active === 'pixel' ? FOREST : 'none'} strokeWidth="2" />
              <circle cx={farm.x} cy={farm.y} r={9} fill="#fff" fillOpacity={0.55} stroke={PERI} strokeWidth="2" />
              <rect x={farm.x - px / 2} y={farm.y - px / 2} width={px} height={px} fill={FOREST} />
              <text x={farmLabel.x} y={farmLabel.y} textAnchor={farmLabel.anchor} fontSize="12" fontWeight="800" fill={FOREST}>
                Farm point
              </text>
            </g>

            {/* scale bar */}
            <g transform={`translate(${x0} ${y0 + cellH + 16})`} aria-hidden="true">
              <path d={`M0 0v6M0 3h${barKm * scale}M${barKm * scale} 0v6`} fill="none" stroke={FOREST} strokeWidth="1.5" />
              <text x={barKm * scale + 8} y={7} fontSize="12" fontWeight="700" fill={INK}>
                {barKm} km
              </text>
            </g>
          </svg>
        </div>

        <ul aria-label="Schematic legend" className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.75rem] leading-snug font-bold text-ink">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="block h-3.5 w-5 shrink-0 border-[1.5px] border-dashed border-forest-950 bg-lime/30" />
            Approximate NASA POWER grid cell
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-peri-chart">
              <span className="block h-[2px] w-[2px] bg-forest-950" />
            </span>
            250 m pixel at the farm point
          </li>
          {sat && (
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-forest-800">
                <span className="block h-[2px] w-[2px] bg-forest-950" />
              </span>
              250 m MODIS pixel used for the greenness check
            </li>
          )}
        </ul>
        {/* not a live region: a focused shape already announces the same text through its own label */}
        <p className={cx('mt-3 min-h-[4.25rem] rounded-xl px-3 py-2 text-[0.8125rem] leading-snug', shown ? 'bg-lime-100 text-forest-950' : 'bg-sand/70 text-ink')}>
          {shown ? (
            <>
              <strong className="font-extrabold">{shown.name}.</strong> {shown.detail}
            </>
          ) : (
            'Point at a shape, or move to it with the Tab key, to read its size. Each ring only helps you find a pixel: the dot inside it is the pixel at its true relative size.'
          )}
        </p>
      </div>

      <div className="min-w-0">
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.key} className="py-3 first:pt-0">
              <p className="font-display text-[1rem] leading-tight font-semibold text-forest-950">{r.name}</p>
              <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-[0.875rem] sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                <dt className="font-bold text-muted">Resolution</dt>
                <dd className="font-semibold text-ink">{r.res}</dd>
                <dt className="font-bold text-muted">Size on the ground</dt>
                <dd className="font-semibold text-forest-950 tabular-nums">{r.here}</dd>
              </dl>
            </li>
          ))}
        </ul>
        <p className="mt-2 rounded-xl bg-sand/70 px-3 py-2.5 text-[0.875rem] leading-snug text-ink">
          <strong className="font-extrabold text-forest-950">
            At this latitude the approximate NASA POWER cell covers about {fmtNum(roundSig2(areaKm2))} km², roughly {fmtNum(roundSig2(ratio))} times the area of one 250 m pixel.
          </strong>{' '}
          The weather behind every season index is therefore far coarser than the soil and greenness data, and even one 250 m pixel can mix several fields.
          {modisOutside && ' The MODIS pixel used for the greenness check lies outside this cell, so it is not drawn.'}
        </p>
        <div className="mt-5 border-t border-border pt-4">
          <p className="font-display text-[1rem] leading-tight font-semibold text-forest-950">What is not drawn, and why</p>
          <ul className="mt-2 space-y-2 text-[0.875rem] leading-snug text-ink">
            {NOT_DRAWN.map((n) => (
              <li key={n.what} className="flex items-start gap-2">
                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  <strong className="font-extrabold text-forest-950">{n.what}.</strong> {n.why}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  )
}
