import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { usePrefersReducedMotion } from '../../hooks/useMotion'
import { cx } from '../../lib/cx'
import { boxOf, findTarget, place, scrollFor, scrollPage, settled, SHEET_BELOW, TIMING, travelMs, wait, type Box, type Placement } from './tourAnimations'
import { TourMascot, type MascotMood } from './TourMascot'
import { TourMessageBoard, type BoardFace } from './TourMessageBoard'
import { TourSpotlight } from './TourSpotlight'
import type { TourStep } from './tourSteps'

/**
 * What the tour is doing. Only `presenting` accepts Next and Back, so two animations can never run
 * at once: entering → presenting → flipping → moving → flipping → presenting … → completing → completed,
 * or → skipped from any state.
 */
export type TourPhase = 'idle' | 'entering' | 'presenting' | 'moving' | 'flipping' | 'completing' | 'completed' | 'skipped'

export interface DashboardTourProps {
  steps: TourStep[]
  open: boolean
  /** Step to open at (for a tour that is being resumed). */
  startAt?: number
  /** Called at once when the user finishes or skips, with the step they were on: the moment to remember the outcome. */
  onFinish: (outcome: 'completed' | 'skipped', step: number) => void
  /** Called when the tour has left the screen: the moment to set `open` to false. */
  onClosed: () => void
  /** Called whenever a step has been reached. */
  onStep?: (index: number) => void
}

/**
 * A guided tour over the live page. For each step it finds the element marked `data-tour="…"`,
 * scrolls it into view, lights it, and moves the mascot and its message board next to it.
 * It reads positions from the page as it is; it does not change the page's layout.
 */
