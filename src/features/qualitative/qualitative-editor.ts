import type { WorkspaceData } from '../../models/domain'
import type { ExternalReference, MemoMaterial, SegmentLocator, TheoryMemoRevision } from '../../models/provenance'
import type { ProvenanceCommand } from '../../utils/provenance-commands'
import type { AppLocale } from '../../i18n/settings'
import { qualitativeText, type QualitativeMessage } from './messages'

export type EditorKind = 'createCase' | 'createDimension' | 'linkInterviewCase' | 'registerSource' | 'reviseSource' | 'createSegment' | 'reviseSegment' | 'createCode' | 'reviseCode' | 'relateCodes' | 'assignCode' | 'recodeAssignment' | 'retractAssignment' | 'activateAnalyticalMemo' | 'createMemo' | 'editMemo' | 'linkMemoMaterial' | 'deriveClaim' | 'freezeComparison' | 'archiveRecord' | 'withdrawSource'
export interface QualitativeDraft {
  kind: EditorKind
  values: Record<string, string>
  selected: Record<string, string[]>
  workspaceId: string
  projectId: string
  expectedRevision: number
}
export type Option = { value: string; label: string }
export type DraftField = { name: string; label: QualitativeMessage; kind?: 'text' | 'textarea' | 'select' | 'multi' | 'number'; options?: Option[]; required?: boolean; hint?: QualitativeMessage; maxLength?: number; min?: number }
const units = ['household', 'person', 'episode', 'group', 'other'] as const
const versions = <T extends { id: string; revisionNo: number }>(items: T[], label: (item: T) => string): Option[] => items.map(item => ({ value: item.id, label: `${label(item)} · r${item.revisionNo}` }))

export function initialDraft(kind: EditorKind, data: WorkspaceData, projectId: string, values: Record<string, string> = {}): QualitativeDraft {
  return {
    kind, workspaceId: data.workspace.id, projectId, expectedRevision: data.workspace.revision,
    values: { unit: 'household', role: kind === 'linkMemoMaterial' ? 'observation' : 'primary', sourceKind: 'transcript', referenceKind: 'local-token', provider: 'nvivo', verification: 'unverified', versionLabel: 'v1', locatorKind: 'lineRange', stage: 'initial', relation: 'groups', analysisKind: 'mechanism', materialKind: 'segmentRevision', researcher: 'R01', ...values }, selected: {},
  }
}

