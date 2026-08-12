import Dexie from 'dexie'
import {
  EncryptedContainerAuthenticationError,
  EncryptedContainerFormatError,
  EncryptedPayloadValidationError,
  PassphrasePolicyError,
  WebCryptoUnavailableError,
  openEncryptedBackup,
  validateNewPassphrase,
} from '../crypto'
import {
  DEMO_WORKSPACE_ID,
  createDemoWorkspace,
} from '../models/demo'
import { createEmptyWorkspace } from '../models/empty-workspace'
import type { WorkspaceData } from '../models/domain'
import {
  createOpaqueStorageId,
  hasRetainedPlaintextSource,
  isWorkspaceAutoLock,
  type PlaintextSourceReference,
  type WorkspaceAutoLock,
  type WorkspaceKind,
  type WorkspaceRegistryEntry,
  type WorkspaceEncryptionMode,
} from '../models/workspace-registry'
import { validateWorkspace, WorkspaceValidationError } from '../utils/workspace-transfer'
import {
  ENCRYPTED_VAULT_DATABASE_VERSION,
  ENCRYPTED_VAULT_DATABASE_PREFIX,
  encryptedVaultDatabaseName,
} from './encryptedVaultDatabase'
import {
  EncryptedWorkspaceConflictError,
  EncryptedWorkspaceNotFoundError,
  createEncryptedBindingId,
  createEncryptedWorkspace,
  removeEncryptedWorkspaceStorage,
  unlockEncryptedWorkspace,
  type EncryptedWorkspaceCoordinates,
  type UnlockedEncryptedWorkspace,
} from './encryptedWorkspaceRepository'
import {
  bootstrapLocalWorkspaceFoundation,
  readLegacySingleton,
  type LegacyMigrationResult,
} from './legacyWorkspaceMigration'
import {
  WorkspaceRegistryConflictError,
  WorkspaceRegistryDatabase,
  WorkspaceRegistryRepository,
} from './registryDatabase'
import {
  STANDARD_WORKSPACE_DATABASE_PREFIX,
  createStandardWorkspaceDatabase,
  deleteStandardWorkspaceDatabase,
  standardWorkspaceDatabaseName,
  standardWorkspaceDatabaseExists,
} from './standardWorkspaceDatabase'
import {
  StandardWorkspaceRepository,
  WorkspaceConflictError,
  WorkspaceIdentityError,
  WorkspaceStorageInvariantError,
  WorkspaceStorageMissingError,
  workspaceSnapshotsEqual,
  type MergeWorkspaceResult,
} from './workspaceRepository'
import { WorkspaceRepositoryFactory } from './workspaceRepositoryFactory'

export type LocalWorkspaceManagerErrorCode =
  | 'manager-closed'
  | 'workspace-not-found'
  | 'workspace-not-ready'
  | 'provisioning-not-found'
  | 'provisioning-passphrase-required'
  | 'workspace-mode-mismatch'
  | 'invalid-workspace'
  | 'invalid-display-name'
  | 'invalid-auto-lock'
  | 'authentication-failed'
  | 'encrypted-payload-invalid'
  | 'passphrase-policy'
  | 'web-crypto-unavailable'
  | 'revision-conflict'
  | 'demo-only'
  | 'encrypted-demo-passphrase-required'
  | 'plaintext-source-not-found'
  | 'plaintext-source-retained'
  | 'plaintext-cleanup-failed'
  | 'cross-tab-lock-unavailable'
  | 'storage-operation-failed'
  | 'bootstrap-failed'

/** Stable cross-layer error that never embeds research text or a passphrase. */
export class LocalWorkspaceManagerError extends Error {
  readonly code: LocalWorkspaceManagerErrorCode

  constructor(code: LocalWorkspaceManagerErrorCode, message: string) {
    super(message)
    this.name = 'LocalWorkspaceManagerError'
    this.code = code
  }
}

export interface WorkspaceRepositoryPort {
  getWorkspaceSnapshot(): Promise<WorkspaceData>
  replaceWorkspace(
    snapshot: WorkspaceData,
    expectedRevision: number,
  ): Promise<WorkspaceData>
  mergeWorkspace(snapshot: WorkspaceData): Promise<MergeWorkspaceResult>
  refresh(): Promise<WorkspaceData>
  close(): void
}

/** Restricted view: the passphrase and derived CryptoKey are never exposed. */
export interface EncryptedWorkspaceRuntimeView {
  readonly bindingId: string
  readonly coordinates: EncryptedWorkspaceCoordinates
  readonly closed: boolean
  createBackup(passphrase: string, canonicalWorkspaceName?: string): Promise<string>
}

export interface OpenedLocalWorkspaceSession {
  readonly entry: WorkspaceRegistryEntry
  readonly snapshot: WorkspaceData
  readonly mode: WorkspaceEncryptionMode
  readonly storageId: string
  readonly repository: WorkspaceRepositoryPort
  readonly lockAllTabs?: () => Promise<number>
  readonly encryptedRuntime?: EncryptedWorkspaceRuntimeView
}

export interface LocalWorkspaceBootstrapState {
  migration: LegacyMigrationResult
  workspaces: WorkspaceRegistryEntry[]
  activeWorkspaceId?: string
}

export interface CreateLocalWorkspaceOptions {
  displayName?: string
  workspaceId?: string
  autoLock?: WorkspaceAutoLock
  now?: Date
}

export interface ImportLocalWorkspaceOptions extends CreateLocalWorkspaceOptions {
  kind?: WorkspaceKind
}

export interface RestoreEncryptedWorkspaceOptions extends CreateLocalWorkspaceOptions {}

export interface ConvertWorkspaceOptions {
  verifiedAt?: Date
}

export interface ResetDemoWorkspaceOptions {
  now?: Date
  passphrase?: string
}

export interface LocalWorkspaceManagerDependencies {
  createEncrypted?: typeof createEncryptedWorkspace
  unlockEncrypted?: typeof unlockEncryptedWorkspace
  openBackup?: typeof openEncryptedBackup
  removeEncryptedStorage?: typeof removeEncryptedWorkspaceStorage
  deleteStandardStorage?: typeof deleteStandardWorkspaceDatabase
  deleteLegacyStorage?: (databaseName: string) => Promise<void>
  createBindingId?: () => string
  coordinator?: WorkspaceOperationCoordinator
}

export interface WorkspaceOperationCoordinator {
  /** True only when exclusion covers every same-origin browser tab. */
  readonly crossTabSafe: boolean
  runExclusive<T>(storageId: string, operation: () => Promise<T>): Promise<T>
}

interface ResolvedDependencies {
  createEncrypted: typeof createEncryptedWorkspace
  unlockEncrypted: typeof unlockEncryptedWorkspace
  openBackup: typeof openEncryptedBackup
  removeEncryptedStorage: typeof removeEncryptedWorkspaceStorage
  deleteStandardStorage: typeof deleteStandardWorkspaceDatabase
  deleteLegacyStorage: (databaseName: string) => Promise<void>
  createBindingId: () => string
  coordinator: WorkspaceOperationCoordinator
}

function createDefaultCoordinator(): WorkspaceOperationCoordinator {
  const lockManager = globalThis.navigator?.locks
  return {
    crossTabSafe: Boolean(lockManager),
    async runExclusive<T>(storageId: string, operation: () => Promise<T>): Promise<T> {
      if (!lockManager) return operation()
      return lockManager.request(
        `sociology-phd-desk:workspace:${storageId}`,
        { mode: 'exclusive' },
        operation,
      )
    },
  }
}

class WorkspaceSessionState {
  private current: WorkspaceData | null

  constructor(snapshot: WorkspaceData) {
    this.current = snapshot
  }

  read(): WorkspaceData {
    if (!this.current) {
      throw new LocalWorkspaceManagerError(
        'manager-closed',
        'The local workspace session is closed.',
      )
    }
    return this.current
  }

  write(snapshot: WorkspaceData): WorkspaceData {
    this.current = snapshot
    return snapshot
  }

  clear(): void {
    this.current = null
  }
}

