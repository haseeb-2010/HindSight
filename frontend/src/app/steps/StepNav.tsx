import { Check } from 'lucide-react'
import { cx } from '../../lib/cx'
import { STEPS, type StepId } from './steps'

interface StepNavProps {
  active: StepId
  issues: Partial<Record<StepId, string>>
  locked: boolean
  hasResults: boolean
  stale: boolean
  onGo: (id: StepId) => void
}

/** Workspace stages: a sidebar on desktop, a compact scrolling progress row on smaller screens. */
export function StepNav({ active, issues, locked, hasResults, stale, onGo }: StepNavProps) {
  const activeIndex = STEPS.findIndex((s) => s.id === active)
  const state = (id: StepId, i: number) => {
    if (id === active) return 'active'
    if (id === 'results') return hasResults ? 'done' : 'todo'
    if (id === 'review') return hasResults && !stale ? 'done' : 'todo'
    if (locked && id !== 'field') return 'locked'
    if (issues[id]) return 'todo'
    return i < activeIndex || hasResults ? 'done' : 'todo'
  }

  return (
    <nav aria-label="Analysis steps" className="min-w-0 print:hidden">
      {/* Mobile and tablet: progress row */}
      <div className="lg:hidden">
        <p className="mb-2 text-[0.75rem] font-extrabold tracking-[0.08em] text-muted uppercase">
          Step {activeIndex + 1} of {STEPS.length} · <span className="text-forest-950">{STEPS[activeIndex].label}</span>
        </p>
        <ol className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
          {STEPS.map((s, i) => {
            const st = state(s.id, i)
            const disabled = st === 'locked' || (s.id === 'results' && !hasResults)
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  disabled={disabled}
                  aria-current={st === 'active' ? 'step' : undefined}
                  onClick={() => onGo(s.id)}
                  className={cx(
                    'flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.8125rem] font-bold whitespace-nowrap ring-1 transition-colors',
                    st === 'active' && 'bg-forest-950 text-cream-50 ring-forest-950',
                    st === 'done' && 'bg-lime-100 text-forest-950 ring-forest-950/10',
                    st === 'todo' && 'bg-white text-ink ring-border',
                    disabled && 'cursor-not-allowed bg-transparent text-muted/70 ring-border',
                  )}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  {s.label}
                  {st === 'done' && <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />}
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Desktop: sidebar */}
      <div className="sticky top-24 hidden rounded-[1.5rem] bg-white p-3 shadow-hairline ring-1 ring-border lg:block">
        <p className="px-3 pt-2 pb-3 text-[0.6875rem] font-extrabold tracking-[0.1em] text-muted uppercase">Farm analysis</p>
        <ol className="space-y-0.5">
          {STEPS.map((s, i) => {
            const st = state(s.id, i)
            const disabled = st === 'locked' || (s.id === 'results' && !hasResults)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-current={st === 'active' ? 'step' : undefined}
                  onClick={() => onGo(s.id)}
                  className={cx(
                    'group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                    st === 'active' ? 'bg-forest-950 text-cream-50' : 'text-forest-950 hover:bg-sand/70',
                    disabled && 'cursor-not-allowed text-muted/70 hover:bg-transparent',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[0.8125rem] font-semibold tabular-nums',
                      st === 'active' && 'bg-lime text-forest-950',
                      st === 'done' && 'bg-lime-100 text-forest-950',
                      st === 'todo' && 'bg-sand text-forest-950',
                      disabled && 'bg-sand/60 text-muted/70',
                    )}
                  >
                    {st === 'done' ? <Check className="h-4 w-4" aria-hidden="true" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] leading-tight font-bold">{s.label}</span>
                    {s.id === 'results' && hasResults && stale && st !== 'active' && (
                      <span className="block text-[0.75rem] font-bold text-signal-ink">From earlier settings</span>
                    )}
                    {issues[s.id] && st !== 'active' && !disabled && s.id !== 'field' && (
                      <span className="block text-[0.75rem] font-semibold text-muted">Needs attention</span>
                    )}
                    <span className="sr-only">{st === 'done' ? ' (complete)' : disabled ? ' (not available yet)' : ''}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
