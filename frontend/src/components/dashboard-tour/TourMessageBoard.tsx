import { ArrowLeft, ArrowRight, Info, PartyPopper } from 'lucide-react'
import type { Ref } from 'react'
import { cx } from '../../lib/cx'
import { stepCount, type TourStep } from './tourSteps'

export type BoardFace = 'shown' | 'flip-out' | 'flip-pre'

interface BoardProps {
  steps: TourStep[]
  index: number
  face: BoardFace
  /** True while the mascot is on the move: buttons stay focusable but do nothing. */
  busy: boolean
  headingId: string
  bodyId: string
  primaryRef: Ref<HTMLButtonElement>
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

/** The board the mascot carries: heading, one or two sentences, progress and the tour's controls. */
export function TourMessageBoard({ steps, index, face, busy, headingId, bodyId, primaryRef, onNext, onBack, onSkip }: BoardProps) {
  const step = steps[index]
  const count = stepCount(steps, index)
  const finish = step.kind === 'finish'
  const intro = step.kind === 'intro'
  const counted = steps.filter((s) => !s.kind)

  return (
    <div className="tour-board-wrap">
      <div
        className={cx(
          'tour-board relative rounded-[1.5rem] bg-white p-5 shadow-float ring-1 ring-forest-950/10',
          face === 'flip-out' && 'is-flip-out',
          face === 'flip-pre' && 'is-flip-pre',
        )}
      >
        {/* the pin the board hangs from: a small brand detail that also reads as "held up" */}
        <span aria-hidden="true" className="absolute -top-2 left-7 h-4 w-10 rounded-full bg-lime shadow-hairline ring-1 ring-forest-950/10" />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.6875rem] font-extrabold tracking-[0.12em] text-muted uppercase">
            {finish ? 'Tour complete' : 'Dashboard tour'}
          </p>
          {count ? (
            <div className="flex items-center gap-2">
              <ol className="flex items-center gap-1" aria-hidden="true">
                {counted.map((s, i) => (
                  <li key={s.id} className={cx('h-1.5 rounded-full transition-all duration-300', i < count.n ? 'w-4 bg-forest-950' : 'w-1.5 bg-sand-400')} />
                ))}
              </ol>
              <span className="text-[0.75rem] font-extrabold text-forest-950 tabular-nums">
                <span className="sr-only">Step </span>
                {count.n} of {count.of}
              </span>
            </div>
          ) : finish ? (
            <PartyPopper className="h-4 w-4 text-forest-800" aria-hidden="true" />
          ) : (
            <span className="text-[0.75rem] font-bold text-muted">About a minute</span>
          )}
        </div>

        <h2 id={headingId} className="mt-2.5 text-[1.3125rem] leading-[1.15] tracking-[-0.02em]">
          {step.heading}
        </h2>
        <p id={bodyId} className="mt-2 text-[0.9375rem] leading-relaxed text-ink">
          {step.body}
        </p>
        {step.note && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-signal-50 px-2.5 py-1 text-[0.75rem] font-extrabold text-signal-ink ring-1 ring-signal/30">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            {step.note}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          {!intro && !finish && (
            <button
              type="button"
              onClick={onBack}
              aria-disabled={busy || undefined}
              className="flex h-11 items-center gap-1.5 rounded-full border border-border-strong bg-white px-3.5 text-[0.875rem] font-bold text-forest-950 transition-colors hover:border-forest-950/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          )}
          {!finish && (
            <button
              type="button"
              onClick={onSkip}
              className="h-11 rounded-full px-3 text-[0.875rem] font-bold text-muted underline decoration-sand-400 underline-offset-4 transition-colors hover:text-forest-950 hover:decoration-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
            >
              Skip tour
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={onNext}
            aria-disabled={busy || undefined}
            data-tour-primary
            className="group ml-auto flex h-11 items-center gap-2 rounded-full bg-forest-950 pr-1.5 pl-4.5 text-[0.9375rem] font-bold text-cream-50 shadow-[0_10px_24px_-10px_rgb(28_58_42/0.55)] transition-colors hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-forest-950"
          >
            {step.primary ?? 'Next'}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-forest-950 transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
