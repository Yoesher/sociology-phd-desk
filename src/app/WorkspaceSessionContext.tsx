import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  LocalWorkspaceManager,
  LocalWorkspaceManagerError,
  type OpenedLocalWorkspaceSession,
} from '../db/localWorkspaceManager'
import {
  EncryptedContainerAuthenticationError,
  EncryptedContainerFormatError,
  EncryptedPayloadValidationError,
  WebCryptoUnavailableError,
} from '../crypto'
import { useAutoLock } from '../hooks/useAutoLock'
import type { WorkspaceData } from '../models/domain'
import type {
  WorkspaceAutoLock,
  WorkspaceRegistryEntry,
} from '../models/workspace-registry'
import { exportWorkspaceJson } from '../utils/workspace-transfer'
import {
  preflightEncryptedWorkspaceFile,
  preflightPortableWorkspaceFile,
  readGuardedText,
  MAX_ENCRYPTED_BACKUP_FILE_BYTES,
} from '../utils/import-preflight'
import { downloadTextFile, todayIso } from './format'
import type {
  WorkspaceCenterSection,
  WorkspaceCreateRequest,
  WorkspaceEncryptedImportRequest,
} from './WorkspaceCenter'
import type {
  WorkspaceUiErrorCode,
  WorkspaceUiErrorDescriptor,
  WorkspaceUiOperation,
} from './WorkspaceAccessGate'
import {
  WorkspaceSessionContext,
  type WorkspaceResearchRuntimeControl,
} from './workspace-session-context'
import {
  createWorkspaceSessionChannel,
  isWorkspaceSessionMessage,
  type WorkspaceSessionChannel,
  type WorkspaceSessionChannelFactory,
  type WorkspaceSessionMessage,
} from './workspace-session-channel'

const STANDARD_LOCK_MARKER_PREFIX = 'sociology-phd-desk:standard-ui-lock:v1'
const ENCRYPTED_BACKUP_MIME = 'application/vnd.sociology-phd-desk.encrypted+json'

export type WorkspaceSessionManager = Pick<
  LocalWorkspaceManager,
  | 'bootstrap'
  | 'list'
  | 'listRecoverableProvisioning'
  | 'listPendingDeletions'
  | 'get'
  | 'setActive'
  | 'openStandard'
  | 'unlockEncrypted'
  | 'createStandard'
  | 'createEncrypted'
  | 'recoverProvisioning'
  | 'discardProvisioning'
  | 'retryFinalizeDeletion'
  | 'importPlaintextWorkspace'
  | 'restoreEncryptedBackup'
  | 'convertStandardToEncrypted'
  | 'discardEncryptedConversion'
  | 'rename'
  | 'updateAutoLock'
  | 'markExportGenerated'
  | 'resetDemo'
  | 'cleanupPlaintextSource'
  | 'delete'
  | 'close'
>

export interface WorkspaceSessionProviderProps {
  children: ReactNode
  managerFactory?: () => WorkspaceSessionManager
  channelFactory?: WorkspaceSessionChannelFactory
  lockingStorage?: LockingStorage | null
}

const defaultManagerFactory = () => new LocalWorkspaceManager()

type LockingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const inaccessibleSessionStorage: LockingStorage = {
  getItem: () => { throw new Error('Session storage is unavailable.') },
  setItem: () => { throw new Error('Session storage is unavailable.') },
  removeItem: () => { throw new Error('Session storage is unavailable.') },
}

function browserSessionStorage(): LockingStorage | null {
  try {
    return window.sessionStorage
  } catch {
    return inaccessibleSessionStorage
  }
}

function safelyReadLockMarker(storage: LockingStorage | null, key: string) {
  if (!storage) return { ok: true as const, value: null }
  try {
    return { ok: true as const, value: storage.getItem(key) }
  } catch {
    return { ok: false as const, value: null }
  }
}

function safelyWriteLockMarker(storage: LockingStorage | null, key: string) {
  if (!storage) return true
  try {
    storage.setItem(key, 'locked')
    return true
  } catch {
    return false
  }
}

