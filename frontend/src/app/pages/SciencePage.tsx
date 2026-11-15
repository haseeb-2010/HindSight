import { CloudSun, FlaskConical, Layers, Satellite } from 'lucide-react'
import { Card, MascotNote } from '../components/controls'
import { Accordion, CITATIONS, LIMITS } from '../results/ProvenanceTab'

const SOURCES = [
  {
    icon: CloudSun,
    name: 'NASA POWER',
    role: 'Drives every simulated day',
    body: 'Daily maximum and minimum temperature, rainfall, sunlight, humidity and wind for 1984–2024, estimated for a grid cell about 50 km wide. Demonstration farms use a stored copy; a custom field triggers a download for its point.',
  },
  {
    icon: Layers,
    name: 'ISRIC SoilGrids',
    role: 'Optional soil suggestion',
    body: 'Sand, clay and organic carbon for the top 30 cm of a 250 m grid square. It may have no data for a location, and it never overrides what you enter yourself.',
  },
  {
    icon: Satellite,
    name: 'MODIS NDVI',
    role: 'Independent check',
    body: 'Vegetation greenness, 2001–2024, compared with the modelled index as an outside check. Available only where a series is already stored; HindSight does not start a satellite download for a custom field.',
  },
]

const STEPS = [
  ['Reference evapotranspiration', 'FAO-56 Penman–Monteith, daily, from the weather record.'],
  ['Crop water need', 'FAO-56 crop coefficients through four growth stages; roots deepen until mid-season.'],
  ['Daily soil-water balance', 'One soil-water store. Rain and irrigation in; crop use and drainage out. Stress begins when the soil dries past a crop-specific threshold.'],
  ['Season index', 'FAO-33 water-production function multiplied by a temperature-suitability factor (EcoCrop ranges), and the legume effect where it applies. Zero if a killing frost occurs.'],
  ['Hindcast', 'Every rotation is replayed through 1985–2024, once for each starting phase of its cycle.'],
  ['Ranking', 'Indicators are scaled between the rotations compared, weighted by your priorities and ranked. Pareto-efficient rotations are marked.'],
  ['Robustness', 'Ranks are recomputed with rainfall ±30% and with the legume effect at 0%, 7%, 20% and 32%.'],
]

export function SciencePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <h1 className="text-[1.875rem] leading-[1.08] tracking-[-0.03em] sm:text-[2.375rem]">Data &amp; science</h1>
          <p className="mt-2.5 text-[1.0625rem] leading-relaxed text-muted">
            What HindSight reads, what the engine does with it, and where its limits are. The engine is a deterministic simulation: the same inputs always give the same answer, and
            there is no machine-learning model or yield prediction.
          </p>
        </div>
        <MascotNote mascot="mint" className="max-w-xs">
          Every result page also has a “Data &amp; validation” tab with the sources used for that analysis.
        </MascotNote>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SOURCES.map((s) => (
          <Card key={s.name} as="article">
            <p className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-muted uppercase">{s.role}</p>
            <h2 className="mt-1.5 flex items-center gap-2.5 text-[1.25rem]">
              <s.icon className="h-5 w-5 shrink-0 text-forest-800" aria-hidden="true" />
              {s.name}
            </h2>
            <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink">{s.body}</p>
          </Card>
        ))}
      </div>

      <section className="rounded-[1.5rem] bg-forest-950 p-6 text-cream-50 sm:p-8">
        <h2 className="flex items-center gap-2.5 text-[1.5rem] text-cream-50">
          <FlaskConical className="h-6 w-6 text-lime" aria-hidden="true" /> What the engine does
        </h2>
        <ol className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime/10 font-display text-[0.8125rem] font-semibold text-lime ring-1 ring-lime/40 tabular-nums">{i + 1}</span>
              <div>
                <h3 className="text-[1.0625rem] text-cream-50">{title}</h3>
                <p className="mt-0.5 text-[0.9375rem] leading-snug text-mist">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[1.375rem]">Limits to keep in mind</h2>
          <div className="space-y-2">
            {LIMITS.map((l, i) => (
              <Accordion key={l.title} title={l.title} open={i === 0}>
                <p>{l.body}</p>
              </Accordion>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-[1.375rem]">Sources and citations</h2>
          <div className="space-y-2">
            {CITATIONS.map((c, i) => (
              <Accordion key={c.name} title={c.name} open={i === 0}>
                <p>{c.text}</p>
                {c.href && (
                  <p className="mt-2">
                    <a href={c.href} target="_blank" rel="noreferrer noopener" className="font-bold text-forest-950 underline decoration-sage underline-offset-2 hover:decoration-forest-950">
                      {c.href.replace(/^https?:\/\//, '')}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                )}
              </Accordion>
            ))}
          </div>
          <p className="mt-3 text-[0.8125rem] text-muted">HindSight uses these public datasets. It is not affiliated with or endorsed by NASA, ISRIC or FAO.</p>
        </section>
      </div>
    </div>
  )
}
