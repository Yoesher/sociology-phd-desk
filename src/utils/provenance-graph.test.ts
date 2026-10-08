import { describe, expect, it } from 'vitest'
import syntheticWorkspace from '../test-fixtures/qualitative-workspace.json'
import type { WorkspaceData } from '../models/domain'
import { LEGACY_COLLECTION_KEYS, PROVENANCE_COLLECTION_KEYS, WORKSPACE_COLLECTION_KEYS } from '../models/provenance'
import { assertProvenanceGraph, assertProvenanceMergeCompatibility, previewProvenanceDeletion, reverseSourceUsages, traceEvidenceUsage, traceProvenance, validateProvenanceGraph } from './provenance-graph'
import { externalReferenceSchema, migrateWorkspaceV7ToV8, migrateWorkspaceV8ToV9, provenanceRowSchemas, segmentLocatorSchema, sharedProvenanceCollectionSchemas } from './provenance-schema'

const fixture = (): WorkspaceData => structuredClone(syntheticWorkspace) as WorkspaceData
const copyId = (id: string) => `test-${id}`

describe('complete version-pinned qualitative provenance', () => {
  it('accepts every collection of the entirely synthetic demonstration with strict record schemas', () => {
    const data = fixture()
    expect(WORKSPACE_COLLECTION_KEYS).toHaveLength(44)
    for (const key of PROVENANCE_COLLECTION_KEYS) for (const row of data[key]) expect(provenanceRowSchemas[key].safeParse(row).success, `${key}/${row.id}`).toBe(true)
    expect(validateProvenanceGraph(data)).toEqual([])
  })

  it('rejects missing retired or historical endpoints rather than pruning them', () => {
    const data = fixture(), historical = data.codingAssignments.find(row => row.state === 'superseded')!
    data.sourceSegmentRevisions = data.sourceSegmentRevisions.filter(row => row.id !== historical.segmentRevisionId)
    expect(validateProvenanceGraph(data).some(message => message.includes('Missing endpoint'))).toBe(true)
  })

  it('rejects cross-project source ownership', () => {
    const data = fixture(), original = data.projects[0]!
    data.projects.push({ ...original, id: 'test-other-project' })
    data.interviews[0]!.projectId = 'test-other-project'
    expect(validateProvenanceGraph(data).some(message => message.includes('Cross-project'))).toBe(true)
  })

  it('rejects new ID collisions with legacy records', () => {
    const data = fixture()
    data.codeRelations[0]!.id = data.interviews[0]!.id
    expect(validateProvenanceGraph(data).some(message => message.includes('identity collision'))).toBe(true)
  })

  it('rejects current Claim text changing without an appended immutable revision', () => {
    const data = fixture()
    data.claims[0]!.text = 'Synthetic revised hypothesis'
    expect(validateProvenanceGraph(data).some(message => message.includes('snapshot mismatch: claims'))).toBe(true)
  })

  it('requires every Claim and Evidence root to have a revision even before linking', () => {
    const data = fixture()
    data.claims.push({ ...data.claims[0]!, id: 'test-unversioned-claim' })
    data.evidence.push({ ...data.evidence[0]!, id: 'test-unversioned-evidence' })
    const issues = validateProvenanceGraph(data)
    expect(issues.some(message => message.includes('Root lacks revision: claims/test-unversioned-claim'))).toBe(true)
    expect(issues.some(message => message.includes('Root lacks revision: evidence/test-unversioned-evidence'))).toBe(true)
  })

  it('requires a contiguous same-root revision chain and current head', () => {
    const data = fixture(), revision = data.qualitativeCodeRevisions[0]!
    const next = { ...revision, id: copyId(revision.id), revisionNo: 99, previousRevisionId: revision.id }
    data.qualitativeCodeRevisions.push(next)
    const issues = validateProvenanceGraph(data)
    expect(issues.some(message => message.includes('Revision sequence'))).toBe(true)
    expect(issues.some(message => message.includes('Current revision head'))).toBe(true)
  })

  it('does not allow a transcript to silently become an ownerless reference', () => {
    const data = fixture()
    data.sourceReferences[0]!.owners = []
    expect(validateProvenanceGraph(data).some(message => message.includes('Source owners'))).toBe(true)
  })

  it('rejects a segment locator pinned to a different logical source', () => {
    const data = fixture(), segment = data.sourceSegmentRevisions[0]!
    const different = data.sourceRevisions.find(row => row.sourceReferenceId !== data.sourceSegments.find(root => root.id === segment.segmentId)!.sourceReferenceId)!
    segment.sourceRevisionId = different.id
    expect(validateProvenanceGraph(data).some(message => message.includes('Segment/source identity'))).toBe(true)
  })

  it('protects thematic grouping against cycles across different revisions', () => {
    const data = fixture(), initial = data.qualitativeCodeRevisions.find(row => row.stage === 'initial')!, theme = data.qualitativeCodeRevisions.find(row => row.stage === 'theme')!
    const oldRoot = data.qualitativeCodes.find(row => row.id === initial.codeId)!
    const oldRevisions = data.qualitativeCodeRevisions.filter(row => row.codeId === initial.codeId).sort((left, right) => right.revisionNo - left.revisionNo)
    const current = oldRevisions[0]!
    const newRevision = { ...current, id: 'test-theme-version', stage: 'theme' as const, revisionNo: current.revisionNo + 1, previousRevisionId: current.id }
    data.qualitativeCodeRevisions.push(newRevision); oldRoot.currentRevisionId = newRevision.id
    const relationBase = { ...data.codeRelations[0]!, kind: 'groups' as const, state: 'active' as const }
    data.codeRelations.push({ ...relationBase, id: 'test-group-a', fromCodeRevisionId: theme.id, toCodeRevisionId: initial.id }, { ...relationBase, id: 'test-group-b', fromCodeRevisionId: newRevision.id, toCodeRevisionId: theme.id })
    expect(validateProvenanceGraph(data).some(message => message.includes('Theme grouping cycle'))).toBe(true)
  })

  it('rejects a recode that leaves its previous application active', () => {
    const data = fixture(), revised = data.codingAssignments.find(row => row.previousAssignmentId)!
    data.codingAssignments.find(row => row.id === revised.previousAssignmentId)!.state = 'active'
    expect(validateProvenanceGraph(data).some(message => message.includes('predecessor remains active'))).toBe(true)
  })

  it('keeps existing coding on archived definitions available as historical material', () => {
    const data = fixture()
    data.qualitativeCodes.forEach(row => { row.state = 'archived' })
    expect(validateProvenanceGraph(data)).toEqual([])
  })

  it('rejects duplicate active coding by the same researcher but permits multiple distinct codes', () => {
    const data = fixture(), assignment = data.codingAssignments.find(row => row.state === 'active')!
    data.codingAssignments.push({ ...assignment, id: copyId(assignment.id), previousAssignmentId: undefined })
    expect(validateProvenanceGraph(data).some(message => message.includes('Duplicate active relation: codingAssignments'))).toBe(true)
  })

  it('prevents empirical Evidence usage attaching to a different Claim revision', () => {
    const data = fixture(), usage = data.evidenceUsages[0]!, manuscriptLink = data.claimManuscriptLinks.find(row => row.id === usage.claimManuscriptLinkId)!, claim = data.claimRevisions.find(row => row.id === manuscriptLink.claimRevisionId)!
    const different = { ...claim, id: 'test-claim-second-revision', revisionNo: 2, previousRevisionId: claim.id }
    data.claimRevisions.push(different); manuscriptLink.claimRevisionId = different.id
    expect(validateProvenanceGraph(data).some(message => message.includes('Evidence use claim mismatch'))).toBe(true)
  })

  it('does not let a retired evidence relation continue to provide an active paragraph use', () => {
    const data = fixture(), usage = data.evidenceUsages.find(row => row.state === 'active')!
    data.evidenceClaimLinks.find(row => row.id === usage.evidenceClaimLinkId)!.state = 'retired'
    expect(validateProvenanceGraph(data).some(message => message.includes('Active use of retired link'))).toBe(true)
  })

  it('blocks reactivation of withdrawn empirical origins even when their source links were retired', () => {
    const data = fixture(), originLink = data.evidenceSourceLinks.find(row => row.origin.kind === 'sourceSegmentRevision')!
    if (originLink.origin.kind !== 'sourceSegmentRevision') throw new Error('Fixture origin')
    const segmentRevisionId = originLink.origin.segmentRevisionId
    const segment = data.sourceSegmentRevisions.find(row => row.id === segmentRevisionId)!
    const source = data.sourceReferences.find(row => row.id === data.sourceRevisions.find(revision => revision.id === segment.sourceRevisionId)!.sourceReferenceId)!
    source.state = 'withdrawn'; originLink.state = 'retired'
    data.codingAssignments.forEach(row => { row.state = 'retracted' })
    expect(validateProvenanceGraph(data).some(message => message.includes('Active claim support has withdrawn provenance'))).toBe(true)
  })

  it('uses a single canonical TheoryMemo current body and one analytical facet', () => {
    const data = fixture(), facet = data.analyticalMemoFacets[0]!
    data.analyticalMemoFacets.push({ ...facet, id: copyId(facet.id) })
    expect(validateProvenanceGraph(data).some(message => message.includes('Duplicate analytical memo facet'))).toBe(true)
    data.analyticalMemoFacets.pop(); data.theoryMemos[0]!.content += 'Synthetic current change'
    expect(validateProvenanceGraph(data).some(message => message.includes('snapshot mismatch: theoryMemos'))).toBe(true)
  })

  it('distinguishes a Claim derivation from a general TheoryMemo association', () => {
    const data = fixture(), link = data.claimDerivationLinks[0]!, memoRevision = data.theoryMemoRevisions.find(row => row.id === link.memoRevisionId)!
    memoRevision.snapshot.relatedClaimIds = []
    expect(validateProvenanceGraph(data).some(message => message.includes('Memo snapshot lacks derived claim'))).toBe(true)
  })

  it('rejects automatic absence without recorded reviewed material and a manual explanation', () => {
    const data = fixture(), cell = data.comparisonRuns[0]!.cells[0]!
    cell.state = 'absent-reviewed'; cell.assignmentIds = []; cell.reviewedSegmentRevisionIds = []; cell.reviewNote = ''
    expect(validateProvenanceGraph(data).some(message => message.includes('Absence requires manual review'))).toBe(true)
  })

  it('checks reviewed segments belong to that frozen comparison case', () => {
    const data = fixture(), run = data.comparisonRuns[0]!, cell = run.cells.find(row => row.state === 'absent-reviewed')!
    const other = run.cells.find(row => row.caseId !== cell.caseId && row.assignmentIds.length)!
    cell.reviewedSegmentRevisionIds = [data.codingAssignments.find(row => row.id === other.assignmentIds[0])!.segmentRevisionId]
    expect(validateProvenanceGraph(data).some(message => message.includes('Comparison review ownership'))).toBe(true)
  })

  it('preserves valid comparison snapshots after current assignment and membership retirement', () => {
    const data = fixture()
    data.codingAssignments.forEach(row => { row.state = 'retracted' }); data.interviewCaseLinks.forEach(row => { row.state = 'retired' })
    expect(validateProvenanceGraph(data)).toEqual([])
  })

  it('does not silently omit comparison rows or conflate unknown with observed absence', () => {
    const data = fixture()
    data.comparisonRuns[0]!.cells.pop()
    expect(validateProvenanceGraph(data).some(message => message.includes('Incomplete comparison matrix'))).toBe(true)
  })

  it('protects obsolete code definitions referenced by historical assignments', () => {
    const data = fixture(), assignment = data.codingAssignments.find(row => row.state === 'superseded')!, code = data.qualitativeCodeRevisions.find(row => row.id === assignment.codeRevisionId)!
    const preview = previewProvenanceDeletion(data, 'qualitativeCodes', code.codeId)
    expect(preview.protected).toBe(true)
    expect(preview.blockers.some(row => row.collection === 'codingAssignments' && row.id === assignment.id)).toBe(true)
  })

  it('protects case and sampling category sources used by frozen comparisons', () => {
    const data = fixture(), run = data.comparisonRuns[0]!
    expect(previewProvenanceDeletion(data, 'researchCases', run.caseSnapshots[0]!.id).blockers.some(row => row.collection === 'comparisonRuns')).toBe(true)
    expect(previewProvenanceDeletion(data, 'samplingDimensions', run.caseSnapshots[0]!.attributes[0]!.dimensionId).protected).toBe(true)
  })

  it('traces an actual manuscript evidence use to its fixed source revision and backwards', () => {
    const data = fixture(), usage = data.evidenceUsages[0]!, trace = traceEvidenceUsage(data, usage.id)!
    expect(trace.claimRevision.id).toBe(trace.evidenceClaimLink.claimRevisionId)
    const source = trace.sources.find(row => 'sourceReference' in row && row.sourceReference)!
    if (!('sourceReference' in source) || !source.sourceReference) throw new Error('Synthetic source')
    expect(reverseSourceUsages(data, source.sourceReference.id)).toContain(usage.id)
    const graph = traceProvenance(data, { collection: 'sourceReferences', id: source.sourceReference.id })
    expect(graph.nodes.some(row => row.collection === 'evidenceUsages' && row.id === usage.id)).toBe(true)
    expect(graph.nodes.some(row => row.collection === 'projects')).toBe(false)
  })

  it('rejects same-ID different immutable definitions on merge', () => {
    const current = fixture(), incoming = fixture()
    incoming.qualitativeCodeRevisions[0]!.definition = 'Synthetic different definition'
    expect(() => assertProvenanceMergeCompatibility(current, incoming)).toThrow('identity conflict')
    expect(() => assertProvenanceMergeCompatibility(current, fixture())).not.toThrow()
  })

  it('rejects competing revision branches with different IDs for the same root revision number', () => {
    const current = fixture(), incoming = fixture()
    incoming.claimRevisions[0]!.id = 'test-branch-revision'
    expect(() => assertProvenanceMergeCompatibility(current, incoming)).toThrow('revision branch')
  })

  it('validates a capacity-sized collection of independent revision histories', () => {
    const original = fixture(), data = fixture(), claim = original.claims[0]!, revision = original.claimRevisions[0]!
    for (const key of WORKSPACE_COLLECTION_KEYS) data[key] = [] as never
    data.projects = [original.projects[0]!]
    for (let index = 0; index < 25_000; index++) {
      const rootId = `synthetic-scale-claim-${index}`
      data.claims.push({ ...claim, id: rootId })
      data.claimRevisions.push({ ...revision, id: `synthetic-scale-revision-${index}`, claimId: rootId, revisionNo: 1, previousRevisionId: undefined, snapshot: { text: claim.text, notes: claim.notes, status: claim.status } })
    }
    expect(validateProvenanceGraph(data)).toEqual([])
  })
})

