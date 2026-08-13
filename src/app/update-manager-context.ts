import { createContext } from 'react'

export type UpdateManagerState =
  | 'idle'
  | 'checking'
  | 'installing'
  | 'available'
  | 'ready'
  | 'applying'
  | 'error'

export interface UpdateManagerContextValue {
  state: UpdateManagerState
  supported: boolean
  updateAvailable: boolean
  applying: boolean
  checking: boolean
  error: boolean
  installAvailable: boolean
  installed: boolean
  otherTabsOpen: boolean
  peerUpdateRequested: boolean
  checkForUpdate: () => Promise<void>
  applyUpdate: () => Promise<void>
  requestInstall: () => Promise<void>
}

export const UpdateManagerContext = createContext<UpdateManagerContextValue | null>(null)
