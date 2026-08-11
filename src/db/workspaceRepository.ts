import type { Table } from 'dexie'
import { db } from './database'
import { createDemoWorkspace } from '../models/demo'
import { WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import type { EntityMetadata, WorkspaceData } from '../models/domain'

export const WORKSPACE_COLLECTIONS = [
  'projects',
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

const allTables = [
  db.workspaces,
  db.projects,
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

async function addMissing<T extends EntityMetadata>(
  table: Table<T, string>,
  records: T[],
): Promise<{ added: number; skipped: number }> {
  const existingKeys = new Set(await table.toCollection().primaryKeys())
  const additions = records.filter((record) => !existingKeys.has(record.id))

  if (additions.length > 0) {
    await table.bulkAdd(additions)
  }

  return {
    added: additions.length,
    skipped: records.length - additions.length,
  }
}

/**
 * Opens the local workspace. The synthetic demo is written only when no
 * workspace exists, so subsequent launches never reset user edits.
 */
export async function initializeWorkspace(
  initialWorkspace: WorkspaceData = createDemoWorkspace(),
): Promise<WorkspaceData> {
  await db.transaction('rw', allTables, async () => {
    if ((await db.workspaces.count()) > 0) {
      return
    }

    // Remove possible orphan rows left by an interrupted pre-v1 write.
    await clearAllTables()
    await writeSnapshot(initialWorkspace)
  })

  const snapshot = await getWorkspaceSnapshot()
  if (!snapshot) {
    throw new Error('Workspace initialization completed without a workspace record.')
  }
  return snapshot
}

/** Returns a portable point-in-time snapshot, or null before initialization. */
export async function getWorkspaceSnapshot(): Promise<WorkspaceData | null> {
  const workspace = await db.workspaces.toCollection().first()
  if (!workspace) {
    return null
  }

  const [
    projects,
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
    version: WORKSPACE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
    projects,
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
 * Atomically replaces every persisted collection. Callers should use this only
 * after a validated import and an explicit replace choice in the UI.
 */
export async function replaceWorkspace(snapshot: WorkspaceData): Promise<void> {
  await db.transaction('rw', allTables, async () => {
    await clearAllTables()
    await writeSnapshot(snapshot)
  })
}

/**
 * Adds records whose IDs are new and preserves every existing record on an ID
 * collision. The returned counts make collision handling visible to callers.
 */
export async function mergeWorkspace(snapshot: WorkspaceData): Promise<MergeWorkspaceResult> {
  const currentWorkspace = await db.workspaces.toCollection().first()
  if (!currentWorkspace) {
    await replaceWorkspace(snapshot)
    return {
      added: snapshotCollectionCounts(snapshot),
      skipped: emptyMergeCounts(),
      preservedWorkspace: false,
    }
  }

  const added = emptyMergeCounts()
  const skipped = emptyMergeCounts()

  await db.transaction('rw', allTables, async () => {
    const results = await Promise.all([
      addMissing(db.projects, snapshot.projects),
      addMissing(db.tasks, snapshot.tasks),
      addMissing(db.literature, snapshot.literature),
      addMissing(db.fieldSites, snapshot.fieldSites),
      addMissing(db.interviews, snapshot.interviews),
      addMissing(db.fieldVisits, snapshot.fieldVisits),
      addMissing(db.datasets, snapshot.datasets),
      addMissing(db.analysisRuns, snapshot.analysisRuns),
      addMissing(db.evidence, snapshot.evidence),
      addMissing(db.researchLogs, snapshot.researchLogs),
      addMissing(db.manuscripts, snapshot.manuscripts),
      addMissing(db.submissions, snapshot.submissions),
      addMissing(db.reviewerComments, snapshot.reviewerComments),
    ])

    WORKSPACE_COLLECTIONS.forEach((collection, index) => {
      const result = results[index]
      if (result) {
        added[collection] = result.added
        skipped[collection] = result.skipped
      }
    })
  })

  return { added, skipped, preservedWorkspace: true }
}

/** Removes all local workspace metadata and research-object records. */
export async function clearWorkspace(): Promise<void> {
  await db.transaction('rw', allTables, clearAllTables)
}
