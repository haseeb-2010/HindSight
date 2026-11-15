import { ChevronDown, ChevronRight, CloudSun, FlaskConical, Layers, Satellite } from 'lucide-react'
import type { ReactNode } from 'react'
import { InfoTip } from '../components/ui/InfoTip'
import { Mascot } from '../components/ui/Mascot'
import { Reveal } from '../components/ui/Reveal'
import { SectionHeading } from '../components/ui/SectionHeading'
import { cx } from '../lib/cx'

/* ---------------------------------------------------------------- mini-illustrations */

/** One coarse weather cell with a small field inside it. */
function GridCellArt() {
  return (
    <svg viewBox="0 0 220 120" className="h-full w-full" aria-hidden="true">
      {[0, 1, 2, 3].map((c) =>
        [0, 1].map((r) => (
          <rect key={`${c}-${r}`} x={6 + c * 53} y={6 + r * 56} width={49} height={52} rx={8} fill={c === 1 && r === 0 ? 'var(--color-lime)' : '#fff'} stroke="var(--color-sand-400)" />
        )),
      )}
      <rect x={82} y={34} width={9} height={7} rx={1.5} fill="var(--color-forest-950)" />
      <path d="M96 38h34" stroke="var(--color-forest-950)" strokeWidth={1.2} strokeDasharray="3 3" />
      <text x={134} y={42} className="fill-forest-950 text-[10px] font-extrabold">your field</text>
      <path d="M59 70v6h49v-6" fill="none" stroke="var(--color-forest-950)" strokeWidth={1.2} />
      <text x={83.5} y={90} textAnchor="middle" className="fill-forest-950 text-[10px] font-extrabold">≈ 50 km</text>
    </svg>
  )
}

/** A mosaic of 250 m pixels in different greens. */
function PixelArt() {
  const shades = ['#dfe7df', '#b8c7bf', '#8aa396', '#33594a', '#25483a']
  const pattern = [1, 2, 3, 2, 1, 0, 2, 3, 4, 3, 2, 1, 0, 2, 3, 4, 2, 0]
  return (
    <svg viewBox="0 0 220 120" className="h-full w-full" aria-hidden="true">
      {pattern.map((s, i) => (
        <rect key={i} x={18 + (i % 6) * 31} y={6 + Math.floor(i / 6) * 29} width={28} height={26} rx={5} fill={shades[s]} />
      ))}
      <rect x={109.5} y={33.5} width={31} height={29} rx={6.5} fill="none" stroke="var(--color-signal-600)" strokeWidth={2} />
      <rect x={66} y={103} width={9} height={9} rx={2.5} fill="none" stroke="var(--color-signal-600)" strokeWidth={2} />
      <text x={81} y={111.5} className="fill-forest-950 text-[10px] font-extrabold">one 250 m pixel</text>
    </svg>
  )
}

/** The three SoilGrids depth layers that are read. */
function SoilArt() {
  const layers = [
    { label: '0–5 cm', h: 16, fill: '#cfcbc2' },
    { label: '5–15 cm', h: 30, fill: '#b8b0a0' },
    { label: '15–30 cm', h: 46, fill: '#8f8676' },
  ]
  let y = 12
  return (
    <svg viewBox="0 0 220 120" className="h-full w-full" aria-hidden="true">
      {layers.map((l) => {
        const el = (
          <g key={l.label}>
            <rect x={20} y={y} width={112} height={l.h - 2} rx={5} fill={l.fill} />
            <text x={142} y={y + l.h / 2 + 3} className="fill-forest-950 text-[10px] font-extrabold">{l.label}</text>
          </g>
        )
        y += l.h
        return el
      })}
    </svg>
  )
}

/* ---------------------------------------------------------------- content */

const SOURCES: { icon: typeof CloudSun; name: string; role: string; art: ReactNode; body: ReactNode; tone: string }[] = [
  {
    icon: CloudSun,
    name: 'NASA POWER',
    role: 'Drives the simulation',
    tone: 'bg-lime-100',
    art: <GridCellArt />,
    body: (
      <>
        Daily temperature, rainfall, sunlight, humidity and wind for 1984–2024, from NASA’s{' '}
        <InfoTip label="Reanalysis" term="reanalysis">
          A weather model that is continuously corrected with satellite and ground observations, giving a consistent
          record for every grid cell on Earth. POWER uses MERRA-2 for weather and CERES for sunlight.
        </InfoTip>{' '}
        and satellite records. Every simulated day uses it.
      </>
    ),
  },
  {
    icon: Satellite,
    name: 'MODIS NDVI',
    role: 'Independent check',
    tone: 'bg-peri-50',
    art: <PixelArt />,
    body: (
      <>
        Satellite observations of{' '}
        <InfoTip label="NDVI" term="vegetation greenness">
          The Normalized Difference Vegetation Index compares red and near-infrared light reflected by the land. Dense,
          healthy vegetation scores high. HindSight reads the MOD13Q1 product: 250 m pixels every 16 days.
        </InfoTip>
        , used as an optional outside check on the modeled season index. It never feeds the model.
      </>
    ),
  },
  {
    icon: Layers,
    name: 'ISRIC SoilGrids',
    role: 'Optional soil prefill',
    tone: 'bg-sand',
    art: <SoilArt />,
    body: (
      <>
        Sand, clay and organic carbon for the top 30 cm, which can prefill a field’s{' '}
        <InfoTip label="Soil texture" term="soil texture">
          The mix of sand, silt and clay. It sets how much water the soil can hold for crops between rains (estimated
          with Saxton &amp; Rawls, 2006).
        </InfoTip>
        . A farmer’s own description of the soil always takes priority.
      </>
    ),
  },
]

