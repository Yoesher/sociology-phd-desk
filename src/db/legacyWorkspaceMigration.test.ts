import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDemoWorkspace, DEMO_WORKSPACE_ID } from '../models/demo'
import { WORKSPACE_APPLICATION } from '../models/domain'
import { SociologyPhdDeskDatabase } from './database'
import {
  LegacyWorkspaceMigrationError,
  bootstrapLocalWorkspaceFoundation,
  migrateLegacySingleton,
  readLegacySingleton,
} from './legacyWorkspaceMigration'
import { WorkspaceRegistryDatabase, WorkspaceRegistryRepository } from './registryDatabase'
import { deleteStandardWorkspaceDatabase } from './standardWorkspaceDatabase'
import {
  StandardWorkspaceRepository,
  workspaceSnapshotsEqual,
} from './workspaceRepository'
import { WorkspaceRepositoryFactory } from './workspaceRepositoryFactory'

const storesV1 = {
  workspaces: '&id, updatedAt',
  projects: '&id, status, method, updatedAt',
  tasks: '&id, projectId, status, category, dueDate, priority',
  literature: '&id, projectId, status, priority, year',
  fieldSites: '&id, projectId, status',
  interviews: '&id, projectId, fieldSiteId, status, interviewDate',
  fieldVisits: '&id, projectId, fieldSiteId, date',
  datasets: '&id, projectId, name',
  analysisRuns: '&id, projectId, datasetId, status, date',
  evidence: '&id, projectId, evidenceType, supportLevel',
  researchLogs: '&id, projectId, date',
  manuscripts: '&id, projectId, status, deadline',
  submissions: '&id, projectId, manuscriptId, status, submissionDate',
  reviewerComments: '&id, submissionId, status, severity',
}

const storesV2 = { ...storesV1, workspaces: '&id, revision, updatedAt' }

const legacyCollectionNames = [
  'tasks',
  'literature',
  'fieldSites',
  'interviews',
  'fieldVisits',
  'datasets',
  'analysisRuns',
  'evidence',
  'researchLogs',
  'manuscripts',
  'submissions',
  'reviewerComments',
] as const

function legacyV2Data(anchor: Date): Record<string, unknown> {
  const current = createDemoWorkspace(anchor)
  const question = current.researchQuestions[0]
  if (!question) throw new Error('Expected demo research question.')
  return {
    application: WORKSPACE_APPLICATION,
    version: 2,
    exportedAt: anchor.toISOString(),
    workspace: current.workspace,
    projects: current.projects.map((project) => ({
      ...project,
      researchQuestion: question.projectId === project.id ? question.text : '',
    })),
    ...Object.fromEntries(
      legacyCollectionNames.map((name) => [name, structuredClone(current[name])]),
    ),
  }
}

async function seedLegacyDatabase(
  databaseName: string,
  version: 1 | 2 | 3,
  workspaceId?: string,
): Promise<void> {
  const anchor = new Date('2026-08-12T00:00:00.000Z')
  if (version === 3) {
    const snapshot = createDemoWorkspace(anchor)
    if (workspaceId) {
      snapshot.workspace.id = workspaceId
      snapshot.workspace.name = 'Edited legacy workspace'
      snapshot.workspace.isDemo = false
      snapshot.workspace.revision = 2
    }
    const database = new SociologyPhdDeskDatabase(databaseName)
    const repository = new StandardWorkspaceRepository(database, snapshot.workspace.id)
    await repository.provisionWorkspace(snapshot)
    repository.close()
    return
  }

  const input = legacyV2Data(anchor)
  const database = new Dexie(databaseName)
  database.version(version).stores(version === 1 ? storesV1 : storesV2)
  const workspace = structuredClone(input['workspace']) as Record<string, unknown>
  if (version === 1) delete workspace['revision']
  await database.table('workspaces').put(workspace)
  await database.table('projects').bulkPut(input['projects'] as unknown[])
  for (const name of legacyCollectionNames) {
    await database.table(name).bulkPut(input[name] as unknown[])
  }
  database.close()
}

