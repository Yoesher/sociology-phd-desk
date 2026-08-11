import { createContext } from 'react'
import type { WorkspaceData } from '../models/domain'
import type { MergeWorkspaceResult } from '../db/workspaceRepository'

export interface WorkspaceContextValue {
  data: WorkspaceData | null
  loading: boolean
  saving: boolean
  error: string | null
  updateData: (updater: (current: WorkspaceData) => WorkspaceData) => Promise<void>
  setActiveProject: (projectId?: string) => Promise<void>
  replaceWith: (workspace: WorkspaceData) => Promise<void>
  mergeWith: (workspace: WorkspaceData) => Promise<MergeWorkspaceResult>
  resetDemo: () => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
