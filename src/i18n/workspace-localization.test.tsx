import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../app/AppShell'
import { WorkspaceContext, type WorkspaceContextValue } from '../app/workspace-context'
import { WorkspaceProvider } from '../app/WorkspaceContext'
import { LanguageControl } from '../components/LanguageControl'
import { useWorkspace } from '../hooks/useWorkspace'
import { createDemoWorkspace } from '../models/demo'
import type { WorkspaceData } from '../models/domain'
import type { WorkspaceRepositoryPort } from '../db/localWorkspaceManager'
import { exportWorkspaceJson } from '../utils/workspace-transfer'
import { I18nProvider, useI18n } from './index'
import { messages } from './messages'
import { navigationItems } from '../app/navigation'

const sessionHook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => sessionHook.value,
}))

let latestWorkspace: WorkspaceData | null = null

function getLatestWorkspace(): WorkspaceData {
  if (!latestWorkspace) {
    throw new Error('The demo workspace has not loaded.')
  }
  return latestWorkspace
}

function normalizedExport(workspace: WorkspaceData): Omit<WorkspaceData, 'exportedAt'> {
  const exported = JSON.parse(exportWorkspaceJson(workspace, false)) as WorkspaceData
  const { exportedAt: _exportedAt, ...portableData } = exported
  return portableData
}

function WorkspaceLocaleProbe() {
  const { data } = useWorkspace()
  const { locale } = useI18n()
  latestWorkspace = data

  return (
    <>
      <LanguageControl />
      <output data-testid="locale">{locale}</output>
      <output data-testid="workspace-ready">{data ? 'ready' : 'loading'}</output>
    </>
  )
}

function contextValue(
  data: WorkspaceData,
  error: WorkspaceContextValue['error'],
): WorkspaceContextValue {
  return {
    data,
    loading: false,
    saving: false,
    error,
    updateData: vi.fn(),
    setActiveProject: vi.fn(),
    replaceWith: vi.fn(),
    mergeWith: vi.fn(),
    resetDemo: vi.fn(),
    refresh: vi.fn(),
    clearError: vi.fn(),
  }
}

describe('workspace localization boundaries', () => {
  beforeEach(() => {
    latestWorkspace = null
    window.localStorage.clear()
    vi.clearAllMocks()
    vi.stubGlobal('BroadcastChannel', undefined)
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    sessionHook.value = {
      activeWorkspace: {
        id: 'demo-workspace',
        storageId: 'demo-storage',
        displayName: 'Synthetic demo',
        kind: 'demo',
        encryptionMode: 'standard',
        autoLock: 'never',
      },
      lockActiveWorkspace: vi.fn(),
      openWorkspaceCenter: vi.fn(),
      exportPlaintextWorkspace: vi.fn(),
      importPlaintextWorkspaceAsNew: vi.fn(),
      resetDemoWorkspace: vi.fn(),
    }
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('keeps the complete demo workspace and portable JSON semantics unchanged when language changes', async () => {
    const demo = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    demo.workspace.revision = 37
    const repository: WorkspaceRepositoryPort = {
      getWorkspaceSnapshot: vi.fn(async () => demo),
      replaceWorkspace: vi.fn(async (snapshot) => snapshot),
      mergeWorkspace: vi.fn(),
      refresh: vi.fn(async () => demo),
      close: vi.fn(),
    }
    const user = userEvent.setup()

    render(
      <I18nProvider>
        <WorkspaceProvider
          repository={repository}
          initialSnapshot={demo}
          workspaceId={demo.workspace.id}
          storageId="demo-storage"
          onExternalLock={vi.fn()}
        >
          <WorkspaceLocaleProbe />
        </WorkspaceProvider>
      </I18nProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('workspace-ready')).toHaveTextContent('ready'))
    const before = structuredClone(getLatestWorkspace())
    const beforeExport = normalizedExport(getLatestWorkspace())

    expect(before).toEqual(demo)
    expect(before.workspace.revision).toBe(37)
    expect(before.workspace.isDemo).toBe(true)
    expect(before.projects[0]).toMatchObject({
      isDemo: true,
      method: 'Mixed Methods',
      status: 'Analysis',
    })
    expect(before.researchQuestions[0]).toMatchObject({ isDemo: true, status: 'active' })
    expect(before.claims[0]).toMatchObject({ isDemo: true, status: 'draft' })
    expect(before.claimQuestionLinks[0]).toMatchObject({ isDemo: true })
    expect(before.analysisRuns[0]).toMatchObject({ software: 'Stata', status: 'Planned' })

    await user.click(screen.getByRole('button', { name: 'English' }))
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('en'))

    expect(getLatestWorkspace()).toEqual(before)
    expect(getLatestWorkspace().workspace.revision).toBe(37)
    expect(getLatestWorkspace().projects[0]?.method).toBe('Mixed Methods')
    expect(getLatestWorkspace().researchQuestions).toEqual(before.researchQuestions)
    expect(getLatestWorkspace().claims).toEqual(before.claims)
    expect(getLatestWorkspace().claimQuestionLinks).toEqual(before.claimQuestionLinks)
    expect(getLatestWorkspace().analysisRuns[0]?.software).toBe('Stata')
    expect(normalizedExport(getLatestWorkspace())).toEqual(beforeExport)
    expect(beforeExport).not.toHaveProperty('language')
    expect(beforeExport).not.toHaveProperty('theme')
  })

  it('switches the real AppShell navigation, privacy status, and safe system error immediately', async () => {
    const demo = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    const sensitiveInternalError = 'participant-alias-should-never-be-rendered'
    const user = userEvent.setup()
    const { container } = render(
      <I18nProvider>
        <WorkspaceContext.Provider value={contextValue(demo, 'save-failed')}>
          <MemoryRouter initialEntries={['/projects']}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/projects" element={<div>route content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </I18nProvider>,
    )

    const chineseNav = screen.getByRole('navigation', {
      name: messages['zh-CN']['navigation.aria'],
    })
    expect(within(chineseNav).getAllByRole('link')).toHaveLength(13)
    for (const item of navigationItems) {
      expect(
        within(chineseNav).getByRole('link', { name: messages['zh-CN'][item.labelKey] }),
      ).toBeInTheDocument()
    }
    expect(screen.getAllByText(messages['zh-CN']['shell.workspaceMode.standard']).length).toBeGreaterThan(0)
    expect(screen.getByRole('alert')).toHaveTextContent(messages['zh-CN']['localWorkspaces.error.save-failed'])
    expect(screen.queryByText(sensitiveInternalError)).not.toBeInTheDocument()

    const topbar = container.querySelector<HTMLElement>('.topbar')
    if (!topbar) throw new Error('Expected the desktop top bar.')
    await user.click(within(topbar).getByRole('button', { name: messages['zh-CN']['navigation.moreActions'] }))
    await user.click(screen.getByRole('button', { name: 'English' }))

    const englishNav = screen.getByRole('navigation', { name: messages.en['navigation.aria'] })
    expect(within(englishNav).getAllByRole('link')).toHaveLength(13)
    for (const item of navigationItems) {
      expect(
        within(englishNav).getByRole('link', { name: messages.en[item.labelKey] }),
      ).toBeInTheDocument()
    }
    expect(screen.getAllByText(messages.en['shell.workspaceMode.standard']).length).toBeGreaterThan(0)
    expect(screen.getByRole('alert')).toHaveTextContent(messages.en['localWorkspaces.error.save-failed'])
    expect(screen.queryByText(sensitiveInternalError)).not.toBeInTheDocument()
  })
})
