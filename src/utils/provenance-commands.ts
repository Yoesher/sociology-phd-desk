/** Pure full-snapshot commands. Persistence and revision increments belong to the repository CAS. */
import type { Claim, EvidenceItem, TheoryMemo, WorkspaceData } from '../models/domain'
import type {
  AnalyticalMemoFacet, CellState, CodeRelation, ComparisonRun, EvidenceClaimLink,
  EvidenceOriginV9, EvidenceUsage, ExternalReference, ManuscriptAnchor,
  ManuscriptAnchorRevision, MemoMaterial, MemoMaterialLink, QualitativeCodeRevision,
  ResearchCase, SamplingDimension, SegmentLocator, SourceOwner, SourceReference,
  TheoryMemoRevision,
} from '../models/provenance'
import { assertProvenanceGraph, previewProvenanceDeletion, PROVENANCE_COLLECTION_KEYS } from './provenance-graph'
import { provenanceCollectionSchemas } from './provenance-schema'
import { WORKSPACE_COLLECTION_KEYS } from '../models/provenance'

export interface ProvenanceCommandContext {
  expectedRevision?: number
  now?: string
  researcherAlias?: string
  reason?: string
  /** Intended for deterministic tests; production defaults to crypto.randomUUID(). */
  idFactory?: (prefix: string) => string
}
type NewId = { id?: string; projectId: string }
type CodeFields = Pick<QualitativeCodeRevision, 'label' | 'stage' | 'definition' | 'inclusion' | 'exclusion'>
type SourceFields = { versionLabel: string; externalRef: ExternalReference; contentDigest?: { algorithm: 'SHA-256'; value: string }; researcherVerification?: 'unverified' | 'verified' }
type LocatorFields = { sourceRevisionId: string; primaryLocator: SegmentLocator; alternateLocators?: SegmentLocator[]; verification?: 'unverified' | 'verified' | 'unresolved' }
type AnchorFields = Pick<ManuscriptAnchorRevision, 'documentVersion' | 'sectionPath' | 'paragraphLabel' | 'bookmarkToken' | 'externalReferenceToken' | 'locatorVerifiedAt'>
export type ComparisonReview = {
  caseId: string
  codeRevisionId: string
  state: Exclude<CellState, 'present'>
  reviewedSegmentRevisionIds: string[]
  reviewNote?: string
}
export type ArchivableCollection = 'sourceReferences' | 'sourceSegments' | 'qualitativeCodes' | 'samplingDimensions' | 'researchCases' | 'analyticalMemoFacets' | 'manuscriptAnchors'
export type RetirableCollection = 'evidenceClaimLinks' | 'evidenceSourceLinks' | 'claimManuscriptLinks' | 'evidenceUsages' | 'interviewCaseLinks' | 'codeRelations' | 'memoMaterialLinks' | 'claimDerivationLinks'
export type ProvenanceCommand = NewId & (
  | ({ type: 'registerSource'; alias: string; sourceKind: SourceReference['sourceKind']; owners: SourceOwner[] } & SourceFields)
  | ({ type: 'reviseSource'; sourceReferenceId: string } & SourceFields)
  | ({ type: 'createSegment'; sourceReferenceId: string; label: string } & LocatorFields)
  | ({ type: 'reviseSegment'; segmentId: string } & LocatorFields)
  | ({ type: 'createCode' } & CodeFields)
  | ({ type: 'reviseCode'; codeId: string } & CodeFields)
  | { type: 'relateCodes'; fromCodeRevisionId: string; toCodeRevisionId: string; kind: CodeRelation['kind']; rationale?: string }
  | { type: 'assignCode'; segmentRevisionId: string; codeRevisionId: string; rationale?: string }
  | { type: 'recodeAssignment'; assignmentId: string; codeRevisionId: string; segmentRevisionId?: string; rationale?: string }
  | { type: 'retractAssignment'; assignmentId: string }
  | ({ type: 'mergeCodes'; codeIds: string[] } & CodeFields)
  | { type: 'splitCode'; codeId: string; codes: Array<CodeFields & { id?: string }> }
  | { type: 'createDimension'; label: string; unit: SamplingDimension['unit']; categories: Array<{ id?: string; label: string }> }
  | { type: 'createCase'; alias: string; unit: ResearchCase['unit']; attributes?: ResearchCase['attributes'] }
  | { type: 'linkInterviewCase'; interviewId: string; caseId: string; role?: 'primary' | 'member' | 'context' }
  | { type: 'activateAnalyticalMemo'; theoryMemoId: string; analysisKind: AnalyticalMemoFacet['analysisKind'] }
  | { type: 'reviseAnalyticalMemo'; theoryMemoId: string; snapshot: TheoryMemoRevision['snapshot'] }
  | { type: 'linkMemoMaterial'; memoRevisionId: string; material: MemoMaterial; role: MemoMaterialLink['role']; note?: string }
  | { type: 'deriveClaim'; claimRevisionId: string; memoRevisionId: string; rationale?: string }
  | { type: 'linkEvidenceToClaim'; evidenceRevisionId: string; claimRevisionId: string; supportLevel: EvidenceClaimLink['supportLevel']; rationale?: string; limitations?: string }
  | { type: 'linkEvidenceSource'; evidenceRevisionId: string; origin: EvidenceOriginV9; role?: 'primary' | 'corroborating' | 'context' }
  | ({ type: 'createManuscriptAnchor'; manuscriptId: string; kind: ManuscriptAnchor['kind'] } & AnchorFields)
  | ({ type: 'reviseManuscriptAnchor'; anchorId: string } & AnchorFields)
  | { type: 'linkClaimToManuscript'; claimRevisionId: string; anchorRevisionId: string; purpose?: 'assertion' | 'discussion' | 'boundary' | 'counterargument' }
  | { type: 'useEvidenceAtAnchor'; evidenceClaimLinkId: string; anchorRevisionId: string; purpose?: 'assertion' | 'discussion' | 'boundary' | 'counterargument'; useKind?: EvidenceUsage['useKind']; note?: string }
  | { type: 'freezeComparison'; title: string; caseIds: string[]; codeRevisionIds: string[]; eligibleInterviewIds?: string[]; unit: ResearchCase['unit']; includeSuperseded?: boolean; reviews?: ComparisonReview[] }
  | { type: 'archiveRecord'; collection: ArchivableCollection; recordId: string }
  | { type: 'retireLink'; collection: RetirableCollection; linkId: string }
  | { type: 'withdrawSource'; sourceReferenceId: string }
)

