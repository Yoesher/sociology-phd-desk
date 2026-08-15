import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../i18n/settings'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import { UpdateManagerContext } from './update-manager-context'
import { DistributionCenter } from './DistributionCenter'
import { createDemoWorkspace } from '../models/demo'

const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')
const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')

const workspace: WorkspaceRegistryEntry = {
  id: 'workspace',
  storageId: 'storage',
  displayName: 'Dissertation',
  kind: 'personal',
  encryptionMode: 'standard',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  schemaVersion: 4,
  storageSchemaVersion: 4,
  registryRevision: 1,
  autoLock: 'never',
  state: 'ready',
}

describe('DistributionCenter', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en' }))
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockResolvedValue(false),
        estimate: vi.fn().mockResolvedValue({ usage: 10_485_760, quota: 104_857_600 }),
      },
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
  })
  afterEach(() => {
    cleanup()
    if (serviceWorkerDescriptor) Object.defineProperty(navigator, 'serviceWorker', serviceWorkerDescriptor)
    else Reflect.deleteProperty(navigator, 'serviceWorker')
    if (createObjectUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor)
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (revokeObjectUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor)
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('shows the complete version axis and accurately reports a denied persistence request', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <UpdateManagerContext.Provider value={{
          state: 'idle',
          supported: true,
          updateAvailable: false,
          applying: false,
          checking: false,
          error: false,
          installAvailable: false,
          installed: false,
          otherTabsOpen: false,
          peerUpdateRequested: false,
          checkForUpdate: vi.fn(),
          applyUpdate: vi.fn(),
          requestInstall: vi.fn(),
        }}>
          <DistributionCenter activeWorkspace={workspace} />
        </UpdateManagerContext.Provider>
      </I18nProvider>,
    )
    await waitFor(() => expect(screen.getByText(/Persistence is not currently granted/i)).toBeInTheDocument())
    expect(await screen.findByText(/10 MB used of 100 MB/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Request persistent storage/i }))
    expect(navigator.storage.persist).toHaveBeenCalledOnce()
    expect(screen.getByText('App version').nextSibling).toHaveTextContent('0.3.0')
    expect(screen.getByText('Portable schema').nextSibling).toHaveTextContent('5')
    expect(screen.getByText('Database schema').nextSibling).toHaveTextContent('5')
    expect(screen.getByText('Encrypted container').nextSibling).toHaveTextContent('1')
    expect(screen.getByText('Build date').nextSibling).not.toBeEmptyDOMElement()
  })

  it('stores only local reminder metadata and offers off, 7, 14, and 30 days', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <UpdateManagerContext.Provider value={{
          state: 'idle',
          supported: false,
          updateAvailable: false,
          applying: false,
          checking: false,
          error: false,
          installAvailable: false,
          installed: false,
          otherTabsOpen: false,
          peerUpdateRequested: false,
          checkForUpdate: vi.fn(),
          applyUpdate: vi.fn(),
          requestInstall: vi.fn(),
        }}>
          <DistributionCenter activeWorkspace={workspace} />
        </UpdateManagerContext.Provider>
      </I18nProvider>,
    )
    const select = screen.getByRole('combobox', { name: 'Remind after' })
    expect(Array.from(select.querySelectorAll('option')).map((option) => option.value)).toEqual(['off', '7', '14', '30'])
    await user.selectOptions(select, '30')
    expect(window.localStorage.getItem('sociology-phd-desk:backup-reminder:v1')).toBe('{"days":30}')
  })

  it('reports a persistence grant after an explicit browser-approved request', async () => {
    vi.mocked(navigator.storage.persist).mockResolvedValue(true)
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <UpdateManagerContext.Provider value={{
          state: 'idle', supported: true, updateAvailable: false, applying: false, checking: false,
          error: false, installAvailable: false, installed: false, otherTabsOpen: false,
          peerUpdateRequested: false, checkForUpdate: vi.fn(), applyUpdate: vi.fn(), requestInstall: vi.fn(),
        }}>
          <DistributionCenter activeWorkspace={workspace} />
        </UpdateManagerContext.Provider>
      </I18nProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Request persistent storage' }))
    expect(await screen.findByText('The browser reports that storage persistence is granted.')).toBeInTheDocument()
    expect(navigator.storage.persist).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Request persistent storage' })).not.toBeInTheDocument()
  })

  it('degrades accurately when the persistence API is unavailable', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 1_048_576 }) },
    })
    render(
      <I18nProvider>
        <UpdateManagerContext.Provider value={{
          state: 'idle', supported: true, updateAvailable: false, applying: false, checking: false,
          error: false, installAvailable: false, installed: false, otherTabsOpen: false,
          peerUpdateRequested: false, checkForUpdate: vi.fn(), applyUpdate: vi.fn(), requestInstall: vi.fn(),
        }}>
          <DistributionCenter activeWorkspace={workspace} />
        </UpdateManagerContext.Provider>
      </I18nProvider>,
    )
    expect(await screen.findByText(/does not expose a persistent-storage request/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request persistent storage' })).not.toBeInTheDocument()
  })

  it('keeps diagnostics local, verifies pending writes, and exposes bilingual privacy boundaries', async () => {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'zh-CN' }))
    const user = userEvent.setup()
    const snapshot = createDemoWorkspace(new Date('2026-08-15T00:00:00.000Z'))
    const onPrepareDiagnostics = vi.fn().mockResolvedValue(snapshot)
    const registration = { active: { state: 'activated' }, waiting: null, installing: null }
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:diagnostics'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    render(
      <I18nProvider>
        <UpdateManagerContext.Provider value={{
          state: 'idle', supported: true, updateAvailable: false, applying: false, checking: false,
          error: false, installAvailable: false, installed: true, otherTabsOpen: false,
          peerUpdateRequested: false, checkForUpdate: vi.fn(), applyUpdate: vi.fn(), requestInstall: vi.fn(),
        }}>
          <DistributionCenter activeWorkspace={workspace} onPrepareDiagnostics={onPrepareDiagnostics} />
        </UpdateManagerContext.Provider>
      </I18nProvider>,
    )

    expect(screen.getByText(/报告不含工作台名称或 ID/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '导出诊断信息' }))
    await waitFor(() => expect(onPrepareDiagnostics).toHaveBeenCalledOnce())
    expect(click).toHaveBeenCalledOnce()
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(await screen.findByText('不含研究内容的诊断报告已下载到本地。')).toBeInTheDocument()
  })

  it('does not export counts from a locked or unopened workspace', async () => {
    render(
      <I18nProvider>
        <UpdateManagerContext.Provider value={{
          state: 'idle', supported: false, updateAvailable: false, applying: false, checking: false,
          error: false, installAvailable: false, installed: false, otherTabsOpen: false,
          peerUpdateRequested: false, checkForUpdate: vi.fn(), applyUpdate: vi.fn(), requestInstall: vi.fn(),
        }}>
          <DistributionCenter activeWorkspace={workspace} />
        </UpdateManagerContext.Provider>
      </I18nProvider>,
    )
    expect(screen.getByRole('button', { name: 'Export diagnostics' })).toBeDisabled()
    expect(screen.getByText(/Open or unlock the active workspace/i)).toBeInTheDocument()
  })
})
