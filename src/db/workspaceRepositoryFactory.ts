import { WORKSPACE_SCHEMA_VERSION, type WorkspaceData } from '../models/domain'
import {
  DEMO_WORKSPACE_DISPLAY_NAME,
  DEMO_WORKSPACE_ID,
  createDemoWorkspace,
} from '../models/demo'
import {
  DEFAULT_PERSONAL_WORKSPACE_NAME,
  createEmptyWorkspace,
} from '../models/empty-workspace'
import {
  createOpaqueStorageId,
  type WorkspaceAutoLock,
  type WorkspaceKind,
  type WorkspaceRegistryEntry,
} from '../models/workspace-registry'
import {
  WorkspaceRegistryConflictError,
  WorkspaceRegistryRepository,
  type WorkspaceRegistryDatabase,
} from './registryDatabase'
import {
  STANDARD_WORKSPACE_STORAGE_SCHEMA_VERSION,
  createStandardWorkspaceDatabase,
  deleteStandardWorkspaceDatabase,
  standardWorkspaceDatabaseExists,
} from './standardWorkspaceDatabase'
import {
  StandardWorkspaceRepository,
  workspaceSnapshotsEqual,
} from './workspaceRepository'

export interface ProvisionStandardWorkspaceOptions {
  kind: WorkspaceKind
  displayName: string
  autoLock?: WorkspaceAutoLock
  storageId?: string
  createdAt?: string
  /** Allows concurrent first-boot callers to converge on one deterministic seed. */
  bootstrapSeed?: boolean
}

export interface OpenStandardWorkspace {
  entry: WorkspaceRegistryEntry
  snapshot: WorkspaceData
  repository: StandardWorkspaceRepository
  close: () => void
}

export class UnsupportedWorkspaceStorageError extends Error {
  constructor(mode: string) {
    super(`Workspace storage mode "${mode}" requires another repository adapter.`)
    this.name = 'UnsupportedWorkspaceStorageError'
  }
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

const INITIAL_PERSONAL_WORKSPACE_ID = 'personal-workspace'
const INITIAL_DEMO_FALLBACK_ID = 'demo-workspace-pristine'

function stableSeedHash(value: string, offset: number): string {
  let hash = (0x811c9dc5 ^ offset) >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36).padStart(7, '0')
}

function deterministicInitialStorageId(
  registryDatabaseName: string,
  workspaceId: string,
): string {
  const seed = `${registryDatabaseName}\u0000${workspaceId}`
  return `initial-${stableSeedHash(seed, 0)}-${stableSeedHash(seed, 0x9e3779b9)}`
}

function bootstrapSnapshotForEntry(entry: WorkspaceRegistryEntry): WorkspaceData {
  const now = new Date(entry.createdAt)
  return entry.kind === 'demo'
    ? demoSnapshotForIdentity(entry.id, now)
    : createEmptyWorkspace({ id: entry.id, name: entry.displayName, now })
}

function nextDeterministicDemoId(entries: WorkspaceRegistryEntry[]): string {
  const occupied = new Set(entries.map((entry) => entry.id))
  if (!occupied.has(DEMO_WORKSPACE_ID)) return DEMO_WORKSPACE_ID
  if (!occupied.has(INITIAL_DEMO_FALLBACK_ID)) return INITIAL_DEMO_FALLBACK_ID
  let suffix = 2
  while (occupied.has(`${INITIAL_DEMO_FALLBACK_ID}-${suffix}`)) suffix += 1
  return `${INITIAL_DEMO_FALLBACK_ID}-${suffix}`
}

function nextDeterministicPersonalId(entries: WorkspaceRegistryEntry[]): string {
  const occupied = new Set(entries.map((entry) => entry.id))
  if (!occupied.has(INITIAL_PERSONAL_WORKSPACE_ID)) {
    return INITIAL_PERSONAL_WORKSPACE_ID
  }
  const fallback = `${INITIAL_PERSONAL_WORKSPACE_ID}-recovery`
  if (!occupied.has(fallback)) return fallback
  let suffix = 2
  while (occupied.has(`${fallback}-${suffix}`)) suffix += 1
  return `${fallback}-${suffix}`
}

export class WorkspaceRepositoryFactory {
  readonly registry: WorkspaceRegistryRepository
  readonly registryDatabase: WorkspaceRegistryDatabase

  constructor(registryDatabase: WorkspaceRegistryDatabase) {
    this.registryDatabase = registryDatabase
    this.registry = new WorkspaceRegistryRepository(registryDatabase)
  }

