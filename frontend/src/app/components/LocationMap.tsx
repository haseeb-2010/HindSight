import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { cx } from '../../lib/cx'

const round2 = (v: number) => Math.round(v * 100) / 100
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180
const validPoint = (lat: number | null, lon: number | null): lat is number =>
  lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180

// NASA POWER meteorology comes from MERRA-2, whose grid cells are 0.5° of latitude by 0.625° of
// longitude, centred on multiples of those steps. The box shows the size of that cell.
export function weatherCell(lat: number, lon: number): [[number, number], [number, number]] {
  const cLat = Math.round(lat / 0.5) * 0.5
  const cLon = Math.round(lon / 0.625) * 0.625
  return [
    [cLat - 0.25, cLon - 0.3125],
    [cLat + 0.25, cLon + 0.3125],
  ]
}

/** The wording the dashed rectangle must carry wherever it is explained. */
export const CELL_LEGEND = 'Approximate NASA POWER grid cell (schematic)'

const PIN = L.divIcon({ className: '', html: '<div class="hs-pin"></div>', iconSize: [34, 34], iconAnchor: [17, 34] })

// Secondary markers are drawn with utility classes, so no stylesheet is needed. The 28 px box is the
// pointer and focus target; the visible mark sits in its centre. A selectable place is a round dot that
// grows and darkens while it is the active one (aria-pressed); a reference position is a small diamond.
const MARK_BOX = 'group rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-950'
const MARK_CENTRE = 'absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2 shadow-[0_1px_5px_rgb(28_58_42/0.5)]'
const PLACE_ICON = L.divIcon({
  className: MARK_BOX,
  html: `<span class="${MARK_CENTRE} h-4 w-4 rounded-full border-2 border-white bg-peri-chart transition-[width,height,background-color,border-color] duration-200 group-hover:bg-forest-800 group-aria-pressed:h-5 group-aria-pressed:w-5 group-aria-pressed:border-[3px] group-aria-pressed:border-lime group-aria-pressed:bg-forest-950"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})
const REFERENCE_ICON = L.divIcon({
  className: MARK_BOX,
  html: `<span class="${MARK_CENTRE} h-3 w-3 rotate-45 rounded-[2px] border-2 border-forest-950 bg-white"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})
const TOOLTIP_CLASS = 'rounded-lg! px-2.5! py-1.5! text-[0.75rem]! font-bold! text-forest-950!'

/** A secondary position on the map, such as a demonstration farm. */
export interface MapMarker {
  id: string
  lat: number
  lon: number
  /** Shown on hover and keyboard focus, and read by screen readers. */
  label: string
  /** Drawn larger and darker: the place whose details are on screen. */
  active?: boolean
  /** 'place' (default) can be selected with a click, Enter or Space. 'reference' only marks a supporting position. */
  kind?: 'place' | 'reference'
}

/** What the map should bring into view. 'point' (default) follows the selected point, as the picker always has. */
export type MapFocus = { type: 'point' } | { type: 'all' } | { type: 'marker'; id: string }

/**
 * FUTURE DATA LAYERS. HindSight draws no thematic layer today: the engine analyses one point, so there
 * is no field boundary, raster or zone to show, and drawing one would misrepresent the data.
 * If a genuine layer becomes available (a surveyed field boundary as GeoJSON, a real raster as an image
 * or tile layer), pass it through `overlays` instead of rebuilding this component: `create` returns any
 * Leaflet layer, the map adds it above the tiles and removes it again, and `label` joins the legend so
 * every layer is named with its source. Keep the array stable (useMemo) so layers are not rebuilt on
 * every render.
 */
export interface MapOverlay {
  id: string
  /** Legend text: what the layer is and where it comes from. */
  label: string
  create: () => L.Layer
}

interface LegendLabels {
  /** The pin. */
  point?: string
  /** Round markers (`kind: 'place'`). */
  place?: string
  /** Diamond markers (`kind: 'reference'`). */
  reference?: string
}

interface LocationMapProps {
  lat: number | null
  lon: number | null
  /** Called with the clicked or dragged-to position. Not used when `readOnly`. */
  onPick?: (lat: number, lon: number) => void
  className?: string
  /** Extra positions, e.g. the demonstration farms. */
  markers?: MapMarker[]
  /** A 'place' marker was chosen by click, Enter or Space. */
  onMarkerSelect?: (id: string) => void
  /** Context map: clicking does not place the pin and the pin cannot be dragged. */
  readOnly?: boolean
  /** With `readOnly`: the pin was chosen by click, Enter or Space. */
  onPointSelect?: () => void
  /** With `readOnly`: what the pin stands for (tooltip and screen-reader name). */
  pointLabel?: string
  /** Metric scale bar in the bottom-left corner. */
  showScale?: boolean
  /** Key under the map naming every symbol drawn. Pass labels to override the default wording. */
  legend?: boolean | LegendLabels
  focus?: MapFocus
  /** Replaces the default description of the map for screen readers. */
  ariaLabel?: string
  /** See MapOverlay. Nothing passes one today. */
  overlays?: MapOverlay[]
}

