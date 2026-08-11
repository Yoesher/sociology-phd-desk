import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BookMarked } from 'lucide-react'
import { AppShell } from './app/AppShell'
import { WorkspaceProvider } from './app/WorkspaceContext'
import { useWorkspace } from './hooks/useWorkspace'

const TodayPage = lazy(() => import('./features/today/TodayPage').then((module) => ({ default: module.TodayPage })))
const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage').then((module) => ({ default: module.ProjectsPage })))
const LiteraturePage = lazy(() => import('./features/literature/LiteraturePage').then((module) => ({ default: module.LiteraturePage })))
const FieldworkPage = lazy(() => import('./features/fieldwork/FieldworkPage').then((module) => ({ default: module.FieldworkPage })))
const QuantitativePage = lazy(() => import('./features/quantitative/QuantitativePage').then((module) => ({ default: module.QuantitativePage })))
const EvidencePage = lazy(() => import('./features/evidence/EvidencePage').then((module) => ({ default: module.EvidencePage })))
const ResearchLogPage = lazy(() => import('./features/research-log/ResearchLogPage').then((module) => ({ default: module.ResearchLogPage })))
const ManuscriptsPage = lazy(() => import('./features/manuscripts/ManuscriptsPage').then((module) => ({ default: module.ManuscriptsPage })))
const SubmissionsPage = lazy(() => import('./features/submissions/SubmissionsPage').then((module) => ({ default: module.SubmissionsPage })))

function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="route-loading" aria-label="Opening module">
          <div className="route-loading__title" />
          <div className="route-loading__summary" />
          <div className="route-loading__grid"><i /><i /><i /><i /></div>
          <div className="route-loading__panel" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function WorkspaceGate() {
  const { loading, data, error } = useWorkspace()

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="boot-screen__mark"><BookMarked size={25} /></span>
        <p className="eyebrow">Sociology PhD Desk</p>
        <h1>Opening the local workspace</h1>
        <span className="boot-screen__progress" aria-label="Loading"><i /></span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="boot-screen boot-screen--error">
        <span className="boot-screen__mark"><BookMarked size={25} /></span>
        <p className="eyebrow">Local workspace unavailable</p>
        <h1>Research data could not be opened</h1>
        <p>{error || 'Reload the page to try initializing the browser database again.'}</p>
        <button className="button button--primary button--md" type="button" onClick={() => window.location.reload()}>
          <span>Reload workspace</span>
        </button>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<RouteBoundary><TodayPage /></RouteBoundary>} />
          <Route path="projects" element={<RouteBoundary><ProjectsPage /></RouteBoundary>} />
          <Route path="literature" element={<RouteBoundary><LiteraturePage /></RouteBoundary>} />
          <Route path="fieldwork" element={<RouteBoundary><FieldworkPage /></RouteBoundary>} />
          <Route path="quantitative" element={<RouteBoundary><QuantitativePage /></RouteBoundary>} />
          <Route path="evidence" element={<RouteBoundary><EvidencePage /></RouteBoundary>} />
          <Route path="research-log" element={<RouteBoundary><ResearchLogPage /></RouteBoundary>} />
          <Route path="manuscripts" element={<RouteBoundary><ManuscriptsPage /></RouteBoundary>} />
          <Route path="submissions" element={<RouteBoundary><SubmissionsPage /></RouteBoundary>} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

function App() {
  return (
    <WorkspaceProvider>
      <WorkspaceGate />
    </WorkspaceProvider>
  )
}

export default App
