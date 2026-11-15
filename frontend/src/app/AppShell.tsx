import { ArrowLeft, BookOpenText, FileText, FlaskConical, FolderClock, LayoutDashboard, LifeBuoy, Lightbulb, MapPin, PlayCircle, Sprout } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../components/brand/Logo'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { cx } from '../lib/cx'
import { hasLocation } from './lib/config'
import { useWorkspace } from './state/workspace'

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/analysis', label: 'Farm Analysis', icon: Sprout, end: false },
  { to: '/app/insights', label: 'Field Intelligence', icon: Lightbulb, end: false },
  { to: '/app/scenarios', label: 'Scenario Lab', icon: FlaskConical, end: false },
  { to: '/app/brief', label: 'Decision Brief', icon: FileText, end: false },
  { to: '/app/analyses', label: 'My Analyses', icon: FolderClock, end: false },
  { to: '/app/science', label: 'Science', icon: BookOpenText, end: false },
  { to: '/app/help', label: 'Help', icon: LifeBuoy, end: false },
]

export function AppShell() {
  const { config, history } = useWorkspace()
  const { pathname } = useLocation()
  const farm = hasLocation(config) ? config.location.name.trim() || `${config.location.lat?.toFixed(2)}, ${config.location.lon?.toFixed(2)}` : null

  useEffect(() => {
    document.title = 'HindSight — Farm analysis workspace'
    return () => {
      document.title = 'HindSight — Climate-aware crop rotation from NASA Earth data'
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#workspace-main"
        className="sr-only rounded-full bg-forest-950 px-4 py-2 font-bold text-cream-50 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-forest-950/[0.07] bg-cream-50/90 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-[92rem] items-center gap-3 px-4 sm:px-6">
          <Link to="/app" aria-label="HindSight workspace overview" className="shrink-0 rounded-lg">
            <Logo wordmarkClassName="text-[1.25rem]" markClassName="h-6 w-6" />
          </Link>
          <span className="hidden h-6 w-px bg-border-strong sm:block" aria-hidden="true" />
          <p className="hidden text-[0.8125rem] font-bold text-muted sm:block">Analysis workspace</p>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {farm && (
              <Link
                to="/app/analysis"
                title={`Selected field: ${farm}`}
                className="flex min-w-0 max-w-[11rem] items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-[0.8125rem] font-extrabold text-forest-950 transition-colors hover:bg-[#e9e3d6] sm:max-w-[16rem]"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{farm}</span>
              </Link>
            )}
            <Link
              to="/app/demo"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-[0.8125rem] font-extrabold text-forest-950 transition-colors hover:bg-[#f3f79e]"
            >
              <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Guided tour</span>
              <span className="sm:hidden">Tour</span>
            </Link>
            <Link
              to="/"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-white px-3 py-1.5 text-[0.8125rem] font-bold text-forest-950 transition-colors hover:border-forest-950/40"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Home</span>
              <span className="sr-only sm:hidden">Home</span>
            </Link>
          </div>
        </div>

        {/* Section navigation: scrolls sideways on narrow screens */}
        <nav aria-label="Workspace" className="border-t border-forest-950/[0.06]">
          <ul className="mx-auto flex max-w-[92rem] gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
            {NAV.map((n) => (
              <li key={n.to} className="shrink-0">
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.8125rem] font-bold whitespace-nowrap transition-colors',
                      isActive ? 'bg-forest-950 text-cream-50' : 'text-forest-950/75 hover:bg-forest-950/[0.06]',
                    )
                  }
                >
                  <n.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {n.label}
                  {n.to === '/app/analyses' && history.length > 0 && (
                    <span className="rounded-full bg-lime px-1.5 text-[0.6875rem] leading-5 font-extrabold text-forest-950 tabular-nums">{history.length}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="workspace-main" className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        <ErrorBoundary key={pathname} label="Workspace page">
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="border-t border-forest-950/[0.07] print:hidden">
        <div className="mx-auto flex max-w-[92rem] flex-col gap-1 px-4 py-4 text-[0.75rem] leading-snug text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>HindSight is an experimental decision-support tool. Results are historical model simulations, not yield forecasts or guarantees.</p>
          <p className="shrink-0">Weather: NASA POWER · Soil: ISRIC SoilGrids · Map: © OpenStreetMap contributors</p>
        </div>
      </footer>
    </div>
  )
}
