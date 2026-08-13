/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import Dexie from 'dexie'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEncryptedBackup,
  LocalWorkspaceCryptoSession,
  WebCryptoUnavailableError,
} from '../crypto'
import { createSyntheticLegacyV3LocalContainer } from '../crypto/legacyV3TestFixture.test-helper'
import { createDemoWorkspace } from '../models/demo'
import { createEmptyWorkspace } from '../models/empty-workspace'
import { isFullyEncryptedWorkspace, type WorkspaceRegistryEntry } from '../models/workspace-registry'
import {
  ENCRYPTED_VAULT_RECORD_ID,
  EncryptedVaultDatabase,
  cloneEncryptedVaultRecord,
  encryptedVaultDatabaseName,
} from './encryptedVaultDatabase'
import {
  createEncryptedWorkspace,
  inspectEncryptedWorkspaceRecord,
  removeEncryptedWorkspaceStorage,
  unlockEncryptedWorkspace,
} from './encryptedWorkspaceRepository'
import { SociologyPhdDeskDatabase } from './database'
import {
  LocalWorkspaceManager,
  LocalWorkspaceManagerError,
  type LocalWorkspaceManagerDependencies,
  type OpenedLocalWorkspaceSession,
  type WorkspaceOperationCoordinator,
} from './localWorkspaceManager'
import {
  WorkspaceRegistryDatabase,
  WorkspaceRegistryRepository,
} from './registryDatabase'
import {
  createStandardWorkspaceDatabase,
  deleteStandardWorkspaceDatabase,
  standardWorkspaceDatabaseName,
  standardWorkspaceDatabaseExists,
} from './standardWorkspaceDatabase'
import { StandardWorkspaceRepository, workspaceSnapshotsEqual } from './workspaceRepository'
import { WorkspaceRepositoryFactory } from './workspaceRepositoryFactory'

const PASSPHRASE = 'Correct horse battery staple 2026'
const NEW_PASSPHRASE = 'Another private workspace phrase 2026'
const BACKUP_PASSPHRASE = 'Independent backup passphrase 2026'
const WRONG_PASSPHRASE = 'independent backup passphrase 2026'
const ANCHOR = new Date('2026-08-12T08:00:00.000Z')

class InMemoryCoordinator implements WorkspaceOperationCoordinator {
  readonly crossTabSafe = true
  private readonly tails = new Map<string, Promise<void>>()

  async runExclusive<T>(storageId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(storageId) ?? Promise.resolve()
    let release = (): void => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.catch(() => undefined).then(() => gate)
    this.tails.set(storageId, tail)
    await previous.catch(() => undefined)
    try {
      return await operation()
    } finally {
      release()
      if (this.tails.get(storageId) === tail) this.tails.delete(storageId)
    }
  }
}

let registryDatabase: WorkspaceRegistryDatabase
let coordinator: InMemoryCoordinator
let managers: Set<LocalWorkspaceManager>
let standardStorageIds: Set<string>
let encryptedStorageIds: Set<string>
let legacyDatabaseNames: Set<string>

beforeAll(() => {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.randomUUID !== 'function') {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    })
  }
})

beforeEach(() => {
  registryDatabase = new WorkspaceRegistryDatabase(`manager-${crypto.randomUUID()}`)
  coordinator = new InMemoryCoordinator()
  managers = new Set()
  standardStorageIds = new Set()
  encryptedStorageIds = new Set()
  legacyDatabaseNames = new Set()
})

afterEach(async () => {
  const entries = await registryDatabase.workspaces.toArray().catch(() => [])
  rememberEntries(entries)
  for (const manager of managers) manager.close()
  await Promise.all(
    [...standardStorageIds].map((storageId) => deleteStandardWorkspaceDatabase(storageId)),
  )
  await Promise.all(
    [...encryptedStorageIds].map((storageId) => removeEncryptedWorkspaceStorage(storageId)),
  )
  await Promise.all([...legacyDatabaseNames].map((name) => Dexie.delete(name)))
  await Dexie.delete(registryDatabase.name)
})

function rememberEntries(entries: WorkspaceRegistryEntry[]): void {
  for (const entry of entries) {
    if (entry.encryptionMode === 'standard') standardStorageIds.add(entry.storageId)
    else encryptedStorageIds.add(entry.storageId)
    for (const source of entry.plaintextSources ?? []) {
      if (source.sourceStorageId) standardStorageIds.add(source.sourceStorageId)
      if (source.sourceDatabaseName) legacyDatabaseNames.add(source.sourceDatabaseName)
    }
  }
}

function rememberSession(session: OpenedLocalWorkspaceSession): OpenedLocalWorkspaceSession {
  if (session.mode === 'standard') standardStorageIds.add(session.storageId)
  else encryptedStorageIds.add(session.storageId)
  rememberEntries([session.entry])
  return session
}

function manager(
  dependencies: LocalWorkspaceManagerDependencies = {},
): LocalWorkspaceManager {
  const suppliedBindingFactory = dependencies.createBindingId
  const instance = new LocalWorkspaceManager(registryDatabase, {
    ...dependencies,
    coordinator: dependencies.coordinator ?? coordinator,
    createBindingId: () => {
      const bindingId = suppliedBindingFactory?.() ?? globalThis.crypto.randomUUID()
      encryptedStorageIds.add(bindingId)
      return bindingId
    },
  })
  managers.add(instance)
  return instance
}

function expectManagerCode(
  promise: Promise<unknown>,
  code: LocalWorkspaceManagerError['code'],
): Promise<void> {
  return expect(promise).rejects.toMatchObject({
    name: 'LocalWorkspaceManagerError',
    code,
  }) as Promise<void>
}

