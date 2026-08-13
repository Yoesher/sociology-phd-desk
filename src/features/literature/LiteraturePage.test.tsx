import { useState, type ReactNode } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
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

function renderLiterature(route: string) {
  const initial = createDemoWorkspace(new Date('2026-08-14T00:00:00.000Z'))
  let snapshot: WorkspaceData = initial
  const updateSpy = vi.fn()

  function Harness({ children }: { children: ReactNode }) {
    const [data, setData] = useState(initial)
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => {
      updateSpy()
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
          <LiteraturePage />
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
})
