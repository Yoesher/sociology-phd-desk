import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../i18n/settings'
import { WORKSPACE_SCHEMA_VERSION } from '../models/domain'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import { PrivacyCenter } from './PrivacyCenter'

function registryEntry(
  overrides: Partial<WorkspaceRegistryEntry> = {},
): WorkspaceRegistryEntry {
  return {
    id: 'workspace-privacy',
    storageId: 'storage-privacy',
    displayName: 'Longitudinal interview archive',
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

function renderPrivacy(
  workspace: WorkspaceRegistryEntry,
  overrides: Partial<React.ComponentProps<typeof PrivacyCenter>> = {},
) {
  return render(
    <I18nProvider>
      <PrivacyCenter
        workspace={workspace}
        autoLock={workspace.autoLock}
        onAutoLockChange={vi.fn()}
        {...overrides}
      />
    </I18nProvider>,
  )
}

describe('PrivacyCenter', () => {
  afterEach(cleanup)

  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ language: 'en' }),
    )
  })

  it('states the local storage, mode, export, and all numeric auto-lock facts', async () => {
    const user = userEvent.setup()
    const onAutoLockChange = vi.fn()
    const workspace = registryEntry()
    renderPrivacy(workspace, { onAutoLockChange })

    expect(screen.getByText('Current device · current browser profile · IndexedDB')).toBeInTheDocument()
    expect(screen.getByText('Not encrypted by Sociology PhD Desk')).toBeInTheDocument()
    expect(screen.getByText('No export generated yet')).toBeInTheDocument()

    const select = screen.getByLabelText('Automatic lock')
    expect(within(select).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual([
      'never',
      '5',
      '15',
      '30',
      '60',
    ])
    await user.selectOptions(select, '30')
    expect(onAutoLockChange).toHaveBeenCalledWith(30)
  })

  it('always explains shared-origin boundaries and elevates the public-hosting warning', () => {
    renderPrivacy(registryEntry(), { sharedOriginWarning: true })

    expect(screen.getByText(/origin is defined by scheme, host, and port—not by the project path/i)).toBeInTheDocument()
    expect(screen.getByText(/not security boundaries against scripts running on the same origin/i)).toBeInTheDocument()
    expect(screen.getByText(/public hosting origin may also serve other project paths/i)).toBeInTheDocument()
  })

  it('offers a two-stage encrypted-copy action for a standard workspace', async () => {
    const user = userEvent.setup()
    const onStartEncryptedCopy = vi.fn()
    renderPrivacy(registryEntry(), { onStartEncryptedCopy })

    expect(screen.getByText(/old plaintext source will remain and be marked cleanup pending/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create encrypted copy' }))
    expect(onStartEncryptedCopy).toHaveBeenCalledOnce()
  })

  it('marks retained plaintext as incomplete protection and isolates cleanup by source', async () => {
    const user = userEvent.setup()
    const onReviewPlaintextCleanup = vi.fn()
    renderPrivacy(
      registryEntry({
        encryptionMode: 'encrypted',
        autoLock: 15,
        plaintextSources: [
          { id: 'legacy-source', kind: 'legacy', state: 'retained' },
          { id: 'standard-source', kind: 'standard', state: 'cleanup-pending' },
          { id: 'removed-source', kind: 'standard', state: 'removed' },
        ],
      }),
      { onReviewPlaintextCleanup },
    )

    expect(screen.getByText(/not fully encrypted at rest/i)).toBeInTheDocument()
    expect(screen.queryByText('Encrypted route; currently open in this tab')).not.toBeInTheDocument()
    expect(screen.getByText('Legacy plaintext database')).toBeInTheDocument()
    expect(screen.getByText('Earlier standard workspace storage')).toBeInTheDocument()

    const cleanupButtons = screen.getAllByRole('button', { name: 'Review cleanup' })
    expect(cleanupButtons).toHaveLength(2)
    await user.click(cleanupButtons[1])
    expect(onReviewPlaintextCleanup).toHaveBeenCalledWith('standard-source')
  })

  it('distinguishes a locked encrypted route from an open encrypted session', () => {
    const encrypted = registryEntry({ encryptionMode: 'encrypted' })
    const view = renderPrivacy(encrypted, { workspaceUnlocked: false })

    expect(screen.getByText('Encrypted route; locked in this tab')).toBeInTheDocument()
    expect(screen.queryByText('Encrypted route; currently open in this tab')).not.toBeInTheDocument()

    view.rerender(
      <I18nProvider>
        <PrivacyCenter
          workspace={encrypted}
          workspaceUnlocked
          autoLock={encrypted.autoLock}
          onAutoLockChange={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(screen.getByText('Encrypted route; currently open in this tab')).toBeInTheDocument()
  })

  it('keeps an unfinished conversion standard and authoritative whether locked or open', () => {
    const staging = registryEntry({
      encryptedConversion: {
        targetStorageId: 'staged-target',
        storageSchemaVersion: 1,
        sourceRevision: 2,
        startedAt: '2026-08-12T01:00:00.000Z',
      },
    })
    const view = renderPrivacy(staging, { workspaceUnlocked: false })
    expect(screen.getByRole('alert')).toHaveTextContent('standard plaintext workspace remains authoritative')
    expect(screen.getByText('Not encrypted by Sociology PhD Desk')).toBeInTheDocument()

    view.rerender(
      <I18nProvider>
        <PrivacyCenter
          workspace={staging}
          workspaceUnlocked
          autoLock={staging.autoLock}
          onAutoLockChange={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('not yet routed as encrypted')
    expect(screen.queryByText(/Encrypted route/)).not.toBeInTheDocument()
  })

  it('presents the four threat layers and research/erasure boundaries without security promises', () => {
    renderPrivacy(registryEntry())

    for (const heading of [
      'Browser isolation',
      'Local screen lock',
      'Encrypted local workspace',
      'Device compromise',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText(/Encryption is not ethics approval/i)).toBeInTheDocument()
    expect(screen.getByText(/not verifiable secure erasure/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\b(?:login|account|forgot password|absolute security)\b/i)
  })
})
