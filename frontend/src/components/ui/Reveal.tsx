import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useReveal } from '../../hooks/useReveal'
import { cx } from '../../lib/cx'

interface RevealProps {
  as?: ElementType
  delay?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
  id?: string
}

/** Fades, de-blurs and lifts its content into place the first time it scrolls into view. */
export function Reveal({ as: Tag = 'div', delay = 0, className, style, children, id }: RevealProps) {
  const ref = useReveal<HTMLElement>()
  return (
    <Tag ref={ref} id={id} className={cx('reveal', className)} style={{ ...style, '--delay': `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  )
}
