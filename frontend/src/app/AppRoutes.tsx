import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { AnalysesPage } from './pages/AnalysesPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { HelpPage } from './pages/HelpPage'
import { OverviewPage } from './pages/OverviewPage'
import { WorkspaceProvider } from './state/workspace'

// Phase 03 pages carry their own charts, so each loads when it is first visited.
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const ScenarioLabPage = lazy(() => import('./pages/ScenarioLabPage'))
const DecisionBriefPage = lazy(() => import('./pages/DecisionBriefPage'))
const DemoTourPage = lazy(() => import('./pages/DemoTourPage'))
const SciencePage = lazy(() => import('./pages/SciencePage'))

function PageFallback() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-5">
      <div className="skeleton h-10 w-2/3 max-w-2xl rounded-xl" />
      <div className="skeleton h-5 w-full max-w-3xl rounded-lg" />
      <div className="skeleton h-64 rounded-[1.5rem]" />
    </div>
  )
}

const page = (node: React.ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>

export default function AppRoutes() {
  return (
    <WorkspaceProvider>
      <Routes>
        {/* The guided tour has its own frame (progress, next/previous) instead of the workspace navigation. */}
        <Route path="demo" element={<Suspense fallback={<div className="p-8"><PageFallback /></div>}><DemoTourPage /></Suspense>} />
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="insights" element={page(<InsightsPage />)} />
          <Route path="scenarios" element={page(<ScenarioLabPage />)} />
          <Route path="brief" element={page(<DecisionBriefPage />)} />
          <Route path="analyses" element={<AnalysesPage />} />
          <Route path="science" element={page(<SciencePage />)} />
          <Route path="help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  )
}
