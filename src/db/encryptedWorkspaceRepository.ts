import type { WorkspaceData } from '../models/domain'
import { validateWorkspace, WorkspaceValidationError } from '../utils/workspace-transfer'
import {
  EncryptedContainerAuthenticationError,
  EncryptedContainerFormatError,
  ENCRYPTED_PAYLOAD_VERSION,
  EncryptedPayloadValidationError,
  LEGACY_ENCRYPTED_PAYLOAD_VERSION,
  LocalWorkspaceCryptoSession,
  MAX_KEY_INVOCATIONS,
  WebCryptoUnavailableError,
  createEncryptedBackup,
  createLocalWorkspaceContainer,
  inspectLocalProtectedHeader,
  openEncryptedBackup,
  openLocalWorkspaceContainer,
  type BinaryEncryptedContainer,
  type OpenedLocalWorkspaceContainer,
} from '../crypto'
import {
  ENCRYPTED_VAULT_RECORD_ID,
  EncryptedVaultDatabase,
  cloneEncryptedVaultRecord,
  deleteEncryptedVaultDatabase,
  encryptedVaultDatabaseExists,
  type EncryptedVaultRecord,
} from './encryptedVaultDatabase'
import {
  WorkspaceConflictError,
  WorkspaceIdentityError,
  buildMergedWorkspace,
  workspaceSnapshotsEqual,
  type MergeWorkspaceResult,
} from './workspaceRepository'

export interface EncryptedWorkspaceCoordinates {
  bindingId: string
  storageRevision: number
  lockEpoch: number
  keyInvocation: number
  encryptionAttempts: number
}

export interface CreateEncryptedWorkspaceOptions {
  bindingId?: string
  /** Dependency injection seam used by storage-integrity tests. */
  databaseFactory?: (bindingId: string) => EncryptedVaultDatabase
}

export interface RestoreEncryptedBackupOptions extends CreateEncryptedWorkspaceOptions {
  /** A fresh logical workspace ID; the backup's ID is never reused implicitly. */
  newWorkspaceId: string
  newWorkspaceName?: string
}

export interface UnlockEncryptedWorkspaceOptions {
  /** Dependency injection seam used by atomic-upgrade storage tests. */
  databaseFactory?: (bindingId: string) => EncryptedVaultDatabase
}

export class EncryptedWorkspaceNotFoundError extends Error {
  constructor(bindingId: string) {
    super(`Encrypted workspace ${bindingId} was not found in this browser profile.`)
    this.name = 'EncryptedWorkspaceNotFoundError'
  }
}

export class EncryptedWorkspaceAlreadyExistsError extends Error {
  constructor(bindingId: string) {
    super(`Encrypted workspace ${bindingId} already exists in this browser profile.`)
    this.name = 'EncryptedWorkspaceAlreadyExistsError'
  }
}

export class EncryptedWorkspaceConflictError extends Error {
  readonly expected: EncryptedWorkspaceCoordinates
  readonly actual: EncryptedWorkspaceCoordinates | null

  constructor(
    expected: EncryptedWorkspaceCoordinates,
    actual: EncryptedWorkspaceCoordinates | null,
  ) {
    super('The encrypted workspace changed or was locked in another application context.')
    this.name = 'EncryptedWorkspaceConflictError'
    this.expected = expected
    this.actual = actual
  }
}

export class EncryptedWorkspaceSessionClosedError extends Error {
  constructor() {
    super('The encrypted workspace session is locked or closed.')
    this.name = 'EncryptedWorkspaceSessionClosedError'
  }
}

function recordCoordinates(
  bindingId: string,
  record: EncryptedVaultRecord,
): EncryptedWorkspaceCoordinates {
  return {
    bindingId,
    storageRevision: record.storageRevision,
    lockEpoch: record.lockEpoch,
    keyInvocation: record.keyInvocation,
    encryptionAttempts: record.encryptionAttempts,
  }
}

