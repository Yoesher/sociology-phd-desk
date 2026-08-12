import Dexie, { type Table } from 'dexie'
import { WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import {
  PLAINTEXT_SOURCE_KINDS,
  PLAINTEXT_SOURCE_STATES,
  WORKSPACE_ENCRYPTION_MODES,
  WORKSPACE_KINDS,
  WORKSPACE_MIGRATION_STATUSES,
  WORKSPACE_REGISTRY_STATES,
  SUPPORTED_WORKSPACE_SCHEMA_VERSIONS,
  isWorkspaceAutoLock,
  type PlaintextSourceReference,
  type EncryptedConversionReservation,
  type WorkspaceEncryptionMode,
  type WorkspaceMigrationLedger,
  type WorkspaceRegistryEntry,
  type WorkspaceRegistrySettings,
} from '../models/workspace-registry'

export const REGISTRY_DATABASE_NAME = 'sociology-phd-desk-registry' as const
export const REGISTRY_DATABASE_SCHEMA_VERSION = 1 as const
export const REGISTRY_BOOTSTRAP_VERSION = 1 as const
export const REGISTRY_SETTINGS_ID = 'registry-settings' as const

const opaqueStorageIdPattern = /^[A-Za-z0-9_-]{12,128}$/

export class WorkspaceRegistryConflictError extends Error {
  readonly workspaceId: string
  readonly expectedRevision: number
  readonly actualRevision: number | null

  constructor(
    workspaceId: string,
    expectedRevision: number,
    actualRevision: number | null,
  ) {
    super(
      actualRevision === null
        ? `Workspace registry conflict: expected ${expectedRevision}, but entry "${workspaceId}" does not exist.`
        : `Workspace registry conflict: expected ${expectedRevision}, but found ${actualRevision}.`,
    )
    this.name = 'WorkspaceRegistryConflictError'
    this.workspaceId = workspaceId
    this.expectedRevision = expectedRevision
    this.actualRevision = actualRevision
  }
}

export class WorkspaceRegistryValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceRegistryValidationError'
  }
}

export class WorkspaceRegistryDatabase extends Dexie {
  workspaces!: Table<WorkspaceRegistryEntry, string>
  migrations!: Table<WorkspaceMigrationLedger, string>
  settings!: Table<WorkspaceRegistrySettings, string>

  constructor(databaseName: string = REGISTRY_DATABASE_NAME) {
    super(databaseName)
    this.version(REGISTRY_DATABASE_SCHEMA_VERSION).stores({
      workspaces:
        '&id, &storageId, state, kind, encryptionMode, updatedAt, lastOpenedAt, legacyMigrationKey',
      migrations: '&id, status, sourceDatabaseName, sourceWorkspaceId, updatedAt',
      settings: '&id, bootstrapVersion, activeWorkspaceId, updatedAt',
    })
    this.on('versionchange', () => {
      this.close({ disableAutoOpen: true })
    })
  }
}

function requireNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new WorkspaceRegistryValidationError(`${field} cannot be blank.`)
}

function requireIsoDateTime(value: string | undefined, field: string): void {
  if (value === undefined) return
  if (Number.isNaN(Date.parse(value))) {
    throw new WorkspaceRegistryValidationError(`${field} must be an ISO date-time.`)
  }
}

function validatePlaintextSource(source: PlaintextSourceReference): void {
  requireNonEmpty(source.id, 'plaintextSources.id')
  if (!PLAINTEXT_SOURCE_KINDS.includes(source.kind)) {
    throw new WorkspaceRegistryValidationError('Unknown plaintext source kind.')
  }
  if (!PLAINTEXT_SOURCE_STATES.includes(source.state)) {
    throw new WorkspaceRegistryValidationError('Unknown plaintext source state.')
  }
  if (source.kind === 'legacy') {
    requireNonEmpty(source.sourceDatabaseName ?? '', 'plaintextSources.sourceDatabaseName')
  }
  if (source.kind === 'standard') {
    if (!source.sourceStorageId || !opaqueStorageIdPattern.test(source.sourceStorageId)) {
      throw new WorkspaceRegistryValidationError(
        'Standard plaintext source requires an opaque storage ID.',
      )
    }
  }
  requireIsoDateTime(source.verifiedAt, 'plaintextSources.verifiedAt')
  requireIsoDateTime(source.removedAt, 'plaintextSources.removedAt')
  if (source.state === 'removed' && !source.removedAt) {
    throw new WorkspaceRegistryValidationError(
      'A removed plaintext source requires removedAt.',
    )
  }
}

