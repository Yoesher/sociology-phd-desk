import { db } from './database'
import { createDemoWorkspace } from '../models/demo'
import { WORKSPACE_APPLICATION, WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import type {
  Claim,
  ClaimQuestionLink,
  EntityMetadata,
  ResearchProject,
  ResearchQuestion,
  WorkspaceData,
} from '../models/domain'
import { validateWorkspace, WorkspaceValidationError } from '../utils/workspace-transfer'

export const WORKSPACE_COLLECTIONS = [
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

const allTables = [
  db.workspaces,
  db.projects,
  db.researchQuestions,
  db.claims,
  db.claimQuestionLinks,
  db.tasks,
  db.literature,
  db.fieldSites,
  db.interviews,
  db.fieldVisits,
  db.datasets,
  db.analysisRuns,
  db.evidence,
  db.researchLogs,
  db.manuscripts,
  db.submissions,
  db.reviewerComments,
]

function emptyMergeCounts(): WorkspaceMergeCounts {
  return {
    projects: 0,
    researchQuestions: 0,
    claims: 0,
    claimQuestionLinks: 0,
    tasks: 0,
    literature: 0,
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
    tasks: snapshot.tasks.length,
    literature: snapshot.literature.length,
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

async function clearAllTables(): Promise<void> {
  await Promise.all(allTables.map((table) => table.clear()))
}

async function writeSnapshot(snapshot: WorkspaceData): Promise<void> {
  await db.workspaces.put(snapshot.workspace)
  await Promise.all([
    db.projects.bulkPut(snapshot.projects),
    db.researchQuestions.bulkPut(snapshot.researchQuestions),
    db.claims.bulkPut(snapshot.claims),
    db.claimQuestionLinks.bulkPut(snapshot.claimQuestionLinks),
    db.tasks.bulkPut(snapshot.tasks),
    db.literature.bulkPut(snapshot.literature),
    db.fieldSites.bulkPut(snapshot.fieldSites),
    db.interviews.bulkPut(snapshot.interviews),
    db.fieldVisits.bulkPut(snapshot.fieldVisits),
    db.datasets.bulkPut(snapshot.datasets),
    db.analysisRuns.bulkPut(snapshot.analysisRuns),
    db.evidence.bulkPut(snapshot.evidence),
    db.researchLogs.bulkPut(snapshot.researchLogs),
    db.manuscripts.bulkPut(snapshot.manuscripts),
    db.submissions.bulkPut(snapshot.submissions),
    db.reviewerComments.bulkPut(snapshot.reviewerComments),
  ])
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
  collection: 'researchQuestions' | 'claims' | 'claimQuestionLinks',
  localRecords: T[],
  incomingRecords: T[],
  identity: (record: T) => string,
): WorkspaceValidationError['issues'] {
  const localById = new Map(localRecords.map((record) => [record.id, record]))
  const issues: WorkspaceValidationError['issues'] = []
  incomingRecords.forEach((record, index) => {
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

/** Prevent imported links from silently attaching to different local graph parents. */
function assertGraphMergeCollisionsSafe(
  current: WorkspaceData,
  incoming: WorkspaceData,
): void {
  const localProjectById = new Map(current.projects.map((project) => [project.id, project]))
  const localQuestionIds = new Set(current.researchQuestions.map((question) => question.id))
  const localClaimIds = new Set(current.claims.map((claim) => claim.id))
  const localLinkIds = new Set(current.claimQuestionLinks.map((link) => link.id))
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
      (link) =>
        JSON.stringify([link.projectId, link.claimId, link.researchQuestionId]),
    ),
  ]
  if (issues.length > 0) {
    throw new WorkspaceValidationError(
      'The workspace merge contains conflicting research-graph IDs.',
      issues,
    )
  }
}

async function readWorkspaceSnapshot(): Promise<WorkspaceData | null> {
  const workspace = await db.workspaces.toCollection().first()
  if (!workspace) {
    return null
  }

  const [
    projects,
    researchQuestions,
    claims,
    claimQuestionLinks,
    tasks,
    literature,
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
    db.projects.toArray(),
    db.researchQuestions.toArray(),
    db.claims.toArray(),
    db.claimQuestionLinks.toArray(),
    db.tasks.toArray(),
    db.literature.toArray(),
    db.fieldSites.toArray(),
    db.interviews.toArray(),
    db.fieldVisits.toArray(),
    db.datasets.toArray(),
    db.analysisRuns.toArray(),
    db.evidence.toArray(),
    db.researchLogs.toArray(),
    db.manuscripts.toArray(),
    db.submissions.toArray(),
    db.reviewerComments.toArray(),
  ])

  return {
    application: WORKSPACE_APPLICATION,
    version: WORKSPACE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
    projects,
    researchQuestions,
    claims,
    claimQuestionLinks,
    tasks,
    literature,
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
  }
}

/**
 * Opens the local workspace. The synthetic demo is written only when no
 * workspace exists, so subsequent launches never reset user edits.
 */
export async function initializeWorkspace(
  initialWorkspace: WorkspaceData = createDemoWorkspace(),
): Promise<WorkspaceData> {
  const validatedInitialWorkspace = assertValidWorkspace(initialWorkspace, 'initialization')

  await db.transaction('rw', allTables, async () => {
    if ((await db.workspaces.count()) > 0) {
      return
    }

    // Remove possible orphan rows left by an interrupted pre-v1 write.
    await clearAllTables()
    await writeSnapshot(validatedInitialWorkspace)
  })

  const snapshot = await getWorkspaceSnapshot()
  if (!snapshot) {
    throw new Error('Workspace initialization completed without a workspace record.')
  }
  return snapshot
}

/** Returns a portable point-in-time snapshot, or null before initialization. */
export async function getWorkspaceSnapshot(): Promise<WorkspaceData | null> {
  return db.transaction('r', allTables, readWorkspaceSnapshot)
}

/**
 * Atomically replaces every persisted collection. When expectedRevision is
 * supplied, a stale caller is rejected before any table is cleared.
 */
export async function replaceWorkspace(
  snapshot: WorkspaceData,
  expectedRevision?: number,
): Promise<void> {
  const validatedSnapshot = assertValidWorkspace(snapshot, 'replacement input')

  await db.transaction('rw', allTables, async () => {
    const currentWorkspace = await db.workspaces.toCollection().first()
    const actualRevision = currentWorkspace?.revision ?? null

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

    await clearAllTables()
    await writeSnapshot(prospectiveSnapshot)
  })
}

/**
 * Builds a complete local-first prospective snapshot in memory. Existing IDs
 * win, but the resulting research graph must still validate before one atomic
 * replacement transaction is allowed to commit.
 */
export async function mergeWorkspace(snapshot: WorkspaceData): Promise<MergeWorkspaceResult> {
  const validatedIncoming = assertValidWorkspace(snapshot, 'merge input')

  return db.transaction('rw', allTables, async () => {
    const current = await readWorkspaceSnapshot()
    if (!current) {
      const prospectiveSnapshot = assertValidWorkspace(
        {
          ...validatedIncoming,
          workspace: { ...validatedIncoming.workspace, revision: 0 },
        },
        'merge commit',
      )
      await clearAllTables()
      await writeSnapshot(prospectiveSnapshot)
      return {
        added: snapshotCollectionCounts(prospectiveSnapshot),
        skipped: emptyMergeCounts(),
        preservedWorkspace: false,
      }
    }

    assertGraphMergeCollisionsSafe(current, validatedIncoming)

    const projects = mergeRecords(current.projects, validatedIncoming.projects)
    const researchQuestions = mergeRecords(
      current.researchQuestions,
      validatedIncoming.researchQuestions,
    )
    const claims = mergeRecords(current.claims, validatedIncoming.claims)
    const claimQuestionLinks = mergeRecords(
      current.claimQuestionLinks,
      validatedIncoming.claimQuestionLinks,
    )
    const tasks = mergeRecords(current.tasks, validatedIncoming.tasks)
    const literature = mergeRecords(current.literature, validatedIncoming.literature)
    const fieldSites = mergeRecords(current.fieldSites, validatedIncoming.fieldSites)
    const interviews = mergeRecords(current.interviews, validatedIncoming.interviews)
    const fieldVisits = mergeRecords(current.fieldVisits, validatedIncoming.fieldVisits)
    const datasets = mergeRecords(current.datasets, validatedIncoming.datasets)
    const analysisRuns = mergeRecords(current.analysisRuns, validatedIncoming.analysisRuns)
    const evidence = mergeRecords(current.evidence, validatedIncoming.evidence)
    const researchLogs = mergeRecords(current.researchLogs, validatedIncoming.researchLogs)
    const manuscripts = mergeRecords(current.manuscripts, validatedIncoming.manuscripts)
    const submissions = mergeRecords(current.submissions, validatedIncoming.submissions)
    const reviewerComments = mergeRecords(
      current.reviewerComments,
      validatedIncoming.reviewerComments,
    )

    const prospectiveSnapshot = assertValidWorkspace(
      {
        application: WORKSPACE_APPLICATION,
        version: WORKSPACE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        workspace: {
          ...current.workspace,
          revision: current.workspace.revision + 1,
          updatedAt: new Date().toISOString(),
        },
        projects: projects.records,
        researchQuestions: researchQuestions.records,
        claims: claims.records,
        claimQuestionLinks: claimQuestionLinks.records,
        tasks: tasks.records,
        literature: literature.records,
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

    await clearAllTables()
    await writeSnapshot(prospectiveSnapshot)

    return {
      added: {
        projects: projects.added,
        researchQuestions: researchQuestions.added,
        claims: claims.added,
        claimQuestionLinks: claimQuestionLinks.added,
        tasks: tasks.added,
        literature: literature.added,
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
        tasks: tasks.skipped,
        literature: literature.skipped,
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
    }
  })
}

/** Removes all local workspace metadata and research-object records. */
export async function clearWorkspace(): Promise<void> {
  await db.transaction('rw', allTables, clearAllTables)
}