function committedCoordinatesMatch(
  left: EncryptedWorkspaceCoordinates,
  right: EncryptedWorkspaceCoordinates,
): boolean {
  return (
    left.bindingId === right.bindingId &&
    left.storageRevision === right.storageRevision &&
    left.lockEpoch === right.lockEpoch &&
    left.keyInvocation === right.keyInvocation
  )
}

function coordinatesMatch(
  left: EncryptedWorkspaceCoordinates,
  right: EncryptedWorkspaceCoordinates,
): boolean {
  return (
    committedCoordinatesMatch(left, right) &&
    left.encryptionAttempts === right.encryptionAttempts
  )
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function containersEqual(
  left: BinaryEncryptedContainer,
  right: BinaryEncryptedContainer,
): boolean {
  return (
    bytesEqual(left.protected, right.protected) &&
    bytesEqual(left.iv, right.iv) &&
    bytesEqual(left.ciphertext, right.ciphertext)
  )
}

export function createEncryptedBindingId(): string {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi || typeof cryptoApi.randomUUID !== 'function') {
    throw new WebCryptoUnavailableError()
  }
  return cryptoApi.randomUUID()
}

function recordFromContainer(
  container: EncryptedVaultRecord | Omit<EncryptedVaultRecord, 'id' | 'lockEpoch'>,
  lockEpoch: number,
): EncryptedVaultRecord {
  return {
    id: ENCRYPTED_VAULT_RECORD_ID,
    storageRevision: container.storageRevision,
    lockEpoch,
    keyInvocation: container.keyInvocation,
    encryptionAttempts: container.encryptionAttempts,
    protected: new Uint8Array(container.protected),
    iv: new Uint8Array(container.iv),
    ciphertext: new Uint8Array(container.ciphertext),
  }
}

function isUint8Array(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) &&
    Object.prototype.toString.call(value) === '[object Uint8Array]'
  )
}

function validatePersistedRecord(input: unknown): EncryptedVaultRecord {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new EncryptedContainerAuthenticationError()
  }
  const record = input as Record<string, unknown>
  if (
    Object.keys(record).sort().join(',') !==
      'ciphertext,encryptionAttempts,id,iv,keyInvocation,lockEpoch,protected,storageRevision' ||
    record['id'] !== ENCRYPTED_VAULT_RECORD_ID ||
    typeof record['storageRevision'] !== 'number' ||
    !Number.isSafeInteger(record['storageRevision']) ||
    record['storageRevision'] < 0 ||
    typeof record['lockEpoch'] !== 'number' ||
    !Number.isSafeInteger(record['lockEpoch']) ||
    record['lockEpoch'] < 0 ||
    typeof record['keyInvocation'] !== 'number' ||
    !Number.isSafeInteger(record['keyInvocation']) ||
    record['keyInvocation'] < 1 ||
    record['keyInvocation'] > MAX_KEY_INVOCATIONS ||
    typeof record['encryptionAttempts'] !== 'number' ||
    !Number.isSafeInteger(record['encryptionAttempts']) ||
    record['encryptionAttempts'] < record['keyInvocation'] ||
    record['encryptionAttempts'] > MAX_KEY_INVOCATIONS ||
    !isUint8Array(record['protected']) ||
    !isUint8Array(record['iv']) ||
    !isUint8Array(record['ciphertext'])
  ) {
    throw new EncryptedContainerAuthenticationError()
  }
  return cloneEncryptedVaultRecord(record as unknown as EncryptedVaultRecord)
}

async function readRecord(database: EncryptedVaultDatabase): Promise<EncryptedVaultRecord | null> {
  const records = await database.vaults.toArray()
  if (records.length === 0) return null
  if (records.length !== 1) throw new EncryptedContainerAuthenticationError()
  return validatePersistedRecord(records[0])
}

