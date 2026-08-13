import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import {
  hasRetainedPlaintextSource,
  isFullyEncryptedWorkspace,
  type WorkspaceRegistryEntry,
} from '../models/workspace-registry'
import {
  WorkspaceRegistryConflictError,
  WorkspaceRegistryDatabase,
  WorkspaceRegistryRepository,
  WorkspaceRegistryValidationError,
} from './registryDatabase'
import {
  createStandardWorkspaceDatabase,
  deleteStandardWorkspaceDatabase,
  standardWorkspaceDatabaseExists,
} from './standardWorkspaceDatabase'

const timestamp = '2026-08-12T00:00:00.000Z'

function entry(overrides: Partial<WorkspaceRegistryEntry> = {}): WorkspaceRegistryEntry {
  return {
    id: 'workspace-a',
    storageId: 'storage-aaaaaaaaaaaa',
    displayName: 'Workspace A',
    kind: 'personal',
    encryptionMode: 'standard',
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    storageSchemaVersion: 3,
    registryRevision: 0,
    autoLock: 'never',
    state: 'provisioning',
    ...overrides,
  }
}

let database: WorkspaceRegistryDatabase
let registry: WorkspaceRegistryRepository

async function reserveAndVerifyConversion(
  ready: WorkspaceRegistryEntry,
  targetStorageId: string,
  verifiedAt: string,
): Promise<WorkspaceRegistryEntry> {
  const reserved = await registry.reserveEncryptedConversion(
    ready.id,
    ready.registryRevision,
    ready.storageId,
    {
      targetStorageId,
      storageSchemaVersion: 1,
      sourceRevision: 0,
      startedAt: verifiedAt,
    },
  )
  return registry.markEncryptedConversionVerified(
    reserved.id,
    reserved.registryRevision,
    targetStorageId,
    verifiedAt,
  )
}

