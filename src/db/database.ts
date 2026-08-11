import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  AnalysisRun,
  Dataset,
  EvidenceItem,
  FieldSite,
  FieldVisit,
  Interview,
  LiteratureItem,
  Manuscript,
  ResearchLogEntry,
  ResearchProject,
  ResearchTask,
  ReviewerComment,
  Submission,
  WorkspaceMeta,
} from '../models/domain'

export class SociologyPhdDeskDatabase extends Dexie {
  workspaces!: Table<WorkspaceMeta, string>
  projects!: Table<ResearchProject, string>
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

    this.version(1).stores({
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
    })
  }
}

/** The single browser-local database used by the application. */
export const db = new SociologyPhdDeskDatabase()
