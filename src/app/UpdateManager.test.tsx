import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../i18n/settings'
import { useUpdateManager } from '../hooks/useUpdateManager'
import { activateWaitingWorker } from './serviceWorkerUpdate'
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

afterEach(cleanup)

describe('activateWaitingWorker', () => {
  it('activates only after workspace preparation succeeds', async () => {
    const postMessage = vi.fn()
    const prepare = vi.fn().mockResolvedValue(undefined)
    const onPrepared = vi.fn()

    await activateWaitingWorker({ postMessage }, prepare, onPrepared)

    expect(prepare).toHaveBeenCalledOnce()
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(prepare.mock.invocationCallOrder[0]).toBeLessThan(postMessage.mock.invocationCallOrder[0])
    expect(onPrepared.mock.invocationCallOrder[0]).toBeLessThan(postMessage.mock.invocationCallOrder[0])
  })

  it('does not activate when a standard or encrypted workspace cannot be verified', async () => {
    const postMessage = vi.fn()
    const prepare = vi.fn().mockRejectedValue(new Error('pending write failed'))
    const onPrepared = vi.fn()

    await expect(activateWaitingWorker({ postMessage }, prepare, onPrepared)).rejects.toThrow('pending write failed')
    expect(onPrepared).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('captures the install prompt at application startup for later user action', async () => {
    window.localStorage.clear()
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en' }))
    window.localStorage.setItem('sociology-phd-desk:release-notes:0.2.1', 'seen')
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
})
