import { useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppearanceProvider } from '../app/AppearanceProvider'
import { useAppearance } from '../hooks/useAppearance'
import { I18nProvider } from '../i18n/I18nProvider'
import { Modal } from './ui'

function Harness() {
  const [open, setOpen] = useState(true)
  const { setAppearance } = useAppearance()
  return <>
    <button onClick={() => setAppearance('motion', 'none')}>Disable motion</button>
    <button onClick={() => setOpen(false)}>Close externally</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Research draft"><input defaultValue="Preserved research" /></Modal>
  </>
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  // Exercise the production exit lifecycle rather than the legacy test-only shortcut.
  vi.stubEnv('MODE', 'production')
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('central motion policy for modal exits', () => {
  it('turns off a pending animated exit and removes its delay immediately', () => {
    render(<I18nProvider><AppearanceProvider><Harness /></AppearanceProvider></I18nProvider>)
    const timeout = vi.spyOn(window, 'setTimeout')
    const clear = vi.spyOn(window, 'clearTimeout')
    act(() => screen.getByText('Close externally').click())
    expect(document.querySelector('[role="dialog"]')).toHaveAttribute('data-closing')
    const exitIndex = timeout.mock.calls.findIndex(([, delay]) => delay === 160)
    expect(exitIndex).toBeGreaterThanOrEqual(0)
    const exitTimer = timeout.mock.results[exitIndex].value
    act(() => screen.getByText('Disable motion').click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(clear).toHaveBeenCalledWith(exitTimer)
  })

  it('has no exit timer when none was selected before dismissal', () => {
    render(<I18nProvider><AppearanceProvider><Harness /></AppearanceProvider></I18nProvider>)
    act(() => screen.getByText('Disable motion').click())
    expect(screen.getByRole('textbox')).toHaveValue('Preserved research')
    const timeout = vi.spyOn(window, 'setTimeout')
    act(() => screen.getByText('Close externally').click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(timeout.mock.calls.filter(([, delay]) => delay === 160)).toHaveLength(0)
  })

  it('dismisses without a timer when system reduced motion is enabled', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    render(<I18nProvider><AppearanceProvider><Harness /></AppearanceProvider></I18nProvider>)
    const timeout = vi.spyOn(window, 'setTimeout')
    act(() => screen.getByText('Close externally').click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(timeout.mock.calls.filter(([, delay]) => delay === 160)).toHaveLength(0)
  })
})