function safelyRemoveLockMarker(storage: LockingStorage | null, key: string) {
  if (!storage) return true
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function lockMarkerUnavailableError() {
  return new LocalWorkspaceManagerError(
    'storage-operation-failed',
    'The standard workspace lock marker is unavailable.',
  )
}

function standardWorkspaceLockMarker(entry: WorkspaceRegistryEntry): string {
  return `${STANDARD_LOCK_MARKER_PREFIX}:${entry.id}:${entry.storageId}`
}

function managerCode(error: unknown): string | undefined {
  return error instanceof LocalWorkspaceManagerError ? error.code : undefined
}

function safeWorkspaceError(
  error: unknown,
  operation: WorkspaceUiOperation,
): WorkspaceUiErrorDescriptor {
  const code = managerCode(error)
  let uiCode: WorkspaceUiErrorCode

  switch (code) {
    case 'bootstrap-failed':
      uiCode = 'registry-unavailable'
      break
    case 'workspace-not-found':
    case 'workspace-not-ready':
    case 'workspace-mode-mismatch':
    case 'manager-closed':
    case 'provisioning-not-found':
      uiCode = 'workspace-unavailable'
      break
    case 'revision-conflict':
      uiCode = 'workspace-conflict'
      break
    case 'authentication-failed':
      uiCode = operation === 'delete'
        ? 'discard-authentication-failed'
        : operation === 'import'
          ? 'invalid-encrypted-backup'
          : 'unlock-failed'
      break
    case 'provisioning-passphrase-required':
      uiCode = operation === 'delete'
        ? 'discard-passphrase-required'
        : operation === 'import'
          ? 'invalid-encrypted-backup'
          : 'unlock-failed'
      break
    case 'encrypted-payload-invalid':
      uiCode = operation === 'import'
        ? 'invalid-encrypted-backup'
        : operation === 'unlock'
          ? 'unlock-failed'
          : 'workspace-unavailable'
      break
    case 'web-crypto-unavailable':
      uiCode = 'crypto-unavailable'
      break
    case 'invalid-workspace':
      uiCode = operation === 'import' ? 'invalid-portable-backup' : 'workspace-unavailable'
      break
    case 'cross-tab-lock-unavailable':
      uiCode = 'cross-tab-lock-unavailable'
      break
    case 'plaintext-source-retained':
    case 'plaintext-source-not-found':
    case 'plaintext-cleanup-failed':
    case 'demo-only':
    case 'encrypted-demo-passphrase-required':
      uiCode = operation === 'delete' ? 'delete-failed' : 'workspace-unavailable'
      break
    default:
      if (operation === 'delete') uiCode = 'delete-failed'
      else if (operation === 'import') uiCode = 'invalid-portable-backup'
      else if (operation === 'save') uiCode = 'save-failed'
      else uiCode = 'workspace-unavailable'
  }

  return {
    code: uiCode,
    operation,
    retryable: code !== 'invalid-workspace' && code !== 'encrypted-payload-invalid',
  }
}

function invalidatesOpenedSession(error: unknown): boolean {
  return error instanceof LocalWorkspaceManagerError && [
    'authentication-failed',
    'encrypted-payload-invalid',
    'invalid-workspace',
    'manager-closed',
    'revision-conflict',
    'workspace-not-found',
    'workspace-not-ready',
  ].includes(error.code)
}

function messageFor(
  type: WorkspaceSessionMessage['type'],
  entry: WorkspaceRegistryEntry,
  revision: number,
  lockEpoch = 0,
): WorkspaceSessionMessage {
  return {
    version: 1,
    type,
    workspaceId: entry.id,
    storageId: entry.storageId,
    revision,
    lockEpoch,
  }
}

export function WorkspaceSessionProvider({
  children,
  managerFactory = defaultManagerFactory,
  channelFactory = createWorkspaceSessionChannel,
  lockingStorage = browserSessionStorage(),
}: WorkspaceSessionProviderProps) {
  const [accessState, setAccessState] = useState<
    'registry-loading' | 'picker' | 'locked' | 'unlocking' | 'locking' | 'unlocked'
  >('registry-loading')
  const [workspaces, setWorkspaces] = useState<WorkspaceRegistryEntry[]>([])
  const [recoverableProvisioning, setRecoverableProvisioning] =
    useState<WorkspaceRegistryEntry[]>([])
  const [pendingDeletions, setPendingDeletions] =
    useState<WorkspaceRegistryEntry[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | undefined>()
  const [session, setSession] = useState<OpenedLocalWorkspaceSession | null>(null)
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<WorkspaceUiErrorDescriptor | null>(null)
  const [workspaceCenterOpen, setWorkspaceCenterOpen] = useState(false)
  const [workspaceCenterSection, setWorkspaceCenterSection] =
    useState<WorkspaceCenterSection>('workspaces')

  const managerRef = useRef<WorkspaceSessionManager | null>(null)
  const channelRef = useRef<WorkspaceSessionChannel | null>(null)
  const sessionRef = useRef<OpenedLocalWorkspaceSession | null>(null)
  const sessionGenerationRef = useRef(0)
  const workspacesRef = useRef<WorkspaceRegistryEntry[]>([])
  const activeWorkspaceIdRef = useRef<string | undefined>(undefined)
  const setupGenerationRef = useRef(0)
  const sessionTransitionGenerationRef = useRef(0)
  const pendingOperationsRef = useRef(0)
  const researchRuntimeRef = useRef<WorkspaceResearchRuntimeControl | null>(null)
  const lockAttemptRef = useRef<Promise<boolean> | null>(null)

  const publishWorkspaces = useCallback((entries: WorkspaceRegistryEntry[]) => {
    workspacesRef.current = entries
    setWorkspaces(entries)
  }, [])

  const publishActiveWorkspaceId = useCallback((id?: string) => {
    activeWorkspaceIdRef.current = id
    setActiveWorkspaceId(id)
  }, [])

  const closeCurrentSession = useCallback(() => {
    const current = sessionRef.current
    sessionRef.current = null
    researchRuntimeRef.current = null
    setSession(null)
    if (current) {
      current.repository.close()
      sessionGenerationRef.current += 1
      setSessionGeneration(sessionGenerationRef.current)
    }
  }, [])

  const publishSession = useCallback((opened: OpenedLocalWorkspaceSession) => {
    const previous = sessionRef.current
    if (previous && previous !== opened) previous.repository.close()
    sessionTransitionGenerationRef.current += 1
    sessionRef.current = opened
    setSession(opened)
    sessionGenerationRef.current += 1
    setSessionGeneration(sessionGenerationRef.current)
    setAccessState('unlocked')
    setError(null)
  }, [])

  const postMessage = useCallback((message: WorkspaceSessionMessage) => {
    try {
      channelRef.current?.postMessage(message)
    } catch {
      // Broadcast is advisory; committed local state remains authoritative.
    }
  }, [])

  const refreshRegistry = useCallback(async () => {
    const manager = managerRef.current
    if (!manager) return []
    const [entries, recoverable, deletions] = await Promise.all([
      manager.list(),
      manager.listRecoverableProvisioning(),
      manager.listPendingDeletions(),
    ])
    publishWorkspaces(entries)
    setRecoverableProvisioning(recoverable)
    setPendingDeletions(deletions)
    return entries
  }, [publishWorkspaces])

  const beginOperation = useCallback(() => {
    pendingOperationsRef.current += 1
    setBusy(true)
  }, [])

  const endOperation = useCallback(() => {
    pendingOperationsRef.current = Math.max(0, pendingOperationsRef.current - 1)
    setBusy(pendingOperationsRef.current > 0)
  }, [])

  const reportError = useCallback((caught: unknown, operation: WorkspaceUiOperation) => {
    setError(safeWorkspaceError(caught, operation))
  }, [])

  const requireManager = useCallback(() => {
    const manager = managerRef.current
    if (!manager) {
      throw new LocalWorkspaceManagerError('manager-closed', 'Workspace manager unavailable.')
    }
    return manager
  }, [])

  const beginSessionTransition = useCallback(() => {
    sessionTransitionGenerationRef.current += 1
    return sessionTransitionGenerationRef.current
  }, [])

  const assertSessionTransition = useCallback((expectedGeneration: number) => {
    if (sessionTransitionGenerationRef.current !== expectedGeneration) {
      throw new LocalWorkspaceManagerError(
        'revision-conflict',
        'The local workspace session changed while the operation was pending.',
      )
    }
  }, [])

  const announceRegistryEntry = useCallback((entry: WorkspaceRegistryEntry) => {
    postMessage(messageFor('registry', entry, entry.registryRevision))
  }, [postMessage])

  const flushCurrentRuntime = useCallback(async () => {
    const current = sessionRef.current
    const runtime = researchRuntimeRef.current
    if (!current || !runtime) return
    if (
      runtime.workspaceId !== current.entry.id ||
      runtime.storageId !== current.storageId
    ) {
      throw new LocalWorkspaceManagerError(
        'revision-conflict',
        'The mounted workspace runtime does not match the active session.',
      )
    }
    await runtime.flushPendingWrites()
  }, [])

  const prepareForApplicationUpdate = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    const runtime = researchRuntimeRef.current
    if (
      !runtime || runtime.workspaceId !== current.entry.id ||
      runtime.storageId !== current.storageId
    ) {
      throw new LocalWorkspaceManagerError(
        'revision-conflict',
        'The active workspace runtime is not ready for an application update.',
      )
    }
    const transitionGeneration = sessionTransitionGenerationRef.current
    await runtime.flushPendingWrites()
    if (
      sessionRef.current !== current ||
      sessionTransitionGenerationRef.current !== transitionGeneration
    ) {
      throw new LocalWorkspaceManagerError(
        'revision-conflict',
        'The local workspace session changed while preparing the application update.',
      )
    }
    const latest = await runtime.refreshLatest()
    if (
      sessionRef.current !== current ||
      sessionTransitionGenerationRef.current !== transitionGeneration ||
      latest.workspace.id !== current.entry.id
    ) {
      throw new LocalWorkspaceManagerError(
        'revision-conflict',
        'The local workspace could not be verified before the application update.',
      )
    }
  }, [])

  const prepareDiagnosticSnapshot = useCallback(async (): Promise<WorkspaceData> => {
    const current = sessionRef.current
    const runtime = researchRuntimeRef.current
    if (
      !current || !runtime || runtime.workspaceId !== current.entry.id ||
      runtime.storageId !== current.storageId
    ) {
      throw new LocalWorkspaceManagerError(
        'workspace-not-ready',
        'An unlocked active workspace is required for a diagnostic report.',
      )
    }
    const transitionGeneration = sessionTransitionGenerationRef.current
    await runtime.flushPendingWrites()
    if (
      sessionRef.current !== current ||
      sessionTransitionGenerationRef.current !== transitionGeneration
    ) {
      throw new LocalWorkspaceManagerError(
        'revision-conflict',
        'The local workspace session changed while preparing diagnostics.',
      )
    }
    const latest = await runtime.refreshLatest()
    if (
      sessionRef.current !== current ||
      sessionTransitionGenerationRef.current !== transitionGeneration ||
      latest.workspace.id !== current.entry.id
    ) {
      throw new LocalWorkspaceManagerError(
        'revision-conflict',
        'The local workspace could not be verified before preparing diagnostics.',
      )
    }
    return structuredClone(latest)
  }, [])

  const adoptSession = useCallback(async (
    manager: WorkspaceSessionManager,
    opened: OpenedLocalWorkspaceSession,
    expectedTransitionGeneration: number,
  ) => {
    try {
      if (sessionRef.current && sessionRef.current !== opened) {
        await flushCurrentRuntime()
      }
      assertSessionTransition(expectedTransitionGeneration)
      if (
        opened.mode === 'standard' &&
        !safelyRemoveLockMarker(lockingStorage, standardWorkspaceLockMarker(opened.entry))
      ) {
        throw lockMarkerUnavailableError()
      }
      await manager.setActive(opened.entry.id)
      assertSessionTransition(expectedTransitionGeneration)
    } catch (caught) {
      opened.repository.close()
      throw caught
    }
    publishWorkspaces([
      ...workspacesRef.current.filter((entry) => entry.id !== opened.entry.id),
      opened.entry,
    ])
    publishActiveWorkspaceId(opened.entry.id)
    publishSession(opened)
    try {
      const entries = await refreshRegistry()
      const refreshed = entries.find((entry) => entry.id === opened.entry.id)
      if (refreshed) announceRegistryEntry(refreshed)
    } catch {
      // The opened repository and active route are already committed. A
      // registry-list refresh is best-effort and cannot reverse adoption.
    }
  }, [announceRegistryEntry, assertSessionTransition, flushCurrentRuntime, lockingStorage, publishActiveWorkspaceId, publishSession, publishWorkspaces, refreshRegistry])

  const openActiveStandard = useCallback(async () => {
    const activeId = activeWorkspaceIdRef.current
    const active = workspacesRef.current.find((entry) => entry.id === activeId)
    if (!active || active.encryptionMode !== 'standard') return
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    setAccessState('unlocking')
    try {
      const manager = requireManager()
      const opened = await manager.openStandard(active.id)
      await adoptSession(manager, opened, transitionGeneration)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      setAccessState('locked')
      reportError(caught, 'open')
      throw caught
    } finally {
      endOperation()
    }
  }, [adoptSession, beginOperation, beginSessionTransition, endOperation, refreshRegistry, reportError, requireManager])

  const unlockActiveEncrypted = useCallback(async (passphrase: string) => {
    const activeId = activeWorkspaceIdRef.current
    const active = workspacesRef.current.find((entry) => entry.id === activeId)
    if (!active || active.encryptionMode !== 'encrypted') return
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    setAccessState('unlocking')
    try {
      const manager = requireManager()
      const opened = await manager.unlockEncrypted(active.id, passphrase)
      await adoptSession(manager, opened, transitionGeneration)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      setAccessState('locked')
      reportError(caught, 'unlock')
      throw caught
    } finally {
      endOperation()
    }
  }, [adoptSession, beginOperation, beginSessionTransition, endOperation, refreshRegistry, reportError, requireManager])

  const invalidateActiveSession = useCallback((
    expectedWorkspaceId?: string,
    expectedStorageId?: string,
    expectedSessionGeneration?: number,
  ) => {
    const current = sessionRef.current
    if (!current) return
    if (
      (expectedWorkspaceId !== undefined && current.entry.id !== expectedWorkspaceId) ||
      (expectedStorageId !== undefined && current.storageId !== expectedStorageId) ||
      (expectedSessionGeneration !== undefined &&
        sessionGenerationRef.current !== expectedSessionGeneration)
    ) return
    beginSessionTransition()
    try {
      if (
        current.mode === 'standard' &&
        !safelyWriteLockMarker(lockingStorage, standardWorkspaceLockMarker(current.entry))
      ) {
        reportError(lockMarkerUnavailableError(), 'switch')
      }
    } finally {
      closeCurrentSession()
      setAccessState('locked')
    }
  }, [beginSessionTransition, closeCurrentSession, lockingStorage, reportError])

  const performLockActiveWorkspace = useCallback(async (): Promise<boolean> => {
    const current = sessionRef.current
    if (!current) return true
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    let revision: number
    try {
      await flushCurrentRuntime()
      assertSessionTransition(transitionGeneration)
      revision = current.snapshot.workspace.revision
    } catch (caught) {
      reportError(caught, 'save')
      if (sessionRef.current === current) {
        setAccessState('unlocked')
      }
      endOperation()
      return false
    }
    setAccessState('locking')
    let lockEpoch = Date.now()
    let markerWriteFailed = false
    try {
      if (current.mode === 'encrypted') {
        if (!current.lockAllTabs) {
          throw new LocalWorkspaceManagerError(
            'workspace-mode-mismatch',
            'Encrypted workspace lock is unavailable.',
          )
        }
        lockEpoch = await current.lockAllTabs()
      } else {
        if (!safelyWriteLockMarker(
          lockingStorage,
          standardWorkspaceLockMarker(current.entry),
        )) {
          markerWriteFailed = true
        }
      }
      postMessage(messageFor(
        'lock',
        current.entry,
        revision,
        lockEpoch,
      ))
      if (markerWriteFailed) reportError(lockMarkerUnavailableError(), 'switch')
      else setError(null)
    } catch (caught) {
      reportError(caught, 'switch')
    } finally {
      closeCurrentSession()
      setAccessState('locked')
      endOperation()
    }
    return true
  }, [assertSessionTransition, beginOperation, beginSessionTransition, closeCurrentSession, endOperation, flushCurrentRuntime, lockingStorage, postMessage, reportError])

  const attemptLockActiveWorkspace = useCallback((): Promise<boolean> => {
    const pending = lockAttemptRef.current
    if (pending) return pending
    const attempt = performLockActiveWorkspace()
    lockAttemptRef.current = attempt
    void attempt.finally(() => {
      if (lockAttemptRef.current === attempt) lockAttemptRef.current = null
    })
    return attempt
  }, [performLockActiveWorkspace])

  const lockActiveWorkspace = useCallback(async () => {
    await attemptLockActiveWorkspace()
  }, [attemptLockActiveWorkspace])

  useAutoLock({
    autoLock: workspaces.find((entry) => entry.id === activeWorkspaceId)?.autoLock ?? 'never',
    enabled: accessState === 'unlocked' && Boolean(session),
    onLock: async () => {
      if (!(await attemptLockActiveWorkspace())) {
        throw new LocalWorkspaceManagerError(
          'revision-conflict',
          'Auto-lock was deferred until pending writes can be verified.',
        )
      }
    },
  })

  useEffect(() => {
    const setupGeneration = setupGenerationRef.current + 1
    setupGenerationRef.current = setupGeneration
    const manager = managerFactory()
    let channel: WorkspaceSessionChannel | null = null
    try {
      channel = channelFactory()
    } catch {
      channel = null
    }
    managerRef.current = manager
    channelRef.current = channel
    let disposed = false

    const isCurrent = () => !disposed && setupGenerationRef.current === setupGeneration

    const lockFromAnotherTab = (message: WorkspaceSessionMessage) => {
      const current = sessionRef.current
      if (
        !current ||
        current.entry.id !== message.workspaceId ||
        current.storageId !== message.storageId
      ) return
      invalidateActiveSession()
    }

    const publishAndRevalidateRegistry = (entries: WorkspaceRegistryEntry[]) => {
      publishWorkspaces(entries)
      const current = sessionRef.current
      if (!current) return
      const routed = entries.find((entry) => entry.id === current.entry.id)
      if (
        !routed ||
        routed.storageId !== current.storageId ||
        routed.encryptionMode !== current.mode ||
        current.encryptedRuntime?.closed
      ) {
        invalidateActiveSession()
        if (!routed) setAccessState('picker')
      }
    }

    if (channel) {
      channel.onmessage = (event) => {
        if (!isCurrent() || !isWorkspaceSessionMessage(event.data)) return
        if (event.data.type === 'lock') {
          lockFromAnotherTab(event.data)
          return
        }
        if (event.data.type === 'registry') {
          void Promise.all([
            manager.list(),
            manager.listRecoverableProvisioning(),
            manager.listPendingDeletions(),
          ]).then(([entries, recoverable, deletions]) => {
            if (isCurrent()) {
              publishAndRevalidateRegistry(entries)
              setRecoverableProvisioning(recoverable)
              setPendingDeletions(deletions)
            }
          }).catch(() => undefined)
        }
      }
    }

    const revalidateWhenVisible = () => {
      if (document.visibilityState !== 'visible') return
      void Promise.all([
        manager.list(),
        manager.listRecoverableProvisioning(),
        manager.listPendingDeletions(),
      ]).then(([entries, recoverable, deletions]) => {
        if (!isCurrent()) return
        publishAndRevalidateRegistry(entries)
        setRecoverableProvisioning(recoverable)
        setPendingDeletions(deletions)
      }).catch(() => undefined)
    }
    document.addEventListener('visibilitychange', revalidateWhenVisible)

    setAccessState('registry-loading')
    setError(null)
    void manager.bootstrap().then(async (boot) => {
      if (!isCurrent()) return
      publishWorkspaces(boot.workspaces)
      const [recoverable, deletions] = await Promise.all([
        manager.listRecoverableProvisioning(),
        manager.listPendingDeletions(),
      ])
      setRecoverableProvisioning(recoverable)
      setPendingDeletions(deletions)
      publishActiveWorkspaceId(boot.activeWorkspaceId)
      const active = boot.workspaces.find((entry) => entry.id === boot.activeWorkspaceId)
      if (!active) {
        setAccessState('picker')
        setWorkspaceCenterOpen(true)
        return
      }
      if (active.encryptionMode === 'encrypted') {
        setAccessState('locked')
        return
      }
      const marker = safelyReadLockMarker(
        lockingStorage,
        standardWorkspaceLockMarker(active),
      )
      if (!marker.ok) {
        setAccessState('locked')
        reportError(lockMarkerUnavailableError(), 'open')
        return
      }
      if (marker.value) {
        setAccessState('locked')
        return
      }
      const opened = await manager.openStandard(active.id)
      if (!isCurrent()) {
        opened.repository.close()
        return
      }
      publishSession(opened)
      const entries = await manager.list()
      if (isCurrent()) publishWorkspaces(entries)
    }).catch((caught) => {
      if (!isCurrent()) return
      closeCurrentSession()
      setAccessState('picker')
      setWorkspaceCenterOpen(true)
      reportError(caught, 'migrate')
    })

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', revalidateWhenVisible)
      try {
        channel?.close()
      } catch {
        // Closing the repository and manager below is security-critical.
      }
      if (channelRef.current === channel) channelRef.current = null
      if (managerRef.current === manager) {
        closeCurrentSession()
        managerRef.current = null
      }
      manager.close()
    }
  }, [
    channelFactory,
    closeCurrentSession,
    invalidateActiveSession,
    lockingStorage,
    managerFactory,
    publishActiveWorkspaceId,
    publishSession,
    publishWorkspaces,
    reportError,
  ])

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    const entry = workspacesRef.current.find((candidate) => candidate.id === workspaceId)
    if (!entry) return
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    try {
      await flushCurrentRuntime()
      assertSessionTransition(transitionGeneration)
      if (
        entry.encryptionMode === 'standard' &&
        !safelyRemoveLockMarker(lockingStorage, standardWorkspaceLockMarker(entry))
      ) {
        throw lockMarkerUnavailableError()
      }
      closeCurrentSession()
      const manager = requireManager()
      await manager.setActive(entry.id)
      assertSessionTransition(transitionGeneration)
      publishActiveWorkspaceId(entry.id)
      setWorkspaceCenterOpen(false)
      setError(null)
      if (entry.encryptionMode === 'encrypted') {
        setAccessState('locked')
      } else {
        const opened = await manager.openStandard(entry.id)
        try {
          assertSessionTransition(transitionGeneration)
          publishWorkspaces([
            ...workspacesRef.current.filter((candidate) => candidate.id !== opened.entry.id),
            opened.entry,
          ])
          publishSession(opened)
          announceRegistryEntry(opened.entry)
        } catch (caught) {
          opened.repository.close()
          throw caught
        }
      }
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      setAccessState(sessionRef.current ? 'unlocked' : 'locked')
      reportError(caught, 'switch')
      throw caught
    } finally {
      endOperation()
    }
  }, [
    beginOperation,
    beginSessionTransition,
    closeCurrentSession,
    endOperation,
    flushCurrentRuntime,
    lockingStorage,
    announceRegistryEntry,
    publishActiveWorkspaceId,
    publishSession,
    publishWorkspaces,
    refreshRegistry,
    assertSessionTransition,
    reportError,
    requireManager,
  ])

  const createWorkspace = useCallback(async (request: WorkspaceCreateRequest) => {
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    try {
      await flushCurrentRuntime()
      assertSessionTransition(transitionGeneration)
      const manager = requireManager()
      const opened = request.encryptionMode === 'encrypted'
        ? await manager.createEncrypted(request.passphrase ?? '', {
            displayName: request.displayName,
            autoLock: request.autoLock,
          })
        : await manager.createStandard({
            displayName: request.displayName,
            autoLock: request.autoLock,
          })
      await adoptSession(manager, opened, transitionGeneration)
      setWorkspaceCenterOpen(false)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      reportError(caught, 'create')
      throw caught
    } finally {
      endOperation()
    }
  }, [adoptSession, assertSessionTransition, beginOperation, beginSessionTransition, endOperation, flushCurrentRuntime, refreshRegistry, reportError, requireManager])

  const recoverProvisioning = useCallback(async (
    workspaceId: string,
    passphrase?: string,
  ) => {
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    try {
      await flushCurrentRuntime()
      assertSessionTransition(transitionGeneration)
      const manager = requireManager()
      const opened = await manager.recoverProvisioning(workspaceId, passphrase)
      await adoptSession(manager, opened, transitionGeneration)
      setRecoverableProvisioning((entries) => entries.filter((entry) => entry.id !== workspaceId))
      try {
        setRecoverableProvisioning(await manager.listRecoverableProvisioning())
      } catch {
        // The recovered route is already committed and locally adopted.
      }
      setWorkspaceCenterOpen(false)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      reportError(caught, 'migrate')
      throw caught
    } finally {
      endOperation()
    }
  }, [adoptSession, assertSessionTransition, beginOperation, beginSessionTransition, endOperation, flushCurrentRuntime, refreshRegistry, reportError, requireManager])

  const discardProvisioning = useCallback(async (
    workspaceId: string,
    passphrase?: string,
  ) => {
    beginOperation()
    try {
      const manager = requireManager()
      const candidate = recoverableProvisioning.find((entry) => entry.id === workspaceId)
      await manager.discardProvisioning(workspaceId, passphrase)
      setRecoverableProvisioning((entries) => entries.filter((entry) => entry.id !== workspaceId))
      await refreshRegistry().catch(() => undefined)
      if (candidate) announceRegistryEntry(candidate)
      setError(null)
    } catch (caught) {
      reportError(caught, 'delete')
      throw caught
    } finally {
      endOperation()
    }
  }, [
    announceRegistryEntry,
    beginOperation,
    endOperation,
    recoverableProvisioning,
    refreshRegistry,
    reportError,
    requireManager,
  ])

  const retryFinalizeDeletion = useCallback(async (workspaceId: string) => {
    beginOperation()
    try {
      const manager = requireManager()
      const candidate = pendingDeletions.find((entry) => entry.id === workspaceId)
      await manager.retryFinalizeDeletion(workspaceId)
      setPendingDeletions((entries) => entries.filter((entry) => entry.id !== workspaceId))
      await refreshRegistry().catch(() => undefined)
      if (candidate) announceRegistryEntry(candidate)
      setError(null)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      reportError(caught, 'delete')
      throw caught
    } finally {
      endOperation()
    }
  }, [
    announceRegistryEntry,
    beginOperation,
    endOperation,
    pendingDeletions,
    refreshRegistry,
    reportError,
    requireManager,
  ])

  const renameWorkspace = useCallback(async (workspaceId: string, displayName: string) => {
    beginOperation()
    try {
      const manager = requireManager()
      const current = workspacesRef.current.find((entry) => entry.id === workspaceId)
      const updated = await manager.rename(workspaceId, displayName, current?.registryRevision)
      publishWorkspaces([
        ...workspacesRef.current.filter((entry) => entry.id !== updated.id),
        updated,
      ])
      await refreshRegistry().catch(() => undefined)
      announceRegistryEntry(updated)
      setError(null)
    } catch (caught) {
      if (
        sessionRef.current?.entry.id === workspaceId &&
        invalidatesOpenedSession(caught)
      ) invalidateActiveSession()
      reportError(caught, 'rename')
      throw caught
    } finally {
      endOperation()
    }
  }, [announceRegistryEntry, beginOperation, endOperation, invalidateActiveSession, publishWorkspaces, refreshRegistry, reportError, requireManager])

  const openFallbackAfterDeletion = useCallback(async (
    manager: WorkspaceSessionManager,
    entries: WorkspaceRegistryEntry[],
  ) => {
    const fallback = entries.find((entry) => entry.kind === 'personal') ??
      entries.find((entry) => entry.kind === 'demo')
    await manager.setActive(fallback?.id)
    publishActiveWorkspaceId(fallback?.id)
    if (!fallback) {
      setAccessState('picker')
      return
    }
    if (fallback.encryptionMode === 'encrypted') {
      setAccessState('locked')
      return
    }
    const marker = safelyReadLockMarker(
      lockingStorage,
      standardWorkspaceLockMarker(fallback),
    )
    if (!marker.ok) {
      setAccessState('locked')
      reportError(lockMarkerUnavailableError(), 'open')
      return
    }
    if (marker.value) {
      setAccessState('locked')
      return
    }
    const opened = await manager.openStandard(fallback.id)
    publishWorkspaces([
      ...workspacesRef.current.filter((entry) => entry.id !== opened.entry.id),
      opened.entry,
    ])
    publishSession(opened)
    announceRegistryEntry(opened.entry)
  }, [announceRegistryEntry, lockingStorage, publishActiveWorkspaceId, publishSession, publishWorkspaces, reportError])

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    beginOperation()
    const deletingActive = sessionRef.current?.entry.id === workspaceId
    if (deletingActive) beginSessionTransition()
    try {
      if (deletingActive) {
        await flushCurrentRuntime()
        setAccessState('locking')
      }
      const manager = requireManager()
      const current = workspacesRef.current.find((entry) => entry.id === workspaceId)
      if (deletingActive) closeCurrentSession()
      await manager.delete(workspaceId, current?.registryRevision)
      const entries = await manager.list().catch(() =>
        workspacesRef.current.filter((entry) => entry.id !== workspaceId),
      )
      publishWorkspaces(entries)
      if (activeWorkspaceIdRef.current === workspaceId) {
        try {
          await openFallbackAfterDeletion(manager, entries)
        } catch {
          publishActiveWorkspaceId(undefined)
          setAccessState('picker')
          setWorkspaceCenterOpen(true)
        }
      }
      if (current) announceRegistryEntry(current)
      setError(null)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      if (deletingActive) setAccessState(sessionRef.current ? 'unlocked' : 'locked')
      reportError(caught, 'delete')
      throw caught
    } finally {
      endOperation()
    }
  }, [
    announceRegistryEntry,
    beginOperation,
    beginSessionTransition,
    closeCurrentSession,
    endOperation,
    flushCurrentRuntime,
    openFallbackAfterDeletion,
    publishActiveWorkspaceId,
    publishWorkspaces,
    refreshRegistry,
    reportError,
    requireManager,
  ])

  const resetDemoWorkspace = useCallback(async (workspaceId: string) => {
    const entry = workspacesRef.current.find((candidate) => candidate.id === workspaceId)
    const current = sessionRef.current
    if (
      !entry || entry.kind !== 'demo' || !current || current.entry.id !== workspaceId ||
      current.mode !== 'standard'
    ) {
      const caught = new LocalWorkspaceManagerError('demo-only', 'Demo reset unavailable.')
      reportError(caught, 'save')
      throw caught
    }
    beginOperation()
    let reset: WorkspaceData
    try {
      await flushCurrentRuntime()
      reset = await requireManager().resetDemo(workspaceId)
    } catch (caught) {
      if (invalidatesOpenedSession(caught)) invalidateActiveSession()
      reportError(caught, 'save')
      endOperation()
      throw caught
    }
    try {
      await current.repository.refresh()
      postMessage(messageFor('revision', entry, reset.workspace.revision))
      try {
        const refreshedEntry = await requireManager().get(workspaceId)
        if (refreshedEntry) {
          publishWorkspaces([
            ...workspacesRef.current.filter((candidate) => candidate.id !== workspaceId),
            refreshedEntry,
          ])
          announceRegistryEntry(refreshedEntry)
        }
        await refreshRegistry().catch(() => undefined)
      } catch {
        // Reset already committed; registry convergence remains best-effort.
      }
      setError(null)
    } catch (caught) {
      if (invalidatesOpenedSession(caught)) invalidateActiveSession()
      reportError(caught, 'save')
    } finally {
      endOperation()
    }
  }, [announceRegistryEntry, beginOperation, endOperation, flushCurrentRuntime, invalidateActiveSession, postMessage, publishWorkspaces, refreshRegistry, reportError, requireManager])

  const updateWorkspaceAutoLock = useCallback(async (
    workspaceId: string,
    autoLock: WorkspaceAutoLock,
  ) => {
    beginOperation()
    try {
      const manager = requireManager()
      const current = workspacesRef.current.find((entry) => entry.id === workspaceId)
      const updated = await manager.updateAutoLock(
        workspaceId,
        autoLock,
        current?.registryRevision,
      )
      publishWorkspaces([
        ...workspacesRef.current.filter((entry) => entry.id !== updated.id),
        updated,
      ])
      await refreshRegistry().catch(() => undefined)
      announceRegistryEntry(updated)
      setError(null)
    } catch (caught) {
      if (
        sessionRef.current?.entry.id === workspaceId &&
        invalidatesOpenedSession(caught)
      ) invalidateActiveSession()
      reportError(caught, 'save')
      throw caught
    } finally {
      endOperation()
    }
  }, [announceRegistryEntry, beginOperation, endOperation, invalidateActiveSession, publishWorkspaces, refreshRegistry, reportError, requireManager])

  const convertWorkspaceToEncrypted = useCallback(async (
    workspaceId: string,
    passphrase: string,
  ) => {
    const entry = workspacesRef.current.find((candidate) => candidate.id === workspaceId)
    if (!entry || entry.kind === 'demo' || entry.encryptionMode !== 'standard') return
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    try {
      if (sessionRef.current?.entry.id === workspaceId) {
        await flushCurrentRuntime()
        assertSessionTransition(transitionGeneration)
        closeCurrentSession()
      }
      assertSessionTransition(transitionGeneration)
      setAccessState('locking')
      const manager = requireManager()
      const opened = await manager.convertStandardToEncrypted(workspaceId, passphrase)
      await adoptSession(manager, opened, transitionGeneration)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      setAccessState(sessionRef.current ? 'unlocked' : 'locked')
      reportError(caught, 'switch')
      throw caught
    } finally {
      endOperation()
    }
  }, [adoptSession, assertSessionTransition, beginOperation, beginSessionTransition, closeCurrentSession, endOperation, flushCurrentRuntime, refreshRegistry, reportError, requireManager])

  const discardEncryptedConversion = useCallback(async (
    workspaceId: string,
    passphrase?: string,
  ) => {
    beginOperation()
    try {
      const updated = await requireManager().discardEncryptedConversion(workspaceId, passphrase)
      publishWorkspaces([
        ...workspacesRef.current.filter((entry) => entry.id !== updated.id),
        updated,
      ])
      await refreshRegistry().catch(() => undefined)
      announceRegistryEntry(updated)
      setError(null)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      reportError(caught, 'delete')
      throw caught
    } finally {
      endOperation()
    }
  }, [announceRegistryEntry, beginOperation, endOperation, publishWorkspaces, refreshRegistry, reportError, requireManager])

  const cleanupPlaintextSource = useCallback(async (workspaceId: string, sourceId: string) => {
    beginOperation()
    try {
      const current = sessionRef.current
      if (
        !current || current.entry.id !== workspaceId || current.mode !== 'encrypted'
      ) {
        throw new LocalWorkspaceManagerError(
          'workspace-not-ready',
          'An unlocked encrypted workspace is required for plaintext cleanup.',
        )
      }
      await flushCurrentRuntime()
      const updated = await requireManager().cleanupPlaintextSource(workspaceId, sourceId)
      publishWorkspaces([
        ...workspacesRef.current.filter((entry) => entry.id !== updated.id),
        updated,
      ])
      await refreshRegistry().catch(() => undefined)
      announceRegistryEntry(updated)
      setError(null)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      if (invalidatesOpenedSession(caught)) invalidateActiveSession()
      reportError(caught, 'delete')
      throw caught
    } finally {
      endOperation()
    }
  }, [announceRegistryEntry, beginOperation, endOperation, flushCurrentRuntime, invalidateActiveSession, publishWorkspaces, refreshRegistry, reportError, requireManager])

  const readCurrentExportEntry = useCallback(async (
    workspaceId: string,
    current: OpenedLocalWorkspaceSession,
  ) => {
    const entry = await requireManager().get(workspaceId)
    if (
      !entry || entry.storageId !== current.storageId ||
      entry.encryptionMode !== current.mode
    ) {
      throw new LocalWorkspaceManagerError(
        'revision-conflict',
        'The workspace route changed before export.',
      )
    }
    return entry
  }, [requireManager])

  const markExportBestEffort = useCallback(async (workspaceId: string) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const manager = requireManager()
        const latest = await manager.get(workspaceId)
        if (!latest) return
        const updated = await manager.markExportGenerated(
          workspaceId,
          new Date(),
          latest.registryRevision,
        )
        publishWorkspaces([
          ...workspacesRef.current.filter((entry) => entry.id !== updated.id),
          updated,
        ])
        await refreshRegistry().catch(() => undefined)
        announceRegistryEntry(updated)
        return
      } catch {
        // The file has already been handed to the browser. Metadata is advisory
        // and must never reverse a successful export result.
      }
    }
  }, [announceRegistryEntry, publishWorkspaces, refreshRegistry, requireManager])

  const exportPlaintextWorkspace = useCallback(async (workspaceId: string) => {
    const current = sessionRef.current
    const runtime = researchRuntimeRef.current
    if (
      !current || current.entry.id !== workspaceId || !runtime ||
      runtime.workspaceId !== workspaceId || runtime.storageId !== current.storageId
    ) {
      const caught = new LocalWorkspaceManagerError('workspace-not-ready', 'Workspace locked.')
      reportError(caught, 'export')
      throw caught
    }
    beginOperation()
    try {
      await runtime.flushPendingWrites()
      const snapshot = await runtime.refreshLatest()
      const exportEntry = await readCurrentExportEntry(workspaceId, current)
      const portableSnapshot: WorkspaceData = {
        ...snapshot,
        workspace: {
          ...snapshot.workspace,
          name: exportEntry.displayName,
        },
      }
      downloadTextFile(
        exportWorkspaceJson(portableSnapshot),
        `sociology-phd-desk-${todayIso()}.json`,
        'application/json;charset=utf-8',
      )
      await markExportBestEffort(workspaceId)
      setError(null)
    } catch (caught) {
      if (invalidatesOpenedSession(caught)) invalidateActiveSession()
      reportError(caught, 'export')
      throw caught
    } finally {
      endOperation()
    }
  }, [beginOperation, endOperation, invalidateActiveSession, markExportBestEffort, readCurrentExportEntry, reportError])

  const exportEncryptedWorkspace = useCallback(async (
    workspaceId: string,
    passphrase: string,
  ) => {
    const current = sessionRef.current
    const researchRuntime = researchRuntimeRef.current
    if (
      !current || current.entry.id !== workspaceId || current.mode !== 'encrypted' ||
      !current.encryptedRuntime || current.encryptedRuntime.closed ||
      !researchRuntime || researchRuntime.workspaceId !== workspaceId ||
      researchRuntime.storageId !== current.storageId
    ) {
      const caught = new LocalWorkspaceManagerError('workspace-not-ready', 'Workspace locked.')
      reportError(caught, 'export')
      throw caught
    }
    beginOperation()
    try {
      await researchRuntime.flushPendingWrites()
      await researchRuntime.refreshLatest()
      const exportEntry = await readCurrentExportEntry(workspaceId, current)
      const backup = await current.encryptedRuntime.createBackup(
        passphrase,
        exportEntry.displayName,
      )
      downloadTextFile(
        backup,
        `sociology-phd-desk-${todayIso()}.sociologydesk`,
        ENCRYPTED_BACKUP_MIME,
      )
      await markExportBestEffort(workspaceId)
      setError(null)
    } catch (caught) {
      if (invalidatesOpenedSession(caught)) invalidateActiveSession()
      reportError(caught, 'export')
      throw caught
    } finally {
      endOperation()
    }
  }, [beginOperation, endOperation, invalidateActiveSession, markExportBestEffort, readCurrentExportEntry, reportError])

  const importPlaintextWithTransition = useCallback(async (
    snapshot: WorkspaceData,
    transitionGeneration: number,
  ) => {
    await flushCurrentRuntime()
    assertSessionTransition(transitionGeneration)
    const manager = requireManager()
    const opened = await manager.importPlaintextWorkspace(snapshot, {
      displayName: snapshot.workspace.name,
      kind: 'personal',
    })
    await adoptSession(manager, opened, transitionGeneration)
    setWorkspaceCenterOpen(false)
  }, [adoptSession, assertSessionTransition, flushCurrentRuntime, requireManager])

  const importPlaintextWorkspaceAsNew = useCallback(async (snapshot: WorkspaceData) => {
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    try {
      await importPlaintextWithTransition(snapshot, transitionGeneration)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      reportError(caught, 'import')
      throw caught
    } finally {
      endOperation()
    }
  }, [beginOperation, beginSessionTransition, endOperation, importPlaintextWithTransition, refreshRegistry, reportError])

  const importPlaintextWorkspaceFile = useCallback(async (file: File) => {
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    try {
      const snapshot = (await preflightPortableWorkspaceFile(file)).snapshot
      assertSessionTransition(transitionGeneration)
      await importPlaintextWithTransition(snapshot, transitionGeneration)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      reportError(caught, 'import')
      throw caught
    } finally {
      endOperation()
    }
  }, [assertSessionTransition, beginOperation, beginSessionTransition, endOperation, importPlaintextWithTransition, refreshRegistry, reportError])

  const preflightPlaintextFile = useCallback(async (file: File) => {
    beginOperation()
    try {
      return await preflightPortableWorkspaceFile(
        file,
        researchRuntimeRef.current?.getCurrentSnapshot(),
      )
    } catch (error) {
      reportError(error, 'import')
      throw error
    } finally {
      endOperation()
    }
  }, [beginOperation, endOperation, reportError])

  const preflightEncryptedFile = useCallback(async (file: File, passphrase: string) => {
    beginOperation()
    try {
      return await preflightEncryptedWorkspaceFile(file, passphrase)
    } catch (error: unknown) {
      if (error instanceof WebCryptoUnavailableError) {
        const mapped = new LocalWorkspaceManagerError('web-crypto-unavailable', 'Required browser cryptography is unavailable.')
        reportError(mapped, 'import')
        throw mapped
      }
      if (error instanceof EncryptedContainerAuthenticationError) {
        const mapped = new LocalWorkspaceManagerError('authentication-failed', 'Encrypted workspace authentication failed.')
        reportError(mapped, 'import')
        throw mapped
      }
      if (error instanceof EncryptedContainerFormatError || error instanceof EncryptedPayloadValidationError) {
        const mapped = new LocalWorkspaceManagerError('encrypted-payload-invalid', 'The encrypted workspace payload is invalid.')
        reportError(mapped, 'import')
        throw mapped
      }
      reportError(error, 'import')
      throw error
    } finally {
      endOperation()
    }
  }, [beginOperation, endOperation, reportError])

  const importEncryptedWorkspaceFile = useCallback(async (
    request: WorkspaceEncryptedImportRequest,
  ) => {
    const transitionGeneration = beginSessionTransition()
    beginOperation()
    try {
      await flushCurrentRuntime()
      assertSessionTransition(transitionGeneration)
      const encryptedSource = await readGuardedText(
        request.file,
        MAX_ENCRYPTED_BACKUP_FILE_BYTES,
      )
      assertSessionTransition(transitionGeneration)
      const manager = requireManager()
      const opened = await manager.restoreEncryptedBackup(
        encryptedSource,
        request.backupPassphrase,
        request.newWorkspacePassphrase,
      )
      await adoptSession(manager, opened, transitionGeneration)
      setWorkspaceCenterOpen(false)
    } catch (caught) {
      await refreshRegistry().catch(() => undefined)
      reportError(caught, 'import')
      throw caught
    } finally {
      endOperation()
    }
  }, [adoptSession, assertSessionTransition, beginOperation, beginSessionTransition, endOperation, flushCurrentRuntime, refreshRegistry, reportError, requireManager])

  const announceRevision = useCallback((revision: number) => {
    const current = sessionRef.current
    if (!current) return
    postMessage(messageFor('revision', current.entry, revision))
  }, [postMessage])

  const registerResearchRuntime = useCallback((control: WorkspaceResearchRuntimeControl) => {
    const current = sessionRef.current
    if (
      !current || current.entry.id !== control.workspaceId ||
      current.storageId !== control.storageId
    ) return () => undefined
    researchRuntimeRef.current = control
    return () => {
      if (researchRuntimeRef.current === control) researchRuntimeRef.current = null
    }
  }, [])

  const activeWorkspace = useMemo(
    () => workspaces.find((entry) => entry.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  )

  const value = useMemo(() => ({
    accessState,
    workspaces,
    recoverableProvisioning,
    pendingDeletions,
    activeWorkspaceId,
    activeWorkspace,
    session,
    sessionGeneration,
    busy,
    error,
    workspaceCenterOpen,
    workspaceCenterSection,
    openWorkspaceCenter: (section: WorkspaceCenterSection = 'workspaces') => {
      setWorkspaceCenterSection(section)
      setWorkspaceCenterOpen(true)
      if (!sessionRef.current) setAccessState('picker')
    },
    closeWorkspaceCenter: () => {
      setWorkspaceCenterOpen(false)
      if (!sessionRef.current) {
        setAccessState(activeWorkspaceIdRef.current ? 'locked' : 'picker')
      }
    },
    openActiveStandard,
    unlockActiveEncrypted,
    lockActiveWorkspace,
    prepareForApplicationUpdate,
    prepareDiagnosticSnapshot,
    invalidateActiveSession,
    selectWorkspace,
    createWorkspace,
    recoverProvisioning,
    discardProvisioning,
    retryFinalizeDeletion,
    renameWorkspace,
    deleteWorkspace,
    resetDemoWorkspace,
    updateWorkspaceAutoLock,
    convertWorkspaceToEncrypted,
    discardEncryptedConversion,
    cleanupPlaintextSource,
    exportPlaintextWorkspace,
    exportEncryptedWorkspace,
    preflightPlaintextWorkspaceFile: preflightPlaintextFile,
    preflightEncryptedWorkspaceFile: preflightEncryptedFile,
    importPlaintextWorkspaceFile,
    importEncryptedWorkspaceFile,
    importPlaintextWorkspaceAsNew,
    announceRevision,
    registerResearchRuntime,
    clearError: () => setError(null),
  }), [
    accessState,
    activeWorkspace,
    activeWorkspaceId,
    announceRevision,
    registerResearchRuntime,
    busy,
    cleanupPlaintextSource,
    discardEncryptedConversion,
    convertWorkspaceToEncrypted,
    createWorkspace,
    recoverProvisioning,
    discardProvisioning,
    retryFinalizeDeletion,
    deleteWorkspace,
    error,
    exportEncryptedWorkspace,
    exportPlaintextWorkspace,
    importEncryptedWorkspaceFile,
    importPlaintextWorkspaceAsNew,
    importPlaintextWorkspaceFile,
    preflightEncryptedFile,
    preflightPlaintextFile,
    lockActiveWorkspace,
    prepareForApplicationUpdate,
    prepareDiagnosticSnapshot,
    invalidateActiveSession,
    openActiveStandard,
    renameWorkspace,
    resetDemoWorkspace,
    selectWorkspace,
    session,
    sessionGeneration,
    unlockActiveEncrypted,
    updateWorkspaceAutoLock,
    workspaceCenterOpen,
    workspaceCenterSection,
    workspaces,
    recoverableProvisioning,
    pendingDeletions,
  ])

  return (
    <WorkspaceSessionContext.Provider value={value}>
      {children}
    </WorkspaceSessionContext.Provider>
  )
}
