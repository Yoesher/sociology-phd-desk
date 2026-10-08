/** Durable anonymous metadata and version-pinned research provenance. */
import type { EntityMetadata, EntityId, ISODateTime, TheoryMemo, Claim, EvidenceItem, SupportLevel } from './domain'

type Id = EntityId
type State = 'active' | 'archived' | 'withdrawn'
type EdgeState = 'active' | 'retired'
interface RecordBase extends EntityMetadata { projectId: Id }
interface RevisionBase extends RecordBase {
  revisionNo: number
  previousRevisionId?: Id
  changeReason: string
}
interface EdgeBase extends RecordBase { state: EdgeState }

// Shared, version-pinned Claim/Evidence/Manuscript provenance (payload v8).
export interface ClaimRevision extends RevisionBase {
  claimId: Id
  snapshot: Pick<Claim, 'text' | 'status' | 'notes'>
}
export interface EvidenceRevision extends RevisionBase {
  evidenceId: Id
  snapshot: Pick<EvidenceItem, 'claim' | 'evidenceType' | 'source' | 'locator' | 'finding' | 'supportLevel' | 'limitations' | 'manuscriptLocation'>
}
export interface EvidenceClaimLink extends EdgeBase {
  evidenceRevisionId: Id
  claimRevisionId: Id
  supportLevel: SupportLevel
  rationale: string
  limitations: string
}
export type EvidenceOriginV8 =
  | { kind: 'literature'; literatureId: Id; locator: string }
  | { kind: 'analysisRun'; analysisRunId: Id; locator: string }
  | { kind: 'interview'; interviewId: Id; locator: string }
  | { kind: 'fieldVisit'; fieldVisitId: Id; locator: string }
// This branch is added only at v9, with strict same-project validation.
export type EvidenceOriginV9 = EvidenceOriginV8 | { kind: 'sourceSegmentRevision'; segmentRevisionId: Id }
export interface EvidenceSourceLink extends EdgeBase {
  evidenceRevisionId: Id
  origin: EvidenceOriginV9
  role: 'primary' | 'corroborating' | 'context'
}
export interface ManuscriptAnchor extends RecordBase {
  manuscriptId: Id
  kind: 'section' | 'paragraph' | 'table' | 'figure'
  currentRevisionId: Id
  state: State
}
export interface ManuscriptAnchorRevision extends RevisionBase {
  anchorId: Id
  documentVersion: string
  sectionPath: string[]
  paragraphLabel?: string
  bookmarkToken?: string
  externalReferenceToken?: string
  locatorVerifiedAt?: ISODateTime
}
export interface ClaimManuscriptLink extends EdgeBase {
  claimRevisionId: Id
  anchorRevisionId: Id
  purpose: 'assertion' | 'discussion' | 'boundary' | 'counterargument'
}
export interface EvidenceUsage extends EdgeBase {
  evidenceClaimLinkId: Id
  claimManuscriptLinkId: Id
  useKind: 'summary' | 'quotation-reference' | 'table-reference' | 'context'
  note: string
}

// Qualitative analysis metadata (payload v9). No transcript/audio blobs.
export interface SamplingDimension extends RecordBase {
  label: string
  unit: 'household' | 'person' | 'episode' | 'group' | 'other'
  categories: Array<{ id: Id; label: string; retired: boolean }>
  state: State
}
export interface ResearchCase extends RecordBase {
  alias: string
  unit: SamplingDimension['unit']
  attributes: Array<{ dimensionId: Id; categoryId: Id }>
  state: State
}
export interface InterviewCaseLink extends EdgeBase {
  interviewId: Id
  caseId: Id
  role: 'primary' | 'member' | 'context'
}
export type SourceOwner = { kind: 'interview'; interviewId: Id } | { kind: 'fieldVisit'; fieldVisitId: Id }
export interface SourceReference extends RecordBase {
  alias: string
  sourceKind: 'transcript' | 'fieldnote' | 'qda-export-reference'
  owners: SourceOwner[]
  currentRevisionId: Id
  state: State
}
export type ExternalReference =
  | { kind: 'local-token'; token: string }
  | { kind: 'https-reference'; url: string }
  | { kind: 'qda-reference'; provider: 'nvivo' | 'maxqda' | 'atlas-ti' | 'other'; projectToken: string; sourceToken: string; objectToken?: string }