describe('LocalWorkspaceManager', () => {
  it('bootstraps ready routes without decrypting encrypted vaults and repairs active fallback', async () => {
    const unlock = vi.fn(async () => {
      throw new Error('bootstrap must not unlock')
    })
    const service = manager({ unlockEncrypted: unlock })
    const legacyName = `absent-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)
    const first = await service.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR })
    rememberEntries(first.workspaces)
    const personal = first.workspaces.find((entry) => entry.kind === 'personal')
    if (!personal) throw new Error('Expected a personal workspace.')

    const encryptedProvisioning: WorkspaceRegistryEntry = {
      id: 'private-route-without-open',
      storageId: crypto.randomUUID(),
      displayName: 'Private route',
      kind: 'personal',
      encryptionMode: 'encrypted',
      createdAt: ANCHOR.toISOString(),
      updatedAt: ANCHOR.toISOString(),
      schemaVersion: 3,
      storageSchemaVersion: 1,
      registryRevision: 0,
      autoLock: 15,
      state: 'provisioning',
    }
    encryptedStorageIds.add(encryptedProvisioning.storageId)
    await service.registry.beginProvisioning(encryptedProvisioning)
    const encryptedReady = await service.registry.markReady(
      encryptedProvisioning.id,
      encryptedProvisioning.registryRevision,
    )
    await service.setActive(encryptedReady.id)
    const second = await service.bootstrap({ legacyDatabaseName: legacyName })
    expect(second.activeWorkspaceId).toBe(encryptedReady.id)
    expect(unlock).not.toHaveBeenCalled()

    await registryDatabase.workspaces.delete(encryptedReady.id)
    const repaired = await service.bootstrap({ legacyDatabaseName: legacyName })
    expect(repaired.activeWorkspaceId).toBe(personal.id)
    expect(unlock).not.toHaveBeenCalled()
  })

  it('reconciles a legacy encrypted registry route only after its vault is verified as v5', async () => {
    const service = manager()
    const workspace = createEmptyWorkspace({
      id: crypto.randomUUID(),
      name: 'Legacy encrypted route',
      now: ANCHOR,
    })
    const storageId = crypto.randomUUID()
    encryptedStorageIds.add(storageId)
    const container = await createSyntheticLegacyV3LocalContainer(
      workspace,
      PASSPHRASE,
      {
        bindingId: storageId,
        storageRevision: workspace.workspace.revision,
        keyInvocation: 1,
      },
    )
    const vault = new EncryptedVaultDatabase(storageId)
    await vault.vaults.put({
      id: ENCRYPTED_VAULT_RECORD_ID,
      storageRevision: workspace.workspace.revision,
      lockEpoch: 0,
      keyInvocation: 1,
      encryptionAttempts: 1,
      ...container,
    })
    vault.close()
    const provisioning = await service.registry.beginProvisioning({
      id: workspace.workspace.id,
      storageId,
      displayName: workspace.workspace.name,
      kind: 'personal',
      encryptionMode: 'encrypted',
      createdAt: ANCHOR.toISOString(),
      updatedAt: ANCHOR.toISOString(),
      schemaVersion: 3,
      storageSchemaVersion: 1,
      registryRevision: 0,
      autoLock: 15,
      state: 'provisioning',
    })
    const ready = await service.registry.markReady(
      provisioning.id,
      provisioning.registryRevision,
    )

    await expectManagerCode(
      service.unlockEncrypted(ready.id, WRONG_PASSPHRASE),
      'authentication-failed',
    )
    expect((await service.registry.getWorkspace(ready.id))?.schemaVersion).toBe(3)

    const opened = rememberSession(
      await service.unlockEncrypted(ready.id, PASSPHRASE),
    )
    expect(opened.entry.schemaVersion).toBe(5)
    expect(opened.entry.storageSchemaVersion).toBe(1)
    expect(opened.snapshot.version).toBe(5)
    const persisted = await service.registry.getWorkspace(ready.id)
    expect(persisted?.schemaVersion).toBe(5)
    expect(persisted?.storageSchemaVersion).toBe(1)
  })

  it('converges concurrent first boot to one personal and one demo route', async () => {
    const databaseName = registryDatabase.name
    const secondRegistryDatabase = new WorkspaceRegistryDatabase(databaseName)
    const unsafeCoordinator: WorkspaceOperationCoordinator = {
      crossTabSafe: false,
      runExclusive: async (_storageId, operation) => operation(),
    }
    const first = manager({ coordinator: unsafeCoordinator })
    const second = new LocalWorkspaceManager(secondRegistryDatabase, {
      coordinator: unsafeCoordinator,
    })
    managers.add(second)
    const legacyName = `absent-concurrent-bootstrap-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)

    const [firstResult, secondResult] = await Promise.all([
      first.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR }),
      second.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR }),
    ])
    const entries = await first.registry.listWorkspaces(true)
    rememberEntries(entries)
    expect(entries.filter((entry) => entry.kind === 'personal')).toHaveLength(1)
    expect(entries.filter((entry) => entry.kind === 'demo')).toHaveLength(1)
    expect(entries.every((entry) => entry.state === 'ready')).toBe(true)
    expect(new Set(entries.map((entry) => entry.storageId)).size).toBe(2)
    expect(firstResult.workspaces).toHaveLength(2)
    expect(secondResult.workspaces).toHaveLength(2)
    await Promise.all(
      entries.map(async (entry) => {
        expect(await standardWorkspaceDatabaseExists(entry.storageId)).toBe(true)
      }),
    )
  })

  it('creates, imports, opens, and writes standard and encrypted workspaces through one port', async () => {
    const service = manager()
    const standard = rememberSession(
      await service.createStandard({ displayName: 'Standard workspace', now: ANCHOR }),
    )
    const changed = structuredClone(standard.snapshot)
    changed.workspace.name = 'Standard content name'
    const saved = await standard.repository.replaceWorkspace(
      changed,
      standard.snapshot.workspace.revision,
    )
    expect(saved.workspace.revision).toBe(1)
    standard.repository.close()
    const reopenedStandard = rememberSession(await service.openStandard(standard.entry.id))
    expect(reopenedStandard.snapshot.workspace.name).toBe('Standard content name')

    const source = createDemoWorkspace(ANCHOR)
    const imported = rememberSession(
      await service.importPlaintextWorkspace(source, {
        displayName: 'Imported isolated workspace',
        now: new Date('2026-08-12T09:00:00.000Z'),
      }),
    )
    expect(imported.mode).toBe('standard')
    expect(imported.snapshot.workspace.id).not.toBe(source.workspace.id)
    expect(imported.snapshot.workspace.revision).toBe(0)
    expect(imported.snapshot.projects).toEqual(source.projects)

    const encrypted = rememberSession(
      await service.createEncrypted(PASSPHRASE, {
        displayName: 'Encrypted workspace',
        now: ANCHOR,
      }),
    )
    expect(encrypted.mode).toBe('encrypted')
    expect(encrypted.encryptedRuntime?.bindingId).toBe(encrypted.storageId)
    encrypted.repository.close()
    const unlocked = rememberSession(
      await service.unlockEncrypted(encrypted.entry.id, PASSPHRASE),
    )
    expect(unlocked.snapshot.workspace.id).toBe(encrypted.entry.id)
  })

  it('fails closed for every operation after a standard session closes', async () => {
    const service = manager()
    const session = rememberSession(await service.createStandard({ now: ANCHOR }))
    const snapshot = structuredClone(session.snapshot)
    session.repository.close()

    await expectManagerCode(session.repository.getWorkspaceSnapshot(), 'manager-closed')
    await expectManagerCode(session.repository.refresh(), 'manager-closed')
    await expectManagerCode(
      session.repository.replaceWorkspace(snapshot, snapshot.workspace.revision),
      'manager-closed',
    )
    await expectManagerCode(
      session.repository.mergeWorkspace(snapshot),
      'manager-closed',
    )
  })

  it('never revives standard session state after a deferred refresh is closed', async () => {
    const service = manager()
    const session = rememberSession(await service.createStandard({ now: ANCHOR }))
    const originalGetSnapshot =
      StandardWorkspaceRepository.prototype.getWorkspaceSnapshot
    let announceRead = (): void => undefined
    let releaseRefresh = (): void => undefined
    const readCompleted = new Promise<void>((resolve) => {
      announceRead = resolve
    })
    const release = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const getSnapshotSpy = vi
      .spyOn(StandardWorkspaceRepository.prototype, 'getWorkspaceSnapshot')
      .mockImplementationOnce(async function (
        this: StandardWorkspaceRepository,
        ...args: Parameters<StandardWorkspaceRepository['getWorkspaceSnapshot']>
      ) {
        const snapshot = await originalGetSnapshot.apply(this, args)
        announceRead()
        await release
        return snapshot
      })

    try {
      const pendingRefresh = session.repository.refresh()
      await readCompleted
      session.repository.close()
      releaseRefresh()

      await expectManagerCode(pendingRefresh, 'manager-closed')
      expect(() => session.snapshot).toThrowError(
        expect.objectContaining({ code: 'manager-closed' }),
      )
      await expectManagerCode(
        session.repository.getWorkspaceSnapshot(),
        'manager-closed',
      )
      expect(await standardWorkspaceDatabaseExists(session.storageId)).toBe(true)
    } finally {
      releaseRefresh()
      getSnapshotSpy.mockRestore()
    }
  })

  it('poisons an active standard port when its ready physical database disappears', async () => {
    const service = manager()
    const session = rememberSession(await service.createStandard({ now: ANCHOR }))
    const snapshot = structuredClone(session.snapshot)
    await deleteStandardWorkspaceDatabase(session.storageId)

    await expectManagerCode(session.repository.refresh(), 'workspace-not-found')
    expect(() => session.snapshot).toThrowError(
      expect.objectContaining({ code: 'manager-closed' }),
    )
    await expectManagerCode(session.repository.getWorkspaceSnapshot(), 'manager-closed')
    await expectManagerCode(
      session.repository.replaceWorkspace(snapshot, snapshot.workspace.revision),
      'manager-closed',
    )
    expect(await standardWorkspaceDatabaseExists(session.storageId)).toBe(false)
  })

  it('opens a real v3 standard database and atomically reconciles its route to 5/5', async () => {
    const service = manager()
    const workspace = createEmptyWorkspace({
      id: crypto.randomUUID(),
      name: 'Legacy standard route',
      now: ANCHOR,
    })
    const storageId = crypto.randomUUID()
    standardStorageIds.add(storageId)
    const legacyDatabase = new Dexie(standardWorkspaceDatabaseName(storageId))
    legacyDatabase.version(3).stores({
      workspaces: '&id, revision, updatedAt',
      projects: '&id, status, method, updatedAt',
      researchQuestions: '&id, projectId, status, updatedAt',
      claims: '&id, projectId, status, updatedAt',
      claimQuestionLinks: '&id, projectId, claimId, researchQuestionId, updatedAt',
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
    })
    await legacyDatabase.table('workspaces').put(workspace.workspace)
    legacyDatabase.close()
    const provisioning = await service.registry.beginProvisioning({
      id: workspace.workspace.id,
      storageId,
      displayName: workspace.workspace.name,
      kind: 'personal',
      encryptionMode: 'standard',
      createdAt: ANCHOR.toISOString(),
      updatedAt: ANCHOR.toISOString(),
      schemaVersion: 3,
      storageSchemaVersion: 3,
      registryRevision: 0,
      autoLock: 'never',
      state: 'provisioning',
    })
    await service.registry.markReady(provisioning.id, provisioning.registryRevision)

    const opened = rememberSession(await service.openStandard(workspace.workspace.id))
    expect(opened.entry.schemaVersion).toBe(5)
    expect(opened.entry.storageSchemaVersion).toBe(5)
    expect(opened.snapshot.version).toBe(5)
    const persisted = await service.registry.getWorkspace(workspace.workspace.id)
    expect(persisted?.schemaVersion).toBe(5)
    expect(persisted?.storageSchemaVersion).toBe(5)

    opened.repository.close()
    const reopened = rememberSession(await service.openStandard(workspace.workspace.id))
    expect(reopened.entry.registryRevision).toBe((persisted?.registryRevision ?? 0) + 1)
    expect(reopened.entry.storageSchemaVersion).toBe(5)
  })

  it('never creates an empty database while opening or recovering a missing standard route', async () => {
    const service = manager()
    const readyStorageId = crypto.randomUUID()
    const readyProvisioning = await service.registry.beginProvisioning({
      id: 'missing-ready-standard',
      storageId: readyStorageId,
      displayName: 'Missing ready standard',
      kind: 'personal',
      encryptionMode: 'standard',
      createdAt: ANCHOR.toISOString(),
      updatedAt: ANCHOR.toISOString(),
      schemaVersion: 3,
      storageSchemaVersion: 3,
      registryRevision: 0,
      autoLock: 'never',
      state: 'provisioning',
    })
    await service.registry.markReady(
      readyProvisioning.id,
      readyProvisioning.registryRevision,
    )
    await expectManagerCode(service.openStandard(readyProvisioning.id), 'workspace-not-found')
    expect(await standardWorkspaceDatabaseExists(readyStorageId)).toBe(false)

    const stagingStorageId = crypto.randomUUID()
    await service.registry.beginProvisioning({
      id: 'missing-staging-standard',
      storageId: stagingStorageId,
      displayName: 'Missing staging standard',
      kind: 'personal',
      encryptionMode: 'standard',
      createdAt: ANCHOR.toISOString(),
      updatedAt: ANCHOR.toISOString(),
      schemaVersion: 3,
      storageSchemaVersion: 3,
      registryRevision: 0,
      autoLock: 'never',
      state: 'provisioning',
    })
    await expectManagerCode(
      service.recoverProvisioning('missing-staging-standard'),
      'workspace-not-found',
    )
    expect(await standardWorkspaceDatabaseExists(stagingStorageId)).toBe(false)
  })

  it('serializes a ready standard open against deletion on the same locator lock', async () => {
    const seed = manager()
    const created = rememberSession(await seed.createStandard({ now: ANCHOR }))
    created.repository.close()
    const base = new InMemoryCoordinator()
    let release = (): void => undefined
    let entered = (): void => undefined
    let gateFirst = true
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const openEntered = new Promise<void>((resolve) => {
      entered = resolve
    })
    const gated: WorkspaceOperationCoordinator = {
      crossTabSafe: true,
      runExclusive: (storageId, operation) =>
        base.runExclusive(storageId, async () => {
          if (gateFirst) {
            gateFirst = false
            entered()
            await gate
          }
          return operation()
        }),
    }
    const openDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const deleteDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const opener = new LocalWorkspaceManager(openDatabase, { coordinator: gated })
    const deleter = new LocalWorkspaceManager(deleteDatabase, { coordinator: gated })
    managers.add(opener)
    managers.add(deleter)

    const pendingOpen = opener.openStandard(created.entry.id)
    await openEntered
    let deletionSettled = false
    const pendingDelete = deleter.delete(created.entry.id).finally(() => {
      deletionSettled = true
    })
    await Promise.resolve()
    expect(deletionSettled).toBe(false)
    release()
    const opened = rememberSession(await pendingOpen)
    await pendingDelete
    await expectManagerCode(opened.repository.getWorkspaceSnapshot(), 'revision-conflict')
    expect(await standardWorkspaceDatabaseExists(created.storageId)).toBe(false)
  })

  it('returns a stable authentication error for a wrong local passphrase', async () => {
    const service = manager()
    const created = rememberSession(await service.createEncrypted(PASSPHRASE, { now: ANCHOR }))
    created.repository.close()

    await expectManagerCode(
      service.unlockEncrypted(created.entry.id, WRONG_PASSPHRASE),
      'authentication-failed',
    )
    expect((await service.get(created.entry.id))?.state).toBe('ready')
  })

  it('maps unavailable Web Crypto to a stable manager error code', async () => {
    const service = manager({
      createBindingId: () => {
        throw new WebCryptoUnavailableError()
      },
    })
    await expectManagerCode(
      service.createEncrypted(PASSPHRASE, {
        workspaceId: 'crypto-unavailable-workspace',
        now: ANCHOR,
      }),
      'web-crypto-unavailable',
    )
  })

  it('authenticates and validates backups before generating a registry or vault write', async () => {
    const backup = await createEncryptedBackup(
      createDemoWorkspace(ANCHOR),
      BACKUP_PASSPHRASE,
    )
    const candidateBinding = crypto.randomUUID()
    const bindingFactory = vi.fn(() => candidateBinding)
    const service = manager({ createBindingId: bindingFactory })

    await expectManagerCode(
      service.restoreEncryptedBackup(
        backup,
        WRONG_PASSPHRASE,
        NEW_PASSPHRASE,
      ),
      'authentication-failed',
    )
    expect(bindingFactory).not.toHaveBeenCalled()
    expect(await registryDatabase.workspaces.count()).toBe(0)
    expect(await Dexie.exists(encryptedVaultDatabaseName(candidateBinding))).toBe(false)

    const parsed = JSON.parse(backup) as Record<string, string>
    const first = parsed['ciphertext']?.[0]
    if (!first) throw new Error('Expected encrypted backup ciphertext.')
    parsed['ciphertext'] = `${first === 'A' ? 'B' : 'A'}${parsed['ciphertext']!.slice(1)}`
    await expectManagerCode(
      service.restoreEncryptedBackup(
        JSON.stringify(parsed),
        BACKUP_PASSPHRASE,
        NEW_PASSPHRASE,
      ),
      'authentication-failed',
    )
    expect(bindingFactory).not.toHaveBeenCalled()
    expect(await registryDatabase.workspaces.count()).toBe(0)
    expect(await Dexie.exists(encryptedVaultDatabaseName(candidateBinding))).toBe(false)
  })

  it('serializes conversion against stale writes, retains plaintext truth, and cleans explicitly', async () => {
    let cleanupMode: 'throw' | 'noop' | 'delete' = 'throw'
    let releaseEncryption = (): void => undefined
    let encryptionEntered = (): void => undefined
    const entered = new Promise<void>((resolve) => {
      encryptionEntered = resolve
    })
    const release = new Promise<void>((resolve) => {
      releaseEncryption = resolve
    })
    const serviceA = manager()
    const serviceB = manager({
      createEncrypted: async (...args) => {
        encryptionEntered()
        await release
        return createEncryptedWorkspace(...args)
      },
      deleteStandardStorage: async (storageId) => {
        if (cleanupMode === 'throw') throw new Error('simulated blocked deletion')
        if (cleanupMode === 'noop') return
        await deleteStandardWorkspaceDatabase(storageId)
      },
    })
    const created = rememberSession(
      await serviceA.createStandard({ displayName: 'Conversion source', now: ANCHOR }),
    )
    created.repository.close()
    const migrationId = 'owned-standard-source-migration'
    await registryDatabase.migrations.add({
      id: migrationId,
      sourceDatabaseName: 'owned-legacy-source',
      sourceDatabaseVersion: 3,
      sourceWorkspaceId: created.entry.id,
      sourceRevision: 0,
      targetWorkspaceId: created.entry.id,
      targetStorageId: created.storageId,
      status: 'verified',
      createdAt: ANCHOR.toISOString(),
      updatedAt: ANCHOR.toISOString(),
      verifiedAt: ANCHOR.toISOString(),
    })
    await registryDatabase.workspaces.update(created.entry.id, {
      legacyMigrationKey: migrationId,
    })
    const stale = rememberSession(await serviceA.openStandard(created.entry.id))
    const oldStorageId = stale.storageId
    standardStorageIds.add(oldStorageId)

    const conversionPromise = serviceB.convertStandardToEncrypted(
      created.entry.id,
      PASSPHRASE,
    )
    await entered
    const staleWrite = structuredClone(stale.snapshot)
    staleWrite.workspace.name = 'Write queued behind conversion'
    let writeSettled = false
    const queuedWrite = stale.repository
      .replaceWorkspace(staleWrite, stale.snapshot.workspace.revision)
      .finally(() => {
        writeSettled = true
      })
    await Promise.resolve()
    expect(writeSettled).toBe(false)
    releaseEncryption()

    const converted = rememberSession(await conversionPromise)
    await expectManagerCode(queuedWrite, 'revision-conflict')
    expect(converted.snapshot.workspace.name).not.toBe('Write queued behind conversion')
    expect(await standardWorkspaceDatabaseExists(oldStorageId)).toBe(true)
    const promoted = await serviceB.get(converted.entry.id)
    expect(promoted?.plaintextSources).toContainEqual(
      expect.objectContaining({
        sourceStorageId: oldStorageId,
        state: 'cleanup-pending',
      }),
    )
    expect(promoted && isFullyEncryptedWorkspace(promoted)).toBe(false)
    await expectManagerCode(
      serviceB.delete(converted.entry.id),
      'plaintext-source-retained',
    )

    const sourceId = `standard:${oldStorageId}`
    converted.repository.close()
    await expectManagerCode(
      serviceB.cleanupPlaintextSource(converted.entry.id, sourceId),
      'authentication-failed',
    )
    const authenticated = rememberSession(
      await serviceB.unlockEncrypted(converted.entry.id, PASSPHRASE),
    )
    await expectManagerCode(
      serviceB.cleanupPlaintextSource(converted.entry.id, sourceId),
      'plaintext-cleanup-failed',
    )
    expect((await serviceB.get(converted.entry.id))?.plaintextSources?.[0]?.state).toBe(
      'cleanup-pending',
    )
    expect(await standardWorkspaceDatabaseExists(oldStorageId)).toBe(true)

    cleanupMode = 'noop'
    await expectManagerCode(
      serviceB.cleanupPlaintextSource(converted.entry.id, sourceId),
      'plaintext-cleanup-failed',
    )
    expect((await serviceB.get(converted.entry.id))?.plaintextSources?.[0]?.state).toBe(
      'cleanup-pending',
    )
    expect(await standardWorkspaceDatabaseExists(oldStorageId)).toBe(true)

    cleanupMode = 'delete'
    const cleaned = await serviceB.cleanupPlaintextSource(converted.entry.id, sourceId)
    expect(cleaned.plaintextSources?.[0]?.state).toBe('removed')
    expect(isFullyEncryptedWorkspace(cleaned)).toBe(true)
    expect(await standardWorkspaceDatabaseExists(oldStorageId)).toBe(false)

    await expectManagerCode(stale.repository.getWorkspaceSnapshot(), 'manager-closed')
    await expectManagerCode(
      stale.repository.replaceWorkspace(staleWrite, staleWrite.workspace.revision),
      'manager-closed',
    )
    await expectManagerCode(stale.repository.mergeWorkspace(staleWrite), 'manager-closed')
    expect(await standardWorkspaceDatabaseExists(oldStorageId)).toBe(false)

    await serviceB.delete(converted.entry.id)
    authenticated.repository.close()
    expect(await serviceB.get(converted.entry.id)).toBeUndefined()
  })

  it.each(['save', 'lock'] as const)(
    'holds authenticated cleanup against a concurrent encrypted %s',
    async (action) => {
      const service = manager()
      const source = rememberSession(
        await service.createStandard({ displayName: 'Cleanup lock source', now: ANCHOR }),
      )
      source.repository.close()
      const converted = rememberSession(
        await service.convertStandardToEncrypted(source.entry.id, PASSPHRASE),
      )
      const sourceId = `standard:${source.storageId}`
      const originalDecrypt = LocalWorkspaceCryptoSession.prototype.decrypt
      let announceDecrypted = (): void => undefined
      let releaseAuthentication = (): void => undefined
      const decrypted = new Promise<void>((resolve) => {
        announceDecrypted = resolve
      })
      const release = new Promise<void>((resolve) => {
        releaseAuthentication = resolve
      })
      const decryptSpy = vi
        .spyOn(LocalWorkspaceCryptoSession.prototype, 'decrypt')
        .mockImplementationOnce(async function (
          this: LocalWorkspaceCryptoSession,
          ...args: Parameters<LocalWorkspaceCryptoSession['decrypt']>
        ) {
          const workspace = await originalDecrypt.apply(this, args)
          announceDecrypted()
          await release
          return workspace
        })

      try {
        const cleanup = service.cleanupPlaintextSource(
          converted.entry.id,
          sourceId,
        )
        await decrypted

        let competingOperation: Promise<unknown>
        if (action === 'save') {
          const changed = structuredClone(converted.snapshot)
          changed.workspace.name = 'Saved after authenticated cleanup'
          competingOperation = converted.repository.replaceWorkspace(
            changed,
            converted.snapshot.workspace.revision,
          )
        } else {
          if (!converted.lockAllTabs) throw new Error('Expected encrypted lock API.')
          competingOperation = converted.lockAllTabs()
        }
        let competingSettled = false
        const observedCompetingOperation = competingOperation.finally(() => {
          competingSettled = true
        })
        await Promise.resolve()
        expect(competingSettled).toBe(false)

        releaseAuthentication()
        const cleaned = await cleanup
        expect(cleaned.plaintextSources?.[0]?.state).toBe('removed')
        expect(await standardWorkspaceDatabaseExists(source.storageId)).toBe(false)

        if (action === 'save') {
          await expect(observedCompetingOperation).resolves.toMatchObject({
            workspace: { name: 'Saved after authenticated cleanup' },
          })
        } else {
          await expect(observedCompetingOperation).resolves.toBe(1)
          await expectManagerCode(
            converted.repository.getWorkspaceSnapshot(),
            'manager-closed',
          )
        }
      } finally {
        releaseAuthentication()
        decryptSpy.mockRestore()
      }
    },
  )

  it('keeps failed conversion staging discoverable and resumes promotion', async () => {
    const service = manager()
    const source = rememberSession(await service.createStandard({ now: ANCHOR }))
    source.repository.close()
    const current = await service.get(source.entry.id)
    if (!current) throw new Error('Expected a ready standard workspace.')
    const bindingId = crypto.randomUUID()
    encryptedStorageIds.add(bindingId)
    const collisionService = manager({ createBindingId: () => bindingId })
    vi.spyOn(collisionService.registry, 'promoteStandardToEncrypted').mockRejectedValueOnce(
      new Error('simulated registry publication failure'),
    )

    await expectManagerCode(
      collisionService.convertStandardToEncrypted(source.entry.id, PASSPHRASE),
      'storage-operation-failed',
    )
    expect(await collisionService.get(source.entry.id)).toMatchObject({
      encryptionMode: 'standard',
      storageId: current.storageId,
      encryptedConversion: { targetStorageId: bindingId },
    })
    expect(await standardWorkspaceDatabaseExists(current.storageId)).toBe(true)
    expect(await Dexie.exists(encryptedVaultDatabaseName(bindingId))).toBe(true)

    const resumed = rememberSession(
      await collisionService.convertStandardToEncrypted(source.entry.id, PASSPHRASE),
    )
    expect(resumed.entry).toMatchObject({
      encryptionMode: 'encrypted',
      storageId: bindingId,
    })
    expect(resumed.entry.encryptedConversion).toBeUndefined()
  })

  it('recovers conversion after ciphertext write interruption and can discard staging', async () => {
    const sourceService = manager()
    const source = rememberSession(await sourceService.createStandard({ now: ANCHOR }))
    source.repository.close()
    const bindingId = crypto.randomUUID()
    encryptedStorageIds.add(bindingId)
    const interrupted = manager({
      createBindingId: () => bindingId,
      createEncrypted: async (...args) => {
        const runtime = await createEncryptedWorkspace(...args)
        runtime.close()
        throw new Error('simulated crash after ciphertext write')
      },
    })

    await expectManagerCode(
      interrupted.convertStandardToEncrypted(source.entry.id, PASSPHRASE),
      'storage-operation-failed',
    )
    expect(await interrupted.get(source.entry.id)).toMatchObject({
      encryptionMode: 'standard',
      encryptedConversion: { targetStorageId: bindingId },
    })
    expect(await Dexie.exists(encryptedVaultDatabaseName(bindingId))).toBe(true)

    interrupted.close()
    registryDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const restarted = manager()
    await expectManagerCode(
      restarted.discardEncryptedConversion(source.entry.id),
      'provisioning-passphrase-required',
    )
    expect(await Dexie.exists(encryptedVaultDatabaseName(bindingId))).toBe(true)
    const beforeWrongPassphrase = await inspectEncryptedWorkspaceRecord(bindingId)
    await expectManagerCode(
      restarted.discardEncryptedConversion(source.entry.id, WRONG_PASSPHRASE),
      'authentication-failed',
    )
    expect(await inspectEncryptedWorkspaceRecord(bindingId)).toEqual(
      beforeWrongPassphrase,
    )
    const cleared = await restarted.discardEncryptedConversion(
      source.entry.id,
      PASSPHRASE,
    )
    expect(cleared.encryptionMode).toBe('standard')
    expect(cleared.encryptedConversion).toBeUndefined()
    expect(await Dexie.exists(encryptedVaultDatabaseName(bindingId))).toBe(false)
    expect(await standardWorkspaceDatabaseExists(source.storageId)).toBe(true)
  })

  it('never deletes another encrypted vault when a generated binding collides', async () => {
    const bindingId = crypto.randomUUID()
    encryptedStorageIds.add(bindingId)
    const winner = createEmptyWorkspace({
      id: 'first-private-workspace',
      name: 'Unregistered encrypted winner',
      now: ANCHOR,
    })
    const unregisteredWinner = await createEncryptedWorkspace(winner, PASSPHRASE, {
      bindingId,
    })
    unregisteredWinner.close()
    const before = await inspectEncryptedWorkspaceRecord(bindingId)
    if (!before) throw new Error('Expected the first encrypted vault.')

    const secondService = manager({ createBindingId: () => bindingId })
    await expectManagerCode(
      secondService.createEncrypted(NEW_PASSPHRASE, {
        workspaceId: 'second-private-workspace',
        now: ANCHOR,
      }),
      'storage-operation-failed',
    )
    expect(
      (await secondService.listRecoverableProvisioning()).some(
        (entry) => entry.id === 'second-private-workspace',
      ),
    ).toBe(false)
    await expectManagerCode(
      secondService.discardProvisioning('second-private-workspace'),
      'provisioning-not-found',
    )
    const standard = rememberSession(await secondService.createStandard({ now: ANCHOR }))
    standard.repository.close()
    await expectManagerCode(
      secondService.convertStandardToEncrypted(standard.entry.id, NEW_PASSPHRASE),
      'storage-operation-failed',
    )

    const after = await inspectEncryptedWorkspaceRecord(bindingId)
    expect(after?.ciphertext).toEqual(before.ciphertext)
    const stillUnlocks = await unlockEncryptedWorkspace(bindingId, PASSPHRASE)
    try {
      expect(stillUnlocks.workspace.workspace.id).toBe(winner.workspace.id)
    } finally {
      stillUnlocks.close()
    }
  })

  it('abandons an unowned standard provisioning route without touching the colliding database', async () => {
    const storageId = crypto.randomUUID()
    standardStorageIds.add(storageId)
    const winner = createEmptyWorkspace({
      id: 'unregistered-standard-winner',
      name: 'Winner',
      now: ANCHOR,
    })
    const winnerRepository = new StandardWorkspaceRepository(
      createStandardWorkspaceDatabase(storageId),
      winner.workspace.id,
    )
    await winnerRepository.provisionWorkspace(winner)
    winnerRepository.close()

    const factory = new WorkspaceRepositoryFactory(registryDatabase)
    const loser = createEmptyWorkspace({
      id: winner.workspace.id,
      name: 'Loser',
      now: ANCHOR,
    })
    await expect(
      factory.provisionStandardWorkspace(loser, {
        kind: 'personal',
        displayName: loser.workspace.name,
        storageId,
      }),
    ).rejects.toBeTruthy()
    expect(await factory.registry.getWorkspace(winner.workspace.id)).toBeUndefined()
    factory.close()

    const verifier = new StandardWorkspaceRepository(
      createStandardWorkspaceDatabase(storageId),
      winner.workspace.id,
    )
    try {
      const retained = await verifier.getWorkspaceSnapshot()
      expect(retained && workspaceSnapshotsEqual(retained, winner)).toBe(true)
    } finally {
      verifier.close()
    }
  })

  it('refuses cleanup when a corrupted registry reuses a historical locator', async () => {
    const service = manager()
    const source = rememberSession(await service.createStandard({ now: ANCHOR }))
    source.repository.close()
    const oldStorageId = source.storageId
    const converted = rememberSession(
      await service.convertStandardToEncrypted(source.entry.id, PASSPHRASE),
    )

    await deleteStandardWorkspaceDatabase(oldStorageId)
    const workspaceB = createEmptyWorkspace({
      id: 'workspace-b-reusing-old-locator',
      name: 'Workspace B',
      now: ANCHOR,
    })
    const databaseB = createStandardWorkspaceDatabase(oldStorageId)
    const repositoryB = new StandardWorkspaceRepository(databaseB, workspaceB.workspace.id)
    await repositoryB.provisionWorkspace(workspaceB)
    repositoryB.close()
    await registryDatabase.workspaces.add({
      id: workspaceB.workspace.id,
      storageId: oldStorageId,
      displayName: workspaceB.workspace.name,
      kind: 'personal',
      encryptionMode: 'standard',
      createdAt: ANCHOR.toISOString(),
      updatedAt: ANCHOR.toISOString(),
      schemaVersion: 3,
      storageSchemaVersion: 3,
      registryRevision: 0,
      autoLock: 'never',
      state: 'ready',
    })

    await expectManagerCode(
      service.cleanupPlaintextSource(
        converted.entry.id,
        `standard:${oldStorageId}`,
      ),
      'plaintext-cleanup-failed',
    )
    const openedB = rememberSession(await service.openStandard(workspaceB.workspace.id))
    expect(workspaceSnapshotsEqual(openedB.snapshot, workspaceB)).toBe(true)
  })

  it('does not delete an unregistered workspace that reused a plaintext source locator', async () => {
    const service = manager()
    const source = rememberSession(await service.createStandard({ now: ANCHOR }))
    source.repository.close()
    const oldStorageId = source.storageId
    const converted = rememberSession(
      await service.convertStandardToEncrypted(source.entry.id, PASSPHRASE),
    )

    await deleteStandardWorkspaceDatabase(oldStorageId)
    const unrelated = createEmptyWorkspace({
      id: 'unregistered-reused-plaintext-locator',
      name: 'Unregistered unrelated workspace',
      now: ANCHOR,
    })
    const unrelatedRepository = new StandardWorkspaceRepository(
      createStandardWorkspaceDatabase(oldStorageId),
      unrelated.workspace.id,
    )
    await unrelatedRepository.provisionWorkspace(unrelated)
    unrelatedRepository.close()

    await expectManagerCode(
      service.cleanupPlaintextSource(
        converted.entry.id,
        `standard:${oldStorageId}`,
      ),
      'plaintext-cleanup-failed',
    )
    expect(await standardWorkspaceDatabaseExists(oldStorageId)).toBe(true)
    const verifier = new StandardWorkspaceRepository(
      createStandardWorkspaceDatabase(oldStorageId),
      unrelated.workspace.id,
    )
    try {
      const retained = await verifier.getWorkspaceSnapshot()
      expect(retained && workspaceSnapshotsEqual(retained, unrelated)).toBe(true)
    } finally {
      verifier.close()
    }
  })

  it('does not delete an unrelated legacy database without matching workspace identity', async () => {
    const service = manager()
    const encrypted = rememberSession(
      await service.createEncrypted(PASSPHRASE, { now: ANCHOR }),
    )
    const legacyName = `unregistered-legacy-reuse-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)
    const unrelated = createEmptyWorkspace({
      id: 'unregistered-unrelated-legacy-workspace',
      name: 'Unrelated legacy database',
      now: ANCHOR,
    })
    const legacyRepository = new StandardWorkspaceRepository(
      new SociologyPhdDeskDatabase(legacyName),
      unrelated.workspace.id,
    )
    await legacyRepository.provisionWorkspace(unrelated)
    legacyRepository.close()
    const sourceId = 'legacy:unregistered-reuse'
    await registryDatabase.workspaces.update(encrypted.entry.id, {
      plaintextSources: [
        {
          id: sourceId,
          kind: 'legacy',
          sourceDatabaseName: legacyName,
          state: 'cleanup-pending',
        },
      ],
    })

    await expectManagerCode(
      service.cleanupPlaintextSource(encrypted.entry.id, sourceId),
      'plaintext-cleanup-failed',
    )
    expect(await Dexie.exists(legacyName)).toBe(true)
    const verifier = new StandardWorkspaceRepository(
      new SociologyPhdDeskDatabase(legacyName),
      unrelated.workspace.id,
    )
    try {
      const retained = await verifier.getWorkspaceSnapshot()
      expect(retained && workspaceSnapshotsEqual(retained, unrelated)).toBe(true)
    } finally {
      verifier.close()
    }
  })

  it('refuses legacy cleanup names that alias registry or reserved workspace databases', async () => {
    const deleteLegacyStorage = vi.fn(async () => undefined)
    const service = manager({ deleteLegacyStorage })
    const source = rememberSession(await service.createStandard({ now: ANCHOR }))
    source.repository.close()
    const converted = rememberSession(
      await service.convertStandardToEncrypted(source.entry.id, PASSPHRASE),
    )
    const names = [
      registryDatabase.name,
      standardWorkspaceDatabaseName(source.storageId),
      encryptedVaultDatabaseName(converted.storageId),
    ]
    for (const [index, sourceDatabaseName] of names.entries()) {
      const current = await service.registry.getWorkspace(converted.entry.id)
      if (!current) throw new Error('Expected encrypted registry route.')
      const sourceId = `corrupted-legacy-source-${index}`
      await registryDatabase.workspaces.update(current.id, {
        plaintextSources: [
          {
            id: sourceId,
            kind: 'legacy',
            sourceDatabaseName,
            state: 'cleanup-pending',
          },
        ],
      })
      await expectManagerCode(
        service.cleanupPlaintextSource(current.id, sourceId),
        'plaintext-cleanup-failed',
      )
    }
    expect(deleteLegacyStorage).not.toHaveBeenCalled()
  })

  it('restores the same encrypted backup twice with new revision-zero identities and isolation', async () => {
    const source = createDemoWorkspace(ANCHOR)
    source.workspace.revision = 7
    const backup = await createEncryptedBackup(source, BACKUP_PASSPHRASE)
    const service = manager()

    const first = rememberSession(
      await service.restoreEncryptedBackup(
        backup,
        BACKUP_PASSPHRASE,
        PASSPHRASE,
        { displayName: 'First restore', now: ANCHOR },
      ),
    )
    const second = rememberSession(
      await service.restoreEncryptedBackup(
        backup,
        BACKUP_PASSPHRASE,
        NEW_PASSPHRASE,
        { displayName: 'Second restore', now: ANCHOR },
      ),
    )
    expect(first.entry.id).not.toBe(second.entry.id)
    expect(first.snapshot.workspace.revision).toBe(0)
    expect(second.snapshot.workspace.revision).toBe(0)
    expect(first.snapshot.projects).toEqual(second.snapshot.projects)

    const changed = structuredClone(first.snapshot)
    changed.workspace.name = 'Only first restore changed'
    await first.repository.replaceWorkspace(changed, first.snapshot.workspace.revision)
    expect((await second.repository.refresh()).workspace.name).toBe('Second restore')
  })

  it('updates registry-only metadata and resets only the demo workspace', async () => {
    const service = manager()
    const legacyName = `absent-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)
    const boot = await service.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR })
    rememberEntries(boot.workspaces)
    const personal = boot.workspaces.find((entry) => entry.kind === 'personal')
    const demo = boot.workspaces.find((entry) => entry.kind === 'demo')
    if (!personal || !demo) throw new Error('Expected initial workspaces.')

    const renamed = await service.rename(personal.id, 'Renamed personal')
    const locked = await service.updateAutoLock(
      personal.id,
      30,
      renamed.registryRevision,
    )
    const exportedAt = new Date('2026-08-12T11:00:00.000Z')
    const exported = await service.markExportGenerated(
      personal.id,
      exportedAt,
      locked.registryRevision,
    )
    expect(exported).toMatchObject({
      displayName: 'Renamed personal',
      autoLock: 30,
      lastExportedAt: exportedAt.toISOString(),
    })
    await expectManagerCode(service.rename(personal.id, 'x'.repeat(201)), 'invalid-display-name')

    const personalBefore = rememberSession(await service.openStandard(personal.id))
    const personalSnapshot = structuredClone(personalBefore.snapshot)
    personalBefore.repository.close()
    const demoSession = rememberSession(await service.openStandard(demo.id))
    const changedDemo = structuredClone(demoSession.snapshot)
    changedDemo.tasks = []
    await demoSession.repository.replaceWorkspace(
      changedDemo,
      demoSession.snapshot.workspace.revision,
    )
    demoSession.repository.close()
    const reset = await service.resetDemo(demo.id, {
      now: new Date('2026-08-13T08:00:00.000Z'),
    })
    expect(reset.tasks.length).toBeGreaterThan(0)
    await expectManagerCode(service.resetDemo(personal.id), 'demo-only')
    const personalAfter = rememberSession(await service.openStandard(personal.id))
    expect(workspaceSnapshotsEqual(personalAfter.snapshot, personalSnapshot)).toBe(true)
  })

  it('fails closed for destructive operations without a cross-tab-safe coordinator', async () => {
    const unsafeCoordinator: WorkspaceOperationCoordinator = {
      crossTabSafe: false,
      runExclusive: async (_storageId, operation) => operation(),
    }
    const service = manager({ coordinator: unsafeCoordinator })
    const standard = rememberSession(await service.createStandard({ now: ANCHOR }))
    standard.repository.close()

    await expectManagerCode(
      service.convertStandardToEncrypted(standard.entry.id, PASSPHRASE),
      'cross-tab-lock-unavailable',
    )
    await expectManagerCode(service.delete(standard.entry.id), 'cross-tab-lock-unavailable')
    expect(await standardWorkspaceDatabaseExists(standard.storageId)).toBe(true)
  })

  it('resumes a deleting tombstone by deleting remaining storage before finalization', async () => {
    const service = manager()
    const created = rememberSession(await service.createStandard({ now: ANCHOR }))
    created.repository.close()
    const current = await service.get(created.entry.id)
    if (!current) throw new Error('Expected a ready workspace.')
    await service.registry.updateWorkspace(
      current.id,
      current.registryRevision,
      (entry) => ({ ...entry, state: 'deleting' }),
    )
    expect(await standardWorkspaceDatabaseExists(current.storageId)).toBe(true)

    expect(await service.listPendingDeletions()).toHaveLength(1)
    const legacyName = `absent-delete-recovery-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)
    await service.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR })
    expect(await standardWorkspaceDatabaseExists(current.storageId)).toBe(false)
    expect(await service.registry.getWorkspace(current.id)).toBeUndefined()
  })

  it('keeps a failed deleting tombstone discoverable and retries after restart', async () => {
    const interrupted = manager({
      deleteStandardStorage: async () => {
        throw new Error('persistent simulated delete failure')
      },
    })
    const created = rememberSession(await interrupted.createStandard({ now: ANCHOR }))
    created.repository.close()
    const current = await interrupted.get(created.entry.id)
    if (!current) throw new Error('Expected a ready workspace.')
    await interrupted.registry.updateWorkspace(
      current.id,
      current.registryRevision,
      (entry) => ({ ...entry, state: 'deleting' }),
    )
    const legacyName = `absent-delete-retry-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)

    await interrupted.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR })
    expect((await interrupted.listPendingDeletions()).map((entry) => entry.id)).toContain(
      current.id,
    )
    expect(await standardWorkspaceDatabaseExists(current.storageId)).toBe(true)
    interrupted.close()

    registryDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const restarted = manager()
    await restarted.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR })
    expect(await restarted.listPendingDeletions()).toEqual([])
    expect(await restarted.registry.getWorkspace(current.id)).toBeUndefined()
    expect(await standardWorkspaceDatabaseExists(current.storageId)).toBe(false)
  })

  it('refuses ready deletion and tombstone recovery when another route retains the locator', async () => {
    const service = manager()
    const owner = rememberSession(
      await service.createStandard({ displayName: 'Locator owner', now: ANCHOR }),
    )
    const victim = rememberSession(
      await service.createStandard({ displayName: 'Delete victim', now: ANCHOR }),
    )
    owner.repository.close()
    victim.repository.close()
    const ownerEntry = await service.get(owner.entry.id)
    const victimEntry = await service.get(victim.entry.id)
    if (!ownerEntry || !victimEntry) throw new Error('Expected ready standard routes.')
    await registryDatabase.workspaces.update(ownerEntry.id, {
      plaintextSources: [
        {
          id: 'corrupted-retained-alias',
          kind: 'standard',
          sourceStorageId: victimEntry.storageId,
          state: 'retained',
        },
      ],
    })

    await expectManagerCode(service.delete(victimEntry.id), 'storage-operation-failed')
    expect(await standardWorkspaceDatabaseExists(victimEntry.storageId)).toBe(true)
    await service.registry.updateWorkspace(
      victimEntry.id,
      victimEntry.registryRevision,
      (entry) => ({ ...entry, state: 'deleting' }),
    )
    const legacyName = `absent-corrupt-tombstone-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)
    await service.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR })
    expect((await service.listPendingDeletions()).map((entry) => entry.id)).toContain(
      victimEntry.id,
    )
    expect(await standardWorkspaceDatabaseExists(victimEntry.storageId)).toBe(true)
  })

  it('rejects stale encrypted reads, refresh, and backup after route deletion begins', async () => {
    const service = manager()
    const session = rememberSession(
      await service.createEncrypted(PASSPHRASE, { now: ANCHOR }),
    )
    const ready = await service.get(session.entry.id)
    if (!ready) throw new Error('Expected a ready encrypted workspace.')
    await service.registry.updateWorkspace(
      ready.id,
      ready.registryRevision,
      (entry) => ({ ...entry, state: 'deleting' }),
    )

    await expectManagerCode(session.repository.getWorkspaceSnapshot(), 'revision-conflict')
    await expectManagerCode(session.repository.refresh(), 'manager-closed')
    await expectManagerCode(
      session.encryptedRuntime!.createBackup(BACKUP_PASSPHRASE, 'Canonical name'),
      'manager-closed',
    )
    expect(await Dexie.exists(encryptedVaultDatabaseName(session.storageId))).toBe(true)
  })

  it('poisons the encrypted port and clears its snapshot after vault tamper', async () => {
    const service = manager()
    const session = rememberSession(
      await service.createEncrypted(PASSPHRASE, { now: ANCHOR }),
    )
    const database = new EncryptedVaultDatabase(session.storageId)
    const record = await database.vaults.get(ENCRYPTED_VAULT_RECORD_ID)
    if (!record) throw new Error('Expected encrypted vault record.')
    const tampered = cloneEncryptedVaultRecord(record)
    tampered.ciphertext[0] ^= 1
    await database.vaults.put(tampered)
    database.close()

    await expectManagerCode(session.repository.refresh(), 'authentication-failed')
    expect(session.encryptedRuntime?.closed).toBe(true)
    expect(() => session.snapshot).toThrowError(
      expect.objectContaining({ code: 'manager-closed' }),
    )
    await expectManagerCode(session.repository.getWorkspaceSnapshot(), 'manager-closed')
    expect(await inspectEncryptedWorkspaceRecord(session.storageId)).toEqual(tampered)
  })

  it('closes a deferred unlock key when the manager closes before commit', async () => {
    const seed = manager()
    const created = rememberSession(
      await seed.createEncrypted(PASSPHRASE, { now: ANCHOR }),
    )
    created.repository.close()
    let release = (): void => undefined
    let entered = (): void => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const unlockEntered = new Promise<void>((resolve) => {
      entered = resolve
    })
    let produced: Awaited<ReturnType<typeof unlockEncryptedWorkspace>> | undefined
    const otherDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const closing = new LocalWorkspaceManager(otherDatabase, {
      coordinator,
      unlockEncrypted: async (...args) => {
        produced = await unlockEncryptedWorkspace(...args)
        entered()
        await gate
        return produced
      },
    })
    managers.add(closing)

    const pending = closing.unlockEncrypted(created.entry.id, PASSPHRASE)
    await unlockEntered
    closing.close()
    release()
    await expectManagerCode(pending, 'manager-closed')
    expect(produced?.closed).toBe(true)
    expect(otherDatabase.isOpen()).toBe(false)
  })

  it('rejects a deferred standard open when the manager closes before session commit', async () => {
    const seed = manager()
    const created = rememberSession(await seed.createStandard({ now: ANCHOR }))
    created.repository.close()
    const original = StandardWorkspaceRepository.prototype.getWorkspaceSnapshot
    let release = (): void => undefined
    let entered = (): void => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const readEntered = new Promise<void>((resolve) => {
      entered = resolve
    })
    const read = vi
      .spyOn(StandardWorkspaceRepository.prototype, 'getWorkspaceSnapshot')
      .mockImplementationOnce(async function (this: StandardWorkspaceRepository) {
        const snapshot = await original.call(this)
        entered()
        await gate
        return snapshot
      })
    const otherDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const closing = new LocalWorkspaceManager(otherDatabase, { coordinator })
    managers.add(closing)

    const pending = closing.openStandard(created.entry.id)
    await readEntered
    closing.close()
    release()
    await expectManagerCode(pending, 'manager-closed')
    expect(otherDatabase.isOpen()).toBe(false)
    read.mockRestore()
  })

  it('rejects bootstrap completion after the manager closes at its commit point', async () => {
    const original = WorkspaceRepositoryFactory.prototype.ensureInitialPersonalAndDemo
    let release = (): void => undefined
    let entered = (): void => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const provisioned = new Promise<void>((resolve) => {
      entered = resolve
    })
    const ensure = vi
      .spyOn(WorkspaceRepositoryFactory.prototype, 'ensureInitialPersonalAndDemo')
      .mockImplementationOnce(async function (
        this: WorkspaceRepositoryFactory,
        ...args
      ) {
        const result = await original.apply(this, args)
        entered()
        await gate
        return result
      })
    const service = manager()
    const legacyName = `absent-close-bootstrap-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)
    const pending = service.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR })
    await provisioned
    rememberEntries(await service.registry.listWorkspaces(true))
    service.close()
    release()
    await expectManagerCode(pending, 'manager-closed')
    expect(registryDatabase.isOpen()).toBe(false)
    ensure.mockRestore()
  })

  it('recovers a verified standard staging route after registry publication interruption', async () => {
    const workspaceId = 'recoverable-standard-workspace'
    const interrupted = manager()
    const markReady = vi
      .spyOn(interrupted.registry, 'markReady')
      .mockRejectedValueOnce(new Error('simulated process interruption'))
    await expectManagerCode(
      interrupted.createStandard({ workspaceId, displayName: 'Recover me', now: ANCHOR }),
      'storage-operation-failed',
    )
    markReady.mockRestore()
    const staging = await interrupted.listRecoverableProvisioning()
    expect(staging).toHaveLength(1)
    standardStorageIds.add(staging[0]!.storageId)
    interrupted.close()

    registryDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const restarted = manager()
    const recovered = rememberSession(await restarted.recoverProvisioning(workspaceId))
    expect(recovered.entry.state).toBe('ready')
    expect(recovered.snapshot.workspace).toMatchObject({
      id: workspaceId,
      name: 'Recover me',
    })
    expect(await restarted.listRecoverableProvisioning()).toEqual([])
  })

  it('resumes initial personal/demo bootstrap after a mark-ready interruption', async () => {
    const legacyName = `absent-bootstrap-recovery-${crypto.randomUUID()}`
    legacyDatabaseNames.add(legacyName)
    const interrupted = manager()
    const markReady = vi
      .spyOn(WorkspaceRegistryRepository.prototype, 'markReady')
      .mockRejectedValueOnce(new Error('simulated bootstrap interruption'))
    await expectManagerCode(
      interrupted.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR }),
      'bootstrap-failed',
    )
    markReady.mockRestore()
    const staging = await interrupted.listRecoverableProvisioning()
    expect(staging).toHaveLength(1)
    standardStorageIds.add(staging[0]!.storageId)
    interrupted.close()

    registryDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const restarted = manager()
    const recovered = await restarted.bootstrap({ legacyDatabaseName: legacyName, now: ANCHOR })
    rememberEntries(recovered.workspaces)
    expect(recovered.workspaces.some((entry) => entry.kind === 'personal')).toBe(true)
    expect(recovered.workspaces.some((entry) => entry.kind === 'demo')).toBe(true)
    expect(await restarted.listRecoverableProvisioning()).toEqual([])
  })

  it('authenticates encrypted staging recovery and can safely discard unpublished staging', async () => {
    const workspaceId = 'recoverable-encrypted-workspace'
    const interrupted = manager()
    const markReady = vi
      .spyOn(interrupted.registry, 'markReady')
      .mockRejectedValueOnce(new Error('simulated process interruption'))
    await expectManagerCode(
      interrupted.createEncrypted(PASSPHRASE, { workspaceId, now: ANCHOR }),
      'storage-operation-failed',
    )
    markReady.mockRestore()
    const [staging] = await interrupted.listRecoverableProvisioning()
    if (!staging) throw new Error('Expected encrypted staging metadata.')
    encryptedStorageIds.add(staging.storageId)
    expect(await Dexie.exists(encryptedVaultDatabaseName(staging.storageId))).toBe(true)
    interrupted.close()

    registryDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const restarted = manager()
    await expectManagerCode(
      restarted.recoverProvisioning(workspaceId, WRONG_PASSPHRASE),
      'authentication-failed',
    )
    expect(await restarted.listRecoverableProvisioning()).toHaveLength(1)
    const recovered = rememberSession(
      await restarted.createEncrypted(PASSPHRASE, { workspaceId, now: ANCHOR }),
    )
    expect(recovered.entry.state).toBe('ready')
    recovered.repository.close()

    const discardId = 'discard-encrypted-staging'
    const discardStorageId = crypto.randomUUID()
    encryptedStorageIds.add(discardStorageId)
    await restarted.registry.beginProvisioning({
      id: discardId,
      storageId: discardStorageId,
      displayName: 'Discard staging',
      kind: 'personal',
      encryptionMode: 'encrypted',
      createdAt: ANCHOR.toISOString(),
      updatedAt: ANCHOR.toISOString(),
      schemaVersion: 3,
      storageSchemaVersion: 1,
      registryRevision: 0,
      autoLock: 'never',
      state: 'provisioning',
    })
    await restarted.discardProvisioning(discardId)
    expect(await restarted.registry.getWorkspace(discardId)).toBeUndefined()
  })

  it('retains an encrypted provisioning route when creation throws after writing', async () => {
    const workspaceId = 'post-write-encrypted-provisioning'
    const bindingId = crypto.randomUUID()
    encryptedStorageIds.add(bindingId)
    const interrupted = manager({
      createBindingId: () => bindingId,
      createEncrypted: async (...args) => {
        const runtime = await createEncryptedWorkspace(...args)
        runtime.close()
        throw new Error('simulated crash after encrypted write')
      },
    })
    await expectManagerCode(
      interrupted.createEncrypted(PASSPHRASE, { workspaceId, now: ANCHOR }),
      'storage-operation-failed',
    )
    expect(await Dexie.exists(encryptedVaultDatabaseName(bindingId))).toBe(true)
    expect(await interrupted.listRecoverableProvisioning()).toContainEqual(
      expect.objectContaining({ id: workspaceId, storageId: bindingId }),
    )
    interrupted.close()

    registryDatabase = new WorkspaceRegistryDatabase(registryDatabase.name)
    const restarted = manager()
    const recovered = rememberSession(
      await restarted.recoverProvisioning(workspaceId, PASSPHRASE),
    )
    expect(recovered.entry.state).toBe('ready')
    expect(recovered.snapshot.workspace.id).toBe(workspaceId)
  })
})
