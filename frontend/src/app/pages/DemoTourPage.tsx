import { ArrowLeft, Check, RotateCcw, SkipForward, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../../components/brand/Logo'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/ui/Mascot'
import { usePrefersReducedMotion } from '../../hooks/useMotion'
import { useResource } from '../../hooks/useResource'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'
import type { AnalysisEnvelope } from '../../lib/types'
import { Callout } from '../components/controls'
import { SourceBadge } from '../components/SourceBadge'
import { Narration, Stage, TOUR_PRESET, TOUR_STEPS } from '../demo/tour'
import { Chip } from '../results/shared'
import { useCropNames } from '../state/useCropNames'
import { useWorkspace } from '../state/workspace'

const LAST = TOUR_STEPS.length - 1

/**
 * The guided tour: nine steps through the real application, on the saved engine output for
 * Chakwal, with one live engine run (step 7). Every panel on the right is the same component
 * the workspace uses, fed the same kind of analysis envelope.
 */
export default function DemoTourPage() {
  const { presets } = useWorkspace()
  const names = useCropNames()
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const [params, setParams] = useSearchParams()
  const [demo, reload] = useResource<AnalysisEnvelope>((s) => api.demo(TOUR_PRESET, s), 'tour-demo')
  const heading = useRef<HTMLHeadingElement>(null)

  const asked = Number(params.get('step'))
  const index = Number.isInteger(asked) && asked >= 1 && asked <= TOUR_STEPS.length ? asked - 1 : 0
  const step = TOUR_STEPS[index]
  const preset = presets.data?.presets.find((p) => p.id === TOUR_PRESET)

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(LAST, next))
      setParams(clamped === 0 ? {} : { step: String(clamped + 1) })
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
      window.setTimeout(() => heading.current?.focus({ preventScroll: true }), 80)
    },
    [setParams, reduced],
  )

  useEffect(() => {
    const before = document.title
    document.title = 'HindSight — Guided tour'
    return () => {
      document.title = before
    }
  }, [])

  // Left and right arrow keys move between steps, unless the user is typing or adjusting a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.altKey || e.ctrlKey || e.metaKey || (t && (t.closest('input, textarea, select, [role="radiogroup"], [role="tablist"], [role="slider"], .leaflet-container') || t.isContentEditable))) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index])

  const needsData = index > 0 && index < LAST

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#tour-main" className="sr-only rounded-full bg-forest-950 px-4 py-2 font-bold text-cream-50 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60]">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-forest-950/[0.07] bg-cream-50/90 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-[96rem] items-center gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="HindSight home" className="shrink-0 rounded-lg">
            <Logo wordmarkClassName="text-[1.25rem]" markClassName="h-6 w-6" />
          </Link>
          <span className="hidden h-6 w-px bg-border-strong sm:block" aria-hidden="true" />
          <p className="hidden text-[0.8125rem] font-bold text-muted sm:block">Guided tour</p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/app/analysis?preset=${TOUR_PRESET}`)}
              className="flex items-center gap-1.5 rounded-full border border-border-strong bg-white px-3 py-1.5 text-[0.8125rem] font-bold text-forest-950 transition-colors hover:border-forest-950/40"
            >
              <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
              Skip to analysis
            </button>
            <Link
              to="/app"
              className="flex items-center gap-1.5 rounded-full bg-forest-950 px-3 py-1.5 text-[0.8125rem] font-bold text-cream-50 transition-colors hover:bg-forest-900"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Exit <span className="hidden sm:inline">demo</span>
            </Link>
          </div>
        </div>

        <nav aria-label="Tour steps" className="border-t border-forest-950/[0.06]">
          <ol className="mx-auto flex max-w-[96rem] items-center gap-1.5 px-4 py-2 sm:px-6">
            {TOUR_STEPS.map((s, i) => {
              const done = i < index
              const on = i === index
              return (
                <li key={s.id} className={cx('min-w-0', on ? 'flex-[2_1_0%] sm:flex-[3_1_0%]' : 'flex-1')}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={on ? 'step' : undefined}
                    aria-label={`Step ${i + 1} of ${TOUR_STEPS.length}: ${s.title}${done ? ' (visited)' : ''}`}
                    title={`${i + 1}. ${s.title}`}
                    className={cx(
                      'group flex h-8 w-full items-center gap-1.5 rounded-full px-2 text-[0.75rem] font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950',
                      on ? 'bg-forest-950 text-cream-50' : done ? 'bg-lime-100 text-forest-950 hover:bg-lime' : 'bg-sand text-ink hover:bg-sand-300',
                    )}
                  >
                    <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full tabular-nums', on ? 'bg-lime text-forest-950' : 'bg-white/70')}>
                      {done ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : i + 1}
                    </span>
                    {on && <span className="hidden truncate sm:block">{s.short}</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </header>

      <main id="tour-main" className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:pb-10">
        <div className="grid items-start gap-6 lg:grid-cols-[23rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)] xl:gap-8">
          {/* Narration: what this step shows and why it matters */}
          <aside className="lg:sticky lg:top-[7.75rem]">
            <div key={step.id} className="animate-rise rounded-[1.5rem] bg-white p-5 shadow-soft ring-1 ring-border sm:p-6">
              <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase tabular-nums">
                Step {index + 1} of {TOUR_STEPS.length}
              </p>
              <h1 ref={heading} tabIndex={-1} className="mt-1.5 text-[1.625rem] leading-[1.1] tracking-[-0.025em] outline-none sm:text-[1.875rem]">
                {step.title}
              </h1>
              <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-ink">
                <Narration step={step.id} env={demo.data} preset={preset} names={names} />
              </div>

              <div className="mt-5 hidden items-center gap-2 lg:flex">
                <Button variant="secondary" icon={<ArrowLeft />} disabled={index === 0} onClick={() => go(index - 1)}>
                  Previous
                </Button>
                {index < LAST ? (
                  <Button arrow onClick={() => go(index + 1)} className="flex-1 justify-between">
                    Next: {TOUR_STEPS[index + 1].short}
                  </Button>
                ) : (
                  <Button icon={<RotateCcw />} onClick={() => go(0)} className="flex-1">
                    Start again
                  </Button>
                )}
              </div>
              <p className="mt-3 hidden text-[0.75rem] font-semibold text-muted lg:block">Tip: the ← and → keys also move between steps.</p>
            </div>
          </aside>

          {/* Stage: the real application component for this step */}
          <section aria-label={`${step.title}: live view of the application`} className="min-w-0 space-y-4">
            {index > 0 && (
              <div className="flex flex-wrap items-center gap-2" data-tour-dataset>
                <Chip tone="forest">Demonstration dataset — Chakwal, Pakistan</Chip>
                {demo.data && <SourceBadge env={demo.data} />}
                <span className="text-[0.8125rem] font-semibold text-muted">
                  {step.id === 'scenario' ? 'Step 7 runs the engine live; everything else in the tour is the saved engine output.' : 'Engine output generated earlier from stored NASA data, shown unchanged.'}
                </span>
              </div>
            )}

            {needsData && demo.status === 'loading' && (
              <div role="status" aria-label="Loading the demonstration analysis" className="space-y-4">
                <div className="skeleton h-40 rounded-[1.5rem]" />
                <div className="skeleton h-72 rounded-[1.5rem]" />
              </div>
            )}
            {needsData && demo.status === 'error' && (
              <Callout tone="warn" title="The demonstration analysis could not be loaded">
                <p>{demo.error}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={reload} icon={<RotateCcw />}>
                    Try again
                  </Button>
                </div>
              </Callout>
            )}
            {(!needsData || demo.status === 'ready') && (
              <ErrorBoundary key={step.id} label="This tour step">
                <div key={step.id} className="animate-fade min-w-0">
                  <Stage step={step.id} env={demo.data} preset={preset} names={names} onGo={(id) => go(TOUR_STEPS.findIndex((s) => s.id === id))} onRestart={() => go(0)} />
                </div>
              </ErrorBoundary>
            )}
          </section>
        </div>
      </main>

      {/* Step controls stay within reach on phones and tablets */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-forest-950/[0.08] bg-cream-50/95 px-4 py-3 backdrop-blur-xl lg:hidden print:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <Button variant="secondary" icon={<ArrowLeft />} disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous step">
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Back</span>
          </Button>
          {index < LAST ? (
            <Button arrow onClick={() => go(index + 1)} className="min-w-0 flex-1 justify-between">
              <span className="truncate">Next: {TOUR_STEPS[index + 1].short}</span>
            </Button>
          ) : (
            <Button icon={<RotateCcw />} onClick={() => go(0)} className="flex-1">
              Start again
            </Button>
          )}
        </div>
      </div>

      <footer className="hidden border-t border-forest-950/[0.07] lg:block print:hidden">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-6 px-6 py-4 text-[0.75rem] leading-snug text-muted">
          <p>HindSight is an experimental decision-support tool. Results are historical model simulations, not yield forecasts or guarantees. Uses NASA open data; not affiliated with or endorsed by NASA.</p>
          <Mascot name="mint" decorative className="w-9 shrink-0" sizes="36px" />
        </div>
      </footer>
    </div>
  )
}
