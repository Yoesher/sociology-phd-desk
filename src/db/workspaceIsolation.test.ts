import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import { createEmptyWorkspace } from '../models/empty-workspace'
import { WorkspaceValidationError } from '../utils/workspace-transfer'
import { bootstrapLocalWorkspaceFoundation } from './legacyWorkspaceMigration'
import { WorkspaceRegistryDatabase } from './registryDatabase'
import {
  deleteStandardWorkspaceDatabase,
  standardWorkspaceDatabaseExists,
} from './standardWorkspaceDatabase'
import { workspaceSnapshotsEqual } from './workspaceRepository'
import { WorkspaceRepositoryFactory } from './workspaceRepositoryFactory'

let registryDatabase: WorkspaceRegistryDatabase
let factory: WorkspaceRepositoryFactory

describe('physical workspace isolation', () => {
  beforeEach(() => {
    registryDatabase = new WorkspaceRegistryDatabase(`registry-isolation-${crypto.randomUUID()}`)
    factory = new WorkspaceRepositoryFactory(registryDatabase)
  })

  afterEach(async () => {
    const entries = await factory.registry.listWorkspaces(true)
    factory.close()
    await Promise.all(
      entries
        .filter((entry) => entry.encryptionMode === 'standard')
        .map((entry) => deleteStandardWorkspaceDatabase(entry.storageId)),
    )
    await Dexie.delete(registryDatabase.name)
  })

  it('allows identical entity IDs while writes, deletes, and replacement stay isolated', async () => {
    const anchor = new Date('2026-08-12T00:00:00.000Z')
    const workspaceA = createDemoWorkspace(anchor)
    workspaceA.workspace.id = 'workspace-a'
    workspaceA.workspace.name = 'Workspace A'
    const workspaceB = createDemoWorkspace(anchor)
    workspaceB.workspace.id = 'workspace-b'
    workspaceB.workspace.name = 'Workspace B'
    const entryA = await factory.provisionStandardWorkspace(workspaceA, {
      kind: 'personal',
      displayName: 'Workspace A',
    })
    const entryB = await factory.provisionStandardWorkspace(workspaceB, {
      kind: 'personal',
      displayName: 'Workspace B',
    })

    const openedA = await factory.openStandardWorkspace(entryA.id)
    const openedB = await factory.openStandardWorkspace(entryB.id)
    try {
      expect(openedA.snapshot.projects[0]?.id).toBe(openedB.snapshot.projects[0]?.id)
      const changedA = structuredClone(openedA.snapshot)
      changedA.projects[0]!.title = 'Only A changed'
      changedA.tasks = changedA.tasks.slice(1)
      await openedA.repository.replaceWorkspace(
        changedA,
        openedA.snapshot.workspace.revision,
      )

      const persistedA = await openedA.repository.getWorkspaceSnapshot()
      const persistedB = await openedB.repository.getWorkspaceSnapshot()
      expect(persistedA?.projects[0]?.title).toBe('Only A changed')
      expect(persistedA?.tasks).toHaveLength(workspaceA.tasks.length - 1)
      expect(persistedB && workspaceSnapshotsEqual(persistedB, workspaceB)).toBe(true)
    } finally {
      openedA.close()
      openedB.close()
    }

    const currentA = await factory.registry.getWorkspace(entryA.id)
    if (!currentA) throw new Error('Expected workspace A registry entry.')
    await factory.deleteStandardWorkspace(currentA.id, currentA.registryRevision)
    expect(await standardWorkspaceDatabaseExists(entryA.storageId)).toBe(false)

    const reopenedB = await factory.openStandardWorkspace(entryB.id)
    try {
      expect(workspaceSnapshotsEqual(reopenedB.snapshot, workspaceB)).toBe(true)
    } finally {
      reopenedB.close()
    }
  })

  it('rejects an endpoint that exists only in another workspace', async () => {
    const anchor = new Date('2026-08-12T00:00:00.000Z')
    const workspaceA = createDemoWorkspace(anchor)
    workspaceA.workspace.id = 'workspace-endpoint-a'
    const workspaceB = createEmptyWorkspace({
      id: 'workspace-endpoint-b',
      name: 'Workspace B',
      now: anchor,
    })
    await factory.provisionStandardWorkspace(workspaceA, {
      kind: 'personal',
      displayName: 'Workspace A',
    })
    const entryB = await factory.provisionStandardWorkspace(workspaceB, {
      kind: 'personal',
      displayName: 'Workspace B',
    })

    const openedB = await factory.openStandardWorkspace(entryB.id)
    try {
      const invalid = structuredClone(workspaceB)
      const link = workspaceA.claimQuestionLinks[0]
      if (!link) throw new Error('Expected demo graph link.')
      invalid.claimQuestionLinks.push({ ...link, id: 'foreign-link' })
      await expect(
        openedB.repository.replaceWorkspace(invalid, openedB.snapshot.workspace.revision),
      ).rejects.toBeInstanceOf(WorkspaceValidationError)
      const retained = await openedB.repository.getWorkspaceSnapshot()
      expect(retained && workspaceSnapshotsEqual(retained, workspaceB)).toBe(true)
    } finally {
      openedB.close()
    }
  })

  it('creates personal and demo separately, scopes demo reset, and never recreates a deleted demo', async () => {
    const anchor = new Date('2026-08-12T00:00:00.000Z')
    const legacyName = `absent-legacy-${crypto.randomUUID()}`
    const initial = await bootstrapLocalWorkspaceFoundation(registryDatabase, {
      legacyDatabaseName: legacyName,
      now: anchor,
    })
    if (!initial.personal || !initial.demo) {
      throw new Error('Expected initial personal and demo workspaces.')
    }

    const personal = await factory.openStandardWorkspace(initial.personal.id)
    const demo = await factory.openStandardWorkspace(initial.demo.id)
    const personalBefore = personal.snapshot
    try {
      expect(personal.snapshot.workspace.isDemo).toBe(false)
      expect(personal.snapshot.projects).toEqual([])
      expect(demo.snapshot.workspace.isDemo).toBe(true)
      expect(demo.snapshot.projects.length).toBeGreaterThan(0)
    } finally {
      personal.close()
      demo.close()
    }

    await factory.resetDemoWorkspace(initial.demo.id, new Date('2026-08-13T00:00:00.000Z'))
    const personalAfter = await factory.openStandardWorkspace(initial.personal.id)
    try {
      expect(workspaceSnapshotsEqual(personalAfter.snapshot, personalBefore)).toBe(true)
    } finally {
      personalAfter.close()
    }

    const currentDemo = await factory.registry.getWorkspace(initial.demo.id)
    if (!currentDemo) throw new Error('Expected demo registry entry.')
    await factory.deleteStandardWorkspace(currentDemo.id, currentDemo.registryRevision)

    const restarted = await bootstrapLocalWorkspaceFoundation(registryDatabase, {
      legacyDatabaseName: legacyName,
      now: new Date('2026-08-14T00:00:00.000Z'),
    })
    expect(restarted.personal?.id).toBe(initial.personal.id)
    expect(restarted.demo).toBeUndefined()
    expect((await factory.registry.listWorkspaces()).filter((entry) => entry.kind === 'demo')).toEqual([])
  })
})
