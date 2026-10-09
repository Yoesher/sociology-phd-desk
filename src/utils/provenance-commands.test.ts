import { describe, expect, it } from 'vitest'
import { createEmptyWorkspace } from '../models/empty-workspace'
import { applyProvenanceCommand, reconcileProvenanceRootEdits, type ComparisonReview, type ProvenanceCommand } from './provenance-commands'

const timestamp = '2026-10-08T09:00:00.000Z'
function fixture() {
  let counter = 0
  const context = { now: timestamp, researcherAlias: 'synthetic-researcher', reason: 'synthetic research decision', idFactory: (prefix: string) => `${prefix}_${++counter}` }
  const empty = createEmptyWorkspace({ id: 'workspace-synthetic', now: new Date(timestamp) })
  const candidate = structuredClone(empty)
  const meta = (id: string) => ({ id, createdAt: timestamp, updatedAt: timestamp, isDemo: false })
  candidate.projects.push({ ...meta('project-synthetic'), title: 'Synthetic household study', shortTitle: 'Synthetic', topic: 'Synthetic sampling metadata', method: 'Qualitative', status: 'Analysis', startDate: '2026-10-08', notes: '' })
  for (const id of ['interview-a-1', 'interview-a-2', 'interview-b']) candidate.interviews.push({ ...meta(id), projectId: 'project-synthetic', participantAlias: id, status: 'Completed', transcriptStatus: 'Complete', codingStatus: 'In Progress', memoStatus: 'In Progress', notes: '' })
  candidate.claims.push({ ...meta('claim-synthetic'), projectId: 'project-synthetic', text: 'Synthetic tentative mechanism', status: 'draft', notes: '' })
  candidate.evidence.push({ ...meta('evidence-synthetic'), projectId: 'project-synthetic', claim: 'Existing legacy text', evidenceType: 'Interview', source: 'Anonymous metadata', locator: 'External only', finding: 'Synthetic analyst summary', supportLevel: 'Unclear', limitations: 'Synthetic', manuscriptLocation: '' })
  candidate.theoryMemos.push({ ...meta('memo-synthetic'), projectId: 'project-synthetic', memoType: 'mechanism', title: 'Synthetic memo', content: 'Researcher-authored synthetic interpretation', relatedQuestionIds: [], relatedClaimIds: [], relatedLiteratureIds: [] })
  candidate.manuscripts.push({ ...meta('manuscript-synthetic'), projectId: 'project-synthetic', title: 'Synthetic manuscript', targetJournal: '', status: 'Drafting', wordCount: 0, nextAction: '' })
  let data = reconcileProvenanceRootEdits(empty, candidate, context)
  const run = (command: Omit<ProvenanceCommand, 'projectId'>) => {
    data = applyProvenanceCommand(data, { ...command, projectId: 'project-synthetic' } as ProvenanceCommand, { ...context, expectedRevision: data.workspace.revision })
    return data
  }
  const source = (id = 'source-a', interviewId = 'interview-a-1') => run({ type: 'registerSource', id, alias: id, sourceKind: 'transcript', owners: [{ kind: 'interview', interviewId }], versionLabel: 'synthetic-v1', externalRef: { kind: 'qda-reference', provider: 'nvivo', projectToken: 'synthetic-project', sourceToken: id } } as Omit<ProvenanceCommand, 'projectId'>)
  const segment = (id = 'segment-a', sourceId = 'source-a') => run({ type: 'createSegment', id, sourceReferenceId: sourceId, sourceRevisionId: data.sourceReferences.find((record) => record.id === sourceId)!.currentRevisionId, label: 'Synthetic analyst locator summary', primaryLocator: { kind: 'lineRange', start: 10, end: 20 } } as Omit<ProvenanceCommand, 'projectId'>)
  const code = (id = 'code-a', stage: 'initial' | 'theme' = 'initial') => run({ type: 'createCode', id, label: id, stage, definition: 'Synthetic definition', inclusion: 'Synthetic inclusion', exclusion: 'Synthetic exclusion' } as Omit<ProvenanceCommand, 'projectId'>)
  return { context, run, source, segment, code, get data() { return data } }
}

