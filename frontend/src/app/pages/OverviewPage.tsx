import {
  ArrowRight,
  BookOpenText,
  CalendarRange,
  CloudSun,
  Droplets,
  FileText,
  FlaskConical,
  FolderClock,
  Layers,
  LifeBuoy,
  MapPin,
  MapPinned,
  Play,
  PlayCircle,
  Scale,
  Sparkles,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DASHBOARD_TOUR, DashboardTour, resumeStep, shouldAutoStart, writeTour } from '../../components/dashboard-tour'
import { ButtonRouterLink } from '../../components/ui/Button'
import { Mascot } from '../../components/ui/Mascot'
import { currentRotation, rankedRotations, rotationLabel, topAlternative } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord, fmtIndex, fmtNum, isNum } from '../../lib/format'
import { ScenarioChip, SourceBadge } from '../components/SourceBadge'
import { hasLocation } from '../lib/config'
import { readShift } from '../lib/insights'
import { PRIORITIES, PRIORITY_ORDER, textureLabel, waterLabel } from '../lib/labels'
import { matchingTemplate } from '../lib/priorityTemplates'
import { RunProgress } from '../results/RunProgress'
import { Chip } from '../results/shared'
import { useCropNames } from '../state/useCropNames'
import { useWorkspace } from '../state/workspace'

const MORE: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/app/insights?tab=season', icon: CalendarRange, label: 'Seasonal exposure' },
  { to: '/app/insights?tab=water', icon: Droplets, label: 'Water resilience' },
  { to: '/app/insights?tab=soil', icon: Layers, label: 'Soil-care opportunities' },
  { to: '/app/insights?tab=location', icon: MapPinned, label: 'Location & data' },
  { to: '/app/science', icon: BookOpenText, label: 'The science' },
  { to: '/app/help', icon: LifeBuoy, label: 'Help' },
]