const claimFields = ['text', 'status', 'notes'] as const
const evidenceFields = ['claim', 'evidenceType', 'source', 'locator', 'finding', 'supportLevel', 'limitations', 'manuscriptLocation'] as const
const memoFields = ['memoType', 'title', 'content', 'relatedQuestionIds', 'relatedClaimIds', 'relatedLiteratureIds'] as const
function pick<T, K extends keyof T>(record: T, fields: readonly K[]): Pick<T, K> {
  return Object.fromEntries(fields.map((key) => [key, structuredClone(record[key])])) as Pick<T, K>
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  return JSON.stringify(value)
}
function requireRecord<T extends readonly { id: string; projectId?: string }[]>(records: T, id: string, projectId: string): T[number] {
  const record = records.find((item) => item.id === id)
  if (!record || (record.projectId !== undefined && record.projectId !== projectId)) throw new Error('Missing or cross-project provenance endpoint')
  return record as T[number]
}
function requireActive(record: { state: string }): void {
  if (record.state !== 'active') throw new Error('Archived or withdrawn records cannot receive new active links')
}
function checkRevision(data: WorkspaceData, context: ProvenanceCommandContext): void {
  if (context.expectedRevision !== undefined && data.workspace.revision !== context.expectedRevision) throw new Error('Workspace revision conflict')
}
function assertCandidate(data: WorkspaceData): void {
  for (const collection of PROVENANCE_COLLECTION_KEYS) provenanceCollectionSchemas[collection].parse(data[collection])
  assertProvenanceGraph(data)
}
interface CommandLedger { ids: Set<string>; projectIds: Set<string> }
function commandLedger(data: WorkspaceData): CommandLedger {
  return { ids: new Set(WORKSPACE_COLLECTION_KEYS.flatMap((collection) => data[collection].map((record) => record.id))), projectIds: new Set(data.projects.map((project) => project.id)) }
}
function environment(data: WorkspaceData, projectId: string, context: ProvenanceCommandContext, ledger = commandLedger(data)) {
  if (!ledger.projectIds.has(projectId)) throw new Error('Missing provenance project')
  const now = context.now ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(now))) throw new Error('Invalid command timestamp')
  const alias = context.researcherAlias?.trim() || 'researcher'
  const reason = context.reason?.trim() || 'researcher metadata update'
  const id = context.idFactory ?? ((prefix: string) => `${prefix}_${crypto.randomUUID()}`)
  const base = (prefix: string, suppliedId?: string) => {
    const recordId = suppliedId ?? id(prefix)
    if (!recordId.trim()) throw new Error('Empty provenance ID')
    if (ledger.ids.has(recordId)) throw new Error('Provenance ID already exists')
    ledger.ids.add(recordId)
    return { id: recordId, projectId, createdAt: now, updatedAt: now, isDemo: false }
  }
  const event = (operation: WorkspaceData['qualitativeChangeEvents'][number]['operation'], affected: Array<{ collection: string; id: string }>) => {
    data.qualitativeChangeEvents.push({ ...base('change'), operation, affected, reason, researcherAlias: alias })
  }
  return { now, alias, reason, base, event }
}
function revisionHeads<T extends { revisionNo: number }>(rows: T[], parent: (row: T) => string): Map<string, T> {
  const result = new Map<string, T>()
  for (const row of rows) { const key = parent(row), head = result.get(key); if (!head || head.revisionNo < row.revisionNo) result.set(key, row) }
  return result
}

