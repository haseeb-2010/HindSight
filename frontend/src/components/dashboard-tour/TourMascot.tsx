import type { CSSProperties } from 'react'
import { cx } from '../../lib/cx'
import { Mascot } from '../ui/Mascot'

export type MascotMood = 'entering' | 'talking' | 'anticipating' | 'travelling' | 'landing' | 'celebrating' | 'still'

const SPARKS: { left: string; top: string; dx: string; dy: string; delay: string; color: string }[] = [
  { left: '6%', top: '20%', dx: '-18px', dy: '-30px', delay: '0ms', color: 'var(--color-lime)' },
  { left: '30%', top: '2%', dx: '-6px', dy: '-38px', delay: '120ms', color: 'var(--color-peri-300)' },
  { left: '64%', top: '0%', dx: '8px', dy: '-40px', delay: '60ms', color: 'var(--color-lime)' },
  { left: '88%', top: '18%', dx: '20px', dy: '-28px', delay: '200ms', color: 'var(--color-mascot-mint)' },
  { left: '48%', top: '-6%', dx: '0px', dy: '-44px', delay: '260ms', color: 'var(--color-peri-300)' },
]

/**
 * The guide. The supplied artwork is used as it is: the character is moved, tilted and bounced as a
 * whole, never redrawn or recoloured. Decorative: the tour's words are in the message board.
 */
export function TourMascot({ mood, size, withFriend, className }: { mood: MascotMood; size: number; withFriend?: boolean; className?: string }) {
  return (
    <div className={cx('relative flex items-end', className)} aria-hidden="true">
      <div
        className={cx(
          'tour-mascot',
          mood === 'entering' && 'is-entering',
          mood === 'talking' && 'is-talking',
          mood === 'anticipating' && 'is-anticipating',
          mood === 'landing' && 'is-landing',
          mood === 'celebrating' && 'is-celebrating',
        )}
        style={{ width: size } as CSSProperties}
      >
        <span className="tour-shadow" />
        <Mascot name="blue" decorative eager sizes={`${size}px`} className="relative" />
        {/* speech marks beside the mouth */}
        <svg className="tour-speech absolute" style={{ right: -size * 0.16, top: size * 0.3, width: size * 0.24, height: size * 0.34 }} viewBox="0 0 24 34" fill="none">
          <path d="M3 11c3 3.5 3 8.500 0 12" stroke="var(--color-forest-950)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M10 6c5.500 6 5.500 16 0 22" stroke="var(--color-forest-950)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M17 1.500c8 8.500 8 22.500 0 31" stroke="var(--color-forest-950)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        {mood === 'celebrating' &&
          SPARKS.map((s) => (
            <svg
              key={s.left}
              className="tour-spark"
              style={{ left: s.left, top: s.top, width: 14, height: 14, animationDelay: s.delay, '--dx': s.dx, '--dy': s.dy } as CSSProperties}
              viewBox="0 0 14 14"
            >
              <path d="M7 0l1.800 5.200L14 7l-5.200 1.800L7 14l-1.800-5.200L0 7l5.200-1.800z" fill={s.color} />
            </svg>
          ))}
      </div>
      {withFriend && (
        <div className="tour-friend -ml-3" style={{ width: size * 0.82 }}>
          <Mascot name="mint" decorative eager sizes={`${Math.round(size * 0.82)}px`} />
        </div>
      )}
    </div>
  )
}