/** One block of the dashboard. `tour` is the name the dashboard tour uses to find it. */
function DashCard({ tour, icon: Icon, title, to, cta, children, className }: { tour: string; icon: LucideIcon; title: string; to: string; cta: string; children: ReactNode; className?: string }) {
  return (
    <section data-tour={tour} className={cx('flex min-w-0 flex-col rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6', className)}>
      <h2 className="flex items-center gap-2.5 text-[1.1875rem] leading-tight">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-forest-950 ring-1 ring-forest-950/10">
          <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        {title}
      </h2>
      <div className="mt-3.5 min-w-0 flex-1 text-[0.9375rem] leading-snug text-ink">{children}</div>
      <Link
        to={to}
        className="group mt-4 inline-flex items-center gap-1.5 self-start rounded-full text-[0.9375rem] font-extrabold text-forest-950 underline decoration-sage decoration-2 underline-offset-4 transition-colors hover:decoration-forest-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-950"
      >
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </section>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-ink">{children}</p>

export function OverviewPage() {
  const { config, current, history, presets, selectPreset, analysePreset, openAnalysis, stale, run, cancelRun, defaultPriorities } = useWorkspace()
  const names = useCropNames()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const located = hasLocation(config)
  const preset = presets.data?.presets.find((p) => p.id === config.location.preset_id)
  const env = current?.envelope
  const res = env?.result
  const cur = res ? currentRotation(res) : undefined
  const top = res ? topAlternative(res) : undefined
  const ranked = res ? rankedRotations(res) : []

  /* ---- first-visit tour: starts once the dashboard has its data and nothing is running */
  const replay = params.get('tour') === '1'
  const ready = presets.status === 'ready' && run.status === 'idle'
  const [tour, setTour] = useState({ open: false, startAt: 0 })
  useEffect(() => {
    if (!ready || tour.open || (!replay && !shouldAutoStart())) return
    new Image().src = '/mascots/mascot-blue.webp' // have the guide's artwork ready before it steps in
    const t = window.setTimeout(() => setTour({ open: true, startAt: replay ? 0 : resumeStep(DASHBOARD_TOUR.length) }), 450)
    return () => window.clearTimeout(t)
  }, [ready, replay, tour.open])
  const onTourStep = useCallback((i: number) => writeTour('in_progress', i), [])
  const onTourFinish = useCallback((outcome: 'completed' | 'skipped', step: number) => writeTour(outcome, step), [])
  const onTourClosed = useCallback(() => {
    setTour({ open: false, startAt: 0 })
    if (replay) setParams({}, { replace: true })
  }, [replay, setParams])

  /* ---- values for the cards, all read from the workspace and the open analysis */
  const weights = Object.fromEntries(PRIORITY_ORDER.map((k) => [k, config.priorities[k] ?? defaultPriorities[k] ?? 0]))
  const template = presets.status === 'ready' ? matchingTemplate(weights, defaultPriorities) : null
  const shifts = [...(res?.climate_shift ?? [])]
    .map((s) => ({ s, r: readShift(s) }))
    .sort((a, b) => Number(b.r.evidence === 'consistent') - Number(a.r.evidence === 'consistent') || Number(b.r.direction !== 'little') - Number(a.r.direction !== 'little'))
    .slice(0, 3)
  const shownRotations = ranked.length > 4 && cur && (cur.scores?.rank ?? 0) > 3 ? [...ranked.slice(0, 3), cur] : ranked.slice(0, 4)
  const rotationText = cur ? rotationLabel(cur) : (preset?.rotation_name ?? config.rotation.slots.map((s) => names[s.crop_id] ?? s.crop_id).join(' → '))
  const fieldName = config.location.name.trim() || (located ? fmtCoord(config.location.lat as number, config.location.lon as number) : '')

  return (
    <div className="space-y-5">
      <section
        data-tour="dashboard-welcome"
        className="relative isolate overflow-hidden rounded-[1.75rem] bg-[linear-gradient(120deg,#e9edfb_0%,#f8f5ef_55%,#f6f6dc_100%)] p-6 ring-1 ring-white/70 ring-inset sm:p-8"
      >
        <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_90%_at_80%_30%,black,transparent)]" />
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-2xl">
            <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Your dashboard</p>
            <h1 className="mt-2 text-[1.875rem] leading-[1.06] tracking-[-0.03em] sm:text-[2.5rem]">
              See how your rotation would have fared, <span className="text-muted">and what else could work.</span>
            </h1>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink">
              HindSight replays your crop rotation and alternatives through four decades of daily weather for your location, then explains the trade-offs.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <ButtonRouterLink to={current ? '/app/analysis?step=results' : located ? '/app/analysis?step=review' : '/app/analysis'} size="lg" arrow>
                {current ? 'Open your results' : located ? 'Continue your analysis' : 'Start a farm analysis'}
              </ButtonRouterLink>
              <ButtonRouterLink to="/app/demo" size="lg" variant="secondary" icon={<PlayCircle />}>
                Guided Tour
              </ButtonRouterLink>
              <button
                type="button"
                data-tour-replay
                onClick={() => setTour({ open: true, startAt: 0 })}
                className="inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-[0.9375rem] font-extrabold text-forest-950 underline decoration-sage decoration-2 underline-offset-4 transition-colors hover:decoration-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Take a tour
              </button>
            </div>
            {current && stale && <p className="mt-3 text-[0.8125rem] font-bold text-signal-ink">Your settings have changed since the last run. Rerun the analysis to update what is shown below.</p>}
          </div>
          {/* while the tour runs, the mascot has stepped off its perch to show the user around */}
          <Mascot name="blue" decorative className={cx('animate-float mx-auto hidden w-36 transition-opacity duration-300 md:block', tour.open && 'opacity-0')} sizes="144px" />
        </div>
      </section>

      {/* ---- your field */}
      <section data-tour="dashboard-overview" aria-labelledby="field-title" className="rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6">
        {run.status !== 'idle' ? (
          <RunProgress run={run} onRetry={() => (preset ? void analysePreset(preset) : navigate('/app/analysis?step=review'))} onCancel={cancelRun} />
        ) : located ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
            <div className="min-w-0">
              <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Your field</p>
              <h2 id="field-title" className="mt-1 flex items-center gap-2.5 text-[1.5rem] leading-tight tracking-[-0.02em]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate">{fieldName}</span>
              </h2>
              <p className="mt-1.5 text-[0.9375rem] font-semibold text-muted tabular-nums">
                {preset ? `${[preset.display.region, preset.display.country].filter(Boolean).join(', ')} · ` : ''}
                {fmtCoord(config.location.lat as number, config.location.lon as number)}
                {preset ? ' · demonstration farm' : ''}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Farm settings">
                <li>
                  <Chip>{waterLabel(config.water.mode, config.water.mode === 'limited' ? config.water.seasonal_cap_mm : null)}</Chip>
                </li>
                <li>
                  <Chip>
                    {config.soil.source === 'soilgrids' ? 'Soil: SoilGrids estimate' : `Soil: ${textureLabel(config.soil.texture_class)}`}, {config.soil.depth_cm} cm
                  </Chip>
                </li>
                {env && (
                  <li>
                    <SourceBadge env={env} detail={false} />
                  </li>
                )}
                {env && (
                  <li>
                    <ScenarioChip env={env} />
                  </li>
                )}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonRouterLink to={current ? (stale ? '/app/analysis?step=review' : '/app/analysis?step=results') : '/app/analysis?step=review'} arrow>
                  {current ? (stale ? 'Review and rerun' : 'Open results') : 'Review and run'}
                </ButtonRouterLink>
                <ButtonRouterLink to="/app/analysis?step=field" variant="secondary">
                  Change field
                </ButtonRouterLink>
              </div>
            </div>
            <dl className="grid content-start gap-x-6 gap-y-3 border-t border-border pt-4 text-[0.9375rem] sm:grid-cols-2 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[0.8125rem] font-bold text-muted">Current rotation</dt>
                <dd className="mt-0.5 font-semibold text-forest-950">{rotationText || 'Not entered yet'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.8125rem] font-bold text-muted">Last analysis</dt>
                <dd className="mt-0.5 font-semibold text-forest-950">
                  {current ? new Date(current.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not analysed yet'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.8125rem] font-bold text-muted">Historical period</dt>
                <dd className="mt-0.5 font-semibold text-forest-950 tabular-nums">
                  {res ? `${res.meta.record.start_year}–${res.meta.record.end_year}` : presets.data ? `${presets.data.hindcast.start_year}–${presets.data.hindcast.end_year}` : '—'}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[0.8125rem] font-bold text-muted">Data HindSight uses here</dt>
                <dd className="mt-0.5 text-[0.875rem] leading-snug text-ink">
                  Daily weather from NASA POWER for the grid cell that contains this point (about 50 km wide), your soil and water description, and your crop rotation.
                  {res?.validation?.ndvi_check ? ' A MODIS NDVI check was run for this analysis.' : ''}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div>
            <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Your field</p>
            <h2 id="field-title" className="mt-1 text-[1.5rem] leading-tight tracking-[-0.02em]">
              No field selected yet
            </h2>
            <p className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink">
              Analyse a demonstration farm with one click (a real engine run on stored NASA POWER weather, a few seconds), or set up your own field step by step.
            </p>
            <ul className="mt-4 grid gap-2.5 md:grid-cols-3">
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
                        {p.water_label} · {p.rotation_name}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonRouterLink to="/app/analysis" variant="secondary" icon={<MapPin />}>
                Set up your own field
              </ButtonRouterLink>
              {presets.data?.presets[0] && (
                <button
                  type="button"
                  onClick={() => {
                    selectPreset(presets.data.presets[0])
                    navigate('/app/analysis?step=field')
                  }}
                  className="rounded-full px-3 text-[0.875rem] font-bold text-muted underline decoration-sand-400 underline-offset-4 hover:text-forest-950"
                >
                  or walk through a demonstration farm’s settings first
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ---- what the analysis found, and what shapes it */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DashCard tour="climate-insights" icon={CloudSun} title="Climate patterns" to="/app/insights?tab=climate" cta="Explore climate patterns">
          {shifts.length > 0 && res ? (
            <>
              <p className="text-[0.8125rem] font-bold text-muted tabular-nums">
                {res.meta.windows?.early?.join('–') ?? 'Earlier period'} compared with {res.meta.windows?.late?.join('–') ?? 'later period'}
              </p>
              <ul className="mt-2 divide-y divide-border">
                {shifts.map(({ s, r }) => (
                  <li key={s.id} className="py-2.5">
                    <p className="font-bold text-forest-950">{s.label}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem] tabular-nums">
                      <span>
                        {isNum(s.early) ? fmtNum(s.early, s.unit === 'mm' ? 0 : 1) : '—'} → {isNum(s.late) ? fmtNum(s.late, s.unit === 'mm' ? 0 : 1) : '—'} {s.unit} a year
                      </span>
                      <Chip tone={r.direction === 'little' ? 'white' : 'sand'}>{r.label}</Chip>
                    </p>
                    {r.direction !== 'little' && r.evidence === 'limited' && <p className="mt-0.5 text-[0.75rem] text-muted">Statistical evidence is limited.</p>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty>How rainfall, reference evapotranspiration, hot days, frost days and heavy-rain days differ between 1985–2004 and 2005–2024 at your location, from NASA POWER.</Empty>
          )}
        </DashCard>

        <DashCard tour="rotation-comparison" icon={Sprout} title="Rotation comparison" to={current ? '/app/analysis?step=results&tab=compare' : '/app/analysis'} cta={current ? 'Compare rotations' : 'Run an analysis to compare'}>
          {shownRotations.length > 0 ? (
            <>
              <p className="text-[0.8125rem] font-bold text-muted">Ranked by your priorities, relative to the rotations in this analysis</p>
              <ol className="mt-2 space-y-1.5">
                {shownRotations.map((r) => (
                  <li key={r.id} className={cx('flex items-center gap-2.5 rounded-xl px-2.5 py-2', r.is_current ? 'bg-peri-50 ring-1 ring-peri' : 'bg-sand/60')}>
                    <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-white px-1 font-display text-[0.8125rem] font-semibold text-forest-950 tabular-nums ring-1 ring-border">
                      #{r.scores?.rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-bold text-forest-950" title={rotationLabel(r)}>
                        {rotationLabel(r)}
                      </span>
                      <span className="block text-[0.75rem] font-semibold text-ink tabular-nums">
                        {r.is_current ? 'Your current rotation · ' : ''}lower-decile index {fmtIndex(r.hindcast.p10)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              {top && cur && (
                <p className="mt-2.5 text-[0.8125rem] text-muted">
                  Highest-ranked alternative: {rotationLabel(top)}. See its trade-offs under{' '}
                  <Link to="/app/insights?tab=resilience" className="font-bold text-forest-950 underline decoration-sage underline-offset-2">
                    Rotation resilience
                  </Link>
                  .
                </p>
              )}
            </>
          ) : (
            <Empty>Your current rotation next to alternative strategies: how each would have fared in weak years, how much water it needs and how well it covers the soil.</Empty>
          )}
        </DashCard>

        <DashCard tour="farmer-priorities" icon={Scale} title="Your priorities" to="/app/analysis?step=priorities" cta="Adjust priorities">
          <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-bold text-muted">
            What the ranking weighs, from 0 to 5
            {presets.status === 'ready' && <Chip tone={template ? 'lime' : 'white'}>{template ? template.label : 'Custom weights'}</Chip>}
          </p>
          <ul className="mt-2.5 space-y-2">
            {PRIORITY_ORDER.map((k) => (
              <li key={k} className="grid grid-cols-[6.75rem_minmax(0,1fr)_1.25rem] items-center gap-2.5 text-[0.8125rem]">
                <span className="truncate font-bold text-forest-950">{PRIORITIES[k].short}</span>
                <span className="h-2 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                  <span className="bar-grow-x block h-full rounded-full bg-forest-800" style={{ width: `${(weights[k] / 5) * 100}%` }} />
                </span>
                <span className="text-right font-display font-semibold text-forest-950 tabular-nums">{weights[k]}</span>
              </li>
            ))}
          </ul>
        </DashCard>
      </div>

      {/* ---- go further */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DashCard tour="scenario-lab" icon={FlaskConical} title="Scenario Lab" to="/app/scenarios" cta="Open the Scenario Lab">
          <p>Re-run the engine on a warmer or drier version of the historical weather record and see whether the ranking of rotations holds.</p>
          <p className="mt-3">
            <Chip tone="signal">Historical what-if scenarios, not forecasts.</Chip>
          </p>
        </DashCard>

        <DashCard tour="decision-brief" icon={FileText} title="Decision Brief" to="/app/brief" cta="Open the Decision Brief">
          <p>The evidence, the trade-offs, the limitations and a local verification checklist in one report. Print it, save it as a PDF, or export the comparison as CSV and the analysis as JSON.</p>
        </DashCard>

        <section className="flex min-w-0 flex-col rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-[1.1875rem] leading-tight">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-forest-950 ring-1 ring-forest-950/10">
                <FolderClock className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
              </span>
              My Analyses
            </h2>
            {history.length > 0 && (
              <Link to="/app/analyses" className="text-[0.875rem] font-bold text-forest-950 underline decoration-sage underline-offset-2 hover:decoration-forest-950">
                View all {history.length}
              </Link>
            )}
          </div>
          <p className="mt-3 text-[0.8125rem] font-bold text-muted">Saved on this device, not on a server.</p>
          {history.length === 0 ? (
            <p className="mt-2 text-[0.9375rem] text-ink">Nothing here yet. Each analysis you run is kept here so you can reopen, compare and export it.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {history.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      openAnalysis(a.id)
                      navigate('/app/analysis?step=results')
                    }}
                    className="group flex w-full items-center gap-3 rounded-xl bg-sand/60 px-3 py-2 text-left transition-colors hover:bg-sand"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-bold text-forest-950">{a.name}</span>
                      <span className="block truncate text-[0.75rem] font-semibold text-ink">{new Date(a.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-forest-950 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <nav aria-label="More in the workspace">
        <ul className="flex flex-wrap gap-2">
          {MORE.map((m) => (
            <li key={m.to}>
              <Link
                to={m.to}
                className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-bold text-forest-950 ring-1 ring-border transition-colors hover:bg-sand/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950"
              >
                <m.icon className="h-4 w-4" aria-hidden="true" />
                {m.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <DashboardTour steps={DASHBOARD_TOUR} open={tour.open} startAt={tour.startAt} onFinish={onTourFinish} onClosed={onTourClosed} onStep={onTourStep} />
    </div>
  )
}
