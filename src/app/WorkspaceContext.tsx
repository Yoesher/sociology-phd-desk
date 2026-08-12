import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  LocalWorkspaceManagerError,
  type WorkspaceRepositoryPort,
} from '../db/localWorkspaceManager'
import type { EntityMetadata, WorkspaceData } from '../models/domain'
import { nowIso } from './format'
import {
  WorkspaceContext,
  type WorkspaceContextValue,
  type WorkspacePersistenceErrorCode,
} from './workspace-context'
import {
  createWorkspaceSessionChannel,
  isWorkspaceSessionMessage,
  type WorkspaceSessionChannelFactory,
  type WorkspaceSessionMessage,
} from './workspace-session-channel'
import type { WorkspaceResearchRuntimeControl } from './workspace-session-context'

class OptimisticWriteCancelledError extends Error {
  constructor() {
    super('An optimistic write chain was cancelled.')
    this.name = 'OptimisticWriteCancelledError'
  }
}

function safePersistenceError(error: unknown): WorkspacePersistenceErrorCode {
  if (error instanceof LocalWorkspaceManagerError) {
    if (error.code === 'revision-conflict') return 'workspace-conflict'
    if (
      error.code === 'workspace-not-found' ||
      error.code === 'workspace-not-ready' ||
      error.code === 'manager-closed'
    ) return 'workspace-unavailable'
  }
  return 'save-failed'
}

function invalidatesOpenSession(error: unknown): boolean {
  return error instanceof LocalWorkspaceManagerError && [
    'authentication-failed',
    'encrypted-payload-invalid',
    'invalid-workspace',
    'revision-conflict',
    'workspace-not-found',
    'workspace-not-ready',
    'manager-closed',
  ].includes(error.code)
}

function markEditedRecords<T extends EntityMetadata>(before: T[], after: T[]): T[] {
  const previousById = new Map(before.map((record) => [record.id, record]))
  return after.map((record) => {
    const previous = previousById.get(record.id)
    return previous?.isDemo && previous !== record ? { ...record, isDemo: false } : record
  })
}

function markUserChanges(current: WorkspaceData, next: WorkspaceData): WorkspaceData {
  return {
    ...next,
    workspace: { ...next.workspace, isDemo: false },
    projects: markEditedRecords(current.projects, next.projects),
    researchQuestions: markEditedRecords(current.researchQuestions, next.researchQuestions),
    claims: markEditedRecords(current.claims, next.claims),
    claimQuestionLinks: markEditedRecords(current.claimQuestionLinks, next.claimQuestionLinks),
    theoryMemos: markEditedRecords(current.theoryMemos, next.theoryMemos),
    tasks: markEditedRecords(current.tasks, next.tasks),
    literature: markEditedRecords(current.literature, next.literature),
    fieldSites: markEditedRecords(current.fieldSites, next.fieldSites),
    interviews: markEditedRecords(current.interviews, next.interviews),
    fieldVisits: markEditedRecords(current.fieldVisits, next.fieldVisits),
    datasets: markEditedRecords(current.datasets, next.datasets),
    analysisRuns: markEditedRecords(current.analysisRuns, next.analysisRuns),
    evidence: markEditedRecords(current.evidence, next.evidence),
    researchLogs: markEditedRecords(current.researchLogs, next.researchLogs),
    manuscripts: markEditedRecords(current.manuscripts, next.manuscripts),
    submissions: markEditedRecords(current.submissions, next.submissions),
    reviewerComments: markEditedRecords(current.reviewerComments, next.reviewerComments),
  }
}

export interface WorkspaceProviderProps {
  children: ReactNode
  repository: WorkspaceRepositoryPort
  initialSnapshot: WorkspaceData
  workspaceId: string
  storageId: string
  onExternalLock: () => void | Promise<void>
  onResetDemo?: () => void | Promise<void>
  registerRuntime?: (control: WorkspaceResearchRuntimeControl) => () => void
  channelFactory?: WorkspaceSessionChannelFactory
}

