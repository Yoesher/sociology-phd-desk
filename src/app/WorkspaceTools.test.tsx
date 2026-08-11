import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageControl } from '../components/LanguageControl'
import { I18nProvider } from '../i18n'
import { createDemoWorkspace } from '../models/demo'
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context'
import { WorkspaceTools } from './WorkspaceTools'

function renderWorkspaceTools() {
  const value: WorkspaceContextValue = {
    data: createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z')),
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

  return render(
    <I18nProvider>
      <WorkspaceContext.Provider value={value}>
        <LanguageControl />
        <WorkspaceTools />
      </WorkspaceContext.Provider>
    </I18nProvider>,
  )
}

describe('WorkspaceTools localization', () => {
  beforeEach(() => window.localStorage.clear())

  it('localizes the workspace and destructive confirmation dialogs immediately', async () => {
    const user = userEvent.setup()
    renderWorkspaceTools()

    await user.click(screen.getByRole('button', { name: '工作区数据' }))
    const workspaceDialog = screen.getByRole('dialog', { name: '工作区数据' })
    expect(within(workspaceDialog).getByText('可迁移备份')).toBeInTheDocument()
    expect(within(workspaceDialog).getByRole('button', { name: '导出 JSON' })).toBeInTheDocument()

    await user.click(within(workspaceDialog).getByRole('button', { name: '重置示例数据' }))
    expect(screen.getByRole('dialog', { name: '恢复示例数据？' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('dialog', { name: 'Restore demo data?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore demo data' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Workspace data' })).toBeInTheDocument()
  })
})