export function draftFields(draft: QualitativeDraft, data: WorkspaceData, locale: AppLocale): DraftField[] {
  const q = (key: QualitativeMessage) => qualitativeText(locale, key)
  const options = (items: readonly string[]): Option[] => items.map(value => ({ value, label: q(value as QualitativeMessage) }))
  const own = <T extends { projectId?: string }>(items: T[]) => items.filter(item => item.projectId === draft.projectId)
  const revisionOptions = versions(own(data.qualitativeCodeRevisions), item => `${item.label} · ${q(item.stage)}`)
  const sourceOptions = own(data.sourceReferences).map(item => ({ value: item.id, label: item.alias }))
  const sourceRevisionOptions = own(data.sourceRevisions).filter(item => !draft.values.sourceReferenceId || item.sourceReferenceId === draft.values.sourceReferenceId).map(item => ({ value: item.id, label: `${data.sourceReferences.find(source => source.id === item.sourceReferenceId)?.alias || item.sourceReferenceId} · ${item.versionLabel} · r${item.revisionNo}` }))
  const segmentOptions = versions(own(data.sourceSegmentRevisions), item => data.sourceSegments.find(segment => segment.id === item.segmentId)?.label || item.segmentId)
  const memoOptions = own(data.theoryMemos).map(item => ({ value: item.id, label: item.title }))
  const memoRevisionOptions = versions(own(data.theoryMemoRevisions), item => item.snapshot.title)
  const field = (name: string, label: QualitativeMessage, kind: DraftField['kind'] = 'text', required = true, extra: Partial<DraftField> = {}): DraftField => ({ name, label, kind, required, ...extra })
  const select = (name: string, label: QualitativeMessage, entries: Option[]): DraftField => field(name, label, 'select', true, { options: entries })
  const codeFields = [field('label', 'label'), select('stage', 'stage', options(['initial', 'theme'])), field('definition', 'definition', 'textarea'), field('inclusion', 'inclusion', 'textarea', false), field('exclusion', 'exclusion', 'textarea', false)]
  let fields: DraftField[] = []
  switch (draft.kind) {
    case 'createDimension': fields = [field('label', 'label'), select('unit', 'unit', options(units)), field('categories', 'categories', 'textarea')]; break
    case 'createCase': fields = [field('alias', 'alias'), select('unit', 'unit', options(units)), field('attributes', 'attributes', 'multi', false, { hint: 'categoryChoice', options: own(data.samplingDimensions).filter(item => item.state === 'active' && item.unit === draft.values.unit).flatMap(item => item.categories.filter(category => !category.retired).map(category => ({ value: JSON.stringify({ dimensionId: item.id, categoryId: category.id }), label: `${item.label}: ${category.label}` }))) })]; break
    case 'linkInterviewCase': fields = [select('interviewId', 'interview', own(data.interviews).map(item => ({ value: item.id, label: item.participantAlias }))), select('caseId', 'case', own(data.researchCases).filter(item => item.state === 'active').map(item => ({ value: item.id, label: item.alias }))), select('role', 'role', options(['primary', 'member', 'context']))]; break
    case 'registerSource':
    case 'reviseSource': {
      if (draft.kind === 'registerSource') fields.push(field('alias', 'alias'), select('sourceKind', 'sourceKind', options(['transcript', 'fieldnote', 'qda-export-reference'])), field('owners', 'owner', 'multi', true, { options: [...own(data.interviews).map(item => ({ value: `interview:${item.id}`, label: `${q('interview')} · ${item.participantAlias}` })), ...(draft.values.sourceKind === 'transcript' ? [] : own(data.fieldVisits).map(item => ({ value: `fieldVisit:${item.id}`, label: `${q('fieldVisit')} · ${item.date} · ${item.purpose}` })))] }))
      fields.push(field('versionLabel', 'version'), select('referenceKind', 'referenceKind', options(['local-token', 'https-reference', 'qda-reference'])))
      if (draft.values.referenceKind === 'https-reference') fields.push(field('url', 'url', 'text', true, { hint: 'noPath', maxLength: 2048 }))
      else if (draft.values.referenceKind === 'qda-reference') fields.push(select('provider', 'provider', ['nvivo', 'maxqda', 'atlas-ti', 'other'].map(value => ({ value, label: value }))), field('projectToken', 'projectToken'), field('sourceToken', 'sourceToken'), field('objectToken', 'objectToken', 'text', false))
      else fields.push(field('token', 'token', 'text', true, { hint: 'noPath' }))
      fields.push(select('verification', 'verification', options(['unverified', 'verified'])))
      break
    }
    case 'createSegment':
    case 'reviseSegment': {
      if (draft.kind === 'createSegment') fields.push(select('sourceReferenceId', 'source', sourceOptions), field('label', 'label', 'text', true, { hint: 'metadataOnly' }))
      fields.push(select('sourceRevisionId', 'sourceVersion', sourceRevisionOptions), select('locatorKind', 'locator', options(['lineRange', 'pageParagraph', 'timeRange', 'externalAnchor'])))
      if (draft.values.locatorKind === 'externalAnchor') fields.push(field('namespace', 'namespace'), field('anchorToken', 'token'))
      else {
        if (draft.values.locatorKind === 'pageParagraph') fields.push(field('page', 'page', 'number', true, { min: 1 }))
        fields.push(field('start', 'start', 'number', true, { min: draft.values.locatorKind === 'timeRange' ? 0 : 1 }), field('end', 'end', 'number', true, { min: draft.values.locatorKind === 'timeRange' ? 0 : 1 }))
      }
      fields.push(select('verification', 'verification', options(['unverified', 'verified', 'unresolved'])))
      break
    }
    case 'createCode':
    case 'reviseCode': fields = codeFields; break
    case 'relateCodes': fields = [select('fromCodeRevisionId', 'fromCode', revisionOptions), select('toCodeRevisionId', 'toCode', revisionOptions), select('relation', 'relation', options(['groups', 'related', 'split-from', 'merged-from'])), field('rationale', 'rationale', 'textarea', false, { hint: 'relationHint' })]; break
    case 'assignCode': fields = [select('segmentRevisionId', 'segment', segmentOptions), select('codeRevisionId', 'code', revisionOptions), field('rationale', 'rationale', 'textarea', false)]; break
    case 'recodeAssignment': fields = [select('codeRevisionId', 'code', revisionOptions), select('segmentRevisionId', 'segment', segmentOptions), field('rationale', 'rationale', 'textarea', false)]; break
    case 'activateAnalyticalMemo': fields = [select('theoryMemoId', 'memo', memoOptions), select('analysisKind', 'memoKind', options(['code-development', 'case-comparison', 'mechanism', 'negative-case']))]; break
    case 'createMemo':
    case 'editMemo': fields = [field('memoTitle', 'memoTitle'), field('memoContent', 'memoContent', 'textarea', true, { hint: 'reuseMemo' })]; if (draft.kind === 'createMemo') fields.push(select('analysisKind', 'memoKind', options(['code-development', 'case-comparison', 'mechanism', 'negative-case']))); break
    case 'linkMemoMaterial': {
      const materialOptions: Record<string, Option[]> = {
        segmentRevision: segmentOptions,
        codingAssignment: own(data.codingAssignments).map(item => ({ value: item.id, label: `${data.qualitativeCodeRevisions.find(code => code.id === item.codeRevisionId)?.label || item.codeRevisionId} · ${data.sourceSegmentRevisions.find(segment => segment.id === item.segmentRevisionId)?.revisionNo || ''} · ${item.id}` })),
        codeRevision: revisionOptions, comparisonRun: own(data.comparisonRuns).map(item => ({ value: item.id, label: item.title })),
        interview: own(data.interviews).map(item => ({ value: item.id, label: item.participantAlias })), fieldVisit: own(data.fieldVisits).map(item => ({ value: item.id, label: `${item.date} · ${item.purpose}` })), researchCase: own(data.researchCases).map(item => ({ value: item.id, label: item.alias })),
      }
      fields = [select('memoRevisionId', 'memoVersion', memoRevisionOptions), select('materialKind', 'materialKind', options(Object.keys(materialOptions))), select('materialId', 'material', materialOptions[draft.values.materialKind] || []), select('role', 'role', options(['observation', 'interpretation', 'rival', 'boundary'])), field('note', 'note', 'textarea', false)]
      break
    }
    case 'deriveClaim': fields = [select('memoRevisionId', 'memoVersion', memoRevisionOptions), select('claimRevisionId', 'claim', versions(own(data.claimRevisions), item => item.snapshot.text)), field('rationale', 'rationale', 'textarea', false)]; break
    case 'freezeComparison': fields = [field('title', 'comparisonTitle'), select('unit', 'unit', options(units)), field('caseIds', 'compareCases', 'multi', true, { options: own(data.researchCases).filter(item => item.state === 'active' && item.unit === draft.values.unit).map(item => ({ value: item.id, label: item.alias })) }), field('codeRevisionIds', 'compareCodes', 'multi', true, { options: revisionOptions })]; break
    case 'archiveRecord':
    case 'retractAssignment':
    case 'withdrawSource': fields = []; break
  }
  return [...fields, field('researcher', 'researcher'), field('reason', 'reason', 'textarea', true)]
}