export function DashboardTour({ steps, open, startAt = 0, onFinish, onClosed, onStep }: DashboardTourProps) {
  const reduced = usePrefersReducedMotion()
  const [phase, setPhaseState] = useState<TourPhase>('idle')
  const [index, setIndex] = useState(startAt)
  const [face, setFace] = useState<BoardFace>('shown')
  const [mood, setMood] = useState<MascotMood>('still')
  const [pos, setPosState] = useState<Placement | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [lit, setLit] = useState(false)
  const [visible, setVisible] = useState(false)
  const [instant, setInstant] = useState(true)
  const [moveMs, setMoveMs] = useState(600)
  const [hopping, setHopping] = useState(false)
  const [lean, setLean] = useState(4)
  const [sheet, setSheet] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [leaving, setLeaving] = useState(false)

  const unit = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const before = useRef<HTMLElement | null>(null)
  const seq = useRef(0)
  const phaseRef = useRef<TourPhase>('idle')
  const indexRef = useRef(startAt)
  const posRef = useRef<Placement | null>(null)
  const scrolling = useRef({ cancelled: false })
  const headingId = useId()
  const bodyId = useId()

  const setPhase = (p: TourPhase) => {
    phaseRef.current = p
    setPhaseState(p)
  }
  const setPos = (p: Placement) => {
    posRef.current = p
    setPosState(p)
  }
  const unitSize = () => ({ w: unit.current?.offsetWidth ?? 368, h: unit.current?.offsetHeight ?? 300 })

  /** Brings step `next` on stage: first appearance (`enter`) or the flip-and-move from another step (`travel`). */
  const show = useCallback(
    async (next: number, mode: 'enter' | 'travel') => {
      const my = ++seq.current
      const alive = () => seq.current === my
      const step = steps[next]
      const isSheet = window.innerWidth < SHEET_BELOW
      const animate = !reduced && mode === 'travel'
      setSheet(isSheet)
      setLit(false)

      if (mode === 'travel') {
        // 1. the board turns edge-on while the mascot gathers itself
        setPhase('flipping')
        setMood(reduced ? 'still' : 'anticipating')
        setFace('flip-out')
        await wait(reduced ? 140 : TIMING.flipOut)
        if (!alive()) return
      } else {
        setPhase('entering')
        setFace('shown')
        setIndex(next)
        indexRef.current = next
        await wait(30) // let the first step's words lay out so the unit can be measured
        if (!alive()) return
      }

      // 2. work out where the target will be once the page has scrolled, and where to stand
      const el = findTarget(step.target)
      let target: Box | null = el ? boxOf(el) : null
      let scrollTop = window.scrollY
      if (target) {
        scrollTop = scrollFor(target, isSheet, unitSize())
        target = { ...target, top: target.top - (scrollTop - window.scrollY) }
      }
      const dest = place(target, unitSize(), isSheet)
      const from = posRef.current
      const distance = from ? Math.hypot(dest.x - from.x, dest.y - from.y) + Math.abs(scrollTop - window.scrollY) * 0.4 : 0
      const ms = animate ? travelMs(distance) : 0

      // 3. travel: the page scrolls and the mascot carries the board across, in one movement
      scrolling.current.cancelled = true
      scrolling.current = { cancelled: false }
      if (animate) {
        setPhase('moving')
        setMood('travelling')
        setMoveMs(ms)
        setLean(from && dest.x < from.x - 4 ? -4 : 4)
        setInstant(false)
        setHopping(true)
        setPos(dest)
        await Promise.all([scrollPage(scrollTop, ms, scrolling.current), wait(ms)])
      } else {
        setInstant(true)
        await scrollPage(scrollTop, mode === 'enter' && !reduced ? 320 : 0, scrolling.current)
        setPos(dest)
      }
      if (!alive()) return
      setHopping(false)

      // 4. arrival: measure the target where it really is now, light it, and turn the board back
      if (el) await settled(el, 400)
      if (!alive()) return
      const real = el ? boxOf(el) : null
      setBox(real)
      setIndex(next)
      indexRef.current = next
      if (mode === 'travel') setFace('flip-pre')
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      if (!alive()) return
      // the new words may be a line longer or shorter, and the target may have settled a few pixels away
      setInstant(reduced || mode === 'enter')
      setMoveMs(200)
      setPos(place(real, unitSize(), isSheet))
      setLit(true)
      setVisible(true)
      setFace('shown')
      setPhase(mode === 'travel' ? 'flipping' : 'entering')
      setMood(reduced ? 'still' : mode === 'enter' ? 'entering' : 'landing')
      setAnnounce(`${step.heading} ${step.body}${step.note ? ` ${step.note}` : ''}`)
      primary.current?.focus({ preventScroll: true })
      onStep?.(next)
      await wait(reduced ? 0 : mode === 'enter' ? TIMING.enter : TIMING.land)
      if (!alive()) return
      setPhase('presenting')
      setMood(reduced ? 'still' : step.kind === 'finish' ? 'celebrating' : 'talking')
      if (step.kind === 'finish' && !reduced) {
        await wait(1850)
        if (alive() && phaseRef.current === 'presenting') setMood('talking')
      }
    },
    [steps, reduced, onStep],
  )

  const close = useCallback(
    (outcome: 'completed' | 'skipped') => {
      if (phaseRef.current === 'idle' || phaseRef.current === 'completed' || phaseRef.current === 'skipped' || phaseRef.current === 'completing') return
      seq.current++
      scrolling.current.cancelled = true
      setPhase(outcome === 'completed' ? 'completing' : 'skipped')
      setLeaving(true)
      setVisible(false)
      setLit(false)
      setHopping(false)
      onFinish(outcome, indexRef.current) // remembered straight away, even if the page is closed mid-fade
      window.setTimeout(
        () => {
          setPhase(outcome)
          setLeaving(false)
          onClosed()
          // hand the keyboard back to where the user was, or to the page's main heading
          const back = before.current && document.contains(before.current) ? before.current : document.querySelector<HTMLElement>('[data-tour-replay], main h1, main')
          back?.focus({ preventScroll: true })
        },
        reduced ? 0 : TIMING.close,
      )
    },
    [onFinish, onClosed, reduced],
  )

  const next = useCallback(() => {
    if (phaseRef.current !== 'presenting') return
    if (indexRef.current >= steps.length - 1) close('completed')
    else void show(indexRef.current + 1, 'travel')
  }, [close, show, steps.length])

  const back = useCallback(() => {
    if (phaseRef.current !== 'presenting' || indexRef.current <= 0) return
    void show(indexRef.current - 1, 'travel')
  }, [show])

  // open and close
  useEffect(() => {
    if (!open) {
      seq.current++
      scrolling.current.cancelled = true
      setPhase('idle')
      setVisible(false)
      setLit(false)
      return
    }
    before.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    posRef.current = null
    setVisible(false)
    setLeaving(false)
    void show(Math.max(0, Math.min(steps.length - 1, startAt)), 'enter')
    return () => {
      seq.current++
      scrolling.current.cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // keyboard: Escape leaves, arrows move, Tab stays inside the board
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close('skipped')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      } else if (e.key === 'Tab') {
        const items = [...(unit.current?.querySelectorAll<HTMLElement>('button') ?? [])]
        if (!items.length) return
        const at = items.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, close, next, back])

  // keep the light and the mascot on the target when the window, the page or the target itself moves
  useLayoutEffect(() => {
    if (!open) return
    let frame = 0
    const reflow = () => {
      frame = 0
      if (phaseRef.current !== 'presenting') return
      const isSheet = window.innerWidth < SHEET_BELOW
      const el = findTarget(steps[indexRef.current]?.target ?? null)
      const real = el ? boxOf(el) : null
      setSheet(isSheet)
      setBox(real)
      setInstant(true)
      setPos(place(real, unitSize(), isSheet))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(reflow)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.removeEventListener('scroll', schedule)
      observer.disconnect()
    }
  }, [open, steps])

  if (!open || phase === 'idle' || phase === 'completed' || (phase === 'skipped' && !leaving)) return null

  const step = steps[index]
  const centre = !sheet && (!step.target || pos?.side === 'center')
  // the artwork has clear space around the character, so it is drawn larger and tucked under the board
  const size = sheet ? 104 : centre ? 164 : 132
  const busy = phase !== 'presenting'
  const sheetRight = sheet && index % 2 === 1
  const mascot = <TourMascot mood={mood} size={size} withFriend={step.kind === 'finish' && phase !== 'entering'} />

  return createPortal(
    <div className="tour-root" data-tour-phase={phase} data-tour-step={step.id}>
      <TourSpotlight box={box} visible={visible || lit} open={lit} ring={lit && phase !== 'completing'} ms={reduced ? 0 : TIMING.spot} />
      <div
        ref={unit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        className={cx('tour-unit', visible && 'is-visible', instant && 'is-instant', sheet && 'is-sheet')}
        style={{ transform: `translate3d(${Math.round(pos?.x ?? 0)}px, ${Math.round(pos?.y ?? 0)}px, 0)`, '--tour-move-ms': `${moveMs}ms`, '--tour-lean': `${lean}deg` } as CSSProperties}
      >
        <div className={cx('tour-hop', hopping && 'is-hopping')}>
          {sheet && (
            <div className="relative z-10 flex pl-2" style={{ justifyContent: sheetRight ? 'flex-end' : 'flex-start', marginBottom: -size * 0.17, paddingRight: size * 0.24 }}>
              {mascot}
            </div>
          )}
          <TourMessageBoard
            steps={steps}
            index={index}
            face={face}
            busy={busy}
            headingId={headingId}
            bodyId={bodyId}
            primaryRef={primary}
            onNext={next}
            onBack={back}
            onSkip={() => close('skipped')}
          />
          {!sheet && (
            <div className={cx('relative z-10 flex', centre ? 'justify-center' : 'pl-3')} style={{ marginTop: -size * 0.2 }}>
              {mascot}
            </div>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    </div>,
    document.body,
  )
}
