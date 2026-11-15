import { Check, Download, FileText, FolderOpen, GitCompareArrows, HardDrive, Pencil, Table2, Trash2, Upload, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ButtonRouterLink } from '../../components/ui/Button'
import { currentRotation, rotationLabel, topAlternative } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord } from '../../lib/format'
import type { AnalysisEnvelope } from '../../lib/types'
import { Callout, MascotNote } from '../components/controls'
import { PageHeader } from '../components/PageHeader'
import { isScenarioActive, scenarioText } from '../lib/config'
import { downloadCsv, downloadJson } from '../lib/export'
import type { RunInput } from '../lib/insights'
import { PRIORITIES, waterLabel } from '../lib/labels'
import { MAX_LIBRARY } from '../lib/library'
import { priorityList } from '../lib/priorityTemplates'
import { Chip } from '../results/shared'
import { useCropNames } from '../state/useCropNames'
import { useWorkspace, type Analysis } from '../state/workspace'

const RunComparison = lazy(() => import('../components/RunComparison'))
const MAX_COMPARE = 4

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'date not recorded' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

/** True for a JSON file that holds a HindSight analysis envelope (as written by "Analysis JSON"). */
function isEnvelope(v: unknown): v is AnalysisEnvelope {
  const e = v as AnalysisEnvelope | null
  return !!e && typeof e === 'object' && !!e.result && Array.isArray(e.result.rotations) && e.result.rotations.length > 0 && !!e.result.meta?.record && !!e.result.site
}

