// Explanatory diagrams for the Science page. They illustrate the method; none of them plots an analysis result.
import { cx } from '../../lib/cx'
import { ENGINE, EXAMPLE_CROP } from './engineFacts'

const INK = 'var(--color-forest-950)'
const FOREST = '#33594a'
const PERI = '#5b6bb5'
const SIGNAL = '#d9530e'
const LABEL = 'fill-forest-950 text-[11px] font-extrabold'
const NOTE = 'fill-ink text-[10px] font-semibold'

function Arrow({ x1, y1, x2, y2, color = INK, dashed }: { x1: number; y1: number; x2: number; y2: number; color?: string; dashed?: boolean }) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const h = 7
  const p = (da: number) => `${x2 - h * Math.cos(a + da)},${y2 - h * Math.sin(a + da)}`
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - 3 * Math.cos(a)} y2={y2 - 3 * Math.sin(a)} stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dashed ? '4 4' : undefined} />
      <polygon points={`${x2},${y2} ${p(0.45)} ${p(-0.45)}`} fill={color} />
    </g>
  )
}

/** The root-zone "bucket": what goes in, what comes out, and where stress starts. */
export function BucketDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 250"
      className={cx('mx-auto block h-auto w-full max-w-[27rem]', className)}
      role="img"
      aria-label="Diagram of the soil-water bucket. Rain and, if chosen, irrigation enter at the top. Water above field capacity drains away. The crop takes water out. When the water level falls below the stress line the crop takes less than it needs. The bucket is empty at the wilting point."
    >
      {/* water */}
      <rect x={127} y={122} width={96} height={94} rx={8} fill="var(--color-peri)" />
      <path d="M127 122 q12 -6 24 0 t24 0 t24 0 t24 0" fill="none" stroke={PERI} strokeWidth={2} />
      {/* bucket */}
      <path d="M125 58 V208 a10 10 0 0 0 10 10 H215 a10 10 0 0 0 10 -10 V58" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <text x={175} y={186} textAnchor="middle" className={LABEL}>
        Soil water
      </text>

      {/* levels */}
      <line x1={113} y1={60} x2={125} y2={60} stroke={INK} strokeWidth={1.5} />
      <text x={109} y={58} textAnchor="end" className={LABEL}>
        Full
      </text>
      <text x={109} y={71} textAnchor="end" className={NOTE}>
        field capacity
      </text>
      <line x1={113} y1={146} x2={237} y2={146} stroke={SIGNAL} strokeWidth={2} strokeDasharray="5 4" />
      <text x={109} y={144} textAnchor="end" className={LABEL}>
        Stress line
      </text>
      <text x={109} y={157} textAnchor="end" className={NOTE}>
        RAW used up
      </text>
      <line x1={113} y1={217} x2={125} y2={217} stroke={INK} strokeWidth={1.5} />
      <text x={109} y={215} textAnchor="end" className={LABEL}>
        Empty
      </text>
      <text x={109} y={228} textAnchor="end" className={NOTE}>
        wilting point
      </text>

      {/* inputs */}
      <Arrow x1={152} y1={12} x2={152} y2={52} color={PERI} />
      <text x={144} y={30} textAnchor="end" className={LABEL}>
        Rain
      </text>
      <Arrow x1={198} y1={12} x2={198} y2={52} color={FOREST} dashed />
      <text x={207} y={24} className={LABEL}>
        Irrigation
      </text>
      <text x={207} y={37} className={NOTE}>
        only if chosen
      </text>

      {/* outputs */}
      <Arrow x1={226} y1={70} x2={300} y2={70} color={INK} />
      <text x={236} y={88} className={LABEL}>
        Excess drains
      </text>
      <path d="M226 180 H262" fill="none" stroke={FOREST} strokeWidth={2} strokeLinecap="round" />
      <Arrow x1={262} y1={180} x2={262} y2={122} color={FOREST} />
      <text x={272} y={170} className={LABEL}>
        Crop water
      </text>
      <text x={272} y={183} className={LABEL}>
        use (ETa)
      </text>
    </svg>
  )
}