function managerError(
  error: unknown,
  fallback: LocalWorkspaceManagerErrorCode = 'storage-operation-failed',
): LocalWorkspaceManagerError {
  if (error instanceof LocalWorkspaceManagerError) return error
  if (error instanceof EncryptedContainerAuthenticationError) {
    return new LocalWorkspaceManagerError(
      'authentication-failed',
      'Encrypted workspace authentication failed.',
    )
  }
  if (
    error instanceof EncryptedContainerFormatError ||
    error instanceof EncryptedPayloadValidationError
  ) {
    return new LocalWorkspaceManagerError(
      'encrypted-payload-invalid',
      'The encrypted workspace payload is invalid.',
    )
  }
  if (error instanceof PassphrasePolicyError) {
    return new LocalWorkspaceManagerError(
      'passphrase-policy',
      'The new passphrase does not satisfy the local policy.',
    )
  }
  if (error instanceof WebCryptoUnavailableError) {
    return new LocalWorkspaceManagerError(
      'web-crypto-unavailable',
      'Required browser cryptography is unavailable.',
    )
  }
  if (
    error instanceof WorkspaceRegistryConflictError ||
    error instanceof WorkspaceConflictError ||
    error instanceof EncryptedWorkspaceConflictError
  ) {
    return new LocalWorkspaceManagerError(
      'revision-conflict',
      'The local workspace changed concurrently.',
    )
  }
  if (error instanceof EncryptedWorkspaceNotFoundError) {
    return new LocalWorkspaceManagerError(
      'workspace-not-found',
      'The local workspace storage was not found.',
    )
  }
  if (error instanceof WorkspaceStorageMissingError) {
    return new LocalWorkspaceManagerError(
      'workspace-not-found',
      'The local workspace storage was not found.',
    )
  }
  if (error instanceof WorkspaceStorageInvariantError) {
    return new LocalWorkspaceManagerError(
      'invalid-workspace',
      'The standard workspace storage is structurally invalid.',
    )
  }
  if (
    error instanceof WorkspaceValidationError ||
    error instanceof WorkspaceIdentityError
  ) {
    return new LocalWorkspaceManagerError(
      'invalid-workspace',
      'The workspace failed strict validation.',
    )
  }
  return new LocalWorkspaceManagerError(
    fallback,
    fallback === 'bootstrap-failed'
      ? 'Local workspace bootstrap failed.'
      : 'The local workspace storage operation failed.',
  )
}

function validatedWorkspace(input: unknown): WorkspaceData {
  const validation = validateWorkspace(input)
  if (!validation.success) {
    throw new LocalWorkspaceManagerError(
      'invalid-workspace',
      'The workspace failed strict validation.',
    )
  }
  return validation.data
}

function createLogicalWorkspaceId(): string {
  const random = globalThis.crypto?.randomUUID?.()
  if (!random) {
    throw new LocalWorkspaceManagerError(
      'storage-operation-failed',
      'A secure workspace identity could not be generated.',
    )
  }
  return `workspace-${random}`
}

function reidentifyWorkspace(
  input: unknown,
  options: {
    workspaceId?: string
    displayName?: string
    now: Date
  },
): WorkspaceData {
  const source = validatedWorkspace(input)
  const timestamp = options.now.toISOString()
  const workspace = validatedWorkspace({
    ...source,
    exportedAt: timestamp,
    workspace: {
      ...source.workspace,
      id: options.workspaceId ?? createLogicalWorkspaceId(),
      name: options.displayName?.trim() || source.workspace.name,
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      isDemo: false,
    },
  })
  if (workspace.workspace.id === source.workspace.id) {
    throw new LocalWorkspaceManagerError(
      'invalid-workspace',
      'A restored or imported workspace must use a new identity.',
    )
  }
  return workspace
}

function demoSnapshotForIdentity(workspaceId: string, now: Date): WorkspaceData {
  const snapshot = createDemoWorkspace(now)
  if (snapshot.workspace.id === workspaceId) return snapshot
  return {
    ...snapshot,
    workspace: {
      ...snapshot.workspace,
      id: workspaceId,
    },
  }
}

function workspaceStorageLockId(
  mode: WorkspaceEncryptionMode,
  storageId: string,
): string {
  return mode === 'standard'
    ? standardWorkspaceDatabaseName(storageId)
    : encryptedVaultDatabaseName(storageId)
}

function plaintextSourceDatabaseName(source: PlaintextSourceReference): string {
  if (source.kind === 'standard' && source.sourceStorageId) {
    return standardWorkspaceDatabaseName(source.sourceStorageId)
  }
  if (source.kind === 'legacy' && source.sourceDatabaseName) {
    return source.sourceDatabaseName
  }
  throw new LocalWorkspaceManagerError(
    'plaintext-source-not-found',
    'The recorded plaintext source has no physical locator.',
  )
}

class StandardWorkspacePort implements WorkspaceRepositoryPort {
  private readonly repository: StandardWorkspaceRepository
  private readonly state: WorkspaceSessionState
  private readonly onClose: () => void
  private readonly runExclusive: <T>(operation: () => Promise<T>) => Promise<T>
  private closed = false
  private lifecycleGeneration = 0

  constructor(
    repository: StandardWorkspaceRepository,
    state: WorkspaceSessionState,
    onClose: () => void,
    runExclusive: <T>(operation: () => Promise<T>) => Promise<T>,
  ) {
    this.repository = repository
    this.state = state
    this.onClose = onClose
    this.runExclusive = runExclusive
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new LocalWorkspaceManagerError(
        'manager-closed',
        'The local workspace session is closed.',
      )
    }
  }

  private captureLifecycle(): number {
    this.assertOpen()
    return this.lifecycleGeneration
  }

  private assertLifecycle(expected: number): void {
    if (this.closed || expected !== this.lifecycleGeneration) {
      throw new LocalWorkspaceManagerError(
        'manager-closed',
        'The local workspace session is closed.',
      )
    }
  }

  private throwManaged(error: unknown, identityIsTerminal = false): never {
    if (
      error instanceof WorkspaceStorageInvariantError ||
      (identityIsTerminal && error instanceof WorkspaceIdentityError) ||
      (error instanceof LocalWorkspaceManagerError &&
        error.code === 'revision-conflict')
    ) {
      this.close()
    }
    throw managerError(error)
  }

  private async refreshWhileLocked(): Promise<WorkspaceData> {
    const lifecycle = this.captureLifecycle()
    const snapshot = await this.repository.getWorkspaceSnapshot()
    this.assertLifecycle(lifecycle)
    if (!snapshot) {
      throw new LocalWorkspaceManagerError(
        'workspace-not-found',
        'The local workspace storage was not found.',
      )
    }
    return this.state.write(snapshot)
  }

  async getWorkspaceSnapshot(): Promise<WorkspaceData> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        return this.refreshWhileLocked()
      })
    } catch (error) {
      this.throwManaged(error, true)
    }
  }

  async replaceWorkspace(
    snapshot: WorkspaceData,
    expectedRevision: number,
  ): Promise<WorkspaceData> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        const lifecycle = this.captureLifecycle()
        await this.repository.replaceWorkspace(structuredClone(snapshot), expectedRevision)
        this.assertLifecycle(lifecycle)
        return await this.refreshWhileLocked()
      })
    } catch (error) {
      this.throwManaged(error)
    }
  }

  async mergeWorkspace(snapshot: WorkspaceData): Promise<MergeWorkspaceResult> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        const lifecycle = this.captureLifecycle()
        const result = await this.repository.mergeWorkspace(structuredClone(snapshot))
        this.assertLifecycle(lifecycle)
        await this.refreshWhileLocked()
        this.assertLifecycle(lifecycle)
        return result
      })
    } catch (error) {
      this.throwManaged(error)
    }
  }

  async refresh(): Promise<WorkspaceData> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        return this.refreshWhileLocked()
      })
    } catch (error) {
      this.throwManaged(error, true)
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.lifecycleGeneration += 1
    this.state.clear()
    this.repository.close()
    this.onClose()
  }
}

class EncryptedWorkspacePort implements WorkspaceRepositoryPort {
  private readonly runtime: UnlockedEncryptedWorkspace
  private readonly state: WorkspaceSessionState
  private readonly onClose: () => void
  private readonly runExclusive: <T>(operation: () => Promise<T>) => Promise<T>
  private closed = false

  constructor(
    runtime: UnlockedEncryptedWorkspace,
    state: WorkspaceSessionState,
    onClose: () => void,
    runExclusive: <T>(operation: () => Promise<T>) => Promise<T>,
  ) {
    this.runtime = runtime
    this.state = state
    this.onClose = onClose
    this.runExclusive = runExclusive
  }

  private assertOpen(): void {
    if (this.closed || this.runtime.closed) {
      throw new LocalWorkspaceManagerError(
        'manager-closed',
        'The local workspace session is closed.',
      )
    }
  }

  private throwManaged(error: unknown): never {
    if (
      this.runtime.closed ||
      (error instanceof LocalWorkspaceManagerError &&
        error.code === 'revision-conflict')
    ) {
      this.close()
    }
    throw managerError(error)
  }

