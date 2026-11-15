import { cx } from '../../lib/cx'

// Geometry copied verbatim from the supplied 5BHgXOI3XgwfEgZjDLFJYnQ2S4M.svg.
const MARK_PATH = 'M29 29H14.5L0 14.5h14.5zm0-14.5H14.5L0 0h14.5z'

interface LogoProps {
  tone?: 'light' | 'dark'
  className?: string
  markClassName?: string
  wordmarkClassName?: string
}

/** Brand symbol + "HindSight" wordmark. On light surfaces the original SVG file is used as-is;
 *  on dark surfaces the same geometry is filled lime, as the NorthTitan reference does. */
export function Logo({ tone = 'light', className, markClassName, wordmarkClassName }: LogoProps) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      {tone === 'light' ? (
        <img
          src="/logo/hindsight-mark.svg"
          alt=""
          width={29}
          height={29}
          className={cx('h-7 w-7 shrink-0', markClassName)}
          draggable={false}
        />
      ) : (
        <svg viewBox="0 0 29 29" aria-hidden="true" className={cx('h-7 w-7 shrink-0', markClassName)}>
          <path fill="var(--color-lime)" d={MARK_PATH} />
        </svg>
      )}
      <span
        className={cx(
          'font-display text-[1.375rem] leading-none font-semibold tracking-[-0.025em]',
          tone === 'light' ? 'text-forest-950' : 'text-lime',
          wordmarkClassName,
        )}
      >
        HindSight
      </span>
    </span>
  )
}