const PIPELINE: { step: string; method: string; tip: string }[] = [
  {
    step: 'Reference ET₀',
    method: 'FAO-56 Penman–Monteith',
    tip: 'How much water a reference grass surface loses to the air each day, calculated from temperature, sunlight, humidity and wind with the UN FAO standard method.',
  },
  {
    step: 'Crop water need',
    method: 'FAO-56 crop coefficients',
    tip: 'Each crop’s water need through its growth stages, expressed as a multiple (Kc) of the reference ET₀.',
  },
  {
    step: 'Daily soil-water balance',
    method: 'FAO-56, chapter 8',
    tip: 'A day-by-day account of water in the root zone: rain and irrigation in, crop use and drainage out. When the soil dries past a threshold, the crop is counted as stressed.',
  },
  {
    step: 'Season index',
    method: 'FAO-33 with EcoCrop ranges',
    tip: 'A score for each crop season from how well its water and temperature needs were met. It is not a yield in tonnes per hectare.',
  },
  {
    step: 'Ranking',
    method: 'Your priorities, weighted 0–5',
    tip: 'Indicators are scaled between the rotations being compared, weighted by the farmer’s priorities and ranked. Rankings are relative, not probabilities of success.',
  },
]

const CHECKS = [
  'Water accounting closes within 0.1 mm over 41 simulated years.',
  'Reproduces FAO-56 worked Example 18 for reference ET₀ within 5%.',
  'Its worst simulated years line up with the 2012 US drought and Pakistan’s 1998–2002 drought: a match of timing, not a yield validation.',
]

const LIMITS: { title: string; body: string }[] = [
  {
    title: 'Weather comes from a grid cell about 50 km wide, not from your field',
    body: 'NASA POWER values are estimates for a whole grid cell, so a single field can differ, especially in rainfall. At the two Pakistan demonstration sites, POWER rainfall differs from published climate normals by roughly +48% and −36%. HindSight does not adjust the data; instead it re-ranks every rotation with rainfall 30% lower and 30% higher and shows whether the order changes.',
  },
  {
    title: 'Results are historical simulations, not forecasts',
    body: 'HindSight replays rotations through the weather of 1985–2024. It describes how they would have fared in the past. It does not predict next season, and it cannot guarantee any outcome.',
  },
  {
    title: 'The season index is not a yield',
    body: 'The index summarises how well a crop’s water and temperature needs were met. It is not tonnes per hectare, and pests, disease, nutrients, salinity, variety and management are not modeled.',
  },
  {
    title: 'Indicators are signposts, not measurements',
    body: 'Legume share points to a potential nitrogen contribution, not a measured nitrogen balance. Residue class is a proxy for organic-matter potential, not an observed gain in soil carbon. Heavy rain on bare soil is an exposure indicator, not a soil-loss estimate.',
  },
  {
    title: 'MODIS NDVI checks greenness, not harvests',
    body: 'A 250 m pixel can mix several fields, and greenness is not grain. The check covers only the current rotation and is reported whatever it shows. It is unavailable when the modeled index barely varies, as under full irrigation.',
  },
  {
    title: 'SoilGrids is optional and sometimes has no data',
    body: 'The service can time out or return nothing for a location, as it did at two of the three demonstration points. HindSight then uses the soil texture the farmer provides.',
  },
  {
    title: 'Crop values and sowing dates need local checking',
    body: 'Crop parameters are generic published FAO figures, not local varieties, and the demonstration sowing dates are typical values. Confirm both with your local extension service. Crops without a sourced yield-response value, such as rice, cannot be scored yet.',
  },
]

