import { createContext } from 'react'
import type { OpenedLocalWorkspaceSession } from '../db/localWorkspaceManager'
import type { WorkspaceData } from '../models/domain'
import type {
  WorkspaceAutoLock,
  WorkspaceRegistryEntry,
} from '../models/workspace-registry'
import type {
  WorkspaceCenterSection,
  WorkspaceCreateRequest,
  WorkspaceEncryptedImportRequest,
} from './WorkspaceCenter'
import type {
  WorkspaceAccessState,
  WorkspaceUiErrorDescriptor,
} from './WorkspaceAccessGate'

export interface WorkspaceSessionContextValue {
  accessState: WorkspaceAccessState
  workspaces: readonly WorkspaceRegistryEntry[]
  recoverableProvisioning: readonly WorkspaceRegistryEntry[]
  pendingDeletions: readonly WorkspaceRegistryEntry[]
  activeWorkspaceId?: string
  activeWorkspace: WorkspaceRegistryEntry | null
  session: OpenedLocalWorkspaceSession | null
  sessionGeneration: number
  busy: boolean
  error: WorkspaceUiErrorDescriptor | null
  workspaceCenterOpen: boolean
  workspaceCenterSection: WorkspaceCenterSection
  openWorkspaceCenter: (section?: WorkspaceCenterSection) => void
  closeWorkspaceCenter: () => void
  openActiveStandard: () => Promise<void>
  unlockActiveEncrypted: (passphrase: string) => Promise<void>
  lockActiveWorkspace: () => Promise<void>
  /** Cooperating-tab/missed-signal invalidation: closes locally without rebroadcasting. */
  invalidateActiveSession: (
    workspaceId?: string,
    storageId?: string,
    sessionGeneration?: number,
  ) => void
  selectWorkspace: (workspaceId: string) => Promise<void>
  createWorkspace: (request: WorkspaceCreateRequest) => Promise<void>
  recoverProvisioning: (workspaceId: string, passphrase?: string) => Promise<void>
  discardProvisioning: (workspaceId: string, passphrase?: string) => Promise<void>
  retryFinalizeDeletion: (workspaceId: string) => Promise<void>
  renameWorkspace: (workspaceId: string, displayName: string) => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  resetDemoWorkspace: (workspaceId: string) => Promise<void>
  updateWorkspaceAutoLock: (
    workspaceId: string,
    autoLock: WorkspaceAutoLock,
  ) => Promise<void>
  convertWorkspaceToEncrypted: (workspaceId: string, passphrase: string) => Promise<void>
  discardEncryptedConversion: (workspaceId: string, passphrase?: string) => Promise<void>
  cleanupPlaintextSource: (workspaceId: string, sourceId: string) => Promise<void>
  exportPlaintextWorkspace: (workspaceId: string) => Promise<void>
  exportEncryptedWorkspace: (workspaceId: string, passphrase: string) => Promise<void>
  importPlaintextWorkspaceFile: (file: File) => Promise<void>
  importEncryptedWorkspaceFile: (request: WorkspaceEncryptedImportRequest) => Promise<void>
  importPlaintextWorkspaceAsNew: (snapshot: WorkspaceData) => Promise<void>
  announceRevision: (revision: number) => void
  registerResearchRuntime: (control: WorkspaceResearchRuntimeControl) => () => void
  clearError: () => void
}

export interface WorkspaceResearchRuntimeControl {
  workspaceId: string
  storageId: string
  flushPendingWrites: () => Promise<void>
  /** Refreshes from the repository and returns the latest committed snapshot. */
  refreshLatest: () => Promise<WorkspaceData>
  getCurrentSnapshot: () => WorkspaceData
}

export const WorkspaceSessionContext = createContext<WorkspaceSessionContextValue | null>(null)
