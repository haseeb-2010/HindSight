import { useCallback, useRef } from 'react'

let observer: IntersectionObserver | null = null

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible')
          observer?.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  )
  return observer
}

/** Ref callback that adds `.is-visible` once the element scrolls into view (one shared observer). */
export function useReveal<T extends Element>() {
  const node = useRef<T | null>(null)
  return useCallback((el: T | null) => {
    const obs = getObserver()
    if (node.current && obs) obs.unobserve(node.current)
    node.current = el
    if (!el) return
    if (!obs) {
      el.classList.add('is-visible')
      return
    }
    obs.observe(el)
  }, [])
}
