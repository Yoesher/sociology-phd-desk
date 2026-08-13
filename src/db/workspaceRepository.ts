import Dexie from 'dexie'
import { createDemoWorkspace } from '../models/demo'
import { WORKSPACE_APPLICATION, WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import type {
  Claim,
  ClaimQuestionLink,
  EntityMetadata,
  LiteratureItem,
  LiteratureExternalReference,
  ResearchProject,
  ResearchQuestion,
  TheoryMemo,
  WorkspaceData,
  WorkspaceMeta,
} from '../models/domain'
import { validateWorkspace, WorkspaceValidationError } from '../utils/workspace-transfer'
import {
  LEGACY_DATABASE_NAME,
  SociologyPhdDeskDatabase,
  createWorkspaceDatabase,
} from './database'

export const WORKSPACE_COLLECTIONS = [
  'projects',
  'researchQuestions',
  'claims',
  'claimQuestionLinks',
  'theoryMemos',
  'tasks',
  'literature',
  'literatureExternalReferences',
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

export type WorkspaceCollectionName = (typeof WORKSPACE_COLLECTIONS)[number]
export type WorkspaceMergeCounts = Record<WorkspaceCollectionName, number>

export interface MergeWorkspaceResult {
  /** Records newly added by the import. */
  added: WorkspaceMergeCounts
  /** Existing IDs retained rather than silently overwritten. */
  skipped: WorkspaceMergeCounts
  /** True when the current workspace settings were retained. */
  preservedWorkspace: boolean
}

/** Raised when a caller tries to commit a snapshot based on an older revision. */
export class WorkspaceConflictError extends Error {
  expectedRevision: number
  actualRevision: number | null

  constructor(expectedRevision: number, actualRevision: number | null) {
    super(
      actualRevision === null
        ? `Workspace revision conflict: expected ${expectedRevision}, but no workspace exists.`
        : `Workspace revision conflict: expected ${expectedRevision}, but found ${actualRevision}.`,
    )
    this.name = 'WorkspaceConflictError'
    this.expectedRevision = expectedRevision
    this.actualRevision = actualRevision
  }
}

/** Raised when a snapshot attempts to change the identity bound to its database. */
export class WorkspaceIdentityError extends Error {
  readonly expectedWorkspaceId: string
  readonly actualWorkspaceId: string

  constructor(expectedWorkspaceId: string, actualWorkspaceId: string) {
    super(
      `Workspace identity conflict: database belongs to "${expectedWorkspaceId}", not "${actualWorkspaceId}".`,
    )
    this.name = 'WorkspaceIdentityError'
    this.expectedWorkspaceId = expectedWorkspaceId
    this.actualWorkspaceId = actualWorkspaceId
  }
}

/** Raised for ambiguous or partial physical workspace databases. */
export class WorkspaceStorageInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceStorageInvariantError'
  }
}

/** Raised when a registry-bound physical database has disappeared. */
export class WorkspaceStorageMissingError extends WorkspaceStorageInvariantError {
  constructor() {
    super('The bound standard workspace database no longer exists.')
    this.name = 'WorkspaceStorageMissingError'
  }
}

function emptyMergeCounts(): WorkspaceMergeCounts {
  return {
    projects: 0,
    researchQuestions: 0,
    claims: 0,
    claimQuestionLinks: 0,
    theoryMemos: 0,
    tasks: 0,
    literature: 0,
    literatureExternalReferences: 0,
    fieldSites: 0,
    interviews: 0,
    fieldVisits: 0,
    datasets: 0,
    analysisRuns: 0,
    evidence: 0,
    researchLogs: 0,
    manuscripts: 0,
    submissions: 0,
    reviewerComments: 0,
  }
}

