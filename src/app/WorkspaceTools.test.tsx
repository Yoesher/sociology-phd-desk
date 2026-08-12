import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageControl } from '../components/LanguageControl'
import { I18nProvider } from '../i18n'
import { createDemoWorkspace } from '../models/demo'
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context'
import { WorkspaceTools } from './WorkspaceTools'

const sessionHook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => sessionHook.value,
}))

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
  afterEach(cleanup)

  beforeEach(() => {
    window.localStorage.clear()
    sessionHook.value = {
      activeWorkspace: {
        id: 'demo-workspace',
        storageId: 'demo-storage',
        displayName: 'Synthetic demo',
        kind: 'demo',
        encryptionMode: 'standard',
      },
      exportPlaintextWorkspace: vi.fn(),
      importPlaintextWorkspaceAsNew: vi.fn(),
      resetDemoWorkspace: vi.fn(),
    }
  })

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
    expect(workspaceDialog).toHaveTextContent('Workspace data')
    expect(workspaceDialog).toHaveAttribute('inert')
    expect(workspaceDialog).toHaveAttribute('aria-hidden', 'true')
  })

  it('guards a deferred isolated import against repeated confirmation clicks', async () => {
    const user = userEvent.setup()
    let release!: () => void
    const importAsNew = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))
    sessionHook.value = {
      ...sessionHook.value,
      importPlaintextWorkspaceAsNew: importAsNew,
    }
    renderWorkspaceTools()
    await user.click(screen.getByRole('button', { name: 'English' }))
    await user.click(screen.getByRole('button', { name: 'Workspace' }))

    const incoming = createDemoWorkspace(new Date('2026-08-12T00:00:00.000Z'))
    incoming.workspace.id = 'different-imported-workspace'
    const file = new File([JSON.stringify(incoming)], 'different.json', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'text', {
      value: vi.fn(async () => JSON.stringify(incoming)),
    })
    await user.upload(screen.getByLabelText('Choose import'), file)
    await user.click(screen.getByRole('button', { name: 'Create isolated workspace' }))

    const confirm = screen.getByRole('dialog', { name: 'Create a separate workspace?' })
    const confirmButton = within(confirm).getByRole('button', { name: 'Create isolated workspace' })
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)
    expect(importAsNew).toHaveBeenCalledTimes(1)
    expect(confirmButton).toBeDisabled()

    release()
    await waitFor(() => expect(confirm).not.toBeInTheDocument())
  })
})
