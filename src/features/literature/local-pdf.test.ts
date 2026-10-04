import Dexie from 'dexie'
import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../../models/demo'
import { importWorkspaceJson, exportWorkspaceJson, validateWorkspace } from '../../utils/workspace-transfer'
import { SociologyPhdDeskDatabase } from '../../db/database'
import { StandardWorkspaceRepository } from '../../db/workspaceRepository'
import { createEncryptedBackup, openEncryptedBackup, inspectBackupProtectedHeader } from '../../crypto'
import { createSyntheticLegacyV5Backup } from '../../crypto/legacyV3TestFixture.test-helper'
import { isValidLiteraturePdf, MAX_PDF_BYTES, readLocalPdf } from './local-pdf'

const bytes = new TextEncoder().encode('%PDF-1.4\nSYNTHETIC regression fixture\n%%EOF')
const pdf = { fileName: 'synthetic.pdf', size: bytes.length, base64: btoa(String.fromCharCode(...bytes)) }
const passphrase = 'SYNTHETIC passphrase 2026'
const anchor = new Date('2026-10-03T00:00:00Z')

beforeAll(() => Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto }))

describe('local literature PDF persistence', () => {
  it('reads the file bytes and rejects renamed text and oversized files before reading', async () => {
    const file = new File([bytes], 'synthetic.pdf')
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer })
    expect(await readLocalPdf(file)).toEqual(pdf)
    expect(isValidLiteraturePdf({ ...pdf, base64: btoa('not a PDF'), size: 9 })).toBe(false)
    expect(isValidLiteraturePdf({ ...pdf, size: pdf.size + 1 })).toBe(false)
    expect(isValidLiteraturePdf({ ...pdf, fileName: 'other.txt' })).toBe(false)
    const oversized = { size: MAX_PDF_BYTES + 1, arrayBuffer: () => { throw new Error('must not read') } } as unknown as File
    await expect(readLocalPdf(oversized)).rejects.toThrow('pdf-size')
  })

  it('preserves PDFs through portable backup and rejects corrupted attachments', () => {
    const workspace = createDemoWorkspace(anchor)
    workspace.literature[0]!.localPdf = pdf
    expect(importWorkspaceJson(exportWorkspaceJson(workspace)).literature[0]!.localPdf).toEqual(pdf)
    workspace.literature[0]!.localPdf = { ...pdf, size: 2 }
    expect(validateWorkspace(workspace).success).toBe(false)
  })

  it('rejects a workspace with more than 20 MiB of attachments', () => {
    const workspace = createDemoWorkspace(anchor)
    const large = { fileName: 'large.pdf', size: MAX_PDF_BYTES, base64: btoa('%PDF-' + 'x'.repeat(MAX_PDF_BYTES - 5)) }
    workspace.literature = Array.from({ length: 3 }, (_, i) => ({ ...workspace.literature[0]!, id: `large-${i}`, localPdf: large }))
    expect(validateWorkspace(workspace)).toMatchObject({ success: false, issues: [expect.objectContaining({ path: ['literature'] })] })
  })

  it('preserves two 10 MiB synthetic PDFs through the complete ordinary backup at the new 20 MiB boundary', () => {
    const workspace = createDemoWorkspace(anchor)
    const large = { fileName: 'SYNTHETIC-capacity.pdf', size: MAX_PDF_BYTES, base64: btoa('%PDF-' + 'x'.repeat(MAX_PDF_BYTES - 5)) }
    workspace.literature = Array.from({ length: 2 }, (_, i) => ({ ...workspace.literature[0]!, id: `SYNTHETIC-limit-${i}`, localPdf: large }))
    expect(validateWorkspace(workspace).success).toBe(true)
    const reopened = importWorkspaceJson(exportWorkspaceJson(workspace))
    expect(reopened.literature).toEqual(workspace.literature)
    expect(reopened.literature.reduce((sum, item) => sum + item.localPdf!.size, 0)).toBe(20 * 1024 * 1024)
  }, 30_000)

  it('upgrades v5 without rewriting existing research records or inventing PDFs', () => {
    const workspace = createDemoWorkspace(anchor)
    const { fieldMaps: _fieldMaps, ...v6Workspace } = workspace
    const historical = { ...v6Workspace, version: 5 }
    const migrated = importWorkspaceJson(JSON.stringify(historical))
    expect(migrated.version).toBe(7)
    expect(migrated.literature).toEqual(workspace.literature)
    expect(migrated.literatureExternalReferences).toEqual(workspace.literatureExternalReferences)
    expect(migrated.projects).toEqual(workspace.projects)
    historical.literature[0]!.localPdf = pdf
    expect(validateWorkspace(historical).success).toBe(false)
  })

  it('reads identical PDF bytes after closing and reopening IndexedDB', async () => {
    const name = `synthetic-pdf-${crypto.randomUUID()}`
    const workspace = createDemoWorkspace(anchor)
    workspace.literature[0]!.localPdf = pdf
    const first = new StandardWorkspaceRepository(new SociologyPhdDeskDatabase(name))
    let reopened: StandardWorkspaceRepository | undefined
    try {
      await first.initializeWorkspace(workspace)
      first.close()
      reopened = new StandardWorkspaceRepository(new SociologyPhdDeskDatabase(name))
      expect((await reopened.getWorkspaceSnapshot())?.literature[0]!.localPdf).toEqual(pdf)
    } finally {
      first.close()
      reopened?.close()
      await Dexie.delete(name)
    }
  })

  it('encrypts attachments and restores them exactly without plaintext in the wrapper', async () => {
    const workspace = createDemoWorkspace(anchor)
    workspace.literature[0]!.localPdf = pdf
    const backup = await createEncryptedBackup(workspace, passphrase)
    expect(backup).not.toContain(pdf.fileName)
    expect(backup).not.toContain(pdf.base64)
    expect((await openEncryptedBackup(backup, passphrase)).literature[0]!.localPdf).toEqual(pdf)
  })

  it('authenticates existing v5 encrypted backups before upgrading to v7', async () => {
    const workspace = createDemoWorkspace(anchor)
    const backup = await createSyntheticLegacyV5Backup(workspace, passphrase)
    const opened = await openEncryptedBackup(backup, passphrase)
    expect(inspectBackupProtectedHeader(backup).payloadVersion).toBe(5)
    expect(opened.version).toBe(7)
    expect(opened.literature).toEqual(workspace.literature)
    expect(opened.literatureExternalReferences).toEqual(workspace.literatureExternalReferences)
    await expect(openEncryptedBackup(backup, 'wrong synthetic passphrase')).rejects.toThrow()
  })
})
