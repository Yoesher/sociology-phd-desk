import { describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import { WORKSPACE_COLLECTIONS } from '../db/workspaceRepository'
import {
  buildDiagnosticReport,
  diagnosticFilename,
  serializeDiagnosticReport,
  type ServiceWorkerDiagnostics,
} from './diagnostics'

const entry: WorkspaceRegistryEntry = {
  id: 'SECRET-WORKSPACE-ID',
  storageId: 'SECRET-STORAGE-ID',
  displayName: 'SECRET WORKSPACE NAME',
  kind: 'personal',
  encryptionMode: 'encrypted',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
  schemaVersion: 5,
  storageSchemaVersion: 1,
  registryRevision: 7,
  autoLock: 15,
  state: 'ready',
  legacyMigrationKey: 'SECRET-MIGRATION-ID',
}

const serviceWorker: ServiceWorkerDiagnostics = {
  supported: true,
  controlled: true,
  lifecycle: 'active',
  updateManagerState: 'idle',
}

describe('privacy-safe diagnostics', () => {
  it('exports a deterministic allowlist with record counts and no research content or identifiers', () => {
    const snapshot = createDemoWorkspace(new Date('2026-08-15T00:00:00.000Z'))
    snapshot.workspace.name = 'SECRET WORKSPACE PAYLOAD NAME'
    snapshot.projects[0]!.title = 'SECRET PROJECT TITLE'
    snapshot.literature[0]!.title = 'SECRET LITERATURE TITLE'
    snapshot.literatureExternalReferences.push({
      id: 'SECRET-EXTERNAL-REFERENCE-ID',
      literatureItemId: snapshot.literature[0]!.id,
      provider: 'zotero',
      externalLibraryId: 'SECRET-ZOTERO-LIBRARY',
      externalItemKey: 'SECRET-ZOTERO-KEY',
      importedAt: '2026-08-15T00:00:00.000Z',
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
      isDemo: true,
    })
    snapshot.interviews[0]!.participantAlias = 'SECRET INTERVIEW ALIAS'
    snapshot.claims[0]!.text = 'SECRET CLAIM TEXT'
    snapshot.theoryMemos[0]!.content = 'SECRET THEORY MEMO CONTENT'

    const input = {
      generatedAt: '2026-08-15T01:02:03.004Z',
      entry,
      snapshot,
      userAgent: 'Synthetic Browser 1.0',
      pwaMode: 'standalone' as const,
      serviceWorker,
    }
    const first = buildDiagnosticReport(input)
    const second = buildDiagnosticReport(input)
    const serialized = serializeDiagnosticReport(first)

    expect(first).toEqual(second)
    expect(Object.keys(first)).toEqual([
      'application', 'version', 'generatedAt', 'app', 'environment', 'schemas',
      'workspace', 'migration', 'serviceWorker', 'privacy',
    ])
    expect(Object.keys(first.workspace.recordCounts)).toEqual(WORKSPACE_COLLECTIONS)
    expect(first.workspace.recordCounts.projects).toBe(snapshot.projects.length)
    expect(first.workspace.recordCounts.literatureExternalReferences).toBe(
      snapshot.literatureExternalReferences.length,
    )
    expect(first.workspace.totalRecords).toBe(
      WORKSPACE_COLLECTIONS.reduce((total, collection) => total + snapshot[collection].length, 0),
    )
    expect(first.workspace.mode).toBe('encrypted')
    expect(first.migration).toEqual({ lastStatus: 'verified', schemaStatus: 'current' })
    expect(first.privacy).toEqual({
      researchContentIncluded: false,
      workspaceIdentifiersIncluded: false,
      automaticallyUploaded: false,
    })
    ;[
      'SECRET-WORKSPACE-ID', 'SECRET-STORAGE-ID', 'SECRET WORKSPACE NAME',
      'SECRET WORKSPACE PAYLOAD NAME', 'SECRET PROJECT TITLE', 'SECRET LITERATURE TITLE',
      'SECRET-ZOTERO-KEY', 'SECRET INTERVIEW ALIAS', 'SECRET CLAIM TEXT',
      'SECRET THEORY MEMO CONTENT', 'SECRET-MIGRATION-ID',
      'SECRET-EXTERNAL-REFERENCE-ID', 'SECRET-ZOTERO-LIBRARY',
    ].forEach((secret) => expect(serialized).not.toContain(secret))
  })

  it('uses a workspace-independent UTC filename', () => {
    expect(diagnosticFilename('2026-08-15T01:02:03.004Z')).toBe(
      'sociology-phd-desk-diagnostics-20260815T010203004Z.json',
    )
  })
})