function AnalysisCard({
  a,
  open,
  picked,
  canPick,
  onPick,
}: {
  a: Analysis
  open: boolean
  picked: boolean
  canPick: boolean
  onPick: () => void
}) {
  const { openAnalysis, removeAnalysis, renameAnalysis } = useWorkspace()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(a.name)
  const [confirming, setConfirming] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const env = a.envelope
  const res = env.result
  const cur = currentRotation(res)
  const top = topAlternative(res)
  const req = env.request
  const priorities = priorityList(req?.priorities, PRIORITIES)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const go = (to: string) => {
    openAnalysis(a.id)
    navigate(to)
  }
  const save = () => {
    renameAnalysis(a.id, draft)
    setEditing(false)
  }

  return (
    <li className={cx('flex flex-col rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 transition-shadow', picked ? 'ring-2 ring-forest-950' : 'ring-border')} data-analysis-card={a.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                save()
              }}
            >
              <input
                ref={input}
                value={draft}
                maxLength={80}
                aria-label="Name of this analysis"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-white px-3.5 text-[0.9375rem] font-semibold text-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
              />
              <button type="submit" disabled={!draft.trim()} aria-label="Save name" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime disabled:opacity-50">
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setEditing(false)} aria-label="Cancel renaming" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sand text-forest-950">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <h2 className="flex items-center gap-1.5 text-[1.25rem] leading-tight">
              <span className="truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => {
                  setDraft(a.name)
                  setEditing(true)
                }}
                aria-label={`Rename ${a.name}`}
                title="Rename"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sand hover:text-forest-950"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </h2>
          )}
          <p className="mt-0.5 text-[0.8125rem] font-semibold text-muted tabular-nums">
            {fmtCoord(res.site.lat, res.site.lon)} · saved {when(a.at)}
            {env.analysis_id ? ` · run ${env.analysis_id.slice(0, 8)}` : ''}
          </p>
        </div>
        {open && <Chip tone="lime">Open now</Chip>}
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        <li>
          <Chip>{waterLabel(req?.water?.mode, req?.water?.seasonal_cap_mm)}</Chip>
        </li>
        <li>
          <Chip>{res.rotations.length} rotations</Chip>
        </li>
        <li>
          <Chip tone={env.source === 'live' ? 'white' : 'peri'}>{env.source === 'live' ? 'Calculated by the engine' : 'Saved demonstration result'}</Chip>
        </li>
        <li>
          <Chip tone={isScenarioActive(req?.scenario) ? 'signal' : 'white'}>
            {isScenarioActive(req?.scenario) ? `What-if: ${scenarioText(req?.scenario)}` : 'Historical baseline'}
          </Chip>
        </li>
      </ul>

      <dl className="mt-4 space-y-1.5 text-[0.9375rem]">
        <div className="flex gap-2">
          <dt className="w-36 shrink-0 font-bold text-muted">Current rotation</dt>
          <dd className="min-w-0 font-semibold text-ink">{cur ? `${rotationLabel(cur)} (rank #${cur.scores?.rank} of ${res.rotations.length})` : '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-36 shrink-0 font-bold text-muted">Top alternative</dt>
          <dd className="min-w-0 font-semibold text-ink">{top ? `${rotationLabel(top)} (rank #${top.scores?.rank})` : 'None returned'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-36 shrink-0 font-bold text-muted">Priorities (0–5)</dt>
          <dd className="min-w-0 font-semibold text-ink tabular-nums">{priorities || 'Not recorded with this analysis'}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <Button icon={<FolderOpen />} onClick={() => go('/app/analysis?step=results')}>
          Open
        </Button>
        <Button variant="secondary" icon={<FileText />} onClick={() => go('/app/brief')}>
          Brief
        </Button>
        <Button variant="secondary" icon={<Download />} onClick={() => downloadJson(env)} aria-label={`Export ${a.name} as JSON`}>
          JSON
        </Button>
        <Button variant="secondary" icon={<Table2 />} onClick={() => downloadCsv(env)} aria-label={`Export the rotation comparison of ${a.name} as CSV`}>
          CSV
        </Button>
        {confirming ? (
          <span role="alert" className="flex items-center gap-2 rounded-full bg-signal-50 py-1 pr-1 pl-3.5 text-[0.875rem] font-bold text-signal-ink ring-1 ring-signal/30">
            Delete from this device?
            <button type="button" onClick={() => removeAnalysis(a.id)} className="rounded-full bg-signal-ink px-3 py-1.5 text-white">
              Delete
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-full bg-white px-3 py-1.5 text-forest-950 ring-1 ring-border-strong">
              Keep
            </button>
          </span>
        ) : (
          <Button variant="secondary" icon={<Trash2 />} onClick={() => setConfirming(true)} aria-label={`Delete the analysis ${a.name}`}>
            Delete
          </Button>
        )}
        <label
          className={cx(
            'ml-auto flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-[0.875rem] font-extrabold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest-950',
            picked ? 'bg-forest-950 text-cream-50' : 'bg-sand text-forest-950 hover:bg-[#e9e3d6]',
            !canPick && !picked && 'cursor-not-allowed opacity-50',
          )}
        >
          <input type="checkbox" className="sr-only" checked={picked} disabled={!canPick && !picked} onChange={onPick} />
          <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
          {picked ? 'In comparison' : 'Compare'}
        </label>
      </div>
    </li>
  )
}

