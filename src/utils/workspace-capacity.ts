import type { WorkspaceData } from '../models/domain'

/** The ordinary backup must remain importable by the bounded JSON reader. */
export const MAX_SERIALIZED_WORKSPACE_BYTES = 32 * 1024 * 1024

export class WorkspaceCapacityError extends Error {
  constructor() {
    super('The complete ordinary backup would exceed 32 MiB. Reduce attachments or local-map images; existing records are retained.')
    this.name = 'WorkspaceCapacityError'
  }
}

/** Match the readable, complete export rather than only its attachment bytes. */
export function workspaceSerializedBytes(data: WorkspaceData): number {
  const exportData = { ...data, exportedAt: new Date().toISOString() }
  return new Blob([JSON.stringify(exportData, null, 2)]).size
}

export function workspacePdfBytes(data: WorkspaceData): number {
  return data.literature.reduce((total, item) => total + (item.localPdf?.size ?? 0), 0)
}

/** Preserve readable legacy workspaces while preventing new unrestorable growth. */
export function assertInteractiveBackupBudget(current: WorkspaceData, next: WorkspaceData): void {
  const nextBytes = workspaceSerializedBytes(next)
  if (nextBytes <= MAX_SERIALIZED_WORKSPACE_BYTES) return
  if (nextBytes <= workspaceSerializedBytes(current)) return
  throw new WorkspaceCapacityError()
}
