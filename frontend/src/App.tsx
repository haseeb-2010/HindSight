import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Logo } from './components/brand/Logo'
import { HomePage } from './pages/HomePage'

// The workspace (map, charts, forms) is a separate bundle so the homepage paints fast.
const loadAppRoutes = () => import('./app/AppRoutes')
const AppRoutes = lazy(loadAppRoutes)

// Once the homepage is idle, fetch the workspace bundle in the background so
// "Explore Your Field" opens without a wait. Skipped when the visitor asked to save data.
if (typeof window !== 'undefined') {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  if (!saveData) {
    const warm = () => void loadAppRoutes().catch(() => {})
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    window.addEventListener('load', () => (idle ? idle(warm, { timeout: 4000 }) : window.setTimeout(warm, 1500)), { once: true })
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">{children}</div>
}

function NotFound() {
  return (
    <Centered>
      <Logo />
      <h1 className="text-[2rem] leading-tight tracking-[-0.03em]">This page does not exist.</h1>
      <p className="max-w-sm text-muted">The address may be mistyped, or the page may have moved.</p>
      <Link to="/" className="rounded-full bg-forest-950 px-6 py-3 font-bold text-cream-50 transition-colors hover:bg-forest-900">
        Back to the homepage
      </Link>
    </Centered>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/app/*"
        element={
          <Suspense
            fallback={
              <Centered>
                <Logo />
                <p role="status" className="text-sm font-bold text-muted">
                  Opening the workspace…
                </p>
              </Centered>
            }
          >
            <AppRoutes />
          </Suspense>
        }
      />
      {/* Short addresses for the main Phase 03 experiences */}
      <Route path="/insights" element={<Navigate to="/app/insights" replace />} />
      <Route path="/scenarios" element={<Navigate to="/app/scenarios" replace />} />
      <Route path="/decision-brief" element={<Navigate to="/app/brief" replace />} />
      <Route path="/science" element={<Navigate to="/app/science" replace />} />
      <Route path="/demo" element={<Navigate to="/app/demo" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