function snapshotCollectionCounts(snapshot: WorkspaceData): WorkspaceMergeCounts {
  return {
    projects: snapshot.projects.length,
    researchQuestions: snapshot.researchQuestions.length,
    claims: snapshot.claims.length,
    claimQuestionLinks: snapshot.claimQuestionLinks.length,
    theoryMemos: snapshot.theoryMemos.length,
    tasks: snapshot.tasks.length,
    literature: snapshot.literature.length,
    literatureExternalReferences: snapshot.literatureExternalReferences.length,
    fieldSites: snapshot.fieldSites.length,
    interviews: snapshot.interviews.length,
    fieldVisits: snapshot.fieldVisits.length,
    datasets: snapshot.datasets.length,
    analysisRuns: snapshot.analysisRuns.length,
    evidence: snapshot.evidence.length,
    researchLogs: snapshot.researchLogs.length,
    manuscripts: snapshot.manuscripts.length,
    submissions: snapshot.submissions.length,
    reviewerComments: snapshot.reviewerComments.length,
  }
}

function assertValidWorkspace(snapshot: unknown, operation: string): WorkspaceData {
  const result = validateWorkspace(snapshot)
  if (!result.success) {
    throw new WorkspaceValidationError(`The workspace failed ${operation} validation.`, result.issues)
  }
  return result.data
}

function mergeRecords<T extends EntityMetadata>(
  localRecords: T[],
  incomingRecords: T[],
): { records: T[]; added: number; skipped: number } {
  const localIds = new Set(localRecords.map((record) => record.id))
  const additions = incomingRecords.filter((record) => !localIds.has(record.id))
  return {
    records: [...localRecords, ...additions],
    added: additions.length,
    skipped: incomingRecords.length - additions.length,
  }
}

function graphIdentityIssues<T extends EntityMetadata>(
  collection:
    | 'researchQuestions'
    | 'claims'
    | 'claimQuestionLinks'
    | 'literature'
    | 'literatureExternalReferences'
    | 'theoryMemos',
  localRecords: T[],
  incomingRecords: T[],
  identity: (record: T) => string,
  shouldCheck: (record: T) => boolean = () => true,
): WorkspaceValidationError['issues'] {
  const localById = new Map(localRecords.map((record) => [record.id, record]))
  const issues: WorkspaceValidationError['issues'] = []
  incomingRecords.forEach((record, index) => {
    if (!shouldCheck(record)) return
    const local = localById.get(record.id)
    if (local && identity(local) !== identity(record)) {
      issues.push({
        path: [collection, index, 'id'],
        message: `ID "${record.id}" collides with a different local research-graph object.`,
      })
    }
  })
  return issues
}

