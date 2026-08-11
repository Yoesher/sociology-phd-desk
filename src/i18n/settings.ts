export type AppLocale = 'zh-CN' | 'en'
export type AppTheme = 'light' | 'dark'

export interface AppSettings {
  language: AppLocale
  theme?: AppTheme
}

export const DEFAULT_LOCALE: AppLocale = 'zh-CN'
export const APP_SETTINGS_STORAGE_KEY = 'sociology-phd-desk-settings'
const LEGACY_THEME_STORAGE_KEY = 'phd-desk-theme'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'zh-CN' || value === 'en'
}

export function isAppTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark'
}

export function readAppSettings(storage: ReadableStorage = window.localStorage): AppSettings {
  let stored: unknown
  let legacyTheme: unknown
  try {
    const raw = storage.getItem(APP_SETTINGS_STORAGE_KEY)
    stored = raw ? JSON.parse(raw) : null
  } catch {
    stored = null
  }
  try {
    legacyTheme = storage.getItem(LEGACY_THEME_STORAGE_KEY)
  } catch {
    legacyTheme = null
  }

  const candidate = stored && typeof stored === 'object' ? stored as Record<string, unknown> : {}
  const theme = isAppTheme(candidate.theme)
    ? candidate.theme
    : isAppTheme(legacyTheme)
      ? legacyTheme
      : undefined

  return {
    language: isAppLocale(candidate.language) ? candidate.language : DEFAULT_LOCALE,
    ...(theme ? { theme } : {}),
  }
}

export function writeAppSettings(
  settings: AppSettings,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) {
  try {
    storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Privacy modes and storage quotas can make localStorage unavailable.
    // The in-memory preference still applies for the current session.
  }
}

function updateAppSettings(
  patch: Partial<AppSettings>,
  storage: WritableStorage = window.localStorage,
) {
  const current = readAppSettings(storage)
  writeAppSettings({ ...current, ...patch }, storage)
}

export function readStoredLocale(storage: ReadableStorage = window.localStorage): AppLocale {
  return readAppSettings(storage).language
}

export function storeLocale(locale: AppLocale, storage: WritableStorage = window.localStorage) {
  updateAppSettings({ language: locale }, storage)
}

export function readStoredTheme(storage: ReadableStorage = window.localStorage): AppTheme | undefined {
  return readAppSettings(storage).theme
}

export function storeTheme(theme: AppTheme, storage: WritableStorage = window.localStorage) {
  updateAppSettings({ theme }, storage)
}
