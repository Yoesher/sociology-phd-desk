import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  AnalysisRun,
  Claim,
  ClaimQuestionLink,
  Dataset,
  EvidenceItem,
  FieldSite,
  FieldVisit,
  Interview,
  LiteratureItem,
  Manuscript,
  ResearchLogEntry,
  ResearchProject,
  ResearchQuestion,
  ResearchTask,
  ReviewerComment,
  Submission,
  WorkspaceMeta,
} from '../models/domain'
import { migrateV2ResearchGraphCollections } from '../utils/workspace-transfer'

export const DATABASE_SCHEMA_VERSION = 3 as const
export const LEGACY_DATABASE_NAME = 'sociology-phd-desk' as const

const databaseStoresV1 = {
  workspaces: '&id, updatedAt',
  projects: '&id, status, method, updatedAt',
  tasks: '&id, projectId, status, category, dueDate, priority',
  literature: '&id, projectId, status, priority, year',
  fieldSites: '&id, projectId, status',
  interviews: '&id, projectId, fieldSiteId, status, interviewDate',
  fieldVisits: '&id, projectId, fieldSiteId, date',
  datasets: '&id, projectId, name',
  analysisRuns: '&id, projectId, datasetId, status, date',
  evidence: '&id, projectId, evidenceType, supportLevel',
  researchLogs: '&id, projectId, date',
  manuscripts: '&id, projectId, status, deadline',
  submissions: '&id, projectId, manuscriptId, status, submissionDate',
  reviewerComments: '&id, submissionId, status, severity',
}

const databaseStoresV2 = {
  ...databaseStoresV1,
  workspaces: '&id, revision, updatedAt',
}

const databaseStoresV3 = {
  ...databaseStoresV2,
  researchQuestions: '&id, projectId, status, updatedAt',
  claims: '&id, projectId, status, updatedAt',
  claimQuestionLinks: '&id, projectId, claimId, researchQuestionId, updatedAt',
}

export class SociologyPhdDeskDatabase extends Dexie {
  workspaces!: Table<WorkspaceMeta, string>
  projects!: Table<ResearchProject, string>
  researchQuestions!: Table<ResearchQuestion, string>
  claims!: Table<Claim, string>
  claimQuestionLinks!: Table<ClaimQuestionLink, string>
  tasks!: Table<ResearchTask, string>
  literature!: Table<LiteratureItem, string>
  fieldSites!: Table<FieldSite, string>
  interviews!: Table<Interview, string>
  fieldVisits!: Table<FieldVisit, string>
  datasets!: Table<Dataset, string>
  analysisRuns!: Table<AnalysisRun, string>
  evidence!: Table<EvidenceItem, string>
  researchLogs!: Table<ResearchLogEntry, string>
  manuscripts!: Table<Manuscript, string>
  submissions!: Table<Submission, string>
  reviewerComments!: Table<ReviewerComment, string>

  constructor(databaseName = 'sociology-phd-desk') {
    super(databaseName)

    this.version(1).stores(databaseStoresV1)
    this.version(2)
      .stores(databaseStoresV2)
      .upgrade(async (transaction) => {
        await transaction
          .table<WorkspaceMeta, string>('workspaces')
          .toCollection()
          .modify((workspace) => {
            if (!Number.isInteger(workspace.revision) || workspace.revision < 0) {
              workspace.revision = 0
            }
          })
      })
    this.version(DATABASE_SCHEMA_VERSION)
      .stores(databaseStoresV3)
      .upgrade(async (transaction) => {
        const projectTable = transaction.table('projects')
        const evidenceTable = transaction.table('evidence')
        const [projects, evidence] = await Promise.all([
          projectTable.toArray(),
          evidenceTable.toArray(),
        ])
        const graph = migrateV2ResearchGraphCollections(projects, evidence)

        if (graph.projects.length > 0) {
          await projectTable.bulkPut(graph.projects)
        }
        if (graph.researchQuestions.length > 0) {
          await transaction.table('researchQuestions').bulkPut(graph.researchQuestions)
        }
        if (graph.claims.length > 0) {
          await transaction.table('claims').bulkPut(graph.claims)
        }
      })
  }
}

/**
 * Opens a database adapter without introducing a module-level runtime
 * singleton. Phase 3C binds each repository instance to one physical database.
 */
export function createWorkspaceDatabase(databaseName: string): SociologyPhdDeskDatabase {
  return new SociologyPhdDeskDatabase(databaseName)
}