export function AnalysesPage() {
  const { history, current, storageError, saveEnvelope } = useWorkspace()
  const names = useCropNames()
  const [picked, setPicked] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const compareRef = useRef<HTMLDivElement>(null)

  // an analysis that was deleted cannot stay in the comparison
  const chosen = useMemo(() => picked.map((id) => history.find((a) => a.id === id)).filter((a): a is Analysis => !!a), [picked, history])
  const runs: RunInput[] = chosen.map((a) => ({
    id: a.id,
    label: a.name,
    sublabel: `${when(a.at)}${isScenarioActive(a.envelope.request?.scenario) ? ` · what-if: ${scenarioText(a.envelope.request?.scenario)}` : ''}`,
    envelope: a.envelope,
  }))

  const toggle = (id: string) => {
    setComparing(false)
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_COMPARE ? [...p, id] : p))
  }

  const onImport = async (f: File | undefined) => {
    if (!f) return
    try {
      const parsed: unknown = JSON.parse(await f.text())
      if (!isEnvelope(parsed)) throw new Error('not an analysis')
      saveEnvelope(parsed, { name: parsed.result.site.name })
      setImportMsg({ ok: true, text: `Imported “${parsed.result.site.name}” from ${f.name}.` })
    } catch {
      setImportMsg({ ok: false, text: `${f.name} is not a HindSight analysis file. Choose a JSON file that was exported from HindSight.` })
    }
    if (file.current) file.current.value = ''
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Analyses"
        title="Your analyses, saved on this device"
        intro={
          <>
            Every analysis you run is kept in this browser so you can reopen, rename, compare and export it. HindSight has no accounts: nothing is stored on a server or
            synchronised to your other devices, and clearing your browser data removes these analyses. Export the JSON of any you want to keep.
          </>
        }
        actions={
          <>
            <input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Import an analysis JSON file" onChange={(e) => void onImport(e.target.files?.[0])} />
            <Button variant="secondary" icon={<Upload />} onClick={() => file.current?.click()}>
              Import JSON
            </Button>
            <ButtonRouterLink to="/app/analysis" arrow>
              New analysis
            </ButtonRouterLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="lime">
          <HardDrive className="h-3 w-3" aria-hidden="true" /> Saved on this device
        </Chip>
        <span className="text-[0.8125rem] font-semibold text-muted tabular-nums">
          {history.length} of {MAX_LIBRARY} kept · the oldest is replaced when the list is full
        </span>
      </div>

      {storageError && (
        <Callout tone="warn" title="Analyses are not being saved on this device">
          {storageError}
        </Callout>
      )}
      {importMsg && (
        <Callout tone={importMsg.ok ? 'info' : 'warn'}>
          <span role="status">{importMsg.text}</span>
        </Callout>
      )}

      {history.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-[1.5rem] bg-white p-8 ring-1 ring-border">
          <MascotNote mascot="mint">Nothing saved on this device yet. Run a farm analysis and it will appear here.</MascotNote>
          <div className="flex flex-wrap gap-2">
            <ButtonRouterLink to="/app/analysis" arrow>
              Start a farm analysis
            </ButtonRouterLink>
            <ButtonRouterLink to="/app/demo" variant="secondary">
              Take the Guided Tour
            </ButtonRouterLink>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl bg-sand/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.9375rem] leading-snug text-ink">
              <strong className="font-extrabold text-forest-950">Compare analyses.</strong> Tick “Compare” on two to four analyses, for example the same field with
              different priorities or scenarios.
              {picked.length > 0 && <span className="font-bold tabular-nums"> {chosen.length} selected.</span>}
            </p>
            <div className="flex shrink-0 gap-2">
              {picked.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPicked([])
                    setComparing(false)
                  }}
                >
                  Clear
                </Button>
              )}
              <Button
                icon={<GitCompareArrows />}
                disabled={chosen.length < 2}
                onClick={() => {
                  setComparing(true)
                  window.setTimeout(() => compareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
                }}
              >
                Compare selected
              </Button>
            </div>
          </div>

          <ul className="grid gap-4 lg:grid-cols-2">
            {history.map((a) => (
              <AnalysisCard key={a.id} a={a} open={current?.id === a.id} picked={picked.includes(a.id)} canPick={picked.length < MAX_COMPARE} onPick={() => toggle(a.id)} />
            ))}
          </ul>

          {comparing && chosen.length >= 2 && (
            <section ref={compareRef} aria-label="Comparison of the selected analyses" className="scroll-mt-32 space-y-4">
              <h2 className="text-[1.5rem] leading-tight tracking-[-0.02em]">Comparison of {chosen.length} saved analyses</h2>
              <Suspense fallback={<div className="skeleton h-72 rounded-[1.5rem]" role="status" aria-label="Loading comparison" />}>
                <RunComparison runs={runs} kind="analysis" names={names} />
              </Suspense>
            </section>
          )}
        </>
      )}
    </div>
  )
}
