import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../../i18n/settings'
import { createEmptyWorkspace } from '../../models/empty-workspace'
import type { WorkspaceData } from '../../models/domain'
import { applyProvenanceCommand, type ProvenanceCommand } from '../../utils/provenance-commands'
import { QualitativeWorkspace } from './QualitativeWorkspace'
import { ProvenanceTrace } from './ProvenanceTrace'
import { locatorFromDraft } from './qualitative-editor'

const timestamp = '2026-10-08T00:00:00.000Z'
const meta = { createdAt: timestamp, updatedAt: timestamp, isDemo: true }
function seed(): WorkspaceData {
  const data = createEmptyWorkspace({ id: 'synthetic-ui-workspace', now: new Date(timestamp) })
  data.projects = [{ ...meta, id: 'synthetic-project', title: 'SYNTHETIC family study', shortTitle: 'SYNTHETIC', topic: '', method: 'Qualitative', status: 'Analysis', startDate: '2026-10-08', notes: '' }]
  data.workspace.activeProjectId = data.projects[0]!.id
  data.interviews = ['I01', 'I02'].map(alias => ({ ...meta, id: `synthetic-${alias}`, projectId: data.projects[0]!.id, participantAlias: `SYNTHETIC ${alias}`, status: 'Completed' as const, transcriptStatus: 'Complete' as const, codingStatus: 'In Progress' as const, memoStatus: 'Not Started' as const, notes: '' }))
  return data
}
function command(data: WorkspaceData, value: Omit<ProvenanceCommand, 'projectId'> & { type: ProvenanceCommand['type'] }): WorkspaceData {
  return applyProvenanceCommand(data, { ...value, projectId: data.projects[0]!.id } as ProvenanceCommand, { now: timestamp, researcherAlias: 'SYNTHETIC R01', reason: 'SYNTHETIC metadata-only test' })
}
function codedSeed(withAssignment = true): WorkspaceData {
  let data = seed()
  data = command(data, { type: 'registerSource', id: 'synthetic-source', alias: 'SYNTHETIC T01', sourceKind: 'transcript', owners: [{ kind: 'interview', interviewId: 'synthetic-I01' }, { kind: 'interview', interviewId: 'synthetic-I02' }], versionLabel: 'v1', externalRef: { kind: 'local-token', token: 'SYNTHETIC-T01-v1' } } as Omit<Extract<ProvenanceCommand, { type: 'registerSource' }>, 'projectId'>)
  data = command(data, { type: 'createSegment', id: 'synthetic-segment', sourceReferenceId: 'synthetic-source', sourceRevisionId: data.sourceReferences[0]!.currentRevisionId, label: 'SYNTHETIC locator only', primaryLocator: { kind: 'lineRange', start: 12, end: 18 } } as Omit<Extract<ProvenanceCommand, { type: 'createSegment' }>, 'projectId'>)
  data = command(data, { type: 'createCode', id: 'synthetic-code', label: 'SYNTHETIC care coordination', stage: 'initial', definition: 'SYNTHETIC definition r1', inclusion: '', exclusion: '' } as Omit<Extract<ProvenanceCommand, { type: 'createCode' }>, 'projectId'>)
  if (withAssignment) data = command(data, { type: 'assignCode', id: 'synthetic-assignment', segmentRevisionId: data.sourceSegments[0]!.currentRevisionId, codeRevisionId: data.qualitativeCodes[0]!.currentRevisionId } as Omit<Extract<ProvenanceCommand, { type: 'assignCode' }>, 'projectId'>)
  return data
}
function LanguageSwitch() {
  const { setLocale } = useI18n()
  return <button onClick={() => setLocale('en')}>SYNTHETIC switch language</button>
}
function mount(initial = seed(), fail = false, conflictOnce = false) {
  let snapshot = initial
  let conflictPending = conflictOnce
  function Harness() {
    const [data, setData] = useState(initial)
    return <QualitativeWorkspace data={data} fullData={data} updateData={async updater => {
      if (fail) throw new Error('synthetic-write-rejected')
      if (conflictPending) {
        conflictPending = false
        const otherEdit = command(snapshot, { type: 'reviseCode', codeId: 'synthetic-code', label: 'SYNTHETIC care coordination', stage: 'initial', definition: 'SYNTHETIC concurrent definition', inclusion: '', exclusion: '' } as Omit<Extract<ProvenanceCommand, { type: 'reviseCode' }>, 'projectId'>)
        snapshot = { ...otherEdit, workspace: { ...otherEdit.workspace, revision: otherEdit.workspace.revision + 1 } }
        setData(snapshot)
        throw new Error('synthetic-concurrent-write')
      }
      const next = updater(snapshot)
      snapshot = { ...next, workspace: { ...next.workspace, revision: next.workspace.revision + 1 } }
      setData(snapshot)
    }} />
  }
  render(<MemoryRouter><I18nProvider><LanguageSwitch /><Harness /></I18nProvider></MemoryRouter>)
  return () => snapshot
}
const change = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name, { exact: false, selector: 'input, textarea, select' }), { target: { value } })
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const save = () => fireEvent.submit(document.getElementById('qualitative-editor')!)
beforeEach(() => { localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en' })) })
afterEach(() => { cleanup(); localStorage.clear() })

describe('metadata-only qualitative workflow', () => {
  it('registers anonymous NVivo references and pinned locators without reading external files', async () => {
    const read = mount()
    click('Sources & locators'); click('Register external source')
    change('Anonymous alias', 'SYNTHETIC NVivo reference'); change('External reference type', 'qda-reference')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Anonymous interview · SYNTHETIC I01' }))
    change('Anonymous QDA project token', 'SYNTHETIC-Q01'); change('Anonymous QDA source token', 'SYNTHETIC-T01'); change('Anonymous QDA object token', 'SYNTHETIC-O01'); change('Reason for revision / operation', 'SYNTHETIC reference metadata')
    save()
    await waitFor(() => expect(read().sourceReferences).toHaveLength(1))
    expect(read().sourceRevisions[0]!.externalRef).toEqual({ kind: 'qda-reference', provider: 'nvivo', projectToken: 'SYNTHETIC-Q01', sourceToken: 'SYNTHETIC-T01', objectToken: 'SYNTHETIC-O01' })
    const article = screen.getByRole('heading', { name: 'SYNTHETIC NVivo reference' }).closest('article')!
    fireEvent.click(within(article).getByRole('button', { name: 'Add segment locator' }))
    change('Researcher label', 'SYNTHETIC metadata range'); change('Start', '12'); change('End', '18'); change('Reason for revision / operation', 'SYNTHETIC locator registration')
    save()
    await waitFor(() => expect(read().sourceSegments).toHaveLength(1))
    expect(read().sourceSegmentRevisions[0]!.sourceRevisionId).toBe(read().sourceReferences[0]!.currentRevisionId)
    expect(read().sourceSegmentRevisions[0]!.primaryLocator).toEqual({ kind: 'lineRange', start: 12, end: 18 })
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="https://"]')).not.toBeInTheDocument()
  })
  it('creates a researcher code through the form and retains its research content when the language changes', async () => {
    const read = mount()
    click('Codes & assignments'); click('Add researcher code')
    change('Researcher label', 'SYNTHETIC family coordination'); change('Definition', 'SYNTHETIC metadata judgment'); change('Reason for revision / operation', 'SYNTHETIC initial code')
    save()
    await waitFor(() => expect(read().qualitativeCodes).toHaveLength(1))
    expect(read().qualitativeCodeRevisions[0]!.definition).toBe('SYNTHETIC metadata judgment')
    const id = read().qualitativeCodes[0]!.id
    cleanup(); localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'zh-CN' })); const readAgain = mount(read())
    click('编码与赋码'); click('SYNTHETIC switch language')
    expect(screen.getByRole('button', { name: 'Codes & assignments' })).toBeVisible()
    expect(readAgain().qualitativeCodes[0]!.id).toBe(id)
    expect(readAgain().qualitativeCodeRevisions[0]!.definition).toBe('SYNTHETIC metadata judgment')
  })

  it('retains the entire form and writes no rows after a rejected save', async () => {
    const read = mount(seed(), true)
    click('Codes & assignments'); click('Add researcher code')
    change('Researcher label', 'SYNTHETIC retained draft'); change('Definition', 'SYNTHETIC retained definition'); change('Reason for revision / operation', 'SYNTHETIC reason')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft remains available')
    expect(screen.getByLabelText('Researcher label', { exact: false })).toHaveValue('SYNTHETIC retained draft')
    expect(screen.getByLabelText('Definition', { exact: false })).toHaveValue('SYNTHETIC retained definition')
    expect(read().qualitativeCodes).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('revises a code without moving existing assignments and reuses its stable identity', async () => {
    const initial = codedSeed(), oldRevision = initial.qualitativeCodes[0]!.currentRevisionId
    const read = mount(initial)
    click('Codes & assignments'); click('Revise code definition')
    change('Definition', 'SYNTHETIC definition r2'); change('Reason for revision / operation', 'SYNTHETIC narrowed boundary')
    save()
    await waitFor(() => expect(read().qualitativeCodeRevisions).toHaveLength(2))
    expect(read().qualitativeCodes).toHaveLength(1)
    expect(read().qualitativeCodes[0]!.id).toBe('synthetic-code')
    expect(read().codingAssignments[0]!.codeRevisionId).toBe(oldRevision)
    expect(read().qualitativeCodeRevisions.find(item => item.id === oldRevision)!.definition).toBe('SYNTHETIC definition r1')
  })
  it('shows a concurrent definition and requires explicit review before retrying the retained draft', async () => {
    const initial = codedSeed(), oldRevision = initial.qualitativeCodes[0]!.currentRevisionId
    const read = mount(initial, false, true)
    click('Codes & assignments'); click('Revise code definition')
    change('Definition', 'SYNTHETIC retained revised definition'); change('Reason for revision / operation', 'SYNTHETIC explicit revision')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft remains available')
    expect(within(screen.getByRole('dialog')).getByText('SYNTHETIC concurrent definition')).toBeVisible()
    expect(screen.getByLabelText('Definition', { exact: false, selector: 'textarea' })).toHaveValue('SYNTHETIC retained revised definition')
    expect(read().qualitativeCodeRevisions).toHaveLength(2)
    click('Reviewed; retry with this draft')
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    save()
    await waitFor(() => expect(read().qualitativeCodeRevisions).toHaveLength(3))
    expect(read().qualitativeCodeRevisions[2]!.definition).toBe('SYNTHETIC retained revised definition')
    expect(read().codingAssignments[0]!.codeRevisionId).toBe(oldRevision)
  })

  it('allows withdrawal of an archived source while protecting frozen comparison history', async () => {
    let initial = codedSeed()
    initial = command(initial, { type: 'createCase', id: 'synthetic-household', alias: 'SYNTHETIC F01', unit: 'household' } as Omit<Extract<ProvenanceCommand, { type: 'createCase' }>, 'projectId'>)
    initial = command(initial, { type: 'linkInterviewCase', interviewId: 'synthetic-I01', caseId: 'synthetic-household' } as Omit<Extract<ProvenanceCommand, { type: 'linkInterviewCase' }>, 'projectId'>)
    initial = command(initial, { type: 'linkInterviewCase', interviewId: 'synthetic-I02', caseId: 'synthetic-household' } as Omit<Extract<ProvenanceCommand, { type: 'linkInterviewCase' }>, 'projectId'>)
    initial = command(initial, { type: 'freezeComparison', title: 'SYNTHETIC repeat interview comparison', caseIds: ['synthetic-household'], codeRevisionIds: [initial.qualitativeCodes[0]!.currentRevisionId], unit: 'household' } as Omit<Extract<ProvenanceCommand, { type: 'freezeComparison' }>, 'projectId'>)
    initial = command(initial, { type: 'archiveRecord', collection: 'sourceReferences', recordId: 'synthetic-source' } as Omit<Extract<ProvenanceCommand, { type: 'archiveRecord' }>, 'projectId'>)
    const frozen = structuredClone(initial.comparisonRuns[0])
    const read = mount(initial)
    click('Sources & locators'); click('Withdraw source')
    change('Reason for revision / operation', 'SYNTHETIC withdrawal'); save()
    await waitFor(() => expect(read().sourceReferences[0]!.state).toBe('withdrawn'))
    expect(read().comparisonRuns[0]).toEqual(frozen)
    expect(read().comparisonRuns[0]!.caseSnapshots).toHaveLength(1)
    click('Case comparison')
    expect(screen.getByText('Present', { exact: true })).toBeVisible()
    expect(screen.getByText(/A source or assignment is now withdrawn/)).toBeVisible()
  })

  it('retracts one superseded assignment through an explicit reason while preserving sources, other assignments and frozen comparisons', async () => {
    let initial = codedSeed()
    initial = command(initial, { type: 'createCase', id: 'synthetic-household', alias: 'SYNTHETIC F01', unit: 'household' } as Omit<Extract<ProvenanceCommand, { type: 'createCase' }>, 'projectId'>)
    initial = command(initial, { type: 'linkInterviewCase', interviewId: 'synthetic-I01', caseId: 'synthetic-household' } as Omit<Extract<ProvenanceCommand, { type: 'linkInterviewCase' }>, 'projectId'>)
    initial = command(initial, { type: 'freezeComparison', title: 'SYNTHETIC fixed assignment comparison', caseIds: ['synthetic-household'], codeRevisionIds: [initial.qualitativeCodes[0]!.currentRevisionId], unit: 'household' } as Omit<Extract<ProvenanceCommand, { type: 'freezeComparison' }>, 'projectId'>)
    initial = command(initial, { type: 'reviseCode', codeId: 'synthetic-code', label: 'SYNTHETIC care coordination', stage: 'initial', definition: 'SYNTHETIC definition r2', inclusion: '', exclusion: '' } as Omit<Extract<ProvenanceCommand, { type: 'reviseCode' }>, 'projectId'>)
    initial = command(initial, { type: 'recodeAssignment', assignmentId: 'synthetic-assignment', codeRevisionId: initial.qualitativeCodes[0]!.currentRevisionId } as Omit<Extract<ProvenanceCommand, { type: 'recodeAssignment' }>, 'projectId'>)
    const frozen = structuredClone(initial.comparisonRuns[0]), replacementId = initial.codingAssignments[1]!.id
    const read = mount(initial)
    click('Codes & assignments')
    const original = screen.getByRole('button', { name: 'synthetic-assignment' }).closest('article')!
    fireEvent.click(within(original).getByRole('button', { name: 'Retract this assignment' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Other assignments and sources remain available')
    change('Reason for revision / operation', 'SYNTHETIC correcting the historical assignment'); save()
    await waitFor(() => expect(read().codingAssignments[0]!.state).toBe('retracted'))
    expect(read().codingAssignments.find(item => item.id === replacementId)!.state).toBe('active')
    expect(read().sourceReferences[0]!.state).toBe('active')
    expect(read().comparisonRuns[0]).toEqual(frozen)
    expect(within(original).queryByRole('button', { name: 'Retract this assignment' })).not.toBeInTheDocument()
    click('Case comparison')
    expect(screen.getByText('Present', { exact: true })).toBeVisible()
    expect(screen.getByText(/A source or assignment is now withdrawn/)).toBeVisible()
    click('Codes & assignments')
    const replacement = screen.getByRole('button', { name: replacementId }).closest('article')!
    fireEvent.click(within(replacement).getByRole('button', { name: 'Retract this assignment' }))
    change('Reason for revision / operation', 'SYNTHETIC correcting the active assignment'); save()
    await waitFor(() => expect(read().codingAssignments.find(item => item.id === replacementId)!.state).toBe('retracted'))
    expect(read().sourceSegments[0]!.state).toBe('active')
    expect(read().qualitativeChangeEvents.at(-1)!.operation).toBe('unlink')
  })

  it('starts every unassigned comparison cell as not examined and retains an invalid absence-review draft', async () => {
    let initial = codedSeed(false)
    initial = command(initial, { type: 'createCase', id: 'synthetic-household', alias: 'SYNTHETIC F01', unit: 'household' } as Omit<Extract<ProvenanceCommand, { type: 'createCase' }>, 'projectId'>)
    initial = command(initial, { type: 'linkInterviewCase', interviewId: 'synthetic-I01', caseId: 'synthetic-household' } as Omit<Extract<ProvenanceCommand, { type: 'linkInterviewCase' }>, 'projectId'>)
    const read = mount(initial)
    click('Case comparison'); click('Save comparison snapshot')
    change('Comparison title', 'SYNTHETIC checked range'); fireEvent.click(screen.getByLabelText('SYNTHETIC F01')); fireEvent.click(screen.getByLabelText('SYNTHETIC care coordination · Initial code · r1'))
    const review = screen.getByRole('heading', { name: 'SYNTHETIC F01 · SYNTHETIC care coordination r1' }).closest('.qualitative-review')!
    expect(within(review as HTMLElement).getByDisplayValue('Not examined')).toBeVisible()
    fireEvent.change(within(review as HTMLElement).getByLabelText('Researcher verification'), { target: { value: 'absent-reviewed' } })
    change('Review rationale', 'SYNTHETIC review without a selected source'); change('Reason for revision / operation', 'SYNTHETIC review')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft remains available')
    expect(read().comparisonRuns).toHaveLength(0)
    expect(screen.getByLabelText('Comparison title', { exact: false })).toHaveValue('SYNTHETIC checked range')
  })
})

describe('historical source trace', () => {
  it('shows the original locator and external reference after source replacement and reanchoring', () => {
    let data = codedSeed()
    const oldSegmentId = data.sourceSegments[0]!.currentRevisionId, oldSourceId = data.sourceReferences[0]!.currentRevisionId
    data = command(data, { type: 'reviseSource', sourceReferenceId: 'synthetic-source', versionLabel: 'v2', externalRef: { kind: 'local-token', token: 'SYNTHETIC-T01-v2' } } as Omit<Extract<ProvenanceCommand, { type: 'reviseSource' }>, 'projectId'>)
    data = command(data, { type: 'reviseSegment', segmentId: 'synthetic-segment', sourceRevisionId: data.sourceReferences[0]!.currentRevisionId, primaryLocator: { kind: 'lineRange', start: 14, end: 20 } } as Omit<Extract<ProvenanceCommand, { type: 'reviseSegment' }>, 'projectId'>)
    render(<I18nProvider><ProvenanceTrace data={data} projectId="synthetic-project" target={{ collection: 'sourceSegmentRevisions', id: oldSegmentId }} onSelect={() => undefined} /></I18nProvider>)
    expect(screen.getByText('L12–18')).toBeVisible()
    expect(screen.queryByText('L14–20')).not.toBeInTheDocument()
    cleanup()
    render(<I18nProvider><ProvenanceTrace data={data} projectId="synthetic-project" target={{ collection: 'sourceRevisions', id: oldSourceId }} onSelect={() => undefined} /></I18nProvider>)
    expect(screen.getByText('SYNTHETIC-T01-v1')).toBeVisible()
    expect(screen.queryByText('SYNTHETIC-T01-v2')).not.toBeInTheDocument()
    expect(screen.getByText(/Current or historical relationships protect this record/)).toBeVisible()
  })
  it('rejects reversed ranges before creating any command', () => {
    expect(() => locatorFromDraft({ locatorKind: 'lineRange', start: '18', end: '12' })).toThrow('invalid-locator')
    expect(locatorFromDraft({ locatorKind: 'timeRange', start: '0', end: '120' })).toEqual({ kind: 'timeRange', startMs: 0, endMs: 120 })
  })
})
