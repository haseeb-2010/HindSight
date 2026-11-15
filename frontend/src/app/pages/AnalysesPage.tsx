import { Download, FolderOpen, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, ButtonRouterLink } from '../../components/ui/Button'
import { currentRotation, rotationLabel, topAlternative } from '../../lib/analysis'
import { fmtCoord } from '../../lib/format'
import { MascotNote } from '../components/controls'
import { isScenarioActive, scenarioText } from '../lib/config'
import { downloadJson } from '../lib/export'
import { waterLabel } from '../lib/labels'
import { Chip } from '../results/shared'
import { useWorkspace } from '../state/workspace'

export function AnalysesPage() {
  const { history, current, openAnalysis, removeAnalysis } = useWorkspace()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-[1.875rem] leading-[1.08] tracking-[-0.03em] sm:text-[2.375rem]">My analyses</h1>
        <p className="mt-2.5 text-[1.0625rem] leading-relaxed text-muted">
          The analyses you have run in this browser tab. HindSight has no accounts yet, so they are not stored on a server and disappear when the tab closes: download the JSON to
          keep one.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-[1.5rem] bg-white p-8 ring-1 ring-border">
          <MascotNote mascot="mint">Nothing saved in this session yet. Run a farm analysis and it will show up here.</MascotNote>
          <ButtonRouterLink to="/app/analysis" arrow>
            Start a farm analysis
          </ButtonRouterLink>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {history.map((a) => {
            const res = a.envelope.result
            const cur = currentRotation(res)
            const top = topAlternative(res)
            const req = a.envelope.request
            return (
              <li key={a.id} className="flex flex-col rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-[1.25rem] leading-tight">{a.name}</h2>
                    <p className="mt-0.5 text-[0.8125rem] font-semibold text-muted tabular-nums">
                      {fmtCoord(res.site.lat, res.site.lon)} · {new Date(a.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  {current?.id === a.id && <Chip tone="lime">Open now</Chip>}
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  <li>
                    <Chip>{waterLabel(req?.water?.mode, req?.water?.seasonal_cap_mm)}</Chip>
                  </li>
                  <li>
                    <Chip>{res.rotations.length} rotations</Chip>
                  </li>
                  <li>
                    <Chip tone={a.envelope.source === 'live' ? 'white' : 'peri'}>{a.envelope.source === 'live' ? 'Live calculation' : 'Saved demonstration result'}</Chip>
                  </li>
                  {isScenarioActive(req?.scenario) && (
                    <li>
                      <Chip tone="signal">What-if: {scenarioText(req?.scenario)}</Chip>
                    </li>
                  )}
                </ul>
                <dl className="mt-4 space-y-1.5 text-[0.9375rem]">
                  <div className="flex gap-2">
                    <dt className="w-36 shrink-0 font-bold text-muted">Current rotation</dt>
                    <dd className="font-semibold text-ink">{cur ? `${rotationLabel(cur)} (rank #${cur.scores?.rank})` : '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-36 shrink-0 font-bold text-muted">Top alternative</dt>
                    <dd className="font-semibold text-ink">{top ? `${rotationLabel(top)} (rank #${top.scores?.rank})` : 'None returned'}</dd>
                  </div>
                </dl>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Button
                    icon={<FolderOpen />}
                    onClick={() => {
                      openAnalysis(a.id)
                      navigate('/app/analysis?step=results')
                    }}
                  >
                    Open
                  </Button>
                  <Button variant="secondary" icon={<Download />} onClick={() => downloadJson(a.envelope)}>
                    JSON
                  </Button>
                  <Button variant="secondary" icon={<Trash2 />} onClick={() => removeAnalysis(a.id)} aria-label={`Remove the analysis of ${a.name}`}>
                    Remove
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
