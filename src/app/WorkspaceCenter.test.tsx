import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../i18n/settings'
import { WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import { WorkspaceCenter, type WorkspaceCenterProps } from './WorkspaceCenter'

function registryEntry(
  overrides: Partial<WorkspaceRegistryEntry> = {},
): WorkspaceRegistryEntry {
  return {
    id: 'personal-standard',
    storageId: 'storage-standard',
    displayName: 'Dissertation fieldwork',
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

function workspaceSet() {
  return [
    registryEntry(),
    registryEntry({
      id: 'personal-encrypted',
      storageId: 'storage-encrypted',
      displayName: 'Encrypted interviews',
      encryptionMode: 'encrypted',
      autoLock: 15,
    }),
    registryEntry({
      id: 'demo',
      storageId: 'storage-demo',
      displayName: 'Synthetic demonstration',
      kind: 'demo',
    }),
  ]
}

function renderCenter(overrides: Partial<WorkspaceCenterProps> = {}) {
  const callbacks = {
    onClose: vi.fn(),
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRetryFinalizeDeletion: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onResetDemo: vi.fn(),
    onAutoLockChange: vi.fn(),
    onConvertToEncrypted: vi.fn(),
    onDiscardEncryptedConversion: vi.fn(),
    onCleanupPlaintextSource: vi.fn(),
    onExportPlaintext: vi.fn(),
    onExportEncrypted: vi.fn(),
    onImportPlaintext: vi.fn(),
    onImportEncrypted: vi.fn(),
  }
  const props: WorkspaceCenterProps = {
    open: true,
    workspaces: workspaceSet(),
    activeWorkspaceId: 'personal-standard',
    ...callbacks,
    ...overrides,
  }

  return {
    callbacks,
    props,
    ...render(
      <I18nProvider>
        <WorkspaceCenter {...props} />
      </I18nProvider>,
    ),
  }
}

describe('WorkspaceCenter', () => {
  afterEach(cleanup)

  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ language: 'en' }),
    )
  })

  it('keeps personal and demo actions separated in a 390px accessible structure', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    const user = userEvent.setup()
    const longName = 'A very long workspace name '.repeat(9).trim()
    const workspaces = workspaceSet().map((workspace, index) => (
      index === 0 ? { ...workspace, displayName: longName } : workspace
    ))
    const { callbacks } = renderCenter({
      workspaces,
      activeWorkspaceId: 'demo',
      activeWorkspaceUnlocked: true,
    })

    expect(screen.getByRole('tablist', { name: 'Workspace settings sections' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Personal research workspaces' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Synthetic demonstration' })).toBeInTheDocument()
    expect(screen.getByText(longName)).toBeInTheDocument()

    const resetActions = screen.getAllByRole('button', { name: /Restore synthetic demo in/ })
    expect(resetActions).toHaveLength(1)
    expect(resetActions[0]).toHaveAccessibleName('Restore synthetic demo in Synthetic demonstration')
    await user.click(resetActions[0])
    const dialog = screen.getByRole('dialog', { name: 'Restore the synthetic demo?' })
    await user.click(within(dialog).getByRole('button', { name: 'Restore synthetic demo' }))
    await waitFor(() => expect(callbacks.onResetDemo).toHaveBeenCalledWith('demo'))

    const workspaceTab = screen.getByRole('tab', { name: 'My workspaces' })
    workspaceTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Privacy & locking' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('creates an encrypted workspace with NFC-normalized code-point validation', async () => {
    const user = userEvent.setup()
    const { callbacks } = renderCenter()
    await user.click(screen.getByRole('button', { name: 'Create workspace' }))

    const dialog = screen.getByRole('dialog', { name: 'Create a local workspace' })
    fireEvent.change(within(dialog).getByLabelText('Workspace name'), {
      target: { value: 'Do not translate / 不翻译' },
    })
    await user.click(within(dialog).getByRole('radio', { name: /Encrypted local workspace/ }))

    const decomposed = 'e\u0301'.repeat(15)
    const composed = 'é'.repeat(15)
    fireEvent.change(within(dialog).getByLabelText('Passphrase'), {
      target: { value: decomposed },
    })
    fireEvent.change(within(dialog).getByLabelText('Confirm passphrase'), {
      target: { value: composed },
    })
    await user.click(within(dialog).getByRole('checkbox', { name: /cannot recover a lost passphrase/i }))
    await user.click(within(dialog).getByRole('button', { name: 'Create workspace' }))

    await waitFor(() => expect(callbacks.onCreate).toHaveBeenCalledWith({
      displayName: 'Do not translate / 不翻译',
      encryptionMode: 'encrypted',
      autoLock: 15,
      passphrase: composed,
      recoveryBoundaryAcknowledged: true,
    }))
  })

  it('requires an exact workspace name for deletion', async () => {
    const user = userEvent.setup()
    const { callbacks } = renderCenter()
    await user.click(screen.getByRole('button', { name: 'Delete Dissertation fieldwork' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete local workspace?' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete workspace' })
    const nameInput = within(dialog).getByLabelText('Exact workspace name')
    expect(confirm).toBeDisabled()
    await user.type(nameInput, 'dissertation fieldwork')
    expect(confirm).toBeDisabled()
    await user.clear(nameInput)
    await user.type(nameInput, 'Dissertation fieldwork')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    await waitFor(() => expect(callbacks.onDelete).toHaveBeenCalledWith('personal-standard'))
  }, 15_000)

  it('keeps unfinished deletion separate and retries without claiming physical state', async () => {
    const user = userEvent.setup()
    const deleting = registryEntry({
      id: 'deleting-workspace',
      storageId: 'deleting-storage',
      displayName: 'Deletion uncertain',
      state: 'deleting',
    })
    const { callbacks } = renderCenter({ pendingDeletions: [deleting] })

    expect(screen.getByRole('heading', { name: 'Unfinished workspace deletions' })).toBeInTheDocument()
    expect(screen.getByText(/cannot determine whether local storage remains/i)).toBeInTheDocument()
    expect(screen.getByText('Physical storage state is not fully verified')).toBeInTheDocument()
    expect(screen.queryByText(/recovery needed/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry deletion' }))
    expect(callbacks.onRetryFinalizeDeletion).toHaveBeenCalledWith(deleting.id)
  })

  it('shows unfinished conversion truth and exposes explicit retry and discard flows', async () => {
    const user = userEvent.setup()
    const staging = registryEntry({
      encryptedConversion: {
        targetStorageId: 'staged-target',
        storageSchemaVersion: 1,
        sourceRevision: 4,
        startedAt: '2026-08-12T01:00:00.000Z',
      },
    })
    const { callbacks } = renderCenter({ workspaces: [staging] })

    expect(screen.getByText('CONVERSION UNFINISHED')).toBeInTheDocument()
    expect(screen.getByText(/standard plaintext workspace remains authoritative/i)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Privacy & locking' }))
    expect(screen.getByRole('alert')).toHaveTextContent('not yet routed as encrypted')

    await user.click(screen.getByRole('button', { name: 'Retry with passphrase' }))
    const retry = screen.getByRole('dialog', { name: 'Retry unfinished encrypted conversion' })
    await user.type(within(retry).getByLabelText('Passphrase for the encrypted copy'), 'fifteen-codepoints-passphrase')
    await user.type(within(retry).getByLabelText('Confirm passphrase'), 'fifteen-codepoints-passphrase')
    await user.click(within(retry).getByRole('checkbox'))
    await user.click(within(retry).getByRole('button', { name: 'Retry conversion' }))
    await waitFor(() => expect(callbacks.onConvertToEncrypted).toHaveBeenCalledWith(
      staging.id,
      'fifteen-codepoints-passphrase',
    ))

    await user.click(screen.getByRole('button', { name: 'Discard staging copy' }))
    const discard = screen.getByRole('dialog', { name: 'Discard encrypted staging copy?' })
    expect(discard).toHaveTextContent('nothing is discarded and its passphrase is required')
    await user.click(within(discard).getByRole('button', { name: 'Discard staging copy' }))
    await waitFor(() => expect(callbacks.onDiscardEncryptedConversion).toHaveBeenCalledWith(
      staging.id,
      undefined,
    ))

    callbacks.onDiscardEncryptedConversion.mockRejectedValueOnce(new Error('raw auth detail'))
    await user.click(screen.getByRole('button', { name: 'Discard staging copy' }))
    const authenticatedDiscard = screen.getByRole('dialog', {
      name: 'Discard encrypted staging copy?',
    })
    const discardPassphrase = within(authenticatedDiscard).getByLabelText(
      'Encrypted-copy passphrase (if staging storage remains)',
    )
    await user.type(discardPassphrase, 'fifteen-codepoints-passphrase')
    await user.click(within(authenticatedDiscard).getByRole('button', {
      name: 'Discard staging copy',
    }))
    await waitFor(() => expect(discardPassphrase).toHaveValue(''))
    expect(authenticatedDiscard).toBeInTheDocument()

    await user.type(discardPassphrase, 'fifteen-codepoints-passphrase')
    await user.click(within(authenticatedDiscard).getByRole('button', {
      name: 'Discard staging copy',
    }))
    await waitFor(() => expect(callbacks.onDiscardEncryptedConversion).toHaveBeenLastCalledWith(
      staging.id,
      'fifteen-codepoints-passphrase',
    ))
    await waitFor(() => expect(authenticatedDiscard).not.toBeInTheDocument())
  }, 15_000)

  it('converts a standard workspace only through a verified-copy passphrase flow', async () => {
    const user = userEvent.setup()
    const { callbacks } = renderCenter({ initialSection: 'privacy' })
    await user.click(screen.getByRole('button', { name: 'Create encrypted copy' }))

    const dialog = screen.getByRole('dialog', { name: 'Create and verify an encrypted copy' })
    expect(dialog).toHaveTextContent('old plaintext source will remain')
    const passphrase = 'conversion phrase'.padEnd(18, '!')
    await user.type(within(dialog).getByLabelText('Passphrase for the encrypted copy'), passphrase)
    await user.type(within(dialog).getByLabelText('Confirm passphrase'), passphrase)
    await user.click(within(dialog).getByRole('checkbox', { name: /old plaintext source will remain/i }))
    await user.click(within(dialog).getByRole('button', { name: 'Create and verify copy' }))

    await waitFor(() => expect(callbacks.onConvertToEncrypted).toHaveBeenCalledWith(
      'personal-standard',
      passphrase,
    ))
  })

  it('requires an encrypted-backup acknowledgement and exact name before plaintext cleanup', async () => {
    const user = userEvent.setup()
    const retained = registryEntry({
      id: 'retained-encrypted',
      storageId: 'storage-retained',
      displayName: 'Converted archive',
      encryptionMode: 'encrypted',
      autoLock: 15,
      plaintextSources: [
        { id: 'plaintext-source', kind: 'standard', state: 'cleanup-pending' },
      ],
    })
    const { callbacks } = renderCenter({
      workspaces: [retained],
      activeWorkspaceId: retained.id,
      initialSection: 'privacy',
    })
    await user.click(screen.getByRole('button', { name: 'Review cleanup' }))

    const dialog = screen.getByRole('dialog', { name: 'Review plaintext-source cleanup' })
    expect(dialog).toHaveTextContent('not verifiable secure erasure')
    const submit = within(dialog).getByRole('button', { name: 'Remove plaintext source' })
    expect(submit).toBeDisabled()
    await user.click(within(dialog).getByRole('checkbox', { name: /generated and safely stored an encrypted/i }))
    await user.type(within(dialog).getByLabelText('Exact workspace name'), 'Converted archive')
    expect(submit).toBeEnabled()
    await user.click(submit)
    await waitFor(() => expect(callbacks.onCleanupPlaintextSource).toHaveBeenCalledWith(
      'retained-encrypted',
      'plaintext-source',
    ))
  })

  it('uses a double-passphrase modal for encrypted exports and clears secrets on cancel', async () => {
    const user = userEvent.setup()
    const { callbacks } = renderCenter({
      activeWorkspaceId: 'personal-encrypted',
      initialSection: 'backup',
    })
    expect(screen.getByRole('status')).toHaveTextContent('Encrypted backup is the default')
    await user.click(screen.getByRole('button', { name: 'Export encrypted backup' }))

    let dialog = screen.getByRole('dialog', { name: 'Create an encrypted backup' })
    await user.type(within(dialog).getByLabelText('Backup passphrase'), 'temporary secret phrase')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Export encrypted backup' }))
    dialog = screen.getByRole('dialog', { name: 'Create an encrypted backup' })
    expect(within(dialog).getByLabelText('Backup passphrase')).toHaveValue('')

    const decomposed = 'e\u0301'.repeat(15)
    const composed = 'é'.repeat(15)
    await user.type(within(dialog).getByLabelText('Backup passphrase'), decomposed)
    await user.type(within(dialog).getByLabelText('Confirm backup passphrase'), composed)
    await user.click(within(dialog).getByRole('button', { name: 'Generate encrypted backup' }))
    await waitFor(() => expect(callbacks.onExportEncrypted).toHaveBeenCalledWith(
      'personal-encrypted',
      composed,
    ))
    expect(document.body).not.toHaveTextContent(decomposed)
  }, 10_000)

  it('imports JSON and encrypted containers into new isolated workspace callbacks', async () => {
    const user = userEvent.setup()
    const { callbacks } = renderCenter({
      activeWorkspaceId: 'personal-encrypted',
      initialSection: 'backup',
    })

    await user.click(screen.getByRole('button', { name: 'Import JSON' }))
    let dialog = screen.getByRole('dialog', { name: 'Import plaintext JSON into a new workspace' })
    expect(dialog).toHaveTextContent('will not overwrite the current workspace')
    const jsonFile = new File(['{}'], 'workspace.json', { type: 'application/json' })
    fireEvent.change(within(dialog).getByLabelText('Plaintext workspace JSON file'), {
      target: { files: [jsonFile] },
    })
    fireEvent.submit(dialog.querySelector('#workspace-plaintext-import-form')!)
    await waitFor(() => expect(callbacks.onImportPlaintext).toHaveBeenCalledWith(jsonFile))

    await user.click(await screen.findByRole('button', { name: 'Import encrypted backup' }))
    dialog = screen.getByRole('dialog', { name: 'Restore encrypted backup into a new workspace' })
    const encryptedFile = new File(['ciphertext'], 'archive.sociologydesk', {
      type: 'application/octet-stream',
    })
    const backupPassphrase = 'backup phrase long enough'
    const newPassphrase = 'new workspace phrase long enough'
    fireEvent.change(within(dialog).getByLabelText('Encrypted .sociologydesk file'), {
      target: { files: [encryptedFile] },
    })
    fireEvent.change(within(dialog).getByLabelText('Backup passphrase'), {
      target: { value: backupPassphrase },
    })
    fireEvent.change(within(dialog).getByLabelText('New workspace passphrase'), {
      target: { value: newPassphrase },
    })
    fireEvent.change(within(dialog).getByLabelText('Confirm new workspace passphrase'), {
      target: { value: newPassphrase },
    })
    await user.click(within(dialog).getByRole('checkbox', { name: /cannot recover the new workspace/i }))
    fireEvent.submit(dialog.querySelector('#workspace-encrypted-import-form')!)

    await waitFor(() => expect(callbacks.onImportEncrypted).toHaveBeenCalledWith({
      file: encryptedFile,
      backupPassphrase,
      newWorkspacePassphrase: newPassphrase,
      recoveryBoundaryAcknowledged: true,
    }))
  })

  it('puts plaintext export behind a strong confirmation', async () => {
    const user = userEvent.setup()
    const { callbacks } = renderCenter({ initialSection: 'backup' })
    await user.click(screen.getByRole('button', { name: 'Export plaintext JSON' }))
    expect(callbacks.onExportPlaintext).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog', { name: 'Export readable plaintext?' })
    expect(dialog).toHaveTextContent('readable research data')
    await user.click(within(dialog).getByRole('button', { name: 'Export plaintext JSON' }))
    await waitFor(() => expect(callbacks.onExportPlaintext).toHaveBeenCalledWith('personal-standard'))
  })
})
