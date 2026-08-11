import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createDemoWorkspace } from '../models/demo'
import type { EntityMetadata, WorkspaceData } from '../models/domain'
import {
  getWorkspaceSnapshot,
  initializeWorkspace,
  mergeWorkspace,
  replaceWorkspace,
} from '../db/workspaceRepository'
import { nowIso } from './format'
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The local workspace could not be updated.'

class OptimisticWriteCancelledError extends Error {
  constructor() {
    super('This save was cancelled because an earlier write in the same optimistic chain failed.')
    this.name = 'OptimisticWriteCancelledError'
  }
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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef<WorkspaceData | null>(null)
  const saveQueue = useRef(Promise.resolve())
  const saveGeneration = useRef(0)
  const queuePoisoned = useRef(false)
  const recoveryPromise = useRef<Promise<void> | null>(null)
  const pendingWrites = useRef(0)
  const syncChannel = useRef<BroadcastChannel | null>(null)

  const setSnapshot = useCallback((snapshot: WorkspaceData) => {
    dataRef.current = snapshot
    setData(snapshot)
  }, [])

  const refresh = useCallback(async () => {
    const snapshot = await getWorkspaceSnapshot()
    if (!snapshot) throw new Error('The local workspace is unavailable. Reload to initialize it.')
    setSnapshot(snapshot)
  }, [setSnapshot])

  const queueWrite = useCallback(<T,>(write: () => Promise<T>): Promise<T> => {
    const generation = saveGeneration.current
    const invalidAtEnqueue = queuePoisoned.current
    pendingWrites.current += 1
    setSaving(true)
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
      setSaving(pendingWrites.current > 0)
    })
  }, [])

  const recoverWriteQueue = useCallback(async (): Promise<void> => {
    if (recoveryPromise.current) {
      return recoveryPromise.current
    }

    const recoveryGeneration = saveGeneration.current
    const recovery = refresh().then(
      () => {
        if (saveGeneration.current === recoveryGeneration) {
          queuePoisoned.current = false
        }
      },
      (refreshError: unknown) => {
        throw refreshError
      },
    )
    recoveryPromise.current = recovery

    try {
      await recovery
    } finally {
      if (recoveryPromise.current === recovery) {
        recoveryPromise.current = null
      }
    }
  }, [refresh])

  const announceWorkspaceChange = useCallback(() => {
    syncChannel.current?.postMessage({ type: 'workspace-changed' })
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        await initializeWorkspace()
        const snapshot = await getWorkspaceSnapshot()
        if (!snapshot) throw new Error('The local workspace could not be initialized.')
        if (active) setSnapshot(snapshot)
      } catch (loadError) {
        if (active) setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [setSnapshot])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    const channel = new BroadcastChannel('sociology-phd-desk-workspace')
    syncChannel.current = channel
    channel.onmessage = () => {
      void refresh().catch((syncError) => setError(errorMessage(syncError)))
    }
    return () => {
      channel.close()
      syncChannel.current = null
    }
  }, [refresh])

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
      setSnapshot(snapshot)
      try {
        await queueWrite(() => replaceWorkspace(snapshot, expectedRevision))
        setError(null)
        announceWorkspaceChange()
      } catch (saveError) {
        if (!(saveError instanceof OptimisticWriteCancelledError)) {
          setError(errorMessage(saveError))
        }
        try {
          await recoverWriteQueue()
        } catch (refreshError) {
          setError(errorMessage(refreshError))
        }
        throw saveError
      }
    },
    [announceWorkspaceChange, queueWrite, recoverWriteQueue, setSnapshot],
  )

  const replaceWith = useCallback(
    async (workspace: WorkspaceData) => {
      const expectedRevision = dataRef.current?.workspace.revision
      const localSnapshot: WorkspaceData = {
        ...workspace,
        exportedAt: nowIso(),
        workspace: {
          ...workspace.workspace,
          revision: expectedRevision === undefined ? 0 : expectedRevision + 1,
          updatedAt: nowIso(),
        },
      }
      try {
        await queueWrite(() => replaceWorkspace(localSnapshot, expectedRevision))
        await refresh()
        setError(null)
        announceWorkspaceChange()
      } catch (replaceError) {
        if (!(replaceError instanceof OptimisticWriteCancelledError)) {
          setError(errorMessage(replaceError))
        }
        try {
          await recoverWriteQueue()
        } catch (refreshError) {
          setError(errorMessage(refreshError))
        }
        throw replaceError
      }
    },
    [announceWorkspaceChange, queueWrite, recoverWriteQueue, refresh],
  )

  const mergeWith = useCallback(
    async (workspace: WorkspaceData) => {
      try {
        const result = await queueWrite(() => mergeWorkspace(workspace))
        await refresh()
        setError(null)
        announceWorkspaceChange()
        return result
      } catch (mergeError) {
        if (!(mergeError instanceof OptimisticWriteCancelledError)) {
          setError(errorMessage(mergeError))
        }
        try {
          await recoverWriteQueue()
        } catch (refreshError) {
          setError(errorMessage(refreshError))
        }
        throw mergeError
      }
    },
    [announceWorkspaceChange, queueWrite, recoverWriteQueue, refresh],
  )

  const resetDemo = useCallback(async () => {
    await replaceWith(createDemoWorkspace())
  }, [replaceWith])

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
      loading,
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
    [data, error, loading, mergeWith, refresh, replaceWith, resetDemo, saving, setActiveProject, updateData],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
