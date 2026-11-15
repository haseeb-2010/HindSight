import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { AnalysesPage } from './pages/AnalysesPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { HelpPage } from './pages/HelpPage'
import { OverviewPage } from './pages/OverviewPage'
import { SciencePage } from './pages/SciencePage'
import { WorkspaceProvider } from './state/workspace'

export default function AppRoutes() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="analyses" element={<AnalysesPage />} />
          <Route path="science" element={<SciencePage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  )
}
