import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  AnalysisRun,
  Claim,
  ClaimQuestionLink,
  Dataset,
  EvidenceItem,
  FieldSite,
  FieldMap,
  FieldVisit,
  Interview,
  LiteratureItem,
  LiteratureExternalReference,
  Manuscript,
  ResearchLogEntry,
  ResearchProject,
  ResearchQuestion,
  ResearchTask,
  ReviewerComment,
  Submission,
  TheoryMemo,
  WorkspaceData,
  WorkspaceMeta,
} from '../models/domain'
import { LEGACY_COLLECTION_KEYS, QUALITATIVE_COLLECTION_KEYS, WORKSPACE_COLLECTION_KEYS } from '../models/provenance'
import { migrateV2ResearchGraphCollections, validateWorkspace, WorkspaceValidationError } from '../utils/workspace-transfer'

export const DATABASE_SCHEMA_VERSION = 9 as const
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

const databaseStoresV4 = {
  ...databaseStoresV3,
  theoryMemos: '&id, projectId, memoType, updatedAt',
}

const databaseStoresV5 = {
  ...databaseStoresV4,
  literatureExternalReferences:
    '&id, literatureItemId, provider, &[provider+externalLibraryId+externalItemKey], importedAt',
}

const databaseStoresV7 = {
  ...databaseStoresV5,
  fieldMaps: '&id, projectId, updatedAt',
}

const databaseStoresV8 = {
  ...databaseStoresV7,
  claimRevisions: '&id, projectId, claimId, [claimId+revisionNo]',
  evidenceRevisions: '&id, projectId, evidenceId, [evidenceId+revisionNo]',
  evidenceClaimLinks: '&id, projectId, evidenceRevisionId, claimRevisionId, state',
  evidenceSourceLinks: '&id, projectId, evidenceRevisionId, state',
  manuscriptAnchors: '&id, projectId, manuscriptId, state',
  manuscriptAnchorRevisions: '&id, projectId, anchorId, [anchorId+revisionNo]',
  claimManuscriptLinks: '&id, projectId, claimRevisionId, anchorRevisionId, state',
  evidenceUsages: '&id, projectId, evidenceClaimLinkId, claimManuscriptLinkId, state',
}

const databaseStoresV9 = {
  ...databaseStoresV8,
  samplingDimensions: '&id, projectId, state',
  researchCases: '&id, projectId, state',
  interviewCaseLinks: '&id, projectId, interviewId, caseId, state',
  sourceReferences: '&id, projectId, state',
  sourceRevisions: '&id, projectId, sourceReferenceId, [sourceReferenceId+revisionNo]',
  sourceSegments: '&id, projectId, sourceReferenceId, state',
  sourceSegmentRevisions: '&id, projectId, segmentId, sourceRevisionId, [segmentId+revisionNo]',
  qualitativeCodes: '&id, projectId, state',
  qualitativeCodeRevisions: '&id, projectId, codeId, stage, [codeId+revisionNo]',
  codeRelations: '&id, projectId, fromCodeRevisionId, toCodeRevisionId, state',
  codingAssignments: '&id, projectId, segmentRevisionId, codeRevisionId, state',
  analyticalMemoFacets: '&id, projectId, theoryMemoId, state',
  theoryMemoRevisions: '&id, projectId, theoryMemoId, [theoryMemoId+revisionNo]',
  memoMaterialLinks: '&id, projectId, memoRevisionId, state',
  claimDerivationLinks: '&id, projectId, claimRevisionId, memoRevisionId, state',
  comparisonRuns: '&id, projectId, frozenAt',
  qualitativeChangeEvents: '&id, projectId, operation, createdAt',
}