/** The four-stage crop coefficient curve, drawn to scale from the wheat entry of the crop table. */
export function KcCurveDiagram({ className }: { className?: string }) {
  const { stageDays, kc } = EXAMPLE_CROP
  const total = stageDays.reduce((a, b) => a + b, 0)
  const X0 = 44
  const X1 = 346
  const Y0 = 150
  const TOP = 20
  const KMAX = 1.3
  const x = (d: number) => X0 + ((X1 - X0) * d) / total
  const y = (k: number) => Y0 - ((Y0 - TOP) * k) / KMAX
  const [l1, l2, l3] = stageDays
  const pts: [number, number][] = [
    [0, kc.ini],
    [l1, kc.ini],
    [l1 + l2, kc.mid],
    [l1 + l2 + l3, kc.mid],
    [total, kc.end],
  ]
  const names = ['Initial', 'Development', 'Mid-season', 'Late']
  let start = 0
  const bands = stageDays.map((len, i) => {
    const b = { from: start, len, name: names[i] }
    start += len
    return b
  })
  return (
    <svg
      viewBox="0 0 360 210"
      className={cx('mx-auto block h-auto w-full max-w-[30rem]', className)}
      role="img"
      aria-label={`Crop coefficient curve for ${EXAMPLE_CROP.name.toLowerCase()}. Kc stays at ${kc.ini.toFixed(2)} for the ${stageDays[0]}-day initial stage, rises in a straight line over the ${stageDays[1]}-day development stage to ${kc.mid.toFixed(2)}, holds for the ${stageDays[2]}-day mid-season stage, then falls in a straight line over the ${stageDays[3]}-day late stage to ${kc.end.toFixed(2)}.`}
    >
      {bands.map((b, i) => (
        <g key={b.name}>
          <rect x={x(b.from)} y={TOP} width={x(b.from + b.len) - x(b.from)} height={Y0 - TOP} fill={i % 2 === 0 ? 'var(--color-sand)' : 'var(--color-cream-50)'} />
          <text x={x(b.from + b.len / 2)} y={Y0 + 16} textAnchor="middle" className={i === 0 ? 'fill-forest-950 text-[9.5px] font-extrabold' : LABEL}>
            {b.name}
          </text>
          <text x={x(b.from + b.len / 2)} y={Y0 + 29} textAnchor="middle" className={NOTE}>
            {b.len} days
          </text>
        </g>
      ))}
      {[0, 0.5, 1].map((k) => (
        <g key={k}>
          <line x1={X0} y1={y(k)} x2={X1} y2={y(k)} stroke="var(--color-sand-400)" strokeWidth={1} strokeDasharray={k === 0 ? undefined : '2 4'} />
          <text x={X0 - 6} y={y(k) + 3.5} textAnchor="end" className={`${NOTE} tabular-nums`}>
            {k.toFixed(1)}
          </text>
        </g>
      ))}
      <text x={X0 - 6} y={TOP - 6} textAnchor="end" className={LABEL}>
        Kc
      </text>
      <polyline points={pts.map(([d, k]) => `${x(d)},${y(k)}`).join(' ')} fill="none" stroke={FOREST} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {[pts[1], pts[2], pts[3], pts[4]].map(([d, k], i) => (
        <circle key={i} cx={x(d)} cy={y(k)} r={4} fill="#fff" stroke={FOREST} strokeWidth={2} />
      ))}
      <text x={x(l1) + 8} y={y(kc.ini) + 15} className={`${LABEL} tabular-nums`}>
        Kc ini {kc.ini.toFixed(2)}
      </text>
      <text x={x(l1 + l2 + l3 / 2)} y={y(kc.mid) - 9} textAnchor="middle" className={`${LABEL} tabular-nums`}>
        Kc mid {kc.mid.toFixed(2)}
      </text>
      <text x={x(total) - 14} y={y(kc.end) + 4} textAnchor="end" className={`${LABEL} tabular-nums`}>
        Kc end {kc.end.toFixed(2)}
      </text>
      <text x={(X0 + X1) / 2} y={204} textAnchor="middle" className={NOTE}>
        Growth stages, by days after sowing
      </text>
    </svg>
  )
}

