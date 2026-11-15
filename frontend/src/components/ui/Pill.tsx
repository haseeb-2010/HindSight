import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface PillProps {
  children: ReactNode
  tone?: 'light' | 'dark' | 'lime'
  pulse?: boolean
  className?: string
}

/** Small uppercase eyebrow badge with a dot (NorthTitan section label pattern). */
export function Pill({ children, tone = 'light', pulse, className }: PillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.72rem] leading-5 font-extrabold tracking-[0.09em] uppercase',
        tone === 'light' && 'border-peri bg-peri-50 text-forest-950',
        tone === 'dark' && 'border-white/15 bg-white/[0.07] text-cream-50',
        tone === 'lime' && 'border-forest-950/10 bg-lime-100 text-forest-950',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          tone === 'dark' ? 'bg-lime' : 'bg-forest-950',
          pulse && 'animate-pulse-dot',
        )}
      />
      {children}
    </span>
  )
}