export interface SourceRevision extends RevisionBase {
  sourceReferenceId: Id
  versionLabel: string
  externalRef: ExternalReference
  contentDigest?: { algorithm: 'SHA-256'; value: string }
  researcherVerification: 'unverified' | 'verified'
}
export type SegmentLocator =
  | { kind: 'lineRange'; start: number; end: number }
  | { kind: 'pageParagraph'; page: number; paragraphStart: number; paragraphEnd: number }
  | { kind: 'timeRange'; startMs: number; endMs: number }
  | { kind: 'externalAnchor'; namespace: string; token: string }
export interface SourceSegment extends RecordBase {
  sourceReferenceId: Id
  label: string // short researcher-authored metadata, never a transcript quotation
  currentRevisionId: Id
  state: State
}
export interface SourceSegmentRevision extends RevisionBase {
  segmentId: Id
  sourceRevisionId: Id
  primaryLocator: SegmentLocator
  alternateLocators: SegmentLocator[]
  verification: 'unverified' | 'verified' | 'unresolved'
}
export interface QualitativeCode extends RecordBase {
  currentRevisionId: Id
  state: State
}
export interface QualitativeCodeRevision extends RevisionBase {
  codeId: Id
  label: string
  stage: 'initial' | 'theme'
  definition: string
  inclusion: string
  exclusion: string
}
export interface CodeRelation extends EdgeBase {
  fromCodeRevisionId: Id
  toCodeRevisionId: Id
  kind: 'groups' | 'related' | 'split-from' | 'merged-from'
  rationale: string
}
export interface CodingAssignment extends RecordBase {
  segmentRevisionId: Id
  codeRevisionId: Id
  researcherAlias: string
  state: 'active' | 'superseded' | 'retracted'
  previousAssignmentId?: Id
  rationale: string
}
// TheoryMemo remains the sole memo identity and editable current text.
export interface AnalyticalMemoFacet extends RecordBase {
  theoryMemoId: Id
  currentRevisionId: Id
  analysisKind: 'code-development' | 'case-comparison' | 'mechanism' | 'negative-case'
  state: State
}
export interface TheoryMemoRevision extends RevisionBase {
  theoryMemoId: Id
  snapshot: Pick<TheoryMemo, 'memoType' | 'title' | 'content' | 'relatedQuestionIds' | 'relatedClaimIds' | 'relatedLiteratureIds'>
}
export type MemoMaterial =
  | { kind: 'segmentRevision'; segmentRevisionId: Id }
  | { kind: 'codingAssignment'; assignmentId: Id }
  | { kind: 'codeRevision'; codeRevisionId: Id }
  | { kind: 'comparisonRun'; comparisonRunId: Id }
  | { kind: 'interview'; interviewId: Id }
  | { kind: 'fieldVisit'; fieldVisitId: Id }
  | { kind: 'researchCase'; caseId: Id }
export interface MemoMaterialLink extends EdgeBase {
  memoRevisionId: Id
  material: MemoMaterial
  role: 'observation' | 'interpretation' | 'rival' | 'boundary'
  note: string
}
export interface ClaimDerivationLink extends EdgeBase {
  claimRevisionId: Id
  memoRevisionId: Id
  rationale: string
}
export type CellState = 'present' | 'absent-reviewed' | 'not-examined' | 'not-applicable' | 'unresolved'
export interface ComparisonRun extends RecordBase {
  title: string
  frozenAt: ISODateTime
  researcherAlias: string
  caseSnapshots: Array<Pick<ResearchCase, 'id' | 'alias' | 'unit' | 'attributes'>>
  codeRevisionIds: Id[]
  eligibleInterviewIds: Id[]
  caseInterviewPairs: Array<{ caseId: Id; interviewId: Id }>
  assignmentStatesAtFreeze: Array<{ assignmentId: Id; state: CodingAssignment['state'] }>
  rule: { unit: ResearchCase['unit']; deduplicateBy: 'caseId'; includeSuperseded: boolean }
  cells: Array<{
    caseId: Id
    codeRevisionId: Id
    state: CellState
    assignmentIds: Id[]
    reviewedSegmentRevisionIds: Id[]
    reviewNote?: string
  }>
}
export interface QualitativeChangeEvent extends RecordBase {
  operation: 'create' | 'revise' | 'recode' | 'merge' | 'split' | 'archive' | 'withdraw' | 'unlink' | 'reanchor'
  affected: Array<{ collection: string; id: Id }>
  reason: string // contains no old sensitive text or transcript excerpts
  researcherAlias: string
}

