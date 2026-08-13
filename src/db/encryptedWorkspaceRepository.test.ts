/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import Dexie from 'dexie'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createEncryptedBackup,
  inspectBackupProtectedHeader,
  inspectLocalProtectedHeader,
  LocalWorkspaceCryptoSession,
  openEncryptedBackup,
} from '../crypto'
import {
  createSyntheticLegacyV3Backup,
  createSyntheticLegacyV3LocalContainer,
} from '../crypto/legacyV3TestFixture.test-helper'
import { createDemoWorkspace } from '../models/demo'
import type { WorkspaceData } from '../models/domain'
import {
  ENCRYPTED_VAULT_RECORD_ID,
  EncryptedVaultDatabase,
  cloneEncryptedVaultRecord,
  encryptedVaultDatabaseName,
  type EncryptedVaultRecord,
} from './encryptedVaultDatabase'
import {
  EncryptedWorkspaceConflictError,
  createEncryptedWorkspace,
  encryptedVaultRecordContainsOnlyCiphertext,
  inspectEncryptedWorkspaceRecord,
  removeEncryptedWorkspaceStorage,
  restoreEncryptedBackupAsNewWorkspace,
  unlockEncryptedWorkspace,
  type UnlockedEncryptedWorkspace,
} from './encryptedWorkspaceRepository'

const PASSPHRASE = 'Correct horse battery staple 2026'
const BACKUP_PASSPHRASE = 'Independent backup passphrase 2026'
const WRONG_PASSPHRASE = 'independent backup passphrase 2026'
const ANCHOR = new Date('2026-08-12T08:00:00.000Z')
const bindings = new Set<string>()
const sessions = new Set<UnlockedEncryptedWorkspace>()

beforeAll(() => {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.randomUUID !== 'function') {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    })
  }
})

afterEach(async () => {
  for (const session of sessions) session.close()
  sessions.clear()
  for (const bindingId of bindings) await removeEncryptedWorkspaceStorage(bindingId)
  bindings.clear()
})

function bindingId(): string {
  const id = globalThis.crypto.randomUUID()
  bindings.add(id)
  return id
}

function track(session: UnlockedEncryptedWorkspace): UnlockedEncryptedWorkspace {
  sessions.add(session)
  bindings.add(session.bindingId)
  return session
}

function nextSnapshot(
  session: UnlockedEncryptedWorkspace,
  name: string,
): WorkspaceData {
  const snapshot = structuredClone(session.workspace)
  snapshot.workspace.name = name
  snapshot.workspace.revision = session.coordinates.storageRevision + 1
  snapshot.workspace.updatedAt = '2026-08-12T09:00:00.000Z'
  return snapshot
}

function recordBytes(record: EncryptedVaultRecord): string {
  const bytes = new Uint8Array(
    record.protected.length + record.iv.length + record.ciphertext.length,
  )
  bytes.set(record.protected, 0)
  bytes.set(record.iv, record.protected.length)
  bytes.set(record.ciphertext, record.protected.length + record.iv.length)
  return new TextDecoder('latin1').decode(bytes)
}

async function installLegacyV3Vault(
  id: string,
  workspace: WorkspaceData,
): Promise<EncryptedVaultRecord> {
  const container = await createSyntheticLegacyV3LocalContainer(
    workspace,
    PASSPHRASE,
    {
      bindingId: id,
      storageRevision: workspace.workspace.revision,
      keyInvocation: 1,
    },
  )
  const record: EncryptedVaultRecord = {
    id: ENCRYPTED_VAULT_RECORD_ID,
    storageRevision: workspace.workspace.revision,
    lockEpoch: 0,
    keyInvocation: 1,
    encryptionAttempts: 1,
    ...container,
  }
  const database = new EncryptedVaultDatabase(id)
  await database.vaults.put(record)
  database.close()
  return cloneEncryptedVaultRecord(record)
}

