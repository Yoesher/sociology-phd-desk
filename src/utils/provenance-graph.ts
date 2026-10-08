import type { WorkspaceData } from '../models/domain'
import { PROVENANCE_COLLECTION_KEYS, WORKSPACE_COLLECTION_KEYS, type WorkspaceCollectionKey } from '../models/provenance'

export { PROVENANCE_COLLECTION_KEYS } from '../models/provenance'
export interface ProvenanceReference { collection: WorkspaceCollectionKey; id: string }
type Row = { id: string; projectId?: string } & Record<string, unknown>
type GraphMaps = Record<WorkspaceCollectionKey, Map<string, Row>>

export function canonicalProvenance(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalProvenance).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => JSON.stringify(key) + ':' + canonicalProvenance(item)).join(',') + '}'
  return JSON.stringify(value) ?? 'undefined'
}
const rowArray = (data: WorkspaceData, collection: WorkspaceCollectionKey): Row[] => data[collection] as unknown as Row[]
const materialTargets: Record<string, [WorkspaceCollectionKey, string]> = {
  segmentRevision: ['sourceSegmentRevisions', 'segmentRevisionId'], sourceSegmentRevision: ['sourceSegmentRevisions', 'segmentRevisionId'],
  codingAssignment: ['codingAssignments', 'assignmentId'], codeRevision: ['qualitativeCodeRevisions', 'codeRevisionId'],
  comparisonRun: ['comparisonRuns', 'comparisonRunId'], interview: ['interviews', 'interviewId'], fieldVisit: ['fieldVisits', 'fieldVisitId'],
  researchCase: ['researchCases', 'caseId'], literature: ['literature', 'literatureId'], analysisRun: ['analysisRuns', 'analysisRunId'],
}
const directReferences: Partial<Record<WorkspaceCollectionKey, Record<string, WorkspaceCollectionKey>>> = {
  claimRevisions: { claimId: 'claims', previousRevisionId: 'claimRevisions' }, evidenceRevisions: { evidenceId: 'evidence', previousRevisionId: 'evidenceRevisions' },
  evidenceClaimLinks: { evidenceRevisionId: 'evidenceRevisions', claimRevisionId: 'claimRevisions' }, evidenceSourceLinks: { evidenceRevisionId: 'evidenceRevisions' },
  manuscriptAnchors: { manuscriptId: 'manuscripts', currentRevisionId: 'manuscriptAnchorRevisions' }, manuscriptAnchorRevisions: { anchorId: 'manuscriptAnchors', previousRevisionId: 'manuscriptAnchorRevisions' },
  claimManuscriptLinks: { claimRevisionId: 'claimRevisions', anchorRevisionId: 'manuscriptAnchorRevisions' }, evidenceUsages: { evidenceClaimLinkId: 'evidenceClaimLinks', claimManuscriptLinkId: 'claimManuscriptLinks' },
  interviewCaseLinks: { interviewId: 'interviews', caseId: 'researchCases' }, sourceReferences: { currentRevisionId: 'sourceRevisions' },
  sourceRevisions: { sourceReferenceId: 'sourceReferences', previousRevisionId: 'sourceRevisions' }, sourceSegments: { sourceReferenceId: 'sourceReferences', currentRevisionId: 'sourceSegmentRevisions' },
  sourceSegmentRevisions: { segmentId: 'sourceSegments', sourceRevisionId: 'sourceRevisions', previousRevisionId: 'sourceSegmentRevisions' },
  qualitativeCodes: { currentRevisionId: 'qualitativeCodeRevisions' }, qualitativeCodeRevisions: { codeId: 'qualitativeCodes', previousRevisionId: 'qualitativeCodeRevisions' },
  codeRelations: { fromCodeRevisionId: 'qualitativeCodeRevisions', toCodeRevisionId: 'qualitativeCodeRevisions' }, codingAssignments: { segmentRevisionId: 'sourceSegmentRevisions', codeRevisionId: 'qualitativeCodeRevisions', previousAssignmentId: 'codingAssignments' },
  analyticalMemoFacets: { theoryMemoId: 'theoryMemos', currentRevisionId: 'theoryMemoRevisions' }, theoryMemoRevisions: { theoryMemoId: 'theoryMemos', previousRevisionId: 'theoryMemoRevisions' },
  memoMaterialLinks: { memoRevisionId: 'theoryMemoRevisions' }, claimDerivationLinks: { claimRevisionId: 'claimRevisions', memoRevisionId: 'theoryMemoRevisions' },
  interviews: { fieldSiteId: 'fieldSites' }, fieldVisits: { fieldSiteId: 'fieldSites' }, claimQuestionLinks: { claimId: 'claims', researchQuestionId: 'researchQuestions' },
  analysisRuns: { datasetId: 'datasets' }, submissions: { manuscriptId: 'manuscripts' }, reviewerComments: { submissionId: 'submissions' }, literatureExternalReferences: { literatureItemId: 'literature' },
}
/** All saved endpoints, including retired links and immutable historical snapshots. */
export function getProvenanceReferences(collection: WorkspaceCollectionKey, record: unknown): ProvenanceReference[] {
  const row = record as Row
  const result: ProvenanceReference[] = []
  const add = (target: WorkspaceCollectionKey, value: unknown) => { if (typeof value === 'string' && value) result.push({ collection: target, id: value }) }
  const material = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const item = value as Record<string, unknown>, target = materialTargets[String(item.kind)]
    if (target) add(target[0], item[target[1]])
  }
  if (row.projectId) add('projects', row.projectId)
  for (const [field, target] of Object.entries(directReferences[collection] ?? {})) add(target, row[field])
  if (collection === 'sourceReferences') for (const owner of row.owners as unknown[]) material(owner)
  if (collection === 'evidenceSourceLinks') material(row.origin)
  if (collection === 'memoMaterialLinks') material(row.material)
  const memo = collection === 'theoryMemos' ? row : collection === 'theoryMemoRevisions' ? row.snapshot as Record<string, unknown> : undefined
  if (memo) for (const [field, target] of [['relatedQuestionIds', 'researchQuestions'], ['relatedClaimIds', 'claims'], ['relatedLiteratureIds', 'literature']] as const) for (const value of memo[field] as string[]) add(target, value)
  if (collection === 'researchCases') for (const item of row.attributes as Array<{ dimensionId: string }>) add('samplingDimensions', item.dimensionId)
  if (collection === 'fieldMaps') for (const marker of row.markers as Array<{ fieldSiteId: string }>) add('fieldSites', marker.fieldSiteId)
  if (collection === 'comparisonRuns') {
    const run = record as WorkspaceData['comparisonRuns'][number]
    for (const snapshot of run.caseSnapshots) { add('researchCases', snapshot.id); for (const item of snapshot.attributes) add('samplingDimensions', item.dimensionId) }
    for (const value of run.codeRevisionIds) add('qualitativeCodeRevisions', value)
    for (const value of run.eligibleInterviewIds) add('interviews', value)
    for (const pair of run.caseInterviewPairs) { add('researchCases', pair.caseId); add('interviews', pair.interviewId) }
    for (const frozen of run.assignmentStatesAtFreeze) add('codingAssignments', frozen.assignmentId)
    for (const cell of run.cells) { add('researchCases', cell.caseId); add('qualitativeCodeRevisions', cell.codeRevisionId); for (const value of cell.assignmentIds) add('codingAssignments', value); for (const value of cell.reviewedSegmentRevisionIds) add('sourceSegmentRevisions', value) }
  }
  // Change events use typed existence-checked references. They deliberately store no old text.
  if (collection === 'qualitativeChangeEvents') for (const affected of row.affected as Array<{ collection: string; id: string }>) if (WORKSPACE_COLLECTION_KEYS.includes(affected.collection as WorkspaceCollectionKey)) add(affected.collection as WorkspaceCollectionKey, affected.id)
  return result
}
function graphMaps(data: WorkspaceData): GraphMaps {
  return Object.fromEntries(WORKSPACE_COLLECTION_KEYS.map(collection => [collection, new Map(rowArray(data, collection).map(row => [row.id, row]))])) as GraphMaps
}
function graphCycle(pairs: Array<[string, string]>): boolean {
  const adjacent = new Map<string, string[]>(), indegree = new Map<string, number>()
  for (const [left, right] of pairs) { const list = adjacent.get(left) ?? []; list.push(right); adjacent.set(left, list) }
  for (const [left, right] of pairs) { if (!indegree.has(left)) indegree.set(left, 0); indegree.set(right, (indegree.get(right) ?? 0) + 1) }
  const queue = [...indegree].filter(([, count]) => count === 0).map(([id]) => id)
  let visited = 0
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]!
    visited++
    for (const target of adjacent.get(id) ?? []) { const next = (indegree.get(target) ?? 0) - 1; indegree.set(target, next); if (next === 0) queue.push(target) }
  }
  return visited !== indegree.size
}
const picked = (row: Row, keys: string[]) => Object.fromEntries(keys.map(key => [key, row[key]]))
const revisionFamilies = [
  ['claimRevisions', 'claims', 'claimId'], ['evidenceRevisions', 'evidence', 'evidenceId'], ['manuscriptAnchorRevisions', 'manuscriptAnchors', 'anchorId'],
  ['sourceRevisions', 'sourceReferences', 'sourceReferenceId'], ['sourceSegmentRevisions', 'sourceSegments', 'segmentId'], ['qualitativeCodeRevisions', 'qualitativeCodes', 'codeId'], ['theoryMemoRevisions', 'theoryMemos', 'theoryMemoId'],
] as const
const snapshotFields = {
  claims: ['text', 'status', 'notes'], evidence: ['claim', 'evidenceType', 'source', 'locator', 'finding', 'supportLevel', 'limitations', 'manuscriptLocation'],
  theoryMemos: ['memoType', 'title', 'content', 'relatedQuestionIds', 'relatedClaimIds', 'relatedLiteratureIds'],
}