describe('full-snapshot provenance commands', () => {
  it('checks CAS before cloning or allocating IDs and does not mutate the original', () => {
    const f = fixture(); const original = structuredClone(f.data)
    expect(() => applyProvenanceCommand(f.data, { type: 'createCode', projectId: 'project-synthetic', label: 'c', stage: 'initial', definition: 'd', inclusion: '', exclusion: '' }, { expectedRevision: 999, idFactory: () => { throw new Error('ID factory must not be called') } })).toThrow('revision conflict')
    expect(f.data).toEqual(original)
    f.code(); expect(original.qualitativeCodes).toHaveLength(0)
    expect(f.data.workspace.revision).toBe(original.workspace.revision)
  })

  it('pins coding to source and code revisions when their current versions change', () => {
    const f = fixture(); f.source(); f.segment(); f.code()
    const oldSegmentRevision = f.data.sourceSegments[0].currentRevisionId
    const oldCodeRevision = f.data.qualitativeCodes[0].currentRevisionId
    f.run({ type: 'assignCode', id: 'assignment-a', segmentRevisionId: oldSegmentRevision, codeRevisionId: oldCodeRevision } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'reviseSource', sourceReferenceId: 'source-a', versionLabel: 'synthetic-v2', externalRef: { kind: 'local-token', token: 'synthetic-v2' } } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'reviseSegment', segmentId: 'segment-a', sourceRevisionId: f.data.sourceReferences[0].currentRevisionId, primaryLocator: { kind: 'lineRange', start: 25, end: 35 } } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'reviseCode', codeId: 'code-a', label: 'Revised', stage: 'initial', definition: 'Refined synthetic definition', inclusion: '', exclusion: '' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.codingAssignments[0].segmentRevisionId).toBe(oldSegmentRevision)
    expect(f.data.codingAssignments[0].codeRevisionId).toBe(oldCodeRevision)
    expect(f.data.sourceSegmentRevisions).toHaveLength(2)
    f.run({ type: 'recodeAssignment', assignmentId: 'assignment-a', codeRevisionId: f.data.qualitativeCodes[0].currentRevisionId, segmentRevisionId: f.data.sourceSegments[0].currentRevisionId } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.codingAssignments[0].state).toBe('superseded')
    expect(f.data.codingAssignments[1].previousAssignmentId).toBe('assignment-a')
  })

  it('merges and splits create new code identities without silently recoding assignments', () => {
    const f = fixture(); f.source(); f.segment(); f.code('code-a'); f.code('code-b')
    const pinnedRevision = f.data.qualitativeCodes[0].currentRevisionId
    f.run({ type: 'assignCode', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId, codeRevisionId: pinnedRevision } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'mergeCodes', id: 'code-merged', codeIds: ['code-a', 'code-b'], label: 'Merged theme', stage: 'theme', definition: 'Merged synthetic definition', inclusion: '', exclusion: '' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.codingAssignments[0].codeRevisionId).toBe(pinnedRevision)
    expect(f.data.qualitativeCodes.filter((record) => record.state === 'archived')).toHaveLength(2)
    f.run({ type: 'splitCode', codeId: 'code-merged', codes: [{ id: 'split-a', label: 'Split A', stage: 'initial', definition: 'A', inclusion: '', exclusion: '' }, { id: 'split-b', label: 'Split B', stage: 'initial', definition: 'B', inclusion: '', exclusion: '' }] } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.codeRelations.map((relation) => relation.kind)).toEqual(['merged-from', 'merged-from', 'split-from', 'split-from'])
    expect(f.data.codingAssignments).toHaveLength(1)
  })

  it('uses the existing TheoryMemo identity and preserves the exact derivation snapshot', () => {
    const f = fixture()
    f.run({ type: 'activateAnalyticalMemo', theoryMemoId: 'memo-synthetic', analysisKind: 'mechanism' } as Omit<ProvenanceCommand, 'projectId'>)
    const oldMemoRevision = f.data.theoryMemoRevisions[0].id
    f.run({ type: 'deriveClaim', claimRevisionId: f.data.claimRevisions[0].id, memoRevisionId: oldMemoRevision, rationale: 'Synthetic mechanism reasoning' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.theoryMemos).toHaveLength(1)
    expect(f.data.theoryMemos[0].relatedClaimIds).toEqual(['claim-synthetic'])
    expect(f.data.theoryMemoRevisions[0].snapshot.relatedClaimIds).toEqual([])
    expect(f.data.claimDerivationLinks[0].memoRevisionId).toBe(f.data.theoryMemoRevisions[1].id)
    const candidate = structuredClone(f.data); candidate.theoryMemos[0].content = 'Synthetic refined interpretation'
    const edited = reconcileProvenanceRootEdits(f.data, candidate, f.context)
    expect(edited.theoryMemoRevisions).toHaveLength(3)
    expect(edited.claimDerivationLinks[0]).toEqual(f.data.claimDerivationLinks[0])
  })

  it('reuses shared evidence and claim relations for a manuscript paragraph', () => {
    const f = fixture(); f.source(); f.segment()
    f.run({ type: 'linkEvidenceSource', evidenceRevisionId: f.data.evidenceRevisions[0].id, origin: { kind: 'sourceSegmentRevision', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId } } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'linkEvidenceToClaim', evidenceRevisionId: f.data.evidenceRevisions[0].id, claimRevisionId: f.data.claimRevisions[0].id, supportLevel: 'Contradictory', limitations: 'Synthetic counterexample retained' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'createManuscriptAnchor', manuscriptId: 'manuscript-synthetic', kind: 'paragraph', documentVersion: 'synthetic-draft-1', sectionPath: ['Results', 'Mechanism boundary'], paragraphLabel: 'p3' } as Omit<ProvenanceCommand, 'projectId'>)
    const oldAnchor = f.data.manuscriptAnchors[0].currentRevisionId
    f.run({ type: 'useEvidenceAtAnchor', evidenceClaimLinkId: f.data.evidenceClaimLinks[0].id, anchorRevisionId: oldAnchor, purpose: 'counterargument' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'reviseManuscriptAnchor', anchorId: f.data.manuscriptAnchors[0].id, documentVersion: 'synthetic-draft-2', sectionPath: ['Discussion'], paragraphLabel: 'p4' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.claimManuscriptLinks[0].anchorRevisionId).toBe(oldAnchor)
    expect(f.data.evidenceUsages[0].evidenceClaimLinkId).toBe(f.data.evidenceClaimLinks[0].id)
    expect(f.data.claims).toHaveLength(1); expect(f.data.evidence).toHaveLength(1)
    expect(f.data.evidenceClaimLinks[0].supportLevel).toBe('Contradictory')
  })

  it('freezes a deduplicated household matrix and distinguishes unexamined from reviewed absence', () => {
    const f = fixture(); f.source(); f.segment(); f.code()
    f.run({ type: 'createCase', id: 'case-a', alias: 'Synthetic household A', unit: 'household' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'createCase', id: 'case-b', alias: 'Synthetic household B', unit: 'household' } as Omit<ProvenanceCommand, 'projectId'>)
    for (const interviewId of ['interview-a-1', 'interview-a-2']) f.run({ type: 'linkInterviewCase', interviewId, caseId: 'case-a' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'linkInterviewCase', interviewId: 'interview-b', caseId: 'case-b' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'assignCode', id: 'assignment-a', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId, codeRevisionId: f.data.qualitativeCodes[0].currentRevisionId } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'freezeComparison', title: 'Synthetic household comparison', caseIds: ['case-a', 'case-b'], codeRevisionIds: [f.data.qualitativeCodes[0].currentRevisionId], unit: 'household' } as Omit<ProvenanceCommand, 'projectId'>)
    const run = f.data.comparisonRuns[0]
    expect(run.caseSnapshots).toHaveLength(2); expect(run.caseInterviewPairs).toHaveLength(3)
    expect(run.cells.map((cell) => cell.state)).toEqual(['present', 'not-examined'])
    const frozen = structuredClone(run)
    f.run({ type: 'withdrawSource', sourceReferenceId: 'source-a' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.comparisonRuns[0]).toEqual(frozen)
    expect(f.data.codingAssignments[0].state).toBe('retracted')
  })

  it('requires reviewed absence to identify examined material owned by the case', () => {
    const f = fixture(); f.source(); f.segment(); f.code()
    f.run({ type: 'createCase', id: 'case-a', alias: 'Synthetic A', unit: 'household' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'linkInterviewCase', interviewId: 'interview-a-1', caseId: 'case-a' } as Omit<ProvenanceCommand, 'projectId'>)
    const command = { type: 'freezeComparison', title: 'Synthetic absence review', caseIds: ['case-a'], codeRevisionIds: [f.data.qualitativeCodes[0].currentRevisionId], unit: 'household', reviews: [{ caseId: 'case-a', codeRevisionId: f.data.qualitativeCodes[0].currentRevisionId, state: 'absent-reviewed', reviewedSegmentRevisionIds: [], reviewNote: 'Synthetic manual review' }] as ComparisonReview[] }
    expect(() => f.run(command as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
    command.reviews[0].reviewedSegmentRevisionIds = [f.data.sourceSegments[0].currentRevisionId]
    f.run(command as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.comparisonRuns[0].cells[0].state).toBe('absent-reviewed')
  })

  it('retracts one mistaken coding without withdrawing its material or rewriting frozen comparisons', () => {
    const f = fixture(); f.source(); f.segment(); f.code()
    f.run({ type: 'createCase', id: 'case-a', alias: 'Synthetic household A', unit: 'household' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'linkInterviewCase', interviewId: 'interview-a-1', caseId: 'case-a' } as Omit<ProvenanceCommand, 'projectId'>)
    const segmentRevisionId = f.data.sourceSegments[0].currentRevisionId, codeRevisionId = f.data.qualitativeCodes[0].currentRevisionId
    f.run({ type: 'assignCode', id: 'mistaken-assignment', segmentRevisionId, codeRevisionId } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'createCode', id: 'independent-code', label: 'Synthetic second code', stage: 'initial', definition: 'Synthetic definition', inclusion: '', exclusion: '' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'assignCode', id: 'retained-assignment', segmentRevisionId, codeRevisionId: f.data.qualitativeCodes.find(row => row.id === 'independent-code')!.currentRevisionId } as Omit<ProvenanceCommand, 'projectId'>)
    const comparison = { type: 'freezeComparison', title: 'Synthetic coding review', caseIds: ['case-a'], codeRevisionIds: [codeRevisionId], unit: 'household' } as Omit<ProvenanceCommand, 'projectId'>
    f.run(comparison)
    const frozen = structuredClone(f.data.comparisonRuns[0]), definitions = structuredClone(f.data.qualitativeCodeRevisions), locators = structuredClone(f.data.sourceSegmentRevisions)
    f.run({ type: 'retractAssignment', assignmentId: 'mistaken-assignment' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.sourceReferences[0].state).toBe('active')
    expect(f.data.sourceSegments[0].state).toBe('active')
    expect(f.data.codingAssignments.find(row => row.id === 'retained-assignment')!.state).toBe('active')
    expect(f.data.codingAssignments.find(row => row.id === 'mistaken-assignment')!.state).toBe('retracted')
    expect(f.data.comparisonRuns[0]).toEqual(frozen)
    expect(frozen.assignmentStatesAtFreeze.find(row => row.assignmentId === 'mistaken-assignment')!.state).toBe('active')
    expect(frozen.cells[0].state).toBe('present')
    expect(f.data.qualitativeCodeRevisions).toEqual(definitions); expect(f.data.sourceSegmentRevisions).toEqual(locators)
    expect(f.data.qualitativeChangeEvents.at(-1)).toMatchObject({ operation: 'unlink', affected: [{ collection: 'codingAssignments', id: 'mistaken-assignment' }] })
    f.run(comparison)
    expect(f.data.comparisonRuns[1].cells[0].state).toBe('not-examined')
    const unchanged = structuredClone(f.data)
    expect(() => f.run({ type: 'retractAssignment', assignmentId: 'mistaken-assignment' } as Omit<ProvenanceCommand, 'projectId'>)).toThrow('already retracted')
    expect(f.data).toEqual(unchanged)
  })

  it('activates and revises an existing maximum-length legacy TheoryMemo without truncation', () => {
    const f = fixture(), originalText = 'x'.repeat(250_000), revisedText = 'y'.repeat(250_000)
    f.data.theoryMemos[0].content = originalText; f.data.theoryMemos[0].title = 't'.repeat(1000)
    f.run({ type: 'activateAnalyticalMemo', theoryMemoId: f.data.theoryMemos[0].id, analysisKind: 'mechanism' } as Omit<ProvenanceCommand, 'projectId'>)
    const initial = structuredClone(f.data.theoryMemoRevisions[0])
    const memo = f.data.theoryMemos[0]
    f.run({ type: 'reviseAnalyticalMemo', theoryMemoId: memo.id, snapshot: { memoType: memo.memoType, title: memo.title, content: revisedText, relatedQuestionIds: memo.relatedQuestionIds, relatedClaimIds: memo.relatedClaimIds, relatedLiteratureIds: memo.relatedLiteratureIds } } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.theoryMemos[0].content).toBe(revisedText)
    expect(f.data.theoryMemoRevisions[0]).toEqual(initial)
    expect(f.data.theoryMemoRevisions[0].snapshot.content).toBe(originalText)
    expect(f.data.theoryMemoRevisions[1].snapshot.content).toBe(revisedText)
    expect(f.data.theoryMemos).toHaveLength(1)
  })

  it('retains contradictory historical evidence but retires uses after source withdrawal', () => {
    const f = fixture(); f.source(); f.segment(); f.code()
    f.run({ type: 'assignCode', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId, codeRevisionId: f.data.qualitativeCodes[0].currentRevisionId } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'linkEvidenceSource', evidenceRevisionId: f.data.evidenceRevisions[0].id, origin: { kind: 'sourceSegmentRevision', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId } } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'linkEvidenceToClaim', evidenceRevisionId: f.data.evidenceRevisions[0].id, claimRevisionId: f.data.claimRevisions[0].id, supportLevel: 'Contradictory' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'createManuscriptAnchor', manuscriptId: 'manuscript-synthetic', kind: 'paragraph', documentVersion: 'synthetic-v1', sectionPath: ['Results'] } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'useEvidenceAtAnchor', evidenceClaimLinkId: f.data.evidenceClaimLinks[0].id, anchorRevisionId: f.data.manuscriptAnchors[0].currentRevisionId } as Omit<ProvenanceCommand, 'projectId'>)
    const historicalRevision = structuredClone(f.data.evidenceRevisions[0])
    f.run({ type: 'withdrawSource', sourceReferenceId: 'source-a' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.evidenceRevisions[0]).toEqual(historicalRevision)
    expect(f.data.evidenceSourceLinks[0].state).toBe('retired'); expect(f.data.evidenceUsages[0].state).toBe('retired')
    expect(f.data.evidenceClaimLinks[0].state).toBe('retired')
    expect(f.data.evidenceClaimLinks[0].supportLevel).toBe('Contradictory')
    expect(() => f.run({ type: 'useEvidenceAtAnchor', evidenceClaimLinkId: f.data.evidenceClaimLinks[0].id, anchorRevisionId: f.data.manuscriptAnchors[0].currentRevisionId } as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
    expect(() => f.run({ type: 'linkEvidenceToClaim', evidenceRevisionId: f.data.evidenceRevisions[0].id, claimRevisionId: f.data.claimRevisions[0].id, supportLevel: 'Weak' } as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
    expect(() => f.run({ type: 'linkEvidenceSource', evidenceRevisionId: f.data.evidenceRevisions[0].id, origin: { kind: 'sourceSegmentRevision', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId } } as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
  })

  it('retires direct owner evidence references and prevents relinking withdrawn interview origins', () => {
    const f = fixture(); f.source()
    f.run({ type: 'linkEvidenceSource', evidenceRevisionId: f.data.evidenceRevisions[0].id, origin: { kind: 'interview', interviewId: 'interview-a-1', locator: 'Synthetic external locator' } } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'linkEvidenceToClaim', evidenceRevisionId: f.data.evidenceRevisions[0].id, claimRevisionId: f.data.claimRevisions[0].id, supportLevel: 'Weak' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'withdrawSource', sourceReferenceId: 'source-a' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(f.data.evidenceSourceLinks[0].state).toBe('retired')
    expect(f.data.evidenceClaimLinks[0].state).toBe('retired')
    expect(() => f.run({ type: 'linkEvidenceToClaim', evidenceRevisionId: f.data.evidenceRevisions[0].id, claimRevisionId: f.data.claimRevisions[0].id, supportLevel: 'Strong' } as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
    expect(() => f.run({ type: 'linkEvidenceSource', evidenceRevisionId: f.data.evidenceRevisions[0].id, origin: { kind: 'interview', interviewId: 'interview-a-1', locator: 'Synthetic external locator' } } as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
  })

  it('rejects using an interview from another project as a source owner', () => {
    const f = fixture()
    const original = structuredClone(f.data)
    const secondProject = { ...original.projects[0], id: 'second-project' }
    original.projects.push(secondProject)
    expect(() => applyProvenanceCommand(original, { type: 'registerSource', projectId: 'second-project', alias: 'Synthetic wrong owner', sourceKind: 'transcript', owners: [{ kind: 'interview', interviewId: 'interview-a-1' }], versionLabel: 'synthetic-v1', externalRef: { kind: 'local-token', token: 'synthetic-token' } }, f.context)).toThrow('cross-project')
    expect(original.sourceReferences).toHaveLength(0)
  })

  it('records old-form claim and evidence edits and blocks rewriting history or deleting used roots', () => {
    const f = fixture()
    f.run({ type: 'linkEvidenceToClaim', evidenceRevisionId: f.data.evidenceRevisions[0].id, claimRevisionId: f.data.claimRevisions[0].id, supportLevel: 'Weak' } as Omit<ProvenanceCommand, 'projectId'>)
    const candidate = structuredClone(f.data); candidate.claims[0].text = 'Synthetic refined claim'; candidate.evidence[0].finding = 'Synthetic refinement'
    const edited = reconcileProvenanceRootEdits(f.data, candidate, f.context)
    expect(edited.claimRevisions).toHaveLength(2); expect(edited.evidenceRevisions).toHaveLength(2)
    expect(edited.evidenceClaimLinks[0].claimRevisionId).toBe(f.data.claimRevisions[0].id)
    const rewritten = structuredClone(edited); rewritten.claimRevisions[0].snapshot.text = 'Overwritten'
    expect(() => reconcileProvenanceRootEdits(edited, rewritten, f.context)).toThrow('Immutable')
    const deleted = structuredClone(edited); deleted.claims = []
    expect(() => reconcileProvenanceRootEdits(edited, deleted, f.context)).toThrow('Deletion blocked')
  })

  it('blocks same-project root reassignment through whole-snapshot updates while allowing explicit revisions', () => {
    const f = fixture(); f.source(); f.source('source-b', 'interview-a-2'); f.segment(); f.code()
    f.run({ type: 'assignCode', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId, codeRevisionId: f.data.qualitativeCodes[0].currentRevisionId } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'activateAnalyticalMemo', theoryMemoId: 'memo-synthetic', analysisKind: 'mechanism' } as Omit<ProvenanceCommand, 'projectId'>)
    f.run({ type: 'createManuscriptAnchor', manuscriptId: 'manuscript-synthetic', kind: 'paragraph', documentVersion: 'synthetic-v1', sectionPath: ['Results'] } as Omit<ProvenanceCommand, 'projectId'>)
    const changes = [
      (candidate: typeof f.data) => { candidate.sourceReferences[0].owners = [{ kind: 'interview', interviewId: 'interview-a-2' }] },
      (candidate: typeof f.data) => { candidate.sourceReferences[0].sourceKind = 'qda-export-reference' },
      (candidate: typeof f.data) => { candidate.sourceSegments[0].sourceReferenceId = 'source-b' },
      (candidate: typeof f.data) => { candidate.manuscriptAnchors[0].kind = 'section' },
      (candidate: typeof f.data) => { candidate.manuscripts.push({ ...candidate.manuscripts[0], id: 'second-synthetic-manuscript' }); candidate.manuscriptAnchors[0].manuscriptId = 'second-synthetic-manuscript' },
      (candidate: typeof f.data) => { candidate.theoryMemos.push({ ...candidate.theoryMemos[0], id: 'second-synthetic-memo' }); candidate.analyticalMemoFacets[0].theoryMemoId = 'second-synthetic-memo' },
    ]
    for (const change of changes) {
      const candidate = structuredClone(f.data); change(candidate)
      expect(() => reconcileProvenanceRootEdits(f.data, candidate, f.context)).toThrow('Stable provenance root endpoints')
    }
    const previous = structuredClone(f.data)
    f.run({ type: 'reviseSource', sourceReferenceId: 'source-a', versionLabel: 'synthetic-v2', externalRef: { kind: 'local-token', token: 'synthetic-source-v2' } } as Omit<ProvenanceCommand, 'projectId'>)
    expect(reconcileProvenanceRootEdits(previous, f.data, f.context).sourceReferences[0].currentRevisionId).toBe(f.data.sourceReferences[0].currentRevisionId)
  })

  it('rejects oversized comparison selections before ID allocation and leaves the entire input unchanged', () => {
    const f = fixture(); const original = structuredClone(f.data)
    const command: ProvenanceCommand = { type: 'freezeComparison', projectId: 'project-synthetic', title: 'Synthetic oversized selection', unit: 'household', caseIds: Array.from({ length: 101 }, (_, index) => `synthetic-case-${index}`), codeRevisionIds: Array.from({ length: 100 }, (_, index) => `synthetic-code-${index}`) }
    expect(() => applyProvenanceCommand(f.data, command, { ...f.context, idFactory: () => { throw new Error('Allocation must not occur') } })).toThrow('Comparison capacity')
    expect(f.data).toEqual(original)
    expect(f.data.comparisonRuns).toHaveLength(0)
    expect(f.data.qualitativeChangeEvents).toHaveLength(0)
  })

  it('allows an edited demo root to become user data while preserving demo historical snapshots', () => {
    const f = fixture()
    const previous = structuredClone(f.data)
    previous.claims[0].isDemo = true; previous.claimRevisions[0].isDemo = true
    const candidate = structuredClone(previous)
    candidate.claims[0].text = 'Synthetic researcher-edited claim'; candidate.claims[0].isDemo = false
    const edited = reconcileProvenanceRootEdits(previous, candidate, f.context)
    expect(edited.claims[0].isDemo).toBe(false)
    expect(edited.claimRevisions[0].isDemo).toBe(true)
    expect(edited.claimRevisions[1].isDemo).toBe(false)
    const relabelled = structuredClone(edited); relabelled.claims[0].isDemo = true
    expect(() => reconcileProvenanceRootEdits(edited, relabelled, f.context)).toThrow('Stable provenance root endpoints')
  })

  it('rejects cross-project endpoints, invalid locators, duplicate active coding and code cycles atomically', () => {
    const f = fixture(); f.source(); f.segment(); f.code('theme-a', 'theme'); f.code('theme-b', 'theme')
    const before = structuredClone(f.data)
    expect(() => f.run({ type: 'createSegment', sourceReferenceId: 'source-a', sourceRevisionId: f.data.sourceReferences[0].currentRevisionId, label: 'Synthetic invalid', primaryLocator: { kind: 'lineRange', start: 20, end: 10 } } as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
    expect(f.data).toEqual(before)
    const a = f.data.qualitativeCodes[0].currentRevisionId, b = f.data.qualitativeCodes[1].currentRevisionId
    f.run({ type: 'relateCodes', fromCodeRevisionId: a, toCodeRevisionId: b, kind: 'groups' } as Omit<ProvenanceCommand, 'projectId'>)
    expect(() => f.run({ type: 'relateCodes', fromCodeRevisionId: b, toCodeRevisionId: a, kind: 'groups' } as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
    f.run({ type: 'assignCode', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId, codeRevisionId: a } as Omit<ProvenanceCommand, 'projectId'>)
    expect(() => f.run({ type: 'assignCode', segmentRevisionId: f.data.sourceSegments[0].currentRevisionId, codeRevisionId: a } as Omit<ProvenanceCommand, 'projectId'>)).toThrow()
  })
})
