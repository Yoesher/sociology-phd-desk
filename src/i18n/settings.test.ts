import { beforeEach, describe, expect, it } from 'vitest'
import {
  APP_SETTINGS_STORAGE_KEY,
  readAppSettings,
  readStoredLocale,
  storeLocale,
  storeTheme,
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
  })
})