function validateEncryptedConversion(
  entry: WorkspaceRegistryEntry,
  reservation: EncryptedConversionReservation,
): void {
  if (entry.state !== 'ready' || entry.encryptionMode !== 'standard') {
    throw new WorkspaceRegistryValidationError(
      'Encrypted conversion staging requires a ready standard source route.',
    )
  }
  if (
    !opaqueStorageIdPattern.test(reservation.targetStorageId) ||
    reservation.targetStorageId === entry.storageId
  ) {
    throw new WorkspaceRegistryValidationError(
      'Encrypted conversion target requires a distinct opaque storage ID.',
    )
  }
  if (
    !Number.isInteger(reservation.storageSchemaVersion) ||
    reservation.storageSchemaVersion < 1
  ) {
    throw new WorkspaceRegistryValidationError(
      'Encrypted conversion storage schema version is invalid.',
    )
  }
  if (!Number.isInteger(reservation.sourceRevision) || reservation.sourceRevision < 0) {
    throw new WorkspaceRegistryValidationError(
      'Encrypted conversion source revision is invalid.',
    )
  }
  requireIsoDateTime(reservation.startedAt, 'encryptedConversion.startedAt')
  requireIsoDateTime(reservation.verifiedAt, 'encryptedConversion.verifiedAt')
}

export function validateRegistryEntry(entry: WorkspaceRegistryEntry): WorkspaceRegistryEntry {
  requireNonEmpty(entry.id, 'id')
  requireNonEmpty(entry.displayName, 'displayName')
  if (!opaqueStorageIdPattern.test(entry.storageId)) {
    throw new WorkspaceRegistryValidationError('storageId must be an opaque local identifier.')
  }
  if (!WORKSPACE_KINDS.includes(entry.kind)) {
    throw new WorkspaceRegistryValidationError('Unknown workspace kind.')
  }
  if (!WORKSPACE_ENCRYPTION_MODES.includes(entry.encryptionMode)) {
    throw new WorkspaceRegistryValidationError('Unknown workspace encryption mode.')
  }
  if (!WORKSPACE_REGISTRY_STATES.includes(entry.state)) {
    throw new WorkspaceRegistryValidationError('Unknown workspace registry state.')
  }
  if (!isWorkspaceAutoLock(entry.autoLock)) {
    throw new WorkspaceRegistryValidationError('Unknown auto-lock value.')
  }
  if (
    !SUPPORTED_WORKSPACE_SCHEMA_VERSIONS.some(
      (version) => version === entry.schemaVersion,
    )
  ) {
    throw new WorkspaceRegistryValidationError('Unsupported portable workspace schema version.')
  }
  if (!Number.isInteger(entry.storageSchemaVersion) || entry.storageSchemaVersion < 1) {
    throw new WorkspaceRegistryValidationError('Invalid storage schema version.')
  }
  if (!Number.isInteger(entry.registryRevision) || entry.registryRevision < 0) {
    throw new WorkspaceRegistryValidationError('Invalid registry revision.')
  }
  requireIsoDateTime(entry.createdAt, 'createdAt')
  requireIsoDateTime(entry.updatedAt, 'updatedAt')
  requireIsoDateTime(entry.lastOpenedAt, 'lastOpenedAt')
  requireIsoDateTime(entry.lastExportedAt, 'lastExportedAt')
  if (entry.provisioningToken !== undefined) {
    requireNonEmpty(entry.provisioningToken, 'provisioningToken')
  }
  const sourceIds = new Set<string>()
  for (const source of entry.plaintextSources ?? []) {
    validatePlaintextSource(source)
    if (sourceIds.has(source.id)) {
      throw new WorkspaceRegistryValidationError('Duplicate plaintext source ID.')
    }
    sourceIds.add(source.id)
  }
  if (entry.encryptedConversion) {
    validateEncryptedConversion(entry, entry.encryptedConversion)
  }
  return entry
}

export function validateMigrationLedger(
  ledger: WorkspaceMigrationLedger,
): WorkspaceMigrationLedger {
  requireNonEmpty(ledger.id, 'migration.id')
  requireNonEmpty(ledger.sourceDatabaseName, 'migration.sourceDatabaseName')
  requireNonEmpty(ledger.sourceWorkspaceId, 'migration.sourceWorkspaceId')
  requireNonEmpty(ledger.targetWorkspaceId, 'migration.targetWorkspaceId')
  if (!opaqueStorageIdPattern.test(ledger.targetStorageId)) {
    throw new WorkspaceRegistryValidationError(
      'Migration targetStorageId must be an opaque local identifier.',
    )
  }
  if (!Number.isFinite(ledger.sourceDatabaseVersion) || ledger.sourceDatabaseVersion < 1) {
    throw new WorkspaceRegistryValidationError('Invalid source database version.')
  }
  if (!Number.isInteger(ledger.sourceRevision) || ledger.sourceRevision < 0) {
    throw new WorkspaceRegistryValidationError('Invalid source workspace revision.')
  }
  if (!WORKSPACE_MIGRATION_STATUSES.includes(ledger.status)) {
    throw new WorkspaceRegistryValidationError('Unknown migration status.')
  }
  requireIsoDateTime(ledger.createdAt, 'migration.createdAt')
  requireIsoDateTime(ledger.updatedAt, 'migration.updatedAt')
  requireIsoDateTime(ledger.verifiedAt, 'migration.verifiedAt')
  return ledger
}

