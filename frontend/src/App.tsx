import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Logo } from './components/brand/Logo'
import { HomePage } from './pages/HomePage'

// The workspace (map, charts, forms) loads only when someone opens it.
const AppRoutes = lazy(() => import('./app/AppRoutes'))

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
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