describe('metadata privacy and format compatibility', () => {
  it('rejects raw transcript/audio/participant fields in new record schemas', () => {
    const source = fixture().sourceRevisions[0]!
    for (const extra of [{ transcript: 'Synthetic forbidden full text' }, { audioBase64: 'AAAA' }, { participantName: 'Synthetic identity field' }]) expect(provenanceRowSchemas.sourceRevisions.safeParse({ ...source, ...extra }).success).toBe(false)
    expect(provenanceRowSchemas.sourceRevisions.safeParse({ ...source, id: '   ' }).success).toBe(false)
    expect(externalReferenceSchema.safeParse({ kind: 'local-token', token: '   ' }).success).toBe(false)
  })

  it('permits NVivo object tokens and HTTPS, and refuses executable protocols or credential URLs', () => {
    expect(externalReferenceSchema.safeParse({ kind: 'qda-reference', provider: 'nvivo', projectToken: 'DEMO-P', sourceToken: 'DEMO-S', objectToken: 'DEMO-O' }).success).toBe(true)
    expect(externalReferenceSchema.safeParse({ kind: 'https-reference', url: 'https://example.invalid/reference' }).success).toBe(true)
    for (const url of ['javascript:alert(1)', 'data:text/plain,DEMO', 'file:///DEMO', 'https://name:secret@example.invalid']) expect(externalReferenceSchema.safeParse({ kind: 'https-reference', url }).success).toBe(false)
  })

  it('strictly validates positive ordered line/page ranges and nonempty time intervals', () => {
    for (const locator of [{ kind: 'lineRange', start: 0, end: 1 }, { kind: 'lineRange', start: 20, end: 2 }, { kind: 'pageParagraph', page: 1, paragraphStart: 3, paragraphEnd: 2 }, { kind: 'timeRange', startMs: 1000, endMs: 1000 }]) expect(segmentLocatorSchema.safeParse(locator).success).toBe(false)
    expect(segmentLocatorSchema.safeParse({ kind: 'timeRange', startMs: 0, endMs: 1000 }).success).toBe(true)
  })

  it('keeps v8 source origins restricted to available v8 entities', () => {
    const link = fixture().evidenceSourceLinks.find(row => row.origin.kind === 'sourceSegmentRevision')!
    expect(sharedProvenanceCollectionSchemas.evidenceSourceLinks.safeParse([link]).success).toBe(false)
  })

  it('migrates v7 exactly, seeds only Claim/Evidence revisions and never infers a text relation', () => {
    const data = fixture(), v7: Record<string, unknown> = Object.fromEntries(['application', 'version', 'exportedAt', 'workspace', ...LEGACY_COLLECTION_KEYS].map(key => [key, data[key as keyof WorkspaceData]]))
    v7.version = 7
    const untouched = structuredClone(v7), v8 = migrateWorkspaceV7ToV8(v7) as Record<string, unknown>, v9 = migrateWorkspaceV8ToV9(v8) as WorkspaceData
    expect(v7).toEqual(untouched)
    for (const key of LEGACY_COLLECTION_KEYS) expect(v9[key]).toEqual(v7[key])
    expect(v9.claimRevisions).toHaveLength(data.claims.length)
    expect(v9.evidenceRevisions).toHaveLength(data.evidence.length)
    expect(v9.evidenceClaimLinks).toEqual([])
    expect(v9.analyticalMemoFacets).toEqual([])
    expect(v9.theoryMemoRevisions).toEqual([])
    expect(assertProvenanceGraph(v9)).toBe(v9)
    expect(migrateWorkspaceV7ToV8(untouched)).toEqual(v8)
  })

  it('refuses unknown collections and partial-new-version masquerading as old backups', () => {
    const data = fixture(), old: Record<string, unknown> = Object.fromEntries(['application', 'version', 'exportedAt', 'workspace', ...LEGACY_COLLECTION_KEYS].map(key => [key, data[key as keyof WorkspaceData]]))
    old.version = 7
    expect(() => migrateWorkspaceV7ToV8({ ...old, qualitativeCodes: [] })).toThrow('Unknown workspace v7 field')
    expect(() => migrateWorkspaceV8ToV9({ ...data, version: 8 })).toThrow('Unknown workspace v8 field')
  })

  it('preserves the v7 accepted 250000-character research fields in revision snapshots', () => {
    const data = fixture(), text = 'x'.repeat(250_000)
    data.claims[0]!.text = text; data.claims[0]!.notes = text
    for (const field of ['claim', 'source', 'locator', 'finding', 'limitations', 'manuscriptLocation'] as const) data.evidence[0]![field] = text
    const old: Record<string, unknown> = Object.fromEntries(['application', 'version', 'exportedAt', 'workspace', ...LEGACY_COLLECTION_KEYS].map(key => [key, data[key as keyof WorkspaceData]])); old.version = 7
    const migrated = migrateWorkspaceV8ToV9(migrateWorkspaceV7ToV8(old)) as WorkspaceData
    expect(provenanceRowSchemas.claimRevisions.safeParse(migrated.claimRevisions.find(row => row.claimId === data.claims[0]!.id)).success).toBe(true)
    expect(provenanceRowSchemas.evidenceRevisions.safeParse(migrated.evidenceRevisions.find(row => row.evidenceId === data.evidence[0]!.id)).success).toBe(true)
    expect(migrated.claimRevisions[0]!.snapshot.text).toBe(text)
    const revision = fixture().theoryMemoRevisions[0]!
    expect(provenanceRowSchemas.theoryMemoRevisions.safeParse({ ...revision, snapshot: { ...revision.snapshot, title: 't'.repeat(1000), content: text } }).success).toBe(true)
    expect(validateProvenanceGraph(migrated)).toEqual([])
  })
})
