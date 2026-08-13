import { useEffect, useState } from 'react'
import { Download, HardDrive, Laptop, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button, Field } from '../components/ui'
import { useI18n } from '../i18n'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import { useUpdateManager } from '../hooks/useUpdateManager'
import { buildInfo } from './buildInfo'
import {
  backupReminderIsDue,
  readBackupReminderDays,
  writeBackupReminderDays,
  type BackupReminderDays,
} from './backupReminder'

type PersistenceState = 'checking' | 'unsupported' | 'granted' | 'not-granted'
interface StorageEstimate { usage: number; quota: number }

export function DistributionCenter({
  activeWorkspace,
  onOpenBackup,
}: {
  activeWorkspace: WorkspaceRegistryEntry | null
  onOpenBackup?: () => void
}) {
  const { locale, t, formatDate } = useI18n()
  const update = useUpdateManager()
  const [persistence, setPersistence] = useState<PersistenceState>('checking')
  const [requestingPersistence, setRequestingPersistence] = useState(false)
  const [reminderDays, setReminderDays] = useState<BackupReminderDays>(readBackupReminderDays)
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null)
  const [installationHelpOpen, setInstallationHelpOpen] = useState(false)

  useEffect(() => {
    let active = true
    const inspect = async () => {
      if (!navigator.storage?.persisted) {
        if (active) setPersistence('unsupported')
      } else {
        try {
          const granted = await navigator.storage.persisted()
          if (active) setPersistence(granted ? 'granted' : 'not-granted')
        } catch {
          if (active) setPersistence('unsupported')
        }
      }
      if (navigator.storage?.estimate) {
        try {
          const estimate = await navigator.storage.estimate()
          if (active && typeof estimate.usage === 'number' && typeof estimate.quota === 'number') {
            setStorageEstimate({ usage: estimate.usage, quota: estimate.quota })
          }
        } catch {
          // Estimate is optional and may be withheld by the browser.
        }
      }
    }
    void inspect()
    return () => { active = false }
  }, [])

  const requestPersistence = async () => {
    if (!navigator.storage?.persist) return
    setRequestingPersistence(true)
    try {
      const granted = await navigator.storage.persist()
      setPersistence(granted ? 'granted' : 'not-granted')
    } catch {
      setPersistence('not-granted')
    } finally {
      setRequestingPersistence(false)
    }
  }

  const reminderDue = backupReminderIsDue(activeWorkspace, reminderDays)
  const formatStorage = (bytes: number) => new Intl.NumberFormat(locale, {
    style: 'unit', unit: 'megabyte', maximumFractionDigits: 1,
  }).format(bytes / 1_048_576)

  return (
    <section className="distribution-center" aria-labelledby="distribution-center-title">
      <header>
        <p className="eyebrow">{t('distribution.center.eyebrow')}</p>
        <h2 id="distribution-center-title">{t('distribution.center.title')}</h2>
        <p>{t('distribution.center.description')}</p>
      </header>

      {reminderDue && (
        <p className="distribution-notice distribution-notice--warning" role="status">
          {t('distribution.backup.due', { days: reminderDays })}
        </p>
      )}

      <div className="distribution-grid">
        <article>
          <HardDrive size={20} />
          <h3>{t('distribution.storage.title')}</h3>
          <p>{t(`distribution.storage.${persistence}`)}</p>
          <p>{t('distribution.storage.clearRisk')}</p>
          {storageEstimate && (
            <p>{t('distribution.storage.estimate', {
              usage: formatStorage(storageEstimate.usage),
              quota: formatStorage(storageEstimate.quota),
            })}</p>
          )}
          {persistence !== 'granted' && persistence !== 'unsupported' && (
            <Button disabled={requestingPersistence} onClick={() => void requestPersistence()}>
              {t('distribution.storage.request')}
            </Button>
          )}
        </article>
        <article>
          <Download size={20} />
          <h3>{t('distribution.install.title')}</h3>
          <p>{t(update.installed ? 'distribution.install.installed' : 'distribution.install.body')}</p>
          {!update.installed && update.installAvailable && (
            <Button onClick={() => void update.requestInstall()}>{t('distribution.install.action')}</Button>
          )}
          {!update.installed && !update.installAvailable && (
            <Button onClick={() => setInstallationHelpOpen((open) => !open)}>
              {t('distribution.install.instructions')}
            </Button>
          )}
          {installationHelpOpen && (
            <div className="distribution-install-help" role="status">
              <p>{t('distribution.install.browserHelp')}</p>
              <p>{t('distribution.install.appleHelp')}</p>
              <p>{t('distribution.install.fallback')}</p>
            </div>
          )}
        </article>
        <article>
          <RefreshCw size={20} />
          <h3>{t('distribution.update.title')}</h3>
          <p>{t(update.otherTabsOpen
            ? 'distribution.update.otherTabs'
            : update.updateAvailable
              ? 'distribution.update.ready'
              : 'distribution.update.current')}</p>
          <Button disabled={!update.supported || update.checking || update.applying} onClick={() => void update.checkForUpdate()}>
            {t(update.checking ? 'distribution.update.checking' : 'distribution.update.check')}
          </Button>
          {update.updateAvailable && (
            <Button variant="primary" disabled={update.applying} onClick={() => void update.applyUpdate()}>
              {t(update.applying ? 'distribution.update.preparing' : 'distribution.update.action')}
            </Button>
          )}
        </article>
        <article>
          <ShieldCheck size={20} />
          <h3>{t('distribution.backup.title')}</h3>
          <Field label={t('distribution.backup.interval')}>
            <select
              value={reminderDays}
              onChange={(event) => {
                const days = event.target.value === 'off'
                  ? 'off'
                  : Number(event.target.value) as BackupReminderDays
                setReminderDays(days)
                writeBackupReminderDays(days)
              }}
            >
              <option value="off">{t('distribution.backup.off')}</option>
              {[7, 14, 30].map((days) => <option key={days} value={days}>{t('distribution.backup.days', { days })}</option>)}
            </select>
          </Field>
          <p>{activeWorkspace?.lastExportedAt
            ? t('distribution.backup.lastExport', { date: formatDate(activeWorkspace.lastExportedAt) })
            : t('distribution.backup.never')}</p>
        </article>
        <article>
          <Laptop size={20} />
          <h3>{t('distribution.transfer.title')}</h3>
          <p>{t('distribution.transfer.body')}</p>
          <ol className="distribution-steps">
            <li>{t('distribution.transfer.step1')}</li>
            <li>{t('distribution.transfer.step2')}</li>
            <li>{t('distribution.transfer.step3')}</li>
          </ol>
          {onOpenBackup && <Button onClick={onOpenBackup}>{t('distribution.transfer.action')}</Button>}
        </article>
      </div>

      <dl className="build-info">
        <div><dt>{t('distribution.version.app')}</dt><dd>{buildInfo.appVersion}</dd></div>
        <div><dt>{t('distribution.version.build')}</dt><dd>{buildInfo.buildSha.slice(0, 12)}</dd></div>
        <div><dt>{t('distribution.version.date')}</dt><dd>{buildInfo.buildDate}</dd></div>
        <div><dt>{t('distribution.version.portable')}</dt><dd>{buildInfo.portableSchemaVersion}</dd></div>
        <div><dt>{t('distribution.version.database')}</dt><dd>{buildInfo.databaseSchemaVersion}</dd></div>
        <div><dt>{t('distribution.version.container')}</dt><dd>{buildInfo.encryptedContainerVersion}</dd></div>
      </dl>
    </section>
  )
}
