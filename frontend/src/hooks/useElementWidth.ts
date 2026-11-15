import { useEffect, useRef, useState } from 'react'

export function useElementWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth || initial)
    if (!('ResizeObserver' in window)) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [initial])
  return [ref, width] as const
}
