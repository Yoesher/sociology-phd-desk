import { useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PageTransitionBoundary } from './PageTransitionBoundary'

function Harness() {
  const navigate = useNavigate()
  const [value, setValue] = useState('research draft')
  return (
    <PageTransitionBoundary>
      <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
      <button type="button" onClick={() => navigate('/projects?view=active')}>Projects</button>
      <button type="button" onClick={() => navigate('/projects?view=completed')}>Completed</button>
    </PageTransitionBoundary>
  )
}

describe('PageTransitionBoundary', () => {
  const animate = vi.fn(() => ({ cancel: vi.fn() }))

  beforeEach(() => {
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
})
