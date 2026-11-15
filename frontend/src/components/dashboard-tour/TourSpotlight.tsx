import type { CSSProperties } from 'react'
import { cx } from '../../lib/cx'
import type { Box } from './tourAnimations'

const PAD = 8

/**
 * Dims the page and leaves one lit area around the current target. While the mascot is on the move
 * (`open` false), or when a step has no target, the lit area closes to a point so the whole page
 * is dimmed. The page underneath is neither changed nor moved.
 */
export function TourSpotlight({ box, visible, open, ring, ms }: { box: Box | null; visible: boolean; open: boolean; ring: boolean; ms: number }) {
  const vw = typeof window === 'undefined' ? 0 : window.innerWidth
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight
  const cx0 = box ? box.left + box.width / 2 : vw / 2
  const cy0 = box ? box.top + box.height / 2 : vh / 2
  const style: CSSProperties =
    box && open ? { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 } : { top: cy0, left: cx0, width: 0, height: 0 }
  return (
    <>
      <div className="tour-blocker" aria-hidden="true" />
      <div className={cx('tour-spot', visible && 'is-on')} style={{ ...style, '--tour-spot-ms': `${ms}ms` } as CSSProperties} aria-hidden="true">
        <div className={cx('tour-ring', ring && open && !!box && 'is-on')} />
      </div>
    </>
  )
}
