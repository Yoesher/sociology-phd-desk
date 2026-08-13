import { z } from 'zod'
import {
  ANALYSIS_RUN_STATUSES,
  ANALYSIS_SOFTWARE,
  CLAIM_STATUSES,
  EVIDENCE_TYPES,
  FIELD_SITE_STATUSES,
  INTERVIEW_STATUSES,
  LITERATURE_EXTERNAL_PROVIDERS,
  LITERATURE_STATUSES,
  MANUSCRIPT_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  RESEARCH_QUESTION_STATUSES,
  RESEARCH_METHODS,
  REVIEW_COMMENT_SEVERITIES,
  REVIEW_COMMENT_STATUSES,
  SUBMISSION_STATUSES,
  SUPPORT_LEVELS,
  TASK_CATEGORIES,
  TASK_STATUSES,
  THEORY_MEMO_TYPES,
  WORK_PRODUCT_STATUSES,
  WORKSPACE_APPLICATION,
  WORKSPACE_SCHEMA_VERSION,
} from '../models/domain'
import type {
  Claim,
  EntityMetadata,
  ResearchQuestion,
  WorkspaceData,
} from '../models/domain'

export interface WorkspaceValidationIssue {
  path: (string | number)[]
  message: string
}

export type WorkspaceValidationResult =
  | { success: true; data: WorkspaceData; issues: [] }
  | { success: false; issues: WorkspaceValidationIssue[] }

export class WorkspaceValidationError extends Error {
  issues: WorkspaceValidationIssue[]