function reservesStorageLocator(
  entry: WorkspaceRegistryEntry,
  storageId: string,
): boolean {
  return (
    entry.storageId === storageId ||
    entry.encryptedConversion?.targetStorageId === storageId ||
    Boolean(
      entry.plaintextSources?.some(
        (source) => source.sourceStorageId === storageId,
      ),
    )
  )
}

export function createRegistryDatabase(
  databaseName = REGISTRY_DATABASE_NAME,
): WorkspaceRegistryDatabase {
  return new WorkspaceRegistryDatabase(databaseName)
}

export class WorkspaceRegistryRepository {
  readonly database: WorkspaceRegistryDatabase

  constructor(database: WorkspaceRegistryDatabase) {
    this.database = database
  }

  async listWorkspaces(includeNonReady = false): Promise<WorkspaceRegistryEntry[]> {
    const entries = await this.database.workspaces.toArray()
    return entries
      .filter((entry) => includeNonReady || entry.state === 'ready')
      .sort((left, right) => {
        const opened = (right.lastOpenedAt ?? '').localeCompare(left.lastOpenedAt ?? '')
        return opened || left.createdAt.localeCompare(right.createdAt)
      })
  }

  async getWorkspace(id: string): Promise<WorkspaceRegistryEntry | undefined> {
    return this.database.workspaces.get(id)
  }

  async getMigration(id: string): Promise<WorkspaceMigrationLedger | undefined> {
    return this.database.migrations.get(id)
  }

  async getSettings(): Promise<WorkspaceRegistrySettings | undefined> {
    return this.database.settings.get(REGISTRY_SETTINGS_ID)
  }

  async beginProvisioning(entry: WorkspaceRegistryEntry): Promise<WorkspaceRegistryEntry> {
    validateRegistryEntry(entry)
    if (entry.state !== 'provisioning') {
      throw new WorkspaceRegistryValidationError(
        'A new workspace entry must begin in provisioning state.',
      )
    }
    return this.database.transaction(
      'rw',
      [this.database.workspaces, this.database.migrations],
      async () => {
      const existing = await this.database.workspaces.get(entry.id)
      if (existing) {
        if (existing.storageId !== entry.storageId) {
          throw new WorkspaceRegistryValidationError(
            `Workspace "${entry.id}" already uses another storage ID.`,
          )
        }
        return existing
      }
      const reservation = (await this.database.workspaces.toArray()).find(
        (candidate) => reservesStorageLocator(candidate, entry.storageId),
      )
      const migrationReservation = (await this.database.migrations.toArray()).find(
        (candidate) => candidate.targetStorageId === entry.storageId,
      )
      if (reservation || migrationReservation) {
        throw new WorkspaceRegistryValidationError(
          'Workspace storage ID is reserved by another current or historical route.',
        )
      }
      await this.database.workspaces.add(entry)
      return entry
      },
    )
  }

  async markReady(id: string, expectedRevision: number): Promise<WorkspaceRegistryEntry> {
    return this.updateWorkspace(id, expectedRevision, (entry) => ({
      ...entry,
      state: 'ready',
      provisioningToken: undefined,
    }))
  }

  /**
   * Rolls back only the registry route owned by a create call that never
   * acquired or wrote the physical storage locator.
   */
  async abandonUnownedProvisioning(
    id: string,
    expectedRevision: number,
    provisioningToken: string,
  ): Promise<void> {
    await this.database.transaction('rw', this.database.workspaces, async () => {
      const current = await this.database.workspaces.get(id)
      if (
        !current ||
        current.state !== 'provisioning' ||
        current.registryRevision !== expectedRevision ||
        current.provisioningToken !== provisioningToken
      ) {
        throw new WorkspaceRegistryConflictError(
          id,
          expectedRevision,
          current?.registryRevision ?? null,
        )
      }
      await this.database.workspaces.delete(id)
    })
  }

