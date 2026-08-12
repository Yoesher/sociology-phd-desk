import { useEffect, useId, useState, type FormEvent } from 'react'
import { BookMarked, KeyRound, LockKeyhole, ShieldAlert } from 'lucide-react'
import { LanguageControl } from '../components/LanguageControl'
import { Button } from '../components/ui'
import { useI18n, type MessageKey } from '../i18n'
import {
  hasRetainedPlaintextSource,
  type WorkspaceRegistryEntry,
} from '../models/workspace-registry'
import type { WorkspaceAccessState, WorkspaceUiErrorDescriptor } from './WorkspaceAccessGate'

export interface WorkspaceLockScreenProps {
  state: Exclude<WorkspaceAccessState, 'unlocked'>
  workspace: WorkspaceRegistryEntry | null
  error?: WorkspaceUiErrorDescriptor | null
  onOpenStandard: () => void | Promise<void>
  onUnlockEncrypted: (passphrase: string) => void | Promise<void>
  onOpenWorkspacePicker: () => void
}

export function WorkspaceLockScreen({
  state,
  workspace,
  error,
  onOpenStandard,
  onUnlockEncrypted,
  onOpenWorkspacePicker,
}: WorkspaceLockScreenProps) {
  const { t } = useI18n()
  const [passphrase, setPassphrase] = useState('')
  const passphraseHintId = useId()
  const errorId = useId()

  useEffect(() => {
    setPassphrase('')
  }, [workspace?.id])

  const safeError = error
    ? t(`localWorkspaces.error.${error.code}` as MessageKey)
    : null
  const busy = state === 'unlocking' || state === 'locking' || state === 'registry-loading'

  const submitUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!passphrase || busy) return
    const attemptedPassphrase = passphrase
    void Promise.resolve(onUnlockEncrypted(attemptedPassphrase)).then(
      () => setPassphrase(''),
      () => setPassphrase(''),
    )
  }

  const openStandard = () => {
    if (busy) return
    void Promise.resolve(onOpenStandard()).catch(() => undefined)
  }

  if (state === 'registry-loading') {
    return (
      <main className="workspace-access-screen" aria-labelledby="workspace-registry-loading-title">
        <div className="workspace-access-card workspace-access-card--status" role="status" aria-live="polite">
          <span className="workspace-access-card__mark"><BookMarked size={24} /></span>
          <p className="eyebrow">{t('localWorkspaces.gate.loadingEyebrow')}</p>
          <h1 id="workspace-registry-loading-title">{t('localWorkspaces.gate.loadingTitle')}</h1>
          <p>{t('localWorkspaces.gate.loadingBody')}</p>
          <span className="workspace-access-progress" aria-hidden="true"><i /></span>
        </div>
      </main>
    )
  }

  if (state === 'picker' || !workspace) {
    return (
      <main className="workspace-access-screen" aria-labelledby="workspace-picker-title">
        <div className="workspace-access-card">
          <div className="workspace-access-card__topline">
            <span className="workspace-access-card__mark"><BookMarked size={24} /></span>
            <LanguageControl compact />
          </div>
          <p className="eyebrow">{t('localWorkspaces.gate.pickerEyebrow')}</p>
          <h1 id="workspace-picker-title">{t('localWorkspaces.gate.pickerTitle')}</h1>
          <p>{t('localWorkspaces.gate.pickerBody')}</p>
          {safeError && <p className="workspace-access-error" role="alert">{safeError}</p>}
          <Button variant="primary" onClick={onOpenWorkspacePicker} autoFocus>
            {t('localWorkspaces.gate.pickerAction')}
          </Button>
        </div>
      </main>
    )
  }

  const encrypted = workspace.encryptionMode === 'encrypted'
  const retainedPlaintext = encrypted && hasRetainedPlaintextSource(workspace)
  const transitioning = state === 'unlocking' || state === 'locking'
  const title = transitioning
    ? t(state === 'unlocking' ? 'localWorkspaces.gate.unlocking' : 'localWorkspaces.gate.locking')
    : t(encrypted ? 'localWorkspaces.lock.encryptedTitle' : 'localWorkspaces.lock.standardTitle')

  return (
    <main className="workspace-access-screen" aria-labelledby="workspace-lock-title">
      <div className="workspace-access-card">
        <div className="workspace-access-card__topline">
          <span className="workspace-access-card__mark">
            {encrypted ? <KeyRound size={23} /> : <LockKeyhole size={23} />}
          </span>
          <LanguageControl compact />
        </div>
        <p className="eyebrow">{t('localWorkspaces.lock.eyebrow')}</p>
        <h1 id="workspace-lock-title">{title}</h1>
        <div className="workspace-access-name">
          <span>{t('localWorkspaces.lock.workspaceLabel')}</span>
          <strong>{workspace.displayName}</strong>
          {workspace.kind === 'demo' && <b>{t('localWorkspaces.kind.demo')}</b>}
        </div>
        <p className={`workspace-access-mode ${encrypted ? 'workspace-access-mode--encrypted' : 'workspace-access-mode--standard'}`}>
          {t(
            retainedPlaintext
              ? 'localWorkspaces.lock.encryptedCleanupPendingMode'
              : encrypted
                ? 'localWorkspaces.lock.encryptedMode'
                : 'localWorkspaces.lock.standardMode',
          )}
        </p>
        <p>
          {t(
            retainedPlaintext
              ? 'localWorkspaces.lock.encryptedCleanupPendingBody'
              : encrypted
                ? 'localWorkspaces.lock.encryptedBody'
                : 'localWorkspaces.lock.standardBody',
          )}
        </p>

        {safeError && (
          <p id={errorId} className="workspace-access-error" role="alert">
            <ShieldAlert size={17} aria-hidden="true" />
            <span>{safeError}</span>
          </p>
        )}

        {transitioning ? (
          <div className="workspace-access-transition" role="status" aria-live="polite">
            <span className="workspace-access-progress" aria-hidden="true"><i /></span>
            <span>{title}</span>
          </div>
        ) : encrypted ? (
          <form className="workspace-unlock-form" onSubmit={submitUnlock}>
            <label htmlFor="workspace-passphrase">{t('localWorkspaces.lock.passphrase')}</label>
            <input
              id="workspace-passphrase"
              type="password"
              value={passphrase}
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={error?.code === 'unlock-failed' ? 'true' : undefined}
              aria-describedby={`${passphraseHintId}${safeError ? ` ${errorId}` : ''}`}
              onChange={(event) => setPassphrase(event.target.value)}
              autoFocus
              required
            />
            <span id={passphraseHintId} className="workspace-unlock-form__hint">
              {t('localWorkspaces.lock.passphraseHint')}
            </span>
            <p className="workspace-recovery-warning">{t('localWorkspaces.lock.noRecovery')}</p>
            <div className="workspace-access-actions">
              <Button variant="primary" type="submit" disabled={!passphrase}>
                {t('localWorkspaces.lock.unlock')}
              </Button>
              <Button type="button" onClick={onOpenWorkspacePicker}>
                {t('localWorkspaces.lock.chooseAnother')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="workspace-access-actions">
            <Button variant="primary" onClick={openStandard} autoFocus>
              {t('localWorkspaces.lock.reopen')}
            </Button>
            <Button onClick={onOpenWorkspacePicker}>
              {t('localWorkspaces.lock.chooseAnother')}
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
