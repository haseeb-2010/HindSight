import { CalendarRange, CloudSun, Droplets, FileText, FlaskConical, Layers, MapPinned, ShieldCheck, type LucideIcon } from 'lucide-react'
import { lazy, Suspense, useRef, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ButtonRouterLink } from '../../components/ui/Button'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { currentRotation, rotationLabel } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord } from '../../lib/format'
import type { AnalysisEnvelope } from '../../lib/types'
import { AnalysisRequired } from '../components/AnalysisRequired'
import { Callout } from '../components/controls'
import { PageHeader } from '../components/PageHeader'
import { ScenarioDisclaimer } from '../components/ScenarioDisclaimer'
import { ScenarioChip, SourceBadge } from '../components/SourceBadge'
import { isScenarioActive } from '../lib/config'
import { PRIORITIES, waterLabel } from '../lib/labels'
import { priorityList } from '../lib/priorityTemplates'
import { Chip } from '../results/shared'
import { useCropNames } from '../state/useCropNames'
import { useWorkspace, type Analysis } from '../state/workspace'

// Each section loads when its tab is first opened.
const ClimateInsights = lazy(() => import('../insights/ClimateInsights'))
const SeasonalExposure = lazy(() => import('../insights/SeasonalExposure'))
const RotationResilience = lazy(() => import('../insights/RotationResilience'))
const WaterResilience = lazy(() => import('../insights/WaterResilience'))
const SoilCare = lazy(() => import('../insights/SoilCare'))
const GeoContext = lazy(() => import('../insights/GeoContext'))

export const INSIGHT_TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'climate', label: 'Climate patterns', icon: CloudSun },
  { id: 'season', label: 'Seasonal exposure', icon: CalendarRange },
  { id: 'resilience', label: 'Rotation resilience', icon: ShieldCheck },
  { id: 'water', label: 'Water resilience', icon: Droplets },
  { id: 'soil', label: 'Soil-care opportunities', icon: Layers },
  { id: 'location', label: 'Location & data', icon: MapPinned },
]

