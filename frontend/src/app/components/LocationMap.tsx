import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { cx } from '../../lib/cx'

const round2 = (v: number) => Math.round(v * 100) / 100
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

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

const PIN = L.divIcon({ className: '', html: '<div class="hs-pin"></div>', iconSize: [34, 34], iconAnchor: [17, 34] })

interface LocationMapProps {
  lat: number | null
  lon: number | null
  onPick: (lat: number, lon: number) => void
  className?: string
}

/** Location picker on OpenStreetMap tiles: click to place the marker, drag it to refine. */
export function LocationMap({ lat, lon, onPick, className }: LocationMapProps) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const cell = useRef<L.Rectangle | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { center: [24, 45], zoom: 2, minZoom: 2, scrollWheelZoom: false, worldCopyJump: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(m)
    m.on('click', (e) => pick.current(round2(e.latlng.lat), round2(wrapLon(e.latlng.lng))))
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      marker.current = null
      cell.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      marker.current?.remove()
      cell.current?.remove()
      marker.current = null
      cell.current = null
      return
    }
    if (!marker.current) {
      marker.current = L.marker([lat, lon], {
        icon: PIN,
        draggable: true,
        keyboard: true,
        title: 'Selected field location. Drag to adjust.',
        alt: 'Selected field location',
      }).addTo(m)
      marker.current.on('dragend', () => {
        const p = marker.current?.getLatLng()
        if (p) pick.current(round2(Math.max(-90, Math.min(90, p.lat))), round2(wrapLon(p.lng)))
      })
    } else {
      marker.current.setLatLng([lat, lon])
    }
    const bounds = weatherCell(lat, lon)
    if (!cell.current) {
      cell.current = L.rectangle(bounds, { color: '#1c3a2a', weight: 1.5, dashArray: '6 6', fillColor: '#eef384', fillOpacity: 0.16, interactive: false }).addTo(m)
    } else {
      cell.current.setBounds(bounds)
    }
    if (m.getZoom() < 6 || !m.getBounds().pad(-0.15).contains([lat, lon])) m.setView([lat, lon], Math.max(m.getZoom(), 8), { animate: true })
  }, [lat, lon])

  return (
    <div className={cx('hs-map relative isolate z-0 overflow-hidden rounded-[1.25rem] ring-1 ring-border', className)}>
      <div ref={el} className="h-full w-full" role="application" aria-label="Map. Click to choose your field’s location; drag the marker to refine it." />
    </div>
  )
}
