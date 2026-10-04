import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useReducedMotionPreference } from '../hooks/useAppearance'
import {
  APP_SETTINGS_STORAGE_KEY, DEFAULT_APPEARANCE, canReadAppSettings, isAppearanceValue,
  readStoredAppearance, storeAppearance, type AppAppearance,
} from '../i18n/settings'
import { AppearanceContext } from './appearance-context'
import { applyAppearanceSettings } from './appearance-runtime'

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppAppearance>(readStoredAppearance)
  const current = useRef(appearance)
  const [storageAvailable, setStorageAvailable] = useState(canReadAppSettings)
  const reducedMotion = useReducedMotionPreference()

  const applyAndSave = useCallback((next: AppAppearance) => {
    current.current = next
    applyAppearanceSettings(next)
    setAppearanceState(next)
    setStorageAvailable(storeAppearance(next))
  }, [])

  const setAppearance = useCallback(<K extends keyof AppAppearance>(key: K, value: AppAppearance[K]) => {
    if (!isAppearanceValue(key, value)) return
    applyAndSave({ ...current.current, [key]: value })
  }, [applyAndSave])

  const resetAppearance = useCallback(() => applyAndSave({ ...DEFAULT_APPEARANCE }), [applyAndSave])

  useLayoutEffect(() => {
    applyAppearanceSettings(appearance)
  }, [appearance, reducedMotion])

  useEffect(() => {
    // This initial merge also detects a denied setItem without a throw or lost draft.
    setStorageAvailable(storeAppearance(current.current))
    const onStorage = (event: StorageEvent) => {
      if (event.key !== APP_SETTINGS_STORAGE_KEY && event.key !== null) return
      if (!canReadAppSettings()) { setStorageAvailable(false); return }
      const next = readStoredAppearance()
      current.current = next
      applyAppearanceSettings(next)
      setAppearanceState(next)
      setStorageAvailable(true)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(() => ({ appearance, setAppearance, resetAppearance, storageAvailable }),
    [appearance, setAppearance, resetAppearance, storageAvailable])
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}
