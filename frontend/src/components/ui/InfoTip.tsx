import { Info } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'

interface InfoTipProps {
  label: string
  children: ReactNode
  tone?: 'light' | 'dark'
  className?: string
  /** Show the term text itself (dotted underline) as the trigger instead of an info icon. */
  term?: ReactNode
  /** Kept for call-site readability; the popover is clamped to the viewport either way. */
  align?: 'center' | 'start' | 'end'
}

const GAP = 10
const EDGE = 8

/** Accessible explanation popover. Opens on hover, focus or tap; closes on Escape, blur or an
 *  outside tap. Rendered in a portal and clamped to the viewport, so it is never clipped. */
export function InfoTip({ label, children, tone = 'light', className, term }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef(0)

  const show = () => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const hideSoon = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 140)
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = () => {
      const b = btn.current?.getBoundingClientRect()
      const t = tip.current
      if (!b || !t) return
      const vw = document.documentElement.clientWidth
      const w = t.offsetWidth
      const h = t.offsetHeight
      const left = Math.max(EDGE, Math.min(b.left + b.width / 2 - w / 2, vw - w - EDGE))
      const above = b.top - h - GAP
      setPos({ left, top: above >= EDGE ? above : b.bottom + GAP })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node
      if (!btn.current?.contains(n) && !tip.current?.contains(n)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  return (
    <span className={cx('inline-flex align-middle', className)} onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        ref={btn}
        type="button"
        aria-label={term ? undefined : `About: ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={show}
        onFocus={show}
        onBlur={hideSoon}
        className={cx(
          'inline-flex cursor-help items-center gap-1 rounded-md text-left transition-colors',
          term
            ? cx('underline decoration-dotted decoration-[1.5px] underline-offset-[3px]', tone === 'dark' ? 'decoration-mist' : 'decoration-sage')
            : cx('-m-1 p-1', tone === 'dark' ? 'text-mist hover:text-cream-50' : 'text-muted hover:text-forest-950'),
        )}
      >
        {term}
        {!term && <Info aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />}
      </button>
      {open &&
        createPortal(
          <span
            ref={tip}
            role="tooltip"
            id={id}
            onMouseEnter={show}
            onMouseLeave={hideSoon}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
            className={cx(
              'animate-fade fixed z-[70] block w-[min(18rem,calc(100vw-1rem))] rounded-xl px-3.5 py-3 text-left font-sans shadow-float',
              tone === 'dark' ? 'bg-cream-50 text-forest-950' : 'bg-forest-950 text-cream-50',
            )}
          >
            <span className={cx('mb-1 block font-display text-[0.8125rem] leading-snug font-semibold', tone === 'dark' ? 'text-forest-800' : 'text-lime')}>
              {label}
            </span>
            <span className="block text-[0.8125rem] leading-snug font-semibold tracking-normal normal-case opacity-95">{children}</span>
          </span>,
          document.body,
        )}
    </span>
  )
}
