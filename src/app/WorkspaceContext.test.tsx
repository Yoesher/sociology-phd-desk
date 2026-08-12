import { StrictMode, useContext } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LocalWorkspaceManagerError,
  type WorkspaceRepositoryPort,
} from '../db/localWorkspaceManager'
import { createDemoWorkspace } from '../models/demo'
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
