import { useLayoutEffect } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceExperience } from '../App'
import {
  LocalWorkspaceManagerError,
  type OpenedLocalWorkspaceSession,
  type WorkspaceRepositoryPort,
} from '../db/localWorkspaceManager'
import { createDemoWorkspace } from '../models/demo'
import { WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import { useWorkspaceSession } from '../hooks/useWorkspaceSession'
import { I18nProvider } from '../i18n'
import {
  WorkspaceSessionProvider,
  type WorkspaceSessionManager,
} from './WorkspaceSessionContext'
import type { WorkspaceSessionContextValue } from './workspace-session-context'
import type {
  WorkspaceSessionChannel,
  WorkspaceSessionMessage,
} from './workspace-session-channel'
import { readMountableSnapshot } from './session-snapshot'

let latest: WorkspaceSessionContextValue | null = null

class TestChannel implements WorkspaceSessionChannel {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  posted: WorkspaceSessionMessage[] = []
  closed = false

  postMessage(message: WorkspaceSessionMessage) {
    this.posted.push(message)
  }

  emit(message: WorkspaceSessionMessage) {
    this.onmessage?.({ data: message } as MessageEvent<unknown>)
  }

  close() {
    this.closed = true
  }
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  values: Map<string, string>
} {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

function entry(overrides: Partial<WorkspaceRegistryEntry> = {}): WorkspaceRegistryEntry {
  return {
    id: 'demo-workspace',
    storageId: 'demo-storage',
    displayName: 'Synthetic demo',
    kind: 'demo',
    encryptionMode: 'standard',
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    storageSchemaVersion: 3,
    registryRevision: 1,
    autoLock: 'never',
    state: 'ready',
    ...overrides,
  }
}

function repository(snapshot = createDemoWorkspace()): WorkspaceRepositoryPort {
  return {
    getWorkspaceSnapshot: vi.fn(async () => snapshot),
    replaceWorkspace: vi.fn(async (next) => next),
    mergeWorkspace: vi.fn(),
    refresh: vi.fn(async () => snapshot),
    close: vi.fn(),
  }
}

function opened(workspace = entry()): OpenedLocalWorkspaceSession {
  const snapshot = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
  snapshot.workspace.id = workspace.id
  return {
    entry: workspace,
    snapshot,
    mode: workspace.encryptionMode,
    storageId: workspace.storageId,
    repository: repository(snapshot),
  }
}

function managerFixture(options: {
  active?: WorkspaceRegistryEntry
  activeSession?: OpenedLocalWorkspaceSession
} = {}) {
  const active = options.active ?? entry()
  const activeSession = options.activeSession ?? opened(active)
  const recoverable = entry({
    id: 'recoverable-workspace',
    storageId: 'recoverable-storage',
    displayName: 'Recoverable setup',
    kind: 'personal',
    state: 'provisioning',
  })
  const manager = {
    bootstrap: vi.fn(async () => ({
      migration: { status: 'absent' as const },
      workspaces: [active],
      activeWorkspaceId: active.id,
    })),
    list: vi.fn(async () => [active]),
    listRecoverableProvisioning: vi.fn(async () => [recoverable]),
    listPendingDeletions: vi.fn(async () => [] as WorkspaceRegistryEntry[]),
    get: vi.fn(async () => active),
    setActive: vi.fn(async (id?: string) => id),
    openStandard: vi.fn(async () => activeSession),
    unlockEncrypted: vi.fn(),
    createStandard: vi.fn(async () => opened(entry({ id: 'created', storageId: 'created-storage', kind: 'personal' }))),
    createEncrypted: vi.fn(),
    recoverProvisioning: vi.fn(),
    discardProvisioning: vi.fn(),
    retryFinalizeDeletion: vi.fn(),
    importPlaintextWorkspace: vi.fn(),
    restoreEncryptedBackup: vi.fn(),
    convertStandardToEncrypted: vi.fn(),
    discardEncryptedConversion: vi.fn(),
    rename: vi.fn(),
    updateAutoLock: vi.fn(),
    markExportGenerated: vi.fn(async () => active),
    resetDemo: vi.fn(),
    cleanupPlaintextSource: vi.fn(),
    delete: vi.fn(),
    close: vi.fn(),
  }
  return { manager, activeSession }
}

function Probe({
  flush,
  refreshLatest,
}: {
  flush: () => Promise<void>
  refreshLatest?: () => Promise<ReturnType<typeof createDemoWorkspace>>
}) {
  const context = useWorkspaceSession()
  const { registerResearchRuntime, session } = context
  latest = context
  useLayoutEffect(() => registerResearchRuntime({
    workspaceId: session?.entry.id ?? '',
    storageId: session?.storageId ?? '',
    flushPendingWrites: flush,
    refreshLatest: refreshLatest ?? (async () => session!.snapshot),
    getCurrentSnapshot: () => session!.snapshot,
  }), [
    registerResearchRuntime,
    session,
    flush,
    refreshLatest,
  ])
  return <div>{context.accessState}</div>
}

function SessionCapture() {
  latest = useWorkspaceSession()
  return null
}

function getContext() {
  if (!latest) throw new Error('Session context unavailable.')
  return latest
}

describe('WorkspaceSessionProvider flush boundaries', () => {
  afterEach(() => {
    cleanup()
    latest = null
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('flushes before reset and before create/import/recover side effects; a failed flush calls none', async () => {
    const { manager } = managerFixture()
    const flush = vi.fn(async () => {
      throw new LocalWorkspaceManagerError('storage-operation-failed', 'internal write detail')
    })
    const factory = () => manager as unknown as WorkspaceSessionManager
    render(
      <WorkspaceSessionProvider
        managerFactory={factory}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={flush} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    await act(async () => {
      await expect(getContext().resetDemoWorkspace('demo-workspace')).rejects.toBeInstanceOf(
        LocalWorkspaceManagerError,
      )
    })
    await act(async () => {
      await expect(getContext().createWorkspace({
        displayName: 'New workspace',
        encryptionMode: 'standard',
        autoLock: 'never',
        recoveryBoundaryAcknowledged: false,
      })).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    await act(async () => {
      await expect(
        getContext().importPlaintextWorkspaceAsNew(createDemoWorkspace()),
      ).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    await act(async () => {
      await expect(
        getContext().recoverProvisioning('recoverable-workspace'),
      ).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })

    expect(flush).toHaveBeenCalledTimes(4)
    expect(manager.resetDemo).not.toHaveBeenCalled()
    expect(manager.createStandard).not.toHaveBeenCalled()
    expect(manager.importPlaintextWorkspace).not.toHaveBeenCalled()
    expect(manager.recoverProvisioning).not.toHaveBeenCalled()
    expect(getContext().session?.entry.id).toBe('demo-workspace')
    expect(getContext().accessState).toBe('unlocked')
  })

  it('does not invoke create until a delayed flush has completed', async () => {
    const { manager } = managerFixture()
    let release!: () => void
    const flush = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        release = resolve
      }))
      .mockResolvedValue(undefined)
    const factory = () => manager as unknown as WorkspaceSessionManager
    render(
      <WorkspaceSessionProvider managerFactory={factory} channelFactory={() => null} lockingStorage={null}>
        <Probe flush={flush} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    const creating = getContext().createWorkspace({
      displayName: 'New workspace',
      encryptionMode: 'standard',
      autoLock: 'never',
      recoveryBoundaryAcknowledged: false,
    })
    await waitFor(() => expect(flush).toHaveBeenCalledTimes(1))
    expect(manager.createStandard).not.toHaveBeenCalled()
    release()
    await act(async () => creating)
    expect(manager.createStandard).toHaveBeenCalledTimes(1)
  })

  it('writes a standard UI-lock marker only after flush, and honors it on reload', async () => {
    const first = managerFixture()
    const storage = memoryStorage()
    const channel = new TestChannel()
    const flush = vi.fn().mockResolvedValue(undefined)
    const firstRender = render(
      <WorkspaceSessionProvider
        managerFactory={() => first.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => channel}
        lockingStorage={storage}
      >
        <Probe flush={flush} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    await act(async () => getContext().lockActiveWorkspace())
    expect(flush).toHaveBeenCalledOnce()
    expect(first.activeSession.repository.close).toHaveBeenCalled()
    expect(getContext().accessState).toBe('locked')
    expect([...storage.values.values()]).toEqual(['locked'])
    expect(channel.posted).toEqual([
      expect.objectContaining({ type: 'lock', workspaceId: 'demo-workspace' }),
    ])
    firstRender.unmount()
    latest = null

    const second = managerFixture()
    render(
      <WorkspaceSessionProvider
        managerFactory={() => second.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={storage}
      >
        <Probe flush={vi.fn()} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('locked'))
    expect(second.manager.openStandard).not.toHaveBeenCalled()
    expect(getContext().session).toBeNull()
  })

  it('retries auto-lock after a failed flush and closes only after a verified retry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T08:00:00.000Z'))
    const automatic = entry({ autoLock: 5 })
    const { manager } = managerFixture({ active: automatic, activeSession: opened(automatic) })
    const storage = memoryStorage()
    let rejectFlush!: () => void
    const flush = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
        rejectFlush = () => reject(
          new LocalWorkspaceManagerError('revision-conflict', 'pending write'),
        )
      }))
      .mockResolvedValue(undefined)

    render(
      <WorkspaceSessionProvider
        managerFactory={() => manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={storage}
      >
        <Probe flush={flush} />
      </WorkspaceSessionProvider>,
    )
    await act(async () => {
      for (let index = 0; index < 10; index += 1) await Promise.resolve()
    })
    expect(getContext().accessState).toBe('unlocked')

    await act(async () => vi.advanceTimersByTimeAsync(5 * 60_000))
    expect(flush).toHaveBeenCalledTimes(1)
    expect(getContext().accessState).toBe('unlocked')
    expect(getContext().session).not.toBeNull()

    let overlappingManualLock!: Promise<void>
    await act(async () => {
      overlappingManualLock = getContext().lockActiveWorkspace()
      await Promise.resolve()
    })
    expect(flush).toHaveBeenCalledTimes(1)
    await act(async () => {
      rejectFlush()
      await overlappingManualLock
    })
    expect(getContext().accessState).toBe('unlocked')
    expect(getContext().session).not.toBeNull()

    await act(async () => vi.advanceTimersByTimeAsync(29_999))
    expect(flush).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(1))

    expect(flush).toHaveBeenCalledTimes(2)
    expect(getContext().accessState).toBe('locked')
    expect(getContext().session).toBeNull()
    expect([...storage.values.values()]).toEqual(['locked'])
  })

  it('unmounts research routes but keeps the provider alive through deferred encrypted locking', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    vi.stubGlobal('scrollTo', vi.fn())
    const encrypted = entry({
      id: 'encrypted-lock-transition',
      storageId: 'encrypted-lock-storage',
      displayName: 'Encrypted lock transition',
      kind: 'personal',
      encryptionMode: 'encrypted',
      autoLock: 'never',
    })
    const snapshot = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    snapshot.workspace.id = encrypted.id
    let snapshotClosed = false
    let releaseLock!: (epoch: number) => void
    const lockResult = new Promise<number>((resolve) => { releaseLock = resolve })
    const port = repository(snapshot)
    port.close = vi.fn(() => { snapshotClosed = true })
    const encryptedSession: OpenedLocalWorkspaceSession = {
      entry: encrypted,
      get snapshot() {
        if (snapshotClosed) {
          throw new LocalWorkspaceManagerError('manager-closed', 'closed runtime detail')
        }
        return snapshot
      },
      mode: 'encrypted',
      storageId: encrypted.storageId,
      repository: port,
      lockAllTabs: vi.fn(() => {
        snapshotClosed = true
        return lockResult
      }),
    }
    const fixture = managerFixture({ active: encrypted })
    fixture.manager.unlockEncrypted.mockResolvedValue(encryptedSession)
    const factory = () => fixture.manager as unknown as WorkspaceSessionManager
    const noChannel = () => null
    const tree = () => (
      <I18nProvider>
        <WorkspaceSessionProvider
          managerFactory={factory}
          channelFactory={noChannel}
          lockingStorage={null}
        >
          <SessionCapture />
          <WorkspaceExperience />
        </WorkspaceSessionProvider>
      </I18nProvider>
    )
    const rendered = render(tree())
    await waitFor(() => expect(getContext().accessState).toBe('locked'))
    await act(async () => getContext().unlockActiveEncrypted('not-stored-test-passphrase'))
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await waitFor(() => expect(rendered.container.querySelector('.app-shell')).not.toBeNull())

    let locking!: Promise<void>
    await act(async () => {
      locking = getContext().lockActiveWorkspace()
      await Promise.resolve()
    })
    await waitFor(() => expect(encryptedSession.lockAllTabs).toHaveBeenCalledTimes(1))
    expect(getContext().accessState).toBe('locking')
    expect(rendered.container.querySelector('.app-shell')).toBeNull()
    expect(port.close).not.toHaveBeenCalled()

    expect(() => rendered.rerender(tree())).not.toThrow()
    expect(getContext().accessState).toBe('locking')
    expect(getContext().session).toBe(encryptedSession)
    expect(port.close).not.toHaveBeenCalled()

    await act(async () => {
      releaseLock(3)
      await locking
    })
    expect(getContext().accessState).toBe('locked')
    expect(getContext().session).toBeNull()
    expect(port.close).toHaveBeenCalledTimes(1)
  }, 15_000)

  it('fails closed when an HMR-like rerender observes a closed session snapshot', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    vi.stubGlobal('scrollTo', vi.fn())
    const active = entry({ kind: 'personal' })
    const snapshot = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    snapshot.workspace.id = active.id
    let snapshotClosed = false
    const port = repository(snapshot)
    port.close = vi.fn(() => { snapshotClosed = true })
    const activeSession: OpenedLocalWorkspaceSession = {
      entry: active,
      get snapshot() {
        if (snapshotClosed) {
          throw new LocalWorkspaceManagerError('manager-closed', 'closed runtime detail')
        }
        return snapshot
      },
      mode: 'standard',
      storageId: active.storageId,
      repository: port,
    }
    const fixture = managerFixture({ active, activeSession })
    const factory = () => fixture.manager as unknown as WorkspaceSessionManager
    const noChannel = () => null
    const tree = () => (
      <I18nProvider>
        <WorkspaceSessionProvider
          managerFactory={factory}
          channelFactory={noChannel}
          lockingStorage={null}
        >
          <SessionCapture />
          <WorkspaceExperience />
        </WorkspaceSessionProvider>
      </I18nProvider>
    )
    const rendered = render(tree())
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await waitFor(() => expect(rendered.container.querySelector('.app-shell')).not.toBeNull())

    port.close()
    expect(() => rendered.rerender(tree())).not.toThrow()
    expect(rendered.container.querySelector('.app-shell')).toBeNull()
    await waitFor(() => expect(getContext().accessState).toBe('locked'))
    expect(getContext().session).toBeNull()
    expect(JSON.stringify(getContext().error)).not.toContain('closed runtime detail')

    const unexpected = opened(active)
    Object.defineProperty(unexpected, 'snapshot', {
      get: () => { throw new Error('unexpected render failure') },
    })
    expect(() => readMountableSnapshot(unexpected)).toThrow('unexpected render failure')

    const previousHmrGeneration = opened(active)
    const previousGenerationError = Object.assign(new Error('closed previous generation'), {
      name: 'LocalWorkspaceManagerError',
      code: 'manager-closed',
    })
    Object.defineProperty(previousHmrGeneration, 'snapshot', {
      get: () => { throw previousGenerationError },
    })
    expect(readMountableSnapshot(previousHmrGeneration)).toBeNull()
  }, 15_000)

  it('ignores a stale provider invalidation after switching to a different route', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    vi.stubGlobal('scrollTo', vi.fn())
    const oldEntry = entry({ kind: 'personal' })
    const nextEntry = entry({
      id: 'next-standard-workspace',
      storageId: 'next-standard-storage',
      displayName: 'Next standard workspace',
      kind: 'personal',
    })
    const touchedNext = { ...nextEntry, registryRevision: 2 }
    const oldSnapshot = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    oldSnapshot.workspace.id = oldEntry.id
    const oldPort = repository(oldSnapshot)
    let rejectOldRefresh!: () => void
    oldPort.refresh = vi.fn(() => new Promise<ReturnType<typeof createDemoWorkspace>>((_, reject) => {
      rejectOldRefresh = () => reject(
        new LocalWorkspaceManagerError('manager-closed', 'stale old provider detail'),
      )
    }))
    const oldSession: OpenedLocalWorkspaceSession = {
      entry: oldEntry,
      snapshot: oldSnapshot,
      mode: 'standard',
      storageId: oldEntry.storageId,
      repository: oldPort,
    }
    const nextSession = opened(touchedNext)
    const fixture = managerFixture({ active: oldEntry, activeSession: oldSession })
    fixture.manager.bootstrap.mockResolvedValue({
      migration: { status: 'absent' as const },
      workspaces: [oldEntry, nextEntry],
      activeWorkspaceId: oldEntry.id,
    })
    fixture.manager.list.mockResolvedValue([oldEntry, nextEntry])
    fixture.manager.openStandard
      .mockResolvedValueOnce(oldSession)
      .mockResolvedValueOnce(nextSession)
    const factory = () => fixture.manager as unknown as WorkspaceSessionManager
    const noChannel = () => null
    render(
      <I18nProvider>
        <WorkspaceSessionProvider
          managerFactory={factory}
          channelFactory={noChannel}
          lockingStorage={null}
        >
          <SessionCapture />
          <WorkspaceExperience />
        </WorkspaceSessionProvider>
      </I18nProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(oldPort.refresh).toHaveBeenCalledTimes(1))
    await act(async () => getContext().selectWorkspace(nextEntry.id))
    expect(getContext().session?.entry.id).toBe(nextEntry.id)

    await act(async () => {
      rejectOldRefresh()
      for (let index = 0; index < 10; index += 1) await Promise.resolve()
    })
    expect(getContext().session?.entry.id).toBe(nextEntry.id)
    expect(getContext().accessState).toBe('unlocked')
    expect(nextSession.repository.close).not.toHaveBeenCalled()
    expect(JSON.stringify(getContext().error)).not.toContain('stale old provider detail')
  }, 15_000)

  it('ignores a stale provider invalidation after reopening the same route', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    vi.stubGlobal('scrollTo', vi.fn())
    const active = entry({ kind: 'personal' })
    const reopenedEntry = { ...active, registryRevision: 2 }
    const oldSnapshot = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    oldSnapshot.workspace.id = active.id
    const oldPort = repository(oldSnapshot)
    let rejectOldRefresh!: () => void
    oldPort.refresh = vi.fn(() => new Promise<ReturnType<typeof createDemoWorkspace>>(
      (_resolve, reject) => {
        rejectOldRefresh = () => reject(
          new LocalWorkspaceManagerError('manager-closed', 'stale generation detail'),
        )
      },
    ))
    const oldSession: OpenedLocalWorkspaceSession = {
      entry: active,
      snapshot: oldSnapshot,
      mode: 'standard',
      storageId: active.storageId,
      repository: oldPort,
    }
    const reopenedSession = opened(reopenedEntry)
    const fixture = managerFixture({ active, activeSession: oldSession })
    fixture.manager.openStandard
      .mockResolvedValueOnce(oldSession)
      .mockResolvedValueOnce(reopenedSession)
    fixture.manager.list.mockResolvedValue([reopenedEntry])
    const factory = () => fixture.manager as unknown as WorkspaceSessionManager
    const noChannel = () => null
    const visibilityListeners = vi.spyOn(document, 'addEventListener')
    const rendered = render(
      <I18nProvider>
        <WorkspaceSessionProvider
          managerFactory={factory}
          channelFactory={noChannel}
          lockingStorage={memoryStorage()}
        >
          <SessionCapture />
          <WorkspaceExperience />
        </WorkspaceSessionProvider>
      </I18nProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await waitFor(() => expect(rendered.container.querySelector('.app-shell')).not.toBeNull())
    await waitFor(() => expect(
      visibilityListeners.mock.calls.filter(([type]) => type === 'visibilitychange').length,
    ).toBeGreaterThanOrEqual(2))

    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(
      () => expect(oldPort.refresh).toHaveBeenCalledTimes(1),
      { timeout: 5_000 },
    )
    await act(async () => getContext().lockActiveWorkspace())
    expect(getContext().accessState).toBe('locked')
    await act(async () => getContext().openActiveStandard())
    expect(getContext().session).toBe(reopenedSession)
    const reopenedGeneration = getContext().sessionGeneration

    await act(async () => {
      rejectOldRefresh()
      for (let index = 0; index < 10; index += 1) await Promise.resolve()
    })
    expect(getContext().session).toBe(reopenedSession)
    expect(getContext().sessionGeneration).toBe(reopenedGeneration)
    expect(getContext().accessState).toBe('unlocked')
    expect(reopenedSession.repository.close).not.toHaveBeenCalled()
    expect(JSON.stringify(getContext().error)).not.toContain('stale generation detail')
  }, 15_000)

  it('fails closed when sessionStorage methods throw and always poisons the open session', async () => {
    const first = managerFixture()
    const setFails: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: () => null,
      setItem: () => { throw new Error('quota/security failure') },
      removeItem: () => undefined,
    }
    const firstRender = render(
      <WorkspaceSessionProvider
        managerFactory={() => first.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={setFails}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await act(async () => getContext().lockActiveWorkspace())
    expect(getContext().accessState).toBe('locked')
    expect(getContext().session).toBeNull()
    expect(first.activeSession.repository.close).toHaveBeenCalled()
    expect(getContext().error?.code).toBe('workspace-unavailable')
    firstRender.unmount()
    latest = null

    const second = managerFixture()
    const removeFails: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: () => 'locked',
      setItem: () => undefined,
      removeItem: () => { throw new Error('security failure') },
    }
    render(
      <WorkspaceSessionProvider
        managerFactory={() => second.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={removeFails}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('locked'))
    await act(async () => {
      await expect(getContext().openActiveStandard()).rejects.toBeInstanceOf(
        LocalWorkspaceManagerError,
      )
    })
    expect(second.activeSession.repository.close).toHaveBeenCalled()
    expect(getContext().session).toBeNull()
    expect(getContext().accessState).toBe('locked')
  })

  it('treats channel construction, post, and close failures as advisory', async () => {
    const constructorFixture = managerFixture()
    const first = render(
      <WorkspaceSessionProvider
        managerFactory={() => constructorFixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => { throw new Error('constructor failure') }}
        lockingStorage={memoryStorage()}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    first.unmount()
    expect(constructorFixture.manager.close).toHaveBeenCalledOnce()
    latest = null

    const fixture = managerFixture()
    const channel: WorkspaceSessionChannel = {
      onmessage: null,
      postMessage: vi.fn(() => { throw new Error('post failure') }),
      close: vi.fn(() => { throw new Error('close failure') }),
    }
    const second = render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => channel}
        lockingStorage={memoryStorage()}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await act(async () => getContext().lockActiveWorkspace())
    expect(getContext().accessState).toBe('locked')
    expect(fixture.activeSession.repository.close).toHaveBeenCalled()
    second.unmount()
    expect(fixture.manager.close).toHaveBeenCalledOnce()
  })

  it('never adopts a deferred import that resolves after the auto-lock transition', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T08:00:00.000Z'))
    const active = entry({ autoLock: 5 })
    const fixture = managerFixture({ active, activeSession: opened(active) })
    const importedEntry = entry({
      id: 'deferred-import',
      storageId: 'deferred-import-storage',
      displayName: 'Deferred import',
      kind: 'personal',
    })
    const importedSession = opened(importedEntry)
    let releaseImport!: (session: OpenedLocalWorkspaceSession) => void
    fixture.manager.importPlaintextWorkspace.mockImplementationOnce(
      () => new Promise<OpenedLocalWorkspaceSession>((resolve) => {
        releaseImport = resolve
      }),
    )
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={memoryStorage()}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await act(async () => {
      for (let index = 0; index < 10; index += 1) await Promise.resolve()
    })
    const importing = getContext().importPlaintextWorkspaceAsNew(createDemoWorkspace())
    await act(async () => {
      for (let index = 0; index < 4; index += 1) await Promise.resolve()
    })
    expect(fixture.manager.importPlaintextWorkspace).toHaveBeenCalledOnce()

    await act(async () => vi.advanceTimersByTimeAsync(5 * 60_000))
    expect(getContext().accessState).toBe('locked')
    releaseImport(importedSession)
    await act(async () => {
      await expect(importing).rejects.toMatchObject({ code: 'revision-conflict' })
    })
    expect(importedSession.repository.close).toHaveBeenCalled()
    expect(getContext().session).toBeNull()
    expect(getContext().accessState).toBe('locked')
  })

  it('includes plaintext file reading in the transition guard', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T08:00:00.000Z'))
    const active = entry({ autoLock: 5 })
    const fixture = managerFixture({ active, activeSession: opened(active) })
    let releaseText!: (text: string) => void
    const file = {
      text: () => new Promise<string>((resolve) => { releaseText = resolve }),
    } as unknown as File
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={memoryStorage()}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await act(async () => {
      for (let index = 0; index < 10; index += 1) await Promise.resolve()
    })
    const importing = getContext().importPlaintextWorkspaceFile(file)
    await act(async () => vi.advanceTimersByTimeAsync(5 * 60_000))
    releaseText(JSON.stringify(createDemoWorkspace()))
    await act(async () => {
      await expect(importing).rejects.toMatchObject({ code: 'revision-conflict' })
    })
    expect(fixture.manager.importPlaintextWorkspace).not.toHaveBeenCalled()
    expect(getContext().accessState).toBe('locked')
  })

  it('invalidates locally on a remote lock without posting a second lock', async () => {
    const { manager, activeSession } = managerFixture()
    const channel = new TestChannel()
    render(
      <WorkspaceSessionProvider
        managerFactory={() => manager as unknown as WorkspaceSessionManager}
        channelFactory={() => channel}
        lockingStorage={memoryStorage()}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    act(() => channel.emit({
      version: 1,
      type: 'lock',
      workspaceId: 'demo-workspace',
      storageId: 'demo-storage',
      revision: 0,
      lockEpoch: 7,
    }))

    expect(getContext().accessState).toBe('locked')
    expect(getContext().session).toBeNull()
    expect(activeSession.repository.close).toHaveBeenCalled()
    expect(channel.posted).toEqual([])
  })

  it('invalidates an open route on remote registry change and missed visibility signal', async () => {
    const first = managerFixture()
    const firstChannel = new TestChannel()
    render(
      <WorkspaceSessionProvider
        managerFactory={() => first.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => firstChannel}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    first.manager.list.mockResolvedValueOnce([
      entry({ storageId: 'replacement-storage', encryptionMode: 'encrypted' }),
    ])
    act(() => firstChannel.emit({
      version: 1,
      type: 'registry',
      workspaceId: 'demo-workspace',
      storageId: 'replacement-storage',
      revision: 2,
      lockEpoch: 0,
    }))
    await waitFor(() => expect(getContext().session).toBeNull())
    expect(getContext().accessState).toBe('locked')
    cleanup()
    latest = null

    const second = managerFixture()
    let visibility: DocumentVisibilityState = 'hidden'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => second.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    second.manager.list.mockResolvedValueOnce([])
    visibility = 'visible'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(getContext().session).toBeNull())
    expect(getContext().accessState).toBe('picker')
  })

  it('flushes and refreshes the latest committed snapshot before plaintext export', async () => {
    const original = entry({ displayName: 'Original registry title' })
    const renamed = { ...original, displayName: 'Canonical registry title', registryRevision: 2 }
    const { manager } = managerFixture({ active: original, activeSession: opened(original) })
    const latestSnapshot = createDemoWorkspace(new Date('2026-08-13T00:00:00.000Z'))
    latestSnapshot.workspace.id = 'demo-workspace'
    latestSnapshot.workspace.name = 'Stale embedded title'
    latestSnapshot.workspace.revision = 9
    const flush = vi.fn().mockResolvedValue(undefined)
    const refreshLatest = vi.fn().mockResolvedValue(latestSnapshot)
    let exportedBlob: Blob | null = null
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) => {
        exportedBlob = blob
        return 'blob:test'
      }),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={flush} refreshLatest={refreshLatest} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    manager.rename.mockResolvedValue(renamed)
    manager.list.mockResolvedValue([renamed])
    manager.get.mockResolvedValue(renamed)
    manager.markExportGenerated.mockRejectedValue(
      new LocalWorkspaceManagerError('revision-conflict', 'remote rename won'),
    )
    await act(async () => getContext().renameWorkspace(original.id, renamed.displayName))

    await act(async () => getContext().exportPlaintextWorkspace('demo-workspace'))
    expect(flush).toHaveBeenCalledOnce()
    expect(refreshLatest).toHaveBeenCalledOnce()
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(refreshLatest.mock.invocationCallOrder[0])
    expect(exportedBlob).not.toBeNull()
    const exportedText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener('load', () => resolve(String(reader.result)))
      reader.addEventListener('error', () => reject(reader.error))
      reader.readAsText(exportedBlob!)
    })
    const exported = JSON.parse(exportedText)
    expect(exported.workspace).toMatchObject({ name: 'Canonical registry title', revision: 9 })
    expect(latestSnapshot.workspace.name).toBe('Stale embedded title')
    expect(getContext().error).toBeNull()
    expect(manager.markExportGenerated).toHaveBeenCalledTimes(2)

    const importedEntry = entry({
      id: 'imported-workspace',
      storageId: 'imported-storage',
      displayName: 'Canonical registry title',
      kind: 'personal',
    })
    manager.importPlaintextWorkspace.mockResolvedValue(opened(importedEntry))
    await act(async () => getContext().importPlaintextWorkspaceFile({
      text: vi.fn(async () => exportedText),
    } as unknown as File))
    expect(manager.importPlaintextWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ name: 'Canonical registry title', revision: 9 }),
      }),
      expect.objectContaining({ displayName: 'Canonical registry title', kind: 'personal' }),
    )
  })

  it('refreshes an unlocked encrypted runtime before creating its backup', async () => {
    const encrypted = entry({
      id: 'encrypted-workspace',
      storageId: 'encrypted-storage',
      displayName: 'Encrypted fieldwork',
      kind: 'personal',
      encryptionMode: 'encrypted',
      autoLock: 15,
    })
    const snapshot = createDemoWorkspace(new Date('2026-08-13T00:00:00.000Z'))
    snapshot.workspace.id = encrypted.id
    const createBackup = vi.fn().mockResolvedValue('{"encrypted":true}')
    const encryptedSession = {
      entry: encrypted,
      snapshot,
      mode: 'encrypted',
      storageId: encrypted.storageId,
      repository: repository(snapshot),
      lockAllTabs: vi.fn().mockResolvedValue(4),
      encryptedRuntime: {
        bindingId: encrypted.storageId,
        coordinates: {},
        closed: false,
        createBackup,
      },
    } as unknown as OpenedLocalWorkspaceSession
    const { manager } = managerFixture({ active: encrypted, activeSession: encryptedSession })
    manager.unlockEncrypted.mockResolvedValue(encryptedSession)
    manager.get.mockResolvedValue({
      ...encrypted,
      displayName: 'Remote canonical encrypted title',
      registryRevision: 2,
    })
    manager.markExportGenerated.mockRejectedValue(
      new LocalWorkspaceManagerError('revision-conflict', 'remote rename won'),
    )
    const flush = vi.fn().mockResolvedValue(undefined)
    const refreshLatest = vi.fn().mockResolvedValue(snapshot)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:encrypted'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={flush} refreshLatest={refreshLatest} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('locked'))
    await act(async () => getContext().unlockActiveEncrypted('workspace unlock phrase'))
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    await act(async () => getContext().exportEncryptedWorkspace(
      encrypted.id,
      'backup passphrase value',
    ))
    expect(flush).toHaveBeenCalledOnce()
    expect(refreshLatest).toHaveBeenCalledOnce()
    expect(createBackup).toHaveBeenCalledWith(
      'backup passphrase value',
      'Remote canonical encrypted title',
    )
    expect(getContext().error).toBeNull()
    expect(refreshLatest.mock.invocationCallOrder[0]).toBeLessThan(
      createBackup.mock.invocationCallOrder[0],
    )
  })

  it('does not begin active deletion when flush fails, and locks for retry after a later delete failure', async () => {
    const first = managerFixture()
    const failedFlush = vi.fn().mockRejectedValue(
      new LocalWorkspaceManagerError('revision-conflict', 'raw participant detail'),
    )
    const firstRender = render(
      <WorkspaceSessionProvider
        managerFactory={() => first.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={failedFlush} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await act(async () => {
      await expect(getContext().deleteWorkspace('demo-workspace')).rejects.toBeInstanceOf(
        LocalWorkspaceManagerError,
      )
    })
    expect(first.manager.delete).not.toHaveBeenCalled()
    expect(getContext().session).not.toBeNull()
    expect(getContext().accessState).toBe('unlocked')
    firstRender.unmount()
    latest = null

    const second = managerFixture()
    const successfulFlush = vi.fn().mockResolvedValue(undefined)
    second.manager.delete.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('storage-operation-failed', 'raw finalization detail'),
    )
    render(
      <WorkspaceSessionProvider
        managerFactory={() => second.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={successfulFlush} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await act(async () => {
      await expect(getContext().deleteWorkspace('demo-workspace')).rejects.toBeInstanceOf(
        LocalWorkspaceManagerError,
      )
    })
    expect(successfulFlush).toHaveBeenCalledOnce()
    expect(second.manager.delete).toHaveBeenCalledOnce()
    expect(successfulFlush.mock.invocationCallOrder[0]).toBeLessThan(
      second.manager.delete.mock.invocationCallOrder[0],
    )
    expect(getContext().session).toBeNull()
    expect(getContext().accessState).toBe('locked')
    expect(getContext().error?.code).toBe('delete-failed')
  })

  it('opens the next isolated workspace after a successful active deletion', async () => {
    const fixture = managerFixture()
    const fallback = entry({
      id: 'fallback-personal',
      storageId: 'fallback-storage',
      displayName: 'Fallback research',
      kind: 'personal',
    })
    const fallbackSession = opened(fallback)
    const flush = vi.fn().mockResolvedValue(undefined)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={memoryStorage()}
      >
        <Probe flush={flush} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    fixture.manager.list.mockResolvedValue([fallback])
    fixture.manager.openStandard.mockResolvedValue(fallbackSession)

    await act(async () => getContext().deleteWorkspace('demo-workspace'))

    expect(flush).toHaveBeenCalledOnce()
    expect(fixture.manager.delete).toHaveBeenCalledOnce()
    expect(getContext().activeWorkspaceId).toBe(fallback.id)
    expect(getContext().session?.entry.id).toBe(fallback.id)
    expect(getContext().accessState).toBe('unlocked')
  })

  it('uses the touched registry revision when renaming after switching to a standard workspace', async () => {
    const active = entry()
    const target = entry({
      id: 'target-standard',
      storageId: 'target-standard-storage',
      displayName: 'Target standard',
      kind: 'personal',
      registryRevision: 7,
    })
    const touchedTarget = { ...target, registryRevision: 8 }
    const renamedTarget = {
      ...touchedTarget,
      displayName: 'Renamed target',
      registryRevision: 9,
    }
    const fixture = managerFixture({ active, activeSession: opened(active) })
    fixture.manager.bootstrap.mockResolvedValue({
      migration: { status: 'absent' as const },
      workspaces: [active, target],
      activeWorkspaceId: active.id,
    })
    fixture.manager.list
      .mockResolvedValueOnce([active, target])
      .mockResolvedValue([active, renamedTarget])
    fixture.manager.openStandard
      .mockResolvedValueOnce(fixture.activeSession)
      .mockResolvedValueOnce(opened(touchedTarget))
    fixture.manager.rename.mockResolvedValue(renamedTarget)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().workspaces).toHaveLength(2))

    await act(async () => getContext().selectWorkspace(target.id))
    expect(getContext().activeWorkspace?.registryRevision).toBe(8)
    await act(async () => getContext().renameWorkspace(target.id, renamedTarget.displayName))

    expect(fixture.manager.rename).toHaveBeenCalledWith(
      target.id,
      renamedTarget.displayName,
      8,
    )
    expect(getContext().activeWorkspace?.registryRevision).toBe(9)
  })

  it('uses the touched fallback revision when renaming after active deletion', async () => {
    const fixture = managerFixture()
    const fallback = entry({
      id: 'fallback-standard',
      storageId: 'fallback-standard-storage',
      displayName: 'Fallback standard',
      kind: 'personal',
      registryRevision: 4,
    })
    const touchedFallback = { ...fallback, registryRevision: 5 }
    const renamedFallback = {
      ...touchedFallback,
      displayName: 'Renamed fallback',
      registryRevision: 6,
    }
    fixture.manager.list
      .mockResolvedValueOnce([entry()])
      .mockResolvedValueOnce([fallback])
      .mockResolvedValue([renamedFallback])
    fixture.manager.openStandard
      .mockResolvedValueOnce(fixture.activeSession)
      .mockResolvedValueOnce(opened(touchedFallback))
    fixture.manager.rename.mockResolvedValue(renamedFallback)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    await act(async () => getContext().deleteWorkspace('demo-workspace'))
    expect(getContext().activeWorkspace?.registryRevision).toBe(5)
    await act(async () => getContext().renameWorkspace(
      fallback.id,
      renamedFallback.displayName,
    ))

    expect(fixture.manager.rename).toHaveBeenCalledWith(
      fallback.id,
      renamedFallback.displayName,
      5,
    )
    expect(getContext().activeWorkspace?.registryRevision).toBe(6)
  })

  it('does not silently reopen a UI-locked standard fallback after deletion', async () => {
    const fixture = managerFixture()
    const lockedFallback = entry({
      id: 'locked-fallback',
      storageId: 'locked-fallback-storage',
      displayName: 'Locked fallback',
      kind: 'personal',
    })
    const storage = memoryStorage()
    storage.setItem(
      'sociology-phd-desk:standard-ui-lock:v1:locked-fallback:locked-fallback-storage',
      'locked',
    )
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={storage}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    fixture.manager.list.mockResolvedValue([lockedFallback])

    await act(async () => getContext().deleteWorkspace('demo-workspace'))

    expect(getContext().activeWorkspaceId).toBe(lockedFallback.id)
    expect(getContext().session).toBeNull()
    expect(getContext().accessState).toBe('locked')
    expect(fixture.manager.openStandard).toHaveBeenCalledTimes(1)
    expect([...storage.values.values()]).toContain('locked')
  })

  it('refreshes durable deleting tombstones after a failed active deletion', async () => {
    const fixture = managerFixture()
    const tombstone = entry({ state: 'deleting', registryRevision: 2 })
    fixture.manager.list
      .mockResolvedValueOnce([entry()])
      .mockResolvedValue([])
    fixture.manager.listPendingDeletions
      .mockResolvedValueOnce([])
      .mockResolvedValue([tombstone])
    fixture.manager.delete.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('storage-operation-failed', 'finalization interrupted'),
    )
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await act(async () => {
      await expect(getContext().deleteWorkspace(tombstone.id)).rejects.toBeInstanceOf(
        LocalWorkspaceManagerError,
      )
    })
    expect(getContext().workspaces).toEqual([])
    expect(getContext().pendingDeletions).toEqual([tombstone])
    expect(getContext().error?.code).toBe('delete-failed')
  })

  it('retries a discoverable deleting tombstone through the manager API', async () => {
    const fixture = managerFixture()
    const tombstone = entry({ state: 'deleting', registryRevision: 2 })
    fixture.manager.listPendingDeletions
      .mockResolvedValueOnce([tombstone])
      .mockResolvedValue([])
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().pendingDeletions).toEqual([tombstone]))
    await act(async () => getContext().retryFinalizeDeletion(tombstone.id))
    expect(fixture.manager.retryFinalizeDeletion).toHaveBeenCalledWith(tombstone.id)
    expect(getContext().pendingDeletions).toEqual([])
  })

  it('refreshes provisioning and conversion staging after lifecycle-changing failures', async () => {
    const createFixture = managerFixture()
    const provisioning = entry({
      id: 'staged-create',
      storageId: 'staged-create-storage',
      displayName: 'Staged create',
      kind: 'personal',
      encryptionMode: 'encrypted',
      state: 'provisioning',
    })
    createFixture.manager.listRecoverableProvisioning
      .mockResolvedValueOnce([])
      .mockResolvedValue([provisioning])
    createFixture.manager.createEncrypted.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('storage-operation-failed', 'publish interrupted'),
    )
    const first = render(
      <WorkspaceSessionProvider
        managerFactory={() => createFixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await act(async () => {
      await expect(getContext().createWorkspace({
        displayName: 'Staged create',
        encryptionMode: 'encrypted',
        autoLock: 15,
        passphrase: 'long-enough-passphrase',
        recoveryBoundaryAcknowledged: true,
      })).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    expect(getContext().recoverableProvisioning).toEqual([provisioning])
    first.unmount()
    latest = null

    const active = entry({ kind: 'personal' })
    const conversionFixture = managerFixture({ active, activeSession: opened(active) })
    const staged = entry({
      kind: 'personal',
      encryptedConversion: {
        targetStorageId: 'conversion-target',
        storageSchemaVersion: 1,
        sourceRevision: 0,
        startedAt: '2026-08-12T01:00:00.000Z',
      },
      registryRevision: 2,
    })
    conversionFixture.manager.list
      .mockResolvedValueOnce([active])
      .mockResolvedValue([staged])
    conversionFixture.manager.convertStandardToEncrypted.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('storage-operation-failed', 'promotion interrupted'),
    )
    render(
      <WorkspaceSessionProvider
        managerFactory={() => conversionFixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await act(async () => {
      await expect(
        getContext().convertWorkspaceToEncrypted(active.id, 'long-enough-passphrase'),
      ).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    expect(getContext().activeWorkspace?.encryptedConversion).toEqual(staged.encryptedConversion)
    expect(getContext().accessState).toBe('locked')
  })

  it('discards only an encrypted conversion staging reservation through the manager', async () => {
    const active = entry({
      kind: 'personal',
      encryptedConversion: {
        targetStorageId: 'conversion-target',
        storageSchemaVersion: 1,
        sourceRevision: 0,
        startedAt: '2026-08-12T01:00:00.000Z',
      },
    })
    const cleared = { ...active, encryptedConversion: undefined, registryRevision: 2 }
    const fixture = managerFixture({ active, activeSession: opened(active) })
    fixture.manager.discardEncryptedConversion
      .mockRejectedValueOnce(new LocalWorkspaceManagerError(
        'provisioning-passphrase-required',
        'raw staging locator detail',
      ))
      .mockResolvedValue(cleared)
    fixture.manager.list
      .mockResolvedValueOnce([active])
      .mockResolvedValueOnce([active])
      .mockResolvedValue([cleared])
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await act(async () => {
      await expect(getContext().discardEncryptedConversion(active.id)).rejects.toBeInstanceOf(
        LocalWorkspaceManagerError,
      )
    })
    expect(fixture.manager.discardEncryptedConversion).toHaveBeenCalledWith(active.id, undefined)
    expect(getContext().activeWorkspace?.encryptedConversion).toEqual(active.encryptedConversion)
    expect(getContext().error).toMatchObject({ code: 'discard-passphrase-required' })
    expect(JSON.stringify(getContext().error)).not.toContain('raw staging locator detail')

    await act(async () => getContext().discardEncryptedConversion(
      active.id,
      'fifteen-codepoints-passphrase',
    ))
    expect(fixture.manager.discardEncryptedConversion).toHaveBeenLastCalledWith(
      active.id,
      'fifteen-codepoints-passphrase',
    )
    expect(getContext().activeWorkspace?.encryptedConversion).toBeUndefined()
    expect(getContext().session?.entry.id).toBe(active.id)
  })

  it('flushes pending encrypted writes before plaintext-source cleanup', async () => {
    const active = entry({
      id: 'encrypted-cleanup',
      storageId: 'encrypted-cleanup-storage',
      displayName: 'Encrypted cleanup',
      kind: 'personal',
      encryptionMode: 'encrypted',
      plaintextSources: [
        { id: 'plaintext-source', kind: 'standard', state: 'cleanup-pending' },
      ],
    })
    const cleaned = {
      ...active,
      registryRevision: 2,
      plaintextSources: [
        { id: 'plaintext-source', kind: 'standard' as const, state: 'removed' as const },
      ],
    }
    const activeSession = opened(active)
    const fixture = managerFixture({ active })
    fixture.manager.unlockEncrypted.mockResolvedValue(activeSession)
    fixture.manager.cleanupPlaintextSource.mockResolvedValue(cleaned)
    fixture.manager.list.mockResolvedValue([cleaned])
    let releaseFlush!: () => void
    const flush = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { releaseFlush = resolve }))
      .mockRejectedValueOnce(new LocalWorkspaceManagerError(
        'storage-operation-failed',
        'raw pending write detail',
      ))
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={flush} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('locked'))
    await act(async () => getContext().unlockActiveEncrypted('not-stored-test-passphrase'))

    const cleaning = getContext().cleanupPlaintextSource(active.id, 'plaintext-source')
    await waitFor(() => expect(flush).toHaveBeenCalledTimes(1))
    expect(fixture.manager.cleanupPlaintextSource).not.toHaveBeenCalled()
    releaseFlush()
    await act(async () => cleaning)
    expect(fixture.manager.cleanupPlaintextSource).toHaveBeenCalledWith(
      active.id,
      'plaintext-source',
    )

    await act(async () => {
      await expect(
        getContext().cleanupPlaintextSource(active.id, 'plaintext-source'),
      ).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    expect(fixture.manager.cleanupPlaintextSource).toHaveBeenCalledTimes(1)
    expect(getContext().session?.entry.id).toBe(active.id)
    expect(getContext().accessState).toBe('unlocked')
    expect(JSON.stringify(getContext().error)).not.toContain('raw pending write detail')
  })

  it('keeps an adopted session committed when the post-commit registry refresh fails', async () => {
    const fixture = managerFixture()
    const createdEntry = entry({
      id: 'created-workspace',
      storageId: 'created-storage',
      displayName: 'Created workspace',
      kind: 'personal',
    })
    const createdSession = opened(createdEntry)
    fixture.manager.createStandard.mockResolvedValue(createdSession)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await waitFor(() => expect(fixture.manager.list).toHaveBeenCalledTimes(1))
    fixture.manager.list.mockRejectedValueOnce(new Error('raw registry read detail'))

    await act(async () => getContext().createWorkspace({
      displayName: createdEntry.displayName,
      encryptionMode: 'standard',
      autoLock: 'never',
      recoveryBoundaryAcknowledged: false,
    }))

    expect(getContext().accessState).toBe('unlocked')
    expect(getContext().session?.entry.id).toBe(createdEntry.id)
    expect(getContext().activeWorkspace?.displayName).toBe(createdEntry.displayName)
    expect(createdSession.repository.close).not.toHaveBeenCalled()
    expect(getContext().error).toBeNull()
  })

  it('treats registry refresh as best-effort after a committed metadata mutation', async () => {
    const fixture = managerFixture()
    const renamed = entry({ displayName: 'Canonical renamed workspace', registryRevision: 2 })
    fixture.manager.rename.mockResolvedValue(renamed)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await waitFor(() => expect(fixture.manager.list).toHaveBeenCalledTimes(1))
    fixture.manager.list.mockRejectedValueOnce(new Error('raw registry read detail'))

    await act(async () => getContext().renameWorkspace(renamed.id, renamed.displayName))

    expect(getContext().activeWorkspace?.displayName).toBe(renamed.displayName)
    expect(getContext().error).toBeNull()
  })

  it('uses the registry revision refreshed by demo reset for the next metadata mutation', async () => {
    const fixture = managerFixture()
    const resetSnapshot = createDemoWorkspace(new Date('2026-08-12T01:00:00.000Z'))
    resetSnapshot.workspace.revision = 7
    const afterReset = entry({ registryRevision: 2, updatedAt: '2026-08-12T01:00:00.000Z' })
    const afterAutoLock = entry({
      registryRevision: 3,
      updatedAt: '2026-08-12T01:01:00.000Z',
      autoLock: 5,
    })
    fixture.manager.resetDemo.mockResolvedValue(resetSnapshot)
    fixture.manager.get.mockResolvedValue(afterReset)
    fixture.manager.list
      .mockResolvedValueOnce([entry()])
      .mockResolvedValueOnce([afterReset])
      .mockResolvedValue([afterAutoLock])
    fixture.manager.updateAutoLock.mockResolvedValue(afterAutoLock)
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    await act(async () => getContext().resetDemoWorkspace(afterReset.id))
    await act(async () => getContext().updateWorkspaceAutoLock(afterReset.id, 5))

    expect(fixture.manager.updateAutoLock).toHaveBeenCalledWith(afterReset.id, 5, 2)
    expect(getContext().activeWorkspace?.registryRevision).toBe(3)
  })

  it('converges a stale workspace picker row after another tab removes its route', async () => {
    const active = entry()
    const target = entry({
      id: 'removed-workspace',
      storageId: 'removed-storage',
      displayName: 'Removed elsewhere',
      kind: 'personal',
    })
    const fixture = managerFixture({ active, activeSession: opened(active) })
    fixture.manager.bootstrap.mockResolvedValue({
      migration: { status: 'absent' as const },
      workspaces: [active, target],
      activeWorkspaceId: active.id,
    })
    fixture.manager.list.mockResolvedValue([active, target])
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))
    await waitFor(() => expect(getContext().workspaces).toHaveLength(2))
    fixture.manager.list.mockResolvedValue([active])
    fixture.manager.openStandard.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('workspace-not-found', 'raw removed route detail'),
    )

    await act(async () => {
      await expect(getContext().selectWorkspace(target.id)).rejects.toBeInstanceOf(
        LocalWorkspaceManagerError,
      )
    })

    expect(getContext().workspaces.map((workspace) => workspace.id)).toEqual([active.id])
    expect(getContext().session).toBeNull()
    expect(getContext().accessState).toBe('locked')
    expect(getContext().error).toMatchObject({ code: 'workspace-unavailable' })
  })

  it('invalidates the open session when an active metadata mutation detects removal', async () => {
    const fixture = managerFixture()
    fixture.manager.rename.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('workspace-not-found', 'raw removed route detail'),
    )
    render(
      <WorkspaceSessionProvider
        managerFactory={() => fixture.manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('unlocked'))

    await act(async () => {
      await expect(
        getContext().renameWorkspace('demo-workspace', 'No longer reachable'),
      ).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })

    expect(getContext().session).toBeNull()
    expect(getContext().accessState).toBe('locked')
    expect(fixture.activeSession.repository.close).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(getContext().error)).not.toContain('raw removed route detail')
  })

  it('maps WebCrypto create, unlock, and import failures without exposing raw details', async () => {
    const encrypted = entry({
      id: 'encrypted-workspace',
      storageId: 'encrypted-storage',
      kind: 'personal',
      encryptionMode: 'encrypted',
    })
    const { manager } = managerFixture({ active: encrypted })
    const cryptoRaw = 'raw WebCrypto provider detail and passphrase'
    manager.createEncrypted.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('web-crypto-unavailable', cryptoRaw),
    )
    manager.unlockEncrypted.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('web-crypto-unavailable', cryptoRaw),
    )
    manager.restoreEncryptedBackup.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('web-crypto-unavailable', cryptoRaw),
    )
    render(
      <WorkspaceSessionProvider
        managerFactory={() => manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('locked'))

    await act(async () => {
      await expect(getContext().createWorkspace({
        displayName: 'Encrypted research',
        encryptionMode: 'encrypted',
        autoLock: 15,
        passphrase: 'never-render-create-passphrase',
        recoveryBoundaryAcknowledged: true,
      })).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    expect(getContext().error?.code).toBe('crypto-unavailable')

    await act(async () => {
      await expect(
        getContext().unlockActiveEncrypted('never-render-this-passphrase'),
      ).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    expect(getContext().error?.code).toBe('crypto-unavailable')
    expect(document.body).not.toHaveTextContent(cryptoRaw)

    await act(async () => {
      await expect(getContext().importEncryptedWorkspaceFile({
        file: { text: vi.fn(async () => 'opaque encrypted container') } as unknown as File,
        backupPassphrase: 'backup secret value',
        newWorkspacePassphrase: 'new workspace secret value',
        recoveryBoundaryAcknowledged: true,
      })).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    expect(getContext().error?.code).toBe('crypto-unavailable')
    expect(document.body).not.toHaveTextContent('never-render-create-passphrase')
    expect(document.body).not.toHaveTextContent('backup secret value')
  })

  it('maps malformed encrypted payloads by unlock versus import operation', async () => {
    const encrypted = entry({
      id: 'encrypted-workspace',
      storageId: 'encrypted-storage',
      kind: 'personal',
      encryptionMode: 'encrypted',
    })
    const { manager } = managerFixture({ active: encrypted })
    render(
      <WorkspaceSessionProvider
        managerFactory={() => manager as unknown as WorkspaceSessionManager}
        channelFactory={() => null}
        lockingStorage={null}
      >
        <Probe flush={vi.fn().mockResolvedValue(undefined)} />
      </WorkspaceSessionProvider>,
    )
    await waitFor(() => expect(getContext().accessState).toBe('locked'))

    const payloadRaw = 'raw vault format detail'
    manager.unlockEncrypted.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('encrypted-payload-invalid', payloadRaw),
    )
    await act(async () => {
      await expect(
        getContext().unlockActiveEncrypted('another-secret-value'),
      ).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    expect(getContext().error?.code).toBe('unlock-failed')
    expect(document.body).not.toHaveTextContent(payloadRaw)

    manager.restoreEncryptedBackup.mockRejectedValueOnce(
      new LocalWorkspaceManagerError('encrypted-payload-invalid', payloadRaw),
    )
    await act(async () => {
      await expect(getContext().importEncryptedWorkspaceFile({
        file: { text: vi.fn(async () => 'opaque encrypted container') } as unknown as File,
        backupPassphrase: 'backup secret value',
        newWorkspacePassphrase: 'new workspace secret value',
        recoveryBoundaryAcknowledged: true,
      })).rejects.toBeInstanceOf(LocalWorkspaceManagerError)
    })
    expect(getContext().error?.code).toBe('invalid-encrypted-backup')
    expect(document.body).not.toHaveTextContent(payloadRaw)
    expect(document.body).not.toHaveTextContent('backup secret value')
  })
})