  async updateWorkspace(
    id: string,
    expectedRevision: number,
    updater: (entry: WorkspaceRegistryEntry) => WorkspaceRegistryEntry,
  ): Promise<WorkspaceRegistryEntry> {
    return this.database.transaction('rw', this.database.workspaces, async () => {
      const current = await this.database.workspaces.get(id)
      if (!current || current.registryRevision !== expectedRevision) {
        throw new WorkspaceRegistryConflictError(
          id,
          expectedRevision,
          current?.registryRevision ?? null,
        )
      }
      const updated = validateRegistryEntry({
        ...updater(current),
        id: current.id,
        storageId: current.storageId,
        kind: current.kind,
        encryptionMode: current.encryptionMode,
        schemaVersion: current.schemaVersion,
        storageSchemaVersion: current.storageSchemaVersion,
        plaintextSources: current.plaintextSources,
        encryptedConversion: current.encryptedConversion,
        registryRevision: current.registryRevision + 1,
        updatedAt: new Date().toISOString(),
      })
      await this.database.workspaces.put(updated)
      return updated
    })
  }

  /**
   * Advances routing metadata only after the caller has authenticated and
   * read back a current-schema payload from the physical workspace storage.
   * This transition is intentionally one-way and cannot manufacture a future
   * or legacy schema claim.
   */
  async reconcileVerifiedWorkspaceStorageVersions(
    id: string,
    expectedRevision: number,
    expectedStorageId: string,
    expectedEncryptionMode: WorkspaceEncryptionMode,
    verifiedSchemaVersion: number,
    verifiedStorageSchemaVersion: number,
  ): Promise<WorkspaceRegistryEntry> {
    if (verifiedSchemaVersion !== WORKSPACE_SCHEMA_VERSION) {
      throw new WorkspaceRegistryValidationError(
        'Only the current verified workspace schema can be reconciled.',
      )
    }
    if (
      !Number.isInteger(verifiedStorageSchemaVersion) ||
      verifiedStorageSchemaVersion < 1
    ) {
      throw new WorkspaceRegistryValidationError(
        'The verified physical storage schema version is invalid.',
      )
    }

    return this.database.transaction('rw', this.database.workspaces, async () => {
      const current = await this.database.workspaces.get(id)
      if (!current || current.registryRevision !== expectedRevision) {
        throw new WorkspaceRegistryConflictError(
          id,
          expectedRevision,
          current?.registryRevision ?? null,
        )
      }
      if (
        current.storageId !== expectedStorageId ||
        current.encryptionMode !== expectedEncryptionMode ||
        current.state !== 'ready'
      ) {
        throw new WorkspaceRegistryValidationError(
          'Schema reconciliation requires the verified ready storage route.',
        )
      }
      if (
        current.schemaVersion > verifiedSchemaVersion ||
        current.storageSchemaVersion > verifiedStorageSchemaVersion
      ) {
        throw new WorkspaceRegistryValidationError(
          'Workspace storage metadata cannot be reconciled backwards.',
        )
      }
      if (
        current.schemaVersion === verifiedSchemaVersion &&
        current.storageSchemaVersion === verifiedStorageSchemaVersion
      ) {
        return current
      }

      const updated = validateRegistryEntry({
        ...current,
        schemaVersion: verifiedSchemaVersion,
        storageSchemaVersion: verifiedStorageSchemaVersion,
        registryRevision: current.registryRevision + 1,
        updatedAt: new Date().toISOString(),
      })
      await this.database.workspaces.put(updated)
      return updated
    })
  }


  async reserveEncryptedConversion(
    id: string,
    expectedRevision: number,
    expectedSourceStorageId: string,
    reservation: EncryptedConversionReservation,
  ): Promise<WorkspaceRegistryEntry> {
    return this.database.transaction(
      'rw',
      [this.database.workspaces, this.database.migrations],
      async () => {
      const current = await this.database.workspaces.get(id)
      if (!current || current.registryRevision !== expectedRevision) {
        throw new WorkspaceRegistryConflictError(
          id,
          expectedRevision,
          current?.registryRevision ?? null,
        )
      }
      if (
        current.state !== 'ready' ||
        current.encryptionMode !== 'standard' ||
        current.storageId !== expectedSourceStorageId
      ) {
        throw new WorkspaceRegistryValidationError(
          'Only the expected ready standard route can reserve conversion storage.',
        )
      }
      if (current.encryptedConversion) {
        if (
          current.encryptedConversion.targetStorageId === reservation.targetStorageId &&
          current.encryptedConversion.sourceRevision === reservation.sourceRevision
        ) {
          return current
        }
        throw new WorkspaceRegistryValidationError(
          'Another encrypted conversion target is already reserved.',
        )
      }
      const collision = (await this.database.workspaces.toArray()).find(
        (candidate) =>
          candidate.id !== current.id &&
          reservesStorageLocator(candidate, reservation.targetStorageId),
      )
      const migrationCollision = (await this.database.migrations.toArray()).find(
        (candidate) => candidate.targetStorageId === reservation.targetStorageId,
      )
      if (
        collision ||
        migrationCollision ||
        current.plaintextSources?.some(
          (source) => source.sourceStorageId === reservation.targetStorageId,
        )
      ) {
        throw new WorkspaceRegistryValidationError(
          'Encrypted conversion target is already reserved.',
        )
      }
      const updated = validateRegistryEntry({
        ...current,
        encryptedConversion: reservation,
        registryRevision: current.registryRevision + 1,
        updatedAt: reservation.startedAt,
      })
      await this.database.workspaces.put(updated)
      return updated
      },
    )
  }

