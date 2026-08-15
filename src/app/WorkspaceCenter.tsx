import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  ArchiveRestore,
  Download,
  FileJson,
  FolderKey,
  FolderOpen,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { LanguageControl } from '../components/LanguageControl'
import { Badge, Button, Field, Modal } from '../components/ui'
import { useI18n, type MessageKey } from '../i18n'
import {
  WORKSPACE_ENCRYPTION_MODES,
  hasRetainedPlaintextSource,
  type WorkspaceAutoLock,
  type WorkspaceEncryptionMode,
  type WorkspaceRegistryEntry,
} from '../models/workspace-registry'
import { PrivacyCenter } from './PrivacyCenter'
import { DistributionCenter } from './DistributionCenter'
import type {
  WorkspaceUiErrorDescriptor,
} from './WorkspaceAccessGate'
import type { WorkspaceImportPreflight } from '../utils/import-preflight'
import { ImportPreflightSummary } from './ImportPreflightSummary'
import type { WorkspaceData } from '../models/domain'

export type WorkspaceCenterSection = 'workspaces' | 'privacy' | 'backup' | 'distribution'

export interface WorkspaceCreateRequest {
  displayName: string
  encryptionMode: WorkspaceEncryptionMode
  autoLock: WorkspaceAutoLock
  passphrase?: string
  recoveryBoundaryAcknowledged: boolean
}

export interface WorkspaceEncryptedImportRequest {
  file: File
  backupPassphrase: string
  newWorkspacePassphrase: string
  recoveryBoundaryAcknowledged: true
}

export interface WorkspaceCenterProps {
  open: boolean
  workspaces: readonly WorkspaceRegistryEntry[]
  recoverableProvisioning?: readonly WorkspaceRegistryEntry[]
  pendingDeletions?: readonly WorkspaceRegistryEntry[]
  activeWorkspaceId?: string
  activeWorkspaceUnlocked?: boolean
  initialSection?: WorkspaceCenterSection
  busy?: boolean
  error?: WorkspaceUiErrorDescriptor | null
  encryptedContainerVersion?: number
  sharedOriginWarning?: boolean
  onClose: () => void
  onSelect: (workspaceId: string) => void | Promise<void>
  onCreate: (request: WorkspaceCreateRequest) => void | Promise<void>
  onRecoverProvisioning?: (workspaceId: string, passphrase?: string) => void | Promise<void>
  onDiscardProvisioning?: (workspaceId: string, passphrase?: string) => void | Promise<void>
  onRetryFinalizeDeletion?: (workspaceId: string) => void | Promise<void>
  onRename: (workspaceId: string, displayName: string) => void | Promise<void>
  onDelete: (workspaceId: string) => void | Promise<void>
  onResetDemo: (workspaceId: string) => void | Promise<void>
  onAutoLockChange?: (workspaceId: string, value: WorkspaceAutoLock) => void | Promise<void>
  onConvertToEncrypted?: (workspaceId: string, passphrase: string) => void | Promise<void>
  onDiscardEncryptedConversion?: (workspaceId: string, passphrase?: string) => void | Promise<void>
  onCleanupPlaintextSource?: (workspaceId: string, sourceId: string) => void | Promise<void>
  onExportPlaintext?: (workspaceId: string) => void | Promise<void>
  onExportEncrypted?: (workspaceId: string, passphrase: string) => void | Promise<void>
  /** The parent validates the JSON and creates a new isolated workspace. */
  onImportPlaintext?: (file: File) => void | Promise<void>
  onPreflightPlaintext?: (file: File) => Promise<WorkspaceImportPreflight>
  /** The parent validates/decrypts the container and creates a new isolated workspace. */
  onImportEncrypted?: (request: WorkspaceEncryptedImportRequest) => void | Promise<void>
  onPreflightEncrypted?: (file: File, passphrase: string) => Promise<WorkspaceImportPreflight>
  onPrepareDiagnostics?: () => Promise<WorkspaceData>
}

interface CreateDraft {
  displayName: string
  encryptionMode: WorkspaceEncryptionMode
  passphrase: string
  confirmPassphrase: string
  recoveryBoundaryAcknowledged: boolean
}

interface PassphrasePairDraft {
  passphrase: string
  confirmPassphrase: string
}

interface EncryptedImportDraft {
  file: File | null
  backupPassphrase: string
  newWorkspacePassphrase: string
  confirmNewWorkspacePassphrase: string
  recoveryBoundaryAcknowledged: boolean
}

interface PlaintextCleanupTarget {
  workspace: WorkspaceRegistryEntry
  sourceId: string
}

interface ProvisioningActionTarget {
  workspace: WorkspaceRegistryEntry
  action: 'recover' | 'discard'
}

const emptyCreateDraft = (): CreateDraft => ({
  displayName: '',
  encryptionMode: 'standard',
  passphrase: '',
  confirmPassphrase: '',
  recoveryBoundaryAcknowledged: false,
})

const emptyPassphrasePair = (): PassphrasePairDraft => ({
  passphrase: '',
  confirmPassphrase: '',
})

const emptyEncryptedImportDraft = (): EncryptedImportDraft => ({
  file: null,
  backupPassphrase: '',
  newWorkspacePassphrase: '',
  confirmNewWorkspacePassphrase: '',
  recoveryBoundaryAcknowledged: false,
})

const sectionLabelKeys: Record<WorkspaceCenterSection, MessageKey> = {
  workspaces: 'localWorkspaces.center.tab.workspaces',
  privacy: 'localWorkspaces.center.tab.privacy',
  backup: 'localWorkspaces.center.tab.backup',
  distribution: 'distribution.center.tab',
}
const workspaceCenterSections = Object.keys(sectionLabelKeys) as WorkspaceCenterSection[]

function unicodeCodePointLength(value: string) {
  return Array.from(value).length
}

function normalizePassphrase(value: string) {
  return value.normalize('NFC')
}

function passphraseLengthIsValid(value: string) {
  const length = unicodeCodePointLength(normalizePassphrase(value))
  return length >= 15 && length <= 1024
}

