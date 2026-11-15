import { CloudRain, Droplets, GitCompareArrows, History, SlidersHorizontal, Sun, Thermometer } from 'lucide-react'
import type { ReactNode } from 'react'
import { CROP_COLORS, MonthStrip } from '../components/charts/MonthStrip'
import { InfoTip } from '../components/ui/InfoTip'
import { Reveal } from '../components/ui/Reveal'
import { SectionHeading } from '../components/ui/SectionHeading'
import type { Resource } from '../hooks/useResource'
import { currentRotation, isIrrigated, rotationLabel, topAlternative } from '../lib/analysis'
import { cx } from '../lib/cx'
import { fmtMm, fmtNum } from '../lib/format'
import type { AnalysisEnvelope, PresetsResponse, Rotation } from '../lib/types'

interface FeaturesProps {
  spotlight: Resource<AnalysisEnvelope>
  presets: PresetsResponse | null
  placeName: string
}

function Card({
  className,
  icon,
  title,
  children,
  visual,
  tone = 'sand',
  delay = 0,
}: {
  className?: string
  icon: ReactNode
  title: string
  children: ReactNode
  visual: ReactNode
  tone?: 'sand' | 'white' | 'lime' | 'forest'
  delay?: number
}) {
  const dark = tone === 'forest'
  return (
    <Reveal
      as="article"
      delay={delay}
      className={cx(
        'group flex flex-col rounded-[1.75rem] p-2.5 transition-[transform,box-shadow] duration-500 ease-(--ease-soft) hover:-translate-y-1',
        tone === 'sand' && 'bg-sand hover:shadow-lift',
        tone === 'white' && 'bg-white shadow-hairline ring-1 ring-border hover:shadow-lift',
        tone === 'lime' && 'bg-lime hover:shadow-lift',
        tone === 'forest' && 'on-dark bg-forest-900 hover:shadow-deep',
        className,
      )}
    >
      <div
        className={cx(
          'relative min-h-[11.5rem] flex-1 rounded-[1.35rem] p-4 sm:p-5',
          dark ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-white/75 ring-1 ring-forest-950/[0.05]',
        )}
      >
        {visual}
      </div>
      <div className="px-3.5 pt-5 pb-3.5 sm:px-4">
        <div className="flex items-center gap-3">
          <span
            className={cx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-500 group-hover:-rotate-6',
              dark ? 'bg-lime text-forest-950' : tone === 'lime' ? 'bg-forest-950 text-lime' : 'bg-forest-950 text-lime',
            )}
          >
            {icon}
          </span>
          <h3 className={cx('text-[1.3125rem] leading-tight tracking-[-0.02em] sm:text-[1.4375rem]', dark && 'text-cream-50')}>{title}</h3>
        </div>
        <p className={cx('mt-3 text-[0.9875rem] leading-relaxed', dark ? 'text-mist' : 'text-ink')}>{children}</p>
      </div>
    </Reveal>
  )
}

function VisualSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-10 w-5/6" />
    </div>
  )
}

function ExampleTag({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={cx('text-[0.6875rem] font-extrabold tracking-[0.07em] uppercase', dark ? 'text-mist' : 'text-muted')}>{children}</p>
  )
}

