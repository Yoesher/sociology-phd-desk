import { StrictMode, useContext } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LocalWorkspaceManagerError,
  type WorkspaceRepositoryPort,
} from '../db/localWorkspaceManager'
import { createDemoWorkspace } from '../models/demo'
import { MAX_SERIALIZED_WORKSPACE_BYTES, workspaceSerializedBytes } from '../utils/workspace-capacity'
import type { WorkspaceData } from '../models/domain'
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context'
import { WorkspaceProvider } from './WorkspaceContext'
import type { WorkspaceResearchRuntimeControl } from './workspace-session-context'
import type { WorkspaceSessionChannel, WorkspaceSessionMessage } from './workspace-session-channel'

let latestContext: WorkspaceContextValue | null = null

function ContextProbe() {
  latestContext = useContext(WorkspaceContext)
  return null
}

function getContext(): WorkspaceContextValue {
  if (!latestContext) throw new Error('Workspace context has not rendered.')
  return latestContext
}

function repository(overrides: Partial<WorkspaceRepositoryPort> = {}): WorkspaceRepositoryPort {
  return {
    getWorkspaceSnapshot: vi.fn(),
    replaceWorkspace: vi.fn(),
    mergeWorkspace: vi.fn(),
    refresh: vi.fn(),
    close: vi.fn(),
    ...overrides,
  }
}

