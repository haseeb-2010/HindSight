import { cx } from '../../lib/cx'

const SOURCES = {
  blue: { base: '/mascots/mascot-blue', w: 500, h: 500, alt: 'HindSight’s blue mascot, a round fluffy character, smiling' },
  mint: { base: '/mascots/mascot-mint', w: 500, h: 500, alt: 'HindSight’s mint-green mascot waving hello' },
  group: {
    base: '/mascots/mascot-group',
    w: 1932,
    h: 909,
    alt: 'The four HindSight mascots together: peach, purple, blue holding a small card, and mint',
  },
} as const

interface MascotProps {
  name: keyof typeof SOURCES
  className?: string
  imgClassName?: string
  eager?: boolean
  decorative?: boolean
  sizes?: string
}

/** Original mascot artwork; lossless WebP with the untouched PNG as fallback. */
export function Mascot({ name, className, imgClassName, eager, decorative, sizes }: MascotProps) {
  const s = SOURCES[name]
  return (
    <picture className={cx('block', className)}>
      <source srcSet={`${s.base}.webp`} type="image/webp" />
      <img
        src={`${s.base}.png`}
        width={s.w}
        height={s.h}
        alt={decorative ? '' : s.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : undefined}
        sizes={sizes}
        draggable={false}
        className={cx('block h-auto w-full select-none', imgClassName)}
      />
    </picture>
  )
}
