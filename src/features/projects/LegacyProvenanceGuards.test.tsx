import { useRef, useState, type ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { QUICK_ADD_EVENT } from '../../app/navigationEvents'
import { I18nProvider, useI18n } from '../../i18n'
import { createEmptyWorkspace } from '../../models/empty-workspace'
import type { WorkspaceData } from '../../models/domain'
import { applyProvenanceCommand, reconcileProvenanceRootEdits } from '../../utils/provenance-commands'
import { assertProvenanceGraph } from '../../utils/provenance-graph'
import { ResearchGraphWorkspace } from './ResearchGraphWorkspace'
import { TheoryMemoWorkspace } from '../theory/TheoryMemoWorkspace'
import { PublishingPage } from '../publishing/PublishingPage'

const timestamp = '2026-10-08T09:00:00.000Z'
function syntheticWorkspace() {
  const empty = createEmptyWorkspace({ id: 'synthetic-guard-workspace', now: new Date(timestamp) })
  const candidate = structuredClone(empty)
  const meta = (id: string) => ({ id, createdAt: timestamp, updatedAt: timestamp, isDemo: false })
  candidate.projects.push({ ...meta('synthetic-project'), title: 'Synthetic family study', shortTitle: 'Synthetic', method: 'Qualitative', status: 'Analysis', topic: 'Synthetic metadata', startDate: '2026-10-08', notes: '' })
  candidate.claims.push({ ...meta('synthetic-claim'), projectId: 'synthetic-project', text: 'Synthetic analytical claim', status: 'draft', notes: '' })
  candidate.evidence.push({ ...meta('synthetic-evidence'), projectId: 'synthetic-project', claim: '', evidenceType: 'Interview', source: '', locator: '', finding: 'Synthetic analyst summary', supportLevel: 'Unclear', limitations: '', manuscriptLocation: '' })
  candidate.theoryMemos.push({ ...meta('synthetic-memo'), projectId: 'synthetic-project', memoType: 'mechanism', title: 'Synthetic memo', content: 'Synthetic researcher interpretation', relatedClaimIds: [], relatedQuestionIds: [], relatedLiteratureIds: [] })
  candidate.manuscripts.push({ ...meta('synthetic-manuscript'), projectId: 'synthetic-project', title: 'Synthetic manuscript', targetJournal: 'Synthetic journal', status: 'Drafting', wordCount: 0, nextAction: '' })
  return reconcileProvenanceRootEdits(empty, candidate, { now: timestamp })
}
function LocaleControl() {
  const { setLocale } = useI18n()
  return <button onClick={() => setLocale('en')}>English test</button>
}
function renderGuarded(children: ReactNode, initial: WorkspaceData, rejectWrites = false, concurrentSnapshot?: WorkspaceData) {
  let snapshot = initial
  const updateSpy = vi.fn()
  function Harness() {
    const [data, setData] = useState(initial)
    const current = useRef(initial)
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => {
      updateSpy()
      if (rejectWrites) throw new Error('Workspace revision conflict')
      if (concurrentSnapshot) { current.current = concurrentSnapshot; snapshot = concurrentSnapshot; setData(concurrentSnapshot) }
      const next = reconcileProvenanceRootEdits(current.current, updater(current.current), { now: timestamp })
      next.workspace.revision = current.current.workspace.revision + 1
      current.current = next; snapshot = next; setData(next)
    }
    return <WorkspaceContext.Provider value={{ data, loading: false, saving: false, error: null, updateData, setActiveProject: vi.fn(), replaceWith: vi.fn(), mergeWith: vi.fn() as WorkspaceContextValue['mergeWith'], resetDemo: vi.fn(), refresh: vi.fn(), clearError: vi.fn() }}>{children}</WorkspaceContext.Provider>
  }
  render(<I18nProvider><LocaleControl /><MemoryRouter><Harness /></MemoryRouter></I18nProvider>)
  return { updateSpy, getSnapshot: () => snapshot }
}
const theory = () => <TheoryMemoWorkspace typeFilter="" onTypeFilterChange={() => undefined} projectFilter="" onProjectFilterChange={() => undefined} />

describe('legacy editing and deletion with saved provenance', () => {
  beforeEach(() => { localStorage.clear(); window.location.hash = '' })
  afterEach(cleanup)

  it('keeps a claim editor and its draft open after a rejected snapshot save', async () => {
    const user = userEvent.setup(), initial = syntheticWorkspace()
    const result = renderGuarded(<ResearchGraphWorkspace projectId="synthetic-project" />, initial, true)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Edit claim.*Synthetic analytical claim/i }))
    const dialog = screen.getByRole('dialog', { name: 'Edit analytical claim' })
    const input = within(dialog).getByLabelText(/Analytical claim/)
    await user.clear(input); await user.type(input, 'Synthetic retained claim draft')
    await user.click(within(dialog).getByRole('button', { name: 'Save claim' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be saved')
    expect(input).toHaveValue('Synthetic retained claim draft')
    expect(result.getSnapshot()).toEqual(initial)
  })

  it('shows retired claim-evidence dependencies with stable IDs without attempting deletion', async () => {
    const user = userEvent.setup(), initial = syntheticWorkspace()
    initial.evidenceClaimLinks.push({ id: 'synthetic-retired-evidence-claim', projectId: 'synthetic-project', createdAt: timestamp, updatedAt: timestamp, isDemo: false, evidenceRevisionId: initial.evidenceRevisions[0].id, claimRevisionId: initial.claimRevisions[0].id, supportLevel: 'Contradictory', rationale: 'Synthetic counterexample', limitations: '', state: 'retired' })
    assertProvenanceGraph(initial)
    const result = renderGuarded(<ResearchGraphWorkspace projectId="synthetic-project" />, initial)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Delete claim.*Synthetic analytical claim/i }))
    const dialog = screen.getByRole('dialog', { name: 'Saved relationships protect this record' })
    expect(within(dialog).getByText('evidenceClaimLinks/synthetic-retired-evidence-claim')).toBeInTheDocument()
    expect(within(dialog).getByText('retired')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(result.updateSpy).not.toHaveBeenCalled(); expect(result.getSnapshot()).toEqual(initial)
  })

  it('removes only an unused claim and its owned snapshots in one validated update', async () => {
    const user = userEvent.setup(), initial = syntheticWorkspace()
    const result = renderGuarded(<ResearchGraphWorkspace projectId="synthetic-project" />, initial)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Delete claim.*Synthetic analytical claim/i }))
    const dialog = screen.getByRole('dialog', { name: 'Delete analytical claim?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete claim' }))
    await waitFor(() => expect(result.getSnapshot().claims).toHaveLength(0))
    expect(result.getSnapshot().claimRevisions).toHaveLength(0)
    expect(result.getSnapshot().evidence).toEqual(initial.evidence)
    expect(result.updateSpy).toHaveBeenCalledTimes(1)
    assertProvenanceGraph(result.getSnapshot())
  })

  it('keeps an analytical memo draft after a rejected save and preserves historical text', async () => {
    const user = userEvent.setup()
    const initial = applyProvenanceCommand(syntheticWorkspace(), { type: 'activateAnalyticalMemo', projectId: 'synthetic-project', theoryMemoId: 'synthetic-memo', analysisKind: 'mechanism' }, { now: timestamp })
    const result = renderGuarded(theory(), initial, true)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Edit memo.*Synthetic memo/i }))
    const dialog = screen.getByRole('dialog', { name: 'Edit theory memo' })
    const input = within(dialog).getByLabelText(/^Title/)
    await user.clear(input); await user.type(input, 'Synthetic retained memo draft')
    await user.click(within(dialog).getByRole('button', { name: 'Save memo' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be saved')
    expect(input).toHaveValue('Synthetic retained memo draft')
    expect(result.getSnapshot().theoryMemoRevisions).toEqual(initial.theoryMemoRevisions)
  })

  it('protects a memo referenced by a retired derivation from an older memo revision', async () => {
    const user = userEvent.setup()
    let initial = applyProvenanceCommand(syntheticWorkspace(), { type: 'activateAnalyticalMemo', projectId: 'synthetic-project', theoryMemoId: 'synthetic-memo', analysisKind: 'mechanism' }, { now: timestamp })
    initial = applyProvenanceCommand(initial, { type: 'deriveClaim', id: 'synthetic-historical-derivation', projectId: 'synthetic-project', claimRevisionId: initial.claimRevisions[0].id, memoRevisionId: initial.theoryMemoRevisions[0].id }, { now: timestamp })
    initial = applyProvenanceCommand(initial, { type: 'retireLink', projectId: 'synthetic-project', collection: 'claimDerivationLinks', linkId: 'synthetic-historical-derivation' }, { now: timestamp })
    const edited = structuredClone(initial); edited.theoryMemos[0].relatedClaimIds = []
    initial = reconcileProvenanceRootEdits(initial, edited, { now: timestamp })
    const result = renderGuarded(theory(), initial)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Delete memo.*Synthetic memo/i }))
    const dialog = screen.getByRole('dialog', { name: 'Saved relationships protect this record' })
    expect(within(dialog).getByText('claimDerivationLinks/synthetic-historical-derivation')).toBeInTheDocument()
    expect(result.updateSpy).not.toHaveBeenCalled(); expect(result.getSnapshot()).toEqual(initial)
  })

  it('keeps publishing form input and unchanged manuscript statuses after write rejection', async () => {
    const user = userEvent.setup(), initial = syntheticWorkspace()
    const result = renderGuarded(<PublishingPage />, initial, true)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    const status = screen.getByRole('combobox', { name: /Synthetic manuscript/ })
    await user.selectOptions(status, 'Submitted')
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
    expect(status).toHaveValue('Drafting')
    await act(async () => { window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT, { detail: { module: 'publishing', action: 'manuscript' } })) })
    const dialog = screen.getByRole('dialog', { name: 'Add a manuscript' })
    await user.type(within(dialog).getByLabelText(/^Working title/), 'Synthetic retained manuscript draft')
    await user.type(within(dialog).getByLabelText(/^Target journal/), 'Synthetic draft journal')
    await user.click(within(dialog).getByRole('button', { name: 'New manuscript' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be saved')
    expect(within(dialog).getByLabelText(/^Working title/)).toHaveValue('Synthetic retained manuscript draft')
    expect(result.getSnapshot()).toEqual(initial)
  })

  it('keeps an unused claim after deletion fails and permits cancellation of the retained confirmation', async () => {
    const user = userEvent.setup(), initial = syntheticWorkspace()
    const result = renderGuarded(<ResearchGraphWorkspace projectId="synthetic-project" />, initial, true)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Delete claim.*Synthetic analytical claim/i }))
    const dialog = screen.getByRole('dialog', { name: 'Delete analytical claim?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete claim' }))
    expect(await within(dialog).findByText(/could not be saved/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(result.getSnapshot()).toEqual(initial)
  })

  it('protects a question referenced only by a historical memo snapshot', async () => {
    const user = userEvent.setup()
    let initial = syntheticWorkspace()
    initial.researchQuestions.push({ id: 'synthetic-question', projectId: 'synthetic-project', createdAt: timestamp, updatedAt: timestamp, isDemo: false, text: 'Synthetic historical question', status: 'draft', notes: '' })
    initial.theoryMemos[0].relatedQuestionIds = ['synthetic-question']
    initial = applyProvenanceCommand(initial, { type: 'activateAnalyticalMemo', projectId: 'synthetic-project', theoryMemoId: 'synthetic-memo', analysisKind: 'mechanism' }, { now: timestamp })
    const historicalRevision = initial.theoryMemoRevisions[0].id
    const candidate = structuredClone(initial); candidate.theoryMemos[0].relatedQuestionIds = []
    initial = reconcileProvenanceRootEdits(initial, candidate, { now: timestamp })
    const result = renderGuarded(<ResearchGraphWorkspace projectId="synthetic-project" />, initial)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Delete question.*Synthetic historical question/i }))
    const dialog = screen.getByRole('dialog', { name: 'Saved relationships protect this record' })
    expect(within(dialog).getByText(`theoryMemoRevisions/${historicalRevision}`)).toBeInTheDocument()
    expect(result.updateSpy).not.toHaveBeenCalled()
  })

  it('atomically removes an unused imported memo facet and its owned revisions without deleting endpoints', async () => {
    const user = userEvent.setup(), initial = syntheticWorkspace()
    const memo = initial.theoryMemos[0]
    const metadata = { projectId: memo.projectId, createdAt: timestamp, updatedAt: timestamp, isDemo: false }
    initial.theoryMemoRevisions.push({ ...metadata, id: 'synthetic-imported-memo-rev', theoryMemoId: memo.id, revisionNo: 1, changeReason: 'Synthetic imported memo metadata', snapshot: { memoType: memo.memoType, title: memo.title, content: memo.content, relatedClaimIds: [], relatedQuestionIds: [], relatedLiteratureIds: [] } })
    initial.analyticalMemoFacets.push({ ...metadata, id: 'synthetic-imported-memo-facet', theoryMemoId: memo.id, currentRevisionId: 'synthetic-imported-memo-rev', analysisKind: 'mechanism', state: 'active' })
    assertProvenanceGraph(initial)
    const result = renderGuarded(theory(), initial)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Delete memo.*Synthetic memo/i }))
    const dialog = screen.getByRole('dialog', { name: /Delete.*Synthetic memo/ })
    await user.click(within(dialog).getByRole('button', { name: 'Delete memo' }))
    await waitFor(() => expect(result.getSnapshot().theoryMemos).toHaveLength(0))
    expect(result.getSnapshot().theoryMemoRevisions).toHaveLength(0)
    expect(result.getSnapshot().analyticalMemoFacets).toHaveLength(0)
    expect(result.getSnapshot().claims).toEqual(initial.claims)
    expect(result.updateSpy).toHaveBeenCalledTimes(1)
    assertProvenanceGraph(result.getSnapshot())
  })

  it('rechecks the complete current graph when relationships arrive after deletion confirmation opens', async () => {
    const user = userEvent.setup(), initial = syntheticWorkspace()
    const concurrent = structuredClone(initial)
    concurrent.workspace.revision += 1
    concurrent.evidenceClaimLinks.push({ id: 'synthetic-concurrent-dependency', projectId: 'synthetic-project', createdAt: timestamp, updatedAt: timestamp, isDemo: false, evidenceRevisionId: concurrent.evidenceRevisions[0].id, claimRevisionId: concurrent.claimRevisions[0].id, supportLevel: 'Weak', rationale: 'Synthetic concurrent decision', limitations: '', state: 'active' })
    assertProvenanceGraph(concurrent)
    const result = renderGuarded(<ResearchGraphWorkspace projectId="synthetic-project" />, initial, false, concurrent)
    await user.click(screen.getByRole('button', { name: 'English test' }))
    await user.click(screen.getByRole('button', { name: /Delete claim.*Synthetic analytical claim/i }))
    const confirmation = screen.getByRole('dialog', { name: 'Delete analytical claim?' })
    await user.click(within(confirmation).getByRole('button', { name: 'Delete claim' }))
    const blocked = await screen.findByRole('dialog', { name: 'Saved relationships protect this record' })
    expect(within(blocked).getByText('evidenceClaimLinks/synthetic-concurrent-dependency')).toBeInTheDocument()
    expect(result.getSnapshot()).toEqual(concurrent)
    expect(result.getSnapshot().claims).toHaveLength(1)
    expect(result.updateSpy).toHaveBeenCalledTimes(1)
  })
})