export class SociologyPhdDeskDatabase extends Dexie {
  workspaces!: Table<WorkspaceMeta, string>
  projects!: Table<ResearchProject, string>
  researchQuestions!: Table<ResearchQuestion, string>
  claims!: Table<Claim, string>
  claimQuestionLinks!: Table<ClaimQuestionLink, string>
  theoryMemos!: Table<TheoryMemo, string>
  tasks!: Table<ResearchTask, string>
  literature!: Table<LiteratureItem, string>
  literatureExternalReferences!: Table<LiteratureExternalReference, string>
  fieldSites!: Table<FieldSite, string>
  fieldMaps!: Table<FieldMap, string>
  interviews!: Table<Interview, string>
  fieldVisits!: Table<FieldVisit, string>
  datasets!: Table<Dataset, string>
  analysisRuns!: Table<AnalysisRun, string>
  evidence!: Table<EvidenceItem, string>
  researchLogs!: Table<ResearchLogEntry, string>
  manuscripts!: Table<Manuscript, string>
  submissions!: Table<Submission, string>
  reviewerComments!: Table<ReviewerComment, string>
  claimRevisions!: Table<WorkspaceData['claimRevisions'][number], string>
  evidenceRevisions!: Table<WorkspaceData['evidenceRevisions'][number], string>
  evidenceClaimLinks!: Table<WorkspaceData['evidenceClaimLinks'][number], string>
  evidenceSourceLinks!: Table<WorkspaceData['evidenceSourceLinks'][number], string>
  manuscriptAnchors!: Table<WorkspaceData['manuscriptAnchors'][number], string>
  manuscriptAnchorRevisions!: Table<WorkspaceData['manuscriptAnchorRevisions'][number], string>
  claimManuscriptLinks!: Table<WorkspaceData['claimManuscriptLinks'][number], string>
  evidenceUsages!: Table<WorkspaceData['evidenceUsages'][number], string>
  samplingDimensions!: Table<WorkspaceData['samplingDimensions'][number], string>
  researchCases!: Table<WorkspaceData['researchCases'][number], string>
  interviewCaseLinks!: Table<WorkspaceData['interviewCaseLinks'][number], string>
  sourceReferences!: Table<WorkspaceData['sourceReferences'][number], string>
  sourceRevisions!: Table<WorkspaceData['sourceRevisions'][number], string>
  sourceSegments!: Table<WorkspaceData['sourceSegments'][number], string>
  sourceSegmentRevisions!: Table<WorkspaceData['sourceSegmentRevisions'][number], string>
  qualitativeCodes!: Table<WorkspaceData['qualitativeCodes'][number], string>
  qualitativeCodeRevisions!: Table<WorkspaceData['qualitativeCodeRevisions'][number], string>
  codeRelations!: Table<WorkspaceData['codeRelations'][number], string>
  codingAssignments!: Table<WorkspaceData['codingAssignments'][number], string>
  analyticalMemoFacets!: Table<WorkspaceData['analyticalMemoFacets'][number], string>
  theoryMemoRevisions!: Table<WorkspaceData['theoryMemoRevisions'][number], string>
  memoMaterialLinks!: Table<WorkspaceData['memoMaterialLinks'][number], string>
  claimDerivationLinks!: Table<WorkspaceData['claimDerivationLinks'][number], string>
  comparisonRuns!: Table<WorkspaceData['comparisonRuns'][number], string>
  qualitativeChangeEvents!: Table<WorkspaceData['qualitativeChangeEvents'][number], string>

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
    this.version(3)
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
    this.version(4).stores(databaseStoresV4)
    this.version(5).stores(databaseStoresV5)
    this.version(6).stores(databaseStoresV5)
    this.version(7).stores(databaseStoresV7)
    this.version(8).stores(databaseStoresV8).upgrade(async (transaction) => {
      const collections = await Promise.all(LEGACY_COLLECTION_KEYS.map(async (collection) => [
        collection, await transaction.table(collection).toArray(),
      ] as const))
      const workspaces = await transaction.table<WorkspaceMeta, string>('workspaces').toArray()
      if (!workspaces.length && collections.every(([, records]) => !records.length)) return
      if (workspaces.length !== 1) {
        throw new WorkspaceValidationError('Cannot upgrade an ambiguous workspace database.', [
          { path: ['workspace'], message: 'Migration requires exactly one workspace metadata row.' },
        ])
      }
      const historical = {
        application: 'sociology-phd-desk', version: 7,
        exportedAt: workspaces[0]!.updatedAt, workspace: workspaces[0],
        ...Object.fromEntries(collections),
      }
      // The schema upgrade is one IndexedDB transaction. Validate the entire
      // prospective graph and expanded record budget before any snapshot put;
      // failures roll back both new stores and data, retaining the old version.
      const candidate = validateWorkspace(historical)
      if (!candidate.success) {
        throw new WorkspaceValidationError('The workspace database upgrade failed validation.', candidate.issues)
      }
      if (candidate.data.claimRevisions.length) await transaction.table('claimRevisions').bulkPut(candidate.data.claimRevisions)
      if (candidate.data.evidenceRevisions.length) await transaction.table('evidenceRevisions').bulkPut(candidate.data.evidenceRevisions)
    })
    this.version(DATABASE_SCHEMA_VERSION).stores(databaseStoresV9).upgrade(async (transaction) => {
      const collections = await Promise.all(WORKSPACE_COLLECTION_KEYS.map(async (collection) => [
        collection, await transaction.table(collection).toArray(),
      ] as const))
      const workspaces = await transaction.table<WorkspaceMeta, string>('workspaces').toArray()
      if (!workspaces.length && collections.every(([, records]) => !records.length)) return
      if (workspaces.length !== 1) {
        throw new WorkspaceValidationError('Cannot upgrade an ambiguous workspace database.', [
          { path: ['workspace'], message: 'Migration requires exactly one workspace metadata row.' },
        ])
      }
      const qualitativeKeys = new Set<string>(QUALITATIVE_COLLECTION_KEYS)
      if (collections.some(([name, records]) => qualitativeKeys.has(name) && records.length)) {
        throw new WorkspaceValidationError('The old database contains ambiguous qualitative records.', [
          { path: ['version'], message: 'A v8 database must not contain v9 qualitative collections.' },
        ])
      }
      const candidate = validateWorkspace({
        application: 'sociology-phd-desk', version: 8,
        exportedAt: workspaces[0]!.updatedAt, workspace: workspaces[0],
        ...Object.fromEntries(collections.filter(([name]) => !qualitativeKeys.has(name))),
      })
      if (!candidate.success) {
        throw new WorkspaceValidationError('The workspace database upgrade failed validation.', candidate.issues)
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