  async markEncryptedConversionVerified(
    id: string,
    expectedRevision: number,
    targetStorageId: string,
    verifiedAt: string,
  ): Promise<WorkspaceRegistryEntry> {
    return this.database.transaction('rw', this.database.workspaces, async () => {
      const current = await this.database.workspaces.get(id)
      if (!current || current.registryRevision !== expectedRevision) {
        throw new WorkspaceRegistryConflictError(
          id,
          expectedRevision,
          current?.registryRevision ?? null,
        )
      }
      if (current.encryptedConversion?.targetStorageId !== targetStorageId) {
        throw new WorkspaceRegistryValidationError(
          'Encrypted conversion reservation does not match the verified target.',
        )
      }
      requireIsoDateTime(verifiedAt, 'encryptedConversion.verifiedAt')
      const updated = validateRegistryEntry({
        ...current,
        encryptedConversion: {
          ...current.encryptedConversion,
          verifiedAt,
        },
        registryRevision: current.registryRevision + 1,
        updatedAt: verifiedAt,
      })
      await this.database.workspaces.put(updated)
      return updated
    })
  }

  async clearEncryptedConversionReservation(
    id: string,
    expectedRevision: number,
    targetStorageId: string,
    verifyTargetAbsent: (entry: WorkspaceRegistryEntry) => Promise<boolean>,
  ): Promise<WorkspaceRegistryEntry> {
    const candidate = await this.database.workspaces.get(id)
    if (
      !candidate ||
      candidate.registryRevision !== expectedRevision ||
      candidate.encryptedConversion?.targetStorageId !== targetStorageId
    ) {
      throw new WorkspaceRegistryConflictError(
        id,
        expectedRevision,
        candidate?.registryRevision ?? null,
      )
    }
    if (!(await verifyTargetAbsent(candidate))) {
      throw new WorkspaceRegistryValidationError(
        'Encrypted conversion target still exists; reservation cannot be cleared.',
      )
    }
    return this.database.transaction('rw', this.database.workspaces, async () => {
      const current = await this.database.workspaces.get(id)
      if (
        !current ||
        current.registryRevision !== expectedRevision ||
        current.encryptedConversion?.targetStorageId !== targetStorageId
      ) {
        throw new WorkspaceRegistryConflictError(
          id,
          expectedRevision,
          current?.registryRevision ?? null,
        )
      }
      const updated = validateRegistryEntry({
        ...current,
        encryptedConversion: undefined,
        registryRevision: current.registryRevision + 1,
        updatedAt: new Date().toISOString(),
      })
      await this.database.workspaces.put(updated)
      return updated
    })
  }

