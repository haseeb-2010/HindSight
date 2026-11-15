import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { STEPS, type StepId } from './steps'

interface StepFrameProps {
  step: StepId
  title: string
  intro: string
  aside?: ReactNode
  children: ReactNode
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  issue?: string | null
  footer?: ReactNode
}

/** Shared frame for an input step: numbered eyebrow, heading, body, and back / continue actions. */
export function StepFrame({ step, title, intro, aside, children, onBack, onNext, nextLabel, nextDisabled, issue, footer }: StepFrameProps) {
  const index = STEPS.findIndex((s) => s.id === step)
  return (
    <section aria-labelledby="step-title" className="animate-rise min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-[40rem]">
          <p className="hidden text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase lg:block">
            Step {index + 1} of {STEPS.length}
          </p>
          <h1 id="step-title" tabIndex={-1} className="mt-1 text-[1.875rem] leading-[1.08] tracking-[-0.03em] outline-none sm:text-[2.375rem]">
            {title}
          </h1>
          <p className="mt-2.5 text-[1.0625rem] leading-relaxed text-muted">{intro}</p>
        </div>
        {aside}
      </div>

      <div className="mt-7 space-y-5">{children}</div>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {onBack && (
            <Button variant="secondary" icon={<ArrowLeft />} onClick={onBack}>
              Back
            </Button>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
          {issue && (
            <p role="status" className="text-[0.8125rem] font-bold text-signal-ink sm:text-right">
              {issue}
            </p>
          )}
          {footer}
          {onNext && (
            <Button arrow onClick={onNext} disabled={nextDisabled} className="justify-between sm:justify-center">
              {nextLabel ?? 'Continue'}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