/** The temperature-suitability trapezoid, drawn to scale from the wheat entry of the crop table. */
export function TemperatureDiagram({ className }: { className?: string }) {
  const t = EXAMPLE_CROP.tempC
  const TMAX = 32
  const X0 = 44
  const X1 = 346
  const Y0 = 128
  const Y1 = 40
  const x = (c: number) => X0 + ((X1 - X0) * c) / TMAX
  const pts = [
    [0, Y0],
    [t.min, Y0],
    [t.optMin, Y1],
    [t.optMax, Y1],
    [t.max, Y0],
    [TMAX, Y0],
  ]
  return (
    <svg
      viewBox="0 0 360 178"
      className={cx('mx-auto block h-auto w-full max-w-[30rem]', className)}
      role="img"
      aria-label={`Temperature factor for ${EXAMPLE_CROP.name.toLowerCase()}. The factor is 0 when the season's mean temperature is ${t.min} degrees Celsius or lower, rises in a straight line to 1 at ${t.optMin} degrees, stays at 1 up to ${t.optMax} degrees, and falls in a straight line to 0 at ${t.max} degrees.`}
    >
      <rect x={x(t.optMin)} y={Y1} width={x(t.optMax) - x(t.optMin)} height={Y0 - Y1} fill="var(--color-lime-100)" />
      {[
        [Y0, '0'],
        [Y1, '1'],
      ].map(([yy, label]) => (
        <g key={label}>
          <line x1={X0} y1={yy as number} x2={X1} y2={yy as number} stroke="var(--color-sand-400)" strokeWidth={1} strokeDasharray={label === '0' ? undefined : '2 4'} />
          <text x={X0 - 6} y={(yy as number) + 3.5} textAnchor="end" className={`${NOTE} tabular-nums`}>
            {label}
          </text>
        </g>
      ))}
      <text x={X0 - 6} y={Y1 - 18} textAnchor="end" className={LABEL}>
        f_T
      </text>
      <polyline points={pts.map(([c, yy]) => `${x(c)},${yy}`).join(' ')} fill="none" stroke={SIGNAL} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <text x={x((t.optMin + t.optMax) / 2)} y={Y1 - 9} textAnchor="middle" className={LABEL}>
        Fully suitable
      </text>
      <text x={x(t.min / 2)} y={Y0 - 8} textAnchor="middle" className={NOTE}>
        too cold
      </text>
      <text x={x((t.max + TMAX) / 2)} y={Y0 - 8} textAnchor="middle" className={NOTE}>
        too hot
      </text>
      {[t.min, t.optMin, t.optMax, t.max].map((c) => (
        <g key={c}>
          <line x1={x(c)} y1={Y0} x2={x(c)} y2={Y0 + 5} stroke={INK} strokeWidth={1.5} />
          <text x={x(c)} y={Y0 + 18} textAnchor="middle" className={`${LABEL} tabular-nums`}>
            {c}°
          </text>
        </g>
      ))}
      <text x={(X0 + X1) / 2} y={170} textAnchor="middle" className={NOTE}>
        Mean temperature of the crop season (°C)
      </text>
    </svg>
  )
}

/** A coarse weather cell beside one 250 m pixel. Not to scale. */
export function FootprintDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 172"
      className={cx('mx-auto block h-auto w-full max-w-[30rem]', className)}
      role="img"
      aria-label="Diagram, not to scale. On the left, one NASA POWER weather cell about 50 kilometres wide. A very small square inside it is enlarged on the right: one 250 metre pixel of SoilGrids or MODIS, with a field inside it that is smaller than the pixel."
    >
      <rect x={16} y={10} width={126} height={126} rx={10} fill="var(--color-lime-100)" stroke={INK} strokeWidth={2} />
      {[1, 2].map((i) => (
        <g key={i} stroke="var(--color-sand-400)" strokeWidth={1}>
          <line x1={16 + i * 42} y1={12} x2={16 + i * 42} y2={134} />
          <line x1={18} y1={10 + i * 42} x2={140} y2={10 + i * 42} />
        </g>
      ))}
      <rect x={92} y={62} width={7} height={7} fill="#fff" stroke={SIGNAL} strokeWidth={2} />
      <path d="M99 62 L214 10 M99 69 L214 136" fill="none" stroke={SIGNAL} strokeWidth={1.2} strokeDasharray="3 4" />
      <rect x={214} y={10} width={126} height={126} rx={10} fill="#fff" stroke={SIGNAL} strokeWidth={2} />
      <rect x={246} y={48} width={58} height={44} rx={5} fill="var(--color-sage)" />
      <path d="M246 62h58M246 77h58" stroke="#fff" strokeWidth={1.2} opacity={0.7} />
      <text x={275} y={110} textAnchor="middle" className={LABEL}>
        your field
      </text>
      <text x={79} y={152} textAnchor="middle" className={LABEL}>
        Weather cell
      </text>
      <text x={79} y={165} textAnchor="middle" className={NOTE}>
        about 50 km wide
      </text>
      <text x={277} y={152} textAnchor="middle" className={LABEL}>
        Soil or NDVI pixel
      </text>
      <text x={277} y={165} textAnchor="middle" className={NOTE}>
        250 m wide
      </text>
    </svg>
  )
}

