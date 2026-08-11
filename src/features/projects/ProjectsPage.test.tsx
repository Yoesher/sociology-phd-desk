import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '../../app/workspace-context'
import { I18nProvider } from '../../i18n'
import { createDemoWorkspace } from '../../models/demo'
import { ProjectsPage } from './ProjectsPage'

describe('ProjectsPage localization boundary', () => {
  beforeEach(() => window.localStorage.clear())

  it('shows Chinese labels while saving stable English enum values', async () => {
    const user = userEvent.setup()
    let snapshot = createDemoWorkspace(new Date('2026-08-11T00:00:00.000Z'))
    const updateData: WorkspaceContextValue['updateData'] = async (updater) => {
      snapshot = updater(snapshot)
    }
    const context: WorkspaceContextValue = {
      data: snapshot,
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

    render(
      <I18nProvider>
        <WorkspaceContext.Provider value={context}>
          <ProjectsPage />
        </WorkspaceContext.Provider>
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: '新建项目' }))
    const dialog = screen.getByRole('dialog', { name: '创建研究项目' })
    await user.type(within(dialog).getByLabelText(/项目标题/), '县域青年就业研究')
    await user.type(within(dialog).getByLabelText(/研究主题/), '劳动与流动')
    await user.type(within(dialog).getByLabelText(/研究问题/), '组织如何影响县域青年的就业流动？')

    const method = within(dialog).getByLabelText(/研究方法/) as HTMLSelectElement
    const localizedOption = within(dialog).getByRole('option', { name: '混合方法' }) as HTMLOptionElement
    expect(localizedOption.value).toBe('Mixed Methods')
    await user.selectOptions(method, 'Mixed Methods')
    await user.click(screen.getByRole('button', { name: '创建项目' }))

    expect(snapshot.projects[0]).toMatchObject({
      title: '县域青年就业研究',
      method: 'Mixed Methods',
      status: 'Idea',
    })
  })
})