  private makeEntry(
    snapshot: WorkspaceData,
    options: ProvisionStandardWorkspaceOptions,
  ): WorkspaceRegistryEntry {
    const createdAt = options.createdAt ?? snapshot.workspace.createdAt
    return {
      id: snapshot.workspace.id,
      storageId: options.storageId ?? createOpaqueStorageId(),
      displayName: options.displayName.trim() || snapshot.workspace.name,
      kind: options.kind,
      encryptionMode: 'standard',
      createdAt,
      updatedAt: createdAt,
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      storageSchemaVersion: STANDARD_WORKSPACE_STORAGE_SCHEMA_VERSION,
      registryRevision: 0,
      autoLock: options.autoLock ?? 'never',
      state: 'provisioning',
      provisioningToken: createOpaqueStorageId(),
    }
  }

  /**
   * Provisions and verifies the physical DB before marking the registry entry
   * ready. A failed write leaves a discoverable provisioning entry.
   */
  async provisionStandardWorkspace(
    snapshot: WorkspaceData,
    options: ProvisionStandardWorkspaceOptions,
  ): Promise<WorkspaceRegistryEntry> {
    let requestedSnapshot = snapshot
    let proposed = this.makeEntry(snapshot, options)
    const existingRoute = await this.registry.getWorkspace(proposed.id)
    if (existingRoute) {
      if (existingRoute.encryptionMode !== 'standard') {
        throw new UnsupportedWorkspaceStorageError(existingRoute.encryptionMode)
      }
      if (existingRoute.kind !== options.kind || existingRoute.id !== snapshot.workspace.id) {
        throw new Error('The existing workspace route has another kind or identity.')
      }
      if (existingRoute.state === 'deleting') {
        throw new Error('A deleting workspace route cannot be reprovisioned.')
      }
      if (options.bootstrapSeed) {
        requestedSnapshot = bootstrapSnapshotForEntry(existingRoute)
      }
    }
    if (existingRoute?.encryptionMode === 'standard' && existingRoute.state === 'ready') {
      if (!(await standardWorkspaceDatabaseExists(existingRoute.storageId))) {
        throw new Error('Ready workspace registry entry has no physical database.')
      }
      const database = createStandardWorkspaceDatabase(existingRoute.storageId)
      const repository = new StandardWorkspaceRepository(database, existingRoute.id)
      try {
        const existing = await repository.getWorkspaceSnapshot()
        if (!existing || !workspaceSnapshotsEqual(requestedSnapshot, existing)) {
          throw new Error(
            'Ready workspace registry entry does not match the requested snapshot.',
          )
        }
        return existingRoute
      } finally {
        repository.close()
      }
    }
    if (
      existingRoute?.encryptionMode === 'standard' &&
      (existingRoute.state === 'provisioning' ||
        existingRoute.state === 'migration-failed')
    ) {
      if (await standardWorkspaceDatabaseExists(existingRoute.storageId)) {
        const database = createStandardWorkspaceDatabase(existingRoute.storageId)
        const repository = new StandardWorkspaceRepository(database, existingRoute.id)
        try {
          const existing = await repository.getWorkspaceSnapshot()
          if (existing) {
            if (!workspaceSnapshotsEqual(requestedSnapshot, existing)) {
              throw new Error(
                'Recoverable standard staging does not match the requested snapshot.',
              )
            }
            return await this.registry.markReady(
              existingRoute.id,
              existingRoute.registryRevision,
            )
          }
        } finally {
          repository.close()
        }
      }
      proposed = {
        ...proposed,
        storageId: existingRoute.storageId,
        createdAt: existingRoute.createdAt,
        updatedAt: existingRoute.updatedAt,
        registryRevision: existingRoute.registryRevision,
        provisioningToken: existingRoute.provisioningToken,
      }
    }
    if (
      !existingRoute &&
      (await standardWorkspaceDatabaseExists(proposed.storageId))
    ) {
      throw new Error('The proposed standard storage locator already exists.')
    }
    const entry = await this.registry.beginProvisioning(proposed)
    if (options.bootstrapSeed) {
      requestedSnapshot = bootstrapSnapshotForEntry(entry)
    }
    if (
      entry.provisioningToken !== proposed.provisioningToken &&
      !options.bootstrapSeed
    ) {
      throw new WorkspaceRegistryConflictError(
        entry.id,
        proposed.registryRevision,
        entry.registryRevision,
      )
    }
    if (entry.encryptionMode !== 'standard') {
      throw new UnsupportedWorkspaceStorageError(entry.encryptionMode)
    }

    if (entry.state === 'ready') {
      if (!(await standardWorkspaceDatabaseExists(entry.storageId))) {
        throw new Error('Ready workspace registry entry has no physical database.')
      }
      const database = createStandardWorkspaceDatabase(entry.storageId)
      const repository = new StandardWorkspaceRepository(database, entry.id)
      try {
        const existing = await repository.getWorkspaceSnapshot()
        if (!existing || !workspaceSnapshotsEqual(requestedSnapshot, existing)) {
          throw new Error('Ready workspace registry entry does not match the request.')
        }
        return entry
      } finally {
        repository.close()
      }
    }

    const database = createStandardWorkspaceDatabase(entry.storageId)
    const repository = new StandardWorkspaceRepository(database, entry.id)
    try {
      await repository.provisionWorkspace(requestedSnapshot)
      const readBack = await repository.getWorkspaceSnapshot()
      if (!readBack || !workspaceSnapshotsEqual(requestedSnapshot, readBack)) {
        throw new Error('Provisioned workspace failed read-back semantic verification.')
      }
      try {
        return await this.registry.markReady(entry.id, entry.registryRevision)
      } catch (error) {
        if (!(options.bootstrapSeed && error instanceof WorkspaceRegistryConflictError)) {
          throw error
        }
        const converged = await this.registry.getWorkspace(entry.id)
        const convergedSnapshot = await repository.getWorkspaceSnapshot()
        if (
          !converged ||
          converged.state !== 'ready' ||
          converged.storageId !== entry.storageId ||
          converged.kind !== entry.kind ||
          !convergedSnapshot ||
          !workspaceSnapshotsEqual(requestedSnapshot, convergedSnapshot)
        ) {
          throw error
        }
        return converged
      }
    } catch (error) {
      let physicalExists = true
      try {
        physicalExists = await standardWorkspaceDatabaseExists(entry.storageId)
      } catch {
        // Preserve the provisioning route when physical ownership is uncertain.
      }
      if (!physicalExists && proposed.provisioningToken) {
        await this.registry.abandonUnownedProvisioning(
          entry.id,
          entry.registryRevision,
          proposed.provisioningToken,
        ).catch(() => undefined)
      }
      throw error
    } finally {
      repository.close()
    }
  }

