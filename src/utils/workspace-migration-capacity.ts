import { MAX_PLAINTEXT_BYTES } from '../crypto/constants'
import type { WorkspaceData } from '../models/domain'
import { MAX_SERIALIZED_WORKSPACE_BYTES, workspaceSerializedBytes } from './workspace-capacity'

/** Plan restore capacity in memory before any database or ciphertext write. */
export function workspaceMigrationCapacityIssue(source: unknown, candidate: WorkspaceData): string | undefined {
  const sourceRecord = source as Record<string, unknown>
  const sourceReadableBytes = new Blob([JSON.stringify({ ...sourceRecord, exportedAt: new Date().toISOString() }, null, 2)]).size
  const candidateReadableBytes = workspaceSerializedBytes(candidate)
  if (sourceReadableBytes <= MAX_SERIALIZED_WORKSPACE_BYTES && candidateReadableBytes > MAX_SERIALIZED_WORKSPACE_BYTES) {
    return 'Migration would exceed the 32 MiB complete ordinary backup limit. Original records were retained; reduce legacy content before migration. No records were truncated.'
  }
  if (new TextEncoder().encode(JSON.stringify(candidate)).byteLength > MAX_PLAINTEXT_BYTES) {
    return 'Migration would exceed the authenticated encrypted payload capacity. Original records were retained; no complete restore path is available for this candidate.'
  }
  return undefined
}
