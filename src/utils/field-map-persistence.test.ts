import { webcrypto } from 'node:crypto'
import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import { isPristineDemoWorkspace } from '../models/demo'
import { PROVENANCE_COLLECTION_KEYS, type ProvenanceCollectionKey } from '../models/provenance'
import type { WorkspaceData } from '../models/domain'
import { SociologyPhdDeskDatabase } from '../db/database'
import { StandardWorkspaceRepository, buildMergedWorkspace } from '../db/workspaceRepository'
import { createEncryptedBackup, openEncryptedBackup, inspectBackupProtectedHeader } from '../crypto'
import { createSyntheticLegacyV6Backup } from '../crypto/legacyV3TestFixture.test-helper'
import { MAX_FIELD_MAP_IMAGE_BYTES, MAX_WORKSPACE_FIELD_MAP_IMAGE_BYTES } from '../features/fieldwork/local-field-map'
import { MAX_SERIALIZED_WORKSPACE_BYTES, workspaceSerializedBytes } from './workspace-capacity'
import { importWorkspaceJson, exportWorkspaceJson, validateWorkspace, migrateWorkspaceV5ToV6, migrateWorkspaceV6ToV7 } from './workspace-transfer'
import { preflightPortableWorkspaceText } from './import-preflight'
import { syntheticFieldMap, paddedSyntheticFieldMapImage } from './field-map.test-helper'

const anchor = new Date('2026-10-04T00:00:00.000Z')
const passphrase = 'SYNTHETIC map persistence passphrase 2026'
beforeAll(() => Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto }))

function workspaceWithMap() {
  const workspace = createDemoWorkspace(anchor)
  workspace.fieldMaps = [syntheticFieldMap(workspace)]
  return workspace
}

function historicalV6(workspace = createDemoWorkspace(anchor)) {
  const { fieldMaps: _fieldMaps, ...current } = workspace
  const legacy = Object.fromEntries(Object.entries(current).filter(([key]) => !PROVENANCE_COLLECTION_KEYS.includes(key as ProvenanceCollectionKey))) as Omit<WorkspaceData, 'fieldMaps' | ProvenanceCollectionKey>
  return { ...legacy, version: 6 }
}