/** Return a complete candidate without mutating input or incrementing its persistence revision. */
export function applyProvenanceCommand(input: WorkspaceData, command: ProvenanceCommand, context: ProvenanceCommandContext = {}): WorkspaceData {
  checkRevision(input, context)
  if (command.type === 'freezeComparison' && (command.caseIds.length > 1_000 || command.codeRevisionIds.length > 1_000 || command.caseIds.length * command.codeRevisionIds.length > 10_000)) throw new Error('Comparison capacity: select at most 1,000 cases/codes and 10,000 cells')
  assertProvenanceGraph(input)
  const data = structuredClone(input)
  const env = environment(data, command.projectId, context)
  const { projectId } = command
  const { base, now, reason, alias, event } = env
  const affected: Array<{ collection: string; id: string }> = []
  const touch = (collection: string, id: string) => affected.push({ collection, id })
  const makeCode = (fields: CodeFields, suppliedId?: string) => {
    const root = { ...base('code', suppliedId), currentRevisionId: '', state: 'active' as const }
    const revision = { ...base('code-rev'), codeId: root.id, revisionNo: 1, changeReason: reason, ...pick(fields, ['label', 'stage', 'definition', 'inclusion', 'exclusion']) }
    root.currentRevisionId = revision.id
    data.qualitativeCodes.push(root)
    data.qualitativeCodeRevisions.push(revision)
    touch('qualitativeCodes', root.id); touch('qualitativeCodeRevisions', revision.id)
    return { root, revision }
  }
  const sourceOfSegmentRevision = (id: string) => {
    const revision = requireRecord(data.sourceSegmentRevisions, id, projectId)
    const sourceRevision = requireRecord(data.sourceRevisions, revision.sourceRevisionId, projectId)
    return requireRecord(data.sourceReferences, sourceRevision.sourceReferenceId, projectId)
  }
  const requireCodingTargets = (segmentRevisionId: string, codeRevisionId: string) => {
    const segmentRevision = requireRecord(data.sourceSegmentRevisions, segmentRevisionId, projectId)
    requireActive(requireRecord(data.sourceSegments, segmentRevision.segmentId, projectId))
    requireActive(sourceOfSegmentRevision(segmentRevisionId))
    const codeRevision = requireRecord(data.qualitativeCodeRevisions, codeRevisionId, projectId)
    requireActive(requireRecord(data.qualitativeCodes, codeRevision.codeId, projectId))
  }
  let operation: WorkspaceData['qualitativeChangeEvents'][number]['operation'] = 'create'
  switch (command.type) {
    case 'registerSource': {
      for (const owner of command.owners) requireRecord(owner.kind === 'interview' ? data.interviews : data.fieldVisits, owner.kind === 'interview' ? owner.interviewId : owner.fieldVisitId, projectId)
      const root = { ...base('source', command.id), alias: command.alias, sourceKind: command.sourceKind, owners: structuredClone(command.owners), currentRevisionId: '', state: 'active' as const }
      const revision = { ...base('source-rev'), sourceReferenceId: root.id, revisionNo: 1, changeReason: reason, versionLabel: command.versionLabel, externalRef: structuredClone(command.externalRef), ...(command.contentDigest ? { contentDigest: structuredClone(command.contentDigest) } : {}), researcherVerification: command.researcherVerification ?? 'unverified' }
      root.currentRevisionId = revision.id
      data.sourceReferences.push(root); data.sourceRevisions.push(revision)
      touch('sourceReferences', root.id); touch('sourceRevisions', revision.id)
      break
    }
    case 'reviseSource': {
      const root = requireRecord(data.sourceReferences, command.sourceReferenceId, projectId); requireActive(root)
      const previous = requireRecord(data.sourceRevisions, root.currentRevisionId, projectId)
      const revision = { ...base('source-rev', command.id), sourceReferenceId: root.id, revisionNo: previous.revisionNo + 1, previousRevisionId: previous.id, changeReason: reason, versionLabel: command.versionLabel, externalRef: structuredClone(command.externalRef), ...(command.contentDigest ? { contentDigest: structuredClone(command.contentDigest) } : {}), researcherVerification: command.researcherVerification ?? 'unverified' }
      data.sourceRevisions.push(revision); root.currentRevisionId = revision.id; root.updatedAt = now
      touch('sourceRevisions', revision.id); touch('sourceReferences', root.id); operation = 'revise'; break
    }
    case 'createSegment': {
      const source = requireRecord(data.sourceReferences, command.sourceReferenceId, projectId); requireActive(source)
      const sourceRevision = requireRecord(data.sourceRevisions, command.sourceRevisionId, projectId)
      if (sourceRevision.sourceReferenceId !== source.id) throw new Error('Segment source revision belongs to another source')
      const root = { ...base('segment', command.id), sourceReferenceId: source.id, label: command.label, currentRevisionId: '', state: 'active' as const }
      const revision = { ...base('segment-rev'), segmentId: root.id, sourceRevisionId: sourceRevision.id, revisionNo: 1, changeReason: reason, primaryLocator: structuredClone(command.primaryLocator), alternateLocators: structuredClone(command.alternateLocators ?? []), verification: command.verification ?? 'unverified' }
      root.currentRevisionId = revision.id; data.sourceSegments.push(root); data.sourceSegmentRevisions.push(revision)
      touch('sourceSegments', root.id); touch('sourceSegmentRevisions', revision.id); break
    }
    case 'reviseSegment': {
      const root = requireRecord(data.sourceSegments, command.segmentId, projectId); requireActive(root)
      requireActive(requireRecord(data.sourceReferences, root.sourceReferenceId, projectId))
      const previous = requireRecord(data.sourceSegmentRevisions, root.currentRevisionId, projectId)
      const sourceRevision = requireRecord(data.sourceRevisions, command.sourceRevisionId, projectId)
      if (sourceRevision.sourceReferenceId !== root.sourceReferenceId) throw new Error('Cannot move a segment into another source')
      const revision = { ...base('segment-rev', command.id), segmentId: root.id, sourceRevisionId: sourceRevision.id, revisionNo: previous.revisionNo + 1, previousRevisionId: previous.id, changeReason: reason, primaryLocator: structuredClone(command.primaryLocator), alternateLocators: structuredClone(command.alternateLocators ?? []), verification: command.verification ?? 'unverified' }
      data.sourceSegmentRevisions.push(revision); root.currentRevisionId = revision.id; root.updatedAt = now
      touch('sourceSegmentRevisions', revision.id); touch('sourceSegments', root.id); operation = 'reanchor'; break
    }
    case 'createCode': makeCode(command, command.id); break
    case 'reviseCode': {
      const root = requireRecord(data.qualitativeCodes, command.codeId, projectId); requireActive(root)
      const previous = requireRecord(data.qualitativeCodeRevisions, root.currentRevisionId, projectId)
      const revision = { ...base('code-rev', command.id), codeId: root.id, revisionNo: previous.revisionNo + 1, previousRevisionId: previous.id, changeReason: reason, ...pick(command, ['label', 'stage', 'definition', 'inclusion', 'exclusion']) }
      data.qualitativeCodeRevisions.push(revision); root.currentRevisionId = revision.id; root.updatedAt = now
      touch('qualitativeCodeRevisions', revision.id); touch('qualitativeCodes', root.id); operation = 'revise'; break
    }
    case 'relateCodes': {
      requireRecord(data.qualitativeCodeRevisions, command.fromCodeRevisionId, projectId); requireRecord(data.qualitativeCodeRevisions, command.toCodeRevisionId, projectId)
      const relation = { ...base('code-relation', command.id), fromCodeRevisionId: command.fromCodeRevisionId, toCodeRevisionId: command.toCodeRevisionId, kind: command.kind, rationale: command.rationale ?? '', state: 'active' as const }
      data.codeRelations.push(relation); touch('codeRelations', relation.id); break
    }
    case 'assignCode': {
      requireCodingTargets(command.segmentRevisionId, command.codeRevisionId)
      const assignment = { ...base('assignment', command.id), segmentRevisionId: command.segmentRevisionId, codeRevisionId: command.codeRevisionId, researcherAlias: alias, state: 'active' as const, rationale: command.rationale ?? '' }
      data.codingAssignments.push(assignment); touch('codingAssignments', assignment.id); break
    }
    case 'recodeAssignment': {
      const previous = requireRecord(data.codingAssignments, command.assignmentId, projectId)
      if (previous.state !== 'active') throw new Error('Only active assignments can be recoded')
      const segmentRevisionId = command.segmentRevisionId ?? previous.segmentRevisionId
      requireCodingTargets(segmentRevisionId, command.codeRevisionId)
      const oldSegment = requireRecord(data.sourceSegmentRevisions, previous.segmentRevisionId, projectId)
      const newSegment = requireRecord(data.sourceSegmentRevisions, segmentRevisionId, projectId)
      if (oldSegment.segmentId !== newSegment.segmentId) throw new Error('Recoding cannot move to another logical segment')
      if (previous.codeRevisionId === command.codeRevisionId && previous.segmentRevisionId === segmentRevisionId) throw new Error('Recoding must change the pinned revision')
      const assignment = { ...base('assignment', command.id), segmentRevisionId, codeRevisionId: command.codeRevisionId, researcherAlias: alias, previousAssignmentId: previous.id, state: 'active' as const, rationale: command.rationale ?? '' }
      previous.state = 'superseded'; previous.updatedAt = now
      data.codingAssignments.push(assignment); touch('codingAssignments', previous.id); touch('codingAssignments', assignment.id); operation = 'recode'; break
    }
    case 'retractAssignment': {
      const assignment = requireRecord(data.codingAssignments, command.assignmentId, projectId)
      if (assignment.state === 'retracted') throw new Error('Coding assignment is already retracted')
      assignment.state = 'retracted'; assignment.updatedAt = now
      touch('codingAssignments', assignment.id); operation = 'unlink'; break
    }
    case 'mergeCodes': {
      if (new Set(command.codeIds).size !== command.codeIds.length || command.codeIds.length < 2) throw new Error('Merge requires at least two distinct codes')
      const roots = command.codeIds.map((id) => requireRecord(data.qualitativeCodes, id, projectId)); roots.forEach(requireActive)
      const merged = makeCode(command, command.id)
      for (const root of roots) {
        const relation = { ...base('code-relation'), fromCodeRevisionId: merged.revision.id, toCodeRevisionId: root.currentRevisionId, kind: 'merged-from' as const, rationale: reason, state: 'active' as const }
        data.codeRelations.push(relation); root.state = 'archived'; root.updatedAt = now
        touch('qualitativeCodes', root.id); touch('codeRelations', relation.id)
      }
      operation = 'merge'; break
    }
    case 'splitCode': {
      const root = requireRecord(data.qualitativeCodes, command.codeId, projectId); requireActive(root)
      if (command.codes.length < 2) throw new Error('Split requires at least two new codes')
      for (const fields of command.codes) {
        const split = makeCode(fields, fields.id)
        const relation = { ...base('code-relation'), fromCodeRevisionId: split.revision.id, toCodeRevisionId: root.currentRevisionId, kind: 'split-from' as const, rationale: reason, state: 'active' as const }
        data.codeRelations.push(relation); touch('codeRelations', relation.id)
      }
      root.state = 'archived'; root.updatedAt = now; touch('qualitativeCodes', root.id); operation = 'split'; break
    }
    case 'createDimension': {
      const dimension = { ...base('dimension', command.id), label: command.label, unit: command.unit, categories: command.categories.map((category) => ({ id: category.id ?? base('category').id, label: category.label, retired: false })), state: 'active' as const }
      data.samplingDimensions.push(dimension); touch('samplingDimensions', dimension.id); break
    }
    case 'createCase': {
      const record = { ...base('case', command.id), alias: command.alias, unit: command.unit, attributes: structuredClone(command.attributes ?? []), state: 'active' as const }
      data.researchCases.push(record); touch('researchCases', record.id); break
    }
    case 'linkInterviewCase': {
      requireRecord(data.interviews, command.interviewId, projectId); requireActive(requireRecord(data.researchCases, command.caseId, projectId))
      const link = { ...base('interview-case', command.id), interviewId: command.interviewId, caseId: command.caseId, role: command.role ?? 'primary', state: 'active' as const }
      data.interviewCaseLinks.push(link); touch('interviewCaseLinks', link.id); break
    }
    case 'activateAnalyticalMemo': {
      const memo = requireRecord(data.theoryMemos, command.theoryMemoId, projectId)
      if (data.analyticalMemoFacets.some((facet) => facet.theoryMemoId === memo.id)) throw new Error('Theory memo already has an analytical facet')
      const revision = { ...base('memo-rev'), theoryMemoId: memo.id, revisionNo: 1, changeReason: reason, snapshot: pick(memo, memoFields) }
      const facet = { ...base('memo-facet', command.id), theoryMemoId: memo.id, currentRevisionId: revision.id, analysisKind: command.analysisKind, state: 'active' as const }
      data.theoryMemoRevisions.push(revision); data.analyticalMemoFacets.push(facet)
      touch('theoryMemoRevisions', revision.id); touch('analyticalMemoFacets', facet.id); break
    }
    case 'reviseAnalyticalMemo': {
      const memo = requireRecord(data.theoryMemos, command.theoryMemoId, projectId)
      const facet = data.analyticalMemoFacets.find((item) => item.theoryMemoId === memo.id)
      if (!facet) throw new Error('Theory memo is not activated for analytical revisions')
      requireActive(facet)
      const previous = requireRecord(data.theoryMemoRevisions, facet.currentRevisionId, projectId)
      const revision = { ...base('memo-rev', command.id), theoryMemoId: memo.id, revisionNo: previous.revisionNo + 1, previousRevisionId: previous.id, changeReason: reason, snapshot: structuredClone(command.snapshot) }
      Object.assign(memo, structuredClone(command.snapshot), { updatedAt: now }); data.theoryMemoRevisions.push(revision); facet.currentRevisionId = revision.id; facet.updatedAt = now
      touch('theoryMemos', memo.id); touch('theoryMemoRevisions', revision.id); touch('analyticalMemoFacets', facet.id); operation = 'revise'; break
    }
    case 'linkMemoMaterial': {
      requireRecord(data.theoryMemoRevisions, command.memoRevisionId, projectId)
      const link = { ...base('memo-material', command.id), memoRevisionId: command.memoRevisionId, material: structuredClone(command.material), role: command.role, note: command.note ?? '', state: 'active' as const }
      data.memoMaterialLinks.push(link); touch('memoMaterialLinks', link.id); break
    }
    case 'deriveClaim': {
      const claimRevision = requireRecord(data.claimRevisions, command.claimRevisionId, projectId)
      const memoRevision = requireRecord(data.theoryMemoRevisions, command.memoRevisionId, projectId)
      let pinnedMemo = memoRevision
      if (!memoRevision.snapshot.relatedClaimIds.includes(claimRevision.claimId)) {
        const memo = requireRecord(data.theoryMemos, memoRevision.theoryMemoId, projectId)
        const facet = data.analyticalMemoFacets.find((item) => item.theoryMemoId === memo.id)
        if (!facet) throw new Error('Analytical memo facet is missing')
        requireActive(facet)
        if (facet.currentRevisionId !== memoRevision.id) throw new Error('Add the general claim association to a current memo revision before deriving from a historical revision')
        memo.relatedClaimIds = [...memo.relatedClaimIds, claimRevision.claimId]; memo.updatedAt = now
        pinnedMemo = { ...base('memo-rev'), theoryMemoId: memo.id, revisionNo: memoRevision.revisionNo + 1, previousRevisionId: memoRevision.id, changeReason: reason, snapshot: pick(memo, memoFields) }
        data.theoryMemoRevisions.push(pinnedMemo); facet.currentRevisionId = pinnedMemo.id; facet.updatedAt = now
        touch('theoryMemos', memo.id); touch('theoryMemoRevisions', pinnedMemo.id); touch('analyticalMemoFacets', facet.id)
      }
      const link = { ...base('claim-derivation', command.id), claimRevisionId: claimRevision.id, memoRevisionId: pinnedMemo.id, rationale: command.rationale ?? '', state: 'active' as const }
      data.claimDerivationLinks.push(link); touch('claimDerivationLinks', link.id); break
    }
    case 'linkEvidenceToClaim': {
      requireRecord(data.evidenceRevisions, command.evidenceRevisionId, projectId); requireRecord(data.claimRevisions, command.claimRevisionId, projectId)
      const link = { ...base('evidence-claim', command.id), evidenceRevisionId: command.evidenceRevisionId, claimRevisionId: command.claimRevisionId, supportLevel: command.supportLevel, rationale: command.rationale ?? '', limitations: command.limitations ?? '', state: 'active' as const }
      data.evidenceClaimLinks.push(link); touch('evidenceClaimLinks', link.id); break
    }
    case 'linkEvidenceSource': {
      requireRecord(data.evidenceRevisions, command.evidenceRevisionId, projectId)
      if (command.origin.kind === 'sourceSegmentRevision') requireActive(sourceOfSegmentRevision(command.origin.segmentRevisionId))
      const link = { ...base('evidence-source', command.id), evidenceRevisionId: command.evidenceRevisionId, origin: structuredClone(command.origin), role: command.role ?? 'primary', state: 'active' as const }
      data.evidenceSourceLinks.push(link); touch('evidenceSourceLinks', link.id); break
    }
    case 'createManuscriptAnchor': {
      requireRecord(data.manuscripts, command.manuscriptId, projectId)
      const root = { ...base('anchor', command.id), manuscriptId: command.manuscriptId, kind: command.kind, currentRevisionId: '', state: 'active' as const }
      const revision = { ...base('anchor-rev'), anchorId: root.id, revisionNo: 1, changeReason: reason, ...pick(command, ['documentVersion', 'sectionPath', 'paragraphLabel', 'bookmarkToken', 'externalReferenceToken', 'locatorVerifiedAt']) }
      root.currentRevisionId = revision.id; data.manuscriptAnchors.push(root); data.manuscriptAnchorRevisions.push(revision)
      touch('manuscriptAnchors', root.id); touch('manuscriptAnchorRevisions', revision.id); break
    }
    case 'reviseManuscriptAnchor': {
      const root = requireRecord(data.manuscriptAnchors, command.anchorId, projectId); requireActive(root)
      const previous = requireRecord(data.manuscriptAnchorRevisions, root.currentRevisionId, projectId)
      const revision = { ...base('anchor-rev', command.id), anchorId: root.id, revisionNo: previous.revisionNo + 1, previousRevisionId: previous.id, changeReason: reason, ...pick(command, ['documentVersion', 'sectionPath', 'paragraphLabel', 'bookmarkToken', 'externalReferenceToken', 'locatorVerifiedAt']) }
      data.manuscriptAnchorRevisions.push(revision); root.currentRevisionId = revision.id; root.updatedAt = now
      touch('manuscriptAnchors', root.id); touch('manuscriptAnchorRevisions', revision.id); operation = 'reanchor'; break
    }
    case 'linkClaimToManuscript': {
      requireRecord(data.claimRevisions, command.claimRevisionId, projectId)
      const revision = requireRecord(data.manuscriptAnchorRevisions, command.anchorRevisionId, projectId)
      requireActive(requireRecord(data.manuscriptAnchors, revision.anchorId, projectId))
      const link = { ...base('claim-manuscript', command.id), claimRevisionId: command.claimRevisionId, anchorRevisionId: revision.id, purpose: command.purpose ?? 'assertion', state: 'active' as const }
      data.claimManuscriptLinks.push(link); touch('claimManuscriptLinks', link.id); break
    }
    case 'useEvidenceAtAnchor': {
      const evidenceLink = requireRecord(data.evidenceClaimLinks, command.evidenceClaimLinkId, projectId); requireActive(evidenceLink)
      const revision = requireRecord(data.manuscriptAnchorRevisions, command.anchorRevisionId, projectId)
      requireActive(requireRecord(data.manuscriptAnchors, revision.anchorId, projectId))
      let claimLink = data.claimManuscriptLinks.find((link) => link.state === 'active' && link.claimRevisionId === evidenceLink.claimRevisionId && link.anchorRevisionId === revision.id && link.purpose === (command.purpose ?? 'assertion'))
      if (!claimLink) {
        claimLink = { ...base('claim-manuscript'), claimRevisionId: evidenceLink.claimRevisionId, anchorRevisionId: revision.id, purpose: command.purpose ?? 'assertion', state: 'active' }
        data.claimManuscriptLinks.push(claimLink); touch('claimManuscriptLinks', claimLink.id)
      }
      const usage = { ...base('evidence-usage', command.id), evidenceClaimLinkId: evidenceLink.id, claimManuscriptLinkId: claimLink.id, useKind: command.useKind ?? 'summary', note: command.note ?? '', state: 'active' as const }
      data.evidenceUsages.push(usage); touch('evidenceUsages', usage.id); break
    }
    case 'freezeComparison': {
      if (!command.caseIds.length || !command.codeRevisionIds.length || new Set(command.caseIds).size !== command.caseIds.length || new Set(command.codeRevisionIds).size !== command.codeRevisionIds.length) throw new Error('Comparison requires distinct cases and code revisions')
      const selectedCaseIds = new Set(command.caseIds), selectedCodeIds = new Set(command.codeRevisionIds)
      const selectedInterviews = command.eligibleInterviewIds ? new Set(command.eligibleInterviewIds) : undefined
      const caseById = new Map(data.researchCases.map((record) => [record.id, record]))
      const cases = command.caseIds.map((id) => {
        const record = caseById.get(id)
        if (!record || record.projectId !== projectId) throw new Error('Missing or cross-project comparison case')
        requireActive(record); return record
      })
      if (cases.some((record) => record.unit !== command.unit)) throw new Error('Comparison unit mismatch')
      const codeById = new Map(data.qualitativeCodeRevisions.map((record) => [record.id, record]))
      for (const id of selectedCodeIds) if (codeById.get(id)?.projectId !== projectId) throw new Error('Missing or cross-project comparison code')
      const pairs = data.interviewCaseLinks.filter((link) => link.projectId === projectId && link.state === 'active' && selectedCaseIds.has(link.caseId) && (!selectedInterviews || selectedInterviews.has(link.interviewId))).map((link) => ({ caseId: link.caseId, interviewId: link.interviewId }))
      const eligibleInterviewIds = [...new Set(command.eligibleInterviewIds ?? pairs.map((pair) => pair.interviewId))]
      const interviewById = new Map(data.interviews.map((record) => [record.id, record]))
      for (const id of eligibleInterviewIds) if (interviewById.get(id)?.projectId !== projectId) throw new Error('Missing or cross-project comparison interview')
      const casesByInterview = new Map<string, Set<string>>()
      for (const pair of pairs) { let ids = casesByInterview.get(pair.interviewId); if (!ids) { ids = new Set(); casesByInterview.set(pair.interviewId, ids) }; ids.add(pair.caseId) }
      const sourceCases = new Map<string, Set<string>>()
      for (const source of data.sourceReferences) if (source.projectId === projectId && source.state !== 'withdrawn') {
        const ids = new Set<string>()
        for (const owner of source.owners) if (owner.kind === 'interview') for (const caseId of casesByInterview.get(owner.interviewId) ?? []) ids.add(caseId)
        sourceCases.set(source.id, ids)
      }
      const sourceRevisionById = new Map(data.sourceRevisions.map((revision) => [revision.id, revision]))
      const segmentById = new Map(data.sourceSegments.map((segment) => [segment.id, segment]))
      const casesBySegmentRevision = new Map<string, Set<string>>()
      for (const revision of data.sourceSegmentRevisions) if (revision.projectId === projectId && segmentById.get(revision.segmentId)?.state !== 'withdrawn') {
        const sourceId = sourceRevisionById.get(revision.sourceRevisionId)?.sourceReferenceId
        if (sourceId && sourceCases.has(sourceId)) casesBySegmentRevision.set(revision.id, sourceCases.get(sourceId)!)
      }
      const cellKey = (caseId: string, codeRevisionId: string) => JSON.stringify([caseId, codeRevisionId])
      const reviews = command.reviews ?? []
      const reviewsByCell = new Map(reviews.map((review) => [cellKey(review.caseId, review.codeRevisionId), review]))
      if (reviewsByCell.size !== reviews.length || reviews.some((review) => !selectedCaseIds.has(review.caseId) || !selectedCodeIds.has(review.codeRevisionId))) throw new Error('Comparison review outside selected matrix or duplicate review')
      const cells: ComparisonRun['cells'] = []
      const includedAssignments = new Map<string, WorkspaceData['codingAssignments'][number]>()
      const assignmentsByCell = new Map<string, WorkspaceData['codingAssignments']>()
      for (const assignment of data.codingAssignments) {
        if (assignment.projectId !== projectId || !selectedCodeIds.has(assignment.codeRevisionId) || assignment.state === 'retracted' || (!command.includeSuperseded && assignment.state !== 'active')) continue
        for (const caseId of casesBySegmentRevision.get(assignment.segmentRevisionId) ?? []) {
          const key = cellKey(caseId, assignment.codeRevisionId)
          let list = assignmentsByCell.get(key); if (!list) { list = []; assignmentsByCell.set(key, list) }; list.push(assignment)
          includedAssignments.set(assignment.id, assignment)
        }
      }
      for (const record of cases) for (const codeRevisionId of command.codeRevisionIds) {
        const key = cellKey(record.id, codeRevisionId)
        const assignments = assignmentsByCell.get(key) ?? []
        const review = reviewsByCell.get(key)
        if (assignments.length && review) throw new Error('A reviewed non-present cell conflicts with a selected assignment')
        if (review) for (const id of review.reviewedSegmentRevisionIds) if (!casesBySegmentRevision.get(id)?.has(record.id)) throw new Error('Reviewed material does not belong to the selected case')
        cells.push({ caseId: record.id, codeRevisionId, state: assignments.length ? 'present' : review?.state ?? 'not-examined', assignmentIds: assignments.map((assignment) => assignment.id), reviewedSegmentRevisionIds: structuredClone(review?.reviewedSegmentRevisionIds ?? []), ...(review?.reviewNote ? { reviewNote: review.reviewNote } : {}) })
      }
      const run = { ...base('comparison', command.id), title: command.title, frozenAt: now, researcherAlias: alias, caseSnapshots: cases.map((record) => pick(record, ['id', 'alias', 'unit', 'attributes'])), codeRevisionIds: [...command.codeRevisionIds], eligibleInterviewIds, caseInterviewPairs: [...new Map(pairs.map((pair) => [JSON.stringify([pair.caseId, pair.interviewId]), pair])).values()], assignmentStatesAtFreeze: [...includedAssignments.values()].map((assignment) => ({ assignmentId: assignment.id, state: assignment.state })), rule: { unit: command.unit, deduplicateBy: 'caseId' as const, includeSuperseded: command.includeSuperseded ?? false }, cells }
      data.comparisonRuns.push(run); touch('comparisonRuns', run.id); break
    }
    case 'retireLink': {
      const link = requireRecord(data[command.collection], command.linkId, projectId)
      requireActive(link); link.state = 'retired'; link.updatedAt = now; touch(command.collection, link.id)
      if (command.collection === 'evidenceClaimLinks' || command.collection === 'claimManuscriptLinks') {
        for (const usage of data.evidenceUsages.filter((usage) => usage.state === 'active' && (command.collection === 'evidenceClaimLinks' ? usage.evidenceClaimLinkId === link.id : usage.claimManuscriptLinkId === link.id))) { usage.state = 'retired'; usage.updatedAt = now; touch('evidenceUsages', usage.id) }
      }
      operation = 'unlink'; break
    }
    case 'archiveRecord': {
      const record = requireRecord(data[command.collection], command.recordId, projectId)
      requireActive(record); record.state = 'archived'; record.updatedAt = now
      touch(command.collection, record.id); operation = 'archive'; break
    }
    case 'withdrawSource': {
      const source = requireRecord(data.sourceReferences, command.sourceReferenceId, projectId)
      if (source.state === 'withdrawn') throw new Error('Source is already withdrawn')
      const sourceRevisionIds = new Set(data.sourceRevisions.filter((revision) => revision.sourceReferenceId === source.id).map((revision) => revision.id))
      const segmentRevisionIds = new Set(data.sourceSegmentRevisions.filter((revision) => sourceRevisionIds.has(revision.sourceRevisionId)).map((revision) => revision.id))
      const assignmentIds = new Set(data.codingAssignments.filter((assignment) => segmentRevisionIds.has(assignment.segmentRevisionId)).map((assignment) => assignment.id))
      const affectedOrigin = (origin: EvidenceOriginV9) => (origin.kind === 'sourceSegmentRevision' && segmentRevisionIds.has(origin.segmentRevisionId)) || (origin.kind === 'interview' && source.owners.some((owner) => owner.kind === 'interview' && owner.interviewId === origin.interviewId)) || (origin.kind === 'fieldVisit' && source.owners.some((owner) => owner.kind === 'fieldVisit' && owner.fieldVisitId === origin.fieldVisitId))
      const evidenceRevisionIds = new Set(data.evidenceSourceLinks.filter((link) => affectedOrigin(link.origin)).map((link) => link.evidenceRevisionId))
      source.state = 'withdrawn'; source.updatedAt = now; touch('sourceReferences', source.id)
      for (const segment of data.sourceSegments.filter((segment) => segment.sourceReferenceId === source.id)) { segment.state = 'withdrawn'; segment.updatedAt = now; touch('sourceSegments', segment.id) }
      for (const assignment of data.codingAssignments.filter((assignment) => assignmentIds.has(assignment.id) && assignment.state === 'active')) { assignment.state = 'retracted'; assignment.updatedAt = now; touch('codingAssignments', assignment.id) }
      for (const link of data.evidenceSourceLinks.filter((link) => link.state === 'active' && affectedOrigin(link.origin))) { link.state = 'retired'; link.updatedAt = now; touch('evidenceSourceLinks', link.id) }
      const affectedEvidenceLinks = new Set(data.evidenceClaimLinks.filter((link) => evidenceRevisionIds.has(link.evidenceRevisionId)).map((link) => link.id))
      for (const link of data.evidenceClaimLinks.filter((link) => link.state === 'active' && affectedEvidenceLinks.has(link.id))) { link.state = 'retired'; link.updatedAt = now; touch('evidenceClaimLinks', link.id) }
      for (const usage of data.evidenceUsages.filter((usage) => usage.state === 'active' && affectedEvidenceLinks.has(usage.evidenceClaimLinkId))) { usage.state = 'retired'; usage.updatedAt = now; touch('evidenceUsages', usage.id) }
      for (const link of data.memoMaterialLinks.filter((link) => link.state === 'active' && ((link.material.kind === 'segmentRevision' && segmentRevisionIds.has(link.material.segmentRevisionId)) || (link.material.kind === 'codingAssignment' && assignmentIds.has(link.material.assignmentId))))) { link.state = 'retired'; link.updatedAt = now; touch('memoMaterialLinks', link.id) }
      operation = 'withdraw'; break
    }
  }
  event(operation, affected)
  assertCandidate(data)
  return data
}

