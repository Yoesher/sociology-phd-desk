import { useState, type ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { ProjectScopeContext } from '../../app/project-scope-context'
import { I18nProvider } from '../../i18n'
import { createDemoWorkspace } from '../../models/demo'
import type { WorkspaceData } from '../../models/domain'
import { LiteraturePage } from './LiteraturePage'
import type { ZoteroHandoff } from './zotero-handoff'

const syntheticHandoff = (): ZoteroHandoff => ({
  application: 'sociology-phd-desk-zotero',
  version: 1,
  createdAt: '2026-08-14T00:00:00.000Z',
  items: [{
    itemKey: 'SAFE1234',
    libraryID: 7,
    itemVersion: 3,
    itemType: 'journalArticle',
    title: 'SYNTHETIC Zotero handoff article',
    creators: [{ firstName: 'Synthetic', lastName: 'Researcher', creatorType: 'author' }],
    date: '2026',
    DOI: '10.1234/synthetic-zotero',
    URL: 'https://example.test/synthetic-zotero',
    dateModified: '2026-08-14T00:00:00.000Z',
  }],
})

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="test location">{`${location.pathname}?${location.search.slice(1)}`}</output>
}

function renderLiterature(route: string, saveFails = false, scopeId = '', initialOverride?: WorkspaceData) {
  const initial = initialOverride || createDemoWorkspace(new Date('2026-08-14T00:00:00.000Z'))
  let snapshot: WorkspaceData = initial
  const updateSpy = vi.fn()

  function Harness({ children }: { children: ReactNode }) {
    const [data, setData] = useState(initial)
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => {
      updateSpy()
      if (saveFails) throw new Error('SYNTHETIC storage failure')
      setData((current) => {
        const next = updater(current)
        snapshot = next
        return next
      })
    }
    return <WorkspaceContext.Provider value={{
      data,
      loading: false,
      saving: false,
      error: null,
      updateData,
      setActiveProject: vi.fn(),
      replaceWith: vi.fn(),
      mergeWith: vi.fn() as WorkspaceContextValue['mergeWith'],
      resetDemo: vi.fn(),
      refresh: vi.fn(),
      clearError: vi.fn(),
    }}>{children}</WorkspaceContext.Provider>
  }

  render(
    <I18nProvider>
      <Harness>
        <MemoryRouter initialEntries={[route]}>
          <LocationProbe />
          <ProjectScopeContext.Provider value={{ projectId: scopeId, enter: vi.fn() }}><LiteraturePage /></ProjectScopeContext.Provider>
        </MemoryRouter>
      </Harness>
    </I18nProvider>,
  )
  return { updateSpy, getSnapshot: () => snapshot }
}

