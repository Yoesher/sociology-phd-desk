import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { WorkspaceData, TheoryMemo } from '../../models/domain'
import type { ComparisonRun, WorkspaceCollectionKey } from '../../models/provenance'
import type { WorkspaceContextValue } from '../../app/workspace-context'
import { entityMeta } from '../../app/format'
import { useI18n } from '../../i18n'
import { Button, Field, FilterChips, Modal, Badge, EmptyState } from '../../components/ui'
import { applyProvenanceCommand } from '../../utils/provenance-commands'
import { commandFromDraft, draftFields, initialDraft, locatorLabel, referenceLabel, type EditorKind, type QualitativeDraft, type DraftField } from './qualitative-editor'
import { qualitativeText, type QualitativeMessage } from './messages'
import { ProvenanceTrace } from './ProvenanceTrace'
import './qualitative.css'

type Target = { collection: WorkspaceCollectionKey; id: string }
type Review = { caseId: string; codeRevisionId: string; state: 'absent-reviewed' | 'not-examined' | 'not-applicable' | 'unresolved'; reviewedSegmentRevisionIds: string[]; reviewNote?: string }
type Props = { data: WorkspaceData; fullData: WorkspaceData; updateData: WorkspaceContextValue['updateData']; initialInterviewId?: string; initialTarget?: Target | null }
const tabs = ['cases', 'sources', 'codes', 'memos', 'comparison', 'trace', 'history'] as const

