import { GitCompareArrows, Layers, MapPin, Scale } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { Reveal } from '../components/ui/Reveal'
import { SectionHeading } from '../components/ui/SectionHeading'
import { useReveal } from '../hooks/useReveal'

const STEPS = [
  {
    icon: MapPin,
    title: 'Choose your field',
    body: 'Select a demonstration location now, or enter your own field location once the full analysis workspace is available.',
  },
  {
    icon: Layers,
    title: 'Understand the conditions',
    body: 'HindSight combines four decades of daily weather with your soil information and the characteristics of each crop.',
  },
  {
    icon: GitCompareArrows,
    title: 'Compare rotations',
    body: 'The engine replays your existing rotation day by day and evaluates possible alternatives under exactly the same weather.',
  },
  {
    icon: Scale,
    title: 'Explore the trade-offs',
    body: 'Review rankings, bad-year stability, water demand, seasonal patterns and the reasoning behind every result.',
  },
]

export function HowItWorks() {
  const track = useReveal<HTMLDivElement>()
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="px-2 sm:px-3">
      <div className="on-dark relative isolate overflow-hidden rounded-[1.75rem] bg-forest-900 py-20 sm:rounded-(--radius-canvas) sm:py-28">
        <div aria-hidden="true" className="bg-grid-dark absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div aria-hidden="true" className="absolute -top-40 left-1/2 -z-10 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-lime/[0.07] blur-3xl" />

        <div className="container-page">
          <SectionHeading
            id="how-title"
            tone="dark"
            wide
            eyebrow="How it works"
            title={
              <>
                From environmental data to <span className="whitespace-nowrap">better-informed</span> decisions.
              </>
            }
            description="Four steps, the same every time. No black box: each one can be traced back to a dataset or a published method."
          />

          <div className="relative mt-16 lg:mt-20">
            {/* Connector: horizontal on desktop, vertical on mobile */}
            <div ref={track} aria-hidden="true" className="reveal-line absolute top-6 right-[12.5%] left-[12.5%] hidden h-px lg:block">
              <div className="h-px w-full bg-[repeating-linear-gradient(90deg,rgb(238_243_132/0.35)_0_6px,transparent_6px_12px)]" />
            </div>
            <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-8">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 140} className="relative flex gap-5 lg:flex-col lg:items-center lg:text-center">
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-12 -bottom-10 left-6 w-px bg-[repeating-linear-gradient(180deg,rgb(238_243_132/0.35)_0_6px,transparent_6px_12px)] lg:hidden"
                    />
                  )}
                  <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest-900 font-display text-[0.9375rem] font-semibold text-lime ring-1 ring-lime/50">
                    <span className="absolute inset-1 rounded-full bg-lime/10" aria-hidden="true" />
                    <span className="relative tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  </span>
                  <div className="lg:mt-7">
                    <div className="flex items-center gap-3 lg:flex-col lg:gap-4">
                      <s.icon className="h-7 w-7 shrink-0 text-lime" strokeWidth={1.6} aria-hidden="true" />
                      <h3 className="text-[1.375rem] leading-tight text-cream-50 sm:text-[1.5rem]">
                        <span className="sr-only">Step {i + 1}: </span>
                        {s.title}
                      </h3>
                    </div>
                    <p className="mt-3 max-w-[26rem] text-[0.9875rem] leading-relaxed text-mist lg:mx-auto lg:max-w-[16rem]">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>

          <Reveal delay={200} className="mt-16 flex justify-center">
            <ButtonLink href="#explore" variant="accent" size="lg" arrow>
              Try it on a demo farm
            </ButtonLink>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
