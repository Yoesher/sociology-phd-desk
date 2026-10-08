import { useState, type ReactNode } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { ProjectScopeContext } from '../../app/project-scope-context'
import { I18nProvider, useI18n } from '../../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../../i18n/settings'
import { createEmptyWorkspace } from '../../models/empty-workspace'
import type { WorkspaceData } from '../../models/domain'
import { applyProvenanceCommand, reconcileProvenanceRootEdits } from '../../utils/provenance-commands'
import { ProvenanceWorkspace } from './ProvenanceWorkspace'
import { EvidencePage } from './EvidencePage'
import { anchorRevisionTrace, claimRevisionTrace, evidenceRevisionTrace } from './provenance-view'

const now = '2026-10-08T00:00:00.000Z'
const meta = (id: string) => ({ id, createdAt: now, updatedAt: now, isDemo: true })
function syntheticWorkspace() {
  const workspace = createEmptyWorkspace({ id: 'workspace-synthetic', name: 'SYNTHETIC provenance test', now: new Date(now) })
  const root: WorkspaceData = {
    ...workspace,
    projects: [{ ...meta('project-synthetic'), title: 'SYNTHETIC household comparison', shortTitle: 'SYNTHETIC', topic: 'SYNTHETIC metadata', method: 'Qualitative', status: 'Analysis', startDate: '2026-10-08', notes: '' }],
    claims: [{ ...meta('claim-synthetic'), projectId: 'project-synthetic', text: 'SYNTHETIC mechanism claim', status: 'active', notes: 'SYNTHETIC boundary' }],
    evidence: [{ ...meta('evidence-synthetic'), projectId: 'project-synthetic', claim: 'Retained free text only', evidenceType: 'Interview', source: 'SYNTHETIC anonymous source', locator: 'legacy locator', finding: 'SYNTHETIC finding metadata', supportLevel: 'Unclear', limitations: '', manuscriptLocation: 'legacy paragraph text' }],
    manuscripts: [{ ...meta('manuscript-synthetic'), projectId: 'project-synthetic', title: 'SYNTHETIC manuscript', targetJournal: '', status: 'Drafting', wordCount: 0, nextAction: '' }],
    interviews: [{ ...meta('interview-synthetic'), projectId: 'project-synthetic', participantAlias: 'SYNTHETIC-P-01', status: 'Completed', transcriptStatus: 'Complete', codingStatus: 'Not Started', memoStatus: 'Not Started', notes: '' }],
  }
  return reconcileProvenanceRootEdits(workspace, root, { now, reason: 'Synthetic fixture' })
}

function LocaleControl() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('zh-CN')}>Switch to Chinese</button>
}

function renderProvenance(initialData = syntheticWorkspace(), options: { route?: string; reject?: boolean; scope?: string; legacy?: boolean } = {}) {
  let snapshot = initialData
  const updates = vi.fn()
  function Harness({ children }: { children: ReactNode }) {
    const [data, setData] = useState(initialData)
    snapshot = data
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => {
      updates()
      if (options.reject) throw new Error('Synthetic persistence conflict')
      const next = reconcileProvenanceRootEdits(snapshot, updater(snapshot), { now, reason: 'Synthetic UI save' })
      snapshot = next
      setData(next)
    }
    const context: WorkspaceContextValue = {
      data, loading: false, saving: false, error: null, updateData,
      setActiveProject: vi.fn(), replaceWith: vi.fn(), mergeWith: vi.fn() as WorkspaceContextValue['mergeWith'], resetDemo: vi.fn(), refresh: vi.fn(), clearError: vi.fn(),
    }
    return <WorkspaceContext.Provider value={context}><ProjectScopeContext.Provider value={{ projectId: options.scope || '', enter: vi.fn() }}>{children}</ProjectScopeContext.Provider></WorkspaceContext.Provider>
  }
  render(<I18nProvider><LocaleControl /><Harness><MemoryRouter initialEntries={[options.route || (options.legacy ? '/evidence?view=all' : '/evidence?view=provenance')]}>{options.legacy ? <EvidencePage /> : <ProvenanceWorkspace />}</MemoryRouter></Harness></I18nProvider>)
  return { getSnapshot: () => snapshot, updates }
}

async function fillContext(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Researcher alias/), 'SYNTHETIC-R-01')
  await user.type(screen.getByLabelText(/^Reason for this change/), 'SYNTHETIC manual review')
}

