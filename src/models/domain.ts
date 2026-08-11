/**
 * Durable domain contracts for the local Sociology PhD Desk workspace.
 *
 * Dates are serialized as ISO strings so a workspace can move between browsers
 * without losing information to a locale-specific parser.
 */
export type EntityId = string
export type ISODate = string
export type ISODateTime = string

export const WORKSPACE_SCHEMA_VERSION = 2 as const
export const WORKSPACE_APPLICATION = 'sociology-phd-desk' as const

export const RESEARCH_METHODS = [
  'Quantitative',
  'Qualitative',
  'Mixed Methods',
  'Theoretical',
] as const
export type ResearchMethod = (typeof RESEARCH_METHODS)[number]

export const PROJECT_STATUSES = [
  'Idea',
  'Design',
  'Data / Fieldwork',
  'Analysis',
  'Writing',
  'Submission',
  'Revision',
  'Published',
  'Archived',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const TASK_CATEGORIES = [
  'Reading',
  'Writing',
  'Analysis',
  'Fieldwork / Interview',
  'Submission',
  'Research Administration',
] as const
export type TaskCategory = (typeof TASK_CATEGORIES)[number]

export const TASK_STATUSES = ['To Do', 'In Progress', 'Done', 'Deferred'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const
export type Priority = (typeof PRIORITIES)[number]

export const LITERATURE_STATUSES = [
  'Inbox',
  'To Read',
  'Reading',
  'Read',
  'Cited',
  'Archived',
] as const
export type LiteratureStatus = (typeof LITERATURE_STATUSES)[number]

export const FIELD_SITE_STATUSES = ['Planned', 'Active', 'Paused', 'Completed', 'Archived'] as const
export type FieldSiteStatus = (typeof FIELD_SITE_STATUSES)[number]

export const INTERVIEW_STATUSES = ['Planned', 'Scheduled', 'Completed', 'Cancelled'] as const
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number]

export const WORK_PRODUCT_STATUSES = ['Not Started', 'In Progress', 'Complete', 'Not Applicable'] as const
export type WorkProductStatus = (typeof WORK_PRODUCT_STATUSES)[number]

export const ANALYSIS_SOFTWARE = ['Stata', 'R', 'Python', 'Other'] as const
export type AnalysisSoftware = (typeof ANALYSIS_SOFTWARE)[number]

export const ANALYSIS_RUN_STATUSES = ['Planned', 'Running', 'Completed', 'Failed', 'Superseded'] as const
export type AnalysisRunStatus = (typeof ANALYSIS_RUN_STATUSES)[number]

export const EVIDENCE_TYPES = [
  'Literature',
  'Quantitative Result',
  'Interview',
  'Fieldnote',
  'Policy / Document',
  'Other',
] as const
export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

export const SUPPORT_LEVELS = ['Strong', 'Moderate', 'Weak', 'Contradictory', 'Unclear'] as const
export type SupportLevel = (typeof SUPPORT_LEVELS)[number]

export const MANUSCRIPT_STATUSES = [
  'Idea',
  'Outline',
  'Drafting',
  'Internal Review',
  'Ready to Submit',
  'Submitted',
  'Under Review',
  'Revision',
  'Accepted',
  'Published',
  'Rejected',
  'Reworking',
] as const
export type ManuscriptStatus = (typeof MANUSCRIPT_STATUSES)[number]

export const SUBMISSION_STATUSES = [
  'Preparing',
  'Submitted',
  'Under Review',
  'Decision Received',
  'Revision',
  'Accepted',
  'Rejected',
  'Withdrawn',
] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export const REVIEW_COMMENT_SEVERITIES = ['Minor', 'Major', 'Critical'] as const
export type ReviewCommentSeverity = (typeof REVIEW_COMMENT_SEVERITIES)[number]

export const REVIEW_COMMENT_STATUSES = [
  'Open',
  'Addressing',
  'Resolved',
  'Rejected with Rationale',
] as const
export type ReviewCommentStatus = (typeof REVIEW_COMMENT_STATUSES)[number]

export interface EntityMetadata {
  id: EntityId
  createdAt: ISODateTime
  updatedAt: ISODateTime
  /** True only for bundled synthetic examples, never for user research data. */
  isDemo: boolean
}

export interface WorkspaceMeta extends EntityMetadata {
  name: string
  description?: string
  activeProjectId?: EntityId
  /** Monotonic local revision used for optimistic full-snapshot writes. */
  revision: number
  /** The focused research outcomes shown on Today; deliberately capped at three. */
  todayGoals: string[]
}

export interface ResearchProject extends EntityMetadata {
  title: string
  shortTitle: string
  researchQuestion: string
  topic: string
  method: ResearchMethod
  status: ProjectStatus
  startDate: ISODate
  targetDate?: ISODate
  notes: string
}

export interface ResearchTask extends EntityMetadata {
  title: string
  projectId: EntityId
  category: TaskCategory
  status: TaskStatus
  dueDate?: ISODate
  priority: Priority
  notes: string
}

export interface LiteratureItem extends EntityMetadata {
  title: string
  authors: string[]
  year?: number
  journal?: string
  doi?: string
  url?: string
  projectId: EntityId
  status: LiteratureStatus
  priority: Priority
  whyRead: string
  notes: string
}

export interface FieldSite extends EntityMetadata {
  nameOrAlias: string
  projectId: EntityId
  status: FieldSiteStatus
  notes: string
}

export interface Interview extends EntityMetadata {
  participantAlias: string
  projectId: EntityId
  fieldSiteId?: EntityId
  interviewDate?: ISODate
  status: InterviewStatus
  transcriptStatus: WorkProductStatus
  codingStatus: WorkProductStatus
  memoStatus: WorkProductStatus
  notes: string
}

export interface FieldVisit extends EntityMetadata {
  date: ISODate
  projectId: EntityId
  fieldSiteId: EntityId
  purpose: string
  observations: string
  followUp: string
  memo: string
}

export interface Dataset extends EntityMetadata {
  name: string
  wave: string
  source: string
  localPath?: string
  projectId: EntityId
  notes: string
}

export interface AnalysisRun extends EntityMetadata {
  projectId: EntityId
  date: ISODate
  software: AnalysisSoftware
  scriptPath?: string
  datasetId: EntityId
  sample: string
  model: string
  outcome: string
  keyPredictor: string
  status: AnalysisRunStatus
  resultSummary: string
  outputPath?: string
}

export interface EvidenceItem extends EntityMetadata {
  projectId: EntityId
  claim: string
  evidenceType: EvidenceType
  source: string
  locator: string
  finding: string
  supportLevel: SupportLevel
  limitations: string
  manuscriptLocation: string
}

export interface ResearchLogEntry extends EntityMetadata {
  date: ISODate
  projectId: EntityId
  whatChanged: string
  decision: string
  problem: string
  nextStep: string
}

export interface Manuscript extends EntityMetadata {
  title: string
  projectId: EntityId
  targetJournal: string
  status: ManuscriptStatus
  wordCount: number
  nextAction: string
  deadline?: ISODate
}

export interface Submission extends EntityMetadata {
  projectId: EntityId
  manuscriptId: EntityId
  journal: string
  submissionDate?: ISODate
  manuscriptVersion: string
  status: SubmissionStatus
  editorialStatus: string
  decisionDate?: ISODate
  decision?: string
  notes: string
}

export interface ReviewerComment extends EntityMetadata {
  submissionId: EntityId
  reviewer: string
  commentId: string
  comment: string
  severity: ReviewCommentSeverity
  response: string
  revisionAction: string
  status: ReviewCommentStatus
}

/**
 * Complete, portable workspace snapshot. Every persisted collection is included;
 * files referred to by local paths are never embedded in the JSON.
 */
export interface WorkspaceData {
  application: typeof WORKSPACE_APPLICATION
  version: typeof WORKSPACE_SCHEMA_VERSION
  exportedAt: ISODateTime
  workspace: WorkspaceMeta
  projects: ResearchProject[]
  tasks: ResearchTask[]
  literature: LiteratureItem[]
  fieldSites: FieldSite[]
  interviews: Interview[]
  fieldVisits: FieldVisit[]
  datasets: Dataset[]
  analysisRuns: AnalysisRun[]
  evidence: EvidenceItem[]
  researchLogs: ResearchLogEntry[]
  manuscripts: Manuscript[]
  submissions: Submission[]
  reviewerComments: ReviewerComment[]
}

/** Concise aliases make consumer code readable while retaining domain-rich names. */
export type Project = ResearchProject
export type Task = ResearchTask
export type Literature = LiteratureItem
export type Evidence = EvidenceItem
export type ResearchLog = ResearchLogEntry
