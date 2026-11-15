// Geometry and timing for the tour. No React here: measuring targets, choosing where the mascot
// and its board stand, and how long a move takes.

export interface Box {
  top: number
  left: number
  width: number
  height: number
}

export interface Placement {
  x: number
  y: number
  /** Where the unit stands relative to its target. `sheet` is the phone layout; `center` has no target. */
  side: 'right' | 'left' | 'below' | 'above' | 'corner' | 'center' | 'sheet'
}

export const TIMING = {
  /** Half a board flip: closing, and then opening again. */
  flipOut: 170,
  flipIn: 210,
  /** Travel between two targets: scaled by distance, within these bounds. */
  moveMin: 450,
  moveMax: 750,
  spot: 260,
  enter: 620,
  land: 420,
  /** Fade-out when the tour closes. */
  close: 240,
}

export const MARGIN = 12
const GAP = 18
export const SHEET_BELOW = 640

/** 450–750 ms depending on how far the mascot has to go. */
export function travelMs(distance: number): number {
  return Math.round(Math.max(TIMING.moveMin, Math.min(TIMING.moveMax, TIMING.moveMin + distance * 0.28)))
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function findTarget(name: string | null): HTMLElement | null {
  if (!name) return null
  // The first one that is actually laid out: a block may exist twice (e.g. a phone and a desktop variant).
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

/** Height covered by a sticky header at the top of the viewport. */
export function topInset(): number {
  const header = document.querySelector<HTMLElement>('header.sticky, header[data-sticky]')
  if (!header) return 0
  const r = header.getBoundingClientRect()
  return r.top <= 0 && r.bottom > 0 ? Math.min(r.bottom, window.innerHeight * 0.4) : 0
}

/**
 * Scroll position that brings the target comfortably into view: centred in the space under the
 * header on wide screens, near the top on phones (the board sits at the bottom there).
 */
export function scrollFor(target: Box, sheet: boolean, unit: { w: number; h: number }): number {
  const inset = topInset()
  const vh = window.innerHeight
  const vw = window.innerWidth
  const room = vh - inset - (sheet ? unit.h + MARGIN * 2 : 0)
  // A block as wide as the page leaves no room beside it, so the board has to stand under it.
  const noSideRoom = !sheet && Math.max(vw - (target.left + target.width), target.left) < unit.w + GAP + MARGIN
  const stacked = target.height + GAP + unit.h
  const wantTop =
    noSideRoom && stacked + 24 <= room
      ? inset + (room - stacked) / 2
      : target.height + 32 <= room
        ? inset + (room - target.height) / 2
        : inset + 16
  const max = Math.max(0, document.documentElement.scrollHeight - vh)
  return clamp(window.scrollY + target.top - wantTop, 0, max)
}

/** Where the mascot and board stand for a target, without covering it when there is room. */
export function place(target: Box | null, unit: { w: number; h: number }, sheet: boolean): Placement {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const inset = topInset()
  if (sheet) {
    // Phone: a sheet at the bottom, or at the top when the target itself is low on the screen.
    const low = !!target && target.top + target.height / 2 > vh * 0.62 && target.top > inset + unit.h + MARGIN * 2
    return { x: (vw - unit.w) / 2, y: low ? inset + MARGIN : vh - unit.h - MARGIN, side: 'sheet' }
  }
  if (!target) return { x: (vw - unit.w) / 2, y: Math.max(inset + MARGIN, (vh - unit.h) / 2 - 12), side: 'center' }

  const yMid = clamp(target.top + target.height / 2 - unit.h / 2, inset + MARGIN, vh - unit.h - MARGIN)
  const xMid = clamp(target.left + target.width / 2 - unit.w / 2, MARGIN, vw - unit.w - MARGIN)
  const options: (Placement & { room: number; fits: boolean })[] = [
    { side: 'right', x: target.left + target.width + GAP, y: yMid, room: vw - (target.left + target.width), fits: target.left + target.width + GAP + unit.w <= vw - MARGIN },
    { side: 'left', x: target.left - GAP - unit.w, y: yMid, room: target.left, fits: target.left - GAP - unit.w >= MARGIN },
    { side: 'below', x: xMid, y: target.top + target.height + GAP, room: vh - (target.top + target.height), fits: target.top + target.height + GAP + unit.h <= vh - MARGIN },
    { side: 'above', x: xMid, y: target.top - GAP - unit.h, room: target.top - inset, fits: target.top - GAP - unit.h >= inset + MARGIN },
  ]
  const best = options.filter((o) => o.fits).sort((a, b) => b.room - a.room)[0]
  if (best) return { x: best.x, y: best.y, side: best.side }
  // No side has room: stand in the bottom corner farther from the target's centre.
  const leftHalf = target.left + target.width / 2 < vw / 2
  return { x: leftHalf ? vw - unit.w - MARGIN : MARGIN, y: vh - unit.h - MARGIN, side: 'corner' }
}

/** Resolves when the element has stopped moving on screen (after a scroll or a layout change), or after `timeout`. */
export function settled(el: Element, timeout = 700): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    let last = el.getBoundingClientRect()
    let still = 0
    const tick = () => {
      const r = el.getBoundingClientRect()
      still = Math.abs(r.top - last.top) < 0.5 && Math.abs(r.left - last.left) < 0.5 ? still + 1 : 0
      last = r
      if (still >= 3 || performance.now() - start > timeout) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

/** Scrolls the page to `top` over `ms` with an ease, and resolves when it is there. */
export function scrollPage(top: number, ms: number, signal: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const from = window.scrollY
    const delta = top - from
    if (Math.abs(delta) < 2 || ms <= 0) {
      if (Math.abs(delta) >= 2) window.scrollTo({ top, behavior: 'instant' })
      resolve()
      return
    }
    const start = performance.now()
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
    const tick = (now: number) => {
      if (signal.cancelled) return resolve()
      const t = Math.min(1, (now - start) / ms)
      window.scrollTo({ top: from + delta * ease(t), behavior: 'instant' })
      if (t < 1) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
