import { useState } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../i18n/settings'
import { WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import { WorkspaceAccessGate, type WorkspaceAccessGateProps } from './WorkspaceAccessGate'
import { WorkspaceCenter } from './WorkspaceCenter'

function registryEntry(
  overrides: Partial<WorkspaceRegistryEntry> = {},
): WorkspaceRegistryEntry {
  return {
    id: 'workspace-1',
    storageId: 'storage-1',
    displayName: 'Fieldwork notes',
    kind: 'personal',
    encryptionMode: 'standard',
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    storageSchemaVersion: 1,
    registryRevision: 1,
    autoLock: 'never',
    state: 'ready',
    ...overrides,
  }
}

function renderGate(overrides: Partial<WorkspaceAccessGateProps> = {}) {
  const props: WorkspaceAccessGateProps = {
    state: 'locked',
    activeWorkspace: registryEntry(),
    onOpenStandard: vi.fn(),
    onUnlockEncrypted: vi.fn(),
    onOpenWorkspacePicker: vi.fn(),
    children: <p>RESEARCH-CANARY</p>,
    ...overrides,
  }

  return {
    ...render(
      <I18nProvider>
        <WorkspaceAccessGate {...props} />
      </I18nProvider>,
    ),
    props,
  }
}

describe('WorkspaceAccessGate', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ language: 'en' }),
    )
  })

  it('keeps research children unmounted while a standard UI-only lock is closed', async () => {
    const user = userEvent.setup()
    const onOpenStandard = vi.fn()
    renderGate({ onOpenStandard })

    expect(screen.queryByText('RESEARCH-CANARY')).not.toBeInTheDocument()
    expect(screen.getByText('Standard local workspace · not encrypted')).toBeInTheDocument()
    expect(screen.getByText(/UI-only lock hides the current tab/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reopen workspace' }))
    expect(onOpenStandard).toHaveBeenCalledOnce()
  })

  it('submits an encrypted unlock without exposing raw errors', async () => {
    const user = userEvent.setup()
    const onUnlockEncrypted = vi.fn()
    renderGate({
      activeWorkspace: registryEntry({ encryptionMode: 'encrypted' }),
      onUnlockEncrypted,
      error: { code: 'unlock-failed', operation: 'unlock', retryable: true },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The passphrase is incorrect or the encrypted data is damaged.',
    )
    expect(document.body).not.toHaveTextContent('OperationError')

    const passphrase = screen.getByLabelText('Workspace passphrase')
    await user.type(passphrase, 'correct horse battery staple')
    await user.click(screen.getByRole('button', { name: 'Unlock workspace' }))
    expect(onUnlockEncrypted).toHaveBeenCalledWith('correct horse battery staple')
  })

  it('preserves user-entered names and passphrases across a language change', async () => {
    const user = userEvent.setup()
    const displayName = '访谈 A / Interview A'
    renderGate({
      activeWorkspace: registryEntry({ displayName, encryptionMode: 'encrypted' }),
    })

    const passphrase = screen.getByLabelText('Workspace passphrase')
    await user.type(passphrase, 'never translate this phrase')
    await user.click(screen.getByRole('button', { name: '简体中文' }))

    expect(screen.getByText(displayName)).toBeInTheDocument()
    expect(screen.getByLabelText('工作台口令')).toHaveValue('never translate this phrase')
  })

  it('clears a submitted passphrase after unlock rejection without storing or broadcasting it', async () => {
    const user = userEvent.setup()
    const passphraseValue = 'submitted only once'
    const onUnlockEncrypted = vi.fn().mockRejectedValue(new Error('raw decrypt detail'))
    const postMessage = vi.fn()
    vi.stubGlobal('BroadcastChannel', vi.fn(() => ({ postMessage, close: vi.fn() })))
    renderGate({
      activeWorkspace: registryEntry({ encryptionMode: 'encrypted' }),
      onUnlockEncrypted,
    })

    const input = screen.getByLabelText('Workspace passphrase')
    await user.type(input, passphraseValue)
    await user.click(screen.getByRole('button', { name: 'Unlock workspace' }))

    await waitFor(() => expect(input).toHaveValue(''))
    expect(onUnlockEncrypted).toHaveBeenCalledWith(passphraseValue)
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(passphraseValue)
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(passphraseValue)
    expect(postMessage).not.toHaveBeenCalled()
    expect(document.body).not.toHaveTextContent('raw decrypt detail')
  })

  it('reports retained plaintext without claiming complete at-rest encryption', () => {
    renderGate({
      activeWorkspace: registryEntry({
        encryptionMode: 'encrypted',
        plaintextSources: [
          {
            id: 'old-standard',
            kind: 'standard',
            state: 'cleanup-pending',
          },
        ],
      }),
    })

    expect(screen.getByText('Encrypted copy verified · plaintext cleanup pending')).toBeInTheDocument()
    expect(screen.getByText(/earlier plaintext source is still retained/i)).toBeInTheDocument()
    expect(screen.queryByText('Encrypted route; currently open in this tab')).not.toBeInTheDocument()
  })

  it('keeps locked-session truth when opening Workspace Center privacy from the lock screen', async () => {
    const user = userEvent.setup()
    const encrypted = registryEntry({ encryptionMode: 'encrypted' })

    function LockedWorkspaceCenterHarness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <WorkspaceAccessGate
            state="locked"
            activeWorkspace={encrypted}
            onOpenStandard={vi.fn()}
            onUnlockEncrypted={vi.fn()}
            onOpenWorkspacePicker={() => setOpen(true)}
          >
            <p>RESEARCH-CANARY</p>
          </WorkspaceAccessGate>
          <WorkspaceCenter
            open={open}
            workspaces={[encrypted]}
            activeWorkspaceId={encrypted.id}
            activeWorkspaceUnlocked={false}
            onClose={() => setOpen(false)}
            onSelect={vi.fn()}
            onCreate={vi.fn()}
            onRename={vi.fn()}
            onDelete={vi.fn()}
            onResetDemo={vi.fn()}
          />
        </>
      )
    }

    render(
      <I18nProvider>
        <LockedWorkspaceCenterHarness />
      </I18nProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Choose another workspace' }))
    expect(screen.getByRole('dialog', { name: 'Local workspaces' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Privacy & locking' }))

    expect(screen.getByText('Encrypted route; locked in this tab')).toBeInTheDocument()
    expect(screen.queryByText('Encrypted route; currently open in this tab')).not.toBeInTheDocument()
  })

  it('describes an unverified delete state without claiming data was retained or deleted', () => {
    renderGate({
      error: { code: 'delete-failed', operation: 'delete', retryable: true },
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The deletion state could not be fully verified.')
    expect(alert).toHaveTextContent('either deleted or retained')
    expect(alert).not.toHaveTextContent('stored data was retained')
    expect(alert).not.toHaveTextContent('was deleted successfully')
  })

  it('renders picker content only in picker state and mounts children only when unlocked', () => {
    const { rerender } = render(
      <I18nProvider>
        <WorkspaceAccessGate
          state="locked"
          activeWorkspace={registryEntry()}
          onOpenStandard={vi.fn()}
          onUnlockEncrypted={vi.fn()}
          onOpenWorkspacePicker={vi.fn()}
          pickerContent={<p>PICKER-CANARY</p>}
        >
          <p>RESEARCH-CANARY</p>
        </WorkspaceAccessGate>
      </I18nProvider>,
    )

    expect(screen.queryByText('PICKER-CANARY')).not.toBeInTheDocument()
    rerender(
      <I18nProvider>
        <WorkspaceAccessGate
          state="unlocked"
          activeWorkspace={registryEntry()}
          onOpenStandard={vi.fn()}
          onUnlockEncrypted={vi.fn()}
          onOpenWorkspacePicker={vi.fn()}
          pickerContent={<p>PICKER-CANARY</p>}
        >
          <p>RESEARCH-CANARY</p>
        </WorkspaceAccessGate>
      </I18nProvider>,
    )
    expect(screen.getByText('RESEARCH-CANARY')).toBeInTheDocument()
    expect(screen.queryByText('PICKER-CANARY')).not.toBeInTheDocument()
  })
})