/** Prevent imported relations from silently attaching to different local parents. */
function assertGraphMergeCollisionsSafe(
  current: WorkspaceData,
  incoming: WorkspaceData,
): void {
  const localProjectById = new Map(current.projects.map((project) => [project.id, project]))
  const localQuestionIds = new Set(current.researchQuestions.map((question) => question.id))
  const localClaimIds = new Set(current.claims.map((claim) => claim.id))
  const localLinkIds = new Set(current.claimQuestionLinks.map((link) => link.id))
  const localTheoryMemoIds = new Set(current.theoryMemos.map((memo) => memo.id))
  const localLiteratureIds = new Set(current.literature.map((item) => item.id))
  const incomingMemoLiteratureIds = new Set(
    incoming.theoryMemos.flatMap((memo) => memo.relatedLiteratureIds),
  )
  const projectIdentity = (project: ResearchProject) =>
    JSON.stringify([
      project.title,
      project.shortTitle,
      project.topic,
      project.method,
      project.startDate,
    ])
  const projectIssues: WorkspaceValidationError['issues'] = []
  incoming.projects.forEach((project, index) => {
    const local = localProjectById.get(project.id)
    if (!local || projectIdentity(local) === projectIdentity(project)) {
      return
    }
    const hasNewGraphChild =
      incoming.researchQuestions.some(
        (question) => question.projectId === project.id && !localQuestionIds.has(question.id),
      ) ||
      incoming.claims.some(
        (claim) => claim.projectId === project.id && !localClaimIds.has(claim.id),
      ) ||
      incoming.claimQuestionLinks.some(
        (link) => link.projectId === project.id && !localLinkIds.has(link.id),
      ) ||
      incoming.theoryMemos.some(
        (memo) => memo.projectId === project.id && !localTheoryMemoIds.has(memo.id),
      ) ||
      incoming.literature.some(
        (item) => item.projectId === project.id && !localLiteratureIds.has(item.id),
      )
    if (hasNewGraphChild) {
      projectIssues.push({
        path: ['projects', index, 'id'],
        message: `Project ID "${project.id}" collides with a different local project while adding research-graph children.`,
      })
    }
  })

  const issues = [
    ...projectIssues,
    ...graphIdentityIssues<ResearchQuestion>(
      'researchQuestions',
      current.researchQuestions,
      incoming.researchQuestions,
      (question) => JSON.stringify([question.projectId, question.text]),
    ),
    ...graphIdentityIssues<Claim>(
      'claims',
      current.claims,
      incoming.claims,
      (claim) => JSON.stringify([claim.projectId, claim.text]),
    ),
    ...graphIdentityIssues<ClaimQuestionLink>(
      'claimQuestionLinks',
      current.claimQuestionLinks,
      incoming.claimQuestionLinks,
      (link) => JSON.stringify([link.projectId, link.claimId, link.researchQuestionId]),
    ),
    ...graphIdentityIssues<LiteratureItem>(
      'literature',
      current.literature,
      incoming.literature,
      (item) =>
        JSON.stringify([
          item.projectId,
          item.title,
          item.authors,
          item.year,
          item.journal,
          item.doi,
          item.url,
        ]),
      (item) => incomingMemoLiteratureIds.has(item.id),
    ),
    ...graphIdentityIssues<TheoryMemo>(
      'theoryMemos',
      current.theoryMemos,
      incoming.theoryMemos,
      (memo) =>
        JSON.stringify([
          memo.projectId,
          memo.memoType,
          memo.title,
          memo.content,
          [...memo.relatedQuestionIds].sort(),
          [...memo.relatedClaimIds].sort(),
          [...memo.relatedLiteratureIds].sort(),
        ]),
    ),
    ...graphIdentityIssues<LiteratureExternalReference>(
      'literatureExternalReferences',
      current.literatureExternalReferences,
      incoming.literatureExternalReferences,
      (reference) => JSON.stringify([
        reference.literatureItemId,
        reference.provider,
        reference.externalLibraryId,
        reference.externalItemKey,
        reference.externalVersion,
      ]),
    ),
  ]
  if (issues.length > 0) {
    throw new WorkspaceValidationError(
      'The workspace merge contains conflicting research-graph IDs.',
      issues,
    )
  }
}

function canonicalizeWorkspaceValue(value: unknown, topLevel = false): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => canonicalizeWorkspaceValue(item))
    if (
      normalized.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          !Array.isArray(item) &&
          typeof (item as Record<string, unknown>)['id'] === 'string',
      )
    ) {
      return [...normalized].sort((left, right) =>
        String((left as Record<string, unknown>)['id']).localeCompare(
          String((right as Record<string, unknown>)['id']),
        ),
      )
    }
    return normalized
  }
  if (typeof value !== 'object' || value === null) return value

  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => !(topLevel && key === 'exportedAt'))
      .sort()
      .map((key) => [key, canonicalizeWorkspaceValue(record[key])]),
  )
}

/** In-memory semantic comparison; no content-derived digest is persisted. */
export function workspaceSnapshotsEqual(left: WorkspaceData, right: WorkspaceData): boolean {
  return (
    JSON.stringify(canonicalizeWorkspaceValue(left, true)) ===
    JSON.stringify(canonicalizeWorkspaceValue(right, true))
  )
}

export interface BuiltWorkspaceMerge {
  snapshot: WorkspaceData
  result: MergeWorkspaceResult
}

/**
 * Shared in-memory merge contract for standard and encrypted repositories.
 * It performs the same identity, graph-collision, and whole-snapshot checks
 * before any adapter is allowed to persist the result.
 */