export function locatorFromDraft(values: Record<string, string>): SegmentLocator {
  if (values.locatorKind === 'externalAnchor') return { kind: 'externalAnchor', namespace: values.namespace.trim(), token: values.anchorToken.trim() }
  const start = Number(values.start), end = Number(values.end)
  if (!values.start || !values.end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start < (values.locatorKind === 'timeRange' ? 0 : 1)) throw new Error('invalid-locator')
  if (values.locatorKind === 'timeRange') return { kind: 'timeRange', startMs: start, endMs: end }
  if (values.locatorKind === 'pageParagraph') {
    const page = Number(values.page)
    if (!Number.isSafeInteger(page) || page < 1) throw new Error('invalid-locator')
    return { kind: 'pageParagraph', page, paragraphStart: start, paragraphEnd: end }
  }
  return { kind: 'lineRange', start, end }
}

export function externalReferenceFromDraft(values: Record<string, string>): ExternalReference {
  if (values.referenceKind === 'https-reference') return { kind: 'https-reference', url: values.url.trim() }
  if (values.referenceKind === 'qda-reference') return { kind: 'qda-reference', provider: values.provider as 'nvivo' | 'maxqda' | 'atlas-ti' | 'other', projectToken: values.projectToken.trim(), sourceToken: values.sourceToken.trim(), ...(values.objectToken?.trim() ? { objectToken: values.objectToken.trim() } : {}) }
  return { kind: 'local-token', token: values.token.trim() }
}

