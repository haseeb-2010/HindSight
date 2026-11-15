import { CloudRain, Database, MapPin, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { IndexBars } from '../components/charts/IndexBars'
import { Button } from '../components/ui/Button'
import { InfoTip } from '../components/ui/InfoTip'
import { Mascot } from '../components/ui/Mascot'
import { usePointerParallax } from '../hooks/useMotion'
import type { Resource } from '../hooks/useResource'
import { currentRotation, failureThreshold, indexVaries, rankText, rotationLabel, seasonsFailed, topAlternative } from '../lib/analysis'
import { cx } from '../lib/cx'
import { fmtIndex, fmtMm } from '../lib/format'
import type { AnalysisEnvelope, Preset } from '../lib/types'

/** "1994, 1998, 2000–2002" */
export function yearList(years: number[]): string {
  const ys = [...years].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < ys.length; i++) {
    let j = i
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++
    out.push(j - i >= 2 ? `${ys[i]}–${ys[j]}` : ys.slice(i, j + 1).join(', '))
    i = j
  }
  return out.join(', ')
}

function FloatCard({ className, delay, children }: { className?: string; delay: number; children: ReactNode }) {
  return (
    <div className={cx('animate-pop', className)} style={{ '--delay': `${delay}ms` } as CSSProperties}>
      <div className="animate-float rounded-2xl border border-forest-950/[0.06] bg-cream-50/95 p-3.5 shadow-float backdrop-blur" style={{ animationDelay: `${delay / 2}ms` }}>
        {children}
      </div>
    </div>
  )
}

interface HeroPreviewProps {
  spotlight: Resource<AnalysisEnvelope>
  preset: Preset | undefined
  onRetry: () => void
}

