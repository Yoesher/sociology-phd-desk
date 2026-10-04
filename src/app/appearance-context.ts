import { createContext } from 'react'
import { DEFAULT_APPEARANCE, type AppAppearance } from '../i18n/settings'

export interface AppearanceContextValue {
  appearance: AppAppearance
  setAppearance: <K extends keyof AppAppearance>(key: K, value: AppAppearance[K]) => void
  resetAppearance: () => void
  storageAvailable: boolean
}

export const AppearanceContext = createContext<AppearanceContextValue>({
  appearance: { ...DEFAULT_APPEARANCE },
  setAppearance: () => {},
  resetAppearance: () => {},
  storageAvailable: true,
})