  async getWorkspaceSnapshot(): Promise<WorkspaceData> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        return this.state.read()
      })
    } catch (error) {
      this.throwManaged(error)
    }
  }

  async replaceWorkspace(
    snapshot: WorkspaceData,
    expectedRevision: number,
  ): Promise<WorkspaceData> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        const replaced = await this.runtime.replace(
          structuredClone(snapshot),
          expectedRevision,
        )
        return this.state.write(structuredClone(replaced))
      })
    } catch (error) {
      this.throwManaged(error)
    }
  }

  async mergeWorkspace(snapshot: WorkspaceData): Promise<MergeWorkspaceResult> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        const result = await this.runtime.merge(structuredClone(snapshot))
        this.state.write(structuredClone(this.runtime.workspace))
        return result
      })
    } catch (error) {
      this.throwManaged(error)
    }
  }

  async refresh(): Promise<WorkspaceData> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        return this.state.write(structuredClone(await this.runtime.refresh()))
      })
    } catch (error) {
      this.throwManaged(error)
    }
  }

  async createBackup(
    passphrase: string,
    canonicalWorkspaceName?: string,
  ): Promise<string> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        return this.runtime.createBackup(passphrase, canonicalWorkspaceName)
      })
    } catch (error) {
      this.throwManaged(error)
    }
  }

  async lockAllTabs(): Promise<number> {
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        const epoch = await this.runtime.lock()
        this.close()
        return epoch
      })
    } catch (error) {
      this.close()
      throw managerError(error)
    }
  }

  matchesRoute(entry: WorkspaceRegistryEntry): boolean {
    if (
      this.closed ||
      this.runtime.closed ||
      entry.state !== 'ready' ||
      entry.encryptionMode !== 'encrypted' ||
      entry.storageId !== this.runtime.bindingId
    ) {
      return false
    }
    try {
      return this.state.read().workspace.id === entry.id
    } catch {
      return false
    }
  }

  async authenticateForPlaintextCleanup<T>(
    entry: WorkspaceRegistryEntry,
    whileAuthenticated: (snapshot: WorkspaceData) => Promise<T>,
  ): Promise<T> {
    if (!this.matchesRoute(entry)) {
      throw new LocalWorkspaceManagerError(
        'authentication-failed',
        'An unlocked encrypted workspace session is required for plaintext cleanup.',
      )
    }
    try {
      this.assertOpen()
      return await this.runExclusive(async () => {
        this.assertOpen()
        const refreshed = await this.runtime.refresh()
        this.assertOpen()
        if (
          refreshed.workspace.id !== entry.id ||
          this.runtime.bindingId !== entry.storageId
        ) {
          throw new LocalWorkspaceManagerError(
            'authentication-failed',
            'The unlocked encrypted workspace session no longer matches this route.',
          )
        }
        const snapshot = this.state.write(structuredClone(refreshed))
        const result = await whileAuthenticated(snapshot)
        this.assertOpen()
        return result
      })
    } catch (error) {
      this.throwManaged(error)
    }
  }

  runtimeView(): EncryptedWorkspaceRuntimeView {
    const runtime = this.runtime
    return {
      get bindingId() {
        return runtime.bindingId
      },
      get coordinates() {
        return runtime.coordinates
      },
      get closed() {
        return runtime.closed
      },
      createBackup: (passphrase: string, canonicalWorkspaceName?: string) =>
        this.createBackup(passphrase, canonicalWorkspaceName),
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.state.clear()
    this.runtime.close()
    this.onClose()
  }
}

export class LocalWorkspaceManager {
  readonly registryDatabase: WorkspaceRegistryDatabase
  readonly registry: WorkspaceRegistryRepository

  private readonly factory: WorkspaceRepositoryFactory
  private readonly dependencies: ResolvedDependencies
  private readonly sessions = new Set<WorkspaceRepositoryPort>()
  private closed = false

