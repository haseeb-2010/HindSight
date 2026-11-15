// Remembers, in this browser, whether the dashboard tour was finished, skipped or left half-way.
// HindSight has no accounts, so this is per browser. The key is versioned: a redesigned tour can
// use a new key and be offered once more. With accounts, the same record would be stored per user.

export const TOUR_KEY = 'hindsight_dashboard_tour_v1'

export interface TourRecord {
  status: 'in_progress' | 'completed' | 'skipped'
  /** Index of the step the user was on (used to resume a tour that was left open). */
  step: number
  at: string
}

// If the browser refuses storage, this at least stops the tour from re-opening on every visit to the
// dashboard within the same page session.
let memory: TourRecord | null = null

export function readTour(): TourRecord | null {
  try {
    const raw = window.localStorage.getItem(TOUR_KEY)
    if (!raw) return memory
    const v = JSON.parse(raw) as Partial<TourRecord>
    if (v.status === 'completed' || v.status === 'skipped' || v.status === 'in_progress') {
      return { status: v.status, step: Number.isInteger(v.step) ? (v.step as number) : 0, at: typeof v.at === 'string' ? v.at : '' }
    }
  } catch {
    /* blocked or unreadable storage */
  }
  return memory
}

export function writeTour(status: TourRecord['status'], step: number): void {
  memory = { status, step, at: new Date().toISOString() }
  try {
    window.localStorage.setItem(TOUR_KEY, JSON.stringify(memory))
  } catch {
    /* kept in memory only */
  }
}

/** True until the tour has been completed or skipped once. */
export function shouldAutoStart(): boolean {
  const r = readTour()
  return !r || r.status === 'in_progress'
}

/** Step to open at: the saved one for a tour that was left open, otherwise the beginning. */
export function resumeStep(stepCount: number): number {
  const r = readTour()
  return r?.status === 'in_progress' && r.step > 0 && r.step < stepCount ? r.step : 0
}