export function Science() {
  return (
    <section id="science" aria-labelledby="science-title" className="relative overflow-x-clip pb-20 sm:pb-28">
      <div aria-hidden="true" className="absolute top-24 -left-40 -z-10 h-[28rem] w-[28rem] rounded-full bg-peri/35 blur-[100px]" />
      <div className="container-page">
        <SectionHeading
          id="science-title"
          eyebrow="Data & science"
          title="Science that explains its reasoning."
          description="Three public datasets and a set of published methods. Each result can be traced to its source, and each limit is stated plainly."
        />

        {/* Data sources */}
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {SOURCES.map((s, i) => (
            <Reveal as="article" key={s.name} delay={i * 100} className="flex flex-col rounded-[1.75rem] bg-white p-2.5 shadow-hairline ring-1 ring-border">
              <div className={cx('h-36 rounded-[1.35rem] p-3', s.tone)}>{s.art}</div>
              <div className="flex flex-1 flex-col px-3.5 pt-5 pb-3.5">
                <p className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-muted uppercase">{s.role}</p>
                <h3 className="mt-1.5 flex items-center gap-2.5 text-[1.375rem] leading-tight">
                  <s.icon className="h-5 w-5 shrink-0 text-forest-800" aria-hidden="true" />
                  {s.name}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Engine */}
        <Reveal as="article" delay={120} className="on-dark relative mt-4 overflow-hidden rounded-[1.75rem] bg-forest-950 p-6 sm:p-9">
          <div aria-hidden="true" className="bg-grid-dark absolute inset-0 [mask-image:linear-gradient(105deg,transparent_30%,black)]" />
          <div className="relative">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:gap-12">
              <div>
                <p className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-sage uppercase">The engine</p>
                <h3 className="mt-1.5 flex items-center gap-2.5 text-[1.625rem] leading-tight text-cream-50 sm:text-[1.875rem]">
                  <FlaskConical className="h-6 w-6 shrink-0 text-lime" aria-hidden="true" />
                  Crop and water simulation
                </h3>
              </div>
              <div className="grid gap-x-8 gap-y-3 text-[0.9375rem] leading-relaxed text-mist sm:grid-cols-2">
                <p>
                  For every rotation, the engine works out what each crop would have needed and received on every day of
                  the record, then scores each season. It is deterministic: the same inputs always give the same answer.
                </p>
                <p>
                  There is no machine-learning model and no yield prediction. The written explanations are fixed
                  templates filled in with the computed numbers.
                </p>
              </div>
            </div>

            <ol className="mt-8 flex flex-col gap-2 lg:flex-row lg:items-stretch">
              {PIPELINE.map((p, i) => (
                <li key={p.step} className="flex flex-col items-center gap-2 lg:flex-1 lg:flex-row">
                  <div className="w-full flex-1 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 lg:h-full">
                    <p className="font-display text-[0.75rem] font-semibold text-lime tabular-nums">{String(i + 1).padStart(2, '0')}</p>
                    <p className="mt-1 flex items-start justify-between gap-2 font-display text-[1.0625rem] leading-tight font-semibold text-cream-50">
                      <span>{p.step}</span>
                      <InfoTip label={p.step} tone="dark" className="mt-0.5 shrink-0">
                        {p.tip}
                      </InfoTip>
                    </p>
                    <p className="mt-1.5 text-[0.8125rem] leading-snug font-semibold text-mist">{p.method}</p>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <>
                      <ChevronRight className="hidden h-4 w-4 shrink-0 text-sage lg:block" aria-hidden="true" />
                      <ChevronDown className="h-4 w-4 shrink-0 text-sage lg:hidden" aria-hidden="true" />
                    </>
                  )}
                </li>
              ))}
            </ol>

            <div className="mt-7 border-t border-white/10 pt-5">
              <p className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-sage uppercase">How it has been checked</p>
              <ul className="mt-3 grid gap-x-8 gap-y-2.5 text-[0.875rem] leading-snug text-mist sm:grid-cols-3">
                {CHECKS.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* Limits */}
        <div className="mt-20 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:gap-16">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <Reveal>
              <h3 className="max-w-[14ch] text-[2rem] leading-[1.08] tracking-[-0.03em] sm:text-[2.5rem]">
                What the results can and <span className="text-muted">can’t tell you.</span>
              </h3>
            </Reveal>
            <Reveal delay={100}>
              <p className="mt-4 max-w-[26rem] text-[1.0625rem] leading-relaxed text-muted">
                HindSight supports a farmer’s judgment; it does not replace it, or the advice of local agricultural experts.
              </p>
            </Reveal>
            <Reveal delay={180} className="mt-8 flex items-end gap-3">
              <Mascot name="mint" className="animate-float-tilt w-28 shrink-0 sm:w-32" sizes="128px" />
              <p className="relative mb-6 rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[0.875rem] leading-snug font-bold text-forest-950 shadow-soft ring-1 ring-border">
                Read these before you trust a ranking. They are part of the result.
              </p>
            </Reveal>
          </div>
          <div className="space-y-2.5">
            {LIMITS.map((l, i) => (
              <Reveal key={l.title} delay={i * 60}>
                <details className="group rounded-2xl bg-white ring-1 ring-border transition-shadow duration-300 open:shadow-soft" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-display text-[1.0625rem] leading-snug font-semibold text-forest-950 [&::-webkit-details-marker]:hidden">
                    {l.title}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand transition-transform duration-300 group-open:rotate-180">
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-[0.9375rem] leading-relaxed text-ink">{l.body}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
