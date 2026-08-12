import type { ReactNode } from 'react'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import { WorkspaceLockScreen } from './WorkspaceLockScreen'

export type WorkspaceAccessState =
  | 'registry-loading'
  | 'picker'
  | 'locked'
  | 'unlocking'
  | 'locking'
  | 'unlocked'

export type WorkspaceUiErrorCode =
  | 'registry-unavailable'
  | 'migration-failed'
  | 'workspace-unavailable'
  | 'workspace-conflict'
  | 'save-failed'
  | 'storage-full'
  | 'crypto-unavailable'
  | 'unlock-failed'
  | 'invalid-portable-backup'
  | 'invalid-encrypted-backup'
  | 'unsupported-container-version'
  | 'cross-tab-lock-unavailable'
  | 'discard-passphrase-required'
  | 'discard-authentication-failed'
  | 'delete-failed'

export type WorkspaceUiOperation =
  | 'open'
  | 'unlock'
  | 'save'
  | 'switch'
  | 'create'
  | 'rename'
  | 'delete'
  | 'export'
  | 'import'
  | 'migrate'

export interface WorkspaceUiErrorDescriptor {
  code: WorkspaceUiErrorCode
  operation: WorkspaceUiOperation
  retryable: boolean
}

export interface WorkspaceAccessGateProps {
  state: WorkspaceAccessState
  activeWorkspace: WorkspaceRegistryEntry | null
  error?: WorkspaceUiErrorDescriptor | null
  onOpenStandard: () => void | Promise<void>
  onUnlockEncrypted: (passphrase: string) => void | Promise<void>
  onOpenWorkspacePicker: () => void
  pickerContent?: ReactNode
  children: ReactNode
}

/**
 * Keeps all research UI unmounted until a local workspace session is open.
 * The parent owns persistence and cryptography; this component receives only
 * stable registry metadata and safe error descriptors.
 */
export function WorkspaceAccessGate({
  state,
  activeWorkspace,
  error,
  onOpenStandard,
  onUnlockEncrypted,
  onOpenWorkspacePicker,
  pickerContent,
  children,
}: WorkspaceAccessGateProps) {
  if (state === 'unlocked') {
    return <>{children}</>
  }

  return (
    <>
      <WorkspaceLockScreen
        state={state}
        workspace={activeWorkspace}
        error={error}
        onOpenStandard={onOpenStandard}
        onUnlockEncrypted={onUnlockEncrypted}
        onOpenWorkspacePicker={onOpenWorkspacePicker}
      />
      {state === 'picker' ? pickerContent : null}
    </>
  )
}