  async createPersonalWorkspace(
    displayName = DEFAULT_PERSONAL_WORKSPACE_NAME,
    now = new Date(),
  ): Promise<WorkspaceRegistryEntry> {
    const snapshot = createEmptyWorkspace({ name: displayName, now })
    return this.provisionStandardWorkspace(snapshot, {
      kind: 'personal',
      displayName: snapshot.workspace.name,
    })
  }

  async createDemoWorkspace(
    now = new Date(),
    workspaceId = DEMO_WORKSPACE_ID,
  ): Promise<WorkspaceRegistryEntry> {
    const snapshot = demoSnapshotForIdentity(workspaceId, now)
    return this.provisionStandardWorkspace(snapshot, {
      kind: 'demo',
      displayName: DEMO_WORKSPACE_DISPLAY_NAME,
    })
  }

  /**
   * Used only during the first registry bootstrap. Later user deletion does not
   * silently recreate workspaces because bootstrapVersion prevents re-entry.
   */
  async ensureInitialPersonalAndDemo(
    now = new Date(),
  ): Promise<{
    personal?: WorkspaceRegistryEntry
    demo?: WorkspaceRegistryEntry
  }> {
    const settings = await this.registry.getSettings()
    if (settings?.bootstrapVersion) {
      const ready = await this.registry.listWorkspaces()
      const personal = ready.find((entry) => entry.kind === 'personal')
      const demo = ready.find((entry) => entry.kind === 'demo')
      return { personal, demo }
    }

    const allEntries = await this.registry.listWorkspaces(true)
    let personal = allEntries.find(
      (entry) => entry.kind === 'personal' && entry.state !== 'deleting',
    )
    if (!personal) {
      const personalId = nextDeterministicPersonalId(allEntries)
      const snapshot = createEmptyWorkspace({
        id: personalId,
        name: DEFAULT_PERSONAL_WORKSPACE_NAME,
        now,
      })
      personal = await this.provisionStandardWorkspace(snapshot, {
        kind: 'personal',
        displayName: snapshot.workspace.name,
        storageId: deterministicInitialStorageId(
          this.registryDatabase.name,
          snapshot.workspace.id,
        ),
        bootstrapSeed: true,
      })
    } else if (personal.state !== 'ready') {
      const snapshot = createEmptyWorkspace({
        id: personal.id,
        name: personal.displayName,
        now: new Date(personal.createdAt),
      })
      personal = await this.provisionStandardWorkspace(snapshot, {
        kind: 'personal',
        displayName: personal.displayName,
        storageId: personal.storageId,
        autoLock: personal.autoLock,
        createdAt: personal.createdAt,
        bootstrapSeed: true,
      })
    }

    let demo = allEntries.find(
      (entry) => entry.kind === 'demo' && entry.state !== 'deleting',
    )
    if (!demo) {
      const latestEntries = await this.registry.listWorkspaces(true)
      demo = latestEntries.find(
        (entry) => entry.kind === 'demo' && entry.state !== 'deleting',
      )
      if (!demo) {
        const demoId = nextDeterministicDemoId(latestEntries)
        const snapshot = demoSnapshotForIdentity(demoId, now)
        demo = await this.provisionStandardWorkspace(snapshot, {
          kind: 'demo',
          displayName: DEMO_WORKSPACE_DISPLAY_NAME,
          storageId: deterministicInitialStorageId(this.registryDatabase.name, demoId),
          bootstrapSeed: true,
        })
      }
    }
    if (!demo) {
      throw new Error('Initial demo workspace provisioning did not acquire a route.')
    }
    if (demo.state !== 'ready') {
      const snapshot = demoSnapshotForIdentity(demo.id, new Date(demo.createdAt))
      demo = await this.provisionStandardWorkspace(snapshot, {
        kind: 'demo',
        displayName: demo.displayName,
        storageId: demo.storageId,
        autoLock: demo.autoLock,
        createdAt: demo.createdAt,
        bootstrapSeed: true,
      })
    }

    if (!personal || !demo) {
      throw new Error('Initial workspace provisioning did not produce both required entries.')
    }
    await this.registry.completeBootstrap(personal.id)
    return { personal, demo }
  }