  constructor(
    registryDatabase: WorkspaceRegistryDatabase = new WorkspaceRegistryDatabase(),
    dependencies: LocalWorkspaceManagerDependencies = {},
  ) {
    this.registryDatabase = registryDatabase
    this.factory = new WorkspaceRepositoryFactory(registryDatabase)
    this.registry = this.factory.registry
    this.dependencies = {
      createEncrypted: dependencies.createEncrypted ?? createEncryptedWorkspace,
      unlockEncrypted: dependencies.unlockEncrypted ?? unlockEncryptedWorkspace,
      openBackup: dependencies.openBackup ?? openEncryptedBackup,
      removeEncryptedStorage:
        dependencies.removeEncryptedStorage ?? removeEncryptedWorkspaceStorage,
      deleteStandardStorage:
        dependencies.deleteStandardStorage ?? deleteStandardWorkspaceDatabase,
      deleteLegacyStorage:
        dependencies.deleteLegacyStorage ?? ((databaseName) => Dexie.delete(databaseName)),
      createBindingId: dependencies.createBindingId ?? createEncryptedBindingId,
      coordinator: dependencies.coordinator ?? createDefaultCoordinator(),
    }
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new LocalWorkspaceManagerError(
        'manager-closed',
        'The local workspace manager is closed.',
      )
    }
  }

  private async readyEntry(id: string): Promise<WorkspaceRegistryEntry> {
    const entry = await this.registry.getWorkspace(id)
    if (!entry) {
      throw new LocalWorkspaceManagerError(
        'workspace-not-found',
        'The local workspace was not found.',
      )
    }
    if (entry.state !== 'ready') {
      throw new LocalWorkspaceManagerError(
        'workspace-not-ready',
        'The local workspace is not ready.',
      )
    }
    return entry
  }

  private encryptedPortForRoute(
    entry: WorkspaceRegistryEntry,
  ): EncryptedWorkspacePort | undefined {
    for (const session of this.sessions) {
      if (session instanceof EncryptedWorkspacePort && session.matchesRoute(entry)) {
        return session
      }
    }
    return undefined
  }

  private async touchOpened(
    expected: WorkspaceRegistryEntry,
  ): Promise<WorkspaceRegistryEntry> {
    try {
      return await this.registry.updateWorkspace(
        expected.id,
        expected.registryRevision,
        (entry) => ({ ...entry, lastOpenedAt: new Date().toISOString() }),
      )
    } catch (error) {
      if (!(error instanceof WorkspaceRegistryConflictError)) throw error
      const current = await this.readyEntry(expected.id)
      if (
        current.storageId !== expected.storageId ||
        current.encryptionMode !== expected.encryptionMode
      ) {
        throw error
      }
      return current
    }
  }

  private requireCrossTabCoordinator(): void {
    if (!this.dependencies.coordinator.crossTabSafe) {
      throw new LocalWorkspaceManagerError(
        'cross-tab-lock-unavailable',
        'This destructive operation requires cross-tab workspace locking.',
      )
    }
  }

  private async assertWorkspaceStorageOwned(
    entry: WorkspaceRegistryEntry,
  ): Promise<void> {
    const databaseName = workspaceStorageLockId(entry.encryptionMode, entry.storageId)
    const entries = await this.registry.listWorkspaces(true)
    const collision = entries.some((candidate) => {
      if (
        candidate.id !== entry.id &&
        workspaceStorageLockId(candidate.encryptionMode, candidate.storageId) ===
          databaseName
      ) {
        return true
      }
      if (
        candidate.encryptedConversion &&
        encryptedVaultDatabaseName(candidate.encryptedConversion.targetStorageId) ===
          databaseName
      ) {
        return true
      }
      return candidate.plaintextSources?.some(
        (source) => plaintextSourceDatabaseName(source) === databaseName,
      )
    })
    const migrations = await this.registryDatabase.migrations.toArray()
    const migrationCollision = migrations.some((migration) => {
      const ownsCurrentStandardTarget =
        entry.encryptionMode === 'standard' &&
        entry.legacyMigrationKey === migration.id &&
        entry.storageId === migration.targetStorageId
      if (
        !ownsCurrentStandardTarget &&
        standardWorkspaceDatabaseName(migration.targetStorageId) === databaseName
      ) {
        return true
      }
      return migration.sourceDatabaseName === databaseName
    })
    if (collision || migrationCollision || databaseName === this.registryDatabase.name) {
      throw new LocalWorkspaceManagerError(
        'storage-operation-failed',
        'The workspace database locator is reserved by another durable route.',
      )
    }

    if (
      entry.encryptionMode === 'standard' &&
      (await standardWorkspaceDatabaseExists(entry.storageId))
    ) {
      const repository = new StandardWorkspaceRepository(
        createStandardWorkspaceDatabase(entry.storageId),
        entry.id,
      )
      try {
        const snapshot = await repository.getWorkspaceSnapshot()
        if (!snapshot || snapshot.workspace.id !== entry.id) {
          throw new LocalWorkspaceManagerError(
            'storage-operation-failed',
            'The standard workspace database identity is invalid.',
          )
        }
      } finally {
        repository.close()
      }
    }
  }

  private async recoverDeletingEntry(initial: WorkspaceRegistryEntry): Promise<void> {
    await this.dependencies.coordinator.runExclusive(
      workspaceStorageLockId(initial.encryptionMode, initial.storageId),
      async () => {
      const entry = await this.registry.getWorkspace(initial.id)
      if (
        !entry ||
        entry.state !== 'deleting' ||
        entry.storageId !== initial.storageId ||
        entry.encryptionMode !== initial.encryptionMode
      ) {
        throw new LocalWorkspaceManagerError(
          'revision-conflict',
          'The workspace deletion tombstone changed concurrently.',
        )
      }
      await this.assertWorkspaceStorageOwned(entry)
      const storageExists =
        entry.encryptionMode === 'standard'
          ? await standardWorkspaceDatabaseExists(entry.storageId)
          : await Dexie.exists(encryptedVaultDatabaseName(entry.storageId))
      if (storageExists) {
        if (entry.encryptionMode === 'standard') {
          await this.dependencies.deleteStandardStorage(entry.storageId)
        } else {
          await this.dependencies.removeEncryptedStorage(entry.storageId)
        }
      }
      await this.registry.finalizeWorkspaceDeletion(entry.id, async (candidate) => {
        if (candidate.encryptionMode === 'standard') {
          return !(await standardWorkspaceDatabaseExists(candidate.storageId))
        }
        return !(await Dexie.exists(encryptedVaultDatabaseName(candidate.storageId)))
      })
      },
    )
  }

  private async recoverDeletingTombstones(): Promise<void> {
    if (!this.dependencies.coordinator.crossTabSafe) return
    const deleting = (await this.registry.listWorkspaces(true)).filter(
      (entry) => entry.state === 'deleting',
    )
    for (const entry of deleting) {
      try {
        await this.recoverDeletingEntry(entry)
      } catch {
        // The tombstone remains the durable recovery record. A later bootstrap
        // or explicit retry will make the same idempotent attempt again.
      }
    }
  }

  private async runWhileRouteIsCurrent<T>(
    entry: WorkspaceRegistryEntry,
    operation: () => Promise<T>,
  ): Promise<T> {
    this.assertOpen()
    return this.dependencies.coordinator.runExclusive(
      workspaceStorageLockId(entry.encryptionMode, entry.storageId),
      async () => {
      this.assertOpen()
      const current = await this.registry.getWorkspace(entry.id)
      if (
        !current ||
        current.state !== 'ready' ||
        current.storageId !== entry.storageId ||
        current.encryptionMode !== entry.encryptionMode
      ) {
        throw new LocalWorkspaceManagerError(
          'revision-conflict',
          'The local workspace route changed concurrently.',
        )
      }
      const result = await operation()
      this.assertOpen()
      return result
      },
    )
  }

  private standardSession(
    entry: WorkspaceRegistryEntry,
    snapshot: WorkspaceData,
    repository: StandardWorkspaceRepository,
  ): OpenedLocalWorkspaceSession {
    try {
      this.assertOpen()
    } catch (error) {
      repository.close()
      throw error
    }
    const state = new WorkspaceSessionState(snapshot)
    let port: StandardWorkspacePort
    port = new StandardWorkspacePort(
      repository,
      state,
      () => this.sessions.delete(port),
      (operation) => this.runWhileRouteIsCurrent(entry, operation),
    )
    this.sessions.add(port)
    return {
      entry,
      get snapshot() {
        return state.read()
      },
      mode: 'standard',
      storageId: entry.storageId,
      repository: port,
    }
  }

  private encryptedSession(
    entry: WorkspaceRegistryEntry,
    runtime: UnlockedEncryptedWorkspace,
  ): OpenedLocalWorkspaceSession {
    try {
      this.assertOpen()
    } catch (error) {
      runtime.close()
      throw error
    }
    if (runtime.workspace.workspace.id !== entry.id) {
      runtime.close()
      throw new LocalWorkspaceManagerError(
        'invalid-workspace',
        'Encrypted storage identity does not match its registry route.',
      )
    }
    const state = new WorkspaceSessionState(structuredClone(runtime.workspace))
    let port: EncryptedWorkspacePort
    port = new EncryptedWorkspacePort(
      runtime,
      state,
      () => this.sessions.delete(port),
      (operation) => this.runWhileRouteIsCurrent(entry, operation),
    )
    this.sessions.add(port)
    return {
      entry,
      get snapshot() {
        return state.read()
      },
      mode: 'encrypted',
      storageId: entry.storageId,
      repository: port,
      lockAllTabs: () => port.lockAllTabs(),
      encryptedRuntime: port.runtimeView(),
    }
  }

  async bootstrap(options: {
    legacyDatabaseName?: string
    now?: Date
  } = {}): Promise<LocalWorkspaceBootstrapState> {
    this.assertOpen()
    try {
      await this.recoverDeletingTombstones()
      const bootstrapped = await bootstrapLocalWorkspaceFoundation(
        this.registryDatabase,
        options,
      )
      this.assertOpen()
      const workspaces = await this.registry.listWorkspaces()
      const settings = await this.registry.getSettings()
      const activeIsReady = workspaces.some(
        (entry) => entry.id === settings?.activeWorkspaceId,
      )
      const fallback = activeIsReady
        ? settings?.activeWorkspaceId
        : workspaces.find((entry) => entry.kind === 'personal')?.id ??
          workspaces.find((entry) => entry.kind === 'demo')?.id
      if (settings?.activeWorkspaceId !== fallback) {
        await this.registry.setActiveWorkspace(fallback)
      }
      return {
        migration: bootstrapped.migration,
        workspaces,
        activeWorkspaceId: fallback,
      }
    } catch (error) {
      throw managerError(error, 'bootstrap-failed')
    }
  }

  async list(): Promise<WorkspaceRegistryEntry[]> {
    this.assertOpen()
    return this.registry.listWorkspaces()
  }

  async listRecoverableProvisioning(): Promise<WorkspaceRegistryEntry[]> {
    this.assertOpen()
    return (await this.registry.listWorkspaces(true)).filter(
      (entry) => entry.state === 'provisioning' || entry.state === 'migration-failed',
    )
  }

  async listPendingDeletions(): Promise<WorkspaceRegistryEntry[]> {
    this.assertOpen()
    return (await this.registry.listWorkspaces(true)).filter(
      (entry) => entry.state === 'deleting',
    )
  }

  async get(id: string): Promise<WorkspaceRegistryEntry | undefined> {
    this.assertOpen()
    const entry = await this.registry.getWorkspace(id)
    return entry?.state === 'ready' ? entry : undefined
  }

  async setActive(id?: string): Promise<string | undefined> {
    this.assertOpen()
    try {
      const settings = await this.registry.setActiveWorkspace(id)
      return settings.activeWorkspaceId
    } catch (error) {
      throw managerError(error)
    }
  }

  async openStandard(id: string): Promise<OpenedLocalWorkspaceSession> {
    this.assertOpen()
    try {
      const expected = await this.readyEntry(id)
      if (expected.encryptionMode !== 'standard') {
        throw new LocalWorkspaceManagerError(
          'workspace-mode-mismatch',
          'The workspace is not stored in standard mode.',
        )
      }
      return await this.dependencies.coordinator.runExclusive(
        standardWorkspaceDatabaseName(expected.storageId),
        async () => {
          this.assertOpen()
          const current = await this.readyEntry(id)
          if (
            current.encryptionMode !== 'standard' ||
            current.storageId !== expected.storageId
          ) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The local workspace route changed concurrently.',
            )
          }
          if (!(await standardWorkspaceDatabaseExists(current.storageId))) {
            throw new LocalWorkspaceManagerError(
              'workspace-not-found',
              'The local workspace storage was not found.',
            )
          }
          const database = createStandardWorkspaceDatabase(current.storageId)
          const repository = new StandardWorkspaceRepository(database, current.id)
          try {
            const snapshot = await repository.getWorkspaceSnapshot()
            if (!snapshot) {
              throw new LocalWorkspaceManagerError(
                'workspace-not-found',
                'The local workspace storage was not found.',
              )
            }
            this.assertOpen()
            const entry = await this.touchOpened(current)
            if (
              entry.encryptionMode !== 'standard' ||
              entry.storageId !== current.storageId
            ) {
              throw new LocalWorkspaceManagerError(
                'revision-conflict',
                'The local workspace route changed concurrently.',
              )
            }
            return this.standardSession(entry, snapshot, repository)
          } catch (error) {
            repository.close()
            throw error
          }
        },
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  async unlockEncrypted(
    id: string,
    passphrase: string,
  ): Promise<OpenedLocalWorkspaceSession> {
    this.assertOpen()
    let runtime: UnlockedEncryptedWorkspace | undefined
    try {
      const expected = await this.readyEntry(id)
      if (expected.encryptionMode !== 'encrypted') {
        throw new LocalWorkspaceManagerError(
          'workspace-mode-mismatch',
          'The workspace is not stored in encrypted mode.',
        )
      }
      return await this.dependencies.coordinator.runExclusive(
        encryptedVaultDatabaseName(expected.storageId),
        async () => {
          this.assertOpen()
          const current = await this.readyEntry(id)
          if (
            current.encryptionMode !== 'encrypted' ||
            current.storageId !== expected.storageId
          ) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The local workspace route changed concurrently.',
            )
          }
          runtime = await this.dependencies.unlockEncrypted(current.storageId, passphrase)
          this.assertOpen()
          if (runtime.workspace.workspace.id !== current.id) {
            throw new LocalWorkspaceManagerError(
              'invalid-workspace',
              'Encrypted storage identity does not match its registry route.',
            )
          }
          const entry = await this.touchOpened(current)
          if (
            entry.encryptionMode !== 'encrypted' ||
            entry.storageId !== current.storageId
          ) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The local workspace route changed concurrently.',
            )
          }
          return this.encryptedSession(entry, runtime)
        },
      )
    } catch (error) {
      runtime?.close()
      throw managerError(error)
    }
  }

  async createStandard(
    options: CreateLocalWorkspaceOptions = {},
  ): Promise<OpenedLocalWorkspaceSession> {
    this.assertOpen()
    try {
      if (options.workspaceId) {
        const existing = await this.registry.getWorkspace(options.workspaceId)
        if (
          existing &&
          (existing.state === 'provisioning' || existing.state === 'migration-failed')
        ) {
          if (existing.encryptionMode !== 'standard') {
            throw new LocalWorkspaceManagerError(
              'workspace-mode-mismatch',
              'The recoverable workspace uses another storage mode.',
            )
          }
          return await this.recoverProvisioning(existing.id)
        }
      }
      const snapshot = createEmptyWorkspace({
        id: options.workspaceId,
        name: options.displayName,
        now: options.now,
      })
      const entry = await this.factory.provisionStandardWorkspace(snapshot, {
        kind: 'personal',
        displayName: snapshot.workspace.name,
        autoLock: options.autoLock,
      })
      return await this.openStandard(entry.id)
    } catch (error) {
      throw managerError(error)
    }
  }

  private async provisionEncryptedSnapshot(
    snapshot: WorkspaceData,
    passphrase: string,
    options: {
      kind: WorkspaceKind
      displayName: string
      autoLock?: WorkspaceAutoLock
    },
  ): Promise<OpenedLocalWorkspaceSession> {
    validateNewPassphrase(passphrase)
    const storageId = this.dependencies.createBindingId()
    const createdAt = snapshot.workspace.createdAt
    const proposed: WorkspaceRegistryEntry = {
      id: snapshot.workspace.id,
      storageId,
      displayName: options.displayName.trim() || snapshot.workspace.name,
      kind: options.kind,
      encryptionMode: 'encrypted',
      createdAt,
      updatedAt: createdAt,
      schemaVersion: snapshot.version,
      storageSchemaVersion: ENCRYPTED_VAULT_DATABASE_VERSION,
      registryRevision: 0,
      autoLock: options.autoLock ?? 'never',
      state: 'provisioning',
      provisioningToken: createOpaqueStorageId(),
    }
    return this.dependencies.coordinator.runExclusive(
      encryptedVaultDatabaseName(storageId),
      async () => {
      // The physical preflight and registry claim share the locator lock. An
      // unknown pre-existing vault is never claimed or deleted by this call.
      if (await Dexie.exists(encryptedVaultDatabaseName(storageId))) {
        throw new LocalWorkspaceManagerError(
          'storage-operation-failed',
          'The proposed encrypted storage locator already exists.',
        )
      }

      const provisioning = await this.registry.beginProvisioning(proposed)
      if (
        provisioning.state !== 'provisioning' ||
        provisioning.provisioningToken !== proposed.provisioningToken
      ) {
        throw new LocalWorkspaceManagerError(
          'revision-conflict',
          'The encrypted workspace identity is already registered.',
        )
      }

      let runtime: UnlockedEncryptedWorkspace | undefined
      let ownedStaging = false
      let verifiedStaging = false
      try {
        runtime = await this.dependencies.createEncrypted(snapshot, passphrase, {
          bindingId: storageId,
        })
        ownedStaging = true
        if (!workspaceSnapshotsEqual(snapshot, runtime.workspace)) {
          throw new LocalWorkspaceManagerError(
            'invalid-workspace',
            'Encrypted storage failed semantic read-back verification.',
          )
        }
        verifiedStaging = true
        const ready = await this.registry.markReady(
          provisioning.id,
          provisioning.registryRevision,
        )
        return this.encryptedSession(ready, runtime)
      } catch (error) {
        runtime?.close()
        let physicalExists = true
        try {
          physicalExists = await Dexie.exists(encryptedVaultDatabaseName(storageId))
        } catch {
          // Preserve the provisioning route when storage truth is unavailable.
        }
        if (ownedStaging && physicalExists && !verifiedStaging) {
          try {
            await this.dependencies.removeEncryptedStorage(storageId)
          } catch {
            // The existence check below, not delete resolution alone, is truth.
          }
          try {
            physicalExists = await Dexie.exists(encryptedVaultDatabaseName(storageId))
          } catch {
            physicalExists = true
          }
        }
        if (!physicalExists && !verifiedStaging && proposed.provisioningToken) {
          await this.registry
            .abandonUnownedProvisioning(
              provisioning.id,
              provisioning.registryRevision,
              proposed.provisioningToken,
            )
            .catch(() => undefined)
        }
        throw managerError(error)
      }
      },
    )
  }

  async createEncrypted(
    passphrase: string,
    options: CreateLocalWorkspaceOptions = {},
  ): Promise<OpenedLocalWorkspaceSession> {
    this.assertOpen()
    try {
      if (options.workspaceId) {
        const existing = await this.registry.getWorkspace(options.workspaceId)
        if (
          existing &&
          (existing.state === 'provisioning' || existing.state === 'migration-failed')
        ) {
          if (existing.encryptionMode !== 'encrypted') {
            throw new LocalWorkspaceManagerError(
              'workspace-mode-mismatch',
              'The recoverable workspace uses another storage mode.',
            )
          }
          return await this.recoverProvisioning(existing.id, passphrase)
        }
      }
      const snapshot = createEmptyWorkspace({
        id: options.workspaceId,
        name: options.displayName,
        now: options.now,
      })
      return await this.provisionEncryptedSnapshot(snapshot, passphrase, {
        kind: 'personal',
        displayName: snapshot.workspace.name,
        autoLock: options.autoLock,
      })
    } catch (error) {
      throw managerError(error)
    }
  }

  async importPlaintextWorkspace(
    input: unknown,
    options: ImportLocalWorkspaceOptions = {},
  ): Promise<OpenedLocalWorkspaceSession> {
    this.assertOpen()
    try {
      const snapshot = reidentifyWorkspace(input, {
        workspaceId: options.workspaceId,
        displayName: options.displayName,
        now: options.now ?? new Date(),
      })
      const entry = await this.factory.provisionStandardWorkspace(snapshot, {
        kind: options.kind ?? 'personal',
        displayName: snapshot.workspace.name,
        autoLock: options.autoLock,
      })
      return await this.openStandard(entry.id)
    } catch (error) {
      throw managerError(error)
    }
  }

  async restoreEncryptedBackup(
    encryptedBackup: string,
    backupPassphrase: string,
    newWorkspacePassphrase: string,
    options: RestoreEncryptedWorkspaceOptions = {},
  ): Promise<OpenedLocalWorkspaceSession> {
    this.assertOpen()
    try {
      validateNewPassphrase(newWorkspacePassphrase)
      // Authentication and strict payload validation happen before any registry
      // or IndexedDB write. Re-identification then remains entirely in memory.
      const authenticated = await this.dependencies.openBackup(
        encryptedBackup,
        backupPassphrase,
      )
      const snapshot = reidentifyWorkspace(authenticated, {
        workspaceId: options.workspaceId,
        displayName: options.displayName,
        now: options.now ?? new Date(),
      })
      return await this.provisionEncryptedSnapshot(snapshot, newWorkspacePassphrase, {
        kind: 'personal',
        displayName: snapshot.workspace.name,
        autoLock: options.autoLock,
      })
    } catch (error) {
      throw managerError(error)
    }
  }

  async recoverProvisioning(
    id: string,
    passphrase?: string,
  ): Promise<OpenedLocalWorkspaceSession> {
    this.assertOpen()
    try {
      const initial = await this.registry.getWorkspace(id)
      if (
        !initial ||
        (initial.state !== 'provisioning' && initial.state !== 'migration-failed')
      ) {
        throw new LocalWorkspaceManagerError(
          'provisioning-not-found',
          'No recoverable provisioning route was found.',
        )
      }
      return await this.dependencies.coordinator.runExclusive(
        workspaceStorageLockId(initial.encryptionMode, initial.storageId),
        async () => {
          const entry = await this.registry.getWorkspace(id)
          if (
            !entry ||
            (entry.state !== 'provisioning' && entry.state !== 'migration-failed') ||
            entry.storageId !== initial.storageId ||
            entry.encryptionMode !== initial.encryptionMode
          ) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The provisioning route changed concurrently.',
            )
          }

          if (entry.encryptionMode === 'standard') {
            if (!(await standardWorkspaceDatabaseExists(entry.storageId))) {
              throw new LocalWorkspaceManagerError(
                'workspace-not-found',
                'The recoverable standard staging database was not found.',
              )
            }
            const database = createStandardWorkspaceDatabase(entry.storageId)
            const repository = new StandardWorkspaceRepository(database, entry.id)
            try {
              const snapshot = await repository.getWorkspaceSnapshot()
              if (!snapshot || snapshot.workspace.id !== entry.id) {
                throw new LocalWorkspaceManagerError(
                  'invalid-workspace',
                  'The standard staging workspace failed read-back validation.',
                )
              }
              const ready = await this.registry.markReady(
                entry.id,
                entry.registryRevision,
              )
              return this.standardSession(ready, snapshot, repository)
            } catch (error) {
              repository.close()
              throw error
            }
          }

          if (!passphrase) {
            throw new LocalWorkspaceManagerError(
              'provisioning-passphrase-required',
              'Unlocking is required to recover encrypted provisioning.',
            )
          }
          let runtime: UnlockedEncryptedWorkspace | undefined
          try {
            runtime = await this.dependencies.unlockEncrypted(entry.storageId, passphrase)
            if (runtime.workspace.workspace.id !== entry.id) {
              throw new LocalWorkspaceManagerError(
                'invalid-workspace',
                'The encrypted staging workspace identity is invalid.',
              )
            }
            const ready = await this.registry.markReady(
              entry.id,
              entry.registryRevision,
            )
            return this.encryptedSession(ready, runtime)
          } catch (error) {
            runtime?.close()
            throw error
          }
        },
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  async discardProvisioning(id: string, passphrase?: string): Promise<void> {
    this.assertOpen()
    try {
      this.requireCrossTabCoordinator()
      const initial = await this.registry.getWorkspace(id)
      if (
        !initial ||
        (initial.state !== 'provisioning' && initial.state !== 'migration-failed')
      ) {
        throw new LocalWorkspaceManagerError(
          'provisioning-not-found',
          'No recoverable provisioning route was found.',
        )
      }
      await this.dependencies.coordinator.runExclusive(
        workspaceStorageLockId(initial.encryptionMode, initial.storageId),
        async () => {
        const entry = await this.registry.getWorkspace(id)
        if (
          !entry ||
          (entry.state !== 'provisioning' && entry.state !== 'migration-failed') ||
          entry.storageId !== initial.storageId ||
          entry.encryptionMode !== initial.encryptionMode
        ) {
          throw new LocalWorkspaceManagerError(
            'revision-conflict',
            'The provisioning route changed concurrently.',
          )
        }
        const storageExists =
          entry.encryptionMode === 'standard'
            ? await standardWorkspaceDatabaseExists(entry.storageId)
            : await Dexie.exists(encryptedVaultDatabaseName(entry.storageId))
        if (storageExists && entry.encryptionMode === 'standard') {
          const database = createStandardWorkspaceDatabase(entry.storageId)
          const repository = new StandardWorkspaceRepository(database)
          try {
            const snapshot = await repository.getWorkspaceSnapshot()
            if (snapshot && snapshot.workspace.id !== entry.id) {
              if (!entry.provisioningToken) {
                throw new LocalWorkspaceManagerError(
                  'revision-conflict',
                  'The staging storage belongs to another workspace.',
                )
              }
              await this.registry.abandonUnownedProvisioning(
                entry.id,
                entry.registryRevision,
                entry.provisioningToken,
              )
              return
            }
          } finally {
            repository.close()
          }
        }
        if (storageExists && entry.encryptionMode === 'encrypted') {
          if (!passphrase) {
            throw new LocalWorkspaceManagerError(
              'provisioning-passphrase-required',
              'Unlocking is required before discarding encrypted provisioning.',
            )
          }
          const runtime = await this.dependencies.unlockEncrypted(
            entry.storageId,
            passphrase,
          )
          try {
            if (runtime.workspace.workspace.id !== entry.id) {
              if (!entry.provisioningToken) {
                throw new LocalWorkspaceManagerError(
                  'revision-conflict',
                  'The staging storage belongs to another workspace.',
                )
              }
              await this.registry.abandonUnownedProvisioning(
                entry.id,
                entry.registryRevision,
                entry.provisioningToken,
              )
              return
            }
          } finally {
            runtime.close()
          }
        }
        if (entry.encryptionMode === 'standard') {
          await this.dependencies.deleteStandardStorage(entry.storageId)
        } else {
          await this.dependencies.removeEncryptedStorage(entry.storageId)
        }
        await this.registry.discardProvisioning(
          entry.id,
          entry.registryRevision,
          async (candidate) =>
            candidate.encryptionMode === 'standard'
              ? !(await standardWorkspaceDatabaseExists(candidate.storageId))
              : !(await Dexie.exists(encryptedVaultDatabaseName(candidate.storageId))),
        )
        },
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  async convertStandardToEncrypted(
    id: string,
    passphrase: string,
    options: ConvertWorkspaceOptions = {},
  ): Promise<OpenedLocalWorkspaceSession> {
    this.assertOpen()
    try {
      validateNewPassphrase(passphrase)
      this.requireCrossTabCoordinator()
      const initial = await this.readyEntry(id)
      if (initial.encryptionMode !== 'standard') {
        throw new LocalWorkspaceManagerError(
          'workspace-mode-mismatch',
          'The workspace is not stored in standard mode.',
        )
      }
      return await this.dependencies.coordinator.runExclusive(
        standardWorkspaceDatabaseName(initial.storageId),
        async () => {
          const sourceEntry = await this.readyEntry(id)
          if (
            sourceEntry.encryptionMode !== 'standard' ||
            sourceEntry.storageId !== initial.storageId
          ) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The local workspace route changed concurrently.',
            )
          }

          if (!(await standardWorkspaceDatabaseExists(sourceEntry.storageId))) {
            throw new LocalWorkspaceManagerError(
              'workspace-not-found',
              'The standard workspace storage was not found.',
            )
          }

          const sourceDatabase = createStandardWorkspaceDatabase(sourceEntry.storageId)
          const sourceRepository = new StandardWorkspaceRepository(
            sourceDatabase,
            sourceEntry.id,
          )
          let runtime: UnlockedEncryptedWorkspace | undefined
          let targetStorageId: string | undefined
          try {
            const snapshot = await sourceRepository.getWorkspaceSnapshot()
            if (!snapshot) {
              throw new LocalWorkspaceManagerError(
                'workspace-not-found',
                'The local workspace storage was not found.',
              )
            }
            let currentRoute = await this.readyEntry(id)
            if (
              currentRoute.encryptionMode !== 'standard' ||
              currentRoute.storageId !== sourceEntry.storageId
            ) {
              throw new LocalWorkspaceManagerError(
                'revision-conflict',
                'The local workspace route changed concurrently.',
              )
            }

            const staged = currentRoute.encryptedConversion
            if (staged) {
              targetStorageId = staged.targetStorageId
              if (await Dexie.exists(encryptedVaultDatabaseName(targetStorageId))) {
                runtime = await this.dependencies.unlockEncrypted(targetStorageId, passphrase)
                if (runtime.workspace.workspace.id !== currentRoute.id) {
                  throw new LocalWorkspaceManagerError(
                    'invalid-workspace',
                    'Encrypted conversion staging belongs to another workspace.',
                  )
                }
                if (!workspaceSnapshotsEqual(snapshot, runtime.workspace)) {
                  // Authentication proves ownership, but the standard source
                  // advanced after the staged copy. Remove only this verified
                  // target, confirm absence, then reserve a fresh generation.
                  runtime.close()
                  runtime = undefined
                  await this.dependencies.removeEncryptedStorage(targetStorageId)
                  if (await Dexie.exists(encryptedVaultDatabaseName(targetStorageId))) {
                    throw new LocalWorkspaceManagerError(
                      'storage-operation-failed',
                      'Superseded encrypted conversion staging could not be removed.',
                    )
                  }
                  currentRoute = await this.registry.clearEncryptedConversionReservation(
                    currentRoute.id,
                    currentRoute.registryRevision,
                    targetStorageId,
                    async () =>
                      !(await Dexie.exists(encryptedVaultDatabaseName(targetStorageId!))),
                  )
                  targetStorageId = undefined
                }
              } else {
                currentRoute = await this.registry.clearEncryptedConversionReservation(
                  currentRoute.id,
                  currentRoute.registryRevision,
                  targetStorageId,
                  async () => true,
                )
                targetStorageId = undefined
              }
            }

            if (!targetStorageId) {
              targetStorageId = this.dependencies.createBindingId()
              const proposedTarget = targetStorageId
              await this.dependencies.coordinator.runExclusive(
                encryptedVaultDatabaseName(proposedTarget),
                async () => {
                if (await Dexie.exists(encryptedVaultDatabaseName(proposedTarget))) {
                  throw new LocalWorkspaceManagerError(
                    'storage-operation-failed',
                    'The proposed encrypted conversion target already exists.',
                  )
                }
                currentRoute = await this.registry.reserveEncryptedConversion(
                  currentRoute.id,
                  currentRoute.registryRevision,
                  currentRoute.storageId,
                  {
                    targetStorageId: proposedTarget,
                    storageSchemaVersion: ENCRYPTED_VAULT_DATABASE_VERSION,
                    sourceRevision: snapshot.workspace.revision,
                    startedAt: (options.verifiedAt ?? new Date()).toISOString(),
                  },
                )
                runtime = await this.dependencies.createEncrypted(snapshot, passphrase, {
                  bindingId: proposedTarget,
                })
                },
              )
            }

            if (!runtime) {
              runtime = await this.dependencies.unlockEncrypted(targetStorageId, passphrase)
            }
            if (!workspaceSnapshotsEqual(snapshot, runtime.workspace)) {
              throw new LocalWorkspaceManagerError(
                'invalid-workspace',
                'Encrypted storage failed semantic read-back verification.',
              )
            }

            if (!currentRoute.encryptedConversion?.verifiedAt) {
              currentRoute = await this.registry.markEncryptedConversionVerified(
                currentRoute.id,
                currentRoute.registryRevision,
                targetStorageId,
                (options.verifiedAt ?? new Date()).toISOString(),
              )
            }
            const confirmed = await sourceRepository.getWorkspaceSnapshot()
            if (!confirmed || !workspaceSnapshotsEqual(snapshot, confirmed)) {
              throw new LocalWorkspaceManagerError(
                'revision-conflict',
                'The standard workspace changed during encrypted conversion.',
              )
            }
            const entry = await this.registry.promoteStandardToEncrypted(
              currentRoute.id,
              currentRoute.registryRevision,
              currentRoute.storageId,
              targetStorageId,
              ENCRYPTED_VAULT_DATABASE_VERSION,
              (options.verifiedAt ?? new Date()).toISOString(),
            )
            return this.encryptedSession(entry, runtime)
          } catch (error) {
            const current = await this.registry.getWorkspace(id).catch(() => undefined)
            if (
              runtime &&
              targetStorageId &&
              current?.state === 'ready' &&
              current.encryptionMode === 'encrypted' &&
              current.storageId === targetStorageId &&
              runtime.workspace.workspace.id === current.id
            ) {
              return this.encryptedSession(current, runtime)
            }
            runtime?.close()
            throw error
          } finally {
            sourceRepository.close()
          }
        },
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  /**
   * Discards only a target durably reserved by an interrupted conversion.
   * The ready standard source remains authoritative and unchanged.
   */
  async discardEncryptedConversion(
    id: string,
    passphrase?: string,
  ): Promise<WorkspaceRegistryEntry> {
    this.assertOpen()
    try {
      this.requireCrossTabCoordinator()
      const initial = await this.readyEntry(id)
      if (initial.encryptionMode !== 'standard' || !initial.encryptedConversion) {
        throw new LocalWorkspaceManagerError(
          'workspace-not-ready',
          'The standard workspace has no pending encrypted conversion.',
        )
      }
      const initialTargetStorageId = initial.encryptedConversion.targetStorageId
      return await this.dependencies.coordinator.runExclusive(
        standardWorkspaceDatabaseName(initial.storageId),
        async () => {
          let current = await this.readyEntry(id)
          if (
            current.encryptionMode !== 'standard' ||
            current.storageId !== initial.storageId ||
            current.encryptedConversion?.targetStorageId !==
              initialTargetStorageId
          ) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The pending encrypted conversion changed concurrently.',
            )
          }
          const targetStorageId = current.encryptedConversion?.targetStorageId
          if (!targetStorageId) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The pending encrypted conversion changed concurrently.',
            )
          }
          return this.dependencies.coordinator.runExclusive(
            encryptedVaultDatabaseName(targetStorageId),
            async () => {
              current = await this.readyEntry(id)
              if (
                current.encryptionMode !== 'standard' ||
                current.storageId !== initial.storageId ||
                current.encryptedConversion?.targetStorageId !== targetStorageId
              ) {
                throw new LocalWorkspaceManagerError(
                  'revision-conflict',
                  'The pending encrypted conversion changed concurrently.',
                )
              }
              const targetExists = await Dexie.exists(
                encryptedVaultDatabaseName(targetStorageId),
              )
              if (targetExists) {
                if (!passphrase) {
                  throw new LocalWorkspaceManagerError(
                    'provisioning-passphrase-required',
                    'Authentication is required before discarding encrypted conversion staging.',
                  )
                }
                const proof = await this.dependencies.unlockEncrypted(
                  targetStorageId,
                  passphrase,
                )
                try {
                  this.assertOpen()
                  if (proof.workspace.workspace.id !== current.id) {
                    throw new LocalWorkspaceManagerError(
                      'invalid-workspace',
                      'Encrypted conversion staging belongs to another workspace.',
                    )
                  }
                } finally {
                  proof.close()
                }
                try {
                  await this.dependencies.removeEncryptedStorage(targetStorageId)
                } catch (error) {
                  if (await Dexie.exists(encryptedVaultDatabaseName(targetStorageId))) {
                    throw error
                  }
                }
              }
              if (await Dexie.exists(encryptedVaultDatabaseName(targetStorageId))) {
                throw new LocalWorkspaceManagerError(
                  'storage-operation-failed',
                  'The encrypted conversion staging database still exists.',
                )
              }
              return this.registry.clearEncryptedConversionReservation(
                current.id,
                current.registryRevision,
                targetStorageId,
                async () =>
                  !(await Dexie.exists(encryptedVaultDatabaseName(targetStorageId))),
              )
            },
          )
        },
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  async rename(
    id: string,
    displayName: string,
    expectedRegistryRevision?: number,
  ): Promise<WorkspaceRegistryEntry> {
    this.assertOpen()
    const trimmed = displayName.trim()
    if (!trimmed || [...trimmed].length > 200) {
      throw new LocalWorkspaceManagerError(
        'invalid-display-name',
        'A workspace display name between 1 and 200 characters is required.',
      )
    }
    try {
      const current = await this.readyEntry(id)
      return await this.registry.updateWorkspace(
        id,
        expectedRegistryRevision ?? current.registryRevision,
        (entry) => ({ ...entry, displayName: trimmed }),
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  async updateAutoLock(
    id: string,
    autoLock: WorkspaceAutoLock,
    expectedRegistryRevision?: number,
  ): Promise<WorkspaceRegistryEntry> {
    this.assertOpen()
    if (!isWorkspaceAutoLock(autoLock)) {
      throw new LocalWorkspaceManagerError(
        'invalid-auto-lock',
        'The workspace auto-lock value is invalid.',
      )
    }
    try {
      const current = await this.readyEntry(id)
      return await this.registry.updateWorkspace(
        id,
        expectedRegistryRevision ?? current.registryRevision,
        (entry) => ({ ...entry, autoLock }),
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  async markExportGenerated(
    id: string,
    generatedAt = new Date(),
    expectedRegistryRevision?: number,
  ): Promise<WorkspaceRegistryEntry> {
    this.assertOpen()
    try {
      const current = await this.readyEntry(id)
      return await this.registry.updateWorkspace(
        id,
        expectedRegistryRevision ?? current.registryRevision,
        (entry) => ({ ...entry, lastExportedAt: generatedAt.toISOString() }),
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  async resetDemo(
    id = DEMO_WORKSPACE_ID,
    options: ResetDemoWorkspaceOptions = {},
  ): Promise<WorkspaceData> {
    this.assertOpen()
    const entry = await this.readyEntry(id)
    if (entry.kind !== 'demo') {
      throw new LocalWorkspaceManagerError(
        'demo-only',
        'Only a demo workspace can be reset.',
      )
    }
    try {
      if (entry.encryptionMode === 'standard') {
        const session = await this.openStandard(id)
        try {
          const reset = demoSnapshotForIdentity(id, options.now ?? new Date())
          return await session.repository.replaceWorkspace(
            reset,
            session.snapshot.workspace.revision,
          )
        } finally {
          session.repository.close()
        }
      }
      if (!options.passphrase) {
        throw new LocalWorkspaceManagerError(
          'encrypted-demo-passphrase-required',
          'Unlocking is required before resetting an encrypted demo workspace.',
        )
      }
      const session = await this.unlockEncrypted(id, options.passphrase)
      try {
        const reset = demoSnapshotForIdentity(id, options.now ?? new Date())
        return await session.repository.replaceWorkspace(
          reset,
          session.snapshot.workspace.revision,
        )
      } finally {
        session.repository.close()
      }
    } catch (error) {
      throw managerError(error)
    }
  }

  async cleanupPlaintextSource(
    id: string,
    plaintextSourceId: string,
    removedAt = new Date(),
  ): Promise<WorkspaceRegistryEntry> {
    this.assertOpen()
    try {
      this.requireCrossTabCoordinator()
      const initial = await this.readyEntry(id)
      if (initial.encryptionMode !== 'encrypted') {
        throw new LocalWorkspaceManagerError(
          'workspace-mode-mismatch',
          'Plaintext cleanup is available only after encrypted storage is active.',
        )
      }
      const initialSource = initial.plaintextSources?.find(
        (candidate) => candidate.id === plaintextSourceId,
      )
      if (!initialSource) {
        throw new LocalWorkspaceManagerError(
          'plaintext-source-not-found',
          'The recorded plaintext source was not found.',
        )
      }
      if (initialSource.state === 'removed') return initial
      const sourceDatabaseName = plaintextSourceDatabaseName(initialSource)
      const targetDatabaseName = workspaceStorageLockId(
        initial.encryptionMode,
        initial.storageId,
      )
      if (sourceDatabaseName === targetDatabaseName) {
        throw new LocalWorkspaceManagerError(
          'plaintext-cleanup-failed',
          'The plaintext source collides with the encrypted workspace storage.',
        )
      }

      // Reject aliased/reserved locators before taking either lock. The same
      // check is repeated while both locks are held to close the registry TOCTOU.
      await this.assertPlaintextLocatorUnshared(
        initial.id,
        initialSource,
        sourceDatabaseName,
      )
      const encryptedPort = this.encryptedPortForRoute(initial)
      if (!encryptedPort) {
        throw new LocalWorkspaceManagerError(
          'authentication-failed',
          'Unlock the encrypted workspace before removing its plaintext recovery source.',
        )
      }

      const cleanupWhileBothLocked = async (): Promise<WorkspaceRegistryEntry> => {
        const entry = await this.readyEntry(id)
        if (
          entry.encryptionMode !== 'encrypted' ||
          entry.storageId !== initial.storageId ||
          !encryptedPort.matchesRoute(entry)
        ) {
          throw new LocalWorkspaceManagerError(
            'revision-conflict',
            'The encrypted workspace route changed during plaintext cleanup.',
          )
        }
        const source = entry.plaintextSources?.find(
          (candidate) => candidate.id === plaintextSourceId,
        )
        if (!source) {
          throw new LocalWorkspaceManagerError(
            'plaintext-source-not-found',
            'The recorded plaintext source was not found.',
          )
        }
        if (source.state === 'removed') return entry
        if (plaintextSourceDatabaseName(source) !== sourceDatabaseName) {
          throw new LocalWorkspaceManagerError(
            'revision-conflict',
            'The plaintext source locator changed during cleanup.',
          )
        }
        await this.assertPlaintextLocatorUnshared(entry.id, source, sourceDatabaseName)
        await this.assertPlaintextSourceIdentity(entry, source)
        try {
          // IndexedDB deletion is a best-effort browser cleanup, not secure erase.
          await this.deletePlaintextSource(source)
          if (await this.plaintextSourceStorageExists(source)) {
            throw new Error('Plaintext storage still exists after deletion resolved.')
          }
        } catch {
          throw new LocalWorkspaceManagerError(
            'plaintext-cleanup-failed',
            'The recorded plaintext source could not be deleted.',
          )
        }
        return await this.registry.markPlaintextSourceRemoved(
          entry.id,
          entry.registryRevision,
          source.id,
          removedAt.toISOString(),
        )
      }

      const authenticateWhileTargetLocked = () =>
        encryptedPort.authenticateForPlaintextCleanup(initial, async () =>
          this.dependencies.coordinator.runExclusive(
            sourceDatabaseName,
            cleanupWhileBothLocked,
          ),
        )

      // Every cleanup acquires its two physical-database locks in the same
      // lexical order, preventing A->B / B->A cross-workspace deadlocks.
      if (targetDatabaseName < sourceDatabaseName) {
        return await authenticateWhileTargetLocked()
      }
      return await this.dependencies.coordinator.runExclusive(
        sourceDatabaseName,
        () =>
          encryptedPort.authenticateForPlaintextCleanup(
            initial,
            cleanupWhileBothLocked,
          ),
      )
    } catch (error) {
      // Conservative truth is retained if final registry publication fails.
      throw managerError(error)
    }
  }

  private async deletePlaintextSource(source: PlaintextSourceReference): Promise<void> {
    if (source.kind === 'standard' && source.sourceStorageId) {
      await this.dependencies.deleteStandardStorage(source.sourceStorageId)
      return
    }
    if (source.kind === 'legacy' && source.sourceDatabaseName) {
      await this.dependencies.deleteLegacyStorage(source.sourceDatabaseName)
      return
    }
    throw new LocalWorkspaceManagerError(
      'plaintext-source-not-found',
      'The recorded plaintext source has no physical locator.',
    )
  }

  private async assertPlaintextSourceIdentity(
    encryptedEntry: WorkspaceRegistryEntry,
    source: PlaintextSourceReference,
  ): Promise<void> {
    try {
      if (source.kind === 'standard' && source.sourceStorageId) {
        if (!(await standardWorkspaceDatabaseExists(source.sourceStorageId))) return
        const repository = new StandardWorkspaceRepository(
          createStandardWorkspaceDatabase(source.sourceStorageId),
          encryptedEntry.id,
        )
        try {
          const snapshot = await repository.getWorkspaceSnapshot()
          if (!snapshot || snapshot.workspace.id !== encryptedEntry.id) {
            throw new Error('The standard plaintext source identity is invalid.')
          }
        } finally {
          repository.close()
        }
        return
      }
      if (source.kind === 'legacy' && source.sourceDatabaseName) {
        const snapshot = await readLegacySingleton(source.sourceDatabaseName)
        if (snapshot.status === 'absent') return
        if (
          snapshot.status !== 'workspace' ||
          snapshot.snapshot.workspace.id !== encryptedEntry.id
        ) {
          throw new Error('The legacy plaintext source identity is invalid.')
        }
        return
      }
      throw new Error('The plaintext source has no valid physical locator.')
    } catch {
      throw new LocalWorkspaceManagerError(
        'plaintext-cleanup-failed',
        'The plaintext source identity could not be verified before deletion.',
      )
    }
  }

  private async plaintextSourceStorageExists(
    source: PlaintextSourceReference,
  ): Promise<boolean> {
    if (source.kind === 'standard' && source.sourceStorageId) {
      return standardWorkspaceDatabaseExists(source.sourceStorageId)
    }
    if (source.kind === 'legacy' && source.sourceDatabaseName) {
      return Dexie.exists(source.sourceDatabaseName)
    }
    throw new LocalWorkspaceManagerError(
      'plaintext-source-not-found',
      'The recorded plaintext source has no physical locator.',
    )
  }

  private async assertPlaintextLocatorUnshared(
    workspaceId: string,
    source: PlaintextSourceReference,
    sourceDatabaseName: string,
  ): Promise<void> {
    if (
      sourceDatabaseName === this.registryDatabase.name ||
      (source.kind === 'legacy' &&
        (sourceDatabaseName.startsWith(STANDARD_WORKSPACE_DATABASE_PREFIX) ||
          sourceDatabaseName.startsWith(ENCRYPTED_VAULT_DATABASE_PREFIX)))
    ) {
      throw new LocalWorkspaceManagerError(
        'plaintext-cleanup-failed',
        'The plaintext source collides with a reserved application database name.',
      )
    }
    const entries = await this.registry.listWorkspaces(true)
    const shared = entries.some((entry) => {
      if (
        workspaceStorageLockId(entry.encryptionMode, entry.storageId) ===
          sourceDatabaseName ||
        (entry.encryptedConversion &&
          encryptedVaultDatabaseName(entry.encryptedConversion.targetStorageId) ===
            sourceDatabaseName)
      ) {
        return true
      }
      return entry.plaintextSources?.some((candidate) => {
        if (entry.id === workspaceId && candidate.id === source.id) return false
        return plaintextSourceDatabaseName(candidate) === sourceDatabaseName
      })
    })
    const migrations = await this.registryDatabase.migrations.toArray()
    const owner = entries.find((entry) => entry.id === workspaceId)
    const sharedMigration = migrations.some((migration) => {
      if (standardWorkspaceDatabaseName(migration.targetStorageId) === sourceDatabaseName) {
        const ownsMigratedStandardSource =
          owner?.legacyMigrationKey === migration.id &&
          source.kind === 'standard' &&
          source.sourceStorageId === migration.targetStorageId
        return !ownsMigratedStandardSource
      }
      if (migration.sourceDatabaseName !== sourceDatabaseName) return false
      return owner?.legacyMigrationKey !== migration.id
    })
    if (shared || sharedMigration) {
      throw new LocalWorkspaceManagerError(
        'plaintext-cleanup-failed',
        'The plaintext storage locator is still reserved by another workspace.',
      )
    }
  }

  async delete(id: string, expectedRegistryRevision?: number): Promise<void> {
    this.assertOpen()
    try {
      this.requireCrossTabCoordinator()
      const initial = await this.readyEntry(id)
      return await this.dependencies.coordinator.runExclusive(
        workspaceStorageLockId(initial.encryptionMode, initial.storageId),
        async () => {
          const entry = await this.readyEntry(id)
          if (
            entry.storageId !== initial.storageId ||
            entry.encryptionMode !== initial.encryptionMode
          ) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'The local workspace route changed concurrently.',
            )
          }
          if (entry.encryptedConversion) {
            throw new LocalWorkspaceManagerError(
              'revision-conflict',
              'Resolve the pending encrypted conversion before deleting this workspace.',
            )
          }
          if (hasRetainedPlaintextSource(entry)) {
            throw new LocalWorkspaceManagerError(
              'plaintext-source-retained',
              'Recorded plaintext sources must be cleaned up before deleting this workspace.',
            )
          }
          await this.assertWorkspaceStorageOwned(entry)
          await this.registry.deleteWorkspace(
            id,
            expectedRegistryRevision ?? entry.registryRevision,
            async (deleting) => {
              if (deleting.encryptionMode === 'standard') {
                await this.dependencies.deleteStandardStorage(deleting.storageId)
              } else {
                await this.dependencies.removeEncryptedStorage(deleting.storageId)
              }
            },
            async (deleting) => {
              if (deleting.encryptionMode === 'standard') {
                return !(await standardWorkspaceDatabaseExists(deleting.storageId))
              }
              return !(await Dexie.exists(encryptedVaultDatabaseName(deleting.storageId)))
            },
          )
        },
      )
    } catch (error) {
      throw managerError(error)
    }
  }

  async retryFinalizeDeletion(id: string): Promise<void> {
    this.assertOpen()
    try {
      this.requireCrossTabCoordinator()
      const initial = await this.registry.getWorkspace(id)
      if (!initial || initial.state !== 'deleting') {
        throw new LocalWorkspaceManagerError(
          'workspace-not-ready',
          'The workspace has no recoverable deletion tombstone.',
        )
      }
      await this.recoverDeletingEntry(initial)
    } catch (error) {
      throw managerError(error)
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    for (const session of [...this.sessions]) session.close()
    this.sessions.clear()
    this.factory.close()
  }
}