describe('encrypted workspace repository', () => {
  it('atomically upgrades an authenticated v3 vault once and reads back v5', async () => {
    const id = bindingId()
    const workspace = createDemoWorkspace(ANCHOR)
    const legacy = await installLegacyV3Vault(id, workspace)

    const first = track(await unlockEncryptedWorkspace(id, PASSPHRASE))
    expect(first.workspace).toEqual({
      ...workspace,
      theoryMemos: [],
      literatureExternalReferences: [],
    })
    const upgraded = await inspectEncryptedWorkspaceRecord(id)
    expect(upgraded).not.toBeNull()
    expect(upgraded && inspectLocalProtectedHeader(upgraded).payloadVersion).toBe(5)
    expect(upgraded?.storageRevision).toBe(legacy.storageRevision)
    expect(upgraded?.keyInvocation).toBe(2)
    first.close()

    const second = track(await unlockEncryptedWorkspace(id, PASSPHRASE))
    expect(second.coordinates.keyInvocation).toBe(2)
    expect((await inspectEncryptedWorkspaceRecord(id))?.keyInvocation).toBe(2)
  })

  it('does not write a v3 vault when authentication fails or ciphertext is tampered', async () => {
    for (const mode of ['wrong-passphrase', 'tampered'] as const) {
      const id = bindingId()
      const original = await installLegacyV3Vault(id, createDemoWorkspace(ANCHOR))
      if (mode === 'tampered') {
        const database = new EncryptedVaultDatabase(id)
        const damaged = cloneEncryptedVaultRecord(original)
        damaged.ciphertext[0] ^= 1
        await database.vaults.put(damaged)
        database.close()
      }
      const before = await inspectEncryptedWorkspaceRecord(id)
      await expect(
        unlockEncryptedWorkspace(
          id,
          mode === 'wrong-passphrase' ? WRONG_PASSPHRASE : PASSPHRASE,
        ),
      ).rejects.toMatchObject({ name: 'EncryptedContainerAuthenticationError' })
      const after = await inspectEncryptedWorkspaceRecord(id)
      expect(after?.keyInvocation).toBe(before?.keyInvocation)
      expect(after?.encryptionAttempts).toBe(before?.encryptionAttempts)
      expect(after && recordBytes(after)).toBe(before && recordBytes(before))
    }
  })

  it('preserves the old ciphertext when legacy re-encryption fails', async () => {
    const id = bindingId()
    const original = await installLegacyV3Vault(id, createDemoWorkspace(ANCHOR))
    const encrypt = vi
      .spyOn(LocalWorkspaceCryptoSession.prototype, 'encrypt')
      .mockRejectedValueOnce(new Error('synthetic encryption failure'))

    await expect(unlockEncryptedWorkspace(id, PASSPHRASE)).rejects.toThrow(
      'synthetic encryption failure',
    )
    encrypt.mockRestore()
    const persisted = await inspectEncryptedWorkspaceRecord(id)
    expect(persisted && recordBytes(persisted)).toBe(recordBytes(original))
    expect(persisted?.keyInvocation).toBe(original.keyInvocation)
    expect(persisted?.encryptionAttempts).toBe(original.encryptionAttempts + 1)
    expect(persisted && inspectLocalProtectedHeader(persisted).payloadVersion).toBe(3)
  })

  it('aborts a failed legacy CAS put and leaves the old ciphertext committed', async () => {
    const id = bindingId()
    const original = await installLegacyV3Vault(id, createDemoWorkspace(ANCHOR))
    let puts = 0
    const databaseFactory = (candidate: string): EncryptedVaultDatabase => {
      const database = new EncryptedVaultDatabase(candidate)
      database.vaults.hook('updating', () => {
        puts += 1
        if (puts === 2) throw new Error('synthetic upgrade put failure')
      })
      return database
    }

    await expect(
      unlockEncryptedWorkspace(id, PASSPHRASE, { databaseFactory }),
    ).rejects.toThrow('synthetic upgrade put failure')
    const persisted = await inspectEncryptedWorkspaceRecord(id)
    expect(persisted && recordBytes(persisted)).toBe(recordBytes(original))
    expect(persisted?.keyInvocation).toBe(original.keyInvocation)
    expect(persisted?.encryptionAttempts).toBe(original.encryptionAttempts + 1)
    expect(persisted && inspectLocalProtectedHeader(persisted).payloadVersion).toBe(3)
  })

  it('rolls back to the old ciphertext when post-commit authentication fails', async () => {
    const id = bindingId()
    const original = await installLegacyV3Vault(id, createDemoWorkspace(ANCHOR))
    const decryptOriginal = LocalWorkspaceCryptoSession.prototype.decrypt
    let decryptions = 0
    const decrypt = vi
      .spyOn(LocalWorkspaceCryptoSession.prototype, 'decrypt')
      .mockImplementation(function (
        this: LocalWorkspaceCryptoSession,
        container,
        expected,
      ) {
        decryptions += 1
        if (decryptions === 3) {
          return Promise.reject(new Error('synthetic post-commit read-back failure'))
        }
        return decryptOriginal.call(this, container, expected)
      })

    await expect(unlockEncryptedWorkspace(id, PASSPHRASE)).rejects.toThrow(
      'synthetic post-commit read-back failure',
    )
    decrypt.mockRestore()
    const persisted = await inspectEncryptedWorkspaceRecord(id)
    expect(persisted && recordBytes(persisted)).toBe(recordBytes(original))
    expect(persisted?.keyInvocation).toBe(original.keyInvocation)
    expect(persisted?.encryptionAttempts).toBe(original.encryptionAttempts + 1)
    expect(persisted && inspectLocalProtectedHeader(persisted).payloadVersion).toBe(3)
  })

  it('authenticates a v3 backup in memory and restores only a new v5 vault', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const backup = await createSyntheticLegacyV3Backup(workspace, BACKUP_PASSPHRASE)
    const restored = track(
      await restoreEncryptedBackupAsNewWorkspace(
        backup,
        BACKUP_PASSPHRASE,
        PASSPHRASE,
        {
          newWorkspaceId: crypto.randomUUID(),
          bindingId: bindingId(),
        },
      ),
    )
    const record = await inspectEncryptedWorkspaceRecord(restored.bindingId)
    expect(record && inspectLocalProtectedHeader(record).payloadVersion).toBe(5)
    expect(restored.workspace.version).toBe(5)
    expect(restored.workspace.theoryMemos).toEqual([])
    expect(restored.workspace.literatureExternalReferences).toEqual([])
  })

  it('does not create an empty IndexedDB database for missing inspect or unlock', async () => {
    const id = bindingId()
    const databaseName = encryptedVaultDatabaseName(id)

    expect(await Dexie.exists(databaseName)).toBe(false)
    await expect(inspectEncryptedWorkspaceRecord(id)).resolves.toBeNull()
    expect(await Dexie.exists(databaseName)).toBe(false)
    await expect(unlockEncryptedWorkspace(id, PASSPHRASE)).rejects.toMatchObject({
      name: 'EncryptedWorkspaceNotFoundError',
    })
    expect(await Dexie.exists(databaseName)).toBe(false)
  })

  it('persists one ciphertext-only record and verifies a decrypted read-back', async () => {
    const canary = 'PLAINTEXT-CANARY-MUST-NOT-ENTER-IDB'
    const workspace = createDemoWorkspace(ANCHOR)
    workspace.workspace.name = canary
    const session = track(
      await createEncryptedWorkspace(workspace, PASSPHRASE, {
        bindingId: bindingId(),
      }),
    )
    const record = await inspectEncryptedWorkspaceRecord(session.bindingId)

    expect(record).not.toBeNull()
    expect(record && encryptedVaultRecordContainsOnlyCiphertext(record)).toBe(true)
    expect(record && recordBytes(record)).not.toContain(canary)
    expect(record && JSON.stringify(record)).not.toContain(canary)
    expect(record?.keyInvocation).toBe(1)
    expect(record?.encryptionAttempts).toBe(1)
    expect(session.workspace).toEqual(workspace)
  })

  it.each(['persisted', 'read-back'] as const)(
    'fails creation when %s ciphertext is tampered before verification',
    async (mode) => {
      const id = bindingId()
      const databaseFactory = (candidate: string): EncryptedVaultDatabase => {
        const database = new EncryptedVaultDatabase(candidate)
        if (mode === 'persisted') {
          database.vaults.hook('creating', (_primaryKey, record) => {
            const ciphertext = new Uint8Array(record.ciphertext)
            ciphertext[0] ^= 1
            record.ciphertext = ciphertext
          })
        } else {
          database.vaults.hook('reading', (record) => {
            if (!record) return record
            const tampered = cloneEncryptedVaultRecord(record)
            tampered.ciphertext[0] ^= 1
            return tampered
          })
        }
        return database
      }

      await expect(
        createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
          bindingId: id,
          databaseFactory,
        }),
      ).rejects.toMatchObject({ name: 'EncryptedContainerAuthenticationError' })
    },
  )

  it('uses revision and key-invocation CAS and leaves the winner ciphertext unchanged', async () => {
    const creator = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: bindingId(),
      }),
    )
    const stale = track(await unlockEncryptedWorkspace(creator.bindingId, PASSPHRASE))
    await creator.save(nextSnapshot(creator, 'CAS winner'))
    const winningRecord = await inspectEncryptedWorkspaceRecord(creator.bindingId)
    if (!winningRecord) throw new Error('Expected the winning encrypted record.')
    expect(winningRecord.encryptionAttempts).toBe(2)

    await expect(stale.save(nextSnapshot(stale, 'Stale loser'))).rejects.toBeInstanceOf(
      EncryptedWorkspaceConflictError,
    )
    const afterConflict = await inspectEncryptedWorkspaceRecord(creator.bindingId)
    expect(afterConflict?.storageRevision).toBe(1)
    expect(afterConflict?.keyInvocation).toBe(2)
    expect(afterConflict?.encryptionAttempts).toBe(2)
    expect(afterConflict?.ciphertext).toEqual(winningRecord.ciphertext)

    const verifier = track(await unlockEncryptedWorkspace(creator.bindingId, PASSPHRASE))
    expect(verifier.workspace.workspace.name).toBe('CAS winner')
  })

  it('reserves concurrent AES-GCM attempts before encryption and keeps the loser count', async () => {
    const creator = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: bindingId(),
      }),
    )
    const contender = track(await unlockEncryptedWorkspace(creator.bindingId, PASSPHRASE))
    const originalEncrypt = LocalWorkspaceCryptoSession.prototype.encrypt
    let entered = 0
    let announceBoth = (): void => undefined
    let releaseEncryption = (): void => undefined
    const bothEntered = new Promise<void>((resolve) => {
      announceBoth = resolve
    })
    const release = new Promise<void>((resolve) => {
      releaseEncryption = resolve
    })
    const encryptSpy = vi
      .spyOn(LocalWorkspaceCryptoSession.prototype, 'encrypt')
      .mockImplementation(async function (
        this: LocalWorkspaceCryptoSession,
        ...args: Parameters<LocalWorkspaceCryptoSession['encrypt']>
      ) {
        entered += 1
        if (entered === 2) announceBoth()
        await release
        return originalEncrypt.apply(this, args)
      })

    const firstSave = creator.save(nextSnapshot(creator, 'Concurrent first'))
    const secondSave = contender.save(nextSnapshot(contender, 'Concurrent second'))
    await bothEntered
    const reserved = await inspectEncryptedWorkspaceRecord(creator.bindingId)
    expect(reserved?.storageRevision).toBe(0)
    expect(reserved?.keyInvocation).toBe(1)
    expect(reserved?.encryptionAttempts).toBe(3)
    releaseEncryption()
    const outcomes = await Promise.allSettled([firstSave, secondSave])
    encryptSpy.mockRestore()

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      EncryptedWorkspaceConflictError,
    )
    const committed = await inspectEncryptedWorkspaceRecord(creator.bindingId)
    expect(committed?.storageRevision).toBe(1)
    expect([2, 3]).toContain(committed?.keyInvocation)
    expect(committed?.encryptionAttempts).toBe(3)

    const verifier = track(await unlockEncryptedWorkspace(creator.bindingId, PASSPHRASE))
    expect(['Concurrent first', 'Concurrent second']).toContain(
      verifier.workspace.workspace.name,
    )
  })

  it('advancing lockEpoch cancels a delayed tab write without changing old ciphertext', async () => {
    const saver = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: bindingId(),
      }),
    )
    const locker = track(await unlockEncryptedWorkspace(saver.bindingId, PASSPHRASE))
    const beforeLock = await inspectEncryptedWorkspaceRecord(saver.bindingId)
    if (!beforeLock) throw new Error('Expected an encrypted record before lock.')

    const originalEncrypt = LocalWorkspaceCryptoSession.prototype.encrypt
    let announceEncryption = (): void => undefined
    let releaseEncryption = (): void => undefined
    const encryptionEntered = new Promise<void>((resolve) => {
      announceEncryption = resolve
    })
    const release = new Promise<void>((resolve) => {
      releaseEncryption = resolve
    })
    const encryptSpy = vi
      .spyOn(LocalWorkspaceCryptoSession.prototype, 'encrypt')
      .mockImplementationOnce(async function (
        this: LocalWorkspaceCryptoSession,
        ...args: Parameters<LocalWorkspaceCryptoSession['encrypt']>
      ) {
        announceEncryption()
        await release
        return originalEncrypt.apply(this, args)
      })
    const delayedSave = saver.save(nextSnapshot(saver, 'Delayed stale save'))
    await encryptionEntered
    const reserved = await inspectEncryptedWorkspaceRecord(saver.bindingId)
    expect(reserved?.encryptionAttempts).toBe(2)
    expect(reserved?.keyInvocation).toBe(1)
    expect(await locker.lock()).toBe(1)
    releaseEncryption()
    await expect(delayedSave).rejects.toBeInstanceOf(
      EncryptedWorkspaceConflictError,
    )
    encryptSpy.mockRestore()
    const afterRejectedSave = await inspectEncryptedWorkspaceRecord(saver.bindingId)
    expect(afterRejectedSave?.lockEpoch).toBe(1)
    expect(afterRejectedSave?.storageRevision).toBe(0)
    expect(afterRejectedSave?.keyInvocation).toBe(1)
    expect(afterRejectedSave?.encryptionAttempts).toBe(2)
    expect(afterRejectedSave?.ciphertext).toEqual(beforeLock.ciphertext)
  })

  it('rejects stale save and lock after an explicit binding reuse without touching the new vault', async () => {
    const id = bindingId()
    const stale = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: id,
      }),
    )
    await removeEncryptedWorkspaceStorage(id)

    const replacementWorkspace = createDemoWorkspace(ANCHOR)
    replacementWorkspace.workspace.id = 'replacement-generation-workspace'
    replacementWorkspace.workspace.name = 'Replacement generation'
    const replacement = track(
      await createEncryptedWorkspace(replacementWorkspace, BACKUP_PASSPHRASE, {
        bindingId: id,
      }),
    )
    const before = await inspectEncryptedWorkspaceRecord(id)
    if (!before) throw new Error('Expected the replacement encrypted record.')

    await expect(
      stale.save(nextSnapshot(stale, 'Old generation overwrite')),
    ).rejects.toMatchObject({ name: 'EncryptedContainerAuthenticationError' })
    await expect(stale.lock()).rejects.toMatchObject({
      name: 'EncryptedWorkspaceSessionClosedError',
    })
    const after = await inspectEncryptedWorkspaceRecord(id)
    expect(after).toEqual(before)

    const verifier = track(await unlockEncryptedWorkspace(id, BACKUP_PASSPHRASE))
    expect(verifier.workspace.workspace.id).toBe(replacement.workspace.workspace.id)
    expect(verifier.workspace.workspace.name).toBe('Replacement generation')
  })

  it('does not export a stale in-memory backup after another tab locks the vault', async () => {
    const stale = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: bindingId(),
      }),
    )
    const locker = track(await unlockEncryptedWorkspace(stale.bindingId, PASSPHRASE))

    await locker.lock()
    await expect(stale.createBackup(BACKUP_PASSPHRASE)).rejects.toBeInstanceOf(
      EncryptedWorkspaceConflictError,
    )
    expect(stale.closed).toBe(true)
  })

  it('poisons an unlocked runtime after authenticated vault data is tampered', async () => {
    const session = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: bindingId(),
      }),
    )
    const database = new EncryptedVaultDatabase(session.bindingId)
    const record = await database.vaults.get(ENCRYPTED_VAULT_RECORD_ID)
    if (!record) throw new Error('Expected encrypted vault record.')
    const tampered = cloneEncryptedVaultRecord(record)
    tampered.ciphertext[0] ^= 1
    await database.vaults.put(tampered)
    database.close()

    await expect(session.refresh()).rejects.toMatchObject({
      name: 'EncryptedContainerAuthenticationError',
    })
    expect(session.closed).toBe(true)
    await expect(
      session.save({
        ...createDemoWorkspace(ANCHOR),
        workspace: {
          ...createDemoWorkspace(ANCHOR).workspace,
          revision: 1,
        },
      }),
    ).rejects.toMatchObject({ name: 'EncryptedWorkspaceSessionClosedError' })
    expect(await inspectEncryptedWorkspaceRecord(session.bindingId)).toEqual(tampered)
  })

  it('exports a canonical registry-name override without mutating the local vault', async () => {
    const session = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: bindingId(),
      }),
    )
    const originalName = session.workspace.workspace.name
    const canonicalName = 'Renamed in workspace registry'
    const backup = await session.createBackup(BACKUP_PASSPHRASE, canonicalName)

    expect((await openEncryptedBackup(backup, BACKUP_PASSPHRASE)).workspace.name).toBe(
      canonicalName,
    )
    expect(JSON.stringify(inspectBackupProtectedHeader(backup))).not.toContain(
      canonicalName,
    )
    expect(session.workspace.workspace.name).toBe(originalName)
    expect((await session.refresh()).workspace.name).toBe(originalName)

    const restored = track(
      await restoreEncryptedBackupAsNewWorkspace(
        backup,
        BACKUP_PASSPHRASE,
        PASSPHRASE,
        {
          newWorkspaceId: 'restored-registry-name-workspace',
          bindingId: bindingId(),
        },
      ),
    )
    expect(restored.workspace.workspace.name).toBe(canonicalName)
    expect(restored.workspace.workspace.revision).toBe(0)
  })

  it('does not recreate a deleted vault through stale backup, save, or lock sessions', async () => {
    const id = bindingId()
    const backupSession = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: id,
      }),
    )
    const saveSession = track(await unlockEncryptedWorkspace(id, PASSPHRASE))
    const lockSession = track(await unlockEncryptedWorkspace(id, PASSPHRASE))
    const databaseName = encryptedVaultDatabaseName(id)

    await removeEncryptedWorkspaceStorage(id)
    expect(await Dexie.exists(databaseName)).toBe(false)

    await expect(
      backupSession.createBackup(BACKUP_PASSPHRASE),
    ).rejects.toMatchObject({ name: 'EncryptedWorkspaceNotFoundError' })
    expect(await Dexie.exists(databaseName)).toBe(false)

    await expect(
      saveSession.save(nextSnapshot(saveSession, 'Must not resurrect deleted storage')),
    ).rejects.toMatchObject({ name: 'EncryptedWorkspaceNotFoundError' })
    expect(await Dexie.exists(databaseName)).toBe(false)

    await expect(lockSession.lock()).rejects.toMatchObject({
      name: 'EncryptedWorkspaceNotFoundError',
    })
    expect(await Dexie.exists(databaseName)).toBe(false)
  })

  it('poisons refresh and save sessions when the unique vault record is missing', async () => {
    const id = bindingId()
    const refreshSession = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: id,
      }),
    )
    const saveSession = track(await unlockEncryptedWorkspace(id, PASSPHRASE))
    const pendingSave = nextSnapshot(saveSession, 'Must not recreate a missing record')
    const database = new EncryptedVaultDatabase(id)
    await database.vaults.delete(ENCRYPTED_VAULT_RECORD_ID)
    database.close()

    await expect(refreshSession.refresh()).rejects.toMatchObject({
      name: 'EncryptedWorkspaceNotFoundError',
    })
    expect(refreshSession.closed).toBe(true)
    expect(() => refreshSession.workspace).toThrowError(
      expect.objectContaining({ name: 'EncryptedWorkspaceSessionClosedError' }),
    )

    await expect(saveSession.save(pendingSave)).rejects.toMatchObject({
      name: 'EncryptedWorkspaceNotFoundError',
    })
    expect(saveSession.closed).toBe(true)
    expect(() => saveSession.workspace).toThrowError(
      expect.objectContaining({ name: 'EncryptedWorkspaceSessionClosedError' }),
    )
    await expect(saveSession.createBackup(BACKUP_PASSPHRASE)).rejects.toMatchObject({
      name: 'EncryptedWorkspaceSessionClosedError',
    })
    expect(await Dexie.exists(encryptedVaultDatabaseName(id))).toBe(true)
    expect(await inspectEncryptedWorkspaceRecord(id)).toBeNull()
  })

  it.each(['close', 'lock'] as const)(
    'never revives a runtime when a deferred refresh races %s',
    async (action) => {
      const session = track(
        await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
          bindingId: bindingId(),
        }),
      )
      const originalDecrypt = LocalWorkspaceCryptoSession.prototype.decrypt
      let announceDecrypted = (): void => undefined
      let releaseRefresh = (): void => undefined
      const decrypted = new Promise<void>((resolve) => {
        announceDecrypted = resolve
      })
      const release = new Promise<void>((resolve) => {
        releaseRefresh = resolve
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
        const pendingRefresh = session.refresh()
        await decrypted
        if (action === 'lock') {
          expect(await session.lock()).toBe(1)
        } else {
          session.close()
        }
        const recordAfterClose = await inspectEncryptedWorkspaceRecord(
          session.bindingId,
        )
        releaseRefresh()

        await expect(pendingRefresh).rejects.toMatchObject({
          name: 'EncryptedWorkspaceSessionClosedError',
        })
        expect(session.closed).toBe(true)
        expect(() => session.workspace).toThrowError(
          expect.objectContaining({ name: 'EncryptedWorkspaceSessionClosedError' }),
        )
        await expect(
          session.save({
            ...createDemoWorkspace(ANCHOR),
            workspace: {
              ...createDemoWorkspace(ANCHOR).workspace,
              revision: 1,
            },
          }),
        ).rejects.toMatchObject({ name: 'EncryptedWorkspaceSessionClosedError' })
        await expect(
          session.createBackup(BACKUP_PASSPHRASE),
        ).rejects.toMatchObject({ name: 'EncryptedWorkspaceSessionClosedError' })
        expect(await inspectEncryptedWorkspaceRecord(session.bindingId)).toEqual(
          recordAfterClose,
        )
      } finally {
        releaseRefresh()
        decryptSpy.mockRestore()
      }
    },
  )

  it('provides standard-compatible replace and merge semantics over encrypted CAS', async () => {
    const session = track(
      await createEncryptedWorkspace(createDemoWorkspace(ANCHOR), PASSPHRASE, {
        bindingId: bindingId(),
      }),
    )
    const replacement = structuredClone(session.workspace)
    const wrongIdentity = nextSnapshot(session, 'Wrong identity')
    wrongIdentity.workspace.id = 'another-logical-workspace'
    await expect(session.save(wrongIdentity)).rejects.toMatchObject({
      name: 'WorkspaceIdentityError',
    })
    replacement.workspace.name = 'Exact encrypted replacement'
    replacement.workspace.revision = 999
    const replaced = await session.replace(replacement, 0)
    expect(replaced.workspace.name).toBe('Exact encrypted replacement')
    expect(replaced.workspace.revision).toBe(1)

    const incoming = structuredClone(session.workspace)
    const originalTask = incoming.tasks[0]
    if (!originalTask) throw new Error('Expected a demo task.')
    incoming.tasks.push({
      ...originalTask,
      id: 'encrypted-merge-added-task',
      title: 'Encrypted merge added task',
    })
    const result = await session.merge(incoming)
    expect(result.added.tasks).toBe(1)
    expect(result.preservedWorkspace).toBe(true)
    expect(session.workspace.workspace.revision).toBe(2)
    expect(session.workspace.tasks.some((task) => task.id === 'encrypted-merge-added-task')).toBe(
      true,
    )
  })

  it('authenticates a backup before writing a new vault', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    workspace.workspace.revision = 7
    const backup = await createEncryptedBackup(workspace, BACKUP_PASSPHRASE)
    const id = bindingId()
    const newWorkspaceId = 'restored-independent-workspace'
    const databaseName = encryptedVaultDatabaseName(id)

    await expect(
      restoreEncryptedBackupAsNewWorkspace(
        backup,
        WRONG_PASSPHRASE,
        PASSPHRASE,
        {
          bindingId: id,
          newWorkspaceId,
          newWorkspaceName: 'Restored private workspace',
        },
      ),
    ).rejects.toMatchObject({ name: 'EncryptedContainerAuthenticationError' })
    expect(await inspectEncryptedWorkspaceRecord(id)).toBeNull()
    expect(await Dexie.exists(databaseName)).toBe(false)

    const restored = track(
      await restoreEncryptedBackupAsNewWorkspace(
        backup,
        BACKUP_PASSPHRASE,
        PASSPHRASE,
        {
          bindingId: id,
          newWorkspaceId,
          newWorkspaceName: 'Restored private workspace',
        },
      ),
    )
    expect(restored.workspace.workspace.id).toBe(newWorkspaceId)
    expect(restored.workspace.workspace.name).toBe('Restored private workspace')
    expect(restored.workspace.workspace.revision).toBe(0)
    expect(restored.workspace.projects).toEqual(workspace.projects)
    const record = await inspectEncryptedWorkspaceRecord(id)
    expect(record?.id).toBe(ENCRYPTED_VAULT_RECORD_ID)
  })
})