describe('workspace registry', () => {
  beforeEach(() => {
    database = new WorkspaceRegistryDatabase(`registry-${crypto.randomUUID()}`)
    registry = new WorkspaceRegistryRepository(database)
  })

  afterEach(async () => {
    const name = database.name
    registry.close()
    await Dexie.delete(name)
    await deleteStandardWorkspaceDatabase(entry().storageId)
  })

  it('accepts only stable auto-lock values and provisioning entry creation', async () => {
    await expect(
      registry.beginProvisioning(entry({ autoLock: 15 })),
    ).resolves.toMatchObject({ autoLock: 15, state: 'provisioning' })
    await expect(
      registry.beginProvisioning(
        entry({ id: 'ready-bypass', storageId: 'storage-readybypass', state: 'ready' }),
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
    await expect(
      registry.beginProvisioning(
        entry({
          id: 'bad-auto-lock',
          storageId: 'storage-badautolock',
          autoLock: 10 as 5,
        }),
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
  })

  it('accepts v3 routing metadata and reconciles it monotonically after verification', async () => {
    const legacy = entry({ schemaVersion: 3 })
    await registry.beginProvisioning(legacy)
    const ready = await registry.markReady(legacy.id, legacy.registryRevision)

    await expect(
      registry.reconcileVerifiedWorkspaceStorageVersions(
        ready.id,
        ready.registryRevision,
        'storage-wrongroute',
        ready.encryptionMode,
        WORKSPACE_SCHEMA_VERSION,
        4,
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
    await expect(
      registry.reconcileVerifiedWorkspaceStorageVersions(
        ready.id,
        ready.registryRevision,
        ready.storageId,
        ready.encryptionMode,
        3,
        4,
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)

    const reconciled = await registry.reconcileVerifiedWorkspaceStorageVersions(
      ready.id,
      ready.registryRevision,
      ready.storageId,
      ready.encryptionMode,
      WORKSPACE_SCHEMA_VERSION,
      4,
    )
    expect(reconciled.schemaVersion).toBe(5)
    expect(reconciled.storageSchemaVersion).toBe(4)
    expect(reconciled.registryRevision).toBe(ready.registryRevision + 1)
    const idempotent = await registry.reconcileVerifiedWorkspaceStorageVersions(
      reconciled.id,
      reconciled.registryRevision,
      reconciled.storageId,
      reconciled.encryptionMode,
      WORKSPACE_SCHEMA_VERSION,
      4,
    )
    expect(idempotent).toEqual(reconciled)
  })

  it('never activates provisioning or deleting entries', async () => {
    const provisioning = await registry.beginProvisioning(entry())
    await expect(registry.setActiveWorkspace(provisioning.id)).rejects.toBeInstanceOf(
      WorkspaceRegistryValidationError,
    )
    const ready = await registry.markReady(provisioning.id, provisioning.registryRevision)
    await expect(registry.setActiveWorkspace(ready.id)).resolves.toMatchObject({
      activeWorkspaceId: ready.id,
    })
    const deleting = await registry.updateWorkspace(
      ready.id,
      ready.registryRevision,
      (current) => ({ ...current, state: 'deleting' }),
    )
    await expect(registry.setActiveWorkspace(deleting.id)).rejects.toBeInstanceOf(
      WorkspaceRegistryValidationError,
    )
  })

  it('promotes only the expected standard storage and retains plaintext truth', async () => {
    const provisioning = await registry.beginProvisioning(entry())
    const ready = await registry.markReady(provisioning.id, provisioning.registryRevision)
    const verifiedAt = '2026-08-12T01:00:00.000Z'
    const staged = await reserveAndVerifyConversion(
      ready,
      'encrypted-bbbbbbbbbbbb',
      verifiedAt,
    )
    const promoted = await registry.promoteStandardToEncrypted(
      staged.id,
      staged.registryRevision,
      staged.storageId,
      'encrypted-bbbbbbbbbbbb',
      1,
      verifiedAt,
    )

    expect(promoted.encryptionMode).toBe('encrypted')
    expect(promoted.storageId).toBe('encrypted-bbbbbbbbbbbb')
    expect(hasRetainedPlaintextSource(promoted)).toBe(true)
    expect(isFullyEncryptedWorkspace(promoted)).toBe(false)
    expect(promoted.plaintextSources).toContainEqual({
      id: `standard:${ready.storageId}`,
      kind: 'standard',
      sourceStorageId: ready.storageId,
      state: 'cleanup-pending',
      verifiedAt,
    })

    const removed = await registry.markPlaintextSourceRemoved(
      promoted.id,
      promoted.registryRevision,
      `standard:${ready.storageId}`,
      '2026-08-12T02:00:00.000Z',
    )
    expect(hasRetainedPlaintextSource(removed)).toBe(false)
    expect(isFullyEncryptedWorkspace(removed)).toBe(true)
  })

  it('keeps registry state unchanged when promotion CAS or source checks fail', async () => {
    const provisioning = await registry.beginProvisioning(entry())
    const ready = await registry.markReady(provisioning.id, provisioning.registryRevision)

    await expect(
      registry.promoteStandardToEncrypted(
        ready.id,
        ready.registryRevision + 1,
        ready.storageId,
        'encrypted-cccccccccccc',
        1,
        timestamp,
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryConflictError)
    await expect(
      registry.promoteStandardToEncrypted(
        ready.id,
        ready.registryRevision,
        'storage-not-current',
        'encrypted-cccccccccccc',
        1,
        timestamp,
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
    expect(await registry.getWorkspace(ready.id)).toEqual(ready)
  })

  it('ordinary metadata updates cannot change storage, mode, or plaintext truth', async () => {
    const provisioning = await registry.beginProvisioning(entry())
    const ready = await registry.markReady(provisioning.id, provisioning.registryRevision)
    const updated = await registry.updateWorkspace(
      ready.id,
      ready.registryRevision,
      (current) => ({
        ...current,
        displayName: 'Renamed',
        storageId: 'malicious-storage-id',
        encryptionMode: 'encrypted',
        plaintextSources: [
          {
            id: 'invented',
            kind: 'legacy',
            sourceDatabaseName: 'legacy',
            state: 'retained',
          },
        ],
      }),
    )
    expect(updated.displayName).toBe('Renamed')
    expect(updated.storageId).toBe(ready.storageId)
    expect(updated.encryptionMode).toBe('standard')
    expect(updated.plaintextSources).toBeUndefined()
  })

  it('never reuses a current or historical plaintext storage locator', async () => {
    const provisioning = await registry.beginProvisioning(entry())
    const ready = await registry.markReady(provisioning.id, provisioning.registryRevision)
    const staged = await reserveAndVerifyConversion(
      ready,
      'encrypted-reservation',
      timestamp,
    )
    const promoted = await registry.promoteStandardToEncrypted(
      staged.id,
      staged.registryRevision,
      staged.storageId,
      'encrypted-reservation',
      1,
      timestamp,
    )

    await expect(
      registry.beginProvisioning(
        entry({
          id: 'workspace-b',
          storageId: ready.storageId,
          displayName: 'Workspace B',
        }),
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)

    await expect(
      registry.recordMigrationStart({
        id: 'migration-reserved-target',
        sourceDatabaseName: 'legacy-source',
        sourceDatabaseVersion: 3,
        sourceWorkspaceId: 'workspace-migration-source',
        sourceRevision: 0,
        targetWorkspaceId: 'workspace-migration-source',
        targetStorageId: ready.storageId,
        status: 'copying',
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)

    await registry.markPlaintextSourceRemoved(
      promoted.id,
      promoted.registryRevision,
      `standard:${ready.storageId}`,
      '2026-08-12T02:00:00.000Z',
    )
    await expect(
      registry.beginProvisioning(
        entry({
          id: 'workspace-c',
          storageId: ready.storageId,
          displayName: 'Workspace C',
        }),
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
  })

  it('durably reserves conversion storage until verified promotion or confirmed absence', async () => {
    const provisioning = await registry.beginProvisioning(entry())
    const ready = await registry.markReady(provisioning.id, provisioning.registryRevision)
    const targetStorageId = 'encrypted-stage-target'
    const reserved = await registry.reserveEncryptedConversion(
      ready.id,
      ready.registryRevision,
      ready.storageId,
      {
        targetStorageId,
        storageSchemaVersion: 1,
        sourceRevision: 0,
        startedAt: timestamp,
      },
    )
    const renamed = await registry.updateWorkspace(
      reserved.id,
      reserved.registryRevision,
      (current) => ({
        ...current,
        displayName: 'Renamed while conversion is pending',
        encryptedConversion: undefined,
      }),
    )
    expect(renamed.encryptedConversion).toEqual(reserved.encryptedConversion)
    await expect(
      registry.beginProvisioning(
        entry({
          id: 'conversion-collision',
          storageId: targetStorageId,
          displayName: 'Collision',
        }),
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
    await expect(
      registry.clearEncryptedConversionReservation(
        renamed.id,
        renamed.registryRevision,
        targetStorageId,
        async () => false,
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
    const cleared = await registry.clearEncryptedConversionReservation(
      renamed.id,
      renamed.registryRevision,
      targetStorageId,
      async () => true,
    )
    expect(cleared.encryptedConversion).toBeUndefined()

    const migrationTarget = 'migration-only-target'
    await registry.recordMigrationStart({
      id: 'migration-only-reservation',
      sourceDatabaseName: 'legacy-only-source',
      sourceDatabaseVersion: 3,
      sourceWorkspaceId: 'legacy-only-workspace',
      sourceRevision: 0,
      targetWorkspaceId: 'legacy-only-workspace',
      targetStorageId: migrationTarget,
      status: 'copying',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await expect(
      registry.beginProvisioning(
        entry({
          id: 'migration-target-collision',
          storageId: migrationTarget,
          displayName: 'Migration collision',
        }),
      ),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
  })

  it('retains an entry on storage deletion failure and supports tombstone finalization', async () => {
    const provisioning = await registry.beginProvisioning(entry())
    const ready = await registry.markReady(provisioning.id, provisioning.registryRevision)
    await expect(
      registry.deleteWorkspace(ready.id, ready.registryRevision, async () => {
        throw new Error('blocked deletion')
      }, async () => false),
    ).rejects.toThrow('blocked deletion')
    expect(await registry.getWorkspace(ready.id)).toMatchObject({ state: 'ready' })

    const current = await registry.getWorkspace(ready.id)
    if (!current) throw new Error('Expected retained entry.')
    const deleting = await registry.updateWorkspace(
      current.id,
      current.registryRevision,
      (value) => ({ ...value, state: 'deleting' }),
    )
    expect(deleting.state).toBe('deleting')
    const physical = createStandardWorkspaceDatabase(deleting.storageId)
    await physical.open()
    physical.close()
    const storageIsAbsent = async () =>
      !(await standardWorkspaceDatabaseExists(deleting.storageId))
    await expect(
      registry.finalizeWorkspaceDeletion(deleting.id, storageIsAbsent),
    ).rejects.toBeInstanceOf(WorkspaceRegistryValidationError)
    expect(await registry.getWorkspace(deleting.id)).toMatchObject({ state: 'deleting' })

    await deleteStandardWorkspaceDatabase(deleting.storageId)
    await registry.finalizeWorkspaceDeletion(deleting.id, storageIsAbsent)
    expect(await registry.getWorkspace(deleting.id)).toBeUndefined()

    const ambiguousStorageId = 'storage-delete-then-throw'
    const ambiguousProvisioning = await registry.beginProvisioning(
      entry({
        id: 'ambiguous-delete-workspace',
        storageId: ambiguousStorageId,
      }),
    )
    const ambiguousReady = await registry.markReady(
      ambiguousProvisioning.id,
      ambiguousProvisioning.registryRevision,
    )
    const ambiguousPhysical = createStandardWorkspaceDatabase(ambiguousStorageId)
    await ambiguousPhysical.open()
    ambiguousPhysical.close()
    await expect(
      registry.deleteWorkspace(
        ambiguousReady.id,
        ambiguousReady.registryRevision,
        async () => {
          await deleteStandardWorkspaceDatabase(ambiguousStorageId)
          throw new Error('delete completed before transport failure')
        },
        async () => !(await standardWorkspaceDatabaseExists(ambiguousStorageId)),
      ),
    ).rejects.toThrow('delete completed before transport failure')
    expect(await registry.getWorkspace(ambiguousReady.id)).toMatchObject({
      state: 'deleting',
    })
    await registry.finalizeWorkspaceDeletion(
      ambiguousReady.id,
      async () => !(await standardWorkspaceDatabaseExists(ambiguousStorageId)),
    )
    expect(await registry.getWorkspace(ambiguousReady.id)).toBeUndefined()

    const unknownProvisioning = await registry.beginProvisioning(
      entry({
        id: 'unknown-delete-workspace',
        storageId: 'storage-unknown-delete',
      }),
    )
    const unknownReady = await registry.markReady(
      unknownProvisioning.id,
      unknownProvisioning.registryRevision,
    )
    await expect(
      registry.deleteWorkspace(
        unknownReady.id,
        unknownReady.registryRevision,
        async () => {
          throw new Error('ambiguous storage transport failure')
        },
        async () => {
          throw new Error('absence probe unavailable')
        },
      ),
    ).rejects.toThrow('ambiguous storage transport failure')
    expect(await registry.getWorkspace(unknownReady.id)).toMatchObject({
      state: 'deleting',
    })
    await registry.finalizeWorkspaceDeletion(unknownReady.id, async () => true)
  })
})