export function WorkspaceCenter({
  open,
  workspaces,
  recoverableProvisioning = [],
  pendingDeletions = [],
  activeWorkspaceId,
  activeWorkspaceUnlocked = false,
  initialSection = 'workspaces',
  busy = false,
  error,
  encryptedContainerVersion = 1,
  sharedOriginWarning,
  onClose,
  onSelect,
  onCreate,
  onRecoverProvisioning,
  onDiscardProvisioning,
  onRetryFinalizeDeletion,
  onRename,
  onDelete,
  onResetDemo,
  onAutoLockChange,
  onConvertToEncrypted,
  onDiscardEncryptedConversion,
  onCleanupPlaintextSource,
  onExportPlaintext,
  onExportEncrypted,
  onImportPlaintext,
  onImportEncrypted,
  onPreflightPlaintext,
  onPreflightEncrypted,
  onPrepareDiagnostics,
}: WorkspaceCenterProps) {
  const { t } = useI18n()
  const [section, setSection] = useState<WorkspaceCenterSection>(initialSection)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreateDraft>(emptyCreateDraft)
  const [createAttempted, setCreateAttempted] = useState(false)
  const [renameTarget, setRenameTarget] = useState<WorkspaceRegistryEntry | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceRegistryEntry | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleteAttempted, setDeleteAttempted] = useState(false)
  const [demoResetTarget, setDemoResetTarget] = useState<WorkspaceRegistryEntry | null>(null)
  const [plaintextConfirmOpen, setPlaintextConfirmOpen] = useState(false)
  const [conversionOpen, setConversionOpen] = useState(false)
  const [conversionRetrying, setConversionRetrying] = useState(false)
  const [discardConversionOpen, setDiscardConversionOpen] = useState(false)
  const [discardConversionPassphrase, setDiscardConversionPassphrase] = useState('')
  const [discardConversionAttempted, setDiscardConversionAttempted] = useState(false)
  const [conversionDraft, setConversionDraft] = useState<PassphrasePairDraft>(emptyPassphrasePair)
  const [conversionAcknowledged, setConversionAcknowledged] = useState(false)
  const [conversionAttempted, setConversionAttempted] = useState(false)
  const [cleanupTarget, setCleanupTarget] = useState<PlaintextCleanupTarget | null>(null)
  const [cleanupName, setCleanupName] = useState('')
  const [cleanupBackupAcknowledged, setCleanupBackupAcknowledged] = useState(false)
  const [encryptedExportOpen, setEncryptedExportOpen] = useState(false)
  const [encryptedExportDraft, setEncryptedExportDraft] = useState<PassphrasePairDraft>(emptyPassphrasePair)
  const [encryptedExportAttempted, setEncryptedExportAttempted] = useState(false)
  const [plaintextImportOpen, setPlaintextImportOpen] = useState(false)
  const [plaintextImportFile, setPlaintextImportFile] = useState<File | null>(null)
  const [plaintextImportAttempted, setPlaintextImportAttempted] = useState(false)
  const [plaintextImportPreflight, setPlaintextImportPreflight] = useState<WorkspaceImportPreflight | null>(null)
  const [encryptedImportOpen, setEncryptedImportOpen] = useState(false)
  const [encryptedImportDraft, setEncryptedImportDraft] = useState<EncryptedImportDraft>(emptyEncryptedImportDraft)
  const [encryptedImportAttempted, setEncryptedImportAttempted] = useState(false)
  const [encryptedImportPreflight, setEncryptedImportPreflight] = useState<WorkspaceImportPreflight | null>(null)
  const [provisioningTarget, setProvisioningTarget] =
    useState<ProvisioningActionTarget | null>(null)
  const [provisioningPassphrase, setProvisioningPassphrase] = useState('')
  const [provisioningName, setProvisioningName] = useState('')
  const [provisioningAttempted, setProvisioningAttempted] = useState(false)
  const tabBaseId = useId()
  const tabRefs = useRef<Record<WorkspaceCenterSection, HTMLButtonElement | null>>({
    workspaces: null,
    privacy: null,
    backup: null,
    distribution: null,
  })

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null
  const personalWorkspaces = workspaces.filter((workspace) => workspace.kind === 'personal')
  const demoWorkspaces = workspaces.filter((workspace) => workspace.kind === 'demo')
  const safeError = error
    ? t(`localWorkspaces.error.${error.code}` as MessageKey)
    : null
  const encryptedDraft = createDraft.encryptionMode === 'encrypted'
  const normalizedCreatePassphrase = normalizePassphrase(createDraft.passphrase)
  const normalizedCreateConfirmation = normalizePassphrase(createDraft.confirmPassphrase)
  const passphraseLengthValid = passphraseLengthIsValid(createDraft.passphrase)
  const passphrasesMatch = normalizedCreatePassphrase === normalizedCreateConfirmation
  const deleteMatches = Boolean(deleteTarget && deleteName === deleteTarget.displayName)
  const normalizedConversionPassphrase = normalizePassphrase(conversionDraft.passphrase)
  const conversionLengthValid = passphraseLengthIsValid(conversionDraft.passphrase)
  const conversionMatches = normalizedConversionPassphrase === normalizePassphrase(conversionDraft.confirmPassphrase)
  const normalizedDiscardConversionPassphrase = normalizePassphrase(discardConversionPassphrase)
  const discardConversionPassphraseValid = !discardConversionPassphrase ||
    passphraseLengthIsValid(discardConversionPassphrase)
  const cleanupMatches = Boolean(cleanupTarget && cleanupName === cleanupTarget.workspace.displayName)
  const normalizedExportPassphrase = normalizePassphrase(encryptedExportDraft.passphrase)
  const encryptedExportLengthValid = passphraseLengthIsValid(encryptedExportDraft.passphrase)
  const encryptedExportMatches = normalizedExportPassphrase === normalizePassphrase(encryptedExportDraft.confirmPassphrase)
  const normalizedBackupPassphrase = normalizePassphrase(encryptedImportDraft.backupPassphrase)
  const normalizedNewWorkspacePassphrase = normalizePassphrase(encryptedImportDraft.newWorkspacePassphrase)
  const encryptedImportBackupLengthValid = passphraseLengthIsValid(encryptedImportDraft.backupPassphrase)
  const encryptedImportNewLengthValid = passphraseLengthIsValid(encryptedImportDraft.newWorkspacePassphrase)
  const encryptedImportMatches = normalizedNewWorkspacePassphrase === normalizePassphrase(
    encryptedImportDraft.confirmNewWorkspacePassphrase,
  )

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateDraft(emptyCreateDraft())
    setCreateAttempted(false)
  }

  const closeConversion = () => {
    setConversionOpen(false)
    setConversionRetrying(false)
    setConversionDraft(emptyPassphrasePair())
    setConversionAcknowledged(false)
    setConversionAttempted(false)
  }

  const closeDiscardConversion = () => {
    setDiscardConversionOpen(false)
    setDiscardConversionPassphrase('')
    setDiscardConversionAttempted(false)
  }

  const closeCleanup = () => {
    setCleanupTarget(null)
    setCleanupName('')
    setCleanupBackupAcknowledged(false)
  }

  const closeEncryptedExport = () => {
    setEncryptedExportOpen(false)
    setEncryptedExportDraft(emptyPassphrasePair())
    setEncryptedExportAttempted(false)
  }

  const closePlaintextImport = () => {
    setPlaintextImportOpen(false)
    setPlaintextImportFile(null)
    setPlaintextImportAttempted(false)
    setPlaintextImportPreflight(null)
  }

  const closeEncryptedImport = () => {
    setEncryptedImportOpen(false)
    setEncryptedImportDraft(emptyEncryptedImportDraft())
    setEncryptedImportAttempted(false)
    setEncryptedImportPreflight(null)
  }

  const closeProvisioningAction = () => {
    setProvisioningTarget(null)
    setProvisioningPassphrase('')
    setProvisioningName('')
    setProvisioningAttempted(false)
  }

  const closeWorkspaceCenter = () => {
    closeCreate()
    closeConversion()
    closeDiscardConversion()
    closeCleanup()
    closeEncryptedExport()
    closePlaintextImport()
    closeEncryptedImport()
    closeProvisioningAction()
    setPlaintextConfirmOpen(false)
    onClose()
  }

  useEffect(() => {
    if (open) {
      setSection(initialSection)
      return
    }

    setCreateOpen(false)
    setCreateDraft(emptyCreateDraft())
    setCreateAttempted(false)
    setConversionOpen(false)
    setConversionRetrying(false)
    setDiscardConversionOpen(false)
    setDiscardConversionPassphrase('')
    setDiscardConversionAttempted(false)
    setConversionDraft(emptyPassphrasePair())
    setConversionAcknowledged(false)
    setConversionAttempted(false)
    setCleanupTarget(null)
    setCleanupName('')
    setCleanupBackupAcknowledged(false)
    setEncryptedExportOpen(false)
    setEncryptedExportDraft(emptyPassphrasePair())
    setEncryptedExportAttempted(false)
    setPlaintextImportOpen(false)
    setPlaintextImportFile(null)
    setPlaintextImportAttempted(false)
    setEncryptedImportOpen(false)
    setEncryptedImportDraft(emptyEncryptedImportDraft())
    setEncryptedImportAttempted(false)
    setProvisioningTarget(null)
    setProvisioningPassphrase('')
    setProvisioningName('')
    setProvisioningAttempted(false)
  }, [initialSection, open])

  useEffect(() => {
    if (!activeWorkspace && section !== 'workspaces') setSection('workspaces')
  }, [activeWorkspace, section])

  useEffect(() => {
    setRenameName(renameTarget?.displayName ?? '')
  }, [renameTarget?.displayName])

  useEffect(() => {
    setDeleteName('')
    setDeleteAttempted(false)
  }, [deleteTarget?.id])

  const selectWorkspace = (workspaceId: string) => {
    void Promise.resolve(onSelect(workspaceId)).then(closeWorkspaceCenter).catch(() => undefined)
  }

  const moveWorkspaceTab = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentSection: WorkspaceCenterSection,
  ) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const availableSections = workspaceCenterSections.filter(
      (item) => item === 'workspaces' || Boolean(activeWorkspace),
    )
    const currentIndex = availableSections.indexOf(currentSection)
    const nextSection = event.key === 'Home'
      ? availableSections[0]
      : event.key === 'End'
        ? availableSections.at(-1)
        : availableSections[
            (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + availableSections.length) %
              availableSections.length
          ]
    if (!nextSection) return
    setSection(nextSection)
    tabRefs.current[nextSection]?.focus()
  }

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateAttempted(true)
    const displayName = createDraft.displayName.trim()
    if (!displayName) return
    if (
      encryptedDraft &&
      (!passphraseLengthValid || !passphrasesMatch || !createDraft.recoveryBoundaryAcknowledged)
    ) return

    const request: WorkspaceCreateRequest = {
      displayName,
      encryptionMode: createDraft.encryptionMode,
      autoLock: encryptedDraft ? 15 : 'never',
      recoveryBoundaryAcknowledged: encryptedDraft,
      ...(encryptedDraft ? { passphrase: normalizedCreatePassphrase } : {}),
    }
    void Promise.resolve(onCreate(request)).then(closeCreate).catch(() => undefined)
  }

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const displayName = renameName.trim()
    if (!renameTarget || !displayName) return
    void Promise.resolve(onRename(renameTarget.id, displayName)).then(() => {
      setRenameTarget(null)
    }).catch(() => undefined)
  }

  const submitDelete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDeleteAttempted(true)
    if (!deleteTarget || !deleteMatches) return
    void Promise.resolve(onDelete(deleteTarget.id)).then(() => {
      setDeleteTarget(null)
    }).catch(() => undefined)
  }

  const confirmDemoReset = () => {
    if (!demoResetTarget || demoResetTarget.kind !== 'demo') return
    void Promise.resolve(onResetDemo(demoResetTarget.id)).then(() => {
      setDemoResetTarget(null)
    }).catch(() => undefined)
  }

  const exportPlaintext = () => {
    if (!activeWorkspace || !onExportPlaintext) return
    void Promise.resolve(onExportPlaintext(activeWorkspace.id)).then(() => {
      setPlaintextConfirmOpen(false)
    }).catch(() => undefined)
  }

  const submitConversion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setConversionAttempted(true)
    if (
      !activeWorkspace ||
      activeWorkspace.encryptionMode !== 'standard' ||
      !onConvertToEncrypted ||
      !conversionLengthValid ||
      !conversionMatches ||
      !conversionAcknowledged
    ) return

    void Promise.resolve(onConvertToEncrypted(activeWorkspace.id, normalizedConversionPassphrase))
      .then(closeConversion)
      .catch(() => undefined)
  }

  const submitDiscardConversion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDiscardConversionAttempted(true)
    if (
      !activeWorkspace ||
      activeWorkspace.encryptionMode !== 'standard' ||
      !activeWorkspace.encryptedConversion ||
      !onDiscardEncryptedConversion ||
      !discardConversionPassphraseValid
    ) return
    void Promise.resolve(onDiscardEncryptedConversion(
      activeWorkspace.id,
      normalizedDiscardConversionPassphrase || undefined,
    ))
      .then(closeDiscardConversion)
      .catch(() => {
        setDiscardConversionPassphrase('')
      })
  }

  const submitCleanup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!cleanupTarget || !onCleanupPlaintextSource || !cleanupMatches || !cleanupBackupAcknowledged) return
    const sourceStillPending = cleanupTarget.workspace.plaintextSources?.some(
      (source) => source.id === cleanupTarget.sourceId &&
        (source.state === 'retained' || source.state === 'cleanup-pending'),
    )
    if (!sourceStillPending) return

    void Promise.resolve(
      onCleanupPlaintextSource(cleanupTarget.workspace.id, cleanupTarget.sourceId),
    ).then(closeCleanup).catch(() => undefined)
  }

  const submitEncryptedExport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEncryptedExportAttempted(true)
    if (
      !activeWorkspace ||
      activeWorkspace.encryptionMode !== 'encrypted' ||
      !onExportEncrypted ||
      !encryptedExportLengthValid ||
      !encryptedExportMatches
    ) return

    void Promise.resolve(onExportEncrypted(activeWorkspace.id, normalizedExportPassphrase))
      .then(closeEncryptedExport)
      .catch(() => undefined)
  }

  const submitPlaintextImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPlaintextImportAttempted(true)
    if (!plaintextImportFile || !onImportPlaintext) return
    if (!plaintextImportPreflight) {
      if (!onPreflightPlaintext) return
      void onPreflightPlaintext(plaintextImportFile)
        .then(setPlaintextImportPreflight)
        .catch(() => undefined)
      return
    }
    void Promise.resolve(onImportPlaintext(plaintextImportFile))
      .then(closePlaintextImport)
      .catch(() => undefined)
  }

  const submitEncryptedImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEncryptedImportAttempted(true)
    if (
      !encryptedImportDraft.file ||
      !onImportEncrypted ||
      !encryptedImportBackupLengthValid ||
      !encryptedImportNewLengthValid ||
      !encryptedImportMatches ||
      !encryptedImportDraft.recoveryBoundaryAcknowledged
    ) return

    if (!encryptedImportPreflight) {
      if (!onPreflightEncrypted) return
      void onPreflightEncrypted(
        encryptedImportDraft.file,
        normalizedBackupPassphrase,
      ).then(setEncryptedImportPreflight).catch(() => {
        setEncryptedImportDraft((current) => ({
          ...current,
          backupPassphrase: '',
          newWorkspacePassphrase: '',
          confirmNewWorkspacePassphrase: '',
        }))
      })
      return
    }

    const request: WorkspaceEncryptedImportRequest = {
      file: encryptedImportDraft.file,
      backupPassphrase: normalizedBackupPassphrase,
      newWorkspacePassphrase: normalizedNewWorkspacePassphrase,
      recoveryBoundaryAcknowledged: true,
    }
    void Promise.resolve(onImportEncrypted(request)).then(closeEncryptedImport).catch(() => undefined)
  }

  const submitProvisioningAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProvisioningAttempted(true)
    if (!provisioningTarget) return
    const encrypted = provisioningTarget.workspace.encryptionMode === 'encrypted'
    const normalizedPassphrase = normalizePassphrase(provisioningPassphrase)
    if (encrypted && !normalizedPassphrase) return
    if (
      provisioningTarget.action === 'discard' &&
      provisioningName !== provisioningTarget.workspace.displayName
    ) return
    const action = provisioningTarget.action === 'recover'
      ? onRecoverProvisioning
      : onDiscardProvisioning
    if (!action) return
    void Promise.resolve(action(
      provisioningTarget.workspace.id,
      encrypted ? normalizedPassphrase : undefined,
    )).then(closeProvisioningAction).catch(() => undefined)
  }

  const renderWorkspaceGroup = (
    titleKey: MessageKey,
    bodyKey: MessageKey,
    records: readonly WorkspaceRegistryEntry[],
    emptyKey?: MessageKey,
  ) => (
    <section className="workspace-group">
      <header>
        <div>
          <h3>{t(titleKey)}</h3>
          <p>{t(bodyKey)}</p>
        </div>
      </header>
      {records.length === 0 && emptyKey ? (
        <p className="workspace-group__empty">{t(emptyKey)}</p>
      ) : (
        <ul className="workspace-list">
          {records.map((workspace) => {
            const current = workspace.id === activeWorkspaceId
            const encrypted = workspace.encryptionMode === 'encrypted'
            const retainedPlaintext = encrypted && hasRetainedPlaintextSource(workspace)
            return (
              <li key={workspace.id} className={`workspace-list__row ${current ? 'workspace-list__row--current' : ''}`}>
                <button
                  type="button"
                  className="workspace-list__open"
                  aria-current={current ? 'true' : undefined}
                  aria-label={t('localWorkspaces.center.open', { name: workspace.displayName })}
                  disabled={busy || current}
                  onClick={() => selectWorkspace(workspace.id)}
                >
                  <span className="workspace-list__icon">
                    {encrypted ? <FolderKey size={19} /> : <FolderOpen size={19} />}
                  </span>
                  <span className="workspace-list__identity">
                    <strong>{workspace.displayName}</strong>
                    <span>
                      {t(
                        retainedPlaintext
                          ? 'localWorkspaces.mode.encryptedCleanupPendingShort'
                          : encrypted
                            ? 'localWorkspaces.mode.encryptedShort'
                            : 'localWorkspaces.mode.standardShort',
                      )}
                    </span>
                  </span>
                </button>
                <div className="workspace-list__badges">
                  {current && <Badge tone="success">{t('localWorkspaces.center.current')}</Badge>}
                  {workspace.kind === 'demo' && <Badge tone="warning">{t('localWorkspaces.kind.demo')}</Badge>}
                  {workspace.encryptedConversion && (
                    <Badge tone="warning">{t('localWorkspaces.conversion.pendingBadge')}</Badge>
                  )}
                </div>
                <div className="workspace-list__actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Pencil size={14} />}
                    aria-label={t('localWorkspaces.center.rename', { name: workspace.displayName })}
                    disabled={busy}
                    onClick={() => setRenameTarget(workspace)}
                  >
                    {t('common.edit')}
                  </Button>
                  {workspace.kind === 'demo' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<RotateCcw size={14} />}
                      aria-label={t('localWorkspaces.center.resetDemo', { name: workspace.displayName })}
                      disabled={busy || !current || !activeWorkspaceUnlocked}
                      onClick={() => setDemoResetTarget(workspace)}
                    >
                      {t('localWorkspaces.demoReset.submit')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    icon={<Trash2 size={14} />}
                    aria-label={t('localWorkspaces.center.delete', { name: workspace.displayName })}
                    disabled={busy}
                    onClick={() => setDeleteTarget(workspace)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
                {workspace.encryptedConversion && (
                  <p className="workspace-list__notice" role="status">
                    <ShieldAlert size={15} aria-hidden="true" />
                    {t('localWorkspaces.conversion.pendingBody')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  return (
    <>
      <Modal
        open={open}
        title={t('localWorkspaces.center.title')}
        description={t('localWorkspaces.center.description')}
        onClose={closeWorkspaceCenter}
        size="xl"
      >
        <div className="workspace-center">
          <div className="workspace-center__language">
            <LanguageControl compact />
          </div>
          <div className="workspace-center__tabs" role="tablist" aria-label={t('localWorkspaces.center.tabsLabel')}>
            {workspaceCenterSections.map((item) => {
              const unavailable = (item === 'privacy' || item === 'backup') && !activeWorkspace
              return (
                <button
                  key={item}
                  ref={(node) => {
                    tabRefs.current[item] = node
                  }}
                  id={`${tabBaseId}-${item}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={section === item}
                  aria-controls={`${tabBaseId}-${item}-panel`}
                  tabIndex={section === item ? 0 : -1}
                  disabled={unavailable}
                  onClick={() => setSection(item)}
                  onKeyDown={(event) => moveWorkspaceTab(event, item)}
                >
                  {t(sectionLabelKeys[item])}
                </button>
              )
            })}
          </div>

          {safeError && <p className="workspace-center__error" role="alert">{safeError}</p>}

          <div
            id={`${tabBaseId}-${section}-panel`}
            role="tabpanel"
            aria-labelledby={`${tabBaseId}-${section}-tab`}
            className="workspace-center__panel"
          >
            {section === 'workspaces' && (
              <div className="workspace-center__registry">
                <div className="workspace-center__registry-actions">
                  <Button
                    variant="primary"
                    icon={<Plus size={15} />}
                    disabled={busy}
                    onClick={() => {
                      setCreateDraft(emptyCreateDraft())
                      setCreateAttempted(false)
                      setCreateOpen(true)
                    }}
                  >
                    {t('localWorkspaces.center.create')}
                  </Button>
                </div>
                {recoverableProvisioning.length > 0 && (
                  <section className="workspace-provisioning" aria-labelledby="workspace-provisioning-title">
                    <header>
                      <div>
                        <h3 id="workspace-provisioning-title">{t('localWorkspaces.provisioning.title')}</h3>
                        <p>{t('localWorkspaces.provisioning.description')}</p>
                      </div>
                      <Badge tone="warning">{t('localWorkspaces.provisioning.badge')}</Badge>
                    </header>
                    <ul className="workspace-provisioning__list">
                      {recoverableProvisioning.map((workspace) => (
                        <li key={workspace.id}>
                          <div className="workspace-provisioning__identity">
                            {workspace.encryptionMode === 'encrypted'
                              ? <FolderKey size={18} aria-hidden="true" />
                              : <FolderOpen size={18} aria-hidden="true" />}
                            <span>
                              <strong>{workspace.displayName}</strong>
                              <small>{t(
                                workspace.encryptionMode === 'encrypted'
                                  ? 'localWorkspaces.mode.encryptedShort'
                                  : 'localWorkspaces.mode.standardShort',
                              )}</small>
                            </span>
                          </div>
                          <div className="workspace-provisioning__actions">
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<ArchiveRestore size={14} />}
                              disabled={busy || !onRecoverProvisioning}
                              onClick={() => {
                                setProvisioningPassphrase('')
                                setProvisioningName('')
                                setProvisioningAttempted(false)
                                setProvisioningTarget({ workspace, action: 'recover' })
                              }}
                            >
                              {t('localWorkspaces.provisioning.recover')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger"
                              icon={<Trash2 size={14} />}
                              disabled={busy || !onDiscardProvisioning}
                              onClick={() => {
                                setProvisioningPassphrase('')
                                setProvisioningName('')
                                setProvisioningAttempted(false)
                                setProvisioningTarget({ workspace, action: 'discard' })
                              }}
                            >
                              {t('localWorkspaces.provisioning.discard')}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {pendingDeletions.length > 0 && (
                  <section className="workspace-provisioning" aria-labelledby="workspace-deletions-title">
                    <header>
                      <div>
                        <h3 id="workspace-deletions-title">{t('localWorkspaces.pendingDeletion.title')}</h3>
                        <p>{t('localWorkspaces.pendingDeletion.description')}</p>
                      </div>
                      <Badge tone="warning">{t('localWorkspaces.pendingDeletion.badge')}</Badge>
                    </header>
                    <ul className="workspace-provisioning__list">
                      {pendingDeletions.map((workspace) => (
                        <li key={workspace.id}>
                          <div className="workspace-provisioning__identity">
                            <ShieldAlert size={18} aria-hidden="true" />
                            <span>
                              <strong>{workspace.displayName}</strong>
                              <small>{t('localWorkspaces.pendingDeletion.stateUnknown')}</small>
                            </span>
                          </div>
                          <div className="workspace-provisioning__actions">
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<RotateCcw size={14} />}
                              disabled={busy || !onRetryFinalizeDeletion}
                              onClick={() => {
                                void Promise.resolve(onRetryFinalizeDeletion?.(workspace.id))
                                  .catch(() => undefined)
                              }}
                            >
                              {t('localWorkspaces.pendingDeletion.retry')}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {renderWorkspaceGroup(
                  'localWorkspaces.center.personalTitle',
                  'localWorkspaces.center.personalBody',
                  personalWorkspaces,
                  'localWorkspaces.center.emptyPersonal',
                )}
                {renderWorkspaceGroup(
                  'localWorkspaces.center.demoTitle',
                  'localWorkspaces.center.demoBody',
                  demoWorkspaces,
                )}
              </div>
            )}

            {section === 'privacy' && activeWorkspace && (
              <PrivacyCenter
                workspace={activeWorkspace}
                workspaceUnlocked={activeWorkspaceUnlocked}
                autoLock={activeWorkspace.autoLock}
                disabled={busy}
                autoLockDisabled={!onAutoLockChange}
                sharedOriginWarning={sharedOriginWarning}
                onAutoLockChange={(value) => onAutoLockChange?.(activeWorkspace.id, value)}
                onStartEncryptedCopy={onConvertToEncrypted ? () => {
                  setConversionRetrying(false)
                  setConversionDraft(emptyPassphrasePair())
                  setConversionAcknowledged(false)
                  setConversionAttempted(false)
                  setConversionOpen(true)
                } : undefined}
                onRetryEncryptedConversion={
                  activeWorkspace.encryptedConversion && onConvertToEncrypted
                    ? () => {
                        setConversionRetrying(true)
                        setConversionDraft(emptyPassphrasePair())
                        setConversionAcknowledged(false)
                        setConversionAttempted(false)
                        setConversionOpen(true)
                      }
                    : undefined
                }
                onDiscardEncryptedConversion={
                  activeWorkspace.encryptedConversion && onDiscardEncryptedConversion
                    ? () => {
                        setDiscardConversionPassphrase('')
                        setDiscardConversionAttempted(false)
                        setDiscardConversionOpen(true)
                      }
                    : undefined
                }
                onReviewPlaintextCleanup={onCleanupPlaintextSource ? (sourceId) => {
                  setCleanupName('')
                  setCleanupBackupAcknowledged(false)
                  setCleanupTarget({ workspace: activeWorkspace, sourceId })
                } : undefined}
              />
            )}

            {section === 'backup' && activeWorkspace && (
              <section className="workspace-backup" aria-labelledby="workspace-backup-title">
                <header>
                  <p className="eyebrow">{t('localWorkspaces.center.tab.backup')}</p>
                  <h2 id="workspace-backup-title">{t('localWorkspaces.backup.title')}</h2>
                  <p>{t('localWorkspaces.backup.description')}</p>
                </header>
                {activeWorkspace.encryptionMode === 'encrypted' && (
                  <p className="workspace-backup__preferred" role="status">
                    <ShieldCheck size={16} />
                    {t('localWorkspaces.backup.preferredEncrypted')}
                  </p>
                )}
                <div className="workspace-backup__formats">
                  <article className="workspace-backup-card workspace-backup-card--plaintext">
                    <span className="workspace-backup-card__icon"><FileJson size={20} /></span>
                    <div>
                      <h3>{t('localWorkspaces.backup.plaintextTitle')}</h3>
                      <p>{t('localWorkspaces.backup.plaintextBody')}</p>
                      <small>{t('localWorkspaces.backup.workspaceVersion', { version: activeWorkspace.schemaVersion })}</small>
                    </div>
                    <Button
                      icon={<Download size={15} />}
                      disabled={!onExportPlaintext || busy}
                      onClick={() => setPlaintextConfirmOpen(true)}
                    >
                      {t('localWorkspaces.backup.exportPlaintext')}
                    </Button>
                  </article>
                  <article className="workspace-backup-card workspace-backup-card--encrypted">
                    <span className="workspace-backup-card__icon"><KeyRound size={20} /></span>
                    <div>
                      <h3>{t('localWorkspaces.backup.encryptedTitle')}</h3>
                      <p>{t('localWorkspaces.backup.encryptedBody')}</p>
                      <small>{t('localWorkspaces.backup.containerVersion', { version: encryptedContainerVersion })}</small>
                    </div>
                    <Button
                      variant={activeWorkspace.encryptionMode === 'encrypted' ? 'primary' : 'secondary'}
                      icon={<ArchiveRestore size={15} />}
                      disabled={activeWorkspace.encryptionMode !== 'encrypted' || !onExportEncrypted || busy}
                      onClick={() => {
                        setEncryptedExportDraft(emptyPassphrasePair())
                        setEncryptedExportAttempted(false)
                        setEncryptedExportOpen(true)
                      }}
                    >
                      {t('localWorkspaces.backup.exportEncrypted')}
                    </Button>
                  </article>
                </div>
                <div className="workspace-backup__import" aria-label={t('localWorkspaces.center.tab.backup')}>
                  <Button
                    icon={<Upload size={15} />}
                    disabled={!onImportPlaintext || busy}
                    onClick={() => {
                      setPlaintextImportFile(null)
                      setPlaintextImportAttempted(false)
                      setPlaintextImportOpen(true)
                    }}
                  >
                    {t('localWorkspaces.backup.importPlaintext')}
                  </Button>
                  <Button
                    icon={<Upload size={15} />}
                    disabled={!onImportEncrypted || busy}
                    onClick={() => {
                      setEncryptedImportDraft(emptyEncryptedImportDraft())
                      setEncryptedImportAttempted(false)
                      setEncryptedImportOpen(true)
                    }}
                  >
                    {t('localWorkspaces.backup.importEncrypted')}
                  </Button>
                </div>
              </section>
            )}
            {section === 'distribution' && (
              <DistributionCenter
                activeWorkspace={activeWorkspace}
                onOpenBackup={() => setSection('backup')}
                onPrepareDiagnostics={onPrepareDiagnostics}
              />
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        title={t('localWorkspaces.create.title')}
        description={t('localWorkspaces.create.description')}
        onClose={closeCreate}
        size="md"
        footer={
          <>
            <Button onClick={closeCreate}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="workspace-create-form" disabled={busy}>
              {t('localWorkspaces.create.submit')}
            </Button>
          </>
        }
      >
        <form id="workspace-create-form" className="workspace-create-form" onSubmit={submitCreate}>
          <Field label={t('localWorkspaces.create.name')} required>
            <input
              value={createDraft.displayName}
              aria-label={t('localWorkspaces.create.name')}
              onChange={(event) => setCreateDraft({ ...createDraft, displayName: event.target.value })}
              placeholder={t('localWorkspaces.create.namePlaceholder')}
              maxLength={200}
              autoFocus
              required
            />
          </Field>
          <fieldset className="workspace-mode-options">
            <legend>{t('localWorkspaces.create.mode')}</legend>
            {WORKSPACE_ENCRYPTION_MODES.map((mode) => (
              <label key={mode} className={`workspace-mode-option workspace-mode-option--${mode}`}>
                <input
                  type="radio"
                  name="workspace-encryption-mode"
                  value={mode}
                  checked={createDraft.encryptionMode === mode}
                  onChange={() => setCreateDraft({
                    ...createDraft,
                    encryptionMode: mode,
                    ...(mode === 'standard' ? {
                      passphrase: '',
                      confirmPassphrase: '',
                      recoveryBoundaryAcknowledged: false,
                    } : {}),
                  })}
                />
                <span>
                  <strong>{t(mode === 'encrypted' ? 'localWorkspaces.mode.encrypted' : 'localWorkspaces.mode.standard')}</strong>
                  <small>{t(mode === 'encrypted' ? 'localWorkspaces.mode.encryptedDescription' : 'localWorkspaces.mode.standardDescription')}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {encryptedDraft && (
            <div className="workspace-create-form__encryption">
              <Field label={t('localWorkspaces.create.passphrase')} hint={t('localWorkspaces.create.passphraseHint')} required>
                <input
                  type="password"
                  value={createDraft.passphrase}
                  aria-label={t('localWorkspaces.create.passphrase')}
                  autoComplete="new-password"
                  aria-invalid={createAttempted && !passphraseLengthValid ? 'true' : undefined}
                  onChange={(event) => setCreateDraft({ ...createDraft, passphrase: event.target.value })}
                  required
                />
              </Field>
              {createAttempted && !passphraseLengthValid && (
                <p className="field-error" role="alert">{t('localWorkspaces.create.passphraseLength')}</p>
              )}
              <Field label={t('localWorkspaces.create.confirmPassphrase')} required>
                <input
                  type="password"
                  value={createDraft.confirmPassphrase}
                  aria-label={t('localWorkspaces.create.confirmPassphrase')}
                  autoComplete="new-password"
                  aria-invalid={createAttempted && !passphrasesMatch ? 'true' : undefined}
                  onChange={(event) => setCreateDraft({ ...createDraft, confirmPassphrase: event.target.value })}
                  required
                />
              </Field>
              {createAttempted && !passphrasesMatch && (
                <p className="field-error" role="alert">{t('localWorkspaces.create.passphraseMismatch')}</p>
              )}
              <label className="workspace-recovery-acknowledgement">
                <input
                  type="checkbox"
                  checked={createDraft.recoveryBoundaryAcknowledged}
                  onChange={(event) => setCreateDraft({
                    ...createDraft,
                    recoveryBoundaryAcknowledged: event.target.checked,
                  })}
                />
                <span>{t('localWorkspaces.create.recoveryAcknowledge')}</span>
              </label>
              {createAttempted && !createDraft.recoveryBoundaryAcknowledged && (
                <p className="field-error" role="alert">{t('localWorkspaces.create.recoveryRequired')}</p>
              )}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={conversionOpen}
        title={t(
          conversionRetrying
            ? 'localWorkspaces.conversion.retryTitle'
            : 'localWorkspaces.conversion.title',
        )}
        description={t(
          conversionRetrying
            ? 'localWorkspaces.conversion.retryDescription'
            : 'localWorkspaces.conversion.description',
        )}
        onClose={closeConversion}
        size="md"
        footer={
          <>
            <Button onClick={closeConversion}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              type="submit"
              form="workspace-conversion-form"
              disabled={busy}
            >
              {t(
                conversionRetrying
                  ? 'localWorkspaces.conversion.retrySubmit'
                  : 'localWorkspaces.conversion.submit',
              )}
            </Button>
          </>
        }
      >
        <form id="workspace-conversion-form" className="workspace-secret-form" onSubmit={submitConversion}>
          <p className="workspace-secret-warning">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>{t('localWorkspaces.conversion.warning')}</span>
          </p>
          <Field
            label={t('localWorkspaces.conversion.passphrase')}
            hint={t('localWorkspaces.backup.passphraseHint')}
            required
          >
            <input
              type="password"
              value={conversionDraft.passphrase}
              aria-label={t('localWorkspaces.conversion.passphrase')}
              autoComplete="new-password"
              aria-invalid={conversionAttempted && !conversionLengthValid ? 'true' : undefined}
              onChange={(event) => setConversionDraft({
                ...conversionDraft,
                passphrase: event.target.value,
              })}
              autoFocus
              required
            />
          </Field>
          {conversionAttempted && !conversionLengthValid && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.passphraseLength')}</p>
          )}
          <Field label={t('localWorkspaces.conversion.confirmPassphrase')} required>
            <input
              type="password"
              value={conversionDraft.confirmPassphrase}
              aria-label={t('localWorkspaces.conversion.confirmPassphrase')}
              autoComplete="new-password"
              aria-invalid={conversionAttempted && !conversionMatches ? 'true' : undefined}
              onChange={(event) => setConversionDraft({
                ...conversionDraft,
                confirmPassphrase: event.target.value,
              })}
              required
            />
          </Field>
          {conversionAttempted && !conversionMatches && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.passphraseMismatch')}</p>
          )}
          <label className="workspace-recovery-acknowledgement">
            <input
              type="checkbox"
              checked={conversionAcknowledged}
              onChange={(event) => setConversionAcknowledged(event.target.checked)}
            />
            <span>{t('localWorkspaces.conversion.acknowledge')}</span>
          </label>
        </form>
      </Modal>

      <Modal
        open={discardConversionOpen}
        title={t('localWorkspaces.conversion.discardTitle')}
        description={t('localWorkspaces.conversion.discardDescription')}
        onClose={closeDiscardConversion}
        size="sm"
        footer={
          <>
            <Button onClick={closeDiscardConversion}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              type="submit"
              form="workspace-discard-conversion-form"
              disabled={busy || !discardConversionPassphraseValid}
            >
              {t('localWorkspaces.conversion.discardSubmit')}
            </Button>
          </>
        }
      >
        <form
          id="workspace-discard-conversion-form"
          className="workspace-conversion-form"
          onSubmit={submitDiscardConversion}
        >
          <p className="workspace-secret-warning">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>{t('localWorkspaces.conversion.discardBoundary')}</span>
          </p>
          <Field label={t('localWorkspaces.conversion.discardPassphrase')}>
            <input
              type="password"
              value={discardConversionPassphrase}
              aria-label={t('localWorkspaces.conversion.discardPassphrase')}
              autoComplete="current-password"
              aria-invalid={
                discardConversionAttempted && !discardConversionPassphraseValid
                  ? 'true'
                  : undefined
              }
              onChange={(event) => setDiscardConversionPassphrase(event.target.value)}
              autoFocus
            />
          </Field>
          <p className="workspace-dialog-note">
            {t('localWorkspaces.conversion.discardPassphraseHint')}
          </p>
          {discardConversionAttempted && !discardConversionPassphraseValid && (
            <p className="field-error" role="alert">
              {t('localWorkspaces.backup.passphraseLength')}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(cleanupTarget)}
        title={t('localWorkspaces.cleanup.title')}
        description={t('localWorkspaces.cleanup.description')}
        onClose={closeCleanup}
        size="md"
        footer={
          <>
            <Button onClick={closeCleanup}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              type="submit"
              form="workspace-cleanup-form"
              disabled={busy || !cleanupMatches || !cleanupBackupAcknowledged}
            >
              {t('localWorkspaces.cleanup.submit')}
            </Button>
          </>
        }
      >
        <form id="workspace-cleanup-form" className="workspace-cleanup-form" onSubmit={submitCleanup}>
          <p className="workspace-secret-warning">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>{t('localWorkspaces.cleanup.pendingBody')}</span>
          </p>
          <label className="workspace-recovery-acknowledgement">
            <input
              type="checkbox"
              checked={cleanupBackupAcknowledged}
              onChange={(event) => setCleanupBackupAcknowledged(event.target.checked)}
            />
            <span>{t('localWorkspaces.cleanup.backupAcknowledge')}</span>
          </label>
          <p>
            {cleanupTarget
              ? t('localWorkspaces.cleanup.namePrompt', { name: cleanupTarget.workspace.displayName })
              : ''}
          </p>
          <Field label={t('localWorkspaces.cleanup.nameLabel')} required>
            <input
              value={cleanupName}
              aria-label={t('localWorkspaces.cleanup.nameLabel')}
              onChange={(event) => setCleanupName(event.target.value)}
              autoComplete="off"
              autoFocus
              required
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={encryptedExportOpen}
        title={t('localWorkspaces.backup.exportEncryptedTitle')}
        description={t('localWorkspaces.backup.exportEncryptedDescription')}
        onClose={closeEncryptedExport}
        size="md"
        footer={
          <>
            <Button onClick={closeEncryptedExport}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              type="submit"
              form="workspace-encrypted-export-form"
              disabled={busy}
            >
              {t('localWorkspaces.backup.exportEncryptedSubmit')}
            </Button>
          </>
        }
      >
        <form
          id="workspace-encrypted-export-form"
          className="workspace-secret-form"
          onSubmit={submitEncryptedExport}
        >
          <p className="workspace-secret-warning">
            <KeyRound size={18} aria-hidden="true" />
            <span>{t('localWorkspaces.lock.noRecovery')}</span>
          </p>
          <Field
            label={t('localWorkspaces.backup.backupPassphrase')}
            hint={t('localWorkspaces.backup.passphraseHint')}
            required
          >
            <input
              type="password"
              value={encryptedExportDraft.passphrase}
              aria-label={t('localWorkspaces.backup.backupPassphrase')}
              autoComplete="new-password"
              aria-invalid={encryptedExportAttempted && !encryptedExportLengthValid ? 'true' : undefined}
              onChange={(event) => setEncryptedExportDraft({
                ...encryptedExportDraft,
                passphrase: event.target.value,
              })}
              autoFocus
              required
            />
          </Field>
          {encryptedExportAttempted && !encryptedExportLengthValid && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.passphraseLength')}</p>
          )}
          <Field label={t('localWorkspaces.backup.confirmBackupPassphrase')} required>
            <input
              type="password"
              value={encryptedExportDraft.confirmPassphrase}
              aria-label={t('localWorkspaces.backup.confirmBackupPassphrase')}
              autoComplete="new-password"
              aria-invalid={encryptedExportAttempted && !encryptedExportMatches ? 'true' : undefined}
              onChange={(event) => setEncryptedExportDraft({
                ...encryptedExportDraft,
                confirmPassphrase: event.target.value,
              })}
              required
            />
          </Field>
          {encryptedExportAttempted && !encryptedExportMatches && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.passphraseMismatch')}</p>
          )}
        </form>
      </Modal>

      <Modal
        open={plaintextImportOpen}
        title={t('localWorkspaces.backup.importPlaintextTitle')}
        description={t('localWorkspaces.backup.importPlaintextDescription')}
        onClose={closePlaintextImport}
        size="md"
        footer={
          <>
            <Button onClick={closePlaintextImport}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              type="submit"
              form="workspace-plaintext-import-form"
              disabled={busy}
            >
              {t(plaintextImportPreflight
                ? 'localWorkspaces.backup.importPlaintextSubmit'
                : 'localWorkspaces.backup.preflightSubmit')}
            </Button>
          </>
        }
      >
        <form id="workspace-plaintext-import-form" onSubmit={submitPlaintextImport}>
          <Field label={t('localWorkspaces.backup.jsonFile')} required>
            <input
              type="file"
              accept=".json,application/json"
              aria-label={t('localWorkspaces.backup.jsonFile')}
              aria-invalid={plaintextImportAttempted && !plaintextImportFile ? 'true' : undefined}
              onChange={(event) => {
                setPlaintextImportFile(event.target.files?.[0] ?? null)
                setPlaintextImportPreflight(null)
              }}
              autoFocus
              required
            />
          </Field>
          {plaintextImportAttempted && !plaintextImportFile && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.fileRequired')}</p>
          )}
          {plaintextImportPreflight && <ImportPreflightSummary preflight={plaintextImportPreflight} />}
        </form>
      </Modal>

      <Modal
        open={encryptedImportOpen}
        title={t('localWorkspaces.backup.importEncryptedTitle')}
        description={t('localWorkspaces.backup.importEncryptedDescription')}
        onClose={closeEncryptedImport}
        size="md"
        footer={
          <>
            <Button onClick={closeEncryptedImport}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              type="submit"
              form="workspace-encrypted-import-form"
              disabled={busy}
            >
              {t(encryptedImportPreflight
                ? 'localWorkspaces.backup.importEncryptedSubmit'
                : 'localWorkspaces.backup.preflightSubmit')}
            </Button>
          </>
        }
      >
        <form
          id="workspace-encrypted-import-form"
          className="workspace-secret-form"
          onSubmit={submitEncryptedImport}
        >
          <Field label={t('localWorkspaces.backup.encryptedFile')} required>
            <input
              type="file"
              accept=".sociologydesk,application/octet-stream"
              aria-label={t('localWorkspaces.backup.encryptedFile')}
              aria-invalid={encryptedImportAttempted && !encryptedImportDraft.file ? 'true' : undefined}
              onChange={(event) => {
                setEncryptedImportDraft({
                  ...encryptedImportDraft,
                  file: event.target.files?.[0] ?? null,
                })
                setEncryptedImportPreflight(null)
              }}
              autoFocus
              required
            />
          </Field>
          {encryptedImportAttempted && !encryptedImportDraft.file && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.fileRequired')}</p>
          )}
          <Field
            label={t('localWorkspaces.backup.existingBackupPassphrase')}
            hint={t('localWorkspaces.backup.passphraseHint')}
            required
          >
            <input
              type="password"
              value={encryptedImportDraft.backupPassphrase}
              aria-label={t('localWorkspaces.backup.existingBackupPassphrase')}
              autoComplete="current-password"
              aria-invalid={encryptedImportAttempted && !encryptedImportBackupLengthValid ? 'true' : undefined}
              onChange={(event) => {
                setEncryptedImportDraft({
                  ...encryptedImportDraft,
                  backupPassphrase: event.target.value,
                })
                setEncryptedImportPreflight(null)
              }}
              required
            />
          </Field>
          {encryptedImportAttempted && !encryptedImportBackupLengthValid && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.passphraseLength')}</p>
          )}
          <Field
            label={t('localWorkspaces.backup.newWorkspacePassphrase')}
            hint={t('localWorkspaces.backup.passphraseHint')}
            required
          >
            <input
              type="password"
              value={encryptedImportDraft.newWorkspacePassphrase}
              aria-label={t('localWorkspaces.backup.newWorkspacePassphrase')}
              autoComplete="new-password"
              aria-invalid={encryptedImportAttempted && !encryptedImportNewLengthValid ? 'true' : undefined}
              onChange={(event) => setEncryptedImportDraft({
                ...encryptedImportDraft,
                newWorkspacePassphrase: event.target.value,
              })}
              required
            />
          </Field>
          {encryptedImportAttempted && !encryptedImportNewLengthValid && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.passphraseLength')}</p>
          )}
          <Field label={t('localWorkspaces.backup.confirmNewWorkspacePassphrase')} required>
            <input
              type="password"
              value={encryptedImportDraft.confirmNewWorkspacePassphrase}
              aria-label={t('localWorkspaces.backup.confirmNewWorkspacePassphrase')}
              autoComplete="new-password"
              aria-invalid={encryptedImportAttempted && !encryptedImportMatches ? 'true' : undefined}
              onChange={(event) => setEncryptedImportDraft({
                ...encryptedImportDraft,
                confirmNewWorkspacePassphrase: event.target.value,
              })}
              required
            />
          </Field>
          {encryptedImportAttempted && !encryptedImportMatches && (
            <p className="field-error" role="alert">{t('localWorkspaces.backup.passphraseMismatch')}</p>
          )}
          {encryptedImportPreflight && <ImportPreflightSummary preflight={encryptedImportPreflight} />}
          <label className="workspace-recovery-acknowledgement">
            <input
              type="checkbox"
              checked={encryptedImportDraft.recoveryBoundaryAcknowledged}
              onChange={(event) => setEncryptedImportDraft({
                ...encryptedImportDraft,
                recoveryBoundaryAcknowledged: event.target.checked,
              })}
            />
            <span>{t('localWorkspaces.backup.importRecoveryAcknowledge')}</span>
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(provisioningTarget)}
        title={t(
          provisioningTarget?.action === 'discard'
            ? 'localWorkspaces.provisioning.discardTitle'
            : 'localWorkspaces.provisioning.recoverTitle',
        )}
        description={t(
          provisioningTarget?.action === 'discard'
            ? 'localWorkspaces.provisioning.discardDescription'
            : 'localWorkspaces.provisioning.recoverDescription',
        )}
        onClose={closeProvisioningAction}
        size="sm"
        footer={
          <>
            <Button onClick={closeProvisioningAction}>{t('common.cancel')}</Button>
            <Button
              variant={provisioningTarget?.action === 'discard' ? 'danger' : 'primary'}
              type="submit"
              form="workspace-provisioning-form"
              disabled={busy}
            >
              {t(
                provisioningTarget?.action === 'discard'
                  ? 'localWorkspaces.provisioning.discard'
                  : 'localWorkspaces.provisioning.recover',
              )}
            </Button>
          </>
        }
      >
        <form id="workspace-provisioning-form" onSubmit={submitProvisioningAction}>
          <p className="workspace-provisioning__target">{provisioningTarget?.workspace.displayName}</p>
          {provisioningTarget?.workspace.encryptionMode === 'encrypted' && (
            <Field label={t('localWorkspaces.provisioning.passphrase')} required>
              <input
                type="password"
                value={provisioningPassphrase}
                aria-label={t('localWorkspaces.provisioning.passphrase')}
                autoComplete="current-password"
                onChange={(event) => setProvisioningPassphrase(event.target.value)}
                aria-invalid={provisioningAttempted && !provisioningPassphrase ? 'true' : undefined}
                autoFocus
                required
              />
            </Field>
          )}
          {provisioningTarget?.action === 'discard' && (
            <Field label={t('localWorkspaces.provisioning.confirmName')} required>
              <input
                value={provisioningName}
                aria-label={t('localWorkspaces.provisioning.confirmName')}
                autoComplete="off"
                onChange={(event) => setProvisioningName(event.target.value)}
                aria-invalid={
                  provisioningAttempted &&
                  provisioningName !== provisioningTarget.workspace.displayName
                    ? 'true'
                    : undefined
                }
                autoFocus={provisioningTarget.workspace.encryptionMode !== 'encrypted'}
                required
              />
            </Field>
          )}
          {provisioningAttempted && provisioningTarget?.workspace.encryptionMode === 'encrypted' && !provisioningPassphrase && (
            <p className="field-error" role="alert">{t('localWorkspaces.provisioning.passphraseRequired')}</p>
          )}
          {provisioningAttempted && provisioningTarget?.action === 'discard' && provisioningName !== provisioningTarget.workspace.displayName && (
            <p className="field-error" role="alert">{t('localWorkspaces.delete.mismatch')}</p>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(renameTarget)}
        title={t('localWorkspaces.rename.title')}
        description={t('localWorkspaces.rename.description')}
        onClose={() => setRenameTarget(null)}
        size="sm"
        footer={
          <>
            <Button onClick={() => setRenameTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="workspace-rename-form" disabled={busy}>
              {t('localWorkspaces.rename.submit')}
            </Button>
          </>
        }
      >
        <form id="workspace-rename-form" onSubmit={submitRename}>
          <Field label={t('localWorkspaces.rename.name')} required>
            <input
              value={renameName}
              aria-label={t('localWorkspaces.rename.name')}
              onChange={(event) => setRenameName(event.target.value)}
              maxLength={200}
              autoFocus
              required
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title={t('localWorkspaces.delete.title')}
        description={t('localWorkspaces.delete.description')}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" type="submit" form="workspace-delete-form" disabled={busy || !deleteMatches}>
              {t('localWorkspaces.delete.submit')}
            </Button>
          </>
        }
      >
        <form id="workspace-delete-form" className="workspace-delete-form" onSubmit={submitDelete}>
          <p>{deleteTarget ? t('localWorkspaces.delete.prompt', { name: deleteTarget.displayName }) : ''}</p>
          <Field label={t('localWorkspaces.delete.name')} required>
            <input
              value={deleteName}
              aria-label={t('localWorkspaces.delete.name')}
              onChange={(event) => setDeleteName(event.target.value)}
              aria-invalid={deleteAttempted && !deleteMatches ? 'true' : undefined}
              autoComplete="off"
              autoFocus
              required
            />
          </Field>
          {deleteAttempted && !deleteMatches && (
            <p className="field-error" role="alert">{t('localWorkspaces.delete.mismatch')}</p>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(demoResetTarget)}
        title={t('localWorkspaces.demoReset.title')}
        description={t('localWorkspaces.demoReset.description')}
        onClose={() => setDemoResetTarget(null)}
        size="sm"
        footer={
          <>
            <Button onClick={() => setDemoResetTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" icon={<RotateCcw size={15} />} onClick={confirmDemoReset} disabled={busy}>
              {t('localWorkspaces.demoReset.submit')}
            </Button>
          </>
        }
      >
        <p className="workspace-demo-confirmation">{demoResetTarget?.displayName}</p>
      </Modal>

      <Modal
        open={plaintextConfirmOpen}
        title={t('localWorkspaces.backup.plaintextWarningTitle')}
        description={t('localWorkspaces.backup.plaintextWarningBody')}
        onClose={() => setPlaintextConfirmOpen(false)}
        size="sm"
        footer={
          <>
            <Button onClick={() => setPlaintextConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" icon={<Download size={15} />} onClick={exportPlaintext} disabled={busy}>
              {t('localWorkspaces.backup.plaintextWarningConfirm')}
            </Button>
          </>
        }
      >
        <p className="workspace-plaintext-warning">{t('localWorkspaces.backup.plaintextBody')}</p>
      </Modal>
    </>
  )
}
