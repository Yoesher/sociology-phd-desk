import { useState, type ReactNode } from 'react'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { todayIso } from '../../app/format'
import { I18nProvider } from '../../i18n'
import { createDemoWorkspace } from '../../models/demo'
import { createEmptyWorkspace } from '../../models/empty-workspace'
import type { WorkspaceData } from '../../models/domain'
import { TodayPage } from './TodayPage'

function renderToday(initialOverride?: WorkspaceData, route = '/?view=overview') {
  const demo = createDemoWorkspace(new Date())
  const initialData: WorkspaceData = initialOverride ?? {
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

  return render(<I18nProvider><Harness><MemoryRouter initialEntries={[route]}><TodayPage /></MemoryRouter></Harness></I18nProvider>)
}

describe('TodayPage theory work mode', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = ''
  })
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

  it('shows lightweight onboarding only for a truly empty personal workspace', () => {
    renderToday(createEmptyWorkspace({ id: 'empty-personal', now: new Date() }))

    expect(screen.getByRole('heading', { name: '开始你的研究工作台' })).toBeInTheDocument()
    expect(screen.getByText('创建研究项目')).toBeInTheDocument()
    expect(screen.getByText('写下第一个研究问题')).toBeInTheDocument()
    expect(screen.getByText('添加今天的研究任务')).toBeInTheDocument()
    expect(screen.getByText('定期备份工作台')).toBeInTheDocument()
  })

  it('derives the overdue task view from the URL without changing task data', () => {
    const demo = createDemoWorkspace(new Date())
    const overdueTitle = 'SYNTHETIC overdue smart-view task'
    const futureTitle = 'SYNTHETIC future smart-view task'
    const initial: WorkspaceData = {
      ...demo,
      tasks: [
        { ...demo.tasks[0], id: 'overdue-task', title: overdueTitle, dueDate: '2000-01-01', status: 'To Do' },
        { ...demo.tasks[0], id: 'future-task', title: futureTitle, dueDate: '2099-01-01', status: 'To Do' },
      ],
    }
    renderToday(initial, '/?view=overdue')

    expect(screen.getByText(overdueTitle)).toBeInTheDocument()
    expect(screen.queryByText(futureTitle)).not.toBeInTheDocument()
    expect(initial.tasks).toHaveLength(2)
  })

  it('shows saved deadlines and lets the researcher revisit notes and change the deadline', async () => {
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
    const demo = createDemoWorkspace()
    const title = 'SYNTHETIC deadline task'
    demo.tasks = [{ ...demo.tasks[0]!, title, dueDate: '2099-01-10', notes: 'SYNTHETIC task notes', status: 'Done' }]
    const user = userEvent.setup()
    renderToday(demo, '/?view=tasks')
    expect(screen.getByText(/Due:.*2099/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `View and edit ${title}` }))
    const dialog = screen.getByRole('dialog', { name: 'View and edit task' })
    expect(within(dialog).getByLabelText('Due date')).toHaveValue('2099-01-10')
    expect(within(dialog).getByLabelText('Notes')).toHaveValue('SYNTHETIC task notes')
    await user.clear(within(dialog).getByLabelText('Due date'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('No deadline')).toBeInTheDocument()
    expect(screen.getByText(title).closest('.check-row')).toHaveClass('check-row--done')
  })

  it('offers a next-seven-days view that excludes completed and later work', () => {
    localStorage.setItem('sociology-phd-desk-settings', JSON.stringify({ language: 'en' }))
    const demo = createDemoWorkspace()
    demo.tasks = [
      { ...demo.tasks[0]!, id: 'soon', title: 'SYNTHETIC due today', dueDate: todayIso(), status: 'To Do' },
      { ...demo.tasks[0]!, id: 'completed', title: 'SYNTHETIC done today', dueDate: todayIso(), status: 'Done' },
      { ...demo.tasks[0]!, id: 'later', title: 'SYNTHETIC due later', dueDate: '2099-01-01', status: 'To Do' },
    ]
    renderToday(demo, '/?view=tasks&filter=upcoming')
    expect(screen.getByText('SYNTHETIC due today')).toBeInTheDocument()
    expect(screen.queryByText('SYNTHETIC done today')).not.toBeInTheDocument()
    expect(screen.queryByText('SYNTHETIC due later')).not.toBeInTheDocument()
  })
})