/** Must run on the complete workspace after strict structural parsing, before writes. */
export function validateProvenanceGraph(data: WorkspaceData): string[] {
  const errors: string[] = [], issue = (message: string) => errors.push(message)
  let count = 0
  for (const collection of WORKSPACE_COLLECTION_KEYS) {
    const rows = data[collection]
    if (!Array.isArray(rows)) { issue(`Missing collection: ${collection}`); continue }
    count += rows.length
    if (rows.length > 25_000) issue(`Collection capacity: ${collection}`)
    if (new Set(rows.map(row => row.id)).size !== rows.length) issue(`Duplicate ID: ${collection}`)
  }
  if (count > 100_000) issue('Workspace record capacity')
  if (errors.length) return errors
  const maps = graphMaps(data), get = (collection: WorkspaceCollectionKey, id: string): Row => maps[collection].get(id) as Row
  const projectFor = (collection: WorkspaceCollectionKey, row: Row): string | undefined => {
    if (collection === 'projects') return row.id
    if (row.projectId) return row.projectId
    if (collection === 'reviewerComments') return get('submissions', String(row.submissionId))?.projectId
    if (collection === 'literatureExternalReferences') return get('literature', String(row.literatureItemId))?.projectId
    return undefined
  }
  const ids = new Set<string>()
  for (const collection of WORKSPACE_COLLECTION_KEYS) if (!PROVENANCE_COLLECTION_KEYS.includes(collection as typeof PROVENANCE_COLLECTION_KEYS[number])) for (const row of rowArray(data, collection)) ids.add(row.id)
  for (const collection of PROVENANCE_COLLECTION_KEYS) for (const row of rowArray(data, collection)) {
    if (ids.has(row.id)) issue(`New identity collision: ${collection}/${row.id}`)
    ids.add(row.id)
  }
  for (const collection of WORKSPACE_COLLECTION_KEYS) for (const row of rowArray(data, collection)) for (const reference of getProvenanceReferences(collection, row)) {
    const target = get(reference.collection, reference.id)
    if (!target) issue(`Missing endpoint: ${collection}/${row.id} -> ${reference.collection}/${reference.id}`)
    else { const left = projectFor(collection, row), right = projectFor(reference.collection, target); if (left && right && left !== right) issue(`Cross-project endpoint: ${collection}/${row.id}`) }
  }
  if (errors.length) return errors
  const memoFacets = new Map(data.analyticalMemoFacets.map(facet => [facet.theoryMemoId, facet]))
  const memoHeads = new Map<string, string>()
  for (const [revisions, roots, parent] of revisionFamilies) {
    const grouped = new Map<string, Row[]>()
    for (const row of rowArray(data, revisions)) { const rootId = String(row[parent]), group = grouped.get(rootId) ?? []; group.push(row); grouped.set(rootId, group) }
    for (const root of rowArray(data, roots)) {
    const all = (grouped.get(root.id) ?? []).sort((left, right) => Number(left.revisionNo) - Number(right.revisionNo))
    if (roots === 'theoryMemos' && !memoFacets.has(root.id)) { if (all.length) issue(`Memo history requires facet: ${root.id}`); continue }
    if (!all.length) { issue(`Root lacks revision: ${roots}/${root.id}`); continue }
    all.forEach((row, index) => {
      if (row.revisionNo !== index + 1) issue(`Revision sequence: ${root.id}`)
      if ((row.previousRevisionId ?? null) !== (all[index - 1]?.id ?? null)) issue(`Revision predecessor: ${root.id}`)
      if (row.createdAt !== row.updatedAt) issue(`Immutable revision timestamp: ${row.id}`)
    })
    const head = all[all.length - 1] as Row
    if (roots === 'theoryMemos') memoHeads.set(root.id, head.id)
    if (root.currentRevisionId && root.currentRevisionId !== head.id) issue(`Current revision head: ${root.id}`)
    if (roots in snapshotFields && canonicalProvenance(picked(root, snapshotFields[roots as keyof typeof snapshotFields])) !== canonicalProvenance(head.snapshot)) issue(`Current snapshot mismatch: ${roots}/${root.id}`)
    }
  }
  if (new Set(data.analyticalMemoFacets.map(facet => facet.theoryMemoId)).size !== data.analyticalMemoFacets.length) issue('Duplicate analytical memo facet')
  for (const facet of data.analyticalMemoFacets) {
    if (facet.currentRevisionId !== memoHeads.get(facet.theoryMemoId)) issue(`Analytical memo head: ${facet.id}`)
  }
  const sourceFor = (revisionId: string) => {
    const segment = get('sourceSegmentRevisions', revisionId), revision = segment && get('sourceRevisions', String(segment.sourceRevisionId))
    return revision && get('sourceReferences', String(revision.sourceReferenceId))
  }
  const interviewOwners = (revisionId: string): string[] => {
    const source = sourceFor(revisionId)
    return source ? (source.owners as Array<{ kind: string; interviewId?: string }>).filter(owner => owner.kind === 'interview').map(owner => owner.interviewId as string) : []
  }
  const withdrawnOwners = new Set(data.sourceReferences.filter(source => source.state === 'withdrawn').flatMap(source => source.owners.map(owner => owner.kind === 'interview' ? `interview/${owner.interviewId}` : `fieldVisit/${owner.fieldVisitId}`)))
  const originWithdrawn = (origin: WorkspaceData['evidenceSourceLinks'][number]['origin']): boolean => {
    if (origin.kind === 'sourceSegmentRevision') {
      const revision = get('sourceSegmentRevisions', origin.segmentRevisionId), segment = get('sourceSegments', String(revision.segmentId))
      return sourceFor(origin.segmentRevisionId)?.state === 'withdrawn' || segment.state === 'withdrawn'
    }
    if (origin.kind === 'interview') return withdrawnOwners.has(`interview/${origin.interviewId}`)
    if (origin.kind === 'fieldVisit') return withdrawnOwners.has(`fieldVisit/${origin.fieldVisitId}`)
    return false
  }
  for (const source of data.sourceReferences) {
    if (!source.owners.length || new Set(source.owners.map(canonicalProvenance)).size !== source.owners.length) issue(`Source owners: ${source.id}`)
    if (source.sourceKind === 'transcript' && !source.owners.some(owner => owner.kind === 'interview')) issue(`Transcript interview owner: ${source.id}`)
  }
  for (const segment of data.sourceSegmentRevisions) if (get('sourceSegments', segment.segmentId).sourceReferenceId !== get('sourceRevisions', segment.sourceRevisionId).sourceReferenceId) issue(`Segment/source identity: ${segment.id}`)
  for (const relation of data.codeRelations) {
    const left = get('qualitativeCodeRevisions', relation.fromCodeRevisionId), right = get('qualitativeCodeRevisions', relation.toCodeRevisionId)
    if (relation.fromCodeRevisionId === relation.toCodeRevisionId || left.codeId === right.codeId) issue(`Code self-relation: ${relation.id}`)
    if (relation.kind === 'groups' && left.stage !== 'theme') issue(`Theme group parent: ${relation.id}`)
  }
  // Enforce cycles by stable code identity as well as pinned revision identity.
  if (graphCycle(data.codeRelations.filter(row => row.state === 'active' && row.kind === 'groups').map(row => [String(get('qualitativeCodeRevisions', row.fromCodeRevisionId).codeId), String(get('qualitativeCodeRevisions', row.toCodeRevisionId).codeId)]))) issue('Theme grouping cycle')
  if (graphCycle(data.codingAssignments.filter(row => row.previousAssignmentId).map(row => [row.id, row.previousAssignmentId as string]))) issue('Coding assignment predecessor cycle')
  for (const assignment of data.codingAssignments) {
    const segmentRevision = get('sourceSegmentRevisions', assignment.segmentRevisionId), segment = get('sourceSegments', String(segmentRevision.segmentId))
    if (assignment.state === 'active' && (sourceFor(assignment.segmentRevisionId)?.state === 'withdrawn' || segment.state === 'withdrawn')) issue(`Active coding on withdrawn source: ${assignment.id}`)
    if (assignment.previousAssignmentId) {
      const previous = get('codingAssignments', assignment.previousAssignmentId), previousSegment = get('sourceSegmentRevisions', String(previous.segmentRevisionId))
      if (previousSegment.segmentId !== segmentRevision.segmentId) issue(`Recode predecessor segment: ${assignment.id}`)
      if (previous.state === 'active') issue(`Recode predecessor remains active: ${assignment.id}`)
    }
  }
  for (const usage of data.evidenceUsages) {
    const evidenceLink = get('evidenceClaimLinks', usage.evidenceClaimLinkId), manuscriptLink = get('claimManuscriptLinks', usage.claimManuscriptLinkId)
    if (evidenceLink.claimRevisionId !== manuscriptLink.claimRevisionId) issue(`Evidence use claim mismatch: ${usage.id}`)
    if (usage.state === 'active' && (evidenceLink.state !== 'active' || manuscriptLink.state !== 'active')) issue(`Active use of retired link: ${usage.id}`)
    if (usage.state === 'active') {
      const anchorRevision = get('manuscriptAnchorRevisions', String(manuscriptLink.anchorRevisionId))
      if (get('manuscriptAnchors', String(anchorRevision.anchorId)).state === 'withdrawn') issue(`Active use of withdrawn anchor: ${usage.id}`)
    }
  }
  for (const link of data.evidenceSourceLinks) if (link.state === 'active' && originWithdrawn(link.origin)) issue(`Active evidence on withdrawn source: ${link.id}`)
  const withdrawnEvidenceRevisions = new Set(data.evidenceSourceLinks.filter(link => originWithdrawn(link.origin)).map(link => link.evidenceRevisionId))
  for (const link of data.evidenceClaimLinks) if (link.state === 'active' && withdrawnEvidenceRevisions.has(link.evidenceRevisionId)) issue(`Active claim support has withdrawn provenance: ${link.id}`)
  for (const derivation of data.claimDerivationLinks) {
    const revision = get('theoryMemoRevisions', derivation.memoRevisionId)
    if (!(revision.snapshot as { relatedClaimIds: string[] }).relatedClaimIds.includes(String(get('claimRevisions', derivation.claimRevisionId).claimId))) issue(`Memo snapshot lacks derived claim: ${derivation.id}`)
  }
  const uniqueSpecs: Partial<Record<WorkspaceCollectionKey, (row: Row) => unknown[]>> = {
    evidenceClaimLinks: row => [row.evidenceRevisionId, row.claimRevisionId], evidenceSourceLinks: row => [row.evidenceRevisionId, row.origin, row.role],
    claimManuscriptLinks: row => [row.claimRevisionId, row.anchorRevisionId, row.purpose], evidenceUsages: row => [row.evidenceClaimLinkId, row.claimManuscriptLinkId, row.useKind],
    codingAssignments: row => [row.segmentRevisionId, row.codeRevisionId, row.researcherAlias], memoMaterialLinks: row => [row.memoRevisionId, row.material, row.role], claimDerivationLinks: row => [row.claimRevisionId, row.memoRevisionId],
    interviewCaseLinks: row => [row.interviewId, row.caseId, row.role], codeRelations: row => row.kind === 'related' ? [...[row.fromCodeRevisionId, row.toCodeRevisionId].sort(), row.kind] : [row.fromCodeRevisionId, row.toCodeRevisionId, row.kind],
  }
  for (const [collection, key] of Object.entries(uniqueSpecs)) {
    const seen = new Set<string>()
    for (const row of rowArray(data, collection as WorkspaceCollectionKey).filter(row => row.state === 'active')) {
      const identity = canonicalProvenance([row.projectId, ...key(row)])
      if (seen.has(identity)) issue(`Duplicate active relation: ${collection}/${row.id}`)
      seen.add(identity)
    }
  }
  for (const dimension of data.samplingDimensions) if (new Set(dimension.categories.map(category => category.id)).size !== dimension.categories.length) issue(`Duplicate category ID: ${dimension.id}`)
  const categoryIds = new Map(data.samplingDimensions.map(dimension => [dimension.id, new Set(dimension.categories.map(category => category.id))]))
  const validateAttributes = (record: { id: string; unit: string; attributes: Array<{ dimensionId: string; categoryId: string }> }) => {
    const seen = new Set<string>()
    for (const attribute of record.attributes) {
      const dimension = get('samplingDimensions', attribute.dimensionId)
      if (!dimension || dimension.unit !== record.unit || !categoryIds.get(attribute.dimensionId)?.has(attribute.categoryId) || seen.has(attribute.dimensionId)) issue(`Case sampling category: ${record.id}`)
      seen.add(attribute.dimensionId)
    }
  }
  data.researchCases.forEach(validateAttributes)
  const savedPairs = new Set(data.interviewCaseLinks.map(row => canonicalProvenance([row.caseId, row.interviewId])))
  for (const run of data.comparisonRuns) {
    run.caseSnapshots.forEach(validateAttributes)
    if (new Set(run.caseSnapshots.map(row => row.id)).size !== run.caseSnapshots.length || new Set(run.codeRevisionIds).size !== run.codeRevisionIds.length || new Set(run.eligibleInterviewIds).size !== run.eligibleInterviewIds.length) issue(`Duplicate comparison selection: ${run.id}`)
    if (run.caseSnapshots.some(row => row.unit !== run.rule.unit)) issue(`Comparison unit mismatch: ${run.id}`)
    if (run.cells.length !== run.caseSnapshots.length * run.codeRevisionIds.length) issue(`Incomplete comparison matrix: ${run.id}`)
    if (run.cells.length > 10_000) issue(`Comparison matrix capacity: ${run.id}`)
    if (new Set(run.assignmentStatesAtFreeze.map(row => row.assignmentId)).size !== run.assignmentStatesAtFreeze.length || new Set(run.caseInterviewPairs.map(canonicalProvenance)).size !== run.caseInterviewPairs.length) issue(`Duplicate comparison frozen endpoint: ${run.id}`)
    const selectedCases = new Set(run.caseSnapshots.map(row => row.id)), selectedCodes = new Set(run.codeRevisionIds), eligibleInterviews = new Set(run.eligibleInterviewIds)
    const frozenPairs = new Set(run.caseInterviewPairs.map(row => canonicalProvenance([row.caseId, row.interviewId])))
    const frozenAssignments = new Map(run.assignmentStatesAtFreeze.map(row => [row.assignmentId, row.state]))
    for (const pair of run.caseInterviewPairs) if (!selectedCases.has(pair.caseId) || !eligibleInterviews.has(pair.interviewId) || !savedPairs.has(canonicalProvenance([pair.caseId, pair.interviewId]))) issue(`Comparison frozen membership: ${run.id}`)
    const owns = (caseId: string, segmentRevisionId: string) => interviewOwners(segmentRevisionId).some(interviewId => eligibleInterviews.has(interviewId) && frozenPairs.has(canonicalProvenance([caseId, interviewId])))
    const seen = new Set<string>()
    for (const cell of run.cells) {
      const key = cell.caseId + '/' + cell.codeRevisionId
      if (seen.has(key)) issue(`Duplicate comparison cell: ${run.id}`)
      seen.add(key)
      if (!selectedCases.has(cell.caseId) || !selectedCodes.has(cell.codeRevisionId)) issue(`Comparison cell outside selection: ${run.id}`)
      if (new Set(cell.assignmentIds).size !== cell.assignmentIds.length || new Set(cell.reviewedSegmentRevisionIds).size !== cell.reviewedSegmentRevisionIds.length) issue(`Duplicate comparison cell endpoint: ${run.id}`)
      if (cell.state === 'present' && !cell.assignmentIds.length) issue(`Present cell lacks coding: ${run.id}`)
      if (cell.state !== 'present' && cell.assignmentIds.length) issue(`Non-present cell has coding: ${run.id}`)
      if (cell.state === 'absent-reviewed' && (!cell.reviewNote?.trim() || !cell.reviewedSegmentRevisionIds.length)) issue(`Absence requires manual review: ${run.id}`)
      if ((cell.state === 'not-applicable' || cell.state === 'unresolved') && !cell.reviewNote?.trim()) issue(`Comparison state requires explanation: ${run.id}`)
      for (const assignmentId of cell.assignmentIds) {
        const assignment = get('codingAssignments', assignmentId), frozen = frozenAssignments.get(assignmentId)
        if (assignment.codeRevisionId !== cell.codeRevisionId || !frozen || frozen === 'retracted' || (!run.rule.includeSuperseded && frozen !== 'active') || !owns(cell.caseId, String(assignment.segmentRevisionId))) issue(`Comparison coding ownership: ${run.id}/${assignmentId}`)
      }
      for (const segmentId of cell.reviewedSegmentRevisionIds) if (!owns(cell.caseId, segmentId)) issue(`Comparison review ownership: ${run.id}/${segmentId}`)
    }
  }
  for (const event of data.qualitativeChangeEvents) for (const affected of event.affected) if (!WORKSPACE_COLLECTION_KEYS.includes(affected.collection as WorkspaceCollectionKey)) issue(`Unknown change-event collection: ${event.id}`)
  return errors
}
export function assertProvenanceGraph(data: WorkspaceData): WorkspaceData {
  const errors = validateProvenanceGraph(data)
  if (errors.length) throw new Error(errors.join('\n'))
  return data
}
/** Refuse identity or competing revision branches before the existing merge can keep local rows. */
export function assertProvenanceMergeCompatibility(current: WorkspaceData, incoming: WorkspaceData): void {
  for (const collection of PROVENANCE_COLLECTION_KEYS) {
    const local = new Map(rowArray(current, collection).map(row => [row.id, row]))
    for (const row of rowArray(incoming, collection)) {
      const previous = local.get(row.id)
      if (previous && canonicalProvenance(previous) !== canonicalProvenance(row)) throw new Error(`Provenance merge identity conflict: ${collection}/${row.id}`)
    }
  }
  for (const [collection, , parent] of revisionFamilies) {
    const local = new Map(rowArray(current, collection).map(row => [String(row[parent]) + ':' + row.revisionNo, row.id]))
    for (const row of rowArray(incoming, collection)) {
      const previousId = local.get(String(row[parent]) + ':' + row.revisionNo)
      if (previousId && previousId !== row.id) throw new Error(`Provenance merge revision branch: ${collection}/${row.id}`)
    }
  }
}
export function previewProvenanceDeletion(data: WorkspaceData, collection: WorkspaceCollectionKey, id: string) {
  const owned: ProvenanceReference[] = [{ collection, id }]
  const family = revisionFamilies.find(([, roots]) => roots === collection)
  if (family) for (const row of rowArray(data, family[0]).filter(row => row[family[2]] === id)) owned.push({ collection: family[0], id: row.id })
  if (collection === 'theoryMemos') for (const facet of data.analyticalMemoFacets.filter(row => row.theoryMemoId === id)) owned.push({ collection: 'analyticalMemoFacets', id: facet.id })
  const keys = new Set(owned.map(row => row.collection + '/' + row.id))
  const blockers: Array<ProvenanceReference & { state: string }> = []
  for (const candidate of WORKSPACE_COLLECTION_KEYS) for (const row of rowArray(data, candidate)) if (!keys.has(candidate + '/' + row.id) && getProvenanceReferences(candidate, row).some(reference => keys.has(reference.collection + '/' + reference.id))) blockers.push({ collection: candidate, id: row.id, state: String(row.state ?? 'historical/current') })
  return { protected: blockers.length > 0, blockers, owned }
}
export function traceEvidenceUsage(data: WorkspaceData, usageId: string) {
  const usage = data.evidenceUsages.find(row => row.id === usageId)
  if (!usage) return null
  const evidenceClaimLink = data.evidenceClaimLinks.find(row => row.id === usage.evidenceClaimLinkId)!, claimManuscriptLink = data.claimManuscriptLinks.find(row => row.id === usage.claimManuscriptLinkId)!
  const claimRevision = data.claimRevisions.find(row => row.id === claimManuscriptLink.claimRevisionId)!, anchorRevision = data.manuscriptAnchorRevisions.find(row => row.id === claimManuscriptLink.anchorRevisionId)!
  return {
    usage, evidenceClaimLink, claimManuscriptLink, claimRevision, anchorRevision,
    evidenceRevision: data.evidenceRevisions.find(row => row.id === evidenceClaimLink.evidenceRevisionId),
    manuscriptAnchor: data.manuscriptAnchors.find(row => row.id === anchorRevision.anchorId),
    derivations: data.claimDerivationLinks.filter(row => row.claimRevisionId === claimRevision.id),
    sources: data.evidenceSourceLinks.filter(row => row.evidenceRevisionId === evidenceClaimLink.evidenceRevisionId).map(link => {
      if (link.origin.kind !== 'sourceSegmentRevision') return { link, origin: link.origin }
      const segmentRevisionId = link.origin.segmentRevisionId
      const segmentRevision = data.sourceSegmentRevisions.find(row => row.id === segmentRevisionId)!, sourceRevision = data.sourceRevisions.find(row => row.id === segmentRevision.sourceRevisionId)!, sourceReference = data.sourceReferences.find(row => row.id === sourceRevision.sourceReferenceId)!
      return { link, origin: link.origin, segmentRevision, sourceRevision, sourceReference, assignments: data.codingAssignments.filter(row => row.segmentRevisionId === segmentRevision.id), currentSourceState: sourceReference.state }
    }),
  }
}
export function reverseSourceUsages(data: WorkspaceData, sourceReferenceId: string): string[] {
  return data.evidenceUsages.filter(usage => traceEvidenceUsage(data, usage.id)?.sources.some(source => 'sourceReference' in source && source.sourceReference?.id === sourceReferenceId)).map(usage => usage.id)
}
export function traceProvenance(data: WorkspaceData, start: ProvenanceReference, maxNodes = 200) {
  const maps = graphMaps(data), key = (reference: ProvenanceReference) => reference.collection + '/' + reference.id
  const adjacent = new Map<string, ProvenanceReference[]>()
  for (const collection of WORKSPACE_COLLECTION_KEYS) if (collection !== 'qualitativeChangeEvents') for (const row of rowArray(data, collection)) for (const target of getProvenanceReferences(collection, row).filter(reference => reference.collection !== 'projects')) {
    const from = { collection, id: row.id }
    const outgoing = adjacent.get(key(from)) ?? [], incoming = adjacent.get(key(target)) ?? []
    outgoing.push(target); incoming.push(from); adjacent.set(key(from), outgoing); adjacent.set(key(target), incoming)
  }
  const queue = [{ ...start, depth: 0 }], seen = new Set<string>(), nodes: Array<ProvenanceReference & { depth: number; record: unknown }> = []
  while (queue.length && nodes.length < maxNodes) {
    const current = queue.shift()!
    if (seen.has(key(current))) continue
    seen.add(key(current))
    const record = maps[current.collection].get(current.id)
    if (!record) continue
    nodes.push({ ...current, record })
    for (const target of adjacent.get(key(current)) ?? []) if (!seen.has(key(target))) queue.push({ ...target, depth: current.depth + 1 })
  }
  return { nodes, truncated: queue.length > 0 }
}
