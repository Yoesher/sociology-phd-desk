import { useState, type ReactNode } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { todayIso } from '../../app/format'
import { I18nProvider } from '../../i18n'
import { createDemoWorkspace } from '../../models/demo'
import { TodayPage } from './TodayPage'

function renderToday() {
  const demo = createDemoWorkspace(new Date())
  const initialData = {
    ...demo,
    tasks: demo.tasks.map((task) => task.category === 'Theory / Conceptual Work'
      ? { ...task, dueDate: todayIso() }
      : task),
  }

  function Harness({ children }: { children: ReactNode }) {
    const [data, setData] = useState(initialData)
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => setData(updater)
    const context: WorkspaceContextValue = {
      data,
      loading: false,
      saving: false,
      error: null,
      updateData,
      setActiveProject: vi.fn(),
      replaceWith: vi.fn(),
      mergeWith: vi.fn() as WorkspaceContextValue['mergeWith'],
      resetDemo: vi.fn(),
      refresh: vi.fn(),
      clearError: vi.fn(),
    }
    return <WorkspaceContext.Provider value={context}>{children}</WorkspaceContext.Provider>
  }

  return render(<I18nProvider><Harness><TodayPage /></Harness></I18nProvider>)
}

describe('TodayPage theory work mode', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => cleanup())

  it('offers the stable theory task category and can filter visible tasks by it', async () => {
    const user = userEvent.setup()
    renderToday()

    await user.click(screen.getByRole('button', { name: '添加研究任务' }))
    const dialog = screen.getByRole('dialog', { name: '添加研究任务' })
    const option = within(dialog).getByRole('option', { name: '理论 / 概念工作' }) as HTMLOptionElement
    expect(option.value).toBe('Theory / Conceptual Work')
    await user.click(within(dialog).getByRole('button', { name: '取消' }))

    const filter = screen.getByRole('combobox', { name: '按工作类型筛选研究任务' })
    await user.selectOptions(filter, 'Theory / Conceptual Work')
    expect(screen.getByText('Review the synthetic concept boundary prompts')).toBeInTheDocument()
    expect(screen.queryByText('Review the three synthetic literature queue records')).not.toBeInTheDocument()
  })
})
