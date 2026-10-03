import { useState } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext } from '../app/workspace-context'
import { ProjectScopeBar, ProjectScopeProvider } from '../app/ProjectScope'
import { createDemoWorkspace } from '../models/demo'
import { I18nProvider } from '../i18n'
import { projectDisplayData, useProjectWorkspace } from './useProjectWorkspace'

beforeEach(() => { sessionStorage.clear(); localStorage.clear() })
afterEach(cleanup)

describe('project working space', () => {
  it('filters related records without mutating the source snapshot', () => {
    const full = createDemoWorkspace()
    const before = structuredClone(full)
    const project = full.projects[0]!.id
    const scoped = projectDisplayData(full, project)!
    expect(scoped.projects.map((item) => item.id)).toEqual([project])
    expect(scoped.tasks.every((item) => item.projectId === project)).toBe(true)
    expect(scoped.literatureExternalReferences.every((item) => scoped.literature.some((source) => source.id === item.literatureItemId))).toBe(true)
    expect(full).toEqual(before)
    expect(projectDisplayData(full, '')).toBe(full)
  })

  it('updates against the full snapshot while scoped and returns other projects intact', async () => {
    const full = createDemoWorkspace()
    const project = full.projects[0]!.id
    function Probe() {
      const { data, updateData } = useProjectWorkspace()
      return <><output aria-label="visible projects">{data?.projects.length}</output><button onClick={() => void updateData((current) => ({ ...current, tasks: [...current.tasks, { ...current.tasks[0]!, id: 'scope-new', projectId: project, title: 'SYNTHETIC scoped task' }] }))}>Save synthetic task</button><output aria-label="tasks">{data?.tasks.map((task) => task.title).join('|')}</output></>
    }
    let snapshot = full
    function Harness() {
      const [data, setData] = useState(full)
      return <WorkspaceContext.Provider value={{ data, loading: false, saving: false, error: null,
        updateData: async (updater) => setData((current) => { snapshot = updater(current); return snapshot }),
        setActiveProject: async () => {}, replaceWith: vi.fn(), mergeWith: vi.fn(), resetDemo: vi.fn(), refresh: vi.fn(), clearError: vi.fn(),
      }}><ProjectScopeProvider><ProjectScopeBar /><Probe /></ProjectScopeProvider></WorkspaceContext.Provider>
    }
    const user = userEvent.setup()
    render(<I18nProvider><Harness /></I18nProvider>)
    await user.selectOptions(screen.getByRole('combobox'), project)
    expect(screen.getByLabelText('visible projects')).toHaveTextContent('1')
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByLabelText('tasks')).toHaveTextContent('SYNTHETIC scoped task'))
    expect(snapshot.projects).toEqual(full.projects)
    expect(snapshot.tasks.filter((item) => item.projectId !== project)).toEqual(full.tasks.filter((item) => item.projectId !== project))
    await user.selectOptions(screen.getByRole('combobox'), '')
    expect(screen.getByLabelText('visible projects')).toHaveTextContent(String(full.projects.length))
    expect(snapshot.tasks).toHaveLength(full.tasks.length + 1)
  })

  it('keeps the latest scope choice when a previous project save finishes later', async () => {
    const full = createDemoWorkspace()
    let finishSave!: () => void
    const save = new Promise<void>((resolve) => { finishSave = resolve })
    const context = { data: full, loading: false, saving: false, error: null, updateData: vi.fn(), setActiveProject: () => save, replaceWith: vi.fn(), mergeWith: vi.fn(), resetDemo: vi.fn(), refresh: vi.fn(), clearError: vi.fn() }
    const user = userEvent.setup()
    render(<I18nProvider><WorkspaceContext.Provider value={context}><ProjectScopeProvider><ProjectScopeBar /></ProjectScopeProvider></WorkspaceContext.Provider></I18nProvider>)
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, full.projects[0]!.id)
    await user.selectOptions(select, '')
    await act(async () => finishSave())
    await waitFor(() => expect(select).toHaveValue(''))
    expect(sessionStorage.getItem(`sociology-desk-project-scope:${full.workspace.id}`)).toBe('')
  })
})
