import { MapPin, Play } from 'lucide-react'
import type { ReactNode } from 'react'
import { ButtonRouterLink } from '../../components/ui/Button'
import { fmtCoord } from '../../lib/format'
import { RunProgress } from '../results/RunProgress'
import { useWorkspace } from '../state/workspace'
import { MascotNote } from './controls'

/**
 * Shown by pages that interpret an analysis when none is open yet. Offers a one-click real engine run
 * for each demonstration farm (cached NASA POWER record, a few seconds) or the full farm set-up.
 */
export function AnalysisRequired({ what, children }: { what: string; children?: ReactNode }) {
  const { presets, run, analysePreset, cancelRun, config } = useWorkspace()

  if (run.status !== 'idle') {
    return <RunProgress run={run} onRetry={() => analysePreset(presets.data?.presets.find((p) => p.id === config.location.preset_id) ?? presets.data!.presets[0])} onCancel={cancelRun} />
  }

  return (
    <section className="rounded-[1.5rem] bg-white p-6 shadow-hairline ring-1 ring-border sm:p-8" data-analysis-required>
      <MascotNote mascot="mint">No analysis is open yet. {what}</MascotNote>
      {children && <div className="mt-4 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">{children}</div>}

      <h2 className="mt-6 text-[1.125rem] leading-tight">Analyse a demonstration farm now</h2>
      <p className="mt-1 max-w-2xl text-[0.875rem] text-muted">
        Runs the real engine on the stored NASA POWER record for that location. It takes a few seconds and the result is saved on this device.
      </p>
      <ul className="mt-3 grid gap-2.5 md:grid-cols-3">
        {presets.status === 'loading' && [0, 1, 2].map((i) => <li key={i} className="skeleton h-[4.5rem] rounded-2xl" aria-hidden="true" />)}
        {presets.status === 'error' && <li className="text-[0.9375rem] font-semibold text-signal-ink md:col-span-3">The demonstration farms could not be loaded. {presets.error}</li>}
        {presets.data?.presets.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              data-quick-preset={p.id}
              onClick={() => void analysePreset(p)}
              className="group flex h-full w-full items-center gap-3 rounded-2xl bg-sand/60 px-4 py-3 text-left transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-950 text-lime transition-transform group-hover:scale-105">
                <Play className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[1.0625rem] leading-tight font-semibold text-forest-950">
                  {p.display.place}
                  {p.display.country ? `, ${p.display.country}` : ''}
                </span>
                <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                  {p.water_label} · {fmtCoord(p.lat, p.lon)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ButtonRouterLink to="/app/analysis" variant="secondary" icon={<MapPin />}>
          Set up your own field
        </ButtonRouterLink>
      </div>
    </section>
  )
}
