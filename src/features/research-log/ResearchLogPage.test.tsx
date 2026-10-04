import { useState, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { I18nProvider } from '../../i18n'
import { createDemoWorkspace } from '../../models/demo'
import type { ResearchLogEntry, WorkspaceData } from '../../models/domain'
import { ResearchLogPage } from './ResearchLogPage'

function renderLog(initial: WorkspaceData, route: string, onUpdate?: WorkspaceContextValue['updateData']) {
  function Harness({ children }: { children: ReactNode }) {
    const [data, setData] = useState(initial)
    const context: WorkspaceContextValue = {
      data,
      loading: false,
      saving: false,
      error: null,
      updateData: async (updater) => {
        await onUpdate?.(updater)
        setData(updater)
      },
      setActiveProject: vi.fn(),
      replaceWith: vi.fn(),
      mergeWith: vi.fn(),
      resetDemo: vi.fn(),
      refresh: vi.fn(),
      clearError: vi.fn(),
    }
    return <WorkspaceContext.Provider value={context}>{children}</WorkspaceContext.Provider>
  }
  return render(<I18nProvider><Harness><MemoryRouter initialEntries={[route]}><ResearchLogPage /></MemoryRouter></Harness></I18nProvider>)
}

function entry(template: ResearchLogEntry, id: string, date: string): ResearchLogEntry {
  return { ...template, id, date, whatChanged: `SYNTHETIC ${id}` }
}

describe('research log local calendar views', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('refreshes Today at midnight while keeping a manual unsaved date and all research text', async () => {
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 58))
    const data = createDemoWorkspace()
    data.researchLogs = [
      entry(data.researchLogs[0]!, 'previous-day', '2026-10-03'),
      entry(data.researchLogs[0]!, 'new-day', '2026-10-04'),
    ]
    const original = structuredClone(data)
    const writes = vi.fn()
    renderLog(data, '/research-log?view=timeline&period=today', writes)
    expect(screen.getByText('SYNTHETIC previous-day')).toBeInTheDocument()
    expect(screen.queryByText('SYNTHETIC new-day')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add log entry' }))
    const dialog = screen.getByRole('dialog', { name: 'Add a research log entry' })
    expect(within(dialog).getByLabelText(/Research date/)).toHaveValue('2026-10-03')
    fireEvent.change(within(dialog).getByLabelText(/Research date/), { target: { value: '2026-09-30' } })
    fireEvent.change(within(dialog).getByLabelText(/What changed/), { target: { value: 'SYNTHETIC untouched progress' } })
    fireEvent.change(within(dialog).getByLabelText(/Decision and rationale/), { target: { value: 'SYNTHETIC untouched reasoning' } })
    fireEvent.change(within(dialog).getByLabelText(/Next step/), { target: { value: 'SYNTHETIC untouched next step' } })

    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.queryByText('SYNTHETIC previous-day')).not.toBeInTheDocument()
    expect(screen.getByText('SYNTHETIC new-day')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Research date/)).toHaveValue('2026-09-30')
    expect(within(dialog).getByLabelText(/What changed/)).toHaveValue('SYNTHETIC untouched progress')
    expect(within(dialog).getByLabelText(/Decision and rationale/)).toHaveValue('SYNTHETIC untouched reasoning')
    expect(within(dialog).getByLabelText(/Next step/)).toHaveValue('SYNTHETIC untouched next step')
    expect(writes).not.toHaveBeenCalled()
    expect(data).toEqual(original)

    await act(async () => fireEvent.submit(document.getElementById('research-log-form')!))
    const saved = writes.mock.calls[0]![0](data) as WorkspaceData
    expect(saved.researchLogs[0]).toMatchObject({
      date: '2026-09-30',
      whatChanged: 'SYNTHETIC untouched progress',
      decision: 'SYNTHETIC untouched reasoning',
      nextStep: 'SYNTHETIC untouched next step',
    })
    expect(saved.researchLogs.slice(1)).toEqual(original.researchLogs)
    fireEvent.click(screen.getByRole('button', { name: 'Add log entry' }))
    expect(within(screen.getByRole('dialog', { name: 'Add a research log entry' })).getByLabelText(/Research date/)).toHaveValue('2026-10-04')
  })

  it('starts the week on the local Monday and refreshes its boundary on the next Monday', () => {
    // This also runs in Pacific/Kiritimati (UTC+14): the local Monday must
    // not become Sunday merely because its noon falls on the prior UTC day.
    vi.setSystemTime(new Date(2026, 9, 4, 23, 59, 58))
    const data = createDemoWorkspace()
    data.researchLogs = [
      entry(data.researchLogs[0]!, 'prior-sunday', '2026-09-27'),
      entry(data.researchLogs[0]!, 'this-monday', '2026-09-28'),
      entry(data.researchLogs[0]!, 'this-sunday', '2026-10-04'),
      entry(data.researchLogs[0]!, 'next-monday', '2026-10-05'),
    ]
    const writes = vi.fn()
    renderLog(data, '/research-log?view=timeline&period=week', writes)
    expect(screen.queryByText('SYNTHETIC prior-sunday')).not.toBeInTheDocument()
    expect(screen.getByText('SYNTHETIC this-monday')).toBeInTheDocument()
    expect(screen.getByText('SYNTHETIC this-sunday')).toBeInTheDocument()
    expect(screen.queryByText('SYNTHETIC next-monday')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.queryByText('SYNTHETIC this-monday')).not.toBeInTheDocument()
    expect(screen.queryByText('SYNTHETIC this-sunday')).not.toBeInTheDocument()
    expect(screen.getByText('SYNTHETIC next-monday')).toBeInTheDocument()
    expect(writes).not.toHaveBeenCalled()
  })

  it('refreshes month totals at the local month boundary and after recovering focus from sleep', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59, 58))
    const data = createDemoWorkspace()
    data.researchLogs = [
      entry(data.researchLogs[0]!, 'september-first', '2026-09-01'),
      entry(data.researchLogs[0]!, 'september-last', '2026-09-30'),
      entry(data.researchLogs[0]!, 'october-first', '2026-10-01'),
    ]
    const writes = vi.fn()
    renderLog(data, '/research-log?view=timeline', writes)
    const monthCard = screen.getByText('This month').closest('.stat-card') as HTMLElement
    expect(monthCard.querySelector('strong')).toHaveTextContent('2')
    act(() => vi.advanceTimersByTime(2_000))
    expect(monthCard.querySelector('strong')).toHaveTextContent('1')
    vi.setSystemTime(new Date(2026, 10, 2, 8))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(monthCard.querySelector('strong')).toHaveTextContent('0')
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(writes).not.toHaveBeenCalled()
  })
})
