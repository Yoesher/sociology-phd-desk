import { useContext } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import type { WorkspaceData } from '../models/domain'
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context'
import { WorkspaceProvider } from './WorkspaceContext'

const repositoryMocks = vi.hoisted(() => ({
  getWorkspaceSnapshot: vi.fn(),
  initializeWorkspace: vi.fn(),
  mergeWorkspace: vi.fn(),
  replaceWorkspace: vi.fn(),
}))

vi.mock('../db/workspaceRepository', () => repositoryMocks)

let latestContext: WorkspaceContextValue | null = null

function ContextProbe() {
  latestContext = useContext(WorkspaceContext)
  return null
}

function getContext(): WorkspaceContextValue {
  if (!latestContext) {
    throw new Error('Workspace context has not rendered.')
  }
  return latestContext
}

describe('WorkspaceProvider optimistic write queue', () => {
  beforeEach(() => {
    latestContext = null
    vi.clearAllMocks()
    vi.stubGlobal('BroadcastChannel', undefined)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('cancels dependent B2 after B1 conflicts instead of overwriting revision-compatible A', async () => {
    const initial = createDemoWorkspace(new Date('2026-04-10T09:30:00.000Z'))
    const winnerFromA = structuredClone(initial)
    winnerFromA.workspace.name = 'Writer A result'
    winnerFromA.workspace.revision = 1

    repositoryMocks.initializeWorkspace.mockResolvedValue(initial)
    repositoryMocks.getWorkspaceSnapshot
      .mockResolvedValueOnce(initial)
      .mockResolvedValue(winnerFromA)
    repositoryMocks.replaceWorkspace.mockImplementation(
      async (_snapshot: WorkspaceData, expectedRevision?: number) => {
        if (expectedRevision === 0) {
          throw new Error('Workspace revision conflict: writer A already committed revision 1.')
        }
      },
    )

    render(
      <WorkspaceProvider>
        <ContextProbe />
      </WorkspaceProvider>,
    )
    await waitFor(() => expect(getContext().loading).toBe(false))

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
    expect(repositoryMocks.replaceWorkspace).toHaveBeenCalledTimes(1)
    expect(repositoryMocks.replaceWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ name: 'Writer B change 1', revision: 1 }),
      }),
      0,
    )
    await waitFor(() => expect(getContext().data?.workspace.name).toBe('Writer A result'))
    expect(getContext().data?.workspace.revision).toBe(1)
    expect(getContext().error).toContain('writer A already committed')
  })
})
