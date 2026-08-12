import {
  Database,
  EyeOff,
  HardDrive,
  KeyRound,
  MonitorOff,
  ShieldAlert,
} from 'lucide-react'
import { Button, Field } from '../components/ui'
import { useI18n, type MessageKey } from '../i18n'
import {
  WORKSPACE_AUTO_LOCK_OPTIONS,
  hasRetainedPlaintextSource,
  isWorkspaceAutoLock,
  type WorkspaceAutoLock,
  type WorkspaceRegistryEntry,
} from '../models/workspace-registry'

const autoLockLabelKeys: Record<WorkspaceAutoLock, MessageKey> = {
  never: 'localWorkspaces.autoLock.never',
  5: 'localWorkspaces.autoLock.5',
  15: 'localWorkspaces.autoLock.15',
  30: 'localWorkspaces.autoLock.30',
  60: 'localWorkspaces.autoLock.60',
}

export interface PrivacyCenterProps {
  workspace: WorkspaceRegistryEntry
  /** True only while this workspace has an open research session in this tab. */
  workspaceUnlocked?: boolean
  autoLock: WorkspaceAutoLock
  lastExportedAt?: string
  onAutoLockChange: (value: WorkspaceAutoLock) => void | Promise<void>
  disabled?: boolean
  autoLockDisabled?: boolean
  /** Force the stronger warning used on shared public-hosting origins. */
  sharedOriginWarning?: boolean
  onStartEncryptedCopy?: () => void
  onRetryEncryptedConversion?: () => void
  onDiscardEncryptedConversion?: () => void
  onReviewPlaintextCleanup?: (sourceId: string) => void
}