  /**
   * Atomically routes a verified standard workspace to its encrypted adapter.
   * The old standard DB is retained and recorded until external deletion has
   * actually succeeded.
   */
  async promoteStandardToEncrypted(
    id: string,
    expectedRegistryRevision: number,
    expectedOldStorageId: string,
    newEncryptedStorageId: string,
    encryptedStorageSchemaVersion: number,
    verifiedAt: string,
  ): Promise<WorkspaceRegistryEntry> {
    return this.database.transaction('rw', this.database.workspaces, async () => {
      const current = await this.database.workspaces.get(id)
      if (!current || current.registryRevision !== expectedRegistryRevision) {
        throw new WorkspaceRegistryConflictError(
          id,
          expectedRegistryRevision,
          current?.registryRevision ?? null,
        )
      }
      if (
        current.state !== 'ready' ||
        current.encryptionMode !== 'standard' ||
        current.storageId !== expectedOldStorageId
      ) {
        throw new WorkspaceRegistryValidationError(
          'Only the expected ready standard workspace can be promoted.',
        )
      }
      if (!opaqueStorageIdPattern.test(newEncryptedStorageId)) {
        throw new WorkspaceRegistryValidationError(
          'Encrypted storage ID must be an opaque local identifier.',
        )
      }
      if (newEncryptedStorageId === current.storageId) {
        throw new WorkspaceRegistryValidationError(
          'Encrypted storage ID must differ from the plaintext storage locator.',
        )
      }
      if (
        !Number.isInteger(encryptedStorageSchemaVersion) ||
        encryptedStorageSchemaVersion < 1
      ) {
        throw new WorkspaceRegistryValidationError(
          'Encrypted storage schema version is invalid.',
        )
      }
      requireIsoDateTime(verifiedAt, 'verifiedAt')
      if (
        !current.encryptedConversion ||
        current.encryptedConversion.targetStorageId !== newEncryptedStorageId ||
        current.encryptedConversion.storageSchemaVersion !==
          encryptedStorageSchemaVersion ||
        !current.encryptedConversion.verifiedAt
      ) {
        throw new WorkspaceRegistryValidationError(
          'Encrypted conversion reservation is not verified for this target.',
        )
      }

      const reservation = (await this.database.workspaces.toArray()).find(
        (candidate) =>
          candidate.id !== current.id &&
          reservesStorageLocator(candidate, newEncryptedStorageId),
      )
      const currentHistoricalReservation = current.plaintextSources?.some(
        (source) => source.sourceStorageId === newEncryptedStorageId,
      )
      if (reservation || currentHistoricalReservation) {
        throw new WorkspaceRegistryValidationError(
          'Encrypted storage ID is reserved by another current or historical route.',
        )
      }

      const sourceId = `standard:${expectedOldStorageId}`
      const plaintextSources = [...(current.plaintextSources ?? [])]
      const existingSourceIndex = plaintextSources.findIndex(
        (source) => source.id === sourceId,
      )
      const source: PlaintextSourceReference = {
        id: sourceId,
        kind: 'standard',
        sourceStorageId: expectedOldStorageId,
        state: 'cleanup-pending',
        verifiedAt,
      }
      if (existingSourceIndex >= 0) plaintextSources[existingSourceIndex] = source
      else plaintextSources.push(source)

      const promoted = validateRegistryEntry({
        ...current,
        storageId: newEncryptedStorageId,
        encryptionMode: 'encrypted',
        storageSchemaVersion: encryptedStorageSchemaVersion,
        plaintextSources,
        encryptedConversion: undefined,
        registryRevision: current.registryRevision + 1,
        updatedAt: verifiedAt,
      })
      await this.database.workspaces.put(promoted)
      return promoted
    })
  }

  /** Call only after the named plaintext database was physically deleted. */
  async markPlaintextSourceRemoved(
    id: string,
    expectedRegistryRevision: number,
    plaintextSourceId: string,
    removedAt: string,
  ): Promise<WorkspaceRegistryEntry> {
    return this.database.transaction('rw', this.database.workspaces, async () => {
      const current = await this.database.workspaces.get(id)
      if (!current || current.registryRevision !== expectedRegistryRevision) {
        throw new WorkspaceRegistryConflictError(
          id,
          expectedRegistryRevision,
          current?.registryRevision ?? null,
        )
      }
      requireIsoDateTime(removedAt, 'removedAt')
      const plaintextSources = [...(current.plaintextSources ?? [])]
      const sourceIndex = plaintextSources.findIndex(
        (source) => source.id === plaintextSourceId,
      )
      if (sourceIndex < 0) {
        throw new WorkspaceRegistryValidationError('Plaintext source does not exist.')
      }
      const source = plaintextSources[sourceIndex]
      if (!source) {
        throw new WorkspaceRegistryValidationError('Plaintext source does not exist.')
      }
      plaintextSources[sourceIndex] = {
        ...source,
        state: 'removed',
        removedAt,
      }
      const updated = validateRegistryEntry({
        ...current,
        plaintextSources,
        registryRevision: current.registryRevision + 1,
        updatedAt: removedAt,
      })
      await this.database.workspaces.put(updated)
      return updated
    })
  }

  async recordMigrationStart(
    ledger: WorkspaceMigrationLedger,
  ): Promise<WorkspaceMigrationLedger> {
    validateMigrationLedger(ledger)
    return this.database.transaction(
      'rw',
      [this.database.migrations, this.database.workspaces],
      async () => {
      const existing = await this.database.migrations.get(ledger.id)
      if (existing?.status === 'verified') return existing
      if (
        existing &&
        (existing.sourceDatabaseName !== ledger.sourceDatabaseName ||
          existing.sourceWorkspaceId !== ledger.sourceWorkspaceId ||
          existing.targetWorkspaceId !== ledger.targetWorkspaceId ||
          existing.targetStorageId !== ledger.targetStorageId)
      ) {
        throw new WorkspaceRegistryValidationError(
          'Migration identity changed while resuming an existing migration.',
        )
      }
      if (!existing) {
        const workspaceReservation = (await this.database.workspaces.toArray()).find(
          (candidate) => reservesStorageLocator(candidate, ledger.targetStorageId),
        )
        const migrationReservation = (await this.database.migrations.toArray()).find(
          (candidate) =>
            candidate.id !== ledger.id &&
            candidate.targetStorageId === ledger.targetStorageId,
        )
        if (workspaceReservation || migrationReservation) {
          throw new WorkspaceRegistryValidationError(
            'Migration target storage is already reserved.',
          )
        }
      }
      const next = validateMigrationLedger(
        existing
          ? {
              ...existing,
              sourceDatabaseVersion: ledger.sourceDatabaseVersion,
              sourceRevision: ledger.sourceRevision,
              status: 'copying',
              errorCode: undefined,
              updatedAt: new Date().toISOString(),
            }
          : ledger,
      )
      await this.database.migrations.put(next)
      return next
      },
    )
  }