export function buildMergedWorkspace(
  currentInput: WorkspaceData,
  incomingInput: WorkspaceData,
  now = new Date(),
): BuiltWorkspaceMerge {
  const current = assertValidWorkspace(currentInput, 'merge current input')
  const incoming = assertValidWorkspace(incomingInput, 'merge incoming input')
  if (current.workspace.id !== incoming.workspace.id) {
    throw new WorkspaceIdentityError(current.workspace.id, incoming.workspace.id)
  }
  assertGraphMergeCollisionsSafe(current, incoming)

  const projects = mergeRecords(current.projects, incoming.projects)
  const researchQuestions = mergeRecords(current.researchQuestions, incoming.researchQuestions)
  const claims = mergeRecords(current.claims, incoming.claims)
  const claimQuestionLinks = mergeRecords(
    current.claimQuestionLinks,
    incoming.claimQuestionLinks,
  )
  const theoryMemos = mergeRecords(current.theoryMemos, incoming.theoryMemos)
  const tasks = mergeRecords(current.tasks, incoming.tasks)
  const literature = mergeRecords(current.literature, incoming.literature)
  const literatureExternalReferences = mergeRecords(
    current.literatureExternalReferences,
    incoming.literatureExternalReferences,
  )
  const fieldSites = mergeRecords(current.fieldSites, incoming.fieldSites)
  const interviews = mergeRecords(current.interviews, incoming.interviews)
  const fieldVisits = mergeRecords(current.fieldVisits, incoming.fieldVisits)
  const datasets = mergeRecords(current.datasets, incoming.datasets)
  const analysisRuns = mergeRecords(current.analysisRuns, incoming.analysisRuns)
  const evidence = mergeRecords(current.evidence, incoming.evidence)
  const researchLogs = mergeRecords(current.researchLogs, incoming.researchLogs)
  const manuscripts = mergeRecords(current.manuscripts, incoming.manuscripts)
  const submissions = mergeRecords(current.submissions, incoming.submissions)
  const reviewerComments = mergeRecords(
    current.reviewerComments,
    incoming.reviewerComments,
  )
  const timestamp = now.toISOString()

  const snapshot = assertValidWorkspace(
    {
      application: WORKSPACE_APPLICATION,
      version: WORKSPACE_SCHEMA_VERSION,
      exportedAt: timestamp,
      workspace: {
        ...current.workspace,
        revision: current.workspace.revision + 1,
        updatedAt: timestamp,
      },
      projects: projects.records,
      researchQuestions: researchQuestions.records,
      claims: claims.records,
      claimQuestionLinks: claimQuestionLinks.records,
      theoryMemos: theoryMemos.records,
      tasks: tasks.records,
      literature: literature.records,
      literatureExternalReferences: literatureExternalReferences.records,
      fieldSites: fieldSites.records,
      interviews: interviews.records,
      fieldVisits: fieldVisits.records,
      datasets: datasets.records,
      analysisRuns: analysisRuns.records,
      evidence: evidence.records,
      researchLogs: researchLogs.records,
      manuscripts: manuscripts.records,
      submissions: submissions.records,
      reviewerComments: reviewerComments.records,
    },
    'merged result',
  )

  return {
    snapshot,
    result: {
      added: {
        projects: projects.added,
        researchQuestions: researchQuestions.added,
        claims: claims.added,
        claimQuestionLinks: claimQuestionLinks.added,
        theoryMemos: theoryMemos.added,
        tasks: tasks.added,
        literature: literature.added,
        literatureExternalReferences: literatureExternalReferences.added,
        fieldSites: fieldSites.added,
        interviews: interviews.added,
        fieldVisits: fieldVisits.added,
        datasets: datasets.added,
        analysisRuns: analysisRuns.added,
        evidence: evidence.added,
        researchLogs: researchLogs.added,
        manuscripts: manuscripts.added,
        submissions: submissions.added,
        reviewerComments: reviewerComments.added,
      },
      skipped: {
        projects: projects.skipped,
        researchQuestions: researchQuestions.skipped,
        claims: claims.skipped,
        claimQuestionLinks: claimQuestionLinks.skipped,
        theoryMemos: theoryMemos.skipped,
        tasks: tasks.skipped,
        literature: literature.skipped,
        literatureExternalReferences: literatureExternalReferences.skipped,
        fieldSites: fieldSites.skipped,
        interviews: interviews.skipped,
        fieldVisits: fieldVisits.skipped,
        datasets: datasets.skipped,
        analysisRuns: analysisRuns.skipped,
        evidence: evidence.skipped,
        researchLogs: researchLogs.skipped,
        manuscripts: manuscripts.skipped,
        submissions: submissions.skipped,
        reviewerComments: reviewerComments.skipped,
      },
      preservedWorkspace: true,
    },
  }
}

