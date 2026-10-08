/// <reference types="node" />
import { readFileSync } from 'node:fs'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import { createEmptyWorkspace } from '../models/empty-workspace'
import type { WorkspaceData } from '../models/domain'
import { LEGACY_COLLECTION_KEYS, PROVENANCE_COLLECTION_KEYS, WORKSPACE_COLLECTION_KEYS } from '../models/provenance'
import { createEncryptedBackup, inspectBackupProtectedHeader, inspectLocalProtectedHeader, openEncryptedBackup } from '../crypto'
import { createSyntheticLegacyBackup, createSyntheticLegacyLocalContainer } from '../crypto/legacyV3TestFixture.test-helper'
import { migrateWorkspaceV7ToV8 } from '../utils/provenance-schema'
import { exportWorkspaceJson, importWorkspaceJson, validateWorkspace, WorkspaceValidationError } from '../utils/workspace-transfer'
import { preflightPortableWorkspaceText } from '../utils/import-preflight'
import { MAX_SERIALIZED_WORKSPACE_BYTES, workspaceSerializedBytes } from '../utils/workspace-capacity'
import { SociologyPhdDeskDatabase } from './database'
import { StandardWorkspaceRepository, WorkspaceConflictError, buildMergedWorkspace, workspaceSnapshotsEqual } from './workspaceRepository'
import { ENCRYPTED_VAULT_RECORD_ID, EncryptedVaultDatabase, type EncryptedVaultRecord } from './encryptedVaultDatabase'
import { createEncryptedWorkspace, inspectEncryptedWorkspaceRecord, removeEncryptedWorkspaceStorage, unlockEncryptedWorkspace } from './encryptedWorkspaceRepository'

const PASSPHRASE = 'Completely synthetic storage regression passphrase'
const ANCHOR = new Date('2026-10-08T00:00:00.000Z')
function completeFixture(): WorkspaceData {
  const raw: unknown = JSON.parse(readFileSync('src/test-fixtures/qualitative-workspace.json', 'utf8'))
  const result = validateWorkspace(raw)
  if (!result.success) throw new WorkspaceValidationError('Invalid synthetic regression fixture.', result.issues)
  return result.data
}
function historicalV7(workspace = createDemoWorkspace(ANCHOR)): Record<string, unknown> {
  const old = structuredClone(workspace) as unknown as Record<string, unknown>
  old.version = 7
  for (const collection of PROVENANCE_COLLECTION_KEYS) delete old[collection]
  return old
}
function capacityExpansionFixture(): WorkspaceData {
  const demo = createDemoWorkspace(ANCHOR)
  const source = createEmptyWorkspace({ id: 'synthetic-byte-capacity-workspace', now: ANCHOR })
  source.projects = [demo.projects[0]!]
  source.claims = Array.from({ length: 80 }, (_, index) => ({ ...demo.claims[0]!, id: `synthetic-large-claim-${index}`, text: 'x'.repeat(250_000), notes: '' }))
  return source
}
/** Exact byte comparison without a test matcher enumerating 20 MiB of keys. */
function sameVaultRecord(left: EncryptedVaultRecord, right: EncryptedVaultRecord): boolean {
  if (left.id !== right.id || left.storageRevision !== right.storageRevision || left.lockEpoch !== right.lockEpoch || left.keyInvocation !== right.keyInvocation || left.encryptionAttempts !== right.encryptionAttempts) return false
  for (const field of ['protected', 'iv', 'ciphertext'] as const) {
    if (left[field].length !== right[field].length) return false
    for (let index = 0; index < left[field].length; index += 1) if (left[field][index] !== right[field][index]) return false
  }
  return true
}

