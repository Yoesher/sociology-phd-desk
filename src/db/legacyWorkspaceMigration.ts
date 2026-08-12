import Dexie from 'dexie'
import { isPristineDemoWorkspace } from '../models/demo'
import { createOpaqueStorageId, type WorkspaceRegistryEntry } from '../models/workspace-registry'
import { WORKSPACE_APPLICATION, type WorkspaceData } from '../models/domain'
import { validateWorkspace, WorkspaceValidationError } from '../utils/workspace-transfer'
import { LEGACY_DATABASE_NAME } from './database'
import {
  WorkspaceRegistryRepository,
  type WorkspaceRegistryDatabase,
} from './registryDatabase'
import {
  STANDARD_WORKSPACE_STORAGE_SCHEMA_VERSION,
  createStandardWorkspaceDatabase,
  standardWorkspaceDatabaseExists,
} from './standardWorkspaceDatabase'
import {
  StandardWorkspaceRepository,
  workspaceSnapshotsEqual,
} from './workspaceRepository'
import { WorkspaceRepositoryFactory } from './workspaceRepositoryFactory'

const legacyCollections = [
  'projects',
  'researchQuestions',
  'claims',
  'claimQuestionLinks',
  'tasks',
  'literature',
  'fieldSites',
  'interviews',
  'fieldVisits',
  'datasets',
  'analysisRuns',
  'evidence',
  'researchLogs',
  'manuscripts',
  'submissions',
  'reviewerComments',
] as const

export type LegacyWorkspaceProbe =
  | { status: 'absent' }
  | { status: 'empty'; databaseVersion: number }
  | {
      status: 'workspace'
      databaseVersion: number
      snapshot: WorkspaceData
    }

export class LegacyWorkspaceMigrationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'LegacyWorkspaceMigrationError'
    this.code = code
  }
}

export interface LegacyMigrationHooks {
  /** Test/recovery hook used to model a legacy writer racing the copy. */
  afterTargetVerified?: () => Promise<void>
  /** Test seam for deterministic physical-locator collision coverage. */
  targetStorageIdFactory?: () => string
}

export interface LegacyMigrationResult {
  status:
    | 'absent'
    | 'empty'
    | 'migrated'
    | 'already-migrated'
    | 'diverged-after-migration'
  entry?: WorkspaceRegistryEntry
}

function tableOrUndefined(database: Dexie, name: string) {
  return database.tables.find((table) => table.name === name)
}

/**
 * Opens an existing legacy database in dynamic/read-only mode. No schema is
 * declared, so probing cannot trigger the v1/v2-to-v3 Dexie upgrade.
 */
export async function readLegacySingleton(
  databaseName: string = LEGACY_DATABASE_NAME,
): Promise<LegacyWorkspaceProbe> {
  if (!(await Dexie.exists(databaseName))) return { status: 'absent' }

  const database = new Dexie(databaseName)
  try {
    await database.open()
    const databaseVersion = database.verno
    if (![1, 2, 3].includes(databaseVersion)) {
      throw new LegacyWorkspaceMigrationError(
        'unsupported-version',
        `Legacy database version ${databaseVersion} is not supported.`,
      )
    }

    return await database.transaction('r', database.tables, async () => {
      const workspaceTable = tableOrUndefined(database, 'workspaces')
      const workspaceRows = workspaceTable ? await workspaceTable.toArray() : []
      const nonWorkspaceRows = await Promise.all(
        database.tables
          .filter((table) => table.name !== 'workspaces')
          .map((table) => table.count()),
      )
      const hasResearchRows = nonWorkspaceRows.some((count) => count > 0)

      if (workspaceRows.length === 0) {
        if (hasResearchRows) {
          throw new LegacyWorkspaceMigrationError(
            'orphan-records',
            'Legacy database has research records but no workspace metadata.',
          )
        }
        return { status: 'empty', databaseVersion }
      }
      if (workspaceRows.length !== 1) {
        throw new LegacyWorkspaceMigrationError(
          'multiple-workspace-meta',
          'Legacy singleton database contains multiple workspace metadata rows.',
        )
      }

      const collections = Object.fromEntries(
        await Promise.all(
          legacyCollections.map(async (name) => [
            name,
            (await tableOrUndefined(database, name)?.toArray()) ?? [],
          ]),
        ),
      ) as Record<(typeof legacyCollections)[number], unknown[]>

      const legacyGraphCollections =
        databaseVersion === 3
          ? {
              researchQuestions: collections.researchQuestions,
              claims: collections.claims,
              claimQuestionLinks: collections.claimQuestionLinks,
            }
          : {}
      const input: Record<string, unknown> = {
        ...(databaseVersion === 1 ? {} : { application: WORKSPACE_APPLICATION }),
        version: databaseVersion,
        exportedAt: new Date().toISOString(),
        workspace: workspaceRows[0],
        projects: collections.projects,
        tasks: collections.tasks,
        literature: collections.literature,
        fieldSites: collections.fieldSites,
        interviews: collections.interviews,
        fieldVisits: collections.fieldVisits,
        datasets: collections.datasets,
        analysisRuns: collections.analysisRuns,
        evidence: collections.evidence,
        researchLogs: collections.researchLogs,
        manuscripts: collections.manuscripts,
        submissions: collections.submissions,
        reviewerComments: collections.reviewerComments,
        ...legacyGraphCollections,
      }
      const validation = validateWorkspace(input)
      if (!validation.success) {
        throw new WorkspaceValidationError(
          'Legacy singleton failed non-destructive migration validation.',
          validation.issues,
        )
      }
      return {
        status: 'workspace',
        databaseVersion,
        snapshot: validation.data,
      }
    })
  } finally {
    database.close()
  }
}