let registryDatabase: WorkspaceRegistryDatabase
let registry: WorkspaceRegistryRepository
let legacyNames: string[]

describe('legacy singleton migration', () => {
  beforeEach(() => {
    registryDatabase = new WorkspaceRegistryDatabase(`registry-migration-${crypto.randomUUID()}`)
    registry = new WorkspaceRegistryRepository(registryDatabase)
    legacyNames = []
  })

  afterEach(async () => {
    const ledgers = await registryDatabase.migrations.toArray()
    const entries = await registry.listWorkspaces(true)
    registry.close()
    await Promise.all(
      [...new Set([...ledgers.map((item) => item.targetStorageId), ...entries.map((item) => item.storageId)])]
        .map((storageId) => deleteStandardWorkspaceDatabase(storageId)),
    )
    await Dexie.delete(registryDatabase.name)
    await Promise.all(legacyNames.map((name) => Dexie.delete(name)))
  })

  it.each([1, 2, 3] as const)(
    'copies and read-back verifies legacy database v%s without changing the source',
    async (version) => {
      const legacyName = `legacy-v${version}-${crypto.randomUUID()}`
      legacyNames.push(legacyName)
      await seedLegacyDatabase(legacyName, version)
      const before = await readLegacySingleton(legacyName)
      if (before.status !== 'workspace') throw new Error('Expected legacy workspace.')

      const migrated = await migrateLegacySingleton(registryDatabase, {
        legacyDatabaseName: legacyName,
      })
      expect(migrated.status).toBe('migrated')
      expect(migrated.entry?.plaintextSources).toEqual([
        expect.objectContaining({
          kind: 'legacy',
          sourceDatabaseName: legacyName,
          state: 'retained',
        }),
      ])

      const after = await readLegacySingleton(legacyName)
      expect(after.status).toBe('workspace')
      if (after.status !== 'workspace' || !migrated.entry) {
        throw new Error('Expected migrated snapshots.')
      }
      expect(after.databaseVersion).toBe(version)
      expect(workspaceSnapshotsEqual(before.snapshot, after.snapshot)).toBe(true)

      const targetDatabase = new SociologyPhdDeskDatabase(
        `sociology-phd-desk-workspace-${migrated.entry.storageId}`,
      )
      const target = new StandardWorkspaceRepository(targetDatabase, migrated.entry.id)
      try {
        const copied = await target.getWorkspaceSnapshot()
        expect(copied && workspaceSnapshotsEqual(copied, before.snapshot)).toBe(true)
      } finally {
        target.close()
      }

      const repeated = await migrateLegacySingleton(registryDatabase, {
        legacyDatabaseName: legacyName,
      })
      expect(repeated.status).toBe('already-migrated')
      expect(await registry.listWorkspaces()).toHaveLength(1)
      expect(await registryDatabase.migrations.count()).toBe(1)
    },
  )

  it('classifies only the exact current fixture as demo', async () => {
    const pristineName = `legacy-pristine-${crypto.randomUUID()}`
    const editedName = `legacy-edited-${crypto.randomUUID()}`
    legacyNames.push(pristineName, editedName)
    await seedLegacyDatabase(pristineName, 3)
    const pristine = await migrateLegacySingleton(registryDatabase, {
      legacyDatabaseName: pristineName,
    })
    expect(pristine.entry?.kind).toBe('demo')

    const secondRegistry = new WorkspaceRegistryDatabase(`registry-edited-${crypto.randomUUID()}`)
    const secondRepository = new WorkspaceRegistryRepository(secondRegistry)
    await seedLegacyDatabase(editedName, 3, DEMO_WORKSPACE_ID)
    const bootstrapped = await bootstrapLocalWorkspaceFoundation(secondRegistry, {
      legacyDatabaseName: editedName,
    })
    expect(bootstrapped.migration.entry?.kind).toBe('personal')
    expect(bootstrapped.personal?.id).toBe(DEMO_WORKSPACE_ID)
    expect(bootstrapped.demo?.id).not.toBe(DEMO_WORKSPACE_ID)
    if (!bootstrapped.personal || !bootstrapped.demo) {
      throw new Error('Expected edited legacy personal plus synthetic demo.')
    }
    const factory = new WorkspaceRepositoryFactory(secondRegistry)
    const personal = await factory.openStandardWorkspace(bootstrapped.personal.id)
    const personalBefore = personal.snapshot
    personal.close()
    await factory.resetDemoWorkspace(
      bootstrapped.demo.id,
      new Date('2026-08-13T00:00:00.000Z'),
    )
    const personalAfter = await factory.openStandardWorkspace(bootstrapped.personal.id)
    expect(workspaceSnapshotsEqual(personalAfter.snapshot, personalBefore)).toBe(true)
    personalAfter.close()
    const ledgers = await secondRegistry.migrations.toArray()
    const entries = await secondRepository.listWorkspaces(true)
    factory.close()
    secondRepository.close()
    await Promise.all(
      [...ledgers.map((item) => item.targetStorageId), ...entries.map((item) => item.storageId)]
        .map((storageId) => deleteStandardWorkspaceDatabase(storageId)),
    )
    await Dexie.delete(secondRegistry.name)
  })

  it('does not publish when the legacy revision changes during copy', async () => {
    const legacyName = `legacy-race-${crypto.randomUUID()}`
    legacyNames.push(legacyName)
    await seedLegacyDatabase(legacyName, 3, 'legacy-race-workspace')

    await expect(
      migrateLegacySingleton(registryDatabase, {
        legacyDatabaseName: legacyName,
        hooks: {
          afterTargetVerified: async () => {
            const writer = new SociologyPhdDeskDatabase(legacyName)
            await writer.workspaces.update('legacy-race-workspace', {
              revision: 3,
              updatedAt: '2026-08-12T03:00:00.000Z',
            })
            writer.close()
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'source-changed-during-copy' })

    expect(await registry.listWorkspaces(true)).toEqual([])
    expect(await registryDatabase.migrations.toCollection().first()).toMatchObject({
      status: 'failed',
      errorCode: 'source-changed-during-copy',
    })
    const source = await readLegacySingleton(legacyName)
    expect(source.status === 'workspace' && source.snapshot.workspace.revision).toBe(3)
  })

  it('never overwrites an unregistered same-id physical migration target', async () => {
    const legacyName = `legacy-target-collision-${crypto.randomUUID()}`
    legacyNames.push(legacyName)
    const workspaceId = 'legacy-target-collision-workspace'
    const targetStorageId = crypto.randomUUID()
    await seedLegacyDatabase(legacyName, 3, workspaceId)

    const unrelated = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    unrelated.workspace.id = workspaceId
    unrelated.workspace.name = 'Unrelated existing physical database'
    unrelated.workspace.isDemo = false
    const targetRepository = new StandardWorkspaceRepository(
      new SociologyPhdDeskDatabase(
        `sociology-phd-desk-workspace-${targetStorageId}`,
      ),
      workspaceId,
    )
    await targetRepository.provisionWorkspace(unrelated)
    targetRepository.close()

    await expect(
      migrateLegacySingleton(registryDatabase, {
        legacyDatabaseName: legacyName,
        hooks: { targetStorageIdFactory: () => targetStorageId },
      }),
    ).rejects.toMatchObject({ code: 'target-storage-exists' })
    expect(await registryDatabase.migrations.count()).toBe(0)
    expect(await registry.listWorkspaces(true)).toEqual([])

    const verifier = new StandardWorkspaceRepository(
      new SociologyPhdDeskDatabase(
        `sociology-phd-desk-workspace-${targetStorageId}`,
      ),
      workspaceId,
    )
    const retained = await verifier.getWorkspaceSnapshot()
    verifier.close()
    expect(retained && workspaceSnapshotsEqual(retained, unrelated)).toBe(true)
    await deleteStandardWorkspaceDatabase(targetStorageId)
  })

  it('continues bootstrap with the verified target when legacy diverges after publish', async () => {
    const legacyName = `legacy-post-publish-${crypto.randomUUID()}`
    legacyNames.push(legacyName)
    await seedLegacyDatabase(legacyName, 3, 'legacy-post-publish-workspace')
    const migrated = await migrateLegacySingleton(registryDatabase, {
      legacyDatabaseName: legacyName,
    })
    if (!migrated.entry) throw new Error('Expected a verified migration target.')
    const targetDatabase = new SociologyPhdDeskDatabase(
      `sociology-phd-desk-workspace-${migrated.entry.storageId}`,
    )
    const targetRepository = new StandardWorkspaceRepository(
      targetDatabase,
      migrated.entry.id,
    )
    const verifiedTarget = await targetRepository.getWorkspaceSnapshot()
    targetRepository.close()
    if (!verifiedTarget) throw new Error('Expected the verified target snapshot.')

    const legacyWriter = new SociologyPhdDeskDatabase(legacyName)
    await legacyWriter.workspaces.update(migrated.entry.id, {
      name: 'Legacy changed after publish',
      revision: verifiedTarget.workspace.revision + 1,
      updatedAt: '2026-08-12T05:00:00.000Z',
    })
    legacyWriter.close()

    const resumed = await bootstrapLocalWorkspaceFoundation(registryDatabase, {
      legacyDatabaseName: legacyName,
      now: new Date('2026-08-13T00:00:00.000Z'),
    })
    expect(resumed.migration.status).toBe('diverged-after-migration')
    expect(resumed.personal?.id).toBe(migrated.entry.id)
    expect(resumed.demo?.kind).toBe('demo')
    expect((await registry.getMigration(migrated.entry.legacyMigrationKey!))?.errorCode).toBe(
      'source-or-target-diverged-after-publish',
    )

    const reopenedTarget = new StandardWorkspaceRepository(
      new SociologyPhdDeskDatabase(
        `sociology-phd-desk-workspace-${migrated.entry.storageId}`,
      ),
      migrated.entry.id,
    )
    try {
      const retained = await reopenedTarget.getWorkspaceSnapshot()
      expect(retained && workspaceSnapshotsEqual(retained, verifiedTarget)).toBe(true)
    } finally {
      reopenedTarget.close()
    }
  })

  it('blocks orphan and multiple-meta legacy databases without deleting their rows', async () => {
    const orphanName = `legacy-orphan-${crypto.randomUUID()}`
    legacyNames.push(orphanName)
    const orphan = new Dexie(orphanName)
    orphan.version(3).stores({ workspaces: '&id, revision', projects: '&id' })
    await orphan.table('projects').put({ id: 'orphan-project', title: 'retain me' })
    orphan.close()

    await expect(readLegacySingleton(orphanName)).rejects.toMatchObject({
      code: 'orphan-records',
    })
    const orphanCheck = new Dexie(orphanName)
    await orphanCheck.open()
    expect(await orphanCheck.table('projects').get('orphan-project')).toMatchObject({
      title: 'retain me',
    })
    orphanCheck.close()

    const multipleName = `legacy-multiple-${crypto.randomUUID()}`
    legacyNames.push(multipleName)
    const multiple = new Dexie(multipleName)
    multiple.version(3).stores({ workspaces: '&id, revision' })
    await multiple.table('workspaces').bulkPut([
      { id: 'workspace-one', revision: 0 },
      { id: 'workspace-two', revision: 0 },
    ])
    multiple.close()
    await expect(readLegacySingleton(multipleName)).rejects.toBeInstanceOf(
      LegacyWorkspaceMigrationError,
    )
    const multipleCheck = new Dexie(multipleName)
    await multipleCheck.open()
    expect(await multipleCheck.table('workspaces').count()).toBe(2)
    multipleCheck.close()
    expect(await registry.listWorkspaces(true)).toEqual([])
  })
})
