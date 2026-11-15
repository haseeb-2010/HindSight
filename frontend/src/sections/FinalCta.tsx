import { ButtonLink, ButtonRouterLink } from '../components/ui/Button'
import { Mascot } from '../components/ui/Mascot'
import { Pill } from '../components/ui/Pill'
import { Reveal } from '../components/ui/Reveal'

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="on-dark relative isolate overflow-hidden bg-forest-950 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div aria-hidden="true" className="bg-grid-dark absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_80%_90%_at_50%_0%,black,transparent)]" />
      <div aria-hidden="true" className="absolute -top-32 left-1/4 -z-10 h-72 w-[36rem] rounded-full bg-peri-600/20 blur-[110px]" />

      <div className="container-page grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div>
          <Reveal>
            <Pill tone="dark">Start exploring</Pill>
          </Reveal>
          <Reveal delay={80}>
            <h2 id="cta-title" className="mt-6 text-[2.5rem] leading-[1.03] tracking-[-0.035em] text-cream-50 sm:text-[3.5rem] lg:text-[4rem]">
              Your field has a history. <span className="block text-lime">Put it to work.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-[30rem] text-[1.0625rem] leading-relaxed text-mist sm:text-lg">
              Explore historical conditions, compare possible rotations, and make your next decision with more context.
            </p>
          </Reveal>
          <Reveal delay={240} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="#explore" variant="accent" size="lg" arrow className="justify-between sm:justify-center">
              Explore a Demo Farm
            </ButtonLink>
            <ButtonRouterLink to="/demo" variant="ghostDark" size="lg">
              Take the Guided Tour
            </ButtonRouterLink>
          </Reveal>
        </div>

        <Reveal delay={160} className="relative mx-auto w-full max-w-[36rem] lg:max-w-none">
          <div className="animate-float-tilt rounded-[1.75rem] bg-cream-50 p-2.5 shadow-deep ring-1 ring-white/10">
            <Mascot name="group" imgClassName="rounded-[1.3rem]" sizes="(min-width: 1024px) 560px, 90vw" />
            <p className="px-3 pt-3 pb-1.5 text-center text-[0.8125rem] font-bold text-ink">
              The HindSight crew: friendly company for some serious field history.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
