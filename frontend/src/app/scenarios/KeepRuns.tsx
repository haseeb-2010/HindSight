import { Check, FolderOpen, FolderPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Callout } from '../components/controls'
import type { RunInput } from '../lib/insights'
import { Chip, Panel } from '../results/shared'

/**
 * Every run of a comparison is a complete analysis. This lists them so one can be kept in
 * My Analyses (this device) or opened in the full results view.
 */
export function KeepRuns({
  runs,
  baselineId,
  isSaved,
  onSave,
  onOpen,
  storageError,
}: {
  runs: RunInput[]
  baselineId: string
  isSaved: (run: RunInput) => boolean
  onSave: (run: RunInput) => void
  onOpen: (run: RunInput) => void
  /** Set when the browser refuses to store analyses on this device. */
  storageError: string | null
}) {
  return (
    <Panel title="Keep a run as a full analysis">
      <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
        Each run above is a complete analysis with its own results, charts and evidence. Save one to My Analyses on this device, or open it to read every tab. A saved scenario run keeps
        its what-if label wherever it is shown.
      </p>
      {storageError && (
        <Callout tone="warn" className="mt-3">
          {storageError}
        </Callout>
      )}
      <ul className="mt-4 divide-y divide-border border-t border-border">
        {runs.map((run) => {
          const saved = isSaved(run)
          return (
            <li key={run.id} className="flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[0.9375rem] leading-snug font-extrabold text-forest-950">
                  {run.label}
                  {run.id === baselineId && <Chip tone="forest">Baseline</Chip>}
                  {saved && (
                    <Chip tone="lime">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> In My Analyses
                    </Chip>
                  )}
                </p>
                {run.sublabel && <p className="mt-0.5 text-[0.8125rem] font-semibold text-ink">{run.sublabel}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {saved ? (
                  <Link to="/app/analyses" className="rounded-full px-3 py-2 text-[0.875rem] font-extrabold text-forest-950 underline underline-offset-4 hover:no-underline">
                    View in My Analyses
                  </Link>
                ) : (
                  <Button variant="secondary" icon={<FolderPlus />} onClick={() => onSave(run)} data-save-run={run.id}>
                    Save to My Analyses
                    <span className="sr-only">: {run.label}</span>
                  </Button>
                )}
                <Button variant="secondary" icon={<FolderOpen />} onClick={() => onOpen(run)} data-open-run={run.id}>
                  Open as full analysis
                  <span className="sr-only">: {run.label}</span>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