/** Which farm, which run, which settings: the identity of everything shown below it. */
export function RunSummary({ analysis, className }: { analysis: Pick<Analysis, 'at' | 'name'> & { envelope: AnalysisEnvelope }; className?: string }) {
  const env = analysis.envelope
  const res = env.result
  const cur = currentRotation(res)
  const rec = res.meta.record
  const ndvi = res.validation?.ndvi_check
  const soil = env.inputs?.soil?.used ?? res.site.soil_used?.source
  const when = new Date(analysis.at)
  return (
    <section aria-label="Analysis being interpreted" className={cx('rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Selected farm</p>
          <h2 className="mt-1 truncate text-[1.5rem] leading-tight tracking-[-0.02em]">{analysis.name}</h2>
          <p className="mt-1 text-[0.875rem] font-semibold text-muted tabular-nums">
            {fmtCoord(res.site.lat, res.site.lon)}
            {!Number.isNaN(when.getTime()) && <> · analysed {when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</>}
            {env.analysis_id && <> · run {env.analysis_id.slice(0, 8)}</>}
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Run details">
          <li>
            <SourceBadge env={env} />
          </li>
          <li>
            <Chip>
              Historical period {rec.start_year}–{rec.end_year}
            </Chip>
          </li>
          <li>
            <Chip>Engine v{res.meta.engine_version}</Chip>
          </li>
          <li>
            <ScenarioChip env={env} />
          </li>
        </ul>
      </div>
      <dl className="mt-4 grid gap-x-8 gap-y-3 border-t border-border pt-4 text-[0.875rem] sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <dt className="font-bold text-muted">Current rotation</dt>
          <dd className="mt-0.5 font-semibold text-forest-950">{cur ? rotationLabel(cur) : '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-bold text-muted">Water</dt>
          <dd className="mt-0.5 font-semibold text-forest-950">{waterLabel(env.request?.water?.mode, env.request?.water?.seasonal_cap_mm)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-bold text-muted">Farmer priorities (0–5)</dt>
          <dd className="mt-0.5 font-semibold text-forest-950">{priorityList(env.request?.priorities, PRIORITIES) || 'Not recorded with this run'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-bold text-muted">Data availability</dt>
          <dd className="mt-0.5 font-semibold text-forest-950">
            NASA POWER weather · soil: {soil === 'farmer' ? 'farmer input' : soil ? 'SoilGrids estimate' : 'not recorded'} · NDVI check: {ndvi ? 'performed' : 'not available'}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function SectionFallback() {
  return (
    <div role="status" aria-label="Loading section" className="space-y-4">
      <div className="skeleton h-8 w-2/3 max-w-xl rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-56 rounded-[1.5rem]" />
        <div className="skeleton h-56 rounded-[1.5rem]" />
      </div>
    </div>
  )
}

export default function InsightsPage() {
  const { current, stale } = useWorkspace()
  const names = useCropNames()
  const [params, setParams] = useSearchParams()
  const asked = params.get('tab')
  const tab = INSIGHT_TABS.some((t) => t.id === asked) ? (asked as string) : 'climate'
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const go = (id: string) => setParams(id === 'climate' ? {} : { tab: id }, { replace: true })

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = INSIGHT_TABS.findIndex((t) => t.id === tab)
    const n = INSIGHT_TABS.length
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (next < 0) return
    e.preventDefault()
    go(INSIGHT_TABS[next].id)
    refs.current[INSIGHT_TABS[next].id]?.focus()
  }

  const header = (
    <PageHeader
      eyebrow="Field Intelligence"
      title="What the record says about your field"
      intro="Plain-language findings from this analysis: how local conditions have changed, when the soil is exposed, which rotations held up in hard years, and what the water and soil-care trade-offs are. Every statement is read from the engine’s output for this run."
      actions={
        current && (
          <>
            <ButtonRouterLink to="/app/scenarios" variant="secondary" icon={<FlaskConical />}>
              Scenario Lab
            </ButtonRouterLink>
            <ButtonRouterLink to="/app/brief" icon={<FileText />}>
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
        <AnalysisRequired what="Field Intelligence interprets a finished analysis, so run one first." />
      </div>
    )
  }

  const env = current.envelope
  const props = { env, names }
  return (
    <div className="space-y-5">
      {header}
      <RunSummary analysis={current} />
      {stale && (
        <Callout tone="warn" title="These findings are from your previous settings">
          You have changed the farm settings since this analysis ran. Rerun it from Farm Analysis to update what is shown here.
        </Callout>
      )}
      {isScenarioActive(env.request?.scenario) && <ScenarioDisclaimer />}

      <div
        role="tablist"
        aria-label="Field Intelligence sections"
        onKeyDown={onKey}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {INSIGHT_TABS.map((t) => {
          const on = t.id === tab
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el
              }}
              type="button"
              role="tab"
              id={`insight-tab-${t.id}`}
              aria-selected={on}
              aria-controls="insight-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => go(t.id)}
              className={cx(
                'relative flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-3 text-[0.9375rem] font-bold whitespace-nowrap transition-colors',
                on ? 'text-forest-950' : 'text-muted hover:text-forest-950',
              )}
            >
              <t.icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
              <span aria-hidden="true" className={cx('absolute inset-x-2 -bottom-px h-[3px] rounded-full transition-colors', on ? 'bg-forest-950' : 'bg-transparent')} />
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id="insight-panel" aria-labelledby={`insight-tab-${tab}`} key={`${tab}-${env.analysis_id ?? current.id}`} className="animate-fade min-w-0">
        <ErrorBoundary label="This section">
          <Suspense fallback={<SectionFallback />}>
            {tab === 'climate' && <ClimateInsights {...props} />}
            {tab === 'season' && <SeasonalExposure {...props} />}
            {tab === 'resilience' && <RotationResilience {...props} />}
            {tab === 'water' && <WaterResilience {...props} />}
            {tab === 'soil' && <SoilCare {...props} />}
            {tab === 'location' && <GeoContext {...props} />}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