export interface SharedProvenanceCollections {
  claimRevisions: ClaimRevision[]
  evidenceRevisions: EvidenceRevision[]
  evidenceClaimLinks: EvidenceClaimLink[]
  evidenceSourceLinks: EvidenceSourceLink[]
  manuscriptAnchors: ManuscriptAnchor[]
  manuscriptAnchorRevisions: ManuscriptAnchorRevision[]
  claimManuscriptLinks: ClaimManuscriptLink[]
  evidenceUsages: EvidenceUsage[]
}
export interface QualitativeCollections {
  samplingDimensions: SamplingDimension[]
  researchCases: ResearchCase[]
  interviewCaseLinks: InterviewCaseLink[]
  sourceReferences: SourceReference[]
  sourceRevisions: SourceRevision[]
  sourceSegments: SourceSegment[]
  sourceSegmentRevisions: SourceSegmentRevision[]
  qualitativeCodes: QualitativeCode[]
  qualitativeCodeRevisions: QualitativeCodeRevision[]
  codeRelations: CodeRelation[]
  codingAssignments: CodingAssignment[]
  analyticalMemoFacets: AnalyticalMemoFacet[]
  theoryMemoRevisions: TheoryMemoRevision[]
  memoMaterialLinks: MemoMaterialLink[]
  claimDerivationLinks: ClaimDerivationLink[]
  comparisonRuns: ComparisonRun[]
  qualitativeChangeEvents: QualitativeChangeEvent[]
}


export const SHARED_PROVENANCE_COLLECTION_KEYS = [
  'claimRevisions', 'evidenceRevisions', 'evidenceClaimLinks', 'evidenceSourceLinks',
  'manuscriptAnchors', 'manuscriptAnchorRevisions', 'claimManuscriptLinks', 'evidenceUsages',
] as const
export const QUALITATIVE_COLLECTION_KEYS = [
  'samplingDimensions', 'researchCases', 'interviewCaseLinks', 'sourceReferences', 'sourceRevisions',
  'sourceSegments', 'sourceSegmentRevisions', 'qualitativeCodes', 'qualitativeCodeRevisions',
  'codeRelations', 'codingAssignments', 'analyticalMemoFacets', 'theoryMemoRevisions',
  'memoMaterialLinks', 'claimDerivationLinks', 'comparisonRuns', 'qualitativeChangeEvents',
] as const
export const PROVENANCE_COLLECTION_KEYS = [...SHARED_PROVENANCE_COLLECTION_KEYS, ...QUALITATIVE_COLLECTION_KEYS] as const
export type ProvenanceCollectionKey = typeof PROVENANCE_COLLECTION_KEYS[number]
export const LEGACY_COLLECTION_KEYS = [
  'projects', 'researchQuestions', 'claims', 'claimQuestionLinks', 'theoryMemos', 'tasks',
  'literature', 'literatureExternalReferences', 'fieldSites', 'fieldMaps', 'interviews', 'fieldVisits',
  'datasets', 'analysisRuns', 'evidence', 'researchLogs', 'manuscripts', 'submissions', 'reviewerComments',
] as const
export const WORKSPACE_COLLECTION_KEYS = [...LEGACY_COLLECTION_KEYS, ...PROVENANCE_COLLECTION_KEYS] as const
export type WorkspaceCollectionKey = typeof WORKSPACE_COLLECTION_KEYS[number]
export function emptyProvenanceCollections(): SharedProvenanceCollections & QualitativeCollections {
  return Object.fromEntries(PROVENANCE_COLLECTION_KEYS.map(key => [key, []])) as unknown as SharedProvenanceCollections & QualitativeCollections
}
export const createEmptyProvenanceCollections = emptyProvenanceCollections