  async markMigrationFailed(id: string, errorCode: string): Promise<void> {
    await this.database.transaction('rw', this.database.migrations, async () => {
      const current = await this.database.migrations.get(id)
      if (!current || current.status === 'verified') return
      await this.database.migrations.put(
        validateMigrationLedger({
          ...current,
          status: 'failed',
          errorCode,
          updatedAt: new Date().toISOString(),
        }),
      )
    })
  }

  async noteVerifiedMigrationDivergence(id: string): Promise<void> {
    await this.database.transaction('rw', this.database.migrations, async () => {
      const current = await this.database.migrations.get(id)
      if (!current || current.status !== 'verified') return
      await this.database.migrations.put(
        validateMigrationLedger({
          ...current,
          errorCode: 'source-or-target-diverged-after-publish',
          updatedAt: new Date().toISOString(),
        }),
      )
    })
  }

  /** Publishes the entry and verified migration atomically inside the registry DB. */
  async publishVerifiedMigration(
    entry: WorkspaceRegistryEntry,
    migrationId: string,
  ): Promise<WorkspaceRegistryEntry> {
    validateRegistryEntry(entry)
    return this.database.transaction(
      'rw',
      [this.database.workspaces, this.database.migrations],
      async () => {
        const ledger = await this.database.migrations.get(migrationId)
        if (!ledger) {
          throw new WorkspaceRegistryValidationError('Migration ledger is missing.')
        }
        if (
          ledger.targetWorkspaceId !== entry.id ||
          ledger.targetStorageId !== entry.storageId
        ) {
          throw new WorkspaceRegistryValidationError(
            'Migration target does not match the registry entry.',
          )
        }

        const existing = await this.database.workspaces.get(entry.id)
        if (existing && existing.storageId !== entry.storageId) {
          throw new WorkspaceRegistryValidationError(
            `Workspace "${entry.id}" already uses another storage ID.`,
          )
        }
        const reservation = (await this.database.workspaces.toArray()).find(
          (candidate) =>
            candidate.id !== entry.id &&
            reservesStorageLocator(candidate, entry.storageId),
        )
        if (reservation) {
          throw new WorkspaceRegistryValidationError(
            'Migration target storage is reserved by another current or historical route.',
          )
        }
        const readyEntry = validateRegistryEntry({
          ...(existing ?? entry),
          state: 'ready',
          legacyMigrationKey: migrationId,
        })
        await this.database.workspaces.put(readyEntry)
        await this.database.migrations.put(
          validateMigrationLedger({
            ...ledger,
            status: 'verified',
            errorCode: undefined,
            verifiedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        )
        return readyEntry
      },
    )
  }

  async setActiveWorkspace(workspaceId?: string): Promise<WorkspaceRegistrySettings> {
    return this.database.transaction(
      'rw',
      [this.database.settings, this.database.workspaces],
      async () => {
        const activeEntry = workspaceId
          ? await this.database.workspaces.get(workspaceId)
          : undefined
        if (workspaceId && activeEntry?.state !== 'ready') {
          throw new WorkspaceRegistryValidationError(
            'Only a ready workspace can become active.',
          )
        }
        const now = new Date().toISOString()
        const current = await this.database.settings.get(REGISTRY_SETTINGS_ID)
        const settings: WorkspaceRegistrySettings = current
          ? { ...current, activeWorkspaceId: workspaceId, updatedAt: now }
          : {
              id: REGISTRY_SETTINGS_ID,
              bootstrapVersion: 0,
              activeWorkspaceId: workspaceId,
              createdAt: now,
              updatedAt: now,
            }
        await this.database.settings.put(settings)
        return settings
      },
    )
  }

  async completeBootstrap(activeWorkspaceId?: string): Promise<WorkspaceRegistrySettings> {
    const now = new Date().toISOString()
    return this.database.transaction(
      'rw',
      [this.database.settings, this.database.workspaces],
      async () => {
        const activeEntry = activeWorkspaceId
          ? await this.database.workspaces.get(activeWorkspaceId)
          : undefined
        if (activeWorkspaceId && activeEntry?.state !== 'ready') {
          throw new WorkspaceRegistryValidationError(
            'Only a ready workspace can complete bootstrap.',
          )
        }
        const current = await this.database.settings.get(REGISTRY_SETTINGS_ID)
        const settings: WorkspaceRegistrySettings = {
          id: REGISTRY_SETTINGS_ID,
          bootstrapVersion: REGISTRY_BOOTSTRAP_VERSION,
          ...(activeWorkspaceId ? { activeWorkspaceId } : {}),
          createdAt: current?.createdAt ?? now,
          updatedAt: now,
        }
        await this.database.settings.put(settings)
        return settings
      },
    )
  }

  /** Removes only an unpublished staging route after its storage is confirmed absent. */
  async discardProvisioning(
    id: string,
    expectedRevision: number,
    storageIsAbsent: (entry: WorkspaceRegistryEntry) => Promise<boolean>,
  ): Promise<void> {
    const candidate = await this.database.workspaces.get(id)
    if (
      !candidate ||
      !['provisioning', 'migration-failed'].includes(candidate.state) ||
      candidate.registryRevision !== expectedRevision
    ) {
      throw new WorkspaceRegistryConflictError(
        id,
        expectedRevision,
        candidate?.registryRevision ?? null,
      )
    }
    if (!(await storageIsAbsent(candidate))) {
      throw new WorkspaceRegistryValidationError(
        'Provisioning storage still exists; the staging route was retained.',
      )
    }
    await this.database.transaction('rw', this.database.workspaces, async () => {
      const current = await this.database.workspaces.get(id)
      if (
        !current ||
        !['provisioning', 'migration-failed'].includes(current.state) ||
        current.registryRevision !== candidate.registryRevision ||
        current.storageId !== candidate.storageId ||
        current.encryptionMode !== candidate.encryptionMode
      ) {
        throw new WorkspaceRegistryValidationError(
          'Provisioning route changed during storage verification.',
        )
      }
      await this.database.workspaces.delete(id)
    })
  }

  /**
   * The registry entry is retained if physical deletion fails. If the final
   * registry transaction fails, a `deleting` entry remains discoverable.
   */
  async deleteWorkspace(
    id: string,
    expectedRevision: number,
    deleteStorage: (entry: WorkspaceRegistryEntry) => Promise<void>,
    storageIsAbsent: (entry: WorkspaceRegistryEntry) => Promise<boolean>,
  ): Promise<void> {
    const deleting = await this.updateWorkspace(id, expectedRevision, (entry) => ({
      ...entry,
      state: 'deleting',
    }))
    try {
      await deleteStorage(deleting)
    } catch (error) {
      let storageAbsent: boolean | undefined
      try {
        storageAbsent = await storageIsAbsent(deleting)
      } catch {
        // Ambiguous physical state stays deleting for explicit recovery.
      }
      if (storageAbsent === false) {
        await this.updateWorkspace(id, deleting.registryRevision, (entry) => ({
          ...entry,
          state: 'ready',
        })).catch(() => undefined)
      }
      throw error
    }

    await this.finalizeWorkspaceDeletion(id, storageIsAbsent)
  }

  /**
   * Completes a previously verified physical deletion. Recovery code may retry
   * this after confirming the storage database is absent.
   */
  async finalizeWorkspaceDeletion(
    id: string,
    storageIsAbsent: (entry: WorkspaceRegistryEntry) => Promise<boolean>,
  ): Promise<void> {
    const candidate = await this.database.workspaces.get(id)
    if (!candidate || candidate.state !== 'deleting') {
      throw new WorkspaceRegistryValidationError(
        'Workspace deletion requires a discoverable deleting tombstone.',
      )
    }
    if (!(await storageIsAbsent(candidate))) {
      throw new WorkspaceRegistryValidationError(
        'Workspace storage still exists; registry deletion was not finalized.',
      )
    }
    await this.database.transaction(
      'rw',
      [this.database.workspaces, this.database.settings],
      async () => {
        const current = await this.database.workspaces.get(id)
        if (
          !current ||
          current.state !== 'deleting' ||
          current.registryRevision !== candidate.registryRevision ||
          current.storageId !== candidate.storageId ||
          current.encryptionMode !== candidate.encryptionMode
        ) {
          throw new WorkspaceRegistryValidationError(
            'Workspace deletion tombstone changed during storage verification.',
          )
        }
        await this.database.workspaces.delete(id)
        const settings = await this.database.settings.get(REGISTRY_SETTINGS_ID)
        if (settings?.activeWorkspaceId === id) {
          await this.database.settings.put({
            ...settings,
            activeWorkspaceId: undefined,
            updatedAt: new Date().toISOString(),
          })
        }
      },
    )
  }

  close(): void {
    this.database.close()
  }
}
