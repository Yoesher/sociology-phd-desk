import { MAX_CIPHERTEXT_BYTES, inspectBackupProtectedHeader, openEncryptedBackup } from '../crypto'
import { WORKSPACE_SCHEMA_VERSION, type WorkspaceData } from '../models/domain'
import {
  WORKSPACE_COLLECTIONS,
  buildMergedWorkspace,
  type WorkspaceCollectionName,
} from '../db/workspaceRepository'
import {
  validateWorkspace,
  WorkspaceValidationError,
  type WorkspaceValidationIssue,
} from './workspace-transfer'

export const MAX_PORTABLE_WORKSPACE_FILE_BYTES = 32 * 1_024 * 1_024
export const MAX_ENCRYPTED_BACKUP_FILE_BYTES =
  Math.ceil((MAX_CIPHERTEXT_BYTES * 4) / 3) + 32_768
export const MAX_WORKSPACE_RECORDS_PER_COLLECTION = 25_000
export const MAX_WORKSPACE_RECORDS_TOTAL = 100_000

export type ImportSourceFormat = 'portable-workspace-json' | 'encrypted-workspace-backup'

export interface WorkspaceImportPreflight {
  sourceFormat: ImportSourceFormat
  sourceVersion: number
  targetVersion: typeof WORKSPACE_SCHEMA_VERSION
  migrationSteps: string[]
  collectionCounts: Record<WorkspaceCollectionName, number>
  totalRecords: number
  duplicateCount: number
  duplicateIds: Partial<Record<WorkspaceCollectionName, string[]>>
  conflictCount: number
  conflictIssues: WorkspaceValidationIssue[]
  risks: Array<'plaintext-sensitive' | 'encrypted-authenticated' | 'merge-collisions' | 'replacement-destructive'>
  snapshot: WorkspaceData
}

function invalidJsonError(): WorkspaceValidationError {
  return new WorkspaceValidationError('The selected file is not valid JSON.', [
    { path: [], message: 'Invalid JSON syntax.' },
  ])
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw invalidJsonError()
  }
}

function sourceVersionOf(input: unknown): number {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return 0
  const version = (input as Record<string, unknown>)['version']
  return typeof version === 'number' && Number.isInteger(version) ? version : 0
}

function migrationSteps(sourceVersion: number): string[] {
  if (sourceVersion < 1 || sourceVersion > WORKSPACE_SCHEMA_VERSION) return []
  return Array.from(
    { length: WORKSPACE_SCHEMA_VERSION - sourceVersion },
    (_, index) => `v${sourceVersion + index} → v${sourceVersion + index + 1}`,
  )
}

function recordCounts(snapshot: WorkspaceData): Record<WorkspaceCollectionName, number> {
  return Object.fromEntries(
    WORKSPACE_COLLECTIONS.map((collection) => [collection, snapshot[collection].length]),
  ) as Record<WorkspaceCollectionName, number>
}

function assertRecordLimits(counts: Record<WorkspaceCollectionName, number>): number {
  const issues: WorkspaceValidationIssue[] = []
  let total = 0
  WORKSPACE_COLLECTIONS.forEach((collection) => {
    const count = counts[collection]
    total += count
    if (count > MAX_WORKSPACE_RECORDS_PER_COLLECTION) {
      issues.push({
        path: [collection],
        message: `${collection} exceeds the ${MAX_WORKSPACE_RECORDS_PER_COLLECTION} record import limit.`,
      })
    }
  })
  if (total > MAX_WORKSPACE_RECORDS_TOTAL) {
    issues.push({
      path: [],
      message: `The workspace exceeds the ${MAX_WORKSPACE_RECORDS_TOTAL} total record import limit.`,
    })
  }
  if (issues.length > 0) {
    throw new WorkspaceValidationError('The workspace exceeds guarded import limits.', issues)
  }
  return total
}