  async openStandardWorkspace(id: string): Promise<OpenStandardWorkspace> {
    let entry = await this.registry.getWorkspace(id)
    if (!entry || entry.state !== 'ready') {
      throw new Error(`Workspace "${id}" is not ready.`)
    }
    if (entry.encryptionMode !== 'standard') {
      throw new UnsupportedWorkspaceStorageError(entry.encryptionMode)
    }
    if (!(await standardWorkspaceDatabaseExists(entry.storageId))) {
      throw new Error(`Workspace "${id}" has no physical database.`)
    }

    const database = createStandardWorkspaceDatabase(entry.storageId)
    const repository = new StandardWorkspaceRepository(database, entry.id)
    try {
      const snapshot = await repository.getWorkspaceSnapshot()
      if (!snapshot) throw new Error('Workspace registry entry has no physical snapshot.')
      try {
        entry = await this.registry.updateWorkspace(
          entry.id,
          entry.registryRevision,
          (current) => ({ ...current, lastOpenedAt: new Date().toISOString() }),
        )
      } catch (error) {
        if (!(error instanceof WorkspaceRegistryConflictError)) throw error
        entry = (await this.registry.getWorkspace(entry.id)) ?? entry
      }
      return {
        entry,
        snapshot,
        repository,
        close: () => repository.close(),
      }
    } catch (error) {
      repository.close()
      throw error
    }
  }

  async resetDemoWorkspace(id = DEMO_WORKSPACE_ID, now = new Date()): Promise<WorkspaceData> {
    const opened = await this.openStandardWorkspace(id)
    try {
      if (opened.entry.kind !== 'demo') {
        throw new Error('Demo reset is allowed only for a demo registry entry.')
      }
      const replacement = demoSnapshotForIdentity(opened.entry.id, now)
      await opened.repository.replaceWorkspace(
        replacement,
        opened.snapshot.workspace.revision,
      )
      const reset = await opened.repository.getWorkspaceSnapshot()
      if (!reset) throw new Error('Demo reset completed without a snapshot.')
      return reset
    } finally {
      opened.close()
    }
  }

  async deleteStandardWorkspace(id: string, expectedRevision: number): Promise<void> {
    const current = await this.registry.getWorkspace(id)
    if (current?.encryptedConversion) {
      throw new Error('Pending encrypted conversion must be resolved before deletion.')
    }
    await this.registry.deleteWorkspace(id, expectedRevision, async (entry) => {
      if (entry.encryptionMode !== 'standard') {
        throw new UnsupportedWorkspaceStorageError(entry.encryptionMode)
      }
      await deleteStandardWorkspaceDatabase(entry.storageId)
    }, async (entry) => !(await standardWorkspaceDatabaseExists(entry.storageId)))
  }

  async retryFinalizeStandardWorkspaceDeletion(id: string): Promise<void> {
    const entry = await this.registry.getWorkspace(id)
    if (!entry || entry.state !== 'deleting') {
      throw new Error('Workspace has no pending deletion tombstone.')
    }
    if (entry.encryptionMode !== 'standard') {
      throw new UnsupportedWorkspaceStorageError(entry.encryptionMode)
    }
    if (await standardWorkspaceDatabaseExists(entry.storageId)) {
      throw new Error('Workspace storage still exists; deletion cannot be finalized.')
    }
    await this.registry.finalizeWorkspaceDeletion(
      id,
      async (candidate) => !(await standardWorkspaceDatabaseExists(candidate.storageId)),
    )
  }

  close(): void {
    this.registry.close()
  }
}