/**
 * A repository is permanently bound to one physical IndexedDB. For registry
 * workspaces, `workspaceId` further prevents replacing the identity routed to
 * that database.
 */
export class StandardWorkspaceRepository {
  readonly database: SociologyPhdDeskDatabase
  readonly workspaceId?: string
  private closed = false

  constructor(
    database: SociologyPhdDeskDatabase,
    workspaceId?: string,
  ) {
    this.database = database
    this.workspaceId = workspaceId
  }

  private get allTables() {
    return this.database.tables
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new WorkspaceStorageInvariantError(
        'The standard workspace repository is closed.',
      )
    }
  }

  private async assertBoundStorageExists(): Promise<void> {
    if (this.workspaceId && !(await Dexie.exists(this.database.name))) {
      this.database.close({ disableAutoOpen: true })
      this.closed = true
      throw new WorkspaceStorageMissingError()
    }
  }

  private assertIdentity(workspaceId: string, existingWorkspaceId?: string): void {
    const expected = this.workspaceId ?? existingWorkspaceId
    if (expected && expected !== workspaceId) {
      throw new WorkspaceIdentityError(expected, workspaceId)
    }
  }

  private async clearAllTables(): Promise<void> {
    await Promise.all(this.allTables.map((table) => table.clear()))
  }

  private async hasOrphanRows(): Promise<boolean> {
    for (const table of this.allTables) {
      if (table.name !== 'workspaces' && (await table.count()) > 0) return true
    }
    return false
  }

  private async writeSnapshot(snapshot: WorkspaceData): Promise<void> {
    await this.database.workspaces.put(snapshot.workspace)
    await Promise.all([
      this.database.projects.bulkPut(snapshot.projects),
      this.database.researchQuestions.bulkPut(snapshot.researchQuestions),
      this.database.claims.bulkPut(snapshot.claims),
      this.database.claimQuestionLinks.bulkPut(snapshot.claimQuestionLinks),
      this.database.theoryMemos.bulkPut(snapshot.theoryMemos),
      this.database.tasks.bulkPut(snapshot.tasks),
      this.database.literature.bulkPut(snapshot.literature),
      this.database.literatureExternalReferences.bulkPut(snapshot.literatureExternalReferences),
      this.database.fieldSites.bulkPut(snapshot.fieldSites),
      this.database.interviews.bulkPut(snapshot.interviews),
      this.database.fieldVisits.bulkPut(snapshot.fieldVisits),
      this.database.datasets.bulkPut(snapshot.datasets),
      this.database.analysisRuns.bulkPut(snapshot.analysisRuns),
      this.database.evidence.bulkPut(snapshot.evidence),
      this.database.researchLogs.bulkPut(snapshot.researchLogs),
      this.database.manuscripts.bulkPut(snapshot.manuscripts),
      this.database.submissions.bulkPut(snapshot.submissions),
      this.database.reviewerComments.bulkPut(snapshot.reviewerComments),
    ])
  }

  private async readWorkspaceSnapshot(): Promise<WorkspaceData | null> {
    const workspaces = await this.database.workspaces.toArray()
    if (workspaces.length === 0) return null
    if (workspaces.length !== 1) {
      throw new WorkspaceStorageInvariantError(
        `Physical workspace database contains ${workspaces.length} workspace metadata rows.`,
      )
    }
    const workspace = workspaces[0] as WorkspaceMeta
    this.assertIdentity(workspace.id)

    const [
      projects,
      researchQuestions,
      claims,
      claimQuestionLinks,
      theoryMemos,
      tasks,
      literature,
      literatureExternalReferences,
      fieldSites,
      interviews,
      fieldVisits,
      datasets,
      analysisRuns,
      evidence,
      researchLogs,
      manuscripts,
      submissions,
      reviewerComments,
    ] = await Promise.all([
      this.database.projects.toArray(),
      this.database.researchQuestions.toArray(),
      this.database.claims.toArray(),
      this.database.claimQuestionLinks.toArray(),
      this.database.theoryMemos.toArray(),
      this.database.tasks.toArray(),
      this.database.literature.toArray(),
      this.database.literatureExternalReferences.toArray(),
      this.database.fieldSites.toArray(),
      this.database.interviews.toArray(),
      this.database.fieldVisits.toArray(),
      this.database.datasets.toArray(),
      this.database.analysisRuns.toArray(),
      this.database.evidence.toArray(),
      this.database.researchLogs.toArray(),
      this.database.manuscripts.toArray(),
      this.database.submissions.toArray(),
      this.database.reviewerComments.toArray(),
    ])

    return assertValidWorkspace(
      {
        application: WORKSPACE_APPLICATION,
        version: WORKSPACE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        workspace,
        projects,
        researchQuestions,
        claims,
        claimQuestionLinks,
        theoryMemos,
        tasks,
        literature,
        literatureExternalReferences,
        fieldSites,
        interviews,
        fieldVisits,
        datasets,
        analysisRuns,
        evidence,
        researchLogs,
        manuscripts,
        submissions,
        reviewerComments,
      },
      'stored snapshot',
    )
  }

  /** Seeds only a truly empty physical database; suspicious orphan rows stop initialization. */
  async initializeWorkspace(initialWorkspace: WorkspaceData): Promise<WorkspaceData> {
    this.assertOpen()
    const validatedInitialWorkspace = assertValidWorkspace(
      initialWorkspace,
      'initialization',
    )

    await this.database.transaction('rw', this.allTables, async () => {
      const existing = await this.database.workspaces.toArray()
      if (existing.length > 1) {
        throw new WorkspaceStorageInvariantError(
          'Cannot initialize a database with multiple workspace metadata rows.',
        )
      }
      if (existing.length === 1) {
        this.assertIdentity((existing[0] as WorkspaceMeta).id)
        return
      }
      if (await this.hasOrphanRows()) {
        throw new WorkspaceStorageInvariantError(
          'Cannot initialize a database containing orphan research records.',
        )
      }
      this.assertIdentity(validatedInitialWorkspace.workspace.id)
      await this.writeSnapshot(validatedInitialWorkspace)
    })

    const snapshot = await this.getWorkspaceSnapshot()
    if (!snapshot) {
      throw new Error('Workspace initialization completed without a workspace record.')
    }
    return snapshot
  }

  /**
   * Writes an exact snapshot into a migration/provisioning target. Callers must
   * ensure the target is unpublished; normal user changes use replaceWorkspace.
   */
  async provisionWorkspace(snapshot: WorkspaceData): Promise<void> {
    this.assertOpen()
    const validated = assertValidWorkspace(snapshot, 'provisioning input')
    this.assertIdentity(validated.workspace.id)
    await this.database.transaction('rw', this.allTables, async () => {
      const existing = await this.database.workspaces.toArray()
      if (existing.length > 1) {
        throw new WorkspaceStorageInvariantError(
          'Cannot provision a database with multiple workspace metadata rows.',
        )
      }
      if (existing.length === 1) {
        if (!this.workspaceId) {
          throw new WorkspaceStorageInvariantError(
            'Reprovisioning an existing database requires an explicit workspace binding.',
          )
        }
        const existingWorkspace = existing[0] as WorkspaceMeta
        this.assertIdentity(existingWorkspace.id)
        this.assertIdentity(validated.workspace.id, existingWorkspace.id)
      } else if (await this.hasOrphanRows()) {
        throw new WorkspaceStorageInvariantError(
          'Cannot provision a database containing orphan research records.',
        )
      }
      await this.clearAllTables()
      await this.writeSnapshot(validated)
    })
  }

  /** Returns a coherent point-in-time snapshot, or null before provisioning. */
  async getWorkspaceSnapshot(): Promise<WorkspaceData | null> {
    this.assertOpen()
    await this.assertBoundStorageExists()
    return this.database.transaction('r', this.allTables, () =>
      this.readWorkspaceSnapshot(),
    )
  }

  /** Atomically replaces this database only; workspace identity cannot change. */
  async replaceWorkspace(snapshot: WorkspaceData, expectedRevision?: number): Promise<void> {
    this.assertOpen()
    await this.assertBoundStorageExists()
    const validatedSnapshot = assertValidWorkspace(snapshot, 'replacement input')

    await this.database.transaction('rw', this.allTables, async () => {
      const currentWorkspaces = await this.database.workspaces.toArray()
      if (currentWorkspaces.length > 1) {
        throw new WorkspaceStorageInvariantError(
          'Cannot replace a database with multiple workspace metadata rows.',
        )
      }
      const currentWorkspace = currentWorkspaces[0] as WorkspaceMeta | undefined
      const actualRevision = currentWorkspace?.revision ?? null
      this.assertIdentity(validatedSnapshot.workspace.id, currentWorkspace?.id)

      if (this.workspaceId && !currentWorkspace) {
        throw new WorkspaceStorageInvariantError(
          'A bound workspace repository cannot recreate missing storage through replacement.',
        )
      }

      if (expectedRevision !== undefined && expectedRevision !== actualRevision) {
        throw new WorkspaceConflictError(expectedRevision, actualRevision)
      }

      const prospectiveSnapshot = assertValidWorkspace(
        {
          ...validatedSnapshot,
          workspace: {
            ...validatedSnapshot.workspace,
            revision:
              currentWorkspace === undefined
                ? validatedSnapshot.workspace.revision
                : currentWorkspace.revision + 1,
          },
        },
        'replacement commit',
      )

      await this.clearAllTables()
      await this.writeSnapshot(prospectiveSnapshot)
    })
  }

  /** Builds and validates a complete prospective merge inside this database. */
  async mergeWorkspace(snapshot: WorkspaceData): Promise<MergeWorkspaceResult> {
    this.assertOpen()
    await this.assertBoundStorageExists()
    const validatedIncoming = assertValidWorkspace(snapshot, 'merge input')

    return this.database.transaction('rw', this.allTables, async () => {
      const current = await this.readWorkspaceSnapshot()
      if (!current) {
        if (this.workspaceId) {
          throw new WorkspaceStorageInvariantError(
            'A bound workspace repository cannot recreate missing storage through merge.',
          )
        }
        this.assertIdentity(validatedIncoming.workspace.id)
        const prospectiveSnapshot = assertValidWorkspace(
          {
            ...validatedIncoming,
            workspace: { ...validatedIncoming.workspace, revision: 0 },
          },
          'merge commit',
        )
        await this.clearAllTables()
        await this.writeSnapshot(prospectiveSnapshot)
        return {
          added: snapshotCollectionCounts(prospectiveSnapshot),
          skipped: emptyMergeCounts(),
          preservedWorkspace: false,
        }
      }

      const merged = buildMergedWorkspace(current, validatedIncoming)
      await this.clearAllTables()
      await this.writeSnapshot(merged.snapshot)

      return merged.result
    })
  }

  /** Clears only this physical workspace database. Registry deletion is separate. */
  async clearWorkspace(): Promise<void> {
    this.assertOpen()
    await this.assertBoundStorageExists()
    await this.database.transaction('rw', this.allTables, () => this.clearAllTables())
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.database.close()
  }
}

