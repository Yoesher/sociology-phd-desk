import { WORKSPACE_SCHEMA_VERSION, type ISODateTime } from './domain'

/**
 * Registry records contain local routing metadata only. Research content stays
 * inside the workspace database selected by `storageId`.
 */
export const WORKSPACE_AUTO_LOCK_OPTIONS = ['never', 5, 15, 30, 60] as const
export type WorkspaceAutoLock = (typeof WORKSPACE_AUTO_LOCK_OPTIONS)[number]

export const WORKSPACE_KINDS = ['personal', 'demo'] as const
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number]

export const WORKSPACE_ENCRYPTION_MODES = ['standard', 'encrypted'] as const
export type WorkspaceEncryptionMode = (typeof WORKSPACE_ENCRYPTION_MODES)[number]

export const LEGACY_WORKSPACE_SCHEMA_VERSION = 3 as const
export const SUPPORTED_WORKSPACE_SCHEMA_VERSIONS = [
  LEGACY_WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_SCHEMA_VERSION,
] as const
export type SupportedWorkspaceSchemaVersion =
  (typeof SUPPORTED_WORKSPACE_SCHEMA_VERSIONS)[number]

export const WORKSPACE_REGISTRY_STATES = [
  'provisioning',
  'ready',
  'migration-failed',
  'deleting',
] as const
export type WorkspaceRegistryState = (typeof WORKSPACE_REGISTRY_STATES)[number]

export const PLAINTEXT_SOURCE_KINDS = ['legacy', 'standard'] as const
export type PlaintextSourceKind = (typeof PLAINTEXT_SOURCE_KINDS)[number]

export const PLAINTEXT_SOURCE_STATES = [
  'retained',
  'cleanup-pending',
  'removed',
] as const
export type PlaintextSourceState = (typeof PLAINTEXT_SOURCE_STATES)[number]

/**
 * Non-sensitive cleanup truth for standard-to-encrypted conversion. Multiple
 * entries are allowed because a migrated workspace can retain both its legacy
 * database and its newer standard workspace database.
 */
export interface PlaintextSourceReference {
  id: string
  kind: PlaintextSourceKind
  sourceDatabaseName?: string
  sourceStorageId?: string
  state: PlaintextSourceState
  verifiedAt?: ISODateTime
  removedAt?: ISODateTime
}

/**
 * Durable, metadata-only handoff for a standard-to-encrypted conversion.
 * The source route remains ready and readable until promotion commits.
 */
export interface EncryptedConversionReservation {
  targetStorageId: string
  storageSchemaVersion: number
  sourceRevision: number
  startedAt: ISODateTime
  verifiedAt?: ISODateTime
}

export interface WorkspaceRegistryEntry {
  id: string
  /** Opaque local database locator. It must never contain the display name. */
  storageId: string
  displayName: string
  kind: WorkspaceKind
  encryptionMode: WorkspaceEncryptionMode
  createdAt: ISODateTime
  updatedAt: ISODateTime
  lastOpenedAt?: ISODateTime
  /** Version of the portable WorkspaceData payload stored by this workspace. */
  schemaVersion: SupportedWorkspaceSchemaVersion
  /** Internal schema of the selected storage adapter. */
  storageSchemaVersion: number
  /** Optimistic revision for registry-only metadata changes. */
  registryRevision: number
  autoLock: WorkspaceAutoLock
  /** Time an export was generated; the browser cannot prove where it was saved. */
  lastExportedAt?: ISODateTime
  state: WorkspaceRegistryState
  /** Ephemeral ownership proof for an unpublished provisioning operation. */
  provisioningToken?: string
  legacyMigrationKey?: string
  plaintextSources?: PlaintextSourceReference[]
  encryptedConversion?: EncryptedConversionReservation
}

export const WORKSPACE_MIGRATION_STATUSES = ['copying', 'verified', 'failed'] as const
export type WorkspaceMigrationStatus = (typeof WORKSPACE_MIGRATION_STATUSES)[number]

export interface WorkspaceMigrationLedger {
  /** Deterministic key for one legacy database and workspace identity. */
  id: string
  sourceDatabaseName: string
  sourceDatabaseVersion: number
  sourceWorkspaceId: string
  sourceRevision: number
  targetWorkspaceId: string
  targetStorageId: string
  status: WorkspaceMigrationStatus
  errorCode?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
  verifiedAt?: ISODateTime
}

export interface WorkspaceRegistrySettings {
  id: 'registry-settings'
  bootstrapVersion: number
  activeWorkspaceId?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export function isWorkspaceAutoLock(value: unknown): value is WorkspaceAutoLock {
  return WORKSPACE_AUTO_LOCK_OPTIONS.some((option) => option === value)
}

export function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return WORKSPACE_KINDS.some((kind) => kind === value)
}

export function isWorkspaceEncryptionMode(value: unknown): value is WorkspaceEncryptionMode {
  return WORKSPACE_ENCRYPTION_MODES.some((mode) => mode === value)
}

export function hasRetainedPlaintextSource(entry: WorkspaceRegistryEntry): boolean {
  return Boolean(
    entry.plaintextSources?.some(
      (source) => source.state === 'retained' || source.state === 'cleanup-pending',
    ),
  )
}

/** UI may call an encrypted workspace fully encrypted only when this is true. */
export function isFullyEncryptedWorkspace(entry: WorkspaceRegistryEntry): boolean {
  return entry.encryptionMode === 'encrypted' && !hasRetainedPlaintextSource(entry)
}

export function createOpaqueStorageId(): string {
  const random = globalThis.crypto?.randomUUID?.()
  if (random) return random
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is unavailable.')
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return `storage-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
