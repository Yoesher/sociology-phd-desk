import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../i18n/settings'
import { useUpdateManager } from '../hooks/useUpdateManager'
import { activateWaitingWorker, OtherApplicationTabsOpenError } from './serviceWorkerUpdate'
import { UpdateManagerProvider } from './UpdateManager'

vi.mock('../hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => ({
    activeWorkspace: null,
    openWorkspaceCenter: vi.fn(),
    prepareForApplicationUpdate: vi.fn().mockResolvedValue(undefined),
  }),
}))

function InstallProbe() {
  const update = useUpdateManager()
  return update.installAvailable
    ? <button type="button" onClick={() => void update.requestInstall()}>Install captured app</button>
    : <span>No install prompt</span>
}

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('activateWaitingWorker', () => {
  it('activates only after workspace preparation succeeds', async () => {
    const postMessage = vi.fn()
    const prepare = vi.fn().mockResolvedValue(undefined)
    const onPrepared = vi.fn()

    const inspect = vi.fn().mockResolvedValue(0)
    await activateWaitingWorker({ postMessage }, prepare, onPrepared, inspect)

    expect(prepare).toHaveBeenCalledOnce()
    expect(inspect).toHaveBeenCalledTimes(2)
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(prepare.mock.invocationCallOrder[0]).toBeLessThan(postMessage.mock.invocationCallOrder[0])
    expect(onPrepared.mock.invocationCallOrder[0]).toBeLessThan(postMessage.mock.invocationCallOrder[0])
  })

  it('rechecks other tabs after the workspace flush and before activation', async () => {
    const postMessage = vi.fn()
    const prepare = vi.fn().mockResolvedValue(undefined)
    const inspect = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    await expect(activateWaitingWorker(
      { postMessage }, prepare, vi.fn(), inspect,
    )).rejects.toBeInstanceOf(OtherApplicationTabsOpenError)
    expect(prepare).toHaveBeenCalledOnce()
    expect(postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('refuses activation when another application tab is open', async () => {
    const postMessage = vi.fn()
    const prepare = vi.fn()
    await expect(activateWaitingWorker(
      { postMessage }, prepare, vi.fn(), async () => 1,
    )).rejects.toBeInstanceOf(OtherApplicationTabsOpenError)
    expect(prepare).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('does not activate when a standard or encrypted workspace cannot be verified', async () => {
    const postMessage = vi.fn()
    const prepare = vi.fn().mockRejectedValue(new Error('pending write failed'))
    const onPrepared = vi.fn()

    await expect(activateWaitingWorker(
      { postMessage }, prepare, onPrepared, vi.fn().mockResolvedValue(0),
    )).rejects.toThrow('pending write failed')
    expect(onPrepared).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('captures the install prompt at application startup for later user action', async () => {
    window.localStorage.clear()
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en' }))
    window.localStorage.setItem('sociology-phd-desk:release-notes:0.3.0', 'seen')
    const prompt = vi.fn().mockResolvedValue(undefined)
    const installEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: 'accepted' }>
    }
    installEvent.prompt = prompt
    installEvent.userChoice = Promise.resolve({ outcome: 'accepted' })

    render(
      <I18nProvider>
        <UpdateManagerProvider><InstallProbe /></UpdateManagerProvider>
      </I18nProvider>,
    )
    window.dispatchEvent(installEvent)

    const action = await screen.findByRole('button', { name: 'Install captured app' })
    await userEvent.setup().click(action)
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce())
    expect(screen.getByText('No install prompt')).toBeInTheDocument()
  })

  it('lets the user postpone a waiting update without activating or reloading it', async () => {
    window.localStorage.clear()
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en' }))
    window.localStorage.setItem('sociology-phd-desk:release-notes:0.3.0', 'seen')
    const worker = { postMessage: vi.fn() }
    const registration = {
      waiting: worker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    render(
      <I18nProvider>
        <UpdateManagerProvider><span>Research workspace</span></UpdateManagerProvider>
      </I18nProvider>,
    )

    expect(await screen.findByText('A new version is ready')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByText('A new version is ready')).not.toBeInTheDocument()
    expect(worker.postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(screen.getByText('Research workspace')).toBeInTheDocument()
  })

  it('announces offline and online recovery without claiming synchronization', async () => {
    window.localStorage.clear()
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en' }))
    window.localStorage.setItem('sociology-phd-desk:release-notes:0.3.0', 'seen')
    render(
      <I18nProvider>
        <UpdateManagerProvider><span>Research workspace</span></UpdateManagerProvider>
      </I18nProvider>,
    )

    window.dispatchEvent(new Event('offline'))
    expect(await screen.findByText('Offline')).toBeInTheDocument()
    expect(screen.queryByText(/sync/i)).not.toBeInTheDocument()
    window.dispatchEvent(new Event('online'))
    expect(await screen.findByText('Back online')).toBeInTheDocument()
  })
})
