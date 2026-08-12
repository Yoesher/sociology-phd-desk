import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { messages } from '../i18n/messages'
import { createDemoWorkspace } from '../models/demo'
import type { WorkspaceData } from '../models/domain'
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context'
import { AppShell } from './AppShell'
import { navigationItems } from './navigation'
import { QUICK_ADD_EVENT, type QuickAddEventDetail } from './navigationEvents'

const sessionHook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => sessionHook.value,
}))

function contextValue(data: WorkspaceData): WorkspaceContextValue {
  return {
    data,
    loading: false,
    saving: false,
    error: null,
    updateData: vi.fn(),
    setActiveProject: vi.fn(),
    replaceWith: vi.fn(),
    mergeWith: vi.fn(),
    resetDemo: vi.fn(),
    refresh: vi.fn(),
    clearError: vi.fn(),
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderShell(path = '/projects?view=all', data = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))) {
  return render(
    <I18nProvider>
      <WorkspaceContext.Provider value={contextValue(data)}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="*" element={<LocationProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </I18nProvider>,
  )
}

describe('hierarchical research navigation shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
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
      busy: false,
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

  it('defines exactly nine primary modules and all frozen two-level smart views', () => {
    expect(navigationItems.map((item) => item.id)).toEqual([
      'today', 'projects', 'literature', 'theory', 'fieldwork',
      'quantitative', 'evidence', 'research-log', 'publishing',
    ])
    expect(navigationItems.map((item) => item.views.map((view) => view.id))).toEqual([
      ['overview', 'tasks', 'overdue', 'week', 'completed'],
      ['all', 'design', 'data', 'analysis', 'writing', 'submission', 'theoretical', 'completed'],
      ['all', 'inbox', 'to-read', 'reading', 'read', 'cited', 'archived'],
      ['overview', 'questions', 'concepts', 'mechanisms', 'dialogue', 'counterarguments', 'memos', 'manuscripts'],
      ['overview', 'sites', 'visits', 'interviews', 'transcription', 'coding', 'memos', 'completed'],
      ['overview', 'datasets', 'planned', 'running', 'completed', 'failed', 'superseded'],
      ['all', 'literature', 'quantitative', 'fieldwork', 'documents', 'contradictory', 'by-project'],
      ['timeline', 'today', 'week', 'decisions', 'problems', 'next-steps', 'by-project'],
      ['all', 'draft', 'ready', 'submitted', 'review', 'revision', 'rejected', 'accepted', 'published', 'withdrawn'],
    ])
  })

  it('auto-expands the active parent, deep-links every view, and renders a bilingual breadcrumb', async () => {
    const user = userEvent.setup()
    renderShell('/literature?view=reading')

    const nav = screen.getByRole('navigation', { name: messages['zh-CN']['navigation.aria'] })
    expect(within(nav).getByRole('link', { name: '阅读中' })).toHaveClass('active')
    expect(screen.getByLabelText('文献 / 阅读中')).toBeInTheDocument()

    await user.click(within(nav).getByRole('link', { name: '待读' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/literature?view=to-read')
    expect(screen.getByLabelText('文献 / 待读')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByLabelText('Literature / To read')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/literature?view=to-read')
  })

  it('keeps only a small persisted set of user-expanded groups alongside the current module', async () => {
    const user = userEvent.setup()
    const first = renderShell('/literature?view=all')

    await user.click(screen.getByRole('button', { name: '展开研究项目' }))
    await user.click(screen.getByRole('button', { name: '展开理论研究' }))
    await user.click(screen.getByRole('button', { name: '展开证据' }))

    expect(JSON.parse(window.localStorage.getItem('sociology-phd-desk:navigation-expanded:v1') ?? '[]')).toEqual([
      'theory', 'evidence',
    ])
    first.unmount()
    renderShell('/literature?view=all')
    expect(screen.getByRole('button', { name: '收起理论研究' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '收起证据' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '收起文献' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens compact secondary navigation by click and exposes keyboard-operable links', async () => {
    const user = userEvent.setup()
    renderShell('/theory?view=overview')

    await user.click(screen.getByRole('button', { name: '收起侧栏' }))
    await user.click(screen.getByRole('button', { name: '打开理论研究工作流' }))

    const flyout = screen.getByRole('dialog', { name: '理论研究' })
    expect(within(flyout).getByRole('link', { name: '核心概念' })).toHaveAttribute('href', '/theory?view=concepts')
    expect(within(flyout).getByRole('link', { name: '理论总览' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '理论研究' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开理论研究工作流' })).toHaveFocus()
  })

  it('dispatches only the frozen typed Quick Add event without mutating workspace data', async () => {
    const user = userEvent.setup()
    const data = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    const before = structuredClone(data)
    const received: QuickAddEventDetail[] = []
    const listener = (event: Event) => received.push((event as CustomEvent<QuickAddEventDetail>).detail)
    window.addEventListener(QUICK_ADD_EVENT, listener)

    renderShell('/fieldwork?view=interviews', data)
    await user.click(screen.getByRole('button', { name: '新建' }))
    await user.click(screen.getByRole('menuitem', { name: '新建访谈' }))

    expect(received).toEqual([{ module: 'fieldwork', action: 'interview' }])
    expect(data).toEqual(before)
    window.removeEventListener(QUICK_ADD_EVENT, listener)
  })

  it('provides the complete mobile accordion and real workspace settings destinations', async () => {
    const user = userEvent.setup()
    const openWorkspaceCenter = sessionHook.value.openWorkspaceCenter as ReturnType<typeof vi.fn>
    renderShell('/projects?view=analysis')

    await user.click(screen.getByRole('button', { name: '打开导航' }))
    const drawer = screen.getByRole('dialog', { name: '模块导航' })
    expect(within(drawer).getByRole('button', { name: '关闭导航' })).toHaveFocus()
    expect(within(drawer).getAllByRole('link', { name: /.+/ })).toHaveLength(17)

    await user.click(within(drawer).getByRole('button', { name: '展开理论研究' }))
    expect(within(drawer).getByRole('link', { name: '理论备忘' })).toBeInTheDocument()

    await user.click(within(drawer).getByRole('button', { name: '工作空间与设置' }))
    await user.click(within(drawer).getByRole('button', { name: '隐私与锁定' }))
    expect(openWorkspaceCenter).toHaveBeenLastCalledWith('privacy')
    await user.click(within(drawer).getByRole('button', { name: '备份与恢复' }))
    expect(openWorkspaceCenter).toHaveBeenLastCalledWith('backup')
  })

  it('degrades safely when navigation preference storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => renderShell('/evidence?view=contradictory')).not.toThrow()
    expect(screen.getByLabelText('证据 / 矛盾与不确定')).toBeInTheDocument()
    getItem.mockRestore()
    setItem.mockRestore()
  })

  it('shows live action badges only on the nominated secondary views', () => {
    const data = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    data.literature.forEach((item) => { item.status = 'Read' })
    data.literature.push(
      { ...data.literature[0], id: 'literature-action-one', status: 'To Read' },
      { ...data.literature[0], id: 'literature-action-two', status: 'To Read' },
    )
    renderShell('/literature?view=to-read', data)

    const nav = screen.getByRole('navigation', { name: messages['zh-CN']['navigation.aria'] })
    const toRead = within(nav).getByRole('link', { name: /待读/ })
    expect(within(toRead).getByLabelText('2 项需要处理')).toHaveTextContent('2')
    expect(within(nav).queryAllByText(/^2$/)).toHaveLength(1)
  })
})
