import { CalendarRange, CloudSun, Layers, Satellite } from 'lucide-react'
import { Reveal } from '../components/ui/Reveal'

const SOURCES = [
  {
    icon: CloudSun,
    name: 'NASA POWER',
    detail: 'Daily weather, 1984–2024',
    note: 'Temperature, rain, sun, humidity, wind · about 50 km grid cells',
  },
  {
    icon: Satellite,
    name: 'MODIS NDVI',
    detail: 'Vegetation greenness, 2001–2024',
    note: 'Terra MOD13Q1 · 250 m pixels, 16-day composites',
  },
  {
    icon: Layers,
    name: 'ISRIC SoilGrids',
    detail: 'Soil properties, optional',
    note: 'Sand, clay and organic carbon · 250 m grid',
  },
]

export function TrustStrip({ hindcast }: { hindcast?: { start_year: number; end_year: number; spin_up_year: number } }) {
  const start = hindcast?.start_year ?? 1985
  const end = hindcast?.end_year ?? 2024
  return (
    <section id="data" aria-labelledby="data-title" className="relative pt-20 pb-4 sm:pt-24 sm:pb-6">
      <div className="container-page">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-[0.75rem] font-extrabold tracking-[0.12em] text-muted uppercase">Data foundations</p>
          <h2 id="data-title" className="mt-4 text-[1.75rem] leading-[1.12] tracking-[-0.025em] sm:text-[2.25rem]">
            Grounded in Earth observations. <span className="text-muted">Designed around real farming decisions.</span>
          </h2>
        </Reveal>

        <div className="mt-12 rounded-[1.75rem] border border-border bg-cream-50 p-2.5 shadow-hairline">
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCES.map((s, i) => (
              <Reveal as="li" key={s.name} delay={i * 80} className="group rounded-[1.25rem] bg-sand p-5 transition-colors duration-300 hover:bg-[#ebe5d8]">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime transition-transform duration-300 group-hover:-rotate-6">
                    <s.icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[1.125rem] leading-tight">{s.name}</h3>
                    <p className="text-[0.8125rem] font-bold text-ink">{s.detail}</p>
                  </div>
                </div>
                <p className="mt-3 text-[0.8125rem] leading-snug text-ink">{s.note}</p>
              </Reveal>
            ))}
            <Reveal as="li" delay={240} className="rounded-[1.25rem] bg-forest-950 p-5 text-cream-50">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime text-forest-950">
                  <CalendarRange className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[1.125rem] leading-tight text-cream-50 tabular-nums">
                    {start}–{end}
                  </h3>
                  <p className="text-[0.8125rem] font-bold text-sage">Historical analysis period</p>
                </div>
              </div>
              <p className="mt-3 text-[0.8125rem] leading-snug text-cream-50/85">
                {end - start + 1} seasons replayed day by day; {hindcast?.spin_up_year ?? start - 1} warms up the soil water.
              </p>
            </Reveal>
          </ul>
        </div>
        <Reveal as="p" delay={120} className="mx-auto mt-6 max-w-2xl text-center text-[0.8125rem] leading-relaxed text-muted">
          Public, openly licensed datasets read through their official web services. HindSight is an independent
          project and is not affiliated with or endorsed by NASA or ISRIC.
        </Reveal>
      </div>
    </section>
  )
}