function assertPersistedGeneration(
  record: EncryptedVaultRecord,
  cryptoSession: LocalWorkspaceCryptoSession,
  bindingId: string,
): void {
  try {
    const header = inspectLocalProtectedHeader(record)
    if (
      cryptoSession.bindingId !== bindingId ||
      header.bindingId !== bindingId ||
      header.kdf.salt !== cryptoSession.salt ||
      header.storageRevision !== record.storageRevision ||
      header.keyInvocation !== record.keyInvocation
    ) {
      throw new EncryptedContainerAuthenticationError()
    }
  } catch {
    throw new EncryptedContainerAuthenticationError()
  }
}

export async function inspectEncryptedWorkspaceRecord(
  bindingId: string,
): Promise<EncryptedVaultRecord | null> {
  if (!(await encryptedVaultDatabaseExists(bindingId))) return null
  const database = new EncryptedVaultDatabase(bindingId)
  try {
    return await readRecord(database)
  } finally {
    database.close()
  }
}

/**
 * Re-encrypts an authenticated v3 payload as v4 without changing the logical
 * workspace revision. The old ciphertext remains the committed value until a
 * fully authenticated candidate has won the vault CAS and been read back in
 * that same transaction. A failed post-commit authentication restores the old
 * ciphertext when the candidate is still the current generation.
 */
