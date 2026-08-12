import Dexie from 'dexie'
import {
  DATABASE_SCHEMA_VERSION,
  SociologyPhdDeskDatabase,
} from './database'

export const STANDARD_WORKSPACE_DATABASE_PREFIX = 'sociology-phd-desk-workspace-'
export const STANDARD_WORKSPACE_STORAGE_SCHEMA_VERSION = DATABASE_SCHEMA_VERSION

const opaqueStorageIdPattern = /^[A-Za-z0-9_-]{12,128}$/

export function assertOpaqueStorageId(storageId: string): string {
  if (!opaqueStorageIdPattern.test(storageId)) {
    throw new Error('Workspace storage ID must be an opaque local identifier.')
  }
  return storageId
}

export function standardWorkspaceDatabaseName(storageId: string): string {
  return `${STANDARD_WORKSPACE_DATABASE_PREFIX}${assertOpaqueStorageId(storageId)}`
}

export function createStandardWorkspaceDatabase(
  storageId: string,
): SociologyPhdDeskDatabase {
  const database = new SociologyPhdDeskDatabase(standardWorkspaceDatabaseName(storageId))
  // Dexie's default versionchange handler permits automatic reopening. A
  // repository is bound to one physical generation, so deletion/replacement
  // must permanently poison its old connection instead of recreating an empty
  // database on a later stale read or write.
  database.on('versionchange', () => {
    database.close({ disableAutoOpen: true })
  })
  return database
}

export async function deleteStandardWorkspaceDatabase(storageId: string): Promise<void> {
  await Dexie.delete(standardWorkspaceDatabaseName(storageId))
}

export async function standardWorkspaceDatabaseExists(storageId: string): Promise<boolean> {
  return Dexie.exists(standardWorkspaceDatabaseName(storageId))
}