export function legacyMigrationId(databaseName: string, workspaceId: string): string {
  return `legacy:${encodeURIComponent(databaseName)}:${encodeURIComponent(workspaceId)}`
}

function migrationErrorCode(error: unknown): string {
  if (error instanceof LegacyWorkspaceMigrationError) return error.code
  if (error instanceof WorkspaceValidationError) return 'legacy-validation-failed'
  return 'copy-or-verification-failed'
}

/**
 * Copy -> durable target -> read-back -> source re-read -> registry publish.
 * The source database is never modified or deleted.
 */
export async function migrateLegacySingleton(
  registryDatabase: WorkspaceRegistryDatabase,
  options: {
    legacyDatabaseName?: string
    hooks?: LegacyMigrationHooks
  } = {},
): Promise<LegacyMigrationResult> {
  const legacyDatabaseName = options.legacyDatabaseName ?? LEGACY_DATABASE_NAME
  const source = await readLegacySingleton(legacyDatabaseName)
  if (source.status === 'absent' || source.status === 'empty') {
    return { status: source.status }
  }

  const registry = new WorkspaceRegistryRepository(registryDatabase)
  const migrationId = legacyMigrationId(legacyDatabaseName, source.snapshot.workspace.id)
  const priorLedger = await registry.getMigration(migrationId)

  if (priorLedger?.status === 'verified') {
    const entry = await registry.getWorkspace(priorLedger.targetWorkspaceId)
    if (!entry || entry.storageId !== priorLedger.targetStorageId || entry.state !== 'ready') {
      throw new LegacyWorkspaceMigrationError(
        'verified-target-missing',
        'Verified legacy migration has no matching ready registry entry.',
      )
    }
    if (!(await standardWorkspaceDatabaseExists(entry.storageId))) {
      throw new LegacyWorkspaceMigrationError(
        'verified-target-missing',
        'Verified legacy migration target has no physical database.',
      )
    }
    const targetDatabase = createStandardWorkspaceDatabase(entry.storageId)
    const targetRepository = new StandardWorkspaceRepository(targetDatabase, entry.id)
    try {
      const target = await targetRepository.getWorkspaceSnapshot()
      if (!target || !workspaceSnapshotsEqual(source.snapshot, target)) {
        await registry.noteVerifiedMigrationDivergence(migrationId)
        return { status: 'diverged-after-migration', entry }
      }
      return { status: 'already-migrated', entry }
    } finally {
      targetRepository.close()
    }
  }

  const targetStorageId =
    priorLedger?.targetStorageId ??
    options.hooks?.targetStorageIdFactory?.() ??
    createOpaqueStorageId()
  const storageClaim = (await registry.listWorkspaces(true)).find(
    (entry) =>
      entry.storageId === targetStorageId ||
      entry.plaintextSources?.some(
        (source) => source.sourceStorageId === targetStorageId,
      ),
  )
  if (storageClaim) {
    throw new LegacyWorkspaceMigrationError(
      'target-storage-claimed',
      'The legacy migration target is already routed to another registry entry.',
    )
  }
  if (!priorLedger && (await standardWorkspaceDatabaseExists(targetStorageId))) {
    throw new LegacyWorkspaceMigrationError(
      'target-storage-exists',
      'The proposed legacy migration target already exists physically.',
    )
  }
  const timestamp = new Date().toISOString()
  const ledger = await registry.recordMigrationStart({
    id: migrationId,
    sourceDatabaseName: legacyDatabaseName,
    sourceDatabaseVersion: source.databaseVersion,
    sourceWorkspaceId: source.snapshot.workspace.id,
    sourceRevision: source.snapshot.workspace.revision,
    targetWorkspaceId: source.snapshot.workspace.id,
    targetStorageId,
    status: 'copying',
    createdAt: priorLedger?.createdAt ?? timestamp,
    updatedAt: timestamp,
  })

  const targetDatabase = createStandardWorkspaceDatabase(ledger.targetStorageId)
  const targetRepository = new StandardWorkspaceRepository(
    targetDatabase,
    ledger.targetWorkspaceId,
  )
  try {
    // The durable ledger is the ownership claim. initializeWorkspace never
    // clears an existing database, even when an unrelated database happens to
    // contain the same logical workspace ID.
    await targetRepository.initializeWorkspace(source.snapshot)
    const readBack = await targetRepository.getWorkspaceSnapshot()
    if (!readBack || !workspaceSnapshotsEqual(source.snapshot, readBack)) {
      throw new LegacyWorkspaceMigrationError(
        'target-readback-mismatch',
        'Legacy copy failed target read-back semantic verification.',
      )
    }

    await options.hooks?.afterTargetVerified?.()
    const confirmedSource = await readLegacySingleton(legacyDatabaseName)
    if (
      confirmedSource.status !== 'workspace' ||
      confirmedSource.snapshot.workspace.id !== source.snapshot.workspace.id ||
      confirmedSource.snapshot.workspace.revision !== source.snapshot.workspace.revision ||
      !workspaceSnapshotsEqual(confirmedSource.snapshot, source.snapshot)
    ) {
      throw new LegacyWorkspaceMigrationError(
        'source-changed-during-copy',
        'Legacy source changed while it was being copied; registry publication was cancelled.',
      )
    }

    const kind = isPristineDemoWorkspace(source.snapshot) ? 'demo' : 'personal'
    const verifiedAt = new Date().toISOString()
    const entry: WorkspaceRegistryEntry = {
      id: source.snapshot.workspace.id,
      storageId: ledger.targetStorageId,
      displayName: source.snapshot.workspace.name,
      kind,
      encryptionMode: 'standard',
      createdAt: source.snapshot.workspace.createdAt,
      updatedAt: verifiedAt,
      lastOpenedAt: verifiedAt,
      schemaVersion: source.snapshot.version,
      storageSchemaVersion: STANDARD_WORKSPACE_STORAGE_SCHEMA_VERSION,
      registryRevision: 0,
      autoLock: 'never',
      state: 'ready',
      legacyMigrationKey: migrationId,
      plaintextSources: [
        {
          id: `legacy:${encodeURIComponent(legacyDatabaseName)}`,
          kind: 'legacy',
          sourceDatabaseName: legacyDatabaseName,
          state: 'retained',
          verifiedAt,
        },
      ],
    }
    const published = await registry.publishVerifiedMigration(entry, migrationId)
    return { status: 'migrated', entry: published }
  } catch (error) {
    await registry.markMigrationFailed(migrationId, migrationErrorCode(error))
    throw error
  } finally {
    targetRepository.close()
  }
}