async function withLegacyRepository<T>(
  operation: (repository: StandardWorkspaceRepository) => Promise<T>,
): Promise<T> {
  const database = createWorkspaceDatabase(LEGACY_DATABASE_NAME)
  const repository = new StandardWorkspaceRepository(database)
  try {
    return await operation(repository)
  } finally {
    repository.close()
  }
}

/** Legacy singleton facade retained while the application shell adopts the registry. */
export async function initializeWorkspace(
  initialWorkspace: WorkspaceData = createDemoWorkspace(),
): Promise<WorkspaceData> {
  return withLegacyRepository((repository) =>
    repository.initializeWorkspace(initialWorkspace),
  )
}

export async function getWorkspaceSnapshot(): Promise<WorkspaceData | null> {
  return withLegacyRepository((repository) => repository.getWorkspaceSnapshot())
}

export async function replaceWorkspace(
  snapshot: WorkspaceData,
  expectedRevision?: number,
): Promise<void> {
  return withLegacyRepository((repository) =>
    repository.replaceWorkspace(snapshot, expectedRevision),
  )
}

export async function mergeWorkspace(snapshot: WorkspaceData): Promise<MergeWorkspaceResult> {
  return withLegacyRepository((repository) => repository.mergeWorkspace(snapshot))
}

export async function clearWorkspace(): Promise<void> {
  return withLegacyRepository((repository) => repository.clearWorkspace())
}