describe('WorkspaceProvider optimistic write queue', () => {
  beforeEach(() => {
    latestContext = null
    vi.stubGlobal('BroadcastChannel', undefined)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('cancels dependent B2 after B1 conflicts and exposes only a stable safe error code', async () => {
    const initial = createDemoWorkspace(new Date('2026-04-10T09:30:00.000Z'))
    const winnerFromA = structuredClone(initial)
    winnerFromA.workspace.name = 'Writer A result'
    winnerFromA.workspace.revision = 1
    const port = repository({
      replaceWorkspace: vi.fn(async (_snapshot: WorkspaceData, expectedRevision: number) => {
        if (expectedRevision === 0) {
          throw new LocalWorkspaceManagerError('revision-conflict', 'sensitive internal detail')
        }
        return winnerFromA
      }),
      refresh: vi.fn(async () => winnerFromA),
    })
    const onExternalLock = vi.fn()

    render(
      <WorkspaceProvider
        repository={port}
        initialSnapshot={initial}
        workspaceId={initial.workspace.id}
        storageId="storage-demo"
        onExternalLock={onExternalLock}
      >
        <ContextProbe />
      </WorkspaceProvider>,
    )

    let outcomes: PromiseSettledResult<void>[] = []
    await act(async () => {
      const b1 = getContext().updateData((current) => ({
        ...current,
        workspace: { ...current.workspace, name: 'Writer B change 1' },
      }))
      const b2 = getContext().updateData((current) => ({
        ...current,
        workspace: { ...current.workspace, name: 'Writer B change 2' },
      }))
      outcomes = await Promise.allSettled([b1, b2])
    })

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'rejected'])
    expect(port.replaceWorkspace).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(getContext().data?.workspace.name).toBe('Writer A result'))
    expect(getContext().data?.workspace.revision).toBe(1)
    expect(onExternalLock).toHaveBeenCalled()
    expect(getContext().error).toBeNull()
  })

  it('refreshLatest returns the repository winner and updates the mounted context snapshot', async () => {
    const initial = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    const latest = structuredClone(initial)
    latest.workspace.name = 'Cross-tab committed winner'
    latest.workspace.revision = 8
    const port = repository({ refresh: vi.fn(async () => latest) })
    let runtime: WorkspaceResearchRuntimeControl | null = null

    render(
      <WorkspaceProvider
        repository={port}
        initialSnapshot={initial}
        workspaceId={initial.workspace.id}
        storageId="storage-demo"
        onExternalLock={vi.fn()}
        registerRuntime={(control) => {
          runtime = control
          return () => { runtime = null }
        }}
      >
        <ContextProbe />
      </WorkspaceProvider>,
    )
    await waitFor(() => expect(runtime).not.toBeNull())

    let refreshed!: WorkspaceData
    await act(async () => {
      refreshed = await runtime!.refreshLatest()
    })
    expect(refreshed.workspace).toMatchObject({
      name: 'Cross-tab committed winner',
      revision: 8,
    })
    expect(getContext().data?.workspace).toMatchObject({
      name: 'Cross-tab committed winner',
      revision: 8,
    })
  })

  it.each(['revision', 'visibility'] as const)(
    'does not let a deferred %s refresh overwrite a mid-flight local edit',
    async (trigger) => {
      const initial = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
      let releaseRefresh!: (snapshot: WorkspaceData) => void
      let persisted = initial
      const refresh = vi.fn()
        .mockImplementationOnce(() => new Promise<WorkspaceData>((resolve) => {
          releaseRefresh = resolve
        }))
        .mockImplementation(async () => persisted)
      const port = repository({
        refresh,
        replaceWorkspace: vi.fn(async (snapshot: WorkspaceData) => {
          persisted = structuredClone(snapshot)
          return persisted
        }),
      })
      const channel: WorkspaceSessionChannel = {
        onmessage: null,
        postMessage: vi.fn(),
        close: vi.fn(),
      }
      let visibility: DocumentVisibilityState = 'hidden'
      vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)

      render(
        <WorkspaceProvider
          repository={port}
          initialSnapshot={initial}
          workspaceId={initial.workspace.id}
          storageId="storage-demo"
          onExternalLock={vi.fn()}
          channelFactory={() => trigger === 'revision' ? channel : null}
        >
          <ContextProbe />
        </WorkspaceProvider>,
      )

      if (trigger === 'revision') {
        act(() => channel.onmessage?.({ data: {
          version: 1,
          type: 'revision',
          workspaceId: initial.workspace.id,
          storageId: 'storage-demo',
          revision: 1,
          lockEpoch: 0,
        } satisfies WorkspaceSessionMessage } as MessageEvent<unknown>))
      } else {
        visibility = 'visible'
        act(() => document.dispatchEvent(new Event('visibilitychange')))
      }
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))

      const edit = getContext().updateData((current) => ({
        ...current,
        workspace: { ...current.workspace, name: 'Mid-flight local edit' },
      }))
      releaseRefresh(initial)
      await act(async () => edit)

      await waitFor(() => expect(getContext().data?.workspace.name).toBe('Mid-flight local edit'))
      expect(refresh).toHaveBeenCalledTimes(2)
      expect(getContext().data?.workspace.revision).toBe(1)
    },
  )

  it('treats channel construction, posting, and closing as advisory failures', async () => {
    const initial = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    const portWithConstructorFailure = repository()
    const first = render(
      <WorkspaceProvider
        repository={portWithConstructorFailure}
        initialSnapshot={initial}
        workspaceId={initial.workspace.id}
        storageId="storage-demo"
        onExternalLock={vi.fn()}
        channelFactory={() => { throw new Error('constructor unavailable') }}
      >
        <ContextProbe />
      </WorkspaceProvider>,
    )
    first.unmount()
    expect(portWithConstructorFailure.close).not.toHaveBeenCalled()

    const channel: WorkspaceSessionChannel = {
      onmessage: null,
      postMessage: vi.fn(() => { throw new Error('post unavailable') }),
      close: vi.fn(() => { throw new Error('close unavailable') }),
    }
    const port = repository({
      replaceWorkspace: vi.fn(async (snapshot: WorkspaceData) => snapshot),
    })
    const second = render(
      <WorkspaceProvider
        repository={port}
        initialSnapshot={initial}
        workspaceId={initial.workspace.id}
        storageId="storage-demo"
        onExternalLock={vi.fn()}
        channelFactory={() => channel}
      >
        <ContextProbe />
      </WorkspaceProvider>,
    )
    await act(async () => getContext().updateData((current) => ({
      ...current,
      workspace: { ...current.workspace, name: 'Committed despite advisory failure' },
    })))
    second.unmount()
    expect(channel.postMessage).toHaveBeenCalledOnce()
    expect(port.close).not.toHaveBeenCalled()
  })

  it('survives the StrictMode effect probe without closing its parent-owned repository', async () => {
    const initial = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    let persisted = initial
    const port = repository({
      replaceWorkspace: vi.fn(async (snapshot: WorkspaceData) => {
        persisted = {
          ...snapshot,
          workspace: {
            ...snapshot.workspace,
            revision: snapshot.workspace.revision + 1,
          },
        }
        return persisted
      }),
      refresh: vi.fn(async () => persisted),
    })
    const rendered = render(
      <StrictMode>
        <WorkspaceProvider
          repository={port}
          initialSnapshot={initial}
          workspaceId={initial.workspace.id}
          storageId="storage-demo"
          onExternalLock={vi.fn()}
          channelFactory={() => null}
        >
          <ContextProbe />
        </WorkspaceProvider>
      </StrictMode>,
    )
    await waitFor(() => expect(latestContext).not.toBeNull())

    await act(async () => getContext().updateData((current) => ({
      ...current,
      workspace: { ...current.workspace, name: 'StrictMode write survived' },
    })))

    expect(getContext().data?.workspace.name).toBe('StrictMode write survived')
    expect(getContext().data?.workspace.revision).toBe(1)
    expect(port.replaceWorkspace).toHaveBeenCalledTimes(1)
    expect(port.close).not.toHaveBeenCalled()
    rendered.unmount()
    expect(port.close).not.toHaveBeenCalled()

    // The parent session lifecycle is the sole owner of the port close.
    port.close()
    expect(port.close).toHaveBeenCalledTimes(1)
  })

  it('rejects interactive capacity growth before changing optimistic data or calling the database', async () => {
    const initial = createDemoWorkspace(new Date('2026-10-04T00:00:00.000Z'))
    const port = repository()
    const onExternalLock = vi.fn()
    render(<WorkspaceProvider repository={port} initialSnapshot={initial} workspaceId={initial.workspace.id} storageId="storage-demo" onExternalLock={onExternalLock}><ContextProbe /></WorkspaceProvider>)
    await act(async () => {
      await expect(getContext().updateData((current) => ({
        ...current,
        researchLogs: Array.from({ length: 136 }, (_, index) => ({ ...current.researchLogs[0]!, id: `synthetic-growth-${index}`, problem: 'x'.repeat(250_000) })),
      }))).rejects.toMatchObject({ name: 'WorkspaceCapacityError' })
    })
    expect(getContext().data).toBe(initial)
    expect(getContext().data!.researchLogs).toEqual(initial.researchLogs)
    expect(port.replaceWorkspace).not.toHaveBeenCalled()
    expect(port.getWorkspaceSnapshot).not.toHaveBeenCalled()
    expect(getContext().saving).toBe(false)
    expect(getContext().error).toBe('save-failed')
    expect(onExternalLock).not.toHaveBeenCalled()
  })

  it('allows a large legacy workspace to reduce content while rejecting later growth without losing the saved reduction', async () => {
    const initial = createDemoWorkspace(new Date('2026-10-04T00:00:00.000Z'))
    initial.researchLogs = Array.from({ length: 136 }, (_, index) => ({ ...initial.researchLogs[0]!, id: `synthetic-legacy-${index}`, problem: 'x'.repeat(250_000) }))
    expect(workspaceSerializedBytes(initial)).toBeGreaterThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    let persisted = initial
    const port = repository({
      replaceWorkspace: vi.fn(async (snapshot: WorkspaceData) => { persisted = snapshot; return persisted }),
      refresh: vi.fn(async () => persisted),
    })
    render(<WorkspaceProvider repository={port} initialSnapshot={initial} workspaceId={initial.workspace.id} storageId="storage-demo" onExternalLock={vi.fn()}><ContextProbe /></WorkspaceProvider>)
    await act(async () => getContext().updateData((current) => ({ ...current, researchLogs: current.researchLogs.map((log, index) => index === 0 ? { ...log, problem: log.problem.slice(0, -2_000) } : log) })))
    expect(port.replaceWorkspace).toHaveBeenCalledTimes(1)
    expect(port.replaceWorkspace).toHaveBeenCalledWith(expect.objectContaining({ workspace: expect.objectContaining({ revision: 1 }) }), 0)
    const reduced = getContext().data!
    expect(reduced.researchLogs[0]!.problem).toHaveLength(248_000)
    expect(workspaceSerializedBytes(reduced)).toBeGreaterThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    await act(async () => {
      await expect(getContext().updateData((current) => ({ ...current, projects: current.projects.map((project, index) => index === 0 ? { ...project, notes: project.notes + 'SYNTHETIC extra research text' } : project) }))).rejects.toMatchObject({ name: 'WorkspaceCapacityError' })
    })
    expect(getContext().data).toBe(reduced)
    expect(port.replaceWorkspace).toHaveBeenCalledTimes(1)
  })

  it('checks each queued merge against the latest committed full snapshot and rejects combined capacity growth before replacement', async () => {
    const initial = createDemoWorkspace(new Date('2026-10-04T00:00:00.000Z'))
    initial.researchLogs = Array.from({ length: 124 }, (_, index) => ({ ...initial.researchLogs[0]!, id: `synthetic-current-${index}`, problem: 'x'.repeat(250_000) }))
    const firstImport = { ...initial, researchLogs: [...initial.researchLogs, ...Array.from({ length: 9 }, (_, index) => ({ ...initial.researchLogs[0]!, id: `synthetic-first-merge-${index}` }))] }
    const secondImport = { ...initial, researchLogs: [...initial.researchLogs, { ...initial.researchLogs[0]!, id: 'synthetic-second-merge' }] }
    expect(workspaceSerializedBytes(firstImport)).toBeLessThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    expect(workspaceSerializedBytes(secondImport)).toBeLessThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    expect(workspaceSerializedBytes({ ...firstImport, researchLogs: [...firstImport.researchLogs, secondImport.researchLogs.at(-1)!] })).toBeGreaterThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    let persisted = initial
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
    const port = repository({
      getWorkspaceSnapshot: vi.fn(async () => persisted),
      replaceWorkspace: vi.fn(async (snapshot: WorkspaceData, expected: number) => {
        expect(expected).toBe(persisted.workspace.revision)
        await firstGate
        persisted = snapshot
        return persisted
      }),
      refresh: vi.fn(async () => persisted),
    })
    const onExternalLock = vi.fn()
    render(<WorkspaceProvider repository={port} initialSnapshot={initial} workspaceId={initial.workspace.id} storageId="storage-demo" onExternalLock={onExternalLock}><ContextProbe /></WorkspaceProvider>)
    let outcomes: PromiseSettledResult<unknown>[] = []
    await act(async () => {
      const first = getContext().mergeWith(firstImport)
      const second = getContext().mergeWith(secondImport)
      const both = Promise.allSettled([first, second])
      await waitFor(() => expect(port.replaceWorkspace).toHaveBeenCalledTimes(1))
      releaseFirst()
      outcomes = await both
    })
    expect(outcomes[0]).toMatchObject({ status: 'fulfilled', value: { added: { researchLogs: 9 } } })
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { name: 'WorkspaceCapacityError' } })
    expect(port.mergeWorkspace).not.toHaveBeenCalled()
    expect(port.replaceWorkspace).toHaveBeenCalledTimes(1)
    expect(port.getWorkspaceSnapshot).toHaveBeenCalledTimes(2)
    expect(getContext().data!.researchLogs).toHaveLength(133)
    expect(getContext().data!.researchLogs.some((log) => log.id === 'synthetic-second-merge')).toBe(false)
    expect(getContext().data!.workspace.revision).toBe(1)
    expect(onExternalLock).not.toHaveBeenCalled()
  })

  it('merges with the fetched revision CAS and retains the existing safe conflict and identity error semantics', async () => {
    const initial = createDemoWorkspace(new Date('2026-10-04T00:00:00.000Z'))
    const fetched = { ...initial, workspace: { ...initial.workspace, revision: 7 } }
    const port = repository({
      getWorkspaceSnapshot: vi.fn(async () => fetched),
      replaceWorkspace: vi.fn().mockRejectedValue(new LocalWorkspaceManagerError('revision-conflict', 'SYNTHETIC sensitive internal text')),
      refresh: vi.fn(async () => fetched),
    })
    const onExternalLock = vi.fn()
    const rendered = render(<WorkspaceProvider repository={port} initialSnapshot={initial} workspaceId={initial.workspace.id} storageId="storage-demo" onExternalLock={onExternalLock}><ContextProbe /></WorkspaceProvider>)
    await act(async () => { await expect(getContext().mergeWith(initial)).rejects.toMatchObject({ code: 'revision-conflict' }) })
    expect(port.replaceWorkspace).toHaveBeenCalledWith(expect.objectContaining({ workspace: expect.objectContaining({ revision: 8 }) }), 7)
    expect(port.mergeWorkspace).not.toHaveBeenCalled()
    expect(onExternalLock).toHaveBeenCalledOnce()
    expect(document.body).not.toHaveTextContent('SYNTHETIC sensitive internal text')
    rendered.unmount()
    const identityPort = repository({ getWorkspaceSnapshot: vi.fn(async () => initial), refresh: vi.fn(async () => initial) })
    const identityLock = vi.fn()
    render(<WorkspaceProvider repository={identityPort} initialSnapshot={initial} workspaceId={initial.workspace.id} storageId="storage-demo" onExternalLock={identityLock}><ContextProbe /></WorkspaceProvider>)
    const wrongIdentity = { ...initial, workspace: { ...initial.workspace, id: 'synthetic-different-workspace' } }
    await act(async () => { await expect(getContext().mergeWith(wrongIdentity)).rejects.toMatchObject({ code: 'invalid-workspace' }) })
    expect(identityPort.replaceWorkspace).not.toHaveBeenCalled()
    expect(identityLock).toHaveBeenCalledOnce()
  })

  it('invalidates an opened session when refresh detects encrypted tamper', async () => {
    const initial = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    const raw = 'raw encrypted payload and participant detail'
    const port = repository({
      refresh: vi.fn().mockRejectedValue(
        new LocalWorkspaceManagerError('encrypted-payload-invalid', raw),
      ),
    })
    const onExternalLock = vi.fn()
    let runtime: WorkspaceResearchRuntimeControl | null = null
    render(
      <WorkspaceProvider
        repository={port}
        initialSnapshot={initial}
        workspaceId={initial.workspace.id}
        storageId="storage-demo"
        onExternalLock={onExternalLock}
        registerRuntime={(control) => {
          runtime = control
          return () => { runtime = null }
        }}
      >
        <ContextProbe />
      </WorkspaceProvider>,
    )
    await waitFor(() => expect(runtime).not.toBeNull())
    await act(async () => {
      await expect(runtime!.refreshLatest()).rejects.toMatchObject({
        code: 'encrypted-payload-invalid',
      })
    })
    expect(onExternalLock).toHaveBeenCalledOnce()
    expect(document.body).not.toHaveTextContent(raw)
  })
})
