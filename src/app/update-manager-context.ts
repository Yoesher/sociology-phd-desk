import { createContext } from 'react'

export interface UpdateManagerContextValue {
  supported: boolean
  updateAvailable: boolean
  applying: boolean
  checking: boolean
  error: boolean
  installAvailable: boolean
  installed: boolean
  checkForUpdate: () => Promise<void>
  applyUpdate: () => Promise<void>
  requestInstall: () => Promise<void>
}

export const UpdateManagerContext = createContext<UpdateManagerContextValue | null>(null)
