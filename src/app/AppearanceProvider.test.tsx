import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppearance, useMotionPreference } from '../hooks/useAppearance'
import { APP_SETTINGS_STORAGE_KEY, DEFAULT_APPEARANCE, type AppFont } from '../i18n/settings'
import { AppearanceProvider } from './AppearanceProvider'
import { applyStoredAppearance } from './appearance-runtime'

let reduced = false
let listeners: Set<() => void>

function stored() { return JSON.parse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY) ?? '{}') }

beforeEach(() => {
  localStorage.clear()
  reduced = false
  listeners = new Set()
  const media = {
    get matches() { return reduced },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => media))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const name of ['motion', 'motionEnabled', 'font', 'template', 'textSize']) delete document.documentElement.dataset[name]
})

describe('AppearanceProvider', () => {
  it('keeps the initial visual defaults and stores no workspace data', () => {
    const { result } = renderHook(useAppearance, { wrapper: AppearanceProvider })
    expect(result.current.appearance).toEqual(DEFAULT_APPEARANCE)
    expect(result.current.storageAvailable).toBe(true)
    expect(document.documentElement.dataset).toMatchObject({ motion: 'gentle', motionEnabled: 'true', font: 'academic', template: 'classic', textSize: 'standard' })
    expect(stored()).toEqual({ language: 'zh-CN', ...DEFAULT_APPEARANCE })
  })

  it('applies each choice, survives remount and preserves language/theme', () => {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en', theme: 'dark' }))
    const first = renderHook(useAppearance, { wrapper: AppearanceProvider })
    act(() => {
      first.result.current.setAppearance('motion', 'fade')
      first.result.current.setAppearance('font', 'serif')
      first.result.current.setAppearance('template', 'forest')
      first.result.current.setAppearance('textSize', 'larger')
    })
    const expected = { motion: 'fade', font: 'serif', template: 'forest', textSize: 'larger' }
    expect(first.result.current.appearance).toEqual(expected)
    expect(stored()).toEqual({ language: 'en', theme: 'dark', ...expected })
    first.unmount()
    const second = renderHook(useAppearance, { wrapper: AppearanceProvider })
    expect(second.result.current.appearance).toEqual(expected)
    expect(document.documentElement.dataset).toMatchObject({ ...expected, motionEnabled: 'true' })
  })

  it('applies preferences in memory and honestly signals a failed write', () => {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en', theme: 'dark' }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError') })
    const { result } = renderHook(useAppearance, { wrapper: AppearanceProvider })
    act(() => result.current.setAppearance('font', 'serif'))
    expect(result.current.appearance.font).toBe('serif')
    expect(document.documentElement.dataset.font).toBe('serif')
    expect(result.current.storageAvailable).toBe(false)
    expect(stored()).toEqual({ language: 'en', theme: 'dark' })
  })

  it('remains usable when access to the storage property itself is denied', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    const { result } = renderHook(useAppearance, { wrapper: AppearanceProvider })
    act(() => result.current.setAppearance('motion', 'none'))
    expect(result.current.appearance.motion).toBe('none')
    expect(result.current.storageAvailable).toBe(false)
    expect(document.documentElement.dataset.motionEnabled).toBe('false')
  })

  it('receives cross-tab preference updates without writing them back', () => {
    const { result } = renderHook(useAppearance, { wrapper: AppearanceProvider })
    const next = { language: 'en', theme: 'dark', motion: 'slide', font: 'sans', template: 'slate', textSize: 'large' }
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(next))
    const write = vi.spyOn(Storage.prototype, 'setItem')
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: APP_SETTINGS_STORAGE_KEY, storageArea: localStorage })))
    expect(result.current.appearance).toEqual({ motion: 'slide', font: 'sans', template: 'slate', textSize: 'large' })
    expect(document.documentElement.dataset.template).toBe('slate')
    expect(write).not.toHaveBeenCalled()
  })

  it('ignores unrelated storage events and safely resets after cleared preferences', () => {
    const { result } = renderHook(useAppearance, { wrapper: AppearanceProvider })
    act(() => result.current.setAppearance('template', 'paper'))
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })))
    expect(result.current.appearance.template).toBe('paper')
    localStorage.clear()
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage })))
    expect(result.current.appearance).toEqual(DEFAULT_APPEARANCE)
  })

  it('restores appearance defaults while keeping locale/theme intact', () => {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en', theme: 'dark', template: 'paper', motion: 'none' }))
    const { result } = renderHook(useAppearance, { wrapper: AppearanceProvider })
    act(() => result.current.resetAppearance())
    expect(result.current.appearance).toEqual(DEFAULT_APPEARANCE)
    expect(stored()).toEqual({ language: 'en', theme: 'dark', ...DEFAULT_APPEARANCE })
  })

  it('honors changing system reduced-motion without replacing the saved choice', () => {
    const cancel = vi.fn()
    Object.defineProperty(document, 'getAnimations', { configurable: true, value: vi.fn(() => [{ cancel }]) })
    const { result } = renderHook(useMotionPreference, { wrapper: AppearanceProvider })
    act(() => { reduced = true; listeners.forEach(listener => listener()) })
    expect(result.current.effectiveMotion).toBe('none')
    expect(result.current.animationsEnabled).toBe(false)
    expect(document.documentElement.dataset.motionEnabled).toBe('false')
    expect(stored().motion).toBe('gentle')
    expect(cancel).toHaveBeenCalled()
    act(() => { reduced = false; listeners.forEach(listener => listener()) })
    expect(result.current.effectiveMotion).toBe('gentle')
    expect(document.documentElement.dataset.motionEnabled).toBe('true')
    Reflect.deleteProperty(document, 'getAnimations')
  })

  it('rejects unknown runtime choices without altering the existing preference', () => {
    const { result } = renderHook(useAppearance, { wrapper: AppearanceProvider })
    act(() => result.current.setAppearance('font', 'remote-url' as AppFont))
    expect(result.current.appearance.font).toBe('academic')
    expect(stored().font).toBe('academic')
  })

  it('can apply stored chrome before React is mounted without modifying theme or locale', () => {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en', theme: 'dark', font: 'system', template: 'slate', textSize: 'large', motion: 'none' }))
    document.documentElement.dataset.theme = 'light'
    document.documentElement.lang = 'zh-CN'
    applyStoredAppearance()
    expect(document.documentElement.dataset).toMatchObject({ font: 'system', template: 'slate', textSize: 'large', motion: 'none', motionEnabled: 'false', theme: 'light' })
    expect(document.documentElement.lang).toBe('zh-CN')
  })
})