export function materialFromDraft(values: Record<string, string>): MemoMaterial {
  const id = values.materialId
  switch (values.materialKind) {
    case 'codingAssignment': return { kind: 'codingAssignment', assignmentId: id }
    case 'codeRevision': return { kind: 'codeRevision', codeRevisionId: id }
    case 'comparisonRun': return { kind: 'comparisonRun', comparisonRunId: id }
    case 'interview': return { kind: 'interview', interviewId: id }
    case 'fieldVisit': return { kind: 'fieldVisit', fieldVisitId: id }
    case 'researchCase': return { kind: 'researchCase', caseId: id }
    default: return { kind: 'segmentRevision', segmentRevisionId: id }
  }
}

export function commandFromDraft(draft: QualitativeDraft, data: WorkspaceData): ProvenanceCommand {
  const v = draft.values, projectId = draft.projectId
  const codeValues = { label: v.label?.trim() || '', stage: v.stage as 'initial' | 'theme', definition: v.definition?.trim() || '', inclusion: v.inclusion?.trim() || '', exclusion: v.exclusion?.trim() || '' }
  switch (draft.kind) {
    case 'createDimension': return { type: draft.kind, projectId, label: v.label.trim(), unit: v.unit as 'household', categories: v.categories.split('\n').map(label => label.trim()).filter(Boolean).map(label => ({ label })) }
    case 'createCase': return { type: draft.kind, projectId, alias: v.alias.trim(), unit: v.unit as 'household', attributes: (draft.selected.attributes || []).map(value => JSON.parse(value) as { dimensionId: string; categoryId: string }) }
    case 'linkInterviewCase': return { type: draft.kind, projectId, interviewId: v.interviewId, caseId: v.caseId, role: v.role as 'primary' }
    case 'registerSource': return { type: draft.kind, projectId, alias: v.alias.trim(), sourceKind: v.sourceKind as 'transcript', owners: (draft.selected.owners || []).map(value => value.startsWith('interview:') ? { kind: 'interview' as const, interviewId: value.slice('interview:'.length) } : { kind: 'fieldVisit' as const, fieldVisitId: value.slice('fieldVisit:'.length) }), versionLabel: v.versionLabel.trim(), externalRef: externalReferenceFromDraft(v), researcherVerification: v.verification as 'unverified' }
    case 'reviseSource': return { type: draft.kind, projectId, sourceReferenceId: v.sourceReferenceId, versionLabel: v.versionLabel.trim(), externalRef: externalReferenceFromDraft(v), researcherVerification: v.verification as 'unverified' }
    case 'createSegment': return { type: draft.kind, projectId, sourceReferenceId: v.sourceReferenceId, sourceRevisionId: v.sourceRevisionId, label: v.label.trim(), primaryLocator: locatorFromDraft(v), verification: v.verification as 'unverified' }
    case 'reviseSegment': return { type: draft.kind, projectId, segmentId: v.segmentId, sourceRevisionId: v.sourceRevisionId, primaryLocator: locatorFromDraft(v), verification: v.verification as 'unverified' }
    case 'createCode': return { type: draft.kind, projectId, ...codeValues }
    case 'reviseCode': return { type: draft.kind, projectId, codeId: v.codeId, ...codeValues }
    case 'relateCodes': return { type: draft.kind, projectId, fromCodeRevisionId: v.fromCodeRevisionId, toCodeRevisionId: v.toCodeRevisionId, kind: v.relation as 'groups', rationale: v.rationale || '' }
    case 'assignCode': return { type: draft.kind, projectId, segmentRevisionId: v.segmentRevisionId, codeRevisionId: v.codeRevisionId, rationale: v.rationale || '' }
    case 'recodeAssignment': return { type: draft.kind, projectId, assignmentId: v.assignmentId, segmentRevisionId: v.segmentRevisionId, codeRevisionId: v.codeRevisionId, rationale: v.rationale || '' }
    case 'retractAssignment': return { type: draft.kind, projectId, assignmentId: v.assignmentId }
    case 'activateAnalyticalMemo': return { type: draft.kind, projectId, theoryMemoId: v.theoryMemoId, analysisKind: v.analysisKind as 'mechanism' }
    case 'editMemo': {
      const original = data.theoryMemos.find(item => item.id === v.theoryMemoId)
      if (!original) throw new Error('memo-missing')
      const snapshot: TheoryMemoRevision['snapshot'] = { memoType: original.memoType, title: v.memoTitle.trim(), content: v.memoContent.trim(), relatedQuestionIds: original.relatedQuestionIds, relatedClaimIds: original.relatedClaimIds, relatedLiteratureIds: original.relatedLiteratureIds }
      return { type: 'reviseAnalyticalMemo', projectId, theoryMemoId: original.id, snapshot }
    }
    case 'linkMemoMaterial': return { type: draft.kind, projectId, memoRevisionId: v.memoRevisionId, material: materialFromDraft(v), role: v.role as 'observation', note: v.note || '' }
    case 'deriveClaim': return { type: draft.kind, projectId, memoRevisionId: v.memoRevisionId, claimRevisionId: v.claimRevisionId, rationale: v.rationale || '' }
    case 'freezeComparison': return { type: draft.kind, projectId, title: v.title.trim(), unit: v.unit as 'household', caseIds: draft.selected.caseIds || [], codeRevisionIds: draft.selected.codeRevisionIds || [] }
    case 'archiveRecord': return { type: draft.kind, projectId, collection: v.collection as 'qualitativeCodes', recordId: v.recordId }
    case 'withdrawSource': return { type: draft.kind, projectId, sourceReferenceId: v.sourceReferenceId }
    default: throw new Error('unsupported-editor')
  }
}

export function referenceLabel(reference: ExternalReference): string {
  if (reference.kind === 'local-token') return reference.token
  if (reference.kind === 'https-reference') return reference.url
  return [reference.provider, reference.projectToken, reference.sourceToken, reference.objectToken].filter(Boolean).join(' / ')
}
export function locatorLabel(locator: SegmentLocator): string {
  switch (locator.kind) {
    case 'lineRange': return `L${locator.start}–${locator.end}`
    case 'pageParagraph': return `P${locator.page} ¶${locator.paragraphStart}–${locator.paragraphEnd}`
    case 'timeRange': return `${locator.startMs}–${locator.endMs} ms`
    case 'externalAnchor': return `${locator.namespace} / ${locator.token}`
  }
}