/**
 * Leaflet map on OpenStreetMap tiles. By default a location picker: click to place the marker, drag it
 * to refine. With `readOnly` it is a context map of a fixed point. Either way the dashed rectangle is the
 * approximate NASA POWER grid cell around the point, never a measured area.
 */
export function LocationMap({ lat, lon, onPick, className, markers, onMarkerSelect, readOnly = false, onPointSelect, pointLabel, showScale = false, legend = false, focus, ariaLabel, overlays }: LocationMapProps) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const cell = useRef<L.Rectangle | null>(null)
  const extra = useRef(new Map<string, { marker: L.Marker; kind: 'place' | 'reference' }>())
  const pick = useRef(onPick)
  pick.current = onPick
  const select = useRef(onMarkerSelect)
  select.current = onMarkerSelect
  const selectPoint = useRef(onPointSelect)
  selectPoint.current = onPointSelect
  const fixed = useRef(readOnly)
  fixed.current = readOnly

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { center: [24, 45], zoom: 2, minZoom: 2, scrollWheelZoom: false, worldCopyJump: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(m)
    m.on('click', (e) => {
      if (!fixed.current) pick.current?.(round2(e.latlng.lat), round2(wrapLon(e.latlng.lng)))
    })
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    const others = extra.current
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      marker.current = null
      cell.current = null
      others.clear()
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !showScale) return
    const scale = L.control.scale({ metric: true, imperial: false, maxWidth: 120 }).addTo(m)
    return () => {
      scale.remove()
    }
  }, [showScale])

  /* ---- the selected point and the weather cell around it ---- */
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!validPoint(lat, lon) || lon === null) {
      marker.current?.remove()
      cell.current?.remove()
      marker.current = null
      cell.current = null
      return
    }
    const name = readOnly ? (pointLabel ?? 'Analysed location') : 'Selected field location. Drag to adjust.'
    if (!marker.current) {
      const pin = L.marker([lat, lon], { icon: PIN, draggable: !readOnly, keyboard: true, title: name, alt: 'Selected field location', zIndexOffset: 1000 }).addTo(m)
      pin.on('dragend', () => {
        const p = pin.getLatLng()
        pick.current?.(round2(Math.max(-90, Math.min(90, p.lat))), round2(wrapLon(p.lng)))
      })
      pin.on('click', () => {
        if (fixed.current) selectPoint.current?.()
      })
      pin.getElement()?.addEventListener('keydown', (e) => {
        if (!fixed.current || !selectPoint.current || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault()
        selectPoint.current()
      })
      marker.current = pin
    } else {
      marker.current.setLatLng([lat, lon])
    }
    if (readOnly) marker.current.dragging?.disable()
    else marker.current.dragging?.enable()
    const pinEl = marker.current.getElement()
    if (pinEl) {
      pinEl.title = name
      if (readOnly) pinEl.setAttribute('aria-label', name)
      else pinEl.removeAttribute('aria-label')
    }
    const bounds = weatherCell(lat, lon)
    if (!cell.current) {
      cell.current = L.rectangle(bounds, { color: '#1c3a2a', weight: 1.5, dashArray: '6 6', fillColor: '#eef384', fillOpacity: 0.16, interactive: false }).addTo(m)
    } else {
      cell.current.setBounds(bounds)
    }
    if (m.getZoom() < 6 || !m.getBounds().pad(-0.15).contains([lat, lon])) m.setView([lat, lon], Math.max(m.getZoom(), 8), { animate: true })
  }, [lat, lon, readOnly, pointLabel])

  /* ---- secondary markers: kept in place between renders so keyboard focus survives a selection ---- */
  const list = (markers ?? []).filter((k) => validPoint(k.lat, k.lon))
  const markersKey = list.map((k) => [k.id, k.lat, k.lon, k.label, k.kind ?? 'place', k.active ? 1 : 0].join('|')).join(';')
  const latest = useRef(list)
  latest.current = list
  useEffect(() => {
    const m = map.current
    if (!m) return
    const want = new Map(latest.current.map((k) => [k.id, k]))
    for (const [id, old] of extra.current) {
      if (want.get(id) && (want.get(id)?.kind ?? 'place') === old.kind) continue
      old.marker.remove()
      extra.current.delete(id)
    }
    for (const k of want.values()) {
      const kind = k.kind ?? 'place'
      let mk = extra.current.get(k.id)?.marker
      if (!mk) {
        mk = L.marker([k.lat, k.lon], { icon: kind === 'place' ? PLACE_ICON : REFERENCE_ICON, keyboard: kind === 'place' }).addTo(m)
        // below the mark, so the label never covers a pin standing on the same spot
        mk.bindTooltip(k.label, { direction: 'bottom', offset: [0, 10], className: TOOLTIP_CLASS })
        if (kind === 'place') {
          const id = k.id
          const placed = mk
          mk.on('click', () => {
            placed.closeTooltip()
            select.current?.(id)
          })
          mk.getElement()?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            select.current?.(id)
          })
        }
        extra.current.set(k.id, { marker: mk, kind })
      } else {
        mk.setLatLng([k.lat, k.lon])
        mk.setTooltipContent(k.label)
      }
      mk.setZIndexOffset(k.active ? 500 : 0) // the active place stays on top where markers overlap
      const node = mk.getElement()
      if (node) {
        node.setAttribute('aria-label', k.label)
        if (kind === 'place') node.setAttribute('aria-pressed', k.active ? 'true' : 'false')
      }
    }
  }, [markersKey])

  /* ---- what is in view ---- */
  const focusKey = !focus || focus.type === 'point' ? 'point' : focus.type === 'all' ? 'all' : `marker:${focus.id}`
  const lastFocus = useRef(focusKey)
  useEffect(() => {
    const m = map.current
    if (!m) return
    const changed = lastFocus.current !== focusKey
    lastFocus.current = focusKey
    if (focusKey === 'all') {
      const pts: [number, number][] = latest.current.map((k) => [k.lat, k.lon])
      if (validPoint(lat, lon) && lon !== null) pts.push([lat, lon])
      if (pts.length) {
        const bounds = L.latLngBounds(pts)
        // Room for the marks themselves: the pin stands 34 px above its point.
        const topLeft = L.point(24, 44)
        const bottomRight = L.point(24, 24)
        // A narrow map has to zoom out further than the picker's limit to hold places on two continents.
        const limit = m.getMinZoom()
        m.setMinZoom(0)
        m.setMinZoom(Math.min(limit, m.getBoundsZoom(bounds, false, topLeft.add(bottomRight))))
        m.fitBounds(bounds, { paddingTopLeft: topLeft, paddingBottomRight: bottomRight, animate: true, maxZoom: 8 })
      }
    } else if (focusKey === 'point') {
      // the point effect above already brings a new point into view; this returns to it from another view
      if (changed && validPoint(lat, lon) && lon !== null) m.setView([lat, lon], 8, { animate: true })
    } else {
      const target = latest.current.find((k) => `marker:${k.id}` === focusKey)
      if (target && (m.getZoom() < 6 || !m.getBounds().pad(-0.1).contains([target.lat, target.lon]))) m.setView([target.lat, target.lon], 8, { animate: true })
    }
  }, [focusKey, markersKey, lat, lon])

  /* ---- future data layers (see MapOverlay): none exist today ---- */
  useEffect(() => {
    const m = map.current
    if (!m || !overlays?.length) return
    const layers = overlays.map((o) => o.create().addTo(m))
    return () => layers.forEach((layer) => layer.remove())
  }, [overlays])

  const hasPoint = validPoint(lat, lon)
  const labels: LegendLabels = typeof legend === 'object' ? legend : {}
  const box = (
    <div className={cx('hs-map relative isolate z-0 overflow-hidden rounded-[1.25rem] ring-1 ring-border', className)}>
      <div
        ref={el}
        className="h-full w-full"
        role="application"
        aria-label={ariaLabel ?? (readOnly ? 'Map of the analysed location. Use the arrow keys to move it and plus or minus to zoom.' : 'Map. Click to choose your field’s location; drag the marker to refine it.')}
      />
    </div>
  )
  if (!legend) return box

  return (
    <>
      {box}
      <ul aria-label="Map legend" className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.75rem] leading-snug font-bold text-ink">
        {hasPoint && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="block h-3.5 w-3.5 -rotate-45 rounded-[50%_50%_50%_0] border-2 border-lime bg-forest-950 ring-1 ring-forest-950" />
            </span>
            {labels.point ?? (readOnly ? 'Analysed location' : 'Selected field point')}
          </li>
        )}
        {list.some((k) => (k.kind ?? 'place') === 'place') && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white bg-peri-chart ring-1 ring-peri-chart" />
            {labels.place ?? 'Other location'}
          </li>
        )}
        {list.some((k) => k.kind === 'reference') && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="block h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-forest-950 bg-white" />
            </span>
            {labels.reference ?? 'Reference position'}
          </li>
        )}
        {hasPoint && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="block h-3.5 w-5 shrink-0 border-[1.5px] border-dashed border-forest-950 bg-lime/30" />
            {CELL_LEGEND}
          </li>
        )}
        {overlays?.map((o) => (
          <li key={o.id} className="flex items-center gap-2">
            <span aria-hidden="true" className="block h-3.5 w-3.5 shrink-0 rounded-[3px] bg-sage ring-1 ring-forest-800" />
            {o.label}
          </li>
        ))}
      </ul>
    </>
  )
}
