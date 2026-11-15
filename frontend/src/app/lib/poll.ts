import { api } from '../../lib/api'
import type { JobState } from '../../lib/types'

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      window.clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })

/**
 * Poll an analysis or comparison job until it finishes. `onProgress` receives every
 * intermediate state. Resolves with the final state (status "done" or "error").
 */
export async function pollJob(id: string, signal: AbortSignal, onProgress: (job: JobState) => void): Promise<JobState> {
  let delay = 300
  for (;;) {
    const job = await api.analysis(id, signal)
    if (job.status === 'done' || job.status === 'error') return job
    onProgress(job)
    await sleep(delay, signal)
    delay = Math.min(Math.round(delay * 1.35), 1500)
  }
}