export interface LocalWorkspaceBootstrapResult {
  migration: LegacyMigrationResult
  personal?: WorkspaceRegistryEntry
  demo?: WorkspaceRegistryEntry
}

/** Runs once per registry generation; anomalies block fresh seeding. */
export async function bootstrapLocalWorkspaceFoundation(
  registryDatabase: WorkspaceRegistryDatabase,
  options: {
    legacyDatabaseName?: string
    now?: Date
    hooks?: LegacyMigrationHooks
  } = {},
): Promise<LocalWorkspaceBootstrapResult> {
  const factory = new WorkspaceRepositoryFactory(registryDatabase)
  const settings = await factory.registry.getSettings()
  if (settings?.bootstrapVersion) {
    const ready = await factory.registry.listWorkspaces()
    const personal = ready.find((entry) => entry.kind === 'personal')
    const demo = ready.find((entry) => entry.kind === 'demo')
    return { migration: { status: 'already-migrated' }, personal, demo }
  }

  const migration = await migrateLegacySingleton(registryDatabase, {
    legacyDatabaseName: options.legacyDatabaseName,
    hooks: options.hooks,
  })
  const { personal, demo } = await factory.ensureInitialPersonalAndDemo(
    options.now ?? new Date(),
  )
  return { migration, personal, demo }
}
