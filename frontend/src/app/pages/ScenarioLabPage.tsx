import { FileText, Lightbulb, Play, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ButtonRouterLink } from '../../components/ui/Button'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { usePrefersReducedMotion } from '../../hooks/useMotion'
import { currentRotation, rotationLabel } from '../../lib/analysis'
import { fmtCoord, fmtElapsed, fmtTime } from '../../lib/format'
import { AnalysisRequired } from '../components/AnalysisRequired'
import { Callout, MascotNote } from '../components/controls'
import { PageHeader } from '../components/PageHeader'
import RunComparison from '../components/RunComparison'
import { ScenarioDisclaimer } from '../components/ScenarioDisclaimer'
import { ScenarioChip, SourceBadge } from '../components/SourceBadge'
import { isScenarioActive, requestFromEnvelope, scenarioText } from '../lib/config'
import type { RunInput } from '../lib/insights'
import { PRIORITIES, SOIL_SOURCES, textureLabel, waterLabel } from '../lib/labels'
import { priorityList } from '../lib/priorityTemplates'
import {
  BASELINE,
  MAX_SAVED_SCENARIOS,
  SCENARIO_PRESETS,
  isBaseline,
  loadSavedScenarios,
  newScenarioId,
  scenarioSummary,
  storeSavedScenarios,
  toVariant,
  type ScenarioDef,
} from '../lib/scenarios'
import { Chip } from '../results/shared'
import { RunProgress } from '../results/RunProgress'
import { KeepRuns } from '../scenarios/KeepRuns'
import { clearLab, keptBaseId, loadLab, loadUi, storeLab, storeUi, type Draft, type StoredLab } from '../scenarios/labStore'
import { NAME_MAX, ScenarioBuilder, type BuilderLimits } from '../scenarios/ScenarioBuilder'
import { ScenarioPicker, type CustomEntry } from '../scenarios/ScenarioPicker'
import { sameAdjustment } from '../scenarios/words'
import { useComparison } from '../state/useComparison'
import { useCropNames } from '../state/useCropNames'
import { useWorkspace, type Analysis } from '../state/workspace'

const CUSTOM_ID = 'custom'
/** Ticked when the page is first opened in a tab. Nothing runs until the user presses the button. */
const DEFAULT_SELECTED = ['warm2', 'rain80', 'warm2rain80']
/** Used only until the API reports its own limit (crops.data.limits.max_compare_runs). */
const FALLBACK_MAX_RUNS = 6
const EMPTY_DRAFT: Draft = { temp_delta_c: BASELINE.temp_delta_c, precip_factor: BASELINE.precip_factor, name: '' }

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v))

export default function ScenarioLabPage() {
  const { current } = useWorkspace()
  const record = current?.envelope.result.meta.record

  const header = (
    <PageHeader
      eyebrow="Scenario Lab"
      title="What if the historical weather had been different?"
      intro={`Adjust the ${record ? `${record.start_year}–${record.end_year}` : 'historical'} weather record with a temperature offset, a rainfall factor or both. Run the versions side by side and see whether the ranking of your rotation strategies holds or changes.`}
      actions={
        current && (
          <>
            <ButtonRouterLink to="/app/insights" variant="secondary" icon={<Lightbulb />}>
              Field Intelligence
            </ButtonRouterLink>
            <ButtonRouterLink to="/app/brief" variant="secondary" icon={<FileText />}>
              Decision Brief
            </ButtonRouterLink>
          </>
        )
      }
    />
  )

  if (!current) {
    return (
      <div className="space-y-6">
        {header}
        <ScenarioDisclaimer />
        <AnalysisRequired what="The Scenario Lab re-runs an open analysis on an adjusted weather record, so run one first." />
      </div>
    )
  }

  // a different open analysis is a different lab bench: selection survives (session), results are keyed to the analysis
  return <Lab key={current.id} analysis={current} header={header} />
}