async function upgradeLegacyEncryptedWorkspace(
  database: EncryptedVaultDatabase,
  bindingId: string,
  originalRecord: EncryptedVaultRecord,
  opened: OpenedLocalWorkspaceContainer,
): Promise<{
  record: EncryptedVaultRecord
  workspace: WorkspaceData
}> {
  if (opened.payloadVersion !== LEGACY_ENCRYPTED_PAYLOAD_VERSION) {
    throw new EncryptedContainerAuthenticationError()
  }

  const expected = recordCoordinates(bindingId, originalRecord)
  let reservedInvocation = 0
  await database.transaction('rw', database.vaults, async () => {
    const records = await database.vaults.toArray()
    if (records.length !== 1) throw new EncryptedContainerAuthenticationError()
    const persisted = validatePersistedRecord(records[0])
    assertPersistedGeneration(persisted, opened.session, bindingId)
    const header = inspectLocalProtectedHeader(persisted)
    const actual = recordCoordinates(bindingId, persisted)
    if (
      header.payloadVersion !== LEGACY_ENCRYPTED_PAYLOAD_VERSION ||
      !committedCoordinatesMatch(expected, actual)
    ) {
      throw new EncryptedWorkspaceConflictError(expected, actual)
    }
    if (persisted.encryptionAttempts >= MAX_KEY_INVOCATIONS) {
      throw new EncryptedContainerAuthenticationError()
    }
    reservedInvocation = persisted.encryptionAttempts + 1
    await database.vaults.put({
      ...persisted,
      encryptionAttempts: reservedInvocation,
    })
  })

  const upgradedContainer = await opened.session.encrypt(
    opened.workspace,
    expected.storageRevision,
    reservedInvocation,
  )
  const candidateCoordinates: EncryptedWorkspaceCoordinates = {
    ...expected,
    keyInvocation: reservedInvocation,
    encryptionAttempts: reservedInvocation,
  }
  const verifiedCandidate = await opened.session.decrypt(
    upgradedContainer,
    candidateCoordinates,
  )
  if (
    inspectLocalProtectedHeader(upgradedContainer).payloadVersion !==
      ENCRYPTED_PAYLOAD_VERSION ||
    !workspaceSnapshotsEqual(opened.workspace, verifiedCandidate)
  ) {
    throw new EncryptedContainerAuthenticationError()
  }

  let committedRecord: EncryptedVaultRecord | null = null
  await database.transaction('rw', database.vaults, async () => {
    const records = await database.vaults.toArray()
    if (records.length !== 1) throw new EncryptedContainerAuthenticationError()
    const persisted = validatePersistedRecord(records[0])
    assertPersistedGeneration(persisted, opened.session, bindingId)
    const actual = recordCoordinates(bindingId, persisted)
    if (!committedCoordinatesMatch(expected, actual)) {
      throw new EncryptedWorkspaceConflictError(expected, actual)
    }
    if (persisted.encryptionAttempts < reservedInvocation) {
      throw new EncryptedContainerAuthenticationError()
    }

    const candidate: EncryptedVaultRecord = {
      id: ENCRYPTED_VAULT_RECORD_ID,
      storageRevision: expected.storageRevision,
      lockEpoch: expected.lockEpoch,
      keyInvocation: reservedInvocation,
      encryptionAttempts: persisted.encryptionAttempts,
      ...upgradedContainer,
    }
    await database.vaults.put(candidate)
    const readBack = await database.vaults.get(ENCRYPTED_VAULT_RECORD_ID)
    if (!readBack) throw new EncryptedContainerAuthenticationError()
    const validatedReadBack = validatePersistedRecord(readBack)
    const readBackHeader = inspectLocalProtectedHeader(validatedReadBack)
    if (
      readBackHeader.payloadVersion !== ENCRYPTED_PAYLOAD_VERSION ||
      !coordinatesMatch(
        recordCoordinates(bindingId, candidate),
        recordCoordinates(bindingId, validatedReadBack),
      ) ||
      !containersEqual(candidate, validatedReadBack)
    ) {
      throw new EncryptedContainerAuthenticationError()
    }
    committedRecord = validatedReadBack
  })

  if (!committedRecord) throw new EncryptedContainerAuthenticationError()
  try {
    const committedCoordinates = recordCoordinates(bindingId, committedRecord)
    const readBackWorkspace = await opened.session.decrypt(
      committedRecord,
      committedCoordinates,
    )
    if (!workspaceSnapshotsEqual(opened.workspace, readBackWorkspace)) {
      throw new EncryptedContainerAuthenticationError()
    }
    return { record: committedRecord, workspace: readBackWorkspace }
  } catch (error) {
    // This rollback is itself a CAS: never overwrite a later legitimate save.
    await database.transaction('rw', database.vaults, async () => {
      const currentInput = await database.vaults.get(ENCRYPTED_VAULT_RECORD_ID)
      if (!currentInput) return
      const current = validatePersistedRecord(currentInput)
      if (
        committedRecord &&
        coordinatesMatch(
          recordCoordinates(bindingId, committedRecord),
          recordCoordinates(bindingId, current),
        ) &&
        containersEqual(committedRecord, current)
      ) {
        await database.vaults.put({
          ...originalRecord,
          encryptionAttempts: Math.max(
            originalRecord.encryptionAttempts,
            current.encryptionAttempts,
          ),
        })
      }
    })
    throw error
  }
}

export class UnlockedEncryptedWorkspace {
  #database: EncryptedVaultDatabase | null
  #cryptoSession: LocalWorkspaceCryptoSession | null
  #workspace: WorkspaceData | null
  #coordinates: EncryptedWorkspaceCoordinates
  #lifecycleGeneration = 0

  constructor(
    database: EncryptedVaultDatabase,
    cryptoSession: LocalWorkspaceCryptoSession,
    workspace: WorkspaceData,
    coordinates: EncryptedWorkspaceCoordinates,
  ) {
    this.#database = database
    this.#cryptoSession = cryptoSession
    this.#workspace = workspace
    this.#coordinates = coordinates
  }

  get bindingId(): string {
    return this.#coordinates.bindingId
  }

