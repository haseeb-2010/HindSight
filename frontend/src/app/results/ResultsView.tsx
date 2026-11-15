import { AlertTriangle, Database, Download, FileJson, FileText, History, Pencil, RefreshCw, Table2, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { rankedRotations, topAlternative } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord, fmtElapsed, fmtTime } from '../../lib/format'
import { Callout } from '../components/controls'
import { isScenarioActive, scenarioText } from '../lib/config'
import { downloadCsv, downloadJson } from '../lib/export'
import { waterLabel } from '../lib/labels'
import { useWorkspace, type Analysis } from '../state/workspace'
import { ClimateTab } from './ClimateTab'
import { CompareTab } from './CompareTab'
import { DetailsTab } from './DetailsTab'
import { EvidenceTab } from './EvidenceTab'
import { OverviewTab } from './OverviewTab'
import { ProvenanceTab } from './ProvenanceTab'
import { RunProgress } from './RunProgress'
import { Chip } from './shared'

export const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'compare', label: 'Compare rotations' },
  { id: 'details', label: 'Rotation details' },
  { id: 'climate', label: 'Climate trends' },
  { id: 'evidence', label: 'Why these rotations' },
  { id: 'data', label: 'Data & validation' },
] as const
export type TabId = (typeof TABS)[number]['id']
export const isTabId = (v: string | null): v is TabId => TABS.some((t) => t.id === v)

interface ResultsViewProps {
  analysis: Analysis
  tab: TabId
  onTab: (t: TabId) => void
  onEdit: () => void
}

