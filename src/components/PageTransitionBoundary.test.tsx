import { useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PageTransitionBoundary } from './PageTransitionBoundary'
import { AppearanceProvider } from '../app/AppearanceProvider'
import { useAppearance } from '../hooks/useAppearance'

function Harness() {
  const navigate = useNavigate()
  const [value, setValue] = useState('research draft')
  const { setAppearance } = useAppearance()
  return (
    <PageTransitionBoundary>
      <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
      <button type="button" onClick={() => navigate('/projects?view=active')}>Projects</button>
      <button type="button" onClick={() => navigate('/projects?view=completed')}>Completed</button>
      <button type="button" onClick={() => setAppearance('motion', 'none')}>No motion</button>
      <button type="button" onClick={() => setAppearance('motion', 'fade')}>Fade</button>
      <button type="button" onClick={() => setAppearance('motion', 'slide')}>Slide</button>
    </PageTransitionBoundary>
  )
}

describe('PageTransitionBoundary', () => {
  const animate = vi.fn(() => ({ cancel: vi.fn() }))

  beforeEach(() => {
    localStorage.clear()
    animate.mockClear()
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate
    Element.prototype.getAnimations = vi.fn(() => [])
    window.matchMedia = vi.fn(() => ({ matches: false } as MediaQueryList))
  })

  afterEach(cleanup)

  it('animates route and query changes without remounting user state', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Harness /></MemoryRouter>)
    const input = screen.getByRole('textbox', { name: 'Draft' })
    await user.clear(input)
    await user.type(input, 'unchanged user content')
    await user.click(screen.getByRole('button', { name: 'Projects' }))
    await user.click(screen.getByRole('button', { name: 'Completed' }))
    expect(input).toHaveValue('unchanged user content')
    expect(animate).toHaveBeenCalledTimes(2)
  })

  it('does not depend on animation when reduced motion is requested', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList)
    render(<MemoryRouter><Harness /></MemoryRouter>)
    act(() => screen.getByRole('button', { name: 'Projects' }).click())
    expect(animate).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBeInTheDocument()
  })

  it.each([
    ['Fade', [{ opacity: 0 }, { opacity: 1 }]],
    ['Slide', [{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'translateX(0)' }]],
  ])('uses the selected %s route style without remounting state', (button, frames) => {
    render(<AppearanceProvider><MemoryRouter><Harness /></MemoryRouter></AppearanceProvider>)
    act(() => screen.getByRole('button', { name: button }).click())
    act(() => screen.getByRole('button', { name: 'Projects' }).click())
    expect(animate).toHaveBeenCalledWith(frames, expect.objectContaining({ duration: 200 }))
    expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('research draft')
  })

  it('cancels a running route animation immediately when motion is turned off', () => {
    const cancel = vi.fn()
    animate.mockReturnValue({ cancel })
    render(<AppearanceProvider><MemoryRouter><Harness /></MemoryRouter></AppearanceProvider>)
    act(() => screen.getByRole('button', { name: 'Projects' }).click())
    expect(animate).toHaveBeenCalledTimes(1)
    act(() => screen.getByRole('button', { name: 'No motion' }).click())
    expect(cancel).toHaveBeenCalled()
    act(() => screen.getByRole('button', { name: 'Completed' }).click())
    expect(animate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBeInTheDocument()
  })

  it('does not fail navigation when WAAPI throws or is unavailable', () => {
    animate.mockImplementationOnce(() => { throw new Error('WAAPI unavailable') })
    render(<MemoryRouter><Harness /></MemoryRouter>)
    expect(() => act(() => screen.getByRole('button', { name: 'Projects' }).click())).not.toThrow()
    expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('research draft')
  })
})