describe('LiteraturePage Zotero handoff', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => cleanup())

  it('consumes fragment metadata into a write-free preview and removes it from route state', async () => {
    const encoded = encodeURIComponent(JSON.stringify(syntheticHandoff()))
    const { updateSpy } = renderLiterature(`/literature?view=inbox&zotero-handoff=${encoded}`)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('SYNTHETIC Zotero handoff article')).toBeInTheDocument()
    expect(updateSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('test location')).toHaveTextContent('/literature?view=inbox'))
  })

  it('writes only after confirmation and preserves explicit project and research defaults', async () => {
    const user = userEvent.setup()
    const encoded = encodeURIComponent(JSON.stringify(syntheticHandoff()))
    const { updateSpy, getSnapshot } = renderLiterature(`/literature?view=inbox&zotero-handoff=${encoded}`)
    const dialog = await screen.findByRole('dialog')
    const rationale = within(dialog).getByRole('textbox')
    await user.type(rationale, 'SYNTHETIC researcher rationale')
    await user.click(within(dialog).getByRole('button', { name: /确认导入|Import/ }))

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1))
    expect(getSnapshot().literature[0]).toMatchObject({
      title: 'SYNTHETIC Zotero handoff article',
      status: 'Inbox',
      priority: 'Medium',
      whyRead: 'SYNTHETIC researcher rationale',
    })
    expect(getSnapshot().literatureExternalReferences[0]).toMatchObject({
      provider: 'zotero',
      externalLibraryId: '7',
      externalItemKey: 'SAFE1234',
    })
  })

  it('recovers sources hidden by a URL status, page filters, and a text search without writing', async () => {
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
    const user = userEvent.setup()
    const { updateSpy, getSnapshot } = renderLiterature('/literature?view=reading&status=Read')
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'SYNTHETIC nonexistent query')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by priority' }), 'High')
    await user.click(screen.getByRole('button', { name: 'Show all literature' }))
    expect(screen.getByLabelText('test location')).toHaveTextContent('/literature?view=all')
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('')
    for (const item of getSnapshot().literature) expect(screen.getByText(item.title)).toBeInTheDocument()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('makes a saved manual source visible even when the prior view excluded its status', async () => {
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
    const user = userEvent.setup()
    const { getSnapshot } = renderLiterature('/literature?view=cited')
    await user.click(screen.getByRole('button', { name: 'Add literature' }))
    const dialog = screen.getByRole('dialog', { name: 'Add literature' })
    await user.type(within(dialog).getByLabelText('Title', { exact: false }), 'SYNTHETIC new manual source')
    await user.type(within(dialog).getByLabelText('Authors', { exact: false }), 'Synthetic Author')
    await user.type(within(dialog).getByLabelText('Why read?', { exact: false }), 'SYNTHETIC project rationale')
    await user.click(within(dialog).getByRole('button', { name: 'Add to queue' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('SYNTHETIC new manual source')).toBeInTheDocument()
    expect(screen.getByLabelText('test location')).toHaveTextContent('/literature?view=all')
    expect(getSnapshot().literature[0]!.status).toBe('Inbox')
  })

  it('retains input and reports a storage failure instead of closing the form', async () => {
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
    const user = userEvent.setup()
    const { getSnapshot } = renderLiterature('/literature?view=all', true)
    const count = getSnapshot().literature.length
    await user.click(screen.getByRole('button', { name: 'Add literature' }))
    const dialog = screen.getByRole('dialog', { name: 'Add literature' })
    await user.type(within(dialog).getByLabelText('Title', { exact: false }), 'SYNTHETIC unsaved source')
    await user.type(within(dialog).getByLabelText('Authors', { exact: false }), 'Synthetic Author')
    await user.type(within(dialog).getByLabelText('Why read?', { exact: false }), 'SYNTHETIC rationale')
    await user.click(within(dialog).getByRole('button', { name: 'Add to queue' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save')
    expect(within(dialog).getByLabelText('Title', { exact: false })).toHaveValue('SYNTHETIC unsaved source')
    expect(getSnapshot().literature).toHaveLength(count)
  })

  it('discards a pending PDF read when its form is cancelled and a new draft is opened', async () => {
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
    const user = userEvent.setup()
    renderLiterature('/literature?view=all')
    await user.click(screen.getByRole('button', { name: 'Add literature' }))
    const bytes = new TextEncoder().encode('%PDF-1.4\nSYNTHETIC pending PDF')
    let finishRead!: (buffer: ArrayBuffer) => void
    const file = new File([bytes], 'synthetic-pending.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => new Promise<ArrayBuffer>((resolve) => { finishRead = resolve }) })
    await user.upload(screen.getByLabelText('Local PDF'), file)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Add literature' }))
    await act(async () => finishRead(bytes.buffer))
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByLabelText('Title', { exact: false })).toHaveValue(''))
    expect(screen.queryByText('Selected: synthetic-pending.pdf')).not.toBeInTheDocument()
  })

  it('skips a Zotero source belonging to another project instead of refreshing it from this space', async () => {
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
    const initial = createDemoWorkspace()
    const scopeId = initial.projects[0]!.id
    const otherId = initial.projects[1]!.id
    const source = { ...initial.literature[0]!, projectId: otherId }
    initial.literature = [source]
    initial.literatureExternalReferences = [{ id: 'SYNTHETIC other-project-reference', createdAt: source.createdAt, updatedAt: source.updatedAt, isDemo: true, literatureItemId: source.id, provider: 'zotero', externalLibraryId: '7', externalItemKey: 'SAFE1234', externalVersion: 3, importedAt: source.createdAt }]
    const encoded = encodeURIComponent(JSON.stringify(syntheticHandoff()))
    const { updateSpy } = renderLiterature(`/literature?view=all&zotero-handoff=${encoded}`, false, scopeId, initial)
    const dialog = await screen.findByRole('dialog')
    const decision = within(dialog).getByRole('combobox', { name: 'Import decision for SYNTHETIC Zotero handoff article' })
    expect(decision).toHaveValue('skip')
    expect(decision).toBeDisabled()
    expect(within(dialog).getByText(/already belongs to another project/)).toBeInTheDocument()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
