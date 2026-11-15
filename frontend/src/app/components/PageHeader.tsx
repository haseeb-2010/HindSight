import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

/** The heading block every workspace page starts with. */
export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
  aside,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  intro?: ReactNode
  /** Buttons shown beside the title on wide screens and under the intro on narrow ones. */
  actions?: ReactNode
  /** A small visual (usually a mascot) at the far right on wide screens. */
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={cx('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="max-w-3xl min-w-0">
        {eyebrow && <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">{eyebrow}</p>}
        <h1 className={cx('text-[1.875rem] leading-[1.08] tracking-[-0.03em] sm:text-[2.375rem]', eyebrow && 'mt-1.5')}>{title}</h1>
        {intro && <p className="mt-2.5 text-[1.0625rem] leading-relaxed text-muted">{intro}</p>}
      </div>
      {(actions || aside) && (
        <div className="flex shrink-0 items-end gap-4">
          {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
          {aside && <div className="hidden lg:block print:hidden">{aside}</div>}
        </div>
      )}
    </header>
  )
}