const immutableCollections = ['claimRevisions', 'evidenceRevisions', 'manuscriptAnchorRevisions', 'sourceRevisions', 'sourceSegmentRevisions', 'qualitativeCodeRevisions', 'theoryMemoRevisions', 'comparisonRuns', 'qualitativeChangeEvents'] as const
const stateOnlyCollections = ['evidenceClaimLinks', 'evidenceSourceLinks', 'claimManuscriptLinks', 'evidenceUsages', 'interviewCaseLinks', 'codeRelations', 'codingAssignments', 'memoMaterialLinks', 'claimDerivationLinks'] as const
const stableRootFields = {
  claims: ['projectId', 'createdAt'], evidence: ['projectId', 'createdAt'], theoryMemos: ['projectId', 'createdAt'],
  sourceReferences: ['projectId', 'createdAt', 'owners', 'sourceKind'],
  sourceSegments: ['projectId', 'createdAt', 'sourceReferenceId'],
  manuscriptAnchors: ['projectId', 'createdAt', 'manuscriptId', 'kind'],
  analyticalMemoFacets: ['projectId', 'createdAt', 'theoryMemoId', 'analysisKind'],
  qualitativeCodes: ['projectId', 'createdAt'],
  researchCases: ['projectId', 'createdAt', 'unit'],
  samplingDimensions: ['projectId', 'createdAt', 'unit'],
} as const