export function WorkspaceProvider({
  children,
  repository,
  initialSnapshot,
  workspaceId,
  storageId,
  onExternalLock,
  onResetDemo,
  registerRuntime,
  channelFactory = createWorkspaceSessionChannel,
}: WorkspaceProviderProps) {
  const [data, setData] = useState<WorkspaceData | null>(() => initialSnapshot)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<WorkspacePersistenceErrorCode | null>(null)
  const dataRef = useRef<WorkspaceData | null>(initialSnapshot)
  const saveQueue = useRef(Promise.resolve())
  const saveGeneration = useRef(0)
  const queuePoisoned = useRef(false)
  const recoveryPromise = useRef<Promise<void> | null>(null)
  const pendingWrites = useRef(0)
  const localMutationGeneration = useRef(0)
  const mountedRef = useRef(true)
  const syncChannelRef = useRef<ReturnType<WorkspaceSessionChannelFactory>>(null)
  const onExternalLockRef = useRef(onExternalLock)
  const writeFailureRef = useRef<unknown>(null)
  onExternalLockRef.current = onExternalLock

  const invalidateForSessionError = useCallback((caught: unknown) => {
    if (!invalidatesOpenSession(caught)) return false
    void Promise.resolve(onExternalLockRef.current()).catch(() => undefined)
    return true
  }, [])

  const setSnapshot = useCallback((snapshot: WorkspaceData) => {
    dataRef.current = snapshot
    if (mountedRef.current) setData(snapshot)
  }, [])

  const refreshUntilStable = useCallback(async (): Promise<WorkspaceData> => {
    while (true) {
      const generation = localMutationGeneration.current
      const snapshot = await repository.refresh()
      if (snapshot.workspace.id !== workspaceId) {
        throw new LocalWorkspaceManagerError(
          'invalid-workspace',
          'Workspace identity changed during refresh.',
        )
      }
      if (generation !== localMutationGeneration.current) {
        await saveQueue.current
        continue
      }
      setSnapshot(snapshot)
      return snapshot
    }
  }, [repository, setSnapshot, workspaceId])

  const refresh = useCallback(async () => {
    await refreshUntilStable()
  }, [refreshUntilStable])

  const queueWrite = useCallback(<T,>(write: () => Promise<T>): Promise<T> => {
    const generation = saveGeneration.current
    const invalidAtEnqueue = queuePoisoned.current
    pendingWrites.current += 1
    if (mountedRef.current) setSaving(true)
    const operation = saveQueue.current.then(async () => {
      if (
        invalidAtEnqueue ||
        queuePoisoned.current ||
        generation !== saveGeneration.current
      ) {
        throw new OptimisticWriteCancelledError()
      }
      try {
        return await write()
      } catch (writeError) {
        writeFailureRef.current = writeError
        if (generation === saveGeneration.current) {
          saveGeneration.current += 1
          queuePoisoned.current = true
        }
        throw writeError
      }
    })
    saveQueue.current = operation.then(() => undefined, () => undefined)
    return operation.finally(() => {
      pendingWrites.current = Math.max(0, pendingWrites.current - 1)
      if (mountedRef.current) setSaving(pendingWrites.current > 0)
    })
  }, [])

  const recoverWriteQueue = useCallback(async (): Promise<void> => {
    if (recoveryPromise.current) return recoveryPromise.current
    const recoveryGeneration = saveGeneration.current
    const recovery = refresh().then(() => {
      if (saveGeneration.current === recoveryGeneration) queuePoisoned.current = false
      writeFailureRef.current = null
    })
    recoveryPromise.current = recovery
    try {
      await recovery
    } finally {
      if (recoveryPromise.current === recovery) recoveryPromise.current = null
    }
  }, [refresh])

  const announceWorkspaceChange = useCallback((revision: number) => {
    const message: WorkspaceSessionMessage = {
      version: 1,
      type: 'revision',
      workspaceId,
      storageId,
      revision,
      lockEpoch: 0,
    }
    return message
  }, [storageId, workspaceId])

  useEffect(() => {
    mountedRef.current = true
    // React StrictMode probes effects with setup → cleanup → setup. The
    // repository is externally owned by WorkspaceSessionProvider, so this
    // local queue must be reusable after the probe without reopening a port.
    queuePoisoned.current = false
    let channel: ReturnType<WorkspaceSessionChannelFactory> = null
    try {
      channel = channelFactory()
    } catch {
      channel = null
    }
    syncChannelRef.current = channel
    const refreshAfterPendingWrites = () => {
      void saveQueue.current.then(refresh).catch((caught) => {
        if (invalidatesOpenSession(caught)) {
          void Promise.resolve(onExternalLockRef.current()).catch(() => undefined)
          return
        }
        if (mountedRef.current) setError(safePersistenceError(caught))
      })
    }

    if (channel) {
      channel.onmessage = (event) => {
        if (!isWorkspaceSessionMessage(event.data)) return
        if (
          event.data.workspaceId !== workspaceId ||
          event.data.storageId !== storageId
        ) return
        if (event.data.type === 'lock') {
          void Promise.resolve(onExternalLockRef.current()).catch(() => undefined)
          return
        }
        if (
          event.data.type === 'revision' &&
          event.data.revision > (dataRef.current?.workspace.revision ?? -1)
        ) refreshAfterPendingWrites()
      }
    }

    const revalidateWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshAfterPendingWrites()
    }
    document.addEventListener('visibilitychange', revalidateWhenVisible)

    return () => {
      mountedRef.current = false
      saveGeneration.current += 1
      queuePoisoned.current = true
      document.removeEventListener('visibilitychange', revalidateWhenVisible)
      try {
        channel?.close()
      } catch {
        // Advisory channel cleanup must not prevent repository poisoning.
      }
      if (syncChannelRef.current === channel) syncChannelRef.current = null
    }
  }, [channelFactory, refresh, repository, storageId, workspaceId])

  useLayoutEffect(() => {
    if (!registerRuntime) return undefined
    return registerRuntime({
      workspaceId,
      storageId,
      flushPendingWrites: async () => {
        try {
          await saveQueue.current
          if (writeFailureRef.current) throw writeFailureRef.current
          if (recoveryPromise.current) await recoveryPromise.current
          if (queuePoisoned.current) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The optimistic write queue is not exportable.',
            )
          }
        } catch (caught) {
          invalidateForSessionError(caught)
          throw caught
        }
      },
      refreshLatest: async () => {
        try {
          await saveQueue.current
          if (writeFailureRef.current) throw writeFailureRef.current
          if (recoveryPromise.current) await recoveryPromise.current
          if (queuePoisoned.current) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The optimistic write queue cannot be refreshed for export.',
            )
          }
          const current = await refreshUntilStable()
          return structuredClone(current)
        } catch (caught) {
          invalidateForSessionError(caught)
          throw caught
        }
      },
      getCurrentSnapshot: () => {
        const current = dataRef.current
        if (!current) {
          throw new LocalWorkspaceManagerError('workspace-not-ready', 'Workspace unavailable.')
        }
        return structuredClone(current)
      },
    })
  }, [invalidateForSessionError, refreshUntilStable, registerRuntime, storageId, workspaceId])

  const publishRevision = useCallback((revision: number) => {
    try {
      syncChannelRef.current?.postMessage(announceWorkspaceChange(revision))
    } catch {
      // Persistence already committed; a failed advisory signal is non-fatal.
    }
  }, [announceWorkspaceChange])

  const updateData = useCallback(
    async (updater: (current: WorkspaceData) => WorkspaceData) => {
      const current = dataRef.current
      if (!current) return
      const next = markUserChanges(current, updater(current))
      const expectedRevision = current.workspace.revision
      const snapshot = {
        ...next,
        exportedAt: nowIso(),
        workspace: {
          ...next.workspace,
          revision: expectedRevision + 1,
          updatedAt: nowIso(),
        },
      }
      localMutationGeneration.current += 1
      setSnapshot(snapshot)
      try {
        const persisted = await queueWrite(() =>
          repository.replaceWorkspace(snapshot, expectedRevision),
        )
        if (mountedRef.current) setError(null)
        publishRevision(persisted.workspace.revision)
      } catch (saveError) {
        if (invalidateForSessionError(saveError)) throw saveError
        if (!(saveError instanceof OptimisticWriteCancelledError) && mountedRef.current) {
          setError(safePersistenceError(saveError))
        }
        try {
          await recoverWriteQueue()
        } catch (refreshError) {
          if (invalidateForSessionError(refreshError)) throw refreshError
          if (mountedRef.current) setError(safePersistenceError(refreshError))
        }
        throw saveError
      }
    },
    [invalidateForSessionError, publishRevision, queueWrite, recoverWriteQueue, repository, setSnapshot],
  )

  const replaceWith = useCallback(
    async (workspace: WorkspaceData) => {
      const current = dataRef.current
      if (!current) return
      const expectedRevision = current.workspace.revision
      const localSnapshot: WorkspaceData = {
        ...workspace,
        exportedAt: nowIso(),
        workspace: {
          ...workspace.workspace,
          revision: expectedRevision + 1,
          updatedAt: nowIso(),
        },
      }
      localMutationGeneration.current += 1
      try {
        const persisted = await queueWrite(() =>
          repository.replaceWorkspace(localSnapshot, expectedRevision),
        )
        await refresh()
        if (mountedRef.current) setError(null)
        publishRevision(persisted.workspace.revision)
      } catch (replaceError) {
        if (invalidateForSessionError(replaceError)) throw replaceError
        if (!(replaceError instanceof OptimisticWriteCancelledError) && mountedRef.current) {
          setError(safePersistenceError(replaceError))
        }
        try {
          await recoverWriteQueue()
        } catch (refreshError) {
          if (invalidateForSessionError(refreshError)) throw refreshError
          if (mountedRef.current) setError(safePersistenceError(refreshError))
        }
        throw replaceError
      }
    },
    [invalidateForSessionError, publishRevision, queueWrite, recoverWriteQueue, refresh, repository],
  )

  const mergeWith = useCallback(
    async (workspace: WorkspaceData) => {
      localMutationGeneration.current += 1
      try {
        const result = await queueWrite(() => repository.mergeWorkspace(workspace))
        await refresh()
        if (mountedRef.current) setError(null)
        publishRevision(dataRef.current?.workspace.revision ?? 0)
        return result
      } catch (mergeError) {
        if (invalidateForSessionError(mergeError)) throw mergeError
        if (!(mergeError instanceof OptimisticWriteCancelledError) && mountedRef.current) {
          setError(safePersistenceError(mergeError))
        }
        try {
          await recoverWriteQueue()
        } catch (refreshError) {
          if (invalidateForSessionError(refreshError)) throw refreshError
          if (mountedRef.current) setError(safePersistenceError(refreshError))
        }
        throw mergeError
      }
    },
    [invalidateForSessionError, publishRevision, queueWrite, recoverWriteQueue, refresh, repository],
  )

  const resetDemo = useCallback(async () => {
    if (!onResetDemo) {
      throw new LocalWorkspaceManagerError('demo-only', 'Demo reset is unavailable.')
    }
    await onResetDemo()
    await refresh()
  }, [onResetDemo, refresh])

  const setActiveProject = useCallback(
    async (projectId?: string) => {
      await updateData((current) => ({
        ...current,
        workspace: { ...current.workspace, activeProjectId: projectId },
      }))
    },
    [updateData],
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      data,
      loading: false,
      saving,
      error,
      updateData,
      setActiveProject,
      replaceWith,
      mergeWith,
      resetDemo,
      refresh,
      clearError: () => setError(null),
    }),
    [data, error, mergeWith, refresh, replaceWith, resetDemo, saving, setActiveProject, updateData],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
