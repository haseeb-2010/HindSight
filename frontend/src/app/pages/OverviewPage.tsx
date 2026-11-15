import { ArrowRight, BarChart3, FolderClock, MapPin, SlidersHorizontal, Sprout } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ButtonRouterLink } from '../../components/ui/Button'
import { Mascot } from '../../components/ui/Mascot'
import { topAlternative, rotationLabel } from '../../lib/analysis'
import { fmtCoord } from '../../lib/format'
import { Card } from '../components/controls'
import { hasLocation } from '../lib/config'
import { useWorkspace } from '../state/workspace'

const JOURNEY = [
  { icon: MapPin, title: 'Locate your field', body: 'Pick a demonstration farm or place a marker on the map.' },
  { icon: Sprout, title: 'Describe the farm', body: 'Soil, water and the crops you grow now.' },
  { icon: SlidersHorizontal, title: 'Set what matters', body: 'Weigh stability, water, soil care and market.' },
  { icon: BarChart3, title: 'Compare rotations', body: 'See how each option would have fared, 1985–2024.' },
]

export function OverviewPage() {
  const { config, current, history, presets, selectPreset, openAnalysis, stale } = useWorkspace()
  const navigate = useNavigate()
  const located = hasLocation(config)

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-[linear-gradient(120deg,#e9edfb_0%,#f8f5ef_55%,#f6f6dc_100%)] p-6 ring-1 ring-white/70 ring-inset sm:p-9">
        <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_90%_at_80%_30%,black,transparent)]" />
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-2xl">
            <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Analysis workspace</p>
            <h1 className="mt-2 text-[2rem] leading-[1.06] tracking-[-0.03em] sm:text-[2.75rem]">
              See how your rotation would have fared, <span className="text-muted">and what else could work.</span>
            </h1>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink">
              HindSight replays your crop rotation and alternatives through four decades of daily weather for your location, then explains the trade-offs.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonRouterLink to={current ? '/app/analysis?step=results' : located ? '/app/analysis?step=review' : '/app/analysis'} size="lg" arrow>
                {current ? 'Open your results' : located ? 'Continue your analysis' : 'Start a farm analysis'}
              </ButtonRouterLink>
              {(current || located) && (
                <ButtonRouterLink to="/app/analysis?step=field" size="lg" variant="secondary">
                  Change field
                </ButtonRouterLink>
              )}
            </div>
            {current && stale && <p className="mt-3 text-[0.8125rem] font-bold text-signal-ink">Your settings have changed since the last run. Rerun the analysis to update the results.</p>}
          </div>
          <Mascot name="blue" decorative className="animate-float mx-auto hidden w-40 md:block" sizes="160px" />
        </div>
      </section>

      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {JOURNEY.map((j, i) => (
          <li key={j.title} className="flex gap-3.5 rounded-[1.5rem] bg-white p-4 ring-1 ring-border">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime">
              <j.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[1.0625rem] leading-tight">
                <span className="text-muted tabular-nums">{i + 1}.</span> {j.title}
              </h2>
              <p className="mt-1 text-[0.875rem] leading-snug text-ink">{j.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card as="section">
          <h2 className="text-[1.25rem]">Start from a demonstration farm</h2>
          <p className="mt-1 text-[0.9375rem] text-muted">Each one fills in its own soil, water and rotation. You can edit everything afterwards.</p>
          <ul className="mt-4 space-y-2">
            {presets.status === 'loading' && [0, 1, 2].map((i) => <li key={i} className="skeleton h-16 rounded-2xl" aria-hidden="true" />)}
            {presets.status === 'error' && <li className="text-[0.9375rem] font-semibold text-signal-ink">The demonstration farms could not be loaded. {presets.error}</li>}
            {presets.data?.presets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectPreset(p)
                    navigate('/app/analysis?step=field')
                  }}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-sand/60 px-4 py-3 text-left transition-colors hover:bg-sand"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-forest-950">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[1.0625rem] leading-tight font-semibold text-forest-950">
                      {p.display.place}
                      {p.display.country ? `, ${p.display.country}` : ''}
                    </span>
                    <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                      {p.water_label} · {p.rotation_name} · {fmtCoord(p.lat, p.lon)}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-forest-950 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1.25rem]">Recent analyses</h2>
            {history.length > 0 && (
              <Link to="/app/analyses" className="text-[0.875rem] font-bold text-forest-950 underline decoration-sage underline-offset-2 hover:decoration-forest-950">
                View all
              </Link>
            )}
          </div>
          <p className="mt-1 text-[0.9375rem] text-muted">Kept in this browser tab only. Download the JSON or CSV to keep a result.</p>
          {history.length === 0 ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-sand/50 p-4">
              <FolderClock className="h-6 w-6 shrink-0 text-muted" aria-hidden="true" />
              <p className="text-[0.9375rem] text-ink">Nothing here yet. Your analyses appear after you run one.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {history.slice(0, 3).map((a) => {
                const top = topAlternative(a.envelope.result)
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        openAnalysis(a.id)
                        navigate('/app/analysis?step=results')
                      }}
                      className="group flex w-full items-center gap-3 rounded-2xl bg-sand/60 px-4 py-3 text-left transition-colors hover:bg-sand"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[1.0625rem] leading-tight font-semibold text-forest-950">{a.name}</span>
                        <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                          {new Date(a.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          {top ? ` · top alternative: ${rotationLabel(top)}` : ''}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-forest-950 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
