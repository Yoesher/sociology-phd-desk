import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button, Modal } from '../components/ui'
import { useI18n } from '../i18n'
import { useWorkspaceSession } from '../hooks/useWorkspaceSession'
import { buildInfo } from './buildInfo'
import { UpdateManagerContext } from './update-manager-context'
import { activateWaitingWorker } from './serviceWorkerUpdate'
import {
  BACKUP_REMINDER_SETTINGS_CHANGED,
  backupReminderIsDue,
  readBackupReminderDays,
  snoozeBackupReminder,
} from './backupReminder'

const RELEASE_NOTES_KEY = `sociology-phd-desk:release-notes:${buildInfo.appVersion}`
const FOCUS_CHECK_INTERVAL_MS = 60 * 60 * 1000

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function readReleaseNotesSeen() {
  try {
    return window.localStorage.getItem(RELEASE_NOTES_KEY) === 'seen'
  } catch {
    return false
  }
}

function rememberReleaseNotesSeen() {
  try {
    window.localStorage.setItem(RELEASE_NOTES_KEY, 'seen')
  } catch {
    // The summary can reappear if browser-local metadata is unavailable.
  }
}

export function UpdateManagerProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const {
    activeWorkspace,
    openWorkspaceCenter,
    prepareForApplicationUpdate,
  } = useWorkspaceSession()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() =>
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches,
  )
  const [, setReminderRevision] = useState(0)
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(() => !readReleaseNotesSeen())
  const lastCheckAt = useRef(0)
  const reloadAfterActivation = useRef(false)
  const supported = 'serviceWorker' in navigator
  const reminderDays = readBackupReminderDays()
  const reminderDue = backupReminderIsDue(activeWorkspace, reminderDays)

  const inspectWaiting = useCallback((candidate: ServiceWorkerRegistration) => {
    if (candidate.waiting) setWaitingWorker(candidate.waiting)
  }, [])

  const checkForUpdate = useCallback(async () => {
    if (!registration) return
    setChecking(true)
    setError(false)
    try {
      lastCheckAt.current = Date.now()
      await registration.update()
      inspectWaiting(registration)
    } catch {
      setError(true)
    } finally {
      setChecking(false)
    }
  }, [inspectWaiting, registration])

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    let currentRegistration: ServiceWorkerRegistration | null = null

    const watchRegistration = (candidate: ServiceWorkerRegistration) => {
      currentRegistration = candidate
      setRegistration(candidate)
      inspectWaiting(candidate)
      const handleUpdateFound = () => {
        const installing = candidate.installing
        if (!installing) return
        const handleStateChange = () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            inspectWaiting(candidate)
          }
        }
        installing.addEventListener('statechange', handleStateChange)
      }
      candidate.addEventListener('updatefound', handleUpdateFound)
      return () => candidate.removeEventListener('updatefound', handleUpdateFound)
    }

    let stopWatching: () => void = () => undefined
    const register = async () => {
      try {
        const candidate = await navigator.serviceWorker.register(
          new URL('sw.js', document.baseURI),
          { scope: './', updateViaCache: 'none' },
        )
        if (cancelled) return
        stopWatching = watchRegistration(candidate)
        lastCheckAt.current = Date.now()
        await candidate.update()
        inspectWaiting(candidate)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    const onLoad = () => void register()
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })

    const onFocus = () => {
      if (!currentRegistration || Date.now() - lastCheckAt.current < FOCUS_CHECK_INTERVAL_MS) return
      lastCheckAt.current = Date.now()
      void currentRegistration.update().then(() => inspectWaiting(currentRegistration!)).catch(() => {
        setError(true)
      })
    }
    window.addEventListener('focus', onFocus)

    const onControllerChange = () => {
      if (reloadAfterActivation.current) window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      cancelled = true
      stopWatching()
      window.removeEventListener('load', onLoad)
      window.removeEventListener('focus', onFocus)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [inspectWaiting, supported])

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const markInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  useEffect(() => {
    const refreshReminder = () => setReminderRevision((revision) => revision + 1)
    window.addEventListener(BACKUP_REMINDER_SETTINGS_CHANGED, refreshReminder)
    return () => window.removeEventListener(BACKUP_REMINDER_SETTINGS_CHANGED, refreshReminder)
  }, [])

  const applyUpdate = useCallback(async () => {
    const worker = waitingWorker ?? registration?.waiting
    if (!worker || applying) return
    setApplying(true)
    setError(false)
    try {
      await activateWaitingWorker(worker, prepareForApplicationUpdate, () => {
        reloadAfterActivation.current = true
      })
    } catch {
      reloadAfterActivation.current = false
      setApplying(false)
      setError(true)
    }
  }, [applying, prepareForApplicationUpdate, registration, waitingWorker])

  const requestInstall = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }, [installPrompt])

  const value = useMemo(() => ({
    supported,
    updateAvailable: Boolean(waitingWorker),
    applying,
    checking,
    error,
    installAvailable: Boolean(installPrompt),
    installed,
    checkForUpdate,
    applyUpdate,
    requestInstall,
  }), [applyUpdate, applying, checkForUpdate, checking, error, installPrompt, installed, requestInstall, supported, waitingWorker])

  const closeReleaseNotes = () => {
    rememberReleaseNotesSeen()
    setReleaseNotesOpen(false)
  }

  return (
    <UpdateManagerContext.Provider value={value}>
      {children}
      {waitingWorker && (
        <aside className="update-banner" role="status" aria-live="polite">
          <div>
            <strong>{t('distribution.update.availableTitle')}</strong>
            <span>{t('distribution.update.availableBody')}</span>
          </div>
          <Button
            variant="primary"
            icon={<RefreshCw size={15} />}
            disabled={applying}
            onClick={() => void applyUpdate()}
          >
            {t(applying ? 'distribution.update.preparing' : 'distribution.update.action')}
          </Button>
          {error && <span role="alert">{t('distribution.update.failed')}</span>}
        </aside>
      )}
      {reminderDue && activeWorkspace && (
        <aside className="backup-reminder-banner" role="status" aria-live="polite">
          <div>
            <strong>{t('distribution.backup.reminderTitle')}</strong>
            <span>{t('distribution.backup.due', { days: reminderDays })}</span>
          </div>
          <Button icon={<Download size={15} />} onClick={() => openWorkspaceCenter('backup')}>
            {t('distribution.backup.open')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              snoozeBackupReminder(activeWorkspace.id)
              setReminderRevision((revision) => revision + 1)
            }}
          >
            {t('distribution.backup.snooze')}
          </Button>
        </aside>
      )}
      <Modal
        open={releaseNotesOpen}
        title={t('distribution.release.title', { version: buildInfo.appVersion })}
        description={t('distribution.release.description')}
        onClose={closeReleaseNotes}
        size="sm"
        footer={<Button variant="primary" onClick={closeReleaseNotes}>{t('common.close')}</Button>}
      >
        <ul className="release-notes">
          <li>{t('distribution.release.install')}</li>
          <li>{t('distribution.release.offline')}</li>
          <li>{t('distribution.release.update')}</li>
          <li>{t('distribution.release.storage')}</li>
        </ul>
      </Modal>
    </UpdateManagerContext.Provider>
  )
}