export function QualitativeWorkspace({ data, fullData, updateData, initialInterviewId = '', initialTarget = null }: Props) {
  const { locale } = useI18n()
  const q = (key: QualitativeMessage) => qualitativeText(locale, key)
  const initialRecord = initialTarget ? fullData[initialTarget.collection].find(item => item.id === initialTarget.id) : undefined
  const initialProjectId = initialRecord && 'projectId' in initialRecord ? initialRecord.projectId : undefined
  const [tab, setTab] = useState<typeof tabs[number]>(initialTarget ? 'trace' : initialInterviewId ? 'sources' : 'cases')
  const [projectSelection, setProjectSelection] = useState(data.interviews.find(item => item.id === initialInterviewId)?.projectId || initialProjectId || data.workspace.activeProjectId || data.projects[0]?.id || '')
  const projectId = data.projects.some(project => project.id === projectSelection) ? projectSelection : data.projects[0]?.id || ''
  const [editor, setEditor] = useState<QualitativeDraft | null>(null)
  const [reviews, setReviews] = useState<Record<string, Review>>({})
  const [error, setError] = useState<'saveFailed' | 'required' | null>(null)
  const [notice, setNotice] = useState<'saved' | 'copied' | 'copyFailed' | null>(null)
  const [busy, setBusy] = useState(false)
  const operation = useRef(false)
  const [target, setTarget] = useState<Target | null>(initialTarget)
  const own = <T extends { projectId?: string }>(items: T[]): T[] => items.filter(item => item.projectId === projectId)
  const showTrace = (collection: WorkspaceCollectionKey, id: string) => { setTarget({ collection, id }); setTab('trace') }
  const open = (kind: EditorKind, values: Record<string, string> = {}) => {
    setError(null); setNotice(null); setReviews({})
    const draft = initialDraft(kind, fullData, projectId, values)
    if (kind === 'registerSource' && initialInterviewId && data.interviews.some(item => item.id === initialInterviewId && item.projectId === projectId)) draft.selected.owners = [`interview:${initialInterviewId}`]
    setEditor(draft)
  }
  const close = () => { if (!operation.current) { setEditor(null); setError(null); setReviews({}) } }
  const archive = (collection: string, recordId: string) => open('archiveRecord', { collection, recordId })
  const copyReference = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setNotice('copied') }
    catch { setNotice('copyFailed') }
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!editor || operation.current) return
    const draft = editor
    const fields = draftFields(draft, fullData, locale)
    if (fields.some(field => field.required && (field.kind === 'multi' ? !(draft.selected[field.name]?.length) : !draft.values[field.name]?.trim()))) { setError('required'); return }
    operation.current = true; setBusy(true); setError(null)
    try {
      await updateData(current => {
        if (current.workspace.id !== draft.workspaceId || projectId !== draft.projectId) throw new Error('workspace-changed')
        const context = { expectedRevision: draft.expectedRevision, researcherAlias: draft.values.researcher.trim(), reason: draft.values.reason.trim() }
        if (draft.kind === 'createMemo') {
          const memo: TheoryMemo = { ...entityMeta('memo'), projectId: draft.projectId, memoType: draft.values.analysisKind === 'negative-case' ? 'counterargument' : draft.values.analysisKind === 'case-comparison' ? 'synthesis' : 'mechanism', title: draft.values.memoTitle.trim(), content: draft.values.memoContent.trim(), relatedQuestionIds: [], relatedClaimIds: [], relatedLiteratureIds: [] }
          return applyProvenanceCommand({ ...current, theoryMemos: [...current.theoryMemos, memo] }, { type: 'activateAnalyticalMemo', projectId: draft.projectId, theoryMemoId: memo.id, analysisKind: draft.values.analysisKind as 'mechanism' }, context)
        }
        const command = commandFromDraft(draft, current)
        if (command.type === 'freezeComparison') command.reviews = Object.values(reviews).filter(review => command.caseIds.includes(review.caseId) && command.codeRevisionIds.includes(review.codeRevisionId))
        return applyProvenanceCommand(current, command, context)
      })
      setEditor(null); setReviews({}); setNotice('saved')
    } catch (failure) { setError(failure instanceof Error && failure.message === 'invalid-locator' ? 'required' : 'saveFailed') }
    finally { operation.current = false; setBusy(false) }
  }
  const revisionLink = (collection: WorkspaceCollectionKey, id: string, label: ReactNode) => <button type="button" className="qualitative-link" onClick={() => showTrace(collection, id)}>{label}</button>
  const card = (collection: WorkspaceCollectionKey, id: string, title: string, body: ReactNode, actions?: ReactNode, state?: string) => <article className="qualitative-record" key={id}>
    <header><h3>{title}</h3>{state && <Badge tone={state === 'withdrawn' || state === 'retracted' ? 'danger' : state === 'active' ? 'success' : 'neutral'}>{q(state as QualitativeMessage)}</Badge>}</header>
    <p className="qualitative-id">{revisionLink(collection, id, id)}</p>{body}
    <div className="qualitative-actions">{actions}<Button size="sm" variant="ghost" onClick={() => showTrace(collection, id)}>{q('openTrace')}</Button></div>
  </article>
  const fieldControl = (field: DraftField) => {
    if (!editor) return null
    const set = (value: string) => setEditor({ ...editor, values: { ...editor.values, [field.name]: value, ...(field.name === 'materialKind' ? { materialId: '' } : {}), ...(field.name === 'sourceReferenceId' ? { sourceRevisionId: '' } : {}) }, selected: field.name === 'unit' ? { ...editor.selected, attributes: [], caseIds: [] } : field.name === 'sourceKind' ? { ...editor.selected, owners: [] } : editor.selected })
    if (field.kind === 'multi') return <div className="qualitative-checkboxes" role="group" aria-label={q(field.label)}>{field.options?.map(option => <label key={option.value}><input type="checkbox" disabled={busy} checked={editor.selected[field.name]?.includes(option.value) || false} onChange={event => setEditor({ ...editor, selected: { ...editor.selected, [field.name]: event.target.checked ? [...editor.selected[field.name] || [], option.value] : (editor.selected[field.name] || []).filter(id => id !== option.value) } })} />{option.label}</label>)}</div>
    if (field.kind === 'select') return <select disabled={busy} required={field.required} value={editor.values[field.name] || ''} onChange={event => set(event.target.value)}><option value="">{q('select')}</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    if (field.kind === 'textarea') return <textarea disabled={busy} required={field.required} rows={field.name === 'memoContent' ? 7 : 3} maxLength={field.maxLength || 8000} value={editor.values[field.name] || ''} onChange={event => set(event.target.value)} />
    return <input disabled={busy} required={field.required} type={field.kind === 'number' ? 'number' : 'text'} min={field.min} step={field.kind === 'number' ? '1' : undefined} maxLength={field.maxLength || 300} value={editor.values[field.name] || ''} onChange={event => set(event.target.value)} />
  }
  const currentDefinition = () => {
    if (!editor) return null
    if (editor.kind === 'reviseCode') {
      const code = fullData.qualitativeCodes.find(item => item.id === editor.values.codeId)
      const revision = fullData.qualitativeCodeRevisions.find(item => item.id === code?.currentRevisionId)
      return revision && <div><h4>{revision.label} · r{revision.revisionNo}</h4><p>{revision.definition}</p><p>{q('inclusion')}: {revision.inclusion}</p><p>{q('exclusion')}: {revision.exclusion}</p></div>
    }
    if (editor.kind === 'editMemo') {
      const memo = fullData.theoryMemos.find(item => item.id === editor.values.theoryMemoId)
      return memo && <div><h4>{memo.title}</h4><p className="qualitative-prose">{memo.content}</p></div>
    }
    if (editor.kind === 'reviseSegment') {
      const segment = fullData.sourceSegments.find(item => item.id === editor.values.segmentId)
      const revision = fullData.sourceSegmentRevisions.find(item => item.id === segment?.currentRevisionId)
      return revision && <p>{locatorLabel(revision.primaryLocator)} · r{revision.revisionNo}</p>
    }
    return null
  }
  const cases = own(data.researchCases)
  const segmentWithdrawn = (id: string) => {
    const revision = data.sourceSegmentRevisions.find(item => item.id === id)
    const segment = data.sourceSegments.find(item => item.id === revision?.segmentId)
    return segment?.state === 'withdrawn' || data.sourceReferences.find(item => item.id === segment?.sourceReferenceId)?.state === 'withdrawn'
  }
  const sourceRecords = own(data.sourceReferences).filter(source => !initialInterviewId || source.owners.some(owner => owner.kind === 'interview' && owner.interviewId === initialInterviewId))
  const comparisonEditor = () => {
    if (!editor || editor.kind !== 'freezeComparison') return null
    const caseIds = editor.selected.caseIds || [], codeIds = editor.selected.codeRevisionIds || []
    return <section className="form-span-2 qualitative-comparison-editor"><p>{q('noAbsence')}</p>{caseIds.flatMap(caseId => {
      const caseRecord = data.researchCases.find(item => item.id === caseId)
      const interviewIds = data.interviewCaseLinks.filter(link => link.caseId === caseId && link.state === 'active').map(link => link.interviewId)
      const sourceIds = data.sourceReferences.filter(source => source.state !== 'withdrawn' && source.owners.some(owner => owner.kind === 'interview' && interviewIds.includes(owner.interviewId))).map(source => source.id)
      const segmentIds = data.sourceSegments.filter(segment => segment.state !== 'withdrawn' && sourceIds.includes(segment.sourceReferenceId)).map(segment => segment.id)
      const segments = data.sourceSegmentRevisions.filter(segment => segmentIds.includes(segment.segmentId))
      return codeIds.map(codeId => {
        const code = data.qualitativeCodeRevisions.find(item => item.id === codeId)
        const key = JSON.stringify([caseId, codeId])
        const review = reviews[key] || { caseId, codeRevisionId: codeId, state: 'not-examined' as const, reviewedSegmentRevisionIds: [] }
        const present = data.codingAssignments.some(assignment => assignment.state === 'active' && assignment.codeRevisionId === codeId && segments.some(segment => segment.id === assignment.segmentRevisionId))
        return <div className="qualitative-review" key={key}><h4>{caseRecord?.alias} · {code?.label} r{code?.revisionNo}</h4>{present ? <Badge tone="success">{q('present')}</Badge> : <>
          <Field label={q('verification')}><select disabled={busy} value={review.state} onChange={event => setReviews({ ...reviews, [key]: { ...review, state: event.target.value as Review['state'] } })}>{['not-examined', 'absent-reviewed', 'not-applicable', 'unresolved'].map(state => <option value={state} key={state}>{q(state as QualitativeMessage)}</option>)}</select></Field>
          {review.state !== 'not-examined' && <><fieldset className="qualitative-checkboxes"><legend>{q('reviewSegments')}</legend>{segments.map(segment => <label key={segment.id}><input disabled={busy} type="checkbox" checked={review.reviewedSegmentRevisionIds.includes(segment.id)} onChange={event => setReviews({ ...reviews, [key]: { ...review, reviewedSegmentRevisionIds: event.target.checked ? [...review.reviewedSegmentRevisionIds, segment.id] : review.reviewedSegmentRevisionIds.filter(id => id !== segment.id) } })} />{data.sourceSegments.find(item => item.id === segment.segmentId)?.label} · r{segment.revisionNo} · {locatorLabel(segment.primaryLocator)}</label>)}</fieldset><Field label={q('reviewNote')} required={review.state === 'absent-reviewed'}><textarea disabled={busy} required={review.state === 'absent-reviewed'} maxLength={2000} value={review.reviewNote || ''} onChange={event => setReviews({ ...reviews, [key]: { ...review, reviewNote: event.target.value } })} /></Field></>}
        </>}</div>
      })
    })}</section>
  }
  const comparisonView = (run: ComparisonRun) => <><p>{q('frozenAt')}: {run.frozenAt} · {q('unit')}: {q(run.rule.unit)}</p><p>{q('scope')}: {run.eligibleInterviewIds.map(id => data.interviews.find(item => item.id === id)?.participantAlias || id).join(', ')}</p><div className="data-table-wrap"><table className="data-table qualitative-comparison-table"><thead><tr><th>{q('case')}</th>{run.codeRevisionIds.map(id => { const code = data.qualitativeCodeRevisions.find(item => item.id === id); return <th key={id}>{revisionLink('qualitativeCodeRevisions', id, `${code?.label || id} · r${code?.revisionNo || ''}`)}</th> })}</tr></thead><tbody>{run.caseSnapshots.map(caseRecord => <tr key={caseRecord.id}><th>{caseRecord.alias}</th>{run.codeRevisionIds.map(codeId => { const cell = run.cells.find(item => item.caseId === caseRecord.id && item.codeRevisionId === codeId); const invalid = cell && (cell.reviewedSegmentRevisionIds.some(segmentWithdrawn) || cell.assignmentIds.some(id => { const assignment = data.codingAssignments.find(item => item.id === id); return assignment?.state === 'retracted' || Boolean(assignment && segmentWithdrawn(assignment.segmentRevisionId)) })); return <td key={codeId} data-label={data.qualitativeCodeRevisions.find(item => item.id === codeId)?.label}>{cell && <><strong>{q(cell.state)}</strong>{invalid && <p className="text-danger">{q('currentInvalid')}</p>}{cell.reviewNote && <p>{cell.reviewNote}</p>}{cell.assignmentIds.map(id => <p key={id}>{revisionLink('codingAssignments', id, id)}</p>)}{cell.reviewedSegmentRevisionIds.map(id => <p key={id}>{revisionLink('sourceSegmentRevisions', id, id)}</p>)}</>}</td> })}</tr>)}</tbody></table></div></>

  return <section className="qualitative-workspace">
    <div className="panel qualitative-intro"><div><p className="eyebrow">{q('title')}</p><h2>{q('description')}</h2><p>{q('privacyBoundary')}</p></div><Field label={q('project')}><select disabled={busy} value={projectId} onChange={event => { setProjectSelection(event.target.value); close(); setTarget(null); setNotice(null) }}>{data.projects.map(project => <option key={project.id} value={project.id}>{project.shortTitle || project.title}</option>)}</select></Field></div>
    {!projectId ? <p>{q('noProject')}</p> : <>
      <div className="panel qualitative-tabs"><FilterChips ariaLabel={q('title')} value={tab} onChange={value => setTab(value as typeof tab)} options={tabs.map(value => ({ value, label: q(value) }))} /></div>
      {notice && <p className="qualitative-notice" role="status">{q(notice)}</p>}
      {tab === 'cases' && <>
        <div className="qualitative-actions"><Button onClick={() => open('createCase')}>{q('createCase')}</Button><Button onClick={() => open('createDimension')}>{q('createDimension')}</Button><Button onClick={() => open('linkInterviewCase')}>{q('linkInterviewCase')}</Button></div>
        <div className="qualitative-records">{cases.map(item => card('researchCases', item.id, item.alias, <><p>{q('unit')}: {q(item.unit)}</p><ul>{item.attributes.map(attribute => { const dimension = data.samplingDimensions.find(d => d.id === attribute.dimensionId); return <li key={attribute.dimensionId}>{dimension?.label}: {dimension?.categories.find(category => category.id === attribute.categoryId)?.label}</li> })}</ul><ul>{data.interviewCaseLinks.filter(link => link.caseId === item.id).map(link => <li key={link.id}>{revisionLink('interviews', link.interviewId, data.interviews.find(interview => interview.id === link.interviewId)?.participantAlias || link.interviewId)} · {q(link.role)} · {q(link.state)}</li>)}</ul></>, item.state === 'active' && <Button size="sm" onClick={() => archive('researchCases', item.id)}>{q('archive')}</Button>, item.state))}</div>
        {own(data.samplingDimensions).map(item => card('samplingDimensions', item.id, item.label, <p>{q(item.unit)} · {item.categories.map(category => `${category.label}${category.retired ? ` (${q('retired')})` : ''}`).join(' / ')}</p>, item.state === 'active' && <Button size="sm" onClick={() => archive('samplingDimensions', item.id)}>{q('archive')}</Button>, item.state))}
      </>}
      {tab === 'sources' && <>
        <div className="qualitative-actions"><Button onClick={() => open('registerSource')}>{q('registerSource')}</Button><Button onClick={() => open('createSegment')}>{q('createSegment')}</Button></div><p>{q('pinned')}</p>
        <div className="qualitative-records">{sourceRecords.map(source => {
          const revisions = data.sourceRevisions.filter(item => item.sourceReferenceId === source.id).sort((a, b) => b.revisionNo - a.revisionNo)
          return card('sourceReferences', source.id, source.alias, <><p>{q(source.sourceKind)}</p><ul>{source.owners.map(owner => <li key={owner.kind === 'interview' ? owner.interviewId : owner.fieldVisitId}>{owner.kind === 'interview' ? revisionLink('interviews', owner.interviewId, data.interviews.find(item => item.id === owner.interviewId)?.participantAlias || owner.interviewId) : revisionLink('fieldVisits', owner.fieldVisitId, data.fieldVisits.find(item => item.id === owner.fieldVisitId)?.purpose || owner.fieldVisitId)}</li>)}</ul><details><summary>{q('sourceVersion')} ({revisions.length})</summary>{revisions.map(revision => <div key={revision.id} className="qualitative-version"><p>{revisionLink('sourceRevisions', revision.id, `${revision.versionLabel} · r${revision.revisionNo}`)} · {q(revision.researcherVerification)} · {q(revision.id === source.currentRevisionId ? 'current' : 'historical')}</p><p className="qualitative-reference">{referenceLabel(revision.externalRef)}</p><Button size="sm" onClick={() => void copyReference(referenceLabel(revision.externalRef))}>{q('copy')}</Button></div>)}</details><div className="qualitative-segments">{data.sourceSegments.filter(segment => segment.sourceReferenceId === source.id).map(segment => {
            const segmentRevision = data.sourceSegmentRevisions.find(item => item.id === segment.currentRevisionId)
            if (!segmentRevision) return null
            return <div className="qualitative-version" key={segment.id}><h4>{revisionLink('sourceSegments', segment.id, segment.label)}</h4><p>{revisionLink('sourceSegmentRevisions', segmentRevision.id, `${locatorLabel(segmentRevision.primaryLocator)} · r${segmentRevision.revisionNo}`)} · {q(segmentRevision.verification)}</p><p>{revisionLink('sourceRevisions', segmentRevision.sourceRevisionId, data.sourceRevisions.find(item => item.id === segmentRevision.sourceRevisionId)?.versionLabel || segmentRevision.sourceRevisionId)}</p><div className="qualitative-actions"><Button size="sm" disabled={source.state !== 'active' || segment.state !== 'active'} onClick={() => open('assignCode', { segmentRevisionId: segmentRevision.id })}>{q('assignCode')}</Button><Button size="sm" disabled={source.state !== 'active' || segment.state !== 'active'} onClick={() => open('reviseSegment', { segmentId: segment.id, sourceReferenceId: source.id, sourceRevisionId: segmentRevision.sourceRevisionId, locatorKind: segmentRevision.primaryLocator.kind })}>{q('reviseSegment')}</Button></div></div>
          })}</div></>, <>{source.state === 'active' && <><Button size="sm" onClick={() => open('reviseSource', { sourceReferenceId: source.id })}>{q('reviseSource')}</Button><Button size="sm" onClick={() => open('createSegment', { sourceReferenceId: source.id, sourceRevisionId: source.currentRevisionId })}>{q('createSegment')}</Button><Button size="sm" onClick={() => archive('sourceReferences', source.id)}>{q('archive')}</Button></>}{source.state !== 'withdrawn' && <Button size="sm" variant="danger" onClick={() => open('withdrawSource', { sourceReferenceId: source.id })}>{q('withdraw')}</Button>}</>, source.state)
        })}</div>
      </>}
      {tab === 'codes' && <>
        <div className="qualitative-actions"><Button onClick={() => open('createCode')}>{q('createCode')}</Button><Button onClick={() => open('assignCode')}>{q('assignCode')}</Button><Button onClick={() => open('relateCodes')}>{q('relateCodes')}</Button></div><p>{q('pinned')}</p>
        <div className="qualitative-records">{own(data.qualitativeCodes).map(code => {
          const revision = data.qualitativeCodeRevisions.find(item => item.id === code.currentRevisionId)
          if (!revision) return null
          return card('qualitativeCodes', code.id, revision.label, <><p><Badge>{q(revision.stage)}</Badge> · r{revision.revisionNo}</p><p>{revision.definition}</p><dl><dt>{q('inclusion')}</dt><dd>{revision.inclusion || '—'}</dd><dt>{q('exclusion')}</dt><dd>{revision.exclusion || '—'}</dd></dl><details><summary>{q('history')}</summary>{data.qualitativeCodeRevisions.filter(item => item.codeId === code.id).map(item => <div key={item.id} className="qualitative-version"><p>{revisionLink('qualitativeCodeRevisions', item.id, `${item.label} · r${item.revisionNo}`)}</p><p>{item.definition}</p><p>{item.changeReason}</p></div>)}</details><ul>{data.codeRelations.filter(relation => relation.fromCodeRevisionId === revision.id || relation.toCodeRevisionId === revision.id).map(relation => <li key={relation.id}>{q(relation.kind)}: {revisionLink('codeRelations', relation.id, relation.id)} · {q(relation.state)}</li>)}</ul></>, code.state === 'active' && <><Button size="sm" onClick={() => open('reviseCode', { codeId: code.id, label: revision.label, stage: revision.stage, definition: revision.definition, inclusion: revision.inclusion, exclusion: revision.exclusion })}>{q('reviseCode')}</Button><Button size="sm" onClick={() => open('assignCode', { codeRevisionId: revision.id })}>{q('assignCode')}</Button><Button size="sm" onClick={() => archive('qualitativeCodes', code.id)}>{q('archive')}</Button></>, code.state)
        })}</div>
        <h3>{q('assignment')}</h3>{own(data.codingAssignments).map(assignment => {
          const code = data.qualitativeCodeRevisions.find(item => item.id === assignment.codeRevisionId)
          const segment = data.sourceSegmentRevisions.find(item => item.id === assignment.segmentRevisionId)
          return card('codingAssignments', assignment.id, `${code?.label || assignment.codeRevisionId} · r${code?.revisionNo || ''}`, <><p>{revisionLink('sourceSegmentRevisions', assignment.segmentRevisionId, segment ? locatorLabel(segment.primaryLocator) : assignment.segmentRevisionId)}</p><p>{assignment.rationale}</p><p>{q('researcher')}: {assignment.researcherAlias}</p></>, <>{assignment.state === 'active' && <Button size="sm" onClick={() => open('recodeAssignment', { assignmentId: assignment.id, codeRevisionId: assignment.codeRevisionId, segmentRevisionId: assignment.segmentRevisionId })}>{q('recodeAssignment')}</Button>}{assignment.state !== 'retracted' && <Button size="sm" variant="danger" onClick={() => open('retractAssignment', { assignmentId: assignment.id })}>{q('retractAssignment')}</Button>}</>, assignment.state)
        })}
      </>}
      {tab === 'memos' && <>
        <div className="qualitative-actions"><Button onClick={() => open('createMemo')}>{q('createMemo')}</Button><Button onClick={() => open('activateAnalyticalMemo')}>{q('activateAnalyticalMemo')}</Button><Button onClick={() => open('linkMemoMaterial')}>{q('linkMemoMaterial')}</Button><Button onClick={() => open('deriveClaim')}>{q('deriveClaim')}</Button></div><p>{q('reuseMemo')}</p>
        <div className="qualitative-records">{own(data.analyticalMemoFacets).map(facet => {
          const memo = data.theoryMemos.find(item => item.id === facet.theoryMemoId)
          if (!memo) return null
          return card('analyticalMemoFacets', facet.id, memo.title, <><p>{q(facet.analysisKind)}</p><p className="qualitative-prose">{memo.content}</p><p>{revisionLink('theoryMemos', memo.id, `TheoryMemo · ${memo.id}`)}</p><details><summary>{q('history')}</summary>{data.theoryMemoRevisions.filter(item => item.theoryMemoId === memo.id).map(revision => <div key={revision.id} className="qualitative-version"><h4>{revisionLink('theoryMemoRevisions', revision.id, `${revision.snapshot.title} · r${revision.revisionNo}`)}</h4><p className="qualitative-prose">{revision.snapshot.content}</p><ul>{data.memoMaterialLinks.filter(link => link.memoRevisionId === revision.id).map(link => <li key={link.id}>{q(link.role)} · {revisionLink('memoMaterialLinks', link.id, link.note || link.id)} · {q(link.state)}</li>)}</ul></div>)}</details></>, facet.state === 'active' && <><Button size="sm" onClick={() => open('editMemo', { theoryMemoId: memo.id, memoTitle: memo.title, memoContent: memo.content })}>{q('editMemo')}</Button><Button size="sm" onClick={() => open('linkMemoMaterial', { memoRevisionId: facet.currentRevisionId })}>{q('linkMemoMaterial')}</Button><Button size="sm" onClick={() => open('deriveClaim', { memoRevisionId: facet.currentRevisionId })}>{q('deriveClaim')}</Button><Button size="sm" onClick={() => archive('analyticalMemoFacets', facet.id)}>{q('archive')}</Button></>, facet.state)
        })}</div>
      </>}
      {tab === 'comparison' && <>
        <div className="qualitative-actions"><Button onClick={() => open('freezeComparison')}>{q('freezeComparison')}</Button></div><p>{q('freezeHint')}</p>{own(data.comparisonRuns).map(run => card('comparisonRuns', run.id, run.title, comparisonView(run)))}
      </>}
      {tab === 'trace' && <><p>{q('evidenceBridge')}</p><Link className="button button--secondary button--sm" to="/evidence?view=provenance">{q('openEvidence')}</Link><ProvenanceTrace data={fullData} projectId={projectId} target={target} onSelect={setTarget} /></>}
      {tab === 'history' && <>
        <p>{q('historyHint')}</p>{own(data.qualitativeChangeEvents).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(event => card('qualitativeChangeEvents', event.id, `${event.operation} · ${event.createdAt}`, <><p>{event.researcherAlias} · {event.reason}</p><ul>{event.affected.map(item => <li key={`${item.collection}|${item.id}`}>{revisionLink(item.collection as WorkspaceCollectionKey, item.id, `${item.collection} · ${item.id}`)}</li>)}</ul></>))}
      </>}
      {tab !== 'trace' && tab !== 'history' && !(tab === 'cases' ? cases.length || own(data.samplingDimensions).length : tab === 'sources' ? sourceRecords.length : tab === 'codes' ? own(data.qualitativeCodes).length : tab === 'memos' ? own(data.analyticalMemoFacets).length : own(data.comparisonRuns).length) && <EmptyState title={q(tab)} description={q('empty')} />}
    </>}
    <Modal open={Boolean(editor)} title={editor ? q(editor.kind === 'archiveRecord' ? 'archive' : editor.kind === 'withdrawSource' ? 'withdraw' : editor.kind) : q('title')} description={q(editor?.kind === 'retractAssignment' ? 'retractHint' : editor?.kind === 'archiveRecord' || editor?.kind === 'withdrawSource' ? 'archiveHint' : 'pinned')} size="lg" onClose={close} footer={<><Button disabled={busy} onClick={close}>{q('cancel')}</Button><Button type="submit" form="qualitative-editor" variant={editor?.kind === 'withdrawSource' || editor?.kind === 'retractAssignment' ? 'danger' : 'primary'} disabled={busy} aria-busy={busy}>{q('save')}</Button></>}>
      {editor && <form id="qualitative-editor" className="form-grid form-grid--spaced" onSubmit={event => void save(event)}>
        {error && <p className="text-danger form-span-2" role="alert">{q(error)}</p>}
        {error && editor.expectedRevision !== fullData.workspace.revision && <section className="form-span-2 qualitative-review"><p>{q('changedDraft')}</p><details open><summary>{q('current')}</summary>{currentDefinition()}</details><Button type="button" disabled={busy} onClick={() => { setEditor({ ...editor, expectedRevision: fullData.workspace.revision }); setError(null) }}>{q('keepDraft')}</Button></section>}
        {draftFields(editor, fullData, locale).map(field => field.kind === 'multi' ? <fieldset className="qualitative-multi-field form-span-2" key={field.name}><legend>{q(field.label)}{field.required ? ' *' : ''}</legend>{fieldControl(field)}{field.hint && <p>{q(field.hint)}</p>}</fieldset> : <Field key={field.name} label={q(field.label)} required={field.required} hint={field.hint ? q(field.hint) : undefined} className={field.kind === 'textarea' ? 'form-span-2' : ''}>{fieldControl(field)}</Field>)}
        {comparisonEditor()}
      </form>}
    </Modal>
  </section>
}
