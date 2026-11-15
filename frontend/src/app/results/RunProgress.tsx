import { AlertTriangle, Check, LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/ui/Mascot'
import { cx } from '../../lib/cx'
import type { RunState } from '../state/workspace'

// Shown until the server reports its own stages (the same four it will report).
const PLANNED = ['Preparing your farm profile', 'Retrieving historical weather', 'Checking available soil information', 'Simulating and comparing crop rotations']

/** Live state of an analysis job: the server's real stages, elapsed time, and failure with retry. */
export function RunProgress({ run, onRetry, onCancel, onEdit }: { run: RunState; onRetry: () => void; onCancel: () => void; onEdit?: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (run.status !== 'running') return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [run.status])

  const stages = run.job?.stages ?? PLANNED.map((label, i) => ({ id: String(i), label, state: i === 0 ? ('active' as const) : ('pending' as const), detail: null }))
  const secs = run.startedAt ? Math.max(0, (now - run.startedAt) / 1000) : 0
  const failed = run.status === 'error'

  return (
    <div className="rounded-[1.5rem] bg-white p-5 shadow-soft ring-1 ring-border sm:p-7">
      <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <Mascot name={failed ? 'mint' : 'blue'} decorative className={cx('mx-auto w-24 md:w-28', !failed && 'animate-float')} sizes="112px" />
        <div className="min-w-0">
          <div role="status" aria-live="polite">
            <h2 className="text-[1.375rem] leading-tight">{failed ? 'The analysis could not be completed' : 'Analysing your farm…'}</h2>
            {!failed && (
              <p className="mt-1 text-[0.9375rem] text-ink">
                Replaying four decades of daily weather for your rotation and its alternatives.{' '}
                <span className="font-bold text-muted tabular-nums">{secs.toFixed(0)} s</span>
              </p>
            )}
          </div>
          {failed && (
            <p role="alert" className="mt-2 flex gap-2 rounded-xl bg-signal-50 p-3 text-[0.9375rem] font-semibold text-ink ring-1 ring-signal/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-ink" aria-hidden="true" />
              {run.error}
            </p>
          )}

          <ol className="mt-4 space-y-2">
            {stages.map((s) => (
              <li key={s.id} className="flex items-start gap-3">
                <span
                  className={cx(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    s.state === 'done' && 'bg-forest-950 text-lime',
                    s.state === 'active' && 'bg-lime text-forest-950',
                    s.state === 'pending' && 'bg-sand text-muted',
                    s.state === 'error' && 'bg-signal-600 text-white',
                  )}
                >
                  {s.state === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
                  {s.state === 'active' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {s.state === 'error' && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className={cx('block text-[0.9375rem] font-bold', s.state === 'pending' ? 'text-muted' : 'text-forest-950')}>
                    {s.label}
                    <span className="sr-only">
                      {s.state === 'done' ? ' (done)' : s.state === 'active' ? ' (in progress)' : s.state === 'error' ? ' (failed)' : ' (waiting)'}
                    </span>
                  </span>
                  {s.detail && s.state !== 'pending' && <span className="block text-[0.8125rem] leading-snug text-ink">{s.detail}</span>}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap gap-2">
            {failed ? (
              <>
                <Button icon={<RefreshCw />} onClick={onRetry}>
                  Try again
                </Button>
                {onEdit && (
                  <Button variant="secondary" onClick={onEdit}>
                    Edit settings
                  </Button>
                )}
              </>
            ) : (
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
