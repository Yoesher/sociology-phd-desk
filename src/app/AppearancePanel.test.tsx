import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../i18n/settings'
import { AppearanceProvider } from './AppearanceProvider'
import { AppearancePanel } from './AppearancePanel'

function renderPanel() {
  return render(<I18nProvider><AppearanceProvider><AppearancePanel onClose={vi.fn()} /></AppearanceProvider></I18nProvider>)
}

describe('appearance settings panel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('offers every style in Chinese and applies the selected font, size, template and motion', async () => {
    renderPanel()
    const user = userEvent.setup()
    expect(screen.getByRole('dialog', { name: '外观与动效' })).toBeVisible()
    expect(screen.getByLabelText('界面模板').querySelectorAll('option')).toHaveLength(4)
    expect(screen.getByLabelText('字体风格').querySelectorAll('option')).toHaveLength(4)
    expect(screen.getByLabelText('字号').querySelectorAll('option')).toHaveLength(3)
    expect(screen.getByLabelText('切换动画').querySelectorAll('option')).toHaveLength(4)
    await user.selectOptions(screen.getByLabelText('界面模板'), 'forest')
    await user.selectOptions(screen.getByLabelText('字体风格'), 'serif')
    await user.selectOptions(screen.getByLabelText('字号'), 'larger')
    await user.selectOptions(screen.getByLabelText('切换动画'), 'none')
    expect(document.documentElement.dataset).toMatchObject({ template: 'forest', font: 'serif', textSize: 'larger', motion: 'none' })
    expect(JSON.parse(window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)!)).toMatchObject({ language: 'zh-CN', template: 'forest', font: 'serif', textSize: 'larger', motion: 'none' })
  })

  it('restores only appearance defaults and retains the existing English and dark-mode choices', async () => {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en', theme: 'dark', template: 'paper', font: 'sans', textSize: 'large', motion: 'slide' }))
    renderPanel()
    expect(screen.getByRole('dialog', { name: 'Appearance & motion' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Restore appearance defaults' }))
    expect(JSON.parse(window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)!)).toMatchObject({ language: 'en', theme: 'dark', template: 'classic', font: 'academic', textSize: 'standard', motion: 'gentle' })
    expect(screen.getByLabelText('Interface template')).toHaveValue('classic')
    expect(screen.getByLabelText('Font style')).toHaveValue('academic')
  })

  it('shows a truthful unsaved message when a browser rejects storage while retaining the in-memory choice', async () => {
    renderPanel()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    await userEvent.selectOptions(screen.getByLabelText('界面模板'), 'slate')
    expect(screen.getByRole('alert')).toHaveTextContent('无法保存到下次访问')
    expect(screen.getByLabelText('界面模板')).toHaveValue('slate')
    expect(document.documentElement.dataset.template).toBe('slate')
  })
})