/** Preserve old forms while recording each Claim/Evidence/activated TheoryMemo edit as a new snapshot. */
export function reconcileProvenanceRootEdits(previous: WorkspaceData, candidate: WorkspaceData, context: ProvenanceCommandContext = {}): WorkspaceData {
  checkRevision(previous, context)
  const data = structuredClone(candidate)
  const permittedDeletes = new Set<string>()
  for (const collection of ['claims', 'evidence', 'theoryMemos'] as const) {
    const presentIds = new Set(data[collection].map((record) => record.id))
    for (const old of previous[collection]) if (!presentIds.has(old.id)) {
      const preview = previewProvenanceDeletion(previous, collection, old.id)
      if (preview.protected) throw new Error('Deletion blocked by current or historical provenance references')
      for (const owned of preview.owned) permittedDeletes.add(`${owned.collection}\0${owned.id}`)
    }
  }
  for (const collection of PROVENANCE_COLLECTION_KEYS) {
    const rows = data[collection] as Array<{ id: string }>
    for (let index = rows.length - 1; index >= 0; index--) if (permittedDeletes.has(`${collection}\0${rows[index].id}`)) rows.splice(index, 1)
  }
  for (const collection of immutableCollections) {
    const byId = new Map<string, unknown>(data[collection].map((row) => [row.id, row]))
    for (const row of previous[collection]) {
      const current = byId.get(row.id)
      if ((!current && !permittedDeletes.has(`${collection}\0${row.id}`)) || (current && canonical(row) !== canonical(current))) throw new Error('Immutable provenance history cannot be changed or discarded')
    }
  }
  for (const collection of stateOnlyCollections) {
    const byId = new Map<string, unknown>(data[collection].map((row) => [row.id, row]))
    const stable = (value: unknown) => Object.fromEntries(Object.entries(value as object).filter(([key]) => key !== 'state' && key !== 'updatedAt' && key !== 'isDemo'))
    for (const row of previous[collection]) {
      const current = byId.get(row.id)
      if (!current || (!row.isDemo && (current as { isDemo: boolean }).isDemo) || canonical(stable(row)) !== canonical(stable(current))) throw new Error('Provenance endpoints cannot be overwritten or silently removed')
    }
  }
  for (const collection of Object.keys(stableRootFields) as Array<keyof typeof stableRootFields>) {
    const byId = new Map<string, unknown>(data[collection].map((row) => [row.id, row]))
    const stable = (value: unknown) => Object.fromEntries(stableRootFields[collection].map((field) => [field, (value as Record<string, unknown>)[field]]))
    for (const row of previous[collection]) {
      const current = byId.get(row.id)
      if ((!current && !permittedDeletes.has(`${collection}\0${row.id}`)) || (current && ((!row.isDemo && (current as { isDemo: boolean }).isDemo) || canonical(stable(row)) !== canonical(stable(current))))) throw new Error('Stable provenance root endpoints cannot be overwritten or silently removed')
    }
  }
  const claimHeads = revisionHeads(data.claimRevisions, (revision) => revision.claimId)
  const evidenceHeads = revisionHeads(data.evidenceRevisions, (revision) => revision.evidenceId)
  const memoHeads = revisionHeads(data.theoryMemoRevisions, (revision) => revision.theoryMemoId)
  const facetsByMemo = new Map(data.analyticalMemoFacets.map((facet) => [facet.theoryMemoId, facet]))
  const ledger = commandLedger(data)
  const environments = new Map<string, ReturnType<typeof environment>>()
  const projectEnvironment = (projectId: string) => {
    let env = environments.get(projectId)
    if (!env) { env = environment(data, projectId, context, ledger); environments.set(projectId, env) }
    return env
  }
  const appendClaim = (root: Claim) => {
    const snapshot = pick(root, claimFields)
    const head = claimHeads.get(root.id)
    if (head && canonical(head.snapshot) === canonical(snapshot)) return
    const env = projectEnvironment(root.projectId)
    const revision = { ...env.base('claim-rev'), isDemo: root.isDemo, claimId: root.id, revisionNo: (head?.revisionNo ?? 0) + 1, ...(head ? { previousRevisionId: head.id } : {}), changeReason: env.reason, snapshot }
    data.claimRevisions.push(revision); claimHeads.set(root.id, revision)
  }
  const appendEvidence = (root: EvidenceItem) => {
    const snapshot = pick(root, evidenceFields)
    const head = evidenceHeads.get(root.id)
    if (head && canonical(head.snapshot) === canonical(snapshot)) return
    const env = projectEnvironment(root.projectId)
    const revision = { ...env.base('evidence-rev'), isDemo: root.isDemo, evidenceId: root.id, revisionNo: (head?.revisionNo ?? 0) + 1, ...(head ? { previousRevisionId: head.id } : {}), changeReason: env.reason, snapshot }
    data.evidenceRevisions.push(revision); evidenceHeads.set(root.id, revision)
  }
  const appendMemo = (root: TheoryMemo) => {
    const facet = facetsByMemo.get(root.id)
    if (!facet) return
    const snapshot = pick(root, memoFields)
    const head = memoHeads.get(root.id)
    if (head && canonical(head.snapshot) === canonical(snapshot)) return
    const env = projectEnvironment(root.projectId)
    const revision = { ...env.base('memo-rev'), isDemo: root.isDemo, theoryMemoId: root.id, revisionNo: (head?.revisionNo ?? 0) + 1, ...(head ? { previousRevisionId: head.id } : {}), changeReason: env.reason, snapshot }
    data.theoryMemoRevisions.push(revision); memoHeads.set(root.id, revision); facet.currentRevisionId = revision.id; facet.updatedAt = env.now
  }
  data.claims.forEach(appendClaim); data.evidence.forEach(appendEvidence); data.theoryMemos.forEach(appendMemo)
  assertCandidate(data)
  return data
}