describe('ProvenanceWorkspace metadata workflow', () => {
  beforeEach(() => { window.localStorage.clear(); window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en' })) })
  afterEach(cleanup)

  it('registers a contradictory relationship with reasons; original free text creates no inferred edges', async () => {
    const user = userEvent.setup()
    const { getSnapshot } = renderProvenance()
    expect(getSnapshot().evidenceClaimLinks).toHaveLength(0)
    expect(getSnapshot().evidenceSourceLinks).toHaveLength(0)
    await fillContext(user)
    await user.selectOptions(screen.getByLabelText(/^Support judgment for this relationship/), 'Contradictory')
    await user.type(screen.getByLabelText(/^Reason for the judgment/), 'SYNTHETIC negative case retained')
    await user.type(screen.getByLabelText(/^Limitations and alternatives/), 'SYNTHETIC scope limit')
    await user.click(screen.getByRole('button', { name: 'Link selected evidence and claim' }))
    await waitFor(() => expect(getSnapshot().evidenceClaimLinks).toHaveLength(1))
    expect(getSnapshot().evidenceClaimLinks[0]).toMatchObject({
      evidenceRevisionId: getSnapshot().evidenceRevisions[0].id, claimRevisionId: getSnapshot().claimRevisions[0].id,
      supportLevel: 'Contradictory', rationale: 'SYNTHETIC negative case retained', limitations: 'SYNTHETIC scope limit',
    })
    expect(within(screen.getByRole('region', { name: 'Claim → evidence, memos and locations' })).getByText('SYNTHETIC negative case retained')).toBeInTheDocument()
    expect(getSnapshot().evidence[0].claim).toBe('Retained free text only')
    expect(getSnapshot().evidence[0].manuscriptLocation).toBe('legacy paragraph text')
    await user.click(screen.getByRole('button', { name: 'Switch to Chinese' }))
    expect(screen.getByRole('heading', { name: '证据与论文追溯' })).toBeInTheDocument()
    expect(getSnapshot().evidenceClaimLinks[0].rationale).toBe('SYNTHETIC negative case retained')
  })

  it('keeps form input on persistence failure and does not mutate the workspace', async () => {
    const user = userEvent.setup()
    const { getSnapshot } = renderProvenance(syntheticWorkspace(), { reject: true })
    await fillContext(user)
    await user.type(screen.getByLabelText(/^Reason for the judgment/), 'SYNTHETIC retained input')
    await user.click(screen.getByRole('button', { name: 'Link selected evidence and claim' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('your form input is retained')
    expect(screen.getByLabelText(/^Reason for the judgment/)).toHaveValue('SYNTHETIC retained input')
    expect(getSnapshot().evidenceClaimLinks).toHaveLength(0)
  })

  it('connects a fixed anonymous NVivo segment revision without reading or uploading external material', async () => {
    const user = userEvent.setup()
    let initial = syntheticWorkspace()
    initial = applyProvenanceCommand(initial, { type: 'registerSource', projectId: 'project-synthetic', alias: 'SYNTHETIC transcript reference', sourceKind: 'qda-export-reference', owners: [{ kind: 'interview', interviewId: 'interview-synthetic' }], versionLabel: 'SYNTHETIC-source-v1', externalRef: { kind: 'qda-reference', provider: 'nvivo', projectToken: 'SYNTHETIC-NV-P', sourceToken: 'SYNTHETIC-NV-S' } }, { now, reason: 'Synthetic reference' })
    initial = applyProvenanceCommand(initial, { type: 'createSegment', projectId: 'project-synthetic', sourceReferenceId: initial.sourceReferences[0].id, label: 'SYNTHETIC comparison locator', sourceRevisionId: initial.sourceRevisions[0].id, primaryLocator: { kind: 'lineRange', start: 12, end: 18 }, verification: 'unverified' }, { now, reason: 'Synthetic locator' })
    const fixedSegmentId = initial.sourceSegmentRevisions[0].id
    const { getSnapshot } = renderProvenance(initial)
    await fillContext(user)
    await user.selectOptions(screen.getByLabelText(/^Saved source or segment revision/), fixedSegmentId)
    await user.click(screen.getByRole('button', { name: 'Save source relationship' }))
    await waitFor(() => expect(getSnapshot().evidenceSourceLinks).toHaveLength(1))
    expect(getSnapshot().evidenceSourceLinks[0].origin).toEqual({ kind: 'sourceSegmentRevision', segmentRevisionId: fixedSegmentId })
    const sourceLink = screen.getByRole('link', { name: 'Locate this segment in qualitative analysis' })
    expect(sourceLink).toHaveAttribute('href', `/fieldwork?view=qualitative&segmentRevision=${encodeURIComponent(fixedSegmentId)}`)
    expect(getSnapshot().sourceRevisions[0].externalRef).toEqual({ kind: 'qda-reference', provider: 'nvivo', projectToken: 'SYNTHETIC-NV-P', sourceToken: 'SYNTHETIC-NV-S' })
    expect(getSnapshot().sourceSegmentRevisions[0].primaryLocator).toEqual({ kind: 'lineRange', start: 12, end: 18 })
  })

  it('creates and reanchors a paragraph while actual usage remains pinned to its old version', async () => {
    const user = userEvent.setup()
    const { getSnapshot } = renderProvenance()
    await fillContext(user)
    await user.type(screen.getByLabelText(/^Reason for the judgment/), 'SYNTHETIC explicit relation')
    await user.click(screen.getByRole('button', { name: 'Link selected evidence and claim' }))
    await user.selectOptions(screen.getByLabelText(/^Existing manuscript/), 'manuscript-synthetic')
    await user.type(screen.getByLabelText(/^Document version/), 'SYNTHETIC-v1')
    await user.type(screen.getByLabelText(/^Section path/), 'Results > Mechanism')
    await user.type(screen.getByLabelText(/^Paragraph or object label/), 'P-03')
    await user.click(screen.getByRole('button', { name: 'Create manuscript location' }))
    await waitFor(() => expect(getSnapshot().manuscriptAnchors).toHaveLength(1))
    const firstRevision = getSnapshot().manuscriptAnchorRevisions[0]
    await user.selectOptions(screen.getByLabelText(/^Manuscript location revision/), firstRevision.id)
    await user.selectOptions(screen.getByLabelText(/^Active relationship for the selected claim/), getSnapshot().evidenceClaimLinks[0].id)
    await user.click(screen.getByRole('button', { name: 'Record actual evidence use' }))
    await waitFor(() => expect(getSnapshot().evidenceUsages).toHaveLength(1))
    await user.selectOptions(screen.getByLabelText(/^Location to revise/), getSnapshot().manuscriptAnchors[0].id)
    await user.clear(screen.getByLabelText(/^Document version/))
    await user.type(screen.getByLabelText(/^Document version/), 'SYNTHETIC-v2')
    await user.clear(screen.getByLabelText(/^Paragraph or object label/))
    await user.type(screen.getByLabelText(/^Paragraph or object label/), 'P-05')
    await user.click(screen.getByRole('button', { name: 'Save new location revision' }))
    await waitFor(() => expect(getSnapshot().manuscriptAnchorRevisions).toHaveLength(2))
    expect(getSnapshot().claimManuscriptLinks[0].anchorRevisionId).toBe(firstRevision.id)
    expect(getSnapshot().manuscriptAnchorRevisions[0]).toEqual(firstRevision)
    expect(within(screen.getByRole('region', { name: 'Manuscript location → claims and evidence' })).getByRole('heading', { level: 3, name: /SYNTHETIC-v1.*Historical/ })).toBeInTheDocument()
    const evidencePane = screen.getByRole('region', { name: 'Evidence → sources and claims' })
    await user.click(within(evidencePane).getByRole('button', { name: 'Retire relationship' }))
    const dialog = screen.getByRole('dialog', { name: 'Retire this saved relationship?' })
    await user.click(within(dialog).getByRole('button', { name: 'Retire and keep history' }))
    await waitFor(() => expect(getSnapshot().evidenceClaimLinks[0].state).toBe('retired'))
    expect(getSnapshot().evidenceUsages[0].state).toBe('retired')
    expect(getSnapshot().evidenceClaimLinks).toHaveLength(1)
  }, 15_000)

  it('preserves out-of-scope records when a project view updates the full snapshot', async () => {
    const user = userEvent.setup()
    const initial = syntheticWorkspace()
    initial.projects.push({ ...initial.projects[0], id: 'other-project', title: 'SYNTHETIC other project' })
    initial.evidence.push({ ...initial.evidence[0], id: 'other-evidence', projectId: 'other-project', finding: 'SYNTHETIC other finding' })
    const seeded = reconcileProvenanceRootEdits(initial, initial, { now, reason: 'Synthetic seed' })
    const { getSnapshot } = renderProvenance(seeded, { scope: 'project-synthetic' })
    expect(within(screen.getByLabelText(/^Project/)).queryByRole('option', { name: 'SYNTHETIC other project' })).not.toBeInTheDocument()
    await fillContext(user)
    await user.type(screen.getByLabelText(/^Reason for the judgment/), 'SYNTHETIC scoped relation')
    await user.click(screen.getByRole('button', { name: 'Link selected evidence and claim' }))
    await waitFor(() => expect(getSnapshot().evidenceClaimLinks).toHaveLength(1))
    expect(getSnapshot().evidence.find((row) => row.id === 'other-evidence')?.finding).toBe('SYNTHETIC other finding')
    expect(getSnapshot().evidenceRevisions.some((row) => row.evidenceId === 'other-evidence')).toBe(true)
  })

  it('blocks legacy deletion of evidence used by saved sources, claims and paragraphs even after retirement; unused evidence remains deletable', async () => {
    const user = userEvent.setup()
    let initial = syntheticWorkspace()
    const projectId = 'project-synthetic'
    const context = { now, reason: 'Synthetic historical provenance' }
    initial = applyProvenanceCommand(initial, { type: 'linkEvidenceSource', projectId, evidenceRevisionId: initial.evidenceRevisions[0].id, origin: { kind: 'interview', interviewId: 'interview-synthetic', locator: 'SYNTHETIC lines 12–18' } }, context)
    initial = applyProvenanceCommand(initial, { type: 'linkEvidenceToClaim', projectId, evidenceRevisionId: initial.evidenceRevisions[0].id, claimRevisionId: initial.claimRevisions[0].id, supportLevel: 'Contradictory', rationale: 'SYNTHETIC counterexample' }, context)
    initial = applyProvenanceCommand(initial, { type: 'createManuscriptAnchor', projectId, manuscriptId: 'manuscript-synthetic', kind: 'paragraph', documentVersion: 'SYNTHETIC-v1', sectionPath: ['Results'], paragraphLabel: 'P-01' }, context)
    initial = applyProvenanceCommand(initial, { type: 'useEvidenceAtAnchor', projectId, evidenceClaimLinkId: initial.evidenceClaimLinks[0].id, anchorRevisionId: initial.manuscriptAnchorRevisions[0].id }, context)
    initial = applyProvenanceCommand(initial, { type: 'retireLink', projectId, collection: 'evidenceClaimLinks', linkId: initial.evidenceClaimLinks[0].id }, context)
    initial = applyProvenanceCommand(initial, { type: 'retireLink', projectId, collection: 'evidenceSourceLinks', linkId: initial.evidenceSourceLinks[0].id }, context)
    initial = reconcileProvenanceRootEdits(initial, { ...initial, evidence: [...initial.evidence, { ...initial.evidence[0], id: 'evidence-unused', claim: 'SYNTHETIC unused evidence' }] }, context)
    const before = structuredClone(initial)
    const { getSnapshot, updates } = renderProvenance(initial, { legacy: true })
    const protectedCard = screen.getByRole('heading', { name: 'Retained free text only' }).closest('article')!
    await user.click(within(protectedCard).getByRole('button', { name: 'Delete' }))
    const blocked = screen.getByRole('dialog', { name: 'Evidence still has saved provenance' })
    expect(blocked).toHaveTextContent('Current and historical relationships protect this evidence')
    expect(blocked).toHaveTextContent(initial.evidenceClaimLinks[0].id)
    expect(blocked).toHaveTextContent(initial.evidenceSourceLinks[0].id)
    expect(within(blocked).queryByRole('button', { name: 'Delete evidence' })).not.toBeInTheDocument()
    expect(within(blocked).getByRole('link', { name: 'Review evidence relationships' })).toHaveAttribute('href', `/evidence?view=provenance&evidenceRevision=${encodeURIComponent(initial.evidenceRevisions[0].id)}`)
    expect(updates).not.toHaveBeenCalled()
    expect(getSnapshot()).toEqual(before)
    await user.click(within(blocked).getByRole('button', { name: 'Keep evidence' }))
    const unusedCard = screen.getByRole('heading', { name: 'SYNTHETIC unused evidence' }).closest('article')!
    await user.click(within(unusedCard).getByRole('button', { name: 'Delete' }))
    const confirmation = screen.getByRole('dialog', { name: 'Delete this evidence item?' })
    await user.click(within(confirmation).getByRole('button', { name: 'Delete evidence' }))
    await waitFor(() => expect(getSnapshot().evidence).toHaveLength(1))
    expect(getSnapshot().evidenceRevisions.some((row) => row.evidenceId === 'evidence-unused')).toBe(false)
    expect(getSnapshot().evidenceUsages).toEqual(before.evidenceUsages)
    expect(getSnapshot().evidenceClaimLinks).toEqual(before.evidenceClaimLinks)
    expect(getSnapshot().claims).toEqual(before.claims)
    expect(getSnapshot().manuscripts).toEqual(before.manuscripts)
  })

  it('catches legacy save and delete failures inside their dialogs and preserves draft and records', async () => {
    const user = userEvent.setup()
    const { getSnapshot } = renderProvenance(syntheticWorkspace(), { legacy: true, reject: true })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const editDialog = screen.getByRole('dialog', { name: 'Edit evidence item' })
    const finding = within(editDialog).getByLabelText(/^Finding/)
    await user.clear(finding)
    await user.type(finding, 'SYNTHETIC retained legacy draft')
    await user.click(within(editDialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(editDialog).findByRole('alert')).toHaveTextContent('your input is retained')
    expect(finding).toHaveValue('SYNTHETIC retained legacy draft')
    expect(getSnapshot().evidence[0].finding).toBe('SYNTHETIC finding metadata')
    await user.click(within(editDialog).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete this evidence item?' })
    await user.click(within(deleteDialog).getByRole('button', { name: 'Delete evidence' }))
    expect(await within(deleteDialog).findByRole('alert')).toHaveTextContent('Nothing was removed')
    expect(getSnapshot().evidence).toHaveLength(1)
    expect(within(deleteDialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })
})

describe('Version-pinned bidirectional selectors', () => {
  it('follows the same saved IDs forward and backward after later root edits and retirement', () => {
    let data = syntheticWorkspace()
    const evidenceRevisionId = data.evidenceRevisions[0].id
    const claimRevisionId = data.claimRevisions[0].id
    data = applyProvenanceCommand(data, { type: 'linkEvidenceToClaim', projectId: 'project-synthetic', evidenceRevisionId, claimRevisionId, supportLevel: 'Weak', rationale: 'SYNTHETIC evidence' }, { now, reason: 'Synthetic registration' })
    const linkId = data.evidenceClaimLinks[0].id
    data = applyProvenanceCommand(data, { type: 'createManuscriptAnchor', projectId: 'project-synthetic', manuscriptId: 'manuscript-synthetic', kind: 'paragraph', documentVersion: 'SYNTHETIC-v1', sectionPath: ['Results'], paragraphLabel: 'P-01' }, { now, reason: 'Synthetic locator' })
    const anchorRevisionId = data.manuscriptAnchorRevisions[0].id
    data = applyProvenanceCommand(data, { type: 'useEvidenceAtAnchor', projectId: 'project-synthetic', evidenceClaimLinkId: linkId, anchorRevisionId }, { now, reason: 'Synthetic use' })
    data = reconcileProvenanceRootEdits(data, { ...data, evidence: data.evidence.map((row) => ({ ...row, finding: 'SYNTHETIC revised finding' })) }, { now, reason: 'Synthetic edit' })
    data = applyProvenanceCommand(data, { type: 'retireLink', projectId: 'project-synthetic', collection: 'evidenceClaimLinks', linkId }, { now, reason: 'Synthetic retirement' })
    expect(evidenceRevisionTrace(data, evidenceRevisionId).claimLinks[0].id).toBe(claimRevisionTrace(data, claimRevisionId).evidenceLinks[0].id)
    expect(evidenceRevisionTrace(data, evidenceRevisionId).usages[0].id).toBe(anchorRevisionTrace(data, anchorRevisionId).usages[0].id)
    expect(evidenceRevisionTrace(data, evidenceRevisionId).evidenceRevision?.snapshot.finding).toBe('SYNTHETIC finding metadata')
    expect(evidenceRevisionTrace(data, evidenceRevisionId).usages[0].state).toBe('retired')
    expect(data.evidenceRevisions).toHaveLength(2)
  })
})