/** The record split into the spin-up year and the two comparison periods, drawn in proportion. */
export function PeriodTimeline({ spinUp, early, late }: { spinUp: number; early: [number, number]; late: [number, number] }) {
  const span = (w: [number, number]) => w[1] - w[0] + 1
  return (
    <div role="img" aria-label={`Timeline. ${spinUp} is the spin-up year and is not reported. The earlier period is ${early[0]} to ${early[1]}, ${span(early)} years. The later period is ${late[0]} to ${late[1]}, ${span(late)} years.`}>
      <div className="flex h-12 gap-1" aria-hidden="true">
        <div
          className="min-w-3 rounded-l-xl ring-1 ring-sand-400"
          style={{ flexGrow: 1, flexBasis: 0, backgroundImage: 'repeating-linear-gradient(135deg, var(--color-sand-400) 0 3px, var(--color-sand) 3px 7px)' }}
        />
        <div className="flex items-center justify-center bg-forest-800 px-2 font-display text-[0.875rem] font-semibold text-cream-50 tabular-nums" style={{ flexGrow: span(early), flexBasis: 0 }}>
          {early[0]}–{early[1]}
        </div>
        <div className="flex items-center justify-center rounded-r-xl bg-peri-chart px-2 font-display text-[0.875rem] font-semibold text-white tabular-nums" style={{ flexGrow: span(late), flexBasis: 0 }}>
          {late[0]}–{late[1]}
        </div>
      </div>
      <ul className="mt-3 grid gap-x-5 gap-y-2 text-[0.8125rem] leading-snug text-ink sm:grid-cols-3" aria-hidden="true">
        <li className="flex gap-2">
          <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[4px] ring-1 ring-sand-400" style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--color-sand-400) 0 3px, var(--color-sand) 3px 7px)' }} />
          <span>
            <strong className="font-extrabold text-forest-950 tabular-nums">{spinUp}: spin-up.</strong> Simulated so the soil water settles, then left out of every result.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[4px] bg-forest-800" />
          <span>
            <strong className="font-extrabold text-forest-950">Earlier period.</strong> {span(early)} years.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[4px] bg-peri-chart" />
          <span>
            <strong className="font-extrabold text-forest-950">Later period.</strong> {span(late)} years.
          </span>
        </li>
      </ul>
    </div>
  )
}

/** A two-year rotation run once per starting phase, so every crop meets every year's weather. */
export function PhaseDiagram() {
  const years: (number | null)[] = [ENGINE.spinUpYear, ENGINE.recordStart, ENGINE.recordStart + 1, ENGINE.recordStart + 2, null, ENGINE.recordEnd]
  // rotation.py _sim_inputs: cycle year = (year - 1984 + phase) mod cycle length
  const cycleYear = (year: number, phase: number) => ((year - ENGINE.spinUpYear + phase) % 2) + 1
  return (
    <div role="img" aria-label={`Diagram of a two-year rotation. Run 1 starts ${ENGINE.spinUpYear} with the first year of the cycle; run 2 starts it with the second year. The two runs alternate in opposite order through ${ENGINE.recordEnd}, so both years of the cycle are simulated in every calendar year.`}>
      <div className="space-y-2.5" aria-hidden="true">
        <div className="grid grid-cols-6 gap-1 text-center text-[0.6875rem] font-extrabold text-ink tabular-nums">
          {years.map((yr, i) => (
            <span key={i}>{yr ?? '…'}</span>
          ))}
        </div>
        {[0, 1].map((phase) => (
          <div key={phase}>
            <p className="mb-1 text-[0.75rem] font-extrabold text-forest-950">Run {phase + 1}</p>
            <div className="grid grid-cols-6 gap-1">
              {years.map((yr, i) => {
                if (yr === null)
                  return (
                    <span key={i} className="flex h-9 items-center justify-center text-[0.875rem] font-extrabold text-muted">
                      …
                    </span>
                  )
                const cy = cycleYear(yr, phase)
                return (
                  <span
                    key={i}
                    className={cx(
                      'flex h-9 items-center justify-center rounded-lg text-[0.75rem] font-extrabold text-forest-950',
                      cy === 1 ? 'bg-lime ring-1 ring-forest-950/15' : 'bg-peri ring-1 ring-peri-300',
                      yr === ENGINE.spinUpYear && 'opacity-55',
                    )}
                  >
                    Y{cy}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
        <p className="text-[0.75rem] leading-snug text-ink">
          Y1 and Y2 are the first and second year of the rotation’s cycle. The faded first column is the spin-up year.
        </p>
      </div>
    </div>
  )
}