export function ResultsView({ analysis, tab, onTab, onEdit }: ResultsViewProps) {
  const { stale, run, analyse, cancelRun, presets, crops } = useWorkspace()
  const navigate = useNavigate()
  const env = analysis.envelope
  const res = env.result
  const names = useMemo(() => ({ ...(presets.data?.crop_names ?? {}), ...Object.fromEntries((crops.data?.crops ?? []).map((c) => [c.id, c.name])) }), [presets.data, crops.data])
  const ranked = useMemo(() => rankedRotations(res), [res])
  const [selected, setSelected] = useState<string>(() => topAlternative(res)?.id ?? ranked[0]?.id ?? '')
  const [included, setIncluded] = useState<Set<string>>(() => new Set(ranked.map((r) => r.id)))
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // a new analysis may contain different rotations
  useEffect(() => {
    setSelected(topAlternative(res)?.id ?? ranked[0]?.id ?? '')
    setIncluded(new Set(ranked.map((r) => r.id)))
  }, [analysis.id, res, ranked])

  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false)
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])

  const inspect = (id: string) => {
    setSelected(id)
    onTab('details')
  }
  const toggle = (id: string) =>
    setIncluded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab)
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    onTab(TABS[next].id)
    tabRefs.current[TABS[next].id]?.focus()
  }

  const scenarioOn = isScenarioActive(env.request?.scenario)
  const warnings = (res.meta.warnings ?? []).filter((w) => !/What-if scenario/.test(w))
  const rec = res.meta.record
  const running = run.status !== 'idle'

  return (
    <>
      <div className="animate-rise min-w-0 space-y-5">
        <header className="rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Your Farm Analysis</p>
              <h1 id="results-title" tabIndex={-1} className="mt-1 text-[1.75rem] leading-[1.1] tracking-[-0.03em] outline-none sm:text-[2.25rem]">
                {res.site.name}
              </h1>
              <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
                Explore how your current crop rotation compares with alternative strategies across historical environmental conditions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" icon={<Pencil />} onClick={onEdit}>
                Edit settings
              </Button>
              <div ref={menuRef} className="relative">
                <Button icon={<Download />} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                  Export
                </Button>
                {menu && (
                  <div role="menu" aria-label="Export options" className="animate-pop absolute right-0 z-30 mt-2 w-72 rounded-2xl bg-white p-1.5 shadow-float ring-1 ring-border">
                    {[
                      { icon: FileText, label: 'Decision Brief (print / PDF)', hint: 'Opens the full report, ready to print or save as PDF', act: () => navigate('/app/brief') },
                      { icon: Table2, label: 'Rotation comparison (CSV)', hint: 'One row per rotation, for a spreadsheet', act: () => downloadCsv(env, { id: analysis.id, at: analysis.at }) },
                      { icon: FileJson, label: 'Download analysis (JSON)', hint: 'The complete engine response, as received', act: () => downloadJson(env, { id: analysis.id, at: analysis.at }) },
                    ].map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false)
                          o.act()
                        }}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-sand/70"
                      >
                        <o.icon className="mt-0.5 h-4 w-4 shrink-0 text-forest-800" aria-hidden="true" />
                        <span>
                          <span className="block text-[0.875rem] font-extrabold text-forest-950">{o.label}</span>
                          <span className="block text-[0.75rem] text-muted">{o.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Analysis details">
            <li>
              <Chip>{fmtCoord(res.site.lat, res.site.lon)}</Chip>
            </li>
            <li>
              <Chip>{waterLabel(env.request?.water?.mode, env.request?.water?.seasonal_cap_mm)}</Chip>
            </li>
            <li>
              <Chip>
                Analysis period {rec.start_year}–{rec.end_year}
              </Chip>
            </li>
            <li>
              <Chip>Engine v{res.meta.engine_version}</Chip>
            </li>
            <li>
              {env.source === 'live' ? (
                <Chip tone="lime">
                  <Zap className="h-3 w-3" aria-hidden="true" /> Live calculation
                  {fmtTime(env.computed_at) ? ` · ${fmtTime(env.computed_at)}` : ''}
                  {fmtElapsed(env.elapsed_ms) ? ` · ${fmtElapsed(env.elapsed_ms)}` : ''}
                </Chip>
              ) : (
                <Chip tone="peri">
                  <Database className="h-3 w-3" aria-hidden="true" /> Saved demonstration result
                </Chip>
              )}
            </li>
            {scenarioOn && (
              <li>
                <Chip tone="signal">
                  <History className="h-3 w-3" aria-hidden="true" /> What-if: {scenarioText(env.request?.scenario)}
                </Chip>
              </li>
            )}
          </ul>
        </header>

        {running ? (
          <RunProgress run={run} onRetry={() => analyse()} onCancel={cancelRun} onEdit={() => { cancelRun(); onEdit() }} />
        ) : (
          stale && (
            <div role="status" className="flex flex-col gap-3 rounded-2xl bg-signal-50 p-4 ring-1 ring-signal/30 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-ink">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-ink" aria-hidden="true" />
                <span>
                  <strong className="font-extrabold text-forest-950">These results are from your previous settings.</strong> You have changed the inputs since this analysis ran, so
                  what you see below does not reflect them yet.
                </span>
              </p>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={onEdit}>
                  Review changes
                </Button>
                <Button icon={<RefreshCw />} onClick={() => analyse()}>
                  Rerun analysis
                </Button>
              </div>
            </div>
          )
        )}

        {env.source === 'saved' && (
          <Callout tone="info" title="Saved demonstration result">
            {env.notice} {env.fallback_reason ? `The live engine could not run: ${env.fallback_reason}.` : ''}
          </Callout>
        )}
        {scenarioOn && (
          <Callout tone="warn" title="Historical what-if scenario — not a climate forecast.">
            This analysis replayed the 1985–2024 record with {scenarioText(env.request?.scenario)} applied uniformly to every day. Every number below describes that adjusted past,
            not a prediction.
          </Callout>
        )}
        {[...(env.notes ?? []), ...warnings].map((n) => (
          <Callout key={n} tone="plain">
            {n}
          </Callout>
        ))}

        <div role="tablist" aria-label="Results sections" onKeyDown={onTabKey} className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const on = t.id === tab
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el
                }}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls="results-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => onTab(t.id)}
                className={cx(
                  'relative shrink-0 rounded-t-xl px-3.5 py-3 text-[0.9375rem] font-bold whitespace-nowrap transition-colors',
                  on ? 'text-forest-950' : 'text-muted hover:text-forest-950',
                )}
              >
                {t.label}
                <span aria-hidden="true" className={cx('absolute inset-x-2 -bottom-px h-[3px] rounded-full transition-colors', on ? 'bg-forest-950' : 'bg-transparent')} />
              </button>
            )
          })}
        </div>

        <div role="tabpanel" id="results-panel" aria-labelledby={`tab-${tab}`} key={tab} className={cx('animate-fade min-w-0', stale && !running && 'opacity-80')}>
          {tab === 'overview' && <OverviewTab env={env} onOpenTab={(t) => isTabId(t) && onTab(t)} onInspect={inspect} />}
          {tab === 'compare' && <CompareTab env={env} names={names} included={included} onToggle={toggle} onInspect={inspect} />}
          {tab === 'details' && <DetailsTab env={env} names={names} selected={selected} onSelect={setSelected} />}
          {tab === 'climate' && <ClimateTab env={env} />}
          {tab === 'evidence' && <EvidenceTab env={env} selected={selected} onSelect={setSelected} />}
          {tab === 'data' && <ProvenanceTab env={env} />}
        </div>
      </div>
    </>
  )
}
