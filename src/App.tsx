import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { WorkspaceAccessGate } from './app/WorkspaceAccessGate'
import { WorkspaceCenter } from './app/WorkspaceCenter'
import { WorkspaceProvider } from './app/WorkspaceContext'
import { WorkspaceSessionProvider } from './app/WorkspaceSessionContext'
import { readMountableSnapshot } from './app/session-snapshot'
import type { OpenedLocalWorkspaceSession } from './db/localWorkspaceManager'
import { useWorkspaceSession } from './hooks/useWorkspaceSession'
import { I18nProvider, useI18n } from './i18n'
import { ENCRYPTED_CONTAINER_VERSION } from './crypto'
import type { WorkspaceData } from './models/domain'

const TodayPage = lazy(() => import('./features/today/TodayPage').then((module) => ({ default: module.TodayPage })))
const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage').then((module) => ({ default: module.ProjectsPage })))
const LiteraturePage = lazy(() => import('./features/literature/LiteraturePage').then((module) => ({ default: module.LiteraturePage })))
const TheoryPage = lazy(() => import('./features/theory/TheoryPage').then((module) => ({ default: module.TheoryPage })))
const FieldworkPage = lazy(() => import('./features/fieldwork/FieldworkPage').then((module) => ({ default: module.FieldworkPage })))
const QuantitativePage = lazy(() => import('./features/quantitative/QuantitativePage').then((module) => ({ default: module.QuantitativePage })))
const EvidencePage = lazy(() => import('./features/evidence/EvidencePage').then((module) => ({ default: module.EvidencePage })))
const ResearchLogPage = lazy(() => import('./features/research-log/ResearchLogPage').then((module) => ({ default: module.ResearchLogPage })))
const ManuscriptsPage = lazy(() => import('./features/manuscripts/ManuscriptsPage').then((module) => ({ default: module.ManuscriptsPage })))
const SubmissionsPage = lazy(() => import('./features/submissions/SubmissionsPage').then((module) => ({ default: module.SubmissionsPage })))

function RouteBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return (
    <Suspense
      fallback={
        <div className="route-loading" aria-label={t('route.openingModule')}>
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

function ResearchRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<RouteBoundary><TodayPage /></RouteBoundary>} />
          <Route path="projects" element={<RouteBoundary><ProjectsPage /></RouteBoundary>} />
          <Route path="literature" element={<RouteBoundary><LiteraturePage /></RouteBoundary>} />
          <Route path="theory" element={<RouteBoundary><TheoryPage /></RouteBoundary>} />
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

export function WorkspaceExperience() {
  const workspaceSession = useWorkspaceSession()
  const {
    accessState,
    activeWorkspace,
    activeWorkspaceId,
    busy,
    error,
    invalidateActiveSession,
    session,
    sessionGeneration,
    workspaces,
  } = workspaceSession
  const mountableSnapshot = readMountableSnapshot(session)
  const mountSnapshotRef = useRef<{
    session: OpenedLocalWorkspaceSession
    snapshot: WorkspaceData
  } | null>(null)
  if (!session) {
    mountSnapshotRef.current = null
  } else if (mountableSnapshot && mountSnapshotRef.current?.session !== session) {
    mountSnapshotRef.current = {
      session,
      snapshot: structuredClone(mountableSnapshot),
    }
  }
  const transitionSnapshot = session && accessState === 'locking' &&
    mountSnapshotRef.current?.session === session
    ? mountSnapshotRef.current.snapshot
    : null
  const providerSnapshot = mountableSnapshot ?? transitionSnapshot
  const sessionMountable = Boolean(session && mountableSnapshot)
  const renderedAccessState = accessState === 'unlocked' && !sessionMountable
    ? 'locking'
    : accessState

  useEffect(() => {
    if (
      session && !mountableSnapshot && accessState !== 'locking'
    ) invalidateActiveSession(
      session.entry.id,
      session.storageId,
      sessionGeneration,
    )
  }, [accessState, invalidateActiveSession, mountableSnapshot, session, sessionGeneration])

  const activeSessionOpen = Boolean(
    renderedAccessState === 'unlocked' && sessionMountable &&
    session && activeWorkspace && session.entry.id === activeWorkspace.id,
  )
  const sharedOriginWarning = window.location.hostname === 'yoesher.github.io'

  const workspaceCenter = (
    <WorkspaceCenter
      open={workspaceSession.workspaceCenterOpen}
      workspaces={workspaces}
      recoverableProvisioning={workspaceSession.recoverableProvisioning}
      pendingDeletions={workspaceSession.pendingDeletions}
      activeWorkspaceId={activeWorkspaceId}
      activeWorkspaceUnlocked={activeSessionOpen}
      initialSection={workspaceSession.workspaceCenterSection}
      busy={busy}
      error={error}
      encryptedContainerVersion={ENCRYPTED_CONTAINER_VERSION}
      sharedOriginWarning={sharedOriginWarning}
      onClose={workspaceSession.closeWorkspaceCenter}
      onSelect={workspaceSession.selectWorkspace}
      onCreate={workspaceSession.createWorkspace}
      onRecoverProvisioning={workspaceSession.recoverProvisioning}
      onDiscardProvisioning={workspaceSession.discardProvisioning}
      onRetryFinalizeDeletion={workspaceSession.retryFinalizeDeletion}
      onRename={workspaceSession.renameWorkspace}
      onDelete={workspaceSession.deleteWorkspace}
      onResetDemo={workspaceSession.resetDemoWorkspace}
      onAutoLockChange={workspaceSession.updateWorkspaceAutoLock}
      onConvertToEncrypted={
        activeWorkspace?.kind === 'personal' && activeWorkspace.encryptionMode === 'standard'
          ? workspaceSession.convertWorkspaceToEncrypted
          : undefined
      }
      onDiscardEncryptedConversion={workspaceSession.discardEncryptedConversion}
      onCleanupPlaintextSource={
        activeSessionOpen && session?.mode === 'encrypted'
          ? workspaceSession.cleanupPlaintextSource
          : undefined
      }
      onExportPlaintext={activeSessionOpen
        ? workspaceSession.exportPlaintextWorkspace
        : undefined}
      onExportEncrypted={
        activeSessionOpen && session?.mode === 'encrypted'
          ? workspaceSession.exportEncryptedWorkspace
          : undefined
      }
      onImportPlaintext={workspaceSession.importPlaintextWorkspaceFile}
      onImportEncrypted={workspaceSession.importEncryptedWorkspaceFile}
    />
  )

  const accessGate = (
    <WorkspaceAccessGate
      state={renderedAccessState}
      activeWorkspace={activeWorkspace}
      error={error}
      onOpenStandard={workspaceSession.openActiveStandard}
      onUnlockEncrypted={workspaceSession.unlockActiveEncrypted}
      onOpenWorkspacePicker={() => workspaceSession.openWorkspaceCenter('workspaces')}
      pickerContent={null}
    >
      <ResearchRoutes />
    </WorkspaceAccessGate>
  )

  return (
    <>
      {session && providerSnapshot ? (
        <WorkspaceProvider
          key={`${session.entry.id}:${session.storageId}:${sessionGeneration}`}
          repository={session.repository}
          initialSnapshot={providerSnapshot}
          workspaceId={session.entry.id}
          storageId={session.storageId}
          onExternalLock={() => invalidateActiveSession(
            session.entry.id,
            session.storageId,
            sessionGeneration,
          )}
          onResetDemo={() => workspaceSession.resetDemoWorkspace(session.entry.id)}
          registerRuntime={workspaceSession.registerResearchRuntime}
        >
          {accessGate}
        </WorkspaceProvider>
      ) : accessGate}
      {workspaceCenter}
    </>
  )
}

function App() {
  return (
    <I18nProvider>
      <WorkspaceSessionProvider>
        <WorkspaceExperience />
      </WorkspaceSessionProvider>
    </I18nProvider>
  )
}

export default App