  get coordinates(): EncryptedWorkspaceCoordinates {
    return { ...this.#coordinates }
  }

  get workspace(): WorkspaceData {
    if (!this.#workspace) throw new EncryptedWorkspaceSessionClosedError()
    return this.#workspace
  }

  get closed(): boolean {
    return this.#database === null || this.#cryptoSession === null
  }

  #captureLifecycle(): number {
    if (!this.#database || !this.#cryptoSession || !this.#workspace) {
      throw new EncryptedWorkspaceSessionClosedError()
    }
    return this.#lifecycleGeneration
  }

  #assertLifecycle(expected: number): void {
    if (
      expected !== this.#lifecycleGeneration ||
      !this.#database ||
      !this.#cryptoSession ||
      !this.#workspace
    ) {
      throw new EncryptedWorkspaceSessionClosedError()
    }
  }

  async #poisonOnVaultIntegrityFailure<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (
        error instanceof EncryptedContainerAuthenticationError ||
        error instanceof EncryptedContainerFormatError ||
        error instanceof EncryptedPayloadValidationError ||
        error instanceof EncryptedWorkspaceNotFoundError
      ) {
        this.close()
      }
      throw error
    }
  }

  async #assertVaultGenerationAvailable(
    database: EncryptedVaultDatabase,
  ): Promise<void> {
    if (database.isOpen()) return
    // Do not reopen this invalidated Dexie connection. A new database with the
    // same binding is a different cryptographic generation and must look like
    // authentication failure; a genuinely deleted database closes the session.
    if (await encryptedVaultDatabaseExists(this.bindingId)) {
      throw new EncryptedContainerAuthenticationError()
    }
    this.close()
    throw new EncryptedWorkspaceNotFoundError(this.bindingId)
  }

  async save(nextWorkspace: WorkspaceData): Promise<WorkspaceData> {
    const database = this.#database
    const cryptoSession = this.#cryptoSession
    if (!database || !cryptoSession || !this.#workspace) {
      throw new EncryptedWorkspaceSessionClosedError()
    }
    const lifecycle = this.#captureLifecycle()
    if (nextWorkspace.workspace.id !== this.#workspace.workspace.id) {
      throw new WorkspaceIdentityError(
        this.#workspace.workspace.id,
        nextWorkspace.workspace.id,
      )
    }

    const expected = { ...this.#coordinates }
    const nextRevision = expected.storageRevision + 1
    if (nextWorkspace.workspace.revision !== nextRevision) {
      throw new EncryptedWorkspaceConflictError(expected, expected)
    }

    return this.#poisonOnVaultIntegrityFailure(async () => {
    await this.#assertVaultGenerationAvailable(database)
    this.#assertLifecycle(lifecycle)

    // Reserve before Web Crypto so crashes, failed encryptions, and losing CAS
    // attempts all consume a unique invocation under this derived key.
    let reservedInvocation = 0
    await database.transaction('rw', database.vaults, async () => {
      const records = await database.vaults.toArray()
      if (records.length === 0) {
        throw new EncryptedWorkspaceNotFoundError(this.bindingId)
      }
      if (records.length !== 1) throw new EncryptedContainerAuthenticationError()
      const persisted = validatePersistedRecord(records[0])
      assertPersistedGeneration(persisted, cryptoSession, expected.bindingId)
      const actual = recordCoordinates(expected.bindingId, persisted)
      if (!committedCoordinatesMatch(expected, actual)) {
        throw new EncryptedWorkspaceConflictError(expected, actual)
      }
      if (persisted.encryptionAttempts >= MAX_KEY_INVOCATIONS) {
        throw new EncryptedContainerAuthenticationError()
      }
      reservedInvocation = persisted.encryptionAttempts + 1
      await database.vaults.put({
        ...persisted,
        encryptionAttempts: reservedInvocation,
      })
    })
    this.#assertLifecycle(lifecycle)

    // Web Crypto deliberately runs outside the IndexedDB transaction. The
    // transaction below performs the committed revision + lock epoch CAS.
    const container = await cryptoSession.encrypt(
      nextWorkspace,
      nextRevision,
      reservedInvocation,
    )
    this.#assertLifecycle(lifecycle)
    const nextRecord: EncryptedVaultRecord = {
      id: ENCRYPTED_VAULT_RECORD_ID,
      storageRevision: nextRevision,
      lockEpoch: expected.lockEpoch,
      keyInvocation: reservedInvocation,
      encryptionAttempts: reservedInvocation,
      ...container,
    }

    let committedRecord: EncryptedVaultRecord | null = null
    await database.transaction('rw', database.vaults, async () => {
      const records = await database.vaults.toArray()
      if (records.length === 0) {
        throw new EncryptedWorkspaceNotFoundError(this.bindingId)
      }
      if (records.length !== 1) throw new EncryptedContainerAuthenticationError()
      const persisted = validatePersistedRecord(records[0])
      assertPersistedGeneration(persisted, cryptoSession, expected.bindingId)
      const actual = recordCoordinates(expected.bindingId, persisted)
      if (!committedCoordinatesMatch(expected, actual)) {
        throw new EncryptedWorkspaceConflictError(expected, actual)
      }
      if (persisted.encryptionAttempts < reservedInvocation) {
        throw new EncryptedContainerAuthenticationError()
      }
      committedRecord = {
        ...nextRecord,
        encryptionAttempts: persisted.encryptionAttempts,
      }
      await database.vaults.put(committedRecord)
    })
    this.#assertLifecycle(lifecycle)

    if (!committedRecord) throw new EncryptedContainerAuthenticationError()
    this.#coordinates = recordCoordinates(this.bindingId, committedRecord)
    this.#workspace = nextWorkspace
    return nextWorkspace
    })
  }

  /** Standard-repository-compatible exact replacement with revision CAS. */
  async replace(
    snapshot: WorkspaceData,
    expectedRevision: number,
  ): Promise<WorkspaceData> {
    const current = this.workspace
    if (expectedRevision !== this.#coordinates.storageRevision) {
      throw new WorkspaceConflictError(
        expectedRevision,
        this.#coordinates.storageRevision,
      )
    }
    const validation = validateWorkspace(snapshot)
    if (!validation.success) {
      throw new WorkspaceValidationError(
        'The replacement workspace failed validation.',
        validation.issues,
      )
    }
    if (validation.data.workspace.id !== current.workspace.id) {
      throw new WorkspaceIdentityError(
        current.workspace.id,
        validation.data.workspace.id,
      )
    }
    return this.save({
      ...validation.data,
      workspace: {
        ...validation.data.workspace,
        revision: this.#coordinates.storageRevision + 1,
      },
    })
  }

  /** Uses the same graph-collision and relationship rules as standard storage. */
  async merge(incoming: WorkspaceData): Promise<MergeWorkspaceResult> {
    const merged = buildMergedWorkspace(this.workspace, incoming)
    await this.save(merged.snapshot)
    return merged.result
  }

  async refresh(): Promise<WorkspaceData> {
    const database = this.#database
    const cryptoSession = this.#cryptoSession
    if (!database || !cryptoSession) throw new EncryptedWorkspaceSessionClosedError()
    const lifecycle = this.#captureLifecycle()
    return this.#poisonOnVaultIntegrityFailure(async () => {
    await this.#assertVaultGenerationAvailable(database)
    this.#assertLifecycle(lifecycle)
    const persisted = await readRecord(database)
    this.#assertLifecycle(lifecycle)
    if (!persisted) throw new EncryptedWorkspaceNotFoundError(this.bindingId)
    if (persisted.lockEpoch !== this.#coordinates.lockEpoch) {
      this.close()
      throw new EncryptedWorkspaceConflictError(
        this.#coordinates,
        recordCoordinates(this.bindingId, persisted),
      )
    }
    const coordinates = recordCoordinates(this.bindingId, persisted)
    const workspace = await cryptoSession.decrypt(persisted, coordinates)
    this.#assertLifecycle(lifecycle)
    this.#coordinates = coordinates
    this.#workspace = workspace
    return workspace
    })
  }

  async createBackup(passphrase: string, canonicalWorkspaceName?: string): Promise<string> {
    // Back up the latest authenticated committed snapshot, not a stale in-memory
    // copy retained after another tab saved, locked, or deleted the vault.
    const lifecycle = this.#captureLifecycle()
    const latest = await this.refresh()
    this.#assertLifecycle(lifecycle)
    if (canonicalWorkspaceName === undefined) {
      const backup = await createEncryptedBackup(latest, passphrase)
      this.#assertLifecycle(lifecycle)
      return backup
    }
    const validation = validateWorkspace({
      ...latest,
      workspace: {
        ...latest.workspace,
        name: canonicalWorkspaceName,
      },
    })
    if (!validation.success) {
      throw new WorkspaceValidationError(
        'The backup workspace-name override failed validation.',
        validation.issues,
      )
    }
    const backup = await createEncryptedBackup(validation.data, passphrase)
    this.#assertLifecycle(lifecycle)
    return backup
  }

  /** Locks all cooperating tabs by advancing the persisted lock epoch. */
  async lock(): Promise<number> {
    const database = this.#database
    const cryptoSession = this.#cryptoSession
    if (!database || !cryptoSession) throw new EncryptedWorkspaceSessionClosedError()
    const lifecycle = this.#captureLifecycle()
    let nextLockEpoch = this.#coordinates.lockEpoch + 1
    try {
      await this.#assertVaultGenerationAvailable(database)
      this.#assertLifecycle(lifecycle)
      await database.transaction('rw', database.vaults, async () => {
        const records = await database.vaults.toArray()
        if (records.length === 0) {
          throw new EncryptedWorkspaceNotFoundError(this.bindingId)
        }
        if (records.length !== 1) throw new EncryptedContainerAuthenticationError()
        const persisted = validatePersistedRecord(records[0])
        assertPersistedGeneration(persisted, cryptoSession, this.bindingId)
        nextLockEpoch = persisted.lockEpoch + 1
        await database.vaults.put({ ...persisted, lockEpoch: nextLockEpoch })
      })
      this.#assertLifecycle(lifecycle)
      return nextLockEpoch
    } finally {
      this.close()
    }
  }

  /** Releases this tab's in-memory key without changing other tabs' lock epoch. */
  close(): void {
    if (this.closed) return
    this.#lifecycleGeneration += 1
    this.#cryptoSession?.dispose()
    this.#cryptoSession = null
    this.#workspace = null
    this.#database?.close()
    this.#database = null
  }
}

