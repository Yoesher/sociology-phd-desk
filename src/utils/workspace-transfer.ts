import { z } from 'zod'
import {
  ANALYSIS_RUN_STATUSES,
  ANALYSIS_SOFTWARE,
  EVIDENCE_TYPES,
  FIELD_SITE_STATUSES,
  INTERVIEW_STATUSES,
  LITERATURE_STATUSES,
  MANUSCRIPT_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  RESEARCH_METHODS,
  REVIEW_COMMENT_SEVERITIES,
  REVIEW_COMMENT_STATUSES,
  SUBMISSION_STATUSES,
  SUPPORT_LEVELS,
  TASK_CATEGORIES,
  TASK_STATUSES,
  WORK_PRODUCT_STATUSES,
  WORKSPACE_APPLICATION,
  WORKSPACE_SCHEMA_VERSION,
} from '../models/domain'
import type { EntityMetadata, WorkspaceData } from '../models/domain'

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
    researchQuestion: textSchema,
    topic: shortTextSchema,
    method: z.enum(RESEARCH_METHODS),
    status: z.enum(PROJECT_STATUSES),
    startDate: isoDateSchema,
    targetDate: isoDateSchema.optional(),
    notes: textSchema,
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
    year: z.number().int().min(1000).max(2100).optional(),
    journal: titleSchema.optional(),
    doi: z.string().trim().min(1).max(500).optional(),
    url: urlSchema.optional(),
    projectId: idSchema,
    status: z.enum(LITERATURE_STATUSES),
    priority: z.enum(PRIORITIES),
    whyRead: textSchema,
    notes: textSchema,
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
    tasks: z.array(taskSchema),
    literature: z.array(literatureSchema),
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
  data.literature.forEach((record, index) => requireProject('literature', index, record.projectId))
  data.fieldSites.forEach((record, index) => requireProject('fieldSites', index, record.projectId))
  data.datasets.forEach((record, index) => requireProject('datasets', index, record.projectId))
  data.evidence.forEach((record, index) => requireProject('evidence', index, record.projectId))
  data.researchLogs.forEach((record, index) => requireProject('researchLogs', index, record.projectId))
  data.manuscripts.forEach((record, index) => requireProject('manuscripts', index, record.projectId))

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

/**
 * Validates both the JSON shape and the referential integrity of its research
 * graph. Unknown properties are rejected to catch unsupported schema versions.
 */
export function validateWorkspace(input: unknown): WorkspaceValidationResult {
  const parsed = workspaceDataSchema.safeParse(input)
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
    ...duplicateIdIssues('tasks', data.tasks),
    ...duplicateIdIssues('literature', data.literature),
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
