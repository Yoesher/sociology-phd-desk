import type { MessageKey } from './messages'
import type {
  AnalysisRunStatus,
  AnalysisSoftware,
  EvidenceType,
  FieldSiteStatus,
  InterviewStatus,
  LiteratureStatus,
  ManuscriptStatus,
  Priority,
  ProjectStatus,
  ResearchMethod,
  ReviewCommentSeverity,
  ReviewCommentStatus,
  SubmissionStatus,
  SupportLevel,
  TaskCategory,
  TaskStatus,
  WorkProductStatus,
} from '../models/domain'

export type LocalizedDomainValue =
  | ResearchMethod
  | ProjectStatus
  | TaskCategory
  | TaskStatus
  | Priority
  | LiteratureStatus
  | FieldSiteStatus
  | InterviewStatus
  | WorkProductStatus
  | AnalysisSoftware
  | AnalysisRunStatus
  | EvidenceType
  | SupportLevel
  | ManuscriptStatus
  | SubmissionStatus
  | ReviewCommentSeverity
  | ReviewCommentStatus

export const domainLabelKeys = {
  'Quantitative': 'enum.quantitative',
  'Qualitative': 'enum.qualitative',
  'Mixed Methods': 'enum.mixedMethods',
  'Theoretical': 'enum.theoretical',
  'Idea': 'enum.idea',
  'Design': 'enum.design',
  'Data / Fieldwork': 'enum.dataFieldwork',
  'Analysis': 'enum.analysis',
  'Writing': 'enum.writing',
  'Submission': 'enum.submission',
  'Revision': 'enum.revision',
  'Published': 'enum.published',
  'Archived': 'enum.archived',
  'Reading': 'enum.reading',
  'Fieldwork / Interview': 'enum.fieldworkInterview',
  'Research Administration': 'enum.researchAdministration',
  'To Do': 'enum.toDo',
  'In Progress': 'enum.inProgress',
  'Done': 'enum.done',
  'Deferred': 'enum.deferred',
  'Low': 'enum.low',
  'Medium': 'enum.medium',
  'High': 'enum.high',
  'Critical': 'enum.critical',
  'Inbox': 'enum.inbox',
  'To Read': 'enum.toRead',
  'Read': 'enum.read',
  'Cited': 'enum.cited',
  'Planned': 'enum.planned',
  'Active': 'enum.active',
  'Paused': 'enum.paused',
  'Completed': 'enum.completed',
  'Scheduled': 'enum.scheduled',
  'Cancelled': 'enum.cancelled',
  'Not Started': 'enum.notStarted',
  'Complete': 'enum.complete',
  'Not Applicable': 'enum.notApplicable',
  'Stata': 'enum.stata',
  'R': 'enum.r',
  'Python': 'enum.python',
  'Other': 'enum.other',
  'Running': 'enum.running',
  'Failed': 'enum.failed',
  'Superseded': 'enum.superseded',
  'Literature': 'enum.literature',
  'Quantitative Result': 'enum.quantitativeResult',
  'Interview': 'enum.interview',
  'Fieldnote': 'enum.fieldnote',
  'Policy / Document': 'enum.policyDocument',
  'Strong': 'enum.strong',
  'Moderate': 'enum.moderate',
  'Weak': 'enum.weak',
  'Contradictory': 'enum.contradictory',
  'Unclear': 'enum.unclear',
  'Outline': 'enum.outline',
  'Drafting': 'enum.drafting',
  'Internal Review': 'enum.internalReview',
  'Ready to Submit': 'enum.readyToSubmit',
  'Submitted': 'enum.submitted',
  'Under Review': 'enum.underReview',
  'Accepted': 'enum.accepted',
  'Rejected': 'enum.rejected',
  'Reworking': 'enum.reworking',
  'Preparing': 'enum.preparing',
  'Decision Received': 'enum.decisionReceived',
  'Withdrawn': 'enum.withdrawn',
  'Minor': 'enum.minor',
  'Major': 'enum.major',
  'Open': 'enum.open',
  'Addressing': 'enum.addressing',
  'Resolved': 'enum.resolved',
  'Rejected with Rationale': 'enum.rejectedWithRationale',
} satisfies Record<LocalizedDomainValue, MessageKey>