export async function createEncryptedWorkspace(
  workspace: WorkspaceData,
  passphrase: string,
  options: CreateEncryptedWorkspaceOptions = {},
): Promise<UnlockedEncryptedWorkspace> {
  const bindingId = (options.bindingId ?? createEncryptedBindingId()).toLowerCase()
  const coordinates: EncryptedWorkspaceCoordinates = {
    bindingId,
    storageRevision: workspace.workspace.revision,
    lockEpoch: 0,
    keyInvocation: 1,
    encryptionAttempts: 1,
  }
  const created = await createLocalWorkspaceContainer(workspace, passphrase, coordinates)
  const database = options.databaseFactory?.(bindingId) ?? new EncryptedVaultDatabase(bindingId)
  const record: EncryptedVaultRecord = {
    id: ENCRYPTED_VAULT_RECORD_ID,
    storageRevision: coordinates.storageRevision,
    lockEpoch: coordinates.lockEpoch,
    keyInvocation: coordinates.keyInvocation,
    encryptionAttempts: coordinates.encryptionAttempts,
    ...created.container,
  }
  try {
    await database.transaction('rw', database.vaults, async () => {
      if ((await database.vaults.count()) !== 0) {
        throw new EncryptedWorkspaceAlreadyExistsError(bindingId)
      }
      await database.vaults.add(record)
    })
    const persisted = await readRecord(database)
    if (!persisted) throw new EncryptedContainerAuthenticationError()
    const readBackCoordinates = recordCoordinates(bindingId, persisted)
    if (!coordinatesMatch(coordinates, readBackCoordinates)) {
      throw new EncryptedContainerAuthenticationError()
    }
    const readBack = await created.session.decrypt(persisted, readBackCoordinates)
    if (!workspaceSnapshotsEqual(workspace, readBack)) {
      throw new EncryptedContainerAuthenticationError()
    }
    return new UnlockedEncryptedWorkspace(
      database,
      created.session,
      readBack,
      readBackCoordinates,
    )
  } catch (error) {
    created.session.dispose()
    database.close()
    throw error
  }
}