describe('local research-map durable contract', () => {
  it('round-trips image bytes and normalized site annotations with the complete workspace', () => {
    const workspace = workspaceWithMap()
    const restored = importWorkspaceJson(exportWorkspaceJson(workspace))
    expect(restored.fieldMaps).toEqual(workspace.fieldMaps)
    expect(restored.projects).toEqual(workspace.projects)
    expect(restored.interviews).toEqual(workspace.interviews)
    expect(restored.fieldVisits).toEqual(workspace.fieldVisits)
    expect(restored.literature).toEqual(workspace.literature)
    const preflight = preflightPortableWorkspaceText(exportWorkspaceJson(workspace), workspace)
    expect(preflight.collectionCounts.fieldMaps).toBe(1)
    expect(preflight.duplicateIds.fieldMaps).toEqual([workspace.fieldMaps[0]!.id])
    expect(isPristineDemoWorkspace(workspace)).toBe(false)
  })

  it('migrates historical v6 PDFs and all research text unchanged without inferring map annotations', () => {
    const workspace = createDemoWorkspace(anchor)
    const bytes = new TextEncoder().encode('%PDF-1.4\nSYNTHETIC v6 preserved PDF\n%%EOF')
    workspace.literature[0]!.localPdf = { fileName: 'synthetic-v6.pdf', size: bytes.length, base64: btoa(String.fromCharCode(...bytes)) }
    const legacy = historicalV6(workspace)
    const original = structuredClone(legacy)
    const imported = importWorkspaceJson(JSON.stringify(legacy))
    expect(imported).toEqual({ ...workspace, fieldMaps: [] })
    expect(legacy).toEqual(original)
    expect(preflightPortableWorkspaceText(JSON.stringify(legacy)).migrationSteps).toEqual(['v6 → v7', 'v7 → v8', 'v8 → v9'])
    expect(migrateWorkspaceV6ToV7({ ...legacy, fieldMaps: [] })).toEqual({ ...legacy, fieldMaps: [] })
    expect(validateWorkspace({ ...legacy, fieldMaps: [] }).success).toBe(false)
    const v5 = historicalV6(createDemoWorkspace(anchor))
    v5.version = 5
    const v6 = migrateWorkspaceV5ToV6(v5) as Record<string, unknown>
    expect(v6['version']).toBe(6)
    expect(v6['fieldMaps']).toBeUndefined()
    expect((migrateWorkspaceV6ToV7(v6) as Record<string, unknown>)['fieldMaps']).toEqual([])
  })

  it.each(['missing-site', 'missing-project', 'cross-project', 'duplicate-site', 'duplicate-map', 'outside-image', 'non-finite-position', 'geographic-field', 'corrupt-image'] as const)('rejects %s annotations or image metadata without silently normalizing them', (scenario) => {
    const workspace = workspaceWithMap()
    const map = workspace.fieldMaps[0]!
    if (scenario === 'missing-site') map.markers[0]!.fieldSiteId = 'missing-site'
    if (scenario === 'missing-project') map.projectId = 'missing-project'
    if (scenario === 'duplicate-map') workspace.fieldMaps.push(structuredClone(map))
    if (scenario === 'non-finite-position') map.markers[0]!.y = Infinity
    if (scenario === 'cross-project') map.projectId = workspace.projects.find((project) => project.id !== map.projectId)!.id
    if (scenario === 'duplicate-site') map.markers.push({ ...map.markers[0]! })
    if (scenario === 'outside-image') map.markers[0]!.x = 1.01
    if (scenario === 'geographic-field') Object.assign(map.markers[0]!, { latitude: 12 })
    if (scenario === 'corrupt-image') map.image.size += 1
    expect(validateWorkspace(workspace).success).toBe(false)
  })

  it('accepts the full 4 MiB image allowance and rejects an additional map without truncating any image', () => {
    const workspace = workspaceWithMap()
    const image = paddedSyntheticFieldMapImage(MAX_FIELD_MAP_IMAGE_BYTES)
    workspace.fieldMaps = [0, 1].map((index) => ({ ...syntheticFieldMap(workspace, `synthetic-padded-map-${index}`), image: { ...image } }))
    expect(workspace.fieldMaps.reduce((sum, map) => sum + map.image.size, 0)).toBe(MAX_WORKSPACE_FIELD_MAP_IMAGE_BYTES)
    expect(validateWorkspace(workspace).success).toBe(true)
    workspace.fieldMaps.push(syntheticFieldMap(workspace, 'synthetic-extra-map'))
    expect(validateWorkspace(workspace)).toMatchObject({ success: false, issues: [expect.objectContaining({ path: ['fieldMaps'] })] })
    expect(workspace.fieldMaps[0]!.image).toEqual(image)
  })

  it('preserves maps across full snapshot writes, merge, and close/reopen; rejects dangling site deletion atomically', async () => {
    const name = `synthetic-map-storage-${crypto.randomUUID()}`
    const workspace = workspaceWithMap()
    let repository = new StandardWorkspaceRepository(new SociologyPhdDeskDatabase(name))
    try {
      await repository.initializeWorkspace(workspace)
      expect(repository.database.tables).toHaveLength(45)
      const changed = structuredClone(workspace)
      changed.tasks[0]!.notes = 'SYNTHETIC unrelated task edit'
      await repository.replaceWorkspace(changed, 0)
      repository.close()
      repository = new StandardWorkspaceRepository(new SociologyPhdDeskDatabase(name))
      const persisted = (await repository.getWorkspaceSnapshot())!
      expect(persisted.fieldMaps).toEqual(workspace.fieldMaps)
      expect(persisted.tasks.find((task) => task.id === changed.tasks[0]!.id)!.notes).toBe(changed.tasks[0]!.notes)
      const incoming = structuredClone(persisted)
      incoming.fieldMaps.push({ ...syntheticFieldMap(incoming, 'synthetic-second-map'), title: 'Second synthetic sketch' })
      const result = await repository.mergeWorkspace(incoming)
      expect(result.added.fieldMaps).toBe(1)
      expect(result.skipped.fieldMaps).toBe(1)
      const beforeDeletion = (await repository.getWorkspaceSnapshot())!
      const referencedSite = beforeDeletion.fieldMaps[0]!.markers[0]!.fieldSiteId
      const invalid = structuredClone(beforeDeletion)
      invalid.fieldSites = invalid.fieldSites.filter((site) => site.id !== referencedSite)
      invalid.interviews = invalid.interviews.map((interview) => interview.fieldSiteId === referencedSite ? { ...interview, fieldSiteId: undefined } : interview)
      invalid.fieldVisits = invalid.fieldVisits.filter((visit) => visit.fieldSiteId !== referencedSite)
      await expect(repository.replaceWorkspace(invalid, beforeDeletion.workspace.revision)).rejects.toThrow(/validation/)
      expect((await repository.getWorkspaceSnapshot())!.fieldMaps).toEqual(beforeDeletion.fieldMaps)
      expect((await repository.getWorkspaceSnapshot())!.fieldSites).toEqual(beforeDeletion.fieldSites)
      const allowed = structuredClone(invalid)
      allowed.fieldMaps = allowed.fieldMaps.map((map) => ({ ...map, markers: map.markers.filter((marker) => marker.fieldSiteId !== referencedSite) }))
      await repository.replaceWorkspace(allowed, beforeDeletion.workspace.revision)
      expect((await repository.getWorkspaceSnapshot())!.fieldMaps.every((map) => map.markers.length === 0)).toBe(true)
    } finally {
      repository.close()
      await Dexie.delete(name)
    }
  })

  it('refuses imported map annotations that collide with a different local site identity', () => {
    const current = workspaceWithMap()
    const incoming = structuredClone(current)
    incoming.fieldMaps[0]!.id = 'synthetic-new-map'
    incoming.fieldSites[0]!.nameOrAlias = 'Different synthetic research point'
    expect(() => buildMergedWorkspace(current, incoming)).toThrow(/conflicting research-graph IDs/)
    expect(current.fieldMaps[0]!.id).toBe('synthetic-field-map')
  })

  it('authenticates maps inside encrypted backup and preserves actual v6 PDF bytes during migration', async () => {
    const workspace = workspaceWithMap()
    const backup = await createEncryptedBackup(workspace, passphrase)
    expect(inspectBackupProtectedHeader(backup).payloadVersion).toBe(9)
    expect(backup).not.toContain(workspace.fieldMaps[0]!.image.fileName)
    expect(backup).not.toContain(workspace.fieldMaps[0]!.image.base64)
    expect((await openEncryptedBackup(backup, passphrase)).fieldMaps).toEqual(workspace.fieldMaps)
    const bytes = new TextEncoder().encode('%PDF-1.4\nSYNTHETIC existing v6 PDF\n%%EOF')
    workspace.literature[0]!.localPdf = { fileName: 'synthetic-v6.pdf', size: bytes.length, base64: btoa(String.fromCharCode(...bytes)) }
    const old = await createSyntheticLegacyV6Backup(workspace, passphrase)
    expect(inspectBackupProtectedHeader(old).payloadVersion).toBe(6)
    expect(await openEncryptedBackup(old, passphrase)).toEqual({ ...workspace, fieldMaps: [] })
    await expect(openEncryptedBackup(old, 'wrong synthetic passphrase')).rejects.toThrow()
  })

  it('rejects oversized ordinary export without truncation while retaining valid legacy v6 research text', () => {
    const workspace = workspaceWithMap()
    workspace.researchLogs = Array.from({ length: 136 }, (_, index) => ({ ...workspace.researchLogs[0]!, id: `synthetic-large-notes-${index}`, problem: 'x'.repeat(250_000) }))
    expect(workspaceSerializedBytes(workspace)).toBeGreaterThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    expect(validateWorkspace(workspace).success).toBe(true)
    const legacy = historicalV6(workspace)
    const migrated = importWorkspaceJson(JSON.stringify(legacy))
    expect(migrated.version).toBe(9)
    expect(migrated.fieldMaps).toEqual([])
    expect(migrated.researchLogs).toEqual(workspace.researchLogs)
    expect(migrated.literature).toEqual(workspace.literature)
    expect(() => exportWorkspaceJson(workspace)).toThrow(/encrypted backup/)
    expect(() => exportWorkspaceJson(workspace, false)).toThrow(/encrypted backup/)
    expect(workspace.fieldMaps[0]!.image).toEqual(syntheticFieldMap(workspace).image)
    expect(workspace.researchLogs).toHaveLength(136)
    expect(workspace.researchLogs.every((log) => log.problem.length === 250_000)).toBe(true)
  })
})
