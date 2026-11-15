import { useState, type CSSProperties } from 'react'
import { fmtIndex, isNum } from '../../lib/format'

interface IndexBarsProps {
  years: number[]
  values: (number | null)[]
  threshold: number | null
  label: string
  height?: number
}

const W = 480

/** Compact annual season-index bars. Bars under the failure line are drawn in signal orange. */
export function IndexBars({ years, values, threshold, label, height = 132 }: IndexBarsProps) {
  const [hover, setHover] = useState<number | null>(null)
  const n = values.length
  const nums = values.filter(isNum)
  const yMax = Math.max(1.2, Math.ceil(Math.max(...nums, 0) * 10) / 10)
  const step = W / Math.max(n, 1)
  const barW = Math.max(step * 0.62, 2)
  const y = (v: number) => height - (v / yMax) * height
  const below = isNum(threshold) ? nums.filter((v) => v < threshold).length : null

  const hv = hover !== null ? values[hover] : null
  return (
    <figure className="m-0">
      <div className="mb-2 flex h-5 items-center justify-between text-[0.75rem] font-bold text-muted" aria-hidden="true">
        <span>Season index</span>
        <span className="font-display tabular-nums text-forest-950 transition-opacity" style={{ opacity: hover === null ? 0 : 1 }}>
          {hover !== null ? `${years[hover]} · ${fmtIndex(hv)}` : ''}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
      >
        {[0.5, 1].map((t) => (
          <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-sand-300)" strokeWidth={1} />
        ))}
        {values.map((v, i) => {
          if (!isNum(v)) return null
          const fail = isNum(threshold) && v < threshold
          const h = Math.max(height - y(v), 1.5)
          return (
            <g key={years[i]} onMouseEnter={() => setHover(i)}>
              <rect x={i * step} y={0} width={step} height={height} fill="transparent" />
              <rect
                x={i * step + (step - barW) / 2}
                y={height - h}
                width={barW}
                height={h}
                rx={Math.min(barW / 2, 3)}
                fill={fail ? 'var(--color-signal-600)' : 'var(--color-forest-800)'}
                opacity={hover === null || hover === i ? 1 : 0.45}
                className="bar-grow transition-opacity duration-200"
                style={{ '--delay': `${200 + i * 18}ms`, transformBox: 'fill-box' } as CSSProperties}
              />
            </g>
          )
        })}
        {isNum(threshold) && (
          <g>
            <line x1={0} x2={W} y1={y(threshold)} y2={y(threshold)} stroke="var(--color-forest-950)" strokeWidth={1.25} strokeDasharray="4 4" />
          </g>
        )}
      </svg>
      <div className="mt-2 flex justify-between text-[0.6875rem] font-bold text-muted tabular-nums" aria-hidden="true">
        <span>{years[0]}</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-signal-600" />
            {isNum(threshold) ? `Below ${fmtIndex(threshold)} (failure line)` : 'Below failure line'}
          </span>
        </span>
        <span>{years[n - 1]}</span>
      </div>
      {below !== null && (
        <figcaption className="sr-only">
          {below} of {nums.length} years below the failure line.
        </figcaption>
      )}
    </figure>
  )
}