  constructor(message: string, issues: WorkspaceValidationIssue[]) {
    super(message)
    this.name = 'WorkspaceValidationError'
    this.issues = issues
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isIsoDateTime(value: string): boolean {
  const hasTimeAndZone =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  return hasTimeAndZone && !Number.isNaN(Date.parse(value))
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const idSchema = z.string().trim().min(1).max(240)
const titleSchema = z.string().trim().min(1).max(1_000)
const textSchema = z.string().max(250_000)
const researchObjectTextSchema = textSchema.refine(
  (value) => value.trim().length > 0,
  'Research object text cannot be blank.',
)
const shortTextSchema = z.string().max(5_000)
const isoDateSchema = z.string().refine(isIsoDate, 'Expected an ISO date in YYYY-MM-DD format.')
const isoDateTimeSchema = z.string().refine(isIsoDateTime, 'Expected an ISO 8601 date-time with a timezone.')
const urlSchema = z.string().refine(isHttpUrl, 'Expected an http or https URL.')

const entityMetadataSchema = z
  .object({
    id: idSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    isDemo: z.boolean(),
  })
  .strict()

const workspaceMetaSchema = entityMetadataSchema
  .extend({
    name: titleSchema,
    description: shortTextSchema.optional(),
    activeProjectId: idSchema.optional(),
    revision: z.number().int().nonnegative(),
    todayGoals: z.array(titleSchema).max(3),
  })
  .strict()

const projectSchema = entityMetadataSchema
  .extend({
    title: titleSchema,
    shortTitle: titleSchema,
    topic: shortTextSchema,
    method: z.enum(RESEARCH_METHODS),
    status: z.enum(PROJECT_STATUSES),
    startDate: isoDateSchema,
    targetDate: isoDateSchema.optional(),
    notes: textSchema,
  })
  .strict()

const researchQuestionSchema = entityMetadataSchema
  .extend({
    projectId: idSchema,
    text: researchObjectTextSchema,
    status: z.enum(RESEARCH_QUESTION_STATUSES),
    notes: textSchema,
  })
  .strict()

const claimSchema = entityMetadataSchema
  .extend({
    projectId: idSchema,
    text: researchObjectTextSchema,
    status: z.enum(CLAIM_STATUSES),
    notes: textSchema,
  })
  .strict()

const claimQuestionLinkSchema = entityMetadataSchema
  .extend({
    projectId: idSchema,
    claimId: idSchema,
    researchQuestionId: idSchema,
  })
  .strict()

const theoryMemoSchema = entityMetadataSchema
  .extend({
    projectId: idSchema,
    memoType: z.enum(THEORY_MEMO_TYPES),
    title: titleSchema,
    content: textSchema,
    relatedQuestionIds: z.array(idSchema),
    relatedClaimIds: z.array(idSchema),
    relatedLiteratureIds: z.array(idSchema),
  })
  .strict()

const taskSchema = entityMetadataSchema
  .extend({
    title: titleSchema,
    projectId: idSchema,
    category: z.enum(TASK_CATEGORIES),
    status: z.enum(TASK_STATUSES),
    dueDate: isoDateSchema.optional(),
    priority: z.enum(PRIORITIES),
    notes: textSchema,
  })
  .strict()

const literatureSchema = entityMetadataSchema
  .extend({
    title: titleSchema,
    authors: z.array(titleSchema).max(1_000),
    itemType: shortTextSchema.optional(),
    year: z.number().int().min(1000).max(2100).optional(),
    journal: titleSchema.optional(),
    volume: shortTextSchema.optional(),
    issue: shortTextSchema.optional(),
    pages: shortTextSchema.optional(),
    publisher: titleSchema.optional(),
    place: titleSchema.optional(),
    doi: z.string().trim().min(1).max(500).optional(),
    isbn: z.string().trim().min(1).max(500).optional(),
    issn: z.string().trim().min(1).max(500).optional(),
    url: urlSchema.optional(),
    projectId: idSchema,
    status: z.enum(LITERATURE_STATUSES),
    priority: z.enum(PRIORITIES),
    whyRead: textSchema,
    notes: textSchema,
  })
  .strict()

const literatureExternalReferenceSchema = entityMetadataSchema
  .extend({
    literatureItemId: idSchema,
    provider: z.enum(LITERATURE_EXTERNAL_PROVIDERS),
    externalLibraryId: idSchema,
    externalItemKey: idSchema,
    externalVersion: z.number().int().nonnegative().optional(),
    importedAt: isoDateTimeSchema,
    lastSeenModifiedAt: isoDateTimeSchema.optional(),
  })
  .strict()

const fieldSiteSchema = entityMetadataSchema
  .extend({
    nameOrAlias: titleSchema,
    projectId: idSchema,
    status: z.enum(FIELD_SITE_STATUSES),
    notes: textSchema,
  })
  .strict()

const interviewSchema = entityMetadataSchema
  .extend({
    participantAlias: titleSchema,
    projectId: idSchema,
    fieldSiteId: idSchema.optional(),
    interviewDate: isoDateSchema.optional(),
    status: z.enum(INTERVIEW_STATUSES),
    transcriptStatus: z.enum(WORK_PRODUCT_STATUSES),
    codingStatus: z.enum(WORK_PRODUCT_STATUSES),
    memoStatus: z.enum(WORK_PRODUCT_STATUSES),
    notes: textSchema,
  })
  .strict()

const fieldVisitSchema = entityMetadataSchema
  .extend({
    date: isoDateSchema,
    projectId: idSchema,
    fieldSiteId: idSchema,
    purpose: textSchema,
    observations: textSchema,
    followUp: textSchema,
    memo: textSchema,
  })
  .strict()

const datasetSchema = entityMetadataSchema
  .extend({
    name: titleSchema,
    wave: shortTextSchema,
    source: textSchema,
    localPath: z.string().max(32_000).optional(),
    projectId: idSchema,
    notes: textSchema,
  })
  .strict()

const analysisRunSchema = entityMetadataSchema
  .extend({
    projectId: idSchema,
    date: isoDateSchema,
    software: z.enum(ANALYSIS_SOFTWARE),
    scriptPath: z.string().max(32_000).optional(),
    datasetId: idSchema,
    sample: textSchema,
    model: textSchema,
    outcome: shortTextSchema,
    keyPredictor: shortTextSchema,
    status: z.enum(ANALYSIS_RUN_STATUSES),
    resultSummary: textSchema,
    outputPath: z.string().max(32_000).optional(),
  })
  .strict()

const evidenceSchema = entityMetadataSchema
  .extend({
    projectId: idSchema,
    claim: textSchema,
    evidenceType: z.enum(EVIDENCE_TYPES),
    source: textSchema,
    locator: textSchema,
    finding: textSchema,
    supportLevel: z.enum(SUPPORT_LEVELS),
    limitations: textSchema,
    manuscriptLocation: textSchema,
  })
  .strict()

const researchLogSchema = entityMetadataSchema
  .extend({
    date: isoDateSchema,
    projectId: idSchema,
    whatChanged: textSchema,
    decision: textSchema,
    problem: textSchema,
    nextStep: textSchema,
  })
  .strict()

const manuscriptSchema = entityMetadataSchema
  .extend({
    title: titleSchema,
    projectId: idSchema,
    targetJournal: shortTextSchema,
    status: z.enum(MANUSCRIPT_STATUSES),
    wordCount: z.number().int().nonnegative(),
    nextAction: textSchema,
    deadline: isoDateSchema.optional(),
  })
  .strict()

const submissionSchema = entityMetadataSchema
  .extend({
    projectId: idSchema,
    manuscriptId: idSchema,
    journal: titleSchema,
    submissionDate: isoDateSchema.optional(),
    manuscriptVersion: titleSchema,
    status: z.enum(SUBMISSION_STATUSES),
    editorialStatus: shortTextSchema,
    decisionDate: isoDateSchema.optional(),
    decision: textSchema.optional(),
    notes: textSchema,
  })
  .strict()

const reviewerCommentSchema = entityMetadataSchema
  .extend({
    submissionId: idSchema,
    reviewer: titleSchema,
    commentId: idSchema,
    comment: textSchema,
    severity: z.enum(REVIEW_COMMENT_SEVERITIES),
    response: textSchema,
    revisionAction: textSchema,
    status: z.enum(REVIEW_COMMENT_STATUSES),
  })
  .strict()

const workspaceDataSchema = z
  .object({
    application: z.literal(WORKSPACE_APPLICATION),
    version: z.literal(WORKSPACE_SCHEMA_VERSION),
    exportedAt: isoDateTimeSchema,
    workspace: workspaceMetaSchema,
    projects: z.array(projectSchema),
    researchQuestions: z.array(researchQuestionSchema),
    claims: z.array(claimSchema),
    claimQuestionLinks: z.array(claimQuestionLinkSchema),
    theoryMemos: z.array(theoryMemoSchema),
    tasks: z.array(taskSchema),
    literature: z.array(literatureSchema),
    literatureExternalReferences: z.array(literatureExternalReferenceSchema),
    fieldSites: z.array(fieldSiteSchema),
    interviews: z.array(interviewSchema),
    fieldVisits: z.array(fieldVisitSchema),
    datasets: z.array(datasetSchema),
    analysisRuns: z.array(analysisRunSchema),
    evidence: z.array(evidenceSchema),
    researchLogs: z.array(researchLogSchema),
    manuscripts: z.array(manuscriptSchema),
    submissions: z.array(submissionSchema),
    reviewerComments: z.array(reviewerCommentSchema),
  })
  .strict()

function duplicateIdIssues(
  collectionName: string,
  records: EntityMetadata[],
): WorkspaceValidationIssue[] {
  const seen = new Set<string>()
  const issues: WorkspaceValidationIssue[] = []

  records.forEach((record, index) => {
    if (seen.has(record.id)) {
      issues.push({
        path: [collectionName, index, 'id'],
        message: `Duplicate ID "${record.id}" in ${collectionName}.`,
      })
    }
    seen.add(record.id)
  })

  return issues
}

function relationshipIssues(data: WorkspaceData): WorkspaceValidationIssue[] {
  const issues: WorkspaceValidationIssue[] = []
  const projectIds = new Set(data.projects.map((project) => project.id))
  const researchQuestionById = new Map(
    data.researchQuestions.map((question) => [question.id, question]),
  )
  const claimById = new Map(data.claims.map((claim) => [claim.id, claim]))
  const literatureById = new Map(data.literature.map((item) => [item.id, item]))
  const externalLiteratureKeys = new Set<string>()
  const fieldSiteById = new Map(data.fieldSites.map((site) => [site.id, site]))
  const datasetById = new Map(data.datasets.map((dataset) => [dataset.id, dataset]))
  const manuscriptById = new Map(data.manuscripts.map((manuscript) => [manuscript.id, manuscript]))
  const submissionById = new Map(data.submissions.map((submission) => [submission.id, submission]))

  const requireProject = (collection: string, index: number, projectId: string): void => {
    if (!projectIds.has(projectId)) {
      issues.push({
        path: [collection, index, 'projectId'],
        message: `Unknown project ID "${projectId}".`,
      })
    }
  }

  if (data.workspace.activeProjectId && !projectIds.has(data.workspace.activeProjectId)) {
    issues.push({
      path: ['workspace', 'activeProjectId'],
      message: `Unknown active project ID "${data.workspace.activeProjectId}".`,
    })
  }

  data.tasks.forEach((record, index) => requireProject('tasks', index, record.projectId))
  data.researchQuestions.forEach((record, index) =>
    requireProject('researchQuestions', index, record.projectId),
  )
  data.claims.forEach((record, index) => requireProject('claims', index, record.projectId))
  data.theoryMemos.forEach((record, index) =>
    requireProject('theoryMemos', index, record.projectId),
  )
  data.literature.forEach((record, index) => requireProject('literature', index, record.projectId))
  data.literatureExternalReferences.forEach((record, index) => {
    if (!literatureById.has(record.literatureItemId)) {
      issues.push({
        path: ['literatureExternalReferences', index, 'literatureItemId'],
        message: `Unknown literature ID "${record.literatureItemId}".`,
      })
    }
    const externalKey = `${record.provider}\u0000${record.externalLibraryId}\u0000${record.externalItemKey}`
    if (externalLiteratureKeys.has(externalKey)) {
      issues.push({
        path: ['literatureExternalReferences', index, 'externalItemKey'],
        message: 'This external Zotero item is already linked in the workspace.',
      })
    }
    externalLiteratureKeys.add(externalKey)
  })
  data.fieldSites.forEach((record, index) => requireProject('fieldSites', index, record.projectId))
  data.datasets.forEach((record, index) => requireProject('datasets', index, record.projectId))
  data.evidence.forEach((record, index) => requireProject('evidence', index, record.projectId))
  data.researchLogs.forEach((record, index) => requireProject('researchLogs', index, record.projectId))
  data.manuscripts.forEach((record, index) => requireProject('manuscripts', index, record.projectId))

  const linkedPairs = new Set<string>()
  data.claimQuestionLinks.forEach((record, index) => {
    requireProject('claimQuestionLinks', index, record.projectId)

    const claim = claimById.get(record.claimId)
    if (!claim) {
      issues.push({
        path: ['claimQuestionLinks', index, 'claimId'],
        message: `Unknown claim ID "${record.claimId}".`,
      })
    } else if (claim.projectId !== record.projectId) {
      issues.push({
        path: ['claimQuestionLinks', index, 'claimId'],
        message: 'The claim link and its claim belong to different projects.',
      })
    }

    const question = researchQuestionById.get(record.researchQuestionId)
    if (!question) {
      issues.push({
        path: ['claimQuestionLinks', index, 'researchQuestionId'],
        message: `Unknown research-question ID "${record.researchQuestionId}".`,
      })
    } else if (question.projectId !== record.projectId) {
      issues.push({
        path: ['claimQuestionLinks', index, 'researchQuestionId'],
        message: 'The claim link and its research question belong to different projects.',
      })
    }

    const pairKey = `${record.projectId}\u0000${record.claimId}\u0000${record.researchQuestionId}`
    if (linkedPairs.has(pairKey)) {
      issues.push({
        path: ['claimQuestionLinks', index, 'researchQuestionId'],
        message: 'This claim is already linked to this research question.',
      })
    }
    linkedPairs.add(pairKey)
  })

  data.theoryMemos.forEach((memo, index) => {
    const validateRelatedIds = <T extends { projectId: string }>(
      field:
        | 'relatedQuestionIds'
        | 'relatedClaimIds'
        | 'relatedLiteratureIds',
      ids: string[],
      recordsById: Map<string, T>,
      objectLabel: string,
    ): void => {
      const seen = new Set<string>()
      ids.forEach((id, relatedIndex) => {
        if (seen.has(id)) {
          issues.push({
            path: ['theoryMemos', index, field, relatedIndex],
            message: `Duplicate ${objectLabel} ID "${id}" in this theory memo.`,
          })
        }
        seen.add(id)

        const related = recordsById.get(id)
        if (!related) {
          issues.push({
            path: ['theoryMemos', index, field, relatedIndex],
            message: `Unknown ${objectLabel} ID "${id}".`,
          })
        } else if (related.projectId !== memo.projectId) {
          issues.push({
            path: ['theoryMemos', index, field, relatedIndex],
            message: `The theory memo and its ${objectLabel} belong to different projects.`,
          })
        }
      })
    }

    validateRelatedIds(
      'relatedQuestionIds',
      memo.relatedQuestionIds,
      researchQuestionById,
      'research-question',
    )
    validateRelatedIds('relatedClaimIds', memo.relatedClaimIds, claimById, 'claim')
    validateRelatedIds(
      'relatedLiteratureIds',
      memo.relatedLiteratureIds,
      literatureById,
      'literature',
    )
  })

  data.interviews.forEach((record, index) => {
    requireProject('interviews', index, record.projectId)
    if (!record.fieldSiteId) {
      return
    }
    const site = fieldSiteById.get(record.fieldSiteId)
    if (!site) {
      issues.push({
        path: ['interviews', index, 'fieldSiteId'],
        message: `Unknown field-site ID "${record.fieldSiteId}".`,
      })
    } else if (site.projectId !== record.projectId) {
      issues.push({
        path: ['interviews', index, 'fieldSiteId'],
        message: 'The interview and its field site belong to different projects.',
      })
    }
  })

  data.fieldVisits.forEach((record, index) => {
    requireProject('fieldVisits', index, record.projectId)
    const site = fieldSiteById.get(record.fieldSiteId)
    if (!site) {
      issues.push({
        path: ['fieldVisits', index, 'fieldSiteId'],
        message: `Unknown field-site ID "${record.fieldSiteId}".`,
      })
    } else if (site.projectId !== record.projectId) {
      issues.push({
        path: ['fieldVisits', index, 'fieldSiteId'],
        message: 'The field visit and its field site belong to different projects.',
      })
    }
  })

  data.analysisRuns.forEach((record, index) => {
    requireProject('analysisRuns', index, record.projectId)
    const dataset = datasetById.get(record.datasetId)
    if (!dataset) {
      issues.push({
        path: ['analysisRuns', index, 'datasetId'],
        message: `Unknown dataset ID "${record.datasetId}".`,
      })
    } else if (dataset.projectId !== record.projectId) {
      issues.push({
        path: ['analysisRuns', index, 'datasetId'],
        message: 'The analysis run and its dataset belong to different projects.',
      })
    }
  })

  data.submissions.forEach((record, index) => {
    requireProject('submissions', index, record.projectId)
    const manuscript = manuscriptById.get(record.manuscriptId)
    if (!manuscript) {
      issues.push({
        path: ['submissions', index, 'manuscriptId'],
        message: `Unknown manuscript ID "${record.manuscriptId}".`,
      })
    } else if (manuscript.projectId !== record.projectId) {
      issues.push({
        path: ['submissions', index, 'manuscriptId'],
        message: 'The submission and its manuscript belong to different projects.',
      })
    }
  })

  const reviewerCommentKeys = new Set<string>()
  data.reviewerComments.forEach((record, index) => {
    if (!submissionById.has(record.submissionId)) {
      issues.push({
        path: ['reviewerComments', index, 'submissionId'],
        message: `Unknown submission ID "${record.submissionId}".`,
      })
    }

    const scopedCommentId = `${record.submissionId}\u0000${record.commentId}`
    if (reviewerCommentKeys.has(scopedCommentId)) {
      issues.push({
        path: ['reviewerComments', index, 'commentId'],
        message: `Duplicate reviewer comment ID "${record.commentId}" for this submission.`,
      })
    }
    reviewerCommentKeys.add(scopedCommentId)
  })

  return issues
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface MigrationMetadata {
  id: string
  createdAt: string
  updatedAt: string
  isDemo: boolean
}

export interface V2ResearchGraphMigration {
  projects: unknown[]
  researchQuestions: ResearchQuestion[]
  claims: Claim[]
  claimQuestionLinks: []
}

function hasMigrationMetadata(record: Record<string, unknown>): record is Record<string, unknown> & MigrationMetadata {
  return (
    typeof record['id'] === 'string' &&
    typeof record['createdAt'] === 'string' &&
    typeof record['updatedAt'] === 'string' &&
    typeof record['isDemo'] === 'boolean'
  )
}

function legacyProjectResearchQuestionIssue(
  projectInput: unknown[],
): WorkspaceValidationIssue | null {
  for (let index = 0; index < projectInput.length; index += 1) {
    const project = projectInput[index]
    if (
      !isRecord(project) ||
      !Object.prototype.hasOwnProperty.call(project, 'researchQuestion') ||
      typeof project['researchQuestion'] !== 'string'
    ) {
      return {
        path: ['projects', index, 'researchQuestion'],
        message: 'Legacy workspace v2 projects require a string researchQuestion field.',
      }
    }
  }
  return null
}

/** A compact deterministic hash for migration IDs; collision suffixes are resolved below. */
function stableMigrationHash(value: string): string {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ (code + index), 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0)
    .toString(16)
    .padStart(8, '0')}`
}

function allocateMigrationId(
  kind: 'question' | 'claim',
  signature: string,
  allocated: Map<string, string>,
): string {
  const base = `migrated-${kind}-${stableMigrationHash(signature)}`
  let candidate = base
  let suffix = 2
  while (allocated.has(candidate) && allocated.get(candidate) !== signature) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  allocated.set(candidate, signature)
  return candidate
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Converts the two legacy text locations into first-class graph objects.
 *
 * Evidence.claim remains untouched as source context. Claims are deduplicated
 * only when their trimmed text is exactly equal inside the same project. No
 * question links are inferred, and records from different projects never merge.
 */
export function migrateV2ResearchGraphCollections(
  projectInput: unknown[],
  evidenceInput: unknown[],
): V2ResearchGraphMigration {
  const legacyProjectIssue = legacyProjectResearchQuestionIssue(projectInput)
  if (legacyProjectIssue) {
    throw new WorkspaceValidationError(
      'The legacy workspace cannot be migrated without losing project research-question data.',
      [legacyProjectIssue],
    )
  }

  const questionCandidates: Array<{
    signature: string
    projectId: string
    text: string
    metadata: MigrationMetadata
  }> = []

  const projects = projectInput.map((value) => {
    if (!isRecord(value)) {
      return value
    }

    const { researchQuestion, ...project } = value
    const normalizedText = typeof researchQuestion === 'string' ? researchQuestion.trim() : ''
    if (
      normalizedText.length > 0 &&
      hasMigrationMetadata(value) &&
      typeof value['id'] === 'string'
    ) {
      questionCandidates.push({
        signature: JSON.stringify([value['id'], normalizedText]),
        projectId: value['id'],
        text: normalizedText,
        metadata: {
          id: value['id'],
          createdAt: value['createdAt'],
          updatedAt: value['updatedAt'],
          isDemo: value['isDemo'],
        },
      })
    }
    return project
  })

  const allocatedQuestionIds = new Map<string, string>()
  const researchQuestions = questionCandidates
    .sort((left, right) => compareText(left.signature, right.signature))
    .map<ResearchQuestion>((candidate) => ({
      id: allocateMigrationId('question', candidate.signature, allocatedQuestionIds),
      projectId: candidate.projectId,
      text: candidate.text,
      status: 'active',
      notes: '',
      createdAt: candidate.metadata.createdAt,
      updatedAt: candidate.metadata.updatedAt,
      isDemo: candidate.metadata.isDemo,
    }))

  const groupedClaimSources = new Map<
    string,
    {
      signature: string
      projectId: string
      text: string
      sources: MigrationMetadata[]
    }
  >()
  evidenceInput.forEach((value) => {
    if (
      !isRecord(value) ||
      !hasMigrationMetadata(value) ||
      typeof value['projectId'] !== 'string' ||
      typeof value['claim'] !== 'string'
    ) {
      return
    }
    const normalizedText = value['claim'].trim()
    if (normalizedText.length === 0) {
      return
    }
    const signature = JSON.stringify([value['projectId'], normalizedText])
    const source: MigrationMetadata = {
      id: value['id'],
      createdAt: value['createdAt'],
      updatedAt: value['updatedAt'],
      isDemo: value['isDemo'],
    }
    const existing = groupedClaimSources.get(signature)
    if (existing) {
      existing.sources.push(source)
    } else {
      groupedClaimSources.set(signature, {
        signature,
        projectId: value['projectId'],
        text: normalizedText,
        sources: [source],
      })
    }
  })

  const allocatedClaimIds = new Map<string, string>()
  const claims = [...groupedClaimSources.values()]
    .sort((left, right) => compareText(left.signature, right.signature))
    .map<Claim>((candidate) => {
      const sortedSources = [...candidate.sources].sort((left, right) =>
        compareText(left.id, right.id),
      )
      const representative = sortedSources[0]
      if (!representative) {
        throw new Error('Claim migration candidate has no source records.')
      }
      return {
        id: allocateMigrationId('claim', candidate.signature, allocatedClaimIds),
        projectId: candidate.projectId,
        text: candidate.text,
        status: 'draft',
        notes: '',
        createdAt: representative.createdAt,
        updatedAt: representative.updatedAt,
        isDemo: sortedSources.every((source) => source.isDemo),
      }
    })

  return { projects, researchQuestions, claims, claimQuestionLinks: [] }
}

/**
 * v1 predates the application discriminator and optimistic revision token.
 * Preserve every legacy property so current strict validation still catches
 * unknown fields instead of silently dropping them during migration.
 */
export function migrateWorkspaceV1ToV2(input: unknown): unknown {
  if (!isRecord(input) || input['version'] !== 1) {
    return input
  }

  const workspace = input['workspace']
  return {
    ...input,
    application:
      input['application'] === undefined ? WORKSPACE_APPLICATION : input['application'],
    version: 2,
    workspace: isRecord(workspace)
      ? {
          ...workspace,
          revision: workspace['revision'] === undefined ? 0 : workspace['revision'],
        }
      : workspace,
  }
}

const WORKSPACE_SCHEMA_VERSION_V3 = 3 as const
const WORKSPACE_SCHEMA_VERSION_V4 = 4 as const

/** v2 introduces revisions; v3 introduces the first-class research graph. */
export function migrateWorkspaceV2ToV3(input: unknown): unknown {
  if (!isRecord(input) || input['version'] !== 2) {
    return input
  }

  // These names were not part of v2. Refuse an ambiguous/tampered v2 envelope
  // instead of silently replacing graph-shaped data during migration.
  if (
    ['researchQuestions', 'claims', 'claimQuestionLinks'].some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    )
  ) {
    return input
  }

  const projects = input['projects']
  const evidence = input['evidence']
  if (!Array.isArray(projects) || !Array.isArray(evidence)) {
    return { ...input, version: WORKSPACE_SCHEMA_VERSION_V3 }
  }

  // A v2 project always carried this required field. Keep a malformed legacy
  // envelope at v2 so strict validation rejects it instead of deleting an
  // unexpected/missing value while manufacturing a seemingly valid v3 file.
  if (legacyProjectResearchQuestionIssue(projects)) {
    return input
  }

  const graph = migrateV2ResearchGraphCollections(projects, evidence)
  return {
    ...input,
    version: WORKSPACE_SCHEMA_VERSION_V3,
    projects: graph.projects,
    researchQuestions: graph.researchQuestions,
    claims: graph.claims,
    claimQuestionLinks: graph.claimQuestionLinks,
  }
}

/** v4 adds an empty TheoryMemo collection without inferring research content. */
export function migrateWorkspaceV3ToV4(input: unknown): unknown {
  if (!isRecord(input) || input['version'] !== WORKSPACE_SCHEMA_VERSION_V3) {
    return input
  }

  // TheoryMemo did not exist in v3. Refuse an ambiguous/tampered envelope
  // rather than silently replacing data that claims to use the old version.
  if (Object.prototype.hasOwnProperty.call(input, 'theoryMemos')) {
    return input
  }

  return {
    ...input,
    version: WORKSPACE_SCHEMA_VERSION_V4,
    theoryMemos: [],
  }
}

/** v5 adds an empty Zotero provenance collection without inferring any links. */
export function migrateWorkspaceV4ToV5(input: unknown): unknown {
  if (!isRecord(input) || input['version'] !== WORKSPACE_SCHEMA_VERSION_V4) return input
  if (Object.prototype.hasOwnProperty.call(input, 'literatureExternalReferences')) return input

  return {
    ...input,
    version: WORKSPACE_SCHEMA_VERSION,
    literatureExternalReferences: [],
  }
}

function migrateLegacyWorkspace(input: unknown): unknown {
  return migrateWorkspaceV4ToV5(
    migrateWorkspaceV3ToV4(
      migrateWorkspaceV2ToV3(migrateWorkspaceV1ToV2(input)),
    ),
  )
}

/**
 * Validates both the JSON shape and the referential integrity of its research
 * graph. Legacy v1 envelopes are upgraded in memory before the same strict
 * validation; unknown properties remain rejected.
 */
export function validateWorkspace(input: unknown): WorkspaceValidationResult {
  const parsed = workspaceDataSchema.safeParse(migrateLegacyWorkspace(input))
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map((segment) =>
          typeof segment === 'number' ? segment : String(segment),
        ),
        message: issue.message,
      })),
    }
  }

  const data = parsed.data as WorkspaceData
  const duplicateIssues = [
    ...duplicateIdIssues('projects', data.projects),
    ...duplicateIdIssues('researchQuestions', data.researchQuestions),
    ...duplicateIdIssues('claims', data.claims),
    ...duplicateIdIssues('claimQuestionLinks', data.claimQuestionLinks),
    ...duplicateIdIssues('theoryMemos', data.theoryMemos),
    ...duplicateIdIssues('tasks', data.tasks),
    ...duplicateIdIssues('literature', data.literature),
    ...duplicateIdIssues('literatureExternalReferences', data.literatureExternalReferences),
    ...duplicateIdIssues('fieldSites', data.fieldSites),
    ...duplicateIdIssues('interviews', data.interviews),
    ...duplicateIdIssues('fieldVisits', data.fieldVisits),
    ...duplicateIdIssues('datasets', data.datasets),
    ...duplicateIdIssues('analysisRuns', data.analysisRuns),
    ...duplicateIdIssues('evidence', data.evidence),
    ...duplicateIdIssues('researchLogs', data.researchLogs),
    ...duplicateIdIssues('manuscripts', data.manuscripts),
    ...duplicateIdIssues('submissions', data.submissions),
    ...duplicateIdIssues('reviewerComments', data.reviewerComments),
  ]
  const issues = [...duplicateIssues, ...relationshipIssues(data)]

  if (issues.length > 0) {
    return { success: false, issues }
  }

  return { success: true, data, issues: [] }
}

/** Parses and validates an exported workspace without writing to IndexedDB. */
export function importWorkspaceJson(json: string): WorkspaceData {
  let input: unknown
  try {
    input = JSON.parse(json) as unknown
  } catch {
    throw new WorkspaceValidationError('The selected file is not valid JSON.', [
      { path: [], message: 'Invalid JSON syntax.' },
    ])
  }

  const result = validateWorkspace(input)
  if (!result.success) {
    throw new WorkspaceValidationError('The workspace file failed validation.', result.issues)
  }

  return result.data
}

/** Serializes a fully validated snapshot and refreshes its export timestamp. */
export function exportWorkspaceJson(workspace: WorkspaceData, pretty = true): string {
  const exportSnapshot: WorkspaceData = {
    ...workspace,
    exportedAt: new Date().toISOString(),
  }
  const result = validateWorkspace(exportSnapshot)
  if (!result.success) {
    throw new WorkspaceValidationError('The current workspace failed export validation.', result.issues)
  }

  return JSON.stringify(result.data, null, pretty ? 2 : 0)
}