export function HeroPreview({ spotlight, preset, onRetry }: HeroPreviewProps) {
  const stage = usePointerParallax<HTMLDivElement>()
  const env = spotlight.data
  const res = env?.result
  const cur = res ? currentRotation(res) : undefined
  const alt = res ? topAlternative(res) : undefined
  const thr = failureThreshold(env)
  const curF = cur ? seasonsFailed(cur) : null
  const altF = alt ? seasonsFailed(alt) : null
  const n = res?.rotations.length ?? 0
  const years = cur?.hindcast.years ?? []
  const worst = cur?.hindcast.worst_years
  const rrRain = alt?.scores.rank_range_rain
  const place = preset ? `${preset.display.place} · ${preset.water_label}` : res?.site.name

  const floats = res && cur && alt && (
    <>
      {indexVaries(cur) && worst?.years?.length && worst.mean_index != null && alt.hindcast.worst_years?.mean_index != null ? (
        <FloatCard delay={1150} className="lg:absolute lg:-top-[6.75rem] lg:-right-5 lg:z-20 lg:w-[14.5rem] xl:-right-10">
          <div className="flex items-center gap-2 text-[0.6875rem] font-extrabold tracking-[0.06em] text-muted uppercase">
            <TrendingUp className="h-3.5 w-3.5 text-forest-800" aria-hidden="true" /> In the 5 worst years
          </div>
          <p className="mt-1.5 font-display text-[1.375rem] leading-none font-semibold text-forest-950 tabular-nums">
            {fmtIndex(worst.mean_index)} <span className="text-sage">→</span> {fmtIndex(alt.hindcast.worst_years.mean_index)}
          </p>
          <p className="mt-1.5 text-[0.75rem] leading-snug font-semibold text-muted">
            Average season index in {yearList(worst.years)}, current vs. top-ranked rotation.
          </p>
        </FloatCard>
      ) : null}
      {rrRain ? (
        <FloatCard delay={1350} className="lg:absolute lg:-bottom-[7.25rem] lg:-left-7 lg:z-20 lg:w-[14rem] xl:-left-12">
          <div className="flex items-center gap-2 text-[0.6875rem] font-extrabold tracking-[0.06em] text-muted uppercase">
            <CloudRain className="h-3.5 w-3.5 text-peri-ink" aria-hidden="true" /> Rainfall ±30%
          </div>
          <p className="mt-1.5 font-display text-[1.375rem] leading-none font-semibold text-forest-950">
            {rrRain[0] === rrRain[1] ? `Still ranked #${rrRain[0]}` : `Ranks #${rrRain[0]}–#${rrRain[1]}`}
          </p>
          <p className="mt-1.5 text-[0.75rem] leading-snug font-semibold text-muted">
            Top-ranked rotation, re-ranked with NASA rainfall 30% lower and higher.
          </p>
        </FloatCard>
      ) : null}
    </>
  )

  return (
    <div ref={stage} className="relative mx-auto w-full max-w-[34rem] [perspective:1400px] lg:mr-0 lg:ml-auto">
      {/* Blue mascot peeking over the card */}
      {/* Entrance, pointer parallax and idle float each get their own wrapper: a running
          animation would otherwise override the inline parallax transform. */}
      <div
        className="animate-pop pointer-events-none absolute -top-[5.5rem] right-4 z-0 w-[7.5rem] sm:-top-[7.25rem] sm:w-[9.5rem] lg:right-auto lg:left-6 lg:-top-[8.6rem] lg:w-[11.5rem]"
        style={{ '--delay': '700ms' } as CSSProperties}
      >
        <div
          className="transition-transform duration-500 ease-out"
          style={{ transform: 'translate3d(calc(var(--px,0) * -8px), calc(var(--py,0) * -5px), 0)' }}
        >
          <div className="animate-float">
            <Mascot name="blue" eager sizes="(min-width: 1024px) 184px, 152px" />
          </div>
        </div>
      </div>

      <div className="animate-rise relative z-10" style={{ '--delay': '420ms' } as CSSProperties}>
      <div
        className="rounded-[1.75rem] bg-white p-5 shadow-float ring-1 ring-forest-950/[0.06] transition-transform duration-500 ease-out sm:p-6"
        style={{ transform: 'rotateX(calc(var(--py,0) * -2deg)) rotateY(calc(var(--px,0) * 3deg))' }}
      >
        {spotlight.status === 'loading' && <PreviewSkeleton />}
        {spotlight.status === 'error' && (
          <div role="alert" className="flex min-h-[22rem] flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-[22rem] text-sm font-semibold text-ink">The preview could not load: {spotlight.error}</p>
            <Button variant="secondary" icon={<RefreshCw />} onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
        {res && cur && alt && (
          <div className="animate-fade">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-[0.75rem] font-extrabold whitespace-nowrap text-forest-950">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {place}
              </span>
              <span className="text-[0.75rem] font-bold whitespace-nowrap text-muted tabular-nums">
                {years.length} seasons · {years[0]}–{years[years.length - 1]}
              </span>
            </div>

            <div className="mt-4">
              <p className="text-[0.75rem] font-extrabold tracking-[0.06em] text-muted uppercase">Current rotation</p>
              <h3 className="mt-0.5 text-[1.375rem] leading-tight tracking-[-0.02em]">{rotationLabel(cur)}</h3>
            </div>

            <div className="mt-4">
              <IndexBars
                years={years}
                values={cur.hindcast.annual_index}
                threshold={thr}
                label={`Season index of ${rotationLabel(cur)} for each year ${years[0]} to ${years[years.length - 1]}${
                  curF ? `: ${curF.failed} of ${curF.total} crop seasons fell below the failure line` : ''
                }.`}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {[
                { r: cur, f: curF, tag: 'Current', tone: 'bg-sand/70' },
                { r: alt, f: altF, tag: 'Top-ranked', tone: 'bg-lime-100' },
              ].map(({ r, f, tag, tone }) => (
                <div key={r.id} className={cx('rounded-2xl p-3.5', tone)}>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 text-[0.6875rem] font-extrabold tracking-[0.05em] text-ink uppercase">
                    <span className="whitespace-nowrap">{tag}</span>
                    <span className="whitespace-nowrap tabular-nums">{rankText(r.scores.rank, n)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-[2.5em] text-[0.8125rem] leading-tight font-bold text-forest-950">{rotationLabel(r)}</p>
                  <dl className="mt-2.5 space-y-1.5">
                    <div>
                      <dt className="text-[0.6875rem] font-bold text-ink">Seasons below failure line</dt>
                      <dd className="font-display text-lg leading-tight font-semibold text-forest-950 tabular-nums">
                        {f ? `${f.failed} of ${f.total}` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] font-bold text-ink">Crop water demand</dt>
                      <dd className="font-display text-lg leading-tight font-semibold text-forest-950 tabular-nums">
                        {fmtMm(r.hindcast.water_demand_mm_per_year)}
                        <span className="text-[0.75rem] font-bold text-ink">/yr</span>
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[0.7rem] font-bold text-muted">
              <span className="inline-flex items-center gap-1.5">
                {env?.source === 'live' ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-forest-800" aria-hidden="true" />
                ) : (
                  <Database className="h-3.5 w-3.5 text-peri-ink" aria-hidden="true" />
                )}
                {env?.source === 'live' ? 'Live engine run' : 'Saved engine result'}
                <InfoTip label={env?.source === 'live' ? 'Live engine run' : 'Saved engine result'} align="end">
                  {env?.source === 'live'
                    ? 'Computed just now by the HindSight engine from cached NASA POWER weather.'
                    : (env?.notice ??
                      'A saved output of the HindSight engine, made from the same cached NASA data. Not a fresh analysis.')}
                </InfoTip>
              </span>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="whitespace-nowrap">Engine v{res.meta.engine_version} · NASA POWER weather</span>
            </div>
          </div>
        )}
      </div>
      </div>

      {floats && <div className="relative z-20 mt-5 grid gap-3 sm:grid-cols-2 lg:static lg:mt-0 lg:block">{floats}</div>}
    </div>
  )
}

function PreviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the preview" className="space-y-4">
      <div className="flex justify-between">
        <div className="skeleton h-6 w-40 rounded-full" />
        <div className="skeleton h-4 w-28" />
      </div>
      <div className="skeleton h-4 w-28" />
      <div className="skeleton h-7 w-64" />
      <div className="flex h-[132px] items-end gap-[3px] pt-4">
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} className="skeleton flex-1 rounded-sm" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 pt-2">
        <div className="skeleton h-36 rounded-2xl" />
        <div className="skeleton h-36 rounded-2xl" />
      </div>
    </div>
  )
}
