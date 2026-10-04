import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  canReadAppSettings,
  readAppSettings,
  readStoredAppearance,
  readStoredLocale,
  storeLocale,
  storeTheme,
  storeAppearance,
  writeAppSettings,
} from './settings'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('application settings', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('defaults a fresh installation to Chinese independent of browser language', () => {
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' })

    expect(readStoredLocale()).toBe('zh-CN')
  })

  it('persists locale and theme together without putting them in workspace data', () => {
    const storage = new MemoryStorage()

    storeTheme('dark', storage)
    storeLocale('en', storage)

    expect(readAppSettings(storage)).toEqual({ language: 'en', theme: 'dark' })
    expect(JSON.parse(storage.getItem(APP_SETTINGS_STORAGE_KEY) ?? '{}')).toEqual({
      language: 'en',
      theme: 'dark',
    })
  })

  it('migrates a valid legacy theme while rejecting malformed settings', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_SETTINGS_STORAGE_KEY, '{not-json')
    storage.setItem('phd-desk-theme', 'dark')

    expect(readAppSettings(storage)).toEqual({ language: 'zh-CN', theme: 'dark' })
  })

  it('degrades safely when browser storage is unavailable', () => {
    const unavailable = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    }

    expect(readAppSettings(unavailable)).toEqual({ language: 'zh-CN' })
    expect(() => writeAppSettings({ language: 'en' }, unavailable)).not.toThrow()
    expect(writeAppSettings({ language: 'en' }, unavailable)).toBe(false)
  })

  it('provides complete conservative appearance defaults for old settings', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en', theme: 'dark' }))
    expect(readStoredAppearance(storage)).toEqual(DEFAULT_APPEARANCE)
    expect(readAppSettings(storage)).toEqual({ language: 'en', theme: 'dark' })
  })

  it('merges flat appearance fields with locale/theme in both update directions', () => {
    const storage = new MemoryStorage()
    storeLocale('en', storage)
    storeTheme('dark', storage)
    expect(storeAppearance({ motion: 'slide', font: 'serif', template: 'paper', textSize: 'larger' }, storage)).toBe(true)
    storeLocale('zh-CN', storage)
    storeTheme('light', storage)
    expect(readAppSettings(storage)).toEqual({ language: 'zh-CN', theme: 'light', motion: 'slide', font: 'serif', template: 'paper', textSize: 'larger' })
    expect(JSON.parse(storage.getItem(APP_SETTINGS_STORAGE_KEY)!)).not.toHaveProperty('appearance')
  })

  it.each(['null', '[]', '42', '"none"', '{broken'])('rejects malformed or non-object preferences: %s', raw => {
    const storage = new MemoryStorage()
    storage.setItem(APP_SETTINGS_STORAGE_KEY, raw)
    expect(readStoredAppearance(storage)).toEqual(DEFAULT_APPEARANCE)
  })

  it('validates fields independently and discards unrecognized or unsafe choices', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({
      motion: 'rapid', font: 'serif', template: '<style>remote</style>', textSize: 500,
      remoteFontUrl: 'https://example.invalid/font.woff', appearance: { motion: 'none' },
    }))
    expect(readStoredAppearance(storage)).toEqual({ ...DEFAULT_APPEARANCE, font: 'serif' })
    expect(readAppSettings(storage)).toEqual({ language: 'zh-CN', font: 'serif' })
  })

  it('never overwrites existing preferences if the merge read is denied', () => {
    const setItem = vi.fn()
    const storage = { getItem: () => { throw new DOMException('denied', 'SecurityError') }, setItem }
    expect(storeAppearance({ ...DEFAULT_APPEARANCE, motion: 'none' }, storage)).toBe(false)
    expect(storeLocale('en', storage)).toBe(false)
    expect(storeTheme('dark', storage)).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('handles denial of the raw localStorage property before a getter call', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    expect(readStoredLocale()).toBe('zh-CN')
    expect(readStoredAppearance()).toEqual(DEFAULT_APPEARANCE)
    expect(canReadAppSettings()).toBe(false)
    expect(storeAppearance({ ...DEFAULT_APPEARANCE, motion: 'none' })).toBe(false)
    expect(() => storeTheme('dark')).not.toThrow()
  })

  it('rejects invalid writes rather than saving remote font or template values', () => {
    const storage = new MemoryStorage()
    const invalid = { ...DEFAULT_APPEARANCE, font: 'https://example.invalid/font.woff' }
    expect(storeAppearance(invalid as unknown as Parameters<typeof storeAppearance>[0], storage)).toBe(false)
    expect(storage.getItem(APP_SETTINGS_STORAGE_KEY)).toBeNull()
  })
})
