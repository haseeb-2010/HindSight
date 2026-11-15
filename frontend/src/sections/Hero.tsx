import { ArrowDown, Check, PlayCircle } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../components/ui/Button'
import { Pill } from '../components/ui/Pill'
import type { Resource } from '../hooks/useResource'
import type { AnalysisEnvelope, Preset } from '../lib/types'
import { HeroPreview } from './HeroPreview'

function Words({ text, start, step = 55, className }: { text: string; start: number; step?: number; className?: string }) {
  return text.split(' ').map((w, i, arr) => (
    <span key={i}>
      <span className={`animate-rise inline-block ${className ?? ''}`} style={{ '--delay': `${start + i * step}ms` } as CSSProperties}>
        {w}
      </span>
      {i < arr.length - 1 ? ' ' : ''}
    </span>
  ))
}

interface HeroProps {
  spotlight: Resource<AnalysisEnvelope>
  spotlightPreset: Preset | undefined
  onRetry: () => void
}

export function Hero({ spotlight, spotlightPreset, onRetry }: HeroProps) {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative px-2 pt-2 sm:px-3 sm:pt-3">
      <div className="relative isolate overflow-hidden rounded-[1.75rem] bg-[linear-gradient(180deg,#e9edfb_0%,#f3f2f4_38%,#f8f5ef_70%,#f6f6dc_100%)] ring-1 ring-white/70 ring-inset sm:rounded-(--radius-canvas)">
        {/* Backdrop: grid, soft light, terrain contours */}
        <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_75%_65%_at_62%_38%,black_20%,transparent_78%)]" />
        <div aria-hidden="true" className="animate-drift absolute -top-[22%] -right-[12%] -z-10 h-[70%] w-[62%] rounded-full bg-peri/55 blur-[90px]" />
        <div aria-hidden="true" className="absolute -bottom-[30%] -left-[14%] -z-10 h-[62%] w-[56%] rounded-full bg-lime-100 blur-[80px]" />
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 -z-10 h-[34%] w-full text-forest-950/[0.07]"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M0 ${120 + i * 26} C 240 ${70 + i * 30}, 420 ${170 + i * 22}, 720 ${110 + i * 26} S 1200 ${60 + i * 30}, 1440 ${130 + i * 24}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        <div className="container-page relative grid items-center gap-16 pt-28 pb-16 sm:pt-32 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-10 lg:pt-44 lg:pb-40 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-12">
          <div className="max-w-[40rem]">
            <div className="animate-rise" style={{ '--delay': '60ms' } as CSSProperties}>
              <Pill pulse>NASA Earth Data · Climate-Aware Crop Rotation</Pill>
            </div>

            <h1
              id="hero-title"
              className="mt-7 text-[2.75rem] leading-[1.03] tracking-[-0.035em] sm:text-[3.75rem] lg:text-[3.5rem] xl:text-[4.125rem]"
            >
              <span className="relative inline-block">
                <Words text="Look back" start={140} />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 300 110"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute -inset-x-[9%] -inset-y-[22%] h-[144%] w-[118%] overflow-visible"
                >
                  <path
                    pathLength={1}
                    className="draw-path"
                    style={{ '--delay': '950ms' } as CSSProperties}
                    d="M196 9C122 0 30 14 12 50c-16 33 55 55 148 52 92-3 136-27 128-57C281 17 200 6 150 8"
                    fill="none"
                    stroke="var(--color-peri-300)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </span>{' '}
              <Words text="at your land." start={250} />{' '}
              <span className="text-muted xl:block">
                <Words text="Make a more informed move forward." start={460} step={50} />
              </span>
            </h1>

            <p
              className="animate-rise mt-7 max-w-[34rem] text-[1.0625rem] leading-relaxed text-ink sm:text-[1.1875rem]"
              style={{ '--delay': '760ms' } as CSSProperties}
            >
              HindSight brings historical NASA observations, local soil information, and crop science together to help
              farmers compare rotation strategies and explore more resilient ways to manage their fields.
            </p>

            <div className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ '--delay': '880ms' } as CSSProperties}>
              <ButtonLink href="#explore" size="lg" arrow className="justify-between sm:justify-center">
                Explore a Demo Farm
              </ButtonLink>
              <ButtonLink href="#how-it-works" size="lg" variant="secondary" icon={<ArrowDown strokeWidth={2.4} />}>
                See How It Works
              </ButtonLink>
            </div>

            <p className="animate-rise mt-5" style={{ '--delay': '940ms' } as CSSProperties}>
              <Link
                to="/demo"
                className="group inline-flex items-center gap-2 rounded-full text-[0.9375rem] font-extrabold text-forest-950 underline decoration-sage decoration-2 underline-offset-4 transition-colors hover:decoration-forest-950"
              >
                <PlayCircle className="h-5 w-5 transition-transform group-hover:scale-110" aria-hidden="true" />
                Take the Guided Tour
              </Link>
              <span className="ml-2 text-[0.875rem] font-bold text-muted">3 to 5 minutes</span>
            </p>

            <ul
              className="animate-rise mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-muted"
              style={{ '--delay': '1000ms' } as CSSProperties}
              aria-label="What HindSight offers"
            >
              {['Historical evidence', 'Clear comparisons', 'Farmer-led decisions'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-forest-950 text-lime">
                    <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden="true" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <HeroPreview spotlight={spotlight} preset={spotlightPreset} onRetry={onRetry} />
        </div>
      </div>
    </section>
  )
}