function Lab({ analysis, header }: { analysis: Analysis; header: ReactNode }) {
  const { stale, defaultPriorities, crops, reloadData, saveEnvelope, openAnalysis, history, storageError } = useWorkspace()
  const names = useCropNames()
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const cmp = useComparison()

  const env = analysis.envelope
  const res = env.result
  const site = res.site
  const cur = currentRotation(res)
  const base = useMemo(() => requestFromEnvelope(env, defaultPriorities), [env, defaultPriorities])

  const [ui] = useState(loadUi)
  const [saved, setSaved] = useState<ScenarioDef[]>(loadSavedScenarios)
  const [sessionOnly, setSessionOnly] = useState<Set<string>>(() => new Set())
  const [draft, setDraft] = useState<Draft>(() => ui?.draft ?? EMPTY_DRAFT)
  const [selected, setSelected] = useState<string[]>(() => ui?.selected ?? DEFAULT_SELECTED)
  const [nameError, setNameError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const [listNote, setListNote] = useState<string | null>(null)
  const [kept, setKept] = useState<StoredLab | null>(() => loadLab(analysis.id))
  const [keptInTab, setKeptInTab] = useState(true)
  const [localSaves, setLocalSaves] = useState<Record<string, string>>({})
  const lastRun = useRef<ScenarioDef[]>([])
  const resultsRef = useRef<HTMLElement>(null)
  const builderRef = useRef<HTMLHeadingElement>(null)

  const lim = crops.data?.limits
  const limits = useMemo<BuilderLimits | null>(() => (lim ? { temp: lim.temp_delta_c, rain: lim.precip_factor } : null), [lim])
  const maxOthers = Math.max(1, (lim?.max_compare_runs ?? FALLBACK_MAX_RUNS) - 1)

  // slider values restored from the session must sit inside the range the API accepts
  useEffect(() => {
    if (!limits) return
    setDraft((d) => {
      const t = clamp(d.temp_delta_c, limits.temp)
      const p = clamp(d.precip_factor, limits.rain)
      return t === d.temp_delta_c && p === d.precip_factor ? d : { ...d, temp_delta_c: t, precip_factor: p }
    })
  }, [limits])

  useEffect(() => storeUi({ selected, draft }), [selected, draft])

  const builtins = useMemo(() => SCENARIO_PRESETS.filter((s) => !isBaseline(s)), [])
  const twin = [...builtins, ...saved].find((s) => sameAdjustment(s, draft))
  const blocked: CustomEntry['blocked'] = isBaseline(draft) ? 'baseline' : twin ? 'duplicate' : null
  // the typed name labels the run only while the sliders hold an adjustment of their own
  const customDef: ScenarioDef = { id: CUSTOM_ID, label: (!blocked && draft.name.trim()) || 'Custom adjustment', temp_delta_c: draft.temp_delta_c, precip_factor: draft.precip_factor }
  const custom: CustomEntry = { def: customDef, blocked, sameAs: twin?.label }
  const options = [...builtins, ...(custom.blocked ? [] : [customDef]), ...saved]
  const chosen = options.filter((o) => selected.includes(o.id)).slice(0, maxOthers)
  const scenarios = [BASELINE, ...chosen]
  const running = cmp.status === 'running'
  const customOn = chosen.some((c) => c.id === CUSTOM_ID)

  const toggle = (id: string) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))
  const scrollTo = (el: HTMLElement | null) => window.setTimeout(() => el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }), 60)

  const runNow = async (list: ScenarioDef[]) => {
    if (!base || list.length < 2) return
    lastRun.current = list
    scrollTo(resultsRef.current)
    const out = await cmp.run(
      base,
      list.map((s) => ({ ...toVariant(s), label: s.label.slice(0, 80) })),
    )
    if (!out) return
    const lab: StoredLab = { baseId: analysis.id, scenarios: list, comparison: out }
    setKept(lab)
    setKeptInTab(storeLab(lab))
  }

  const persist = (list: ScenarioDef[], touched: string | null) => {
    const ok = storeSavedScenarios(list)
    // once the browser accepts the list again, everything in it is on the device
    setSessionOnly((prev) => (ok ? new Set() : touched ? new Set([...prev, touched]) : prev))
    return ok
  }

  const saveDraft = () => {
    const name = draft.name.trim().slice(0, NAME_MAX)
    setSaveStatus(null)
    if (isBaseline(draft)) return
    if (!name) return setNameError('Give the scenario a name first.')
    if (SCENARIO_PRESETS.some((s) => s.label.toLowerCase() === name.toLowerCase())) return setNameError('That name belongs to a built-in scenario. Choose another.')
    const existing = saved.find((s) => s.label.toLowerCase() === name.toLowerCase())
    if (!existing && saved.length >= MAX_SAVED_SCENARIOS) return setNameError(`You can keep up to ${MAX_SAVED_SCENARIOS} scenarios. Remove one from the checklist first.`)
    setNameError(null)
    const def: ScenarioDef = { id: existing?.id ?? newScenarioId(), label: name, temp_delta_c: draft.temp_delta_c, precip_factor: draft.precip_factor }
    const list = existing ? saved.map((s) => (s.id === existing.id ? def : s)) : [def, ...saved]
    setSaved(list)
    const ok = persist(list, def.id)
    // the saved scenario takes the place of the unsaved slider entry in the selection
    setSelected((sel) => {
      const rest = sel.filter((id) => id !== CUSTOM_ID && id !== def.id)
      const live = rest.filter((id) => options.some((o) => o.id === id))
      return live.length < maxOthers ? [...rest, def.id] : rest
    })
    setSaveStatus(
      ok
        ? { tone: 'ok', text: `“${name}” (${scenarioSummary(def)}) is ${existing ? 'updated' : 'saved'} on this device and listed under Your scenarios.` }
        : { tone: 'warn', text: `This browser did not let HindSight store “${name}”. It is kept for this session only and will be gone when the tab closes.` },
    )
  }

  const removeSaved = (s: ScenarioDef) => {
    const list = saved.filter((x) => x.id !== s.id)
    setSaved(list)
    setSelected((sel) => sel.filter((id) => id !== s.id))
    setSaveStatus(null)
    setListNote(persist(list, null) ? `“${s.label}” was removed from this device.` : `“${s.label}” was removed for this session, but this browser did not let HindSight update the list stored on this device.`)
  }

  const loadSaved = (s: ScenarioDef) => {
    setDraft({ temp_delta_c: limits ? clamp(s.temp_delta_c, limits.temp) : s.temp_delta_c, precip_factor: limits ? clamp(s.precip_factor, limits.rain) : s.precip_factor, name: s.label })
    setNameError(null)
    setSaveStatus(null)
    setListNote(`“${s.label}” is loaded into the sliders.`)
    window.setTimeout(() => {
      builderRef.current?.focus({ preventScroll: true })
      builderRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    }, 60)
  }

  const runs: RunInput[] = useMemo(
    () =>
      kept
        ? kept.comparison.variants.map((v) => {
            const def = kept.scenarios.find((s) => s.id === v.id)
            return { id: v.id, label: v.label, sublabel: def ? scenarioSummary(def) : undefined, envelope: v.envelope }
          })
        : [],
    [kept],
  )
  const outdated = !!kept && (kept.scenarios.length !== scenarios.length || kept.scenarios.some((s, i) => s.id !== scenarios[i].id || s.label !== scenarios[i].label || !sameAdjustment(s, scenarios[i])))

  const nameFor = (run: RunInput) => `${site.name} — ${run.label}`
  const keep = (run: RunInput, open: boolean) => {
    const id = saveEnvelope(run.envelope, { name: nameFor(run), open })
    setLocalSaves((m) => ({ ...m, [run.id]: id }))
    if (open) navigate('/app/analysis?step=results')
  }
  const isSaved = (run: RunInput) => {
    const id = run.envelope.analysis_id ?? localSaves[run.id]
    return !!id && history.some((a) => a.id === id)
  }

  const soil = res.site.soil_used
  const when = new Date(analysis.at)
  // a comparison kept in this tab for another analysis that is still saved on this device
  const [elsewhereId] = useState(keptBaseId)
  const elsewhere = !kept && elsewhereId && elsewhereId !== analysis.id ? history.find((a) => a.id === elsewhereId) : undefined

  return (
    <div className="space-y-5">
      {header}
      <MascotNote mascot="blue" className="max-w-2xl">
        Tick a few stress tests and press “Run comparison”. Nothing runs until you do. Each scenario replays the whole record again, so allow a few seconds per run.
      </MascotNote>

      <section aria-label="Analysis the scenarios start from" className="rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Open analysis · the same in every run</p>
            <h2 className="mt-1 truncate text-[1.5rem] leading-tight tracking-[-0.02em]">{analysis.name}</h2>
            <p className="mt-1 text-[0.875rem] font-semibold text-muted tabular-nums">
              {fmtCoord(site.lat, site.lon)}
              {!Number.isNaN(when.getTime()) && <> · analysed {when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</>}
            </p>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Run details">
            <li>
              <SourceBadge env={env} />
            </li>
            <li>
              <Chip>
                Historical period {res.meta.record.start_year}–{res.meta.record.end_year}
              </Chip>
            </li>
            {isScenarioActive(env.request?.scenario) && (
              <li>
                <ScenarioChip env={env} />
              </li>
            )}
          </ul>
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-3 border-t border-border pt-4 text-[0.875rem] sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <dt className="font-bold text-muted">Current rotation</dt>
            <dd className="mt-0.5 font-semibold text-forest-950">{cur ? rotationLabel(cur) : 'Not available'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-bold text-muted">Water</dt>
            <dd className="mt-0.5 font-semibold text-forest-950">{waterLabel(env.request?.water?.mode, env.request?.water?.seasonal_cap_mm)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-bold text-muted">Soil</dt>
            <dd className="mt-0.5 font-semibold text-forest-950">
              {soil?.texture_class ? textureLabel(soil.texture_class) : 'Not recorded with this run'}
              {soil?.source && SOIL_SOURCES[soil.source] ? ` · ${SOIL_SOURCES[soil.source]}` : ''}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-bold text-muted">Farmer priorities (0–5)</dt>
            <dd className="mt-0.5 font-semibold text-forest-950">{priorityList(env.request?.priorities, PRIORITIES) || 'Not recorded with this run'}</dd>
          </div>
        </dl>
      </section>

      {stale && (
        <Callout tone="info" title="Scenarios use the settings of the open analysis">
          You have changed the farm settings since this analysis ran. The Scenario Lab re-runs the analysis shown above as it was run, not the unsaved changes in the form. Rerun it from Farm
          Analysis first if you want the scenarios to use the new settings.
        </Callout>
      )}
      {isScenarioActive(env.request?.scenario) && (
        <Callout tone="info" title="The open analysis is itself a what-if run">
          It was run with {scenarioText(env.request?.scenario)}. The Scenario Lab still starts from the unadjusted record: the baseline here is the actual historical weather, and each scenario
          replaces that adjustment with its own.
        </Callout>
      )}
      {!base && (
        <Callout tone="warn" title="This analysis cannot be re-run from here">
          It was stored without the settings it was run with, so the engine cannot repeat it on an adjusted record. Run the analysis again from Farm Analysis, then come back.
        </Callout>
      )}

      <ScenarioDisclaimer />

      <div className="space-y-5">
        {/* stays in view under the workspace navigation while the checklist and sliders are on screen */}
        <div
          className="on-dark sticky top-[7.5rem] z-30 flex items-center justify-between gap-x-5 gap-y-3 rounded-[1.5rem] bg-forest-950 px-4 py-3 shadow-float sm:px-6 sm:py-4 print:hidden"
          data-run-bar
        >
          <div className="min-w-0">
            <p className="font-display text-[1rem] leading-snug font-semibold text-cream-50 sm:text-[1.1875rem]" aria-live="polite">
              {chosen.length === 0 ? (
                'Tick at least one scenario to compare with the baseline'
              ) : (
                <>
                  Baseline + {chosen.length} scenario{chosen.length === 1 ? '' : 's'}
                  <span className="hidden sm:inline"> = {scenarios.length} engine runs</span>
                </>
              )}
            </p>
            <p className="mt-0.5 hidden text-[0.8125rem] leading-snug text-mist sm:block">
              {chosen.length > 0 && <>{scenarios.map((s) => s.label).join(' · ')}. </>}
              {chosen.length >= maxOthers ? `That is the most that can run at once: the baseline and ${maxOthers} others.` : `Up to ${maxOthers} scenarios can run beside the baseline.`}
            </p>
          </div>
          <Button variant="accent" icon={<Play />} loading={running} disabled={running || !base || chosen.length === 0} onClick={() => void runNow(scenarios)} data-run-scenarios className="shrink-0">
            {running ? 'Running…' : 'Run comparison'}
          </Button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] print:hidden">
          <section aria-labelledby="lab-choose" className="rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6">
            <h2 id="lab-choose" className="text-[1.375rem] leading-tight tracking-[-0.02em]">
              Choose what to compare
            </h2>
            <p className="mt-1 mb-5 text-[0.9375rem] leading-relaxed text-muted">
              Tick the scenarios to run beside the baseline. Only the ticked ones run, and the weather and soil are read once for all of them.
            </p>
            <ScenarioPicker
              siteName={site.name}
              builtins={builtins}
              custom={custom}
              saved={saved}
              sessionOnly={sessionOnly}
              selected={chosen.map((c) => c.id)}
              maxOthers={maxOthers}
              onToggle={toggle}
              onLoad={loadSaved}
              onRemove={removeSaved}
              note={listNote}
            />
          </section>

          <section aria-label="Build your own stress test" className="rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6">
            <ScenarioBuilder
              draft={draft}
              onChange={(patch) => {
                setDraft((d) => ({ ...d, ...patch }))
                setNameError(null)
                setSaveStatus(null)
              }}
              limits={limits}
              limitsError={crops.status === 'error' ? (crops.error ?? 'The server did not answer.') : null}
              onRetryLimits={reloadData}
              presets={SCENARIO_PRESETS}
              onSave={saveDraft}
              nameError={nameError}
              status={saveStatus}
              savedCount={saved.length}
              maxSaved={MAX_SAVED_SCENARIOS}
              include={{
                on: customOn,
                blocked: custom.blocked === 'duplicate' ? `The same adjustment as “${custom.sameAs}”, which is already in the checklist.` : !customOn && chosen.length >= maxOthers ? 'The comparison is full. Untick a scenario in the checklist first.' : null,
                onToggle: () => toggle(CUSTOM_ID),
              }}
              headingRef={builderRef}
            />
          </section>
        </div>
      </div>

      <section ref={resultsRef} data-anchor aria-label="Comparison results" className="min-w-0 space-y-5">
        {cmp.status === 'running' || cmp.status === 'error' ? (
          <RunProgress
            run={cmp}
            title="Running your scenarios…"
            failedTitle="The scenarios could not be completed"
            intro="Reading the weather and soil once, then replaying the record for each ticked scenario."
            onRetry={() => void runNow(lastRun.current)}
            onCancel={cmp.cancel}
            onEdit={cmp.reset}
          />
        ) : kept ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[1.5rem] bg-sand/70 px-5 py-4 sm:px-6">
              <p className="min-w-0 text-[0.875rem] leading-snug font-semibold text-ink">
                <span className="font-extrabold text-forest-950">
                  Last comparison: {runs.length} run{runs.length === 1 ? '' : 's'}
                </span>
                {fmtTime(kept.comparison.computed_at) ? ` · finished ${fmtTime(kept.comparison.computed_at)}` : ''}
                {fmtElapsed(kept.comparison.elapsed_ms) ? ` · ${fmtElapsed(kept.comparison.elapsed_ms)}` : ''}
                {' · '}
                {kept.comparison.weather_from_cache ? 'weather read once from the stored NASA POWER record' : 'weather retrieved once from NASA POWER'}
                {keptInTab ? '. Kept for this browser tab.' : '. This browser could not keep it for the tab, so it will be gone if you leave this page.'}
              </p>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button variant="secondary" icon={<RefreshCw />} disabled={!base || chosen.length === 0} onClick={() => void runNow(scenarios)}>
                  {outdated ? 'Run the new selection' : 'Run again'}
                </Button>
                <Button
                  variant="secondary"
                  icon={<Trash2 />}
                  onClick={() => {
                    clearLab()
                    setKept(null)
                    cmp.reset()
                  }}
                >
                  Clear results
                </Button>
              </div>
            </div>
            {outdated && (
              <Callout tone="info" title="The checklist has changed since this comparison ran">
                The results below are for the scenarios that were ticked then. Run the new selection to update them.
              </Callout>
            )}
            <ErrorBoundary label="Scenario comparison">
              <div className="animate-fade space-y-5">
                <RunComparison runs={runs} baselineId={BASELINE.id} kind="scenario" names={names} />
                <div className="print:hidden">
                  <KeepRuns runs={runs} baselineId={BASELINE.id} isSaved={isSaved} onSave={(run) => keep(run, false)} onOpen={(run) => keep(run, true)} storageError={storageError} />
                </div>
              </div>
            </ErrorBoundary>
          </>
        ) : (
          <div className="rounded-[1.5rem] border-2 border-dashed border-sand-400 px-5 py-8 text-center sm:px-6 print:hidden">
            <h2 className="text-[1.25rem] leading-tight">No comparison has been run for this analysis yet</h2>
            <p className="mx-auto mt-1.5 max-w-xl text-[0.9375rem] leading-relaxed text-ink">
              Tick the scenarios you want and press “Run comparison”. The ranking of every run, the current rotation’s indicators and a plain account of what changed will appear here.
            </p>
            {elsewhere && (
              <p className="mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-sand-400 pt-4 text-[0.875rem] font-semibold text-ink">
                The last comparison in this tab was run from “{elsewhere.name}”.
                <Button variant="secondary" onClick={() => openAnalysis(elsewhere.id)}>
                  Open that analysis
                </Button>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