function duplicateSummary(current: WorkspaceData | undefined, incoming: WorkspaceData) {
  const duplicateIds: Partial<Record<WorkspaceCollectionName, string[]>> = {}
  let duplicateCount = 0
  if (!current) return { duplicateIds, duplicateCount }
  WORKSPACE_COLLECTIONS.forEach((collection) => {
    const localIds = new Set(current[collection].map((record) => record.id))
    const matches = incoming[collection]
      .map((record) => record.id)
      .filter((id) => localIds.has(id))
      .sort()
    if (matches.length > 0) duplicateIds[collection] = matches
    duplicateCount += matches.length
  })
  return { duplicateIds, duplicateCount }
}

function conflictIssues(current: WorkspaceData | undefined, incoming: WorkspaceData) {
  if (!current || current.workspace.id !== incoming.workspace.id) return []
  try {
    buildMergedWorkspace(current, incoming)
    return []
  } catch (error) {
    if (error instanceof WorkspaceValidationError) return error.issues
    throw error
  }
}

function buildPreflight(
  sourceFormat: ImportSourceFormat,
  sourceVersion: number,
  snapshot: WorkspaceData,
  current?: WorkspaceData,
): WorkspaceImportPreflight {
  const counts = recordCounts(snapshot)
  const totalRecords = assertRecordLimits(counts)
  const duplicates = duplicateSummary(current, snapshot)
  const conflicts = conflictIssues(current, snapshot)
  return {
    sourceFormat,
    sourceVersion,
    targetVersion: WORKSPACE_SCHEMA_VERSION,
    migrationSteps: migrationSteps(sourceVersion),
    collectionCounts: counts,
    totalRecords,
    duplicateCount: duplicates.duplicateCount,
    duplicateIds: duplicates.duplicateIds,
    conflictCount: conflicts.length,
    conflictIssues: conflicts,
    risks: [
      sourceFormat === 'portable-workspace-json' ? 'plaintext-sensitive' : 'encrypted-authenticated',
      ...(duplicates.duplicateCount > 0 ? ['merge-collisions' as const] : []),
      ...(current && current.workspace.id === snapshot.workspace.id
        ? ['replacement-destructive' as const]
        : []),
    ],
    snapshot,
  }
}

export async function readGuardedText(file: File, maximumBytes: number): Promise<string> {
  if (file.size > maximumBytes) {
    throw new WorkspaceValidationError('The selected file exceeds its import size limit.', [
      { path: [], message: `File size ${file.size} exceeds the ${maximumBytes} byte limit.` },
    ])
  }
  const text = await file.text()
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new WorkspaceValidationError('The selected file exceeds its import size limit.', [
      { path: [], message: `Decoded file content exceeds the ${maximumBytes} byte limit.` },
    ])
  }
  return text
}

export function preflightPortableWorkspaceText(
  text: string,
  current?: WorkspaceData,
): WorkspaceImportPreflight {
  const input = parseJson(text)
  const sourceVersion = sourceVersionOf(input)
  const result = validateWorkspace(input)
  if (!result.success) {
    throw new WorkspaceValidationError('The workspace file failed validation.', result.issues)
  }
  return buildPreflight('portable-workspace-json', sourceVersion, result.data, current)
}

export async function preflightPortableWorkspaceFile(
  file: File,
  current?: WorkspaceData,
): Promise<WorkspaceImportPreflight> {
  return preflightPortableWorkspaceText(
    await readGuardedText(file, MAX_PORTABLE_WORKSPACE_FILE_BYTES),
    current,
  )
}

export async function preflightEncryptedWorkspaceFile(
  file: File,
  passphrase: string,
): Promise<WorkspaceImportPreflight> {
  const text = await readGuardedText(file, MAX_ENCRYPTED_BACKUP_FILE_BYTES)
  const header = inspectBackupProtectedHeader(text)
  const snapshot = await openEncryptedBackup(text, passphrase)
  return buildPreflight('encrypted-workspace-backup', header.payloadVersion, snapshot)
}
