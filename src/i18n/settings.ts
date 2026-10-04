export type AppLocale = 'zh-CN' | 'en'
export type AppTheme = 'light' | 'dark'
export type AppMotion = 'gentle' | 'fade' | 'slide' | 'none'
export type AppFont = 'academic' | 'sans' | 'serif' | 'system'
export type AppTemplate = 'classic' | 'paper' | 'slate' | 'forest'
export type AppTextSize = 'standard' | 'large' | 'larger'

export interface AppAppearance {
  motion: AppMotion
  font: AppFont
  template: AppTemplate
  textSize: AppTextSize
}

export interface AppSettings extends Partial<AppAppearance> {
  language: AppLocale
  theme?: AppTheme
}

export const DEFAULT_LOCALE: AppLocale = 'zh-CN'
export const APP_SETTINGS_STORAGE_KEY = 'sociology-phd-desk-settings'
const LEGACY_THEME_STORAGE_KEY = 'phd-desk-theme'
export const DEFAULT_APPEARANCE: Readonly<AppAppearance> = Object.freeze({
  motion: 'gentle',
  font: 'academic',
  template: 'classic',
  textSize: 'standard',
})

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    // Accessing the property itself can throw in restricted browser contexts.
    return undefined
  }
}

export function isAppMotion(value: unknown): value is AppMotion {
  return value === 'gentle' || value === 'fade' || value === 'slide' || value === 'none'
}

export function isAppFont(value: unknown): value is AppFont {
  return value === 'academic' || value === 'sans' || value === 'serif' || value === 'system'
}

export function isAppTemplate(value: unknown): value is AppTemplate {
  return value === 'classic' || value === 'paper' || value === 'slate' || value === 'forest'
}

export function isAppTextSize(value: unknown): value is AppTextSize {
  return value === 'standard' || value === 'large' || value === 'larger'
}

export function isAppearanceValue(key: keyof AppAppearance, value: unknown): boolean {
  switch (key) {
    case 'motion': return isAppMotion(value)
    case 'font': return isAppFont(value)
    case 'template': return isAppTemplate(value)
    case 'textSize': return isAppTextSize(value)
    default: return false
  }
}

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'zh-CN' || value === 'en'
}

export function isAppTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark'
}

export function readAppSettings(storage: ReadableStorage | undefined = defaultStorage()): AppSettings {
  let stored: unknown
  let legacyTheme: unknown
  try {
    const raw = storage?.getItem(APP_SETTINGS_STORAGE_KEY)
    stored = raw ? JSON.parse(raw) : null
  } catch {
    stored = null
  }
  try {
    legacyTheme = storage?.getItem(LEGACY_THEME_STORAGE_KEY)
  } catch {
    legacyTheme = null
  }

  const candidate = stored && typeof stored === 'object' && !Array.isArray(stored)
    ? stored as Record<string, unknown> : {}
  const theme = isAppTheme(candidate.theme)
    ? candidate.theme
    : isAppTheme(legacyTheme)
      ? legacyTheme
      : undefined

  return {
    language: isAppLocale(candidate.language) ? candidate.language : DEFAULT_LOCALE,
    ...(theme ? { theme } : {}),
    ...(isAppMotion(candidate.motion) ? { motion: candidate.motion } : {}),
    ...(isAppFont(candidate.font) ? { font: candidate.font } : {}),
    ...(isAppTemplate(candidate.template) ? { template: candidate.template } : {}),
    ...(isAppTextSize(candidate.textSize) ? { textSize: candidate.textSize } : {}),
  }
}

export function writeAppSettings(
  settings: AppSettings,
  storage: Pick<Storage, 'setItem'> | undefined = defaultStorage(),
) {
  try {
    if (!storage) return false
    storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    // Privacy modes and storage quotas can make localStorage unavailable.
    // The in-memory preference still applies for the current session.
    return false
  }
}

function updateAppSettings(
  patch: Partial<AppSettings>,
  storage: WritableStorage | undefined = defaultStorage(),
) {
  // A denied read must not overwrite existing language/theme or other preferences.
  if (!storage) return false
  try {
    storage.getItem(APP_SETTINGS_STORAGE_KEY)
  } catch {
    return false
  }
  const current = readAppSettings(storage)
  return writeAppSettings({ ...current, ...patch }, storage)
}

export function readStoredLocale(storage?: ReadableStorage): AppLocale {
  return readAppSettings(storage).language
}

export function storeLocale(locale: AppLocale, storage?: WritableStorage) {
  return updateAppSettings({ language: locale }, storage)
}

export function readStoredTheme(storage?: ReadableStorage): AppTheme | undefined {
  return readAppSettings(storage).theme
}

export function storeTheme(theme: AppTheme, storage?: WritableStorage) {
  return updateAppSettings({ theme }, storage)
}

export function readStoredAppearance(storage?: ReadableStorage): AppAppearance {
  const settings = readAppSettings(storage)
  return {
    motion: settings.motion ?? DEFAULT_APPEARANCE.motion,
    font: settings.font ?? DEFAULT_APPEARANCE.font,
    template: settings.template ?? DEFAULT_APPEARANCE.template,
    textSize: settings.textSize ?? DEFAULT_APPEARANCE.textSize,
  }
}

export function storeAppearance(appearance: AppAppearance, storage?: WritableStorage): boolean {
  if (Object.entries(appearance).some(([key, value]) =>
    !isAppearanceValue(key as keyof AppAppearance, value),
  ) || Object.keys(DEFAULT_APPEARANCE).some(key => !Object.hasOwn(appearance, key))) return false
  return updateAppSettings({
    motion: appearance.motion, font: appearance.font,
    template: appearance.template, textSize: appearance.textSize,
  }, storage)
}

export function canReadAppSettings(storage: ReadableStorage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false
    storage.getItem(APP_SETTINGS_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