export function PrivacyCenter({
  workspace,
  workspaceUnlocked = false,
  autoLock,
  lastExportedAt = workspace.lastExportedAt,
  onAutoLockChange,
  disabled = false,
  autoLockDisabled = false,
  sharedOriginWarning,
  onStartEncryptedCopy,
  onRetryEncryptedConversion,
  onDiscardEncryptedConversion,
  onReviewPlaintextCleanup,
}: PrivacyCenterProps) {
  const { locale, t } = useI18n()
  const encrypted = workspace.encryptionMode === 'encrypted'
  const retainedPlaintext = encrypted && hasRetainedPlaintextSource(workspace)
  const retainedPlaintextSources = workspace.plaintextSources?.filter(
    (source) => source.state === 'retained' || source.state === 'cleanup-pending',
  ) ?? []
  const detectedSharedPublicOrigin =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')
  const showSharedOriginWarning = sharedOriginWarning ?? detectedSharedPublicOrigin
  const formattedLastExport = lastExportedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(lastExportedAt),
      )
    : t('localWorkspaces.privacy.neverExported')

  const changeAutoLock = (rawValue: string) => {
    const value = rawValue === 'never' ? 'never' : Number(rawValue)
    if (!isWorkspaceAutoLock(value)) return
    void Promise.resolve(onAutoLockChange(value)).catch(() => undefined)
  }

  return (
    <section className="privacy-center" aria-labelledby="privacy-center-title">
      <header className="privacy-center__header">
        <div>
          <p className="eyebrow">{t('localWorkspaces.center.tab.privacy')}</p>
          <h2 id="privacy-center-title">{t('localWorkspaces.privacy.title')}</h2>
          <p>{t('localWorkspaces.privacy.description')}</p>
        </div>
      </header>

      <dl className="privacy-facts">
        <div>
          <dt>{t('localWorkspaces.privacy.currentWorkspace')}</dt>
          <dd className="privacy-facts__workspace">{workspace.displayName}</dd>
        </div>
        <div>
          <dt>{t('localWorkspaces.privacy.storageLocation')}</dt>
          <dd>{t('localWorkspaces.privacy.storageValue')}</dd>
        </div>
        <div>
          <dt>{t('localWorkspaces.privacy.encryptionStatus')}</dt>
          <dd className={encrypted && !retainedPlaintext ? 'text-success' : 'text-warning'}>
            {t(
              retainedPlaintext
                ? 'localWorkspaces.privacy.encryptedCleanupPendingStatus'
                : encrypted
                  ? workspaceUnlocked
                    ? 'localWorkspaces.privacy.encryptedStatusUnlocked'
                    : 'localWorkspaces.privacy.encryptedStatusLocked'
                  : 'localWorkspaces.privacy.standardStatus',
            )}
          </dd>
        </div>
        <div>
          <dt>{t('localWorkspaces.privacy.lastExport')}</dt>
          <dd>{formattedLastExport}</dd>
        </div>
      </dl>

      {!encrypted && workspace.encryptedConversion ? (
        <aside className="workspace-conversion-notice workspace-conversion-notice--pending" role="alert">
          <ShieldAlert size={19} aria-hidden="true" />
          <div>
            <h3>{t('localWorkspaces.conversion.pendingTitle')}</h3>
            <p>{t('localWorkspaces.conversion.pendingBody')}</p>
            <div className="workspace-conversion-notice__actions">
              <Button
                variant="primary"
                disabled={disabled || !onRetryEncryptedConversion}
                onClick={onRetryEncryptedConversion}
              >
                {t('localWorkspaces.conversion.retryAction')}
              </Button>
              <Button
                variant="danger"
                disabled={disabled || !onDiscardEncryptedConversion}
                onClick={onDiscardEncryptedConversion}
              >
                {t('localWorkspaces.conversion.discardAction')}
              </Button>
            </div>
          </div>
        </aside>
      ) : !encrypted && (
        <aside className="workspace-conversion-notice">
          <KeyRound size={19} aria-hidden="true" />
          <div>
            <h3>{t('localWorkspaces.conversion.title')}</h3>
            <p>{t('localWorkspaces.conversion.description')}</p>
            <Button
              variant="primary"
              disabled={disabled || !onStartEncryptedCopy}
              onClick={onStartEncryptedCopy}
            >
              {t('localWorkspaces.conversion.action')}
            </Button>
          </div>
        </aside>
      )}

      {retainedPlaintext && (
        <section className="workspace-cleanup-notice" aria-labelledby="workspace-cleanup-title" role="alert">
          <ShieldAlert size={20} aria-hidden="true" />
          <div>
            <h3 id="workspace-cleanup-title">{t('localWorkspaces.cleanup.pendingTitle')}</h3>
            <p>{t('localWorkspaces.cleanup.pendingBody')}</p>
            <ul>
              {retainedPlaintextSources.map((source) => (
                <li key={source.id}>
                  <span>
                    {t(
                      source.kind === 'legacy'
                        ? 'localWorkspaces.cleanup.legacySource'
                        : 'localWorkspaces.cleanup.standardSource',
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={disabled || !onReviewPlaintextCleanup}
                    onClick={() => onReviewPlaintextCleanup?.(source.id)}
                  >
                    {t('localWorkspaces.cleanup.reviewAction')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="privacy-auto-lock">
        <Field label={t('localWorkspaces.privacy.autoLock')} hint={t('localWorkspaces.privacy.autoLockHint')}>
          <select
            value={autoLock}
            disabled={disabled || autoLockDisabled}
            aria-label={t('localWorkspaces.privacy.autoLock')}
            onChange={(event) => changeAutoLock(event.target.value)}
          >
            {WORKSPACE_AUTO_LOCK_OPTIONS.map((value) => (
              <option key={value} value={value}>{t(autoLockLabelKeys[value])}</option>
            ))}
          </select>
        </Field>
      </div>

      <section className="privacy-threat-model" aria-labelledby="privacy-threat-model-title">
        <h3 id="privacy-threat-model-title">{t('localWorkspaces.privacy.threatTitle')}</h3>
        <div className="privacy-threat-grid">
          <article>
            <span><Database size={18} /></span>
            <div>
              <h4>{t('localWorkspaces.privacy.browserTitle')}</h4>
              <p>{t('localWorkspaces.privacy.browserBody')}</p>
            </div>
          </article>
          <article>
            <span><MonitorOff size={18} /></span>
            <div>
              <h4>{t('localWorkspaces.privacy.screenTitle')}</h4>
              <p>{t('localWorkspaces.privacy.screenBody')}</p>
            </div>
          </article>
          <article>
            <span><KeyRound size={18} /></span>
            <div>
              <h4>{t('localWorkspaces.privacy.encryptionTitle')}</h4>
              <p>{t('localWorkspaces.privacy.encryptionBody')}</p>
            </div>
          </article>
          <article>
            <span><ShieldAlert size={18} /></span>
            <div>
              <h4>{t('localWorkspaces.privacy.deviceTitle')}</h4>
              <p>{t('localWorkspaces.privacy.deviceBody')}</p>
            </div>
          </article>
        </div>
      </section>

      <aside className={`shared-origin-notice ${showSharedOriginWarning ? 'shared-origin-notice--warning' : ''}`}>
        <HardDrive size={19} aria-hidden="true" />
        <div>
          <h3>{t('localWorkspaces.privacy.sharedOriginTitle')}</h3>
          <p>{t('localWorkspaces.privacy.sharedOriginBody')}</p>
          {showSharedOriginWarning && <strong>{t('localWorkspaces.privacy.sharedOriginWarning')}</strong>}
        </div>
      </aside>

      <div className="privacy-boundaries">
        <article>
          <EyeOff size={18} aria-hidden="true" />
          <div>
            <h3>{t('localWorkspaces.privacy.metadataTitle')}</h3>
            <p>{t('localWorkspaces.privacy.metadataBody')}</p>
          </div>
        </article>
        <article>
          <ShieldAlert size={18} aria-hidden="true" />
          <div>
            <h3>{t('localWorkspaces.privacy.boundaryTitle')}</h3>
            <p>{t('localWorkspaces.privacy.boundaryBody')}</p>
            <p>{t('localWorkspaces.privacy.erasureBody')}</p>
          </div>
        </article>
      </div>
    </section>
  )
}
