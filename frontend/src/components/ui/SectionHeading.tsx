import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Pill } from './Pill'
import { Reveal } from './Reveal'

interface SectionHeadingProps {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'left'
  tone?: 'light' | 'dark'
  id?: string
  className?: string
  /** Wider measure for long titles, so they break into two lines instead of three. */
  wide?: boolean
}

export function SectionHeading({ eyebrow, title, description, align = 'center', tone = 'light', id, className, wide }: SectionHeadingProps) {
  return (
    <div className={cx('flex flex-col gap-5', align === 'center' ? 'items-center text-center' : 'items-start', className)}>
      <Reveal>
        <Pill tone={tone === 'dark' ? 'dark' : 'light'}>{eyebrow}</Pill>
      </Reveal>
      <Reveal delay={80}>
        <h2
          id={id}
          className={cx(
            'text-[2.25rem] leading-[1.06] tracking-[-0.03em] sm:text-[2.75rem] lg:text-[3.375rem]',
            wide ? 'max-w-[23ch]' : 'max-w-[18ch]',
            align === 'center' && 'mx-auto',
            tone === 'dark' && 'text-cream-50',
          )}
        >
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={160}>
          <p
            className={cx(
              'max-w-[40rem] text-[1.0625rem] leading-relaxed sm:text-lg',
              align === 'center' && 'mx-auto',
              tone === 'dark' ? 'text-mist' : 'text-muted',
            )}
          >
            {description}
          </p>
        </Reveal>
      )}
    </div>
  )
}