export function Features({ spotlight, presets, placeName }: FeaturesProps) {
  const res = spotlight.data?.result
  const cur = res ? currentRotation(res) : undefined
  const alt = res ? topAlternative(res) : undefined
  const climate = res?.site.climate_summary
  const cropNames = presets?.crop_names ?? {}
  const pair: Rotation[] = cur && alt ? [cur, alt] : []
  const cropOrder = [...new Set(pair.flatMap((r) => r.slots.map((s) => s.crop_id)))]
  const maxWater = Math.max(...pair.map((r) => r.hindcast.water_demand_mm_per_year), 1)
  const failed = spotlight.status === 'error'
  const unavailable = <p className="text-sm font-semibold text-muted">Example data is unavailable right now.</p>

  return (
    <section id="about" aria-labelledby="features-title" className="relative py-20 sm:py-28">
      <div className="container-page">
        <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
          <SectionHeading
            id="features-title"
            align="left"
            eyebrow="What HindSight does"
            title="Better context for every rotation decision."
          />
          <Reveal delay={160}>
            <p className="max-w-[30rem] text-[1.0625rem] leading-relaxed text-muted lg:ml-auto lg:pb-2">
              HindSight replays your current rotation and its alternatives through four decades of daily weather, then
              lays out what each one would have meant for your field. Examples below are real engine results for{' '}
              {placeName}.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-12">
          <Card
            className="lg:col-span-7"
            icon={<History className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />}
            title="Understand your field’s history"
            visual={
              failed ? unavailable : !climate ? <VisualSkeleton /> : (
                <div>
                  <ExampleTag>{placeName} · yearly average, {res?.meta.record.start_year}–{res?.meta.record.end_year}</ExampleTag>
                  <dl className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-2.5">
                    {[
                      { icon: CloudRain, label: 'Rainfall', value: fmtMm(climate.annual_rain_mm), tip: null },
                      {
                        icon: Sun,
                        label: 'Reference ET₀',
                        value: fmtMm(climate.annual_et0_mm),
                        tip: 'How much water a reference grass surface would evaporate and transpire in this climate (FAO-56 Penman–Monteith). A measure of the air’s drying power.',
                      },
                      { icon: Thermometer, label: 'Mean temp.', value: `${fmtNum(climate.mean_temp_c, 1)} °C`, tip: null },
                    ].map((m) => (
                      <div key={m.label} className="flex items-center justify-between gap-3 rounded-2xl bg-sand/80 px-3.5 py-2.5 sm:block sm:p-3.5">
                        <dt className="flex items-center gap-1.5 text-[0.8125rem] font-bold whitespace-nowrap text-ink sm:text-[0.75rem]">
                          <m.icon className="h-3.5 w-3.5 shrink-0 text-forest-800" aria-hidden="true" />
                          <span>{m.label}</span>
                          {m.tip && <InfoTip label="Reference evapotranspiration (ET₀)">{m.tip}</InfoTip>}
                        </dt>
                        <dd className="font-display text-[1.25rem] leading-none font-semibold whitespace-nowrap text-forest-950 tabular-nums sm:mt-1.5 sm:text-[1.5rem]">
                          {m.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3.5 text-[0.8125rem] leading-snug text-ink">
                    Plus hot days, frost days and heavy-rain days, compared between {res?.meta.windows?.early?.join('–') ?? 'the early'} and{' '}
                    {res?.meta.windows?.late?.join('–') ?? 'late'} with a trend test.
                  </p>
                </div>
              )
            }
          >
            Read historical temperature, rainfall, reference evapotranspiration and other environmental patterns for your
            location.
          </Card>

          <Card
            className="lg:col-span-5"
            tone="white"
            delay={90}
            icon={<GitCompareArrows className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />}
            title="Compare crop rotations"
            visual={
              failed ? unavailable : pair.length < 2 ? <VisualSkeleton /> : (
                <div>
                  <ExampleTag>Months with a crop in the ground</ExampleTag>
                  <div className="mt-3 space-y-3.5">
                    {pair.map((r, i) => (
                      <div key={r.id}>
                        <p className="mb-1.5 flex items-center justify-between gap-2 text-[0.8125rem] font-bold text-forest-950">
                          <span className="truncate">{rotationLabel(r)}</span>
                          <span className="shrink-0 text-[0.6875rem] font-extrabold tracking-wide text-muted uppercase">
                            {i === 0 ? 'Current' : 'Top-ranked'}
                          </span>
                        </p>
                        {r.calendar && (
                          <MonthStrip calendar={r.calendar} cropOrder={cropOrder} cropNames={cropNames} label={rotationLabel(r)} showMonths={i === 1} compact />
                        )}
                      </div>
                    ))}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] font-bold text-ink">
                    {cropOrder.map((id, i) => (
                      <li key={id} className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: CROP_COLORS[i % CROP_COLORS.length] }} />
                        {cropNames[id] ?? id}
                      </li>
                    ))}
                    <li className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm border border-sand-400 bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(207_203_194)_2px_3px)]" />
                      Bare soil
                    </li>
                  </ul>
                </div>
              )
            }
          >
            Set your current rotation beside alternative crop combinations, simulated by the same engine under the same
            weather.
          </Card>

          <Card
            className="lg:col-span-5"
            tone="lime"
            delay={60}
            icon={<Droplets className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />}
            title="Explore water resilience"
            visual={
              failed ? unavailable : pair.length < 2 ? <VisualSkeleton /> : (
                <div>
                  <ExampleTag>Modeled crop water demand per year</ExampleTag>
                  <div className="mt-4 space-y-3">
                    {pair.map((r, i) => (
                      <div key={r.id}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.8125rem] font-bold text-forest-950">
                          <span className="truncate">{rotationLabel(r)}</span>
                          <span className="shrink-0 font-display text-base font-semibold tabular-nums">{fmtMm(r.hindcast.water_demand_mm_per_year)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-sand">
                          <div
                            className={cx('h-full rounded-full', i === 0 ? 'bg-peri-chart' : 'bg-forest-950')}
                            style={{ width: `${(r.hindcast.water_demand_mm_per_year / maxWater) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3.5 text-[0.8125rem] leading-snug text-ink">
                    {isIrrigated(spotlight.data)
                      ? 'Water the crops would use in a year; the irrigation share is reported separately.'
                      : `${placeName} is rainfed, so this is water the crops would need, not irrigation applied.`}
                  </p>
                </div>
              )
            }
          >
            See modeled water demand, historical stress patterns and the trade-offs between rotation options.
          </Card>

          <Card
            className="lg:col-span-7"
            tone="forest"
            delay={120}
            icon={<SlidersHorizontal className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />}
            title="Make priorities matter"
            visual={
              !presets ? (
                <VisualSkeleton />
              ) : (
                <div>
                  <ExampleTag dark>Weights used for the demonstration farms · 0–5</ExampleTag>
                  <ul className="mt-3.5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                    {Object.entries(presets.default_priorities).map(([key, w]) => (
                      <li key={key} className="flex items-center justify-between gap-3">
                        <span className="text-[0.8125rem] font-bold text-cream-50">{presets.priority_labels[key] ?? key}</span>
                        <span className="flex shrink-0 gap-1" role="img" aria-label={`weight ${w} of 5`}>
                          {[1, 2, 3, 4, 5].map((d) => (
                            <span key={d} className={cx('h-2 w-2 rounded-full', d <= w ? 'bg-lime' : 'bg-white/15')} />
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 border-t border-white/10 pt-3.5 text-[0.8125rem] leading-snug text-mist">
                    Each indicator is scaled between the rotations being compared, then weighted by these priorities to
                    give a relative ranking.
                  </p>
                </div>
              )
            }
          >
            Weigh stability, water use, forage, legume contribution, ground cover and market suitability, and see how
            the ranking responds.
          </Card>
        </div>
      </div>
    </section>
  )
}