export async function unlockEncryptedWorkspace(
  bindingIdInput: string,
  passphrase: string,
  options: UnlockEncryptedWorkspaceOptions = {},
): Promise<UnlockedEncryptedWorkspace> {
  const bindingId = bindingIdInput.toLowerCase()
  if (!(await encryptedVaultDatabaseExists(bindingId))) {
    throw new EncryptedWorkspaceNotFoundError(bindingId)
  }
  const database = options.databaseFactory?.(bindingId) ?? new EncryptedVaultDatabase(bindingId)
  let opened: OpenedLocalWorkspaceContainer | null = null
  try {
    const record = await readRecord(database)
    if (!record) throw new EncryptedWorkspaceNotFoundError(bindingId)
    let coordinates = recordCoordinates(bindingId, record)
    opened = await openLocalWorkspaceContainer(record, passphrase, coordinates)
    let workspace = opened.workspace
    if (opened.payloadVersion === LEGACY_ENCRYPTED_PAYLOAD_VERSION) {
      const upgraded = await upgradeLegacyEncryptedWorkspace(
        database,
        bindingId,
        record,
        opened,
      )
      coordinates = recordCoordinates(bindingId, upgraded.record)
      workspace = upgraded.workspace
    }
    return new UnlockedEncryptedWorkspace(
      database,
      opened.session,
      workspace,
      coordinates,
    )
  } catch (error) {
    opened?.session.dispose()
    database.close()
    throw error
  }
}

