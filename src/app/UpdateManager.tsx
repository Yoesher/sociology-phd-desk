import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Download, RefreshCw, WifiOff } from 'lucide-react'
import { Button, Modal } from '../components/ui'
import { useI18n } from '../i18n'
import { useWorkspaceSession } from '../hooks/useWorkspaceSession'
import { buildInfo } from './buildInfo'
import { UpdateManagerContext, type UpdateManagerState } from './update-manager-context'
import { activateWaitingWorker, OtherApplicationTabsOpenError } from './serviceWorkerUpdate'
import { releaseMetadata } from '../release/releaseMetadata'
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
  const { locale, t } = useI18n()
  const {
    activeWorkspace,
    openWorkspaceCenter,
    prepareForApplicationUpdate,
  } = useWorkspaceSession()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [state, setState] = useState<UpdateManagerState>('idle')
  const [otherTabsOpen, setOtherTabsOpen] = useState(false)
  const [peerUpdateRequested, setPeerUpdateRequested] = useState(false)
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [backOnline, setBackOnline] = useState(false)
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
  const checking = state === 'checking'
  const applying = state === 'applying'
  const error = state === 'error'

  const inspectWaiting = useCallback((candidate: ServiceWorkerRegistration) => {
    if (candidate.waiting) {
      setWaitingWorker(candidate.waiting)
      setUpdateBannerDismissed(false)
      setState('ready')
    }
  }, [])

  const checkForUpdate = useCallback(async () => {
    if (!registration) return
    setState('checking')
    setOtherTabsOpen(false)
    try {
      lastCheckAt.current = Date.now()
      await registration.update()
      inspectWaiting(registration)
      setState(registration.waiting ? 'ready' : 'idle')
    } catch {
      setState('error')
    } finally {
      if (registration.waiting) setState('ready')
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
        setState('available')
        const installing = candidate.installing
        if (!installing) return
        setState('installing')
        const handleStateChange = () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            inspectWaiting(candidate)
          } else if (installing.state === 'redundant') {
            setState('error')
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
        if (!cancelled) setState('error')
      }
    }

    const onLoad = () => void register()
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })

    const onFocus = () => {
      if (!currentRegistration || Date.now() - lastCheckAt.current < FOCUS_CHECK_INTERVAL_MS) return
      lastCheckAt.current = Date.now()
      void currentRegistration.update().then(() => inspectWaiting(currentRegistration!)).catch(() => {
        setState('error')
      })
    }
    window.addEventListener('focus', onFocus)

    const onControllerChange = () => {
      if (reloadAfterActivation.current) window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    const onWorkerMessage = (event: MessageEvent<unknown>) => {
      if (
        typeof event.data === 'object' && event.data !== null &&
        'type' in event.data && event.data.type === 'UPDATE_REQUESTED'
      ) setPeerUpdateRequested(true)
    }
    navigator.serviceWorker.addEventListener('message', onWorkerMessage)

    return () => {
      cancelled = true
      stopWatching()
      window.removeEventListener('load', onLoad)
      window.removeEventListener('focus', onFocus)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      navigator.serviceWorker.removeEventListener('message', onWorkerMessage)
    }
  }, [inspectWaiting, supported])

  useEffect(() => {
    let timer = 0
    const markOffline = () => {
      window.clearTimeout(timer)
      setBackOnline(false)
      setOnline(false)
    }
    const markOnline = () => {
      setOnline(true)
      setBackOnline(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setBackOnline(false), 5_000)
    }
    window.addEventListener('offline', markOffline)
    window.addEventListener('online', markOnline)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('offline', markOffline)
      window.removeEventListener('online', markOnline)
    }
  }, [])

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
    setState('applying')
    setOtherTabsOpen(false)
    try {
      await activateWaitingWorker(worker, prepareForApplicationUpdate, () => {
        reloadAfterActivation.current = true
      })
    } catch (cause) {
      reloadAfterActivation.current = false
      setOtherTabsOpen(cause instanceof OtherApplicationTabsOpenError)
      setState('error')
      setUpdateBannerDismissed(false)
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
    state,
    supported,
    updateAvailable: Boolean(waitingWorker),
    applying,
    checking,
    error,
    installAvailable: Boolean(installPrompt),
    installed,
    otherTabsOpen,
    peerUpdateRequested,
    checkForUpdate,
    applyUpdate,
    requestInstall,
  }), [applyUpdate, applying, checkForUpdate, checking, error, installPrompt, installed, otherTabsOpen, peerUpdateRequested, requestInstall, state, supported, waitingWorker])

  const closeReleaseNotes = () => {
    rememberReleaseNotesSeen()
    setReleaseNotesOpen(false)
  }

  return (
    <UpdateManagerContext.Provider value={value}>
      {children}
      {!online && (
        <aside className="network-status" role="status" aria-live="polite">
          <WifiOff size={15} aria-hidden="true" /> {t('distribution.network.offline')}
        </aside>
      )}
      {online && backOnline && (
        <aside className="network-status network-status--online" role="status" aria-live="polite">
          {t('distribution.network.online')}
        </aside>
      )}
      {peerUpdateRequested && (
        <aside className="peer-update-banner" role="status" aria-live="polite">
          <span>{t('distribution.update.peerRequested')}</span>
          <Button variant="ghost" onClick={() => setPeerUpdateRequested(false)}>{t('common.close')}</Button>
        </aside>
      )}
      {waitingWorker && !updateBannerDismissed && (
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
          {!applying && (
            <Button variant="ghost" onClick={() => setUpdateBannerDismissed(true)}>
              {t('distribution.update.later')}
            </Button>
          )}
          {error && <span role="alert">{t(otherTabsOpen ? 'distribution.update.otherTabs' : 'distribution.update.failed')}</span>}
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
        footer={<>
          <a className="button button--secondary button--md" href={releaseMetadata.releaseUrl} target="_blank" rel="noreferrer">
            <span>{t('distribution.release.full')}</span>
          </a>
          <Button variant="primary" onClick={closeReleaseNotes}>{t('distribution.release.gotIt')}</Button>
        </>}
      >
        <ul className="release-notes">
          {releaseMetadata.summary[locale].map((item) => <li key={item}>{item}</li>)}
        </ul>
      </Modal>
    </UpdateManagerContext.Provider>
  )
}
