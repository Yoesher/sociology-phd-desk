import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createEncryptedBackup } from '../crypto'
import { createDemoWorkspace } from '../models/demo'
import {
  MAX_ENCRYPTED_BACKUP_FILE_BYTES,
  MAX_PORTABLE_WORKSPACE_FILE_BYTES,
  MAX_WORKSPACE_RECORDS_PER_COLLECTION,
  preflightEncryptedWorkspaceFile,
  preflightPortableWorkspaceFile,
  preflightPortableWorkspaceText,
} from './import-preflight'

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto })
})

function fileWith(text: string, name = 'workspace.json'): File {
  const file = new File([text], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: vi.fn(async () => text) })
  return file
}

describe('unified import preflight', () => {
  it('reports current portable counts and exact ID collisions without writes', async () => {
    const current = createDemoWorkspace(new Date('2026-08-14T00:00:00.000Z'))
    const incoming = structuredClone(current)
    incoming.workspace.revision = 4
    const file = fileWith(JSON.stringify(incoming))
    const preflight = await preflightPortableWorkspaceFile(file, current)

    expect(preflight).toMatchObject({
      sourceFormat: 'portable-workspace-json',
      sourceVersion: 5,
      targetVersion: 5,
      migrationSteps: [],
      conflictCount: 0,
    })
    expect(preflight.totalRecords).toBeGreaterThan(0)
    expect(preflight.duplicateCount).toBe(preflight.totalRecords)
    expect(file.text).toHaveBeenCalledOnce()
  })

  it('reports the full legacy v1 to v5 migration chain without inferring new records', () => {
    const legacy = createDemoWorkspace(new Date('2026-08-14T00:00:00.000Z')) as unknown as Record<string, unknown>
    legacy.version = 1
    delete legacy.researchQuestions
    delete legacy.claims
    delete legacy.claimQuestionLinks
    delete legacy.theoryMemos
    delete legacy.literatureExternalReferences
    const projects = legacy.projects as Array<Record<string, unknown>>
    projects.forEach((project) => { project.researchQuestion = 'Synthetic legacy question' })

    const preflight = preflightPortableWorkspaceText(JSON.stringify(legacy))
    expect(preflight.migrationSteps).toEqual(['v1 → v2', 'v2 → v3', 'v3 → v4', 'v4 → v5'])
    expect(preflight.collectionCounts.theoryMemos).toBe(0)
    expect(preflight.collectionCounts.literatureExternalReferences).toBe(0)
  })

  it('rejects future schemas, per-collection abuse, and oversized files before reading', async () => {
    const future = createDemoWorkspace() as unknown as Record<string, unknown>
    future.version = 6
    expect(() => preflightPortableWorkspaceText(JSON.stringify(future))).toThrow()

    const excessive = createDemoWorkspace()
    excessive.tasks = Array.from(
      { length: MAX_WORKSPACE_RECORDS_PER_COLLECTION + 1 },
      (_, index) => ({ ...excessive.tasks[0]!, id: `task-${index}` }),
    )
    expect(() => preflightPortableWorkspaceText(JSON.stringify(excessive))).toThrow(/guarded import limits/)

    const text = vi.fn(async () => '{}')
    await expect(preflightPortableWorkspaceFile({
      size: MAX_PORTABLE_WORKSPACE_FILE_BYTES + 1,
      text,
    } as unknown as File)).rejects.toThrow(/size limit/)
    expect(text).not.toHaveBeenCalled()
  })

  it('surfaces deterministic research-relationship identity conflicts for merge review', () => {
    const current = createDemoWorkspace(new Date('2026-08-14T00:00:00.000Z'))
    const incoming = structuredClone(current)
    incoming.researchQuestions[0] = {
      ...incoming.researchQuestions[0]!,
      text: 'A different question under the same stable ID',
    }
    const preflight = preflightPortableWorkspaceText(JSON.stringify(incoming), current)
    expect(preflight.conflictCount).toBeGreaterThan(0)
    expect(preflight.conflictIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['researchQuestions', 0, 'id'] }),
    ]))
    expect(preflight.duplicateIds.researchQuestions).toContain(incoming.researchQuestions[0]!.id)
  })

  it('authenticates encrypted backups in memory and applies the file-size gate first', async () => {
    const backup = await createEncryptedBackup(
      createDemoWorkspace(new Date('2026-08-14T00:00:00.000Z')),
      'synthetic backup passphrase',
    )
    const preflight = await preflightEncryptedWorkspaceFile(
      fileWith(backup, 'workspace.sociologydesk'),
      'synthetic backup passphrase',
    )
    expect(preflight).toMatchObject({
      sourceFormat: 'encrypted-workspace-backup',
      sourceVersion: 5,
      targetVersion: 5,
      migrationSteps: [],
      duplicateCount: 0,
      conflictCount: 0,
    })

    const text = vi.fn(async () => backup)
    await expect(preflightEncryptedWorkspaceFile({
      size: MAX_ENCRYPTED_BACKUP_FILE_BYTES + 1,
      text,
    } as unknown as File, 'synthetic backup passphrase')).rejects.toThrow(/size limit/)
    expect(text).not.toHaveBeenCalled()
  })
})