/**
 * Authenticates and validates the backup before generating or opening any local
 * vault database. A wrong passphrase or damaged backup therefore performs no write.
 */
export async function restoreEncryptedBackupAsNewWorkspace(
  encryptedBackup: string,
  backupPassphrase: string,
  newWorkspacePassphrase: string,
  options: RestoreEncryptedBackupOptions,
): Promise<UnlockedEncryptedWorkspace> {
  const workspace = await openEncryptedBackup(encryptedBackup, backupPassphrase)
  if (!options.newWorkspaceId || options.newWorkspaceId === workspace.workspace.id) {
    throw new EncryptedPayloadValidationError(
      'Restoring as new requires a non-empty workspace ID distinct from the backup.',
    )
  }
  const restoredWorkspace: WorkspaceData = {
    ...workspace,
    workspace: {
      ...workspace.workspace,
      id: options.newWorkspaceId,
      name: options.newWorkspaceName ?? workspace.workspace.name,
      revision: 0,
    },
  }
  return createEncryptedWorkspace(restoredWorkspace, newWorkspacePassphrase, {
    bindingId: options.bindingId,
    databaseFactory: options.databaseFactory,
  })
}

export async function removeEncryptedWorkspaceStorage(bindingId: string): Promise<void> {
  await deleteEncryptedVaultDatabase(bindingId)
}

export function encryptedVaultRecordContainsOnlyCiphertext(
  record: EncryptedVaultRecord,
): boolean {
  return (
    Object.keys(record).sort().join(',') ===
    'ciphertext,encryptionAttempts,id,iv,keyInvocation,lockEpoch,protected,storageRevision'
  )
}

export function copyEncryptedVaultRecord(record: EncryptedVaultRecord): EncryptedVaultRecord {
  return recordFromContainer(record, record.lockEpoch)
}