describe('complete provenance storage and migration regressions', () => {
  it('imports v7 through literal v8 snapshots to v9 without inferring free-text relations', () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const old = historicalV7(workspace)
    const imported = importWorkspaceJson(JSON.stringify(old))
    expect(imported.version).toBe(9)
    for (const collection of LEGACY_COLLECTION_KEYS) expect(imported[collection]).toEqual(workspace[collection])
    expect(imported.claimRevisions).toHaveLength(workspace.claims.length)
    expect(imported.evidenceRevisions).toHaveLength(workspace.evidence.length)
    expect(imported.evidenceClaimLinks).toEqual([])
    expect(imported.sourceReferences).toEqual([])
    expect(imported.theoryMemoRevisions).toEqual([])
    expect(preflightPortableWorkspaceText(JSON.stringify(old)).migrationSteps).toEqual(['v7 → v8', 'v8 → v9'])
    expect(importWorkspaceJson(JSON.stringify(old)).claimRevisions).toEqual(imported.claimRevisions)
  })

  it('rejects an ambiguous old envelope before any new collection is overwritten', () => {
    const old = historicalV7()
    old.codingAssignments = [{ id: 'synthetic-data-that-must-not-be-dropped' }]
    expect(validateWorkspace(old).success).toBe(false)
    expect(old.codingAssignments).toEqual([{ id: 'synthetic-data-that-must-not-be-dropped' }])
    const v8 = migrateWorkspaceV7ToV8(historicalV7()) as Record<string, unknown>
    v8.sourceReferences = [{ id: 'synthetic-v9-field-in-v8' }]
    expect(validateWorkspace(v8).success).toBe(false)
  })

  it('plans migration capacity in memory and refuses an ordinary-backup source whose snapshots would exceed 32 MiB', () => {
    const source = capacityExpansionFixture()
    const old = historicalV7(source)
    const sourceJson = JSON.stringify(old)
    expect(workspaceSerializedBytes(source)).toBeLessThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    const result = validateWorkspace(old)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['migrationCapacity'] })]))
    expect(() => preflightPortableWorkspaceText(sourceJson)).toThrow(WorkspaceValidationError)
    expect(JSON.stringify(old)).toBe(sourceJson)
  }, 60_000)

  it('rejects new qualitative children under a different colliding project before writes', async () => {
    const current = createDemoWorkspace(ANCHOR)
    const incoming = structuredClone(current)
    const source = completeFixture()
    const projectId = incoming.projects[0]!.id
    const code = source.qualitativeCodes[0]!, revision = source.qualitativeCodeRevisions.find((row) => row.id === code.currentRevisionId)!
    incoming.projects[0]!.title = 'Synthetic different project under an existing ID'
    incoming.qualitativeCodes.push({ ...code, projectId })
    incoming.qualitativeCodeRevisions.push({ ...revision, projectId, revisionNo: 1, previousRevisionId: undefined })
    expect(validateWorkspace(incoming).success).toBe(true)
    expect(() => buildMergedWorkspace(current, incoming)).toThrow(WorkspaceValidationError)
  })

  it('rejects a new transcript reference that would attach to a different colliding interview', () => {
    const current = createDemoWorkspace(ANCHOR)
    const incoming = structuredClone(current)
    const source = completeFixture()
    const interview = incoming.interviews[0]!
    interview.participantAlias = 'Synthetic different interview alias under an existing ID'
    const reference = source.sourceReferences[0]!, revision = source.sourceRevisions.find((row) => row.id === reference.currentRevisionId)!
    incoming.sourceReferences.push({ ...reference, projectId: interview.projectId, owners: [{ kind: 'interview', interviewId: interview.id }] })
    incoming.sourceRevisions.push({ ...revision, projectId: interview.projectId, revisionNo: 1, previousRevisionId: undefined })
    expect(validateWorkspace(incoming).success).toBe(true)
    expect(() => buildMergedWorkspace(current, incoming)).toThrow(WorkspaceValidationError)
  })

  it('retains all 44 collections and historical endpoints in ordinary JSON and IndexedDB', async () => {
    const fixture = completeFixture()
    expect(WORKSPACE_COLLECTION_KEYS).toHaveLength(44)
    const jsonRestored = importWorkspaceJson(exportWorkspaceJson(fixture))
    for (const collection of WORKSPACE_COLLECTION_KEYS) expect(jsonRestored[collection]).toEqual(fixture[collection])
    const database = new SociologyPhdDeskDatabase(`synthetic-provenance-roundtrip-${crypto.randomUUID()}`)
    const repository = new StandardWorkspaceRepository(database, fixture.workspace.id)
    try {
      await repository.initializeWorkspace(fixture)
      expect(database.tables).toHaveLength(45)
      const restored = (await repository.getWorkspaceSnapshot())!
      for (const collection of WORKSPACE_COLLECTION_KEYS) expect(restored[collection] as unknown[]).toEqual(expect.arrayContaining(fixture[collection] as unknown[]))
      expect(workspaceSnapshotsEqual(restored, fixture)).toBe(true)
      const merged = buildMergedWorkspace(restored, fixture)
      for (const collection of WORKSPACE_COLLECTION_KEYS) {
        expect(merged.result.added[collection]).toBe(0)
        expect(merged.result.skipped[collection]).toBe(fixture[collection].length)
      }
      const stale = structuredClone(restored)
      const updated = structuredClone(restored)
      updated.workspace.name = 'Synthetic current full snapshot'
      await repository.replaceWorkspace(updated, restored.workspace.revision)
      await expect(repository.replaceWorkspace(stale, restored.workspace.revision)).rejects.toBeInstanceOf(WorkspaceConflictError)
      const conflict = structuredClone((await repository.getWorkspaceSnapshot())!)
      conflict.qualitativeCodeRevisions[0]!.definition = 'Synthetic incompatible immutable definition'
      const preflight = preflightPortableWorkspaceText(JSON.stringify(conflict), (await repository.getWorkspaceSnapshot())!)
      expect(preflight.conflictCount).toBeGreaterThan(0)
      const before = (await repository.getWorkspaceSnapshot())!
      await expect(repository.mergeWorkspace(conflict)).rejects.toBeInstanceOf(WorkspaceValidationError)
      expect(workspaceSnapshotsEqual((await repository.getWorkspaceSnapshot())!, before)).toBe(true)
    } finally { repository.close(); await Dexie.delete(database.name) }
  })

  it('retains every collection through authenticated encrypted backup and encrypted local storage', async () => {
    const fixture = completeFixture()
    const backup = await createEncryptedBackup(fixture, PASSPHRASE)
    expect(inspectBackupProtectedHeader(backup).payloadVersion).toBe(9)
    const restored = await openEncryptedBackup(backup, PASSPHRASE)
    for (const collection of WORKSPACE_COLLECTION_KEYS) expect(restored[collection]).toEqual(fixture[collection])
    await expect(openEncryptedBackup(backup, 'Incorrect synthetic passphrase')).rejects.toThrow()
    const session = await createEncryptedWorkspace(fixture, PASSPHRASE)
    try {
      const before = await inspectEncryptedWorkspaceRecord(session.bindingId)
      const conflict = structuredClone(fixture)
      conflict.evidenceUsages[0]!.note = 'Synthetic same-ID different usage'
      await expect(session.merge(conflict)).rejects.toBeInstanceOf(WorkspaceValidationError)
      expect(await inspectEncryptedWorkspaceRecord(session.bindingId)).toEqual(before)
      const bindingId = session.bindingId
      session.close()
      const reopened = await unlockEncryptedWorkspace(bindingId, PASSPHRASE)
      try { for (const collection of WORKSPACE_COLLECTION_KEYS) expect(reopened.workspace[collection]).toEqual(fixture[collection]) }
      finally { reopened.close() }
    } finally { session.close(); await removeEncryptedWorkspaceStorage(session.bindingId) }
  })

  it.each([7, 8] as const)('authenticates historical v%s backups and upgrades local vaults exactly once', async (version) => {
    const workspace = createDemoWorkspace(ANCHOR)
    const backup = await createSyntheticLegacyBackup(workspace, PASSPHRASE, version)
    expect(inspectBackupProtectedHeader(backup).payloadVersion).toBe(version)
    expect(await openEncryptedBackup(backup, PASSPHRASE)).toEqual(workspace)
    const bindingId = crypto.randomUUID()
    const container = await createSyntheticLegacyLocalContainer(workspace, PASSPHRASE, { bindingId, storageRevision: 0, keyInvocation: 1 }, version)
    const database = new EncryptedVaultDatabase(bindingId)
    await database.vaults.put({ id: ENCRYPTED_VAULT_RECORD_ID, storageRevision: 0, lockEpoch: 0, keyInvocation: 1, encryptionAttempts: 1, ...container })
    database.close()
    try {
      const before = await inspectEncryptedWorkspaceRecord(bindingId)
      await expect(unlockEncryptedWorkspace(bindingId, 'Wrong synthetic passphrase')).rejects.toThrow()
      expect(await inspectEncryptedWorkspaceRecord(bindingId)).toEqual(before)
      const first = await unlockEncryptedWorkspace(bindingId, PASSPHRASE)
      expect(first.workspace).toEqual(workspace)
      expect(first.workspace.workspace.revision).toBe(0)
      first.close()
      const upgraded = (await inspectEncryptedWorkspaceRecord(bindingId))!
      expect(inspectLocalProtectedHeader(upgraded).payloadVersion).toBe(9)
      const second = await unlockEncryptedWorkspace(bindingId, PASSPHRASE)
      second.close()
      expect(await inspectEncryptedWorkspaceRecord(bindingId)).toEqual(upgraded)
    } finally { await removeEncryptedWorkspaceStorage(bindingId) }
  })

  it('rolls back an over-budget v7 database upgrade without changing its schema or records', async () => {
    const base = createDemoWorkspace(ANCHOR)
    const old = createEmptyWorkspace({ id: 'synthetic-capacity-workspace', now: ANCHOR })
    old.projects = [base.projects[0]!]
    old.claims = Array.from({ length: 25_000 }, (_, index) => ({ ...base.claims[0]!, id: `synthetic-claim-${index}`, text: `Synthetic claim ${index}`, notes: '' }))
    old.evidence = Array.from({ length: 25_000 }, (_, index) => ({ ...base.evidence[0]!, id: `synthetic-evidence-${index}`, claim: '', source: '', locator: '', finding: '', limitations: '', manuscriptLocation: '' }))
    const name = `synthetic-v7-capacity-${crypto.randomUUID()}`
    const stores = { workspaces: '&id, revision', ...Object.fromEntries(LEGACY_COLLECTION_KEYS.map(collection => [collection, '&id'])) }
    const historical = new Dexie(name)
    historical.version(7).stores(stores)
    await historical.table('workspaces').put(old.workspace)
    await Promise.all(LEGACY_COLLECTION_KEYS.map(collection => historical.table(collection).bulkPut(old[collection])))
    historical.close()
    const candidate = new SociologyPhdDeskDatabase(name)
    try {
      await expect(candidate.open()).rejects.toBeInstanceOf(WorkspaceValidationError)
      candidate.close()
      const preserved = new Dexie(name)
      preserved.version(7).stores(stores)
      try {
        await preserved.open()
        expect(preserved.verno).toBe(7)
        expect(await preserved.table('claims').count()).toBe(25_000)
        expect(await preserved.table('evidence').count()).toBe(25_000)
        expect(await preserved.table('workspaces').get(old.workspace.id)).toEqual(old.workspace)
        expect(preserved.tables.map(table => table.name)).not.toContain('claimRevisions')
      } finally { preserved.close() }
    } finally { candidate.close(); await Dexie.delete(name) }
  }, 60_000)

  it('rolls back a byte-capacity v7 upgrade and retains authenticated legacy ciphertext', async () => {
    const source = capacityExpansionFixture()
    expect(workspaceSerializedBytes(source)).toBeLessThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    const name = `synthetic-v7-byte-capacity-${crypto.randomUUID()}`
    const stores = { workspaces: '&id, revision', ...Object.fromEntries(LEGACY_COLLECTION_KEYS.map(collection => [collection, '&id'])) }
    const historical = new Dexie(name)
    historical.version(7).stores(stores)
    await historical.table('workspaces').put(source.workspace)
    await Promise.all(LEGACY_COLLECTION_KEYS.map(collection => historical.table(collection).bulkPut(source[collection])))
    historical.close()
    const candidate = new SociologyPhdDeskDatabase(name)
    const bindingId = crypto.randomUUID()
    try {
      await expect(candidate.open()).rejects.toBeInstanceOf(WorkspaceValidationError)
      candidate.close()
      const preserved = new Dexie(name)
      preserved.version(7).stores(stores)
      try {
        await preserved.open()
        expect(preserved.verno).toBe(7)
        expect(await preserved.table('claims').count()).toBe(80)
        expect(await preserved.table('claims').get(source.claims[0]!.id)).toEqual(source.claims[0])
        expect(preserved.tables.map(table => table.name)).not.toContain('claimRevisions')
      } finally { preserved.close() }
      const container = await createSyntheticLegacyLocalContainer(source, PASSPHRASE, { bindingId, storageRevision: 0, keyInvocation: 1 }, 7)
      const database = new EncryptedVaultDatabase(bindingId)
      await database.vaults.put({ id: ENCRYPTED_VAULT_RECORD_ID, storageRevision: 0, lockEpoch: 0, keyInvocation: 1, encryptionAttempts: 1, ...container })
      database.close()
      const before = await inspectEncryptedWorkspaceRecord(bindingId)
      await expect(unlockEncryptedWorkspace(bindingId, PASSPHRASE)).rejects.toThrow()
      expect(sameVaultRecord((await inspectEncryptedWorkspaceRecord(bindingId))!, before!)).toBe(true)
      expect(inspectLocalProtectedHeader((await inspectEncryptedWorkspaceRecord(bindingId))!).payloadVersion).toBe(7)
    } finally { candidate.close(); await Dexie.delete(name); await removeEncryptedWorkspaceStorage(bindingId) }
  }, 60_000)
})
